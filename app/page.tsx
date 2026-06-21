import Link from "next/link";
import { Brushstroke } from "@/components/Brushstroke";
import { HankoSeal } from "@/components/HankoSeal";
import { TanmatsuHero } from "@/components/TanmatsuHero";
import { LandingHero } from "@/components/LandingHero";
import { ResumeHint } from "@/components/ResumeHint";
import { CITIES } from "@/lib/levels";

export default function Home() {
  const totalLevels = CITIES.reduce((n, c) => n + c.levels.length, 0);

  return (
    <div className="bg-paper text-ink">
      <TanmatsuHero />

      {/* "Stepping off the platform" — brushstroke transition into the terminal */}
      <div className="relative bg-paper">
        <Brushstroke
          className="absolute top-[-6px] left-1/2 -translate-x-1/2"
          width="min(680px, 90%)"
          height={12}
        />
      </div>

      {/* BOARDING — the terminal */}
      <section
        id="board"
        className="bg-paper text-ink px-5 sm:px-8 md:px-16 pt-16 sm:pt-24 pb-16 sm:pb-20"
      >
        <main className="max-w-[720px] mx-auto">
          <ResumeHint />
          <LandingHero />

          <div className="mt-14 pt-7 border-t border-ink-10 flex items-center gap-4 flex-wrap text-[13px] text-ink-50">
            <span>{CITIES.length} cities</span>
            <span
              aria-hidden
              className="inline-block w-[3px] h-[3px] rounded-full bg-ink-30"
            />
            <span>{totalLevels} levels</span>
            <span
              aria-hidden
              className="inline-block w-[3px] h-[3px] rounded-full bg-ink-30"
            />
            <Link href="/map" className="hover:text-seal transition-colors">
              the route →
            </Link>
            <span className="ml-auto">
              <HankoSeal kanji="端" title="hanko seal — earned each level" />
            </span>
          </div>
        </main>

        <footer className="max-w-[720px] mx-auto mt-24 font-mono text-[11px] tracking-wide text-ink-30 flex items-center gap-4 flex-wrap">
          <span>// tanmatsu · 端末</span>
          <span
            aria-hidden
            className="inline-block w-[3px] h-[3px] rounded-full bg-ink-30"
          />
          <span>open source · runs in your browser · no signup</span>
        </footer>
      </section>
    </div>
  );
}
