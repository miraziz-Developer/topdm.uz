"""Groq Cloud API configuration — single source for model IDs, base URL, and streaming defaults."""

from __future__ import annotations

from app.core.config import Settings, get_settings

# OpenAI-compatible Groq endpoint (chat, tools, streaming).
GROQ_API_BASE = "https://api.groq.com/openai/v1"
GROQ_CHAT_COMPLETIONS_PATH = "/chat/completions"

# Production 70B line (successor to deprecated llama3-70b-8192 on Groq).
GROQ_DEFAULT_CHAT_MODEL = "llama-3.3-70b-versatile"
GROQ_DEFAULT_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

LEGACY_MODEL_ALIASES: dict[str, str] = {
    "llama3-70b-8192": GROQ_DEFAULT_CHAT_MODEL,
    "llama-3.1-70b-versatile": GROQ_DEFAULT_CHAT_MODEL,
    "llama-3.2-11b-vision-preview": GROQ_DEFAULT_VISION_MODEL,
    "llama-3.2-90b-vision-preview": GROQ_DEFAULT_VISION_MODEL,
}


def _normalize_model(name: str, *, fallback: str) -> str:
    cleaned = (name or "").strip() or fallback
    return LEGACY_MODEL_ALIASES.get(cleaned, cleaned)


def groq_chat_completions_url() -> str:
    return f"{GROQ_API_BASE}{GROQ_CHAT_COMPLETIONS_PATH}"


def get_groq_api_key(settings: Settings | None = None) -> str:
    return (settings or get_settings()).groq_api_key.strip()


def iter_groq_api_keys(settings: Settings | None = None) -> list[str]:
    """Primary + backup kalitlar (takrorlarsiz)."""
    cfg = settings or get_settings()
    keys: list[str] = []
    for raw in (cfg.groq_api_key, getattr(cfg, "groq_api_key_backup", "")):
        key = (raw or "").strip()
        if key and key not in keys:
            keys.append(key)
    return keys


def require_groq_api_key(settings: Settings | None = None) -> str:
    keys = iter_groq_api_keys(settings)
    if not keys:
        raise ValueError("Missing GROQ_API_KEY — Bozorliii stylist requires Groq Cloud.")
    return keys[0]


def resolve_groq_chat_model(settings: Settings | None = None) -> str:
    """Primary 70B reasoning model for JSON + markdown stylist turns."""
    cfg = settings or get_settings()
    return _normalize_model(cfg.groq_model, fallback=GROQ_DEFAULT_CHAT_MODEL)


def resolve_groq_agent_model(settings: Settings | None = None) -> str:
    """Tool-calling agent loop model (defaults to chat model when GROQ_AGENT_MODEL unset)."""
    cfg = settings or get_settings()
    override = (cfg.groq_agent_model or "").strip()
    if override:
        return _normalize_model(override, fallback=GROQ_DEFAULT_CHAT_MODEL)
    return resolve_groq_chat_model(cfg)


def resolve_groq_vision_model(settings: Settings | None = None) -> str:
    cfg = settings or get_settings()
    return _normalize_model(cfg.groq_vision_model, fallback=GROQ_DEFAULT_VISION_MODEL)


def default_chat_payload(
    *,
    model: str,
    messages: list[dict],
    stream: bool = False,
    temperature: float = 0.15,
    response_format: dict | None = None,
    tools: list | None = None,
    tool_choice: str | None = None,
) -> dict:
    """Build a Groq chat/completions body with streaming flag always explicit."""
    body: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": stream,
    }
    if response_format is not None:
        body["response_format"] = response_format
    if tools is not None:
        body["tools"] = tools
    if tool_choice is not None:
        body["tool_choice"] = tool_choice
    return body
