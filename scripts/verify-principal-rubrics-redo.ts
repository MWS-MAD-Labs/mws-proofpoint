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
        console.log('Verifying MWS Principal Rubrics...');

        const templateRes = await client.query(
            "SELECT id FROM rubric_templates WHERE name = 'MWS Principal Performance Standards'"
        );

        if (templateRes.rows.length === 0) {
            console.error('❌ Template not found!');
            return;
        }

        const templateId = templateRes.rows[0].id;
        console.log(`✓ Template found: ${templateId}`);

        const domainsRes = await client.query(
            "SELECT count(*), AVG(weight) as avg_weight FROM kpi_domains WHERE template_id = $1",
            [templateId]
        );
        console.log(`✓ Domains count: ${domainsRes.rows[0].count} (Expected: 6)`);
        console.log(`✓ Average domain weight: ${parseFloat(domainsRes.rows[0].avg_weight).toFixed(2)}% (Expected: 16.67%)`);

        const standardsRes = await client.query(
            "SELECT count(*) FROM kpi_standards WHERE domain_id IN (SELECT id FROM kpi_domains WHERE template_id = $1)",
            [templateId]
        );
        console.log(`✓ Standards count: ${standardsRes.rows[0].count} (Expected: 12)`);

        const kpisRes = await client.query(
            "SELECT count(*) FROM kpis WHERE standard_id IN (SELECT id FROM kpi_standards WHERE domain_id IN (SELECT id FROM kpi_domains WHERE template_id = $1))",
            [templateId]
        );
        console.log(`✓ KPIs count: ${kpisRes.rows[0].count} (Expected: 41)`);

        // Check if a few KPIs have their rubrics and evidence
        const sampleKPI = await client.query(
            "SELECT name, description, evidence_guidance, trainings, rubric_4 FROM kpis WHERE standard_id IN (SELECT id FROM kpi_standards WHERE domain_id IN (SELECT id FROM kpi_domains WHERE template_id = $1)) LIMIT 1",
            [templateId]
        );

        if (sampleKPI.rows.length > 0) {
            console.log('\nSample KPI Verification:');
            console.log(`- Name: ${sampleKPI.rows[0].name}`);
            console.log(`- Rubric 4 exists: ${!!sampleKPI.rows[0].rubric_4}`);
            console.log(`- Evidence exists: ${!!sampleKPI.rows[0].evidence_guidance}`);
            console.log(`- Trainings exists: ${!!sampleKPI.rows[0].trainings}`);
        }

    } catch (e) {
        console.error('❌ Verification failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyPrincipalRubrics();
