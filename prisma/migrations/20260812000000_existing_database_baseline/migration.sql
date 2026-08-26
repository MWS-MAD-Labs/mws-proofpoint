--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: IndicatorQuestionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."IndicatorQuestionType" AS ENUM (
    'SCALE',
    'CHOICE',
    'TEXT'
);


--
-- Name: ObservationStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ObservationStatus" AS ENUM (
    'draft',
    'pending',
    'submitted',
    'reviewed',
    'acknowledged'
);


--
-- Name: ProgramStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ProgramStatus" AS ENUM (
    'not_started',
    'on_track',
    'at_risk',
    'off_track',
    'completed'
);


--
-- Name: StrategicPlanStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StrategicPlanStatus" AS ENUM (
    'draft',
    'published'
);


--
-- Name: TemplateType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TemplateType" AS ENUM (
    'KPI_APPRAISAL',
    'CLASSROOM_OBSERVATION',
    'GENERIC',
    'STAFF_APPRAISAL'
);


--
-- Name: WorkflowActionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."WorkflowActionType" AS ENUM (
    'FILL_FORM',
    'ACKNOWLEDGE',
    'REVIEW',
    'APPROVE'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'staff',
    'manager',
    'director',
    'supervisor'
);


--
-- Name: fill_kpi_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fill_kpi_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.template_id IS NULL THEN
    SELECT template_id INTO NEW.template_id FROM kpi_standards WHERE id = NEW.standard_id;
  END IF;
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'K' || (SELECT COUNT(*) + 1 FROM kpis WHERE template_id = NEW.template_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: fill_kpi_domain_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fill_kpi_domain_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'D' || (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM kpi_domains WHERE template_id = NEW.template_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: fill_kpi_standard_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fill_kpi_standard_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.template_id IS NULL THEN
    SELECT template_id INTO NEW.template_id FROM kpi_domains WHERE id = NEW.domain_id;
  END IF;
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'S' || (SELECT COUNT(*) + 1 FROM kpi_standards WHERE template_id = NEW.template_id);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_notification_preferences_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_notification_preferences_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_role_id uuid NOT NULL,
    step_order integer NOT NULL,
    approver_role public.app_role NOT NULL,
    step_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT approval_workflows_step_type_check CHECK ((step_type = ANY (ARRAY['review'::text, 'approval'::text, 'review_and_approval'::text, 'acknowledge'::text])))
);


--
-- Name: assessment_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assessment_id uuid NOT NULL,
    indicator_id uuid,
    asked_by uuid NOT NULL,
    question text NOT NULL,
    response text,
    responded_by uuid,
    responded_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assessment_questions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'answered'::text, 'closed'::text])))
);


--
-- Name: assessment_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessment_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assessment_id uuid NOT NULL,
    updated_by_id uuid,
    step_order integer,
    status_from text,
    status_to text NOT NULL,
    event_type text NOT NULL,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: assessments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assessments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    manager_id uuid,
    director_id uuid,
    template_id uuid,
    period text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    staff_scores jsonb DEFAULT '{}'::jsonb,
    manager_scores jsonb DEFAULT '{}'::jsonb,
    staff_evidence jsonb DEFAULT '{}'::jsonb,
    manager_evidence jsonb DEFAULT '{}'::jsonb,
    manager_notes text,
    director_comments text,
    final_score numeric(4,2),
    final_grade text,
    staff_submitted_at timestamp with time zone,
    manager_reviewed_at timestamp with time zone,
    director_approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    staff_notes text,
    return_feedback text,
    returned_at timestamp with time zone,
    returned_by uuid,
    nlsmartrack_id text,
    workflow_id uuid,
    workflow_assignment_id uuid,
    workflow_snapshot jsonb,
    current_step_order integer,
    initiated_by_id uuid,
    manager_submitted_at timestamp(3) without time zone,
    director_reviewed_at timestamp(3) without time zone,
    acknowledged_at timestamp(3) without time zone,
    completed_at timestamp(3) without time zone,
    director_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    director_evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT assessments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'self_submitted'::text, 'manager_reviewed'::text, 'pending_director_review'::text, 'director_reviewed'::text, 'director_approved'::text, 'admin_reviewed'::text, 'acknowledged'::text, 'rejected'::text, 'returned'::text, 'pending_release'::text])))
);


