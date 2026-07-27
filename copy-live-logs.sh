#!/bin/bash
# Copy live logs from remote production server to local dev environment

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${DEPLOY_ENV_FILE:-$SCRIPT_DIR/deploy.env}"
LOCAL_LOGS_DIR="./logs"

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

if [[ -z "$REMOTE_HOST" || -z "$REMOTE_LOGS_DIR" ]]; then
    print_error "REMOTE_HOST and REMOTE_LOGS_DIR must be set in $CONFIG_FILE"
    exit 1
fi

# Create local logs directory if it doesn't exist
if [[ ! -d "$LOCAL_LOGS_DIR" ]]; then
    print_step "Creating local logs directory..."
    mkdir -p "$LOCAL_LOGS_DIR"
fi

# Get list of log files and their modification dates from remote (Windows host)
print_step "Fetching log file list from ${REMOTE_HOST}:${REMOTE_LOGS_DIR}..."
REMOTE_FILES=$(ssh "$REMOTE_HOST" "powershell -Command \"Get-ChildItem '$REMOTE_LOGS_DIR' -Filter *.log | ForEach-Object { \$_.Name + '|' + \$_.LastWriteTime.ToString('yyyyMMdd') }\"" 2>/dev/null | tr -d '\r') || {
    print_error "Failed to list remote log files"
    exit 1
}

if [[ -z "$REMOTE_FILES" ]]; then
    print_warning "No log files found in ${REMOTE_HOST}:${REMOTE_LOGS_DIR}"
    exit 0
fi

COPIED=0

while IFS='|' read -r filename date_str; do
    [[ -z "$filename" ]] && continue

    # Try to extract a date from the filename first (supports YYYY-MM-DD or YYYYMMDD)
    if [[ "$filename" =~ ([0-9]{4})-([0-9]{2})-([0-9]{2}) ]]; then
        DATE_STR="${BASH_REMATCH[1]}${BASH_REMATCH[2]}${BASH_REMATCH[3]}"
    elif [[ "$filename" =~ ([0-9]{8}) ]]; then
        DATE_STR="${BASH_REMATCH[1]}"
    else
        # Use the file's last modified date from PowerShell output
        DATE_STR="${date_str:-$(date +%Y%m%d)}"
    fi

    LOCAL_NAME="app.live.${DATE_STR}.log"
    LOCAL_PATH="${LOCAL_LOGS_DIR}/${LOCAL_NAME}"

    print_step "Copying '$filename' -> '$LOCAL_NAME'..."

    if scp "${REMOTE_HOST}:${REMOTE_LOGS_DIR}/${filename}" "$LOCAL_PATH"; then
        COPIED=$((COPIED + 1))
    else
        print_error "Failed to copy '$filename'"
    fi
done <<< "$REMOTE_FILES"

print_success "Done. Copied $COPIED log file(s) to $LOCAL_LOGS_DIR"
print_step "Files:"
ls -lh "$LOCAL_LOGS_DIR"/app.live.*.log 2>/dev/null || true
