.PHONY: dev-up dev-down sync-brand prod-deploy prod-up prod-down prod-logs prod-preflight verify system-check local-prod-up local-prod-down local-prod-logs

sync-brand:
	bash scripts/sync-brand-assets.sh

verify-media:
	docker compose exec backend python /app/scripts/verify_media_storage.py

audit-images:
	docker compose exec backend python /app/scripts/audit_product_images.py

repair-media:
	docker compose exec backend python /app/scripts/repair_broken_media.py
	docker compose exec backend python /app/scripts/fix_product_images.py

system-check:
	@curl -sf http://127.0.0.1:8000/health >/dev/null && echo "OK backend /health" || (echo "FAIL: docker compose up backend"; exit 1)
	@curl -sf "http://127.0.0.1:8000/api/v1/home/deal-feed?limit=2" >/dev/null && echo "OK deal-feed" || exit 1

verify:
	python3 scripts/verify_backend_core.py

verify-frontend-proxy:
	@curl -sf http://127.0.0.1:3002/api/v1/health >/dev/null && echo "OK frontend proxy → backend" || (echo "FAIL: start frontend"; exit 1)

dev-up:
	docker compose up -d --build

dev-down:
	docker compose down

prod-preflight:
	bash scripts/preflight-deploy.sh

prod-deploy:
	bash scripts/deploy-prod.sh

prod-up:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f --tail=100

prod-smoke:
	bash scripts/smoke-prod.sh

test-backend:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -q -e . pytest && python -m pytest tests/ -q

local-prod-up:
	@test -f .env.local-prod || (echo "Missing .env.local-prod"; exit 1)
	docker compose -f docker-compose.local-prod.yml up -d --build

local-prod-down:
	docker compose -f docker-compose.local-prod.yml down

local-prod-logs:
	docker compose -f docker-compose.local-prod.yml logs -f --tail=120
