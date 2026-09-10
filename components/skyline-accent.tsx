// Decorative vertical "skyline" stripes evoking a high-rise city facade —
// purely visual, used at the edges of the nav bar's glass panel.
const BAR_HEIGHTS = [38, 62, 46, 80, 54, 70, 42];

export function SkylineAccent({ flip = false }: { flip?: boolean }) {
  const bars = flip ? [...BAR_HEIGHTS].reverse() : BAR_HEIGHTS;
  return (
    <div className={`pointer-events-none absolute inset-y-0 ${flip ? "right-0" : "left-0"} flex items-end gap-[3px] overflow-hidden opacity-70`}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-t-full bg-gradient-to-t from-white/10 via-white/60 to-white/90"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
