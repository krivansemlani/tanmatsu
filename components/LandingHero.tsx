"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Line =
  | { kind: "out"; html: string }
  | { kind: "echo"; text: string };

const WELCOME: Line[] = [
  { kind: "out", html: "tanmatsu platform 9 · departing for tokyo" },
  { kind: "out", html: "this is a real shell, not a video." },
  {
    kind: "out",
    html: 'type <span class="text-[var(--color-term-fg)]">start</span> when you\'re ready to board.',
  },
];

export function LandingHero() {
  const router = useRouter();
  const [buffer, setBuffer] = useState("");
  const [history, setHistory] = useState<Line[]>(WELCOME);
  const [started, setStarted] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Capture global keystrokes — the page IS the terminal.
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // ignore if focus is in a real input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Enter") {
        runCommand(buffer.trim().toLowerCase());
        setBuffer("");
        e.preventDefault();
      } else if (e.key === "Backspace") {
        setBuffer((b) => b.slice(0, -1));
        e.preventDefault();
      } else if (e.key.length === 1) {
        setBuffer((b) => b + e.key);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer]);

  // Auto-scroll to bottom on new output
  useEffect(() => {
    bodyRef.current?.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history, buffer]);

  function runCommand(cmd: string) {
    const echo: Line = { kind: "echo", text: cmd };
    let out: Line[] = [];

    if (cmd === "start") {
      setStarted(true);
      out = [
        { kind: "out", html: "" },
        {
          kind: "out",
          html: '<span class="text-[var(--color-jade)]">boarding the train...</span>',
        },
      ];
      setHistory((h) => [...h, echo, ...out]);
      // give the user a beat to see the transition, then jump in
      setTimeout(() => router.push("/play/tokyo-01-pwd"), 600);
      return;
    } else if (cmd === "pwd") {
      out = [
        { kind: "out", html: "/home/traveler" },
        {
          kind: "out",
          html: '<span class="text-[var(--color-jade)]">✓ that\'s it. mentor nods.</span>',
        },
      ];
    } else if (cmd === "ls") {
      out = [{ kind: "out", html: "readme.md  notes.txt  drafts/" }];
    } else if (cmd === "clear") {
      setHistory(WELCOME);
      return;
    } else if (cmd === "") {
      // empty enter
    } else {
      out = [
        {
          kind: "out",
          html: `<span class="text-[rgba(237,231,218,0.45)]">${escapeHtml(
            cmd
          )}: this is just a preview — the real sandbox is coming soon.</span>`,
        },
      ];
    }

    setHistory((h) => [...h, echo, ...out]);
  }

  return (
    <>
      {/* Pre-start copy → swap to "boarding" on start */}
      {!started ? (
        <>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-50 mb-5 flex items-center gap-3">
            <span className="inline-block w-6 h-px bg-ink-30" />
            東京 · Tokyo · first stop
          </p>
          <h2 className="font-mincho font-normal leading-[1.1] tracking-tight text-ink mb-5 text-[clamp(30px,4.4vw,46px)]">
            ようこそ.<br />
            <span className="text-ink-70">Welcome aboard.</span>
          </h2>
          <p className="text-[16px] leading-[1.6] text-ink-70 mb-6 max-w-[460px]">
            <span className="hidden md:inline">
              Type <code className="font-mono text-ink">start</code> to board the
              train.
            </span>
            <span className="md:hidden">Tap below to board the train.</span>{" "}
            Your mentor is already at the office in Shibuya waiting for you.
          </p>

          {/* Mobile-only tap target — mobile browsers don't fire keydown
              without a focused input, so a button is the right primitive */}
          <button
            type="button"
            onClick={() => router.push("/play/tokyo-01-pwd")}
            className="md:hidden mb-8 font-mono text-[12px] uppercase tracking-[0.18em] bg-ink text-paper px-5 py-3 hover:bg-seal transition-colors"
          >
            board the train →
          </button>
        </>
      ) : (
        <div className="border-l-2 border-seal pl-[22px] mb-8 pt-1 pb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-50 mb-2.5">
            departing for tokyo · 東京
          </p>
          <h2 className="font-mincho font-normal text-[24px] leading-[1.25] mb-2 text-ink">
            ガタンゴトン
          </h2>
          <p className="text-[14px] leading-[1.55] text-ink-70">
            (the sound of the Shinkansen leaving Tokyo Station)
          </p>
        </div>
      )}

      {/* The terminal — desktop only. On mobile the button above is the CTA
          and the type-to-start UX doesn't work without a physical keyboard. */}
      <div
        className="hidden md:block bg-term-bg text-term-fg font-mono text-[14px] leading-[1.7] rounded-[2px] overflow-hidden"
        style={{
          boxShadow:
            "0 1px 0 var(--color-ink-10), 0 30px 60px -30px rgba(22,22,22,0.25)",
        }}
      >
        <div className="px-[18px] py-[11px] border-b border-[rgba(237,231,218,0.08)] flex justify-between text-term-dim font-mono text-[11px] tracking-wide">
          <span>tanmatsu</span>
          <span>~/</span>
        </div>
        <div
          ref={bodyRef}
          className="px-[22px] pt-[22px] pb-[20px] min-h-[220px] max-h-[420px] overflow-y-auto cursor-text"
        >
          {history.map((line, i) =>
            line.kind === "out" ? (
              <p
                key={i}
                className="text-term-dim break-words"
                dangerouslySetInnerHTML={{ __html: line.html || "&nbsp;" }}
              />
            ) : (
              <p key={i} className="text-term-fg mt-3.5 break-words">
                <span className="text-term-fg">tokyo ~ $</span> {line.text}
              </p>
            )
          )}
          <p className="text-term-fg mt-3.5 break-words">
            <span className="text-term-fg">tokyo ~ $</span>{" "}
            <span className="text-term-fg">{buffer}</span>
            <span className="tanmatsu-cursor" aria-hidden />
          </p>
        </div>
      </div>
    </>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
