#!/bin/bash
# Cobot AI Sandbox - OpenClaw Container Startup  v3.0 (production)
#
# Lifecycle:
#   1. Wait for R2 FUSE mount
#   2. Restore config + workspace from R2 tar backups
#   3. Run openclaw onboard (first boot only)
#   4. Patch config for channels + gateway auth
#   5. Register SIGTERM trap for final R2 sync on sleep/shutdown
#   6. Start gateway
#   7. Background loop: heartbeat every 30s, R2 sync every 10 min
#
# Backup strategy (production-grade):
#   - Two tar files: config.tar.gz + workspace.tar.gz
#   - config.tar.gz: openclaw.json, agents/sessions, telegram offset,
#     identity, cron, canvas (~300KB)
#   - workspace.tar.gz: user files + installed skills
#     (EXCLUDES tools/ — Chromium 644MB, re-downloaded by OpenClaw on demand)
#   - Initial sync 10s after boot, then every 10 minutes (crash insurance)
#   - SIGTERM trap: final sync before container sleeps (the critical one)
#     Cloudflare gives 15 minutes between SIGTERM and SIGKILL.
#   - NO rsync — R2 FUSE is too slow for per-file operations.
#     rsync --size-only also misses files that change content but not size
#     (e.g., Telegram update offset stays 48 bytes but offset number changes).

set -e

# Kill any existing gateway processes to ensure clean start
if pgrep -f "openclaw gateway" > /dev/null 2>&1; then
    echo "Killing existing OpenClaw gateway processes..."
    pkill -f "openclaw-gateway" 2>/dev/null || true
    pkill -f "openclaw gateway" 2>/dev/null || true
    sleep 2
    pkill -9 -f "openclaw-gateway" 2>/dev/null || true
    pkill -9 -f "openclaw gateway" 2>/dev/null || true
    sleep 1
    echo "Existing processes killed"
fi

CONFIG_DIR="/root/.openclaw"
CONFIG_FILE="$CONFIG_DIR/openclaw.json"
BACKUP_DIR="/data/cobot/${TENANT_ID}"
R2_READY=false
R2_RESTORED=false

mkdir -p "$CONFIG_DIR"

# ============================================================
# WAIT FOR R2 FUSE MOUNT TO BE READY
# ============================================================
echo "[R2] Checking R2 mount at /data/cobot..."
if [ -n "$TENANT_ID" ] && [ -d "/data/cobot" ]; then
    for i in 1 2 3 4 5; do
        if timeout 3 ls /data/cobot/ >/dev/null 2>&1; then
            R2_READY=true
            echo "[R2] FUSE mount is ready (attempt $i)"
            break
        fi
        echo "[R2] Waiting for FUSE mount... (attempt $i/5)"
        sleep 3
    done
    if [ "$R2_READY" = "false" ]; then
        echo "[R2] ERROR: FUSE mount not ready after 15 seconds!"
    fi
fi

