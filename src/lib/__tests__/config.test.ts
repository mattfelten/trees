import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Mock paths.ts so globalConfigPath points to a temp dir, not ~/.trees
const globalConfigPathRef = { value: "" };
vi.mock("../paths.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../paths.js")>();
  return {
    ...actual,
    globalConfigPath: () => globalConfigPathRef.value,
  };
});

// Import config AFTER the mock is in place
const {
  loadLocalConfig,
  saveLocalConfig,
  localConfigExists,
  localConfigPath,
  getEffectiveConfig,
  saveGlobalRepoConfig,
  getGlobalRepoConfig,
} = await import("../config.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmp(): string {
  return mkdtempSync(join(tmpdir(), "trees-config-test-"));
}

// ---------------------------------------------------------------------------
// Local config
// ---------------------------------------------------------------------------

describe("local config", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmp();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true });
  });

  it("localConfigExists returns false when no file is present", () => {
    expect(localConfigExists(dir)).toBe(false);
  });

  it("loadLocalConfig returns null when no file is present", () => {
    expect(loadLocalConfig(dir)).toBeNull();
  });

  it("round-trips local config through save + load", () => {
    const cfg = { setup: ["npm install"], teardown: ["npm run clean"] };
    saveLocalConfig(dir, cfg);
    expect(loadLocalConfig(dir)).toEqual(cfg);
  });

  it("localConfigExists returns true after saving", () => {
    saveLocalConfig(dir, { setup: [], teardown: [] });
    expect(localConfigExists(dir)).toBe(true);
  });

  it("localConfigPath returns the .treesrc.json path", () => {
    expect(localConfigPath(dir)).toBe(join(dir, ".treesrc.json"));
  });
});

// ---------------------------------------------------------------------------
// Global config
// ---------------------------------------------------------------------------

describe("global config", () => {
  let globalDir: string;

  beforeEach(() => {
    globalDir = makeTmp();
    globalConfigPathRef.value = join(globalDir, "config.json");
  });

  afterEach(() => {
    rmSync(globalDir, { recursive: true });
  });

  it("getGlobalRepoConfig returns empty arrays when no config exists", () => {
    expect(getGlobalRepoConfig("my-app")).toEqual({ setup: [], teardown: [] });
  });

  it("round-trips a repo config through save + get", () => {
    const cfg = { setup: ["npm install"], teardown: [] };
    saveGlobalRepoConfig("my-app", cfg);
    expect(getGlobalRepoConfig("my-app")).toEqual(cfg);
  });

  it("preserves other repos when saving a new one", () => {
    saveGlobalRepoConfig("app-a", { setup: ["a"], teardown: [] });
    saveGlobalRepoConfig("app-b", { setup: ["b"], teardown: [] });
    expect(getGlobalRepoConfig("app-a").setup).toEqual(["a"]);
    expect(getGlobalRepoConfig("app-b").setup).toEqual(["b"]);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveConfig — precedence logic
// ---------------------------------------------------------------------------

describe("getEffectiveConfig", () => {
  let repoDir: string;
  let globalDir: string;

  beforeEach(() => {
    repoDir = makeTmp();
    globalDir = makeTmp();
    globalConfigPathRef.value = join(globalDir, "config.json");
  });

  afterEach(() => {
    rmSync(repoDir, { recursive: true });
    rmSync(globalDir, { recursive: true });
  });

  it("returns default config with source=default when nothing is configured", () => {
    const { config, source } = getEffectiveConfig("my-app", repoDir);
    expect(source).toBe("default");
    expect(config).toEqual({ setup: [], teardown: [] });
  });

  it("returns global config with source=global when only global is set", () => {
    saveGlobalRepoConfig("my-app", { setup: ["global-setup"], teardown: [] });
    const { config, source } = getEffectiveConfig("my-app", repoDir);
    expect(source).toBe("global");
    expect(config.setup).toEqual(["global-setup"]);
  });

  it("returns local config with source=local when local exists", () => {
    saveGlobalRepoConfig("my-app", { setup: ["global-setup"], teardown: [] });
    saveLocalConfig(repoDir, { setup: ["local-setup"], teardown: [] });
    const { config, source } = getEffectiveConfig("my-app", repoDir);
    expect(source).toBe("local");
    expect(config.setup).toEqual(["local-setup"]);
  });

  it("local config takes precedence over global", () => {
    saveGlobalRepoConfig("my-app", { setup: ["should-not-appear"], teardown: [] });
    saveLocalConfig(repoDir, { setup: ["local-wins"], teardown: [] });
    const { config } = getEffectiveConfig("my-app", repoDir);
    expect(config.setup).toEqual(["local-wins"]);
  });
});
