// City 2 — Kyoto (京都)
// A week at a small temple as a visiting researcher.
// Quiet halls, dawn bells, scrolls and gardens.
// Teaches: grep, find, head, tail, wc.

import { mkDir, mkFile, walk, isDir } from "@/lib/sandbox/fs";
import type { City, Checker } from "@/lib/levels";

// Real haiku (public domain — Bashō, Buson, Issa) anchor the content.
const HAIKU_SCROLL = `the old pond — a frog jumps in, the sound of water
on a withered branch a crow has alighted: autumn evening
even in Kyoto, hearing the cuckoo's cry, I long for Kyoto
this autumn — why am I growing old? the crane returns
spring rain — a child teaching the cat to dance
under the cherry tree there are no strangers
first snow — just enough to bend the daffodil leaves
the cuckoo — going where? toward the moon
`;

const SUTRA_INDEX = `001  morning bell, three strikes
002  opening, gassho
003  namo amida butsu
004  the heart sutra
005  the diamond sutra
006  midday rest
007  namo amida butsu
008  the lotus sutra
009  silent meditation
010  closing bell`;

const FORMAL_LETTER = `Honorable Sir,

It is with great respect that I, MAEDA Hiroshi of the western
prefecture, beg leave to write to your temple. My grandfather
served under the late abbot, whom you may remember as Maeda
the elder, and our family has long kept records of —

(letter trails off, undated)

Yours in service,
Maeda`;

const DIARY = `2025-04-01  arrived in Kyoto. rain.
2025-04-02  visited the bamboo grove. quiet.
2025-04-03  the monks woke me at five. bells everywhere.
2025-04-04  long walk to Fushimi. red gates without end.
2025-04-05  sat with the abbot for tea. he spoke of patience.
2025-04-06  wrote three haiku. burned two.
2025-04-07  the cherry trees opened overnight.`;

// A tangled archive — many nested temple "halls" with poems inside
const ARCHIVE = () =>
  mkDir("archive", {
    north_hall: mkDir("north_hall", {
      "winter_moon.txt": mkFile("winter_moon.txt", "the winter moon, my only companion"),
      "old_pine.txt": mkFile("old_pine.txt", "the old pine bends, it does not break"),
    }),
    south_hall: mkDir("south_hall", {
      "spring_rain.txt": mkFile(
        "spring_rain.txt",
        "spring rain — a child teaching the cat to dance"
      ),
      "summer_dusk.txt": mkFile("summer_dusk.txt", "summer dusk, fireflies above the river"),
    }),
    east_garden: mkDir("east_garden", {
      stones: mkDir("stones", {
        "moss.txt": mkFile("moss.txt", "moss on every stone, even the ones we placed"),
      }),
      "lantern.txt": mkFile("lantern.txt", "stone lantern, half-buried, still burning"),
    }),
    west_pavilion: mkDir("west_pavilion", {
      "tea.txt": mkFile("tea.txt", "first sip of tea, the morning forgives me"),
    }),
  });

const baseFs = () =>
  mkDir("/", {
    home: mkDir("home", {
      traveler: mkDir("traveler", {
        "haiku.txt": mkFile("haiku.txt", HAIKU_SCROLL),
        "letter.txt": mkFile("letter.txt", FORMAL_LETTER),
        "sutras.txt": mkFile("sutras.txt", SUTRA_INDEX),
        "diary.txt": mkFile("diary.txt", DIARY),
        ARCHIVE: ARCHIVE(),
      }),
    }),
  });

// --- helpers ---

const wasCommand =
  (...names: string[]): Checker =>
  ({ command }) => {
    const first = command.trim().split(/\s+/)[0];
    return names.includes(first);
  };

const usedFlag =
  (flag: string): Checker =>
  ({ command }) => {
    // Match `-X` or `-XY...` (bundled short flags); also `--long`
    const tokens = command.trim().split(/\s+/);
    return tokens.some((t) => {
      if (t.startsWith("--")) return t.slice(2).split("=")[0] === flag;
      if (t.startsWith("-") && !t.startsWith("--")) return t.slice(1).includes(flag);
      return false;
    });
  };

const and =
  (...cs: Checker[]): Checker =>
  (ctx) =>
    cs.every((c) => c(ctx));

