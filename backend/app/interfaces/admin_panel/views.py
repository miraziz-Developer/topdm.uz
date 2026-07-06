"""Admin panel ko'rinishlari — read-only analiz + maxsus foyda sahifasi."""
from __future__ import annotations

import html
from decimal import Decimal, InvalidOperation

from sqladmin import BaseView, ModelView, expose
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse, Response

from app.application.admin.shop_moderation import AdminShopModerationService
from app.interfaces.admin_panel.theme import (
    admin_page,
    empty_state,
    flash_block,
    stat_card,
    table_panel,
)
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
        ShopModel.verification_status,
        ShopModel.verification_reason,
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
        flash = flash_block(msg=msg, err=err)

        rows = []
        for s in sweeps:
            status = s["status"]
            badge_cls = {"pending": "pending", "completed": "ok", "cancelled": "no"}.get(status, "pending")
            actions = ""
            if status == "pending":
                actions = (
                    '<form method="post" style="display:inline-flex;gap:6px;flex-wrap:wrap" onsubmit="return confirm(\'Tasdiqlaysizmi?\')">'
                    '<input type="hidden" name="action" value="complete">'
                    f'<input type="hidden" name="sweep_id" value="{html.escape(s["id"])}">'
                    '<input type="text" name="reference" placeholder="click-tx-id" style="width:120px">'
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
                f'<td><strong>{_fmt(s["amount_uzs"])}</strong> so\'m</td>'
                f'<td><span class="badge {badge_cls}">{html.escape(status)}</span></td>'
                f'<td>{html.escape(s.get("reference") or "—")}</td>'
                f'<td>{html.escape((s.get("created_at") or "")[:19].replace("T", " "))}</td>'
                f'<td>{html.escape((s.get("processed_at") or "-")[:19].replace("T", " "))}</td>'
                f"<td>{actions}</td>"
                "</tr>"
            )
        rows_html = "".join(rows) if rows else f'<tr><td colspan="6">{empty_state("Sweep tarixi bo\'sh", emoji="📭")}</td></tr>'

        cards = "".join(
            [
                stat_card("Jami foyda", _fmt(summary["earned_profit_uzs"]), None, icon="📈", tone="blue"),
                stat_card("Band (pending)", _fmt(summary["swept_pending_uzs"]), None, icon="⏳", tone="amber"),
                stat_card("Yechilgan", _fmt(summary["swept_completed_uzs"]), None, icon="✓", tone="green"),
                stat_card("Yechish mumkin", f"{_fmt(summary['withdrawable_uzs'])}", None, icon="💰", tone="green", hint="so'm"),
            ]
        )

        inner = f"""{flash}
<div class="cards">{cards}</div>
<div class="panel">
  <div class="panel-head"><h2>Yangi sweep</h2></div>
  <div class="panel-body padded">
    <form method="post" class="form-stack" style="max-width:420px">
      <input type="hidden" name="action" value="create">
      <div class="form-group"><label>Summa (so'm)</label><input type="number" name="amount_uzs" min="1" step="1" required></div>
      <div class="form-group"><label>Izoh</label><input type="text" name="note" placeholder="Ixtiyoriy"></div>
      <button class="btn primary" type="submit">Sweep yaratish</button>
    </form>
    <p style="color:var(--text-muted);font-size:12px;margin:12px 0 0">Click ilovasida kartaga o'tkazing, keyin sweep ni tasdiqlang.</p>
  </div>
</div>
{table_panel("Sweep tarixi", ["Summa", "Holat", "Reference", "Yaratilgan", "Bajarilgan", "Amal"], rows_html)}"""

        return admin_page(
            "Platforma foydasi",
            inner,
            active="profit",
            subtitle="Faqat yetkazilgan buyurtmalar komissiyasi. Escrow (do'konchilar puli) tegilmaydi.",
        )


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
        flash = flash_block(msg=msg, err=err)
        is_auto = bool(summary.get("automatic"))
        rows = []
        for p in pending:
            rows.append(
                "<tr>"
                f'<td><strong>{html.escape(p.get("shop_name") or p["shop_id"][:8])}</strong></td>'
                f'<td>{_fmt(p["amount_uzs"])} so\'m</td>'
                f'<td>{html.escape(_mask_card(p.get("card_number") or ""))}</td>'
                f'<td>{html.escape((p.get("created_at") or "")[:19].replace("T", " "))}</td>'
                "<td>"
                '<form method="post" style="display:inline-flex;gap:6px;flex-wrap:wrap" onsubmit="return confirm(\'Tasdiqlansinmi?\')">'
                '<input type="hidden" name="action" value="complete_one">'
                f'<input type="hidden" name="payout_id" value="{html.escape(p["id"])}">'
                '<input type="text" name="reference" placeholder="ref" style="width:80px">'
                '<button class="btn ok" type="submit">To\'landi</button>'
                '</form> '
                '<form method="post" style="display:inline" onsubmit="return confirm(\'Bekor qilinsinmi?\')">'
                '<input type="hidden" name="action" value="cancel_one">'
                f'<input type="hidden" name="payout_id" value="{html.escape(p["id"])}">'
                '<button class="btn danger" type="submit">Bekor</button>'
                '</form>'
                "</td>"
                "</tr>"
            )
        rows_html = "".join(rows) if rows else f'<tr><td colspan="5">{empty_state("Pending to\'lov yo\'q", emoji="✓")}</td></tr>'

        auto_btn = ""
        if is_auto:
            auto_btn = (
                '<form method="post" style="display:inline" onsubmit="return confirm(\'Avtomatik tolansinmi?\')">'
                '<input type="hidden" name="action" value="auto">'
                '<button class="btn primary" type="submit">Avtomatik to\'lash</button>'
                "</form>"
            )

        mode_badge = "AVTO" if is_auto else "BATCH"
        cards = "".join(
            [
                stat_card("Pending", str(summary["pending_count"]), None, icon="📋", tone="amber"),
                stat_card("Jami summa", _fmt(summary["pending_total_uzs"]), None, icon="💳", tone="purple", hint="so'm"),
                stat_card("Rejim", mode_badge, None, icon="⚙", tone="blue"),
            ]
        )

        inner = f"""{flash}
<div class="cards">{cards}</div>
<div class="panel">
  <div class="panel-head"><h2>Ommaviy to'lov</h2></div>
  <div class="panel-body padded">
    <div class="btn-row">
      <a class="btn ghost" href="/admin/merchant-payouts/reestr.csv">⬇ Reestr CSV</a>
      {auto_btn}
      <form method="post" style="display:inline-flex;gap:8px;align-items:center" onsubmit="return confirm('Hammasi to\'landi deb belgilansinmi?')">
        <input type="hidden" name="action" value="complete_all">
        <input type="text" name="reference" placeholder="reestr ref" style="width:120px">
        <button class="btn ok" type="submit">Hammasini to'landi</button>
      </form>
    </div>
    <p style="color:var(--text-muted);font-size:12px;margin:12px 0 0">Batch: CSV yuklab oling → bank/Click → «Hammasini to'landi».</p>
  </div>
</div>
{table_panel("Pending to'lovlar", ["Do'kon", "Summa", "Karta", "So'ralgan", "Amal"], rows_html, count=len(pending))}"""

        return admin_page(
            "Do'konchi to'lovlari",
            inner,
            active="payouts",
            subtitle="Yetkazilgan buyurtmalardan do'konchilarga tegishli pul so'rovlari.",
        )


