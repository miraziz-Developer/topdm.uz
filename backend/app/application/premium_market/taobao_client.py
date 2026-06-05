from __future__ import annotations

import re
from typing import Any

import httpx
from loguru import logger

from app.core.config import Settings


class TaobaoDataHubError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


_NUMERIC_ID = re.compile(r"^\d{8,20}$")
_TAOBAO_ID_IN_URL = re.compile(r"(?:[?&]id=|item/)(\d{8,20})")


class TaobaoDataHubClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._host = settings.taobao_datahub_host.strip()
        self._base = settings.taobao_datahub_base_url.rstrip("/")
        self._key = settings.rapidapi_key.strip()
        self._timeout = float(settings.external_api_timeout_seconds)

    def _headers(self) -> dict[str, str]:
        return {
            "x-rapidapi-host": self._host,
            "x-rapidapi-key": self._key,
            "Content-Type": "application/json",
        }

    async def resolve_item_id(self, raw: str) -> str:
        token = (raw or "").strip()
        if not token:
            raise TaobaoDataHubError("invalid_id", "Tovar ID bo'sh")
        if _NUMERIC_ID.match(token):
            return token
        url_match = _TAOBAO_ID_IN_URL.search(token)
        if url_match:
            return url_match.group(1)
        return await self._convert_item_id_str(token)

    async def _convert_item_id_str(self, item_id_str: str) -> str:
        url = f"{self._base}/itemidstr_convert"
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(url, headers=self._headers(), json={"itemIdStr": item_id_str})
        if resp.status_code >= 400:
            raise TaobaoDataHubError("upstream_error", "Taobao ID konvertatsiyasi muvaffaqiyatsiz")
        data = resp.json()
        item_id = _dig_item_id(data)
        if not item_id:
            raise TaobaoDataHubError("invalid_id", "Taobao itemId topilmadi")
        return item_id

    async def fetch_item_detail(self, item_id: str) -> dict[str, Any]:
        paths = [
            ("GET", f"/item_detail_simple", {"itemId": item_id}),
            ("GET", f"/item_detail", {"itemId": item_id}),
            ("GET", f"/item/detail", {"itemId": item_id}),
        ]
        last_err: str | None = None
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            for method, path, params in paths:
                url = f"{self._base}{path}"
                try:
                    if method == "GET":
                        resp = await client.get(url, headers=self._headers(), params=params)
                    else:
                        resp = await client.post(url, headers=self._headers(), json=params)
                    if resp.status_code == 403 and _rapidapi_not_subscribed(resp):
                        raise TaobaoDataHubError(
                            "not_subscribed",
                            "Taobao DataHub API obunasi yo'q. RapidAPI da «Subscribe to Test» ni bosing.",
                        )
                    if resp.status_code == 404:
                        last_err = "not_found"
                        continue
                    if resp.status_code >= 400:
                        last_err = f"http_{resp.status_code}"
                        continue
                    payload = resp.json()
                    if payload:
                        return payload
                except httpx.HTTPError as exc:
                    logger.warning("taobao_datahub_path_failed path={} err={}", path, exc)
                    last_err = "network"
        raise TaobaoDataHubError(last_err or "upstream_error", "Taobao tafsilotlari olinmadi")

    async def search_items(self, keyword: str, *, page: int = 1) -> list[dict[str, Any]]:
        """Taobao DataHub — Item Search by Keyword (RapidAPI playground bilan mos)."""
        kw = (keyword or "").strip()
        if not kw:
            raise TaobaoDataHubError("invalid_query", "Qidiruv kaliti bo'sh")

        page_no = max(1, int(page))
        attempts: list[tuple[str, str, dict[str, Any]]] = [
            ("GET", "/item_search", {"keyword": kw, "page": page_no, "pageSize": 20}),
            ("GET", "/item_search_by_keyword", {"keyword": kw, "page": page_no, "pageSize": 20}),
            ("GET", "/item_search_x", {"keyword": kw, "page": page_no, "pageSize": 20}),
            ("POST", "/item_search", {"keyword": kw, "page": page_no, "pageSize": 20}),
        ]
        last_err: str | None = None
        not_subscribed = False
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            for method, path, params in attempts:
                url = f"{self._base}{path}"
                try:
                    if method == "GET":
                        resp = await client.get(url, headers=self._headers(), params=params)
                    else:
                        resp = await client.post(url, headers=self._headers(), json=params)
                except httpx.HTTPError as exc:
                    logger.warning("taobao_search_failed path={} err={}", path, exc)
                    last_err = "network"
                    continue

                if resp.status_code == 403 and _rapidapi_not_subscribed(resp):
                    not_subscribed = True
                    last_err = "not_subscribed"
                    continue
                if resp.status_code == 429:
                    last_err = "rate_limit"
                    continue
                if resp.status_code == 404:
                    last_err = "not_found"
                    continue
                if resp.status_code >= 400:
                    last_err = f"http_{resp.status_code}"
                    logger.debug(
                        "taobao_search_http path={} status={} body={}",
                        path,
                        resp.status_code,
                        (resp.text or "")[:200],
                    )
                    continue
                payload = resp.json()
                hits = _extract_search_list(payload)
                if hits:
                    logger.info("taobao_search_ok path={} method={} hits={}", path, method, len(hits))
                    return hits

        if not_subscribed:
            raise TaobaoDataHubError(
                "not_subscribed",
                "Taobao DataHub API obunasi yo'q. RapidAPI da «Subscribe to Test» ni bosing.",
            )
        if last_err == "rate_limit":
            raise TaobaoDataHubError("rate_limit", "RapidAPI limiti — bir necha soniyadan keyin qayta urining.")
        raise TaobaoDataHubError(last_err or "upstream_error", "Taobao qidiruv natijasi topilmadi")


