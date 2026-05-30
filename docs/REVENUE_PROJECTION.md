# Topdim.UZ — Daromad proyeksiyasi (halol hisob)

> Sana: 2026-05-26 | Manbalar: O'zbekiston SME statistikasi, Ippodrom bozor haqiqati, SaaS benchmark

---

## Bozor hajmi (TAM)

| Ko'rsatkich | Raqam | Manba |
|-------------|-------|-------|
| Ippodrom + Abu Sahiy do'konlar | ~3,000–5,000 | Real hisob |
| Toshkent shahri bozor do'konlari | ~30,000–50,000 | MSHJ ma'lumoti |
| O'zbekiston do'konlari (kichik) | ~300,000+ | UzStat |
| Boshlang'ich maqsad (Ippodrom) | **500–1,000 do'kon** | Bizning SAM |

---

## Hozirgi holat (demo)

- Do'konlar: **2** (seed ma'lumot)
- Mahsulotlar: **23**
- Real merchantlar: **0** (hali deploy qilinmagan)

---

## Proyeksiya — 3 stsenariy

### STSENARY A — Konservativ (ehtimoliy)
> 6 oyda 50 ta, 12 oyda 150 ta merchant

### STSENARY B — Realistik (maqsadimiz)
> 6 oyda 150 ta, 12 oyda 500 ta merchant

### STSENARY C — Optimistik (agar virallik bo'lsa)
> 6 oyda 500 ta, 12 oyda 2,000 ta merchant

---

## Daromad hisob-kitobi (1 merchant uchun MRR)

```
NARXLAR (hozirgi):
  Starter obuna:      59,000 so'm/oy
  Pro obuna:         129,000 so'm/oy
  Bronze banner:      79,000 so'm/oy
  Silver banner:     199,000 so'm/oy
  Gold banner:       379,000 so'm/oy
  Boost (oylik):      59,000 so'm/oy

MERCHANT MIX (tajribadan):
  70% — Bepul (hech qanday to'lov yo'q)
  20% — Starter yoki Bronze banner
  10% — Pro yoki Silver/Gold banner

1 merchant dan o'rtacha MRR = 59k×0.20 + 199k×0.07 + 129k×0.08 + 59k×0.05
                             ≈ 11,800 + 13,930 + 10,320 + 2,950
                             ≈ ~39,000 so'm/oy/merchant
```

---

## Stsenariy B — 12 oylik oylik daromad (MRR)

| Oy | Merchants | MRR (so'm) | MRR ($) |
|----|-----------|-----------|---------|
| 1  | 10        | 390,000   | $33 |
| 2  | 25        | 975,000   | $82 |
| 3  | 50        | 1,950,000 | $163 |
| 4  | 80        | 3,120,000 | $260 |
| 5  | 120       | 4,680,000 | $390 |
| 6  | 150       | **5,850,000** | **$487** |
| 7  | 200       | 7,800,000 | $650 |
| 8  | 280       | 10,920,000 | $910 |
| 9  | 350       | 13,650,000 | $1,138 |
| 10 | 420       | 16,380,000 | $1,365 |
| 11 | 480       | 18,720,000 | $1,560 |
| 12 | 500       | **19,500,000** | **$1,625/oy** |

> **Yillik ARR (12 oy oxiri): ~$19,500** yoki ~233M so'm

---

## Komissiya qo'shilgandan keyin (6 oy+)

**Farazlar:**
- 1 merchant oyiga o'rtacha 5M so'm savdo
- Komissiya 1% = 50,000 so'm/merchant/oy

| Merchants | Savdo GMV | 1% Komissiya |
|-----------|-----------|--------------|
| 150       | 750M so'm | 7,500,000 so'm/oy |
| 500       | 2.5 mlrd  | 25,000,000 so'm/oy |

**500 merchant + 1% komissiya + obuna = ~44M so'm/oy (~$3,700)**

---

## Break-even (xarajat vs daromad)

| Xarajat | Oylik ($) | Izoh |
|---------|-----------|------|
| VPS server | $30–80 | Hetzner / DO |
| Groq API | $20–50 | LLM xarajat |
| Google AI | $10–30 | Vision/Embedding |
| Telegram | $0 | Bepul |
| Domain/SSL | $3 | Yillik |
| **Jami xarajat** | **~$80–160** | |

**Break-even:** ~**5–10 ta paying merchant** (Starter reja)

---

## Reallik tekshiruvi

### Nima amalga oshishi mumkin ✅
- 6 oy ichida 50-150 merchant: **ha, mumkin** (Ippodrom do'konlari soni)
- Bronze banner sotish: **oson** — 79k juda qulay, merchant 2 ta mijoz olsa qoplanadi
- Komissiyasiz Uzum dan afzallik: **kuchli argument**

### Nima qiyin ❌
- Merchant onboarding: har bir do'kon egasiga tushuntirish kerak (offline marketing)
- Mahsulot yuklash: sotuvchilar o'zlari qilmaydi — CRM bot orqali yordam kerak
- Mijoz bazasi: saytga trafik kelmaguncha merchant to'lamaydi

### Asosiy xavf omillari
1. **Trafik yo'q** → merchant saytdan foyda ko'rmaydi → to'lamaydi
2. **Raqobat** → Uzum/Instagram kuchli, merchant nima uchun Topdim ishlatadi?
3. **Offline bozor** → Ippodrom do'konchilari onlayn platformani qabul qilish vaqt oladi

---

## Tavsiya — qanday pul ishlash kerak?

### 1-bosqich (hozir): Banner bilan boshlang
```
Maqsad: 20 ta Bronze banner sotish
Daromad: 20 × 79,000 = 1,580,000 so'm/oy (~$132)
Muammo: kim uchun siz qimmat emas ekanligini ko'rsating
```

### 2-bosqich (1-2 oy): Obuna
```
Maqsad: 30 ta Starter + 10 ta Pro
Daromad: 30×59k + 10×129k = 3,060,000 so'm/oy (~$255)
```

### 3-bosqich (3-6 oy): Komissiya
```
Maqsad: 100+ merchant, 1% komissiya
Daromad: 100 × 5M × 1% = 5,000,000 so'm/oy (~$417)
```

### Kumulativ 12 oy (Stsenary B):
> **~$15,000–20,000** yillik daromad

---

## Halol xulosa

| Holat | Daromad |
|-------|---------|
| **Hozir** (demo, 0 merchant) | $0 |
| **3 oy** (50 merchant) | $125-250/oy |
| **6 oy** (150 merchant) | $400-600/oy |
| **12 oy** (500 merchant) | $1,500-2,500/oy |
| **24 oy** (2,000 merchant + komissiya) | $10,000-25,000/oy |

**Asosiy kalit:** Real merchant onboarding — kod tayyor, marketing qoldi.
