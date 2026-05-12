CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS global_shops (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    block VARCHAR(50) NOT NULL,
    row VARCHAR(50) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS unified_products (
    id UUID PRIMARY KEY,
    shop_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'UZS',
    embedding VECTOR(1536) NOT NULL,
    ai_generated_tags JSONB NOT NULL DEFAULT '{}'::jsonb,
    vision_attributes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_unified_products_embedding
ON unified_products USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS product_lead_events (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'telegram_webapp',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_global_shops_name ON global_shops (name);
CREATE INDEX IF NOT EXISTS idx_unified_products_name ON unified_products (name);
CREATE INDEX IF NOT EXISTS idx_unified_products_shop_id ON unified_products (shop_id);
CREATE INDEX IF NOT EXISTS idx_product_lead_product_id ON product_lead_events (product_id);
