// All sandbox commands live here. Each is a pure(ish) function that takes
// (args, stdin, shell) and returns {stdout, stderr, exitCode, cwdAfter?}.
// Mutations to the filesystem happen through the shell.root reference.

import {
  type DirNode,
  type FsNode,
  HOME,
  isDir,
  isFile,
  listDir,
  mkdirP,
  move,
  resolvePath,
  rmRecursive,
  touchFile,
  unlink,
  walk,
  writeFile,
} from "./fs";
import { parseArgs } from "./parser";

function globToRegex(pattern: string): RegExp {
  let r = "^";
  for (const c of pattern) {
    if (c === "*") r += ".*";
    else if (c === "?") r += ".";
    else if (".+^$(){}|\\".includes(c)) r += "\\" + c;
    else r += c;
  }
  r += "$";
  return new RegExp(r);
}

/** Split content into lines, dropping the empty element a trailing \n creates. */
function splitLines(content: string): string[] {
  if (content === "") return [];
  const lines = content.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Join lines with trailing \n on each — matches real Unix line-oriented tools. */
function joinLines(lines: string[]): string {
  if (lines.length === 0) return "";
  return lines.join("\n") + "\n";
}

export type Process = {
  pid: number;
  name: string;
  cpu: number; // %
  mem: number; // %
  status: "R" | "S" | "Z"; // running, sleeping, zombie
};

export type Shell = {
  cwd: string;
  root: DirNode;
  env: Record<string, string>;
  previousCwd?: string;
  processes: Process[];
};

export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  cwdAfter?: string;
};

export type CommandIO = {
  args: string[]; // includes argv[0] = command name
  stdin: string;
  shell: Shell;
};

export type CommandFn = (io: CommandIO) => CommandResult;

const ok = (stdout = "", stderr = "", exitCode = 0): CommandResult => ({
  stdout,
  stderr,
  exitCode,
});

const fail = (message: string, code = 1, name?: string): CommandResult => ({
  stdout: "",
  stderr: name ? `${name}: ${message}` : message,
  exitCode: code,
});

// --- pwd ---
const pwd: CommandFn = ({ shell }) => ok(shell.cwd);

// --- cd ---
const cd: CommandFn = ({ args, shell }) => {
  const target = args[1] || "~";
  const abs =
    target === "-"
      ? shell.previousCwd || shell.cwd
      : resolvePath(shell.cwd, target);
  const node = walk(shell.root, abs);
  if (!node) return fail(`${target}: no such file or directory`, 1, "cd");
  if (!isDir(node)) return fail(`${target}: not a directory`, 1, "cd");
  shell.previousCwd = shell.cwd;
  return { stdout: "", stderr: "", exitCode: 0, cwdAfter: abs };
};

// --- ls ---
const ls: CommandFn = ({ args, shell }) => {
  const { flags, positional } = parseArgs(args.slice(1));
  const targets = positional.length ? positional : ["."];
  const long = flags.has("l");
  const all = flags.has("a");

  const lines: string[] = [];
  let exitCode = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const abs = resolvePath(shell.cwd, t);
    const node = walk(shell.root, abs);
    if (!node) {
      lines.push(`ls: ${t}: no such file or directory`);
      exitCode = 1;
      continue;
    }
    if (targets.length > 1) {
      if (i > 0) lines.push("");
      lines.push(`${t}:`);
    }
    if (isFile(node)) {
      lines.push(node.name);
      continue;
    }
    // directory
    let entries = listDir(node);
    if (!all) entries = entries.filter((n) => !n.startsWith("."));
    if (long) {
      for (const name of entries) {
        const child = node.children[name];
        const kind = child.type === "dir" ? "d" : "-";
        const perm = (child.mode & 0o777).toString(8);
        const size = child.type === "file" ? String(child.content.length) : "—";
        lines.push(`${kind}${perm}  ${size.padStart(5)}  ${name}`);
      }
    } else {
      lines.push(entries.join("  "));
    }
  }
  return { stdout: lines.join("\n"), stderr: "", exitCode };
};

