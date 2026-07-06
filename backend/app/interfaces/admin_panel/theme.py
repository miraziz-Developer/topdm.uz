"""Bozorliii Admin — zamonaviy dashboard UI (shadcn/Tabler uslubida)."""

from __future__ import annotations

import html as html_lib

NAV_ITEMS: list[tuple[str, str, str, str]] = [
    ("dashboard", "Boshqaruv", "/admin/", "🏠"),
    ("shops", "Do'kon arizalari", "/admin/shop-moderation", "🏪"),
    ("payouts", "To'lovlar", "/admin/merchant-payouts", "💳"),
    ("profit", "Platforma foydasi", "/admin/platform-profit", "💰"),
    ("tables", "Ma'lumotlar jadvali", "/admin/shop/list", "📋"),
]

ADMIN_CSS = """
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  :root {
    --bg: #09090b;
    --bg-elevated: #0f0f12;
    --surface: #18181b;
    --surface-hover: #1f1f23;
    --border: #27272a;
    --border-subtle: #3f3f46;
    --text: #fafafa;
    --text-secondary: #a1a1aa;
    --text-muted: #71717a;
    --accent: #3b82f6;
    --accent-soft: rgba(59, 130, 246, 0.12);
    --accent-hover: #2563eb;
    --ok: #22c55e;
    --ok-soft: rgba(34, 197, 94, 0.12);
    --warn: #f59e0b;
    --warn-soft: rgba(245, 158, 11, 0.12);
    --danger: #ef4444;
    --danger-soft: rgba(239, 68, 68, 0.12);
    --purple: #a855f7;
    --purple-soft: rgba(168, 85, 247, 0.12);
    --radius: 12px;
    --radius-lg: 16px;
    --shadow: 0 1px 3px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.25);
    --sidebar-w: 260px;
  }

  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }

  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    margin: 0;
    background: var(--bg);
    color: var(--text);
    line-height: 1.55;
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }

  a { color: var(--accent); text-decoration: none; }
  a:hover { color: #93c5fd; }

  .app { display: flex; min-height: 100vh; }

  .sidebar {
    width: var(--sidebar-w);
    flex-shrink: 0;
    background: var(--bg-elevated);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0;
    height: 100vh;
    z-index: 40;
  }

  .brand {
    padding: 22px 20px 18px;
    border-bottom: 1px solid var(--border);
  }
  .brand-logo {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--text);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .brand-logo span {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; color: #fff; font-weight: 700;
  }
  .brand-sub { font-size: 12px; color: var(--text-muted); margin-top: 4px; padding-left: 42px; }

  .nav { padding: 14px 12px; flex: 1; overflow-y: auto; }
  .nav-label {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--text-muted);
    padding: 8px 12px 6px; margin-top: 4px;
  }
  .nav a {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 10px;
    color: var(--text-secondary); font-weight: 500; font-size: 13px;
    text-decoration: none; margin-bottom: 2px;
    transition: background .15s, color .15s;
  }
  .nav a:hover { background: var(--surface); color: var(--text); }
  .nav a.active {
    background: var(--accent-soft);
    color: #93c5fd;
    font-weight: 600;
  }
  .nav a .ico { width: 18px; text-align: center; opacity: .85; font-size: 12px; }

  .sidebar-foot {
    padding: 14px 16px;
    border-top: 1px solid var(--border);
    font-size: 11px; color: var(--text-muted);
  }

  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .topbar {
    padding: 16px 28px;
    border-bottom: 1px solid var(--border);
    background: rgba(9,9,11,.8);
    backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 30;
  }
  .topbar h1 {
    margin: 0; font-size: 22px; font-weight: 700;
    letter-spacing: -0.03em;
  }
  .topbar .sub { margin: 4px 0 0; color: var(--text-muted); font-size: 13px; max-width: 560px; }

  .content { padding: 24px 28px 64px; flex: 1; }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 18px 18px 16px;
    text-decoration: none; color: inherit;
    display: block;
    transition: border-color .15s, transform .15s, box-shadow .15s;
    position: relative; overflow: hidden;
  }
  .stat-card:hover {
    border-color: var(--border-subtle);
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }
  .stat-card .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .stat-card .icon {
    width: 40px; height: 40px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
  }
  .stat-card .icon.blue { background: var(--accent-soft); }
  .stat-card .icon.green { background: var(--ok-soft); }
  .stat-card .icon.amber { background: var(--warn-soft); }
  .stat-card .icon.red { background: var(--danger-soft); }
  .stat-card .icon.purple { background: var(--purple-soft); }
  .stat-card .label {
    font-size: 12px; font-weight: 500; color: var(--text-muted);
    margin-bottom: 6px;
  }
  .stat-card .val {
    font-size: 28px; font-weight: 700; letter-spacing: -0.03em;
    line-height: 1.1;
  }
  .stat-card .hint { font-size: 11px; color: var(--text-muted); margin-top: 8px; }

  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: 20px;
    overflow: hidden;
  }
  .panel-head {
    padding: 18px 22px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    flex-wrap: wrap;
  }
  .panel-head h2 { margin: 0; font-size: 15px; font-weight: 600; }
  .panel-head .count {
    font-size: 12px; font-weight: 600; color: var(--text-muted);
    background: var(--bg); padding: 4px 10px; border-radius: 999px;
    border: 1px solid var(--border);
  }
  .panel-body { padding: 0; }
  .panel-body.padded { padding: 22px; }
  .panel.focus { border-color: rgba(59,130,246,.45); box-shadow: 0 0 0 1px rgba(59,130,246,.2); }

  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 12px 22px; border-bottom: 1px solid var(--border); }
  th {
    color: var(--text-muted); font-weight: 600; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.05em;
    background: var(--bg-elevated);
  }
  tr:last-child td { border-bottom: 0; }
  tbody tr:hover td { background: rgba(255,255,255,.02); }
  td .link-btn {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 6px 12px; border-radius: 8px;
    background: var(--accent-soft); color: #93c5fd;
    font-weight: 600; font-size: 12px;
  }
  td .link-btn:hover { background: rgba(59,130,246,.22); color: #bfdbfe; text-decoration: none; }

  .empty {
    text-align: center; padding: 48px 24px; color: var(--text-muted);
  }
  .empty .emoji { font-size: 36px; margin-bottom: 12px; opacity: .6; }
  .empty p { margin: 0; font-size: 14px; }

  .flash {
    padding: 14px 18px; border-radius: var(--radius);
    margin-bottom: 20px; font-size: 13px; font-weight: 500;
    display: flex; align-items: center; gap: 10px;
  }
  .flash.ok { background: var(--ok-soft); border: 1px solid rgba(34,197,94,.3); color: #86efac; }
  .flash.err { background: var(--danger-soft); border: 1px solid rgba(239,68,68,.3); color: #fca5a5; }

  .badge {
    display: inline-flex; align-items: center;
    padding: 3px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  }
  .badge.pending { background: var(--warn-soft); color: #fcd34d; }
  .badge.ok { background: var(--ok-soft); color: #86efac; }
  .badge.no { background: var(--danger-soft); color: #fca5a5; }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 24px;
    align-items: start;
  }
  @media (max-width: 800px) {
    .detail-grid { grid-template-columns: 1fr; }
    .sidebar { display: none; }
    .content { padding: 16px; }
  }

  .meta-list { list-style: none; padding: 0; margin: 0 0 16px; }
  .meta-list li {
    padding: 8px 0; border-bottom: 1px solid var(--border);
    font-size: 13px; color: var(--text-secondary);
    display: flex; gap: 8px;
  }
  .meta-list li strong { color: var(--text-muted); font-weight: 500; min-width: 72px; }

  .thumb {
    width: 100%; max-height: 280px; object-fit: cover;
    border-radius: var(--radius); border: 1px solid var(--border);
    background: var(--bg);
  }
  .thumb-placeholder {
    width: 100%; height: 200px; border-radius: var(--radius);
    border: 1px dashed var(--border-subtle);
    display: flex; align-items: center; justify-content: center;
    color: var(--text-muted); font-size: 13px; background: var(--bg);
  }

  .form-stack { display: flex; flex-direction: column; gap: 14px; max-width: 480px; }
  .form-group label {
    display: block; font-size: 12px; font-weight: 600;
    color: var(--text-secondary); margin-bottom: 6px;
  }
  input[type=text], input[type=number], textarea, input[type=email] {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    color: var(--text);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px;
    font-family: inherit;
    transition: border-color .15s, box-shadow .15s;
  }
  input:focus, textarea:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  textarea { min-height: 88px; resize: vertical; }

  .btn-row { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
  .btn {
    border: 0; border-radius: 10px;
    padding: 10px 18px; cursor: pointer;
    font-weight: 600; font-size: 13px; font-family: inherit;
    color: #fff; display: inline-flex; align-items: center; gap: 8px;
    transition: opacity .15s, transform .1s;
  }
  .btn:hover { opacity: .92; }
  .btn:active { transform: scale(.98); }
  .btn.primary { background: var(--accent); }
  .btn.ok { background: var(--ok); }
  .btn.danger { background: var(--danger); }
  .btn.ghost {
    background: transparent; color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .btn.ghost:hover { background: var(--surface-hover); color: var(--text); }

  .quick-links { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px 22px; border-top: 1px solid var(--border); }

  .split-forms { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) { .split-forms { grid-template-columns: 1fr; } }

  .approve-box { background: var(--ok-soft); border: 1px solid rgba(34,197,94,.25); border-radius: var(--radius); padding: 16px; }
  .reject-box { background: var(--danger-soft); border: 1px solid rgba(239,68,68,.25); border-radius: var(--radius); padding: 16px; }
  .approve-box h3, .reject-box h3 { margin: 0 0 12px; font-size: 13px; font-weight: 600; }
  .approve-box h3 { color: #86efac; }
  .reject-box h3 { color: #fca5a5; }
"""


