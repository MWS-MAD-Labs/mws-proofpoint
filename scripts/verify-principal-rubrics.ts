import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifyPrincipalRubrics() {
    const client = await pool.connect();
    try {
        console.log('Verifying Principal Rubrics...');

        const templateRes = await client.query(
            "SELECT id FROM rubric_templates WHERE name = 'Principal Performance Standards'"
        );

        if (templateRes.rows.length === 0) {
            console.error('❌ Template not found!');
            return;
        }

        const templateId = templateRes.rows[0].id;
        console.log(`✓ Template found: ${templateId}`);

        const domainsRes = await client.query(
            "SELECT count(*) FROM kpi_domains WHERE template_id = $1",
            [templateId]
        );
        console.log(`✓ Domains count: ${domainsRes.rows[0].count} (Expected: 6)`);

        const standardsRes = await client.query(
            "SELECT count(*) FROM kpi_standards WHERE domain_id IN (SELECT id FROM kpi_domains WHERE template_id = $1)",
            [templateId]
        );
        console.log(`✓ Standards count: ${standardsRes.rows[0].count} (Expected: 12)`);

        const kpisRes = await client.query(
            "SELECT count(*) FROM kpis WHERE standard_id IN (SELECT id FROM kpi_standards WHERE domain_id IN (SELECT id FROM kpi_domains WHERE template_id = $1))",
            [templateId]
        );
        console.log(`✓ KPIs count: ${kpisRes.rows[0].count} (Expected: 36)`);

        const domainWeights = await client.query(
            "SELECT name, weight FROM kpi_domains WHERE template_id = $1 ORDER BY sort_order",
            [templateId]
        );
        console.log('\nDomain Weights:');
        domainWeights.rows.forEach(row => {
            console.log(`- ${row.name}: ${row.weight}%`);
        });

    } catch (e) {
        console.error('❌ Verification failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyPrincipalRubrics();