class AdminDashboardView(BaseView):
    """Platforma boshqaruv — CRM uslubidagi umumiy ko'rinish."""

    name = "Boshqaruv paneli"
    icon = "fa-solid fa-gauge-high"

    @expose("/", methods=["GET"])
    async def dashboard(self, request: Request):
        async with AsyncSessionFactory() as session:
            mod = AdminShopModerationService(session)
            counts = await mod.dashboard_counts()
            from app.application.billing.platform_profit_service import PlatformProfitService

            profit = await PlatformProfitService(session).summary()
            pending_shops = await mod.list_pending(limit=5)

        cards = [
            ("Kutilayotgan do'konlar", counts["pending_shops"], "/admin/shop-moderation", "🏪", "amber", "Tasdiqlash kerak"),
            ("To'lov so'rovlari", counts["pending_payouts"], "/admin/merchant-payouts", "💳", "purple", "Pending"),
            ("CRM murojaatlar", counts["open_support_tickets"], "/admin/merchant-support-ticket/list", "💬", "red", "Ochiq"),
            ("Yechish mumkin", int(profit.get("withdrawable_uzs") or 0), "/admin/platform-profit", "💰", "green", "so'm"),
        ]
        card_html = "".join(
            stat_card(
                label,
                _fmt(val) if isinstance(val, (int, float)) else str(val),
                href,
                icon=icon,
                tone=tone,
                hint=hint,
            )
            for label, val, href, icon, tone, hint in cards
        )
        rows = []
        for s in pending_shops:
            rows.append(
                "<tr>"
                f'<td><strong>{html.escape(s.name)}</strong></td>'
                f'<td>{html.escape(s.owner_phone or "—")}</td>'
                f'<td>{html.escape(s.market_zone or "—")}</td>'
                f'<td><a class="link-btn" href="/admin/shop-moderation?shop={s.id}">Ko\'rish</a></td>'
                "</tr>"
            )
        rows_html = "".join(rows) if rows else f'<tr><td colspan="4">{empty_state("Kutilayotgan do\'kon arizasi yo\'q", emoji="🎉")}</td></tr>'

        body = admin_page(
            "Boshqaruv paneli",
            f"""
  <div class="cards">{card_html}</div>
  {table_panel("So'nggi do'kon arizalari", ["Do'kon", "Telefon", "Bozor", ""], rows_html, count=len(pending_shops),
    footer='''<div class="quick-links">
      <a class="btn ghost" href="/admin/shop-moderation">Barcha do'kon arizalari</a>
      <a class="btn ghost" href="/admin/merchant-payouts">To'lovlar</a>
    </div>''')}
""",
            active="dashboard",
            subtitle="Do'kon moderatsiyasi va to'lovlar — barchasi bir joyda.",
        )
        return HTMLResponse(body)


