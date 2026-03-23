import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import chalk from "chalk";

const MARKER_START = "# trees-cli shell integration";
const MARKER_END = "# end trees-cli shell integration";
const SHELL_FUNCTION = `
${MARKER_START}
tree() {
  local tmpfile
  tmpfile=$(mktemp "${"\${TMPDIR:-/tmp}"}/trees-cd.XXXXXX")
  TREES_CD_FILE="$tmpfile" trees "$@"
  local exit_code=$?
  local cd_path
  cd_path=$(cat "$tmpfile" 2>/dev/null)
  rm -f "$tmpfile"
  [[ -n "$cd_path" ]] && cd "$cd_path"
  return $exit_code
}
if [ -n "$ZSH_VERSION" ]; then
  _tree_completions() {
    local -a completions
    completions=("\${(@f)$(trees completions \${words[2,-1]} 2>/dev/null)}")
    _describe 'values' completions
  }
  compdef _tree_completions tree
fi
if [ -n "$BASH_VERSION" ]; then
  _tree_completions() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    local candidates
    candidates=$(trees completions "\${COMP_WORDS[@]:1}" 2>/dev/null)
    COMPREPLY=($(compgen -W "$candidates" -- "$cur"))
  }
  complete -F _tree_completions tree
fi
${MARKER_END}
`;

function installToFile(rcPath: string, shell: string): boolean {
  if (!existsSync(rcPath)) {
    console.log(chalk.dim(`  ${shell}: ${rcPath} not found, skipping`));
    return false;
  }

  let contents = readFileSync(rcPath, "utf8");
  const blockRegex = new RegExp(
    `\\n?${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`
  );

  if (blockRegex.test(contents)) {
    // Replace existing block
    contents = contents.replace(blockRegex, SHELL_FUNCTION);
    writeFileSync(rcPath, contents);
    console.log(chalk.green(`  ✓ ${shell}: updated (${rcPath})`));
    return true;
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
