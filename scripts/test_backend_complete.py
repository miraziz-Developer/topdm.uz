#!/usr/bin/env python3
"""End-to-end Bozorliii backend smoke tests (auth, indoor nav, AI chat)."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import time
from typing import Any

import httpx

try:
    from redis import Redis
except ImportError:
    Redis = None  # type: ignore[misc, assignment]

API_BASE = os.environ.get("API_BASE_URL", "http://localhost:8000/api/v1").rstrip("/")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
TEST_EMAIL = os.environ.get("TEST_EMAIL", "delivered@resend.dev").strip().lower()
TIMEOUT = float(os.environ.get("TEST_HTTP_TIMEOUT", "60"))


class Suite:
    def __init__(self) -> None:
        self.passed = 0
        self.failed = 0
        self.client = httpx.Client(timeout=TIMEOUT)

    def check(self, name: str, condition: bool, detail: str = "") -> None:
        if condition:
            self.passed += 1
            print(f"  PASS  {name}")
        else:
            self.failed += 1
            msg = f" — {detail}" if detail else ""
            print(f"  FAIL  {name}{msg}")

    def get_health(self) -> dict[str, Any]:
        url = API_BASE.replace("/api/v1", "") + "/health"
        r = self.client.get(url)
        return {"status": r.status_code, "body": r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text}

    def build_telegram_widget_payload(self, *, user_id: int = 9_990_011) -> dict[str, Any]:
        if not TELEGRAM_BOT_TOKEN:
            raise RuntimeError("TELEGRAM_BOT_TOKEN is not set")
        payload: dict[str, Any] = {
            "id": user_id,
            "first_name": "Smoke",
            "last_name": "Test",
            "username": "smoke_test_user",
            "auth_date": int(time.time()),
        }
        check_string = "\n".join(f"{k}={payload[k]}" for k in sorted(payload.keys()))
        secret = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
        payload["hash"] = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        return payload

    def test_health(self) -> None:
        health = self.get_health()
        self.check("health endpoint", health["status"] == 200, str(health))

    def test_telegram_login(self) -> None:
        if not TELEGRAM_BOT_TOKEN:
            self.check("telegram login (skipped)", True, "no TELEGRAM_BOT_TOKEN")
            return
        body = self.build_telegram_widget_payload()
        r = self.client.post(f"{API_BASE}/auth/telegram", json=body)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        self.check("telegram login status", r.status_code == 200, f"{r.status_code} {data}")
        token = data.get("access_token") or data.get("token")
        self.check("telegram login JWT", isinstance(token, str) and len(token) > 20, str(data)[:200])

    def test_email_otp_redis(self) -> None:
        r = self.client.post(f"{API_BASE}/auth/email/send-otp", json={"email": TEST_EMAIL})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code == 503 and "RESEND" in str(data.get("detail", "")):
            self.check("email send-otp (skipped)", True, "RESEND_API_KEY not configured")
            return
        self.check("email send-otp status", r.status_code == 200, f"{r.status_code} {data}")

        otp = data.get("dev_otp")
        if not otp:
            self.check("email dev_otp present", False, "set APP_DEBUG=true or read OTP from inbox")
            return

        if Redis is None:
            self.check("redis package", False, "install redis: pip install redis")
            return
        redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
        key = f"otp:email:{TEST_EMAIL}"
        raw = redis_client.get(key)
        self.check("email OTP redis key", raw is not None, f"missing {key}")
        if raw:
            stored = json.loads(raw)
            self.check("email OTP redis value", str(stored.get("otp")) == str(otp), str(stored))

        time.sleep(0.5)
        vr = self.client.post(
            f"{API_BASE}/auth/email/verify-otp",
            json={"email": TEST_EMAIL, "otp": str(otp)},
        )
        vdata = vr.json() if vr.headers.get("content-type", "").startswith("application/json") else {}
        self.check("email verify-otp status", vr.status_code == 200, f"{vr.status_code} {vdata}")
        token = vdata.get("access_token") or vdata.get("token")
        self.check("email verify JWT", isinstance(token, str) and len(token) > 20, str(vdata)[:200])

    def test_indoor_route(self) -> None:
        url = f"{API_BASE}/indoor-maps/ippodrom/levels/1/route"
        r = self.client.get(url, params={"start_node_id": "entrance-A", "goal_node_id": "corridor-A"})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        self.check("indoor route status", r.status_code == 200, f"{r.status_code} {data}")
        node_ids = data.get("node_ids") or (data.get("route") or {}).get("node_ids")
        self.check("indoor route node_ids", isinstance(node_ids, list) and len(node_ids) >= 2, str(data)[:300])

    def test_ai_chat_agent(self) -> None:
        r = self.client.post(
            f"{API_BASE}/chat/agent/turn",
            json={
                "user_id": "smoke-test-user",
                "thread_id": "smoke-thread",
                "text": "Menga qishki kurtka kerak",
                "user_nav_node_id": "entrance-A",
            },
        )
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        self.check("chat agent status", r.status_code == 200, f"{r.status_code} {str(data)[:300]}")
        text = data.get("assistant_text") or ""
        blocks = data.get("blocks")
        has_content = bool(str(text).strip()) or (isinstance(blocks, list) and len(blocks) > 0)
        self.check("chat agent response body", has_content, str(data)[:400])

    def run(self) -> int:
        print(f"Bozorliii backend smoke suite → {API_BASE}\n")
        self.test_health()
        self.test_telegram_login()
        self.test_email_otp_redis()
        self.test_indoor_route()
        self.test_ai_chat_agent()
        total = self.passed + self.failed
        print(f"\n{'=' * 50}")
        print(f"Results: {self.passed}/{total} passed, {self.failed} failed")
        if self.failed:
            print("OVERALL: FAILED")
            return 1
        print("OVERALL: PASSED")
        return 0


def main() -> None:
    suite = Suite()
    raise SystemExit(suite.run())


if __name__ == "__main__":
    main()
