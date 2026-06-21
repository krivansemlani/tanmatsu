// Executor: walks the parser AST, runs commands, threads pipes, applies
// redirects, honors && and || short-circuiting.

import { parse, type Command, type Pipeline } from "./parser";
import {
  COMMANDS,
  type CommandResult,
  type Shell,
} from "./commands";
import { isFile, resolvePath, walk, writeFile } from "./fs";

export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export function execute(shell: Shell, input: string): ExecResult {
  const parsed = parse(input);
  if (parsed.type === "error") {
    return { stdout: "", stderr: `syntax error: ${parsed.message}`, exitCode: 2 };
  }

  let lastExit = 0;
  let combinedOut = "";
  let combinedErr = "";

  for (let s = 0; s < parsed.steps.length; s++) {
    const step = parsed.steps[s];
    const prev = parsed.steps[s - 1];
    if (prev?.op === "&&" && lastExit !== 0) continue;
    if (prev?.op === "||" && lastExit === 0) continue;

    const res = runPipeline(shell, step.pipeline);
    lastExit = res.exitCode;
    if (res.stdout) {
      combinedOut += (combinedOut ? "\n" : "") + res.stdout;
    }
    if (res.stderr) {
      combinedErr += (combinedErr ? "\n" : "") + res.stderr;
    }
  }

  return { stdout: combinedOut, stderr: combinedErr, exitCode: lastExit };
}

function runPipeline(shell: Shell, pipeline: Pipeline): ExecResult {
  let stdin = "";
  let stdout = "";
  let stderr = "";
  let exitCode = 0;

  for (const cmd of pipeline.commands) {
    const res = runCommand(shell, cmd, stdin);
    stdin = res.stdout;
    stdout = res.stdout;
    if (res.stderr) stderr += (stderr ? "\n" : "") + res.stderr;
    exitCode = res.exitCode;
  }

  return { stdout, stderr, exitCode };
}

function runCommand(
  shell: Shell,
  cmd: Command,
  stdin: string
): CommandResult {
  // < redirect replaces stdin
  for (const r of cmd.redirects) {
    if (r.op === "<") {
      const abs = resolvePath(shell.cwd, r.target);
      const node = walk(shell.root, abs);
      if (!node || !isFile(node)) {
        return {
          stdout: "",
          stderr: `${r.target}: no such file or directory`,
          exitCode: 1,
        };
      }
      stdin = node.content;
    }
  }

  const name = cmd.args[0];
  const fn = COMMANDS[name];
  if (!fn) {
    return {
      stdout: "",
      stderr: `${name}: command not found`,
      exitCode: 127,
    };
  }

  const res = fn({ args: cmd.args, stdin, shell });

  if (res.cwdAfter) shell.cwd = res.cwdAfter;

  // > / >> redirects: capture stdout into a file instead of returning it
  for (const r of cmd.redirects) {
    if (r.op === ">" || r.op === ">>") {
      const abs = resolvePath(shell.cwd, r.target);
      const writeRes = writeFile(shell.root, abs, res.stdout, r.op === ">>");
      if (!writeRes.ok) {
        return { ...res, stderr: writeRes.error, exitCode: 1 };
      }
      return { ...res, stdout: "" };
    }
  }

  return res;
}
