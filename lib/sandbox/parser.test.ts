import { describe, it, expect } from "vitest";
import { parse, parseArgs } from "./parser";

function ok(input: string) {
  const r = parse(input);
  if (r.type === "error") throw new Error("expected ok, got error: " + r.message);
  return r;
}

function err(input: string) {
  const r = parse(input);
  if (r.type !== "error") throw new Error("expected error, got: " + JSON.stringify(r));
  return r;
}

describe("parser — basics", () => {
  it("parses an empty input", () => {
    const r = ok("");
    expect(r.steps).toEqual([]);
  });

  it("parses a single command", () => {
    const r = ok("ls");
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].pipeline.commands[0].args).toEqual(["ls"]);
  });

  it("parses multi-arg command", () => {
    const r = ok("ls -la /etc");
    expect(r.steps[0].pipeline.commands[0].args).toEqual(["ls", "-la", "/etc"]);
  });

  it("handles trailing whitespace", () => {
    const r = ok("  pwd   ");
    expect(r.steps[0].pipeline.commands[0].args).toEqual(["pwd"]);
  });
});

describe("parser — quoting + escapes", () => {
  it("single quotes preserve spaces", () => {
    const r = ok("echo 'hello world'");
    expect(r.steps[0].pipeline.commands[0].args).toEqual(["echo", "hello world"]);
  });

  it("double quotes preserve spaces and process escapes", () => {
    const r = ok('echo "say \\"hi\\""');
    expect(r.steps[0].pipeline.commands[0].args).toEqual(["echo", 'say "hi"']);
  });

  it("backslash escapes a space outside quotes", () => {
    const r = ok("cat my\\ file.txt");
    expect(r.steps[0].pipeline.commands[0].args).toEqual(["cat", "my file.txt"]);
  });

  it("preserves glob characters as literals (executor expands)", () => {
    const r = ok("rm *.log");
    expect(r.steps[0].pipeline.commands[0].args).toEqual(["rm", "*.log"]);
  });

  it("errors on unclosed quote", () => {
    expect(err("echo 'unclosed").message).toMatch(/unclosed/);
  });
});

describe("parser — pipes", () => {
  it("parses a 2-command pipeline", () => {
    const r = ok("cat foo | grep bar");
    const cmds = r.steps[0].pipeline.commands;
    expect(cmds).toHaveLength(2);
    expect(cmds[0].args).toEqual(["cat", "foo"]);
    expect(cmds[1].args).toEqual(["grep", "bar"]);
  });

  it("parses a 3-command pipeline", () => {
    const r = ok("cat a | grep b | wc -l");
    expect(r.steps[0].pipeline.commands.map((c) => c.args[0])).toEqual([
      "cat",
      "grep",
      "wc",
    ]);
  });
});

describe("parser — redirects", () => {
  it("parses > redirect", () => {
    const r = ok("echo hi > out.txt");
    const c = r.steps[0].pipeline.commands[0];
    expect(c.args).toEqual(["echo", "hi"]);
    expect(c.redirects).toEqual([{ op: ">", target: "out.txt" }]);
  });

  it("parses >> append redirect", () => {
    const r = ok("echo more >> log.txt");
    expect(r.steps[0].pipeline.commands[0].redirects[0]).toEqual({
      op: ">>",
      target: "log.txt",
    });
  });

  it("parses < input redirect", () => {
    const r = ok("wc -l < input.txt");
    expect(r.steps[0].pipeline.commands[0].redirects[0]).toEqual({
      op: "<",
      target: "input.txt",
    });
  });

  it("errors when redirect has no target", () => {
    expect(err("echo hi >").message).toMatch(/missing target/);
  });
});

describe("parser — sequence operators", () => {
  it("parses &&", () => {
    const r = ok("mkdir foo && cd foo");
    expect(r.steps).toHaveLength(2);
    expect(r.steps[0].op).toBe("&&");
  });

  it("parses ||", () => {
    const r = ok("test -f f || touch f");
    expect(r.steps[0].op).toBe("||");
  });

  it("parses ;", () => {
    const r = ok("pwd; ls");
    expect(r.steps[0].op).toBe(";");
  });
});

describe("parser — comments", () => {
  it("strips trailing comment", () => {
    const r = ok("ls -la # show all");
    expect(r.steps[0].pipeline.commands[0].args).toEqual(["ls", "-la"]);
  });
});

describe("parseArgs", () => {
  it("collects short flags from bundled form", () => {
    const p = parseArgs(["-la", "foo"]);
    expect(p.flags.has("l")).toBe(true);
    expect(p.flags.has("a")).toBe(true);
    expect(p.positional).toEqual(["foo"]);
  });

  it("collects long flags with values", () => {
    const p = parseArgs(["--color=auto", "--force"]);
    expect(p.longFlags.get("color")).toBe("auto");
    expect(p.longFlags.get("force")).toBe(true);
  });

  it("treats -- as end of flags", () => {
    const p = parseArgs(["-l", "--", "-not-a-flag"]);
    expect(p.flags.has("l")).toBe(true);
    expect(p.positional).toEqual(["-not-a-flag"]);
  });
});
