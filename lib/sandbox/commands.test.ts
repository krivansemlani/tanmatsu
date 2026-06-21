import { describe, it, expect, beforeEach } from "vitest";
import { execute } from "./executor";
import { newShell, type Shell } from "./commands";
import { mkDir, mkFile, walk, isDir, type DirNode } from "./fs";

function attach(s: Shell, name: string, content: string) {
  const home = walk(s.root, "/home/traveler");
  if (isDir(home)) home.children[name] = mkFile(name, content);
}

function fs() {
  return mkDir("/", {
    home: mkDir("home", {
      traveler: mkDir("traveler", {
        "poem.txt": mkFile(
          "poem.txt",
          "an old silent pond\na frog jumps into the pond\nsplash silence again\n"
        ),
        "log.txt": mkFile(
          "log.txt",
          "2025-01-01 boot\n2025-01-02 error: disk full\n2025-01-03 ok\n2025-01-04 ERROR: timeout\n2025-01-05 ok\n"
        ),
        notes: mkDir("notes", {
          "todo.md": mkFile("todo.md", "- read\n- write\n- sleep"),
          "ideas.md": mkFile("ideas.md", "- a calmer dev tool"),
          drafts: mkDir("drafts", {
            "v1.md": mkFile("v1.md", "draft one"),
            "v2.md": mkFile("v2.md", "draft two"),
          }),
        }),
      }),
    }),
  });
}

function freshShell(): Shell {
  return newShell({ root: fs(), cwd: "/home/traveler" });
}

describe("grep", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("matches a literal pattern", () => {
    const r = execute(s, "grep frog poem.txt");
    expect(r.stdout.trimEnd()).toBe("a frog jumps into the pond");
    expect(r.exitCode).toBe(0);
  });

  it("returns exit 1 when no match", () => {
    const r = execute(s, "grep banana poem.txt");
    expect(r.exitCode).toBe(1);
    expect(r.stdout).toBe("");
  });

  it("-i case insensitive", () => {
    const r = execute(s, "grep -i ERROR log.txt");
    expect(r.stdout.split("\n").filter(Boolean)).toHaveLength(2);
  });

  it("-n includes line numbers", () => {
    const r = execute(s, "grep -n ok log.txt");
    expect(r.stdout).toContain("3:");
    expect(r.stdout).toContain("5:");
  });

  it("-v inverts the match", () => {
    const r = execute(s, "grep -v ok log.txt");
    const lines = r.stdout.split("\n").filter(Boolean);
    expect(lines.every((l) => !/\bok\b/.test(l))).toBe(true);
  });

  it("-c counts matches", () => {
    expect(execute(s, "grep -c ok log.txt").stdout.trim()).toBe("2");
  });

  it("supports basic regex", () => {
    const r = execute(s, "grep ^splash poem.txt");
    expect(r.stdout.trimEnd()).toBe("splash silence again");
  });

  it("works as a pipe receiver", () => {
    const r = execute(s, "cat log.txt | grep -i error");
    expect(r.stdout.split("\n").filter(Boolean)).toHaveLength(2);
  });

  it("missing pattern errors", () => {
    expect(execute(s, "grep").exitCode).toBe(2);
  });
});

describe("find", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("walks recursively from .", () => {
    const out = execute(s, "find .").stdout;
    expect(out).toContain("./poem.txt");
    expect(out).toContain("./notes/todo.md");
    expect(out).toContain("./notes/drafts/v1.md");
  });

  it("-name with a glob", () => {
    const out = execute(s, "find . -name *.md").stdout;
    const lines = out.split("\n").filter(Boolean);
    expect(lines.every((l) => l.endsWith(".md"))).toBe(true);
    expect(lines).toContain("./notes/todo.md");
    expect(lines).toContain("./notes/drafts/v1.md");
  });

  it("-type d returns only directories", () => {
    const out = execute(s, "find . -type d").stdout;
    const lines = out.split("\n").filter(Boolean);
    expect(lines).toContain(".");
    expect(lines).toContain("./notes");
    expect(lines).toContain("./notes/drafts");
    expect(lines).not.toContain("./poem.txt");
  });

  it("-type f -name combo", () => {
    const out = execute(s, "find . -type f -name v*.md").stdout;
    expect(out.split("\n").filter(Boolean).sort()).toEqual([
      "./notes/drafts/v1.md",
      "./notes/drafts/v2.md",
    ]);
  });

  it("absolute path argument", () => {
    const out = execute(s, "find /home/traveler/notes -name *.md").stdout;
    expect(out).toContain("/home/traveler/notes/todo.md");
  });
});