class ShopModerationView(BaseView):
    """Do'kon ro'yxatdan o'tish — qo'lda tasdiqlash / rad etish."""

    name = "Do'kon moderatsiyasi"
    icon = "fa-solid fa-user-check"

    @expose("/shop-moderation", methods=["GET", "POST"])
    async def moderation_page(self, request: Request):
        path = "/admin/shop-moderation"
        shop_focus = request.query_params.get("shop")
        if request.method == "POST":
            return await self._handle_post(request, path)

        msg = request.query_params.get("msg")
        err = request.query_params.get("err")
        async with AsyncSessionFactory() as session:
            svc = AdminShopModerationService(session)
            pending = await svc.list_pending(limit=100)
            focus = None
            if shop_focus:
                try:
                    from uuid import UUID

                    focus = await svc.get_shop(UUID(shop_focus))
                except ValueError:
                    focus = None

        return HTMLResponse(self._render(pending, focus=focus, msg=msg, err=err))

    async def _handle_post(self, request: Request, path: str):
        from uuid import UUID

        from app.application.admin.shop_moderation import ShopModerationError

        form = await request.form()
        action = str(form.get("action") or "")
        shop_id_raw = str(form.get("shop_id") or "")
        try:
            shop_id = UUID(shop_id_raw)
        except ValueError:
            return RedirectResponse(f"{path}?err=Noto'g'ri do'kon ID", status_code=303)

        async with AsyncSessionFactory() as session:
            svc = AdminShopModerationService(session)
            try:
                if action == "approve":
                    await svc.approve(shop_id, note=str(form.get("note") or "") or None)
                    return RedirectResponse(f"{path}?msg=Tasdiqlandi", status_code=303)
                if action == "reject":
                    reason = str(form.get("reason") or "").strip() or "Moderator talablariga mos emas."
                    await svc.reject(shop_id, reason=reason)
                    return RedirectResponse(f"{path}?msg=Rad etildi", status_code=303)
            except ShopModerationError as exc:
                return RedirectResponse(f"{path}?err={html.escape(str(exc))}", status_code=303)
        return RedirectResponse(path, status_code=303)

    def _render(self, pending: list, *, focus, msg: str | None, err: str | None) -> str:
        flash = flash_block(msg=msg, err=err)

        detail = ""
        if focus:
            img = (focus.storefront_image_url or focus.logo_url or "").strip()
            img_html = (
                f'<img class="thumb" src="{html.escape(img)}" alt="Vitrina">'
                if img
                else '<div class="thumb-placeholder">Rasm yuklanmagan</div>'
            )
            detail = f"""
<div class="panel focus" style="margin-bottom:24px">
  <div class="panel-head"><h2>{html.escape(focus.name)}</h2><span class="badge pending">kutilmoqda</span></div>
  <div class="panel-body padded">
    <div class="detail-grid">
      <div>
        <ul class="meta-list">
          <li><strong>Telefon</strong> {html.escape(focus.owner_phone or "—")}</li>
          <li><strong>Bozor</strong> {html.escape(focus.market_zone or "—")}</li>
          <li><strong>Rasta</strong> {html.escape(focus.block_sector or "")} {html.escape(focus.stall_number or "")}</li>
          <li><strong>Holat</strong> {html.escape(focus.verification_status or "pending_review")}</li>
        </ul>
        <div class="split-forms">
          <div class="approve-box">
            <h3>✓ Tasdiqlash</h3>
            <form method="post" class="form-stack">
              <input type="hidden" name="shop_id" value="{focus.id}">
              <input type="hidden" name="action" value="approve">
              <div class="form-group">
                <label>Izoh (ixtiyoriy)</label>
                <input type="text" name="note" placeholder="Masalan: barcha ma'lumotlar to'g'ri">
              </div>
              <button class="btn ok" type="submit">Tasdiqlash — CRM ochiladi</button>
            </form>
          </div>
          <div class="reject-box">
            <h3>✕ Rad etish</h3>
            <form method="post" class="form-stack" onsubmit="return confirm('Rad etilsinmi? Sotuvchiga izoh boradi.')">
              <input type="hidden" name="shop_id" value="{focus.id}">
              <input type="hidden" name="action" value="reject">
              <div class="form-group">
                <label>Sabab (majburiy)</label>
                <textarea name="reason" placeholder="Nima uchun rad etilmoqda?" required></textarea>
              </div>
              <button class="btn danger" type="submit">Rad etish</button>
            </form>
          </div>
        </div>
      </div>
      <div>{img_html}</div>
    </div>
  </div>
</div>"""

        rows = []
        for s in pending:
            rows.append(
                "<tr>"
                f'<td><strong>{html.escape(s.name)}</strong></td>'
                f'<td>{html.escape(s.owner_phone or "—")}</td>'
                f'<td>{html.escape(s.market_zone or "—")}</td>'
                f'<td><span class="badge pending">{html.escape(s.verification_status or "pending")}</span></td>'
                f'<td><a class="link-btn" href="/admin/shop-moderation?shop={s.id}">Moderatsiya</a></td>'
                "</tr>"
            )
        rows_html = "".join(rows) if rows else f'<tr><td colspan="5">{empty_state("Barcha arizalar ko\'rib chiqilgan", emoji="🎉")}</td></tr>'

        inner = f"""{flash}{detail}{table_panel(
            "Kutilayotgan arizalar",
            ["Do'kon", "Telefon", "Bozor", "Holat", ""],
            rows_html,
            count=len(pending),
        )}"""

        return admin_page(
            "Do'kon moderatsiyasi",
            inner,
            active="shops",
            subtitle="Har bir arizani qo'lda tasdiqlang yoki rad eting. Tasdiqlangach login/parol Telegram orqali yuboriladi.",
        )


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

ALL_CUSTOM_VIEWS = [
    AdminDashboardView,
    ShopModerationView,
    PlatformProfitView,
    MerchantPayoutView,
]
