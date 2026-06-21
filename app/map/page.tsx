import Image from "next/image";
import Link from "next/link";
import { JapanMap } from "@/components/JapanMap";
import { MtFuji } from "@/components/MtFuji";

export default function MapPage() {
  return (
    <div className="relative flex flex-col min-h-screen bg-paper text-ink px-5 sm:px-8 md:px-16 py-8 overflow-hidden">
      <div
        aria-hidden
        className="absolute bottom-4 right-6 pointer-events-none hidden md:block"
        style={{ opacity: 0.12 }}
      >
        <MtFuji variant="outline" width={140} snowy />
      </div>
      <nav className="flex items-center max-w-[980px] w-full mx-auto pb-14">
        <Link
          href="/"
          className="flex items-center gap-3 group"
        >
          <Image
            src="/logo.png"
            alt="Tanmatsu"
            width={40}
            height={40}
            priority
            className="block"
          />
          <span className="leading-tight">
            <span className="font-mincho font-medium text-[18px] tracking-tight text-ink group-hover:text-seal transition-colors block">
              Tanmatsu
            </span>
            <span className="font-mincho text-[12px] text-ink-50 block -mt-0.5">
              端末
            </span>
          </span>
        </Link>
      </nav>

      <main className="max-w-[980px] w-full mx-auto flex-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-50 mb-3 flex items-center gap-3">
          <span className="inline-block w-6 h-px bg-ink-30" />
          旅 · your route
        </p>
        <h1 className="font-mincho text-[42px] leading-[1.1] tracking-tight mb-3">
          The Tanmatsu map
        </h1>
        <p className="text-[15px] leading-[1.55] text-ink-70 mb-12 max-w-[520px]">
          Four cities, west across Honshu, then north to Hokkaido. Each city
          teaches a new layer of the shell.
        </p>

        <JapanMap />
      </main>

      <footer className="max-w-[980px] w-full mx-auto mt-20 font-mono text-[11px] tracking-wide text-ink-30">
        // tanmatsu · 端末
      </footer>
    </div>
  );
}
