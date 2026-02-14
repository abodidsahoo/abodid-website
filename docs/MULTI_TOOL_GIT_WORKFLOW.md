# Multi-Tool Git Workflow

This repo is configured so direct pushes from `main` are blocked locally.

## Current Local Safety Setup

- Local hooks path: `.githooks`
- Protected branch from direct push: `main`
- Hook file: `/Users/abodid/Documents/GitHub/personal-site-codex/.githooks/pre-push`

## Daily Flow

1. Update your local main:
   - `git switch main`
   - `git pull origin main`
2. Create a tool-specific branch:
   - Codex: `git switch -c codex/<task-name>`
   - Other tool: `git switch -c othertool/<task-name>`
3. Work and commit.
4. Push branch:
   - `git push -u origin <your-branch>`
5. Open PR to `main`.

## Why this avoids conflicts

- Both tools can work in the same GitHub repo.
- Each tool writes to separate branches.
- `main` only changes through reviewed merges.