--
-- Name: department_role_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_role_memberships (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    department_role_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: department_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid,
    role public.app_role NOT NULL,
    default_template_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: kpi_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    weight numeric(5,2) DEFAULT 0 NOT NULL,
    code text NOT NULL,
    legacy_code text,
    CONSTRAINT kpi_domains_weight_check CHECK (((weight >= (0)::numeric) AND (weight <= (100)::numeric)))
);


--
-- Name: kpi_standards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpi_standards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    code text NOT NULL,
    legacy_code text,
    template_id uuid NOT NULL
);


--
-- Name: kpis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kpis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    standard_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    evidence_guidance text,
    trainings text,
    sort_order integer DEFAULT 0 NOT NULL,
    rubric_4 text NOT NULL,
    rubric_3 text NOT NULL,
    rubric_2 text NOT NULL,
    rubric_1 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    code text NOT NULL,
    legacy_code text,
    template_id uuid NOT NULL,
    performance_weight numeric(5,2) DEFAULT 100 NOT NULL
);


--
-- Name: migration_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_log (
    id integer NOT NULL,
    entity_type text NOT NULL,
    source_id text NOT NULL,
    target_id text NOT NULL,
    status text DEFAULT 'success'::text NOT NULL,
    notes text,
    migrated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migration_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migration_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migration_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migration_log_id_seq OWNED BY public.migration_log.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    email_enabled boolean DEFAULT true,
    assessment_submitted boolean DEFAULT true,
    manager_review_done boolean DEFAULT true,
    director_approved boolean DEFAULT true,
    admin_released boolean DEFAULT true,
    assessment_returned boolean DEFAULT true,
    assessment_acknowledged boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    assessment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    CONSTRAINT notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text]))),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['assessment_submitted'::text, 'manager_review_completed'::text, 'director_approved'::text, 'admin_released'::text, 'assessment_returned'::text, 'assessment_acknowledged'::text])))
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: observation_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observation_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    observation_id uuid NOT NULL,
    indicator_id uuid NOT NULL,
    score double precision DEFAULT 0 NOT NULL,
    note text,
    evidence text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    text_value text,
    selected_option text,
    selected_options jsonb
);


--
-- Name: observation_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observation_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    observation_id uuid NOT NULL,
    updated_by_id uuid,
    status_from text,
    status_to text NOT NULL,
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    event_type text DEFAULT 'status_changed'::text NOT NULL
);


--
-- Name: observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.observations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "staffId" uuid NOT NULL,
    "managerId" uuid,
    template_id uuid NOT NULL,
    status public."ObservationStatus" DEFAULT 'draft'::public."ObservationStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    submitted_at timestamp(3) without time zone,
    acknowledged_at timestamp(3) without time zone,
    nlsmartrack_id text,
    observation_date timestamp(3) without time zone,
    due_at timestamp(3) without time zone,
    reopened_at timestamp(3) without time zone,
    type text DEFAULT 'MANAGER'::text NOT NULL,
    title text,
    description text,
    acknowledgement_response text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    niy text,
    job_title text,
    department_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar_url text,
    migration_source text
);


--
-- Name: program_budget_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_budget_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    period_id uuid NOT NULL,
    label text NOT NULL,
    description text,
    amount_idr numeric(15,2) DEFAULT 0 NOT NULL
);


--
-- Name: program_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    text text NOT NULL,
    done boolean DEFAULT false NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: program_collaborators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_collaborators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    department_id uuid NOT NULL
);


--
-- Name: program_kpi_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_kpi_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    kpi_id uuid NOT NULL,
    coverage_label text
);


--
-- Name: program_period_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_period_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    period_id uuid NOT NULL,
    target_text text DEFAULT ''::text NOT NULL,
    actual_text text,
    status public."ProgramStatus" DEFAULT 'not_started'::public."ProgramStatus" NOT NULL,
    evidence_key text,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: program_progress_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_progress_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    author_id uuid NOT NULL,
    note text NOT NULL,
    status public."ProgramStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: role_workflow_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_workflow_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_role_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    rubric_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: rubric_indicators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_indicators (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    evidence_guidance text,
    score_options jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    question_type public."IndicatorQuestionType" DEFAULT 'SCALE'::public."IndicatorQuestionType" NOT NULL,
    score_min integer,
    score_max integer,
    score_step integer,
    placeholder_text text,
    is_required boolean DEFAULT true NOT NULL
);


