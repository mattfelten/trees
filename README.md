# trees

Git worktree manager — switch branches like `cd`.

Git's worktree interface is powerful but clunky. `trees` wraps it in a simple, opinionated CLI so jumping between branches feels natural.

```
tree up my-feature   # create worktree + cd into it
tree down            # cd back to main
tree list            # see all worktrees + dirty status
tree switch          # interactive picker
tree remove my-feature
```

## Installation

```bash
npm install -g trees-cli
source ~/.zshrc   # or ~/.bashrc
```

The install automatically adds a `tree` shell function to your `~/.zshrc` and/or `~/.bashrc`. This wrapper is needed because a Node process can't change your shell's directory — `tree` runs `trees` under the hood and handles the `cd` for you.

## Commands

### `tree up <branch>`

Switch to a branch worktree, creating it if it doesn't exist yet.

```bash
tree up main              # switch to main
tree up feature/my-work   # create worktree + switch
```

Worktrees are stored at `~/.trees/repositories/<repo>/<branch>`.

If a `setup` hook is configured, it runs automatically when a new worktree is created (not on subsequent switches).

### `tree down`

Return to the main (non-worktree) copy of the repo.

### `tree remove <branch>`

Remove a worktree. If you're currently inside it, you'll be moved to the main repo first.

```bash
tree remove feature/my-work
```

### `tree list`

Show all worktrees for the current repo with their dirty status.

```
BRANCH          STATUS  PATH
──────────────────────────────────────────────────────
main            clean   ~/projects/my-app
feature/auth    dirty   ~/.trees/repositories/my-app/feature/auth
```

### `tree switch`

Interactively pick a worktree to switch to (uses arrow keys).

### `tree clean`

Find and remove worktrees whose branches no longer exist locally. Shows a dry-run list and prompts before deleting anything.

### `tree config`

Manage setup and teardown hooks for the current repo.

```bash
tree config                           # show effective config
tree config add setup "npm install"   # run after worktree creation
tree config add teardown "npm run clean"
tree config clear setup               # remove all setup commands
```

Hooks can be saved globally (`~/.trees/config.json`) or locally (`.treesrc.json` in the repo root). You'll be prompted each time — the default is smart: local if a local config already exists, global otherwise.

## Tab Completion

Tab completion is installed automatically alongside the shell function. It works in both zsh and bash:

- `tree <TAB>` — completes subcommands (`up`, `down`, `remove`, `list`, `switch`, `clean`, `config`)
- `tree up <TAB>` — completes all local git branches
- `tree remove <TAB>` — completes only active worktree branches
- `tree config <TAB>` — completes `add`, `clear`

If you installed before tab completion was added, run `trees install` to update the shell function, then reload your shell.

## Configuration

**Global** — applies to a named repo across all machines:
```json
// ~/.trees/config.json
{
  "repos": {
    "my-app": {
      "setup": ["npm install"],
      "teardown": ["npm run clean"]
    }
  }
}
```

**Per-repo** — commit it (or gitignore it) alongside the code:
```json
// .treesrc.json
{
  "setup": ["npm install", "npm run bootstrap"],
  "teardown": []
}
```

Per-repo config takes precedence over global.

---

## Contributing

### Prerequisites

- Node 18+
- npm 9+

### Setup

```bash
git clone https://github.com/<you>/trees
cd trees
npm install
npm run build
npm link        # makes `trees` available in your PATH
source ~/.zshrc # shell function is auto-installed by postinstall
```

### Development

```bash
npm run dev     # watch mode — rebuilds on save
```

Test your changes directly with `tree <command>` in any git repo.

### Project structure

```
src/
  index.ts          # CLI entrypoint (commander)
  commands/
    up.ts           # tree up <branch>
    down.ts         # tree down
    remove.ts       # tree remove <branch>
    list.ts         # tree list
    switch.ts       # tree switch
    clean.ts        # tree clean
    config.ts       # tree config
  lib/
    git.ts          # git operations (child_process)
    config.ts       # load/merge global + per-repo config
    paths.ts        # ~/.trees/repositories/<repo>/<branch>
    shell.ts        # __TREES_CD__ signal
    hooks.ts        # run setup/teardown commands
```

### The `cd` mechanism

`tree up <branch>` needs to change your shell's directory. Since Node can't do that directly, the mechanism works like this:

1. The `tree` shell function creates a temp file and passes it via `TREES_CD_FILE`
2. `trees` (Node) writes the target path to that file
3. The shell function reads the file and runs `cd`

This approach lets `trees` run with a direct TTY connection, so interactive prompts (like `tree switch` or `tree config add`) work correctly.

### Releasing

Releases are automated via [auto](https://intuit.github.io/auto/). Labels on PRs drive version bumps:

| Label | Version bump | Appears in changelog |
|---|---|---|
| `major` | `1.0.0 → 2.0.0` | Yes — Breaking Changes |
| `minor` | `1.0.0 → 1.1.0` | Yes — Features |
| `patch` | `1.0.0 → 1.0.1` | Yes — Bug Fixes |
| `documentation` | none | Yes — Documentation |
| `internal` | none | Yes — Internal |
| `dependencies` | none | Yes — Dependencies |
| `skip-release` | none | No |

When a PR merges to `main`, CI runs `auto shipit` which:
1. Determines the version bump from PR labels
2. Bumps `package.json` version
3. Appends to `CHANGELOG.md`
4. Creates a GitHub release + git tag
5. Publishes to npm

**First-time setup** (one-time, after pushing the repo to GitHub):

1. Add repo secrets in GitHub → Settings → Secrets:
   - `GH_TOKEN` — a GitHub personal access token with `repo` scope
   - `NPM_TOKEN` — an npm access token with publish rights

2. Create the PR labels on the repo (one-time):
   ```bash
   GH_TOKEN=<your-token> npx auto create-labels
   ```
   Or trigger the `Create Labels` workflow manually from the Actions tab.

3. Tag the initial version so `auto` has a baseline:
   ```bash
   git tag v0.1.0
   git push --tags
   ```
