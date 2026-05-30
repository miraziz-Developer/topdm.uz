"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: string; message: string; kind: ToastKind };

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
};

const styles = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-400",
};

const ToastContext = createContext<{ push: (message: string, kind?: ToastKind) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, kind: ToastKind = "info") => {
    const id = crypto.randomUUID();
    setItems((prev) => {
      const duplicate = prev.some((x) => x.message === message && x.kind === kind);
      if (duplicate) return prev;
      return [...prev, { id, message, kind }];
    });
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="safe-top pointer-events-none fixed inset-x-3 top-0 z-[100] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
        <AnimatePresence>
          {items.map((item) => {
            const Icon = icons[item.kind];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 100, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.95 }}
                transition={{ type: "spring", damping: 25 }}
                className={`relative flex max-w-[min(100vw-1.5rem,22rem)] items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm sm:max-w-sm ${styles[item.kind]}`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="break-anywhere text-sm font-medium">{item.message}</span>
                <button onClick={() => remove(item.id)} className="ml-2 flex-shrink-0 opacity-60 transition-opacity hover:opacity-100">
                  <X className="h-4 w-4" />
                </button>
                {/* Progress bar */}
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 4, ease: "linear" }}
                  className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-current opacity-30"
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
