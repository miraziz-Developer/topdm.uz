import { Suspense } from "react";

import { FloatingHeader } from "@/components/ui/floating-header";

function NavFallback() {
  return <header className="fixed inset-x-0 top-0 z-50 h-[4.5rem] bg-canvas/80 backdrop-blur-md" aria-hidden />;
}

export function Navigation() {
  return (
    <Suspense fallback={<NavFallback />}>
      <FloatingHeader />
    </Suspense>
  );
}
