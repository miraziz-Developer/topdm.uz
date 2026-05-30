# Bozor AI Stilist — world-class pipeline

## Oqim

```
Foydalanuvchi xabari (+ profil + til)
  → Groq semantic tahlil
  → Hybrid katalog: pgvector + keyword (64 ta, faqat omborda bor)
  → Groq outfit pick (look_slots + matn)
  → Validatsiya (sport/zal, jins, budjet, stock)
  → Kerak bo‘lsa AI retry
  → Mini-xarita (do‘konga yo‘l)
  → UI: wardrobe + feedback 👍/👎
```

**API:** `POST /api/v1/chat/agent/turn` · `/turn/stream` · `POST /agent/feedback`

## P2 funksiyalar (world-class)

| Funksiya | Tavsif |
|----------|--------|
| **Profil** | O‘lcham, sevimli ranglar (`/stylist` → Mening profilim) |
| **Ko‘p til** | uz / ru / en — `X-Bozor-Locale` + Groq javob tili |
| **Feedback** | 👍/👎 → Redis → keyingi tavsiyada yoqtirmagan ID lar chiqmaydi |
| **Ombor** | Faqat `is_available` + `stock_count > 0` |
| **Mini-xarita** | Look tanlanganda avtomatik yo‘l (stall `graph_node_id` bo‘lsa) |
| **Buyurtmalar** | Telefon bilan kirgan user uchun oxirgi buyurtma nomlari kontekstga |

## Kalitlar

| Kalit | Vazifa |
|-------|--------|
| `GROQ_API_KEY` | Chat + tanlov + vision |
| `GOOGLE_API_KEY` | Vector embed (katalog sifati) |
| `REDIS_URL` | Sessiya, tarix, feedback |

## Katalog

```bash
docker compose exec backend python /app/scripts/fix_product_images.py --reembed
docker compose exec backend python /app/scripts/reembed_products.py
docker compose restart backend
```

## Smoke

```bash
./scripts/smoke-stylist-chat.sh
```

## Frontend

- Dev: assistant ostida `AI · groq_outfit`
- `NEXT_PUBLIC_SHOW_AI_DEBUG=true` — production debug
- Profil: `localStorage` `bozor-stylist-profile`

## Engine

| engine | Ma’nosi |
|--------|---------|
| `groq_chitchat` | Suhbat |
| `groq_outfit` | AI look |
| `groq_outfit_retry` | Validatsiyadan keyin qayta tanlov |
| `groq_shopping` | Zaxira JSON tanlov |
