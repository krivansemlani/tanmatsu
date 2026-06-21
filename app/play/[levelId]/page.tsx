import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { BeltIndicator } from "@/components/BeltIndicator";
import { LevelView } from "@/components/LevelView";
import { MtFuji } from "@/components/MtFuji";
import { getLevel, getNextLevel, getCityByLevelId } from "@/lib/levels";

type PageProps = { params: Promise<{ levelId: string }> };

export default async function LevelPage({ params }: PageProps) {
  const { levelId } = await params;
  const level = getLevel(levelId);
  if (!level) notFound();

  const city = getCityByLevelId(levelId);
  const next = getNextLevel(levelId);

  return (
    <div className="relative flex flex-col min-h-screen bg-paper text-ink px-4 sm:px-8 md:px-16 py-6 sm:py-8 overflow-hidden">
      {/* Tiny Fuji silhouette in lower-right — woodblock through-line, quiet */}
      <div
        aria-hidden
        className="absolute bottom-4 right-6 pointer-events-none hidden md:block"
        style={{ opacity: 0.14 }}
      >
        <MtFuji variant="outline" width={140} snowy />
      </div>

      <nav className="relative flex justify-between items-center max-w-[860px] w-full mx-auto pb-8 sm:pb-12 pr-14">
        <Link href="/" className="flex items-center gap-2 sm:gap-3 group min-w-0">
          <Image
            src="/logo.png"
            alt="Tanmatsu"
            width={36}
            height={36}
            priority
            className="block w-8 h-8 sm:w-9 sm:h-9 shrink-0"
          />
          <span className="leading-tight min-w-0">
            <span className="font-mincho font-medium text-[15px] sm:text-[18px] tracking-tight text-ink group-hover:text-seal transition-colors block">
              Tanmatsu
            </span>
            <span className="font-mincho text-[10px] sm:text-[12px] text-ink-50 block -mt-0.5">
              端末
            </span>
          </span>
        </Link>
        <BeltIndicator rank={city?.belt || "white"} />
      </nav>

      <main className="max-w-[860px] w-full mx-auto flex-1">
        <LevelView levelId={level.id} nextLevelId={next?.id} />
      </main>

      <footer className="max-w-[860px] w-full mx-auto mt-16 font-mono text-[11px] tracking-wide text-ink-30">
        // tanmatsu · 端末
      </footer>
    </div>
  );
}
