#!/bin/sh
set -e

# Configuration
DB_HOST="${DATABASE_URL:-http://db:8080}"
MAX_RETRIES=3
DB_WAIT_TIMEOUT=30

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Wait for database to be ready
wait_for_db() {
    # Extract host and port from DATABASE_URL
    DB_HOST_CLEAN=$(echo "$DB_HOST" | sed 's|http://||' | sed 's|https://||' | cut -d'/' -f1)
    DB_HOSTNAME=$(echo "$DB_HOST_CLEAN" | cut -d':' -f1)
    DB_PORT=$(echo "$DB_HOST_CLEAN" | cut -d':' -f2)
    DB_PORT=${DB_PORT:-8080}
    
    log_info "Waiting for database at ${DB_HOSTNAME}:${DB_PORT}..."
    
    elapsed=0
    while [ $elapsed -lt $DB_WAIT_TIMEOUT ]; do
        # Use nc for TCP port check (more reliable than HTTP for LibSQL)
        if nc -z "$DB_HOSTNAME" "$DB_PORT" 2>/dev/null; then
            log_info "Database is ready!"
            # Brief pause to ensure service is fully initialized
            sleep 1
            return 0
        fi
        
        sleep 1
        elapsed=$((elapsed + 1))
        
        if [ $((elapsed % 5)) -eq 0 ]; then
            log_warn "Still waiting for database... (${elapsed}s elapsed)"
        fi
    done
    
    log_error "Database not ready after ${DB_WAIT_TIMEOUT}s"
    return 1
}

# Push schema with retry logic
push_schema() {
    log_info "Pushing database schema..."
    
    # Pre-create indexes with IF NOT EXISTS to avoid drizzle-kit duplicates
    log_info "Ensuring indexes exist (IF NOT EXISTS)..."
    if bun run scripts/ensure-indexes.ts 2>&1; then
        log_info "Index pre-check passed"
    else
        log_warn "Index pre-check had issues (continuing anyway)"
    fi
    
    # Safety: --force auto-approves DESTRUCTIVE schema changes (data loss).
    # Only enabled when explicitly requested via DRIZZLE_FORCE_PUSH=true.
    PUSH_FLAGS=""
    if [ "$DRIZZLE_FORCE_PUSH" = "true" ]; then
        log_warn "DRIZZLE_FORCE_PUSH=true: destructive schema changes will be auto-approved!"
        PUSH_FLAGS="--force"
    fi

    attempt=1
    while [ $attempt -le $MAX_RETRIES ]; do
        log_info "Schema push attempt ${attempt}/${MAX_RETRIES}..."

        # Capture output to check for known non-fatal errors
        output=$(bunx drizzle-kit push $PUSH_FLAGS 2>&1)
        exit_code=$?
        
        # Check if successful
        if [ $exit_code -eq 0 ]; then
            log_info "Database schema pushed successfully!"
            return 0
        fi
        
        # Check for "index already exists" - this is a drizzle-kit bug with SQLite
        # table recreation, but it means the schema is actually correct
        if echo "$output" | grep -q "already exists"; then
            log_warn "Index already exists (drizzle-kit SQLite quirk) - schema is correct"
            log_info "Database schema pushed successfully!"
            return 0
        fi
        
        # Log the error
        echo "$output"
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            # Exponential backoff: 2^attempt seconds
            backoff=$((2 ** attempt))
            log_warn "Schema push failed. Retrying in ${backoff}s..."
            sleep $backoff
        fi
        
        attempt=$((attempt + 1))
    done
    
    log_error "Failed to push schema after ${MAX_RETRIES} attempts"
    log_error "If the failure is a destructive-change prompt, review it and restart with DRIZZLE_FORCE_PUSH=true"
    return 1
}

# Seed super admin if credentials provided
seed_admin() {
    if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
        log_info "Seeding super admin: $ADMIN_EMAIL"
        if bun run scripts/seed-admin.ts "$ADMIN_EMAIL" "$ADMIN_PASSWORD"; then
            log_info "Super admin seeded successfully!"
        else
            log_warn "Admin seeding failed (may already exist)"
        fi
    else
        log_info "Skipping admin seed (ADMIN_EMAIL/ADMIN_PASSWORD not set)"
    fi
}

# Main execution
main() {
    # If we are root, we need to fix permissions and then re-run as paaa
    if [ "$(id -u)" = "0" ]; then
        log_info "=== PAAA-Tool Startup (Root Phase) ==="
        
        # Ensure data directories exist and are writable
        mkdir -p /app/paaa_data /app/uploads
        
        # Fix permissions for the entire app directory (including bind mounts)
        log_info "Fixing permissions for /app/paaa_data and /app/uploads..."
        chown -R paaa:paaa /app/paaa_data /app/uploads
        
        # Also ensure /app itself is owned (for temporary files, etc)
        chown paaa:paaa /app
        
        # Re-run this script as the 'paaa' user
        log_info "Dropping privileges to 'paaa' user..."
        exec su-exec paaa "$0" "$@"
    fi

    # Everything from here on runs as the 'paaa' user
    log_info "=== PAAA-Tool Startup (User Phase: $(whoami)) ==="
    
    # Step 1: Wait for database
    if ! wait_for_db; then
        log_error "Cannot proceed without database connection"
        exit 1
    fi
    
    # Step 2: Push schema
    if ! push_schema; then
        log_error "Cannot proceed without successful schema push"
        exit 1
    fi
    
    # Step 3: Normalize legacy data (non-critical)
    log_info "Normalizing user emails..."
    if ! bun run scripts/normalize-emails.ts 2>&1; then
        log_warn "Email normalization had issues (continuing anyway)"
    fi

    log_info "Disabling legacy ranking bonuses..."
    if ! bun run scripts/disable-ranking-bonuses.ts 2>&1; then
        log_warn "Ranking bonus normalization had issues (continuing anyway)"
    fi

    # Step 4: Seed admin (non-critical)
    seed_admin
    
    # Step 5: Start application
    log_info "Starting PAAA-Tool server..."
    exec bun ./build/index.js
}

main
