import httpx
import logging
from typing import Optional
from app.core.config import get_settings
from app.infrastructure.cache.redis_gateway import RedisCacheGateway
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

class EskizSMSClient:
    def __init__(self):
        self.settings = get_settings()
        self.cache = RedisCacheGateway()
        self.base_url = "https://notify.eskiz.uz/api"

    async def _get_token(self) -> Optional[str]:
        token = await self.cache._get_raw("eskiz_token")
        if token:
            return token

        if not self.settings.eskiz_login or not self.settings.eskiz_password:
            return None

        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/auth/login",
                    data={"email": self.settings.eskiz_login, "password": self.settings.eskiz_password}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    token = data["data"]["token"]
                    # Token expires in 30 days, we cache for 20 days
                    await self.cache._set_raw("eskiz_token", token, 3600 * 24 * 20)
                    return token
            except Exception as e:
                logger.error(f"Eskiz login failed: {e}")
            return None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        retry=retry_if_exception_type(httpx.HTTPError),
        reraise=False,
    )
    async def send_sms(self, phone: str, message: str) -> bool:
        phone_cleaned = phone.replace("+", "")
        token = await self._get_token()
        if not token:
            logger.info(f"DEV SMS to {phone}: {message}")
            return True

        async with httpx.AsyncClient(timeout=10) as client:
            try:
                resp = await client.post(
                    f"{self.base_url}/message/sms/send",
                    headers={"Authorization": f"Bearer {token}"},
                    data={
                        "mobile_phone": phone_cleaned,
                        "message": message,
                        "from": "4546",
                    }
                )
                return resp.status_code == 200
            except Exception as e:
                logger.error(f"Eskiz SMS failed: {e}")
                return False
