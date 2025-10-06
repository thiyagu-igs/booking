require('dotenv').config();

const config = {
    development: {
        client: 'mysql2',
        connection: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '3306'),
            database: process.env.DB_NAME || 'waitlist_management',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'password',
            charset: 'utf8mb4'
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
        },
        migrations: {
            directory: './src/database/migrations',
            tableName: 'knex_migrations',
            extension: 'ts'
        },
        seeds: {
            directory: './src/database/seeds',
            extension: 'ts'
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
            charset: 'utf8mb4'
        },
        pool: {
            min: 1,
            max: 5
        },
        migrations: {
            directory: './src/database/migrations',
            tableName: 'knex_migrations',
            extension: 'ts'
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
        },
        migrations: {
            directory: './src/database/migrations',
            tableName: 'knex_migrations',
            extension: 'ts'
        }
    }
};

// Register ts-node for TypeScript support
require('ts-node').register({
    compilerOptions: {
        module: 'commonjs'
    }
});

module.exports = config;