import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { globalConfigPath } from "./paths.js";

export interface RepoConfig {
  setup: string[];
  teardown: string[];
}

export interface GlobalConfig {
  repos: Record<string, RepoConfig>;
}

const emptyRepoConfig = (): RepoConfig => ({ setup: [], teardown: [] });

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export function loadGlobalConfig(): GlobalConfig {
  return readJson<GlobalConfig>(globalConfigPath()) ?? { repos: {} };
}

export function saveGlobalConfig(config: GlobalConfig): void {
  writeJson(globalConfigPath(), config);
}

export function loadLocalConfig(repoRoot: string): RepoConfig | null {
  const treesrc = join(repoRoot, ".treesrc.json");
  const treesConfig = join(repoRoot, "trees.config.json");
  return (
    readJson<RepoConfig>(treesrc) ?? readJson<RepoConfig>(treesConfig) ?? null
  );
}

export function saveLocalConfig(repoRoot: string, config: RepoConfig): void {
  writeJson(join(repoRoot, ".treesrc.json"), config);
}

export function localConfigPath(repoRoot: string): string {
  return join(repoRoot, ".treesrc.json");
}

export function localConfigExists(repoRoot: string): boolean {
  return (
    existsSync(join(repoRoot, ".treesrc.json")) ||
    existsSync(join(repoRoot, "trees.config.json"))
  );
}

export function getEffectiveConfig(
  repoName: string,
  repoRoot: string
): { config: RepoConfig; source: "local" | "global" | "default" } {
  const local = loadLocalConfig(repoRoot);
  if (local) return { config: local, source: "local" };

  const global = loadGlobalConfig();
  const globalRepo = global.repos[repoName];
  if (globalRepo) return { config: globalRepo, source: "global" };

  return { config: emptyRepoConfig(), source: "default" };
}

export function saveGlobalRepoConfig(
  repoName: string,
  config: RepoConfig
): void {
  const global = loadGlobalConfig();
  global.repos[repoName] = config;
  saveGlobalConfig(global);
}

export function getGlobalRepoConfig(repoName: string): RepoConfig {
  const global = loadGlobalConfig();
  return global.repos[repoName] ?? emptyRepoConfig();
}