def _nav_html(active: str | None) -> str:
    links = []
    links.append('<div class="nav-label">Asosiy</div>')
    for key, label, href, icon in NAV_ITEMS:
        cls = "active" if key == active else ""
        links.append(
            f'<a href="{href}" class="{cls}"><span class="ico">{icon}</span>{html_lib.escape(label)}</a>'
        )
    return "\n".join(links)


def flash_block(*, msg: str | None = None, err: str | None = None) -> str:
    parts = []
    if msg:
        parts.append(f'<div class="flash ok">✓ {html_lib.escape(msg)}</div>')
    if err:
        parts.append(f'<div class="flash err">✕ {html_lib.escape(err)}</div>')
    return "".join(parts)


def stat_card(
    label: str,
    value: str,
    href: str | None,
    *,
    icon: str = "📊",
    tone: str = "blue",
    hint: str = "",
) -> str:
    hint_html = f'<div class="hint">{html_lib.escape(hint)}</div>' if hint else ""
    inner = (
        f'<div class="row"><div><div class="label">{html_lib.escape(label)}</div>'
        f'<div class="val">{value}</div>{hint_html}</div>'
        f'<div class="icon {tone}">{icon}</div></div>'
    )
    if href:
        return f'<a class="stat-card" href="{html_lib.escape(href)}">{inner}</a>'
    return f'<div class="stat-card" style="cursor:default">{inner}</div>'


