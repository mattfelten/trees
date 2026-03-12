import { Command } from "commander";
import { upCommand } from "./commands/up.js";
import { downCommand } from "./commands/down.js";
import { removeCommand } from "./commands/remove.js";
import { listCommand } from "./commands/list.js";
import { switchCommand } from "./commands/switch.js";
import { cleanCommand } from "./commands/clean.js";
import {
  configShowCommand,
  configAddCommand,
  configClearCommand,
} from "./commands/config.js";
import { installCommand } from "./commands/install.js";

const program = new Command();

program
  .name("trees")
  .description("Git worktree manager — switch branches like cd")
  .version("0.1.0");

program
  .argument("[branch]", "Branch to switch to (creates worktree if needed)")
  .action(async (branch?: string) => {
    if (branch) {
      await upCommand(branch);
    } else {
      program.help();
    }
  });

program
  .command("down")
  .description("Return to the main worktree")
  .action(downCommand);

program
  .command("remove <branch>")
  .description("Remove a worktree")
  .action(removeCommand);

program
  .command("list")
  .description("List all worktrees for this repo")
  .action(listCommand);

program
  .command("switch")
  .description("Interactively switch between worktrees")
  .action(switchCommand);

program
  .command("clean")
  .description("Remove stale worktrees (branches no longer exist)")
  .action(cleanCommand);

const configCmd = program
  .command("config")
  .description("View and manage setup/teardown hooks")
  .action(configShowCommand);

const configAdd = configCmd
  .command("add <type> <command>")
  .description("Add a setup or teardown command")
  .action(async (type: string, command: string) => {
    if (type !== "setup" && type !== "teardown") {
      console.error(`Type must be "setup" or "teardown"`);
      process.exit(1);
    }
    await configAddCommand(type, command);
  });

void configAdd;

const configClear = configCmd
  .command("clear <type>")
  .description("Clear all setup or teardown commands")
  .action(async (type: string) => {
    if (type !== "setup" && type !== "teardown") {
      console.error(`Type must be "setup" or "teardown"`);
      process.exit(1);
    }
    await configClearCommand(type);
  });

void configClear;

program
  .command("install")
  .description("Install the tree shell function into ~/.zshrc / ~/.bashrc")
  .action(installCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
