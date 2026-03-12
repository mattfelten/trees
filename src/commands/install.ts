import { existsSync, readFileSync, appendFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import chalk from "chalk";

const MARKER = "# trees-cli shell integration";
const SHELL_FUNCTION = `
${MARKER}
tree() {
  local output
  output=$(trees "$@" 2>&1)
  local exit_code=$?
  local cd_path
  cd_path=$(echo "$output" | grep '^__TREES_CD__:' | tail -1 | sed 's/^__TREES_CD__://')
  echo "$output" | grep -v '^__TREES_CD__:'
  [[ -n "$cd_path" ]] && cd "$cd_path"
  return $exit_code
}
# end trees-cli shell integration
`;

function installToFile(rcPath: string, shell: string): boolean {
  if (!existsSync(rcPath)) {
    console.log(chalk.dim(`  ${shell}: ${rcPath} not found, skipping`));
    return false;
  }

  const contents = readFileSync(rcPath, "utf8");
  if (contents.includes(MARKER)) {
    console.log(chalk.dim(`  ${shell}: already installed (${rcPath})`));
    return false;
  }

  appendFileSync(rcPath, SHELL_FUNCTION);
  console.log(chalk.green(`  ✓ ${shell}: installed (${rcPath})`));
  return true;
}

export async function installCommand(): Promise<void> {
  const home = homedir();
  let installed = false;

  const targets = [
    { path: join(home, ".zshrc"), shell: "zsh" },
    { path: join(home, ".bashrc"), shell: "bash" },
  ];

  console.log(chalk.cyan("Installing trees shell function..."));

  for (const { path, shell } of targets) {
    const did = installToFile(path, shell);
    if (did) installed = true;
  }

  if (installed) {
    console.log();
    console.log("Reload your shell to activate:");
    console.log(chalk.cyan("  source ~/.zshrc"));
  } else {
    console.log(chalk.dim("Shell function already installed everywhere."));
  }
}
