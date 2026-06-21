// Shell tokenizer + parser. Outputs a small AST the executor walks.
// Supports: quoted args ('...' "..."), \ escapes, pipes |, redirects > >> <,
// logical && ||, sequence ;, and # comments. Defers globs to the executor.

export type Redirect = {
  op: ">" | ">>" | "<";
  target: string;
};

export type Command = {
  type: "command";
  args: string[];
  redirects: Redirect[];
};

export type Pipeline = {
  type: "pipeline";
  commands: Command[];
};

export type SequenceStep = {
  pipeline: Pipeline;
  op?: "&&" | "||" | ";";
};

export type Sequence = {
  type: "sequence";
  steps: SequenceStep[];
};

export type ParseError = { type: "error"; message: string };
export type ParseResult = Sequence | ParseError;

// --- Tokenizer ---

type Token =
  | { kind: "word"; value: string }
  | { kind: "pipe" }
  | { kind: "and" }
  | { kind: "or" }
  | { kind: "semi" }
  | { kind: "gt" }
  | { kind: "gtgt" }
  | { kind: "lt" }
  | { kind: "eof" };

function tokenize(input: string): Token[] | ParseError {
  const tokens: Token[] = [];
  const n = input.length;
  let i = 0;

  while (i < n) {
    const c = input[i];

    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }

    if (c === "#") {
      while (i < n && input[i] !== "\n") i++;
      continue;
    }

    if (c === "|") {
      if (input[i + 1] === "|") {
        tokens.push({ kind: "or" });
        i += 2;
      } else {
        tokens.push({ kind: "pipe" });
        i++;
      }
      continue;
    }
    if (c === "&") {
      if (input[i + 1] === "&") {
        tokens.push({ kind: "and" });
        i += 2;
      } else {
        return { type: "error", message: "unexpected '&'" };
      }
      continue;
    }
    if (c === ";") {
      tokens.push({ kind: "semi" });
      i++;
      continue;
    }
    if (c === ">") {
      if (input[i + 1] === ">") {
        tokens.push({ kind: "gtgt" });
        i += 2;
      } else {
        tokens.push({ kind: "gt" });
        i++;
      }
      continue;
    }
    if (c === "<") {
      tokens.push({ kind: "lt" });
      i++;
      continue;
    }

    const word = readWord(input, i);
    if ("error" in word) return { type: "error", message: word.error };
    tokens.push({ kind: "word", value: word.value });
    i = word.next;
  }

  tokens.push({ kind: "eof" });
  return tokens;
}

function readWord(
  input: string,
  start: number
): { value: string; next: number } | { error: string } {
  let i = start;
  let out = "";
  const n = input.length;

  while (i < n) {
    const c = input[i];
    if (
      c === " " ||
      c === "\t" ||
      c === "\n" ||
      c === "|" ||
      c === "&" ||
      c === ";" ||
      c === ">" ||
      c === "<" ||
      c === "#"
    ) {
      break;
    }

    if (c === "\\") {
      if (i + 1 >= n) return { error: "trailing backslash" };
      out += input[i + 1];
      i += 2;
      continue;
    }

    if (c === "'") {
      i++;
      while (i < n && input[i] !== "'") {
        out += input[i];
        i++;
      }
      if (i >= n) return { error: "unclosed single quote" };
      i++;
      continue;
    }

    if (c === '"') {
      i++;
      while (i < n && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < n) {
          out += input[i + 1];
          i += 2;
          continue;
        }
        out += input[i];
        i++;
      }
      if (i >= n) return { error: "unclosed double quote" };
      i++;
      continue;
    }

    out += c;
    i++;
  }

  return { value: out, next: i };
}

// --- Parser ---

export function parse(input: string): ParseResult {
  const tokens = tokenize(input);
  if (!Array.isArray(tokens)) return tokens;

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseCommand(): Command | ParseError {
    const args: string[] = [];
    const redirects: Redirect[] = [];
    let producedSomething = false;

    while (true) {
      const t = peek();
      if (t.kind === "word") {
        consume();
        args.push(t.value);
        producedSomething = true;
      } else if (t.kind === "gt" || t.kind === "gtgt" || t.kind === "lt") {
        consume();
        const target = peek();
        if (target.kind !== "word") {
          return { type: "error", message: "redirect missing target" };
        }
        consume();
        redirects.push({
          op: t.kind === "gt" ? ">" : t.kind === "gtgt" ? ">>" : "<",
          target: target.value,
        });
        producedSomething = true;
      } else {
        break;
      }
    }

    if (!producedSomething) {
      return { type: "error", message: "empty command" };
    }
    return { type: "command", args, redirects };
  }

  function parsePipeline(): Pipeline | ParseError {
    const commands: Command[] = [];
    const first = parseCommand();
    if ("message" in first) return first;
    commands.push(first);
    while (peek().kind === "pipe") {
      consume();
      const next = parseCommand();
      if ("message" in next) return next;
      commands.push(next);
    }
    return { type: "pipeline", commands };
  }

  const steps: SequenceStep[] = [];
  while (peek().kind !== "eof") {
    const pl = parsePipeline();
    if ("message" in pl) return pl;
    const next = peek();
    let op: "&&" | "||" | ";" | undefined;
    if (next.kind === "and") {
      op = "&&";
      consume();
    } else if (next.kind === "or") {
      op = "||";
      consume();
    } else if (next.kind === "semi") {
      op = ";";
      consume();
    }
    steps.push({ pipeline: pl, op });
  }

  return { type: "sequence", steps };
}

// --- Flag parsing helper (used by command implementations) ---

export type ParsedArgs = {
  flags: Set<string>;       // {'l', 'a'} from -la or -l -a
  longFlags: Map<string, string | true>;  // --color=auto → "auto"; --force → true
  positional: string[];
};

export function parseArgs(args: string[]): ParsedArgs {
  const flags = new Set<string>();
  const longFlags = new Map<string, string | true>();
  const positional: string[] = [];
  let endOfFlags = false;

  for (const arg of args) {
    if (endOfFlags) {
      positional.push(arg);
      continue;
    }
    if (arg === "--") {
      endOfFlags = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq >= 0) longFlags.set(arg.slice(2, eq), arg.slice(eq + 1));
      else longFlags.set(arg.slice(2), true);
      continue;
    }
    if (arg.startsWith("-") && arg.length > 1) {
      for (const ch of arg.slice(1)) flags.add(ch);
      continue;
    }
    positional.push(arg);
  }
  return { flags, longFlags, positional };
}
