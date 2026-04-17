#!/bin/bash
# Setup script to install AWS CLI and configure cron job for daily backups

set -e

echo "Setting up automated database backups..."

# Install cron if not already installed
if ! command -v crontab &> /dev/null; then
    echo "Installing cron..."
    sudo yum install -y cronie
    sudo systemctl enable crond
    sudo systemctl start crond
    echo "Cron installed and started"
else
    echo "Cron already installed"
fi

# Install AWS CLI if not already installed
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    sudo ./aws/install
    rm -rf aws awscliv2.zip
    echo "AWS CLI installed successfully"
else
    echo "AWS CLI already installed"
fi

# Make backup script executable
chmod +x scripts/backup-db-to-s3.sh

# Get the full path to the backup script
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backup-db-to-s3.sh"

# Create cron job to run at 12:01 AM daily
CRON_JOB="1 0 * * * $SCRIPT_PATH >> /home/ec2-user/backups/backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup-db-to-s3.sh"; then
    echo "Cron job already exists. Updating..."
    crontab -l 2>/dev/null | grep -v "backup-db-to-s3.sh" | crontab -
fi

# Add cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Cron job configured to run daily at 12:01 AM"
echo "View cron jobs: crontab -l"
echo "View backup logs: tail -f /home/ec2-user/backups/backup.log"

