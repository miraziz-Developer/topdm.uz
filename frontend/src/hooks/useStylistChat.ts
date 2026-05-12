import { useState } from "react";

import { stylistLookbook } from "@/lib/api";

type StylistResponse = {
  source: string;
  lookbook?: Array<{ product_id: string; reason: string }>;
  explanation?: string;
};

export function useStylistChat() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StylistResponse | null>(null);

  const askStylist = async (text: string, image_url?: string) => {
    setLoading(true);
    try {
      const data = await stylistLookbook({ user_id: "web-user", text, image_url });
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return { loading, result, askStylist };
}