export const KYOTO: City = {
  id: "kyoto",
  name: "Kyoto",
  nameJa: "京都",
  subtitle: "A week of scrolls, gardens, and dawn bells.",
  tagline: "Find things, read what matters, count what's there.",
  belt: "yellow",
  promptName: "kyoto",
  photoUrl:
    "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=2400&q=80&auto=format&fit=crop",
  mapPosition: { x: 588, y: 458 },
  levels: [
    {
      id: "kyoto-01-grep",
      cityId: "kyoto",
      index: 1,
      title: "Find the crane.",
      scenario:
        "The temple librarian sets a haiku scroll before you. \"There's a verse in here about a crane returning. Find it for me — just the line.\"",
      hints: [
        "`grep` searches for a pattern in a file.",
        "`grep crane haiku.txt` — pattern first, then the file.",
      ],
      teaches: ["grep"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(wasCommand("grep"), ({ result }) =>
        result.exitCode === 0 && /crane/i.test(result.stdout)
      ),
      completedMessage:
        "The librarian smiles. \"That's the one. Bashō wrote that the autumn he turned forty.\"",
    },

    {
      id: "kyoto-02-grep-i",
      cityId: "kyoto",
      index: 2,
      title: "Maeda — somewhere in the letter.",
      scenario:
        "An old letter mentions a family name — Maeda — but the writer wasn't consistent with capitals. Some lines have it as `Maeda`, some as `MAEDA`. Find every mention, regardless of case.",
      hints: [
        "`grep` is case-sensitive by default. There's a flag for case-insensitive search.",
        "`grep -i maeda letter.txt` — the `-i` flag ignores case.",
      ],
      teaches: ["grep -i"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(wasCommand("grep"), usedFlag("i"), ({ result }) =>
        result.exitCode === 0
      ),
      completedMessage:
        "\"Three mentions. The family kept records for generations. Good eye.\"",
    },

    {
      id: "kyoto-03-grep-n",
      cityId: "kyoto",
      index: 3,
      title: "Where in the index?",
      scenario:
        "The morning monk needs to know on which lines the chant `namo amida butsu` appears in the sutra index. Show him the line numbers.",
      hints: [
        "`grep` can prefix each match with its line number.",
        "`grep -n \"namo amida butsu\" sutras.txt` — the `-n` flag adds line numbers.",
      ],
      teaches: ["grep -n"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        wasCommand("grep"),
        usedFlag("n"),
        ({ result }) =>
          result.exitCode === 0 &&
          /3:/.test(result.stdout) &&
          /7:/.test(result.stdout)
      ),
      completedMessage:
        "The monk nods. \"Lines three and seven. He'll begin at three.\"",
    },

    {
      id: "kyoto-04-find-name",
      cityId: "kyoto",
      index: 4,
      title: "Spring rain, somewhere in the archive.",
      scenario:
        "The archive has dozens of poems scattered across the temple's halls and pavilions. Find the file called `spring_rain.txt` — you don't know which hall it's in.",
      hints: [
        "`find` walks the tree looking for matches.",
        "`find . -name spring_rain.txt` — search from here, by name.",
      ],
      teaches: ["find"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(wasCommand("find"), ({ result }) =>
        /spring_rain\.txt/.test(result.stdout)
      ),
      completedMessage:
        "\"South hall. Of course. The rain always comes from the south.\"",
    },

    {
      id: "kyoto-05-find-type",
      cityId: "kyoto",
      index: 5,
      title: "Count the halls.",
      scenario:
        "You want a map of the temple. Find every directory under `ARCHIVE` — every hall, garden, and pavilion — but ignore the files inside them.",
      hints: [
        "`find` can filter by type. `-type d` keeps only directories. `-type f` keeps only files.",
        "`find ARCHIVE -type d`.",
      ],
      teaches: ["find -type"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        wasCommand("find"),
        ({ command }) =>
          /-type\s+d\b/.test(command),
        ({ result }) =>
          result.exitCode === 0 &&
          /north_hall/.test(result.stdout) &&
          /east_garden/.test(result.stdout) &&
          !/\.txt/.test(result.stdout)
      ),
      completedMessage:
        "Six halls, plus a small alcove for stones. The temple is bigger than it looks.",
    },

    {
      id: "kyoto-06-head",
      cityId: "kyoto",
      index: 6,
      title: "The morning verses.",
      scenario:
        "Dawn. The monk asks for only the first three lines of the haiku scroll — the morning verses — to begin the day's reading.",
      hints: [
        "`head` shows the first lines of a file. By default, ten.",
        "`head -n 3 haiku.txt` — first three lines.",
      ],
      teaches: ["head"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(wasCommand("head"), ({ result }) => {
        const lines = result.stdout.split("\n").filter(Boolean);
        return (
          result.exitCode === 0 &&
          lines.length === 3 &&
          lines[0].includes("old pond")
        );
      }),
      completedMessage:
        "The monk closes his eyes. \"Bashō. A good way to begin a day.\"",
    },

    {
      id: "kyoto-07-tail",
      cityId: "kyoto",
      index: 7,
      title: "The last week.",
      scenario:
        "Before bed, you flip your diary open to today's entry and the few before it. Show only the last three lines of `diary.txt`.",
      hints: [
        "`tail` is the mirror of `head` — last lines instead of first.",
        "`tail -n 3 diary.txt`.",
      ],
      teaches: ["tail"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(wasCommand("tail"), ({ result }) => {
        const lines = result.stdout.split("\n").filter(Boolean);
        return (
          result.exitCode === 0 &&
          lines.length === 3 &&
          /04-07/.test(lines[2])
        );
      }),
      completedMessage:
        "\"The cherries opened overnight.\" A good entry to end the week on.",
    },

    {
      id: "kyoto-08-wc",
      cityId: "kyoto",
      index: 8,
      title: "How many verses?",
      scenario:
        "The librarian wants a number for her ledger: how many haiku are in the scroll? Each line is one verse. Just the count, please.",
      hints: [
        "`wc` is word count — it can also count lines (`-l`) or characters (`-c`).",
        "`wc -l haiku.txt` gives you the line count.",
      ],
      teaches: ["wc -l"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(wasCommand("wc"), ({ result }) =>
        result.exitCode === 0 && /\b8\b/.test(result.stdout.trim())
      ),
      completedMessage:
        "She writes the number in the ledger and closes the book. \"That's Kyoto, then. Tomorrow you go west — Osaka. They'll teach you how things connect.\"",
    },
  ],
};
