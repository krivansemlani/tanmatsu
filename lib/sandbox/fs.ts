// Virtual filesystem for the Terminal Dojo sandbox.
// Tree of nodes, mutated in place — clone before a level if you need to snapshot.

export type FileNode = {
  type: "file";
  name: string;
  content: string;
  mode: number;
  mtime: number;
};

export type DirNode = {
  type: "dir";
  name: string;
  children: Record<string, FsNode>;
  mode: number;
  mtime: number;
};

export type FsNode = FileNode | DirNode;

export const HOME = "/home/traveler";

export const isDir = (n: FsNode | null | undefined): n is DirNode =>
  !!n && n.type === "dir";
export const isFile = (n: FsNode | null | undefined): n is FileNode =>
  !!n && n.type === "file";

export function mkFile(name: string, content = "", mode = 0o644): FileNode {
  return { type: "file", name, content, mode, mtime: 0 };
}

export function mkDir(
  name: string,
  children: Record<string, FsNode> = {},
  mode = 0o755
): DirNode {
  return { type: "dir", name, children, mode, mtime: 0 };
}

/** Deep clone an FsNode — used to snapshot a level's initial state. */
export function cloneFs<T extends FsNode>(node: T): T {
  if (node.type === "file") return { ...node };
  const children: Record<string, FsNode> = {};
  for (const k of Object.keys(node.children)) {
    children[k] = cloneFs(node.children[k]);
  }
  return { ...node, children } as T;
}

/** Resolve a (possibly relative, possibly ~-prefixed) path into a normalized absolute path. */
export function resolvePath(cwd: string, path: string, home = HOME): string {
  let abs: string;
  if (!path) abs = cwd;
  else if (path === "~") abs = home;
  else if (path.startsWith("~/")) abs = home + path.slice(1);
  else if (path.startsWith("/")) abs = path;
  else abs = (cwd.endsWith("/") ? cwd.slice(0, -1) : cwd) + "/" + path;

  // normalize . and ..
  const parts = abs.split("/").filter(Boolean);
  const stack: string[] = [];
  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") {
      stack.pop();
      continue;
    }
    stack.push(p);
  }
  return "/" + stack.join("/");
}

/** Walk to a node, return it or null. */
export function walk(root: DirNode, absPath: string): FsNode | null {
  if (absPath === "/" || absPath === "") return root;
  const parts = absPath.split("/").filter(Boolean);
  let cur: FsNode = root;
  for (const p of parts) {
    if (cur.type !== "dir") return null;
    const child: FsNode | undefined = cur.children[p];
    if (!child) return null;
    cur = child;
  }
  return cur;
}

/** Get the parent directory and the final segment name from an absolute path. */
export function parentOf(
  root: DirNode,
  absPath: string
): { parent: DirNode | null; name: string } {
  const parts = absPath.split("/").filter(Boolean);
  if (parts.length === 0) return { parent: null, name: "" };
  const name = parts[parts.length - 1];
  const parentPath = "/" + parts.slice(0, -1).join("/");
  const parent = walk(root, parentPath);
  return { parent: isDir(parent) ? parent : null, name };
}

export function listDir(node: DirNode): string[] {
  return Object.keys(node.children).sort();
}

// --- Mutating helpers (return ok/error rather than throwing) ---

export type FsResult = { ok: true } | { ok: false; error: string };

export function mkdirP(
  root: DirNode,
  absPath: string,
  recursive: boolean
): FsResult {
  if (absPath === "/" || absPath === "") return { ok: true };
  const parts = absPath.split("/").filter(Boolean);
  let cur: DirNode = root;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;
    const existing = cur.children[part];
    if (existing) {
      if (existing.type !== "dir") {
        return { ok: false, error: `${part}: not a directory` };
      }
      if (isLast && !recursive) {
        return { ok: false, error: `${absPath}: file exists` };
      }
      cur = existing;
    } else {
      if (!isLast && !recursive) {
        return {
          ok: false,
          error: `${"/" + parts.slice(0, i + 1).join("/")}: no such file or directory`,
        };
      }
      const fresh = mkDir(part);
      cur.children[part] = fresh;
      cur = fresh;
    }
  }
  return { ok: true };
}

export function touchFile(root: DirNode, absPath: string): FsResult {
  const { parent, name } = parentOf(root, absPath);
  if (!parent) return { ok: false, error: `${absPath}: cannot create` };
  const existing = parent.children[name];
  if (existing) {
    existing.mtime = existing.mtime + 1;
    return { ok: true };
  }
  parent.children[name] = mkFile(name);
  return { ok: true };
}

export function writeFile(
  root: DirNode,
  absPath: string,
  content: string,
  append = false
): FsResult {
  const { parent, name } = parentOf(root, absPath);
  if (!parent) return { ok: false, error: `${absPath}: cannot write` };
  const existing = parent.children[name];
  if (existing && existing.type === "dir") {
    return { ok: false, error: `${absPath}: is a directory` };
  }
  if (existing && existing.type === "file") {
    existing.content = append ? existing.content + content : content;
    existing.mtime = existing.mtime + 1;
    return { ok: true };
  }
  parent.children[name] = mkFile(name, content);
  return { ok: true };
}

export function unlink(root: DirNode, absPath: string): FsResult {
  const { parent, name } = parentOf(root, absPath);
  if (!parent || !parent.children[name]) {
    return { ok: false, error: `${absPath}: no such file or directory` };
  }
  if (parent.children[name].type === "dir") {
    return { ok: false, error: `${absPath}: is a directory` };
  }
  delete parent.children[name];
  return { ok: true };
}

export function rmRecursive(root: DirNode, absPath: string): FsResult {
  const { parent, name } = parentOf(root, absPath);
  if (!parent || !parent.children[name]) {
    return { ok: false, error: `${absPath}: no such file or directory` };
  }
  delete parent.children[name];
  return { ok: true };
}

export function rmDir(
  root: DirNode,
  absPath: string,
  recursive: boolean
): FsResult {
  const { parent, name } = parentOf(root, absPath);
  if (!parent || !parent.children[name]) {
    return { ok: false, error: `${absPath}: no such file or directory` };
  }
  const node = parent.children[name];
  if (node.type === "dir" && !recursive && Object.keys(node.children).length > 0) {
    return { ok: false, error: `${absPath}: directory not empty` };
  }
  delete parent.children[name];
  return { ok: true };
}

export function move(root: DirNode, srcAbs: string, dstAbs: string): FsResult {
  const srcNode = walk(root, srcAbs);
  if (!srcNode) return { ok: false, error: `${srcAbs}: no such file or directory` };
  const { parent: srcParent, name: srcName } = parentOf(root, srcAbs);
  if (!srcParent) return { ok: false, error: "cannot move root" };

  let dstParent: DirNode | null;
  let dstName: string;
  const dstNode = walk(root, dstAbs);
  if (isDir(dstNode)) {
    dstParent = dstNode;
    dstName = srcName;
    if (dstParent.children[dstName]) {
      return { ok: false, error: `${dstAbs}/${dstName}: already exists` };
    }
  } else {
    const p = parentOf(root, dstAbs);
    if (!p.parent) return { ok: false, error: `${dstAbs}: invalid destination` };
    dstParent = p.parent;
    dstName = p.name;
  }

  delete srcParent.children[srcName];
  srcNode.name = dstName;
  dstParent!.children[dstName] = srcNode;
  return { ok: true };
}
