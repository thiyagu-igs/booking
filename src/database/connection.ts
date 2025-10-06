import knex from 'knex';
import config from '../knexfile';

const environment = process.env.NODE_ENV || 'development';
const knexConfig = config[environment as keyof typeof config];

if (!knexConfig) {
  throw new Error(`No database configuration found for environment: ${environment}`);
}

// Create the database connection
const db = knex(knexConfig);

// Test the connection
export const testConnection = async (): Promise<void> => {
  try {
    await db.raw('SELECT 1 as test');
    console.log('✅ Database connection established successfully');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
};

// Graceful shutdown
export const closeConnection = async (): Promise<void> => {
  await db.destroy();
  console.log('Database connection closed');
};

export default db;