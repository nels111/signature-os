#!/usr/bin/env bash
# Scheduled SigOS email IMAP sync. Reads API_KEY from .env so it isn't in crontab.
KEY=$(grep '^API_KEY=' /var/www/signature-cleans-os/.env 2>/dev/null | cut -d= -f2-)
[ -z "$KEY" ] && exit 0
curl -s -H "Authorization: Bearer $KEY" http://localhost:3200/api/cron/sync-emails --max-time 110 >/dev/null 2>&1
