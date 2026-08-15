"use client";

import Script from "next/script";

const METRIKA_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim();

/** Optional Yandex Metrika — set NEXT_PUBLIC_YANDEX_METRIKA_ID in production .env */
export function SiteAnalytics() {
  if (!METRIKA_ID || process.env.NODE_ENV !== "production") {
    return null;
  }

  return (
    <Script id="yandex-metrika" strategy="afterInteractive">
      {`
        (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
        (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
        ym(${METRIKA_ID}, "init", {
          ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer",
          trackLinks:true, accurateTrackBounce:true,
          referrer: document.referrer, url: location.href
        });
      `}
    </Script>
  );
}
