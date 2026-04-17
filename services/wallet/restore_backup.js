const fs = require('fs');
const { execSync } = require('child_process');

const envFile = fs.readFileSync('.env', 'utf8');
const dbUrlLine = envFile.split('\n').find(line => line.startsWith('DATABASE_URL='));

if (!dbUrlLine) {
    console.error('DATABASE_URL not found');
    process.exit(1);
}

// Get raw value
let rawUrl = dbUrlLine.substring(dbUrlLine.indexOf('=') + 1).trim();
// Remove quotes
rawUrl = rawUrl.replace(/^["']|["']$/g, '');
// Remove query params
rawUrl = rawUrl.split('?')[0];

try {
    // Parse manually to handle unencoded special chars in password (like @)
    // Format: postgresql://user:password@host:port/db

    const protocolSplit = rawUrl.split('://');
    const protocol = protocolSplit[0];
    const rest = protocolSplit[1];

    // Find the LAST @ to separate auth from host
    const lastAt = rest.lastIndexOf('@');
    if (lastAt === -1) {
        throw new Error('Invalid URL format');
    }

    const auth = rest.substring(0, lastAt);
    const hostPart = rest.substring(lastAt + 1);

    // Split auth into user and password by FIRST :
    const firstColon = auth.indexOf(':');
    if (firstColon === -1) {
        // No password? just return as is
        console.log('No password detected in URL');
    } else {
        const user = auth.substring(0, firstColon);
        const password = auth.substring(firstColon + 1);

        // Encode password if not already encoded (simple check: if it has @ and no %)
        // Typically safe to just decode then encode to be sure, or just encode if we assume it's raw from .env
        // .env usually has RAW passwords.
        const encodedPassword = encodeURIComponent(password);

        const newUrl = `${protocol}://${user}:${encodedPassword}@${hostPart}`;

        console.log('Restoring using encoded URL...');
        execSync(`psql "${newUrl}" < escrowly_db_backup_20260101_144240.sql`, { stdio: 'inherit' });
        console.log('Restore successful');
    }

} catch (e) {
    console.error('Restore failed:', e.message);
    process.exit(1);
}
