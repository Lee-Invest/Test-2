"use client";

import { useEffect, useState } from "react";

/**
 * Site-wide safety net for the "looks fine, nothing is clickable" reports.
 * A React error boundary only catches errors thrown during render — it does
 * NOT catch errors thrown inside event handlers (onClick, etc.) or async
 * code, which is exactly where a silently-swallowed exception would explain
 * "clicking does nothing, no crash, no console access to check." This
 * listens at the window level for both uncaught exceptions and unhandled
 * promise rejections, anywhere on the site, and renders whatever it catches
 * directly on screen — so a failure that would otherwise only show up in a
 * devtools console we can't see becomes visible to whoever is looking at
 * the page.
 */
export function GlobalErrorWatcher() {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    function record(label: string, err: unknown) {
      const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      setErrors((prev) => (prev.includes(`${label} — ${message}`) ? prev : [...prev, `${label} — ${message}`]));
    }
    function onError(e: ErrorEvent) {
      record("Error", e.error ?? e.message);
    }
    function onRejection(e: PromiseRejectionEvent) {
      record("Unhandled promise rejection", e.reason);
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (errors.length === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[9999] max-h-64 overflow-y-auto border-t-4 border-red-600 bg-red-950 px-4 py-3 text-xs text-red-100 shadow-2xl">
      <p className="font-bold uppercase tracking-wide text-red-300">
        {errors.length} JavaScript error{errors.length > 1 ? "s" : ""} detected on this page
      </p>
      {errors.map((e, i) => (
        <p key={i} className="mt-1 font-mono">
          {e}
        </p>
      ))}
    </div>
  );
}