// --- cat ---
const cat: CommandFn = ({ args, stdin, shell }) => {
  const files = args.slice(1).filter((a) => !a.startsWith("-"));
  if (files.length === 0) return ok(stdin);

  const parts: string[] = [];
  const errs: string[] = [];
  let code = 0;
  for (const f of files) {
    if (f === "-") {
      parts.push(stdin);
      continue;
    }
    const abs = resolvePath(shell.cwd, f);
    const node = walk(shell.root, abs);
    if (!node) {
      errs.push(`cat: ${f}: no such file or directory`);
      code = 1;
      continue;
    }
    if (isDir(node)) {
      errs.push(`cat: ${f}: is a directory`);
      code = 1;
      continue;
    }
    parts.push(node.content);
  }
  return { stdout: parts.join(""), stderr: errs.join("\n"), exitCode: code };
};

// --- mkdir ---
const mkdir: CommandFn = ({ args, shell }) => {
  const { flags, positional } = parseArgs(args.slice(1));
  if (positional.length === 0) return fail("missing operand", 1, "mkdir");
  const recursive = flags.has("p");
  const errs: string[] = [];
  let code = 0;
  for (const p of positional) {
    const abs = resolvePath(shell.cwd, p);
    const res = mkdirP(shell.root, abs, recursive);
    if (!res.ok) {
      errs.push(`mkdir: ${res.error}`);
      code = 1;
    }
  }
  return { stdout: "", stderr: errs.join("\n"), exitCode: code };
};

// --- touch ---
const touch: CommandFn = ({ args, shell }) => {
  const { positional } = parseArgs(args.slice(1));
  if (positional.length === 0) return fail("missing operand", 1, "touch");
  for (const f of positional) {
    const abs = resolvePath(shell.cwd, f);
    const res = touchFile(shell.root, abs);
    if (!res.ok) return fail(res.error, 1, "touch");
  }
  return ok();
};

// --- mv ---
const mv: CommandFn = ({ args, shell }) => {
  const { positional } = parseArgs(args.slice(1));
  if (positional.length < 2) {
    return fail("missing destination operand", 1, "mv");
  }
  const dst = positional[positional.length - 1];
  const srcs = positional.slice(0, -1);
  const dstAbs = resolvePath(shell.cwd, dst);
  const dstNode = walk(shell.root, dstAbs);
  if (srcs.length > 1 && !isDir(dstNode)) {
    return fail(`${dst}: not a directory`, 1, "mv");
  }
  const errs: string[] = [];
  let code = 0;
  for (const src of srcs) {
    const res = move(shell.root, resolvePath(shell.cwd, src), dstAbs);
    if (!res.ok) {
      errs.push(`mv: ${res.error}`);
      code = 1;
    }
  }
  return { stdout: "", stderr: errs.join("\n"), exitCode: code };
};

// --- rm ---
const rm: CommandFn = ({ args, shell }) => {
  const { flags, positional } = parseArgs(args.slice(1));
  const recursive = flags.has("r") || flags.has("R");
  const force = flags.has("f");
  if (positional.length === 0 && !force) {
    return fail("missing operand", 1, "rm");
  }
  const errs: string[] = [];
  let code = 0;
  for (const p of positional) {
    const abs = resolvePath(shell.cwd, p);
    const node = walk(shell.root, abs);
    if (!node) {
      if (!force) {
        errs.push(`rm: ${p}: no such file or directory`);
        code = 1;
      }
      continue;
    }
    if (isDir(node) && !recursive) {
      errs.push(`rm: ${p}: is a directory`);
      code = 1;
      continue;
    }
    const res = isDir(node)
      ? rmRecursive(shell.root, abs)
      : unlink(shell.root, abs);
    if (!res.ok && !force) {
      errs.push(`rm: ${res.error}`);
      code = 1;
    }
  }
  return { stdout: "", stderr: errs.join("\n"), exitCode: code };
};

