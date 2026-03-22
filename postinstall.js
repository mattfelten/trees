import { existsSync, readFileSync, appendFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const MARKER = "# trees-cli shell integration";
const SHELL_FUNCTION = `
${MARKER}
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
# end trees-cli shell integration
`;

const home = homedir();
const targets = [
  { path: join(home, ".zshrc"), shell: "zsh" },
  { path: join(home, ".bashrc"), shell: "bash" },
];

let installed = false;

for (const { path, shell } of targets) {
  if (!existsSync(path)) continue;

  const contents = readFileSync(path, "utf8");
  if (contents.includes(MARKER)) continue;

  appendFileSync(path, SHELL_FUNCTION);
  console.log(`trees: installed shell function in ${path}`);
  installed = true;
}

if (installed) {
  console.log("trees: reload your shell to activate (e.g. source ~/.zshrc)");
}
