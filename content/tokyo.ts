// City 1 — Tokyo (東京)
// You just started a new internship at a small tech studio in Shibuya.
// Your mentor walks you through your first day. Eight scenarios.
// Teaches the fundamentals: pwd, ls, cd, cat, mkdir, touch, mv, rm.

import { mkDir, mkFile, walk, isDir, isFile } from "@/lib/sandbox/fs";
import type { City, Checker } from "@/lib/levels";

const baseFs = () =>
  mkDir("/", {
    home: mkDir("home", {
      traveler: mkDir("traveler", {
        "readme.md": mkFile(
          "readme.md",
          "# welcome to the studio\n\nyou just sat down at a real terminal.\ntype `ls` to see what's here."
        ),
        notes: mkDir("notes", {
          "todo.txt": mkFile(
            "todo.txt",
            "1. read the readme\n2. say hi to the mentor\n3. learn the shell"
          ),
          "ideas.md": mkFile("ideas.md", "- a calmer dev tool\n- a real haiku"),
        }),
      }),
    }),
  });

const wasCommand =
  (...names: string[]): Checker =>
  ({ command }) => {
    const first = command.trim().split(/\s+/)[0];
    return names.includes(first);
  };

export const TOKYO: City = {
  id: "tokyo",
  name: "Tokyo",
  nameJa: "東京",
  subtitle: "Day one at a new desk.",
  tagline: "Find your way around. Navigate, read, create, rename, delete.",
  belt: "white",
  promptName: "tokyo",
  photoUrl:
    "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=2400&q=80&auto=format&fit=crop",
  mapPosition: { x: 760, y: 385 },
  levels: [
    {
      id: "tokyo-01-pwd",
      cityId: "tokyo",
      index: 1,
      title: "Where am I, again?",
      scenario:
        "Your mentor leans over your desk. \"Hey — what folder are you sitting in right now? Print it out so I can see.\"",
      hints: [
        "There's a command that prints the working directory.",
        "It's three letters. `pwd` — print working directory.",
      ],
      teaches: ["pwd"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: ({ command, result }) =>
        wasCommand("pwd")({ command, result } as never) &&
        result.exitCode === 0 &&
        result.stdout.trim() === "/home/traveler",
      completedMessage: "Mentor nods. \"Cool. Now I know where you are.\"",
    },

    {
      id: "tokyo-02-ls",
      cityId: "tokyo",
      index: 2,
      title: "What's in here?",
      scenario:
        "\"Good. Now list everything in this folder so we both know what we're working with.\"",
      hints: [
        "There's a two-letter command for listing files.",
        "`ls` — list. Try it.",
      ],
      teaches: ["ls"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: ({ command, result }) =>
        wasCommand("ls", "dir")({ command, result } as never) &&
        result.exitCode === 0,
      completedMessage: "\"Nice. You see the readme and the notes folder?\"",
    },

    {
      id: "tokyo-03-cd",
      cityId: "tokyo",
      index: 3,
      title: "Step into the notes.",
      scenario:
        "\"Move into the `notes` folder. We'll look at what's inside in a sec.\"",
      hints: [
        "`cd` changes directory. Give it a folder name.",
        "Try `cd notes`.",
      ],
      teaches: ["cd"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: ({ shell }) => shell.cwd === "/home/traveler/notes",
      completedMessage:
        "\"Good. Now you're inside `notes`. Notice the prompt updated.\"",
    },

    {
      id: "tokyo-04-cat",
      cityId: "tokyo",
      index: 4,
      title: "Read me my todos.",
      scenario:
        "\"Read what's in `todo.txt` out loud — well, print it to the terminal.\"",
      hints: [
        "`cat` prints a file's contents. Pass it a filename.",
        "`cat todo.txt`.",
      ],
      teaches: ["cat"],
      initialFs: baseFs,
      initialCwd: "/home/traveler/notes",
      check: ({ command, result }) =>
        wasCommand("cat")({ command, result } as never) &&
        result.exitCode === 0 &&
        result.stdout.includes("learn the shell"),
      completedMessage:
        "\"Mhm. Three things to do today. Let's start with #3.\"",
    },

    {
      id: "tokyo-05-mkdir",
      cityId: "tokyo",
      index: 5,
      title: "Make a workspace.",
      scenario:
        "\"Go back to your home folder, then create a new directory called `projects`. We'll put real work in there.\"",
      hints: [
        "Two commands. First `cd ~` to go home, then `mkdir <name>` to create.",
        "`cd ~ && mkdir projects` does both at once.",
      ],
      teaches: ["mkdir", "cd ~"],
      initialFs: baseFs,
      initialCwd: "/home/traveler/notes",
      check: ({ shell }) => {
        const node = walk(shell.root, "/home/traveler/projects");
        return isDir(node);
      },
      completedMessage:
        "\"Perfect. `projects` exists. Run `ls ~` if you don't believe me.\"",
    },

    {
      id: "tokyo-06-touch",
      cityId: "tokyo",
      index: 6,
      title: "An empty page.",
      scenario:
        "\"Inside `projects`, make an empty file called `draft.md`. We'll fill it in later.\"",
      hints: [
        "`touch` creates an empty file. Give it a path.",
        "If you're already in projects: `touch draft.md`. Otherwise: `touch ~/projects/draft.md`.",
      ],
      teaches: ["touch"],
      initialFs: () => {
        const fs = baseFs();
        const home = walk(fs, "/home/traveler");
        if (isDir(home)) home.children["projects"] = mkDir("projects");
        return fs;
      },
      initialCwd: "/home/traveler",
      check: ({ shell }) =>
        isFile(walk(shell.root, "/home/traveler/projects/draft.md")),
      completedMessage: "\"Good. Now we have a blank canvas.\"",
    },

    {
      id: "tokyo-07-mv",
      cityId: "tokyo",
      index: 7,
      title: "Better name.",
      scenario:
        "\"Hmm, `draft.md` is too generic. Rename it to `v1.md` instead.\"",
      hints: [
        "`mv` moves OR renames a file. Pass it the old name and the new name.",
        "`mv ~/projects/draft.md ~/projects/v1.md` (or from inside the folder: `mv draft.md v1.md`).",
      ],
      teaches: ["mv"],
      initialFs: () => {
        const fs = baseFs();
        const home = walk(fs, "/home/traveler");
        if (isDir(home)) {
          home.children["projects"] = mkDir("projects", {
            "draft.md": mkFile("draft.md"),
          });
        }
        return fs;
      },
      initialCwd: "/home/traveler/projects",
      check: ({ shell }) =>
        isFile(walk(shell.root, "/home/traveler/projects/v1.md")) &&
        !walk(shell.root, "/home/traveler/projects/draft.md"),
      completedMessage: "\"Much better. Versioning matters.\"",
    },

    {
      id: "tokyo-08-rm",
      cityId: "tokyo",
      index: 8,
      title: "Throw it out.",
      scenario:
        "\"You know what, scratch that. Just delete `v1.md`. We'll start fresh tomorrow.\"\n\n(Heads up: `rm` is permanent. There's no trash can. Be sure before you run it.)",
      hints: [
        "`rm` removes a file. No trash, no undo.",
        "`rm v1.md` from inside `projects`, or `rm ~/projects/v1.md` from anywhere.",
      ],
      teaches: ["rm"],
      initialFs: () => {
        const fs = baseFs();
        const home = walk(fs, "/home/traveler");
        if (isDir(home)) {
          home.children["projects"] = mkDir("projects", {
            "v1.md": mkFile("v1.md"),
          });
        }
        return fs;
      },
      initialCwd: "/home/traveler/projects",
      check: ({ shell }) => !walk(shell.root, "/home/traveler/projects/v1.md"),
      completedMessage:
        "Mentor smiles. \"That's day one. You can navigate, read, create, rename, delete. Take five. Tomorrow we head to Kyoto.\"",
    },
  ],
};
