#!/bin/bash

# Bash deployment script: local Ubuntu -> remote Windows (cmd.exe) host
#
# All environment-specific configuration (target host, paths, secrets) is read
# from deploy.env, which is gitignored. Before first use:
#   cp deploy.env.example deploy.env && chmod 600 deploy.env
# then fill in your values. Override the location with DEPLOY_ENV_FILE.
#
# A minor bump is a release. `--minor` produces vX.Y.0, and pushing that tag
# opens a draft GitHub Release (.github/workflows/release-draft.yml); a plain
# run bumps the patch and just deploys. The commit and tag are pushed to origin
# once the deploy has succeeded.
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

# Load configuration
if [[ ! -f "$CONFIG_FILE" ]]; then
    print_error "Configuration file not found: $CONFIG_FILE"
    print_error "Create it from the template and fill in your values:"
    print_error "  cp deploy.env.example deploy.env && chmod 600 deploy.env"
    exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG_FILE"

# Fail fast, reporting every missing variable at once rather than one per run
require_var() {
    local missing=()
    local name
    for name in "$@"; do
        if [[ -z "${!name}" ]]; then
            missing+=("$name")
        fi
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        print_error "Missing required configuration in $CONFIG_FILE:"
        for name in "${missing[@]}"; do
            print_error "  - $name"
        done
        print_error "See deploy.env.example for the full key list."
        exit 1
    fi
}

require_var APP_NAME REMOTE_HOST REMOTE_DEPLOY_DIR REMOTE_DATA_DIR REMOTE_LOGS_DIR PORT \
    ALLOWED_ORIGIN APP_URL SESSION_SECRET BODY_SIZE_LIMIT LOG_LEVEL \
    MAILGUN_SENDING_KEY MAILGUN_DOMAIN

# Container runtime environment. Optional values are appended only when set, so
# the app's own fallbacks still apply when they are left empty.
DOCKER_ENV_ARGS="-e ALLOWED_ORIGIN=${ALLOWED_ORIGIN}"
DOCKER_ENV_ARGS+=" -e SESSION_SECRET=${SESSION_SECRET}"
DOCKER_ENV_ARGS+=" -e APP_URL=${APP_URL}"
# The app reads MAILGUN_API_KEY (see src/hooks.server.js), not MAILGUN_SENDING_KEY.
DOCKER_ENV_ARGS+=" -e MAILGUN_API_KEY=${MAILGUN_SENDING_KEY}"
DOCKER_ENV_ARGS+=" -e MAILGUN_DOMAIN=${MAILGUN_DOMAIN}"
DOCKER_ENV_ARGS+=" -e BODY_SIZE_LIMIT=${BODY_SIZE_LIMIT}"
DOCKER_ENV_ARGS+=" -e LOG_LEVEL=${LOG_LEVEL}"
if [[ -n "$PLAYER_OWNER_SALT" ]]; then
    DOCKER_ENV_ARGS+=" -e PLAYER_OWNER_SALT=${PLAYER_OWNER_SALT}"
fi
if [[ -n "$OPENAI_API_KEY" ]]; then
    DOCKER_ENV_ARGS+=" -e OPENAI_API_KEY=${OPENAI_API_KEY}"
    DOCKER_ENV_ARGS+=" -e OPENAI_MODEL=${OPENAI_MODEL}"
else
    print_warning "OPENAI_API_KEY not set - AI team-logo generation will be disabled"
fi

# Rollback state variables
PREVIOUS_VERSION=""
GIT_TAG_CREATED=false
PACKAGE_JSON_MODIFIED=false
GIT_PUSHED=false
REMOTE_CONTAINER_STOPPED=false
OLD_CONTAINER_BACKED_UP=false
DOCKER_IMAGE_BUILT=false
TAR_FILE_CREATED=false
TAR_FILE_COPIED=false
REMOTE_IMAGE_LOADED=false

