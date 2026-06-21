"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadProgress, currentLevel, progressSummary } from "@/lib/progress";

export function ResumeHint() {
  const [show, setShow] = useState(false);
  const [href, setHref] = useState("/play");
  const [label, setLabel] = useState("");

  useEffect(() => {
    const p = loadProgress();
    if (p.completed.length === 0) return;
    const { sealed, total } = progressSummary(p);
    const lvl = currentLevel(p);
    setHref(`/play/${lvl.id}`);
    setLabel(
      sealed >= total
        ? `you've sealed every level — view the scroll →`
        : `${sealed} of ${total} sealed · resume level ${lvl.index} →`
    );
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <Link
      href={href}
      className="block mb-7 font-mono text-[11px] uppercase tracking-[0.15em] text-seal hover:text-ink transition-colors"
    >
      ↻ {label}
    </Link>
  );
}