// --- grep ---
const grep: CommandFn = ({ args, stdin, shell }) => {
  const { flags, positional } = parseArgs(args.slice(1));
  if (positional.length === 0) {
    return fail("usage: grep PATTERN [FILE...]", 2, "grep");
  }
  const pattern = positional[0];
  const files = positional.slice(1);

  const caseInsensitive = flags.has("i");
  const showLineNum = flags.has("n");
  const invert = flags.has("v");
  const countOnly = flags.has("c");

  let re: RegExp;
  try {
    re = new RegExp(pattern, caseInsensitive ? "i" : "");
  } catch {
    return fail(`invalid pattern: ${pattern}`, 2, "grep");
  }

  const inputs: Array<{ label: string; content: string }> = [];
  if (files.length === 0) {
    inputs.push({ label: "", content: stdin });
  } else {
    for (const f of files) {
      const abs = resolvePath(shell.cwd, f);
      const node = walk(shell.root, abs);
      if (!node) {
        return fail(`${f}: no such file or directory`, 2, "grep");
      }
      if (isDir(node)) {
        return fail(`${f}: is a directory`, 2, "grep");
      }
      inputs.push({ label: f, content: node.content });
    }
  }

  const showFilename = inputs.length > 1;
  const outLines: string[] = [];
  let anyMatched = false;

  for (const inp of inputs) {
    const lines = inp.content.split("\n");

    if (countOnly) {
      let count = 0;
      for (const line of lines) {
        const matched = re.test(line);
        if (matched !== invert) count++;
      }
      if (count > 0) anyMatched = true;
      outLines.push(showFilename ? `${inp.label}:${count}` : `${count}`);
      continue;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matched = re.test(line);
      if (matched === invert) continue;
      anyMatched = true;
      const parts: string[] = [];
      if (showFilename) parts.push(inp.label);
      if (showLineNum) parts.push(String(i + 1));
      parts.push(line);
      outLines.push(parts.join(":"));
    }
  }

  return {
    stdout: joinLines(outLines),
    stderr: "",
    exitCode: anyMatched ? 0 : 1,
  };
};

// --- find ---
const find: CommandFn = ({ args, shell }) => {
  // find [PATH] [-name PATTERN] [-type d|f]
  const raw = args.slice(1);
  let startPath = ".";
  let namePattern: string | null = null;
  let typeFilter: "f" | "d" | null = null;

  let argIdx = 0;
  if (raw[0] && !raw[0].startsWith("-")) {
    startPath = raw[0];
    argIdx = 1;
  }
  while (argIdx < raw.length) {
    const a = raw[argIdx];
    if (a === "-name" && raw[argIdx + 1] !== undefined) {
      namePattern = raw[argIdx + 1];
      argIdx += 2;
    } else if (a === "-type" && raw[argIdx + 1] !== undefined) {
      const t = raw[argIdx + 1];
      if (t === "f" || t === "d") typeFilter = t;
      argIdx += 2;
    } else {
      argIdx++;
    }
  }

  const startAbs = resolvePath(shell.cwd, startPath);
  const startNode = walk(shell.root, startAbs);
  if (!startNode) {
    return fail(`'${startPath}': No such file or directory`, 1, "find");
  }

  const nameRe = namePattern ? globToRegex(namePattern) : null;
  const results: string[] = [];

  function visit(node: FsNode, displayPath: string) {
    let include = true;
    if (typeFilter === "f" && node.type !== "file") include = false;
    if (typeFilter === "d" && node.type !== "dir") include = false;
    if (nameRe) {
      const basename = displayPath.split("/").pop() || displayPath;
      if (!nameRe.test(basename)) include = false;
    }
    if (include) results.push(displayPath);

    if (isDir(node)) {
      for (const name of Object.keys(node.children).sort()) {
        const sep = displayPath === "/" || displayPath === "" ? (displayPath === "/" ? "" : "") : "/";
        const joined =
          displayPath === ""
            ? name
            : displayPath === "/"
              ? "/" + name
              : displayPath + "/" + name;
        visit(node.children[name], joined);
      }
    }
  }

  visit(startNode, startPath);

  return ok(joinLines(results));
};

