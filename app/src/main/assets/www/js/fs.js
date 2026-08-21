export function normalizePath(path) {
  if (!path || path === "/") return "/";
  const parts = path.split("/").filter(Boolean);
  return `/${parts.join("/")}`;
}

export function joinPath(base, name) {
  const b = normalizePath(base);
  if (b === "/") return `/${name}`;
  return `${b}/${name}`;
}

export function parentPath(path) {
  const n = normalizePath(path);
  if (n === "/") return "/";
  const i = n.lastIndexOf("/");
  return i <= 0 ? "/" : n.slice(0, i);
}

export function findNode(root, path) {
  const normalized = normalizePath(path);
  if (root.path === normalized) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    if (normalized === child.path) return child;
    const prefix = child.path === "/" ? "/" : `${child.path}/`;
    if (normalized.startsWith(prefix)) {
      const found = findNode(child, normalized);
      if (found) return found;
    }
  }
  return null;
}

export function listDir(root, path) {
  const node = findNode(root, path);
  if (!node || node.kind !== "dir") return [];
  return [...(node.children ?? [])].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function collectFiles(root, path) {
  const node = findNode(root, path);
  if (!node) return [];
  if (node.kind === "file") return [node];
  const out = [];
  const walk = (n) => {
    if (n.kind === "file") out.push(n);
    n.children?.forEach(walk);
  };
  walk(node);
  return out;
}

export function breadcrumbs(path) {
  const n = normalizePath(path);
  const parts = n.split("/").filter(Boolean);
  const out = [{ name: "/", path: "/" }];
  let acc = "";
  for (const part of parts) {
    acc = joinPath(acc || "/", part);
    out.push({ name: part, path: acc });
  }
  return out;
}

export function dirNode(path, name, children, modifiedAt) {
  return {
    id: `dir_${path}`,
    name,
    path,
    kind: "dir",
    sizeBytes: children.reduce((s, c) => s + (c.sizeBytes || 0), 0),
    modifiedAt,
    children,
  };
}

export function fileNode(path, name, sizeBytes, modifiedAt) {
  return {
    id: `file_${path}`,
    name,
    path,
    kind: "file",
    sizeBytes,
    modifiedAt,
  };
}

function mapTree(node, fn) {
  return fn({
    ...node,
    children: node.children?.map((c) => mapTree(c, fn)),
  });
}

export function ensureDir(root, path, now) {
  const normalized = normalizePath(path);
  if (findNode(root, normalized)) return root;
  const parts = normalized.split("/").filter(Boolean);
  let acc = "";
  let tree = root;
  for (const part of parts) {
    acc = joinPath(acc || "/", part);
    if (!findNode(tree, acc)) {
      const parent = parentPath(acc);
      tree = mapTree(tree, (node) => {
        if (node.path !== parent || node.kind !== "dir") return node;
        const child = dirNode(acc, part, [], now);
        return { ...node, children: [...(node.children ?? []), child] };
      });
    }
  }
  return tree;
}

export function upsertFile(root, destDir, file) {
  const dirPath = normalizePath(destDir);
  const nextFile = {
    ...file,
    path: joinPath(dirPath, file.name),
    kind: "file",
    children: undefined,
  };
  return mapTree(root, (node) => {
    if (node.path !== dirPath || node.kind !== "dir") return node;
    const children = [...(node.children ?? [])];
    const idx = children.findIndex((c) => c.name === nextFile.name);
    if (idx >= 0) children[idx] = nextFile;
    else children.push(nextFile);
    return { ...node, children };
  });
}
