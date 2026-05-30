#!/usr/bin/env python3
"""
Frontend-facing API contract verification.
Validates response shapes and status codes expected by frontend/src/lib/api.ts
and merchant-crm/src/lib/api.ts.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import time
from typing import Any, Callable
from uuid import UUID

import httpx

API_BASE = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")
ROOT = API_BASE.replace("/api/v1", "")
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TEST_EMAIL = os.environ.get("TEST_EMAIL", "delivered@resend.dev").strip().lower()
IPPODROM_LAT = 41.2346
IPPODROM_LNG = 69.1834


def _is_str(v: Any) -> bool:
    return isinstance(v, str)


def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _is_bool(v: Any) -> bool:
    return isinstance(v, bool)


def _is_list(v: Any) -> bool:
    return isinstance(v, list)


def _is_dict(v: Any) -> bool:
    return isinstance(v, dict)


def assert_product(item: dict) -> list[str]:
    errs: list[str] = []
    for key in ("id", "name", "price", "images", "is_available", "shop"):
        if key not in item:
            errs.append(f"product missing {key}")
    if "price" in item and not _is_num(item["price"]):
        errs.append(f"product.price not number: {type(item['price'])}")
    shop = item.get("shop")
    if isinstance(shop, dict):
        if "ipadrom" not in shop and "ipadrom_name" not in shop:
            errs.append("product.shop missing ipadrom")
        if "ipadrom" in shop and not _is_str(shop["ipadrom"]):
            errs.append("product.shop.ipadrom not string")
    return errs


def assert_auth_token(data: dict) -> list[str]:
    errs: list[str] = []
    for key in ("status", "token", "role", "id"):
        if key not in data:
            errs.append(f"auth missing {key}")
    if "token" in data and not (_is_str(data["token"]) and len(data["token"]) > 20):
        errs.append("auth.token invalid")
    return errs


def assert_auth_me(data: dict) -> list[str]:
    errs: list[str] = []
    for key in ("id", "role", "has_email", "has_telegram"):
        if key not in data:
            errs.append(f"/auth/me missing {key}")
    if "shop" in data and data["shop"] is not None and not _is_dict(data["shop"]):
        errs.append("/auth/me shop not object")
    return errs


def assert_error_envelope(response: httpx.Response) -> list[str]:
    if response.is_success:
        return ["expected error response"]
    try:
        data = response.json()
    except Exception:
        return ["error body not json"]
    if "detail" not in data:
        return [f"error missing detail key: {list(data.keys())}"]
    return []


def telegram_payload(user_id: int = 9_990_033) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": user_id,
        "first_name": "Contract",
        "auth_date": int(time.time()),
        "hash": "",
    }
    check_string = "\n".join(f"{k}={payload[k]}" for k in sorted(payload.keys()) if k != "hash")
    secret = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
    payload["hash"] = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    return payload


class FrontendContractVerifier:
    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0
        self.client = httpx.Client(timeout=90.0, base_url=API_BASE)
        self.consumer_token: str | None = None
        self.sample_product_id: str | None = None
        self.sample_shop_slug: str | None = None
        self.chat_thread_id: str | None = None

    def check(self, name: str, errs: list[str]) -> None:
        if not errs:
            self.passed += 1
            print(f"  ✓ {name}")
        else:
            self.failed += 1
            print(f"  ✗ {name} — {'; '.join(errs)}")

    def run_case(
        self,
        name: str,
        method: str,
        path: str,
        *,
        json_body: dict | None = None,
        params: dict | None = None,
        auth: bool = False,
        expected_status: int | set[int] = 200,
        validate: Callable[[httpx.Response], list[str]] | None = None,
    ) -> httpx.Response | None:
        headers = {}
        if auth and self.consumer_token:
            headers["Authorization"] = f"Bearer {self.consumer_token}"
        response = self.client.request(method, path, json=json_body, params=params, headers=headers)
        statuses = {expected_status} if isinstance(expected_status, int) else expected_status
        errs: list[str] = []
        if response.status_code not in statuses:
            errs.append(f"status {response.status_code} expected {statuses}")
        if validate and response.status_code in statuses:
            errs.extend(validate(response))
        self.check(name, errs)
        return response

    def bootstrap_auth(self) -> None:
        self.section("Auth contracts (frontend AuthTokenResponse)")
        if TELEGRAM_BOT_TOKEN:
            r = self.run_case(
                "POST /auth/telegram",
                "POST",
                "/auth/telegram",
                json_body=telegram_payload(),
                validate=lambda res: assert_auth_token(res.json()),
            )
            if r and r.status_code == 200:
                self.consumer_token = r.json().get("token")

        sr = self.client.post("/auth/email/send-otp", json={"email": TEST_EMAIL})
        if sr.status_code == 200:
            otp = sr.json().get("dev_otp")
            if otp:
                vr = self.client.post("/auth/email/verify-otp", json={"email": TEST_EMAIL, "otp": str(otp)})
                self.check(
                    "POST /auth/email/verify-otp",
                    [] if vr.status_code == 200 and not assert_auth_token(vr.json()) else assert_auth_token(vr.json())
                    if vr.status_code != 200
                    else [],
                )
                if vr.status_code == 200:
                    self.consumer_token = vr.json().get("token") or self.consumer_token

        if self.consumer_token:
            self.run_case(
                "GET /auth/me",
                "GET",
                "/auth/me",
                auth=True,
                validate=lambda res: assert_auth_me(res.json()),
            )

    def run_catalog(self) -> None:
        self.section("Catalog & search (Product / PaginatedProducts)")

        def validate_featured(res: httpx.Response) -> list[str]:
            data = res.json()
            if not _is_dict(data) or not _is_list(data.get("items")):
                return ["featured items missing"]
            errs: list[str] = []
            for item in data["items"][:3]:
                errs.extend(assert_product(item))
                if not self.sample_product_id:
                    self.sample_product_id = item.get("id")
            return errs

        self.run_case("GET /products/featured", "GET", "/products/featured", validate=validate_featured)

        def validate_search(res: httpx.Response) -> list[str]:
            data = res.json()
            errs: list[str] = []
            for key in ("items", "total", "page"):
                if key not in data:
                    errs.append(f"search missing {key}")
            if _is_list(data.get("items")):
                for item in data["items"][:2]:
                    errs.extend(assert_product(item))
                    shop = item.get("shop") if _is_dict(item.get("shop")) else {}
                    if not self.sample_shop_slug and _is_str(shop.get("slug")):
                        self.sample_shop_slug = shop["slug"]
            return errs

        self.run_case(
            "GET /products/search",
            "GET",
            "/products/search",
            params={"q": "kurtka", "limit": 4},
            validate=validate_search,
        )

        if self.sample_product_id:
            self.run_case(
                "GET /products/{id}",
                "GET",
                f"/products/{self.sample_product_id}",
                validate=lambda res: assert_product(res.json()),
            )
            self.run_case(
                "GET /products/{id}/similar",
                "GET",
                f"/products/{self.sample_product_id}/similar",
                validate=lambda res: (
                    ["similar missing items"]
                    if not _is_list(res.json().get("items"))
                    else [e for i in res.json()["items"][:2] for e in assert_product(i)]
                ),
            )

        def validate_shops(res: httpx.Response) -> list[str]:
            data = res.json()
            if not _is_list(data.get("items")):
                return ["featured shops missing items"]
            errs: list[str] = []
            for shop in data["items"][:3]:
                if not _is_str(shop.get("id")):
                    errs.append("shop.id not string")
                if not _is_str(shop.get("name")):
                    errs.append("shop.name not string")
                if "ipadrom" not in shop:
                    errs.append("shop missing ipadrom (frontend ShopSummary)")
                elif not _is_str(shop["ipadrom"]):
                    errs.append("shop.ipadrom not string")
                if shop.get("slug") and not self.sample_shop_slug:
                    self.sample_shop_slug = shop["slug"]
            return errs

        self.run_case("GET /shops/featured", "GET", "/shops/featured", validate=validate_shops)

        if self.sample_shop_slug:
            self.run_case(
                "GET /shops/{slug}",
                "GET",
                f"/shops/{self.sample_shop_slug}",
                validate=lambda res: (
                    ["shop missing slug"]
                    if not _is_str(res.json().get("slug"))
                    else []
                ),
            )
            self.run_case(
                "GET /shops/{slug}/products",
                "GET",
                f"/shops/{self.sample_shop_slug}/products",
                validate=lambda res: (
                    ["shop products shape"]
                    if not (_is_dict(res.json().get("shop")) and _is_list(res.json().get("items")))
                    else [e for i in res.json()["items"][:2] for e in assert_product(i)]
                ),
            )

    def run_ai_and_maps(self) -> None:
        self.section("AI & indoor maps")

        def validate_agent(res: httpx.Response) -> list[str]:
            data = res.json()
            errs: list[str] = []
            if not _is_str(data.get("assistant_text")) and not _is_list(data.get("blocks")):
                errs.append("chat agent missing assistant_text/blocks")
            if "source" not in data:
                errs.append("chat agent missing source")
            return errs

        self.run_case(
            "POST /chat/agent/turn",
            "POST",
            "/chat/agent/turn",
            json_body={
                "user_id": "contract-test",
                "text": "Menga krossovka topib ber",
                "user_nav_node_id": "entrance-A",
            },
            validate=validate_agent,
        )

        def validate_stylist(res: httpx.Response) -> list[str]:
            data = res.json()
            errs: list[str] = []
            for key in ("source", "intent", "lookbook", "explanation"):
                if key not in data:
                    errs.append(f"stylist missing {key}")
            if "error" in data:
                errs.append("stylist returned error at 200")
            return errs

        self.run_case(
            "POST /stylist/lookbook",
            "POST",
            "/stylist/lookbook",
            json_body={"user_id": "contract-test", "text": "yozgi kiyim"},
            validate=validate_stylist,
        )

        def validate_route(res: httpx.Response) -> list[str]:
            data = res.json()
            if not _is_list(data.get("node_ids")) or len(data["node_ids"]) < 2:
                return ["route node_ids invalid"]
            if not _is_list(data.get("points")):
                return ["route points missing"]
            return []

        self.run_case(
            "GET indoor route",
            "GET",
            "/indoor-maps/ippodrom/levels/1/route",
            params={"start_node_id": "entrance-A", "goal_node_id": "corridor-B"},
            validate=validate_route,
        )

        self.run_case(
            "POST route/from-coordinates",
            "POST",
            "/indoor-maps/ippodrom/levels/1/route/from-coordinates",
            json_body={"lat": IPPODROM_LAT, "lng": IPPODROM_LNG, "goal_node_id": "corridor-C"},
            validate=validate_route,
        )

        def validate_map(res: httpx.Response) -> list[str]:
            data = res.json()
            if not _is_list(data.get("levels")):
                return ["indoor map levels missing"]
            level = data["levels"][0]
            if not _is_dict(level.get("navigation_graph")):
                return ["navigation_graph missing"]
            return []

        self.run_case("GET /indoor-maps/{slug}", "GET", "/indoor-maps/ippodrom", validate=validate_map)

    def run_chat_and_tracking(self) -> None:
        self.section("Chat, tracking, moderation")

        if self.sample_shop_slug:
            shop = self.client.get(f"/shops/{self.sample_shop_slug}").json()
            shop_id = shop.get("id")
            if shop_id:
                tr = self.client.post(
                    "/chat/threads",
                    json={
                        "shop_id": shop_id,
                        "customer_key": "contract-session-12345",
                        "customer_display_name": "Contract Test",
                    },
                )
                errs: list[str] = []
                if tr.status_code != 200:
                    errs.append(f"status {tr.status_code}")
                else:
                    thread = tr.json().get("thread")
                    if not _is_dict(thread) or not _is_str(thread.get("id")):
                        errs.append("thread.id missing")
                    else:
                        self.chat_thread_id = thread["id"]
                        try:
                            UUID(self.chat_thread_id)
                        except ValueError:
                            errs.append("thread.id not uuid")
                self.check("POST /chat/threads", errs)

                if self.chat_thread_id:
                    mr = self.client.get(f"/chat/threads/{self.chat_thread_id}/messages")
                    self.check(
                        "GET /chat/threads/{id}/messages",
                        []
                        if mr.status_code == 200 and _is_list(mr.json().get("items"))
                        else ["messages list invalid"],
                    )

        self.run_case(
            "POST /tracking/events",
            "POST",
            "/tracking/events",
            json_body={"event_type": "view", "metadata": {}},
            expected_status=200,
        )

        self.run_case(
            "POST /moderation/check-price",
            "POST",
            "/moderation/check-price",
            json_body={"price_uzs": 150_000, "product_name": "kurtka"},
            validate=lambda res: (
                []
                if _is_bool(res.json().get("flagged")) and _is_str(res.json().get("message"))
                else ["moderation shape"]
            ),
        )

    def run_error_envelopes(self) -> None:
        self.section("Error envelopes (detail key)")

        bad_email = self.client.post("/auth/email/send-otp", json={"email": "bad"})
        self.check("invalid email → 4xx + detail", assert_error_envelope(bad_email))

        missing_product = self.client.get("/products/00000000-0000-0000-0000-000000000000")
        self.check(
            "missing product → 404 + detail",
            assert_error_envelope(missing_product) if missing_product.status_code == 404 else ["not 404"],
        )

    def section(self, title: str) -> None:
        print(f"\n[{title}]")

    def run(self) -> int:
        print(f"Frontend API contract verification → {API_BASE}\n")
        health = httpx.get(f"{ROOT}/health", timeout=10)
        self.check("GET /health", [] if health.status_code == 200 else [f"status {health.status_code}"])

        self.bootstrap_auth()
        self.run_catalog()
        self.run_ai_and_maps()
        self.run_chat_and_tracking()
        self.run_error_envelopes()

        total = self.passed + self.failed
        print(f"\n{'=' * 56}")
        print(f"CONTRACT SUMMARY: {self.passed}/{total} passed, {self.failed} failed")
        if self.failed:
            print("RESULT: FAILED")
            return 1
        print("RESULT: 100% SUCCESS — frontend-safe")
        return 0


def main() -> None:
    raise SystemExit(FrontendContractVerifier().run())


if __name__ == "__main__":
    main()
