import { spawnSync } from "child_process";
import chalk from "chalk";

export function runHooks(commands: string[], cwd: string): boolean {
  for (const cmd of commands) {
    console.log(chalk.dim(`  $ ${cmd}`));
    const result = spawnSync(cmd, {
      shell: true,
      cwd,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      console.error(chalk.red(`  Hook failed: ${cmd}`));
      return false;
    }
  }
  return true;
}
