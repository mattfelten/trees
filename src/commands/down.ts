import chalk from "chalk";
import { getMainRoot } from "../lib/git.js";
import { signalCd } from "../lib/shell.js";

export async function downCommand(): Promise<void> {
  try {
    const mainRoot = getMainRoot();
    console.log(chalk.cyan("Returning to main worktree"));
    signalCd(mainRoot);
  } catch (err) {
    console.error(chalk.red(String(err)));
    process.exit(1);
  }
}
