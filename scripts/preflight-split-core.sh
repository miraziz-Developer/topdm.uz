#!/usr/bin/env bash
# CORE server preflight — split production deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ENV_FILE:-.env}"
fail=0

die() { echo "FAIL: $1"; fail=1; }
ok() { echo "OK  $1"; }

[[ -f "$ENV_FILE" ]] || { echo "FAIL: Missing $ENV_FILE — cp .env.core.example .env"; exit 1; }

val() { grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^"//;s/"$//' || true; }

required() {
  local name="$1" value
  value="$(val "$name")"
  if [[ -z "$value" || "$value" == CHANGE_ME* ]]; then
    die "$name is empty or a placeholder"
  else
    ok "$name"
  fi
}

required_secret() {
  local name="$1" value
  value="$(val "$name")"
  if [[ -z "$value" || "$value" == CHANGE_ME* || ${#value} -lt 32 ]]; then
    die "$name must be a strong value of at least 32 characters"
  else
    ok "$name"
  fi
}

[[ "$(val APP_ENV)" == "production" ]] || die "APP_ENV=production is required"
[[ "$(val PRODUCTION)" == "true" ]] || die "PRODUCTION=true is required"
[[ "$(val APP_DEBUG)" == "false" ]] || die "APP_DEBUG=false is required"
[[ "$(val ALLOW_DEV_MOCKS)" == "false" ]] || die "ALLOW_DEV_MOCKS=false is required"
[[ "$(val RUN_SEED)" == "false" ]] || die "RUN_SEED=false is required"

required POSTGRES_PASSWORD
required_secret JWT_SECRET
required_secret ADMIN_API_KEY
required TELEGRAM_BOT_TOKEN
required GROQ_API_KEY

if [[ -z "$(val GOOGLE_API_KEY)" && -z "$(val OPENAI_API_KEY)" ]]; then
  die "GOOGLE_API_KEY or OPENAI_API_KEY is required"
else
  ok "catalog embedding provider"
fi

if [[ "$(val MEDIA_STORAGE_BACKEND)" == "s3" ]]; then
  required S3_BUCKET
  required S3_ACCESS_KEY_ID
  required S3_SECRET_ACCESS_KEY
fi

command -v docker >/dev/null 2>&1 || die "docker is not installed"
docker compose version >/dev/null 2>&1 || die "docker compose plugin is not installed"

[[ "$fail" -eq 0 ]] || exit 1
echo "== CORE preflight passed =="