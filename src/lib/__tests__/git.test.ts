import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, realpathSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";
import {
  repoNameFromUrl,
  getRepoRoot,
  listWorktrees,
  branchExists,
  addWorktree,
  removeWorktree,
  getLocalBranches,
  getMainRoot,
} from "../git.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, encoding: "utf8" }).trim();
}

function makeRepo(): string {
  // realpathSync resolves macOS /var -> /private/var symlink so path
  // comparisons match what git rev-parse --show-toplevel returns
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "trees-test-")));
  git("init", dir);
  git("config user.email test@example.com", dir);
  git("config user.name Test", dir);
  writeFileSync(join(dir, "README"), "init");
  git("add .", dir);
  git("commit -m init", dir);
  return dir;
}

// ---------------------------------------------------------------------------
// repoNameFromUrl — pure logic, no git needed
// ---------------------------------------------------------------------------

describe("repoNameFromUrl", () => {
  it("parses SSH URLs", () => {
    expect(repoNameFromUrl("git@github.com:user/my-app.git")).toBe("user-my-app");
  });

  it("parses HTTPS URLs with .git suffix", () => {
    expect(repoNameFromUrl("https://github.com/user/my-app.git")).toBe("user-my-app");
  });

  it("parses HTTPS URLs without .git suffix", () => {
    expect(repoNameFromUrl("https://github.com/user/my-app")).toBe("user-my-app");
  });

  it("preserves hyphens in repo and org names", () => {
    expect(repoNameFromUrl("git@github.com:my-org/my-app-name.git")).toBe(
      "my-org-my-app-name"
    );
  });

  it("returns null for an unrecognisable URL", () => {
    expect(repoNameFromUrl("not-a-url")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration tests against real temp git repos
// ---------------------------------------------------------------------------

describe("git lib (integration)", () => {
  let repoDir: string;
  let worktreeDir: string;

  beforeEach(() => {
    repoDir = makeRepo();
    // Resolve symlink then remove — git worktree add needs a non-existent path
    worktreeDir = realpathSync(mkdtempSync(join(tmpdir(), "trees-wt-")));
    rmSync(worktreeDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true, force: true });
    rmSync(worktreeDir, { recursive: true, force: true });
  });

  describe("getRepoRoot", () => {
    it("returns the repo root from the root itself", () => {
      expect(getRepoRoot(repoDir)).toBe(repoDir);
    });

    it("returns the repo root from a subdirectory", () => {
      const sub = join(repoDir, "sub");
      execSync(`mkdir -p ${sub}`);
      expect(getRepoRoot(sub)).toBe(repoDir);
    });

    it("throws when not in a git repo", () => {
      const outside = mkdtempSync(join(tmpdir(), "not-a-repo-"));
      try {
        expect(() => getRepoRoot(outside)).toThrow("Not inside a git repository");
      } finally {
        rmSync(outside, { recursive: true });
      }
    });
  });

  describe("listWorktrees", () => {
    it("returns a single main worktree for a plain repo", () => {
      const wts = listWorktrees(repoDir);
      expect(wts).toHaveLength(1);
      expect(wts[0].isMain).toBe(true);
      expect(wts[0].path).toBe(repoDir);
      expect(wts[0].branch).toBe("main");
    });

    it("marks the main worktree as clean when there are no changes", () => {
      const wts = listWorktrees(repoDir);
      expect(wts[0].dirty).toBe(false);
    });

    it("marks the main worktree as dirty when there are uncommitted changes", () => {
      writeFileSync(join(repoDir, "dirty.txt"), "change");
      const wts = listWorktrees(repoDir);
      expect(wts[0].dirty).toBe(true);
    });
  });

  describe("getMainRoot", () => {
    it("returns the main repo root", () => {
      expect(getMainRoot(repoDir)).toBe(repoDir);
    });
  });

  describe("branchExists", () => {
    it("returns false for a branch that does not exist", () => {
      expect(branchExists("no-such-branch", repoDir)).toBe(false);
    });

    it("returns true for the default branch", () => {
      expect(branchExists("main", repoDir)).toBe(true);
    });
  });

  describe("getLocalBranches", () => {
    it("returns the default branch", () => {
      expect(getLocalBranches(repoDir)).toContain("main");
    });

    it("includes newly created branches", () => {
      git("branch feature-x", repoDir);
      expect(getLocalBranches(repoDir)).toContain("feature-x");
    });
  });

  describe("addWorktree / removeWorktree", () => {
    it("creates a new branch and worktree", () => {
      addWorktree(worktreeDir, "feature-new", repoDir);

      const wts = listWorktrees(repoDir);
      expect(wts).toHaveLength(2);
      const wt = wts.find((w) => w.branch === "feature-new");
      expect(wt).toBeDefined();
      expect(wt!.path).toBe(worktreeDir);
      expect(wt!.isMain).toBe(false);
    });

    it("uses an existing branch when it already exists", () => {
      git("branch existing-branch", repoDir);
      addWorktree(worktreeDir, "existing-branch", repoDir);

      const wts = listWorktrees(repoDir);
      expect(wts.find((w) => w.branch === "existing-branch")).toBeDefined();
    });

    it("removes the worktree", () => {
      addWorktree(worktreeDir, "to-remove", repoDir);
      expect(listWorktrees(repoDir)).toHaveLength(2);

      removeWorktree(worktreeDir, repoDir);
      expect(listWorktrees(repoDir)).toHaveLength(1);
    });
  });
});
