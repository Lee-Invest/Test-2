"use client";

import { useEffect } from "react";
import { STATIC_TEMPLATES } from "@/lib/static-templates";
import { STATIC_PLATFORMS, STATIC_PLATFORM_AVAILABILITY } from "@/lib/static-platforms";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function setText(field: string, value: string) {
  const el = document.querySelector(`[data-field="${field}"]`);
  if (el) el.textContent = value;
}

function setRowHidden(role: string, hidden: boolean) {
  const el = document.querySelector(`[data-role="${role}"]`);
  if (el instanceof HTMLElement) el.hidden = hidden;
}

// Full progressive enhancement: every selection (account size, platform,
// program, add-ons) recomputes and updates the entire page in place —
// no navigation, no URL change, same as clicking through a normal app.
// Everything computed here comes from the same static, publicly-known
// pricing data already rendered on the page (lib/static-templates.ts,
// lib/static-platforms.ts) or from data-* attributes the server already
// rendered (a program's phaseCount, the active discount's mode/value) —
// nothing here can drift from what /api/checkout re-verifies
// authoritatively at purchase time, since it re-derives all of this from
// the database independently.
//
// Only the coupon field still causes a real (fast) page reload: whether a
// code is valid has to come from the database, so it can't be previewed
// purely client-side.
//
// All underlying inputs are still real, native radio/checkbox controls
// inside real <form>s, so the page keeps working even if this script never
// runs for any reason — selections just wouldn't auto-apply or live-update
// without it.
export function ConfiguratorClient() {
  useEffect(() => {
    const form = document.getElementById("configurator-form");
    if (!(form instanceof HTMLFormElement)) return;

    function checked(name: string): HTMLInputElement | null {
      return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`);
    }

    function recompute() {
      const templateInput = checked("template");
      const template = STATIC_TEMPLATES.find((t) => t.id === templateInput?.value);
      if (!template) return;

      // Sync the checkout form's own templateId immediately.
      const checkoutTemplateId = document.getElementById("checkout-templateId");
      if (checkoutTemplateId instanceof HTMLInputElement) checkoutTemplateId.value = template.id;

      // Every account-size card's own price (relevant if that ever varies).
      for (const t of STATIC_TEMPLATES) {
        setText(`price-${t.id}`, formatCents(t.priceCents));
      }

      // Program cards: the "10% → 5%"-style step summary depends on the
      // selected account size's targets, so every program's text needs
      // recomputing whenever the size changes, not just the checked one.
      const programInput = checked("program");
      document.querySelectorAll<HTMLInputElement>('input[name="program"]').forEach((input) => {
        const phaseCount = Number(input.dataset.phaseCount ?? 2);
        const steps =
          phaseCount === 0
            ? "Instant funding"
            : phaseCount === 1
            ? `${template.phase1ProfitTargetPct}%`
            : `${template.phase1ProfitTargetPct}% → ${template.phase2ProfitTargetPct}%`;
        setText(`program-steps-${input.value}`, steps);
      });
      const checkoutProgramId = document.getElementById("checkout-programId");
      if (checkoutProgramId instanceof HTMLInputElement) checkoutProgramId.value = programInput?.value ?? "";
      const programName = programInput?.closest("label")?.querySelector("h3")?.textContent ?? "—";

      // Platform cards: availability/fee depends on the selected account
      // size. Update every card's disabled/allowed state and note text,
      // and if the currently-checked platform just became unavailable for
      // the new size, uncheck it (matching what a full server reload would
      // have done).
      let platformFeeCents = 0;
      document.querySelectorAll<HTMLInputElement>('input[name="platform"]').forEach((input) => {
        const avail = STATIC_PLATFORM_AVAILABILITY.find((a) => a.templateId === template.id && a.platformId === input.value);
        const allowed = avail?.allowed ?? true;
        input.disabled = !allowed;
        if (!allowed && input.checked) input.checked = false;

        const label = input.closest("label");
        if (label) {
          label.classList.toggle("cursor-not-allowed", !allowed);
          label.classList.toggle("opacity-50", !allowed);
          label.classList.toggle("cursor-pointer", allowed);
        }

        const fee = avail?.feeCents ?? 0;
        setText(`platform-note-${input.value}`, !allowed ? avail?.unavailableReason ?? "Not available" : fee > 0 ? `+${formatCents(fee)}` : "");

        if (input.checked) platformFeeCents = fee;
      });
      const platformInput = checked("platform");
      const platform = STATIC_PLATFORMS.find((p) => p.id === platformInput?.value);
      const checkoutPlatformId = document.getElementById("checkout-platformId");
      if (checkoutPlatformId instanceof HTMLInputElement) checkoutPlatformId.value = platformInput?.value ?? "";

      // Add-ons: price shown as a % of the evaluation fee, so it also
      // depends on account size; total depends only on which are checked.
      const addonInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="addon"]'));
      document.querySelectorAll<HTMLInputElement>('input[name="addon"]').forEach((input) => {
        const priceCents = Number(input.dataset.addonPriceCents ?? 0);
        const pct = template.priceCents > 0 ? Math.round((priceCents / template.priceCents) * 100) : 0;
        const el = document.querySelector(`[data-field="addon-pct-${input.value}"]`);
        if (el) {
          const isMonthly = el.textContent?.includes("/mo");
          el.textContent = `+${pct}%${isMonthly ? "/mo" : ""}`;
        }
      });
      const selectedAddons = addonInputs.filter((c) => c.checked);
      const addonTotalCents = selectedAddons.reduce((sum, c) => sum + Number(c.dataset.addonPriceCents ?? 0), 0);

      const hiddenContainer = document.querySelector('[data-role="addon-hidden-fields"]');
      if (hiddenContainer) {
        hiddenContainer.innerHTML = "";
        for (const c of selectedAddons) {
          const hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.name = "addonIds";
          hidden.value = c.value;
          hiddenContainer.appendChild(hidden);
        }
      }

      // Discount: mode/value came from the server (a percent-based coupon
      // or multi-account discount scales with the new price; a fixed-cents
      // one doesn't) — see the data-discount-* attributes on the summary.
      const aside = document.querySelector('[data-role="order-summary"]');
      const discountMode = aside instanceof HTMLElement ? aside.dataset.discountMode : "none";
      const discountValue = Number((aside instanceof HTMLElement && aside.dataset.discountValue) || 0);
      let discountCents = 0;
      if (discountMode === "percent") discountCents = Math.round((template.priceCents * discountValue) / 100);
      else if (discountMode === "fixed") discountCents = Math.min(discountValue, template.priceCents);

      const totalCents = template.priceCents - discountCents + platformFeeCents + addonTotalCents;

      setText("summary-size", `$${template.accountSize.toLocaleString()}`);
      setText("summary-program", programName);
      setText("summary-platform", platform ? platform.name : "No preference");
      setText("summary-addons", selectedAddons.length > 0 ? selectedAddons.map((c) => c.dataset.addonName).join(", ") : "None");
      setText("summary-subtotal", formatCents(template.priceCents));
      setText("summary-platform-fee", formatCents(platformFeeCents));
      setRowHidden("summary-platform-fee-row", platformFeeCents === 0);
      setText("summary-addon-total", formatCents(addonTotalCents));
      setRowHidden("summary-addon-total-row", addonTotalCents === 0);
      setText("summary-discount", `-${formatCents(discountCents)}`);
      setRowHidden("summary-discount-row", discountCents === 0);
      setText("summary-total", formatCents(totalCents));
    }

    // Listen at the document level, not on the form itself: platform,
    // program, and add-on inputs join #configurator-form via the
    // `form="configurator-form"` attribute without being its DOM
    // descendants, so their change events never bubble up to a listener
    // placed on `form` directly.
    function onChange(e: Event) {
      if (e.target instanceof HTMLInputElement && e.target.form === form) recompute();
    }

    document.addEventListener("change", onChange);
    recompute();
    return () => document.removeEventListener("change", onChange);
  }, []);

  return null;
}
