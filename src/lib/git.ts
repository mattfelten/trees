import { execSync, spawnSync } from "child_process";

export interface Worktree {
  path: string;
  branch: string;
  commit: string;
  isMain: boolean;
  dirty: boolean;
}

function exec(cmd: string, cwd?: string): string {
  return execSync(cmd, { cwd, encoding: "utf8" }).trim();
}

function tryExec(cmd: string, cwd?: string): string | null {
  try {
    return exec(cmd, cwd);
  } catch {
    return null;
  }
}

export function getRepoRoot(cwd = process.cwd()): string {
  const root = tryExec("git rev-parse --show-toplevel", cwd);
  if (!root) throw new Error("Not inside a git repository");
  return root;
}

export function repoNameFromUrl(url: string): string | null {
  const match = url.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (match) return match[1].replace(/\//g, "-");
  return null;
}

export function getRepoName(cwd = process.cwd()): string {
  const remoteUrl = tryExec("git remote get-url origin", cwd);
  if (remoteUrl) {
    const name = repoNameFromUrl(remoteUrl);
    if (name) return name;
  }
  // Fallback: directory name
  return exec("basename $(git rev-parse --show-toplevel)", cwd);
}

export function listWorktrees(cwd = process.cwd()): Worktree[] {
  const output = exec("git worktree list --porcelain", cwd);
  const entries = output.split("\n\n").filter(Boolean);

  return entries.map((entry, index) => {
    const lines = entry.split("\n");
    const path = lines.find((l) => l.startsWith("worktree "))?.slice(9) ?? "";
    const commit = lines.find((l) => l.startsWith("HEAD "))?.slice(5) ?? "";
    const branchLine = lines.find((l) => l.startsWith("branch "));
    const branch = branchLine
      ? branchLine.slice(7).replace("refs/heads/", "")
      : "(detached)";

    const statusOut = tryExec("git status --short", path) ?? "";
    const dirty = statusOut.trim().length > 0;

    return { path, branch, commit, isMain: index === 0, dirty };
  });
}

export function getMainRoot(cwd = process.cwd()): string {
  const worktrees = listWorktrees(cwd);
  const main = worktrees.find((w) => w.isMain);
  if (!main) throw new Error("Could not find main worktree");
  return main.path;
}

export function worktreeExists(path: string): boolean {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
  return result.stdout.includes(`worktree ${path}`);
}

export function branchExists(branch: string, cwd = process.cwd()): boolean {
  return tryExec(`git rev-parse --verify refs/heads/${branch}`, cwd) !== null;
}

export function remoteBranchExists(
  branch: string,
  cwd = process.cwd()
): boolean {
  return (
    tryExec(
      `git rev-parse --verify refs/remotes/origin/${branch}`,
      cwd
    ) !== null
  );
}

export function addWorktree(
  targetPath: string,
  branch: string,
  cwd = process.cwd()
): void {
  if (branchExists(branch, cwd)) {
    exec(`git worktree add "${targetPath}" "${branch}"`, cwd);
  } else if (remoteBranchExists(branch, cwd)) {
    // Create a local tracking branch from the remote
    exec(
      `git worktree add --track -b "${branch}" "${targetPath}" "origin/${branch}"`,
      cwd
    );
  } else {
    exec(`git worktree add -b "${branch}" "${targetPath}"`, cwd);
  }
}

export function removeWorktree(
  targetPath: string,
  cwd = process.cwd()
): void {
  exec(`git worktree remove "${targetPath}" --force`, cwd);
}

export function getLocalBranches(cwd = process.cwd()): string[] {
  const result = spawnSync(
    "git",
    ["branch", "--format=%(refname:short)"],
    { cwd, encoding: "utf8" }
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.split("\n").filter(Boolean);
}

export function getCurrentWorktreePath(cwd = process.cwd()): string {
  return exec("git rev-parse --show-toplevel", cwd);
}
