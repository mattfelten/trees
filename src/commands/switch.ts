import chalk from "chalk";
import select from "@inquirer/select";
import { listWorktrees, getCurrentWorktreePath } from "../lib/git.js";
import { signalCd } from "../lib/shell.js";

export async function switchCommand(): Promise<void> {
  let worktrees;
  let currentPath: string;

  try {
    worktrees = listWorktrees();
    currentPath = getCurrentWorktreePath();
  } catch (err) {
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  if (worktrees.length <= 1) {
    console.log(chalk.dim("No other worktrees to switch to"));
    return;
  }

  const choices = worktrees.map((wt) => {
    const isCurrent = wt.path === currentPath;
    const label =
      (isCurrent ? chalk.cyan("→ ") : "  ") +
      wt.branch +
      (wt.dirty ? chalk.yellow(" *") : "") +
      (wt.isMain ? chalk.dim(" (main)") : "");
    return {
      name: label,
      value: wt.path,
      description: chalk.dim(wt.path),
    };
  });

  try {
    const selected = await select({
      message: "Switch to worktree:",
      choices,
    });

    if (selected === currentPath) {
      console.log(chalk.dim("Already in this worktree"));
      return;
    }

    signalCd(selected);
  } catch {
    // User cancelled (Ctrl+C)
    process.exit(0);
  }
}