# ============================================================
# RESTORE FROM R2 BACKUP
# ============================================================
if [ "$R2_READY" = "true" ]; then
    echo "[R2] R2 is mounted. Tenant=$TENANT_ID, BackupDir=$BACKUP_DIR"
    timeout 5 ls -la "$BACKUP_DIR/" 2>/dev/null || echo "[R2] Backup dir does not exist yet (first boot)"

    # -- Restore config --
    if [ -f "$BACKUP_DIR/config.tar.gz" ]; then
        echo "[R2] Restoring config from tar archive..."
        if timeout 30 tar xzf "$BACKUP_DIR/config.tar.gz" -C "$CONFIG_DIR/"; then
            echo "[R2] Config restored ($(ls -1 $CONFIG_DIR/ 2>/dev/null | wc -l) items)"
            R2_RESTORED=true
        else
            echo "[R2] WARNING: Config tar restore failed"
        fi
    elif [ -f "$BACKUP_DIR/openclaw/openclaw.json" ]; then
        # Legacy fallback: restore from old per-file rsync backup
        echo "[R2] Restoring config from legacy rsync backup..."
        timeout 60 rsync -r --no-times \
            --exclude='.git' --exclude='*.lock' --exclude='*.log' --exclude='*.tmp' \
            --exclude='workspace' \
            "$BACKUP_DIR/openclaw/" "$CONFIG_DIR/" 2>/dev/null || true
        echo "[R2] Config restored from legacy rsync"
        R2_RESTORED=true
    else
        echo "[R2] No config backup found — first boot for this tenant"
        # CRITICAL: Allow sync so the first onboard data gets persisted to R2.
        # Without this, new tenants lose all data on first sleep/wake cycle.
        R2_RESTORED=true
    fi

    # -- Restore workspace --
    # Try tar first, then legacy. Both check for user files (not just system files).
    if [ -f "$BACKUP_DIR/workspace.tar.gz" ]; then
        echo "[R2] Restoring workspace from tar archive..."
        mkdir -p "$CONFIG_DIR/workspace"
        if timeout 30 tar xzf "$BACKUP_DIR/workspace.tar.gz" -C "$CONFIG_DIR/workspace/"; then
            echo "[R2] Workspace restored ($(ls -1 $CONFIG_DIR/workspace/ 2>/dev/null | wc -l) items)"
        else
            echo "[R2] WARNING: Workspace tar restore failed"
        fi
        # Also restore any user files from legacy backup that might not be in tar
        # (handles case where tar was created from a partial boot)
        if [ -d "$BACKUP_DIR/openclaw/workspace" ]; then
            echo "[R2] Merging user files from legacy backup (if any missing)..."
            timeout 30 rsync -r --no-times --ignore-existing \
                --exclude='.git' --exclude='*.lock' --exclude='*.log' --exclude='*.tmp' \
                --exclude='tools' \
                "$BACKUP_DIR/openclaw/workspace/" "$CONFIG_DIR/workspace/" 2>/dev/null || true
        fi
    elif [ -d "$BACKUP_DIR/openclaw/workspace" ]; then
        # Legacy fallback
        echo "[R2] Restoring workspace from legacy per-file backup..."
        mkdir -p "$CONFIG_DIR/workspace"
        timeout 60 rsync -r --no-times \
            --exclude='.git' --exclude='*.lock' --exclude='*.log' --exclude='*.tmp' \
            --exclude='tools' \
            "$BACKUP_DIR/openclaw/workspace/" "$CONFIG_DIR/workspace/" 2>/dev/null || true
        echo "[R2] Workspace restored (legacy)"
    fi
else
    if [ -z "$TENANT_ID" ]; then
        echo "[R2] WARNING: TENANT_ID not set, skipping R2 restore"
    elif [ ! -d "/data/cobot" ]; then
        echo "[R2] WARNING: /data/cobot not found — R2 not mounted"
    fi
fi

# ============================================================
# ONBOARD (only if no config exists yet — first boot)
# ============================================================
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Running openclaw onboard..."

    AUTH_ARGS=""
    if [ -n "$ANTHROPIC_API_KEY" ]; then
        AUTH_ARGS="--auth-choice apiKey --anthropic-api-key $ANTHROPIC_API_KEY"
    elif [ -n "$OPENAI_API_KEY" ]; then
        AUTH_ARGS="--auth-choice openai-api-key --openai-api-key $OPENAI_API_KEY"
    fi

    openclaw onboard --non-interactive --accept-risk \
        --mode local \
        $AUTH_ARGS \
        --gateway-port 18789 \
        --gateway-bind lan \
        --skip-channels \
        --skip-skills \
        --skip-health

    echo "Onboard completed"
else
    echo "Using existing config (restored from R2 or previous boot)"
fi

# ============================================================
# PATCH CONFIG (channels, gateway auth, trusted proxies)
# ============================================================
node << 'EOFPATCH'
const fs = require('fs');
const configPath = '/root/.openclaw/openclaw.json';
let config = {};

try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    console.log('Starting with empty config');
}

config.gateway = config.gateway || {};
config.channels = config.channels || {};

// Gateway settings
config.gateway.port = 18789;
config.gateway.mode = 'local';
config.gateway.trustedProxies = ['10.1.0.0'];

if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    config.gateway.auth = config.gateway.auth || {};
    config.gateway.auth.token = process.env.OPENCLAW_GATEWAY_TOKEN;
}

