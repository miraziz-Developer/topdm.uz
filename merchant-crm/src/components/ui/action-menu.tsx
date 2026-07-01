"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ActionMenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  tone?: "default" | "danger";
  onSelect: () => void;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  triggerLabel?: string;
  triggerClassName?: string;
};

const MENU_WIDTH = 176;
const MENU_ITEM_HEIGHT = 40;
const MENU_PADDING = 8;

export function ActionMenu({ items, triggerLabel = "Harakatlar", triggerClassName }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = items.length * MENU_ITEM_HEIGHT + MENU_PADDING;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < menuHeight + 12 && rect.top > menuHeight + 12;
      const top = openUp ? rect.top - menuHeight - 6 : rect.bottom + 6;
      const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, items.length]);

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ??
          "rounded-lg p-2 text-text-400 hover:bg-canvas hover:text-text-100"
        }
        aria-label={triggerLabel}
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[60] cursor-default bg-transparent"
                onClick={close}
                aria-label="Yopish"
              />
              <div
                className="fixed z-[70] w-44 overflow-hidden rounded-xl border border-border-subtle bg-surface py-1 shadow-xl"
                style={{ top: coords.top, left: coords.left }}
                role="menu"
              >
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className={
                      item.tone === "danger"
                        ? "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red hover:bg-red/5"
                        : "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-100 hover:bg-canvas"
                    }
                    onClick={() => {
                      close();
                      item.onSelect();
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
