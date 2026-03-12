#!/bin/bash
# Cache cleanup script for placehold.us
# Keeps cache under control by removing old files

CACHE_DIR="/var/www/vhosts/placehold.us/httpdocs/cache"
MAX_SIZE_MB=500  # Maximum cache size in MB
MAX_AGE_DAYS=30  # Delete files older than this

# Get current cache size in MB
CURRENT_SIZE=$(du -sm "$CACHE_DIR" | cut -f1)

echo "Current cache size: ${CURRENT_SIZE}MB"

# Delete files older than MAX_AGE_DAYS
echo "Deleting files older than ${MAX_AGE_DAYS} days..."
find "$CACHE_DIR" -type f -mtime +${MAX_AGE_DAYS} -delete

# If still over limit, delete oldest files until under limit
CURRENT_SIZE=$(du -sm "$CACHE_DIR" | cut -f1)
if [ $CURRENT_SIZE -gt $MAX_SIZE_MB ]; then
    echo "Cache still over ${MAX_SIZE_MB}MB, removing oldest files..."
    FILES_TO_DELETE=$(expr $CURRENT_SIZE - $MAX_SIZE_MB + 50)  # Delete 50MB extra as buffer
    find "$CACHE_DIR" -type f -printf '%T+ %p\n' | sort | head -n 100 | cut -d' ' -f2- | xargs rm -f
fi

# Final size
FINAL_SIZE=$(du -sm "$CACHE_DIR" | cut -f1)
echo "Final cache size: ${FINAL_SIZE}MB"
echo "Cache cleanup complete!"
