import dotenv from 'dotenv';
import knex from 'knex';

dotenv.config();

export const databaseConfig = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME || 'waitlist_management',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      charset: 'utf8mb4',
      timezone: 'UTC'
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100
    }
  },
  
  test: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME_TEST || 'waitlist_management_test',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      charset: 'utf8mb4',
      timezone: 'UTC'
    },
    pool: {
      min: 1,
      max: 5
    }
  },
  
  production: {
    client: 'mysql2',
    connection: process.env.DATABASE_URL || {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      charset: 'utf8mb4',
      timezone: 'UTC',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 20,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100
    }
  }
};

export const getEnvironment = (): string => {
  return process.env.NODE_ENV || 'development';
};

export const isDevelopment = (): boolean => {
  return getEnvironment() === 'development';
};

export const isProduction = (): boolean => {
  return getEnvironment() === 'production';
};

export const isTest = (): boolean => {
  return getEnvironment() === 'test';
};

// Database connection function
export const connectDatabase = async () => {
  const environment = getEnvironment();
  const config = databaseConfig[environment as keyof typeof databaseConfig];
  
  if (!config) {
    throw new Error(`Database configuration not found for environment: ${environment}`);
  }
  
  const db = knex(config);
  
  // Test the connection
  try {
    await db.raw('SELECT 1');
    console.log(`✅ Database connected successfully (${environment})`);
    return db;
  } catch (error) {
    console.error(`❌ Database connection failed (${environment}):`, error);
    throw error;
  }
};