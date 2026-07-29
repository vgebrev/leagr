#!/bin/bash

# Reconcile GitHub Releases with local release/* git tags.
#
# deploy.sh tags every deploy as vX.Y.Z, but only a subset of those are promoted
# to a GitHub Release. This script reads the release list from the GitHub API and
# creates a release/vX.Y.Z tag on the same commit for each one, so the promoted
# subset is queryable from git:
#
#   git describe --tags --match 'release/v*' --abbrev=0    # last release
#
# Going forward .github/workflows/release-tag.yml creates these tags
# automatically when a release is published; this script backfills releases
# published before that existed, and reconciles if the workflow is ever skipped.
#
# Needs no credentials for a public repository. Set GITHUB_TOKEN to raise the
# rate limit or to read a private repo.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_step() {
    echo -e "\033[1;34m$1\033[0m"
}

print_error() {
    echo -e "\033[1;31mError: $1\033[0m" >&2
}

print_success() {
    echo -e "\033[1;32m$1\033[0m"
}

print_warning() {
    echo -e "\033[1;33mWarning: $1\033[0m"
}

DRY_RUN=false
PUSH=true
INCLUDE_PRERELEASES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-push)
            PUSH=false
            shift
            ;;
        --include-prereleases)
            INCLUDE_PRERELEASES=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--dry-run] [--no-push] [--include-prereleases]"
            echo
            echo "  --dry-run              report what would change, touch nothing"
            echo "  --no-push              create tags locally but do not push them"
            echo "  --include-prereleases  mirror prereleases too (skipped by default)"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

if ! command -v jq >/dev/null 2>&1; then
    print_error "jq is required but not installed."
    exit 1
fi

# Derive owner/repo from the origin URL. Handles both https:// and ssh forms,
# including ssh config host aliases (git@github.com-gmail:owner/repo.git).
REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
if [[ -z "$REMOTE_URL" ]]; then
    print_error "No 'origin' remote found."
    exit 1
fi
REPO_SLUG=$(echo "$REMOTE_URL" | sed -E 's#\.git$##; s#^.*[:/]([^/:]+/[^/]+)$#\1#')
if [[ ! "$REPO_SLUG" =~ ^[^/]+/[^/]+$ ]]; then
    print_error "Could not parse owner/repo from origin URL: $REMOTE_URL"
    exit 1
fi

print_step "Repository: $REPO_SLUG"

AUTH_HEADER=()
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    AUTH_HEADER=(-H "Authorization: Bearer $GITHUB_TOKEN")
    print_step "Using GITHUB_TOKEN for API requests"
fi

# Pull down any release/* tags the workflow already created, so they are not
# re-created here. Best-effort: an offline run can still reconcile locally.
if ! git fetch --tags --quiet origin 2>/dev/null; then
    print_warning "Could not fetch from origin - working with local tags only"
fi

print_step "Fetching releases from GitHub..."

