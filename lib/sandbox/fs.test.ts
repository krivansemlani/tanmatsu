import { describe, it, expect } from "vitest";
import {
  mkDir,
  mkFile,
  cloneFs,
  resolvePath,
  walk,
  parentOf,
  listDir,
  mkdirP,
  touchFile,
  writeFile,
  unlink,
  rmDir,
  move,
  isDir,
  isFile,
} from "./fs";

function sampleRoot() {
  return mkDir("/", {
    home: mkDir("home", {
      dojo: mkDir("dojo", {
        "readme.md": mkFile("readme.md", "# hi"),
        notes: mkDir("notes", {
          "todo.txt": mkFile("todo.txt", "learn the shell"),
        }),
      }),
    }),
    etc: mkDir("etc", {
      hosts: mkFile("hosts", "127.0.0.1 localhost"),
    }),
  });
}

describe("resolvePath", () => {
  it("treats absolute paths as-is", () => {
    expect(resolvePath("/home/dojo", "/etc/hosts")).toBe("/etc/hosts");
  });
  it("joins relative paths against cwd", () => {
    expect(resolvePath("/home/dojo", "notes")).toBe("/home/dojo/notes");
  });
  it("expands ~", () => {
    expect(resolvePath("/etc", "~")).toBe("/home/traveler");
    expect(resolvePath("/etc", "~/notes")).toBe("/home/traveler/notes");
  });
  it("normalizes . and ..", () => {
    expect(resolvePath("/home/dojo", "../../etc")).toBe("/etc");
    expect(resolvePath("/home/dojo", "../etc")).toBe("/home/etc");
    expect(resolvePath("/home/dojo", "./notes/./..")).toBe("/home/dojo");
    expect(resolvePath("/", "..")).toBe("/");
  });
});

describe("walk + parentOf", () => {
  it("walks to a nested file", () => {
    const r = sampleRoot();
    const n = walk(r, "/home/dojo/readme.md");
    expect(isFile(n)).toBe(true);
    if (isFile(n)) expect(n.content).toBe("# hi");
  });
  it("returns null for missing paths", () => {
    expect(walk(sampleRoot(), "/nope")).toBeNull();
  });
  it("returns the parent dir and final segment", () => {
    const r = sampleRoot();
    const { parent, name } = parentOf(r, "/home/dojo/readme.md");
    expect(isDir(parent)).toBe(true);
    expect(name).toBe("readme.md");
  });
});

describe("listDir", () => {
  it("lists children sorted alphabetically", () => {
    const r = sampleRoot();
    const dojo = walk(r, "/home/dojo");
    expect(isDir(dojo)).toBe(true);
    if (isDir(dojo)) expect(listDir(dojo)).toEqual(["notes", "readme.md"]);
  });
});

describe("mkdirP", () => {
  it("creates a single dir", () => {
    const r = sampleRoot();
    expect(mkdirP(r, "/home/dojo/projects", false).ok).toBe(true);
    expect(isDir(walk(r, "/home/dojo/projects"))).toBe(true);
  });
  it("fails without -p when parent doesn't exist", () => {
    const r = sampleRoot();
    const res = mkdirP(r, "/home/dojo/a/b/c", false);
    expect(res.ok).toBe(false);
  });
  it("creates intermediates with -p", () => {
    const r = sampleRoot();
    expect(mkdirP(r, "/home/dojo/a/b/c", true).ok).toBe(true);
    expect(isDir(walk(r, "/home/dojo/a/b/c"))).toBe(true);
  });
  it("succeeds if dir already exists with -p", () => {
    const r = sampleRoot();
    expect(mkdirP(r, "/home/dojo/notes", true).ok).toBe(true);
  });
});

describe("touchFile + writeFile", () => {
  it("creates empty file", () => {
    const r = sampleRoot();
    expect(touchFile(r, "/home/dojo/empty.txt").ok).toBe(true);
    const f = walk(r, "/home/dojo/empty.txt");
    expect(isFile(f)).toBe(true);
    if (isFile(f)) expect(f.content).toBe("");
  });
  it("write replaces content", () => {
    const r = sampleRoot();
    expect(writeFile(r, "/home/dojo/readme.md", "new").ok).toBe(true);
    const f = walk(r, "/home/dojo/readme.md");
    if (isFile(f)) expect(f.content).toBe("new");
  });
  it("append concatenates", () => {
    const r = sampleRoot();
    writeFile(r, "/home/dojo/readme.md", "\nmore", true);
    const f = walk(r, "/home/dojo/readme.md");
    if (isFile(f)) expect(f.content).toBe("# hi\nmore");
  });
});

describe("unlink + rmDir", () => {
  it("unlinks a file", () => {
    const r = sampleRoot();
    expect(unlink(r, "/home/dojo/readme.md").ok).toBe(true);
    expect(walk(r, "/home/dojo/readme.md")).toBeNull();
  });
  it("refuses to unlink a directory", () => {
    const r = sampleRoot();
    expect(unlink(r, "/home/dojo/notes").ok).toBe(false);
  });
  it("rmdir non-empty without -r fails", () => {
    const r = sampleRoot();
    expect(rmDir(r, "/home/dojo/notes", false).ok).toBe(false);
  });
  it("rmdir -r succeeds", () => {
    const r = sampleRoot();
    expect(rmDir(r, "/home/dojo/notes", true).ok).toBe(true);
    expect(walk(r, "/home/dojo/notes")).toBeNull();
  });
});

describe("move", () => {
  it("renames a file in place", () => {
    const r = sampleRoot();
    expect(move(r, "/home/dojo/readme.md", "/home/dojo/README.md").ok).toBe(true);
    expect(walk(r, "/home/dojo/readme.md")).toBeNull();
    expect(isFile(walk(r, "/home/dojo/README.md"))).toBe(true);
  });
  it("moves into an existing directory", () => {
    const r = sampleRoot();
    expect(move(r, "/home/dojo/readme.md", "/home/dojo/notes").ok).toBe(true);
    expect(isFile(walk(r, "/home/dojo/notes/readme.md"))).toBe(true);
  });
});

describe("cloneFs", () => {
  it("returns an independent tree", () => {
    const r = sampleRoot();
    const clone = cloneFs(r);
    writeFile(clone, "/home/dojo/readme.md", "MUTATED");
    const original = walk(r, "/home/dojo/readme.md");
    if (isFile(original)) expect(original.content).toBe("# hi");
  });
});