// --- head ---
const head: CommandFn = ({ args, stdin, shell }) => {
  let n = 10;
  const files: string[] = [];
  const raw = args.slice(1);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === "-n" && raw[i + 1] !== undefined) {
      n = parseInt(raw[i + 1], 10);
      if (Number.isNaN(n)) n = 10;
      i++;
    } else if (/^-\d+$/.test(a)) {
      n = parseInt(a.slice(1), 10);
    } else if (a.startsWith("-")) {
      /* ignore */
    } else {
      files.push(a);
    }
  }

  const inputs: Array<{ label: string; content: string }> = [];
  if (files.length === 0) {
    inputs.push({ label: "", content: stdin });
  } else {
    for (const f of files) {
      const abs = resolvePath(shell.cwd, f);
      const node = walk(shell.root, abs);
      if (!node) return fail(`${f}: no such file or directory`, 1, "head");
      if (isDir(node)) return fail(`${f}: is a directory`, 1, "head");
      inputs.push({ label: f, content: node.content });
    }
  }

  const chunks: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    if (inputs.length > 1) {
      if (i > 0) chunks.push("\n");
      chunks.push(`==> ${inputs[i].label} <==\n`);
    }
    const lines = splitLines(inputs[i].content).slice(0, n);
    chunks.push(joinLines(lines));
  }
  return ok(chunks.join(""));
};

// --- tail ---
const tail: CommandFn = ({ args, stdin, shell }) => {
  let n = 10;
  const files: string[] = [];
  const raw = args.slice(1);
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === "-n" && raw[i + 1] !== undefined) {
      n = parseInt(raw[i + 1], 10);
      if (Number.isNaN(n)) n = 10;
      i++;
    } else if (/^-\d+$/.test(a)) {
      n = parseInt(a.slice(1), 10);
    } else if (a.startsWith("-")) {
      /* ignore */
    } else {
      files.push(a);
    }
  }

  const inputs: Array<{ label: string; content: string }> = [];
  if (files.length === 0) {
    inputs.push({ label: "", content: stdin });
  } else {
    for (const f of files) {
      const abs = resolvePath(shell.cwd, f);
      const node = walk(shell.root, abs);
      if (!node) return fail(`${f}: no such file or directory`, 1, "tail");
      if (isDir(node)) return fail(`${f}: is a directory`, 1, "tail");
      inputs.push({ label: f, content: node.content });
    }
  }

  const chunks: string[] = [];
  for (let i = 0; i < inputs.length; i++) {
    if (inputs.length > 1) {
      if (i > 0) chunks.push("\n");
      chunks.push(`==> ${inputs[i].label} <==\n`);
    }
    const lines = splitLines(inputs[i].content);
    const slice = lines.slice(Math.max(0, lines.length - n));
    chunks.push(joinLines(slice));
  }
  return ok(chunks.join(""));
};

// --- wc ---
const wc: CommandFn = ({ args, stdin, shell }) => {
  const { flags, positional } = parseArgs(args.slice(1));
  const showLines = flags.has("l");
  const showWords = flags.has("w");
  const showChars = flags.has("c");
  const showAll = !showLines && !showWords && !showChars;

  const inputs: Array<{ label: string; content: string }> = [];
  if (positional.length === 0) {
    inputs.push({ label: "", content: stdin });
  } else {
    for (const f of positional) {
      const abs = resolvePath(shell.cwd, f);
      const node = walk(shell.root, abs);
      if (!node) return fail(`${f}: no such file or directory`, 1, "wc");
      if (isDir(node)) return fail(`${f}: is a directory`, 1, "wc");
      inputs.push({ label: f, content: node.content });
    }
  }

  const lines: string[] = [];
  let totalL = 0,
    totalW = 0,
    totalC = 0;

  for (const inp of inputs) {
    const l = (inp.content.match(/\n/g) || []).length;
    const w = inp.content.split(/\s+/).filter(Boolean).length;
    const c = inp.content.length;
    totalL += l;
    totalW += w;
    totalC += c;

    const parts: string[] = [];
    if (showAll || showLines) parts.push(String(l).padStart(7));
    if (showAll || showWords) parts.push(String(w).padStart(7));
    if (showAll || showChars) parts.push(String(c).padStart(7));
    if (inp.label) parts.push(inp.label);
    lines.push(parts.join(" "));
  }

  if (inputs.length > 1) {
    const parts: string[] = [];
    if (showAll || showLines) parts.push(String(totalL).padStart(7));
    if (showAll || showWords) parts.push(String(totalW).padStart(7));
    if (showAll || showChars) parts.push(String(totalC).padStart(7));
    parts.push("total");
    lines.push(parts.join(" "));
  }

  return ok(lines.join("\n"));
};

