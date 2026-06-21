// City 3 — Osaka (大阪)
// A noisy izakaya in Dōtonbori. You're working the line.
// The cook hands you tasks; pipes and redirects are how things flow.
// Teaches: |, >, >>, <, sort, uniq, cut, xargs.

import { mkDir, mkFile, walk, isFile, isDir } from "@/lib/sandbox/fs";
import type { City, Checker } from "@/lib/levels";

// --- shared seed data ---

const MENU = `yakitori
edamame
tako wasabi
hamachi
uni
awabi
ankimo
sake
highball
beer`;

const TICKETS = `table 1
table 3
table 5
table 2
table 4
table 1
table 7
table 6`;

const ORDERS_SEED = `table 1: yakitori
table 1: sake
table 3: edamame
table 3: tako wasabi
table 5: hamachi
table 2: yakitori
table 4: uni
table 1: hamachi
table 4: sake`;

const ITEMS = `hamachi
uni
yakitori
ankimo
edamame
yakitori
sake
awabi
hamachi
beer`;

const RECEIPTS = `table,item,price
1,yakitori,400
1,sake,800
3,edamame,300
3,tako wasabi,650
5,hamachi,1200
4,uni,1800
6,beer,600`;

const FIRE_LIST = `hamachi
uni
yakitori
ankimo`;

// --- factory: a fully-set izakaya ---

const baseFs = () =>
  mkDir("/", {
    home: mkDir("home", {
      traveler: mkDir("traveler", {
        "menu.txt": mkFile("menu.txt", MENU),
        "tickets.txt": mkFile("tickets.txt", TICKETS),
        "orders.txt": mkFile("orders.txt", ORDERS_SEED),
        "items.txt": mkFile("items.txt", ITEMS),
        "receipts.csv": mkFile("receipts.csv", RECEIPTS),
        "fire-list.txt": mkFile("fire-list.txt", FIRE_LIST),
      }),
    }),
  });

// --- check helpers ---

const wasCommand =
  (...names: string[]): Checker =>
  ({ command }) => {
    const first = command.trim().split(/\s+/)[0];
    return names.includes(first);
  };

const usesOperator =
  (op: string): Checker =>
  ({ command }) =>
    command.includes(op);

const commandIncludes =
  (...needles: string[]): Checker =>
  ({ command }) =>
    needles.every((n) => command.includes(n));

const and =
  (...cs: Checker[]): Checker =>
  (ctx) =>
    cs.every((c) => c(ctx));

const or =
  (...cs: Checker[]): Checker =>
  (ctx) =>
    cs.some((c) => c(ctx));

