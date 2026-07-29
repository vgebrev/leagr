# Release tagging: marking which deploys became GitHub Releases

**Date:** 2026-07-29

## Overview

`deploy.sh` tags every deploy `vX.Y.Z` — 158 of them at the time of writing. GitHub Releases are cut
by hand, subjectively, when enough has accumulated to be worth announcing — 26 of them, on tags like
`v2.24.3`, `v2.21.4` and `v2.15.8`. Nothing in git distinguished the two, so "what shipped since the
last actual release?" meant opening the Releases page and hunting for the matching bump commit.

This adds a `release/vX.Y.Z` tag on every commit that has a corresponding GitHub Release, created
automatically when a release is published and backfillable from the API.

## Architecture decisions

### 1. Derived from GitHub, not maintained by hand

The GitHub Releases list is already the source of truth for "this one counted", and it is queryable
without credentials on a public repo. So the tag is a **mirror**, never an input: nothing has to be
remembered at release time, and the state can be rebuilt from scratch at any point by re-running the
sync. A convention like "only tag minor versions" was rejected for exactly this reason — the existing
releases don't follow one (`v2.24.3`, `v2.21.4`, `v2.15.8` are all patch versions), because the
decision is editorial rather than mechanical.

### 2. A separate namespace, not a second name for the same thing

`release/vX.Y.Z` sits alongside `vX.Y.Z` rather than replacing it. Both facts are worth keeping — a
version was deployed, and a version was announced — and the namespace makes the release subset
directly addressable:

```bash
git describe --tags --match 'release/v*' --abbrev=0     # last published release
git log $(git describe --tags --match 'release/v*' --abbrev=0)..HEAD
```

`--match` keeps the 158 deploy tags out of the way. Nothing else in the repo uses `git describe`, so
there is no existing behaviour to disturb.

### 3. The workflow triggers on the release, not the other way round

`release: published` → create the tag. The alternative — push a `release/*` tag, let a workflow
create the GitHub Release from a notes file — would have replaced the UI flow with a CLI one and
needed a PAT locally. Triggering off the release keeps the existing habit intact and needs no
secrets: Actions' built-in `GITHUB_TOKEN` with `contents: write` is enough.

**Consequence:** workflows for non-`push` events run from the **default branch**, so this only takes
effect once merged to `main`. Releases published before then are picked up by the sync script.

### 4. The sync script is idempotent and never deletes

`sync-release-tags.sh` reconciles rather than creates: it skips tags that already exist, so it is
safe to re-run, and it is the fallback whenever the workflow is skipped, fails, or wasn't there yet.
Local `release/*` tags with no matching GitHub release are **reported and left alone** — a tag
deleted by a script is a tag that has to be recovered by hand, and the only way to reach that state
is a deleted release, which is rare enough to handle manually.

### 5. Commits resolved locally first, API second

For each release the commit comes from the local tag when it exists (all 26 did), falling back to
`git/ref/tags/{tag}` and dereferencing the annotated tag object when it doesn't. That keeps the
common path to one API call for the release list, rather than three per release.

### 6. The notes scaffold stops short of prose

`release-notes-draft.sh` resolves the range and groups commits by conventional-commit type into the
headings the published notes use (`feat` → New Features, `fix` → Bug Fixes, `perf`/`refactor`/`style`
→ Improvements, `chore`/`docs`/`test`/`ci`/`build` → Maintenance), then appends the raw log with
bodies. Version-bump commits are filtered out as markers rather than content.

It deliberately does **not** try to produce the final wording. The published notes describe what a
player can now do — "Tap Start for a 3-2-1 countdown and a kick-off whistle" — which is not
recoverable from "feat(Match Centre): Add a match timer" by any transformation of the subject line.
Bulleted commit bodies are pulled in as sub-bullets, since those tend to enumerate the user-facing
parts; prose bodies are left to the raw log. What the script removes is the mechanical half: finding
the boundary, collecting the range, and sorting by type.

## Files added

- **`.github/workflows/release-tag.yml`** — on `release: published`, resolves the release's tag to a
  commit and creates `refs/tags/release/<tag>` via the API. Skips prereleases, non-`vX.Y.Z` tags, and
  tags that already exist.
- **`sync-release-tags.sh`** — paginated fetch of the releases list, creates and pushes any missing
  `release/*` tags. `--dry-run`, `--no-push`, `--include-prereleases`. Derives `owner/repo` from the
  origin URL (handles ssh config host aliases such as `git@github.com-gmail:owner/repo.git`).
- **`release-notes-draft.sh`** — writes `RELEASE-NOTES-vX.Y.Z.md` from the commit range.
  `-v/--version`, `--from`, `--to`, `-o/--output`, `-f/--force`; refuses to overwrite without
  `--force`.
- **`README.md`** — a "Releases" subsection under Scripted Deployment covering the two tag
  namespaces and all three commands.

## Testing

Shell scripts, so verified by running rather than by unit test (the vitest suites cover application
code; nothing in the repo tests shell).

- `sync-release-tags.sh --dry-run` → resolved all 26 releases to commits.
- `sync-release-tags.sh --no-push` → created 26 local tags; a second `--dry-run` reported
  "Already in sync", confirming idempotency.
- Stale detection → a bogus `release/v9.9.9` was reported under "no matching GitHub release" and left
  in place, then removed by hand.
- `release-notes-draft.sh` → run over `v2.24.3..v2.25.0` and `v2.25.0..v2.26.0`; output matched the
  hand-written notes for those releases in structure and coverage. Default `--from` resolution
  verified against `--to 95295a9`, resolving to `release/v2.25.0`.
- Empty range and existing-output guards both trip as intended.
- `npx prettier --check` clean on the workflow and the notes files (`npm run lint` runs
  `prettier --check .`, which covers `.yml` and `.md`).

## Assumptions and limitations

- **The tags are local until pushed.** The backfill was run with `--no-push`; the 26 tags need
  `git push origin release/v2.0.4 …` (the script prints the exact command) to be visible on GitHub.
- **The workflow is inert until it reaches `main`.** See decision 3.
- **Deleting a GitHub release leaves its `release/*` tag behind**, reported by the next sync but not
  removed. Deliberate.
- **Prereleases are skipped by default** (`--include-prereleases` opts in). None exist today.
- **Draft releases are invisible** to an unauthenticated API call and are filtered out explicitly
  anyway — they have no published commit to tag.
- **The notes scaffold assumes conventional commits.** Subjects that don't parse land in an
  "Uncategorised" section rather than being dropped.
- **Rate limit:** unauthenticated GitHub API allows 60 requests/hour per IP. The sync uses one call
  per page (plus up to two per release only when a tag is missing locally), so this is not a
  practical constraint. `GITHUB_TOKEN` raises it if needed.