// --- sort ---
const sort: CommandFn = ({ args, stdin, shell }) => {
  const { flags, positional } = parseArgs(args.slice(1));
  const reverse = flags.has("r");
  const numeric = flags.has("n");
  const unique = flags.has("u");

  let input = stdin;
  if (positional.length > 0) {
    const parts: string[] = [];
    for (const f of positional) {
      const abs = resolvePath(shell.cwd, f);
      const node = walk(shell.root, abs);
      if (!node) return fail(`${f}: no such file or directory`, 2, "sort");
      if (isDir(node)) return fail(`${f}: is a directory`, 2, "sort");
      parts.push(node.content);
    }
    input = parts.join("");
  }

  const lines = splitLines(input);
  lines.sort((a, b) => {
    if (numeric) {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
      if (Number.isNaN(na)) return -1;
      if (Number.isNaN(nb)) return 1;
      return na - nb;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
  if (reverse) lines.reverse();

  let out = lines;
  if (unique) {
    out = [];
    let prev: string | undefined;
    for (const l of lines) {
      if (l !== prev) out.push(l);
      prev = l;
    }
  }

  return ok(joinLines(out));
};

// --- uniq ---
const uniq: CommandFn = ({ args, stdin, shell }) => {
  const { flags, positional } = parseArgs(args.slice(1));
  const showCount = flags.has("c");
  const onlyDups = flags.has("d");
  const onlyUnique = flags.has("u");

  let input = stdin;
  if (positional.length > 0) {
    const abs = resolvePath(shell.cwd, positional[0]);
    const node = walk(shell.root, abs);
    if (!node) return fail(`${positional[0]}: no such file or directory`, 1, "uniq");
    if (isDir(node)) return fail(`${positional[0]}: is a directory`, 1, "uniq");
    input = node.content;
  }

  const lines = splitLines(input);
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let count = 1;
    while (i + count < lines.length && lines[i + count] === lines[i]) count++;
    const line = lines[i];
    const formatted = showCount ? `${String(count).padStart(7)} ${line}` : line;
    if (onlyDups) {
      if (count > 1) out.push(formatted);
    } else if (onlyUnique) {
      if (count === 1) out.push(formatted);
    } else {
      out.push(formatted);
    }
    i += count;
  }

  return ok(joinLines(out));
};

// --- cut ---
function parseFieldList(spec: string): number[] {
  const result: number[] = [];
  for (const part of spec.split(",")) {
    if (part.includes("-")) {
      const [s, e] = part.split("-").map((n) => parseInt(n, 10));
      if (Number.isNaN(s) || Number.isNaN(e)) continue;
      for (let i = s; i <= e; i++) result.push(i);
    } else {
      const n = parseInt(part, 10);
      if (!Number.isNaN(n)) result.push(n);
    }
  }
  return result;
}

const cut: CommandFn = ({ args, stdin, shell }) => {
  const raw = args.slice(1);
  let delimiter = "\t";
  let fields: number[] = [];
  const files: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === "-d" && raw[i + 1] !== undefined) {
      delimiter = raw[i + 1];
      i++;
    } else if (a.startsWith("-d") && a.length > 2) {
      delimiter = a.slice(2);
    } else if (a === "-f" && raw[i + 1] !== undefined) {
      fields = parseFieldList(raw[i + 1]);
      i++;
    } else if (a.startsWith("-f") && a.length > 2) {
      fields = parseFieldList(a.slice(2));
    } else if (a.startsWith("-")) {
      /* unknown flag, ignore */
    } else {
      files.push(a);
    }
  }

  if (fields.length === 0) {
    return fail("missing -f field list", 2, "cut");
  }

  let input = stdin;
  if (files.length > 0) {
    const parts: string[] = [];
    for (const f of files) {
      const abs = resolvePath(shell.cwd, f);
      const node = walk(shell.root, abs);
      if (!node) return fail(`${f}: no such file or directory`, 1, "cut");
      if (isDir(node)) return fail(`${f}: is a directory`, 1, "cut");
      parts.push(node.content);
    }
    input = parts.join("");
  }

  const lines = splitLines(input);
  const out = lines.map((line) => {
    const cols = line.split(delimiter);
    return fields.map((f) => cols[f - 1] ?? "").join(delimiter);
  });
  return ok(joinLines(out));
};

