# CLAUDE.md

Guidance for AI assistants (Claude Code) working in this repository.

## Repository Status

This repository (`detherington/boring-caribou`) is currently **empty** — no commits, no source files, no configured language or build tooling. This document is a placeholder scaffold and should be updated as soon as real code lands.

## Working Conventions

- **Default branch for Claude work:** `claude/add-claude-documentation-g6xTD` (or whichever branch the task specifies). Never push to a different branch without explicit permission.
- **Commits:** Use clear, descriptive messages. Prefer small, focused commits over large ones.
- **Push:** `git push -u origin <branch>`. Retry transient network failures with exponential backoff.
- **Pull requests:** Do not open a PR unless the user explicitly requests it.

## Tooling Preferences

When editing this repo, prefer Claude Code's dedicated tools over shell equivalents:

- Read files with `Read`, not `cat`/`head`/`tail`
- Search filenames with `Glob`, content with `Grep`
- Edit with `Edit`; create files with `Write`
- Use `Bash` only for genuine shell operations

## What To Update Here Next

Once the project takes shape, replace this placeholder with:

1. **Overview** — what the project does and its target runtime.
2. **Layout** — top-level directories and their purpose.
3. **Build / test / lint commands** — exact invocations.
4. **Architecture notes** — key modules, data flow, external dependencies.
5. **Conventions** — code style, naming, testing patterns, commit format.
6. **Gotchas** — anything non-obvious that has tripped up contributors.

## GitHub Integration

This repo is accessed via the `mcp__github__*` MCP tools (no `gh` CLI). Tool access is scoped to `detherington/boring-caribou` only.
