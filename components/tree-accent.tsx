// Tall decorative image pinned to the left edge of the homepage, running the
// full height of the content area (from just under the nav down to the
// footer, which marks the end of the page). Fades into a frosted-glass edge
// on its right side rather than a hard cut.
export function TreeAccent() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 left-0 hidden w-64 overflow-hidden lg:block xl:w-80"
      style={{ WebkitMaskImage: "linear-gradient(to right, black 65%, transparent 100%)", maskImage: "linear-gradient(to right, black 65%, transparent 100%)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/tree.jpg" alt="" className="h-full w-full object-cover object-top" />
      <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-r from-transparent to-[var(--background)] backdrop-blur-md" />
    </div>
  );
}