# Rollback function
rollback() {
    local reason="$1"
    print_error "Deployment failed: $reason"
    print_step "Initiating rollback..."
    
    # Stop and remove new container if it was created
    if [[ "$REMOTE_CONTAINER_STOPPED" == true ]]; then
        print_step "Cleaning up failed new container..."
        ssh "$REMOTE_HOST" "docker stop ${APP_NAME} 2>nul" || true
        ssh "$REMOTE_HOST" "docker rm ${APP_NAME} 2>nul" || true
    fi
    
    # Restore previous container if we backed it up
    if [[ "$OLD_CONTAINER_BACKED_UP" == true ]]; then
        print_step "Restoring previous container..."
        ssh "$REMOTE_HOST" "docker rename ${APP_NAME}-backup ${APP_NAME} 2>nul" || true
        ssh "$REMOTE_HOST" "docker start ${APP_NAME} 2>nul" || true
    fi
    
    # Clean up remote artifacts
    if [[ "$REMOTE_IMAGE_LOADED" == true ]]; then
        print_step "Removing newly loaded remote image..."
        ssh "$REMOTE_HOST" "docker rmi ${APP_NAME}:${VERSION} 2>nul" || true
    fi
    
    if [[ "$TAR_FILE_COPIED" == true ]]; then
        print_step "Removing tar file from remote server..."
        WINDOWS_DEPLOY_DIR=$(echo "$REMOTE_DEPLOY_DIR" | sed 's/\//\\/g')
        ssh "$REMOTE_HOST" "del /Q \"${WINDOWS_DEPLOY_DIR}\\${TAR_FILE}\" 2>nul" || true
    fi
    
    # Clean up local artifacts
    if [[ "$TAR_FILE_CREATED" == true ]]; then
        print_step "Removing local tar file..."
        rm -f "$TAR_FILE" || true
    fi
    
    if [[ "$DOCKER_IMAGE_BUILT" == true ]]; then
        print_step "Removing local Docker image..."
        docker rmi "${APP_NAME}:${VERSION}" 2>/dev/null || true
    fi
    
    # Revert git changes if we made them - but never after they have been
    # pushed, since a hard reset over published history is not recoverable
    # locally.
    if [[ "$GIT_PUSHED" == true ]]; then
        print_warning "v$VERSION was already pushed to origin - leaving git history alone."
    else
        if [[ "$GIT_TAG_CREATED" == true ]]; then
            print_step "Removing git tag v$VERSION..."
            git tag -d "v$VERSION" 2>/dev/null || true
        fi

        if [[ "$PACKAGE_JSON_MODIFIED" == true ]]; then
            print_step "Reverting version commit (hard reset to HEAD~1)..."
            git reset --hard HEAD~1 2>/dev/null || true
        fi
    fi
    
    print_error "Rollback completed. Deployment aborted."
    exit 1
}

# Trap to ensure rollback on any error
trap 'rollback "Unexpected error occurred"' ERR

# Parse command line arguments
VERSION=""
NO_VERSION=false
MINOR_BUMP=false
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -m|--minor)
            MINOR_BUMP=true
            shift
            ;;
        --no-version)
            NO_VERSION=true
            shift
            ;;
        *)
            echo "Usage: $0 [-v|--version VERSION] [-m|--minor] [--no-version]"
            echo
            echo "  -v, --version  deploy a specific version"
            echo "  -m, --minor    bump the minor version - marks this deploy as a release"
            echo "      --no-version  deploy without versioning or tagging"
            exit 1
            ;;
    esac
done

if [[ "$MINOR_BUMP" == true ]] && { [[ -n "$VERSION" ]] || [[ "$NO_VERSION" == true ]]; }; then
    print_error "--minor cannot be combined with --version or --no-version."
    exit 1
fi

# Step 1: Determine and apply version upfront
if [[ "$NO_VERSION" == true ]]; then
    VERSION="latest"
    print_step "Using version: latest (no versioning)"
elif [[ -z "$VERSION" ]]; then
    if [[ "$MINOR_BUMP" == true ]]; then
        print_step "Reading and incrementing minor version from package.json..."
    else
        print_step "No version specified. Reading and incrementing patch version from package.json..."
    fi

    if [[ ! -f "package.json" ]]; then
        rollback "package.json not found"
    fi

    # Extract current version using jq (or node if jq not available)
    if command -v jq &> /dev/null; then
        PREVIOUS_VERSION=$(jq -r '.version' package.json)
    else
        PREVIOUS_VERSION=$(node -p "require('./package.json').version")
    fi

    # Parse version components. A minor bump is the release marker: vX.Y.0 gets
    # a draft GitHub Release, vX.Y.Z (Z>0) is a routine deploy.
    IFS='.' read -ra VERSION_PARTS <<< "$PREVIOUS_VERSION"
    MAJOR=${VERSION_PARTS[0]}
    if [[ "$MINOR_BUMP" == true ]]; then
        MINOR=$((${VERSION_PARTS[1]} + 1))
        PATCH=0
    else
        MINOR=${VERSION_PARTS[1]}
        PATCH=$((${VERSION_PARTS[2]} + 1))
    fi
    VERSION="$MAJOR.$MINOR.$PATCH"

    print_step "Current version: $PREVIOUS_VERSION"
    print_step "New version: $VERSION"
