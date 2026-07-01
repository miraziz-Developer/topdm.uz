"""Admin panel ko'rinishlari — read-only analiz + maxsus foyda sahifasi."""
from __future__ import annotations

import html
from decimal import Decimal, InvalidOperation

from sqladmin import BaseView, ModelView, expose
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse, Response

from app.application.billing.payout_service import MerchantPayoutService, PayoutError
from app.application.billing.platform_profit_service import (
    PlatformProfitError,
    PlatformProfitService,
)
from app.infrastructure.db.models import (
    AppUserModel,
    OrderModel,
    ProductModel,
    ShopModel,
)
from app.infrastructure.db.session import AsyncSessionFactory
from app.models.delivery_claim import DeliveryClaimModel, MerchantPayoutRequestModel
from app.models.merchant_support import MerchantSupportFaqModel, MerchantSupportTicketModel
from app.models.finance import (
    MerchantFinanceWalletModel,
    PlatformProfitSweepModel,
    PlatformTransactionModel,
)


class _ReadOnly(ModelView):
    """Moliyaviy/asosiy jadvallar uchun read-only baza (escrow yaxlitligi uchun)."""

    can_create = False
    can_edit = False
    can_delete = False
    can_view_details = True
    can_export = True
    page_size = 50
    page_size_options = [25, 50, 100, 200]


class ShopAdmin(_ReadOnly, model=ShopModel):
    name = "Do'kon"
    name_plural = "Do'konlar"
    icon = "fa-solid fa-store"
    category = "Marketplace"
    column_list = [
        ShopModel.id,
        ShopModel.name,
        ShopModel.owner_phone,
        ShopModel.shop_type,
        ShopModel.is_verified,
        ShopModel.is_active,
        ShopModel.is_blocked,
        ShopModel.rating,
        ShopModel.review_count,
        ShopModel.debt_balance,
    ]
    column_searchable_list = [ShopModel.name, ShopModel.owner_phone, ShopModel.slug]
    column_sortable_list = [ShopModel.name, ShopModel.rating, ShopModel.review_count, ShopModel.debt_balance]
    column_default_sort = [(ShopModel.name, False)]


class ProductAdmin(_ReadOnly, model=ProductModel):
    name = "Mahsulot"
    name_plural = "Mahsulotlar"
    icon = "fa-solid fa-box"
    category = "Marketplace"
    column_list = [
        ProductModel.id,
        ProductModel.name,
        ProductModel.shop_id,
        ProductModel.price,
        ProductModel.sale_type,
        ProductModel.stock_count,
        ProductModel.is_available,
        ProductModel.view_count,
        ProductModel.lead_count,
    ]
    column_searchable_list = [ProductModel.name]
    column_sortable_list = [ProductModel.price, ProductModel.stock_count, ProductModel.view_count]
    column_details_exclude_list = [ProductModel.embedding, ProductModel.visual_embedding]


class OrderAdmin(_ReadOnly, model=OrderModel):
    name = "Buyurtma"
    name_plural = "Buyurtmalar"
    icon = "fa-solid fa-receipt"
    category = "Marketplace"
    column_list = [
        OrderModel.id,
        OrderModel.customer_phone,
        OrderModel.shop_id,
        OrderModel.total_price,
        OrderModel.status,
        OrderModel.fulfillment_type,
        OrderModel.payment_method,
        OrderModel.created_at,
    ]
    column_searchable_list = [OrderModel.customer_phone]
    column_sortable_list = [OrderModel.total_price, OrderModel.created_at, OrderModel.status]
    column_default_sort = [(OrderModel.created_at, True)]


class AppUserAdmin(_ReadOnly, model=AppUserModel):
    name = "Foydalanuvchi"
    name_plural = "Foydalanuvchilar"
    icon = "fa-solid fa-user"
    category = "Marketplace"
    column_list = [
        AppUserModel.id,
        AppUserModel.display_name,
        AppUserModel.phone,
        AppUserModel.email,
        AppUserModel.telegram_id,
        AppUserModel.created_at,
    ]
    column_searchable_list = [AppUserModel.phone, AppUserModel.email, AppUserModel.display_name]
    column_default_sort = [(AppUserModel.created_at, True)]


