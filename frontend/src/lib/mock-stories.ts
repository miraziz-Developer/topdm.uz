import type { LiveStory } from "@/types";

export type MockStoryCircle = {
  id: string;
  storeName: string;
  location: string;
  itemPreviewUrl: string;
  isUnread: boolean;
};

/** Realistic Ippodrom / Abu Sahiy merchant stories for empty-feed fallback. */
export const MOCK_STORY_CIRCLES: MockStoryCircle[] = [
  {
    id: "mock-murod-vip",
    storeName: "Murod VIP",
    location: "Ippodrom, 2-yo'lak",
    itemPreviewUrl:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=400&q=80",
    isUnread: true,
  },
  {
    id: "mock-anor-boutique",
    storeName: "Anor Boutique",
    location: "Abu Saxiy, 1-Glavniy",
    itemPreviewUrl:
      "https://images.unsplash.com/photo-1434389677669-641f78720c3e?auto=format&fit=crop&w=400&h=400&q=80",
    isUnread: true,
  },
  {
    id: "mock-turk-fashion",
    storeName: "Turk Fashion",
    location: "Ippodrom, 5-yo'lak",
    itemPreviewUrl:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80",
    isUnread: true,
  },
  {
    id: "mock-style-house",
    storeName: "Style House",
    location: "Abu Saxiy, 3-blok",
    itemPreviewUrl:
      "https://images.unsplash.com/photo-1617137968427-85924c800a22?auto=format&fit=crop&w=400&h=400&q=80",
    isUnread: true,
  },
  {
    id: "mock-premium-moda",
    storeName: "Premium Moda",
    location: "Ippodrom, 1-qavat",
    itemPreviewUrl:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=400&q=80",
    isUnread: true,
  },
];

const expiresAt = () => new Date(Date.now() + 86_400_000).toISOString();

export function mockCircleToLiveStory(mock: MockStoryCircle): LiveStory {
  const [market, ...rest] = mock.location.split(",");
  return {
    id: mock.id,
    shop_id: mock.id,
    image_url: mock.itemPreviewUrl,
    level_context: mock.location,
    created_at: new Date().toISOString(),
    expires_at: expiresAt(),
    is_hot: mock.isUnread,
    route_path: "/search",
    shop: {
      id: mock.id,
      name: mock.storeName,
      ipadrom: market?.trim() ?? "Ippodrom",
      floor: rest.join(",").trim() || mock.location,
      location_label: mock.location,
    },
  };
}

export function mockStoriesAsLive(): LiveStory[] {
  return MOCK_STORY_CIRCLES.map(mockCircleToLiveStory);
}
