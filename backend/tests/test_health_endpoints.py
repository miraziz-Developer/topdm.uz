import json
from unittest.mock import AsyncMock

import pytest

from app import main


def _body(response) -> dict:
    return json.loads(response.body)


@pytest.mark.asyncio
async def test_liveness_does_not_probe_dependencies(monkeypatch):
    probe = AsyncMock(side_effect=RuntimeError("must not be called"))
    monkeypatch.setattr(main, "_health_payload", probe)

    response = await main.health_live()

    assert response.status_code == 200
    assert _body(response)["status"] == "ok"
    probe.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("endpoint", [main.health, main.health_ready])
async def test_readiness_skips_external_ai_probe(monkeypatch, endpoint):
    probe = AsyncMock(return_value=({"status": "ok"}, 200))
    monkeypatch.setattr(main, "_health_payload", probe)

    response = await endpoint()

    assert response.status_code == 200
    probe.assert_awaited_once_with(probe_ai=False)


@pytest.mark.asyncio
async def test_deep_health_probes_external_ai(monkeypatch):
    probe = AsyncMock(return_value=({"status": "degraded"}, 200))
    monkeypatch.setattr(main, "_health_payload", probe)

    response = await main.health_deep()

    assert response.status_code == 200
    probe.assert_awaited_once_with(probe_ai=True)