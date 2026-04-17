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
CREATE SCHEMA IF NOT EXISTS landing_db;
CREATE SCHEMA IF NOT EXISTS listener_engine_db;

-- Grant privileges to the current user (Aurora master user)
-- Using CURRENT_USER ensures it works with any Aurora master username
DO $$
DECLARE
    current_user_name TEXT;
BEGIN
    current_user_name := CURRENT_USER;
    
    -- Grant privileges on all schemas
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA auth_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA wallet_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA ledger_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA escrow_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA inquiry_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA compliance_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA admin_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA reporting_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA notification_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA landing_db TO %I', current_user_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON SCHEMA listener_engine_db TO %I', current_user_name);
    
    -- Set default privileges for future tables
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA auth_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA wallet_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA ledger_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA escrow_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA inquiry_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA compliance_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA admin_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA reporting_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA notification_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA landing_db GRANT ALL ON TABLES TO %I', current_user_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA listener_engine_db GRANT ALL ON TABLES TO %I', current_user_name);
    
    RAISE NOTICE 'Granted privileges to user: %', current_user_name;
END
$$;

-- Log confirmation
DO $$
BEGIN
    RAISE NOTICE 'All Escrowly schemas created successfully';
END
$$;

