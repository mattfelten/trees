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
  remoteBranchExists,
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

/** Creates an origin repo and a local clone of it. */
function makeRepoWithRemote(): { origin: string; local: string } {
  const origin = makeRepo();
  // Clone into a temp path that doesn't exist yet (git clone creates it)
  const cloneBase = mkdtempSync(join(tmpdir(), "trees-clone-"));
  rmSync(cloneBase, { recursive: true });
  const local = realpathSync(
    execSync(`git clone ${origin} ${cloneBase} && echo ${cloneBase}`, {
      encoding: "utf8",
    }).trim()
  );
  git("config user.email test@example.com", local);
  git("config user.name Test", local);
  return { origin, local };
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

// ---------------------------------------------------------------------------
// Remote branch detection and tracking worktree creation
// ---------------------------------------------------------------------------

describe("remote branch support", () => {
  let origin: string;
  let local: string;
  let worktreeDir: string;

  beforeEach(() => {
    ({ origin, local } = makeRepoWithRemote());
    worktreeDir = realpathSync(mkdtempSync(join(tmpdir(), "trees-wt-")));
    rmSync(worktreeDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(origin, { recursive: true, force: true });
    rmSync(local, { recursive: true, force: true });
    rmSync(worktreeDir, { recursive: true, force: true });
  });

  describe("remoteBranchExists", () => {
    it("returns false when the branch does not exist on origin", () => {
      expect(remoteBranchExists("no-such-branch", local)).toBe(false);
    });

    it("returns true after a branch is pushed to origin and fetched", () => {
      // Create branch in origin
      git("checkout -b remote-feature", origin);
      writeFileSync(join(origin, "f.txt"), "x");
      git("add .", origin);
      git("commit -m feat", origin);
      git("checkout main", origin);
      // Fetch in the clone
      git("fetch", local);

      expect(remoteBranchExists("remote-feature", local)).toBe(true);
    });

    it("returns false for a branch that exists locally but not on origin", () => {
      git("branch local-only", local);
      expect(remoteBranchExists("local-only", local)).toBe(false);
    });
  });

  describe("addWorktree with remote branch", () => {
    it("creates a tracking worktree for a remote-only branch", () => {
      // Push a new branch to origin, fetch it in local
      git("checkout -b remote-only", origin);
      writeFileSync(join(origin, "r.txt"), "r");
      git("add .", origin);
      git("commit -m remote", origin);
      git("checkout main", origin);
      git("fetch", local);

      addWorktree(worktreeDir, "remote-only", local);

      // Branch should exist locally now
      expect(branchExists("remote-only", local)).toBe(true);

      // Worktree should be registered
      const wts = listWorktrees(local);
      expect(wts.find((w) => w.branch === "remote-only")).toBeDefined();

      // Branch should track origin
      const upstream = execSync(
        "git rev-parse --abbrev-ref remote-only@{upstream}",
        { cwd: local, encoding: "utf8" }
      ).trim();
      expect(upstream).toBe("origin/remote-only");
    });

    it("does not set tracking for a purely new local branch", () => {
      addWorktree(worktreeDir, "brand-new", local);

      expect(branchExists("brand-new", local)).toBe(true);
      // Querying upstream should fail (no tracking set)
      expect(() =>
        execSync("git rev-parse --abbrev-ref brand-new@{upstream}", {
          cwd: local,
          encoding: "utf8",
          stdio: "pipe",
        })
      ).toThrow();
    });
  });
});
