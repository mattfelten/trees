import { homedir } from "os";
import { join } from "path";

export function treesRoot(): string {
  return join(homedir(), ".trees");
}

export function worktreePath(repoName: string, branch: string): string {
  return join(homedir(), ".trees", "repositories", repoName, branch);
}

export function globalConfigPath(): string {
  return join(homedir(), ".trees", "config.json");
}
