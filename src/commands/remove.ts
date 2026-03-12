import { existsSync, rmSync } from "fs";
import chalk from "chalk";
import confirm from "@inquirer/confirm";
import {
  getRepoName,
  getMainRoot,
  removeWorktree,
  getCurrentWorktreePath,
  listWorktrees,
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

  // Warn if the worktree has uncommitted changes
  const worktrees = listWorktrees(mainRoot);
  const target = worktrees.find((w) => w.path === targetPath);
  if (target?.dirty) {
    console.log(chalk.yellow(`  Warning: ${branch} has uncommitted changes`));
    let ok: boolean;
    try {
      ok = await confirm({ message: "Remove anyway?", default: false });
    } catch {
      process.exit(0);
    }
    if (!ok) {
      console.log(chalk.dim("Aborted"));
      return;
    }
  }

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
