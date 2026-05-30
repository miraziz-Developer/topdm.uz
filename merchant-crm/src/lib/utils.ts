import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatPrice(price: number): string {
  return `${new Intl.NumberFormat("uz-UZ").format(price)} so'm`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function getRefToken(): string {
  if (typeof window === "undefined") return "server-ref";
  let token = sessionStorage.getItem("ref_token");
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem("ref_token", token);
  }
  return token;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "server-session";
  let id = localStorage.getItem("session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("session_id", id);
  }
  return id;
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return "hozirgina";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} daqiqa oldin`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} soat oldin`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} kun oldin`;
  return d.toLocaleDateString("uz-UZ");
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}
