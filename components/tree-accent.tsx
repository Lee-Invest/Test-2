// Tall decorative image pinned to an edge of the homepage, rendered above
// the hero section's glass panel (z-20 vs the hero's z-10) so both photos
// show normally at the top of the page instead of looking muted underneath
// it. The left one keeps its full page-length height down to the footer;
// the right one is shorter, fading out partway down the page instead of
// reaching the bottom.
export function TreeAccent({ side = "left" }: { side?: "left" | "right" }) {
  const isRight = side === "right";
  const label = isRight ? "With Finance Trust" : "With Nature Trust";
  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute z-20 hidden overflow-hidden lg:block ${
          isRight ? "right-0 top-0 h-[1050px] w-[26rem] xl:w-[34rem]" : "left-0 inset-y-0 w-80 xl:w-[30rem]"
        }`}
        style={{
          WebkitMaskImage: `linear-gradient(to ${isRight ? "left" : "right"}, black 85%, transparent 100%)`,
          maskImage: `linear-gradient(to ${isRight ? "left" : "right"}, black 85%, transparent 100%)`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isRight ? "/tree-right.png" : "/tree.png"}
          alt=""
          className={`h-full w-full object-cover ${isRight ? "object-center" : "object-top"}`}
        />
        <div
          className={`absolute inset-y-0 w-24 backdrop-blur-md ${
            isRight
              ? "left-0 bg-gradient-to-l from-transparent to-[var(--background)]"
              : "right-0 bg-gradient-to-r from-transparent to-[var(--background)]"
          }`}
        />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent via-[var(--background)]/60 to-[var(--background)] backdrop-blur-md" />
      </div>

      <div
        aria-hidden
        className={`pointer-events-none absolute top-6 z-30 hidden text-base font-semibold italic tracking-wide lg:block ${
          isRight ? "right-8" : "left-8"
        }`}
        style={{ color: "rgba(51, 65, 85, 0.98)", textShadow: "0 1px 3px rgba(255,255,255,0.9), 0 0 10px rgba(255,255,255,0.6)" }}
      >
        {label}
      </div>
    </>
  );
}
