"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";

import { reportClientError, reportWebVital } from "@/lib/browser-monitoring";

export function BrowserObservability() {
  useReportWebVitals(reportWebVital);

  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}