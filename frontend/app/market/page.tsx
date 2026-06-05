import { redirect } from "next/navigation";

import { isChinaMarketEnabled } from "@/lib/runtime-flags";

export default function MarketIndexPage() {
  redirect(isChinaMarketEnabled() ? "/market/china" : "/market/local");
}