class PlatformTransactionAdmin(_ReadOnly, model=PlatformTransactionModel):
    name = "Split tranzaksiya"
    name_plural = "Split tranzaksiyalar (escrow)"
    icon = "fa-solid fa-money-bill-transfer"
    category = "Moliya"
    column_list = [
        PlatformTransactionModel.id,
        PlatformTransactionModel.order_id,
        PlatformTransactionModel.shop_id,
        PlatformTransactionModel.total_amount_received,
        PlatformTransactionModel.merchant_share,
        PlatformTransactionModel.delivery_share,
        PlatformTransactionModel.platform_commission,
        PlatformTransactionModel.status,
        PlatformTransactionModel.created_at,
    ]
    column_sortable_list = [
        PlatformTransactionModel.created_at,
        PlatformTransactionModel.platform_commission,
        PlatformTransactionModel.status,
    ]
    column_default_sort = [(PlatformTransactionModel.created_at, True)]


class FinanceWalletAdmin(_ReadOnly, model=MerchantFinanceWalletModel):
    name = "Do'kon hamyoni"
    name_plural = "Do'kon hamyonlari (settlement)"
    icon = "fa-solid fa-wallet"
    category = "Moliya"
    column_list = [
        MerchantFinanceWalletModel.shop_id,
        MerchantFinanceWalletModel.current_balance,
        MerchantFinanceWalletModel.frozen_balance,
        MerchantFinanceWalletModel.updated_at,
    ]
    column_sortable_list = [
        MerchantFinanceWalletModel.current_balance,
        MerchantFinanceWalletModel.frozen_balance,
    ]


class PayoutRequestAdmin(_ReadOnly, model=MerchantPayoutRequestModel):
    name = "To'lov so'rovi"
    name_plural = "Do'kon to'lov so'rovlari"
    icon = "fa-solid fa-hand-holding-dollar"
    category = "Moliya"
    column_list = [
        MerchantPayoutRequestModel.id,
        MerchantPayoutRequestModel.shop_id,
        MerchantPayoutRequestModel.amount_uzs,
        MerchantPayoutRequestModel.status,
        MerchantPayoutRequestModel.destination,
        MerchantPayoutRequestModel.created_at,
        MerchantPayoutRequestModel.processed_at,
    ]
    column_sortable_list = [
        MerchantPayoutRequestModel.created_at,
        MerchantPayoutRequestModel.amount_uzs,
        MerchantPayoutRequestModel.status,
    ]
    column_default_sort = [(MerchantPayoutRequestModel.created_at, True)]


class ProfitSweepAdmin(_ReadOnly, model=PlatformProfitSweepModel):
    name = "Foyda sweep"
    name_plural = "Foyda sweep tarixi"
    icon = "fa-solid fa-piggy-bank"
    category = "Moliya"
    column_list = [
        PlatformProfitSweepModel.id,
        PlatformProfitSweepModel.amount_uzs,
        PlatformProfitSweepModel.status,
        PlatformProfitSweepModel.destination,
        PlatformProfitSweepModel.reference,
        PlatformProfitSweepModel.created_at,
        PlatformProfitSweepModel.processed_at,
    ]
    column_sortable_list = [
        PlatformProfitSweepModel.created_at,
        PlatformProfitSweepModel.amount_uzs,
        PlatformProfitSweepModel.status,
    ]
    column_default_sort = [(PlatformProfitSweepModel.created_at, True)]


class DeliveryClaimAdmin(_ReadOnly, model=DeliveryClaimModel):
    name = "Yetkazma"
    name_plural = "Yetkazmalar (BTS)"
    icon = "fa-solid fa-truck"
    category = "Moliya"
    column_list = [
        DeliveryClaimModel.id,
        DeliveryClaimModel.order_id,
        DeliveryClaimModel.shop_id,
        DeliveryClaimModel.status,
        DeliveryClaimModel.delivery_cost,
        DeliveryClaimModel.created_at,
        DeliveryClaimModel.delivered_at,
    ]
    column_sortable_list = [DeliveryClaimModel.created_at, DeliveryClaimModel.status]
    column_default_sort = [(DeliveryClaimModel.created_at, True)]


