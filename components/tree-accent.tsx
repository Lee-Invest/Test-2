// Tall decorative image pinned to an edge of the homepage, rendered above
// the hero section's glass panel (z-20 vs the hero's z-10) so both photos
// show normally at the top of the page instead of looking muted underneath
// it.
//
// Its width is a CSS clamp() tied to the actual leftover space beside the
// centered max-w-6xl (1152px) content column, not a fixed size gated by a
// breakpoint. That leftover space shrinks continuously as the window is
// resized, so the photo shrinks continuously with it (down to 0, i.e.
// invisible) instead of staying a fixed width and abruptly overlapping the
// text once the window gets narrower than whatever breakpoint was chosen.
const CONTENT_WIDTH_PX = 1152;
const GUTTER_PADDING_PX = 32;
const MAX_PHOTO_WIDTH_PX = 224;

// (100vw - content)/2 is the space on one side of the centered content; we
// reserve some of that as padding and clamp the rest between 0 and a max.
const clampWidth = `clamp(0px, calc((100vw - ${CONTENT_WIDTH_PX}px) / 2 - ${GUTTER_PADDING_PX}px), ${MAX_PHOTO_WIDTH_PX}px)`;

export function TreeAccent({ side = "left" }: { side?: "left" | "right" }) {
  const isRight = side === "right";
  const label = isRight
    ? "Think Big — with the trust of ApexFund Headquarters Finance"
    : "Think High — with the trust of ApexFund Nature Trust";
  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute z-20 hidden overflow-hidden md:block ${
          isRight ? "right-0 inset-y-0" : "left-0 inset-y-0"
        }`}
        style={{
          width: clampWidth,
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
            page background instead of ending on a visible edge. */}
        <div className="absolute inset-x-0 bottom-0 h-10 backdrop-blur-sm" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent via-[var(--background)]/40 to-[var(--background)]/80 backdrop-blur-sm" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute top-6 z-30 hidden max-w-[15rem] overflow-hidden text-sm font-semibold italic leading-snug tracking-wide md:block"
        style={{
          [isRight ? "right" : "left"]: "1.5rem",
          width: `calc(${clampWidth} - 1.5rem)`,
          color: "#ffffff",
          textShadow: "0 1px 4px rgba(0,0,0,0.6)",
        }}
      >
        {label}
      </div>
    </>
  );
}
