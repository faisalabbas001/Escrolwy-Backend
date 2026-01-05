/**
 * Jest Setup File
 *
 * Runs before all tests to configure the testing environment.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  'postgresql://escrowly_dev:escrowly_dev_password@localhost:5432/escrowly?schema=admin_db';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.PORT = '3002';
process.env.SERVICE_NAME = 'admin-service';

// Increase test timeout for integration tests
jest.setTimeout(10000);

// Mock console to reduce noise in tests (optional)
global.console = {
  ...console,
  log: jest.fn(), // Suppress console.log in tests
  debug: jest.fn(),
  info: jest.fn(),
  // Keep error and warn for debugging
};

