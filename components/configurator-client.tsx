"use client";

import { useEffect } from "react";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Progressive enhancement only.
//
// Account size / platform / program / payment-method changes still
// auto-submit #configurator-form (a real, fast navigation) instead of
// requiring a manual "Update" click — a hand-rolled client-side
// re-implementation of the pricing/availability logic for those was
// deliberately avoided so the preview can never drift from what
// /api/checkout actually charges.
//
// Add-ons are the one exception: selecting one must not reload the page at
// all, so this recomputes the add-ons list/total/grand-total directly in
// the DOM (the numbers are simple sums of static, publicly-known add-on
// prices already rendered on the page — nothing here can drift from
// reality) and keeps the checkout form's hidden addonIds fields in sync so
// the actual purchase reflects the live selection.
//
// All the underlying inputs are still real, native form controls
// (radio/checkbox) submitted by real <form>s, so the page keeps working
// even if this script never runs — selections just wouldn't auto-apply or
// live-update without it.
export function ConfiguratorClient() {
  useEffect(() => {
    const el = document.getElementById("configurator-form");
    if (!(el instanceof HTMLFormElement)) return;
    const form: HTMLFormElement = el;

    function updateAddonSummary() {
      const checkboxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="addon"]'));
      const selected = checkboxes.filter((c) => c.checked);
      const addonTotalCents = selected.reduce((sum, c) => sum + Number(c.dataset.addonPriceCents ?? 0), 0);

      const namesField = document.querySelector('[data-field="summary-addons"]');
      if (namesField) namesField.textContent = selected.length > 0 ? selected.map((c) => c.dataset.addonName).join(", ") : "None";

      const totalRow = document.querySelector('[data-role="summary-addon-total-row"]');
      const totalField = document.querySelector('[data-field="summary-addon-total"]');
      if (totalRow instanceof HTMLElement) totalRow.hidden = addonTotalCents === 0;
      if (totalField) totalField.textContent = formatCents(addonTotalCents);

      const aside = document.querySelector('[data-role="order-summary"]');
      const grandTotalField = document.querySelector('[data-field="summary-total"]');
      if (aside instanceof HTMLElement && grandTotalField) {
        const baseTotalCents = Number(aside.dataset.baseTotalCents ?? 0);
        grandTotalField.textContent = formatCents(baseTotalCents + addonTotalCents);
      }

      const hiddenContainer = document.querySelector('[data-role="addon-hidden-fields"]');
      if (hiddenContainer) {
        hiddenContainer.innerHTML = "";
        for (const c of selected) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = "addonIds";
          input.value = c.value;
          hiddenContainer.appendChild(input);
        }
      }
    }

    // Listen at the document level, not on the form itself: platform,
    // program, add-on, and payment-method inputs join this form via the
    // `form="configurator-form"` attribute without being its DOM
    // descendants, so their change events never bubble up to a listener
    // placed on `form` directly.
    function onChange(e: Event) {
      const target = e.target;
      if (!(target instanceof HTMLInputElement) || target.form !== form) return;

      if (target.name === "addon") {
        updateAddonSummary();
        return;
      }
      form.requestSubmit();
    }

    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, []);

  return null;
}
