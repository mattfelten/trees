import chalk from "chalk";
import select from "@inquirer/select";
import confirm from "@inquirer/confirm";
import {
  loadLocalConfig,
  saveLocalConfig,
  saveGlobalRepoConfig,
  getGlobalRepoConfig,
  localConfigExists,
  localConfigPath,
  getEffectiveConfig,
  type RepoConfig,
} from "../lib/config.js";
import { getRepoName, getMainRoot } from "../lib/git.js";

type HookType = "setup" | "teardown";

async function resolveTarget(
  repoRoot: string
): Promise<"local" | "global"> {
  const hasLocal = localConfigExists(repoRoot);
  const defaultTarget = hasLocal ? "local" : "global";

  try {
    const choice = await select<"local" | "global">({
      message: "Save to:",
      choices: [
        {
          name: `local (this repo: .treesrc.json)`,
          value: "local",
          description: localConfigPath(repoRoot),
        },
        {
          name: `global (~/.trees/config.json)`,
          value: "global",
        },
      ],
      default: defaultTarget,
    });
    return choice;
  } catch {
    process.exit(0);
  }
}

function printConfig(config: RepoConfig, source: string): void {
  console.log(chalk.dim(`Source: ${source}`));
  console.log();
  if (config.setup.length === 0) {
    console.log(chalk.dim("  setup:    (none)"));
  } else {
    console.log("  setup:");
    for (const cmd of config.setup) {
      console.log(`    - ${chalk.cyan(cmd)}`);
    }
  }
  if (config.teardown.length === 0) {
    console.log(chalk.dim("  teardown: (none)"));
  } else {
    console.log("  teardown:");
    for (const cmd of config.teardown) {
      console.log(`    - ${chalk.cyan(cmd)}`);
    }
  }
}

export async function configShowCommand(): Promise<void> {
  let repoName: string;
  let repoRoot: string;

  try {
    repoName = getRepoName();
    repoRoot = getMainRoot();
  } catch (err) {
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  const { config, source } = getEffectiveConfig(repoName, repoRoot);
  printConfig(config, source);
}

export async function configAddCommand(
  hookType: HookType,
  command: string
): Promise<void> {
  let repoName: string;
  let repoRoot: string;

  try {
    repoName = getRepoName();
    repoRoot = getMainRoot();
  } catch (err) {
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  const target = await resolveTarget(repoRoot);

  let config: RepoConfig;
  if (target === "local") {
    config = loadLocalConfig(repoRoot) ?? { setup: [], teardown: [] };
  } else {
    config = getGlobalRepoConfig(repoName);
  }

  if (config[hookType].includes(command)) {
    console.log(chalk.dim(`Command already in ${hookType}: ${command}`));
    return;
  }

  config[hookType].push(command);

  if (target === "local") {
    const isNew = !localConfigExists(repoRoot);
    saveLocalConfig(repoRoot, config);
    const path = localConfigPath(repoRoot);
    console.log(chalk.green(`✓ Added to ${hookType} (local)`));
    if (isNew) {
      console.log(chalk.dim(`  Created: ${path}`));
      console.log(
        chalk.yellow(
          `  Consider committing or adding to .gitignore: ${path}`
        )
      );
    }
  } else {
    saveGlobalRepoConfig(repoName, config);
    console.log(chalk.green(`✓ Added to ${hookType} (global)`));
  }
}

export async function configClearCommand(hookType: HookType): Promise<void> {
  let repoName: string;
  let repoRoot: string;

  try {
    repoName = getRepoName();
    repoRoot = getMainRoot();
  } catch (err) {
    console.error(chalk.red(String(err)));
    process.exit(1);
  }

  const target = await resolveTarget(repoRoot);

  let config: RepoConfig;
  if (target === "local") {
    config = loadLocalConfig(repoRoot) ?? { setup: [], teardown: [] };
  } else {
    config = getGlobalRepoConfig(repoName);
  }

  if (config[hookType].length === 0) {
    console.log(chalk.dim(`No ${hookType} commands to clear`));
    return;
  }

  let ok: boolean;
  try {
    ok = await confirm({
      message: `Clear all ${hookType} commands?`,
      default: false,
    });
  } catch {
    process.exit(0);
  }

  if (!ok) {
    console.log(chalk.dim("Aborted"));
    return;
  }

  config[hookType] = [];

  if (target === "local") {
    saveLocalConfig(repoRoot, config);
    console.log(chalk.green(`✓ Cleared ${hookType} (local)`));
  } else {
    saveGlobalRepoConfig(repoName, config);
    console.log(chalk.green(`✓ Cleared ${hookType} (global)`));
  }
}
