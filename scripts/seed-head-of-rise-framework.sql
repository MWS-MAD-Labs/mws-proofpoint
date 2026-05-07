
-- Seed Script for Head of RISE Framework
-- Run this with psql or any SQL client

DO $$
DECLARE
    v_dept_id UUID;
    v_template_id UUID;
    v_domain_percentage DECIMAL := 100.0 / 6.0;
    
    -- Domain IDs
    v_d1_id UUID := gen_random_uuid();
    v_d2_id UUID := gen_random_uuid();
    v_d3_id UUID := gen_random_uuid();
    v_d4_id UUID := gen_random_uuid();
    v_d5_id UUID := gen_random_uuid();
    v_d6_id UUID := gen_random_uuid();
    
    -- Standard IDs
    v_s1_id UUID := gen_random_uuid();
    v_s2_id UUID := gen_random_uuid();
    v_s3_id UUID := gen_random_uuid();
    v_s4_id UUID := gen_random_uuid();
    v_s5_id UUID := gen_random_uuid();
    v_s6_id UUID := gen_random_uuid();
    v_s7_id UUID := gen_random_uuid();
    v_s8_id UUID := gen_random_uuid();
    v_s9_id UUID := gen_random_uuid();
    v_s10_id UUID := gen_random_uuid();
    v_s11_id UUID := gen_random_uuid();
    v_s12_id UUID := gen_random_uuid();

