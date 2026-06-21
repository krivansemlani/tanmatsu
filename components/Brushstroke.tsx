// Hand-drawn-looking brushstroke divider.
// Used as section dividers and route lines on the map.
// Variable width via two stacked paths with stroke-dasharray for texture.

type Props = {
  className?: string;
  width?: number | string;
  height?: number;
  color?: string;
  dashed?: boolean;
  orientation?: "horizontal" | "vertical";
};

export function Brushstroke({
  className = "",
  width = "100%",
  height = 14,
  color = "var(--color-brush)",
  dashed = false,
  orientation = "horizontal",
}: Props) {
  if (orientation === "horizontal") {
    return (
      <svg
        viewBox="0 0 600 14"
        width={width}
        height={height}
        preserveAspectRatio="none"
        className={className}
        aria-hidden
      >
        {/* main stroke — varying-thickness illusion via two overlapping paths */}
        <path
          d="M 4 7 Q 80 6, 160 7 T 320 7 T 480 7 T 596 7"
          fill="none"
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeOpacity={0.85}
          strokeDasharray={dashed ? "6 8" : undefined}
        />
        <path
          d="M 4 7 Q 80 8, 160 7 T 320 6.4 T 480 7.2 T 596 7"
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeLinecap="round"
          strokeOpacity={0.5}
        />
        {/* tiny ink-splatter dot at one end */}
        <circle cx={596} cy={7.2} r={1.4} fill={color} opacity={0.6} />
      </svg>
    );
  }

  // vertical
  return (
    <svg
      viewBox="0 0 14 600"
      width={height}
      height={width}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <path
        d="M 7 4 Q 6 80, 7 160 T 7 320 T 7 480 T 7 596"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeOpacity={0.85}
        strokeDasharray={dashed ? "6 8" : undefined}
      />
    </svg>
  );
}
