import { LocalProductPage } from "@/components/market/LocalProductPage";

type Props = {
  params: { itemId: string };
};

export default function LocalMarketProductRoute({ params }: Props) {
  return <LocalProductPage itemId={params.itemId} />;
}