class MerchantSupportTicketAdmin(ModelView, model=MerchantSupportTicketModel):
    name = "CRM murojaat"
    name_plural = "CRM murojaatlar (muammo/taklif)"
    icon = "fa-solid fa-headset"
    category = "Marketplace"
    can_create = False
    can_delete = False
    can_edit = True
    can_view_details = True
    page_size = 50
    column_list = [
        MerchantSupportTicketModel.id,
        MerchantSupportTicketModel.shop_id,
        MerchantSupportTicketModel.category,
        MerchantSupportTicketModel.message,
        MerchantSupportTicketModel.status,
        MerchantSupportTicketModel.merchant_phone,
        MerchantSupportTicketModel.created_at,
    ]
    column_searchable_list = [MerchantSupportTicketModel.message, MerchantSupportTicketModel.merchant_phone]
    column_sortable_list = [MerchantSupportTicketModel.created_at, MerchantSupportTicketModel.status]
    column_default_sort = [(MerchantSupportTicketModel.created_at, True)]
    form_columns = [
        MerchantSupportTicketModel.status,
        MerchantSupportTicketModel.admin_note,
    ]
    column_details_list = [
        MerchantSupportTicketModel.id,
        MerchantSupportTicketModel.shop_id,
        MerchantSupportTicketModel.category,
        MerchantSupportTicketModel.message,
        MerchantSupportTicketModel.status,
        MerchantSupportTicketModel.admin_note,
        MerchantSupportTicketModel.merchant_phone,
        MerchantSupportTicketModel.merchant_email,
        MerchantSupportTicketModel.created_at,
        MerchantSupportTicketModel.updated_at,
    ]


class MerchantSupportFaqAdmin(ModelView, model=MerchantSupportFaqModel):
    name = "AI FAQ"
    name_plural = "AI yordam FAQ (bilim bazasi)"
    icon = "fa-solid fa-circle-question"
    category = "Marketplace"
    can_create = True
    can_delete = True
    can_edit = True
    can_view_details = True
    page_size = 50
    column_list = [
        MerchantSupportFaqModel.topic,
        MerchantSupportFaqModel.question,
        MerchantSupportFaqModel.is_active,
        MerchantSupportFaqModel.sort_order,
        MerchantSupportFaqModel.updated_at,
    ]
    column_searchable_list = [
        MerchantSupportFaqModel.topic,
        MerchantSupportFaqModel.question,
        MerchantSupportFaqModel.answer,
        MerchantSupportFaqModel.keywords,
    ]
    column_sortable_list = [
        MerchantSupportFaqModel.sort_order,
        MerchantSupportFaqModel.topic,
        MerchantSupportFaqModel.updated_at,
    ]
    column_default_sort = [(MerchantSupportFaqModel.sort_order, False)]
    form_columns = [
        MerchantSupportFaqModel.topic,
        MerchantSupportFaqModel.question,
        MerchantSupportFaqModel.answer,
        MerchantSupportFaqModel.keywords,
        MerchantSupportFaqModel.sort_order,
        MerchantSupportFaqModel.is_active,
    ]


def _fmt(value: float) -> str:
    return f"{int(round(value)):,}".replace(",", " ")