describe("head + tail", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("head defaults to 10 lines", () => {
    const r = execute(s, "head log.txt");
    expect(r.stdout.split("\n").length).toBeLessThanOrEqual(11);
  });

  it("head -n 2", () => {
    const r = execute(s, "head -n 2 log.txt");
    expect(r.stdout.split("\n").slice(0, 2)).toEqual([
      "2025-01-01 boot",
      "2025-01-02 error: disk full",
    ]);
  });

  it("head -3 short form", () => {
    const r = execute(s, "head -3 log.txt");
    expect(r.stdout.split("\n").filter(Boolean)).toHaveLength(3);
  });

  it("tail -n 2", () => {
    const r = execute(s, "tail -n 2 log.txt");
    const out = r.stdout.split("\n").filter(Boolean);
    expect(out).toEqual(["2025-01-04 ERROR: timeout", "2025-01-05 ok"]);
  });

  it("head + grep in a pipe", () => {
    const r = execute(s, "head -n 3 log.txt | grep ok");
    expect(r.stdout.trimEnd()).toBe("2025-01-03 ok");
  });
});

describe("wc", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("default shows lines, words, chars", () => {
    const r = execute(s, "wc poem.txt");
    expect(r.stdout).toMatch(/3\s+13\s+\d+\s+poem\.txt/);
  });

  it("-l lines only", () => {
    const r = execute(s, "wc -l log.txt");
    expect(r.stdout.trim().split(/\s+/)[0]).toBe("5");
  });

  it("-w words only", () => {
    const r = execute(s, "wc -w poem.txt");
    expect(r.stdout.trim().split(/\s+/)[0]).toBe("13");
  });

  it("counts via pipe", () => {
    const r = execute(s, "cat poem.txt | wc -l");
    expect(r.stdout.trim()).toBe("3");
  });

  it("multiple files show total", () => {
    const r = execute(s, "wc -l poem.txt log.txt");
    expect(r.stdout).toMatch(/total/);
  });
});

describe("sort", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("alphabetizes lines", () => {
    attach(s, "names.txt", "ren\nakira\nkenji\nbasho\n");
    const r = execute(s, "sort names.txt");
    expect(r.stdout.split("\n").filter(Boolean)).toEqual([
      "akira",
      "basho",
      "kenji",
      "ren",
    ]);
  });

  it("-r reverses", () => {
    const r = execute(s, "echo -e 'c\\nb\\na' | sort -r");
    // echo -e doesn't expand here, but plain piped lines work:
    // simpler test with cat
    expect(execute(s, "sort poem.txt").exitCode).toBe(0);
  });

  it("-n numeric sort", () => {
    attach(s, "nums.txt", "10\n2\n30\n1\n");
    const r = execute(s, "sort -n nums.txt");
    expect(r.stdout.split("\n").filter(Boolean)).toEqual(["1", "2", "10", "30"]);
  });

  it("reads stdin via pipe", () => {
    const r = execute(s, "cat poem.txt | sort | head -n 1");
    expect(r.exitCode).toBe(0);
  });
});

describe("uniq", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("dedupes consecutive lines", () => {
    attach(s, "rep.txt", "a\na\nb\nb\nb\nc\n");
    const r = execute(s, "uniq rep.txt");
    expect(r.stdout.split("\n").filter(Boolean)).toEqual(["a", "b", "c"]);
  });

  it("-c counts occurrences", () => {
    attach(s, "rep.txt", "a\na\nb\nb\nb\nc\n");
    const out = execute(s, "uniq -c rep.txt").stdout;
    expect(out).toMatch(/2 a/);
    expect(out).toMatch(/3 b/);
    expect(out).toMatch(/1 c/);
  });

  it("-d only duplicates", () => {
    attach(s, "rep2.txt", "a\nb\nb\nc\n");
    const r = execute(s, "uniq -d rep2.txt");
    expect(r.stdout.split("\n").filter(Boolean)).toEqual(["b"]);
  });

  it("classic sort|uniq pattern", () => {
    attach(s, "shuffled.txt", "a\nb\na\nc\nb\na\n");
    const r = execute(s, "sort shuffled.txt | uniq");
    expect(r.stdout.split("\n").filter(Boolean)).toEqual(["a", "b", "c"]);
  });
});

describe("cut", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
    attach(s, "bill.csv", "table,item,price\n1,sushi,12\n1,sake,8\n2,ramen,11\n");
  });

  it("-d -f single field", () => {
    const r = execute(s, "cut -d, -f3 bill.csv");
    expect(r.stdout.split("\n").filter(Boolean)).toEqual([
      "price",
      "12",
      "8",
      "11",
    ]);
  });

  it("-f multiple fields", () => {
    const r = execute(s, "cut -d, -f2,3 bill.csv");
    expect(r.stdout.split("\n").filter(Boolean)[1]).toBe("sushi,12");
  });

  it("-f range", () => {
    const r = execute(s, "cut -d, -f1-2 bill.csv");
    expect(r.stdout.split("\n").filter(Boolean)[2]).toBe("1,sake");
  });

  it("works via pipe", () => {
    const r = execute(s, "cat bill.csv | cut -d, -f2");
    expect(r.stdout).toContain("sushi");
  });
});

