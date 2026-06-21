type Belt = "white" | "yellow" | "green" | "brown" | "black";

const beltColor: Record<Belt, string> = {
  white: "var(--color-belt-white)",
  yellow: "var(--color-belt-yellow)",
  green: "var(--color-belt-green)",
  brown: "var(--color-belt-brown)",
  black: "var(--color-belt-black)",
};

export function BeltIndicator({ rank = "white" as Belt }: { rank?: Belt }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[11px] text-ink-50 lowercase tracking-wide">
      <span
        aria-hidden
        className="inline-block w-[22px] h-[4px] border border-ink-30"
        style={{ background: beltColor[rank] }}
      />
      {rank} belt
    </span>
  );
}