--
-- Name: rubric_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    name text NOT NULL,
    weight numeric(5,2) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rubric_sections_weight_check CHECK (((weight >= (0)::numeric) AND (weight <= (100)::numeric)))
);


--
-- Name: rubric_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubric_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    department_id uuid,
    is_global boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    template_type public."TemplateType" DEFAULT 'KPI_APPRAISAL'::public."TemplateType" NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: strategic_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.strategic_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    number integer NOT NULL,
    title text NOT NULL,
    description text,
    sort_order integer NOT NULL
);


--
-- Name: strategic_objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.strategic_objectives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    goal_id uuid NOT NULL,
    number integer NOT NULL,
    title text NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: strategic_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.strategic_periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    label text NOT NULL,
    year integer NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: strategic_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.strategic_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    vision text,
    mission text,
    start_year integer NOT NULL,
    end_year integer NOT NULL,
    status public."StrategicPlanStatus" DEFAULT 'draft'::public."StrategicPlanStatus" NOT NULL,
    owner_user_id uuid,
    published_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: strategic_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.strategic_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    objective_id uuid NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    status public."ProgramStatus" DEFAULT 'not_started'::public."ProgramStatus" NOT NULL,
    sort_order integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'staff'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    email_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    nlsmartrack_id text,
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'deleted'::text])))
);


--
-- Name: workflow_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type public."TemplateType" NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workflow_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    step_order integer NOT NULL,
    actor_role public.app_role NOT NULL,
    action_type public."WorkflowActionType" NOT NULL,
    description text
);


--
-- Name: migration_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_log ALTER COLUMN id SET DEFAULT nextval('public.migration_log_id_seq'::regclass);


--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: approval_workflows approval_workflows_department_role_id_step_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_department_role_id_step_order_key UNIQUE (department_role_id, step_order);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: assessment_questions assessment_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_pkey PRIMARY KEY (id);


--
-- Name: assessment_updates assessment_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_updates
    ADD CONSTRAINT assessment_updates_pkey PRIMARY KEY (id);


--
-- Name: assessments assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_pkey PRIMARY KEY (id);


--
-- Name: department_role_memberships department_role_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_role_memberships
    ADD CONSTRAINT department_role_memberships_pkey PRIMARY KEY (id);


--
-- Name: department_role_memberships department_role_memberships_role_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_role_memberships
    ADD CONSTRAINT department_role_memberships_role_user_key UNIQUE (department_role_id, user_id);


--
-- Name: department_roles department_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: kpi_domains kpi_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_domains
    ADD CONSTRAINT kpi_domains_pkey PRIMARY KEY (id);


--
-- Name: kpi_standards kpi_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_standards
    ADD CONSTRAINT kpi_standards_pkey PRIMARY KEY (id);


--
-- Name: kpis kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_pkey PRIMARY KEY (id);


--
-- Name: migration_log migration_log_entity_source_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_log
    ADD CONSTRAINT migration_log_entity_source_key UNIQUE (entity_type, source_id);


