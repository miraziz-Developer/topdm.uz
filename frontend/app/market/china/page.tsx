import { redirect } from "next/navigation";

import { ChinaProductPage } from "@/components/market/ChinaProductPage";
import { isChinaMarketEnabled } from "@/lib/runtime-flags";

export default function ChinaMarketRoute() {
  if (!isChinaMarketEnabled()) {
    redirect("/");
  }
  return <ChinaProductPage />;
}
