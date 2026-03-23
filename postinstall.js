import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const MARKER_START = "# trees-cli shell integration";
const MARKER_END = "# end trees-cli shell integration";
const SHELL_FUNCTION = `
${MARKER_START}
tree() {
  local tmpfile
  tmpfile=$(mktemp "\${TMPDIR:-/tmp}/trees-cd.XXXXXX")
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

const home = homedir();
const targets = [
  { path: join(home, ".zshrc"), shell: "zsh" },
  { path: join(home, ".bashrc"), shell: "bash" },
];

let installed = false;

const blockRegex = new RegExp(
  `\\n?${MARKER_START}[\\s\\S]*?${MARKER_END}\\n?`
);

for (const { path, shell } of targets) {
  if (!existsSync(path)) continue;

  let contents = readFileSync(path, "utf8");

  if (blockRegex.test(contents)) {
    // Replace existing block
    contents = contents.replace(blockRegex, SHELL_FUNCTION);
    writeFileSync(path, contents);
    console.log(`trees: updated shell function in ${path}`);
    installed = true;
    continue;
  }

  appendFileSync(path, SHELL_FUNCTION);
  console.log(`trees: installed shell function in ${path}`);
  installed = true;
}

if (installed) {
  console.log("trees: reload your shell to activate (e.g. source ~/.zshrc)");
}
