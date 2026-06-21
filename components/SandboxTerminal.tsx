"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { execute, type ExecResult } from "@/lib/sandbox/executor";
import {
  COMMAND_NAMES,
  newShell,
  type Process,
  type Shell,
} from "@/lib/sandbox/commands";
import {
  cloneFs,
  HOME,
  isDir,
  listDir,
  resolvePath,
  walk,
  type DirNode,
} from "@/lib/sandbox/fs";

export type TerminalCommandMeta = {
  /** Readline shortcuts the user pressed while editing this line (e.g. "Ctrl+U"). */
  shortcuts: Set<string>;
};

type Props = {
  initialFs: DirNode;
  initialCwd?: string;
  initialProcesses?: Process[];
  greeting?: string;
  onCommand?: (
    line: string,
    result: ExecResult,
    shell: Shell,
    meta: TerminalCommandMeta
  ) => void;
  promptFor?: (cwd: string) => string;
};

const THEME = {
  background: "#161616",
  foreground: "#EDE7DA",
  cursor: "#EDE7DA",
  cursorAccent: "#161616",
  selectionBackground: "rgba(237,231,218,0.2)",
  black: "#161616",
  red: "#C8392E",
  green: "#7AAE6B",
  yellow: "#E8C547",
  blue: "#6E9DC5",
  magenta: "#A484B5",
  cyan: "#6BB5A8",
  white: "#EDE7DA",
  brightBlack: "rgba(237,231,218,0.4)",
  brightRed: "#E04A3F",
  brightGreen: "#94CD86",
  brightYellow: "#F2D766",
  brightBlue: "#7AB3D9",
  brightMagenta: "#BFA0CC",
  brightCyan: "#8AC9BC",
  brightWhite: "#FAF6EE",
};

function defaultPrompt(cwd: string): string {
  const display = cwd.startsWith(HOME) ? "~" + cwd.slice(HOME.length) : cwd;
  return `\x1b[97mtanmatsu\x1b[0m \x1b[90m${display}\x1b[0m \x1b[97m$\x1b[0m `;
}

function nlToCrlf(s: string): string {
  return s.replace(/\r?\n/g, "\r\n");
}

function longestCommonPrefix(strs: string[]): string {
  if (strs.length === 0) return "";
  let prefix = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (!strs[i].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === "") return "";
    }
  }
  return prefix;
}

type Completion = {
  matches: string[];
  common: string;
  trailing: string;
};

function completeFor(shell: Shell, buffer: string): Completion {
  const trimmed = buffer.trimStart();
  const lastSpace = buffer.lastIndexOf(" ");
  const lastToken = lastSpace >= 0 ? buffer.slice(lastSpace + 1) : trimmed;

  if (lastSpace < 0) {
    const matches = COMMAND_NAMES.filter((c) => c.startsWith(lastToken));
    const common = matches.length ? longestCommonPrefix(matches) : lastToken;
    const trailing = matches.length === 1 ? " " : "";
    return { matches, common, trailing };
  }

  let dirPart = "";
  let basePart = lastToken;
  const lastSlash = lastToken.lastIndexOf("/");
  if (lastSlash >= 0) {
    dirPart = lastToken.slice(0, lastSlash + 1);
    basePart = lastToken.slice(lastSlash + 1);
  }

  let lookupDir = shell.cwd;
  if (dirPart === "/") {
    lookupDir = "/";
  } else if (dirPart) {
    lookupDir = resolvePath(shell.cwd, dirPart);
  }
  const node = walk(shell.root, lookupDir);
  if (!isDir(node)) {
    return { matches: [], common: lastToken, trailing: "" };
  }
  const entries = listDir(node).filter((e) => e.startsWith(basePart));
  if (entries.length === 0) {
    return { matches: [], common: lastToken, trailing: "" };
  }
  const common = longestCommonPrefix(entries);
  let trailing = "";
  if (entries.length === 1) {
    const matched = node.children[entries[0]];
    trailing = matched.type === "dir" ? "/" : " ";
  }
  return {
    matches: entries.map((e) => dirPart + e),
    common: dirPart + common,
    trailing,
  };
}

