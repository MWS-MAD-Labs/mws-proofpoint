
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifyHeadOfRiseData() {
    const client = await pool.connect();
    try {
        console.log('Verifying Head of RISE data...');

        // Check Department
        const deptRes = await client.query('SELECT id, name FROM departments WHERE name = $1', ['RISE']);
        if (deptRes.rows.length === 0) {
            console.error('❌ Department RISE not found');
            return;
        }
        console.log(`✓ Department found: ${deptRes.rows[0].name}`);

        // Check Template
        const templateRes = await client.query('SELECT id, name FROM rubric_templates WHERE name = $1', ['Head of RISE Performance Standards']);
        if (templateRes.rows.length === 0) {
            console.error('❌ Template not found');
            return;
        }
        const templateId = templateRes.rows[0].id;
        console.log(`✓ Template found: ${templateRes.rows[0].name}`);

        // Check Domains - should be 6
        const domainRes = await client.query('SELECT count(*) FROM kpi_domains WHERE template_id = $1', [templateId]);
        const domainCount = parseInt(domainRes.rows[0].count);
        if (domainCount !== 6) {
            console.error(`❌ Expected 6 domains, found ${domainCount}`);
        } else {
            console.log('✓ Domains count correct: 6');
        }

        // Check Standards - should be 12
        // We need to join because standards don't have template_id directly
        const stdRes = await client.query(`
            SELECT count(s.id) 
            FROM kpi_standards s
            JOIN kpi_domains d ON s.domain_id = d.id
            WHERE d.template_id = $1
        `, [templateId]);
        const stdCount = parseInt(stdRes.rows[0].count);
        if (stdCount !== 12) {
            console.error(`❌ Expected 12 standards, found ${stdCount}`);
        } else {
            console.log('✓ Standards count correct: 12');
        }

        // Check KPIs - should be 35
        const kpiRes = await client.query(`
            SELECT count(k.id) 
            FROM kpis k
            JOIN kpi_standards s ON k.standard_id = s.id
            JOIN kpi_domains d ON s.domain_id = d.id
            WHERE d.template_id = $1
        `, [templateId]);
        const kpiCount = parseInt(kpiRes.rows[0].count);
        if (kpiCount !== 35) {
            console.error(`❌ Expected 35 KPIs, found ${kpiCount}`);
        } else {
            console.log('✓ KPIs count correct: 35');
        }

    } catch (e) {
        console.error('❌ Verification failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyHeadOfRiseData();