def _rapidapi_not_subscribed(resp: httpx.Response) -> bool:
    text = (resp.text or "").lower()
    return "not subscribed" in text or "subscription" in text


def _extract_search_list(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if not isinstance(payload, dict):
        return []
    for key in (
        "items",
        "item",
        "products",
        "list",
        "itemList",
        "item_list",
        "data",
        "result",
        "results",
        "auctions",
        "itemListVO",
    ):
        val = payload.get(key)
        if isinstance(val, list):
            rows = [x for x in val if isinstance(x, dict)]
            if rows:
                return rows
        if isinstance(val, dict):
            nested = _extract_search_list(val)
            if nested:
                return nested
    # Ba'zi javoblarda itemId to'g'ridan-to'g'ri root ichida
    if payload.get("itemId") or payload.get("num_iid"):
        return [payload]
    return []


def _dig_item_id(data: Any) -> str | None:
    if isinstance(data, dict):
        for key in ("itemId", "item_id", "num_iid", "id"):
            val = data.get(key)
            if val is not None and str(val).strip():
                return str(val).strip()
        for nest in ("data", "result", "item"):
            found = _dig_item_id(data.get(nest))
            if found:
                return found
    return None


def normalize_taobao_item(raw: dict[str, Any], *, resolved_id: str) -> dict[str, Any]:
    root = raw.get("data") if isinstance(raw.get("data"), dict) else raw
    if isinstance(root.get("item"), dict):
        root = root["item"]

    title = str(root.get("title") or root.get("name") or "").strip()
    images = _collect_images(root)
    price_cny = _parse_price(root.get("price") or root.get("promotion_price") or root.get("originPrice"))
    weight_kg = _parse_weight(root)
    colors, sizes, skus = _parse_skus(root)

    return {
        "item_id": resolved_id,
        "title": title or f"Taobao #{resolved_id}",
        "images": images,
        "description": str(root.get("desc") or root.get("description") or "").strip() or None,
        "base_price_cny": price_cny,
        "weight_kg": weight_kg,
        "colors": colors,
        "sizes": sizes,
        "skus": skus,
        "source_url": f"https://item.taobao.com/item.htm?id={resolved_id}",
    }


def _collect_images(root: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for key in ("images", "item_imgs", "pic_urls", "imageList"):
        val = root.get(key)
        if isinstance(val, list):
            for item in val:
                if isinstance(item, str) and item.strip():
                    out.append(item.strip())
                elif isinstance(item, dict):
                    u = item.get("url") or item.get("pic") or item.get("image")
                    if u:
                        out.append(str(u).strip())
        elif isinstance(val, str) and val.strip():
            out.append(val.strip())
    main = root.get("pic_url") or root.get("mainImage") or root.get("image")
    if main and str(main).strip():
        out.insert(0, str(main).strip())
    return list(dict.fromkeys(out))


def _parse_price(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace(",", "").strip()
    m = re.search(r"[\d.]+", text)
    return float(m.group()) if m else 0.0


def _parse_weight(root: dict[str, Any]) -> float:
    for key in ("weight", "weight_kg", "packageWeight"):
        if root.get(key) is not None:
            try:
                w = float(root[key])
                if w > 0:
                    return w if w < 50 else w / 1000
            except (TypeError, ValueError):
                pass
    return 0.5


def _parse_skus(root: dict[str, Any]) -> tuple[list[str], list[str], list[dict[str, Any]]]:
    colors: set[str] = set()
    sizes: set[str] = set()
    skus_out: list[dict[str, Any]] = []

    raw_skus = root.get("skus") or root.get("sku_list") or root.get("skuMap") or []
    if isinstance(raw_skus, dict):
        raw_skus = list(raw_skus.values())

    if isinstance(raw_skus, list):
        for row in raw_skus:
            if not isinstance(row, dict):
                continue
            props = str(row.get("properties_name") or row.get("name") or row.get("title") or "")
            color = str(row.get("color") or _prop(props, "rang", "color", "颜色") or "").strip()
            size = str(row.get("size") or _prop(props, "razmer", "size", "尺码") or "").strip()
            if color:
                colors.add(color)
            if size:
                sizes.add(size)
            price = _parse_price(row.get("price") or row.get("promotion_price"))
            skus_out.append(
                {
                    "sku_id": str(row.get("sku_id") or row.get("id") or ""),
                    "color": color or None,
                    "size": size or None,
                    "price_cny": price or None,
                    "stock": _safe_int(row.get("stock") or row.get("quantity")),
                    "image_url": str(row.get("pic_url") or row.get("image") or "").strip() or None,
                }
            )

    props = root.get("props") or root.get("properties")
    if isinstance(props, list):
        for p in props:
            if not isinstance(p, dict):
                continue
            name = str(p.get("name") or p.get("key") or "").lower()
            val = str(p.get("value") or p.get("valueName") or "").strip()
            if not val:
                continue
            if "color" in name or "rang" in name or "颜色" in name:
                colors.add(val)
            if "size" in name or "razmer" in name or "尺码" in name:
                sizes.add(val)

    return sorted(colors), sorted(sizes), skus_out


def _prop(text: str, *needles: str) -> str:
    lower = text.lower()
    for part in text.split(";"):
        chunk = part.strip()
        if not chunk:
            continue
        for n in needles:
            if n in chunk.lower():
                if ":" in chunk:
                    return chunk.split(":", 1)[-1].strip()
                return chunk
    if any(n in lower for n in needles):
        return text
    return ""


def _safe_int(value: Any) -> int | None:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return None
