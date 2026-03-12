import { existsSync } from "fs";
import chalk from "chalk";
import {
  getRepoName,
  getMainRoot,
  addWorktree,
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

  const targetPath = worktreePath(repoName, branch);
  const alreadyExists = existsSync(targetPath);

  if (!alreadyExists) {
    console.log(chalk.cyan(`Creating worktree for branch: ${branch}`));
    console.log(chalk.dim(`  Path: ${targetPath}`));
    try {
      addWorktree(targetPath, branch, mainRoot);
      console.log(chalk.green(`  ✓ Worktree created`));
    } catch (err) {
      console.error(chalk.red(`Failed to create worktree: ${err}`));
      process.exit(1);
    }

    // Run setup hooks only on creation
    const { config } = getEffectiveConfig(repoName, mainRoot);
    if (config.setup.length > 0) {
      console.log(chalk.cyan("Running setup hooks..."));
      const ok = runHooks(config.setup, targetPath);
      if (!ok) process.exit(1);
    }
  } else {
    // Verify it's actually a registered worktree
    const worktrees = listWorktrees(mainRoot);
    const registered = worktrees.some((w) => w.path === targetPath);
    if (!registered) {
      console.error(
        chalk.red(
          `Directory exists but is not a git worktree: ${targetPath}`
        )
      );
      process.exit(1);
    }
    console.log(chalk.cyan(`Switching to existing worktree: ${branch}`));
  }

  signalCd(targetPath);
}
