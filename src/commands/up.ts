import { existsSync } from "fs";
import chalk from "chalk";
import {
  getRepoName,
  getMainRoot,
  addWorktree,
  removeWorktree,
  listWorktrees,
} from "../lib/git.js";
import { worktreePath } from "../lib/paths.js";
import { getEffectiveConfig } from "../lib/config.js";
import { runHooks } from "../lib/hooks.js";
import { signalCd } from "../lib/shell.js";

export async function upCommand(branch: string): Promise<void> {
  let repoName: string;
  let mainRoot: string;

  try {
    repoName = getRepoName();
    mainRoot = getMainRoot();
  } catch (err) {
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  // If the branch is already checked out anywhere, go there instead of
  // trying to create a new worktree (which git would reject anyway).
  const worktrees = listWorktrees(mainRoot);
  const checkedOut = worktrees.find((w) => w.branch === branch);
  if (checkedOut) {
    console.log(chalk.cyan(`Switching to existing worktree: ${branch}`));
    signalCd(checkedOut.path);
    return;
  }

  const targetPath = worktreePath(repoName, branch);

  if (existsSync(targetPath)) {
    // Directory exists but git doesn't know about it — stale leftovers.
    console.error(
      chalk.red(
        `Directory already exists but is not a registered worktree: ${targetPath}\n` +
          `Remove it manually and try again.`
      )
    );
    process.exit(1);
  }

  console.log(chalk.cyan(`Creating worktree for branch: ${branch}`));
  console.log(chalk.dim(`  Path: ${targetPath}`));
  try {
    addWorktree(targetPath, branch, mainRoot);
    console.log(chalk.green(`  ✓ Worktree created`));
  } catch (err) {
    console.error(chalk.red(`Failed to create worktree: ${err}`));
    process.exit(1);
  }

  // Run setup hooks — roll back the worktree if they fail so we don't
  // leave a half-initialised directory behind.
  const { config } = getEffectiveConfig(repoName, mainRoot);
  if (config.setup.length > 0) {
    console.log(chalk.cyan("Running setup hooks..."));
    const ok = runHooks(config.setup, targetPath);
    if (!ok) {
      console.log(chalk.yellow("Rolling back worktree creation…"));
      try {
        removeWorktree(targetPath, mainRoot);
      } catch {
        // best-effort
      }
      process.exit(1);
    }
  }

  signalCd(targetPath);
}
