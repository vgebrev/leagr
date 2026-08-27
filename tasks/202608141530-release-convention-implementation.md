# Release convention: a minor bump is a release

**Date:** 2026-08-14

Supersedes `202607291032-release-tagging-implementation.md`.

## Overview

`deploy.sh` tags every deploy `vX.Y.Z` (160 tags at the time of writing). Only some of those were
promoted to a GitHub Release (26), and the promotion was editorial and after-the-fact. The previous
implementation made that subset queryable from git by mirroring each published release onto a
`release/vX.Y.Z` tag, via a workflow and a sync script.

This replaces the mirror with a convention: **`vX.Y.0` means released, `vX.Y.Z` (Z>0) means
deployed.** Pushing a `v*.0` tag opens a draft GitHub Release pre-filled with the notes scaffold; the
wording is then rewritten by hand and published.

## Architecture decisions

### 1. The decision moves earlier, so the mirror disappears

`release/*` existed only because the release decision was made after the commit — the namespace's
entire job was to re-import a judgement that lived on GitHub. Making the decision at deploy time
means the version number itself carries it, and there is nothing left to mirror. The same argument
rules out release branches, which would be a mirror that also has to be maintained.

The previous doc rejected "only tag minor versions" on the grounds that existing releases did not
follow it (`v2.24.3`, `v2.21.4`, `v2.15.8` are patch versions). That was true as an observation about
history and wrong as an objection to a convention: a convention constrains what happens next, not
what already happened.

### 2. Minor rather than a separate marker

The alternative markers considered were the merge to `main` (already one PR per promotion, titled by
version) and a `workflow_dispatch` release button. Minor-as-release won because the signal is already
in the tooling — `deploy.sh` only auto-bumps the patch, so every minor has always been a deliberate
act — and because it is addressable per release rather than being a branch tip.

**Accepted cost:** version numbers now mark release boundaries rather than change size. A large
feature that is not being announced ships as a patch, and patch numbers may run high between releases
(`v2.27.14`).

### 3. Draft, not published

The workflow opens a draft rather than publishing outright. The published notes describe what a
player can now do — "Tap Start for a 3-2-1 countdown and a kick-off whistle" — which is not
recoverable from "feat(Match Centre): Add a match timer" by any transformation of the subject line.
Automating the mechanical half (finding the boundary, collecting the range, grouping by type) while
leaving the prose to a human is the whole point; a draft is exactly where "delete the raw log before
publishing" belongs.

### 4. Triggered by the tag push, not by the release

`on: push: tags: ['v*.0']`. The workflow runs from the **tagged commit**, so it takes effect on
`develop` as soon as the file is in the tag — no merge to `main` required.

The same is true of the `release: published` workflow it replaces, contrary to what
`202607291032-release-tagging-implementation.md` decision 3 assumed. That doc generalised
"workflows for non-`push` events run from the default branch", which holds for `schedule`,
`workflow_dispatch` and `repository_dispatch` but not for `release`: a release event sets
`GITHUB_REF` to `refs/tags/<tag_name>`, and Actions loads the workflow definitions from that ref.

Publishing the `v2.27.0` release by hand on 2026-08-14 proved it. PR #22 merged the deletion to
`main` at 09:35 UTC; the workflow ran at 09:37 UTC — two minutes later, from the copy in the
`v2.27.0` tag's own tree. `main` never carried the file in its tree at any tip either: PR #21 did
not include the commit that added it, and PR #22 brought the add and the delete across together, so
they cancelled. The real difference between the two triggers is **when** they fire (tag push vs.
manual publish), not which ref they resolve from.

Worth knowing for the next time this is traced: `git log main -- <path>` reports **nothing** here.
Default history simplification follows only the first parent of a merge when the merge result is
TREESAME to it, and PR #22's result was — the file is absent on both sides. `git log --full-history`
shows both commits; `git merge-base --is-ancestor` answers the question directly.

The glob is exact enough on its own (`v*.0` matches `v2.28.0` and `v2.100.0` but not `v2.28.10`,
which ends in `.10`), but the job re-checks with `^v[0-9]+\.[0-9]+\.0$` anyway.

### 5. `deploy.sh` pushes on success

The script previously printed "Remember to push the tag", which is why `v2.26.1` and `v2.27.0` sat
deployed but unpushed. It now pushes the branch and tag as its final action, after the deploy has
been verified — so the release workflow fires without a manual step.

Two safety properties: a push failure **warns rather than rolling back**, since the deploy is already
live; and `rollback()` skips its `git tag -d` / `git reset --hard HEAD~1` once `GIT_PUSHED` is set,
because a hard reset over published history is the one unrecoverable failure mode here.

### 6. A latent bug the smoke test exposed

`release-notes-draft.sh` used `%x1e` as a record **prefix** in its `git log --format`. The final
record therefore had no trailing delimiter, so `read -d $'\x1e'` hit EOF and returned non-zero before
the loop body ran — silently dropping the newest commit from every range, while the header still
reported the correct count.

It had never shown up because `deploy.sh` always makes the version bump the newest commit in the
range, and bump commits are filtered out as markers anyway: the dropped commit was always one that
would have been discarded. The throwaway smoke-test tag sat on an ordinary commit, which made it
visible. Moving `%x1e` to the end of the format makes it a terminator; the existing
`SUBJECT="${SUBJECT#$'\n'}"` strip already handles the leading newline this shifts onto each record.

Output for real deploy-shaped ranges is byte-identical before and after, which is what confirms the
change is safe rather than merely different.

### 7. The release body is shaped for GitHub, not for a file

The script writes `# Release vX.Y.Z` as the file's title, which is right for a standalone `.md` and
redundant as a release body — GitHub already shows the release name above it. The workflow strips
that heading and appends the `**Full Changelog**` compare link that every published release ends
with, so the draft opens in the same shape as the 26 releases before it.

