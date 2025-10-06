"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const config = {
    development: {
        client: 'postgresql',
        connection: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'waitlist_management',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password'
        },
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            directory: './src/database/migrations',
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './src/database/seeds'
        }
    },
    test: {
        client: 'postgresql',
        connection: {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME_TEST || 'waitlist_management_test',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'password'
        },
        pool: {
            min: 1,
            max: 5
        },
        migrations: {
            directory: './src/database/migrations',
            tableName: 'knex_migrations'
        }
    },
    production: {
        client: 'postgresql',
        connection: process.env.DATABASE_URL || {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            ssl: { rejectUnauthorized: false }
        },
        pool: {
            min: 2,
            max: 20
        },
        migrations: {
            directory: './src/database/migrations',
            tableName: 'knex_migrations'
        }
    }
};
exports.default = config;
//# sourceMappingURL=knexfile.js.map