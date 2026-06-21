type Props = {
  kanji?: string;
  size?: number;
  rotate?: number;
  title?: string;
  className?: string;
};

export function HankoSeal({
  kanji = "段",
  size = 38,
  rotate = -4,
  title,
  className = "",
}: Props) {
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center font-mincho font-semibold text-paper select-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.58,
        background: "var(--color-seal)",
        boxShadow: "inset 0 0 0 1px rgba(200, 57, 46, 0.5)",
        backgroundImage:
          "radial-gradient(circle at 30% 25%, rgba(0,0,0,0.20) 0%, transparent 38%), radial-gradient(circle at 72% 78%, rgba(255,255,255,0.10) 0%, transparent 32%)",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {kanji}
    </span>
  );
}
