// A minimal but real git implementation, living entirely inside the virtual
// filesystem. Storage: .git/HEAD, .git/index, .git/refs/heads/<branch>,
// .git/objects/<hash>. Objects come in three flavors: blob, tree, commit.
//
// Implemented: init, status, add, commit, log, diff, branch, switch,
// merge (fast-forward + simple recursive for non-conflicting trees).

import {
  type DirNode,
  type FileNode,
  type FsNode,
  isDir,
  isFile,
  listDir,
  mkDir,
  mkFile,
  resolvePath,
  walk,
} from "./fs";

// --- Types -----------------------------------------------------------------

export type GitBlob = { type: "blob"; content: string };
export type GitTreeEntry = { name: string; hash: string; kind: "blob" | "tree" };
export type GitTree = { type: "tree"; entries: GitTreeEntry[] };
export type GitCommit = {
  type: "commit";
  tree: string;
  parent?: string;
  message: string;
  author: string;
  time: number;
};
export type GitObject = GitBlob | GitTree | GitCommit;

export type GitIndex = Record<string, { hash: string }>;

// --- Hashing ---------------------------------------------------------------

/** Deterministic, git-flavored 7-char hex hash. Not cryptographic. */
export function gitHash(content: string): string {
  // djb2 variant with one extra mix step for better short-hash distribution
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h + content.charCodeAt(i)) | 0;
  }
  // mix once more to spread bits
  h = (h ^ (h >>> 16)) * 0x85ebca6b;
  h = (h ^ (h >>> 13)) | 0;
  return ((h >>> 0).toString(16) + "0000000").slice(0, 7);
}

// --- Path helpers ----------------------------------------------------------

/** Find the .git directory for the current shell — for now, expect it at cwd. */
function gitDirOf(root: DirNode, cwd: string): DirNode | null {
  // Walk up the cwd chain looking for .git
  const parts = cwd.split("/").filter(Boolean);
  while (parts.length >= 0) {
    const path = "/" + parts.join("/");
    const node = walk(root, path);
    if (isDir(node)) {
      const dot = node.children[".git"];
      if (isDir(dot)) return dot;
    }
    if (parts.length === 0) break;
    parts.pop();
  }
  return null;
}

/** The repo working-tree root (the dir that contains .git). */
function repoRootOf(root: DirNode, cwd: string): { dir: DirNode; path: string } | null {
  const parts = cwd.split("/").filter(Boolean);
  while (parts.length >= 0) {
    const path = "/" + parts.join("/");
    const node = walk(root, path);
    if (isDir(node) && isDir(node.children[".git"])) {
      return { dir: node, path };
    }
    if (parts.length === 0) break;
    parts.pop();
  }
  return null;
}

// --- .git file IO ----------------------------------------------------------

function readGitFile(gitDir: DirNode, relPath: string): string | null {
  const parts = relPath.split("/").filter(Boolean);
  let cur: FsNode = gitDir;
  for (const p of parts) {
    if (!isDir(cur)) return null;
    const entry: FsNode | undefined = cur.children[p];
    if (!entry) return null;
    cur = entry;
  }
  return isFile(cur) ? cur.content : null;
}

function writeGitFile(gitDir: DirNode, relPath: string, content: string): void {
  const parts = relPath.split("/").filter(Boolean);
  let cur: DirNode = gitDir;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    let next = cur.children[p];
    if (!isDir(next)) {
      const fresh = mkDir(p);
      cur.children[p] = fresh;
      next = fresh;
    }
    cur = next as DirNode;
  }
  const name = parts[parts.length - 1];
  cur.children[name] = mkFile(name, content);
}

function deleteGitFile(gitDir: DirNode, relPath: string): void {
  const parts = relPath.split("/").filter(Boolean);
  if (parts.length === 0) return;
  let cur: DirNode = gitDir;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur.children[parts[i]];
    if (!isDir(next)) return;
    cur = next;
  }
  delete cur.children[parts[parts.length - 1]];
}

