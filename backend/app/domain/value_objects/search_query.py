from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SearchQuery:
    text: str | None
    image_url: str | None

    def semantic_key(self) -> str:
        raw = f"{self.text or ''}|{self.image_url or ''}".strip().lower()
        return raw.replace("dark dress", "qora ko'ylak")
