"use client";

import { Check } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { STATIC_ADDONS } from "@/lib/static-addons";

export function AddonSelector({
  selectedIds,
  onToggle,
}: {
  templateId: string;
  selectedIds: string[];
  onToggle: (addon: { id: string; name: string; priceCents: number }) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {STATIC_ADDONS.map((addon) => {
        const selected = selectedIds.includes(addon.id);

        return (
          <button
            key={addon.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(addon)}
            className={`relative flex flex-col gap-1.5 rounded-2xl border-2 p-4 text-left transition ${
              selected
                ? "border-[#b48c46] bg-[rgba(180,140,70,0.1)]"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            {selected && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#b48c46] text-white">
                <Check size={12} />
              </div>
            )}
            <div className="pr-6 font-semibold text-gray-900">{addon.name}</div>
            <p className="text-xs text-gray-500">{addon.description}</p>
            <div className="mt-auto pt-2 text-xs font-semibold text-gray-700">
              {formatCents(addon.priceCents)}
              {addon.billing === "MONTHLY" ? "/mo" : ""}
            </div>
          </button>
        );
      })}
    </div>
  );
}
