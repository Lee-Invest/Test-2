// Tall decorative image pinned to an edge of the homepage, rendered above
// the hero section's glass panel (z-20 vs the hero's z-10) so both photos
// show normally at the top of the page instead of looking muted underneath
// it. The left one keeps its full page-length height down to the footer;
// the right one is shorter, fading out partway down the page instead of
// reaching the bottom.
export function TreeAccent({ side = "left" }: { side?: "left" | "right" }) {
  const isRight = side === "right";
  const label = isRight
    ? "Think Big — with the trust of ApexFund Headquarters Finance"
    : "Think High — with the trust of ApexFund Nature Trust";
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
        {/* Bottom fade — layered so the photo dissolves gradually into the
            page background instead of ending on a visible edge. */}
        <div className="absolute inset-x-0 bottom-0 h-24 backdrop-blur-sm" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent via-[var(--background)]/50 to-[var(--background)]/85 backdrop-blur-md" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-[var(--background)]" />
      </div>

      <div
        aria-hidden
        className={`pointer-events-none absolute top-6 z-30 hidden max-w-[15rem] rounded-lg px-3 py-2 text-sm font-semibold italic leading-snug tracking-wide text-white shadow-lg lg:block ${
          isRight ? "right-6" : "left-6"
        }`}
        style={{ backgroundColor: "rgba(30, 41, 59, 0.65)", backdropFilter: "blur(6px)" }}
      >
        {label}
      </div>
    </>
  );
}
