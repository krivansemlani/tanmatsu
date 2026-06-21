// City 4 — Hokkaido (北海道)
// A mountain ryokan in winter. You're staying with Ozawa, an old sysadmin
// who runs a few small servers out of his shed for local fishing co-ops.
// He teaches you the last layer: who you are, what you own, what's running,
// and how to move on the line without lifting your hands.
// Teaches: whoami, ls -l perms, chmod, ps, kill + readline shortcuts.

import { mkDir, mkFile, walk, isFile, isDir } from "@/lib/sandbox/fs";
import type { City, Checker } from "@/lib/levels";
import type { Process } from "@/lib/sandbox/commands";

// --- shared seed data ---

const CABIN_README = `# the cabin

the woodstove is in the corner.
the well water is hot in the kettle.
the log is in log.txt — write your hours.
`;

const HOT_WATER_LOG = `2025-12-01  6:00  on
2025-12-01  9:30  off
2025-12-02  5:45  on
2025-12-02  10:00 off
`;

const baseFs = () =>
  mkDir("/", {
    home: mkDir("home", {
      traveler: mkDir("traveler", {
        "readme.md": mkFile("readme.md", CABIN_README),
        "log.txt": mkFile("log.txt", HOT_WATER_LOG),
        "private.txt": mkFile(
          "private.txt",
          "ozawa's private notes — don't read",
          0o600
        ),
      }),
    }),
  });

// The default-ish process table, plus a runaway "burner.sh" for L4/L5
const noisyProcesses = (): Process[] => [
  { pid: 1, name: "init", cpu: 0.0, mem: 0.1, status: "S" },
  { pid: 142, name: "systemd", cpu: 0.0, mem: 0.4, status: "S" },
  { pid: 384, name: "bash", cpu: 0.1, mem: 0.3, status: "S" },
  { pid: 2104, name: "node fish-relay.js", cpu: 1.2, mem: 4.8, status: "S" },
  { pid: 7117, name: "burner.sh", cpu: 94.3, mem: 12.6, status: "R" },
];

// --- check helpers ---

const wasCommand =
  (...names: string[]): Checker =>
  ({ command }) => {
    const first = command.trim().split(/\s+/)[0];
    return names.includes(first);
  };

const usedShortcut =
  (key: string): Checker =>
  ({ shortcuts }) =>
    shortcuts.has(key);

const and =
  (...cs: Checker[]): Checker =>
  (ctx) =>
    cs.every((c) => c(ctx));

