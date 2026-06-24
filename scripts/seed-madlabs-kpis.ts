import pg from 'pg';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function seedMadLabsKPIs() {
    const client = await pool.connect();
    try {
        console.log('Starting Mad Labs Head Unit KPI seed process...');

        await client.query('BEGIN');

        // 1. Create Department for Mad Labs
        const deptId = uuidv4();
        await client.query(
            'INSERT INTO departments (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [deptId, 'Mad Labs']
        );
        console.log('✓ Department created: Mad Labs');

        // 2. Create Rubric Template for Head Unit of Mad Labs
        const templateId = uuidv4();
        await client.query(
            `INSERT INTO rubric_templates (id, name, description, department_id, is_global, created_by)
             VALUES ($1, $2, $3, $4, $5, NULL)`,
            [
                templateId,
                'Head Unit of Mad Labs',
                'KPI Framework for the Head of Innovation & Makerspace Unit - covering Professional Knowledge, Practice, and Values domains.',
                deptId,
                false
            ]
        );
        console.log('✓ Rubric Template created: Head Unit of Mad Labs');

        // =====================================================
        // DOMAIN 1 — Professional Knowledge & Foresight
        // =====================================================
        const domain1Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_domains (id, template_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [domain1Id, templateId, 'Professional Knowledge & Foresight', 1]
        );
        console.log('✓ Domain 1 created');

        // Standard 1 — Innovation principles, sustainable design, systems thinking
        const std1Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std1Id, domain1Id, 'Innovation principles, sustainable design, systems thinking', 1]
        );

        // KPIs for Standard 1
        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std1Id,
                'Sustainable Design Integration',
                '% MadLabs projects with briefs including energy/water/waste goals and lifecycle lens',
                'Project briefs with impact sections',
                null,
                1,
                '≥95%', '90–94%', '75–89%', '<75%'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std1Id,
                'Process Systems Thinking',
                '# system maps with cross-dept input & implemented changes',
                'System maps, change logs',
                'Circular economy, LCA, process mapping',
                2,
                '≥6 maps/yr & ≥10 changes', '4–5 & 6–9', '2–3 & 3–5', '<2 & <3'
            ]
        );

        // Standard 2 — Educational technologies & emerging tools
        const std2Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std2Id, domain1Id, 'Educational technologies & emerging tools', 2]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std2Id,
                'Tools Database Coverage',
                '# tech scans / horizon briefs per term (AI, AR/VR, robotics, IoT, low-code, OSS)',
                'Scan briefs',
                null,
                1,
                '≥3 / term', '2', '1', '0'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std2Id,
                'Adoption-Ready Evaluations',
                '% shortlisted tools tested with use-case + go/no-go note',
                'Pilots, decision notes',
                null,
                2,
                '≥95%', '85–94%', '70–84%', '<70%'
            ]
        );

        // Standard 3 — Datawise improvement & insight-to-action
        const std3Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std3Id, domain1Id, 'Datawise improvement & insight-to-action', 3]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std3Id,
                'Datawise Cadence',
                '# improvement cycles completed/year',
                'Cycle artifacts, dashboards',
                null,
                1,
                '≥6', '4–5', '3', '<3'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std3Id,
                'Decision Uptake',
                '% leadership decisions citing MadLabs insight',
                'Decision log (Living Dashboard)',
                null,
                2,
                '≥80%', '70–79%', '50–69%', '<50%'
            ]
        );

        // Standard 4 — Compliance with innovation & sustainability frameworks
        const std4Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std4Id, domain1Id, 'Compliance with innovation & sustainability frameworks', 4]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std4Id,
                'Framework Mapping',
                '% projects mapped to ISO 14001 & ESG (GRI/ESRS)',
                'Mapping sheets, audits',
                null,
                1,
                '≥95%', '85–94%', '70–84%', '<70%'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std4Id,
                'Digital Ethics & Governance',
                '% new systems with risk register, DPIA/AI note, retention plan',
                'DPIAs, retention schedules',
                null,
                2,
                '100%', '90–99%', '75–89%', '<75%'
            ]
        );

        console.log('✓ Domain 1 Standards and KPIs created');

        // =====================================================
        // DOMAIN 2 — Practice: Sustainable Innovation, Systems & Deployment
        // =====================================================
        const domain2Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_domains (id, template_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [domain2Id, templateId, 'Practice: Sustainable Innovation, Systems & Deployment', 2]
        );
        console.log('✓ Domain 2 created');

        // Standard 5 — Sustainable innovation & resource optimization
        const std5Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std5Id, domain2Id, 'Sustainable innovation & resource optimization', 1]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std5Id,
                'Footprint Reduction',
                'YoY % reduction (energy, water, waste diversion, Scope 1–2)',
                'Meters, invoices',
                null,
                1,
                '≥15% / ≥20pp', '10–14%', '5–9%', '<5%'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std5Id,
                'Event & Ops Streamlining Yield',
                'Hours/Rp saved & % reinvested',
                'Streamlining ledger',
                null,
                2,
                'Publish & ≥80%', '60–79%', 'Publish only', 'None'
            ]
        );

        // Standard 6 — Makerspace & design labs
        const std6Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std6Id, domain2Id, 'Makerspace & design labs', 2]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std6Id,
                'Access & Inclusion',
                '% students served & parity',
                'Rosters',
                null,
                1,
                '≥60% & parity+', '45–59% & near', '30–44% & gaps', '<30%'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std6Id,
                'Safety & Uptime',
                'Safety-trained %, uptime, incidents',
                'Logs, reports',
                null,
                2,
                '≥95% / ≥97% / 0', '≥90 / 95–96 / minor', '80–89 / 90–94', 'Lower'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std6Id,
                'Project Throughput & Quality',
                '# projects & % rubric-assessed',
                'Project rubrics',
                null,
                3,
                '≥120 & ≥90%', '80–119 & 80–89%', '50–79 & 60–79%', 'Lower'
            ]
        );

        // Standard 7 — Responsible AI & data systems
        const std7Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std7Id, domain2Id, 'Responsible AI & data systems', 3]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std7Id,
                'Responsible AI Guardrails',
                '% AI use cases with full guardrails',
                'Model cards, guides',
                null,
                1,
                '100%', '90–99%', '75–89%', '<75%'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std7Id,
                'Core Systems Reliability & Interop',
                'Uptime / SSO / integrations / backups',
                'Analytics, logs',
                null,
                2,
                '≥99.9% / ≥95% / ≥6 / 100%', '99.5–99.8 / 90–94 / 4–5 / 100%', '99.0–99.4 / 80–89 / 2–3', 'Lower'
            ]
        );

        // Standard 8 — Pilot fast, scale well
        const std8Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std8Id, domain2Id, 'Pilot fast, scale well', 4]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std8Id,
                'Cycle Time',
                'Weeks from insight → pilot',
                'Pilot charters',
                null,
                1,
                '≤3', '≤4', '5–6', '>6'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std8Id,
                'Scale-Up Success',
                '% pilots scaled next term',
                'Decision notes',
                null,
                2,
                '≥60%', '40–59%', '25–39%', '<25%'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std8Id,
                'Evaluation Fidelity',
                '% pilots with pre-post & decision note',
                'Review minutes',
                null,
                3,
                '≥95% & ≥90%', '90% & 80–89%', '75–89% & 60–79%', 'Lower'
            ]
        );

        // Standard 9 — Documentation, capacity building & onboarding
        const std9Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std9Id, domain2Id, 'Documentation, capacity building & onboarding', 5]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std9Id,
                'How-To Library',
                '# guides & accessibility',
                'Library repo',
                null,
                1,
                '≥30 & 100%', '20–29 & 100%', '12–19 & partial', '<12'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std9Id,
                'Capability Transfer',
                '# sessions & usefulness rating',
                'Surveys',
                null,
                2,
                '≥12 & ≥4.3', '8–11 & ≥4.0', '5–7 & ≥3.6', 'Lower'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std9Id,
                'Onboarding Coverage & SLA',
                '% on-time & SLA met',
                'Ticketing data',
                null,
                3,
                '≥95% & ≥95%', '90–94% & 90–94%', '80–89% & 80–89%', 'Lower'
            ]
        );

        console.log('✓ Domain 2 Standards and KPIs created');

        // =====================================================
        // DOMAIN 3 — Values, Relationships & Public Value
        // =====================================================
        const domain3Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_domains (id, template_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [domain3Id, templateId, 'Values, Relationships & Public Value', 3]
        );
        console.log('✓ Domain 3 created');

        // Standard 10 — Human-centred, ethical, inclusive innovation
        const std10Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std10Id, domain3Id, 'Human-centred, ethical, inclusive innovation', 1]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std10Id,
                'Inclusive Co-Design',
                '% projects with co-design & usability tests',
                'Test reports',
                null,
                1,
                '≥90% & ≥2', '80–89% & ≥1', '60–79% & occasional', 'Lower'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std10Id,
                'Wellbeing & Safety by Design',
                '% checklist pass',
                'Checklists',
                null,
                2,
                '100%', '≥95%', '85–94%', '<85%'
            ]
        );

        // Standard 11 — School-wide & global collaboration
        const std11Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std11Id, domain3Id, 'School-wide & global collaboration', 2]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std11Id,
                'Partnerships & Outcomes',
                '# partnerships & outcomes',
                'MOUs, logs',
                null,
                1,
                '≥6 & ≥10', '4–5 & 6–9', '2–3 & 3–5', '<2 & <3'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std11Id,
                'Interdepartmental Initiatives',
                '# cross-unit projects & value',
                'Project files',
                null,
                2,
                '≥6 & strong', '4–5 & clear', '2–3 & modest', '<2'
            ]
        );

        // Standard 12 — Reflective practice, growth & strategic foresight
        const std12Id = uuidv4();
        await client.query(
            `INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)`,
            [std12Id, domain3Id, 'Reflective practice, growth & strategic foresight', 3]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std12Id,
                'Foresight Rhythm',
                '# scans, scenarios, bets updated',
                'Scan briefs',
                null,
                1,
                '≥4 & ≥2 & termly', '3 / 1 / term', '2 / — / annual', 'Ad-hoc'
            ]
        );

        await client.query(
            `INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                uuidv4(), std12Id,
                'Personal & Team Growth',
                'PD, plan execution, reuse by teams',
                'Playbooks',
                null,
                2,
                '≥6 / full / ≥5', '4–5 / solid / 3–4', '2–3 / basic / 2', 'Lower'
            ]
        );

        console.log('✓ Domain 3 Standards and KPIs created');

        await client.query('COMMIT');
        console.log('\n✅ Mad Labs Head Unit KPI seed completed successfully!');
        console.log('   Template: Head Unit of Mad Labs');
        console.log('   Domains: 3');
        console.log('   Standards: 12');
        console.log('   KPIs: 25');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

seedMadLabsKPIs();