--
-- Name: migration_log migration_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_log
    ADD CONSTRAINT migration_log_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_key UNIQUE (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: observation_answers observation_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observation_answers
    ADD CONSTRAINT observation_answers_pkey PRIMARY KEY (id);


--
-- Name: observation_updates observation_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observation_updates
    ADD CONSTRAINT observation_updates_pkey PRIMARY KEY (id);


--
-- Name: observations observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT observations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: program_budget_lines program_budget_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_budget_lines
    ADD CONSTRAINT program_budget_lines_pkey PRIMARY KEY (id);


--
-- Name: program_checklist_items program_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_checklist_items
    ADD CONSTRAINT program_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: program_checklist_items program_checklist_items_program_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_checklist_items
    ADD CONSTRAINT program_checklist_items_program_id_sort_order_key UNIQUE (program_id, sort_order);


--
-- Name: program_collaborators program_collaborators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_collaborators
    ADD CONSTRAINT program_collaborators_pkey PRIMARY KEY (id);


--
-- Name: program_collaborators program_collaborators_program_id_department_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_collaborators
    ADD CONSTRAINT program_collaborators_program_id_department_id_key UNIQUE (program_id, department_id);


--
-- Name: program_kpi_links program_kpi_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_kpi_links
    ADD CONSTRAINT program_kpi_links_pkey PRIMARY KEY (id);


--
-- Name: program_kpi_links program_kpi_links_program_id_kpi_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_kpi_links
    ADD CONSTRAINT program_kpi_links_program_id_kpi_id_key UNIQUE (program_id, kpi_id);


--
-- Name: program_period_targets program_period_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_period_targets
    ADD CONSTRAINT program_period_targets_pkey PRIMARY KEY (id);


--
-- Name: program_period_targets program_period_targets_program_id_period_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_period_targets
    ADD CONSTRAINT program_period_targets_program_id_period_id_key UNIQUE (program_id, period_id);


--
-- Name: program_progress_updates program_progress_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_progress_updates
    ADD CONSTRAINT program_progress_updates_pkey PRIMARY KEY (id);


--
-- Name: role_workflow_assignments role_workflow_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_workflow_assignments
    ADD CONSTRAINT role_workflow_assignments_pkey PRIMARY KEY (id);


--
-- Name: rubric_indicators rubric_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_indicators
    ADD CONSTRAINT rubric_indicators_pkey PRIMARY KEY (id);


--
-- Name: rubric_sections rubric_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_sections
    ADD CONSTRAINT rubric_sections_pkey PRIMARY KEY (id);


--
-- Name: rubric_templates rubric_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_templates
    ADD CONSTRAINT rubric_templates_pkey PRIMARY KEY (id);


--
-- Name: strategic_goals strategic_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_goals
    ADD CONSTRAINT strategic_goals_pkey PRIMARY KEY (id);


--
-- Name: strategic_goals strategic_goals_plan_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_goals
    ADD CONSTRAINT strategic_goals_plan_id_number_key UNIQUE (plan_id, number);


--
-- Name: strategic_goals strategic_goals_plan_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_goals
    ADD CONSTRAINT strategic_goals_plan_id_sort_order_key UNIQUE (plan_id, sort_order);


--
-- Name: strategic_objectives strategic_objectives_goal_id_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_objectives
    ADD CONSTRAINT strategic_objectives_goal_id_number_key UNIQUE (goal_id, number);


--
-- Name: strategic_objectives strategic_objectives_goal_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_objectives
    ADD CONSTRAINT strategic_objectives_goal_id_sort_order_key UNIQUE (goal_id, sort_order);


--
-- Name: strategic_objectives strategic_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_objectives
    ADD CONSTRAINT strategic_objectives_pkey PRIMARY KEY (id);


--
-- Name: strategic_periods strategic_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_periods
    ADD CONSTRAINT strategic_periods_pkey PRIMARY KEY (id);


--
-- Name: strategic_periods strategic_periods_plan_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_periods
    ADD CONSTRAINT strategic_periods_plan_id_sort_order_key UNIQUE (plan_id, sort_order);


--
-- Name: strategic_periods strategic_periods_plan_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_periods
    ADD CONSTRAINT strategic_periods_plan_id_year_key UNIQUE (plan_id, year);


--
-- Name: strategic_plans strategic_plans_department_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_plans
    ADD CONSTRAINT strategic_plans_department_id_key UNIQUE (department_id);


--
-- Name: strategic_plans strategic_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_plans
    ADD CONSTRAINT strategic_plans_pkey PRIMARY KEY (id);


--
-- Name: strategic_programs strategic_programs_objective_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_programs
    ADD CONSTRAINT strategic_programs_objective_id_code_key UNIQUE (objective_id, code);


--
-- Name: strategic_programs strategic_programs_objective_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_programs
    ADD CONSTRAINT strategic_programs_objective_id_sort_order_key UNIQUE (objective_id, sort_order);


--
-- Name: strategic_programs strategic_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_programs
    ADD CONSTRAINT strategic_programs_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workflow_definitions workflow_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_pkey PRIMARY KEY (id);


--
-- Name: workflow_steps workflow_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT workflow_steps_pkey PRIMARY KEY (id);


--
-- Name: assessment_updates_assessment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assessment_updates_assessment_id_idx ON public.assessment_updates USING btree (assessment_id);


--
-- Name: assessment_updates_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assessment_updates_created_at_idx ON public.assessment_updates USING btree (created_at);


--
-- Name: assessments_current_step_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assessments_current_step_order_idx ON public.assessments USING btree (current_step_order);


--
-- Name: assessments_initiated_by_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assessments_initiated_by_id_idx ON public.assessments USING btree (initiated_by_id);


--
-- Name: assessments_nlsmartrack_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX assessments_nlsmartrack_id_key ON public.assessments USING btree (nlsmartrack_id) WHERE (nlsmartrack_id IS NOT NULL);


--
-- Name: assessments_workflow_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assessments_workflow_id_idx ON public.assessments USING btree (workflow_id);


--
-- Name: department_role_memberships_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_role_memberships_role_idx ON public.department_role_memberships USING btree (department_role_id);


--
-- Name: department_role_memberships_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_role_memberships_user_idx ON public.department_role_memberships USING btree (user_id);


--
-- Name: idx_approval_workflows_department_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_workflows_department_role_id ON public.approval_workflows USING btree (department_role_id);


--
-- Name: idx_assessment_questions_assessment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessment_questions_assessment_id ON public.assessment_questions USING btree (assessment_id);


--
-- Name: idx_assessments_director_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessments_director_id ON public.assessments USING btree (director_id);


--
-- Name: idx_assessments_manager_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessments_manager_id ON public.assessments USING btree (manager_id);


--
-- Name: idx_assessments_returned_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessments_returned_by ON public.assessments USING btree (returned_by);


--
-- Name: idx_assessments_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessments_staff_id ON public.assessments USING btree (staff_id);


--
-- Name: idx_assessments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assessments_status ON public.assessments USING btree (status);


--
-- Name: idx_department_roles_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_department_roles_department_id ON public.department_roles USING btree (department_id);


--
-- Name: idx_department_roles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_department_roles_role ON public.department_roles USING btree (role);


--
-- Name: idx_kpi_domains_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kpi_domains_template_id ON public.kpi_domains USING btree (template_id);


--
-- Name: idx_kpi_standards_domain_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kpi_standards_domain_id ON public.kpi_standards USING btree (domain_id);


--
-- Name: idx_kpis_standard_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_kpis_standard_id ON public.kpis USING btree (standard_id);


--
-- Name: idx_notification_preferences_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences USING btree (user_id);


--
-- Name: idx_notifications_assessment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_assessment_id ON public.notifications USING btree (assessment_id);


--
-- Name: idx_notifications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_status ON public.notifications USING btree (status);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_profiles_department_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_department_id ON public.profiles USING btree (department_id);


--
-- Name: idx_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_user_id ON public.profiles USING btree (user_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: kpi_domains_template_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX kpi_domains_template_id_code_key ON public.kpi_domains USING btree (template_id, code);


--
-- Name: kpi_standards_template_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX kpi_standards_template_id_code_key ON public.kpi_standards USING btree (template_id, code);


--
-- Name: kpi_standards_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kpi_standards_template_id_idx ON public.kpi_standards USING btree (template_id);


--
-- Name: kpis_template_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX kpis_template_id_code_key ON public.kpis USING btree (template_id, code);


--
-- Name: kpis_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kpis_template_id_idx ON public.kpis USING btree (template_id);


--
-- Name: migration_log_entity_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_log_entity_type_idx ON public.migration_log USING btree (entity_type);


--
-- Name: migration_log_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_log_status_idx ON public.migration_log USING btree (status);


--
-- Name: observation_answers_indicator_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observation_answers_indicator_id_idx ON public.observation_answers USING btree (indicator_id);


--
-- Name: observation_answers_observation_id_indicator_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX observation_answers_observation_id_indicator_id_key ON public.observation_answers USING btree (observation_id, indicator_id);


--
-- Name: observation_updates_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observation_updates_created_at_idx ON public.observation_updates USING btree (created_at);


--
-- Name: observation_updates_observation_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observation_updates_observation_id_idx ON public.observation_updates USING btree (observation_id);


--
-- Name: observation_updates_updated_by_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observation_updates_updated_by_id_idx ON public.observation_updates USING btree (updated_by_id);


--
-- Name: observations_due_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_due_at_idx ON public.observations USING btree (due_at);


--
-- Name: observations_managerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "observations_managerId_idx" ON public.observations USING btree ("managerId");


--
-- Name: observations_manager_status_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_manager_status_updated_idx ON public.observations USING btree ("managerId", status, updated_at);


--
-- Name: observations_nlsmartrack_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX observations_nlsmartrack_id_key ON public.observations USING btree (nlsmartrack_id) WHERE (nlsmartrack_id IS NOT NULL);


--
-- Name: observations_observation_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_observation_date_idx ON public.observations USING btree (observation_date);


--
-- Name: observations_staffId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "observations_staffId_idx" ON public.observations USING btree ("staffId");


--
-- Name: observations_staff_status_updated_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_staff_status_updated_idx ON public.observations USING btree ("staffId", status, updated_at);


--
-- Name: observations_status_due_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_status_due_at_idx ON public.observations USING btree (status, due_at);


--
-- Name: observations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX observations_status_idx ON public.observations USING btree (status);


--
-- Name: program_budget_lines_period_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_budget_lines_period_id_idx ON public.program_budget_lines USING btree (period_id);


--
-- Name: program_budget_lines_program_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_budget_lines_program_id_idx ON public.program_budget_lines USING btree (program_id);


--
-- Name: program_checklist_items_program_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_checklist_items_program_id_idx ON public.program_checklist_items USING btree (program_id);


--
-- Name: program_collaborators_department_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_collaborators_department_id_idx ON public.program_collaborators USING btree (department_id);


--
-- Name: program_collaborators_program_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_collaborators_program_id_idx ON public.program_collaborators USING btree (program_id);


--
-- Name: program_kpi_links_kpi_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_kpi_links_kpi_id_idx ON public.program_kpi_links USING btree (kpi_id);


--
-- Name: program_kpi_links_program_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_kpi_links_program_id_idx ON public.program_kpi_links USING btree (program_id);


--
-- Name: program_period_targets_period_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_period_targets_period_id_idx ON public.program_period_targets USING btree (period_id);


--
-- Name: program_period_targets_program_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_period_targets_program_id_idx ON public.program_period_targets USING btree (program_id);


--
-- Name: program_progress_updates_author_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_progress_updates_author_id_idx ON public.program_progress_updates USING btree (author_id);


--
-- Name: program_progress_updates_program_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX program_progress_updates_program_id_idx ON public.program_progress_updates USING btree (program_id);


--
-- Name: role_workflow_assignments_dept_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX role_workflow_assignments_dept_role_idx ON public.role_workflow_assignments USING btree (department_role_id);


--
-- Name: strategic_goals_plan_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strategic_goals_plan_id_idx ON public.strategic_goals USING btree (plan_id);


--
-- Name: strategic_objectives_goal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strategic_objectives_goal_id_idx ON public.strategic_objectives USING btree (goal_id);


--
-- Name: strategic_periods_plan_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strategic_periods_plan_id_idx ON public.strategic_periods USING btree (plan_id);


--
-- Name: strategic_plans_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strategic_plans_status_idx ON public.strategic_plans USING btree (status);


--
-- Name: strategic_programs_objective_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX strategic_programs_objective_id_idx ON public.strategic_programs USING btree (objective_id);


--
-- Name: users_nlsmartrack_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_nlsmartrack_id_key ON public.users USING btree (nlsmartrack_id) WHERE (nlsmartrack_id IS NOT NULL);


--
-- Name: workflow_steps_workflow_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_steps_workflow_id_idx ON public.workflow_steps USING btree (workflow_id);


--
-- Name: kpis trg_fill_kpi_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fill_kpi_code BEFORE INSERT ON public.kpis FOR EACH ROW EXECUTE FUNCTION public.fill_kpi_code();


--
-- Name: kpi_domains trg_fill_kpi_domain_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fill_kpi_domain_code BEFORE INSERT ON public.kpi_domains FOR EACH ROW EXECUTE FUNCTION public.fill_kpi_domain_code();


--
-- Name: kpi_standards trg_fill_kpi_standard_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_fill_kpi_standard_code BEFORE INSERT ON public.kpi_standards FOR EACH ROW EXECUTE FUNCTION public.fill_kpi_standard_code();


--
-- Name: assessment_questions update_assessment_questions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assessment_questions_updated_at BEFORE UPDATE ON public.assessment_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assessments update_assessments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_assessments_updated_at BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: department_roles update_department_roles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_department_roles_updated_at BEFORE UPDATE ON public.department_roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: departments update_departments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_preferences update_notification_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_notification_preferences_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: rubric_templates update_rubric_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_rubric_templates_updated_at BEFORE UPDATE ON public.rubric_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: approval_workflows approval_workflows_department_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_department_role_id_fkey FOREIGN KEY (department_role_id) REFERENCES public.department_roles(id) ON DELETE CASCADE;


--
-- Name: assessment_questions assessment_questions_asked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_asked_by_fkey FOREIGN KEY (asked_by) REFERENCES public.users(id);


--
-- Name: assessment_questions assessment_questions_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id) ON DELETE CASCADE;


--
-- Name: assessment_questions assessment_questions_indicator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_indicator_id_fkey FOREIGN KEY (indicator_id) REFERENCES public.rubric_indicators(id) ON DELETE SET NULL;


--
-- Name: assessment_questions assessment_questions_responded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_responded_by_fkey FOREIGN KEY (responded_by) REFERENCES public.users(id);


--
-- Name: assessment_updates assessment_updates_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_updates
    ADD CONSTRAINT assessment_updates_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id) ON DELETE CASCADE;