export const OSAKA: City = {
  id: "osaka",
  name: "Osaka",
  nameJa: "大阪",
  subtitle: "Dōtonbori, after dark. The izakaya is loud.",
  tagline: "How things connect. Pipes, redirects, plumbing.",
  belt: "green",
  promptName: "osaka",
  photoUrl:
    "https://images.unsplash.com/photo-1554797589-7241bb691973?w=2400&q=80&auto=format&fit=crop",
  mapPosition: { x: 542, y: 488 },
  levels: [
    {
      id: "osaka-01-pipe",
      cityId: "osaka",
      index: 1,
      title: "The pass.",
      scenario:
        "Your first night on the line. The cook wipes his hands and glances at you. \"How many tickets came in this hour? Just give me the count — I don't need the list.\"",
      hints: [
        "The pipe `|` sends one command's output into another's input.",
        "`cat tickets.txt | wc -l` — read the file, count the lines.",
      ],
      teaches: ["|", "wc -l"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        ({ result }) => result.exitCode === 0 && result.stdout.trim() === "8",
        or(usesOperator("|"), commandIncludes("wc", "tickets.txt"))
      ),
      completedMessage: "\"Eight. Quiet for a Friday. Keep going.\"",
    },

    {
      id: "osaka-02-redirect",
      cityId: "osaka",
      index: 2,
      title: "Write it down.",
      scenario:
        "\"Drinks board's empty. Write 'sake, beer, highball' to a file called `drinks.txt`. Just the one line.\"",
      hints: [
        "`>` redirects a command's output into a file. Overwrites whatever was there.",
        "`echo \"sake, beer, highball\" > drinks.txt`.",
      ],
      teaches: [">"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: ({ shell }) => {
        const f = walk(shell.root, "/home/traveler/drinks.txt");
        return (
          isFile(f) && /sake/.test(f.content) && /beer/.test(f.content) && /highball/.test(f.content)
        );
      },
      completedMessage: "\"Good. Now everyone can see what's pouring tonight.\"",
    },

    {
      id: "osaka-03-append",
      cityId: "osaka",
      index: 3,
      title: "Add to the order.",
      scenario:
        "\"Table 7 just added uni. Tack 'table 7: uni' onto the end of `orders.txt` — don't wipe the rest.\"",
      hints: [
        "`>>` appends to a file. `>` would erase what's already there.",
        "`echo \"table 7: uni\" >> orders.txt`.",
      ],
      teaches: [">>"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: ({ shell }) => {
        const f = walk(shell.root, "/home/traveler/orders.txt");
        if (!isFile(f)) return false;
        return (
          f.content.includes("table 1: yakitori") && // original survived
          /table 7:\s*uni/i.test(f.content) // new appended
        );
      },
      completedMessage: "\"Cool. Table 7 — uni's on.\"",
    },

    {
      id: "osaka-04-input",
      cityId: "osaka",
      index: 4,
      title: "From the menu.",
      scenario:
        "\"Quick — how many lines is the menu? Use the input redirect this time — `<` feeds a file into a command's stdin instead of passing it as an argument.\"",
      hints: [
        "`<` reads a file into a command's standard input.",
        "`wc -l < menu.txt` — wc counts what it gets on stdin.",
      ],
      teaches: ["<"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        usesOperator("<"),
        ({ result }) => result.exitCode === 0 && /\b10\b/.test(result.stdout.trim())
      ),
      completedMessage: "\"Ten items. Right. Let's keep moving.\"",
    },

    {
      id: "osaka-05-sort",
      cityId: "osaka",
      index: 5,
      title: "Sort the morning checklist.",
      scenario:
        "\"Before close, I need the night's items sorted alphabetically — so I know what to restock first thing tomorrow. Just print the sorted list.\"",
      hints: [
        "`sort` orders lines alphabetically.",
        "`sort items.txt`.",
      ],
      teaches: ["sort"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(wasCommand("sort"), ({ result }) => {
        const lines = result.stdout.split("\n").filter(Boolean);
        const sorted = [...lines].sort();
        return (
          result.exitCode === 0 &&
          lines.length > 4 &&
          lines.every((l, i) => l === sorted[i])
        );
      }),
      completedMessage: "\"Alphabetical. Easier to walk down a list than to remember it.\"",
    },

    {
      id: "osaka-06-uniq",
      cityId: "osaka",
      index: 6,
      title: "How many different dishes?",
      scenario:
        "\"People ordered a lot tonight — but how many DIFFERENT dishes did we actually serve? Sort the items, then strip the duplicates.\"",
      hints: [
        "`uniq` removes duplicate lines, but only when they're adjacent. That's why you sort first.",
        "`sort items.txt | uniq` — the classic pattern.",
      ],
      teaches: ["sort | uniq"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        usesOperator("|"),
        commandIncludes("sort", "uniq"),
        ({ result }) => {
          const lines = result.stdout.split("\n").filter(Boolean);
          // ITEMS has 10 entries, 7 unique
          return result.exitCode === 0 && lines.length === 7;
        }
      ),
      completedMessage: "\"Seven distinct dishes. Decent variety for a Tuesday menu.\"",
    },

    {
      id: "osaka-07-cut",
      cityId: "osaka",
      index: 7,
      title: "Just the prices.",
      scenario:
        "\"Pull just the price column from `receipts.csv` for me — fields are separated by commas, prices are the third column.\"",
      hints: [
        "`cut -d X -f N` takes column N from each line, where the delimiter is X.",
        "`cut -d, -f3 receipts.csv`.",
      ],
      teaches: ["cut -d -f"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        wasCommand("cut"),
        ({ result }) => {
          const lines = result.stdout.split("\n").filter(Boolean);
          // First line is "price" header, then 7 numeric prices
          return (
            result.exitCode === 0 &&
            lines.includes("price") &&
            lines.includes("1200") &&
            lines.includes("400")
          );
        }
      ),
      completedMessage:
        "\"Five thousand seven-fifty. Good night, considering we were short-staffed.\"",
    },

    {
      id: "osaka-08-xargs",
      cityId: "osaka",
      index: 8,
      title: "Fire each one.",
      scenario:
        "\"Last task. Take each item in `fire-list.txt` and print 'fired: <item>' — one line per item, so I know what's started. Use `xargs` with `-I {}` to do it cleanly.\"",
      hints: [
        "`xargs -I {} cmd {}` runs `cmd` once per input line, replacing `{}` with each line.",
        "`cat fire-list.txt | xargs -I {} echo fired: {}`.",
      ],
      teaches: ["xargs -I"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        commandIncludes("xargs"),
        ({ result }) => {
          const out = result.stdout;
          return (
            result.exitCode === 0 &&
            /fired:\s*hamachi/.test(out) &&
            /fired:\s*uni/.test(out) &&
            /fired:\s*yakitori/.test(out) &&
            /fired:\s*ankimo/.test(out)
          );
        }
      ),
      completedMessage:
        "Cook nods, doesn't look up. \"You learn fast. Tomorrow you're north — Hokkaido. Take a jacket.\"",
    },
  ],
};

// Suppress unused import warning until we need it
void isDir;
