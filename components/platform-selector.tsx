"use client";

import { Check, Monitor, Smartphone, Globe } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { STATIC_PLATFORMS, STATIC_PLATFORM_AVAILABILITY } from "@/lib/static-platforms";

const BADGE_ICON: Record<string, React.ElementType> = {
  WEB: Globe,
  MOBILE: Smartphone,
};

export function PlatformSelector({
  templateId,
  selectedId,
  onSelect,
}: {
  templateId: string;
  selectedId: string | null;
  onSelect: (platformId: string | null, feeCents: number) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {STATIC_PLATFORMS.map((platform) => {
        const avail = STATIC_PLATFORM_AVAILABILITY.find(
          (a) => a.templateId === templateId && a.platformId === platform.id
        );
        const allowed = avail?.allowed ?? true;
        const feeCents = avail?.feeCents ?? 0;
        const selected = selectedId === platform.id;

        return (
          <div
            key={platform.id}
            className={`relative flex flex-col gap-2 rounded-2xl border-2 p-4 transition ${
              !allowed
                ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60"
                : selected
                ? "cursor-pointer border-[#b48c46] bg-[rgba(180,140,70,0.1)]"
                : "cursor-pointer border-gray-200 bg-white hover:border-gray-300"
            }`}
            onClick={() => allowed && onSelect(selected ? null : platform.id, feeCents)}
          >
            {selected && allowed && (
              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#b48c46] text-white">
                <Check size={12} />
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {platform.badges.map((b) => {
                const Icon = BADGE_ICON[b] ?? Monitor;
                return (
                  <span
                    key={b}
                    className="inline-flex items-center gap-1 rounded-full bg-gray-900/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600"
                  >
                    <Icon size={10} />
                    {b}
                  </span>
                );
              })}
            </div>
            <div className="font-semibold text-gray-900">{platform.name}</div>
            <p className="text-xs text-gray-500">{platform.tagline}</p>
            <ul className="mt-1 space-y-1 text-xs text-gray-600">
              {platform.features.map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-gray-400" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-2 text-xs font-semibold">
              {!allowed ? (
                <span className="text-gray-400">{avail?.unavailableReason ?? "Not available for this account size"}</span>
              ) : feeCents > 0 ? (
                <span className="text-gray-700">+{formatCents(feeCents)}</span>
              ) : (
                <span className="text-[var(--brand-accent)]">Included</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
