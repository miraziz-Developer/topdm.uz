import random


class LookABTestingEngine:
    def choose_variant(self, look_a: dict, look_b: dict) -> tuple[str, dict]:
        variant = random.choice(["A", "B"])
        return (variant, look_a if variant == "A" else look_b)

    def record_conversion_signal(self, variant: str, converted: bool) -> dict:
        return {"variant": variant, "converted": converted}
