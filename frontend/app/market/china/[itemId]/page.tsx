import { redirect } from "next/navigation";

import { ChinaProductDetailPage } from "@/components/market/ChinaProductDetailPage";
import { isChinaMarketEnabled } from "@/lib/runtime-flags";

type Props = {
  params: { itemId: string };
};

export default function ChinaMarketProductRoute({ params }: Props) {
  if (!isChinaMarketEnabled()) {
    redirect("/");
  }
  const raw = decodeURIComponent(params.itemId);
  return <ChinaProductDetailPage itemId={raw} />;
}
