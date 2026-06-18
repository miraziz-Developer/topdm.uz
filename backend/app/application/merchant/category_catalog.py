"""Bozorliii mahsulot kategoriyalari — root → sub (ichma-ich tanlash)."""

from __future__ import annotations

from typing import TypedDict


class CategoryNode(TypedDict):
    name: str
    icon: str
    sort_order: int
    subs: list[str]


# Asosiy bo'limlar → aniq sub-kategoriyalar (chalkashmaslik uchun 2 bosqich)
CLOTHING_CATEGORY_TREE: list[CategoryNode] = [
    {
        "name": "Ayollar kiyimi",
        "icon": "👗",
        "sort_order": 1,
        "subs": [
            "Ko'ylak va bluzka",
            "Kurtka va palto",
            "Shim va jinsi",
            "Yubka",
            "Libos va to'y libosi",
            "Sport kiyim",
            "Ichki kiyim",
            "Haylov va ko'ylak",
        ],
    },
    {
        "name": "Erkaklar kiyimi",
        "icon": "👔",
        "sort_order": 2,
        "subs": [
            "Futbolka va mayka",
            "Ko'ylak (rubashka)",
            "Shim va jinsi",
            "Kurtka va jilet",
            "Sport kiyim",
            "Kostyum va klassik",
            "Ichki kiyim",
        ],
    },
    {
        "name": "Bolalar kiyimi",
        "icon": "🧒",
        "sort_order": 3,
        "subs": [
            "Kundalik kiyim",
            "Maktab formasi",
            "Sport kiyim",
            "Chaqaloq kiyimi",
            "Bolalar shim va futbolka",
        ],
    },
    {
        "name": "Poyabzal",
        "icon": "👟",
        "sort_order": 4,
        "subs": [
            "Ayollar poyabzali",
            "Erkaklar poyabzali",
            "Bolalar poyabzali",
            "Sandallar va shippak",
            "Krossovka",
            "Tufli va mokasen",
        ],
    },
    {
        "name": "Aksessuarlar",
        "icon": "👜",
        "sort_order": 5,
        "subs": [
            "Sumka",
            "Kamar va galstuk",
            "Shapka va sharf",
            "Zargarlik va soat",
        ],
    },
    {
        "name": "Go'zallik & Parfümeriya",
        "icon": "✨",
        "sort_order": 6,
        "subs": [
            "Atir va parfyum",
            "Kosmetika",
            "Soch va parvarish",
        ],
    },
]

# Abu Sahiy / Ippodrom — kiyimdan tashqari ko'p sotiladigan tovarlar
BAZAAR_EXTENDED_CATEGORY_TREE: list[CategoryNode] = [
    {
        "name": "Matolar & tekstil",
        "icon": "🧵",
        "sort_order": 10,
        "subs": [
            "Pardabop va dekor mato",
            "Sarpo va atlas",
            "Turk / Xitoy mato",
            "Uy tekstili",
            "Ishlab chiqarish matosi",
        ],
    },
    {
        "name": "Elektronika & texnika",
        "icon": "📱",
        "sort_order": 11,
        "subs": [
            "Telefon va aksessuar",
            "Maishiy texnika",
            "Kompyuter va planshet",
            "Audio va video",
        ],
    },
    {
        "name": "Uy & maishiy",
        "icon": "🏠",
        "sort_order": 12,
        "subs": [
            "Idish-tovoq",
            "Oshxona jihozlari",
            "Tozalash va maishiy",
            "Dekor va interyer",
        ],
    },
    {
        "name": "Oziq-ovqat & savdo",
        "icon": "🛒",
        "sort_order": 13,
        "subs": [
            "Quruq mevalar",
            "Ziravorlar",
            "Shirinliklar",
            "Ichimliklar",
        ],
    },
    {
        "name": "Qurilish & hunarmandchilik",
        "icon": "🔧",
        "sort_order": 14,
        "subs": [
            "Qurilish materiallari",
            "Asbob-uskunalar",
        ],
    },
]

FULL_BAZAAR_CATEGORY_TREE: list[CategoryNode] = [*CLOTHING_CATEGORY_TREE, *BAZAAR_EXTENDED_CATEGORY_TREE]
