import { getLocalBranches, getWorktreeBranches } from "../lib/git.js";

const SUBCOMMANDS = ["up", "down", "remove", "list", "switch", "clean", "config"];

export function completionsCommand(words: string[]): void {
  try {
    const [first] = words;

    if (!first) {
      console.log(SUBCOMMANDS.join("\n"));
      return;
    }

    switch (first) {
      case "up":
        console.log(getLocalBranches().join("\n"));
        break;
      case "remove":
        console.log(getWorktreeBranches().join("\n"));
        break;
      case "config":
        console.log(["add", "clear"].join("\n"));
        break;
      default:
        break;
    }
  } catch {
    // completions must never error
  }
}
