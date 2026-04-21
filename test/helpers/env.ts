// Must be imported before any NestJS module to satisfy ConfigModule validation.
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
process.env.GOOGLE_CALLBACK_URL =
  'http://localhost:3099/api/v1/auth/google/callback';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32c';
process.env.JWT_EXPIRES_IN = '1h';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
process.env.PORT = '3099';

export const TEST_JWT_SECRET = process.env.JWT_SECRET;
