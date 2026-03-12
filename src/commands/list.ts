import chalk from "chalk";
import { listWorktrees } from "../lib/git.js";

export async function listCommand(): Promise<void> {
  let worktrees;
  try {
    worktrees = listWorktrees();
  } catch (err) {
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  if (worktrees.length === 0) {
    console.log(chalk.dim("No worktrees found"));
    return;
  }

  const branchWidth = Math.max(
    6,
    ...worktrees.map((w) => w.branch.length)
  );

  console.log(
    chalk.bold(
      `${"BRANCH".padEnd(branchWidth)}  ${"STATUS".padEnd(6)}  PATH`
    )
  );
  console.log(chalk.dim("─".repeat(branchWidth + 2 + 6 + 2 + 40)));

  for (const wt of worktrees) {
    const branch = wt.isMain
      ? chalk.green(wt.branch.padEnd(branchWidth))
      : wt.branch.padEnd(branchWidth);
    const status = wt.dirty ? chalk.yellow("dirty ") : chalk.dim("clean ");
    const path = chalk.dim(wt.path);
    console.log(`${branch}  ${status}  ${path}`);
  }
}
