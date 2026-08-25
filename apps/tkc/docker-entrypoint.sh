#!/bin/sh
set -e

# Generate the HTTP Basic Auth file from environment variables at runtime.
# The credentials NEVER live in the repository or image — only in the Dokploy
# Environment settings. If either var is missing, fail loudly so the container
# never starts unprotected.

: "${BASIC_AUTH_USER:?BASIC_AUTH_USER is not set — refusing to start without auth}"
: "${BASIC_AUTH_PASSWORD:?BASIC_AUTH_PASSWORD is not set — refusing to start without auth}"

htpasswd -bc /etc/nginx/.htpasswd "$BASIC_AUTH_USER" "$BASIC_AUTH_PASSWORD" >/dev/null 2>&1

echo "[basic-auth] .htpasswd generated for user: ${BASIC_AUTH_USER}"
