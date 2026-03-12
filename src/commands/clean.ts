import chalk from "chalk";
import confirm from "@inquirer/confirm";
import {
  listWorktrees,
  getLocalBranches,
  removeWorktree,
  getMainRoot,
  getCurrentWorktreePath,
} from "../lib/git.js";
import { signalCd } from "../lib/shell.js";

export async function cleanCommand(): Promise<void> {
  let worktrees;
  let branches: string[];
  let mainRoot: string;
  let currentPath: string;

  try {
    worktrees = listWorktrees();
    branches = getLocalBranches();
    mainRoot = getMainRoot();
    currentPath = getCurrentWorktreePath();
  } catch (err) {
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  const branchSet = new Set(branches);
  const stale = worktrees.filter(
    (wt) => !wt.isMain && !branchSet.has(wt.branch)
  );

  if (stale.length === 0) {
    console.log(chalk.green("No stale worktrees found"));
    return;
  }

  console.log(chalk.yellow(`Found ${stale.length} stale worktree(s):`));
  for (const wt of stale) {
    console.log(`  ${chalk.red(wt.branch)}  ${chalk.dim(wt.path)}`);
  }

  let ok: boolean;
  try {
    ok = await confirm({ message: "Remove these worktrees?", default: false });
  } catch {
    process.exit(0);
  }

  if (!ok) {
    console.log(chalk.dim("Aborted"));
    return;
  }

  const removedPaths = new Set<string>();
  for (const wt of stale) {
    try {
      removeWorktree(wt.path, mainRoot);
      removedPaths.add(wt.path);
      console.log(chalk.green(`  ✓ Removed ${wt.branch}`));
    } catch (err) {
      console.error(chalk.red(`  ✗ Failed to remove ${wt.branch}: ${err}`));
    }
  }

  if (removedPaths.has(currentPath)) {
    console.log(chalk.cyan("Returning to main worktree"));
    signalCd(mainRoot);
  }
}
