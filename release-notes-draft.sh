#!/bin/bash

# Scaffold a release notes draft from the commits since the last release.
#
# A minor bump is a release: vX.Y.0 was announced, vX.Y.Z (Z>0) was just a
# deploy. So the range starts at the last vX.Y.0 tag, and "since the last
# release" means the last release you actually published - not the last deploy.
# Commits are grouped by conventional-commit type into the same section headings
# the published notes use.
#
# The output is a draft: bullets are raw commit subjects and still need
# rewriting into user-facing prose. The raw log is appended for reference and
# should be deleted before publishing.
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

VERSION=""
FROM_REF=""
TO_REF="HEAD"
OUTPUT=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        --from)
            FROM_REF="$2"
            shift 2
            ;;
        --to)
            TO_REF="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [-v VERSION] [--from REF] [--to REF] [-o FILE] [-f]"
            echo
            echo "  -v, --version  version for the notes (default: package.json version)"
            echo "      --from     start of the range, exclusive (default: last vX.Y.0 tag)"
            echo "      --to       end of the range, inclusive (default: HEAD)"
            echo "  -o, --output   output file (default: RELEASE-NOTES-v<version>.md)"
            echo "  -f, --force    overwrite an existing output file"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

if [[ -z "$VERSION" ]]; then
    if command -v jq >/dev/null 2>&1; then
        VERSION=$(jq -r '.version' package.json)
    else
        VERSION=$(node -p "require('./package.json').version")
    fi
fi
VERSION="${VERSION#v}"

# Default start of range: the last release (vX.Y.0) reachable from --to.
# Resolved from the parent of --to, not --to itself: git describe returns a ref's
# own tag, so `--to v2.28.0` would otherwise resolve the start to v2.28.0 and
# leave an empty range.
if [[ -z "$FROM_REF" ]]; then
    FROM_REF=$(git describe --tags --match 'v*.0' --abbrev=0 "${TO_REF}^" 2>/dev/null || true)
    if [[ -z "$FROM_REF" ]]; then
        print_error "No vX.Y.0 tag found before $TO_REF - cannot determine the last release."
        print_error "Pass --from explicitly."
        exit 1
    fi
fi

if ! git rev-parse -q --verify "${FROM_REF}^{commit}" >/dev/null; then
    print_error "Not a valid ref: $FROM_REF"
    exit 1
fi

RANGE="${FROM_REF}..${TO_REF}"
OUTPUT="${OUTPUT:-RELEASE-NOTES-v${VERSION}.md}"

if [[ -f "$OUTPUT" && "$FORCE" != true ]]; then
    print_error "$OUTPUT already exists. Use --force to overwrite."
    exit 1
fi

# Version bump commits are release markers, not content.
BUMP_FILTER='^chore: bump version to '

# type(scope)!: description - held in a variable because [[ =~ ]] mangles an
# inline pattern containing parentheses.
CONVENTIONAL_RE='^([a-z]+)(\(([^)]*)\))?!?:[[:space:]]*(.*)$'

COMMIT_COUNT=$(git log --no-merges --format='%s' "$RANGE" | grep -vcE "$BUMP_FILTER" || true)
if [[ "$COMMIT_COUNT" -eq 0 ]]; then
    print_warning "No commits in $RANGE (excluding version bumps)."
    exit 0
fi

print_step "Range:   $RANGE"
print_step "Version: v$VERSION"
print_step "Commits: $COMMIT_COUNT"

FEATURES=()
IMPROVEMENTS=()
FIXES=()
MAINTENANCE=()
OTHER=()

# %x1f separates fields, %x1e terminates records - neither occurs in commit text.
# %x1e must come last: as a prefix it leaves the final record undelimited, and
# `read` then hits EOF and returns before the loop body runs, silently dropping
# the newest commit.
while IFS=$'\x1f' read -r -d $'\x1e' SUBJECT BODY; do
    SUBJECT="${SUBJECT#$'\n'}"
    [[ -z "$SUBJECT" ]] && continue
    echo "$SUBJECT" | grep -qE "$BUMP_FILTER" && continue

    if [[ "$SUBJECT" =~ $CONVENTIONAL_RE ]]; then
        TYPE="${BASH_REMATCH[1]}"
        SCOPE="${BASH_REMATCH[3]}"
        DESC="${BASH_REMATCH[4]}"
    else
        TYPE=""
        SCOPE=""
        DESC="$SUBJECT"
    fi

    if [[ -n "$SCOPE" ]]; then
        BULLET="- **${SCOPE}** — ${DESC}"
    else
        BULLET="- ${DESC}"
    fi

    # Bulleted body lines usually enumerate the user-facing parts of the change;
    # prose bodies are left to the raw log at the bottom.
    SUB_BULLETS=$(echo "$BODY" | grep -E '^[[:space:]]*[-*][[:space:]]+' | sed -E 's/^[[:space:]]*[-*][[:space:]]+/    - /' || true)
    if [[ -n "$SUB_BULLETS" ]]; then
        BULLET+=$'\n'"$SUB_BULLETS"
    fi

    case "$TYPE" in
        feat)
            FEATURES+=("$BULLET")
            ;;
        fix)
            FIXES+=("$BULLET")
            ;;
        perf|refactor|style)
            IMPROVEMENTS+=("$BULLET")
            ;;
        chore|docs|test|ci|build)
            MAINTENANCE+=("$BULLET")
            ;;
        *)
            OTHER+=("$BULLET")
            ;;
    esac
done < <(git log --no-merges --reverse --format="%s%x1f%b%x1e" "$RANGE")

{
    echo "# Release v${VERSION}"
    echo
    echo "<!-- DRAFT generated by release-notes-draft.sh from ${RANGE} (${COMMIT_COUNT} commits)."
    echo "     Bullets are raw commit subjects: rewrite them as user-facing prose, move them"
    echo "     between sections as needed, drop anything not worth telling players about,"
    echo "     then delete this comment and the raw log at the bottom. -->"
    echo
    echo "## What's Changed"

    emit_section() {
        local heading="$1"
        shift
        [[ $# -eq 0 ]] && return 0
        echo
        echo "$heading"
        echo
        printf '%s\n' "$@"
    }

    emit_section "New Features" "${FEATURES[@]}"
    emit_section "Improvements" "${IMPROVEMENTS[@]}"
    emit_section "Bug Fixes" "${FIXES[@]}"
    emit_section "Maintenance" "${MAINTENANCE[@]}"
    emit_section "Uncategorised" "${OTHER[@]}"

    echo
    echo "<details>"
    echo "<summary>Raw commits (delete before publishing)</summary>"
    echo
    git log --no-merges --reverse --format='### %h %s%n%n%b' "$RANGE" \
        | grep -vE "^### [0-9a-f]+ chore: bump version to " \
        | cat -s
    echo
    echo "</details>"
} > "$OUTPUT"

print_success "Wrote $OUTPUT"
