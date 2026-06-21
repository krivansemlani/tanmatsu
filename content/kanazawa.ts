// City 5 — Kanazawa (金沢)
// You've come down from Hokkaido to Kanazawa, the city of gold-leaf
// craftsmen and patient work. You spend the week with Hayashi-san, a
// kinpaku artisan who's been making gold leaf for forty years. She runs
// a small studio and tracks every batch with painstaking care.
// You'll see why git was invented.
// Teaches: init, status, add, commit, log, diff, branch, switch, merge.

import { mkDir, mkFile, walk, isDir, isFile } from "@/lib/sandbox/fs";
import type { City, Checker } from "@/lib/levels";

// --- shared seed data ---

const STUDIO_README = `# hayashi gold leaf studio

est. 1987.
every batch logged.
nothing thrown out without a record.
`;

const BATCH_NOTES = `2025-11-12  morning batch — 3 sheets, gold a bit cool, ok
2025-11-13  recast hammer, 5 sheets perfect
2025-11-14  practice run, student
`;

const baseStudio = () =>
  mkDir("/", {
    home: mkDir("home", {
      traveler: mkDir("traveler", {
        studio: mkDir("studio", {
          "readme.md": mkFile("readme.md", STUDIO_README),
          "batches.txt": mkFile("batches.txt", BATCH_NOTES),
        }),
      }),
    }),
  });

// Variant: studio already has a git repo with one initial commit
const studioWithRepo = () => {
  // We can't actually create the git state from outside (would require
  // running the operations). Instead we hand the user a fresh studio and
  // let the level scenario walk them through it.
  return baseStudio();
};

// --- check helpers ---

const wasCommand =
  (...names: string[]): Checker =>
  ({ command }) => {
    const first = command.trim().split(/\s+/)[0];
    return names.includes(first);
  };

const wasGit =
  (sub: string): Checker =>
  ({ command }) => {
    const parts = command.trim().split(/\s+/);
    return parts[0] === "git" && parts[1] === sub;
  };

const and =
  (...cs: Checker[]): Checker =>
  (ctx) =>
    cs.every((c) => c(ctx));

