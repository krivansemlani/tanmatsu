import { describe, it, expect, beforeEach } from "vitest";
import { execute } from "./executor";
import { newShell, type Shell } from "./commands";
import { mkDir, mkFile, walk, isFile, isDir, listDir } from "./fs";

function freshShell(): Shell {
  return newShell({
    root: mkDir("/", {
      home: mkDir("home", {
        traveler: mkDir("traveler", {
          "readme.md": mkFile("readme.md", "# hello"),
          notes: mkDir("notes", {
            "todo.txt": mkFile("todo.txt", "learn the shell\nwrite a thing"),
          }),
        }),
      }),
      etc: mkDir("etc", {
        hosts: mkFile("hosts", "127.0.0.1 localhost"),
      }),
    }),
    cwd: "/home/traveler",
  });
}

describe("executor — basic commands", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("pwd returns cwd", () => {
    expect(execute(s, "pwd").stdout).toBe("/home/traveler");
  });

  it("ls returns sorted entries", () => {
    expect(execute(s, "ls").stdout).toBe("notes  readme.md");
  });

  it("ls -l shows file size + perms", () => {
    const out = execute(s, "ls -l").stdout;
    expect(out).toMatch(/readme\.md/);
    expect(out).toMatch(/d755/);
  });

  it("cd changes cwd", () => {
    execute(s, "cd notes");
    expect(s.cwd).toBe("/home/traveler/notes");
  });

  it("cd ~ returns home", () => {
    execute(s, "cd /etc");
    execute(s, "cd ~");
    expect(s.cwd).toBe("/home/traveler");
  });

  it("cd to a file fails", () => {
    const r = execute(s, "cd readme.md");
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toMatch(/not a directory/);
  });

  it("cat reads a file", () => {
    expect(execute(s, "cat readme.md").stdout).toBe("# hello");
  });

  it("cat on missing file errors", () => {
    const r = execute(s, "cat nope");
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toMatch(/no such file/);
  });

  it("mkdir + touch make a new dir and file", () => {
    execute(s, "mkdir projects");
    execute(s, "touch projects/draft.md");
    expect(isDir(walk(s.root, "/home/traveler/projects"))).toBe(true);
    expect(isFile(walk(s.root, "/home/traveler/projects/draft.md"))).toBe(true);
  });

  it("mkdir without -p fails on missing intermediates", () => {
    const r = execute(s, "mkdir a/b/c");
    expect(r.exitCode).not.toBe(0);
  });

  it("mkdir -p creates the chain", () => {
    expect(execute(s, "mkdir -p a/b/c").exitCode).toBe(0);
    expect(isDir(walk(s.root, "/home/traveler/a/b/c"))).toBe(true);
  });

  it("mv renames a file", () => {
    execute(s, "mv readme.md README.md");
    expect(walk(s.root, "/home/traveler/readme.md")).toBeNull();
    expect(isFile(walk(s.root, "/home/traveler/README.md"))).toBe(true);
  });

  it("rm deletes a file", () => {
    execute(s, "rm readme.md");
    expect(walk(s.root, "/home/traveler/readme.md")).toBeNull();
  });

  it("rm on a dir without -r fails", () => {
    const r = execute(s, "rm notes");
    expect(r.exitCode).not.toBe(0);
  });

  it("rm -rf removes a populated directory", () => {
    expect(execute(s, "rm -rf notes").exitCode).toBe(0);
    expect(walk(s.root, "/home/traveler/notes")).toBeNull();
  });
});

describe("executor — pipes + redirects + sequences", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("pipes stdout to stdin", () => {
    expect(execute(s, "cat readme.md | cat").stdout).toBe("# hello");
  });

  it("> writes to file", () => {
    execute(s, "echo hi > greet.txt");
    const f = walk(s.root, "/home/traveler/greet.txt");
    if (isFile(f)) expect(f.content).toBe("hi\n");
  });

  it(">> appends", () => {
    execute(s, "echo first > log.txt");
    execute(s, "echo second >> log.txt");
    const f = walk(s.root, "/home/traveler/log.txt");
    if (isFile(f)) expect(f.content).toBe("first\nsecond\n");
  });

  it("< reads from file as stdin", () => {
    execute(s, "echo body > in.txt");
    expect(execute(s, "cat < in.txt").stdout.trim()).toBe("body");
  });

  it("&& runs only on success", () => {
    const r = execute(s, "pwd && echo next");
    expect(r.stdout.trim()).toBe("/home/traveler\nnext");
  });

  it("&& short-circuits on failure", () => {
    const r = execute(s, "cd nope && echo never");
    expect(r.stdout).toBe("");
  });

  it("|| runs only on failure", () => {
    const r = execute(s, "cd nope || echo backup");
    expect(r.stdout.trim()).toBe("backup");
  });

  it("; runs both regardless", () => {
    const r = execute(s, "pwd ; echo done");
    expect(r.stdout.trim()).toBe("/home/traveler\ndone");
  });

  it("unknown command returns 127", () => {
    const r = execute(s, "nosuch");
    expect(r.exitCode).toBe(127);
    expect(r.stderr).toMatch(/command not found/);
  });
});

describe("executor — clone isolation", () => {
  it("two shells don't share filesystem state", () => {
    const a = freshShell();
    const b = freshShell();
    execute(a, "rm -rf notes");
    expect(walk(a.root, "/home/traveler/notes")).toBeNull();
    expect(walk(b.root, "/home/traveler/notes")).not.toBeNull();
  });
});
