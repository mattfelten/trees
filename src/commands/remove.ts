import { existsSync, rmSync } from "fs";
import chalk from "chalk";
import {
  getRepoName,
  getMainRoot,
  removeWorktree,
  getCurrentWorktreePath,
} from "../lib/git.js";
import { worktreePath } from "../lib/paths.js";
import { signalCd } from "../lib/shell.js";

export async function removeCommand(branch: string): Promise<void> {
  let repoName: string;
  let mainRoot: string;
  let currentPath: string;

  try {
    repoName = getRepoName();
    mainRoot = getMainRoot();
    currentPath = getCurrentWorktreePath();
  } catch (err) {
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  const targetPath = worktreePath(repoName, branch);

  if (!existsSync(targetPath)) {
    console.error(chalk.red(`No worktree found for branch: ${branch}`));
    process.exit(1);
  }

  const isInsideTarget = currentPath === targetPath;

  console.log(chalk.cyan(`Removing worktree: ${branch}`));
  console.log(chalk.dim(`  Path: ${targetPath}`));

  try {
    removeWorktree(targetPath, mainRoot);
    console.log(chalk.green("  ✓ Worktree removed"));
  } catch (err) {
    console.error(chalk.red(`Failed to remove worktree: ${err}`));
    process.exit(1);
  }

  // Clean up directory if it still exists
  if (existsSync(targetPath)) {
    rmSync(targetPath, { recursive: true, force: true });
  }

  if (isInsideTarget) {
    console.log(chalk.cyan("Returning to main worktree"));
    signalCd(mainRoot);
  }
}
