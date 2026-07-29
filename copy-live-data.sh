#!/bin/bash
# Copy live data from remote production server to local dev environment

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${DEPLOY_ENV_FILE:-$SCRIPT_DIR/deploy.env}"

# Function to print colored output
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

# Configuration is shared with deploy.sh and lives in the gitignored deploy.env
if [[ ! -f "$CONFIG_FILE" ]]; then
    print_error "Configuration file not found: $CONFIG_FILE"
    print_error "Create it from the template and fill in your values:"
    print_error "  cp deploy.env.example deploy.env && chmod 600 deploy.env"
    exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG_FILE"

if [[ -z "$REMOTE_HOST" || -z "$REMOTE_DATA_DIR" ]]; then
    print_error "REMOTE_HOST and REMOTE_DATA_DIR must be set in $CONFIG_FILE"
    exit 1
fi

# Default league (overridden by the -l/--league argument)
LEAGUE="$DEFAULT_LEAGUE"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -l|--league)
            LEAGUE="$2"
            shift 2
            ;;
        *)
            LEAGUE="$1"
            shift
            ;;
    esac
done

# Validate league name
if [[ -z "$LEAGUE" ]]; then
    print_error "League name cannot be empty"
    echo "Usage: $0 [LEAGUE_NAME]"
    echo "   or: $0 -l|--league LEAGUE_NAME"
    echo ""
    echo "Examples:"
    echo "  $0 pirates"
    echo "  $0 --league pirates"
    exit 1
fi

print_step "Copying live data for league: $LEAGUE"

# Create local data directory if it doesn't exist
LOCAL_DATA_DIR="./data"
LOCAL_LEAGUE_DIR="$LOCAL_DATA_DIR/$LEAGUE"

if [[ ! -d "$LOCAL_DATA_DIR" ]]; then
    print_step "Creating local data directory..."
    mkdir -p "$LOCAL_DATA_DIR"
fi

# Backup existing local data if it exists
if [[ -d "$LOCAL_LEAGUE_DIR" ]]; then
    BACKUP_DIR="${LOCAL_LEAGUE_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
    print_warning "Local league directory exists. Creating backup at $BACKUP_DIR"
    mv "$LOCAL_LEAGUE_DIR" "$BACKUP_DIR"
fi

# Copy data from remote server
REMOTE_LEAGUE_PATH="${REMOTE_DATA_DIR}/${LEAGUE}"
print_step "Copying from remote: ${REMOTE_HOST}:${REMOTE_LEAGUE_PATH}"

if ! scp -r "${REMOTE_HOST}:${REMOTE_LEAGUE_PATH}" "$LOCAL_DATA_DIR/"; then
    print_error "Failed to copy data from remote server"

    # Restore backup if copy failed
    if [[ -d "$BACKUP_DIR" ]]; then
        print_step "Restoring backup..."
        mv "$BACKUP_DIR" "$LOCAL_LEAGUE_DIR"
    fi

    exit 1
fi

# Remove backup if copy was successful
if [[ -d "$BACKUP_DIR" ]]; then
    print_step "Removing backup (copy successful)..."
    rm -rf "$BACKUP_DIR"
fi

print_success "Successfully copied live data for league '$LEAGUE'"
print_step "Local directory: $LOCAL_LEAGUE_DIR"

# Show what was copied
if command -v tree &> /dev/null; then
    print_step "Directory structure:"
    tree -L 2 "$LOCAL_LEAGUE_DIR"
else
    print_step "Files copied:"
    ls -lh "$LOCAL_LEAGUE_DIR"
fi
