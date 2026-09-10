"use client";

import { useEffect, useState } from "react";
import { Check, Monitor, Smartphone, Globe } from "lucide-react";
import { formatCents } from "@/lib/utils";

interface Platform {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  features: string[];
  badges: string[];
}

interface Availability {
  templateId: string;
  platformId: string;
  allowed: boolean;
  feeCents: number;
  unavailableReason: string | null;
}

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
  const [platforms, setPlatforms] = useState<Platform[] | null>(null);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/platforms")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setPlatforms(data.platforms ?? []);
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
    return (
      <p className="text-sm text-gray-500">
        Couldn&rsquo;t load trading platforms right now — you can still pick one at checkout.
      </p>
    );
  }

  if (!platforms) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {platforms.map((platform) => {
        const avail = availability.find((a) => a.templateId === templateId && a.platformId === platform.id);
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
