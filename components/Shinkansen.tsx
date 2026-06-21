// Stylized Shinkansen — ink body, paper highlights, vermillion accent stripe.
// Use direction="left" to face left (default faces right).

type Props = {
  className?: string;
  width?: number;
  direction?: "left" | "right";
};

export function Shinkansen({
  className = "",
  width = 280,
  direction = "right",
}: Props) {
  const height = width * 0.21;

  return (
    <svg
      viewBox="0 0 280 60"
      width={width}
      height={height}
      className={className}
      aria-hidden
      style={direction === "left" ? { transform: "scaleX(-1)" } : undefined}
    >
      <defs>
        <linearGradient id="train-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-paper)" />
          <stop offset="100%" stopColor="var(--color-paper-deep)" />
        </linearGradient>
      </defs>

      {/* Body — long teardrop nose + body */}
      <path
        d="M 4 30
           Q 18 14, 60 14
           L 268 14
           Q 274 14, 274 18
           L 274 42
           Q 274 46, 268 46
           L 60 46
           Q 18 46, 4 30 Z"
        fill="url(#train-body)"
        stroke="var(--color-brush)"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />

      {/* Nose darker tip — the front cap */}
      <path
        d="M 4 30 Q 14 22, 36 18 L 36 42 Q 14 38, 4 30 Z"
        fill="var(--color-brush)"
        opacity={0.85}
      />

      {/* Vermillion accent stripe — Tanmatsu signature */}
      <rect x="40" y="29.5" width="232" height="2.2" fill="var(--color-seal)" />
      <rect x="40" y="33" width="232" height="0.8" fill="var(--color-seal-deep)" opacity={0.5} />

      {/* Windows — small rounded rectangles */}
      {[78, 110, 142, 174, 206, 238].map((cx, i) => (
        <rect
          key={i}
          x={cx}
          y={19}
          width={20}
          height={7}
          rx={2}
          fill="var(--color-indigo-deep)"
          opacity={0.7}
        />
      ))}

      {/* Cockpit window */}
      <path
        d="M 42 24 Q 56 18, 70 18 L 70 26 Q 56 28, 42 26 Z"
        fill="var(--color-indigo-deep)"
        opacity={0.7}
      />

      {/* Headlight glint */}
      <circle cx="14" cy="30" r="1.6" fill="var(--color-paper)" opacity={0.9} />

      {/* Subtle door lines between cars */}
      {[100, 168, 236].map((x, i) => (
        <line
          key={i}
          x1={x}
          y1={16}
          x2={x}
          y2={44}
          stroke="var(--color-brush)"
          strokeOpacity={0.3}
          strokeWidth={0.6}
        />
      ))}

      {/* Wheels / shadow under */}
      <rect x="48" y="44" width="220" height="2" fill="var(--color-brush)" opacity={0.5} />
      {[68, 124, 180, 236].map((cx, i) => (
        <circle key={i} cx={cx} cy={48} r={3} fill="var(--color-brush)" opacity={0.65} />
      ))}
    </svg>
  );
}
