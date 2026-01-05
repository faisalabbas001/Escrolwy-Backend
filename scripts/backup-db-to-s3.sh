#!/bin/bash
# PostgreSQL Backup Script (runs every 4 hours)
# Dumps full database and uploads to S3 with timestamp
# Keeps last 7 days of backups

set -e  # Exit on error

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project directory (where docker-compose.yml is)
cd "$PROJECT_DIR"

# Configuration
BACKUP_DIR="/home/ec2-user/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="escrowly-db-${TIMESTAMP}.sql"
S3_BUCKET="dev-escrowly-stack-devescrowlyfilesd7d0fc74-nlzj6dxdllaf"
S3_KEY="backups/escrowly-db-${TIMESTAMP}.sql"
S3_KEY_LATEST="backups/escrowly-db-latest.sql"
DB_USER="escrowly_dev"
DB_NAME="escrowly"
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Logging
LOG_FILE="$BACKUP_DIR/backup.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting database backup..." >> "$LOG_FILE"

# Dump PostgreSQL database
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Dumping database..." >> "$LOG_FILE"
/usr/local/bin/docker-compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE" 2>> "$LOG_FILE"

# Check if dump was successful
if [ $? -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Database dump successful: $BACKUP_FILE" >> "$LOG_FILE"
    
    # Compress the backup (optional but recommended for large databases)
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Compressing backup..." >> "$LOG_FILE"
    gzip -f "$BACKUP_DIR/$BACKUP_FILE"
    BACKUP_FILE_COMPRESSED="${BACKUP_FILE}.gz"
    
    # Upload to S3 with timestamp
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Uploading to S3..." >> "$LOG_FILE"
    aws s3 cp "$BACKUP_DIR/$BACKUP_FILE_COMPRESSED" "s3://${S3_BUCKET}/${S3_KEY}.gz" --region us-east-1 2>> "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Backup uploaded: s3://${S3_BUCKET}/${S3_KEY}.gz" >> "$LOG_FILE"
        
        # Also copy as "latest" for easy access
        aws s3 cp "s3://${S3_BUCKET}/${S3_KEY}.gz" "s3://${S3_BUCKET}/${S3_KEY_LATEST}.gz" --region us-east-1 2>> "$LOG_FILE"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Latest backup updated: s3://${S3_BUCKET}/${S3_KEY_LATEST}.gz" >> "$LOG_FILE"
        
        # Delete backups older than RETENTION_DAYS
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up old backups (older than ${RETENTION_DAYS} days)..." >> "$LOG_FILE"
        CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d)
        aws s3 ls "s3://${S3_BUCKET}/backups/" --region us-east-1 | while read -r line; do
            FILE_DATE=$(echo "$line" | awk '{print $4}' | grep -oP 'escrowly-db-\K[0-9]{8}' || true)
            if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" != "" ] && [ "$FILE_DATE" -lt "$CUTOFF_DATE" ] 2>/dev/null; then
                FILE_NAME=$(echo "$line" | awk '{print $4}')
                aws s3 rm "s3://${S3_BUCKET}/backups/${FILE_NAME}" --region us-east-1 2>> "$LOG_FILE"
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deleted old backup: ${FILE_NAME}" >> "$LOG_FILE"
            fi
        done
        
        # Remove local backup file to save disk space
        rm -f "$BACKUP_DIR/$BACKUP_FILE_COMPRESSED"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Local backup file removed" >> "$LOG_FILE"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: Failed to upload to S3" >> "$LOG_FILE"
        exit 1
    fi
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: Database dump failed" >> "$LOG_FILE"
    exit 1
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup process completed successfully" >> "$LOG_FILE"

