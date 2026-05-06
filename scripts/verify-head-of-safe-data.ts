import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifyHeadOfSafeData() {
    const client = await pool.connect();
    try {
        console.log('Verifying Head of Safe Framework data...');

        // Check Department
        const deptRes = await client.query("SELECT id FROM departments WHERE name = 'SAFE'");
        if (deptRes.rows.length === 0) throw new Error('Department SAFE not found');
        void deptRes.rows[0].id;
        console.log('✓ Department found');

        // Check Template
        const tmplRes = await client.query("SELECT id FROM rubric_templates WHERE name = 'Head of Safe Performance Standards'");
        if (tmplRes.rows.length === 0) throw new Error('Template not found');
        const tmplId = tmplRes.rows[0].id;
        console.log('✓ Template found');

        // Check Domains
        const domainRes = await client.query('SELECT count(*) FROM kpi_domains WHERE template_id = $1', [tmplId]);
        const domainCount = parseInt(domainRes.rows[0].count);
        console.log(`✓ Domains found: ${domainCount} (Expected: 5)`);
        if (domainCount !== 5) throw new Error(`Domain count mismatch: ${domainCount} != 5`);

        // Check Standards (Need to join with domains of this template)
        const stdRes = await client.query(`
            SELECT count(s.*) 
            FROM kpi_standards s
            JOIN kpi_domains d ON s.domain_id = d.id
            WHERE d.template_id = $1
        `, [tmplId]);
        const stdCount = parseInt(stdRes.rows[0].count);
        console.log(`✓ Standards found: ${stdCount} (Expected: 10)`);
        if (stdCount !== 10) throw new Error(`Standard count mismatch: ${stdCount} != 10`);

        // Check KPIs
        const kpiRes = await client.query(`
            SELECT count(k.*) 
            FROM kpis k
            JOIN kpi_standards s ON k.standard_id = s.id
            JOIN kpi_domains d ON s.domain_id = d.id
            WHERE d.template_id = $1
        `, [tmplId]);
        const kpiCount = parseInt(kpiRes.rows[0].count);
        console.log(`✓ KPIs found: ${kpiCount} (Expected: 29)`);
        if (kpiCount !== 29) throw new Error(`KPI count mismatch: ${kpiCount} != 29`);

        console.log('\n✅ Verification passed!');

    } catch (e) {
        console.error('❌ Verification failed:', e);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyHeadOfSafeData();
