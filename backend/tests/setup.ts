import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
config({ path: resolve(__dirname, '../.env.test') });

// Ensure we're in test mode
process.env.NODE_ENV = 'test';
process.env.SMS_PROVIDER = 'mock';