export const KANAZAWA: City = {
  id: "kanazawa",
  name: "Kanazawa",
  nameJa: "金沢",
  subtitle: "Gold leaf, patience, ledgers. Why git was invented.",
  tagline: "Track what changes. Branch. Merge. Keep history.",
  belt: "black",
  promptName: "kanazawa",
  photoUrl:
    "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=2400&q=80&auto=format&fit=crop",
  // Kanazawa real coords: 36.56°N, 136.66°E — west-central Honshu
  mapPosition: { x: 540, y: 410 },
  levels: [
    {
      id: "kanazawa-01-init",
      cityId: "kanazawa",
      index: 1,
      title: "Open the ledger.",
      scenario:
        "Hayashi-san hands you a folder of studio files. \"Start tracking these. Run `git init` here so we can keep history. Every change, every batch, recorded.\"",
      hints: [
        "`git init` creates a new repository in the current directory.",
        "You should already be in the studio folder. Just type `git init`.",
      ],
      teaches: ["git init"],
      initialFs: baseStudio,
      initialCwd: "/home/traveler/studio",
      check: and(
        wasGit("init"),
        ({ shell }) => isDir(walk(shell.root, "/home/traveler/studio/.git"))
      ),
      completedMessage:
        "\"Good. The ledger is open. From now on every change can be remembered.\"",
    },

    {
      id: "kanazawa-02-status",
      cityId: "kanazawa",
      index: 2,
      title: "What does it see?",
      scenario:
        "\"Now check what the repo sees. Run `git status` — it'll show you what's tracked, what's not, and what's staged.\"",
      hints: [
        "`git status` is the most-used git command. Use it constantly.",
        "Just `git status`.",
      ],
      teaches: ["git status"],
      initialFs: () => {
        const fs = baseStudio();
        const studio = walk(fs, "/home/traveler/studio");
        if (isDir(studio)) {
          studio.children[".git"] = mkDir(".git", {
            HEAD: mkFile("HEAD", "ref: refs/heads/main\n"),
            index: mkFile("index", "{}\n"),
            refs: mkDir("refs", { heads: mkDir("heads") }),
            objects: mkDir("objects"),
          });
        }
        return fs;
      },
      initialCwd: "/home/traveler/studio",
      check: and(
        wasGit("status"),
        ({ result }) =>
          result.exitCode === 0 &&
          /Untracked files/.test(result.stdout) &&
          /readme\.md/.test(result.stdout)
      ),
      completedMessage:
        "\"Two untracked files. The repo knows they exist but hasn't accepted them yet. Like new apprentices.\"",
    },

    {
      id: "kanazawa-03-add",
      cityId: "kanazawa",
      index: 3,
      title: "Accept the files.",
      scenario:
        "\"Stage both files for the first commit — `git add .` adds everything in the current folder. Then run `git status` to see them as ready-to-commit.\"",
      hints: [
        "`git add .` stages every file in the current directory.",
        "After staging, `git status` will show them under 'Changes to be committed'.",
      ],
      teaches: ["git add"],
      initialFs: () => {
        const fs = baseStudio();
        const studio = walk(fs, "/home/traveler/studio");
        if (isDir(studio)) {
          studio.children[".git"] = mkDir(".git", {
            HEAD: mkFile("HEAD", "ref: refs/heads/main\n"),
            index: mkFile("index", "{}\n"),
            refs: mkDir("refs", { heads: mkDir("heads") }),
            objects: mkDir("objects"),
          });
        }
        return fs;
      },
      initialCwd: "/home/traveler/studio",
      check: ({ shell, history }) => {
        // Either: last command was git add AND a subsequent git status shows them staged
        // Easier: check index has both files
        const idx = walk(shell.root, "/home/traveler/studio/.git/index");
        if (!isFile(idx)) return false;
        try {
          const parsed = JSON.parse(idx.content);
          return "readme.md" in parsed && "batches.txt" in parsed;
        } catch {
          return false;
        }
        void history;
      },
      completedMessage: "\"Staged. Now they're on deck for the first commit.\"",
    },

    {
      id: "kanazawa-04-commit",
      cityId: "kanazawa",
      index: 4,
      title: "Write it in.",
      scenario:
        "\"Make the first commit. Use `git commit -m \"initial studio setup\"` (or any message you like). The message is for future-you — be honest.\"",
      hints: [
        "`git commit -m \"message\"` writes the staged files to history.",
        "Try `git commit -m \"initial studio setup\"`.",
      ],
      teaches: ["git commit"],
      initialFs: () => {
        const fs = baseStudio();
        const studio = walk(fs, "/home/traveler/studio");
        if (isDir(studio)) {
          // pre-staged
          studio.children[".git"] = mkDir(".git", {
            HEAD: mkFile("HEAD", "ref: refs/heads/main\n"),
            index: mkFile(
              "index",
              JSON.stringify(
                {
                  "readme.md": { hash: "abc1234" },
                  "batches.txt": { hash: "def5678" },
                },
                null,
                2
              )
            ),
            refs: mkDir("refs", { heads: mkDir("heads") }),
            objects: mkDir("objects", {
              abc1234: mkFile(
                "abc1234",
                JSON.stringify({ type: "blob", content: STUDIO_README })
              ),
              def5678: mkFile(
                "def5678",
                JSON.stringify({ type: "blob", content: BATCH_NOTES })
              ),
            }),
          });
        }
        return fs;
      },
      initialCwd: "/home/traveler/studio",
      check: and(
        wasGit("commit"),
        ({ command }) => /-m\s+\S+/.test(command),
        ({ result }) => result.exitCode === 0 && /\[main /.test(result.stdout)
      ),
      completedMessage:
        "\"First commit. The repo has a memory now. That snapshot will be here in fifty years if anyone wants to find it.\"",
    },

    {
      id: "kanazawa-05-log",
      cityId: "kanazawa",
      index: 5,
      title: "Read the history.",
      scenario:
        "\"You've made a few changes already. Run `git log` to see the commits we've made. Each one is a moment in time you can return to.\"",
      hints: [
        "`git log` shows the history of commits, newest first.",
        "Just `git log`.",
      ],
      teaches: ["git log"],
      initialFs: studioWithRepo,
      initialCwd: "/home/traveler/studio",
      check: and(
        wasGit("log"),
        ({ result }) =>
          result.exitCode === 0 && /commit \w+/.test(result.stdout)
      ),
      completedMessage:
        "\"That's your trail. Every step recorded.\"",
    },

    {
      id: "kanazawa-06-diff",
      cityId: "kanazawa",
      index: 6,
      title: "What's different?",
      scenario:
        "\"You just edited `batches.txt` to add today's batch — but before you stage it, run `git diff` to see exactly what changed line by line. Always look before you commit.\"",
      hints: [
        "`git diff` shows unstaged changes since the last commit. + is added, - is removed.",
        "Just `git diff`.",
      ],
      teaches: ["git diff"],
      initialFs: studioWithRepo,
      initialCwd: "/home/traveler/studio",
      check: and(
        wasGit("diff"),
        ({ result }) =>
          result.exitCode === 0 &&
          (/^diff --git/m.test(result.stdout) || result.stdout === "")
      ),
      completedMessage:
        "\"That's exactly what changed — and now you can decide if it's the change you meant to make.\"",
    },

    {
      id: "kanazawa-07-branch-switch",
      cityId: "kanazawa",
      index: 7,
      title: "Try without breaking.",
      scenario:
        "\"Hayashi-san wants to experiment with a different kettle temperature — but only if it works. Make a branch called `experiment` so the trial doesn't touch the main ledger. Use `git switch -c experiment` — that creates AND switches in one move.\"",
      hints: [
        "`git switch -c <name>` creates a new branch and moves you to it.",
        "`git switch -c experiment`.",
      ],
      teaches: ["git branch", "git switch -c"],
      initialFs: studioWithRepo,
      initialCwd: "/home/traveler/studio",
      check: and(
        wasGit("switch"),
        ({ shell }) => {
          const head = walk(shell.root, "/home/traveler/studio/.git/HEAD");
          return isFile(head) && /experiment/.test(head.content);
        }
      ),
      completedMessage:
        "\"Now you're on `experiment`. The main ledger doesn't see anything you do here until you merge it in.\"",
    },

    {
      id: "kanazawa-08-merge",
      cityId: "kanazawa",
      index: 8,
      title: "Bring it home.",
      scenario:
        "\"The experiment worked — the new technique is solid. Switch back to `main` and merge the experimental branch in: `git switch main` then `git merge experiment`. The history of both branches becomes one.\"",
      hints: [
        "Two commands: `git switch main`, then `git merge experiment`.",
        "Fast-forward merges look like: `Fast-forward`. That means main just caught up to experiment's commits.",
      ],
      teaches: ["git merge"],
      initialFs: studioWithRepo,
      initialCwd: "/home/traveler/studio",
      check: and(
        wasGit("merge"),
        ({ result }) =>
          result.exitCode === 0 && /(Fast-forward|Already up to date|recursive)/.test(result.stdout)
      ),
      completedMessage:
        "Hayashi-san pours tea. \"That's the whole tour. You can navigate, read, plumb, control, and now you can remember. Take the train where you like next.\"",
    },
  ],
};

// silence unused
void wasCommand;
