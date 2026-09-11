"use client";

import { useEffect } from "react";

// Progressive enhancement only: auto-submits #configurator-form the moment
// an account-size, platform, program, add-on, or payment-method input
// changes, instead of making the trader click "Update" manually. This is a
// real (fast) navigation, not a zero-reload DOM patch — a hand-rolled
// client-side re-implementation of the pricing/availability logic was
// deliberately avoided so the preview can never drift from what
// /api/checkout actually charges. If this script never runs for any
// reason, the always-visible "Update" button (and the other "Apply ..."
// buttons still present for program/platform/payment) already do the exact
// same thing on click, so the page is fully functional either way.
export function ConfiguratorClient() {
  useEffect(() => {
    const el = document.getElementById("configurator-form");
    if (!(el instanceof HTMLFormElement)) return;
    const form: HTMLFormElement = el;

    // Listen at the document level, not on the form itself: several inputs
    // (platform, program, add-ons, payment method) use the `form="..."`
    // attribute to join this form without being its DOM descendants, so
    // their change events never bubble up to a listener on `form` directly.
    function onChange(e: Event) {
      const target = e.target;
      if (target instanceof HTMLInputElement && target.form === form) {
        form.requestSubmit();
      }
    }

    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  return null;
}
