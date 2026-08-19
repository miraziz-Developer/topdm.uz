"""Chat/vision LLM provider configuration — single source for model IDs, base URL, and auth.

Azure AI Foundry (GPT-4.1) is used in place of Groq whenever AZURE_OPENAI_API_KEY +
AZURE_OPENAI_ENDPOINT are set — same OpenAI-compatible /chat/completions shape, so every
existing GroqClient/GroqToolClient call site picks it up with zero changes. Groq stays the
provider when Azure isn't configured (e.g. local dev without an Azure key).
"""

from __future__ import annotations

from app.core.config import Settings, get_settings

# OpenAI-compatible Groq endpoint (chat, tools, streaming).
GROQ_API_BASE = "https://api.groq.com/openai/v1"
GROQ_CHAT_COMPLETIONS_PATH = "/chat/completions"

# Groq's Llama 70B line was retired from the catalog (2026-08) — moved to
# OpenAI's open-weight GPT-OSS line for chat and Qwen3.6 (the only current
# Groq vision-capable model) for image input.
GROQ_DEFAULT_CHAT_MODEL = "openai/gpt-oss-120b"
GROQ_DEFAULT_VISION_MODEL = "qwen/qwen3.6-27b"

LEGACY_MODEL_ALIASES: dict[str, str] = {
    "llama3-70b-8192": GROQ_DEFAULT_CHAT_MODEL,
    "llama-3.1-70b-versatile": GROQ_DEFAULT_CHAT_MODEL,
    "llama-3.3-70b-versatile": GROQ_DEFAULT_CHAT_MODEL,
    "llama-3.2-11b-vision-preview": GROQ_DEFAULT_VISION_MODEL,
    "llama-3.2-90b-vision-preview": GROQ_DEFAULT_VISION_MODEL,
    "meta-llama/llama-4-scout-17b-16e-instruct": GROQ_DEFAULT_VISION_MODEL,
}


def _normalize_model(name: str, *, fallback: str) -> str:
    cleaned = (name or "").strip() or fallback
    return LEGACY_MODEL_ALIASES.get(cleaned, cleaned)


def _azure_active(settings: Settings) -> bool:
    return bool((settings.azure_openai_api_key or "").strip() and (settings.azure_openai_endpoint or "").strip())


def groq_chat_completions_url(settings: Settings | None = None) -> str:
    cfg = settings or get_settings()
    if _azure_active(cfg):
        return f"{cfg.azure_openai_endpoint.rstrip('/')}/chat/completions"
    return f"{GROQ_API_BASE}{GROQ_CHAT_COMPLETIONS_PATH}"


def get_groq_api_key(settings: Settings | None = None) -> str:
    return (settings or get_settings()).groq_api_key.strip()


def iter_groq_api_keys(settings: Settings | None = None) -> list[str]:
    """Primary + backup kalitlar (takrorlarsiz)."""
    cfg = settings or get_settings()
    if _azure_active(cfg):
        return [cfg.azure_openai_api_key.strip()]
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
    """Primary reasoning model for JSON + markdown stylist turns."""
    cfg = settings or get_settings()
    if _azure_active(cfg):
        return (cfg.azure_openai_chat_deployment or "gpt-4.1").strip()
    return _normalize_model(cfg.groq_model, fallback=GROQ_DEFAULT_CHAT_MODEL)


def resolve_groq_agent_model(settings: Settings | None = None) -> str:
    """Tool-calling agent loop model (defaults to chat model when GROQ_AGENT_MODEL unset)."""
    cfg = settings or get_settings()
    if _azure_active(cfg):
        return resolve_groq_chat_model(cfg)
    override = (cfg.groq_agent_model or "").strip()
    if override:
        return _normalize_model(override, fallback=GROQ_DEFAULT_CHAT_MODEL)
    return resolve_groq_chat_model(cfg)


def resolve_groq_vision_model(settings: Settings | None = None) -> str:
    cfg = settings or get_settings()
    if _azure_active(cfg):
        return (cfg.azure_openai_vision_deployment or "gpt-4.1").strip()
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