--
-- Name: assessment_updates assessment_updates_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessment_updates
    ADD CONSTRAINT assessment_updates_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assessments assessments_director_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_director_id_fkey FOREIGN KEY (director_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assessments assessments_initiated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_initiated_by_id_fkey FOREIGN KEY (initiated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assessments assessments_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assessments assessments_returned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: assessments assessments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: assessments assessments_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.rubric_templates(id) ON DELETE SET NULL;


--
-- Name: assessments assessments_workflow_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_workflow_assignment_id_fkey FOREIGN KEY (workflow_assignment_id) REFERENCES public.role_workflow_assignments(id) ON DELETE SET NULL;


--
-- Name: assessments assessments_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow_definitions(id) ON DELETE SET NULL;


--
-- Name: department_role_memberships department_role_memberships_department_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_role_memberships
    ADD CONSTRAINT department_role_memberships_department_role_id_fkey FOREIGN KEY (department_role_id) REFERENCES public.department_roles(id) ON DELETE CASCADE;


--
-- Name: department_role_memberships department_role_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_role_memberships
    ADD CONSTRAINT department_role_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: department_roles department_roles_default_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_default_template_id_fkey FOREIGN KEY (default_template_id) REFERENCES public.rubric_templates(id) ON DELETE SET NULL;


--
-- Name: department_roles department_roles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: kpi_domains kpi_domains_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_domains
    ADD CONSTRAINT kpi_domains_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.rubric_templates(id) ON DELETE CASCADE;


--
-- Name: kpi_standards kpi_standards_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_standards
    ADD CONSTRAINT kpi_standards_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.kpi_domains(id) ON DELETE CASCADE;


--
-- Name: kpi_standards kpi_standards_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpi_standards
    ADD CONSTRAINT kpi_standards_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.rubric_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: kpis kpis_standard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_standard_id_fkey FOREIGN KEY (standard_id) REFERENCES public.kpi_standards(id) ON DELETE CASCADE;


--
-- Name: kpis kpis_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.rubric_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: observation_answers observation_answers_indicator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observation_answers
    ADD CONSTRAINT observation_answers_indicator_id_fkey FOREIGN KEY (indicator_id) REFERENCES public.rubric_indicators(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: observation_answers observation_answers_observation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observation_answers
    ADD CONSTRAINT observation_answers_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES public.observations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: observation_updates observation_updates_observation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observation_updates
    ADD CONSTRAINT observation_updates_observation_id_fkey FOREIGN KEY (observation_id) REFERENCES public.observations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: observation_updates observation_updates_updated_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observation_updates
    ADD CONSTRAINT observation_updates_updated_by_id_fkey FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: observations observations_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT "observations_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: observations observations_rubricId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT "observations_rubricId_fkey" FOREIGN KEY (template_id) REFERENCES public.rubric_templates(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: observations observations_staffId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.observations
    ADD CONSTRAINT "observations_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: profiles profiles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: program_budget_lines program_budget_lines_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_budget_lines
    ADD CONSTRAINT program_budget_lines_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.strategic_periods(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_budget_lines program_budget_lines_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_budget_lines
    ADD CONSTRAINT program_budget_lines_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.strategic_programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_checklist_items program_checklist_items_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_checklist_items
    ADD CONSTRAINT program_checklist_items_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.strategic_programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_collaborators program_collaborators_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_collaborators
    ADD CONSTRAINT program_collaborators_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_collaborators program_collaborators_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_collaborators
    ADD CONSTRAINT program_collaborators_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.strategic_programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_kpi_links program_kpi_links_kpi_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_kpi_links
    ADD CONSTRAINT program_kpi_links_kpi_id_fkey FOREIGN KEY (kpi_id) REFERENCES public.kpis(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_kpi_links program_kpi_links_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_kpi_links
    ADD CONSTRAINT program_kpi_links_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.strategic_programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_period_targets program_period_targets_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_period_targets
    ADD CONSTRAINT program_period_targets_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.strategic_periods(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_period_targets program_period_targets_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_period_targets
    ADD CONSTRAINT program_period_targets_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.strategic_programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: program_progress_updates program_progress_updates_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_progress_updates
    ADD CONSTRAINT program_progress_updates_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON UPDATE CASCADE;


--
-- Name: program_progress_updates program_progress_updates_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_progress_updates
    ADD CONSTRAINT program_progress_updates_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.strategic_programs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_workflow_assignments role_workflow_assignments_dept_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_workflow_assignments
    ADD CONSTRAINT role_workflow_assignments_dept_role_fkey FOREIGN KEY (department_role_id) REFERENCES public.department_roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: role_workflow_assignments role_workflow_assignments_rubric_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_workflow_assignments
    ADD CONSTRAINT role_workflow_assignments_rubric_fkey FOREIGN KEY (rubric_id) REFERENCES public.rubric_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: role_workflow_assignments role_workflow_assignments_workflow_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_workflow_assignments
    ADD CONSTRAINT role_workflow_assignments_workflow_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow_definitions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: rubric_indicators rubric_indicators_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_indicators
    ADD CONSTRAINT rubric_indicators_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.rubric_sections(id) ON DELETE CASCADE;


--
-- Name: rubric_sections rubric_sections_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_sections
    ADD CONSTRAINT rubric_sections_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.rubric_templates(id) ON DELETE CASCADE;


--
-- Name: rubric_templates rubric_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_templates
    ADD CONSTRAINT rubric_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: rubric_templates rubric_templates_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubric_templates
    ADD CONSTRAINT rubric_templates_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: strategic_goals strategic_goals_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_goals
    ADD CONSTRAINT strategic_goals_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.strategic_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: strategic_objectives strategic_objectives_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_objectives
    ADD CONSTRAINT strategic_objectives_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.strategic_goals(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: strategic_periods strategic_periods_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_periods
    ADD CONSTRAINT strategic_periods_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.strategic_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: strategic_plans strategic_plans_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_plans
    ADD CONSTRAINT strategic_plans_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: strategic_plans strategic_plans_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_plans
    ADD CONSTRAINT strategic_plans_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: strategic_programs strategic_programs_objective_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.strategic_programs
    ADD CONSTRAINT strategic_programs_objective_id_fkey FOREIGN KEY (objective_id) REFERENCES public.strategic_objectives(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workflow_steps workflow_steps_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_steps
    ADD CONSTRAINT workflow_steps_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflow_definitions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
