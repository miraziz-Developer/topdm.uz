"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ImageMagnifierProps = {
  src: string;
  alt: string;
  className?: string;
};

export function ImageMagnifier({ src, alt, className }: ImageMagnifierProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPosition({ x, y });
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-[4/5] w-full overflow-hidden rounded-[1.75rem] bg-[#f0eeea] ring-1 ring-black/[0.06] shadow-[0_24px_64px_-28px_rgba(15,23,42,0.22)] sm:aspect-square sm:rounded-[2rem]",
        className,
      )}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onMouseMove={onMove}
    >
      <Image src={src} alt={alt} fill priority className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
      {active ? (
        <div
          className="pointer-events-none absolute h-28 w-28 rounded-full border-2 border-electric-500/70 shadow-hover"
          style={{ left: `calc(${position.x}% - 3.5rem)`, top: `calc(${position.y}% - 3.5rem)` }}
        />
      ) : null}
      {active ? (
        <div className="pointer-events-none absolute right-4 top-4 hidden h-40 w-40 overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-modal md:block">
          <div
            className="h-full w-full bg-cover bg-no-repeat"
            style={{
              backgroundImage: `url(${src})`,
              backgroundPosition: `${position.x}% ${position.y}%`,
              backgroundSize: "220%",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