BEGIN
    -- 1. Get or Create Department: RISE
    SELECT id INTO v_dept_id FROM departments WHERE name = 'RISE';
    IF v_dept_id IS NULL THEN
        v_dept_id := gen_random_uuid();
        INSERT INTO departments (id, name) VALUES (v_dept_id, 'RISE');
        RAISE NOTICE 'Created Department: RISE';
    ELSE
        RAISE NOTICE 'Department RISE exists';
    END IF;

    -- 2. Create Rubric Template
    v_template_id := gen_random_uuid();
    INSERT INTO rubric_templates (id, name, description, department_id, is_global, created_by)
    VALUES (
        v_template_id,
        'Head of RISE Performance Standards',
        'Performance Standards for Head of RISE (Vision, Inclusion, Operations, Family Partnership, Ethics, Sustainability)',
        v_dept_id,
        false,
        NULL
    );
    RAISE NOTICE 'Created Template: Head of RISE Performance Standards';

    -- --- DOMAIN 1: Vision, Knowledge & Inclusive Strategy ---
    INSERT INTO kpi_domains (id, template_id, name, sort_order, weight)
    VALUES (v_d1_id, v_template_id, 'D1: Vision, Knowledge & Inclusive Strategy', 1, v_domain_percentage);

    -- Standard 1
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s1_id, v_d1_id, 'Standard 1: Lead an MWS‑aligned Inclusion & Therapy Strategy', 1);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s1_id, 
    'KPI 1.1 | Strategy coherence & delivery', 
    'Indicators: plan on time; 100% initiatives tracked in the Living Dashboard; ≥90% milestones on track; stakeholder clarity ≥85%.', 
    'Core tasks: Publish SEN & Pelangi portfolio; quarterly review; decision notes. Evidence: strategy deck; portfolio map; dashboard; comms audit; stakeholder pulse.', 
    'Strategy & execution; Balanced Scorecard for inclusion; participatory planning.', 
    1, 'on time/100/≥95/≥90', 'on time/100/90–94/85–89', 'minor delay/85–99/80–89/75–84', 'late/<85/<80/<75'),

    (gen_random_uuid(), v_s1_id, 
    'KPI 1.2 | Mission & Shared Language adoption in SEN/Therapy outputs', 
    'Indicators: ≥90% outputs use Shared Language; ≥85% stakeholders can state the mission & give a concrete inclusion example.', 
    'Core tasks: Publish SEN & Pelangi portfolio; quarterly review; decision notes. Evidence: strategy deck; portfolio map; dashboard; comms audit; stakeholder pulse.', 
    'Strategy & execution; Balanced Scorecard for inclusion; participatory planning.', 
    2, '≥95/≥90', '90–94/85–89', '80–89/75–84', '<80/<75'),

    (gen_random_uuid(), v_s1_id, 
    'KPI 1.3 | Scorecard coverage', 
    'Indicators: projects mapped across all four perspectives with balance (no single perspective >50%).', 
    'Core tasks: Publish SEN & Pelangi portfolio; quarterly review; decision notes. Evidence: strategy deck; portfolio map; dashboard; comms audit; stakeholder pulse.', 
    'Strategy & execution; Balanced Scorecard for inclusion; participatory planning.', 
    3, '100% & balanced', '100% & minor imbalance', '85–99%/imbalanced', '<85%');

    -- Standard 2
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s2_id, v_d1_id, 'Standard 2: Lead with deep knowledge of learning, development & inclusive/therapeutic methods', 2);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s2_id, 
    'KPI 2.1 | Assessment & Planning Quality Index (school + clinic)', 
    'Indicators: presence/quality of anamnesis, standardized tools, ILP/IEP goals (SMART), baseline & progress methods, cultural/linguistic notes, consent.', 
    'Core tasks: IEP/ILP templates; tool validation; privacy checks. Evidence: IEP/ILP samples; AT/AAC plans; consent logs; data dictionary.', 
    'Neurodiversity & learning sciences; UDL & AAC/AT; mixed‑methods; data ethics.', 
    1, '≥90%', '80–89%', '60–79%', '<60%'),

    (gen_random_uuid(), v_s2_id, 
    'KPI 2.2 | Inclusive design adoption', 
    'Indicators: % units with UDL/accommodation tags; AT/AAC plans active; barrier‑removal notes for equity groups.', 
    'Core tasks: IEP/ILP templates; tool validation; privacy checks. Evidence: IEP/ILP samples; AT/AAC plans; consent logs; data dictionary.', 
    'Neurodiversity & learning sciences; UDL & AAC/AT; mixed‑methods; data ethics.', 
    2, '≥95%', '85–94%', '70–84%', '<70%'),

    (gen_random_uuid(), v_s2_id, 
    'KPI 2.3 | Ethical data use & privacy', 
    'Indicators: data dictionary live; access controls; 100% privacy audits passed; therapy notes meet clinical standards.', 
    'Core tasks: IEP/ILP templates; tool validation; privacy checks. Evidence: IEP/ILP samples; AT/AAC plans; consent logs; data dictionary.', 
    'Neurodiversity & learning sciences; UDL & AAC/AT; mixed‑methods; data ethics.', 
    3, 'live/≥95/100%', 'live/90–94/100%', 'draft/75–89/minor gaps', 'none/<75/gaps');


    -- --- DOMAIN 2: Instructional & Therapeutic Leadership ---
    INSERT INTO kpi_domains (id, template_id, name, sort_order, weight)
    VALUES (v_d2_id, v_template_id, 'D2: Instructional & Therapeutic Leadership', 2, v_domain_percentage);

    -- Standard 3
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s3_id, v_d2_id, 'Standard 3: Make teaching inclusive and effective (co‑teaching, accommodations, curriculum & assessment)', 1);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s3_id, 
    'KPI 3.1 | Classroom inclusion fidelity', 
    'Indicators: % observed lessons at Proficient+ on inclusive look‑fors (clear goals, scaffolded language, visuals/AAC where needed, UDL, positive behavior supports, metacognition).', 
    'Evidence: walkthroughs; unit plans; modified assessments; feedback artifacts; co‑planning minutes.', 
    'Differentiated instruction; task analysis; positive behavior supports; accessible assessment.', 
    1, '≥90%', '80–89%', '60–79%', '<60%'),

    (gen_random_uuid(), v_s3_id, 
    'KPI 3.2 | IEP/ILP goal progress', 
    'Indicators: % learners on track to meet term goals (GAS or equivalent); quality of teacher feedback to learner/family.', 
    'Evidence: walkthroughs; unit plans; modified assessments; feedback artifacts; co‑planning minutes.', 
    'Differentiated instruction; task analysis; positive behavior supports; accessible assessment.', 
    2, '≥75% on track & feedback high quality', '60–74% & solid', '40–59% & variable', '<40% & weak'),

    (gen_random_uuid(), v_s3_id, 
    'KPI 3.3 | Co‑planning & co‑teaching coverage', 
    'Indicators: % classes with scheduled SEN collaboration; use of accessible materials bank.', 
    'Evidence: walkthroughs; unit plans; modified assessments; feedback artifacts; co‑planning minutes.', 
    'Differentiated instruction; task analysis; positive behavior supports; accessible assessment.', 
    3, '≥85%', '70–84%', '50–69%', '<50%');

    -- Standard 4
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s4_id, v_d2_id, 'Standard 4: Deliver high‑quality therapy & integrate school–clinic practice', 2);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s4_id, 
    'KPI 4.1 | Therapy plan timeliness & quality', 
    'Indicators: % plans within SLA (e.g., 10 business days post‑assessment) and rated “fit‑for‑purpose” by supervisor.', 
    'Evidence: assessment & plan files; session notes; GAS summaries; parent logs.', 
    'Evidence‑based practice; child‑centred sessions; AAC/AT; parent coaching.', 
    1, '≥95% on time & high quality', '90–94%', '80–89%', '<80%'),

    (gen_random_uuid(), v_s4_id, 
    'KPI 4.2 | Session fidelity & documentation', 
    'Indicators: % sessions following planned structure, with goals addressed and progress notes completed same day; no‑show rate managed with follow‑up.', 
    'Evidence: assessment & plan files; session notes; GAS summaries; parent logs.', 
    'Evidence‑based practice; child‑centred sessions; AAC/AT; parent coaching.', 
    2, '≥95% fidelity, notes same day, no‑show <5%', '90–94%, next day, 5–9%', '80–89%, 48h, 10–14%', 'lower/late/>14%'),

    (gen_random_uuid(), v_s4_id, 
    'KPI 4.3 | Outcome achievement (GAS/standardized)', 
    'Indicators: % therapy goals rated achieved or better at review; family carryover adherence.', 
    'Evidence: assessment & plan files; session notes; GAS summaries; parent logs.', 
    'Evidence‑based practice; child‑centred sessions; AAC/AT; parent coaching.', 
    3, '≥75% goals met & ≥80% carryover', '60–74% & 70–79%', '40–59% & 50–69%', '<40% & <50%');


    -- --- DOMAIN 3: Systems, Safeguarding & Operational Efficiency ---
    INSERT INTO kpi_domains (id, template_id, name, sort_order, weight)
    VALUES (v_d3_id, v_template_id, 'D3: Systems, Safeguarding & Operational Efficiency', 3, v_domain_percentage);

    -- Standard 5
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s5_id, v_d3_id, 'Standard 5: Run strong MTSS/IEP case‑management & safeguarding', 1);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s5_id, 
    'KPI 5.1 | IEP/ILP & MTSS coverage', 
    'Indicators: % identified learners with current plans; review cadence met; progress monitoring on schedule.', 
    'Evidence: caseload trackers; safeguarding logs; BSPs; consent forms; MDT minutes.', 
    '', 
    1, '100%/on schedule', '95–99%/minor slippage', '85–94%/irregular', '<85%/gaps'),

    (gen_random_uuid(), v_s5_id, 
    'KPI 5.2 | Safeguarding & risk', 
    'Indicators: 100% staff trained; incident response times; quality of behavior support plans; trauma‑informed practices visible.', 
    'Evidence: caseload trackers; safeguarding logs; BSPs; consent forms; MDT minutes.', 
    '', 
    2, '100%/rapid/high', '≥95%/good', '85–94%/moderate', '<85%/weak'),

    (gen_random_uuid(), v_s5_id, 
    'KPI 5.3 | Transitions & placement', 
    'Indicators: clear entry/exits, referrals, inter‑service coordination; family consent & briefings documented.', 
    'Evidence: caseload trackers; safeguarding logs; BSPs; consent forms; MDT minutes.', 
    '', 
    3, 'complete, timely, high satisfaction', 'solid', 'patchy', 'weak');

    -- Standard 6
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s6_id, v_d3_id, 'Standard 6: Optimize operations (scheduling, waitlists, cost, templates, repository)', 2);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s6_id, 
    'KPI 6.1 | Documentation punctuality', 
    'Indicators: % therapy notes & school reports filed by SLA.', 
    'Evidence: repository audit; scheduling reports; utilization dashboards; style checks.', 
    '', 
    1, '≥95%', '90–94%', '80–89%', '<80%'),

    (gen_random_uuid(), v_s6_id, 
    'KPI 6.2 | Access & efficiency', 
    'Indicators: median wait time to first session; session utilization (kept/available); no‑show & late cancellations trend.', 
    'Evidence: repository audit; scheduling reports; utilization dashboards; style checks.', 
    '', 
    2, '≤10 days/≥90%/≤5%', '11–14/85–89%/6–9%', '15–21/75–84%/10–14%', '>21/<75%/>14%'),

    (gen_random_uuid(), v_s6_id, 
    'KPI 6.3 | Template reuse & standardization', 
    'Indicators: ratio used across ≥3 teams; % outputs meeting design standards.', 
    'Evidence: repository audit; scheduling reports; utilization dashboards; style checks.', 
    '', 
    3, '≥0.60 & ≥95%', '0.50–0.59 & 90–94%', '0.35–0.49 & 80–89%', 'lower');


    -- --- DOMAIN 4: Family Partnership, Interdisciplinary Collaboration & Communication ---
    INSERT INTO kpi_domains (id, template_id, name, sort_order, weight)
    VALUES (v_d4_id, v_template_id, 'D4: Family Partnership, Interdisciplinary Collaboration & Communication', 4, v_domain_percentage);

    -- Standard 7
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s7_id, v_d4_id, 'Standard 7: Partner with families for learning & life outcomes', 1);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s7_id, 
    'KPI 7.1 | Parent coaching & training', 
    'Indicators: # sessions/term; attendance; usefulness rating.', 
    'Evidence: workshop logs; translated materials; parent pulses; follow‑up trackers.', 
    '', 
    1, '≥4/term, ≥80% attend, ≥4.3/5', '3, 70–79%, ≥4.0', '2, 60–69%, ≥3.6', 'lower'),

    (gen_random_uuid(), v_s7_id, 
    'KPI 7.2 | Family clarity & trust', 
    'Indicators: % families who understand goals & how to help; “feedback‑to‑action” transparency.', 
    'Evidence: workshop logs; translated materials; parent pulses; follow‑up trackers.', 
    '', 
    2, '≥90% & ≥90%', '80–89% & 80–89%', '70–79% & 60–79%', 'lower'),

    (gen_random_uuid(), v_s7_id, 
    'KPI 7.3 | Culturally/language‑accessible materials', 
    'Indicators: % plans & reports issued in accessible formats/languages as required.', 
    'Evidence: workshop logs; translated materials; parent pulses; follow‑up trackers.', 
    '', 
    3, '≥95%', '90–94%', '80–89%', '<80%');

    -- Standard 8
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s8_id, v_d4_id, 'Standard 8: Lead multidisciplinary (MDT) collaboration & transparent comms', 2);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s8_id, 
    'KPI 8.1 | MDT cadence & quality', 
    'Indicators: scheduled MDT per case; action follow‑through.', 
    '', 
    '', 
    1, '≥95% on time & ≥90% actions done', '90–94%/80–89%', '80–89%/60–79%', 'lower'),

    (gen_random_uuid(), v_s8_id, 
    'KPI 8.2 | Data briefings with accessibility', 
    'Indicators: staff/parents receive clear dashboards/briefs; inclusivity checklist met.', 
    '', 
    '', 
    2, '≥2/term, ≥90% clarity, full accessibility', '1/term, 80–89%, full', '1/sem, 70–79%, partial', 'lower'),

    (gen_random_uuid(), v_s8_id, 
    'KPI 8.3 | Crisis/critical‑incident communication', 
    'Indicators: protocol currency; response time; simulations.', 
    '', 
    '', 
    3, 'current/<30m/≥2 per year', 'current/<60m/1', 'basic/1–2h/limited', 'none/>2h/none');


    -- --- DOMAIN 5: Professionalism, Ethics & Growth ---
    INSERT INTO kpi_domains (id, template_id, name, sort_order, weight)
    VALUES (v_d5_id, v_template_id, 'D5: Professionalism, Ethics & Growth', 5, v_domain_percentage);

    -- Standard 9
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s9_id, v_d5_id, 'Standard 9: Uphold ethics, confidentiality, and safe practice', 1);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s9_id, 
    'KPI 9.1 | Ethical compliance', 
    'Indicators: % decisions with ethical rationale; privacy audits; incident rate; trust index.', 
    'Evidence: decision logs; privacy checks; climate surveys; training records; incident logs.', 
    '', 
    1, '≥95%/100%/zero/≥90%', '90–94/100/minor/85–89', '85–89/minor gaps/occasional/75–84', 'lower'),

    (gen_random_uuid(), v_s9_id, 
    'KPI 9.2 | Psychological safety & anti‑bias', 
    'Indicators: safety score; anti‑bias training completion; recognized compassion acts; discrimination cases.', 
    'Evidence: decision logs; privacy checks; climate surveys; training records; incident logs.', 
    '', 
    2, '≥90%/100%/≥10/zero', '85–89/≥95%/6–9/minimal', '75–84/85–94/3–5/occasional', 'lower');

    -- Standard 10
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s10_id, v_d5_id, 'Standard 10: Build capability through supervision, PD & reflective practice', 2);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s10_id, 
    'KPI 10.1 | Supervision & coaching', 
    'Indicators: supervision hours met per therapist/teacher; reflective notes; competence growth.', 
    'Evidence: supervision logs; coaching artifacts; PD analysis; repositories.', 
    '', 
    1, '100% plans met & strong gains', '≥90% & solid', '75–89% & modest', 'lower'),

    (gen_random_uuid(), v_s10_id, 
    'KPI 10.2 | PD program ROI', 
    'Indicators: % PD where ≥60% participants show practice lift within 6–8 weeks (classroom rubric or therapy fidelity).', 
    'Evidence: supervision logs; coaching artifacts; PD analysis; repositories.', 
    '', 
    2, '≥70% modules', '60–69%', '45–59%', '<45%'),

    (gen_random_uuid(), v_s10_id, 
    'KPI 10.3 | Knowledge base contributions', 
    'Indicators: # high‑quality playbooks/explainers; cross‑team reuse.', 
    'Evidence: supervision logs; coaching artifacts; PD analysis; repositories.', 
    '', 
    3, '≥10 & ≥5 teams', '8–9 & 3–4', '5–7 & 2', 'lower');


    -- --- DOMAIN 6: Inclusive Culture, Accessibility & Sustainability ---
    INSERT INTO kpi_domains (id, template_id, name, sort_order, weight)
    VALUES (v_d6_id, v_template_id, 'D6: Inclusive Culture, Accessibility & Sustainability', 6, v_domain_percentage);

    -- Standard 11
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s11_id, v_d6_id, 'Standard 11: Improve accessibility of environments, materials & technology', 1);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s11_id, 
    'KPI 11.1 | Accessibility audit improvement', 
    'Indicators: % actions closed (physical, sensory, ICT); student/user satisfaction.', 
    '', 
    '', 
    1, '≥90% & ≥90%', '80–89% & 80–89%', '60–79% & 70–79%', 'lower'),

    (gen_random_uuid(), v_s11_id, 
    'KPI 11.2 | AT/AAC implementation', 
    'Indicators: % eligible learners with active AT/AAC plans & trained teams/families.', 
    '', 
    '', 
    2, '≥95% & ≥90% trained', '90–94% & 80–89%', '80–89% & 70–79%', 'lower'),

    (gen_random_uuid(), v_s11_id, 
    'KPI 11.3 | Digital fluency & safety (inclusive)', 
    'Indicators: teacher fluency, student digital literacy, safety audits.', 
    '', 
    '', 
    3, '≥95/≥90/100%', '85–94/80–89/100%', '70–84/70–79/minor gaps', 'lower');

    -- Standard 12
    INSERT INTO kpi_standards (id, domain_id, name, sort_order)
    VALUES (v_s12_id, v_d6_id, 'Standard 12: Embed student voice, wellbeing & restorative culture', 2);

    INSERT INTO kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1) VALUES
    (gen_random_uuid(), v_s12_id, 
    'KPI 12.1 | Student voice & self‑determination', 
    'Indicators: % learners with voice tools (choice boards, AAC scripts, goal‑setting) used weekly.', 
    'Evidence: student artifacts; BSPs; incident logs; wellbeing surveys.', 
    '', 
    1, '≥90%', '80–89%', '70–79%', '<70%'),

    (gen_random_uuid(), v_s12_id, 
    'KPI 12.2 | Behavior support quality', 
    'Indicators: % learners with Behavior Support Plans where indicated; reduction in repeat incidents; restorative resolution rate.', 
    'Evidence: student artifacts; BSPs; incident logs; wellbeing surveys.', 
    '', 
    2, '≥95% BSPs, strong reduction, ≥95% restorative', '85–94/clear/85–94%', '70–84/modest/70–84%', 'lower'),

    (gen_random_uuid(), v_s12_id, 
    'KPI 12.3 | Wellbeing index', 
    'Indicators: favorable responses on safety/belonging/engagement (students, staff, families).', 
    'Evidence: student artifacts; BSPs; incident logs; wellbeing surveys.', 
    '', 
    3, '≥90%', '85–89%', '75–84%', '<75%');

END $$;