// Telegram channel (native polling)
if (process.env.TELEGRAM_BOT_TOKEN) {
    const dmPolicy = process.env.TELEGRAM_DM_POLICY || 'pairing';
    config.channels.telegram = {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        enabled: true,
        dmPolicy: dmPolicy,
    };
    if (process.env.TELEGRAM_DM_ALLOW_FROM) {
        config.channels.telegram.allowFrom = process.env.TELEGRAM_DM_ALLOW_FROM.split(',');
    } else if (dmPolicy === 'open') {
        config.channels.telegram.allowFrom = ['*'];
    }
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Configuration patched successfully');
EOFPATCH

# Run doctor --fix to finalize setup (enables Telegram, fixes permissions)
echo "Running openclaw doctor --fix..."
openclaw doctor --fix --non-interactive 2>&1 || true

# ============================================================
# R2 SYNC FUNCTION
#
# Two tar files per sync:
#   config.tar.gz    — all data EXCEPT workspace (~300KB compressed)
#   workspace.tar.gz — user files + skills, EXCLUDING tools/ (Chromium=644MB)
#
# Tar captures ALL file content regardless of size changes.
# This fixes the rsync --size-only bug where files that change
# content but not size (Telegram offset, session metadata) were
# never re-synced to R2.
# ============================================================
do_r2_sync() {
    if [ -z "$TENANT_ID" ] || [ ! -d "/data/cobot" ]; then
        return 0  # Nothing to sync — not an error
    fi

    if [ ! -f "/root/.openclaw/openclaw.json" ]; then
        echo "[R2-SYNC] SKIP: No openclaw.json — refusing to sync empty state to R2"
        return 0
    fi

    # Guard: if R2 wasn't available at boot, don't overwrite good backups.
    if [ "$R2_RESTORED" != "true" ]; then
        echo "[R2-SYNC] SKIP: R2 was not available at boot — refusing to overwrite backups"
        return 0
    fi

    # Verify mount is still alive (s3fs can disappear)
    if ! timeout 5 ls "$BACKUP_DIR/" >/dev/null 2>&1; then
        echo "[R2-SYNC] WARNING: R2 mount appears dead ($BACKUP_DIR not accessible)"
        return 0
    fi

    mkdir -p "$BACKUP_DIR"

    # Config tar: sessions, telegram offset, identity, cron, canvas, openclaw.json
    # Excludes: workspace (separate tar), backup files (bloat), temp/lock files
    if tar czf /tmp/config.tar.gz \
        --exclude='workspace' \
        --exclude='openclaw.json.bak*' --exclude='.openclaw.json.bak*' \
        --exclude='.env*' --exclude='update-check.json' \
        --exclude='.git' --exclude='*.lock' --exclude='*.log' --exclude='*.tmp' \
        -C /root/.openclaw . 2>/tmp/tar-config-err.log; then
        if [ -f /tmp/config.tar.gz ]; then
            timeout 30 cp /tmp/config.tar.gz "$BACKUP_DIR/config.tar.gz" || echo "[R2-SYNC] WARNING: config tar copy to R2 failed"
            rm -f /tmp/config.tar.gz
        fi
    else
        echo "[R2-SYNC] WARNING: config tar creation failed: $(cat /tmp/tar-config-err.log 2>/dev/null)"
    fi
    rm -f /tmp/tar-config-err.log

    # Workspace tar: user files + skills, exclude Chromium/tools (644MB)
    if [ -d "/root/.openclaw/workspace" ]; then
        if tar czf /tmp/workspace.tar.gz \
            --exclude='tools' --exclude='node_modules' --exclude='.cache' \
            --exclude='.git' --exclude='*.lock' --exclude='*.log' --exclude='*.tmp' \
            -C /root/.openclaw/workspace . 2>/tmp/tar-workspace-err.log; then
            if [ -f /tmp/workspace.tar.gz ]; then
                timeout 30 cp /tmp/workspace.tar.gz "$BACKUP_DIR/workspace.tar.gz" || echo "[R2-SYNC] WARNING: workspace tar copy to R2 failed"
                rm -f /tmp/workspace.tar.gz
            fi
        else
            echo "[R2-SYNC] WARNING: workspace tar creation failed: $(cat /tmp/tar-workspace-err.log 2>/dev/null)"
        fi
        rm -f /tmp/tar-workspace-err.log
    fi

    date -Iseconds > "$BACKUP_DIR/.last-sync" 2>/dev/null || true
    echo "[R2-SYNC] Sync completed at $(date -Iseconds)"
}

# Export for use in subshell and trap
export -f do_r2_sync 2>/dev/null || true
export BACKUP_DIR TENANT_ID WEBHOOK_BASE_URL TELEGRAM_BOT_TOKEN R2_RESTORED

# ============================================================
# DELETE WEBHOOK (so OpenClaw polling works)
# ============================================================
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    echo "[WEBHOOK] Deleting Telegram webhook for polling mode..."
    curl -sf --max-time 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook" || echo "[WEBHOOK] deleteWebhook failed (non-critical)"
fi

# ============================================================
# SIGTERM TRAP — final sync before container sleeps/stops
# Must be registered BEFORE gateway starts.
# This is the CRITICAL sync — captures all changes since boot.
# Cloudflare sends SIGTERM then SIGKILL after 15 minutes.
# ============================================================
SYNC_PID=""
GATEWAY_PID=""
cleanup() {
    echo "[SHUTDOWN] Received signal, performing final R2 sync..."
    do_r2_sync
    echo "[SHUTDOWN] Final sync done. Exiting."
    [ -n "$SYNC_PID" ] && kill $SYNC_PID 2>/dev/null || true
    [ -n "$GATEWAY_PID" ] && kill $GATEWAY_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

# ============================================================
# START GATEWAY
# ============================================================
echo "Starting OpenClaw Gateway on port 18789..."

rm -f /tmp/openclaw-gateway.lock 2>/dev/null || true
rm -f "$CONFIG_DIR/gateway.lock" 2>/dev/null || true

if [ -n "$OPENCLAW_GATEWAY_TOKEN" ]; then
    openclaw gateway --port 18789 --verbose --allow-unconfigured --bind lan --token "$OPENCLAW_GATEWAY_TOKEN" &
else
    openclaw gateway --port 18789 --verbose --allow-unconfigured --bind lan &
fi
GATEWAY_PID=$!
echo "[GATEWAY] Started with PID=$GATEWAY_PID"

# ============================================================
# BACKGROUND LOOP: heartbeat + webhook guard + R2 sync
#
# Heartbeat: every 30s -> KV write (tells cron we're alive)
# Webhook guard: first 5 min -> delete any webhook cron sets
# R2 sync: initial sync after 10s, then every 10 minutes
#   (crash insurance — main sync is SIGTERM trap on sleep)
# ============================================================
(
    # Immediate heartbeat — prevents cron from setting webhook
    if [ -n "$WEBHOOK_BASE_URL" ] && [ -n "$TENANT_ID" ]; then
        curl -sf --max-time 5 "${WEBHOOK_BASE_URL}/heartbeat?tenant=${TENANT_ID}" || true
        echo "[HEARTBEAT] Initial heartbeat sent"
    fi

    # Webhook guard: aggressively delete webhooks for 5 minutes after boot.
    # Cron may set webhook due to KV eventual consistency (~60s propagation).
    WEBHOOK_GUARD_START=$(date +%s)
    GATEWAY_READY=false
    while true; do
        ELAPSED=$(( $(date +%s) - WEBHOOK_GUARD_START ))
        [ "$ELAPSED" -ge 300 ] && echo "[WEBHOOK-GUARD] 5-minute guard complete" && break

        if [ "$GATEWAY_READY" = "false" ]; then
            if curl -sf --max-time 2 "http://127.0.0.1:18789/" >/dev/null 2>&1; then
                GATEWAY_READY=true
                echo "[WEBHOOK-GUARD] Gateway is up"
            fi
        fi

        if [ "$GATEWAY_READY" = "true" ]; then
            curl -sf --max-time 5 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook" >/dev/null 2>&1 || true
            if [ -n "$WEBHOOK_BASE_URL" ] && [ -n "$TENANT_ID" ]; then
                curl -sf --max-time 5 "${WEBHOOK_BASE_URL}/heartbeat?tenant=${TENANT_ID}" >/dev/null 2>&1 || true
            fi
        fi
        sleep 15
    done &
    echo "[WEBHOOK-GUARD] Started (5 min)"

    # Wait for gateway to stabilize before initial sync
    sleep 10

    if [ -n "$TENANT_ID" ] && [ -d "/data/cobot" ]; then
        echo "[R2-SYNC] Running initial sync..."
        do_r2_sync

        # Main loop: heartbeat every 30s, R2 sync every 5 minutes (10 iterations)
        SYNC_COUNTER=0
        while true; do
            sleep 30
            SYNC_COUNTER=$((SYNC_COUNTER + 1))

            # Heartbeat every 30s
            if [ -n "$WEBHOOK_BASE_URL" ]; then
                curl -sf --max-time 5 "${WEBHOOK_BASE_URL}/heartbeat?tenant=${TENANT_ID}" || true
            fi

            # R2 sync every 10 minutes (every 20th iteration of 30s sleep)
            if [ $((SYNC_COUNTER % 20)) -eq 0 ]; then
                do_r2_sync
            fi
        done
    else
        # No R2, heartbeat only
        while true; do
            sleep 30
            if [ -n "$WEBHOOK_BASE_URL" ] && [ -n "$TENANT_ID" ]; then
                curl -sf --max-time 5 "${WEBHOOK_BASE_URL}/heartbeat?tenant=${TENANT_ID}" || true
            fi
        done
    fi
) &
SYNC_PID=$!
echo "[SYNC] Background loop started (PID=$SYNC_PID)"

# Wait for gateway (and handle signals)
wait $GATEWAY_PID
EXIT_CODE=$?
echo "[GATEWAY] Exited with code $EXIT_CODE, running final sync..."
do_r2_sync
# Clean up background loop before exiting
[ -n "$SYNC_PID" ] && kill $SYNC_PID 2>/dev/null || true
exit $EXIT_CODE