### 8. Not adopting PR-per-change

GitHub's native "Generate release notes" builds "What's Changed" from merged PRs in the range. Work
lands as linear commits straight onto `develop` with a single `develop → main` promotion PR, so there
are no PRs to list — hence the empty auto-generated notes. Making that flow useful would mean a PR
per feature. Since the notes are hand-written prose either way, a PR list would not save the writing,
and the conventional-commit scaffold is the better input. The promotion PR is unchanged.

## Files changed

- **`.github/workflows/release-draft.yml`** (added) — on push of a `v*.0` tag: checkout with
  `fetch-depth: 0` (`git describe` needs the full history and tags), skip if a release already
  exists, run `release-notes-draft.sh`, strip the duplicated title heading, append the Full Changelog
  link, `gh release create --draft`. Built-in `GITHUB_TOKEN`, no secrets.
- **`release-notes-draft.sh`** — range start now resolves from `git describe --tags --match 'v*.0'`.
  Resolved from `${TO_REF}^`, **not** `$TO_REF`: `git describe` returns a ref's own tag, so
  `--to v2.28.0` would otherwise resolve the start to `v2.28.0` and leave an empty range. Grouping,
  bump-commit filtering and output format unchanged. Also fixes the dropped-commit bug below.
- **`deploy.sh`** — added `-m|--minor` (rejected in combination with `--version`/`--no-version`),
  minor version math, the push-on-success block, the `GIT_PUSHED` rollback guard, and updated
  usage/header/final messages.
- **`.github/workflows/release-tag.yml`**, **`sync-release-tags.sh`** (deleted) — the mirror.
  Deleting a workflow on a branch does not remove it from tags already cut: `v2.26.1` and `v2.27.0`
  sit between the commit that added `release-tag.yml` and the one that deleted it, so both still
  carry it and a release published against either still runs it. `v2.26.0` and everything older are
  clean, and every future tag is cut after the deletion.
- **`.gitignore`** — `RELEASE-NOTES-v*.md`; the published release is the record.
- **`README.md`** — "Releases" rewritten around the convention; `--minor` added to the deploy
  examples.

The 26 `release/*` tags were deleted locally and on origin.

## Testing

Shell and CI config, so verified by running rather than by unit test (the vitest suites cover
application code; nothing in the repo tests shell). Application code is untouched.

- Boundary resolution — `git describe --tags --match 'v*.0' --abbrev=0 <ref>^` returns `v2.26.0` for
  `HEAD`, `v2.27.0` and `v2.26.1`. The self-match failure without `^` was confirmed first
  (`... v2.27.0` → `v2.27.0`).
- `release-notes-draft.sh -v 2.27.0 --to v2.27.0` → range `v2.26.0..v2.27.0`, 6 commits (8 minus the
  two version bumps).
- Version math extracted and exercised: `2.27.0 --minor` → `2.28.0` (not `2.27.1`), `2.27.14 --minor`
  → `2.28.0`, `3.9.5 --minor` → `3.10.0`, plain bumps unchanged.
- `deploy.sh` argument guards run against the real script: unknown flag prints usage, `--minor -v`
  and `--minor --no-version` both refuse. All exit before Step 1, so `package.json` and git history
  were untouched.
- `bash -n` on both scripts; `npm run lint` clean (its `prettier --check .` covers the new `.yml` and
  the `.md` edits).
- Record-splitting fix: `git log` count vs. loop-processed count compared across five ranges
  (1, 6, 8, 9 and 6 commits); every range was short by exactly one before the fix and matches after.
  Regenerating the `v2.26.0..v2.27.0` notes produced a byte-identical file.
- Workflow end-to-end: a throwaway `v9.9.0` tag pushed on `develop`. First run confirmed the trigger,
  the checkout and the draft, and exposed both the duplicated heading and the dropped commit. Second
  run, after the fixes, produced a draft in the published shape — "What's Changed" first, both
  commits present, Full Changelog compare link last. Draft and tag then deleted from origin; the 26
  real releases and 160 `v*` tags were verified intact.

## Assumptions and limitations

- **The boundary query is only correct going forward.** Minors were previously bumped for change
  size, so `v2.24.0` exists as a tag but `v2.24.3` was the release, and 13 of the 26 published
  releases were patch versions. `git describe --match 'v*.0'` over pre-`v2.27.0` history will name
  minor tags that were never released. Nothing breaks — the next range is `v2.27.0..v2.28.0`, both
  genuine boundaries — but the query is not for archaeology.
- **The workflow cannot fire retroactively.** `v2.27.0` was already tagged and pushed before it
  existed, so that release is cut by hand; `v2.28.0` is the first fully automated one.
- **A release cut from `develop` points at a commit not yet on `main`.** The tag is pushed on deploy
  and the promotion PR follows, so the release briefly references a commit that reaches `main` only
  later. Harmless — the tag is what the release resolves against.
- **The deleted mirror fired once more, from the tag.** Publishing `v2.27.0` by hand ran
  `release-tag.yml` out of that tag's tree (see decision 4), and it failed 403 creating
  `refs/tags/release/v2.27.0`. Harmless, and arguably the right outcome — that namespace is
  intentionally gone, so the failure protected the cleanup rather than breaking anything. It says
  nothing about `release-draft.yml`, whose identical `contents: write` `GITHUB_TOKEN` was proven
  end-to-end by the `v9.9.0` smoke test.
- **Deleting the draft is the only undo.** If a `v*.0` tag is pushed by mistake, delete the draft
  release; re-pushing the same tag will not re-draft it, since the workflow skips tags that already
  have a release.
