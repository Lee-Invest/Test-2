// Decorative vertical "skyline" stripes evoking a high-rise city facade —
// purely visual, used at the edges of the nav bar's glass panel.
const BAR_HEIGHTS = [38, 62, 46, 80, 54, 70, 42];

export function SkylineAccent({ flip = false }: { flip?: boolean }) {
  const bars = flip ? [...BAR_HEIGHTS].reverse() : BAR_HEIGHTS;
  return (
    <div className={`pointer-events-none absolute inset-y-0 ${flip ? "right-0" : "left-0"} flex items-end gap-[4px] overflow-hidden`}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[4px] rounded-t-full bg-gradient-to-t from-gray-700/20 via-gray-700/70 to-gray-800/90"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
