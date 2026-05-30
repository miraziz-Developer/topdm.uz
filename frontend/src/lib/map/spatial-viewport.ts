/** UI chrome: top, right, bottom, left (px) — keeps route & focus clear of panels. */
export type MapChromeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export function resolveMapChromeInsets(options: {
  sidebarOpen: boolean;
  hasBottomSheet: boolean;
  isDesktop?: boolean;
}): MapChromeInsets {
  const desktop =
    options.isDesktop ??
    (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);

  if (desktop) {
    return {
      top: 56,
      right: 56,
      bottom: options.hasBottomSheet ? 72 : 48,
      left: options.sidebarOpen ? 340 : 56,
    };
  }

  return {
    top: 72,
    right: 28,
    bottom: options.hasBottomSheet ? 300 : 88,
    left: 28,
  };
}
