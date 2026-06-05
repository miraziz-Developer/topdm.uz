"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";

import { BannerCrmPanel } from "@/components/banner-crm-panel";
import { CrmTabShell } from "@/components/crm/crm-tab-shell";
import { MerchantReelsGallery, ReelsUploadWizard } from "@/components/reels-upload-wizard";
import { StoryUploadWidget } from "@/components/story-upload-widget";
import { Button } from "@/components/ui/button";
import { CRM_CONTENT_TABS } from "@/lib/crm-nav";

function ContentHubInner() {
  const tabParam = useSearchParams().get("tab");
  const tab = tabParam === "stories" || tabParam === "banners" ? tabParam : "reels";
  const [reelsMode, setReelsMode] = useState<"gallery" | "upload">("gallery");

  return (
    <CrmTabShell
      tabs={CRM_CONTENT_TABS}
      activeTab={tab}
      title="Kontent markazi"
      description="Reels, Stories va bosh sahifa reklamasi — banner so'mda, reels bepul."
    >
      {tab === "reels" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant={reelsMode === "gallery" ? "primary" : "secondary"} onClick={() => setReelsMode("gallery")}>
              Mening reellarim
            </Button>
            <Button variant={reelsMode === "upload" ? "primary" : "secondary"} onClick={() => setReelsMode("upload")} leftIcon={<Plus className="h-4 w-4" />}>
              Yangi reel
            </Button>
          </div>
          <div className="crm-surface-card p-4 sm:p-6">
            {reelsMode === "upload" ? (
              <ReelsUploadWizard onSuccess={() => setReelsMode("gallery")} />
            ) : (
              <MerchantReelsGallery />
            )}
          </div>
        </div>
      ) : null}

      {tab === "stories" ? (
        <div className="crm-surface-card p-4 sm:p-6">
          <StoryUploadWidget />
        </div>
      ) : null}

      {tab === "banners" ? <BannerCrmPanel /> : null}
    </CrmTabShell>
  );
}

export default function ContentHubPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 rounded-3xl" />}>
      <ContentHubInner />
    </Suspense>
  );
}