/** Find the start of the word before `pos` for Ctrl+W. */
function wordStartBefore(buffer: string, pos: number): number {
  let i = pos;
  // skip whitespace immediately before cursor
  while (i > 0 && /\s/.test(buffer[i - 1])) i--;
  // skip non-whitespace
  while (i > 0 && !/\s/.test(buffer[i - 1])) i--;
  return i;
}

export function SandboxTerminal({
  initialFs,
  initialCwd,
  initialProcesses,
  greeting,
  onCommand,
  promptFor,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const promptFnRef = useRef(promptFor || defaultPrompt);
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    promptFnRef.current = promptFor || defaultPrompt;
    onCommandRef.current = onCommand;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const shell = newShell({
      root: cloneFs(initialFs),
      cwd: initialCwd,
      processes: initialProcesses,
    });

    const term = new Terminal({
      theme: THEME,
      fontFamily:
        "var(--font-mono-src), 'JetBrains Mono', ui-monospace, monospace",
      fontSize: 15,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: "block",
      scrollback: 500,
      convertEol: false,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    term.focus();

    let buffer = "";
    let pos = 0;
    let shortcuts = new Set<string>();
    const history: string[] = [];
    let historyIdx = -1;

    const writePrompt = () => term.write(promptFnRef.current(shell.cwd));

    // Repaint the current input line + place cursor at logical pos
    const redrawLine = () => {
      term.write("\r\x1b[2K");
      writePrompt();
      term.write(buffer);
      const back = buffer.length - pos;
      if (back > 0) term.write(`\x1b[${back}D`);
    };

    if (greeting) {
      term.writeln(`\x1b[90m${greeting}\x1b[0m`);
    } else {
      term.writeln(
        "\x1b[90mwelcome. type \x1b[97mhelp\x1b[90m to see what you can do.\x1b[0m"
      );
    }
    writePrompt();

    term.onData((data) => {
      // ─── Multi-char escape sequences (arrow keys) ───
      if (data === "\x1b[A") {
        if (history.length === 0) return;
        if (historyIdx === -1) historyIdx = history.length;
        if (historyIdx > 0) historyIdx--;
        buffer = history[historyIdx] || "";
        pos = buffer.length;
        redrawLine();
        return;
      }
      if (data === "\x1b[B") {
        if (history.length === 0) return;
        if (historyIdx < history.length - 1) {
          historyIdx++;
          buffer = history[historyIdx];
        } else {
          historyIdx = history.length;
          buffer = "";
        }
        pos = buffer.length;
        redrawLine();
        return;
      }
      if (data === "\x1b[D") {
        // left arrow
        if (pos > 0) {
          pos--;
          term.write("\x1b[D");
        }
        return;
      }
      if (data === "\x1b[C") {
        // right arrow
        if (pos < buffer.length) {
          pos++;
          term.write("\x1b[C");
        }
        return;
      }

      // ─── Single-character processing ───
      for (const ch of data) {
        // Tab — autocomplete
        if (ch === "\t") {
          const completion = completeFor(shell, buffer);
          if (completion.matches.length === 0) continue;

          const lastSpace = buffer.lastIndexOf(" ");
          const prefix = lastSpace >= 0 ? buffer.slice(0, lastSpace + 1) : "";
          const oldLast = lastSpace >= 0 ? buffer.slice(lastSpace + 1) : buffer;

          if (completion.matches.length === 1) {
            const newLast = completion.common + completion.trailing;
            if (newLast !== oldLast) {
              buffer = prefix + newLast;
              pos = buffer.length;
              redrawLine();
            }
          } else {
            if (completion.common.length > oldLast.length) {
              buffer = prefix + completion.common;
              pos = buffer.length;
              redrawLine();
            } else {
              term.write("\r\n");
              term.write(
                "\x1b[90m" + completion.matches.join("  ") + "\x1b[0m\r\n"
              );
              writePrompt();
              term.write(buffer);
              if (buffer.length - pos > 0) {
                term.write(`\x1b[${buffer.length - pos}D`);
              }
            }
          }
          continue;
        }

        // Enter — run the command
        if (ch === "\r") {
          term.write("\r\n");
          const line = buffer;
          const usedShortcuts = shortcuts;
          buffer = "";
          pos = 0;
          shortcuts = new Set();
          if (line.trim()) {
            history.push(line);
            historyIdx = history.length;
            const res = execute(shell, line);
            if (res.stdout === "__CLEAR__") {
              term.clear();
            } else {
              if (res.stdout) {
                const out = res.stdout.endsWith("\n")
                  ? res.stdout.slice(0, -1)
                  : res.stdout;
                term.write(nlToCrlf(out) + "\r\n");
              }
              if (res.stderr) {
                const errOut = res.stderr.endsWith("\n")
                  ? res.stderr.slice(0, -1)
                  : res.stderr;
                term.write(
                  "\x1b[31m" + nlToCrlf(errOut) + "\x1b[0m\r\n"
                );
              }
            }
            onCommandRef.current?.(line, res, shell, {
              shortcuts: usedShortcuts,
            });
          }
          writePrompt();
          continue;
        }

        // Backspace
        if (ch === "\x7f") {
          if (pos > 0) {
            buffer = buffer.slice(0, pos - 1) + buffer.slice(pos);
            pos--;
            redrawLine();
          }
          continue;
        }

        // Ctrl+A — cursor to start
        if (ch === "\x01") {
          shortcuts.add("Ctrl+A");
          pos = 0;
          redrawLine();
          continue;
        }

        // Ctrl+E — cursor to end
        if (ch === "\x05") {
          shortcuts.add("Ctrl+E");
          pos = buffer.length;
          redrawLine();
          continue;
        }

        // Ctrl+U — kill from cursor to start of line
        if (ch === "\x15") {
          shortcuts.add("Ctrl+U");
          buffer = buffer.slice(pos);
          pos = 0;
          redrawLine();
          continue;
        }

        // Ctrl+K — kill from cursor to end of line
        if (ch === "\x0B") {
          shortcuts.add("Ctrl+K");
          buffer = buffer.slice(0, pos);
          redrawLine();
          continue;
        }

        // Ctrl+W — kill word before cursor
        if (ch === "\x17") {
          if (pos === 0) continue;
          shortcuts.add("Ctrl+W");
          const start = wordStartBefore(buffer, pos);
          buffer = buffer.slice(0, start) + buffer.slice(pos);
          pos = start;
          redrawLine();
          continue;
        }

        // Ctrl+C — cancel current input
        if (ch === "\x03") {
          shortcuts.add("Ctrl+C");
          term.write("^C\r\n");
          buffer = "";
          pos = 0;
          shortcuts = new Set();
          historyIdx = history.length;
          writePrompt();
          continue;
        }

        // Ctrl+L — clear screen, keep current input
        if (ch === "\x0c") {
          shortcuts.add("Ctrl+L");
          term.clear();
          writePrompt();
          term.write(buffer);
          if (buffer.length - pos > 0) {
            term.write(`\x1b[${buffer.length - pos}D`);
          }
          continue;
        }

        // Printable character — insert at cursor
        if (ch >= " " && ch <= "~") {
          buffer = buffer.slice(0, pos) + ch + buffer.slice(pos);
          pos++;
          if (pos === buffer.length) {
            // cursor at end — fast path: just write the char
            term.write(ch);
          } else {
            redrawLine();
          }
          continue;
        }
      }
    });

    const handleResize = () => {
      try {
        fit.fit();
      } catch {
        /* container not laid out yet */
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="relative w-full bg-term-bg rounded-[2px] overflow-hidden"
      style={{
        height: "380px",
        boxShadow:
          "0 1px 0 var(--color-ink-10), 0 30px 60px -30px rgba(22,22,22,0.25)",
      }}
    >
      <div className="px-[18px] py-[10px] border-b border-[rgba(237,231,218,0.08)] flex justify-between text-term-dim font-mono text-[11px] tracking-wide">
        <span>tanmatsu — bash</span>
        <span>practice</span>
      </div>
      <div ref={containerRef} className="absolute inset-0 top-[36px] p-3" />
    </div>
  );
}