// --- xargs ---
// Take whitespace-separated tokens from stdin and pass them to a command.
// -I {} replaces the placeholder per-item; otherwise tokens are appended.
const xargs: CommandFn = ({ args, stdin, shell }) => {
  const raw = args.slice(1);
  let placeholder: string | null = null;
  let perBatch: number | null = null;
  const cmdParts: string[] = [];
  let inFlags = true;

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (inFlags && a === "-I" && raw[i + 1] !== undefined) {
      placeholder = raw[i + 1];
      i++;
    } else if (inFlags && a.startsWith("-I") && a.length > 2) {
      placeholder = a.slice(2);
    } else if (inFlags && a === "-n" && raw[i + 1] !== undefined) {
      perBatch = parseInt(raw[i + 1], 10);
      if (Number.isNaN(perBatch)) perBatch = null;
      i++;
    } else if (inFlags && a.startsWith("-")) {
      /* unknown flag, ignore */
    } else {
      inFlags = false;
      cmdParts.push(a);
    }
  }

  if (cmdParts.length === 0) cmdParts.push("echo");

  const items = placeholder
    ? splitLines(stdin)
    : stdin.split(/\s+/).filter(Boolean);

  const outputs: string[] = [];
  let exitCode = 0;

  if (placeholder) {
    const ph = placeholder;
    for (const item of items) {
      const newArgs = cmdParts.map((p) => p.split(ph).join(item));
      const fn = COMMANDS[newArgs[0]];
      if (!fn) return fail(`${newArgs[0]}: command not found`, 127, "xargs");
      const r = fn({ args: newArgs, stdin: "", shell });
      if (r.stdout) outputs.push(r.stdout);
      if (r.exitCode !== 0) exitCode = r.exitCode;
    }
  } else {
    const batchSize = perBatch || Math.max(items.length, 1);
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const newArgs = [...cmdParts, ...batch];
      const fn = COMMANDS[newArgs[0]];
      if (!fn) return fail(`${newArgs[0]}: command not found`, 127, "xargs");
      const r = fn({ args: newArgs, stdin: "", shell });
      if (r.stdout) outputs.push(r.stdout);
      if (r.exitCode !== 0) exitCode = r.exitCode;
    }
  }

  return { stdout: outputs.join(""), stderr: "", exitCode };
};

// --- tee ---
// Read stdin, write it to each named file, AND pass it through to stdout.
const tee: CommandFn = ({ args, stdin, shell }) => {
  const { flags, positional } = parseArgs(args.slice(1));
  const append = flags.has("a");

  for (const f of positional) {
    const abs = resolvePath(shell.cwd, f);
    const res = writeFile(shell.root, abs, stdin, append);
    if (!res.ok) return fail(res.error, 1, "tee");
  }

  return ok(stdin);
};

// --- whoami ---
const whoami: CommandFn = ({ shell }) => ok((shell.env.USER || "traveler") + "\n");

