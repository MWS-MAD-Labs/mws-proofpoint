import pg from 'pg';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function seedPrincipalRubrics() {
    const client = await pool.connect();
    try {
        console.log('Starting MWS Principal Rubrics redo seed process...');

        await client.query('BEGIN');

        // 1. Create Department for Principals
        const deptId = uuidv4();
        await client.query(
            'INSERT INTO departments (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [deptId, 'Principals']
        );
        console.log('✓ Department created: Principals');

        // 2. Create Rubric Template for Principals
        const templateId = uuidv4();
        await client.query(
            `INSERT INTO rubric_templates (id, name, description, department_id, is_global, created_by)
             VALUES ($1, $2, $3, $4, $5, NULL)`,
            [
                templateId,
                'MWS Principal Performance Standards',
                'Millennia World School Standards for Performance Development and Appraisal for Principals (v1.0, 26-Aug-2025)',
                deptId,
                false
            ]
        );
        console.log('✓ Rubric Template created: MWS Principal Performance Standards');

        const domainWeight = 16.67;

        // --- DOMAIN 1: Professional Knowledge, Vision, Planning & Understanding ---
        const d1Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d1Id, templateId, 'D1: Professional Knowledge, Vision, Planning & Understanding', 1, domainWeight]
        );

        // Standard 1
        const s1Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s1Id, d1Id, 'Standard 1. Lead with Vision and Strategic Planning (MWS Mission–Values in Action)', 1]
        );

        const kpisS1 = [
            {
                name: 'KPI 1: Vision Communication, Stakeholder Commitment, and Behavioral Modeling',
                desc: 'Formula: 0.4·(% comms using Shared Language) + 0.4·(Clarity Index) + 0.2·(Modeling entries/month normalized to /8) ·100',
                guidance: 'Annotated presentation decks with audience feedback; Communication audit reports; Behavioral modeling observation journals; Survey analysis reports (disaggregated); Interview transcripts; Visual communication tools (dashboards, posters, displays).',
                trainings: 'Vision Communication and Storytelling; Transformational Leadership and Values-Based Modeling; Stakeholder Engagement Strategies; Presentation and Public Speaking Excellence; Balanced Scorecard Implementation',
                r4: '≥95% of stakeholders demonstrate deep vision understanding; >10 behavioral modeling instances/month; 100% communications reference vision; communication style inspires culture change.',
                r3: '≥90% understanding; ≥8 instances/month; ≥90% communications reference vision; positive influence on culture evident.',
                r2: '75–89% understanding; 5–7 instances/month; 75–89% communications reference vision; cultural influence inconsistent.',
                r1: '<75% understanding; <5 instances/month; <75% communications reference vision; minimal cultural impact.'
            },
            {
                name: 'KPI 2: Strategic Planning, Objective Communication and Adaptive Leadership',
                desc: 'Formula: 0.25·(On-time 0/100) + 0.25·(% initiatives tracked in Living Dashboard) + 0.25·(% goals on-track) + 0.25·(Stakeholder clarity)',
                guidance: 'SSP with consultation records & alignment matrix; Dashboards and tracking logs; Internal & external alignment reports; Quarterly review reports; Admissions and placement documents.',
                trainings: 'Strategic Planning & Execution; DataWise; Data-Driven Decision-Making; Adaptive Leadership; Policy Alignment and Compliance',
                r4: 'SSP completed early; 100% tracking; 98% alignment; 98%+ goals achieved; Data dashboards actively guide strategic decisions; exceptional stakeholder satisfaction.',
                r3: 'SSP on time; 100% tracking; 95–97% alignment; 95% goals achieved; good satisfaction.',
                r2: 'Minor delays; 85–99% tracking; 85–94% alignment; 85–94% goals achieved.',
                r1: 'Late SSP; poor tracking; <85% alignment; <85% goals achieved.'
            },
            {
                name: 'KPI 3: Integral Education Integration in Strategic Planning',
                desc: 'Formula: 100% mapping; ≥7 initiatives; ≥85% literacy.',
                guidance: 'SSP integral education matrix; PD session materials & action plans; Initiative impact & sustainability reports; Literacy survey & reflection journals; Placement rationale aligned with integral framework.',
                trainings: 'Integral Education Philosophy; Holistic/Integral Curriculum Design; Transformational Leadership',
                r4: '100% SSP goals integrate 4+ dimensions; 8+ PD sessions; 10+ initiatives; exceeds literacy targets.',
                r3: '100% goals integrate 3+ dimensions; 6–7 PD sessions; 7–9 initiatives; meets literacy targets.',
                r2: '90–99% goals integrate 2–3 dimensions; 4–5 PD sessions; 5–6 initiatives; near literacy targets.',
                r1: '<90% goals integrate integral principles; <4 PD sessions; <5 initiatives; below literacy targets.'
            }
        ];
        for (const [idx, kpi] of kpisS1.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s1Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // Standard 2
        const s2Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s2Id, d1Id, 'Standard 2. Understand Teaching, Learning & Human Growth', 2]
        );

        const kpisS2 = [
            {
                name: 'KPI 1: Advanced Pedagogical Mastery and Application, including Teaching & Learning Framework Implementation',
                desc: 'Indicators: # advanced pedagogy programs led/attended; % observed lessons showing inclusive/metacognitive practice (peer walkthrough tool); improvement in engagement/behavior signals.',
                guidance: 'Published Teaching & Learning Framework; Training agendas and attendance records; Observation and walkthrough reports; Student feedback summaries.',
                trainings: 'Advanced Pedagogy and Metacognitive Teaching Strategies; Curriculum Mapping and Alignment; Positive Discipline in the Classroom; Learning Sciences; Neurodiversity-Responsive Education; Inclusive and Compassionate Practices; Culturally Responsive Pedagogy',
                r4: 'Framework published early; 6+ programs; transformational coaching evident; ≥90% lessons inclusive; significant, documented improvements in student outcomes and engagement.',
                r3: 'Framework published on time; 4–5 programs; strong coaching impact; ≥80% inclusive lessons; measurable positive student impact.',
                r2: 'Framework published on time; 2–3 programs; moderate coaching impact; 60–79% inclusive lessons; limited student outcome improvements.',
                r1: 'Framework delayed; <2 programs; minimal coaching impact; <60% inclusive lessons; no clear student outcome changes.'
            },
            {
                name: 'KPI 2: Inclusive & Intersectional Design',
                desc: 'Formula: 0.6·(% units with barrier-removal/UDL tags) + 0.2·(# equity reviews vs plan) + 0.2·(gap reduction vs baseline)',
                guidance: 'Unit plans with UDL tags, equity review logs, outcomes.',
                trainings: 'Learning sciences; UDL; culturally responsive pedagogy; neurodiversity-responsive education',
                r4: '≥95% units; ≥4 reviews; clear reduction in access gaps.',
                r3: '85–94% units; 3 reviews; reduction in access gaps.',
                r2: '70–84% units; 2 reviews; small reduction in access gaps.',
                r1: '<70% units; <2 reviews; no reduction in access gaps.'
            },
            {
                name: 'KPI 3: Ethical Data Use & Insight',
                desc: 'Formula: 0.25·(Data dictionary live) + 0.25·(# inquiry protocols in use) + 0.25·(% plans citing data) + 0.25·(privacy compliance)',
                guidance: 'Data dictionary, meeting artifacts, plan reviews, privacy logs.',
                trainings: 'Data ethics; privacy checklist; DataWise; data‑inquiry protocols',
                r4: 'Dictionary live; ≥3 protocols; ≥90% plans; 100% compliance.',
                r3: 'Dictionary live; 2 protocols; 80–89% plans; 100% compliance.',
                r2: 'Dictionary draft; 1 protocol; 60–79% plans; minor gaps.',
                r1: 'No dictionary; 0 protocols; <60% plans; privacy gaps.'
            }
        ];
        for (const [idx, kpi] of kpisS2.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s2Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // --- DOMAIN 2: Instructional & Integral Leadership ---
        const d2Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d2Id, templateId, 'D2: Instructional & Integral Leadership', 2, domainWeight]
        );

        // Standard 3
        const s3Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s3Id, d2Id, 'Standard 3. Lead Instructional Quality (Curriculum, Pedagogy, Integral Development)', 1]
        );

        const kpisS3 = [
            {
                name: 'KPI 1: Comprehensive Curriculum and Integral Education Leadership',
                desc: 'Indicators: % curriculum units aligned to Integral Education; Number of curriculum audits/reviews conducted; Number of implemented transdisciplinary projects; Number of teachers trained in curriculum innovation; Teacher/student feedback on instructional alignment',
                guidance: 'Curriculum audit reports and review minutes; Lesson plan evaluations with integral alignment; PLC records and collaboration logs; Stakeholder feedback surveys; Student project portfolios.',
                trainings: 'Advanced Curriculum Leadership; Integral Education Design; Instructional Supervision; Multi-tiered Instructional Support; Curriculum Design and Evaluation; Visible Thinking; Project-Based Learning (PBL) Strategies; Differentiated and Adaptive Instruction',
                r4: '100% units aligned; high-impact interdisciplinary projects; exceptional student agency gains.',
                r3: '≥90% units aligned; strong interdisciplinary projects; positive feedback.',
                r2: '75–89% aligned; limited interdisciplinary work; moderate feedback.',
                r1: '<75% aligned; minimal integration; poor relevance feedback.'
            },
            {
                name: 'KPI 2: Integral Education Implementation Excellence',
                desc: 'Indicators: Percentage of curricular and co-curricular activities demonstrating integral education alignment; Number of initiatives promoting integral/holistic human development; Staff and student feedback on integral education experience; Evidence of culture shift toward growth mindset and innovation',
                guidance: 'Integral education implementation audits and reports; Initiative documentation with holistic/integral outcomes; Survey results on student/staff flourishing; Growth mindset workshop and leadership documentation.',
                trainings: 'Millennia Integral Education Framework; Growth Mindset Leadership; Transpersonal Development; Innovation Leadership',
                r4: '100% integral education implementation; 8+ integral/holistic initiatives; transformative culture change evident.',
                r3: '90–99% implementation; 6–7 initiatives; strong culture improvement.',
                r2: '80–89% implementation; 4–5 initiatives; moderate culture shifts.',
                r1: '<80% implementation; <4 initiatives; limited culture change.'
            },
            {
                name: 'KPI 3: Research-Based Innovation and Teaching Practice Enhancement',
                desc: 'Indicators: Number and quality of research projects and innovations introduced; Percentage of school policies updated using research findings; Number of action research projects and resulting improvements in teaching practice; Documented improvements in student learning outcomes',
                guidance: 'Research proposals and published reports; Policy revision logs and rationales; Action research documentation with results; Student performance and impact assessment reports.',
                trainings: 'Educational Research Methods; Policy Innovation; Instructional Leadership',
                r4: '3+ research projects; 100% policies updated; 6+ action research cycles with transformative impact.',
                r3: '2 projects; 90% policies updated; 4–5 action research cycles with positive impact.',
                r2: '1 project; 70–89% policies updated; 2–3 action research cycles with modest impact.',
                r1: 'No significant research or policy innovation; <70% updated; <2 action research cycles.'
            }
        ];
        for (const [idx, kpi] of kpisS3.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s3Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // Standard 4
        const s4Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s4Id, d2Id, 'Standard 4. Continuous Improvement: Support, Assessment, Innovation & Technology', 2]
        );

        const kpisS4 = [
            {
                name: 'KPI 1: Comprehensive Student Support Systems such as MTSS',
                desc: 'Indicators: % of students receiving targeted MTSS interventions with documented progress; Individualized learning plans; Stakeholder satisfaction.',
                guidance: 'MTSS logs, ILPs, adaptive learning observation sheets, anecdotal records, formative assessment data, counselor notes, family meeting notes.',
                trainings: 'MTSS; Differentiated Pedagogy; Inclusive Education Leadership; Equity Leadership; Strengths-Based Development.',
                r4: 'Full MTSS; 100% identified students supported; exceptional progress; comprehensive ecosystem.',
                r3: '90–99% implementation; positive progress; strong satisfaction.',
                r2: '75–89% implementation; moderate progress; partial satisfaction.',
                r1: '<75% implementation; limited progress; weak ecosystem.'
            },
            {
                name: 'KPI 2: Assessment-Driven Teaching Excellence and Equity Leadership',
                desc: 'Indicators: % teachers effectively using data; Reduction in achievement gaps; Trainings conducted; Stakeholder understanding.',
                guidance: 'Assessment plans, training logs, data dashboards, achievement gap reports, parent-teacher meeting notes.',
                trainings: 'Assessment Literacy; Data-Informed Instruction; DataWise; Equity-Focused Strategies.',
                r4: '≥90% teachers proficient; significant gap reduction; exceptional improvement.',
                r3: '80–89% teachers proficient; measurable gap closure; strong data use.',
                r2: '60–79% teachers proficient; moderate improvements; limited data use.',
                r1: '<60% teachers proficient; minimal gap progress; poor data integration.'
            },
            {
                name: 'KPI 3: Collaborative Excellence and Growth Culture Leadership',
                desc: 'Indicators: # PLC sessions; Teacher feedback; Growth in practice; Reduced conflicts.',
                guidance: 'PLC session logs, peer observation records, coaching logs, staff surveys, conflict resolution documentation.',
                trainings: 'Growth Mindset; Collaborative Leadership; PLC Development; Interpersonal Communication.',
                r4: '≥8 PLC cycles; transformative growth culture; high collaboration scores; systemic teamwork.',
                r3: '6–7 PLC cycles; strong collaboration; growth mindset evident.',
                r2: '4–5 PLC cycles; moderate collaboration and growth culture.',
                r1: '<4 PLC cycles; weak collaboration; limited growth mindset.'
            },
            {
                name: 'KPI 4: Agile Innovation Culture Leadership',
                desc: 'Indicators: # projects piloted/scaled; Participation rate; Improvements in learning; Stakeholder feedback.',
                guidance: 'Innovation project proposals, reports, labs/workshops records, impact analyses, student work samples, dissemination records.',
                trainings: 'Educational Tech Integration; Agile Methods; Design Thinking; Change Management.',
                r4: '4+ transformative projects; exceptional impact on teaching, learning, and reputation.',
                r3: '3 projects; significant positive improvements; strong recognition.',
                r2: '2 projects; modest innovation outcomes; limited scaling.',
                r1: '<2 projects; minimal innovation culture or impact.'
            },
            {
                name: 'KPI 5: Continuous Improvement and Organizational Learning',
                desc: 'Indicators: # program evaluations; feedback loop integration; crisis management effectiveness; participation in reflective learning.',
                guidance: 'Evaluation reports, feedback logs, crisis protocols, reflective session outputs, sustainability audit reports.',
                trainings: 'Continuous Improvement Frameworks; Learning Organization; Strategic Risk Management; Future-Ready Skills.',
                r4: '5+ evaluations; exceptional improvements; ≥90% future-ready; 6+ reflective sessions; 4+ sustainability projects.',
                r3: '4 evaluations; effective improvements; 80–89% integration; 5 sessions; 3 projects.',
                r2: '3 evaluations; moderate improvements; partial culture; 70–79% integration; 3–4 sessions.',
                r1: '<3 evaluations; limited improvements; weak organizational learning; <70% integration.'
            },
            {
                name: 'KPI 6: Digital Fluency, Safety and Digital Literacy Leadership',
                desc: 'Indicators: % teachers digital fluency; % students digital literacy benchmarks; Training sessions; Safety compliance scores.',
                guidance: 'Teacher assessments, lesson artifacts, student lit results, training materials, safety audit reports.',
                trainings: 'EdTech Integration; Digital Security/Safety; Digital Literacy Leadership; Future-Ready Skills.',
                r4: '≥95% teacher fluency; ≥90% student literacy; multiple impactful programs; excellent safety record.',
                r3: '85–94% teacher fluency; 80–89% student literacy; strong adoption; good safety.',
                r2: '70–84% teacher fluency; 70–79% student literacy; moderate adoption; minor gaps.',
                r1: '<70% teacher fluency; <70% student literacy; low adoption; poor safety.'
            }
        ];
        for (const [idx, kpi] of kpisS4.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s4Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // --- DOMAIN 3: Organizational, Resource & Admissions Management ---
        const d3Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d3Id, templateId, 'D3: Organizational, Resource & Admissions Management', 3, domainWeight]
        );

        // Standard 5
        const s5Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s5Id, d3Id, 'Standard 5. Strategic School Management, Admissions and Operations', 1]
        );

        const kpisS5 = [
            {
                name: 'KPI 1: Strategic Operations, Compliance, and Risk Management',
                desc: 'Indicators: % compliance with Yayasan/Ministry policies; Risk management review complete; Operational audit score; Cross-unit resolution rate; Stakeholder satisfaction.',
                guidance: 'Compliance reports, risk registers, manuals/handbooks, ops audit reports, collaboration resolution logs, feedback forms.',
                trainings: 'School Operations; Compliance; Strategic Risk Management; Crisis Leadership; Regulatory Frameworks.',
                r4: '100% compliance; proactive risk mgmt; systemic efficiency; exemplary audit; ≥90% satisfaction.',
                r3: '95–99% compliance; strong risk mgmt; good efficiency; solid audit; 80–89% satisfaction.',
                r2: '85–94% compliance; moderate risk/efficiency; limited collaboration; 70–79% satisfaction.',
                r1: '<85% compliance; weak risk mgmt; significant gaps; poor audit; <70% satisfaction.'
            },
            {
                name: 'KPI 2: Sustainable Financial Planning, Practices and Resource Optimization',
                desc: 'Indicators: Budget utilization efficiency; % strategic initiatives with cost-effectiveness; Financial transparency satisfaction; # sustainable cost-saving initiatives.',
                guidance: 'Annual/Quarterly reports & plans, cost-effectiveness analyses, transparency feedback, internal/external audits, procurement records.',
                trainings: 'Strategic Financial Planning; Cost Optimization; Stewardship; Transparent Budgeting; Allocation Strategies.',
                r4: '98–100% budget utilization; exceptional cost optimization; sustainable stewardship; zero compliance issues.',
                r3: '96–97% utilization; strong cost management; solid financial practices; minimal issues.',
                r2: '90–95% utilization; basic cost management; some compliance or efficiency gaps.',
                r1: '<90% utilization; poor cost optimization; frequent issues; lack of transparency.'
            },
            {
                name: 'KPI 3: Facilities, Infrastructure, and Environmental Stewardship',
                desc: 'Indicators: Facilities safety score; % maintenance completed on schedule; # sustainability practices; Stakeholder satisfaction; Disaster readiness; Implementation projects on time/budget.',
                guidance: 'Safety & environmental audit reports, project plans/reports, maintenance logs, sustainability docs, disaster readiness reports.',
                trainings: 'Facilities Management; Preventive Maintenance; Safety; Disaster Preparedness; Sustainable Infrastructure.',
                r4: 'Fully safe/optimized; ≥90% on-time maintenance; 4+ sustainability initiatives; exceptional digital readiness.',
                r3: 'Safe, well-maintained; 80–89% on-time; 3 sustainability initiatives; good digital readiness.',
                r2: 'Moderate safety/maintenance issues; 70–79% tasks; 2 sustainability initiatives; limited digital readiness.',
                r1: 'Significant gaps; <70% tasks; minimal sustainability; poor digital readiness.'
            }
        ];
        for (const [idx, kpi] of kpisS5.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s5Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // Standard 6
        const s6Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s6Id, d3Id, 'Standard 6. Effective Time and Human Resource Management', 2]
        );

        const kpisS6 = [
            {
                name: 'KPI 1: Strategic Time Management and Prioritization',
                desc: 'Indicators: % leadership time on instructional/strategic; # efficiency improvements; Adherence to protocols; Stakeholder feedback on accessibility/responsiveness.',
                guidance: 'Master schedules, audits, protocols logs, delegation logs, workflow docs, surveys.',
                trainings: 'Time Optimization; Meeting Wise; Instructional Prioritization; Delegation; Productivity Tools.',
                r4: '≥70% time for strategic leadership; significant process optimizations; high responsiveness; deadlines met.',
                r3: '60–69% time on leadership priorities; good process management; timely completion.',
                r2: '50–59% strategic focus; limited process improvements; moderate delays.',
                r1: '<50% strategic focus; frequent inefficiencies; recurring missed deadlines.'
            },
            {
                name: 'KPI 2: Comprehensive Human Resource Leadership and Development',
                desc: 'Indicators: % positions filled via competency; # appraisals/IDPs completed; # leadership promotions; Existence of succession plan; Recruitment efficiency; Retention rate.',
                guidance: 'Recruitment & onboarding docs, appraisal reports, IDPs, mentoring logs, succession plan docs, retention analyses.',
                trainings: 'HR Management; Competency-Based Recruitment; Succession Planning; Performance Appraisal.',
                r4: '100% HR compliance; efficient recruitment; 100% staff appraised with IDPs; ≥90% retention; robust pipeline.',
                r3: '95–99% compliance; timely recruitment; ≥85% staff appraised; 80–89% retention; good development.',
                r2: '85–94% compliance; recruitment delays; 70–84% appraised; 70–79% retention; limited development.',
                r1: '<85% compliance; inefficient recruitment; <70% appraised; <70% retention; no systematic development.'
            },
            {
                name: 'KPI 3: Staff Wellbeing, Accountability, and Retention',
                desc: 'Indicators: Wellbeing index; Attendance/punctuality compliance; Turnover rate; # wellbeing initiatives.',
                guidance: 'Program docs, survey data, attendance reports, retention strategy docs, exit interview data, recognition records.',
                trainings: 'Staff Wellbeing; Mental Health; Emotional Intelligence; Conflict Resolution; Coaching Skills.',
                r4: 'Wellbeing Index ≥90%; ≥97% attendance; turnover <5%; comprehensive wellbeing initiatives.',
                r3: 'Wellbeing Index 85–89%; 95–96% attendance; turnover 5–10%; robust initiatives.',
                r2: 'Wellbeing Index 75–84%; 90–94% attendance; turnover 11–15%; basic initiatives.',
                r1: 'Wellbeing Index <75%; <90% attendance; turnover >15%; minimal initiatives.'
            }
        ];
        for (const [idx, kpi] of kpisS6.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s6Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // --- DOMAIN 4: Professional Relationships, Community Engagement & Communication ---
        const d4Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d4Id, templateId, 'D4: Professional Relationships, Community Engagement & Communication', 4, domainWeight]
        );

        // Standard 7
        const s7Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s7Id, d4Id, 'Standard 7. Cultivate Strong Interpersonal Relationships and Community Engagement', 1]
        );

        const kpisS7 = [
            {
                name: 'KPI 1: Stakeholder Relationship Building and Inclusive Community Engagement',
                desc: 'Indicators: # inclusive events; % active voice reporting; Conflict resolution success; Trust index; satisfaction scores; # decisions influenced by input; # partnerships.',
                guidance: 'Event planning, Event reports, council minutes, conflict mediation logs, trust survey analysis, stakeholder testimonials, partnership records.',
                trainings: 'Emotional Intelligence; Inclusive Community Engagement; Conflict Resolution; Relationship-Based Leadership.',
                r4: '≥90% satisfaction; 8+ events; extensive decision impact; sustainable partnerships; 95%+ conflict success.',
                r3: '80–89% satisfaction; 6–7 events; good involvement; active partnerships; 90–94% success.',
                r2: '70–79% satisfaction; 4–5 events; limited decision influence; few partnerships; 75–89% success.',
                r1: '<70% satisfaction; <4 events; minimal voices; weak connections; <75% success.'
            },
            {
                name: 'KPI 2: Collaborative Culture and Intelligent Conflict Management',
                desc: 'Indicators: # collaborative initiatives; Reduction in unresolved conflicts/cases; % restorative practices; feedback on teamwork/culture.',
                guidance: 'PLC agendas, collaborative project reports, conflict resolution registers, restorative session logs, culture surveys.',
                trainings: 'Team-Building; Facilitation; Systemic Intelligence; Compassionate Leadership; Restorative Practices.',
                r4: 'Multiple collaborative initiatives; significant conflict reduction; ≥90% satisfaction; thriving culture.',
                r3: 'Several initiatives; moderate conflict reduction; 80–89% satisfaction; good collaboration culture.',
                r2: 'Few initiatives; limited conflict reduction; 70–79% satisfaction; basic practices.',
                r1: 'Minimal collaboration; frequent unresolved conflicts; <70% satisfaction; poor culture.'
            },
            {
                name: 'KPI 3: Strategic External Leadership and Professional Representation',
                desc: 'Indicators: # external engagements; # strategic partnerships; Media sentiment; reputation feedback; awards/recognition.',
                guidance: 'Records of events attended, presentation decks, partnership MOUs/reports, media coverage clippings, reputation surveys, records of awards.',
                trainings: 'Networking; PR Training; Media Training; Partnership Development; Advocacy Skills.',
                r4: '7+ engagements; 5+ partnerships; frequent/impactful representations; multiple recognitions; exceptional reputation.',
                r3: '5–6 engagements; 3–4 partnerships; consistent representation; some recognition; strong reputation.',
                r2: '3–4 engagements; 2 partnerships; occasional representation; limited recognition; moderate reputation.',
                r1: '<3 engagements; <2 partnerships; minimal representation; no recognition; weak reputation.'
            }
        ];
        for (const [idx, kpi] of kpisS7.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s7Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // Standard 8
        const s8Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s8Id, d4Id, 'Standard 8. Communicate Effectively and Transparently', 2]
        );

        const kpisS8 = [
            {
                name: 'KPI 1: Comprehensive Communication Strategy and Transparency',
                desc: 'Indicators: % communications on time; Stakeholder trust index; # documented decisions with communication; audit score; frequency/reach of internal comms; satisfaction score.',
                guidance: 'Communication strategy document, newsletters, memos, decision rationales ("You said, we did"), audit reports, dashboard screenshots.',
                trainings: 'Strategic Communication; Transparency; Trust-Building; Public Speaking; Ethical Information Sharing.',
                r4: 'Consistent, multi-channel; ≥95% timely; exceptional transparency; high trust index; proactive sharing (≥90%); exemplary audit.',
                r3: 'Regular; 90–94% timely; strong transparency; good trust (85–89%); timely updates; solid audit.',
                r2: 'Irregular; 80–89% timely; moderate transparency; fair trust (75–84%); frequent delays; basic audit.',
                r1: 'Limited; <80% timely; poor timeliness/transparency; weak trust; poor audit.'
            },
            {
                name: 'KPI 2: Data-Driven Communication and Stakeholder Engagement',
                desc: 'Indicators: # data-driven sessions; % stakeholders increased understanding; inclusivity measures; feedback ratings; engagement rates; timeliness of reports.',
                guidance: 'Data dashboards, session agendas/logs, multilingual materials, quarterly reports, stakeholder feedback forms.',
                trainings: 'Data Visualization; Reporting Skills; Stakeholder Engagement; Digital Dashboard Management.',
                r4: '4+ forums/reports; ≥90% satisfaction with transparency; proactive detailed reporting; fully inclusive.',
                r3: '4 reports/forums; 80–89% satisfaction; consistent reporting; strong inclusivity.',
                r2: '3 reports/forums; 70–79% satisfaction; moderate engagement; partial inclusivity.',
                r1: '<3 reports/forums; <70% satisfaction; minimal engagement/incomplete reports.'
            },
            {
                name: 'KPI 3: Responsive Crisis and Incident Communication',
                desc: 'Indicators: existence/quality of documented plan; average response time; # simulations annually; stakeholder confidence; # trained staff.',
                guidance: 'Crisis communication plan, contact lists, simulation reports, incident logs, media releases, post-incident reviews.',
                trainings: 'Crisis Planning; SOCO; Emergency Response; Public Relations.',
                r4: 'Comprehensive plan; rapid response (<30 mins); ≥90% stakeholder confidence; regular simulations (excellent results).',
                r3: 'Solid plan; timely response (31-59 mins); 80–89% stakeholder confidence; annual simulations.',
                r2: 'Basic plan; slower response (1–2 hrs); 70–79% confidence; infrequent simulations.',
                r1: 'No clear plan; delayed response (>2 hrs); <70% confidence; no crisis simulations.'
            }
        ];
        for (const [idx, kpi] of kpisS8.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s8Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // --- DOMAIN 5: Professionalism, Values & Ethical Leadership ---
        const d5Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d5Id, templateId, 'D5: Professionalism, Values & Ethical Leadership', 5, domainWeight]
        );

        // Standard 9
        const s9Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s9Id, d5Id, 'Standard 9. Model Ethical and Compassionate Leadership', 1]
        );

        const kpisS9 = [
            {
                name: 'KPI 1: Ethical Decision-Making and Integrity',
                desc: 'Indicators: % decisions with ethical justifications; # ethics trainings; # breaches reported; perception of fairness/transparency.',
                guidance: 'Decision rationale logs, policy reviews, training records, compliance reports, stakeholder survey results.',
                trainings: 'Ethical Leadership; Ethical Governance; Legal Standards; Values-Based Decision-Making.',
                r4: '100% policies reviewed; 2+ ethics trainings; ≥90% stakeholder confidence; zero major breaches; ≥90% trust index.',
                r3: 'Regular reviews; 1–2 ethics trainings; 80–89% stakeholder confidence; minimal breaches resolved; 85–89% trust index.',
                r2: 'Limited reviews; 1 training; 70–79% confidence; occasional unresolved breaches; 75–84% trust index.',
                r1: 'No reviews/trainings; <70% confidence; frequent or unresolved ethical breaches; <75% trust index.'
            },
            {
                name: 'KPI 2: Compassionate Leadership and Psychologically Safe Culture',
                desc: 'Indicators: Safety/wellbeing/inclusivity scores; % staff trained in anti-bias; # recognized acts of compassion; reported discrimination; changes in culture metrics.',
                guidance: 'Wellbeing surveys, anti-bias/anti-discrimination training records, recognition logs, anti-bias policy docs, incident logs.',
                trainings: 'Emotional Intelligence; Positive Discipline for Leaders; Psychological Safety; Anti-Discriminatory Practices.',
                r4: '≥90% wellbeing satisfaction; thriving compassionate culture; 100% training completion; 10+ acts recognized; zero discrimination.',
                r3: '80–89% satisfaction; strong culture of compassion; ≥95% training; 6–9 acts recognized; minimal cases.',
                r2: '70–79% satisfaction; basic compassion practices; 85–94% training; 3–5 acts recognized; occasional cases.',
                r1: '<70% satisfaction; weak compassionate culture; <85% training; <3 acts recognized; multiple cases.'
            },
            {
                name: 'KPI 3: Enforcement of Professional Standards, Values and Accountability',
                desc: 'Indicators: % staff meeting conduct standards; #/resolution rate of violations; values-based PD frequency; inclusion in appraisals; perception of accountability.',
                guidance: 'Attendance/punctuality reports, ethics review minutes, corrective action logs, professional standards docs, appraisal reports.',
                trainings: 'Ethics Enforcement; Accountability Frameworks; Performance Appraisal; values-based leadership.',
                r4: '≥95% adherence to standards; 3+ values-based PD sessions; 4 reviews/year; high issue resolution; ≥90% accountability rating.',
                r3: '85–94% adherence; 2 PD sessions; 3 reviews/year; solid resolution rate; 85–89% accountability rating.',
                r2: '75–84% adherence; 1 PD session; 2 reviews/year; moderate resolution; 75–84% rating.',
                r1: '<75% adherence; no PD sessions; <2 reviews/year; low resolution; <75% rating.'
            }
        ];
        for (const [idx, kpi] of kpisS9.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s9Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // Standard 10
        const s10Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s10Id, d5Id, 'Standard 10. Commit to Lifelong Learning and Reflective Leadership', 2]
        );

        const kpisS10 = [
            {
                name: 'KPI 1: Continuous Personal and Professional Growth and Reflective Leadership',
                desc: 'Indicators: # PD activities; Quality/progress of growth plan; Network engagements; Evidence of reflective practice.',
                guidance: 'PD certificates/transcripts, growth plan reviews, network logs, reflective journals, coaching session reports.',
                trainings: 'Advanced Leadership; Reflective Leadership; Networking; Mentorship; Mindfulness.',
                r4: '6+ PD activities; fully executed plan; active in ≥4 networks; transformative reflective practice.',
                r3: '4–5 activities; solid plan; active in 2-3 networks; clear evidence of reflection in practice.',
                r2: '2–3 activities; basic plan; active in 1 network; limited evidence of reflection.',
                r1: '<2 PD activities; no formal plan; no network activity; minimal reflection.'
            },
            {
                name: 'KPI 2: Staff Mentorship & IDPs',
                desc: 'Indicators: % staff with IDPs; # mentoring sessions per mentee; growth against IDPs; leadership pipeline entries.',
                guidance: 'IDPs, mentoring logs, appraisal outcomes, mentorship reports.',
                trainings: 'Coaching/mentoring; adult learning; IDPs; leadership pipelines.',
                r4: '100% staff with IDPs; ≥6 sessions/mentee; strong growth; active leadership pipeline.',
                r3: '95–99% staff with IDPs; 4–5 sessions; solid growth; visible leadership pipeline.',
                r2: '85–94% staff with IDPs; 2–3 sessions; modest growth; limited leadership pipeline.',
                r1: '<85% staff with IDPs; <2 sessions; minimal growth; no leadership pipeline.'
            },
            {
                name: 'KPI 3: Growth‑Mindset & Professional Learning Culture',
                desc: 'Indicators: # learning events; adoption of growth‑mindset practices; organizational learning artifacts.',
                guidance: 'Event logs, surveys, knowledge‑share artifacts, staff inquiry records.',
                trainings: 'Learning organization; growth‑mindset practices; reflective practice; inquiry-led projects.',
                r4: '6+ learning events; ≥90% adoption; extensive organizational learning artifacts.',
                r3: '4–5 events; 80–89% adoption; clear organizational learning evidence.',
                r2: '3 events; 70–79% adoption; limited organizational learning evidence.',
                r1: '<3 events; <70% adoption; minimal learning culture.'
            }
        ];
        for (const [idx, kpi] of kpisS10.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s10Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // --- DOMAIN 6: Millennia World School Culture ---
        const d6Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_domains (id, template_id, name, sort_order, weight) VALUES ($1, $2, $3, $4, $5)',
            [d6Id, templateId, 'D6: Millennia World School Culture', 6, domainWeight]
        );

        // Standard 11
        const s11Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s11Id, d6Id, 'Standard 11. Promote MWS Integral & Responsive Culture', 1]
        );

        const kpisS11 = [
            {
                name: 'KPI 1: Mission Ownership & Role Clarity',
                desc: 'Indicators: % stakeholders who can articulate mission and give a recent example; # participatory forums; staff role‑clarity index.',
                guidance: 'Forum minutes, mission visibility toolkit, staff survey, culture audits.',
                trainings: 'Shared leadership; mission visibility; participatory culture; organizational storytelling.',
                r4: '≥90% mission articulation; ≥6 forums; ≥90% role clarity; stakeholders can state mission & give concrete example.',
                r3: '85–89% mission articulation; 4–5 forums; 80–89% role clarity.',
                r2: '75–84% mission articulation; 3 forums; 70–79% role clarity.',
                r1: '<75% mission articulation; <3 forums; <70% role clarity.'
            },
            {
                name: 'KPI 2: Safe, Positive, and Responsive Climate',
                desc: 'Indicators: climate rating; % incidents resolved restoratively; wellbeing programs delivered; reduction in repeat incidents.',
                guidance: 'Climate surveys, incident logs, program records, restorative session logs, culture walkthrough reports.',
                trainings: 'Restorative culture; safe/positive climate; wellbeing programs; conflict resolution.',
                r4: '≥90% climate positive; ≥95% restorative resolution; ≥5 wellbeing programs; strong downward incident trend.',
                r3: '85–89% climate positive; 85–94% restorative resolution; 3–4 programs; clear downward trend.',
                r2: '75–84% climate positive; 70–84% restorative resolution; 1–2 programs; modest trend.',
                r1: '<75% climate positive; <70% restorative resolution; 0 programs; minimal trend.'
            },
            {
                name: 'KPI 3: Learning Organization & Sustainability',
                desc: 'Indicators: # reflective sessions; # inquiry‑led projects; sustainability audit score; participation in eco initiatives.',
                guidance: 'Session docs, project files, eco audits, knowledge sharing artifacts.',
                trainings: 'Sustainability in schools; learning organization; inquiry-led projects.',
                r4: '≥6 reflective sessions; ≥5 inquiry projects; high sustainability score; strong participation.',
                r3: '4–5 reflective sessions; 3–4 inquiry projects; solid sustainability score; good participation.',
                r2: '3 reflective sessions; 2 inquiry projects; moderate sustainability score; modest participation.',
                r1: '<3 reflective sessions; <2 inquiry projects; weak sustainability score; low participation.'
            }
        ];
        for (const [idx, kpi] of kpisS11.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s11Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        // Standard 12
        const s12Id = uuidv4();
        await client.query(
            'INSERT INTO kpi_standards (id, domain_id, name, sort_order) VALUES ($1, $2, $3, $4)',
            [s12Id, d6Id, 'Standard 12. Values, Character & Spiritual Flourishing (Inclusive & Developmentally Appropriate)', 2]
        );

        const kpisS12 = [
            {
                name: 'KPI 1: Character & Values Integration',
                desc: 'Indicators: % curriculum/co‑curricular with values targets; student reflections evidencing growth; perception of values visible.',
                guidance: 'Lesson plans with values tags, student journals/portfolios, event logs, stakeholder pulses.',
                trainings: 'Character education; values integration; reflective facilitation.',
                r4: '≥95% activities; weekly reflections; ≥90% stakeholder perception; visible in daily life.',
                r3: '85–94% activities; fortnightly reflections; 80–89% stakeholder perception.',
                r2: '70–84% activities; monthly reflections; 70–79% stakeholder perception.',
                r1: '<70% activities; rare reflections; <70% stakeholder perception.'
            },
            {
                name: 'KPI 2: Reflection & Purposeful Practices',
                desc: 'Indicators: cadence and quality of age‑appropriate practices; participation rate; student self‑reports of purpose.',
                guidance: 'Schedules, attendance logs, student self-reports, purpose index data.',
                trainings: 'Reflective facilitation; inclusive spiritual literacy; purposeful practices.',
                r4: 'Daily practices; ≥90% participation; strong upward trend in purpose/connection.',
                r3: 'Regular practices; 80–89% participation; clear trend.',
                r2: 'Inconsistent practices; 70–79% participation; modest trend.',
                r1: 'Minimal practices; <70% participation; low trend.'
            },
            {
                name: 'KPI 3: Service, Inclusion & Community Impact',
                desc: 'Indicators: # service projects; participation; impact narratives; inter‑belief events.',
                guidance: 'Project logs, rosters, case studies/narratives, community feedback, inter-belief event logs.',
                trainings: 'Service-learning design; inter‑belief understanding; community impact assessment.',
                r4: '≥5 service projects/year; ≥85% student participation; strong impact narratives; ≥3 inter‑belief events.',
                r3: '3–4 service projects; 70–84% student participation; clear impact narratives; 2 inter‑belief events.',
                r2: '2 service projects; 50–69% student participation; modest impact narratives; 1 inter‑belief event.',
                r1: '<2 service projects; <50% student participation; low impact narratives; 0 inter‑belief events.'
            }
        ];
        for (const [idx, kpi] of kpisS12.entries()) {
            await client.query('INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)', [uuidv4(), s12Id, kpi.name, kpi.desc, kpi.guidance, kpi.trainings, idx + 1, kpi.r4, kpi.r3, kpi.r2, kpi.r1]);
        }

        await client.query('COMMIT');
        console.log('\n✅ MWS Principal Rubrics redo seed completed successfully!');
        console.log('   Template: MWS Principal Performance Standards');
        console.log('   Domains: 6');
        console.log('   Standards: 12');
        console.log('   KPIs: 41'); // Some standards had more KPIs in the full text

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

seedPrincipalRubrics();