class PlatformProfitView(BaseView):
    """Platforma foydasini ko'rish va shaxsiy kartaga sweep qilish (maxsus sahifa)."""

    name = "Platforma Foydasi"
    icon = "fa-solid fa-coins"

    @expose("/platform-profit", methods=["GET", "POST"])
    async def profit_page(self, request: Request):
        path = request.url.path
        if request.method == "POST":
            return await self._handle_post(request, path)

        msg = request.query_params.get("msg")
        err = request.query_params.get("err")
        async with AsyncSessionFactory() as session:
            service = PlatformProfitService(session)
            summary = await service.summary()
            sweeps = (await service.list_sweeps(limit=50))["items"]
        body = self._render(summary, sweeps, msg=msg, err=err)
        return HTMLResponse(body)

    async def _handle_post(self, request: Request, path: str):
        form = await request.form()
        action = str(form.get("action") or "")
        async with AsyncSessionFactory() as session:
            service = PlatformProfitService(session)
            try:
                if action == "create":
                    raw = str(form.get("amount_uzs") or "").replace(" ", "").replace(",", "")
                    try:
                        amount = Decimal(raw)
                    except (InvalidOperation, ValueError):
                        return RedirectResponse(f"{path}?err=Noto'g'ri summa", status_code=303)
                    note = str(form.get("note") or "") or None
                    res = await service.create_sweep(amount_uzs=amount, note=note)
                    return RedirectResponse(
                        f"{path}?msg=Sweep yaratildi: {_fmt(res['amount_uzs'])} so'm band qilindi",
                        status_code=303,
                    )
                if action == "complete":
                    sweep_id = str(form.get("sweep_id") or "")
                    reference = str(form.get("reference") or "") or None
                    from uuid import UUID

                    await service.complete_sweep(UUID(sweep_id), reference=reference)
                    return RedirectResponse(f"{path}?msg=Sweep tasdiqlandi", status_code=303)
                if action == "cancel":
                    sweep_id = str(form.get("sweep_id") or "")
                    from uuid import UUID

                    await service.cancel_sweep(UUID(sweep_id))
                    return RedirectResponse(f"{path}?msg=Sweep bekor qilindi", status_code=303)
            except PlatformProfitError as exc:
                return RedirectResponse(f"{path}?err={html.escape(str(exc))}", status_code=303)
            except Exception as exc:  # noqa: BLE001
                return RedirectResponse(f"{path}?err={html.escape(type(exc).__name__)}", status_code=303)
        return RedirectResponse(path, status_code=303)

    def _render(self, summary: dict, sweeps: list[dict], *, msg: str | None, err: str | None) -> str:
        flash = ""
        if msg:
            flash += f'<div class="flash ok">{html.escape(msg)}</div>'
        if err:
            flash += f'<div class="flash err">{html.escape(err)}</div>'

        rows = []
        for s in sweeps:
            status = s["status"]
            badge = {
                "pending": "#b45309",
                "completed": "#15803d",
                "cancelled": "#b91c1c",
            }.get(status, "#475569")
            actions = ""
            if status == "pending":
                actions = (
                    '<form method="post" style="display:inline" onsubmit="return confirm(\'Tasdiqlaysizmi?\')">'
                    '<input type="hidden" name="action" value="complete">'
                    f'<input type="hidden" name="sweep_id" value="{html.escape(s["id"])}">'
                    '<input type="text" name="reference" placeholder="click-tx-id" style="width:130px">'
                    '<button class="btn ok" type="submit">Tasdiqlash</button>'
                    '</form> '
                    '<form method="post" style="display:inline" onsubmit="return confirm(\'Bekor qilinsinmi?\')">'
                    '<input type="hidden" name="action" value="cancel">'
                    f'<input type="hidden" name="sweep_id" value="{html.escape(s["id"])}">'
                    '<button class="btn danger" type="submit">Bekor</button>'
                    '</form>'
                )
            rows.append(
                "<tr>"
                f'<td>{_fmt(s["amount_uzs"])}</td>'
                f'<td><span class="badge" style="background:{badge}">{html.escape(status)}</span></td>'
                f'<td>{html.escape(s.get("reference") or "-")}</td>'
                f'<td>{html.escape((s.get("created_at") or "")[:19].replace("T", " "))}</td>'
                f'<td>{html.escape((s.get("processed_at") or "-")[:19].replace("T", " "))}</td>'
                f"<td>{actions}</td>"
                "</tr>"
            )
        rows_html = "".join(rows) or '<tr><td colspan="6" style="text-align:center;color:#94a3b8">Hozircha sweep yo\'q</td></tr>'

        return f"""<!doctype html>
<html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Platforma Foydasi</title>
<style>
  body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin:0; background:#0f172a; color:#e2e8f0; }}
  .wrap {{ max-width: 960px; margin: 0 auto; padding: 24px 16px 64px; }}
  a.back {{ color:#38bdf8; text-decoration:none; font-size:14px; }}
  h1 {{ font-size: 22px; margin: 12px 0 4px; }}
  .sub {{ color:#94a3b8; font-size:13px; margin-bottom:20px; }}
  .cards {{ display:grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:24px; }}
  .card {{ background:#1e293b; border:1px solid #334155; border-radius:12px; padding:16px; }}
  .card .label {{ color:#94a3b8; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }}
  .card .val {{ font-size:24px; font-weight:700; margin-top:6px; }}
  .card.hl {{ background:#064e3b; border-color:#047857; }}
  .panel {{ background:#1e293b; border:1px solid #334155; border-radius:12px; padding:18px; margin-bottom:20px; }}
  .panel h2 {{ font-size:15px; margin:0 0 12px; }}
  input[type=text], input[type=number] {{ background:#0f172a; border:1px solid #334155; color:#e2e8f0; border-radius:8px; padding:8px 10px; margin:2px; }}
  .btn {{ border:0; border-radius:8px; padding:8px 14px; cursor:pointer; font-weight:600; color:#fff; }}
  .btn.primary {{ background:#2563eb; }}
  .btn.ok {{ background:#16a34a; }}
  .btn.danger {{ background:#dc2626; }}
  table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  th, td {{ text-align:left; padding:8px 10px; border-bottom:1px solid #334155; }}
  th {{ color:#94a3b8; font-weight:600; }}
  .badge {{ color:#fff; padding:2px 8px; border-radius:999px; font-size:11px; }}
  .flash {{ padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:14px; }}
  .flash.ok {{ background:#065f46; }}
  .flash.err {{ background:#7f1d1d; }}
  .note {{ color:#94a3b8; font-size:12px; margin-top:8px; }}
</style></head>
<body><div class="wrap">
  <a class="back" href="/admin">&larr; Admin panel</a>
  <h1>Platforma Foydasi</h1>
  <div class="sub">Faqat yetkazilgan (released) buyurtmalar komissiyasi. Escrow (do'konchilar puli) hech qachon tegilmaydi.</div>
  {flash}
  <div class="cards">
    <div class="card"><div class="label">Jami foyda (released)</div><div class="val">{_fmt(summary['earned_profit_uzs'])}</div></div>
    <div class="card"><div class="label">Band (pending)</div><div class="val">{_fmt(summary['swept_pending_uzs'])}</div></div>
    <div class="card"><div class="label">Yechilgan (completed)</div><div class="val">{_fmt(summary['swept_completed_uzs'])}</div></div>
    <div class="card hl"><div class="label">Yechish mumkin</div><div class="val">{_fmt(summary['withdrawable_uzs'])} so'm</div></div>
  </div>

  <div class="panel">
    <h2>Yangi sweep (kartaga ko'chirish uchun band qilish)</h2>
    <form method="post">
      <input type="hidden" name="action" value="create">
      <input type="number" name="amount_uzs" placeholder="Summa (so'm)" min="1" step="1" required>
      <input type="text" name="note" placeholder="Izoh (ixtiyoriy)" style="width:220px">
      <button class="btn primary" type="submit">Sweep yaratish</button>
    </form>
    <div class="note">Sweep yaratgach, Click ilovasida o'sha summani shaxsiy kartangizga o'tkazasiz, keyin "Tasdiqlash" tugmasi bilan click-tx-id ni yozib qo'yasiz.</div>
  </div>

  <div class="panel">
    <h2>Sweep tarixi</h2>
    <table>
      <thead><tr><th>Summa</th><th>Holat</th><th>Reference</th><th>Yaratilgan</th><th>Bajarilgan</th><th>Amal</th></tr></thead>
      <tbody>{rows_html}</tbody>
    </table>
  </div>
</div></body></html>"""