// --- chmod (numeric + simple symbolic) ---
const chmod: CommandFn = ({ args, shell }) => {
  const positional = args.slice(1);
  if (positional.length < 2) {
    return fail("usage: chmod MODE FILE", 2, "chmod");
  }
  const modeStr = positional[0];
  const files = positional.slice(1);

  let computeMode: (current: number) => number;

  if (/^[0-7]+$/.test(modeStr)) {
    const newMode = parseInt(modeStr, 8);
    computeMode = () => newMode;
  } else {
    // Symbolic — [ugoa]*[+\-=][rwx]+
    const m = modeStr.match(/^([ugoa]*)([+\-=])([rwx]+)$/);
    if (!m) return fail(`invalid mode: ${modeStr}`, 2, "chmod");
    const whoStr = m[1] || "a";
    const op = m[2];
    const perms = m[3];

    let bits = 0;
    if (perms.includes("r")) bits |= 0o444;
    if (perms.includes("w")) bits |= 0o222;
    if (perms.includes("x")) bits |= 0o111;

    let restrict = 0;
    if (whoStr.includes("u") || whoStr === "a") restrict |= 0o700;
    if (whoStr.includes("g") || whoStr === "a") restrict |= 0o070;
    if (whoStr.includes("o") || whoStr === "a") restrict |= 0o007;
    bits &= restrict;

    computeMode = (current) => {
      if (op === "+") return current | bits;
      if (op === "-") return current & ~bits;
      return (current & ~restrict) | bits;
    };
  }

  for (const f of files) {
    const abs = resolvePath(shell.cwd, f);
    const node = walk(shell.root, abs);
    if (!node) return fail(`${f}: no such file or directory`, 1, "chmod");
    node.mode = computeMode(node.mode) & 0o777;
  }

  return ok();
};

// --- ps ---
const ps: CommandFn = ({ shell, args }) => {
  const flags = args.slice(1).join("").replace(/-/g, "");
  const showFull = flags.includes("u") || flags.includes("f");

  const procs = shell.processes || [];
  const lines: string[] = [];

  if (showFull) {
    lines.push("USER       PID  %CPU  %MEM  STAT  COMMAND");
    for (const p of procs) {
      lines.push(
        `${(shell.env.USER || "traveler").padEnd(10)} ${String(p.pid).padStart(5)}  ${p.cpu.toFixed(1).padStart(4)}  ${p.mem.toFixed(1).padStart(4)}  ${p.status.padEnd(4)}  ${p.name}`
      );
    }
  } else {
    lines.push("  PID  STAT  COMMAND");
    for (const p of procs) {
      lines.push(
        `${String(p.pid).padStart(5)}  ${p.status.padEnd(4)}  ${p.name}`
      );
    }
  }

  return ok(joinLines(lines));
};

// --- kill ---
const killCmd: CommandFn = ({ shell, args }) => {
  const raw = args.slice(1);
  const pids: number[] = [];
  let signal = "TERM";

  for (const a of raw) {
    if (a === "-9" || a === "-KILL") signal = "KILL";
    else if (a === "-15" || a === "-TERM") signal = "TERM";
    else if (a.startsWith("-")) {
      /* unknown signal, ignore */
    } else {
      const n = parseInt(a, 10);
      if (!Number.isNaN(n)) pids.push(n);
    }
  }

  if (pids.length === 0) return fail("usage: kill [-9] PID", 2, "kill");

  void signal; // both signals just terminate in the sandbox

  const errs: string[] = [];
  for (const pid of pids) {
    const idx = shell.processes.findIndex((p) => p.pid === pid);
    if (idx === -1) {
      errs.push(`(${pid}) - No such process`);
    } else {
      shell.processes.splice(idx, 1);
    }
  }

  return {
    stdout: "",
    stderr: errs.length ? `kill: ${errs.join(", ")}` : "",
    exitCode: errs.length ? 1 : 0,
  };
};

// --- git (subcommand dispatcher) ---
import * as Git from "./git";

