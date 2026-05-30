.PHONY: dev-up dev-down dev-reset-crm sync-brand prod-up prod-down prod-logs prod-preflight prod-smoke verify smoke smoke-payments setup-merchant-mobile verify-frontend-proxy world-class local-prod-up local-prod-down local-prod-logs local-prod-test

sync-brand:
	bash scripts/sync-brand-assets.sh

verify-media:
	docker compose exec backend python /app/scripts/verify_media_storage.py

audit-images:
	docker compose exec backend python /app/scripts/audit_product_images.py

seed-reels:
	docker compose -f docker-compose.local-prod.yml exec backend python /app/scripts/seed_reels.py

seed-reels-force:
	docker compose -f docker-compose.local-prod.yml exec -e FORCE_RESEED=1 backend python /app/scripts/seed_reels.py

verify:
	python3 scripts/verify_backend_core.py
	python3 scripts/verify_frontend_api_contract.py

smoke:
	bash scripts/smoke_api.sh

smoke-payments:
	bash scripts/smoke-payment-callbacks.sh $${API:-http://127.0.0.1:8000}

setup-merchant-mobile:
	bash scripts/setup-merchant-mobile.sh

merchant-mobile-all:
	bash scripts/merchant-mobile-all.sh

build-merchant-apk:
	bash scripts/build-merchant-apk.sh

verify-frontend-proxy:
	@curl -sf http://127.0.0.1:3002/api/v1/health >/dev/null && echo "OK frontend proxy → backend" || (echo "FAIL: start frontend (docker compose up frontend)"; exit 1)

dev-up:
	docker compose up -d --build

dev-down:
	docker compose down

dev-reset-crm:
	bash scripts/dev-reset-crm.sh

prod-up:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f --tail=100

prod-preflight:
	bash scripts/preflight-deploy.sh

prod-smoke:
	bash scripts/smoke-all.sh $${SITE:-https://topdim.uz} $${CRM:-https://crm.topdim.uz} $${API:-https://api.topdim.uz}

world-class:
	bash scripts/world-class-verify.sh

local-prod-up:
	@test -f .env.local-prod || (echo "Missing .env.local-prod — cp .env.local-prod.example .env.local-prod"; exit 1)
	docker compose -f docker-compose.local-prod.yml up -d --build

local-prod-down:
	docker compose -f docker-compose.local-prod.yml down

local-prod-logs:
	docker compose -f docker-compose.local-prod.yml logs -f --tail=120

local-prod-test:
	bash scripts/wait-local-prod.sh http://localhost:3002 http://localhost:3003 http://localhost:8000
	bash scripts/smoke-all.sh http://localhost:3002 http://localhost:3003 http://localhost:8000
