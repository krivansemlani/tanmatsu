// Sakura/maple petals drifting across the viewport.
// CSS-animated for performance — each petal has randomized delay, duration, x-start.
// Restrained: 8 petals max so it whispers rather than shouts.

type Props = {
  count?: number;
  /** className applied to the container — typically "absolute inset-0 pointer-events-none" */
  className?: string;
};

// Deterministic "random" values keyed by petal index so server + client render the same.
function seedRandom(seed: number) {
  // simple LCG — stable across renders
  let s = seed * 2654435761;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function SakuraPetals({ count = 8, className = "" }: Props) {
  const petals = Array.from({ length: count }, (_, i) => {
    const rand = seedRandom(i + 1);
    const startX = rand() * 100;            // % of viewport width
    const duration = 18 + rand() * 22;      // 18-40s
    const delay = -rand() * duration;       // negative — already partway through on mount
    const sway = 7 + rand() * 7;            // 7-14s sway period
    const size = 8 + rand() * 8;            // 8-16px
    const rotate = rand() * 360;
    const opacity = 0.3 + rand() * 0.35;    // 0.3-0.65
    return { startX, duration, delay, sway, size, rotate, opacity, i };
  });

  return (
    <div
      className={`pointer-events-none overflow-hidden ${className}`}
      aria-hidden
    >
      {petals.map((p) => (
        <span
          key={p.i}
          className="sakura-petal absolute top-0 will-change-transform"
          style={{
            left: `${p.startX}%`,
            animation: `sakura-fall ${p.duration}s linear ${p.delay}s infinite`,
            opacity: p.opacity,
          }}
        >
          <span
            className="block"
            style={{
              animation: `sakura-sway ${p.sway}s ease-in-out infinite`,
              transform: `rotate(${p.rotate}deg)`,
            }}
          >
            <svg
              width={p.size}
              height={p.size}
              viewBox="0 0 20 20"
              aria-hidden
            >
              {/* Petal — almond shape with notched tip, classic sakura silhouette */}
              <path
                d="M 10 2
                   Q 14 6, 14 11
                   Q 14 17, 10 18
                   Q 6 17, 6 11
                   Q 6 6, 10 2
                   Z
                   M 10 17 L 9 19 L 11 19 Z"
                fill="var(--color-seal)"
              />
            </svg>
          </span>
        </span>
      ))}
    </div>
  );
}
