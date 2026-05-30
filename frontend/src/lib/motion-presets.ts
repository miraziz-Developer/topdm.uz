export const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
};

export const cardHover = {
  whileHover: { y: -8, transition: { duration: 0.25 } },
  whileTap: { scale: 0.98 },
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

export const staggerItem = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
};
