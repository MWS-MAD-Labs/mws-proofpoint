import { Pool } from 'pg';
import { resolveDatabaseUrl } from '@/lib/database-url';

const databaseUrl = resolveDatabaseUrl();

// Create a connection pool for PostgreSQL
const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection on startup
pool.on('connect', () => {
    console.log('Database pool connection established');
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});

export { pool };

// Helper function for queries
export async function query<T = unknown>(
    text: string,
    params?: unknown[]
): Promise<T[]> {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result.rows as T[];
    } finally {
        client.release();
    }
}

// Helper for single row queries
export async function queryOne<T = unknown>(
    text: string,
    params?: unknown[]
): Promise<T | null> {
    const rows = await query<T>(text, params);
    return rows[0] ?? null;
}
