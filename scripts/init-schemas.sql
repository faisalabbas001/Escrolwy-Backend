-- Initialize all schemas (logical databases) for Escrowly microservices
-- This runs once when PostgreSQL container starts for the first time

-- Create schemas for each microservice
CREATE SCHEMA IF NOT EXISTS auth_db;
CREATE SCHEMA IF NOT EXISTS wallet_db;
CREATE SCHEMA IF NOT EXISTS ledger_db;
CREATE SCHEMA IF NOT EXISTS escrow_db;
CREATE SCHEMA IF NOT EXISTS inquiry_db;
CREATE SCHEMA IF NOT EXISTS compliance_db;
CREATE SCHEMA IF NOT EXISTS admin_db;
CREATE SCHEMA IF NOT EXISTS reporting_db;
CREATE SCHEMA IF NOT EXISTS notification_db;

-- Grant privileges to the main user
GRANT ALL PRIVILEGES ON SCHEMA auth_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA wallet_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA ledger_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA escrow_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA inquiry_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA compliance_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA admin_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA reporting_db TO escrowly_dev;
GRANT ALL PRIVILEGES ON SCHEMA notification_db TO escrowly_dev;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA auth_db GRANT ALL ON TABLES TO escrowly_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA wallet_db GRANT ALL ON TABLES TO escrowly_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA ledger_db GRANT ALL ON TABLES TO escrowly_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA escrow_db GRANT ALL ON TABLES TO escrowly_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA inquiry_db GRANT ALL ON TABLES TO escrowly_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA compliance_db GRANT ALL ON TABLES TO escrowly_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA admin_db GRANT ALL ON TABLES TO escrowly_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting_db GRANT ALL ON TABLES TO escrowly_dev;
ALTER DEFAULT PRIVILEGES IN SCHEMA notification_db GRANT ALL ON TABLES TO escrowly_dev;

-- Log confirmation
DO $$
BEGIN
    RAISE NOTICE 'All Escrowly schemas created successfully';
END
$$;

