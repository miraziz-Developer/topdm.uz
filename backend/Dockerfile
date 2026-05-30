FROM python:3.11-slim

WORKDIR /app

COPY backend/pyproject.toml /app/pyproject.toml
COPY backend/app /app/app
COPY backend/alembic.ini /app/alembic.ini
COPY backend/migrations /app/migrations
COPY backend/docker-entrypoint.sh /docker-entrypoint.sh
COPY scripts/seed.py /app/scripts/seed.py
COPY scripts/run_merchant_bot.py /app/scripts/run_merchant_bot.py

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -e . \
    && chmod +x /docker-entrypoint.sh \
    && mkdir -p /app/uploads/products

EXPOSE 8000
ENTRYPOINT ["/docker-entrypoint.sh"]
