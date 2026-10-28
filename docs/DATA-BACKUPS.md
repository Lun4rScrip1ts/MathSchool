# Lunar data backups and migration

These scripts back up the current community database and uploaded files together. They include account records, existing password hashes and salts, sessions, chats, friendships, profile URLs, stickers, reports, AI chat state, and the files referenced by saved URLs. Plaintext passwords are not stored or exported.

## Required persistent storage

Attach a Railway Volume to the website service and mount it at `/app/data`. Set this variable on the website service:

- `LUNAR_DATA_DIR=/app/data`

Keep the same value on any service that serves uploads or performs backups. Existing data must be copied into the volume before changing the path; do not point the app at an empty directory if the current data lives elsewhere.

## External backup storage

Create a private S3-compatible bucket in a separate storage account. Use a dedicated access key restricted to uploading objects to this bucket. The script uses HTTPS and requests server-side AES-256 encryption.

Set these variables on a separate Railway Cron service, not in source code:

- `LUNAR_DATA_DIR=/app/data`
- `BACKUP_S3_ENDPOINT=https://your-s3-endpoint`
- `BACKUP_S3_BUCKET=your-private-bucket`
- `BACKUP_S3_REGION=your-region`
- `BACKUP_S3_ACCESS_KEY_ID=your-access-key`
- `BACKUP_S3_SECRET_ACCESS_KEY=your-secret-key`
- `BACKUP_S3_PREFIX=lunar-backups` (optional)

The Cron service must have access to the same persistent volume as the web service. Configure the Railway Cron schedule to run once per day and set its start command to:

```sh
node scripts/backup-data.js
```

If your Railway plan or service setup does not allow a volume to be shared with the Cron service, run the script as a scheduled task in the web service or use a database/object-storage architecture that the backup worker can access. Never put backup keys in GitHub. Configure bucket lifecycle rules separately to retain daily and weekly backups.

## Restore

Download the desired `.tar.gz` backup from the bucket and put it on the machine/container where you will restore. Stop the website service first, confirm `LUNAR_DATA_DIR` points at the intended data directory, and run:

```sh
node scripts/restore-data.js /path/to/lunar-backup.tar.gz --confirm-restore
```

The restore script validates the archive paths and database shape and saves a copy of the previous database before replacing it. Keep a separate copy of the current uploads directory before a production restore. Restart the website service after restoring.

## Important

- The first backup must be run successfully and the archive should be tested in a separate environment before relying on it.
- Backups contain sensitive account and session data. Keep the bucket private and restrict access.
- The backup script intentionally fails when storage credentials are missing; it does not silently create a false sense of protection with only a local copy.
- The current app uses JSON-file persistence. This protects against losing a Railway account only if the external backup is configured and current.
