CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS global_shops (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    block VARCHAR(64) NOT NULL,
    row VARCHAR(64) NOT NULL,
    phone VARCHAR(32),
    telegram_username VARCHAR(64),
    address_note VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS unified_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    currency VARCHAR(10) DEFAULT 'UZS',
    description TEXT,
    embedding VECTOR(1536),
    ai_metadata JSONB DEFAULT '{}'::jsonb,
    shop_id INTEGER REFERENCES global_shops(id)
);

CREATE INDEX IF NOT EXISTS idx_unified_products_embedding
ON unified_products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    product_id INTEGER NOT NULL REFERENCES unified_products(id),
    shop_id INTEGER NOT NULL REFERENCES global_shops(id),
    event_type VARCHAR(32) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);
