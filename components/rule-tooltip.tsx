"use client";

// Small hover-triggered explainer for a rule row. Pure CSS (group-hover),
// no JS state needed — the tooltip is positioned above the trigger and
// clipped to stay inside the viewport on narrow cards.
export function RuleTooltip({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <span className="group relative inline-flex cursor-help items-center border-b border-dotted border-gray-400">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 bg-gray-900" />
      </span>
    </span>
  );
}