else
    # Get current version for rollback purposes
    if [[ -f "package.json" ]]; then
        if command -v jq &> /dev/null; then
            PREVIOUS_VERSION=$(jq -r '.version' package.json)
        else
            PREVIOUS_VERSION=$(node -p "require('./package.json').version")
        fi
    fi
    print_step "Using specified version: $VERSION"
fi

# Step 1.1: Apply version upfront (unless --no-version)
if [[ "$NO_VERSION" != true ]]; then
    print_step "Checking git status..."
    
    # Enforce clean git state
    if ! git diff --quiet || ! git diff --cached --quiet; then
        print_error "Working directory has uncommitted changes!"
        print_error "Please commit or stash your changes before deploying."
        print_error "Run 'git status' to see uncommitted changes."
        exit 1
    fi
    
    print_step "Applying version $VERSION to package.json..."
    
    # Update package.json
    if ! npm version "$VERSION" --no-git-tag-version; then
        rollback "Failed to update package.json version"
    fi
    PACKAGE_JSON_MODIFIED=true
    
    # Commit the version change
    git add package.json package-lock.json
    if ! git commit -m "chore: bump version to $VERSION"; then
        rollback "Failed to commit version change"
    fi
    
    # Create git tag
    if ! git tag -a "v$VERSION" -m "Release version $VERSION"; then
        rollback "Failed to create git tag"
    fi
    GIT_TAG_CREATED=true
    
    print_success "Version $VERSION applied and committed with tag v$VERSION"
else
    print_step "Skipping version application (--no-version flag)"
fi

# Step 1.2: Clean up existing latest images if --no-version
if [[ "$NO_VERSION" == true ]]; then
    print_step "Cleaning up existing 'latest' images and containers..."
    
    # Remove existing container
    if docker ps -a --format "table {{.Names}}" | grep -q "^${APP_NAME}$"; then
        docker stop "${APP_NAME}" 2>/dev/null || true
        docker rm "${APP_NAME}" 2>/dev/null || true
    fi
    
    # Remove existing latest image
    if docker images --format "table {{.Repository}}:{{.Tag}}" | grep -q "^${APP_NAME}:latest$"; then
        docker rmi "${APP_NAME}:latest" 2>/dev/null || true
    fi
fi

# Step 2: Run tests
print_step "Running tests..."
if ! npm test; then
    rollback "Tests failed"
fi

# Step 3: Build Docker image
print_step "Building Docker image ${APP_NAME}:${VERSION}..."
if ! docker build -t "${APP_NAME}:${VERSION}" .; then
    rollback "Docker build failed"
fi
DOCKER_IMAGE_BUILT=true

# Step 4: Save image
TAR_FILE="${APP_NAME}-${VERSION}.tar"
print_step "Saving Docker image to $TAR_FILE..."
if ! docker save -o "$TAR_FILE" "${APP_NAME}:${VERSION}"; then
    rollback "Docker save failed"
fi
TAR_FILE_CREATED=true

# Step 5: Copy image to production
print_step "Copying image to production server..."
if ! scp "$TAR_FILE" "${REMOTE_HOST}:${REMOTE_DEPLOY_DIR}/"; then
    rollback "SCP to remote server failed"
fi
TAR_FILE_COPIED=true

# Step 6: Deploy remotely with backup
print_step "Loading image on production server..."
if ! ssh "$REMOTE_HOST" "docker load -i ${REMOTE_DEPLOY_DIR}/$TAR_FILE"; then
    rollback "Remote docker load failed"
fi
REMOTE_IMAGE_LOADED=true

print_step "Backing up existing container..."
if ssh "$REMOTE_HOST" "docker ps -q -f name=^${APP_NAME}$" | grep -q .; then
    print_step "Current container is running, creating backup..."
    if ssh "$REMOTE_HOST" "docker rename ${APP_NAME} ${APP_NAME}-backup"; then
        OLD_CONTAINER_BACKED_UP=true
        print_step "Container renamed to ${APP_NAME}-backup"
        # Stop the backup container to free up the port
        print_step "Stopping backup container to free up port ${PORT}..."
        if ssh "$REMOTE_HOST" "docker stop ${APP_NAME}-backup"; then
            print_step "Backup container stopped successfully"
        else
            rollback "Failed to stop backup container - port conflict will occur"
        fi
    else
        rollback "Failed to backup existing running container"
    fi
elif ssh "$REMOTE_HOST" "docker ps -a -q -f name=^${APP_NAME}$" | grep -q .; then
    print_step "Stopped container exists, creating backup..."
    if ssh "$REMOTE_HOST" "docker rename ${APP_NAME} ${APP_NAME}-backup"; then
        OLD_CONTAINER_BACKED_UP=true
        print_step "Container backed up as ${APP_NAME}-backup"
    else
        rollback "Failed to backup existing stopped container"
    fi
