import pg from 'pg';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function seedHeadOfCareRubrics() {
    const client = await pool.connect();
    try {
        console.log('Starting Head of CARE Rubrics seed process...');

        await client.query('BEGIN');

        // 1. Create Department for CARE
        const deptId = uuidv4();

        const deptRes = await client.query('SELECT id FROM departments WHERE name = $1', ['CARE']);
        let actualDeptId = deptId;
        if (deptRes.rows.length > 0) {
            actualDeptId = deptRes.rows[0].id;
            console.log('✓ Department exists: CARE');
        } else {
            await client.query('INSERT INTO departments (id, name) VALUES ($1, $2)', [deptId, 'CARE']);
            console.log('✓ Department created: CARE');
        }

        // 2. Create Rubric Template
        const templateId = uuidv4();
        await client.query(
            `INSERT INTO rubric_templates (id, name, description, department_id, is_global, created_by)
             VALUES ($1, $2, $3, $4, $5, NULL)`,
            [
                templateId,
                'Head of CARE Performance Standards',
                'Performance Standards for Head of CARE (Community, Administration, Resources, & Engagement)',
                actualDeptId,
                false
            ]
        );
        console.log('✓ Rubric Template created: Head of CARE Performance Standards');

        const domainWeight = 33.33; // 3 Domains, approx equal weight

        // --- DOMAIN 1: Professional Knowledge & Understanding ---
        const d1Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d1Id, templateId, 'D1: Professional Knowledge & Understanding', 1, domainWeight]
        );

        // Standard 1
        const s1Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s1Id, d1Id, 'Standard 1 — Professional mastery & technical knowledge in Human Capital Management (HCM) (planning & analytics, compliance, competency architecture, culture alignment, HCM tech)', 1]
        );

        const kpisS1 = [
            {
                name: 'KPI 1.1 | HCM compliance & policy currency',
                desc: 'Indicators: % policies updated to law; privacy & consent handled; audits passed; ethical incident rate.',
                guidance: 'Evidence: policy manual & change log, privacy/DPIA records, audit reports.',
                trainings: '',
                r4: '100% current; audits clean; zero critical incidents',
                r3: '95–99%; clean; minor issues',
                r2: '90–94%; minor gaps',
                r1: '<90%/material gaps.'
            },
            {
                name: 'KPI 1.2 | Competency & role architecture coverage',
                desc: 'Indicators: % roles with current competency maps tied to MWS values/Shared Language; interview rubrics live.',
                guidance: 'Evidence: role maps, rubric bank, hiring packets.',
                trainings: '',
                r4: '≥95% roles mapped & used',
                r3: '85–94%',
                r2: '70–84%',
                r1: '<70%.'
            },
            {
                name: 'KPI 1.3 | HCM data systems & dashboards',
                desc: 'Indicators: HCMIS data dictionary, access controls, Living Dashboard signals (time‑to‑fill, QoH, retention, wellbeing) published on cadence.',
                guidance: '',
                trainings: '',
                r4: 'dictionary+access live; 100% cadence',
                r3: 'live; ≥90% cadence',
                r2: 'draft; 70–89% cadence',
                r1: 'absent/irregular.'
            }
        ];

        for (const [idx, kpi] of kpisS1.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s1Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 2
        const s2Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s2Id, d1Id, 'Standard 2 — Strategic talent planning & organizational design (gap analysis, succession, career pathways, org agility, alumni memory)', 2]
        );

        const kpisS2 = [
            {
                name: 'KPI 2.1 | Succession & bench strength',
                desc: 'Indicators: % critical roles with ≥2 ready successors (12‑month horizon); talent‑risk heatmap reviewed termly.',
                guidance: '',
                trainings: '',
                r4: '≥90% roles covered',
                r3: '80–89%',
                r2: '65–79%',
                r1: '<65%.'
            },
            {
                name: 'KPI 2.2 | Career pathways & internal mobility',
                desc: 'Indicators: % staff with multi‑track IDPs; internal moves/promotions (YoY); mobility satisfaction.',
                guidance: '',
                trainings: '',
                r4: '≥95% IDPs; mobility ↑≥6 pp YoY',
                r3: '90–94%; ↑3–5 pp',
                r2: '80–89%; ↑1–2 pp',
                r1: 'lower.'
            },
            {
                name: 'KPI 2.3 | Organizational design agility',
                desc: 'Indicators: time to publish organizational changes; cross‑functional squads formed for priorities; role clarity index.',
                guidance: '',
                trainings: '',
                r4: '≤10 days; ≥6 squads/yr; ≥90% clarity',
                r3: '11–20; 4–5; 85–89%',
                r2: '21–30; 2–3; 75–84%',
                r1: 'slower/fewer.'
            }
        ];

        for (const [idx, kpi] of kpisS2.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s2Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // --- DOMAIN 2: Professional Practice & People Systems ---
        const d2Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d2Id, templateId, 'D2: Professional Practice & People Systems', 2, domainWeight]
        );

        // Standard 3
        const s3Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s3Id, d2Id, 'Standard 3 — Effective talent acquisition & onboarding (multi‑channel sourcing, competency‑based selection, structured onboarding & probation)', 1]
        );

        const kpisS3 = [
            {
                name: 'KPI 3.1 | Time‑to‑fill & quality‑of‑hire (QoH)',
                desc: 'Indicators: median days to offer; 6‑month retention of new hires; probation pass; first‑year rating at/above target.',
                guidance: '',
                trainings: '',
                r4: '≤35 days; ≥90%/≥95%/≥80%',
                r3: '36–45; 85–89/90–94/70–79%',
                r2: '46–60; 80–84/85–89/60–69%',
                r1: 'slower/lower.'
            },
            {
                name: 'KPI 3.2 | Candidate experience & offer acceptance',
                desc: 'Indicators: candidate NPS; offer acceptance rate; unbiased shortlisting checks.',
                guidance: '',
                trainings: '',
                r4: 'NPS ≥70; offers ≥90%; checks 100%',
                r3: '50–69; 85–89%; 95–99%',
                r2: '30–49; 80–84%; 85–94%',
                r1: 'lower.'
            },
            {
                name: 'KPI 3.3 | Onboarding & ramp‑to‑productivity',
                desc: 'Indicators: 30‑60‑90 completion; tools/training access by Day 1; time‑to‑productivity; mentoring coverage.',
                guidance: '',
                trainings: '',
                r4: '≥95%/≤10 days/≥90% coverage',
                r3: '90–94/≤15/85–89%',
                r2: '80–89/≤20/70–84%',
                r1: 'lower.'
            }
        ];

        for (const [idx, kpi] of kpisS3.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s3Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 4
        const s4Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s4Id, d2Id, 'Standard 4 — Staff development, growth, and leadership (IDPs, PD pathways, mentorship & coaching, culture of learning)', 2]
        );

        const kpisS4 = [
            {
                name: 'KPI 4.1 | IDP completion & coaching',
                desc: 'Indicators: % staff with reviewed IDPs; coaching/mentoring hours; observed growth vs plan.',
                guidance: '',
                trainings: '',
                r4: '100%; plans met; strong growth',
                r3: '90–99%; solid',
                r2: '75–89%; modest',
                r1: 'lower.'
            },
            {
                name: 'KPI 4.2 | PD ROI on practice',
                desc: 'Indicators: % PD modules where ≥60% participants show practice lift in 6–8 weeks (rubric) and a linked outcome signal.',
                guidance: '',
                trainings: '',
                r4: '≥70% modules',
                r3: '60–69%',
                r2: '45–59%',
                r1: '<45%.'
            },
            {
                name: 'KPI 4.3 | Leadership pipeline & succession readiness',
                desc: 'Indicators: % leadership roles filled internally; % successors “ready in 12 months.”',
                guidance: '',
                trainings: '',
                r4: '≥60% internal; ≥80% ready',
                r3: '40–59; 70–79',
                r2: '25–39; 60–69',
                r1: 'lower.'
            }
        ];

        for (const [idx, kpi] of kpisS4.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s4Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 5
        const s5Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s5Id, d2Id, 'Standard 5 — Performance management & feedback systems (SMART goals, balanced scorecard, peer/self review, continuous feedback)', 3]
        );

        const kpisS5 = [
            {
                name: 'KPI 5.1 | Goal alignment & appraisal timeliness',
                desc: 'Indicators: % roles with SMART goals tied to Scorecard; on‑time appraisals.',
                guidance: '',
                trainings: '',
                r4: '≥95% aligned; ≥95% on time',
                r3: '90–94; 90–94',
                r2: '80–89; 80–89',
                r1: 'lower.'
            },
            {
                name: 'KPI 5.2 | Feedback quality & cadence',
                desc: 'Indicators: % staff receiving ≥3 documented check‑ins/term; feedback usefulness score.',
                guidance: '',
                trainings: '',
                r4: '≥90% & ≥4.3/5',
                r3: '80–89 & ≥4.0',
                r2: '70–79 & ≥3.6',
                r1: 'lower.'
            },
            {
                name: 'KPI 5.3 | Fairness & calibration',
                desc: 'Indicators: calibration held; distribution integrity (no bunching/outliers); appeal resolution.',
                guidance: '',
                trainings: '',
                r4: 'termly; strong; 100% resolved',
                r3: 'termly; clear; ≥90%',
                r2: 'patchy; moderate',
                r1: 'weak.'
            }
        ];

        for (const [idx, kpi] of kpisS5.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s5Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 6
        const s6Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s6Id, d2Id, 'Standard 6 — Compensation, recognition & wellbeing (market‑aligned, transparent, motivating; mental health & workload)', 4]
        );

        const kpisS6 = [
            {
                name: 'KPI 6.1 | Pay architecture & equity',
                desc: 'Indicators: salary bands current; unexplained pay gap; equity checks in decisions.',
                guidance: '',
                trainings: '',
                r4: '100% bands; gap ≤3%; checks 100%',
                r3: '≥95%; 3.1–5%; ≥95%',
                r2: '85–94%; 5.1–8%; 85–94%',
                r1: 'lower.'
            },
            {
                name: 'KPI 6.2 | Recognition & engagement',
                desc: 'Indicators: participation in recognition programs; perceived fairness; cross‑unit visibility.',
                guidance: '',
                trainings: '',
                r4: '≥80% participation; ≥90% fairness',
                r3: '70–79; 85–89',
                r2: '60–69; 75–84',
                r1: 'lower.'
            },
            {
                name: 'KPI 6.3 | Wellbeing & attendance',
                desc: 'Indicators: wellbeing index; attendance/punctuality; EAP uptake; burnout flags.',
                guidance: '',
                trainings: '',
                r4: '≥90%; ≥97%; healthy uptake; low risk',
                r3: '85–89; 95–96; good; moderate',
                r2: '75–84; 90–94; low; some risk',
                r1: 'lower.'
            }
        ];

        for (const [idx, kpi] of kpisS6.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s6Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // --- DOMAIN 3: Professional Values, Culture & Engagement ---
        const d3Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d3Id, templateId, 'D3: Professional Values, Culture & Engagement', 3, domainWeight]
        );

        // Standard 7
        const s7Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s7Id, d3Id, 'Standard 7 — Ethical leadership & compliance (model values, safeguard confidentiality, clear grievances & restorative resolution)', 1]
        );

        const kpisS7 = [
            {
                name: 'KPI 7.1 | Ethical decision‑making',
                desc: 'Indicators: % major decisions with published ethical rationale; staff training coverage; trust index.',
                guidance: '',
                trainings: '',
                r4: '100%/100%/≥90%',
                r3: '95–99/≥95/85–89',
                r2: '85–94/85–94/75–84',
                r1: 'lower.'
            },
            {
                name: 'KPI 7.2 | Grievance & conflict resolution',
                desc: 'Indicators: time to resolution; restorative use; satisfaction after closure.',
                guidance: '',
                trainings: '',
                r4: '≤15 days; ≥90% restorative; ≥90% satisfied',
                r3: '≤20; 80–89; 80–89',
                r2: '≤30; 70–79; 70–79',
                r1: 'slower/lower.'
            }
        ];

        for (const [idx, kpi] of kpisS7.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s7Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 8
        const s8Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s8Id, d3Id, 'Standard 8 — Engagement, culture & community (voice, inclusion, retention, manager quality)', 2]
        );

        const kpisS8 = [
            {
                name: 'KPI 8.1 | Engagement & voice',
                desc: 'Indicators: engagement index; % reporting voice in decisions; “You Said, We Did” follow‑through.',
                guidance: '',
                trainings: '',
                r4: '≥90%/≥80%/≥90%',
                r3: '85–89/70–79/80–89',
                r2: '75–84/60–69/70–79',
                r1: 'lower.'
            },
            {
                name: 'KPI 8.2 | Retention & regretted attrition',
                desc: 'Indicators: annual turnover; regretted attrition; stay‑interview coverage & actions closed.',
                guidance: '',
                trainings: '',
                r4: 'turnover <10%; regretted <5%; ≥90% coverage',
                r3: '10–12/5–7/80–89',
                r2: '13–15/8–10/70–79',
                r1: 'higher/lower.'
            },
            {
                name: 'KPI 8.3 | Manager effectiveness',
                desc: 'Indicators: manager 180 index (clarity, coaching, care); improvement after PD.',
                guidance: '',
                trainings: '',
                r4: '≥90% favorable; sustained lift',
                r3: '85–89; clear lift',
                r2: '75–84; modest',
                r1: 'weak.'
            }
        ];

        for (const [idx, kpi] of kpisS8.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s8Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        await client.query('COMMIT');
        console.log('\n✅ Head of CARE Rubrics seed completed successfully!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

seedHeadOfCareRubrics();