def empty_state(text: str, *, emoji: str = "✨") -> str:
    return f'<div class="empty"><div class="emoji">{emoji}</div><p>{html_lib.escape(text)}</p></div>'


def table_panel(title: str, headers: list[str], rows_html: str, *, count: int | None = None, footer: str = "") -> str:
    count_badge = f'<span class="count">{count}</span>' if count is not None else ""
    head_cells = "".join(f"<th>{html_lib.escape(h)}</th>" for h in headers)
    return f"""
<div class="panel">
  <div class="panel-head"><h2>{html_lib.escape(title)}</h2>{count_badge}</div>
  <div class="panel-body">
    <div class="table-wrap">
      <table><thead><tr>{head_cells}</tr></thead><tbody>{rows_html}</tbody></table>
    </div>
    {footer}
  </div>
</div>"""


def page_intro(title: str, subtitle: str = "") -> str:
    sub = f'<p class="sub">{html_lib.escape(subtitle)}</p>' if subtitle else ""
    return f"<h1>{html_lib.escape(title)}</h1>{sub}"


def admin_page(
    title: str,
    body: str,
    *,
    active: str | None = None,
    subtitle: str = "",
) -> str:
    intro = page_intro(title, subtitle)
    return f"""<!doctype html>
<html lang="uz"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html_lib.escape(title)} — Bozorliii Admin</title>
<style>{ADMIN_CSS}</style>
</head><body>
<div class="app">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-logo"><span>B</span> Bozorliii</div>
      <div class="brand-sub">Moderator paneli</div>
    </div>
    <nav class="nav">{_nav_html(active)}</nav>
    <div class="sidebar-foot">Qo'lda moderatsiya · AI o'chirilgan</div>
  </aside>
  <div class="main">
    <header class="topbar">{intro}</header>
    <div class="content">{body}</div>
  </div>
</div>
</body></html>"""
