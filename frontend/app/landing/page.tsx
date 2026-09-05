import {
  ArrowRight, BadgeCheck, BarChart3, Check, MapPinned, MessageCircleMore,
  PackageCheck, Search, ShieldCheck, ShoppingBag, Sparkles, Store,
} from "lucide-react";
import Link from "next/link";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";

const merchantUrl = "https://t.me/Bozorliiicrm_bot";

const customerBenefits = [
  { icon: Search, title: "Tez va aniq qidiruv", description: "Mahsulotni nomi, rasmi yoki AI yordamida toping. Keraksiz sahifalar orasida adashmaysiz." },
  { icon: MapPinned, title: "Rastagacha yo‘l", description: "Do‘kon joylashuvini xaritada ko‘ring va bozorga borganda uni oson toping." },
  { icon: PackageCheck, title: "Oldindan band qilish", description: "Mahsulotni saqlatib qo‘ying, sotuvchi bilan bog‘laning va vaqtingizni tejang." },
];

const merchantBenefits = [
  "Mahsulot va narxlarni bitta paneldan boshqarish",
  "Yangi buyurtmalarni Telegram orqali darhol olish",
  "Savdo, mijoz va kontent natijalarini kuzatish",
  "Do‘kon uchun raqamli vitrina va QR havola",
];

