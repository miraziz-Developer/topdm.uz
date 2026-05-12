from typing import Any


class StylistDomainService:
    def build_look(self, products: list[dict[str, Any]], style: str) -> list[dict[str, Any]]:
        if style.lower() == "formal":
            return products[:6]
        return products[:4]
