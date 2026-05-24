#!/bin/bash
# Run this ONCE on the server to apply the optimized nginx config.
# Usage: bash server/apply-nginx.sh

set -e

CONF_SRC="$(dirname "$0")/visionex.nginx.conf"
CONF_DEST="/etc/nginx/sites-available/visionex"
LINK="/etc/nginx/sites-enabled/visionex"

echo "Copying nginx config..."
sudo cp "$CONF_SRC" "$CONF_DEST"

echo "Enabling site..."
sudo ln -sf "$CONF_DEST" "$LINK"

echo "Testing nginx config..."
sudo nginx -t

echo "Reloading nginx..."
sudo systemctl reload nginx

echo "Done. Gzip + Cache headers are now active."