// --- Object database -------------------------------------------------------

function storeObject(gitDir: DirNode, obj: GitObject): string {
  const serialized = JSON.stringify(obj);
  // Blobs hash by raw content (like real git); trees/commits by serialized form.
  const hash = obj.type === "blob" ? gitHash(obj.content) : gitHash(serialized);
  writeGitFile(gitDir, `objects/${hash}`, serialized);
  return hash;
}

function readObject(gitDir: DirNode, hash: string): GitObject | null {
  const raw = readGitFile(gitDir, `objects/${hash}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GitObject;
  } catch {
    return null;
  }
}

// --- HEAD + refs -----------------------------------------------------------

export function readHead(gitDir: DirNode): { branch?: string; commit?: string } {
  const head = (readGitFile(gitDir, "HEAD") || "").trim();
  if (!head) return {};
  if (head.startsWith("ref: ")) {
    const ref = head.slice(5).trim();
    const branch = ref.replace(/^refs\/heads\//, "");
    const commit = (readGitFile(gitDir, ref) || "").trim() || undefined;
    return { branch, commit };
  }
  return { commit: head };
}

function setHeadToBranch(gitDir: DirNode, branch: string): void {
  writeGitFile(gitDir, "HEAD", `ref: refs/heads/${branch}\n`);
}

function setBranchTo(gitDir: DirNode, branch: string, commitHash: string): void {
  writeGitFile(gitDir, `refs/heads/${branch}`, commitHash + "\n");
}

function listBranches(gitDir: DirNode): string[] {
  const refs = walk(gitDir, "/refs/heads");
  // walk returns relative to gitDir as if gitDir were the root, but our
  // helper treats gitDir as a free-floating DirNode. Walk by hand:
  const heads = gitDir.children.refs;
  if (!isDir(heads)) return [];
  const headsDir = heads.children.heads;
  if (!isDir(headsDir)) return [];
  // suppress unused
  void refs;
  return listDir(headsDir);
}

// --- Index (staging area) --------------------------------------------------

function readIndex(gitDir: DirNode): GitIndex {
  const raw = readGitFile(gitDir, "index");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as GitIndex;
  } catch {
    return {};
  }
}

function writeIndex(gitDir: DirNode, idx: GitIndex): void {
  writeGitFile(gitDir, "index", JSON.stringify(idx, null, 2));
}

// --- Working tree helpers --------------------------------------------------

/** Walk the working tree (under repoRoot), returning {relPath: content}. Skips .git/. */
function walkWorkingTree(repoRoot: DirNode): Map<string, string> {
  const out = new Map<string, string>();
  function recur(dir: DirNode, prefix: string) {
    for (const name of Object.keys(dir.children)) {
      if (name === ".git") continue;
      const node = dir.children[name];
      const rel = prefix ? `${prefix}/${name}` : name;
      if (isFile(node)) out.set(rel, node.content);
      else if (isDir(node)) recur(node, rel);
    }
  }
  recur(repoRoot, "");
  return out;
}

/** Read the tree object recursively into a {relPath: blobHash} map. */
function expandTree(
  gitDir: DirNode,
  treeHash: string,
  prefix = ""
): Map<string, string> {
  const out = new Map<string, string>();
  const tree = readObject(gitDir, treeHash);
  if (!tree || tree.type !== "tree") return out;
  for (const e of tree.entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.kind === "blob") out.set(rel, e.hash);
    else {
      const inner = expandTree(gitDir, e.hash, rel);
      inner.forEach((v, k) => out.set(k, v));
    }
  }
  return out;
}

/** Build a tree object from the index (flat path -> hash). */
function buildTreeFromIndex(gitDir: DirNode, index: GitIndex): string {
  // group entries by top-level directory
  type Group = {
    blobs: Array<{ name: string; hash: string }>;
    subdirs: Record<string, GitIndex>;
  };

  function build(entries: GitIndex): string {
    const group: Group = { blobs: [], subdirs: {} };
    for (const path of Object.keys(entries)) {
      const sep = path.indexOf("/");
      if (sep < 0) {
        group.blobs.push({ name: path, hash: entries[path].hash });
      } else {
        const head = path.slice(0, sep);
        const rest = path.slice(sep + 1);
        group.subdirs[head] = group.subdirs[head] || {};
        group.subdirs[head][rest] = entries[path];
      }
    }
    const treeEntries: GitTreeEntry[] = [
      ...group.blobs.map(
        (b) => ({ name: b.name, hash: b.hash, kind: "blob" as const })
      ),
      ...Object.entries(group.subdirs).map(([name, sub]) => ({
        name,
        hash: build(sub),
        kind: "tree" as const,
      })),
    ];
    treeEntries.sort((a, b) => (a.name < b.name ? -1 : 1));
    return storeObject(gitDir, { type: "tree", entries: treeEntries });
  }

  return build(index);
}

/** Apply a tree to the working tree: overwrite/create matching files, remove what's not in tree. */
function checkoutTree(
  repoRoot: DirNode,
  gitDir: DirNode,
  treeHash: string
): void {
  const desired = expandTree(gitDir, treeHash);
  const current = walkWorkingTree(repoRoot);

  // delete files not in desired
  for (const path of current.keys()) {
    if (!desired.has(path)) {
      // remove from repoRoot
      const parts = path.split("/");
      let parent: DirNode = repoRoot;
      for (let i = 0; i < parts.length - 1; i++) {
        const n = parent.children[parts[i]];
        if (!isDir(n)) break;
        parent = n;
      }
      delete parent.children[parts[parts.length - 1]];
    }
  }

  // write desired files
  for (const [path, blobHash] of desired) {
    const blob = readObject(gitDir, blobHash);
    if (!blob || blob.type !== "blob") continue;
    const parts = path.split("/");
    let parent: DirNode = repoRoot;
    for (let i = 0; i < parts.length - 1; i++) {
      let n = parent.children[parts[i]];
      if (!isDir(n)) {
        const fresh = mkDir(parts[i]);
        parent.children[parts[i]] = fresh;
        n = fresh;
      }
      parent = n as DirNode;
    }
    const fname = parts[parts.length - 1];
    const existing = parent.children[fname];
    if (isFile(existing)) {
      existing.content = blob.content;
    } else {
      parent.children[fname] = mkFile(fname, blob.content);
    }
  }
}

/** Walk parents of a commit. Returns hashes oldest-last. */
function commitAncestry(gitDir: DirNode, head: string): string[] {
  const out: string[] = [];
  let cur: string | undefined = head;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    const c = readObject(gitDir, cur);
    if (!c || c.type !== "commit") break;
    cur = c.parent;
  }
  return out;
}

// --- Operations ------------------------------------------------------------

export type GitResult = { stdout: string; stderr: string; exitCode: number };

const ok = (stdout = ""): GitResult => ({ stdout, stderr: "", exitCode: 0 });
const fail = (message: string, code = 1): GitResult => ({
  stdout: "",
  stderr: message,
  exitCode: code,
});

export function gitInit(root: DirNode, cwd: string): GitResult {
  const cwdNode = walk(root, cwd);
  if (!isDir(cwdNode)) return fail(`fatal: ${cwd} is not a directory`);
  if (isDir(cwdNode.children[".git"])) {
    return ok(`Reinitialized existing Git repository in ${cwd}/.git/`);
  }
  cwdNode.children[".git"] = mkDir(".git", {
    HEAD: mkFile("HEAD", "ref: refs/heads/main\n"),
    index: mkFile("index", "{}\n"),
    refs: mkDir("refs", { heads: mkDir("heads") }),
    objects: mkDir("objects"),
  });
  return ok(`Initialized empty Git repository in ${cwd}/.git/\n`);
}

function notARepo(): GitResult {
  return fail("fatal: not a git repository (or any of the parent directories): .git\n");
}

export function gitStatus(root: DirNode, cwd: string): GitResult {
  const gitDir = gitDirOf(root, cwd);
  const repo = repoRootOf(root, cwd);
  if (!gitDir || !repo) return notARepo();

  const head = readHead(gitDir);
  const index = readIndex(gitDir);
  const working = walkWorkingTree(repo.dir);

  // What's in HEAD?
  const headTree = head.commit
    ? (() => {
        const c = readObject(gitDir, head.commit);
        if (c && c.type === "commit") return expandTree(gitDir, c.tree);
        return new Map<string, string>();
      })()
    : new Map<string, string>();

  // Categorize each working-tree file
  const staged: string[] = [];
  const modified: string[] = [];
  const untracked: string[] = [];

  for (const path of working.keys()) {
    const workContent = working.get(path)!;
    const workHash = gitHash(workContent);
    const indexEntry = index[path];
    const headBlobHash = headTree.get(path);

    if (!indexEntry && !headBlobHash) {
      untracked.push(path);
    } else if (indexEntry && indexEntry.hash === workHash && headBlobHash !== workHash) {
      staged.push(path);
    } else if (indexEntry && indexEntry.hash !== workHash) {
      modified.push(path);
    } else if (!indexEntry && headBlobHash && headBlobHash !== workHash) {
      modified.push(path);
    }
  }

  // Files in index that match HEAD: nothing to show
  // Files in HEAD missing from working tree: deleted (omit for v1)

  const lines: string[] = [];
  lines.push(`On branch ${head.branch || "main"}`);
  if (!head.commit) {
    lines.push("");
    lines.push("No commits yet");
  }
  if (staged.length > 0) {
    lines.push("");
    lines.push("Changes to be committed:");
    for (const p of staged.sort()) lines.push(`  new file:   ${p}`);
  }
  if (modified.length > 0) {
    lines.push("");
    lines.push("Changes not staged for commit:");
    for (const p of modified.sort()) lines.push(`  modified:   ${p}`);
  }
  if (untracked.length > 0) {
    lines.push("");
    lines.push("Untracked files:");
    for (const p of untracked.sort()) lines.push(`  ${p}`);
  }
  if (staged.length === 0 && modified.length === 0 && untracked.length === 0) {
    lines.push("");
    lines.push("nothing to commit, working tree clean");
  }

  return ok(lines.join("\n") + "\n");
}

export function gitAdd(root: DirNode, cwd: string, paths: string[]): GitResult {
  const gitDir = gitDirOf(root, cwd);
  const repo = repoRootOf(root, cwd);
  if (!gitDir || !repo) return notARepo();
  if (paths.length === 0) return fail("Nothing specified, nothing added.\n");

  const working = walkWorkingTree(repo.dir);
  const index = readIndex(gitDir);
  let added = 0;

  for (const arg of paths) {
    // resolve relative to cwd, then strip repo prefix
    const abs = resolvePath(cwd, arg);
    const rel = abs.startsWith(repo.path + "/")
      ? abs.slice(repo.path.length + 1)
      : abs.startsWith(repo.path)
        ? abs.slice(repo.path.length).replace(/^\//, "")
        : abs;

    if (arg === "." || rel === "" || rel === ".") {
      // add everything
      for (const path of working.keys()) {
        const content = working.get(path)!;
        const hash = gitHash(content);
        storeObject(gitDir, { type: "blob", content });
        index[path] = { hash };
        added++;
      }
      continue;
    }

    if (working.has(rel)) {
      const content = working.get(rel)!;
      const hash = gitHash(content);
      storeObject(gitDir, { type: "blob", content });
      index[rel] = { hash };
      added++;
    } else {
      return fail(
        `fatal: pathspec '${arg}' did not match any files\n`,
        128
      );
    }
  }

  writeIndex(gitDir, index);
  void added;
  return ok("");
}

let GIT_TIME_COUNTER = 1700000000; // pseudo-timestamp counter, deterministic per run

export function gitCommit(
  root: DirNode,
  cwd: string,
  rawArgs: string[]
): GitResult {
  const gitDir = gitDirOf(root, cwd);
  if (!gitDir) return notARepo();

  let message = "";
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === "-m" && rawArgs[i + 1] !== undefined) {
      message = rawArgs[i + 1];
      break;
    }
  }
  if (!message) return fail("error: commit message is required (use -m)\n");

  const index = readIndex(gitDir);
  if (Object.keys(index).length === 0) {
    return fail("nothing to commit\n");
  }

  const head = readHead(gitDir);
  const treeHash = buildTreeFromIndex(gitDir, index);

  // skip empty commits — tree unchanged from parent
  if (head.commit) {
    const parent = readObject(gitDir, head.commit);
    if (parent && parent.type === "commit" && parent.tree === treeHash) {
      return fail(
        `On branch ${head.branch || "main"}\nnothing to commit, working tree clean\n`
      );
    }
  }

  const commit: GitCommit = {
    type: "commit",
    tree: treeHash,
    parent: head.commit,
    message,
    author: "traveler",
    time: ++GIT_TIME_COUNTER,
  };
  const commitHash = storeObject(gitDir, commit);
  const branch = head.branch || "main";
  setBranchTo(gitDir, branch, commitHash);

  const short = commitHash.slice(0, 7);
  return ok(`[${branch} ${short}] ${message}\n`);
}

export function gitLog(root: DirNode, cwd: string): GitResult {
  const gitDir = gitDirOf(root, cwd);
  if (!gitDir) return notARepo();
  const head = readHead(gitDir);
  if (!head.commit) return ok("");
  const lines: string[] = [];
  const ancestry = commitAncestry(gitDir, head.commit);
  for (const hash of ancestry) {
    const c = readObject(gitDir, hash);
    if (!c || c.type !== "commit") continue;
    lines.push(`commit ${hash}`);
    lines.push(`Author: ${c.author}`);
    lines.push(`Date:   ${c.time}`);
    lines.push("");
    lines.push(`    ${c.message}`);
    lines.push("");
  }
  return ok(lines.join("\n"));
}

export function gitDiff(root: DirNode, cwd: string): GitResult {
  const gitDir = gitDirOf(root, cwd);
  const repo = repoRootOf(root, cwd);
  if (!gitDir || !repo) return notARepo();

  const head = readHead(gitDir);
  const headTree = head.commit
    ? (() => {
        const c = readObject(gitDir, head.commit);
        if (c && c.type === "commit") return expandTree(gitDir, c.tree);
        return new Map<string, string>();
      })()
    : new Map<string, string>();

  const working = walkWorkingTree(repo.dir);
  const lines: string[] = [];

  for (const [path, content] of working) {
    const workHash = gitHash(content);
    const headHash = headTree.get(path);
    if (headHash === workHash) continue;
    lines.push(`diff --git a/${path} b/${path}`);
    if (headHash) {
      const headBlob = readObject(gitDir, headHash);
      const oldContent = headBlob && headBlob.type === "blob" ? headBlob.content : "";
      lines.push(`--- a/${path}`);
      lines.push(`+++ b/${path}`);
      lines.push(...simpleDiff(oldContent, content));
    } else {
      lines.push("new file mode 100644");
      lines.push(`--- /dev/null`);
      lines.push(`+++ b/${path}`);
      for (const l of content.split("\n")) lines.push(`+${l}`);
    }
  }

  if (lines.length === 0) return ok("");
  return ok(lines.join("\n") + "\n");
}

function simpleDiff(oldStr: string, newStr: string): string[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const out: string[] = [];
  // line-by-line — not a real myers diff, but good enough for the levels
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    if (oldLines[i] === newLines[i]) {
      if (oldLines[i] !== undefined) out.push(` ${oldLines[i]}`);
    } else {
      if (oldLines[i] !== undefined) out.push(`-${oldLines[i]}`);
      if (newLines[i] !== undefined) out.push(`+${newLines[i]}`);
    }
  }
  return out;
}

export function gitBranch(
  root: DirNode,
  cwd: string,
  rawArgs: string[]
): GitResult {
  const gitDir = gitDirOf(root, cwd);
  if (!gitDir) return notARepo();
  const head = readHead(gitDir);
  const branches = listBranches(gitDir);

  if (rawArgs.length === 0) {
    if (branches.length === 0) return ok("");
    const lines = branches.sort().map((b) => (b === head.branch ? `* ${b}` : `  ${b}`));
    return ok(lines.join("\n") + "\n");
  }

  // git branch <name>
  const name = rawArgs[0];
  if (!head.commit) return fail("fatal: Not a valid object name: 'HEAD'\n");
  setBranchTo(gitDir, name, head.commit);
  return ok("");
}

export function gitSwitch(
  root: DirNode,
  cwd: string,
  rawArgs: string[]
): GitResult {
  const gitDir = gitDirOf(root, cwd);
  const repo = repoRootOf(root, cwd);
  if (!gitDir || !repo) return notARepo();

  let createNew = false;
  const positional: string[] = [];
  for (const a of rawArgs) {
    if (a === "-c") createNew = true;
    else positional.push(a);
  }
  const name = positional[0];
  if (!name) return fail("usage: git switch [-c] <branch>\n");

  const head = readHead(gitDir);
  if (createNew) {
    if (!head.commit) return fail("fatal: no commits yet\n");
    setBranchTo(gitDir, name, head.commit);
    setHeadToBranch(gitDir, name);
    return ok(`Switched to a new branch '${name}'\n`);
  }

  const branchCommit = (readGitFile(gitDir, `refs/heads/${name}`) || "").trim();
  if (!branchCommit) return fail(`fatal: invalid reference: ${name}\n`);

  // Check for uncommitted changes — error if dirty
  const working = walkWorkingTree(repo.dir);
  const index = readIndex(gitDir);
  const headTree = head.commit
    ? (() => {
        const c = readObject(gitDir, head.commit);
        if (c && c.type === "commit") return expandTree(gitDir, c.tree);
        return new Map<string, string>();
      })()
    : new Map<string, string>();

  for (const [path, content] of working) {
    const workHash = gitHash(content);
    if (index[path] && index[path].hash !== workHash) {
      return fail(
        `error: Your local changes to '${path}' would be overwritten by switch. Commit first.\n`
      );
    }
    if (!index[path] && headTree.get(path) !== workHash && !headTree.has(path)) {
      return fail(
        `error: untracked working file '${path}' would be overwritten by switch.\n`
      );
    }
  }

  // Materialize the target branch's tree
  const targetCommit = readObject(gitDir, branchCommit);
  if (!targetCommit || targetCommit.type !== "commit") {
    return fail(`fatal: bad commit ${branchCommit}\n`);
  }
  checkoutTree(repo.dir, gitDir, targetCommit.tree);
  // reset index to the new HEAD tree
  const fresh: GitIndex = {};
  for (const [path, hash] of expandTree(gitDir, targetCommit.tree)) {
    fresh[path] = { hash };
  }
  writeIndex(gitDir, fresh);
  setHeadToBranch(gitDir, name);

  return ok(`Switched to branch '${name}'\n`);
}

export function gitMerge(
  root: DirNode,
  cwd: string,
  rawArgs: string[]
): GitResult {
  const gitDir = gitDirOf(root, cwd);
  const repo = repoRootOf(root, cwd);
  if (!gitDir || !repo) return notARepo();
  const name = rawArgs[0];
  if (!name) return fail("usage: git merge <branch>\n");

  const head = readHead(gitDir);
  const otherCommit = (readGitFile(gitDir, `refs/heads/${name}`) || "").trim();
  if (!otherCommit) return fail(`merge: ${name} - not something we can merge\n`);
  if (!head.commit) return fail("fatal: no commits on current branch\n");

  if (otherCommit === head.commit) {
    return ok("Already up to date.\n");
  }

  const headAncestry = new Set(commitAncestry(gitDir, head.commit));
  const otherAncestry = commitAncestry(gitDir, otherCommit);

  // Fast-forward case — current HEAD is an ancestor of other
  if (otherAncestry.includes(head.commit)) {
    const otherCommitObj = readObject(gitDir, otherCommit);
    if (otherCommitObj && otherCommitObj.type === "commit") {
      checkoutTree(repo.dir, gitDir, otherCommitObj.tree);
      const fresh: GitIndex = {};
      for (const [path, hash] of expandTree(gitDir, otherCommitObj.tree)) {
        fresh[path] = { hash };
      }
      writeIndex(gitDir, fresh);
      setBranchTo(gitDir, head.branch || "main", otherCommit);
      return ok(`Fast-forward\nUpdating ${head.commit.slice(0, 7)}..${otherCommit.slice(0, 7)}\n`);
    }
  }

  // Other is already merged
  if (headAncestry.has(otherCommit)) {
    return ok("Already up to date.\n");
  }

  // Non-trivial merge — for v1 we try a simple recursive merge of trees
  // where every path is in only one side (no conflicts).
  const baseHash = otherAncestry.find((h) => headAncestry.has(h));
  if (!baseHash) {
    return fail("fatal: refusing to merge unrelated histories\n");
  }

  const base = readObject(gitDir, baseHash);
  const headObj = readObject(gitDir, head.commit);
  const other = readObject(gitDir, otherCommit);
  if (
    !base ||
    base.type !== "commit" ||
    !headObj ||
    headObj.type !== "commit" ||
    !other ||
    other.type !== "commit"
  ) {
    return fail("fatal: merge: malformed objects\n");
  }

  const baseTree = expandTree(gitDir, base.tree);
  const headTree = expandTree(gitDir, headObj.tree);
  const otherTree = expandTree(gitDir, other.tree);

  const merged: GitIndex = {};
  const allPaths = new Set([
    ...baseTree.keys(),
    ...headTree.keys(),
    ...otherTree.keys(),
  ]);
  for (const path of allPaths) {
    const b = baseTree.get(path);
    const h = headTree.get(path);
    const o = otherTree.get(path);
    if (h === o) {
      // both sides equal — keep
      if (h) merged[path] = { hash: h };
      continue;
    }
    if (h === b) {
      // head unchanged — take other
      if (o) merged[path] = { hash: o };
      continue;
    }
    if (o === b) {
      // other unchanged — keep head
      if (h) merged[path] = { hash: h };
      continue;
    }
    // both diverged → conflict
    return fail(
      `CONFLICT (content): Merge conflict in ${path}\nAutomatic merge failed; fix conflicts and commit.\n`
    );
  }

  // Materialize merged tree, build a merge commit
  const mergedTree = buildTreeFromIndexFlat(gitDir, merged);
  const mergeCommit: GitCommit = {
    type: "commit",
    tree: mergedTree,
    parent: head.commit,
    message: `Merge branch '${name}'`,
    author: "traveler",
    time: ++GIT_TIME_COUNTER,
  };
  const mergeHash = storeObject(gitDir, mergeCommit);
  setBranchTo(gitDir, head.branch || "main", mergeHash);
  checkoutTree(repo.dir, gitDir, mergedTree);
  writeIndex(gitDir, merged);

  return ok(`Merge made by the 'recursive' strategy.\n`);
}

function buildTreeFromIndexFlat(gitDir: DirNode, index: GitIndex): string {
  return buildTreeFromIndex(gitDir, index);
}

// Unused export helper — silences linter for FileNode import.
export const _gitTypes = { FileNode: null as unknown as FileNode };
