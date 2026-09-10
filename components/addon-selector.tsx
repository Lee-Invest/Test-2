"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { formatCents } from "@/lib/utils";

interface Addon {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  billing: "ONE_TIME" | "MONTHLY";
}

interface Availability {
  templateId: string;
  addonId: string;
  allowed: boolean;
}

export function AddonSelector({
  templateId,
  selectedIds,
  onToggle,
}: {
  templateId: string;
  selectedIds: string[];
  onToggle: (addon: Addon) => void;
}) {
  const [addons, setAddons] = useState<Addon[] | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/addons")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setAddons(data.addons ?? []);
        setAvailability(data.availability ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-gray-500">Couldn&rsquo;t load add-ons right now — you can skip this step.</p>;
  }

  if (!addons) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (addons.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {addons.map((addon) => {
        const avail = availability.find((a) => a.templateId === templateId && a.addonId === addon.id);
        const allowed = avail?.allowed ?? true;
        const selected = selectedIds.includes(addon.id);

        return (
          <div
            key={addon.id}
            className={`relative flex flex-col gap-1.5 rounded-2xl border-2 p-4 transition ${
              !allowed
                ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60"
                : selected
                ? "cursor-pointer border-[rgba(192,192,197,0.9)] bg-[rgba(192,192,197,0.15)]"
                : "cursor-pointer border-gray-200 bg-white hover:border-gray-300"
            }`}
            onClick={() => allowed && onToggle(addon)}
          >
            {selected && allowed && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(140,140,148,0.9)] text-white">
                <Check size={12} />
              </div>
            )}
            <div className="pr-6 font-semibold text-gray-900">{addon.name}</div>
            <p className="text-xs text-gray-500">{addon.description}</p>
            <div className="mt-auto pt-2 text-xs font-semibold text-gray-700">
              {!allowed ? (
                <span className="text-gray-400">Not available for this account size</span>
              ) : (
                <>
                  {formatCents(addon.priceCents)}
                  {addon.billing === "MONTHLY" ? "/mo" : ""}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