export const HOKKAIDO: City = {
  id: "hokkaido",
  name: "Hokkaido",
  nameJa: "北海道",
  subtitle: "A mountain ryokan in winter. Ozawa runs servers from his shed.",
  tagline: "Control. Who you are, what runs, how fast you move.",
  belt: "brown",
  promptName: "sapporo",
  photoUrl:
    "https://images.unsplash.com/photo-1577893898077-ba79f1c3a3a7?w=2400&q=80&auto=format&fit=crop",
  mapPosition: { x: 868, y: 125 },
  levels: [
    {
      id: "hokkaido-01-whoami",
      cityId: "hokkaido",
      index: 1,
      title: "Who are you, on this box?",
      scenario:
        "Ozawa squints at the screen. \"Hold on. Who am I even logged in as? Print your name back to me — the one this machine knows.\"",
      hints: [
        "`whoami` prints the current user.",
        "It's literally just `whoami`.",
      ],
      teaches: ["whoami"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        wasCommand("whoami"),
        ({ result }) =>
          result.exitCode === 0 && result.stdout.trim() === "traveler"
      ),
      completedMessage:
        "\"Traveler. Fine. That's what I called your account. Pay attention to who you are.\"",
    },

    {
      id: "hokkaido-02-ls-l",
      cityId: "hokkaido",
      index: 2,
      title: "Read the cabin's permissions.",
      scenario:
        "\"Look at this folder's files in long form. The middle column shows perms — `644` means owner can read/write, everyone else read. `600` means just the owner. Print the long listing so we both see what's what.\"",
      hints: [
        "`ls -l` shows the long listing — perms, size, name.",
        "`ls -l`. Notice `private.txt` is more locked down than the others.",
      ],
      teaches: ["ls -l"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        wasCommand("ls"),
        ({ command }) => /\s-l\b|\s-\w*l/.test(command),
        ({ result }) =>
          result.exitCode === 0 && /600/.test(result.stdout) && /644/.test(result.stdout)
      ),
      completedMessage:
        "\"Right. private.txt is 600 — only I can read it. The rest are 644 — everybody else can at least look.\"",
    },

    {
      id: "hokkaido-03-chmod",
      cityId: "hokkaido",
      index: 3,
      title: "Unlock the log.",
      scenario:
        "\"Wait — the hot water `log.txt` got chmod'd to 600 somehow. Set it back to 644 so the rest of the cabin can read it.\"",
      hints: [
        "`chmod` changes file permissions. Numeric form like `644` is read+write for owner, read-only for others.",
        "`chmod 644 log.txt`.",
      ],
      teaches: ["chmod"],
      initialFs: () => {
        const fs = baseFs();
        const f = walk(fs, "/home/traveler/log.txt");
        if (isFile(f)) f.mode = 0o600;
        return fs;
      },
      initialCwd: "/home/traveler",
      check: ({ shell }) => {
        const f = walk(shell.root, "/home/traveler/log.txt");
        return isFile(f) && (f.mode & 0o777) === 0o644;
      },
      completedMessage: "\"Better. Everyone can see how long the kettle ran today.\"",
    },

    {
      id: "hokkaido-04-ps",
      cityId: "hokkaido",
      index: 4,
      title: "Something's burning.",
      scenario:
        "Ozawa cups his hand to his ear. The shed fans are screaming. \"List what's running — something is hammering the CPU and I want to see which one.\"",
      hints: [
        "`ps` lists running processes.",
        "`ps` or `ps aux` for more detail. Look for the one with high %CPU.",
      ],
      teaches: ["ps"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      initialProcesses: noisyProcesses,
      check: and(
        wasCommand("ps"),
        ({ result }) =>
          result.exitCode === 0 && /burner\.sh/.test(result.stdout)
      ),
      completedMessage:
        "\"PID 7117 — `burner.sh`. Some script someone left running. It's eating the fans.\"",
    },

    {
      id: "hokkaido-05-kill",
      cityId: "hokkaido",
      index: 5,
      title: "Stop it.",
      scenario:
        "\"Kill 7117. It's not responding to gentle signals — use the strong one, `kill -9`. That's the SIGKILL signal, the one a process can't ignore.\"",
      hints: [
        "`kill -9 PID` sends SIGKILL (signal 9) — instant termination.",
        "`kill -9 7117`.",
      ],
      teaches: ["kill -9"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      initialProcesses: noisyProcesses,
      check: ({ shell, command }) =>
        wasCommand("kill")({ command } as never) &&
        !shell.processes.find((p) => p.pid === 7117),
      completedMessage:
        "Fans spin down. \"Quiet again. Now — three more lessons. These you do with your hands, not commands.\"",
    },

    {
      id: "hokkaido-06-ctrl-u",
      cityId: "hokkaido",
      index: 6,
      title: "Wrong command. Don't press enter.",
      scenario:
        "\"This is line editing. You started typing `rm -rf /home` by mistake — don't run it. Type some text first, then hit **Ctrl+U** to clear the whole line. After that, type `pwd` and run it.\"\n\n(Ctrl+U kills everything from your cursor back to the start of the line. It's the fastest way to abandon a half-typed command.)",
      hints: [
        "Type a few characters, press Ctrl+U to wipe them, then type `pwd` and Enter.",
        "Ctrl+U on Mac is hold Control, press U. Then the line is empty.",
      ],
      teaches: ["Ctrl+U"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        usedShortcut("Ctrl+U"),
        wasCommand("pwd"),
        ({ result }) => result.exitCode === 0
      ),
      completedMessage:
        "\"Good. Faster than holding down backspace twenty times.\"",
    },

    {
      id: "hokkaido-07-ctrl-w",
      cityId: "hokkaido",
      index: 7,
      title: "Just the last word.",
      scenario:
        "\"This time, only the last word. Type any two-word command — say `ls notes` — then use **Ctrl+W** to delete the word `notes` (and the space before it). Then type `readme.md` and run `ls readme.md`.\"\n\n(Ctrl+W kills the word before your cursor. Useful when you mistyped the last argument.)",
      hints: [
        "Type `ls notes`, press Ctrl+W to delete `notes`, then type `readme.md` and Enter.",
        "Ctrl+W removes everything from your cursor back to the start of the previous word.",
      ],
      teaches: ["Ctrl+W"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        usedShortcut("Ctrl+W"),
        wasCommand("ls"),
        ({ command }) => /readme\.md/.test(command),
        ({ result }) => result.exitCode === 0
      ),
      completedMessage:
        "\"Now you can fix the last argument without retyping the whole thing.\"",
    },

    {
      id: "hokkaido-08-ctrl-a-e",
      cityId: "hokkaido",
      index: 8,
      title: "Move without lifting your hands.",
      scenario:
        "\"Last lesson. Type `cat readme.md` but DON'T press Enter yet. Now press **Ctrl+A** to jump to the start of the line, **Ctrl+E** to jump to the end, then press Enter. Both shortcuts in one command — that's how you stop using the arrow keys.\"\n\n(Ctrl+A = beginning of line. Ctrl+E = end of line. You'll use these constantly once they're in your fingers.)",
      hints: [
        "Type `cat readme.md`, press Ctrl+A, then Ctrl+E, then Enter.",
        "You don't need to move anything between A and E — just demonstrate both.",
      ],
      teaches: ["Ctrl+A", "Ctrl+E"],
      initialFs: baseFs,
      initialCwd: "/home/traveler",
      check: and(
        usedShortcut("Ctrl+A"),
        usedShortcut("Ctrl+E"),
        wasCommand("cat"),
        ({ result }) =>
          result.exitCode === 0 && /woodstove/.test(result.stdout)
      ),
      completedMessage:
        "Ozawa pours another cup of tea. \"That's what I know. You've got the navigate, the read, the plumb, the control. Take the next train south — and don't forget the cold.\"",
    },
  ],
};

// Silence unused — referenced via levels.ts
void isDir;
