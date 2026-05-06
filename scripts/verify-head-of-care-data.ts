import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifyHeadOfCareData() {
    const client = await pool.connect();
    try {
        console.log('Verifying Head of CARE Framework data...');

        // Check Department
        const deptRes = await client.query("SELECT id FROM departments WHERE name = 'CARE'");
        if (deptRes.rows.length === 0) throw new Error('Department CARE not found');
        void deptRes.rows[0].id;
        console.log('✓ Department found');

        // Check Template
        const tmplRes = await client.query("SELECT id FROM rubric_templates WHERE name = 'Head of CARE Performance Standards'");
        if (tmplRes.rows.length === 0) throw new Error('Template not found');
        const tmplId = tmplRes.rows[0].id;
        console.log('✓ Template found');

        // Check Domains
        const domainRes = await client.query('SELECT count(*) FROM kpi_domains WHERE template_id = $1', [tmplId]);
        const domainCount = parseInt(domainRes.rows[0].count);
        console.log(`✓ Domains found: ${domainCount} (Expected: 3)`);
        if (domainCount !== 3) throw new Error(`Domain count mismatch: ${domainCount} != 3`);

        // Check Standards (Need to join with domains of this template)
        const stdRes = await client.query(`
            SELECT count(s.*) 
            FROM kpi_standards s
            JOIN kpi_domains d ON s.domain_id = d.id
            WHERE d.template_id = $1
        `, [tmplId]);
        const stdCount = parseInt(stdRes.rows[0].count);
        console.log(`✓ Standards found: ${stdCount} (Expected: 8)`);
        if (stdCount !== 8) throw new Error(`Standard count mismatch: ${stdCount} != 8`);

        // Check KPIs
        const kpiRes = await client.query(`
            SELECT count(k.*) 
            FROM kpis k
            JOIN kpi_standards s ON k.standard_id = s.id
            JOIN kpi_domains d ON s.domain_id = d.id
            WHERE d.template_id = $1
        `, [tmplId]);
        const kpiCount = parseInt(kpiRes.rows[0].count);
        console.log(`✓ KPIs found: ${kpiCount} (Expected: 23)`);
        if (kpiCount !== 23) throw new Error(`KPI count mismatch: ${kpiCount} != 23`);

        console.log('\n✅ Verification passed!');

    } catch (e) {
        console.error('❌ Verification failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyHeadOfCareData();
