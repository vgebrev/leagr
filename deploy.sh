#!/bin/bash

# Bash Deployment Script for WSL
set -e  # Exit on any error

# Configuration
APP_NAME="pirates-footy-roster"
REMOTE_HOST="lesley-desktop-deploy"
REMOTE_DEPLOY_DIR="C:/$APP_NAME/docker"
REMOTE_DATA_DIR="C:/$APP_NAME/data"
API_KEY="09a5ca6a-5d61-48e8-a872-219ebb995b91"
ALLOWED_ORIGIN="https://footy.gebrev.com,https://localhost:3000"
PORT=3000

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

# Parse command line arguments
VERSION=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        *)
            echo "Usage: $0 [-v|--version VERSION]"
            exit 1
            ;;
    esac
done

# Step 1: Determine version
if [[ -z "$VERSION" ]]; then
    print_step "No version specified. Reading and incrementing patch version from package.json..."

    if [[ ! -f "package.json" ]]; then
        print_error "package.json not found"
        exit 1
    fi

    # Extract current version using jq (or node if jq not available)
    if command -v jq &> /dev/null; then
        CURRENT_VERSION=$(jq -r '.version' package.json)
    else
        CURRENT_VERSION=$(node -p "require('./package.json').version")
    fi

    # Parse version components
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=$((${VERSION_PARTS[2]} + 1))
    VERSION="$MAJOR.$MINOR.$PATCH"

    print_step "Proposed new version: $VERSION"
fi

# Step 2: Build Docker image
print_step "Building Docker image ${APP_NAME}:${VERSION}..."
if ! docker build -t "${APP_NAME}:${VERSION}" .; then
    print_error "Docker build failed"
    exit 1
fi

# Step 3: Save image
TAR_FILE="${APP_NAME}-${VERSION}.tar"
print_step "Saving Docker image to $TAR_FILE..."
if ! docker save -o "$TAR_FILE" "${APP_NAME}:${VERSION}"; then
    print_error "Docker save failed"
    exit 1
fi

# Step 4: Copy image to production
print_step "Copying image to production server..."
if ! scp "$TAR_FILE" "${REMOTE_HOST}:${REMOTE_DEPLOY_DIR}/"; then
    print_error "SCP to remote server failed"
    exit 1
fi

# Step 5: Deploy remotely
print_step "Loading image on production server..."
if ! ssh "$REMOTE_HOST" "docker load -i ${REMOTE_DEPLOY_DIR}/$TAR_FILE"; then
    print_error "Remote docker load failed"
    exit 1
fi

print_step "Stopping existing container..."
if ! ssh "$REMOTE_HOST" "docker stop ${APP_NAME}" 2>/dev/null; then
    echo "Warning: Could not stop existing container (it may not be running)"
fi

print_step "Removing existing container..."
if ! ssh "$REMOTE_HOST" "docker rm ${APP_NAME}" 2>/dev/null; then
    echo "Warning: Could not remove existing container (it may not exist)"
fi

print_step "Starting new container..."
if ! ssh "$REMOTE_HOST" "docker run -d --name ${APP_NAME} --restart unless-stopped -p ${PORT}:${PORT} -v ${REMOTE_DATA_DIR}:/app/data -e ALLOWED_ORIGIN=${ALLOWED_ORIGIN} -e API_KEY=${API_KEY} ${APP_NAME}:${VERSION}"; then
    print_error "Failed to start new container"
    exit 1
fi

# Step 6: Apply version to package.json
print_step "Finalizing: writing version $VERSION to package.json..."
if ! npm version "$VERSION" --no-git-tag-version; then
    print_error "Failed to update package.json version"
    exit 1
fi

# Step 7: Clean up
print_step "Cleaning up: Removing local tarball..."
rm -f "$TAR_FILE"

print_step "Cleaning up: Removing old tarball from production server..."
# Convert forward slashes to backslashes for Windows path
WINDOWS_DEPLOY_DIR=$(echo "$REMOTE_DEPLOY_DIR" | sed 's/\//\\/g')
ssh "$REMOTE_HOST" "del /Q \"${WINDOWS_DEPLOY_DIR}\\$TAR_FILE\""

print_success "Deployment complete: $APP_NAME version $VERSION is now running on prod."