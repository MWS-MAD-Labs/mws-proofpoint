import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Connected to database...');

        const migrationPath = path.join(__dirname, '../database/migrations/006_add_domain_weight.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');

        console.log('Running migration...');
        await client.query(sql);

        console.log('Migration applied successfully!');

        // Verify
        const res = await client.query('SELECT name, weight FROM kpi_domains');
        console.log('Current domains and weights:');
        res.rows.forEach(row => {
            console.log(`- ${row.name}: ${row.weight}%`);
        });

    } catch (err) {
        console.error('Error executing migration:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration();
