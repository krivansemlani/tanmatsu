// Subtle Hokusai-inspired wave pattern.
// Use as a faint texture in ocean areas of the map or as a background accent.

type Props = {
  className?: string;
  width?: number | string;
  height?: number | string;
  opacity?: number;
  color?: string;
};

export function WavePattern({
  className = "",
  width = "100%",
  height = "100%",
  opacity = 0.18,
  color = "var(--color-indigo)",
}: Props) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      aria-hidden
      style={{ opacity }}
    >
      <defs>
        <pattern
          id="tanmatsu-waves"
          x={0}
          y={0}
          width={80}
          height={28}
          patternUnits="userSpaceOnUse"
        >
          {/* main wave crest */}
          <path
            d="M 0 18 Q 12 8, 24 18 T 48 18 T 72 18 T 96 18"
            fill="none"
            stroke={color}
            strokeWidth={1.2}
            strokeOpacity={0.7}
            strokeLinecap="round"
          />
          {/* secondary lower wave */}
          <path
            d="M 8 24 Q 16 21, 24 24 T 40 24 T 56 24 T 72 24"
            fill="none"
            stroke={color}
            strokeWidth={0.8}
            strokeOpacity={0.4}
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tanmatsu-waves)" />
    </svg>
  );
}
