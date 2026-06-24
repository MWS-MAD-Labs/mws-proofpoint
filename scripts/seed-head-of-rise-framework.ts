
import pg from 'pg';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function seedHeadOfRiseRubrics() {
    const client = await pool.connect();
    try {
        console.log('Starting Head of RISE Rubrics seed process...');

        await client.query('BEGIN');

        // 1. Create Department for RISE
        const deptId = uuidv4();
        let actualDeptId = deptId;

        // Check if department exists, if not create it.
        // Assuming the department name is 'RISE' based on "Head of RISE" title.
        const deptRes = await client.query('SELECT id FROM departments WHERE name = $1', ['RISE']);

        if (deptRes.rows.length > 0) {
            actualDeptId = deptRes.rows[0].id;
            console.log('✓ Department exists: RISE');
        } else {
            await client.query('INSERT INTO departments (id, name) VALUES ($1, $2)', [actualDeptId, 'RISE']);
            console.log('✓ Department created: RISE');
        }

        // 2. Create Rubric Template
        const templateId = uuidv4();
        await client.query(
            `INSERT INTO rubric_templates (id, name, description, department_id, is_global, created_by)
             VALUES ($1, $2, $3, $4, $5, NULL)`,
            [
                templateId,
                'Head of RISE Performance Standards',
                'Performance Standards for Head of RISE (Vision, Inclusion, Operations, Family Partnership, Ethics, Sustainability)',
                actualDeptId,
                false
            ]
        );
        console.log('✓ Rubric Template created: Head of RISE Performance Standards');

        const domainWeight = 100.0 / 6.0; // 6 Domains, equal weight approx 16.66%

        // --- DOMAIN 1 ---
        const d1Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d1Id, templateId, 'D1: Vision, Knowledge & Inclusive Strategy', 1, domainWeight]
        );

        // Standard 1
        const s1Id = uuidv4();
        const s1Guidance = 'Core tasks: Publish SEN & Pelangi portfolio; quarterly review; decision notes. Evidence: strategy deck; portfolio map; dashboard; comms audit; stakeholder pulse.';
        const s1Trainings = 'Strategy & execution; Balanced Scorecard for inclusion; participatory planning.';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s1Id, d1Id, 'Standard 1: Lead an MWS‑aligned Inclusion & Therapy Strategy', 1]
        );

        const kpisS1 = [
            {
                name: 'KPI 1.1 | Strategy coherence & delivery',
                desc: 'Indicators: plan on time; 100% initiatives tracked in the Living Dashboard; ≥90% milestones on track; stakeholder clarity ≥85%.',
                r4: 'on time/100/≥95/≥90',
                r3: 'on time/100/90–94/85–89',
                r2: 'minor delay/85–99/80–89/75–84',
                r1: 'late/<85/<80/<75'
            },
            {
                name: 'KPI 1.2 | Mission & Shared Language adoption in SEN/Therapy outputs',
                desc: 'Indicators: ≥90% outputs use Shared Language; ≥85% stakeholders can state the mission & give a concrete inclusion example.',
                r4: '≥95/≥90',
                r3: '90–94/85–89',
                r2: '80–89/75–84',
                r1: '<80/<75'
            },
            {
                name: 'KPI 1.3 | Scorecard coverage',
                desc: 'Indicators: projects mapped across all four perspectives with balance (no single perspective >50%).',
                r4: '100% & balanced',
                r3: '100% & minor imbalance',
                r2: '85–99%/imbalanced',
                r1: '<85%'
            }
        ];

        for (const [idx, kpi] of kpisS1.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s1Id, kpi.name, kpi.desc, s1Guidance, s1Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 2
        const s2Id = uuidv4();
        // Updated S2 Guidance/Trainings based on input
        const s2Guidance = 'Core tasks: IEP/ILP templates; tool validation; privacy checks. Evidence: IEP/ILP samples; AT/AAC plans; consent logs; data dictionary.';
        const s2Trainings = 'Neurodiversity & learning sciences; UDL & AAC/AT; mixed‑methods; data ethics.';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s2Id, d1Id, 'Standard 2: Lead with deep knowledge of learning, development & inclusive/therapeutic methods', 2]
        );

        const kpisS2 = [
            {
                name: 'KPI 2.1 | Assessment & Planning Quality Index (school + clinic)',
                desc: 'Indicators: presence/quality of anamnesis, standardized tools, ILP/IEP goals (SMART), baseline & progress methods, cultural/linguistic notes, consent.',
                r4: '≥90%',
                r3: '80–89%',
                r2: '60–79%',
                r1: '<60%'
            },
            {
                name: 'KPI 2.2 | Inclusive design adoption',
                desc: 'Indicators: % units with UDL/accommodation tags; AT/AAC plans active; barrier‑removal notes for equity groups.',
                r4: '≥95%',
                r3: '85–94%',
                r2: '70–84%',
                r1: '<70%'
            },
            {
                name: 'KPI 2.3 | Ethical data use & privacy',
                desc: 'Indicators: data dictionary live; access controls; 100% privacy audits passed; therapy notes meet clinical standards.',
                r4: 'live/≥95/100%',
                r3: 'live/90–94/100%',
                r2: 'draft/75–89/minor gaps',
                r1: 'none/<75/gaps'
            }
        ];

        for (const [idx, kpi] of kpisS2.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s2Id, kpi.name, kpi.desc, s2Guidance, s2Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // --- DOMAIN 2 ---
        const d2Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d2Id, templateId, 'D2: Instructional & Therapeutic Leadership', 2, domainWeight]
        );

        // Standard 3
        const s3Id = uuidv4();
        const s3Guidance = 'Evidence: walkthroughs; unit plans; modified assessments; feedback artifacts; co‑planning minutes.';
        const s3Trainings = 'Differentiated instruction; task analysis; positive behavior supports; accessible assessment.';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s3Id, d2Id, 'Standard 3: Make teaching inclusive and effective (co‑teaching, accommodations, curriculum & assessment)', 1]
        );

        const kpisS3 = [
            {
                name: 'KPI 3.1 | Classroom inclusion fidelity',
                desc: 'Indicators: % observed lessons at Proficient+ on inclusive look‑fors (clear goals, scaffolded language, visuals/AAC where needed, UDL, positive behavior supports, metacognition).',
                r4: '≥90%',
                r3: '80–89%',
                r2: '60–79%',
                r1: '<60%'
            },
            {
                name: 'KPI 3.2 | IEP/ILP goal progress',
                desc: 'Indicators: % learners on track to meet term goals (GAS or equivalent); quality of teacher feedback to learner/family.',
                r4: '≥75% on track & feedback high quality',
                r3: '60–74% & solid',
                r2: '40–59% & variable',
                r1: '<40% & weak'
            },
            {
                name: 'KPI 3.3 | Co‑planning & co‑teaching coverage',
                desc: 'Indicators: % classes with scheduled SEN collaboration; use of accessible materials bank.',
                r4: '≥85%',
                r3: '70–84%',
                r2: '50–69%',
                r1: '<50%'
            }
        ];

        for (const [idx, kpi] of kpisS3.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s3Id, kpi.name, kpi.desc, s3Guidance, s3Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 4
        const s4Id = uuidv4();
        const s4Guidance = 'Evidence: assessment & plan files; session notes; GAS summaries; parent logs.';
        const s4Trainings = 'Evidence‑based practice; child‑centred sessions; AAC/AT; parent coaching.';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s4Id, d2Id, 'Standard 4: Deliver high‑quality therapy & integrate school–clinic practice', 2]
        );

        const kpisS4 = [
            {
                name: 'KPI 4.1 | Therapy plan timeliness & quality',
                desc: 'Indicators: % plans within SLA (e.g., 10 business days post‑assessment) and rated “fit‑for‑purpose” by supervisor.',
                r4: '≥95% on time & high quality',
                r3: '90–94%',
                r2: '80–89%',
                r1: '<80%'
            },
            {
                name: 'KPI 4.2 | Session fidelity & documentation',
                desc: 'Indicators: % sessions following planned structure, with goals addressed and progress notes completed same day; no‑show rate managed with follow‑up.',
                r4: '≥95% fidelity, notes same day, no‑show <5%',
                r3: '90–94%, next day, 5–9%',
                r2: '80–89%, 48h, 10–14%',
                r1: 'lower/late/>14%'
            },
            {
                name: 'KPI 4.3 | Outcome achievement (GAS/standardized)',
                desc: 'Indicators: % therapy goals rated achieved or better at review; family carryover adherence.',
                r4: '≥75% goals met & ≥80% carryover',
                r3: '60–74% & 70–79%',
                r2: '40–59% & 50–69%',
                r1: '<40% & <50%'
            }
        ];

        for (const [idx, kpi] of kpisS4.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s4Id, kpi.name, kpi.desc, s4Guidance, s4Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // --- DOMAIN 3 ---
        const d3Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d3Id, templateId, 'D3: Systems, Safeguarding & Operational Efficiency', 3, domainWeight]
        );

        // Standard 5
        const s5Id = uuidv4();
        const s5Guidance = 'Evidence: caseload trackers; safeguarding logs; BSPs; consent forms; MDT minutes.';
        const s5Trainings = ''; // Not explicitly listed in text for Standard 5, inferring from Domain or Leaving Blank. The text had trainings for previous standards. S5 text block doesn't explicitly list "Trainings: ..." before Evidence. Wait, S5 text says: "Evidence: caseload trackers; safeguarding logs; BSPs; consent forms; MDT minutes." but no "Trainings: ..." line. I will leave it blank.

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s5Id, d3Id, 'Standard 5: Run strong MTSS/IEP case‑management & safeguarding', 1]
        );

        const kpisS5 = [
            {
                name: 'KPI 5.1 | IEP/ILP & MTSS coverage',
                desc: 'Indicators: % identified learners with current plans; review cadence met; progress monitoring on schedule.',
                r4: '100%/on schedule',
                r3: '95–99%/minor slippage',
                r2: '85–94%/irregular',
                r1: '<85%/gaps'
            },
            {
                name: 'KPI 5.2 | Safeguarding & risk',
                desc: 'Indicators: 100% staff trained; incident response times; quality of behavior support plans; trauma‑informed practices visible.',
                r4: '100%/rapid/high',
                r3: '≥95%/good',
                r2: '85–94%/moderate',
                r1: '<85%/weak'
            },
            {
                name: 'KPI 5.3 | Transitions & placement',
                desc: 'Indicators: clear entry/exits, referrals, inter‑service coordination; family consent & briefings documented.',
                r4: 'complete, timely, high satisfaction',
                r3: 'solid',
                r2: 'patchy',
                r1: 'weak'
            }
        ];

        for (const [idx, kpi] of kpisS5.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s5Id, kpi.name, kpi.desc, s5Guidance, s5Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 6
        const s6Id = uuidv4();
        const s6Guidance = 'Evidence: repository audit; scheduling reports; utilization dashboards; style checks.';
        const s6Trainings = '';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s6Id, d3Id, 'Standard 6: Optimize operations (scheduling, waitlists, cost, templates, repository)', 2]
        );

        const kpisS6 = [
            {
                name: 'KPI 6.1 | Documentation punctuality',
                desc: 'Indicators: % therapy notes & school reports filed by SLA.',
                r4: '≥95%',
                r3: '90–94%',
                r2: '80–89%',
                r1: '<80%'
            },
            {
                name: 'KPI 6.2 | Access & efficiency',
                desc: 'Indicators: median wait time to first session; session utilization (kept/available); no‑show & late cancellations trend.',
                r4: '≤10 days/≥90%/≤5%',
                r3: '11–14/85–89%/6–9%',
                r2: '15–21/75–84%/10–14%',
                r1: '>21/<75%/>14%'
            },
            {
                name: 'KPI 6.3 | Template reuse & standardization',
                desc: 'Indicators: ratio used across ≥3 teams; % outputs meeting design standards.',
                r4: '≥0.60 & ≥95%',
                r3: '0.50–0.59 & 90–94%',
                r2: '0.35–0.49 & 80–89%',
                r1: 'lower'
            }
        ];

        for (const [idx, kpi] of kpisS6.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s6Id, kpi.name, kpi.desc, s6Guidance, s6Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // --- DOMAIN 4 ---
        const d4Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d4Id, templateId, 'D4: Family Partnership, Interdisciplinary Collaboration & Communication', 4, domainWeight]
        );

        // Standard 7
        const s7Id = uuidv4();
        const s7Guidance = 'Evidence: workshop logs; translated materials; parent pulses; follow‑up trackers.';
        const s7Trainings = '';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s7Id, d4Id, 'Standard 7: Partner with families for learning & life outcomes', 1]
        );

        const kpisS7 = [
            {
                name: 'KPI 7.1 | Parent coaching & training',
                desc: 'Indicators: # sessions/term; attendance; usefulness rating.',
                r4: '≥4/term, ≥80% attend, ≥4.3/5',
                r3: '3, 70–79%, ≥4.0',
                r2: '2, 60–69%, ≥3.6',
                r1: 'lower'
            },
            {
                name: 'KPI 7.2 | Family clarity & trust',
                desc: 'Indicators: % families who understand goals & how to help; “feedback‑to‑action” transparency.',
                r4: '≥90% & ≥90%',
                r3: '80–89% & 80–89%',
                r2: '70–79% & 60–79%',
                r1: 'lower'
            },
            {
                name: 'KPI 7.3 | Culturally/language‑accessible materials',
                desc: 'Indicators: % plans & reports issued in accessible formats/languages as required.',
                r4: '≥95%',
                r3: '90–94%',
                r2: '80–89%',
                r1: '<80%'
            }
        ];

        for (const [idx, kpi] of kpisS7.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s7Id, kpi.name, kpi.desc, s7Guidance, s7Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 8
        const s8Id = uuidv4();
        const s8Guidance = ''; // No evidence listed specifically for S8
        const s8Trainings = '';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s8Id, d4Id, 'Standard 8: Lead multidisciplinary (MDT) collaboration & transparent comms', 2]
        );

        const kpisS8 = [
            {
                name: 'KPI 8.1 | MDT cadence & quality',
                desc: 'Indicators: scheduled MDT per case; action follow‑through.',
                r4: '≥95% on time & ≥90% actions done',
                r3: '90–94%/80–89%',
                r2: '80–89%/60–79%',
                r1: 'lower'
            },
            {
                name: 'KPI 8.2 | Data briefings with accessibility',
                desc: 'Indicators: staff/parents receive clear dashboards/briefs; inclusivity checklist met.',
                r4: '≥2/term, ≥90% clarity, full accessibility',
                r3: '1/term, 80–89%, full',
                r2: '1/sem, 70–79%, partial',
                r1: 'lower'
            },
            {
                name: 'KPI 8.3 | Crisis/critical‑incident communication',
                desc: 'Indicators: protocol currency; response time; simulations.',
                r4: 'current/<30m/≥2 per year',
                r3: 'current/<60m/1',
                r2: 'basic/1–2h/limited',
                r1: 'none/>2h/none'
            }
        ];

        for (const [idx, kpi] of kpisS8.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s8Id, kpi.name, kpi.desc, s8Guidance, s8Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // --- DOMAIN 5 ---
        const d5Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d5Id, templateId, 'D5: Professionalism, Ethics & Growth', 5, domainWeight]
        );

        // Standard 9
        const s9Id = uuidv4();
        const s9Guidance = 'Evidence: decision logs; privacy checks; climate surveys; training records; incident logs.';
        const s9Trainings = '';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s9Id, d5Id, 'Standard 9: Uphold ethics, confidentiality, and safe practice', 1]
        );

        const kpisS9 = [
            {
                name: 'KPI 9.1 | Ethical compliance',
                desc: 'Indicators: % decisions with ethical rationale; privacy audits; incident rate; trust index.',
                r4: '≥95%/100%/zero/≥90%',
                r3: '90–94/100/minor/85–89',
                r2: '85–89/minor gaps/occasional/75–84',
                r1: 'lower'
            },
            {
                name: 'KPI 9.2 | Psychological safety & anti‑bias',
                desc: 'Indicators: safety score; anti‑bias training completion; recognized compassion acts; discrimination cases.',
                r4: '≥90%/100%/≥10/zero',
                r3: '85–89/≥95%/6–9/minimal',
                r2: '75–84/85–94/3–5/occasional',
                r1: 'lower'
            }
        ];

        for (const [idx, kpi] of kpisS9.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s9Id, kpi.name, kpi.desc, s9Guidance, s9Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 10
        const s10Id = uuidv4();
        const s10Guidance = 'Evidence: supervision logs; coaching artifacts; PD analysis; repositories.';
        const s10Trainings = '';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s10Id, d5Id, 'Standard 10: Build capability through supervision, PD & reflective practice', 2]
        );

        const kpisS10 = [
            {
                name: 'KPI 10.1 | Supervision & coaching',
                desc: 'Indicators: supervision hours met per therapist/teacher; reflective notes; competence growth.',
                r4: '100% plans met & strong gains',
                r3: '≥90% & solid',
                r2: '75–89% & modest',
                r1: 'lower'
            },
            {
                name: 'KPI 10.2 | PD program ROI',
                desc: 'Indicators: % PD where ≥60% participants show practice lift within 6–8 weeks (classroom rubric or therapy fidelity).',
                r4: '≥70% modules',
                r3: '60–69%',
                r2: '45–59%',
                r1: '<45%'
            },
            {
                name: 'KPI 10.3 | Knowledge base contributions',
                desc: 'Indicators: # high‑quality playbooks/explainers; cross‑team reuse.',
                r4: '≥10 & ≥5 teams',
                r3: '8–9 & 3–4',
                r2: '5–7 & 2',
                r1: 'lower'
            }
        ];

        for (const [idx, kpi] of kpisS10.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s10Id, kpi.name, kpi.desc, s10Guidance, s10Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // --- DOMAIN 6 ---
        const d6Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d6Id, templateId, 'D6: Inclusive Culture, Accessibility & Sustainability', 6, domainWeight]
        );

        // Standard 11
        const s11Id = uuidv4();
        const s11Guidance = ''; // No evidence specific to S11 in prompt
        const s11Trainings = '';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s11Id, d6Id, 'Standard 11: Improve accessibility of environments, materials & technology', 1]
        );

        const kpisS11 = [
            {
                name: 'KPI 11.1 | Accessibility audit improvement',
                desc: 'Indicators: % actions closed (physical, sensory, ICT); student/user satisfaction.',
                r4: '≥90% & ≥90%',
                r3: '80–89% & 80–89%',
                r2: '60–79% & 70–79%',
                r1: 'lower'
            },
            {
                name: 'KPI 11.2 | AT/AAC implementation',
                desc: 'Indicators: % eligible learners with active AT/AAC plans & trained teams/families.',
                r4: '≥95% & ≥90% trained',
                r3: '90–94% & 80–89%',
                r2: '80–89% & 70–79%',
                r1: 'lower'
            },
            {
                name: 'KPI 11.3 | Digital fluency & safety (inclusive)',
                desc: 'Indicators: teacher fluency, student digital literacy, safety audits.',
                r4: '≥95/≥90/100%',
                r3: '85–94/80–89/100%',
                r2: '70–84/70–79/minor gaps',
                r1: 'lower'
            }
        ];

        for (const [idx, kpi] of kpisS11.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s11Id, kpi.name, kpi.desc, s11Guidance, s11Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        // Standard 12
        const s12Id = uuidv4();
        const s12Guidance = 'Evidence: student artifacts; BSPs; incident logs; wellbeing surveys.';
        const s12Trainings = '';

        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s12Id, d6Id, 'Standard 12: Embed student voice, wellbeing & restorative culture', 2]
        );

        const kpisS12 = [
            {
                name: 'KPI 12.1 | Student voice & self‑determination',
                desc: 'Indicators: % learners with voice tools (choice boards, AAC scripts, goal‑setting) used weekly.',
                r4: '≥90%',
                r3: '80–89%',
                r2: '70–79%',
                r1: '<70%'
            },
            {
                name: 'KPI 12.2 | Behavior support quality',
                desc: 'Indicators: % learners with Behavior Support Plans where indicated; reduction in repeat incidents; restorative resolution rate.',
                r4: '≥95% BSPs, strong reduction, ≥95% restorative',
                r3: '85–94/clear/85–94%',
                r2: '70–84/modest/70–84%',
                r1: 'lower'
            },
            {
                name: 'KPI 12.3 | Wellbeing index',
                desc: 'Indicators: favorable responses on safety/belonging/engagement (students, staff, families).',
                r4: '≥90%',
                r3: '85–89%',
                r2: '75–84%',
                r1: '<75%'
            }
        ];

        for (const [idx, kpi] of kpisS12.entries()) {
            await client.query(
                'INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
                [uuidv4(), s12Id, kpi.name, kpi.desc, s12Guidance, s12Trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]
            );
        }

        await client.query('COMMIT');
        console.log('\n✅ Head of RISE Rubrics seed completed successfully!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

seedHeadOfRiseRubrics();
