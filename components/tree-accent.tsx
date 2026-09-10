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
          isRight ? "right-0 inset-y-0 w-[30rem] xl:w-[40rem]" : "left-0 inset-y-0 w-80 xl:w-[30rem]"
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
          className={`h-full w-full object-cover ${isRight ? "object-bottom" : "object-top"}`}
        />
        <div
          className={`absolute inset-y-0 w-24 backdrop-blur-md ${
            isRight
              ? "left-0 bg-gradient-to-l from-transparent to-[var(--background)]"
              : "right-0 bg-gradient-to-r from-transparent to-[var(--background)]"
          }`}
        />
        {/* Bottom fade — layered so the photo dissolves gradually into the
            page background instead of ending on a visible edge. Right photo
            is left fully transparent at the bottom with no fade. */}
        {!isRight && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-10 backdrop-blur-sm" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent via-[var(--background)]/40 to-[var(--background)]/80 backdrop-blur-sm" />
          </>
        )}
      </div>

      <div
        aria-hidden
        className={`pointer-events-none absolute top-6 z-30 hidden max-w-[15rem] text-sm font-semibold italic leading-snug tracking-wide lg:block ${
          isRight ? "right-6" : "left-6"
        }`}
        style={{ color: "#b48c46", textShadow: "0 1px 3px rgba(255,255,255,0.6)" }}
      >
        {label}
      </div>
    </>
  );
}