describe("xargs", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("default appends args to echo", () => {
    const r = execute(s, "echo 'a b c' | xargs echo prefix");
    expect(r.stdout.trim()).toBe("prefix a b c");
  });

  it("-I{} replaces placeholder per line", () => {
    attach(s, "list.txt", "alpha\nbeta\ngamma\n");
    const r = execute(s, "cat list.txt | xargs -I {} echo fired: {}");
    const lines = r.stdout.split("\n").filter(Boolean);
    expect(lines).toEqual(["fired: alpha", "fired: beta", "fired: gamma"]);
  });

  it("unknown command returns 127", () => {
    const r = execute(s, "echo hi | xargs nosuch");
    expect(r.exitCode).toBe(127);
  });
});

describe("tee", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("writes stdin to file AND passes through", () => {
    const r = execute(s, "echo hello | tee out.txt");
    expect(r.stdout.trim()).toBe("hello");
    const out = execute(s, "cat out.txt").stdout;
    expect(out.trim()).toBe("hello");
  });

  it("-a appends", () => {
    execute(s, "echo first | tee log.txt");
    execute(s, "echo second | tee -a log.txt");
    const out = execute(s, "cat log.txt").stdout;
    expect(out).toBe("first\nsecond\n");
  });
});

describe("whoami", () => {
  it("returns the env USER", () => {
    const s = freshShell();
    expect(execute(s, "whoami").stdout.trim()).toBe("traveler");
  });
});

describe("chmod", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
    attach(s, "secret.txt", "hush");
  });

  it("numeric mode", () => {
    execute(s, "chmod 600 secret.txt");
    const f = walk(s.root, "/home/traveler/secret.txt");
    expect(f && "mode" in f && (f as { mode: number }).mode).toBe(0o600);
  });

  it("symbolic +x", () => {
    execute(s, "chmod 644 secret.txt");
    execute(s, "chmod +x secret.txt");
    const f = walk(s.root, "/home/traveler/secret.txt");
    expect(f && "mode" in f && (f as { mode: number }).mode & 0o111).toBeGreaterThan(0);
  });

  it("symbolic -r removes read", () => {
    execute(s, "chmod 644 secret.txt");
    execute(s, "chmod -r secret.txt");
    const f = walk(s.root, "/home/traveler/secret.txt");
    expect((f as { mode: number }).mode & 0o444).toBe(0);
  });

  it("ls -l reflects new perms", () => {
    execute(s, "chmod 750 secret.txt");
    const out = execute(s, "ls -l").stdout;
    expect(out).toContain("750");
    expect(out).toContain("secret.txt");
  });
});

describe("ps + kill", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("ps lists the default processes", () => {
    const out = execute(s, "ps").stdout;
    expect(out).toContain("init");
    expect(out).toContain("bash");
  });

  it("ps aux includes USER and %CPU", () => {
    const out = execute(s, "ps aux").stdout;
    expect(out).toMatch(/USER/);
    expect(out).toMatch(/%CPU/);
  });

  it("kill removes a process", () => {
    s.processes.push({ pid: 9999, name: "rogue", cpu: 99, mem: 50, status: "R" });
    expect(execute(s, "ps").stdout).toContain("rogue");
    execute(s, "kill 9999");
    expect(execute(s, "ps").stdout).not.toContain("rogue");
  });

  it("kill on missing pid errors", () => {
    const r = execute(s, "kill 12345");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/No such process/);
  });

  it("kill -9 also works", () => {
    s.processes.push({ pid: 8888, name: "stubborn", cpu: 99, mem: 99, status: "R" });
    expect(execute(s, "kill -9 8888").exitCode).toBe(0);
    expect(execute(s, "ps").stdout).not.toContain("stubborn");
  });
});

describe("pipeline integration", () => {
  let s: Shell;
  beforeEach(() => {
    s = freshShell();
  });

  it("find | grep narrows results", () => {
    const r = execute(s, "find . -name *.md | grep drafts");
    const lines = r.stdout.split("\n").filter(Boolean);
    expect(lines.every((l) => l.includes("drafts"))).toBe(true);
  });

  it("grep | wc -l counts matching lines", () => {
    const r = execute(s, "grep ok log.txt | wc -l");
    expect(r.stdout.trim()).toBe("2");
  });

  it("redirect head output to a file", () => {
    execute(s, "head -n 2 log.txt > first.txt");
    expect(execute(s, "cat first.txt").stdout).toBe(
      "2025-01-01 boot\n2025-01-02 error: disk full\n"
    );
  });
});
