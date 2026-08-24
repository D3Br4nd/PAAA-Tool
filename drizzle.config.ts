import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
    schema: './src/lib/server/schema.ts',
    out: './drizzle',
    dialect: 'turso',
    dbCredentials: {
        url: process.env.DATABASE_URL || 'http://db:8080',
        authToken: process.env.DATABASE_AUTH_TOKEN || process.env.AUTH_TOKEN
    },
    verbose: true,
    strict: true
});