else
    print_step "No existing container found"
fi

print_step "Starting new container..."
if ssh "$REMOTE_HOST" "docker run -d --name ${APP_NAME} --restart unless-stopped -p ${PORT}:3000 -v ${REMOTE_DATA_DIR}:/app/data -v ${REMOTE_LOGS_DIR}:/app/logs ${DOCKER_ENV_ARGS} ${APP_NAME}:${VERSION}"; then
    print_step "New container started successfully"
else
    rollback "Failed to start new container"
fi

print_step "Verifying new container is running..."
sleep 3
if ssh "$REMOTE_HOST" "docker ps -q -f name=^${APP_NAME}$" | grep -q .; then
    print_step "New container verified as running"
    REMOTE_CONTAINER_STOPPED=false  # Container is actually running successfully
else
    REMOTE_CONTAINER_STOPPED=true   # Container failed to stay running
    rollback "New container failed to start properly"
fi

# Disable error trap for cleanup phase - deployment succeeded, cleanup failures shouldn't rollback
trap - ERR

# Step 7: Clean up old images and containers
print_step "Cleaning up old Docker images and containers..."

# Remove backup container if deployment was successful
if [[ "$OLD_CONTAINER_BACKED_UP" == true ]]; then
    print_step "Removing backup container..."
    if ! ssh "$REMOTE_HOST" "docker rm ${APP_NAME}-backup 2>nul"; then
        print_warning "Failed to remove backup container (non-critical)"
    fi
fi

# Clean up old remote Docker images (keep last 3 versions)
# Remote host is Windows/cmd, so rank the tags locally and issue targeted removals.
print_step "Cleaning up old remote Docker images (keeping last 3 versions)..."
REMOTE_OLD_TAGS=$(ssh "$REMOTE_HOST" "docker images ${APP_NAME} --format \"{{.Tag}}\"" 2>/dev/null \
    | tr -d '\r' \
    | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' \
    | sort -V -r \
    | tail -n +4)

if [[ -n "$REMOTE_OLD_TAGS" ]]; then
    while read -r tag; do
        print_step "Removing remote image ${APP_NAME}:${tag}..."
        ssh "$REMOTE_HOST" "docker rmi ${APP_NAME}:${tag} 2>nul" \
            || print_warning "Failed to remove ${APP_NAME}:${tag} (non-critical)"
    done <<< "$REMOTE_OLD_TAGS"
else
    print_step "No old remote images to remove"
fi

# Prune leftover dangling layers on the remote
print_step "Pruning dangling remote images..."
if ! ssh "$REMOTE_HOST" "docker image prune -f 2>nul"; then
    print_warning "Failed to prune dangling remote images (non-critical)"
fi

# Local cleanup of old images (keep last 3 versions)
print_step "Cleaning up local Docker images (keeping last 3 versions)..."
if ! docker images "${APP_NAME}" --format '{{.Tag}}' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V -r | tail -n +4 | xargs -r -I {} docker rmi "${APP_NAME}:{}" 2>/dev/null; then
    print_warning "Failed to clean up old local Docker images (non-critical)"
fi

print_step "Cleaning up local tarball..."
rm -f "$TAR_FILE"

print_step "Cleaning up tarball from production server..."
# Convert forward slashes to backslashes for Windows path
WINDOWS_DEPLOY_DIR=$(echo "$REMOTE_DEPLOY_DIR" | sed 's/\//\\/g')
if ! ssh "$REMOTE_HOST" "del /Q \"${WINDOWS_DEPLOY_DIR}\\$TAR_FILE\" 2>nul"; then
    print_warning "Failed to remove remote tar file (non-critical)"
fi

print_success "Deployment complete: $APP_NAME version $VERSION is now running on prod."

# Push last, once the deploy has actually succeeded. A failure here is not worth
# rolling a live deployment back for, so it warns rather than aborting.
if [[ "$NO_VERSION" != true ]]; then
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    print_step "Pushing $CURRENT_BRANCH and tag v$VERSION to origin..."
    if git push origin "$CURRENT_BRANCH" && git push origin "v$VERSION"; then
        GIT_PUSHED=true
        print_success "Pushed $CURRENT_BRANCH and v$VERSION."
        if [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.0$ ]]; then
            print_success "v$VERSION is a release: a draft release is being prepared on GitHub."
            print_step "Review the wording and publish it: https://github.com/vgebrev/leagr/releases"
        fi
    else
        print_warning "Push failed. The deploy is live; push by hand when you can:"
        print_warning "  git push origin $CURRENT_BRANCH && git push origin v$VERSION"
    fi
fi