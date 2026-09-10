"use client";

import { useEffect } from "react";

// Progressive enhancement only: auto-submits #configurator-form the moment
// an account-size or platform radio changes, instead of making the trader
// click "Update" manually. This is a real (fast) navigation, not a
// zero-reload DOM patch — a hand-rolled client-side re-implementation of the
// pricing/availability logic was deliberately avoided so the preview can
// never drift from what /api/checkout actually charges. If this script
// never runs for any reason, the always-visible "Update" / "Apply platform
// selection" buttons already do the exact same thing on click, so the page
// is fully functional either way.
export function ConfiguratorClient() {
  useEffect(() => {
    const el = document.getElementById("configurator-form");
    if (!(el instanceof HTMLFormElement)) return;
    const form: HTMLFormElement = el;

    function onChange(e: Event) {
      if (e.target instanceof HTMLInputElement && e.target.type === "radio") {
        form.requestSubmit();
      }
    }

    form.addEventListener("change", onChange);
    return () => form.removeEventListener("change", onChange);
  }, []);

  return null;
}
