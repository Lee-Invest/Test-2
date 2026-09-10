// Tall decorative image pinned to an edge of the homepage, running the full
// height of the content area (from just under the nav down to the footer,
// which marks the end of the page). Fades into a frosted-glass edge on the
// side facing the page content, rather than a hard cut.
export function TreeAccent({ side = "left" }: { side?: "left" | "right" }) {
  const isRight = side === "right";
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 hidden w-80 overflow-hidden lg:block xl:w-[28rem] ${
        isRight ? "right-0" : "left-0"
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
    </div>
  );
}
