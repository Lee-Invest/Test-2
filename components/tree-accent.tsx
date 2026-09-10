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
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute hidden overflow-hidden lg:block ${
          isRight ? "right-0 top-0 z-20 h-[900px] w-[26rem] xl:w-[34rem]" : "left-0 inset-y-0 w-80 xl:w-[30rem]"
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
          className="h-full w-full object-cover object-top"
        />
        {!isRight && <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />}
        <div
          className={`absolute inset-y-0 w-24 backdrop-blur-md ${
            isRight
              ? "left-0 bg-gradient-to-l from-transparent to-[var(--background)]"
              : "right-0 bg-gradient-to-r from-transparent to-[var(--background)]"
          }`}
        />
        {!isRight && (
          <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-[var(--background)] via-[var(--background)]/40 to-transparent" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent via-[var(--background)]/60 to-[var(--background)] backdrop-blur-md" />
      </div>

      {/* Rendered as its own layer (z-30) so it always shows above the hero
          glass panel (z-10) instead of being hidden underneath it. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute top-6 z-30 hidden text-sm font-medium italic tracking-wide lg:block ${
          isRight ? "right-8" : "left-8"
        }`}
        style={{ color: "rgba(226, 229, 233, 0.95)", textShadow: "0 1px 6px rgba(0,0,0,0.45)" }}
      >
        {label}
      </div>
    </>
  );
}
