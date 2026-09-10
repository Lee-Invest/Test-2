// Tall decorative image pinned to an edge of the homepage. The left one runs
// the full height of the content area down to the footer; the right one is
// shorter, ending partway down the page with its own soft fade rather than
// reaching the bottom. Both fade into a frosted-glass edge on the side
// facing the page content, and at their top/bottom edges, instead of a hard
// cut — the top fade in particular smooths the seam where the hero glass
// panel above ends and the photo becomes fully visible.
export function TreeAccent({ side = "left" }: { side?: "left" | "right" }) {
  const isRight = side === "right";
  const label = isRight ? "With Finance Trust" : "With Nature Trust";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute hidden w-80 overflow-hidden lg:block xl:w-[28rem] ${
        isRight ? "right-0 top-0 h-[880px]" : "left-0 inset-y-0"
      }`}
      style={{
        WebkitMaskImage: `linear-gradient(to ${isRight ? "left" : "right"}, black 65%, transparent 100%)`,
        maskImage: `linear-gradient(to ${isRight ? "left" : "right"}, black 65%, transparent 100%)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={isRight ? "/tree-right.png" : "/tree.png"}
        alt=""
        className="h-full w-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
      <div
        className={`absolute inset-y-0 w-24 backdrop-blur-md ${
          isRight
            ? "left-0 bg-gradient-to-l from-transparent to-[var(--background)]"
            : "right-0 bg-gradient-to-r from-transparent to-[var(--background)]"
        }`}
      />
      <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-[var(--background)] via-[var(--background)]/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--background)] backdrop-blur-md" />
      <div
        className={`absolute top-24 text-sm font-medium italic tracking-wide text-white/90 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] ${
          isRight ? "right-6" : "left-6"
        }`}
        style={{ color: "rgba(212, 175, 132, 0.9)" }}
      >
        {label}
      </div>
    </div>
  );
}