RELEASES=""
PAGE=1
while true; do
    RESPONSE=$(curl -sS --max-time 30 "${AUTH_HEADER[@]}" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/${REPO_SLUG}/releases?per_page=100&page=${PAGE}")

    if ! echo "$RESPONSE" | jq -e 'type == "array"' >/dev/null 2>&1; then
        print_error "Unexpected API response: $(echo "$RESPONSE" | jq -r '.message // .' | head -1)"
        exit 1
    fi

    COUNT=$(echo "$RESPONSE" | jq 'length')
    [[ "$COUNT" -eq 0 ]] && break

    # tag_name<TAB>prerelease, drafts excluded (they have no published commit)
    PAGE_TAGS=$(echo "$RESPONSE" | jq -r '.[] | select(.draft == false) | "\(.tag_name)\t\(.prerelease)"')
    RELEASES+="${PAGE_TAGS}"$'\n'

    [[ "$COUNT" -lt 100 ]] && break
    PAGE=$((PAGE + 1))
done

RELEASES=$(echo "$RELEASES" | sed '/^$/d')
if [[ -z "$RELEASES" ]]; then
    print_warning "No published releases found."
    exit 0
fi

print_step "Found $(echo "$RELEASES" | wc -l) published release(s)"
echo

CREATED_TAGS=()
SKIPPED=0
UNRESOLVED=0
SEEN_TAGS=""

while IFS=$'\t' read -r TAG PRERELEASE; do
    [[ -z "$TAG" ]] && continue

    if [[ "$PRERELEASE" == "true" && "$INCLUDE_PRERELEASES" != true ]]; then
        echo "  - $TAG: prerelease, skipped"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    RELEASE_TAG="release/$TAG"
    SEEN_TAGS+="${RELEASE_TAG}"$'\n'

    if git rev-parse -q --verify "refs/tags/$RELEASE_TAG" >/dev/null; then
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    # Prefer the local tag; fall back to the API when it was never fetched.
    if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
        SHA=$(git rev-list -n 1 "$TAG")
    else
        REF_JSON=$(curl -sS --max-time 30 "${AUTH_HEADER[@]}" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${REPO_SLUG}/git/ref/tags/${TAG}")
        SHA=$(echo "$REF_JSON" | jq -r '.object.sha // empty')
        if [[ "$(echo "$REF_JSON" | jq -r '.object.type // empty')" == "tag" ]]; then
            SHA=$(curl -sS --max-time 30 "${AUTH_HEADER[@]}" \
                -H "Accept: application/vnd.github+json" \
                "https://api.github.com/repos/${REPO_SLUG}/git/tags/${SHA}" \
                | jq -r '.object.sha // empty')
        fi
        # The commit itself may not be present locally either.
        if [[ -n "$SHA" ]] && ! git cat-file -e "${SHA}^{commit}" 2>/dev/null; then
            print_warning "$TAG: commit $SHA not present locally (try: git fetch --all --tags)"
            UNRESOLVED=$((UNRESOLVED + 1))
            continue
        fi
    fi

    if [[ -z "$SHA" ]]; then
        print_warning "$TAG: could not resolve to a commit, skipped"
        UNRESOLVED=$((UNRESOLVED + 1))
        continue
    fi

    if [[ "$DRY_RUN" == true ]]; then
        echo "  + would create $RELEASE_TAG at ${SHA:0:7}"
    else
        git tag -a "$RELEASE_TAG" "$SHA" -m "GitHub release $TAG"
        echo "  + created $RELEASE_TAG at ${SHA:0:7}"
    fi
    CREATED_TAGS+=("$RELEASE_TAG")
done <<< "$RELEASES"

echo

# Local release/* tags with no corresponding GitHub release. Reported only -
# deleting tags is never done automatically.
STALE=$(git tag --list 'release/v*' | grep -vxF -f <(echo "$SEEN_TAGS") || true)
if [[ -n "$STALE" ]]; then
    print_warning "Local release tags with no matching GitHub release:"
    echo "$STALE" | sed 's/^/    /'
    echo
fi

if [[ ${#CREATED_TAGS[@]} -eq 0 ]]; then
    print_success "Already in sync - $SKIPPED release tag(s) present, nothing to create."
    [[ "$UNRESOLVED" -gt 0 ]] && print_warning "$UNRESOLVED release(s) could not be resolved."
    exit 0
fi

if [[ "$DRY_RUN" == true ]]; then
    print_success "Dry run: ${#CREATED_TAGS[@]} tag(s) would be created, $SKIPPED already present."
    exit 0
fi

if [[ "$PUSH" == true ]]; then
    print_step "Pushing ${#CREATED_TAGS[@]} tag(s) to origin..."
    if git push origin "${CREATED_TAGS[@]}"; then
        print_success "Created and pushed ${#CREATED_TAGS[@]} release tag(s)."
    else
        print_error "Tags were created locally but the push failed."
        print_error "Retry with: git push origin ${CREATED_TAGS[*]}"
        exit 1
    fi
else
    print_success "Created ${#CREATED_TAGS[@]} release tag(s) locally (not pushed)."
    echo "  git push origin ${CREATED_TAGS[*]}"
fi

[[ "$UNRESOLVED" -gt 0 ]] && print_warning "$UNRESOLVED release(s) could not be resolved."
exit 0