const gitCmd: CommandFn = ({ args, shell }) => {
  const sub = args[1];
  const subArgs = args.slice(2);
  if (!sub) {
    return ok(
      "usage: git <command> [args]\n" +
        "  git init               start a new repo\n" +
        "  git status             see what's tracked / staged\n" +
        "  git add <file>         stage a file\n" +
        "  git commit -m <msg>    commit staged changes\n" +
        "  git log                show commit history\n" +
        "  git diff               show unstaged changes\n" +
        "  git branch [name]      list or create a branch\n" +
        "  git switch [-c] <name> move to a branch\n" +
        "  git merge <branch>     merge a branch into the current one\n"
    );
  }
  switch (sub) {
    case "init":
      return Git.gitInit(shell.root, shell.cwd);
    case "status":
      return Git.gitStatus(shell.root, shell.cwd);
    case "add":
      return Git.gitAdd(shell.root, shell.cwd, subArgs);
    case "commit":
      return Git.gitCommit(shell.root, shell.cwd, subArgs);
    case "log":
      return Git.gitLog(shell.root, shell.cwd);
    case "diff":
      return Git.gitDiff(shell.root, shell.cwd);
    case "branch":
      return Git.gitBranch(shell.root, shell.cwd, subArgs);
    case "switch":
    case "checkout":
      return Git.gitSwitch(shell.root, shell.cwd, subArgs);
    case "merge":
      return Git.gitMerge(shell.root, shell.cwd, subArgs);
    default:
      return fail(
        `'${sub}' is not a git command (this sandbox supports: init, status, add, commit, log, diff, branch, switch, merge).\n`,
        1
      );
  }
};

// --- echo (bonus, useful with redirects) ---
// Bash echo appends a trailing newline by default unless -n is given.
const echo: CommandFn = ({ args }) => {
  const rest = args.slice(1);
  const noNewline = rest[0] === "-n";
  const text = (noNewline ? rest.slice(1) : rest).join(" ");
  return ok(noNewline ? text : text + "\n");
};

// --- clear (sandbox: terminal-side handles the actual clear) ---
const clearCmd: CommandFn = () => ok("__CLEAR__");

// --- help ---
const help: CommandFn = () =>
  ok(
    "available commands:\n" +
      "  navigate     pwd  cd  ls\n" +
      "  files        cat  mkdir  touch  mv  rm\n" +
      "  search       grep  find  head  tail  wc\n" +
      "  plumbing     sort  uniq  cut  xargs  tee\n" +
      "  system       whoami  chmod  ps  kill\n" +
      "  version      git (init, status, add, commit, log, diff, branch, switch, merge)\n" +
      "  shell        echo  clear  help\n" +
      "\n" +
      "shell features: pipes (|), redirects (> >> <), && and ||, tab autocomplete, ↑↓ history\n" +
      "line editing: Ctrl+A (home), Ctrl+E (end), Ctrl+U (kill line), Ctrl+W (kill word), Ctrl+L (clear)"
  );

export const COMMANDS: Record<string, CommandFn> = {
  pwd,
  cd,
  ls,
  cat,
  mkdir,
  touch,
  mv,
  rm,
  grep,
  find,
  head,
  tail,
  wc,
  sort,
  uniq,
  cut,
  xargs,
  tee,
  whoami,
  chmod,
  ps,
  kill: killCmd,
  git: gitCmd,
  echo,
  clear: clearCmd,
  help,
};

/** Names of all built-in commands — used by tab completion. */
export const COMMAND_NAMES = Object.keys(COMMANDS).sort();

const DEFAULT_PROCESSES: Process[] = [
  { pid: 1, name: "init", cpu: 0.0, mem: 0.1, status: "S" },
  { pid: 142, name: "systemd", cpu: 0.0, mem: 0.4, status: "S" },
  { pid: 384, name: "bash", cpu: 0.1, mem: 0.3, status: "S" },
];

// helper for tests / app code that wants a fresh shell
export function newShell(opts: Partial<Shell> & { root: DirNode }): Shell {
  return {
    cwd: opts.cwd || HOME,
    root: opts.root,
    env: opts.env || { HOME, USER: "traveler", PWD: HOME },
    previousCwd: opts.previousCwd,
    processes: opts.processes || DEFAULT_PROCESSES.map((p) => ({ ...p })),
  };
}