const steps = [
  { number: "01", title: "Botga yozing", description: "Telegram botni oching va telefon raqamingizni tasdiqlang." },
  { number: "02", title: "Do‘konni sozlang", description: "Nomi, manzili va asosiy ma’lumotlarni kiriting." },
  { number: "03", title: "Mahsulot qo‘shing", description: "Rasm, narx va mavjudlikni CRM orqali joylang." },
  { number: "04", title: "Savdoni boshlang", description: "Mijozlar sizni topadi, buyurtmalar esa sizga keladi." },
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh overflow-x-clip bg-[#f7f8fc] text-[#101828]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
          <BozorliiiLogo variant="full" size="sm" href="/landing" />
          <nav className="hidden items-center gap-7 md:flex" aria-label="Asosiy navigatsiya">
            <a href="#imkoniyatlar" className="text-sm font-semibold text-slate-600 transition hover:text-[#1857d6]">Imkoniyatlar</a>
            <a href="#sotuvchilar" className="text-sm font-semibold text-slate-600 transition hover:text-[#1857d6]">Sotuvchilar uchun</a>
            <a href="#qanday-ishlaydi" className="text-sm font-semibold text-slate-600 transition hover:text-[#1857d6]">Qanday ishlaydi</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/auth" className="hidden px-3 py-2 text-sm font-semibold text-slate-700 transition hover:text-[#1857d6] sm:inline-flex">Kirish</Link>
            <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#1857d6] px-4 text-sm font-bold text-white shadow-[0_8px_24px_-10px_rgba(24,87,214,.7)] transition hover:bg-[#1248b8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
              Bozorni ochish <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 sm:pb-28 sm:pt-40 lg:px-8">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute left-1/2 top-0 h-[42rem] w-[70rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(24,87,214,.13),transparent_65%)]" />
          <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(15,23,42,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.08)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
        </div>
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.08fr_.92fr] lg:gap-16">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-[#1857d6] shadow-sm backdrop-blur">
              <BadgeCheck className="h-4 w-4" aria-hidden /> O‘zbekiston bozorlari uchun yagona raqamli platforma
            </div>
            <h1 className="text-balance text-[2.65rem] font-black leading-[1.04] tracking-[-0.045em] text-[#0b1220] sm:text-6xl lg:text-[4.5rem]">
              Bozor endi sizga <span className="text-[#1857d6]">yaqinroq.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg font-medium leading-8 text-slate-600 sm:text-xl">
              Mahsulotlarni toping, narxlarni ko‘ring, sotuvchi bilan bog‘laning va xaridingizni oldindan rejalashtiring — barchasi bitta joyda.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#1857d6] px-7 text-base font-bold text-white shadow-[0_16px_34px_-14px_rgba(24,87,214,.75)] transition hover:-translate-y-0.5 hover:bg-[#1248b8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200">
                <ShoppingBag className="h-5 w-5" aria-hidden /> Xaridni boshlash
              </Link>
              <a href={merchantUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-7 text-base font-bold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-[#1857d6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200">
                <Store className="h-5 w-5" aria-hidden /> Do‘konni ulash
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-600">
              {["Mahalliy do‘konlar", "Shaffof narxlar", "To‘g‘ridan-to‘g‘ri aloqa"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-3.5 w-3.5" aria-hidden /></span>{item}</span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl" aria-label="Bozorliii imkoniyatlari">
            <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-blue-200/60 via-violet-100/40 to-orange-100/60 blur-3xl" aria-hidden />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-[#0c172e] p-5 shadow-[0_35px_90px_-30px_rgba(15,23,42,.55)] sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Bozorliii</p><p className="mt-1 text-lg font-bold text-white">Xarid markazi</p></div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">Onlayn</span>
              </div>
              <div className="mt-5 rounded-2xl bg-white p-4 shadow-xl">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500"><Search className="h-5 w-5 text-[#1857d6]" aria-hidden />Nima qidiryapsiz?</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-blue-50 p-4"><MapPinned className="h-6 w-6 text-[#1857d6]" aria-hidden /><p className="mt-8 text-sm font-extrabold text-slate-900">Do‘kon xaritasi</p><p className="mt-1 text-xs leading-5 text-slate-500">Kerakli rastani tez toping</p></div>
                  <div className="rounded-2xl bg-orange-50 p-4"><Sparkles className="h-6 w-6 text-orange-600" aria-hidden /><p className="mt-8 text-sm font-extrabold text-slate-900">AI yordamchi</p><p className="mt-1 text-xs leading-5 text-slate-500">Mos mahsulotni tanlang</p></div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {["Qidiruv", "Xarita", "Buyurtma"].map((item, index) => <div key={item} className="rounded-xl border border-white/10 bg-white/[0.06] px-2 py-3"><p className="text-xs font-bold text-white">{String(index + 1).padStart(2, "0")}</p><p className="mt-1 text-[10px] font-medium text-slate-400">{item}</p></div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="imkoniyatlar" className="border-y border-slate-200 bg-white px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#1857d6]">Xaridorlar uchun</p><h2 className="mt-4 text-balance text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-5xl">Oddiy, tez va ishonchli bozor tajribasi</h2><p className="mt-5 text-lg leading-8 text-slate-600">Kerakli mahsulotga yetib borish yo‘lini qisqartirdik. Har bir funksiya aniq vazifani bajaradi.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {customerBenefits.map(({ icon: Icon, title, description }) => (
              <article key={title} className="group rounded-[1.5rem] border border-slate-200 bg-[#fbfcfe] p-7 transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_45px_-24px_rgba(24,87,214,.4)]">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-[#1857d6] transition group-hover:bg-[#1857d6] group-hover:text-white"><Icon className="h-6 w-6" aria-hidden /></span>
                <h3 className="mt-6 text-xl font-extrabold tracking-tight text-slate-950">{title}</h3><p className="mt-3 leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="sotuvchilar" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-[#0c172e] lg:grid-cols-[.9fr_1.1fr]">
          <div className="p-7 sm:p-12 lg:p-16">
            <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.18em] text-blue-300"><Store className="h-4 w-4" aria-hidden /> Sotuvchilar uchun</span>
            <h2 className="mt-5 text-balance text-3xl font-black tracking-[-0.035em] text-white sm:text-5xl">Do‘koningizni raqamli savdoga olib chiqing</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">Murakkab dasturlar va ortiqcha jarayonlarsiz. Mahsulot, buyurtma va mijozlar bilan ishlash uchun tushunarli CRM.</p>
            <a href={merchantUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-bold text-[#0c172e] transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/40">Bepul boshlash <ArrowRight className="h-4 w-4" aria-hidden /></a>
          </div>
          <div className="border-t border-white/10 bg-white/[0.045] p-7 sm:p-12 lg:border-l lg:border-t-0 lg:p-16">
            <div className="grid gap-4 sm:grid-cols-2">
              {merchantBenefits.map((benefit, index) => {
                const icons = [PackageCheck, MessageCircleMore, BarChart3, ShieldCheck];
                const Icon = icons[index] ?? Check;
                return <div key={benefit} className="rounded-2xl border border-white/10 bg-white/[0.055] p-5"><Icon className="h-5 w-5 text-blue-300" aria-hidden /><p className="mt-4 text-sm font-semibold leading-6 text-slate-100">{benefit}</p></div>;
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="qanday-ishlaydi" className="bg-white px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center"><p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#1857d6]">Boshlash oson</p><h2 className="mt-4 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-5xl">To‘rtta aniq qadam</h2></div>
          <ol className="mt-12 grid gap-4 md:grid-cols-4">
            {steps.map((step) => <li key={step.number} className="relative rounded-2xl border border-slate-200 p-6"><span className="text-sm font-black tracking-widest text-[#1857d6]">{step.number}</span><h3 className="mt-8 text-lg font-extrabold text-slate-950">{step.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[2rem] bg-[#1857d6] p-8 text-white shadow-[0_30px_80px_-35px_rgba(24,87,214,.8)] sm:p-12 lg:flex-row lg:items-center">
          <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-100">Bozorliii bilan boshlang</p><h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.035em] sm:text-4xl">Bozorni topish ham, bozorda topilish ham oson.</h2></div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"><Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 font-bold text-[#1857d6] transition hover:bg-blue-50">Xarid qilish</Link><a href={merchantUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 font-bold text-white transition hover:bg-white/10">Do‘konni ulash</a></div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div><BozorliiiLogo variant="full" size="sm" href="/landing" /><p className="mt-2 text-sm text-slate-500">Uydan chiqmasdan bozor aylaning.</p></div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-600"><Link href="/">Bozor</Link><Link href="/map">Xarita</Link><a href="https://crm.bozorliii.online">CRM</a><a href={merchantUrl} target="_blank" rel="noopener noreferrer">Telegram</a></div>
          <p className="text-sm text-slate-500">© 2026 Bozorliii</p>
        </div>
      </footer>
    </main>
  );
}