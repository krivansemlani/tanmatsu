// Stylized Mt. Fuji silhouette — single mountain shape.
// Compose multiple at different sizes/opacities for parallax layering.

type Props = {
  className?: string;
  width?: number;
  variant?: "wash" | "outline" | "distant";
  snowy?: boolean;
};

export function MtFuji({
  className = "",
  width = 240,
  variant = "wash",
  snowy = true,
}: Props) {
  const height = width * 0.55;

  // Main mountain silhouette path (200×120 viewBox-relative)
  // Slight asymmetry — left flank is shorter, like the real Fuji from south
  const fujiPath = "M 14 116 L 84 26 Q 102 16, 116 30 L 188 116 Z";

  // Snow cap — zigzag ridge that overlays the top
  const snowPath =
    "M 60 64 L 72 56 L 80 60 L 92 50 L 100 56 L 112 48 L 122 56 L 134 50 L 142 60 L 148 70 Q 100 78, 60 64 Z";

  // Ridge shadow line
  const ridgePath = "M 102 22 Q 130 60, 188 116";

  if (variant === "outline") {
    return (
      <svg
        viewBox="0 0 200 120"
        width={width}
        height={height}
        className={className}
        aria-hidden
      >
        <path
          d={fujiPath}
          fill="none"
          stroke="var(--color-brush)"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {snowy && (
          <path
            d={snowPath}
            fill="none"
            stroke="var(--color-brush)"
            strokeWidth={1}
          />
        )}
      </svg>
    );
  }

  if (variant === "distant") {
    return (
      <svg
        viewBox="0 0 200 120"
        width={width}
        height={height}
        className={className}
        aria-hidden
      >
        <path d={fujiPath} fill="var(--color-indigo-soft)" />
      </svg>
    );
  }

  // "wash" variant — indigo base + paper-warm snow + brush ridge
  return (
    <svg
      viewBox="0 0 200 120"
      width={width}
      height={height}
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="fuji-wash" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-indigo)" />
          <stop offset="100%" stopColor="var(--color-indigo-deep)" />
        </linearGradient>
      </defs>
      <path d={fujiPath} fill="url(#fuji-wash)" />
      <path
        d={ridgePath}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth={1}
        fill="none"
      />
      {snowy && (
        <path d={snowPath} fill="var(--color-paper)" opacity={0.92} />
      )}
      <path
        d={fujiPath}
        fill="none"
        stroke="var(--color-brush)"
        strokeOpacity={0.55}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
