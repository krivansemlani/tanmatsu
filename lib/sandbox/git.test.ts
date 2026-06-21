import { describe, it, expect, beforeEach } from "vitest";
import { execute } from "./executor";
import { newShell, type Shell } from "./commands";
import { mkDir, mkFile, walk, isFile, isDir } from "./fs";

function projectShell(): Shell {
  return newShell({
    root: mkDir("/", {
      home: mkDir("home", {
        traveler: mkDir("traveler", {
          project: mkDir("project", {
            "readme.md": mkFile("readme.md", "# project\n"),
          }),
        }),
      }),
    }),
    cwd: "/home/traveler/project",
  });
}

describe("git — init + status + add + commit", () => {
  let s: Shell;
  beforeEach(() => {
    s = projectShell();
  });

  it("init creates a .git directory", () => {
    expect(execute(s, "git init").exitCode).toBe(0);
    expect(isDir(walk(s.root, "/home/traveler/project/.git"))).toBe(true);
  });

  it("status before init = not a repo", () => {
    const r = execute(s, "git status");
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toMatch(/not a git repository/);
  });

  it("status after init shows untracked + no commits", () => {
    execute(s, "git init");
    const r = execute(s, "git status");
    expect(r.stdout).toMatch(/On branch main/);
    expect(r.stdout).toMatch(/No commits yet/);
    expect(r.stdout).toMatch(/Untracked files:/);
    expect(r.stdout).toMatch(/readme\.md/);
  });

  it("add then status shows staged", () => {
    execute(s, "git init");
    execute(s, "git add readme.md");
    const r = execute(s, "git status");
    expect(r.stdout).toMatch(/Changes to be committed/);
    expect(r.stdout).toMatch(/new file:\s+readme\.md/);
  });

  it("commit creates a commit and clean status follows", () => {
    execute(s, "git init");
    execute(s, "git add readme.md");
    const r = execute(s, "git commit -m initial");
    expect(r.stdout).toMatch(/\[main \w+\] initial/);
    expect(execute(s, "git status").stdout).toMatch(/nothing to commit/);
  });

  it("commit without -m errors", () => {
    execute(s, "git init");
    execute(s, "git add readme.md");
    expect(execute(s, "git commit").exitCode).not.toBe(0);
  });

  it("log shows the commit", () => {
    execute(s, "git init");
    execute(s, "git add readme.md");
    execute(s, "git commit -m initial");
    const r = execute(s, "git log");
    expect(r.stdout).toMatch(/commit \w+/);
    expect(r.stdout).toMatch(/initial/);
  });
});

describe("git — diff", () => {
  let s: Shell;
  beforeEach(() => {
    s = projectShell();
    execute(s, "git init");
    execute(s, "git add readme.md");
    execute(s, "git commit -m initial");
  });

  it("clean working tree → empty diff", () => {
    expect(execute(s, "git diff").stdout).toBe("");
  });

  it("modified file → diff shows + and -", () => {
    const f = walk(s.root, "/home/traveler/project/readme.md");
    if (isFile(f)) f.content = "# project\n\nnow with more\n";
    const r = execute(s, "git diff");
    expect(r.stdout).toMatch(/^diff --git/m);
    expect(r.stdout).toMatch(/\+now with more/);
  });
});

describe("git — branch + switch", () => {
  let s: Shell;
  beforeEach(() => {
    s = projectShell();
    execute(s, "git init");
    execute(s, "git add readme.md");
    execute(s, "git commit -m initial");
  });

  it("branch lists current with *", () => {
    const r = execute(s, "git branch");
    expect(r.stdout).toMatch(/\* main/);
  });

  it("branch + switch creates and moves", () => {
    execute(s, "git branch experimental");
    expect(execute(s, "git branch").stdout).toMatch(/experimental/);
    expect(execute(s, "git switch experimental").stdout).toMatch(/Switched/);
    expect(execute(s, "git branch").stdout).toMatch(/\* experimental/);
  });

  it("switch -c creates and switches in one", () => {
    expect(execute(s, "git switch -c feature").stdout).toMatch(/new branch/);
    expect(execute(s, "git branch").stdout).toMatch(/\* feature/);
  });

  it("commits on a branch don't affect main", () => {
    execute(s, "git switch -c side");
    const f = walk(s.root, "/home/traveler/project/readme.md");
    if (isFile(f)) f.content = "side branch content\n";
    execute(s, "git add readme.md");
    execute(s, "git commit -m side-change");
    execute(s, "git switch main");
    const main = walk(s.root, "/home/traveler/project/readme.md");
    if (isFile(main)) expect(main.content).toBe("# project\n");
  });
});

describe("git — merge", () => {
  let s: Shell;
  beforeEach(() => {
    s = projectShell();
    execute(s, "git init");
    execute(s, "git add readme.md");
    execute(s, "git commit -m initial");
  });

  it("fast-forward merge brings other branch's changes in", () => {
    execute(s, "git switch -c side");
    const f = walk(s.root, "/home/traveler/project/readme.md");
    if (isFile(f)) f.content = "side wrote this\n";
    execute(s, "git add readme.md");
    execute(s, "git commit -m side-edit");
    execute(s, "git switch main");
    const r = execute(s, "git merge side");
    expect(r.stdout).toMatch(/Fast-forward/);
    const merged = walk(s.root, "/home/traveler/project/readme.md");
    if (isFile(merged)) expect(merged.content).toBe("side wrote this\n");
  });

  it("already up to date when merging same commit", () => {
    expect(execute(s, "git merge main").stdout).toMatch(/Already up to date/);
  });
});