def _mask_card(card: str) -> str:
    digits = "".join(ch for ch in (card or "") if ch.isdigit())
    if len(digits) == 16:
        return f"{digits[:4]} **** **** {digits[-4:]}"
    return card or "-"


class MerchantPayoutView(BaseView):
    """Do'konchilarga to'lov — batch (reestr) yoki avtomatik."""

    name = "Do'konchi To'lovlari"
    icon = "fa-solid fa-hand-holding-dollar"

    @expose("/merchant-payouts/reestr.csv", methods=["GET"])
    async def reestr_csv(self, request: Request):
        async with AsyncSessionFactory() as session:
            service = MerchantPayoutService(session)
            csv_text = await service.generate_reestr_csv()
        return Response(
            content=csv_text,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="payout_reestr.csv"'},
        )

    @expose("/merchant-payouts", methods=["GET", "POST"])
    async def payouts_page(self, request: Request):
        path = "/admin/merchant-payouts"
        if request.method == "POST":
            return await self._handle_post(request, path)
        msg = request.query_params.get("msg")
        err = request.query_params.get("err")
        async with AsyncSessionFactory() as session:
            service = MerchantPayoutService(session)
            summary = await service.summary()
            pending = await service.list_pending()
        return HTMLResponse(self._render(summary, pending, msg=msg, err=err))

    async def _handle_post(self, request: Request, path: str):
        from uuid import UUID

        form = await request.form()
        action = str(form.get("action") or "")
        async with AsyncSessionFactory() as session:
            service = MerchantPayoutService(session)
            try:
                if action == "complete_one":
                    pid = UUID(str(form.get("payout_id")))
                    ref = str(form.get("reference") or "") or None
                    await service.complete_payout(pid, reference=ref)
                    return RedirectResponse(f"{path}?msg=To'lov tasdiqlandi", status_code=303)
                if action == "cancel_one":
                    pid = UUID(str(form.get("payout_id")))
                    await service.cancel_payout(pid)
                    return RedirectResponse(f"{path}?msg=To'lov bekor qilindi (pul qaytdi)", status_code=303)
                if action == "complete_all":
                    ref = str(form.get("reference") or "") or None
                    res = await service.complete_all_pending(reference=ref)
                    return RedirectResponse(
                        f"{path}?msg={res['completed']} ta to'lov completed, {len(res['failed'])} ta xato",
                        status_code=303,
                    )
                if action == "auto":
                    res = await service.process_auto()
                    return RedirectResponse(
                        f"{path}?msg=Avtomatik: {res.get('completed', 0)} ta to'landi",
                        status_code=303,
                    )
            except PayoutError as exc:
                return RedirectResponse(f"{path}?err={html.escape(str(exc))}", status_code=303)
            except Exception as exc:  # noqa: BLE001
                return RedirectResponse(f"{path}?err={html.escape(type(exc).__name__)}", status_code=303)
        return RedirectResponse(path, status_code=303)

    def _render(self, summary: dict, pending: list[dict], *, msg: str | None, err: str | None) -> str:
        flash = ""
        if msg:
            flash += f'<div class="flash ok">{html.escape(msg)}</div>'
        if err:
            flash += f'<div class="flash err">{html.escape(err)}</div>'

        is_auto = bool(summary.get("automatic"))
        rows = []
        for p in pending:
            rows.append(
                "<tr>"
                f'<td>{html.escape(p.get("shop_name") or p["shop_id"][:8])}</td>'
                f'<td>{_fmt(p["amount_uzs"])}</td>'
                f'<td>{html.escape(_mask_card(p.get("card_number") or ""))}</td>'
                f'<td>{html.escape((p.get("created_at") or "")[:19].replace("T", " "))}</td>'
                "<td>"
                '<form method="post" style="display:inline" onsubmit="return confirm(\'Tasdiqlansinmi?\')">'
                '<input type="hidden" name="action" value="complete_one">'
                f'<input type="hidden" name="payout_id" value="{html.escape(p["id"])}">'
                '<input type="text" name="reference" placeholder="ref" style="width:90px">'
                '<button class="btn ok" type="submit">To\'landi</button>'
                '</form> '
                '<form method="post" style="display:inline" onsubmit="return confirm(\'Bekor qilinsinmi? Pul qaytadi.\')">'
                '<input type="hidden" name="action" value="cancel_one">'
                f'<input type="hidden" name="payout_id" value="{html.escape(p["id"])}">'
                '<button class="btn danger" type="submit">Bekor</button>'
                '</form>'
                "</td>"
                "</tr>"
            )
        rows_html = "".join(rows) or '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Pending to\'lov yo\'q</td></tr>'

        auto_btn = ""
        if is_auto:
            auto_btn = (
                '<form method="post" style="display:inline" onsubmit="return confirm(\'Avtomatik tolansinmi?\')">'
                '<input type="hidden" name="action" value="auto">'
                '<button class="btn primary" type="submit">⚡ Avtomatik to\'lash (API)</button>'
                "</form>"
            )

        mode_badge = "AVTO (API)" if is_auto else "BATCH (reestr)"
        return f"""<!doctype html>
<html lang="uz"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Do'konchi To'lovlari</title>
<style>
  body {{ font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin:0; background:#0f172a; color:#e2e8f0; }}
  .wrap {{ max-width: 1000px; margin:0 auto; padding:24px 16px 64px; }}
  a.back {{ color:#38bdf8; text-decoration:none; font-size:14px; }}
  h1 {{ font-size:22px; margin:12px 0 4px; }}
  .sub {{ color:#94a3b8; font-size:13px; margin-bottom:20px; }}
  .cards {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:20px; }}
  .card {{ background:#1e293b; border:1px solid #334155; border-radius:12px; padding:16px; }}
  .card .label {{ color:#94a3b8; font-size:12px; text-transform:uppercase; }}
  .card .val {{ font-size:24px; font-weight:700; margin-top:6px; }}
  .panel {{ background:#1e293b; border:1px solid #334155; border-radius:12px; padding:18px; margin-bottom:20px; }}
  .panel h2 {{ font-size:15px; margin:0 0 12px; }}
  input[type=text] {{ background:#0f172a; border:1px solid #334155; color:#e2e8f0; border-radius:8px; padding:8px 10px; margin:2px; }}
  .btn {{ border:0; border-radius:8px; padding:8px 14px; cursor:pointer; font-weight:600; color:#fff; text-decoration:none; display:inline-block; }}
  .btn.primary {{ background:#2563eb; }} .btn.ok {{ background:#16a34a; }} .btn.danger {{ background:#dc2626; }} .btn.gray {{ background:#475569; }}
  table {{ width:100%; border-collapse:collapse; font-size:13px; }}
  th, td {{ text-align:left; padding:8px 10px; border-bottom:1px solid #334155; }}
  th {{ color:#94a3b8; }}
  .flash {{ padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:14px; }}
  .flash.ok {{ background:#065f46; }} .flash.err {{ background:#7f1d1d; }}
  .badge {{ background:#334155; padding:3px 10px; border-radius:999px; font-size:12px; }}
  .note {{ color:#94a3b8; font-size:12px; margin-top:8px; line-height:1.5; }}
</style></head>
<body><div class="wrap">
  <a class="back" href="/admin">&larr; Admin panel</a>
  <h1>Do'konchi To'lovlari <span class="badge">{mode_badge}</span></h1>
  <div class="sub">Yetkazilgan buyurtmalardan do'konchilarga tegishli pul (current_balance) bo'yicha so'rovlar.</div>
  {flash}
  <div class="cards">
    <div class="card"><div class="label">Pending so'rovlar</div><div class="val">{summary['pending_count']}</div></div>
    <div class="card"><div class="label">Jami summa</div><div class="val">{_fmt(summary['pending_total_uzs'])} so'm</div></div>
    <div class="card"><div class="label">Rejim</div><div class="val" style="font-size:16px">{mode_badge}</div></div>
  </div>

  <div class="panel">
    <h2>Ommaviy to'lov (1 fayl + 1 tugma)</h2>
    <a class="btn gray" href="/admin/merchant-payouts/reestr.csv">⬇️ Reestr (CSV) yuklab olish</a>
    {auto_btn}
    <form method="post" style="display:inline" onsubmit="return confirm('Barcha pending tolandi deb belgilansinmi?')">
      <input type="hidden" name="action" value="complete_all">
      <input type="text" name="reference" placeholder="reestr ref / sana" style="width:140px">
      <button class="btn ok" type="submit">✅ Hammasini to'landi</button>
    </form>
    <div class="note">
      <b>Batch oqim:</b> 1) Reestr CSV ni yuklab oling → 2) Click Business / bank kabinetiga "ommaviy to'lov" sifatida yuklang → 3) "Hammasini to'landi" tugmasini bosing.<br>
      <b>Avto oqim</b> (YaTT + provayder shartnomasi bo'lsa, PAYOUT_MODE=auto): "Avtomatik to'lash" tugmasi har bir kartaga API orqali jo'natadi.
    </div>
  </div>

  <div class="panel">
    <h2>Pending to'lovlar</h2>
    <table>
      <thead><tr><th>Do'kon</th><th>Summa</th><th>Karta</th><th>So'ralgan</th><th>Amal</th></tr></thead>
      <tbody>{rows_html}</tbody>
    </table>
  </div>
</div></body></html>"""


ALL_MODEL_VIEWS = [
    ShopAdmin,
    ProductAdmin,
    OrderAdmin,
    AppUserAdmin,
    MerchantSupportTicketAdmin,
    MerchantSupportFaqAdmin,
    PlatformTransactionAdmin,
    FinanceWalletAdmin,
    PayoutRequestAdmin,
    ProfitSweepAdmin,
    DeliveryClaimAdmin,
]

ALL_CUSTOM_VIEWS = [PlatformProfitView, MerchantPayoutView]
