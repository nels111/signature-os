#!/bin/bash
# run-sync-hours.sh — cron wrapper for Regular Hours Sheet sync
# Runs daily at 04:30 UTC. Logs to /home/dorabot/.dorabot/cache/sigos-hours-sync.log
set -u

APP_DIR=/var/www/signature-cleans-os
LOG_FILE=/home/dorabot/.dorabot/cache/sigos-hours-sync.log
MAX_LINES=1000

# tsx with -r dotenv/config loads .env from APP_DIR automatically
cd "$APP_DIR"

# Run the sync and log output
"$APP_DIR/node_modules/.bin/tsx" -r dotenv/config scripts/sync-hours-sheet.ts >> "$LOG_FILE" 2>&1
STATUS=$?

# Trim log to MAX_LINES to prevent unbounded growth
if [ -f "$LOG_FILE" ]; then
  tail -n "$MAX_LINES" "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

exit $STATUS
