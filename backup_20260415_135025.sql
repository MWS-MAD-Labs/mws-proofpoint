--
-- PostgreSQL database dump
--

\restrict p9iPQGHkSdGdkMD2qHXf8fosigNBEeb2a9daWFmEFMG2U62Lt5WyINAprOC4jx0

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: proofpoint
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO proofpoint;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: proofpoint
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AssessmentStatus; Type: TYPE; Schema: public; Owner: proofpoint
--

CREATE TYPE public."AssessmentStatus" AS ENUM (
    'draft',
    'self_submitted',
    'manager_reviewed',
    'director_approved',
    'admin_reviewed',
    'acknowledged',
    'rejected',
    'returned'
);


ALTER TYPE public."AssessmentStatus" OWNER TO proofpoint;

--
-- Name: NotificationStatus; Type: TYPE; Schema: public; Owner: proofpoint
--

CREATE TYPE public."NotificationStatus" AS ENUM (
    'pending',
    'sent',
    'failed'
);


ALTER TYPE public."NotificationStatus" OWNER TO proofpoint;

--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: proofpoint
--

CREATE TYPE public."NotificationType" AS ENUM (
    'assessment_submitted',
    'manager_review_completed',
    'director_approved',
    'admin_released',
    'assessment_returned',
    'assessment_acknowledged'
);


ALTER TYPE public."NotificationType" OWNER TO proofpoint;

--
-- Name: ObservationStatus; Type: TYPE; Schema: public; Owner: proofpoint
--

CREATE TYPE public."ObservationStatus" AS ENUM (
    'draft',
    'submitted',
    'reviewed',
    'acknowledged'
);


ALTER TYPE public."ObservationStatus" OWNER TO proofpoint;

--
-- Name: ObservationType; Type: TYPE; Schema: public; Owner: proofpoint
--

CREATE TYPE public."ObservationType" AS ENUM (
    'SELF',
    'MANAGER'
);


ALTER TYPE public."ObservationType" OWNER TO proofpoint;

--
-- Name: QuestionStatus; Type: TYPE; Schema: public; Owner: proofpoint
--

CREATE TYPE public."QuestionStatus" AS ENUM (
    'pending',
    'answered',
    'closed'
);


ALTER TYPE public."QuestionStatus" OWNER TO proofpoint;

--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: proofpoint
--

CREATE TYPE public."UserStatus" AS ENUM (
    'active',
    'suspended',
    'deleted'
);


ALTER TYPE public."UserStatus" OWNER TO proofpoint;

--
-- Name: WorkflowStepType; Type: TYPE; Schema: public; Owner: proofpoint
--

CREATE TYPE public."WorkflowStepType" AS ENUM (
    'review',
    'approval',
    'review_and_approval',
    'acknowledge',
    'admin_review'
);


ALTER TYPE public."WorkflowStepType" OWNER TO proofpoint;

--
-- Name: app_role; Type: TYPE; Schema: public; Owner: proofpoint
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'staff',
    'manager',
    'director',
    'supervisor'
);


ALTER TYPE public.app_role OWNER TO proofpoint;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Observation; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public."Observation" (
    id text NOT NULL,
    "staffId" text NOT NULL,
    director_id text,
    "managerId" text,
    "acknowledgedAt" timestamp(3) without time zone,
    status public."ObservationStatus" DEFAULT 'draft'::public."ObservationStatus" NOT NULL,
    "acknowledgedBy" text,
    "rubricId" text NOT NULL,
    type public."ObservationType" DEFAULT 'MANAGER'::public."ObservationType" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "submittedAt" timestamp(3) without time zone
);


ALTER TABLE public."Observation" OWNER TO proofpoint;

--
-- Name: ObservationAnswer; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public."ObservationAnswer" (
    id text NOT NULL,
    "observationId" text NOT NULL,
    "indicatorId" text NOT NULL,
    score integer NOT NULL,
    note text,
    evidence text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ObservationAnswer" OWNER TO proofpoint;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO proofpoint;

--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.approval_workflows (
    id text DEFAULT gen_random_uuid() NOT NULL,
    department_role_id text NOT NULL,
    step_order integer NOT NULL,
    approver_role public.app_role NOT NULL,
    step_type public."WorkflowStepType" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.approval_workflows OWNER TO proofpoint;

--
-- Name: assessment_questions; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.assessment_questions (
    id text NOT NULL,
    assessment_id text NOT NULL,
    indicator_id text,
    asked_by text NOT NULL,
    question text NOT NULL,
    response text,
    responded_by text,
    responded_at timestamp(3) without time zone,
    status public."QuestionStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.assessment_questions OWNER TO proofpoint;

--
-- Name: assessments; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.assessments (
    id text DEFAULT gen_random_uuid() NOT NULL,
    staff_id text NOT NULL,
    manager_id text,
    director_id text,
    template_id text,
    period text NOT NULL,
    status public."AssessmentStatus" NOT NULL,
    staff_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    manager_scores jsonb DEFAULT '{}'::jsonb NOT NULL,
    staff_evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    manager_evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    manager_notes text,
    director_comments text,
    return_feedback text,
    returned_at timestamp(3) without time zone,
    returned_by text,
    final_score numeric(4,2),
    final_grade text,
    staff_submitted_at timestamp(3) without time zone,
    manager_reviewed_at timestamp(3) without time zone,
    director_approved_at timestamp(3) without time zone,
    staff_notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.assessments OWNER TO proofpoint;

--
-- Name: department_roles; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.department_roles (
    id text DEFAULT gen_random_uuid() NOT NULL,
    department_id text,
    role public.app_role NOT NULL,
    default_template_id text,
    name text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.department_roles OWNER TO proofpoint;

--
-- Name: departments; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.departments (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    parent_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.departments OWNER TO proofpoint;

--
-- Name: kpi_domains; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.kpi_domains (
    id text DEFAULT gen_random_uuid() NOT NULL,
    template_id text NOT NULL,
    name text NOT NULL,
    weight numeric(5,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.kpi_domains OWNER TO proofpoint;

--
-- Name: kpi_standards; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.kpi_standards (
    id text DEFAULT gen_random_uuid() NOT NULL,
    domain_id text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.kpi_standards OWNER TO proofpoint;

--
-- Name: kpis; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.kpis (
    id text DEFAULT gen_random_uuid() NOT NULL,
    standard_id text NOT NULL,
    name text NOT NULL,
    description text,
    evidence_guidance text,
    trainings text,
    sort_order integer DEFAULT 0 NOT NULL,
    rubric_4 text NOT NULL,
    rubric_3 text NOT NULL,
    rubric_2 text NOT NULL,
    rubric_1 text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.kpis OWNER TO proofpoint;

--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.notification_preferences (
    id integer NOT NULL,
    user_id text NOT NULL,
    email_enabled boolean DEFAULT true NOT NULL,
    assessment_submitted boolean DEFAULT true NOT NULL,
    manager_review_done boolean DEFAULT true NOT NULL,
    director_approved boolean DEFAULT true NOT NULL,
    admin_released boolean DEFAULT true NOT NULL,
    assessment_returned boolean DEFAULT true NOT NULL,
    assessment_acknowledged boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notification_preferences OWNER TO proofpoint;

--
-- Name: notification_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: proofpoint
--

CREATE SEQUENCE public.notification_preferences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_preferences_id_seq OWNER TO proofpoint;

--
-- Name: notification_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: proofpoint
--

ALTER SEQUENCE public.notification_preferences_id_seq OWNED BY public.notification_preferences.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    assessment_id text,
    user_id text,
    type public."NotificationType" NOT NULL,
    status public."NotificationStatus" DEFAULT 'pending'::public."NotificationStatus" NOT NULL,
    error text,
    sent_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications OWNER TO proofpoint;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: proofpoint
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO proofpoint;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: proofpoint
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.profiles (
    id text DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    email text NOT NULL,
    full_name text,
    niy text,
    job_title text,
    department_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.profiles OWNER TO proofpoint;

--
-- Name: rubric_indicators; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.rubric_indicators (
    id text NOT NULL,
    section_id text NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    evidence_guidance text,
    score_options jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.rubric_indicators OWNER TO proofpoint;

--
-- Name: rubric_sections; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.rubric_sections (
    id text NOT NULL,
    template_id text NOT NULL,
    name text NOT NULL,
    weight numeric(5,2),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.rubric_sections OWNER TO proofpoint;

--
-- Name: rubric_templates; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.rubric_templates (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    name text NOT NULL,
    description text,
    department_id text,
    is_global boolean DEFAULT false NOT NULL,
    created_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.rubric_templates OWNER TO proofpoint;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.user_roles (
    id text DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    role public.app_role DEFAULT 'staff'::public.app_role NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_roles OWNER TO proofpoint;

--
-- Name: users; Type: TABLE; Schema: public; Owner: proofpoint
--

CREATE TABLE public.users (
    id text DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    status public."UserStatus" DEFAULT 'active'::public."UserStatus" NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "directorId" text
);


ALTER TABLE public.users OWNER TO proofpoint;

--
-- Name: notification_preferences id; Type: DEFAULT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.notification_preferences ALTER COLUMN id SET DEFAULT nextval('public.notification_preferences_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Data for Name: Observation; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public."Observation" (id, "staffId", director_id, "managerId", "acknowledgedAt", status, "acknowledgedBy", "rubricId", type, "createdAt", "updatedAt", "submittedAt") FROM stdin;
9d446795-9e93-4431-be98-96f7cef95dfb	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	e9e07777-3d29-44d0-afa3-70f8441b4074	\N	draft	\N	c8d10653-e09e-4f83-975a-dc24aec5b317	MANAGER	2026-04-10 01:44:47.21	2026-04-10 01:44:47.21	\N
4c29f03d-dc0c-456c-b4c7-ca2f7f4ed773	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	619fd9ac-d0a2-42e1-9523-aca6e352f8eb	\N	draft	\N	f089b3b3-7e6b-4540-af82-d0c49d98836b	MANAGER	2026-04-10 02:36:56.745	2026-04-10 02:36:56.745	\N
bedf027c-0004-4d91-872a-cce171519c15	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	619fd9ac-d0a2-42e1-9523-aca6e352f8eb	\N	draft	\N	f089b3b3-7e6b-4540-af82-d0c49d98836b	MANAGER	2026-04-10 02:37:17.909	2026-04-10 02:37:17.909	\N
df771780-25fc-421a-81cf-0f9d9b875bcd	6bb89ed2-9ad8-4429-baee-d27d9a408a3b	\N	e9e07777-3d29-44d0-afa3-70f8441b4074	\N	submitted	\N	f089b3b3-7e6b-4540-af82-d0c49d98836b	MANAGER	2026-04-10 03:44:09.409	2026-04-10 06:17:04.318	2026-04-10 06:17:04.316
31211410-d0f9-4997-9e2c-2029cb8a0710	b5211662-88a4-4d5c-b58f-dad83100559c	\N	e9e07777-3d29-44d0-afa3-70f8441b4074	\N	draft	\N	f089b3b3-7e6b-4540-af82-d0c49d98836b	MANAGER	2026-04-14 06:44:57.39	2026-04-14 06:44:57.39	\N
18	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.771	2026-04-15 04:40:30.771	\N
935500db-6c57-4bd9-b0ab-e5165069088c	47bacb6b-5ee9-4983-b2bf-a0970bd52f78	\N	e9e07777-3d29-44d0-afa3-70f8441b4074	2026-04-14 06:52:53.022	acknowledged	47bacb6b-5ee9-4983-b2bf-a0970bd52f78	f089b3b3-7e6b-4540-af82-d0c49d98836b	MANAGER	2026-04-14 06:50:28.267	2026-04-14 06:52:53.024	2026-04-14 06:52:14.232
1	ab32b306-669a-4c6b-ab39-0e625eae5749	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.728	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.729	2026-04-15 04:40:30.729	2026-04-15 04:40:30.728
2	ab32b306-669a-4c6b-ab39-0e625eae5749	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.732	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.733	2026-04-15 04:40:30.733	2026-04-15 04:40:30.732
3	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.737	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.738	2026-04-15 04:40:30.738	2026-04-15 04:40:30.737
4	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.742	2026-04-15 04:40:30.742	\N
5	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.745	2026-04-15 04:40:30.745	\N
6	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.746	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.747	2026-04-15 04:40:30.747	2026-04-15 04:40:30.746
7	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.749	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.75	2026-04-15 04:40:30.75	2026-04-15 04:40:30.749
8	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.751	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.752	2026-04-15 04:40:30.752	2026-04-15 04:40:30.751
9	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.754	2026-04-15 04:40:30.754	\N
10	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.756	2026-04-15 04:40:30.756	\N
11	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.757	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.758	2026-04-15 04:40:30.758	2026-04-15 04:40:30.757
12	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.76	2026-04-15 04:40:30.76	\N
13	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.761	2026-04-15 04:40:30.761	\N
14	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.762	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.763	2026-04-15 04:40:30.763	2026-04-15 04:40:30.762
15	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.763	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.764	2026-04-15 04:40:30.764	2026-04-15 04:40:30.763
16	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.766	2026-04-15 04:40:30.766	\N
17	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.769	2026-04-15 04:40:30.769	\N
19	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.773	2026-04-15 04:40:30.773	\N
20	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.775	2026-04-15 04:40:30.775	\N
21	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.776	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.777	2026-04-15 04:40:30.777	2026-04-15 04:40:30.776
22	0a73da10-2740-4a46-8086-fde9dd29d80c	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.781	2026-04-15 04:40:30.781	\N
27	f232abc1-86d2-460b-9307-d5b88f40bcd7	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.785	2026-04-15 04:40:30.785	\N
28	ab32b306-669a-4c6b-ab39-0e625eae5749	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.787	2026-04-15 04:40:30.787	\N
31	3fb37a57-99e6-459d-b0bb-a0f5df6b0567	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.791	2026-04-15 04:40:30.791	\N
32	93b8c2e7-d572-4a06-b36e-20706dbfc1fa	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.793	2026-04-15 04:40:30.793	\N
33	a8622742-0637-403c-b912-279e364a4739	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.797	2026-04-15 04:40:30.797	\N
34	a8622742-0637-403c-b912-279e364a4739	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.799	2026-04-15 04:40:30.799	\N
35	a8622742-0637-403c-b912-279e364a4739	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.801	2026-04-15 04:40:30.801	\N
36	9deac837-7f72-49b9-8580-c49b7bc92ffa	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.804	2026-04-15 04:40:30.804	\N
37	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.806	2026-04-15 04:40:30.806	\N
38	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.807	2026-04-15 04:40:30.807	\N
39	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.809	2026-04-15 04:40:30.809	\N
40	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.81	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.81	2026-04-15 04:40:30.81	2026-04-15 04:40:30.81
41	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.812	2026-04-15 04:40:30.812	\N
42	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.814	2026-04-15 04:40:30.814	\N
43	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.815	2026-04-15 04:40:30.815	\N
44	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.818	2026-04-15 04:40:30.818	\N
45	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.82	2026-04-15 04:40:30.82	\N
46	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.822	2026-04-15 04:40:30.822	\N
47	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.823	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.824	2026-04-15 04:40:30.824	2026-04-15 04:40:30.823
48	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.824	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.825	2026-04-15 04:40:30.825	2026-04-15 04:40:30.824
49	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.827	2026-04-15 04:40:30.827	\N
50	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.829	2026-04-15 04:40:30.829	\N
51	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.83	2026-04-15 04:40:30.83	\N
52	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.832	2026-04-15 04:40:30.832	\N
53	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.834	2026-04-15 04:40:30.834	\N
54	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.836	2026-04-15 04:40:30.836	\N
55	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.836	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.837	2026-04-15 04:40:30.837	2026-04-15 04:40:30.836
56	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.839	2026-04-15 04:40:30.839	\N
57	95d96540-3471-4aa7-97c0-6514e53ee2df	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.84	2026-04-15 04:40:30.84	\N
65	a8622742-0637-403c-b912-279e364a4739	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.842	2026-04-15 04:40:30.842	\N
66	0a73da10-2740-4a46-8086-fde9dd29d80c	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.843	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.843	2026-04-15 04:40:30.843	2026-04-15 04:40:30.843
71	0b033927-3108-42dd-9b2e-2fa2ebbd9da3	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.846	2026-04-15 04:40:30.846	\N
72	93b8c2e7-d572-4a06-b36e-20706dbfc1fa	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.848	2026-04-15 04:40:30.848	\N
73	93b8c2e7-d572-4a06-b36e-20706dbfc1fa	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.848	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.849	2026-04-15 04:40:30.849	2026-04-15 04:40:30.848
74	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.851	2026-04-15 04:40:30.851	\N
78	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.852	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.853	2026-04-15 04:40:30.853	2026-04-15 04:40:30.852
80	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.854	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.854	2026-04-15 04:40:30.854	2026-04-15 04:40:30.854
81	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.855	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.856	2026-04-15 04:40:30.856	2026-04-15 04:40:30.855
82	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.857	2026-04-15 04:40:30.857	\N
83	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.858	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.859	2026-04-15 04:40:30.859	2026-04-15 04:40:30.858
84	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.86	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.861	2026-04-15 04:40:30.861	2026-04-15 04:40:30.86
85	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.862	2026-04-15 04:40:30.862	\N
86	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.863	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.864	2026-04-15 04:40:30.864	2026-04-15 04:40:30.863
87	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.865	2026-04-15 04:40:30.865	\N
88	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.867	2026-04-15 04:40:30.867	\N
89	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.868	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.869	2026-04-15 04:40:30.869	2026-04-15 04:40:30.868
90	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.869	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.87	2026-04-15 04:40:30.87	2026-04-15 04:40:30.869
91	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.872	2026-04-15 04:40:30.872	\N
92	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.873	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.874	2026-04-15 04:40:30.874	2026-04-15 04:40:30.873
93	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.875	2026-04-15 04:40:30.875	\N
94	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.876	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.877	2026-04-15 04:40:30.877	2026-04-15 04:40:30.876
95	01f9b0b2-1de9-4e90-9221-9276e121b3f1	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.879	2026-04-15 04:40:30.879	\N
96	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.881	2026-04-15 04:40:30.881	\N
97	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.882	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.883	2026-04-15 04:40:30.883	2026-04-15 04:40:30.882
98	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.885	2026-04-15 04:40:30.885	\N
100	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.886	2026-04-15 04:40:30.886	\N
101	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.887	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.888	2026-04-15 04:40:30.888	2026-04-15 04:40:30.887
102	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.889	2026-04-15 04:40:30.889	\N
103	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	\N	draft	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.891	2026-04-15 04:40:30.891	\N
104	6eb5d203-25eb-4607-9707-ec59e5f7ec13	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	2026-04-15 04:40:30.892	acknowledged	\N	1a198120-7cc6-49ee-8e39-6e6976cea309	MANAGER	2026-04-15 04:40:30.893	2026-04-15 04:40:30.893	2026-04-15 04:40:30.892
\.


--
-- Data for Name: ObservationAnswer; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public."ObservationAnswer" (id, "observationId", "indicatorId", score, note, evidence, "createdAt", "updatedAt") FROM stdin;
42f2d015-5f0a-4825-ba6b-99f387b42ea6	df771780-25fc-421a-81cf-0f9d9b875bcd	3ee36ff3-6681-40de-a821-a288e1b694b4	4	Sudah cukup baik	foto.png	2026-04-10 03:59:10.163	2026-04-14 00:46:10.833
57cd8613-55c9-4513-82ca-c22262408c1b	935500db-6c57-4bd9-b0ab-e5165069088c	3ee36ff3-6681-40de-a821-a288e1b694b4	80	Respon tiket sangat cepat, rata-rata di bawah 1 jam	\N	2026-04-14 06:51:52.861	2026-04-14 06:52:12.999
9c5a8396-eca2-46fd-aa73-e7ce106ff536	31211410-d0f9-4997-9e2c-2029cb8a0710	3ee36ff3-6681-40de-a821-a288e1b694b4	18		\N	2026-04-14 06:53:39.447	2026-04-14 06:53:39.447
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
61f3164c-6582-46c9-8c36-3bb659af6855	e30daa4a7a02692e48aa15f820a206bf560faa7e0fb8a5b043d31deebac15c37	2026-04-09 13:35:36.819345+07	20260331083843_init	\N	\N	2026-04-09 13:35:36.739074+07	1
421670aa-fa1f-4d61-b166-2eda6fed313b	e3ba6f5853d4aca9776d1b0550838203a6adc260281caf2f2deb50b062630358	2026-04-09 13:35:36.828754+07	20260401030854_add_observation_answer	\N	\N	2026-04-09 13:35:36.819879+07	1
544f6f7a-4460-4bde-92a9-a63d2d9b9aa3	8b8aec67a2300c33f21f48449b7a4af658bca7a35d83bed601a00bf91add0309	2026-04-09 13:35:36.833231+07	20260402024842_add_manager_id	\N	\N	2026-04-09 13:35:36.829342+07	1
907d92bf-f5eb-461a-9e28-5e9241541931	a47f196ed195e99ac212bcd053821c0a9e89d06f6bfcc2cd413de7ec1911297f	2026-04-09 13:35:36.836081+07	20260402033920_add_user_hierarchy	\N	\N	2026-04-09 13:35:36.833751+07	1
45f476d9-3a6a-4472-a65a-e61e87749d39	cb24be8f9101acf9397eab58a9657c3ca378b6279ff7bc3b2f088347dc3c053e	2026-04-09 13:35:36.838117+07	20260402072133_add_observation_workflow	\N	\N	2026-04-09 13:35:36.836572+07	1
91a1de1d-c7e6-407a-9615-e7e67c472d21	872821ece833398216490d58e34d00661fc094a4fe8a137c10555c6a8695d339	2026-04-09 13:35:36.841455+07	20260407070643_add_observation_flow	\N	\N	2026-04-09 13:35:36.838567+07	1
5c4132e5-26b4-4746-83f6-9167d5ed9510	21d5affb31906148d4107664c35b3bb1a249467a9b277e89344817a36da988f4	2026-04-09 13:35:36.843596+07	20260408061254_add_timestamps_to_observation	\N	\N	2026-04-09 13:35:36.84193+07	1
ba1b0d10-520e-4d87-82d1-e73fb366418b	b32e4f6c8a546d6dbc25d3da8f3ade36c04dd5629a61d51f2735161a46e93574	2026-04-09 13:35:36.844994+07	20260409013648_add_submitted_at	\N	\N	2026-04-09 13:35:36.844003+07	1
3849dcf3-5ab2-4fce-ae20-77f5a8001ff2	1bfea3fbd974539a319177341309cc213fb43d968acd5a20255dd5e0bc82901b	2026-04-15 09:01:29.976041+07	20260415020129_add_observation_tables	\N	\N	2026-04-15 09:01:29.969621+07	1
\.


--
-- Data for Name: approval_workflows; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.approval_workflows (id, department_role_id, step_order, approver_role, step_type, created_at) FROM stdin;
\.


--
-- Data for Name: assessment_questions; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.assessment_questions (id, assessment_id, indicator_id, asked_by, question, response, responded_by, responded_at, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: assessments; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.assessments (id, staff_id, manager_id, director_id, template_id, period, status, staff_scores, manager_scores, staff_evidence, manager_evidence, manager_notes, director_comments, return_feedback, returned_at, returned_by, final_score, final_grade, staff_submitted_at, manager_reviewed_at, director_approved_at, staff_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: department_roles; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.department_roles (id, department_id, role, default_template_id, name, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.departments (id, name, parent_id, created_at, updated_at) FROM stdin;
a4ecf668-c162-4308-b4c3-e44629b00117	Operational	\N	2026-04-09 06:35:37.526	2026-04-09 06:35:37.526
fdd6f613-332c-49a2-89c2-ae1201ab319c	Junior High	\N	2026-04-09 06:35:37.526	2026-04-09 06:35:37.526
a4c06cfb-eb85-4960-a254-c4718376c7f0	Elementary	\N	2026-04-09 06:35:37.526	2026-04-09 06:35:37.526
98f0833a-26fe-4cfe-b431-d73ca992ed53	Kindergarten	\N	2026-04-09 06:35:37.526	2026-04-09 06:35:37.526
6c56f34c-dbaf-4c2f-a3de-b6026ba98cff	Directorate	\N	2026-04-09 06:35:37.526	2026-04-09 06:35:37.526
b1c81ff3-410f-492b-a4a3-73a927e0103c	Finance	\N	2026-04-09 06:35:37.526	2026-04-09 06:35:37.526
b0957653-0705-42d5-8681-87fbcad4ed08	CARE	\N	2026-04-09 06:35:37.526	2026-04-09 06:35:37.526
dbe4f077-6c29-46e2-b78b-81a296d2ccdb	MAD Lab	\N	2026-04-09 06:35:37.526	2026-04-09 06:35:37.526
670f94fa-ebb2-4e16-97c1-b768e3dc45df	Pelangi	\N	2026-04-09 06:35:37.526	2026-04-09 06:35:37.526
\.


--
-- Data for Name: kpi_domains; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.kpi_domains (id, template_id, name, weight, sort_order, created_at) FROM stdin;
c7b5d155-fcdf-4b3b-839c-e7fd91a4aba4	f089b3b3-7e6b-4540-af82-d0c49d98836b	Service Responsiveness	50.00	0	2026-04-10 09:12:20.953
464baffd-9dee-411c-8ba0-88ed45960338	f089b3b3-7e6b-4540-af82-d0c49d98836b	Technical Effectiveness	30.00	1	2026-04-10 09:16:48.966
0bf306d2-6747-4e10-af4b-c73d9cc95473	f089b3b3-7e6b-4540-af82-d0c49d98836b	User Satisfaction & Communication	20.00	2	2026-04-10 09:22:33.537
\.


--
-- Data for Name: kpi_standards; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.kpi_standards (id, domain_id, name, sort_order, created_at) FROM stdin;
126c136d-f597-469e-b2f0-a26816fe18f3	c7b5d155-fcdf-4b3b-839c-e7fd91a4aba4	Ticket Handling Efficiency	0	2026-04-10 09:12:54.134
836e8984-1530-411f-bb5c-61cb7a021e1a	464baffd-9dee-411c-8ba0-88ed45960338	Issue Resolution Quality	0	2026-04-10 09:20:54.439
f1cbffa4-2cc0-4284-9d57-5e8037b67750	0bf306d2-6747-4e10-af4b-c73d9cc95473	User Experience	0	2026-04-10 09:23:05.805
\.


--
-- Data for Name: kpis; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.kpis (id, standard_id, name, description, evidence_guidance, trainings, sort_order, rubric_4, rubric_3, rubric_2, rubric_1, created_at) FROM stdin;
e554cc2b-970f-416d-a303-b6afd361c965	126c136d-f597-469e-b2f0-a26816fe18f3	Ticket Resolution Time	Measures how quickly IT support resolves tickets based on SLA.			0	≥95%	80–94%	60–79%	<60%	2026-04-10 09:14:05.217
63897634-59b0-4dcb-b6df-1881d21efffd	836e8984-1530-411f-bb5c-61cb7a021e1a	First Contact Resolution	Percentage of issues resolved without escalation.			0	≥95%	75–89%	60–74%	<60%	2026-04-10 09:21:10.809
6db5afb0-fa33-41df-b00e-2e115cdc8ed5	f1cbffa4-2cc0-4284-9d57-5e8037b67750	User Satisfaction Score	Based on user feedback rating			0	≥4.5	4.0–4.4	3.0–3.9	<3.0	2026-04-10 09:23:16.419
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.notification_preferences (id, user_id, email_enabled, assessment_submitted, manager_review_done, director_approved, admin_released, assessment_returned, assessment_acknowledged, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.notifications (id, assessment_id, user_id, type, status, error, sent_at, created_at) FROM stdin;
1	\N	07dcbcf9-d40d-4540-bd36-affa5e74b5f6	manager_review_completed	sent	\N	2026-04-10 09:30:46.298	2026-04-10 09:30:46.294
2	\N	e9e07777-3d29-44d0-afa3-70f8441b4074	director_approved	sent	\N	2026-04-10 09:31:31.459	2026-04-10 09:31:31.458
3	\N	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	director_approved	sent	\N	2026-04-10 09:31:31.462	2026-04-10 09:31:31.461
4	\N	07dcbcf9-d40d-4540-bd36-affa5e74b5f6	manager_review_completed	sent	\N	2026-04-10 09:33:39.876	2026-04-10 09:33:39.874
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.profiles (id, user_id, email, full_name, niy, job_title, department_id, created_at, updated_at) FROM stdin;
ab4af277-ac5d-4e50-855b-6385616e1a80	6bb89ed2-9ad8-4429-baee-d27d9a408a3b	abdullah@millennia21.id	Abdullah	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:37.591	2026-04-09 06:35:37.591
ca347dfd-a4d7-4f76-a71c-f7761d2cc7a5	090799d9-3284-44e9-96e6-0746157aebe9	abu@millennia21.id	Abu Bakar Ali	\N	Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:37.652	2026-04-09 06:35:37.652
e4d9ec74-095f-4af5-9766-d703245b1eca	6a97d369-734f-4459-9fad-5c273f5aa608	adibah.hana@millennia21.id	Adibah Hana Widjaya	\N	Staff	6c56f34c-dbaf-4c2f-a3de-b6026ba98cff	2026-04-09 06:35:37.709	2026-04-09 06:35:37.709
ffd8117c-b062-4a97-b642-ce635ed7c190	d4bce7ff-4ce6-4e81-9a4a-3559b3fff42a	adiya.herisa@millennia21.id	Adiya Herisa	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:37.766	2026-04-09 06:35:37.766
efb29de9-e8c4-427d-abac-7529877cbf7c	c19228fb-9ec9-470c-b356-1ab0f0244657	afiyanti.hardiansari@millennia21.id	Afiyanti Hardiansari	\N	Teacher	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:37.823	2026-04-09 06:35:37.823
7845da28-45c7-4b00-84ff-f2e48e658ba3	4d3f98f6-5f37-4db8-94d4-488d74fa8053	dhaffa@millennia21.id	Alifananda Dhaffa Hanif Musyafa	\N	SE Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:37.937	2026-04-09 06:35:37.937
c797184a-84d6-4f87-ad4e-45d849769768	5228b29e-4864-4d0d-80c5-55616cc691f4	almia@millennia21.id	Almia Ester Kristiyany Sinabang	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:37.993	2026-04-09 06:35:37.993
a06bd7b8-c3a8-4f77-87ab-a280cb4a6178	9b329146-dce2-4dc6-9b30-dc342ee448e0	andre@millennia21.id	Andrean Hadinata	\N	Staff	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:38.049	2026-04-09 06:35:38.049
aa9c0185-e911-4f0e-b3e6-49f095ff24ba	a8de5a0a-9bbb-4bbd-a1b9-a69e55a23112	anggie@millennia21.id	Anggie Ayu Setya Pradini	\N	SE Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:38.106	2026-04-09 06:35:38.106
9acd2610-f2b5-417c-9dde-a8d2337433f0	fb04f59d-9839-4e56-a51d-b248ab7c4a5c	annisa@millennia21.id	Annisa Fitri Tanjung	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:38.162	2026-04-09 06:35:38.162
4367ae24-62a0-4c8b-8e5f-6a3ac226918c	e952dc49-c4d7-4e55-bf09-af23b6f8acb3	ardiansyah@millennia21.id	Ardiansyah	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:38.219	2026-04-09 06:35:38.219
b2fdf0a2-62ca-43ba-a338-f345ea13dd12	4f45c8e6-e714-4dd6-a5dd-661e2bf027a2	alinsuwisto@millennia21.id	Auliya Hasanatin Suwisto	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:38.386	2026-04-09 06:35:38.386
fbe1e660-dfc8-4b02-b486-28ebedf0840f	60d1e094-0600-4d90-a5fd-d91603767074	aprimaputri@millennia21.id	Ayunda Primaputri	\N	Teacher	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:38.445	2026-04-09 06:35:38.445
10b17a2e-f266-49a7-9890-83dff985f454	d73bbdb7-9871-4926-b52e-884286eb696b	wina@millennia21.id	Azalia Magdalena Septianti Tambunan	\N	Staff	6c56f34c-dbaf-4c2f-a3de-b6026ba98cff	2026-04-09 06:35:38.503	2026-04-09 06:35:38.503
5ac96bab-a21b-4a1b-9782-2c36996ea9ff	d1019254-c453-4ec2-9d69-2707e935d4ca	belakartika@millennia21.id	Bela Kartika Sari	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:38.559	2026-04-09 06:35:38.559
7c793d07-c9a9-427a-a3ac-e9029ba1ac3f	a8e7a287-8dca-4aff-9db6-bc1a83d0255d	nana@millennia21.id	Berliana Gustina Siregar	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:38.615	2026-04-09 06:35:38.615
dc68216f-a7b7-4190-8cd1-325b5560ba03	c2ab6e9e-f96b-483e-9f9f-445c5ecf14d0	chaca@millennia21.id	Chantika Nur Febryanti	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:38.672	2026-04-09 06:35:38.672
d44028d5-78e3-4d26-815c-968ed1b608fc	00b87ee1-2bb8-4193-b9a8-24178b9b220f	danu@millennia21.id	Danu Irwansyah	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:38.729	2026-04-09 06:35:38.729
5a67d493-19ef-4854-8545-8623c1a53d02	d467ea9f-5237-4cc2-8830-09272a4857ae	denis@millennia21.id	Denis Septian	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:38.785	2026-04-09 06:35:38.785
5ed34a97-d2a3-4745-b796-58c88dcca9ac	109f7ff6-ea68-49f1-9ddd-b0f67d28b57b	derry@millennia21.id	Derry Parmanto	\N	Staff	6c56f34c-dbaf-4c2f-a3de-b6026ba98cff	2026-04-09 06:35:38.842	2026-04-09 06:35:38.842
5a8a366c-72e0-41c7-8f7d-0eba329e9b34	de62bdaa-613e-43cf-bd76-59c8bb6f6192	devi.agriani@millennia21.id	Devi Agriani	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:38.9	2026-04-09 06:35:38.9
aded0c03-e69c-459a-a0de-07edd55f13fc	5a507f9e-941f-4f1b-9823-f97459a877cc	devilarasati@millennia21.id	Devi Larasati	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:38.956	2026-04-09 06:35:38.956
399eea78-3a0e-477f-99d8-f4d53919be9c	8045b950-7f2e-4858-9d19-d5998973d11f	dien@millennia21.id	Dien Islamy	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:39.013	2026-04-09 06:35:39.013
be54bacc-841f-48e6-9434-fb6621d15b98	4a36d15f-3de1-4bde-829d-fd8453bd8a17	dina@millennia21.id	Dina	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:39.07	2026-04-09 06:35:39.07
b06dc428-e42b-4ab1-8387-0c95286ec954	4d52ea14-c52d-421d-91b0-38fbb5182c0c	dinimeilani@millennia21.id	Dini Meilani Pramesti	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:39.126	2026-04-09 06:35:39.126
ba0cf223-5594-47ee-b4f0-a6cdf79ecbfd	779a9ce2-5995-4d16-adb4-f8766caea427	diya@millennia21.id	Diya Pratiwi	\N	Teacher	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:39.181	2026-04-09 06:35:39.181
d0a4f143-feca-4bfb-9798-3d17359165d5	bc787a21-afd3-4c43-bc68-8a4888a96728	dona@millennia21.id	Dona	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:39.237	2026-04-09 06:35:39.237
e296ad51-5f7a-47c8-9893-16ee7c692f96	e3574f0f-e2da-4fea-b97f-0a9a09d81a78	akbarfadholi98@millennia21.id	Fadholi Akbar	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:39.294	2026-04-09 06:35:39.294
9c5b602c-ff9f-42df-88d4-7145b2932806	a147b294-1332-4f34-a7ac-d1959f6f193d	fasa@millennia21.id	Faqiha Salma Achmada	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:39.406	2026-04-09 06:35:39.406
e08b568d-1446-4d84-be26-abfa14e4d34f	ebb7d23d-b97a-4311-a0f8-266ceb0190b7	aya@millennia21.id	Farhah Alya Nabilah	\N	Staff	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:39.462	2026-04-09 06:35:39.462
3cc71b6b-adfd-4042-831e-a6624fb8d430	5a27ff4d-dd48-4ad5-a494-38a9d484d4d5	jo@millennia21.id	Fayza Julia Pramesti Hapsari Prayoga	\N	Staff	670f94fa-ebb2-4e16-97c1-b768e3dc45df	2026-04-09 06:35:39.517	2026-04-09 06:35:39.517
f98b6720-c077-4cb5-9c4b-a75ebbf5eef1	eb2d599d-09ef-4b03-a491-a28737f3c8a7	ferlyna.balqis@millennia21.id	Ferlyna Balqis	\N	SE Teacher	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:39.573	2026-04-09 06:35:39.573
d7201a6a-df5b-4629-8135-e682b12d29c5	ecf0cb46-149c-4a68-be1f-27d5b44f0faf	fransiskaeva@millennia21.id	Fransiska Evasari	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:39.629	2026-04-09 06:35:39.629
4741e126-717c-4d5f-8a7d-9a5639fbf89f	e9e07777-3d29-44d0-afa3-70f8441b4074	faisal@millennia21.id	Faisal Nur Hidayat	\N	Head Unit	dbe4f077-6c29-46e2-b78b-81a296d2ccdb	2026-04-09 06:35:39.351	2026-04-14 09:58:10.602
228f0967-02f7-4475-8536-77be1f8b332f	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	ari.wibowo@millennia21.id	Ari Wibowo	\N	Staff	dbe4f077-6c29-46e2-b78b-81a296d2ccdb	2026-04-09 06:35:38.275	2026-04-09 13:42:44.241
4c4d21d5-ba07-49fc-b803-f62f9bdb1582	05106ce3-3b5c-4f45-adb6-16ab8a56fdce	aria@millennia21.id	Aria Wisnuwardana	\N	Head Unit	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:38.331	2026-04-14 09:57:48.257
5cea860e-6fdf-48a5-a231-50ca475cc970	b84d8031-e053-4c50-9228-827d0602cbc4	galen@millennia21.id	Galen Rasendriya	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:39.686	2026-04-09 06:35:39.686
876d12e9-832e-4bd3-8718-3a0e03ba70a2	fc29bcce-a56e-490f-b485-bf16d491f885	gebby@millennia21.id	Gebby Rika Amdani	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:39.742	2026-04-09 06:35:39.742
571a50c5-fcc2-4379-99e1-661a4b85cadd	c65ccd20-7803-43dd-b5bc-c52b09354947	gundah@millennia21.id	Gundah Basiswi	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:39.799	2026-04-09 06:35:39.799
e21189f2-f553-43a1-9571-99c5155d8bf3	abd35657-a575-4b80-918b-136bb88179d4	hadi@millennia21.id	Hadi	\N	Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:39.854	2026-04-09 06:35:39.854
6910d565-0f4e-4b9f-ab21-37356fd89d80	c612a974-799c-4374-9410-43fa1b270ecc	himawan@millennia21.id	Himawan Rizky Syaputra	\N	Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:39.966	2026-04-09 06:35:39.966
45feabf5-fbe9-4d57-b5b3-756b72229451	73e65845-a426-47ba-b1fe-a1e293c9e17e	ian.ahmad@millennia21.id	Ian Ahmad Fauzi	\N	Staff	b1c81ff3-410f-492b-a4a3-73a927e0103c	2026-04-09 06:35:40.021	2026-04-09 06:35:40.021
e36d72f4-94bc-4f23-927e-961177325e23	9e047de7-b7d3-443e-88e9-07b6c93339d7	iis@millennia21.id	Iis Asifah	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:40.076	2026-04-09 06:35:40.076
1ebc18f6-436a-44bc-be03-4d58392a7784	26e4d891-daac-43d9-a35f-1ed0b31d3652	ikarahayu@millennia21.id	Ika Rahayu	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:40.132	2026-04-09 06:35:40.132
5f439124-836e-4b2b-b584-7610fc5b0f05	f660374c-0d0f-44b0-91af-c4e888cae7b1	irawan@millennia21.id	Irawan	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:40.188	2026-04-09 06:35:40.188
7d4ef81b-e372-41d8-bc97-6cc8013f281b	bab72814-1cbe-4693-ac3c-bb7fd65d4b70	khairul@millennia21.id	Khairul Anwar	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:40.245	2026-04-09 06:35:40.245
2310534d-6225-4591-9951-9a6ae9fb7429	ad102766-5f46-45e4-bbdc-e1b981ded3af	alys@millennia21.id	Krisalyssa Esna Rehulina Tarigan	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:40.356	2026-04-09 06:35:40.356
0b9740e2-7f5e-4f12-8b91-411b1682681e	d31eb59d-daf5-4c80-9fe2-6e9e5cdc8504	sandi@millennia21.id	Kurnia Sandi	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:40.412	2026-04-09 06:35:40.412
a694fab9-b057-45cd-a7fa-f2eb724db313	5923371b-a16d-4e2c-9c96-d22c0b1916f3	maria@millennia21.id	Maria Rosa Apriliana Jaftoran	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:40.577	2026-04-09 06:35:40.577
3cf74950-0dc7-4c07-853e-94a495f89cdc	54d39ace-0692-4c99-b56d-abfd670a3a83	maulida.yunita@millennia21.id	Maulida Yunita	\N	Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:40.633	2026-04-09 06:35:40.633
4059a66c-f467-46d3-86f1-c3066f8a2ccb	6a670aae-4dae-451c-ab28-75b81b225d62	muhammad.farhan@millennia21.id	Muhammad Farhan Sholeh Ramadhika	\N	Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:40.688	2026-04-09 06:35:40.688
93c7cb91-4d0f-46ca-9c58-cfb9c3efe285	0c379847-8194-4faf-95bc-557eff0ed639	fathan.qalbi@millennia21.id	Muhammad Fathan Qorib	\N	Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:40.744	2026-04-09 06:35:40.744
b4b71c91-d825-43be-a982-e60bbc757a38	11fc92de-c1da-4106-90b8-f6292c9b2b2e	awal@millennia21.id	Muhammad Gibran Al Wali	\N	Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:40.8	2026-04-09 06:35:40.8
c9099e31-8a21-4bea-b7d9-388860642bda	47bacb6b-5ee9-4983-b2bf-a0970bd52f78	ananta@millennia21.id	Muhammad Rayhan Ananta	\N	Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:40.856	2026-04-09 06:35:40.856
9832a566-e2bd-428f-974a-cc390823b68a	368b9376-4114-4998-9f75-2e9e2f76b037	mukron@millennia21.id	Mukron	\N	Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:40.913	2026-04-09 06:35:40.913
9643ad25-4e01-4873-8664-4fe81dd15e03	bdec744a-d9c2-49d2-bfac-72ec4c9f14a9	nadiamws@millennia21.id	Nadia	\N	Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:40.969	2026-04-09 06:35:40.969
1ccec932-65a8-48f7-970f-09133fd4b2e2	229c1108-7fa8-41e7-9b4c-822c52531881	sisil@millennia21.id	Najmi Silmi Mafaza	\N	Teacher	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:41.026	2026-04-09 06:35:41.026
d296f466-8e28-4c58-b24a-d5e0894785e7	6e9a9fc1-e5e8-45cc-be1b-7696314528cf	nanda@millennia21.id	Nanda Citra Ryani	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.082	2026-04-09 06:35:41.082
ba22f57e-9d1d-4ae4-81c8-cba2435de241	47d6cb9d-adda-4536-bb58-5c7d834a2a78	nathasya@millennia21.id	Nathasya Christine Prabowo	\N	Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:41.138	2026-04-09 06:35:41.138
d6c93d8b-9337-4aa7-9838-8d7974b01b26	b8687a19-2ae2-4f20-a3cb-4858f43cd410	nayandra@millennia21.id	Nayandra Hasan Sudra	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.194	2026-04-09 06:35:41.194
d8a35775-28a2-41dc-a66b-6c49019f8089	bee2fc0d-bf5f-4fee-b7f9-5a8f3a6cc2d8	kusumawantari@millennia21.id	Nazmi Kusumawantari	\N	Staff	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.252	2026-04-09 06:35:41.252
c1e50239-1efc-4786-855d-d65648beae7f	cb0701a3-1cfe-4951-862b-4e686809c0db	made@millennia21.id	Ni Made Ayu Juwitasari	\N	SE Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:41.31	2026-04-09 06:35:41.31
649f5d8b-a3ea-4de1-bcf4-3aaac82c2151	05f5b88f-068d-47a0-bb2e-76eebcf24568	novan@millennia21.id	Novan Syaiful Rahman	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.367	2026-04-09 06:35:41.367
ce42ddfd-b869-4e3a-b6d3-399fdc270b4d	799ffc90-fb7c-4c87-bb44-41ac39c6ac6d	novia@millennia21.id	Novia Syifaputri Ramadhan	\N	Staff	b0957653-0705-42d5-8681-87fbcad4ed08	2026-04-09 06:35:41.424	2026-04-09 06:35:41.424
adbb2f4e-a7fe-49d1-9f9f-93bb896a949b	9cf78649-f0f3-4bc2-8e68-b61554427284	ismail@millennia21.id	Nur Muhamad Ismail	\N	Teacher	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:41.481	2026-04-09 06:35:41.481
322f2ca5-c14e-435c-9f7d-a5a8946dec99	3892d0b0-8207-4515-b6e3-bd290339e64f	widya@millennia21.id	Nurul Widyaningtyas Agustin	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.539	2026-04-09 06:35:41.539
15869caf-f9ca-4d85-ba39-0043efd21dec	d5e8d615-a464-4a66-acc7-8cff2bdbb9c8	pipiet@millennia21.id	Pipiet Anggreiny	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.595	2026-04-09 06:35:41.595
792e5bb9-9504-4a5f-80dc-c538e09e2ae9	4d989caf-0c51-4aa2-8adb-9f2e82db44c7	cecil@millennia21.id	Pricilla Cecil Leander	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.651	2026-04-09 06:35:41.651
be17f2b1-4c04-460a-b843-cf4dc5dede3a	86a62869-cf7a-4b8a-a3f9-bc89561ba4f0	prisy@millennia21.id	Prisy Dewanti	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.706	2026-04-09 06:35:41.706
c7d70acb-1873-4f61-b9dc-0ef0b6f2480f	ecfbde16-5fbc-450b-af22-e6dcb0b86c13	hana.fajria@millennia21.id	Hana Nuzula Fajria	\N	Head Unit	670f94fa-ebb2-4e16-97c1-b768e3dc45df	2026-04-09 06:35:39.91	2026-04-14 09:59:24.873
4d926fe6-5a89-4a32-b571-3c94bd44b825	619fd9ac-d0a2-42e1-9523-aca6e352f8eb	latifah@millennia21.id	Latifah Nur Restiningtyas	\N	Head Unit	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:40.467	2026-04-14 09:59:01.872
a71b444d-c6ea-4809-a514-f10a8362e8a4	07dcbcf9-d40d-4540-bd36-affa5e74b5f6	mahrukh@millennia21.id	Mahrukh Bashir	\N	Director	6c56f34c-dbaf-4c2f-a3de-b6026ba98cff	2026-04-09 06:35:40.522	2026-04-14 09:58:23.172
398f603f-9806-4bb0-948d-8e3f848a8559	fdbc07a2-54c1-412c-ac6d-7de2ffbccdd4	putri.fitriyani@millennia21.id	Putri Fitriyani	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.762	2026-04-09 06:35:41.762
656dc833-fec2-4884-b523-e3a6983274cf	bd4cdfae-c2b4-4f04-a5a2-2a145d610246	radit@millennia21.id	Raditya Saputra	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:41.819	2026-04-09 06:35:41.819
f3db6b40-c644-4500-8022-66cad8641416	ec7e3e81-c490-4412-9d67-12344ff1be83	raisa@millennia21.id	Raisa Ramadhani	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.874	2026-04-09 06:35:41.874
ceaa720f-1ff3-42bc-921a-5130b15e38b5	6d785c33-3b65-4626-b0ca-2ecc65b8255f	ratna@millennia21.id	Ratna Merlangen	\N	Staff	6c56f34c-dbaf-4c2f-a3de-b6026ba98cff	2026-04-09 06:35:41.93	2026-04-09 06:35:41.93
890253a9-5b87-4f70-981d-ae57347611d7	61b67dc4-ac5e-482e-a6a8-ed8161d4def4	restia.widiasari@millennia21.id	Restia Widiasari	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:41.986	2026-04-09 06:35:41.986
41b09122-7c7e-4e0a-8e4d-c5d15f2e8f25	ce344394-f0a1-4db1-9ac3-42a204561f48	rezarizky@millennia21.id	Reza Rizky Prayudha	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:42.042	2026-04-09 06:35:42.042
7d64b2d8-ef6b-41bf-a571-018c1ec13e3a	d722e728-4d7f-4793-a20a-3e8b9b2d16e6	rifqi.satria@millennia21.id	Rifqi Satria Permana	\N	Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:42.098	2026-04-09 06:35:42.098
9f4a16e3-02e4-4697-bac9-379a2afb6ff2	db47af38-15f6-44bd-9c60-706f866b583d	rike@millennia21.id	Rike Rahmawati	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:42.154	2026-04-09 06:35:42.154
e5b29524-0f18-4f86-816b-d6b3dabb0be0	d0906acd-2368-4121-8c39-19cd7c51798d	risma.angelita@millennia21.id	Risma Ayu Angelita	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:42.21	2026-04-09 06:35:42.21
3c58166f-91ce-4b92-b20a-d2d431678655	1a36a031-b90d-4e54-bfda-22688ac96079	risma.galuh@millennia21.id	Risma Galuh Pitaloka Fahdin	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:42.266	2026-04-09 06:35:42.266
173385f7-d88f-41e0-a665-d0b5fd17d7d3	2bcf6b44-094d-4b84-be3e-677676ab67ed	kiki@millennia21.id	Rizki Amalia Fatikhah	\N	Teacher	6c56f34c-dbaf-4c2f-a3de-b6026ba98cff	2026-04-09 06:35:42.322	2026-04-09 06:35:42.322
458f57ee-2031-4a09-bb46-deb711a1e2be	efd686be-cab6-4185-8341-da6ad52a797e	rizkinurul@millennia21.id	Rizki Nurul Hayati	\N	Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:42.378	2026-04-09 06:35:42.378
c0ae4519-2c44-4afa-a13f-48ba736469a0	2888756b-2773-4018-af4b-c7daaa991008	robby@millennia21.id	Robby Anggara	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:42.434	2026-04-09 06:35:42.434
ede5b2bf-6cf0-44af-a7ba-d9e5b4f730d1	e2188878-8264-4b9a-bea2-ca8fae397dae	robby.noer@millennia21.id	Robby Noer Abjuny	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:42.489	2026-04-09 06:35:42.489
aef06a9e-f022-42aa-90a7-f54ed7586776	def36142-38ec-479c-9870-3225aafef955	robiatul@millennia21.id	Robiatul Adawiah	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:42.546	2026-04-09 06:35:42.546
08066deb-c458-40de-a280-161f78b74417	683c7d83-1e6f-455f-8c3a-9c60a3aa1fdc	rohmatulloh@millennia21.id	Rohmatulloh	\N	Support Staff	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:42.602	2026-04-09 06:35:42.602
c8b2b0e3-d258-4320-b71e-36fe1201a14e	8c036bb3-b7cc-4a69-9caf-0188b24dbab3	roma@millennia21.id	Romasta Oryza Sativa Siagian	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:42.657	2026-04-09 06:35:42.657
33a6ed6d-dd59-48ac-9185-4f362540bc85	82fa6ad4-dca3-4fac-86b3-1b22c00466da	salsabiladhiyaussyifa@millennia21.id	Salsabila Dhiyaussyifa Laela	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:42.714	2026-04-09 06:35:42.714
90f42ee5-70a3-43ec-9539-9a78a05a0a1e	21a485b2-63bd-4d58-81c0-78727a02b326	sayed.jilliyan@millennia21.id	Sayed Jilliyan	\N	SE Teacher	b1c81ff3-410f-492b-a4a3-73a927e0103c	2026-04-09 06:35:42.825	2026-04-09 06:35:42.825
d3733b58-ed36-4788-bfca-57cb1392ecf3	2c2f4466-7c77-4d0a-9b99-a053e4ae54b4	tiastiningrum@millennia21.id	Tiastiningrum Nugrahanti	\N	Staff	6c56f34c-dbaf-4c2f-a3de-b6026ba98cff	2026-04-09 06:35:42.994	2026-04-09 06:35:42.994
489efdf7-6a4a-4997-8736-5096a7ee1b09	b330eb7b-39f9-4437-b8cf-941baf446912	hanny@millennia21.id	Tien Hadiningsih	\N	Head Unit	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:43.05	2026-04-09 06:35:43.05
dfd5d616-d5de-4b3e-8898-6968917eb442	81c25e80-0160-4a62-a040-42af0f1e8861	triayulestari@millennia21.id	Tri Ayu Lestari	\N	Staff	6c56f34c-dbaf-4c2f-a3de-b6026ba98cff	2026-04-09 06:35:43.106	2026-04-09 06:35:43.106
78779fee-8812-4011-802f-963dedb6b980	866643e3-512d-401c-8434-9be45cc8a75e	triafadilla@millennia21.id	Tria Fadilla	\N	SE Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:43.162	2026-04-09 06:35:43.162
bc50ff2f-09b0-4745-b337-46ae7b484453	2f5c157b-ead6-446e-9faf-1206f171031e	udom@millennia21.id	Udom Anatapong	\N	Staff	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:43.218	2026-04-09 06:35:43.218
f688d838-e200-4613-a145-0da9170577d5	1b82c6ed-070a-4720-9571-6aeb58779610	usep@millennia21.id	Usep Saefurohman	\N	Teacher	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:43.273	2026-04-09 06:35:43.273
11faa315-00d8-42ba-a1f9-7569586506f7	bfed3a90-278e-4ef8-89f8-eef0a622e4c6	vickiaprinando@millennia21.id	Vicki Aprinando	\N	Teacher	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:43.33	2026-04-09 06:35:43.33
f49820b1-8e30-4457-8584-752421d3bdc5	e22e93f5-a4ac-4710-9262-f1cf965e2080	vinka@millennia21.id	Vinka Erawati	\N	Support Staff	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:43.386	2026-04-09 06:35:43.386
abfa954b-fe72-46b4-9ffc-b2d65bdb2cd2	188674e7-6862-4bd4-a435-049e508fecf8	wahyu@millennia21.id	Wahyu Ramadhan	\N	Support Staff	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:43.441	2026-04-09 06:35:43.441
0702fd67-eb90-408c-b297-87072dae93f7	56bf86c0-a849-43d5-804e-c0187a80d8e7	yeti@millennia21.id	Yeti	\N	Teacher	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:43.497	2026-04-09 06:35:43.497
39c9c0d6-5deb-481a-988d-976e8d9e8717	e484eecd-3345-4747-8b1b-21b4c3cd22c8	yohana@millennia21.id	Yohana Setia Risli	\N	SE Teacher	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:43.553	2026-04-09 06:35:43.553
0746e1ae-e7d6-4ae1-94b9-6d62a571890b	ffff5638-835a-484f-8bc6-3d51dbae14e0	yosafat@millennia21.id	Yosafat Imanuel Parlindungan	\N	Teacher	98f0833a-26fe-4cfe-b431-d73ca992ed53	2026-04-09 06:35:43.61	2026-04-09 06:35:43.61
24fc1d13-7231-4f2b-8818-391fc61988b7	b1658138-9042-483b-9d79-978964fad136	oudy@millennia21.id	Zavier Cloudya Mashareen	\N	Teacher	fdd6f613-332c-49a2-89c2-ae1201ab319c	2026-04-09 06:35:43.666	2026-04-09 06:35:43.666
8bb74e99-7919-40df-a94f-ca1a7cc5be88	a7278145-4ec8-40d6-8f7d-368d6e46e489	zolla@millennia21.id	Zolla Firmalia Rossa	\N	Teacher	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:43.721	2026-04-09 06:35:43.721
2ec9699c-dc1d-4f77-aab5-c4c5eb26dfa7	20fbef18-25ac-4fde-9cd0-3a58281dae26	dodi@millennia21.id	Ahmad Haikal	\N	Head Unit	a4ecf668-c162-4308-b4c3-e44629b00117	2026-04-09 06:35:37.88	2026-04-14 09:57:57.429
ad44a10a-2fae-49aa-b3e2-d602b6693ca4	9d3aa0d1-7f11-464b-8895-aa31ff8bf7d2	susantika@millennia21.id	Susantika Nilasari	\N	Head Unit	b0957653-0705-42d5-8681-87fbcad4ed08	2026-04-09 06:35:42.939	2026-04-14 09:58:51.73
5356a88e-d025-4220-b0e5-1b046c96ba1f	4ca6fa4e-8238-43fc-b8ad-a5e2c2a52ec8	sarahyuliana@millennia21.id	Sarah Yuliana	\N	Teacher	b1c81ff3-410f-492b-a4a3-73a927e0103c	2026-04-09 06:35:42.769	2026-04-14 09:59:39.964
8e37514e-f53d-4abd-bdc5-ac832b163662	5084b3b5-2721-4816-9539-09292bb84291	rain@millennia21.id	Shahrani Fatimah Azzahrah	\N	SE Teacher	b0957653-0705-42d5-8681-87fbcad4ed08	2026-04-09 06:35:42.882	2026-04-14 09:58:39.65
83128995-d604-48e5-ba40-90d622655200	cd87e32b-d278-468d-8c79-f67579131a0c	kholida@millennia21.id	Kholida Widyawati	\N	Head Unit	a4c06cfb-eb85-4960-a254-c4718376c7f0	2026-04-09 06:35:40.301	2026-04-14 09:59:12.337
9043d749-cfdc-4645-9b63-7f302b7241f4	ab32b306-669a-4c6b-ab39-0e625eae5749	checklist.for.direct.instruction@millennia21.id	CHECKLIST FOR DIRECT INSTRUCTION	\N	\N	\N	2026-04-15 04:40:30.725	2026-04-15 04:40:30.725
2a17ec7f-ecad-447e-975b-55800b645e43	95d96540-3471-4aa7-97c0-6514e53ee2df	special.education.teacher.supervision.instrument@millennia21.id	Special Education Teacher Supervision Instrument	\N	\N	\N	2026-04-15 04:40:30.736	2026-04-15 04:40:30.736
a2aa58b4-f844-4f96-bb7d-d6c385853465	6eb5d203-25eb-4607-9707-ec59e5f7ec13	detailed.classroom.observation@millennia21.id	DETAILED CLASSROOM OBSERVATION	\N	\N	\N	2026-04-15 04:40:30.741	2026-04-15 04:40:30.741
41bf834e-fcbb-4e72-816a-cffabb699b97	0a73da10-2740-4a46-8086-fde9dd29d80c	checklist.for.learning.and.understanding@millennia21.id	CHECKLIST FOR LEARNING AND UNDERSTANDING	\N	\N	\N	2026-04-15 04:40:30.779	2026-04-15 04:40:30.779
144d5c11-7cf9-4d3a-af43-d8d4359d06c4	f232abc1-86d2-460b-9307-d5b88f40bcd7	focus.on.learners.student.engagement@millennia21.id	FOCUS ON LEARNERS  STUDENT ENGAGEMENT	\N	\N	\N	2026-04-15 04:40:30.783	2026-04-15 04:40:30.783
2687aaba-ae4e-41c2-95d8-94cb8aebc9e3	3fb37a57-99e6-459d-b0bb-a0f5df6b0567	checklist.for.differentiation@millennia21.id	CHECKLIST FOR DIFFERENTIATION	\N	\N	\N	2026-04-15 04:40:30.789	2026-04-15 04:40:30.789
89b640bc-0d37-4284-b1a4-07843d385f43	93b8c2e7-d572-4a06-b36e-20706dbfc1fa	focus.on.learners.small.group.or.in.pairing@millennia21.id	FOCUS ON LEARNERS  SMALL GROUP OR IN PAIRING	\N	\N	\N	2026-04-15 04:40:30.792	2026-04-15 04:40:30.792
ec6c2ae1-6d73-4cd0-a03f-c335f22ee3ea	a8622742-0637-403c-b912-279e364a4739	classroom.display.checklist@millennia21.id	CLASSROOM DISPLAY CHECKLIST	\N	\N	\N	2026-04-15 04:40:30.795	2026-04-15 04:40:30.795
0c1e63c4-d08e-4e24-9cab-8ba5097891a1	9deac837-7f72-49b9-8580-c49b7bc92ffa	test.observation@millennia21.id	Test Observation	\N	\N	\N	2026-04-15 04:40:30.803	2026-04-15 04:40:30.803
9515b910-14c2-40c2-b405-5a9015788c7c	0b033927-3108-42dd-9b2e-2fa2ebbd9da3	delivery.of.instruction@millennia21.id	DELIVERY OF INSTRUCTION	\N	\N	\N	2026-04-15 04:40:30.845	2026-04-15 04:40:30.845
116b9f92-1386-45e0-b525-adcbd68ae960	01f9b0b2-1de9-4e90-9221-9276e121b3f1	lesson.preparation.walkthrough@millennia21.id	Lesson Preparation Walkthrough	\N	\N	\N	2026-04-15 04:40:30.878	2026-04-15 04:40:30.878
\.


--
-- Data for Name: rubric_indicators; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.rubric_indicators (id, section_id, name, description, sort_order, evidence_guidance, score_options, created_at) FROM stdin;
3ee36ff3-6681-40de-a821-a288e1b694b4	763461ee-f2ff-46ac-be49-09474b78119e	Kecepatan respon tiket	Seberapa cepat menangani tiket user	1	\N	\N	2026-04-10 10:53:01.816
9502127f-5ff5-4ce3-ac6d-5da926fe9f85	9ba6afae-55ba-44fa-becb-bdf161ae7ae8	Overall Performance	General assessment of performance	0	\N	\N	2026-04-15 04:40:30.708
\.


--
-- Data for Name: rubric_sections; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.rubric_sections (id, template_id, name, weight, sort_order, created_at) FROM stdin;
c5ca46b2-8027-453d-b041-9b5048e25c77	f089b3b3-7e6b-4540-af82-d0c49d98836b	Responsiveness	50.00	1	2026-04-10 10:49:47.501
763461ee-f2ff-46ac-be49-09474b78119e	f089b3b3-7e6b-4540-af82-d0c49d98836b	Responsiveness	50.00	1	2026-04-10 10:52:23.952
9ba6afae-55ba-44fa-becb-bdf161ae7ae8	1a198120-7cc6-49ee-8e39-6e6976cea309	General Performance	100.00	0	2026-04-15 04:40:30.708
\.


--
-- Data for Name: rubric_templates; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.rubric_templates (id, name, description, department_id, is_global, created_by, created_at, updated_at) FROM stdin;
c8d10653-e09e-4f83-975a-dc24aec5b317	New KPI Template		\N	f	e9e07777-3d29-44d0-afa3-70f8441b4074	2026-04-09 15:03:51.2	2026-04-09 15:03:51.2
f089b3b3-7e6b-4540-af82-d0c49d98836b	IT SUPPORT	This KPI template is designed to evaluate IT Support performance in handling technical issues, service responsiveness, system maintenance, and user satisfaction through structured domains, standards, and measurable indicators.	\N	f	e9e07777-3d29-44d0-afa3-70f8441b4074	2026-04-10 08:48:33.104	2026-04-10 09:26:22.549
1a198120-7cc6-49ee-8e39-6e6976cea309	Default Observation Rubric	Auto-generated rubric for observation migration	\N	t	\N	2026-04-15 04:40:30.708	2026-04-15 04:40:30.708
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.user_roles (id, user_id, role, created_at) FROM stdin;
c37f83a2-3544-45b4-8451-d4a2746d232f	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	staff	2026-04-09 13:42:44.337
ec316b0e-61b4-4d1a-89aa-26c820cbd670	cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	admin	2026-04-09 13:42:44.338
5a3ed3cf-4d83-4a84-a371-d1f6c1eba423	6bb89ed2-9ad8-4429-baee-d27d9a408a3b	staff	2026-04-14 02:50:22.094
46919263-ed92-4cd1-bb18-5a0484ae9fa6	090799d9-3284-44e9-96e6-0746157aebe9	staff	2026-04-14 02:50:22.099
5867810a-afaf-4f4b-8a20-9089e5c4387e	6a97d369-734f-4459-9fad-5c273f5aa608	staff	2026-04-14 02:50:22.101
c84452f0-12cb-44f2-8480-e9eee6af0d16	d4bce7ff-4ce6-4e81-9a4a-3559b3fff42a	staff	2026-04-14 02:50:22.104
a0907b0a-c1b6-4dcd-908e-f2924265b16b	c19228fb-9ec9-470c-b356-1ab0f0244657	staff	2026-04-14 02:50:22.107
f7a19d2f-48f3-4c60-9738-ee99e879a9f1	4d3f98f6-5f37-4db8-94d4-488d74fa8053	staff	2026-04-14 02:50:22.111
59b00c8e-fdb0-4c57-a317-d3e47fee9db1	5228b29e-4864-4d0d-80c5-55616cc691f4	staff	2026-04-14 02:50:22.113
6ed27082-ddc7-4101-9399-80aa55620c08	9b329146-dce2-4dc6-9b30-dc342ee448e0	staff	2026-04-14 02:50:22.116
3a2f9877-e3ee-4562-ad08-4bcb5c29bb8d	a8de5a0a-9bbb-4bbd-a1b9-a69e55a23112	staff	2026-04-14 02:50:22.118
4b16f3da-3425-40d5-b1c3-8f888fd29e97	fb04f59d-9839-4e56-a51d-b248ab7c4a5c	staff	2026-04-14 02:50:22.121
0cb02e36-7627-425d-93ee-5fd1101f85f4	e952dc49-c4d7-4e55-bf09-af23b6f8acb3	staff	2026-04-14 02:50:22.123
ef1ef510-87c2-4d09-9a45-be4a1c6bc936	4f45c8e6-e714-4dd6-a5dd-661e2bf027a2	staff	2026-04-14 02:50:22.128
c9f71524-c606-492f-b397-2541c3609e7d	60d1e094-0600-4d90-a5fd-d91603767074	staff	2026-04-14 02:50:22.129
a9c5cb1a-f334-45e3-8ca3-1e22c2a14954	d73bbdb7-9871-4926-b52e-884286eb696b	staff	2026-04-14 02:50:22.131
32bdf3a3-4959-4c09-b62e-7dfb6bbdee52	d1019254-c453-4ec2-9d69-2707e935d4ca	staff	2026-04-14 02:50:22.133
841ed8ba-e2e2-4352-a41b-3ebd86ae9e03	a8e7a287-8dca-4aff-9db6-bc1a83d0255d	staff	2026-04-14 02:50:22.136
447e61c3-1526-4241-8f8f-50b9a46c0762	c2ab6e9e-f96b-483e-9f9f-445c5ecf14d0	staff	2026-04-14 02:50:22.138
8c341eab-2c3c-4a5e-b47f-f681b085bdbd	00b87ee1-2bb8-4193-b9a8-24178b9b220f	staff	2026-04-14 02:50:22.14
15cdf868-5afc-44a6-97bd-fbf983b5f5b5	d467ea9f-5237-4cc2-8830-09272a4857ae	staff	2026-04-14 02:50:22.142
4a4e9f2f-84d8-4062-a620-876a8ddf3f1d	109f7ff6-ea68-49f1-9ddd-b0f67d28b57b	staff	2026-04-14 02:50:22.144
e8bef0f6-9aed-4e5d-9846-e2cc2ce7ba59	de62bdaa-613e-43cf-bd76-59c8bb6f6192	staff	2026-04-14 02:50:22.146
9768e5f3-5178-43dc-91ba-c8a6bdf79d99	5a507f9e-941f-4f1b-9823-f97459a877cc	staff	2026-04-14 02:50:22.147
8ba5f599-6200-4842-ae3f-48b58afab6df	8045b950-7f2e-4858-9d19-d5998973d11f	staff	2026-04-14 02:50:22.149
2edea891-0914-41a7-845e-0afb4ab3a019	4a36d15f-3de1-4bde-829d-fd8453bd8a17	staff	2026-04-14 02:50:22.151
df00508a-7291-4321-a2f3-938c9c383db0	4d52ea14-c52d-421d-91b0-38fbb5182c0c	staff	2026-04-14 02:50:22.153
11441256-f12d-4ecf-89d6-dc75ec157674	779a9ce2-5995-4d16-adb4-f8766caea427	staff	2026-04-14 02:50:22.155
7b0336f1-2984-4a14-a983-7de088fb1706	bc787a21-afd3-4c43-bc68-8a4888a96728	staff	2026-04-14 02:50:22.158
e8e0d786-eaf2-48fe-a22e-c185b63ea378	e3574f0f-e2da-4fea-b97f-0a9a09d81a78	staff	2026-04-14 02:50:22.159
4724e539-2855-4051-803a-5cf16c0c0e17	a147b294-1332-4f34-a7ac-d1959f6f193d	staff	2026-04-14 02:50:22.163
2e00fc88-6a0f-49a1-a824-f4a9ef0d7c66	ebb7d23d-b97a-4311-a0f8-266ceb0190b7	staff	2026-04-14 02:50:22.165
2ef3dcb7-e9cc-48e2-9420-079f362d61b4	5a27ff4d-dd48-4ad5-a494-38a9d484d4d5	staff	2026-04-14 02:50:22.166
428d5766-6b0c-4a82-bdbf-ad3aa527761b	eb2d599d-09ef-4b03-a491-a28737f3c8a7	staff	2026-04-14 02:50:22.169
64d912b5-9645-4840-ad5b-b2adf4bd3ae8	ecf0cb46-149c-4a68-be1f-27d5b44f0faf	staff	2026-04-14 02:50:22.17
048df3a9-691b-43d6-bf61-185472c51727	b84d8031-e053-4c50-9228-827d0602cbc4	staff	2026-04-14 02:50:22.173
9e2e59fc-fb0d-4e63-919d-8047cca58615	fc29bcce-a56e-490f-b485-bf16d491f885	staff	2026-04-14 02:50:22.175
63dc2b0e-308a-46ac-875b-6792f5ee3b72	c65ccd20-7803-43dd-b5bc-c52b09354947	staff	2026-04-14 02:50:22.177
6cf4ac62-cfdb-4cee-8d7d-4f7d09d3d531	abd35657-a575-4b80-918b-136bb88179d4	staff	2026-04-14 02:50:22.178
d5af889d-e49c-4f24-882b-43e6f3cdf1ee	c612a974-799c-4374-9410-43fa1b270ecc	staff	2026-04-14 02:50:22.183
1c577ab3-b2ee-4901-981f-d26d139b7a7e	73e65845-a426-47ba-b1fe-a1e293c9e17e	staff	2026-04-14 02:50:22.185
fb4e64be-856b-40ca-9786-2cc43199120a	9e047de7-b7d3-443e-88e9-07b6c93339d7	staff	2026-04-14 02:50:22.187
7ae505c1-097d-4333-aca6-589f7c773dce	26e4d891-daac-43d9-a35f-1ed0b31d3652	staff	2026-04-14 02:50:22.189
2ed94312-5959-4853-9696-d9eac010712a	f660374c-0d0f-44b0-91af-c4e888cae7b1	staff	2026-04-14 02:50:22.191
0b876bf3-4e01-48a1-a468-48df8b897a93	bab72814-1cbe-4693-ac3c-bb7fd65d4b70	staff	2026-04-14 02:50:22.192
2725ea6c-0173-4910-872a-eaf88f42256d	ad102766-5f46-45e4-bbdc-e1b981ded3af	staff	2026-04-14 02:50:22.196
7d20969f-0b5f-41d9-8749-2d1a95ec67fb	d31eb59d-daf5-4c80-9fe2-6e9e5cdc8504	staff	2026-04-14 02:50:22.197
71012de2-62e7-478d-9b79-208801c07972	5923371b-a16d-4e2c-9c96-d22c0b1916f3	staff	2026-04-14 02:50:22.203
b986771c-3b30-4b5e-9474-0382af2599ae	54d39ace-0692-4c99-b56d-abfd670a3a83	staff	2026-04-14 02:50:22.206
70885b4e-fd50-4567-b8aa-5d965de02f4c	6a670aae-4dae-451c-ab28-75b81b225d62	staff	2026-04-14 02:50:22.208
7e35743b-0937-44dd-bfd1-3598570e3742	0c379847-8194-4faf-95bc-557eff0ed639	staff	2026-04-14 02:50:22.21
5b68a821-fb86-4ec5-ad50-201949b31433	11fc92de-c1da-4106-90b8-f6292c9b2b2e	staff	2026-04-14 02:50:22.211
115c0f54-559e-4563-84fa-87d9764615f5	47bacb6b-5ee9-4983-b2bf-a0970bd52f78	staff	2026-04-14 02:50:22.213
53bd2782-e0cb-4172-9a08-5f15cad6c873	368b9376-4114-4998-9f75-2e9e2f76b037	staff	2026-04-14 02:50:22.216
03482492-9bf8-4b43-a78d-6f49d2b44ec2	bdec744a-d9c2-49d2-bfac-72ec4c9f14a9	staff	2026-04-14 02:50:22.218
68809275-e1fb-4f01-b09c-2326c9b54416	229c1108-7fa8-41e7-9b4c-822c52531881	staff	2026-04-14 02:50:22.22
499a0e9c-595d-4c57-a489-9f8726366e24	6e9a9fc1-e5e8-45cc-be1b-7696314528cf	staff	2026-04-14 02:50:22.222
6e69b612-1c3a-4989-9dc6-c4543645dbab	47d6cb9d-adda-4536-bb58-5c7d834a2a78	staff	2026-04-14 02:50:22.224
44737977-83c3-4689-84f1-cf5356c606ff	b8687a19-2ae2-4f20-a3cb-4858f43cd410	staff	2026-04-14 02:50:22.226
a15256f9-d494-48d1-944f-d0d844f1de5e	bee2fc0d-bf5f-4fee-b7f9-5a8f3a6cc2d8	staff	2026-04-14 02:50:22.228
caed18f3-1e9c-492d-ad92-f5e82dc65307	cb0701a3-1cfe-4951-862b-4e686809c0db	staff	2026-04-14 02:50:22.229
ab1091e8-1c11-4e6e-967b-713fcc77316d	05f5b88f-068d-47a0-bb2e-76eebcf24568	staff	2026-04-14 02:50:22.231
50e167b5-0ff5-4098-b2a4-d100e9a8b5c2	799ffc90-fb7c-4c87-bb44-41ac39c6ac6d	staff	2026-04-14 02:50:22.233
7e44af0b-9ef5-4525-88d2-bc8582e17ff5	9cf78649-f0f3-4bc2-8e68-b61554427284	staff	2026-04-14 02:50:22.235
706b1462-6b72-490e-8770-31fc3ce83d59	3892d0b0-8207-4515-b6e3-bd290339e64f	staff	2026-04-14 02:50:22.237
9368d215-d805-48e2-b41e-20c9956c573a	d5e8d615-a464-4a66-acc7-8cff2bdbb9c8	staff	2026-04-14 02:50:22.239
9ce2bad4-e883-4f43-86a2-42a1815fe9e3	4d989caf-0c51-4aa2-8adb-9f2e82db44c7	staff	2026-04-14 02:50:22.241
c8b7f52a-c8a3-4eae-87bc-fb32f987f8d1	86a62869-cf7a-4b8a-a3f9-bc89561ba4f0	staff	2026-04-14 02:50:22.243
ed253c3e-533a-4f0a-823c-3210fa5c88f4	fdbc07a2-54c1-412c-ac6d-7de2ffbccdd4	staff	2026-04-14 02:50:22.245
254e17ac-f18e-4e29-ba52-0109f72959af	bd4cdfae-c2b4-4f04-a5a2-2a145d610246	staff	2026-04-14 02:50:22.246
481a47fc-32df-406f-a8f1-c64e3e34ee4b	ec7e3e81-c490-4412-9d67-12344ff1be83	staff	2026-04-14 02:50:22.248
4d44c1f2-bc08-426b-b1a6-dd13ad1f5dcd	6d785c33-3b65-4626-b0ca-2ecc65b8255f	staff	2026-04-14 02:50:22.249
aedd1d25-cd41-4ea2-97f0-549418ce1cc1	61b67dc4-ac5e-482e-a6a8-ed8161d4def4	staff	2026-04-14 02:50:22.251
ef0de0fa-cab5-4c5d-9ce8-e45c34904a6b	ce344394-f0a1-4db1-9ac3-42a204561f48	staff	2026-04-14 02:50:22.254
cbceae50-a6f2-4004-944c-62e6c091fcb8	d722e728-4d7f-4793-a20a-3e8b9b2d16e6	staff	2026-04-14 02:50:22.255
63fb3085-ffd5-4eb9-aff7-1aaf7d84d01c	db47af38-15f6-44bd-9c60-706f866b583d	staff	2026-04-14 02:50:22.257
b0f24110-fe5a-4ba8-8a14-e1c30adb57cd	d0906acd-2368-4121-8c39-19cd7c51798d	staff	2026-04-14 02:50:22.259
52b54cc8-a14d-4245-b3f0-f62595d14848	1a36a031-b90d-4e54-bfda-22688ac96079	staff	2026-04-14 02:50:22.261
ff79b602-9435-43ff-b1f6-e6325ed59651	2bcf6b44-094d-4b84-be3e-677676ab67ed	staff	2026-04-14 02:50:22.262
d24cbb0b-f9b2-4411-8b0a-7c9ae3c942a0	efd686be-cab6-4185-8341-da6ad52a797e	staff	2026-04-14 02:50:22.264
f8b25237-12fc-493c-988a-1138382856be	2888756b-2773-4018-af4b-c7daaa991008	staff	2026-04-14 02:50:22.266
b57e2b2a-95f1-46de-ae11-ca87dfbc35e0	e2188878-8264-4b9a-bea2-ca8fae397dae	staff	2026-04-14 02:50:22.268
55c06074-1f67-45b6-919d-adfc80b7fbda	def36142-38ec-479c-9870-3225aafef955	staff	2026-04-14 02:50:22.27
55558ae1-315e-406b-abe3-06184833cd10	683c7d83-1e6f-455f-8c3a-9c60a3aa1fdc	staff	2026-04-14 02:50:22.272
ae1e766e-932d-43c1-8054-72bc84f199af	8c036bb3-b7cc-4a69-9caf-0188b24dbab3	staff	2026-04-14 02:50:22.274
1a3e1230-eec6-44ba-bd65-f7357c694700	82fa6ad4-dca3-4fac-86b3-1b22c00466da	staff	2026-04-14 02:50:22.276
0850860f-4ee0-4d34-a879-285302459323	21a485b2-63bd-4d58-81c0-78727a02b326	staff	2026-04-14 02:50:22.279
640a8c70-290a-46bb-945a-6989c2d057a4	2c2f4466-7c77-4d0a-9b99-a053e4ae54b4	staff	2026-04-14 02:50:22.286
87787853-4089-46d1-a7ff-26c7a0eb8748	b330eb7b-39f9-4437-b8cf-941baf446912	manager	2026-04-14 02:50:22.288
11a1db42-bebf-4254-9042-523d1e199139	b330eb7b-39f9-4437-b8cf-941baf446912	staff	2026-04-14 02:50:22.289
4ba560cf-ff81-4df8-8bb5-84d90d194cd2	81c25e80-0160-4a62-a040-42af0f1e8861	staff	2026-04-14 02:50:22.291
90faf31d-b2fb-4a2a-a6dc-cee522878a41	866643e3-512d-401c-8434-9be45cc8a75e	staff	2026-04-14 02:50:22.293
3a9dde4b-7777-4bd2-82ea-ae7768bfcb06	2f5c157b-ead6-446e-9faf-1206f171031e	staff	2026-04-14 02:50:22.296
d4594d32-856a-4160-87b2-00e02d669552	1b82c6ed-070a-4720-9571-6aeb58779610	staff	2026-04-14 02:50:22.298
a9392884-5f82-476a-beeb-7776cfad6abe	bfed3a90-278e-4ef8-89f8-eef0a622e4c6	staff	2026-04-14 02:50:22.3
18efc225-beee-46a2-814a-6a4841bd4f14	e22e93f5-a4ac-4710-9262-f1cf965e2080	staff	2026-04-14 02:50:22.303
e4d789fd-9b63-4109-885c-652d008424de	188674e7-6862-4bd4-a435-049e508fecf8	staff	2026-04-14 02:50:22.305
56e2e1cb-04f4-4e87-9376-85f83d02d8c5	56bf86c0-a849-43d5-804e-c0187a80d8e7	staff	2026-04-14 02:50:22.307
f636acac-0a29-4b9a-9127-223f0dda4b3f	e484eecd-3345-4747-8b1b-21b4c3cd22c8	staff	2026-04-14 02:50:22.309
3bae95c7-495f-43d5-9dbf-b1c1cdaccba5	ffff5638-835a-484f-8bc6-3d51dbae14e0	staff	2026-04-14 02:50:22.311
442d49d4-46ed-400d-8c39-08d01b8003f6	b1658138-9042-483b-9d79-978964fad136	staff	2026-04-14 02:50:22.312
65c9c7e2-2977-4136-8086-5bf50c2963b4	a7278145-4ec8-40d6-8f7d-368d6e46e489	staff	2026-04-14 02:50:22.314
99a28f72-2907-4e05-bc1e-9aad7d73db86	05106ce3-3b5c-4f45-adb6-16ab8a56fdce	manager	2026-04-14 09:57:48.26
5d2ef996-f750-4987-be2d-72b20512eaff	20fbef18-25ac-4fde-9cd0-3a58281dae26	manager	2026-04-14 09:57:57.525
26b089f7-7c04-4f29-bbba-e2351ff1c98c	e9e07777-3d29-44d0-afa3-70f8441b4074	manager	2026-04-14 09:58:10.699
08e48c04-ffea-4fa1-9c73-156cb4901f30	e9e07777-3d29-44d0-afa3-70f8441b4074	admin	2026-04-14 09:58:10.7
fdcc03e5-6b64-458b-b6c6-eb91bf122ad3	07dcbcf9-d40d-4540-bd36-affa5e74b5f6	manager	2026-04-14 09:58:23.266
cff85c76-923d-46c4-944d-5e0e64bcd4b3	07dcbcf9-d40d-4540-bd36-affa5e74b5f6	director	2026-04-14 09:58:23.268
455fd00b-3998-4b9e-bfed-0b6ebab16fdc	5084b3b5-2721-4816-9539-09292bb84291	manager	2026-04-14 09:58:39.652
17b57311-8d30-4b3e-b4bc-2877841cdf3b	9d3aa0d1-7f11-464b-8895-aa31ff8bf7d2	manager	2026-04-14 09:58:51.733
bbf6d6eb-66b9-41ce-8540-fffd7b693a54	619fd9ac-d0a2-42e1-9523-aca6e352f8eb	manager	2026-04-14 09:59:01.875
b3c291ff-d0e1-45bf-9376-62b5be738db9	cd87e32b-d278-468d-8c79-f67579131a0c	manager	2026-04-14 09:59:12.34
bf1e09f8-648c-489e-a7a8-412a0830cb2b	ecfbde16-5fbc-450b-af22-e6dcb0b86c13	manager	2026-04-14 09:59:24.876
156cece1-a3b3-4649-b4f1-3c3c857f9e20	4ca6fa4e-8238-43fc-b8ad-a5e2c2a52ec8	manager	2026-04-14 09:59:39.967
c6d6ddce-e718-48b4-aaa2-2d63a3190e13	ab32b306-669a-4c6b-ab39-0e625eae5749	staff	2026-04-15 04:40:30.725
8f9fc49e-506e-4a51-8059-6c7729164638	95d96540-3471-4aa7-97c0-6514e53ee2df	staff	2026-04-15 04:40:30.736
cae765d9-7674-4e89-8077-cdfdf91c6c54	6eb5d203-25eb-4607-9707-ec59e5f7ec13	staff	2026-04-15 04:40:30.741
34d9fd30-ddc1-491d-a384-59b51308d024	0a73da10-2740-4a46-8086-fde9dd29d80c	staff	2026-04-15 04:40:30.779
e4ab628a-514e-4d10-be53-7828a6936d5e	f232abc1-86d2-460b-9307-d5b88f40bcd7	staff	2026-04-15 04:40:30.783
0c42fe8b-3bf9-4b62-8055-f95939299ffd	3fb37a57-99e6-459d-b0bb-a0f5df6b0567	staff	2026-04-15 04:40:30.789
77909f24-abc8-4717-a915-f684af8d76b2	93b8c2e7-d572-4a06-b36e-20706dbfc1fa	staff	2026-04-15 04:40:30.792
5e39a81b-28b9-405b-9239-d6df8de21dc8	a8622742-0637-403c-b912-279e364a4739	staff	2026-04-15 04:40:30.795
d2e4087c-78b6-4a6c-942b-ff674af5ef95	9deac837-7f72-49b9-8580-c49b7bc92ffa	staff	2026-04-15 04:40:30.803
acb883e6-518f-442e-92b7-2b935a7531b6	0b033927-3108-42dd-9b2e-2fa2ebbd9da3	staff	2026-04-15 04:40:30.845
a312dabc-5c3e-4154-8cc6-9b66f962f02a	01f9b0b2-1de9-4e90-9221-9276e121b3f1	staff	2026-04-15 04:40:30.878
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: proofpoint
--

COPY public.users (id, email, password_hash, email_verified, status, created_at, updated_at, "directorId") FROM stdin;
6bb89ed2-9ad8-4429-baee-d27d9a408a3b	abdullah@millennia21.id	$2b$10$2YoDDTZhCrO3jmgNmzs2XOh3rht91AuSLJ2.ONcjkg/nPcD6XDW2S	f	active	2026-04-09 06:35:37.591	2026-04-09 06:35:37.591	\N
090799d9-3284-44e9-96e6-0746157aebe9	abu@millennia21.id	$2b$10$kqu1S2ymvvUnMmavLiPs..C2b0p9E1MpDOtQrjgGmQGHouot7p9cu	f	active	2026-04-09 06:35:37.652	2026-04-09 06:35:37.652	\N
6a97d369-734f-4459-9fad-5c273f5aa608	adibah.hana@millennia21.id	$2b$10$NpY5UA3taGg3WtF.XPemc.xMkoJ21y4nlyRdf.j5mHBrjmAgq5Fem	f	active	2026-04-09 06:35:37.709	2026-04-09 06:35:37.709	\N
d4bce7ff-4ce6-4e81-9a4a-3559b3fff42a	adiya.herisa@millennia21.id	$2b$10$oebukaFeYFrXOOUpp6iBWOWjVkOdPld8SW1D2A.S9A6Y5IBxdc9WO	f	active	2026-04-09 06:35:37.766	2026-04-09 06:35:37.766	\N
c19228fb-9ec9-470c-b356-1ab0f0244657	afiyanti.hardiansari@millennia21.id	$2b$10$RRwaP7m8jffaN54FhdJf1O5TLP7aebn8DWMUCDJ/XWrUH1sBRFKsq	f	active	2026-04-09 06:35:37.823	2026-04-09 06:35:37.823	\N
4d3f98f6-5f37-4db8-94d4-488d74fa8053	dhaffa@millennia21.id	$2b$10$b7mF5ZfpOTYax4Uua2kEr.GgDAKnw79AmwEtitUDmHFx6SILEjgs2	f	active	2026-04-09 06:35:37.937	2026-04-09 06:35:37.937	\N
5228b29e-4864-4d0d-80c5-55616cc691f4	almia@millennia21.id	$2b$10$MR.r/WFE2lrx/l5hJWbSFe4e8DICPCzEjUQIeThL/9gjBw7FbVILq	f	active	2026-04-09 06:35:37.993	2026-04-09 06:35:37.993	\N
9b329146-dce2-4dc6-9b30-dc342ee448e0	andre@millennia21.id	$2b$10$/ql1ULpHvEhhCAkiS4CCXOBDYeL5g.lS0wzV6R0KU/2MO9KPvhZJK	f	active	2026-04-09 06:35:38.049	2026-04-09 06:35:38.049	\N
a8de5a0a-9bbb-4bbd-a1b9-a69e55a23112	anggie@millennia21.id	$2b$10$LLJVq1uabWMYdkFiWbkYoeQ7GbinLYq18STAVgKuBd1J0B7sKcdqO	f	active	2026-04-09 06:35:38.106	2026-04-09 06:35:38.106	\N
fb04f59d-9839-4e56-a51d-b248ab7c4a5c	annisa@millennia21.id	$2b$10$On5DHlpV4smRjC1O//aRVumeU1VosX2EgC/D02BGlUqBnAJrrzLka	f	active	2026-04-09 06:35:38.162	2026-04-09 06:35:38.162	\N
e952dc49-c4d7-4e55-bf09-af23b6f8acb3	ardiansyah@millennia21.id	$2b$10$Ndzh2Ye5cNics1PTDENqa.cxSibObcFXs.PtcWzZIJpTcxaPy.l7W	f	active	2026-04-09 06:35:38.219	2026-04-09 06:35:38.219	\N
05106ce3-3b5c-4f45-adb6-16ab8a56fdce	aria@millennia21.id	$2b$10$QXoqddf1hpgNBPTNYu9uLu1bJHARBt7WbBQHDj1oyGGpGKU08iEnK	f	active	2026-04-09 06:35:38.331	2026-04-09 06:35:38.331	\N
4f45c8e6-e714-4dd6-a5dd-661e2bf027a2	alinsuwisto@millennia21.id	$2b$10$ORkOuQH./BKZQU/gBYwE..OifJxQvkka1/mGR8a0T.HbqsIuX.i52	f	active	2026-04-09 06:35:38.386	2026-04-09 06:35:38.386	\N
60d1e094-0600-4d90-a5fd-d91603767074	aprimaputri@millennia21.id	$2b$10$7RZ7zdCBQztw8xMjA6ICDOCcssZJEKd.GjC7bIbjY.h8ysaR14uKy	f	active	2026-04-09 06:35:38.445	2026-04-09 06:35:38.445	\N
d73bbdb7-9871-4926-b52e-884286eb696b	wina@millennia21.id	$2b$10$7QnYz5nixcTUzLGT0GPWDeJFWJeLUcti/gHf0bUhvZ70bpZWey.Ci	f	active	2026-04-09 06:35:38.503	2026-04-09 06:35:38.503	\N
d1019254-c453-4ec2-9d69-2707e935d4ca	belakartika@millennia21.id	$2b$10$4/enShaOTQ.3nkeod5D/ZuDKespy/Jo7vHD3zKwR8WY1gIUzZrcTG	f	active	2026-04-09 06:35:38.559	2026-04-09 06:35:38.559	\N
a8e7a287-8dca-4aff-9db6-bc1a83d0255d	nana@millennia21.id	$2b$10$T1ptrHDmglxtNEDiO5V4SuyYPz2n1/d4k/lwAuPaK7LfSLyWznLFm	f	active	2026-04-09 06:35:38.615	2026-04-09 06:35:38.615	\N
c2ab6e9e-f96b-483e-9f9f-445c5ecf14d0	chaca@millennia21.id	$2b$10$AqHWSCEP1ySUmgEflhgBzeWgFbeLY6dIG7q1oQARHJtVRpXeN7CRy	f	active	2026-04-09 06:35:38.672	2026-04-09 06:35:38.672	\N
00b87ee1-2bb8-4193-b9a8-24178b9b220f	danu@millennia21.id	$2b$10$xJBREfZeoFNU3WsD7kRSAOYO.CmvGYXEG3SiYVCg45F3JDYS3QttO	f	active	2026-04-09 06:35:38.729	2026-04-09 06:35:38.729	\N
d467ea9f-5237-4cc2-8830-09272a4857ae	denis@millennia21.id	$2b$10$Ps.X9dF8nJ4H3iT049JmiehrYlMwxVkEk0kHSi3b54Mv5QWS0REdG	f	active	2026-04-09 06:35:38.785	2026-04-09 06:35:38.785	\N
109f7ff6-ea68-49f1-9ddd-b0f67d28b57b	derry@millennia21.id	$2b$10$cbY36n2xrsQx8lgdbvdJfeF9b1rRgx.j.yPOgjs5xLGJSXymRsweK	f	active	2026-04-09 06:35:38.842	2026-04-09 06:35:38.842	\N
de62bdaa-613e-43cf-bd76-59c8bb6f6192	devi.agriani@millennia21.id	$2b$10$a7D7NImPYW6ZNb.Zf59j1uaLEczez/jmM3JVfwvmLjZitKm7h8foO	f	active	2026-04-09 06:35:38.9	2026-04-09 06:35:38.9	\N
5a507f9e-941f-4f1b-9823-f97459a877cc	devilarasati@millennia21.id	$2b$10$vun2zm17F7/9KW5zi4I.1ua9XaNTdvIqmeJvfi3OzhBNCD4gxiSF2	f	active	2026-04-09 06:35:38.956	2026-04-09 06:35:38.956	\N
8045b950-7f2e-4858-9d19-d5998973d11f	dien@millennia21.id	$2b$10$cxj.E2uIUWc/C5XD1Pixyuxe0e3NS9RNu0niEqy4sEBaKZ/51hXe6	f	active	2026-04-09 06:35:39.013	2026-04-09 06:35:39.013	\N
4a36d15f-3de1-4bde-829d-fd8453bd8a17	dina@millennia21.id	$2b$10$jB/CEYtvnt00FNjhjt5ptuJdKiwJl9Frg.wSU.0PnrKDAbhMrnjQe	f	active	2026-04-09 06:35:39.07	2026-04-09 06:35:39.07	\N
4d52ea14-c52d-421d-91b0-38fbb5182c0c	dinimeilani@millennia21.id	$2b$10$1H3NZrPajcTP1XBbf3.YW.YNWH4RS0A/XWHLodp82dnNRI8jXlYb2	f	active	2026-04-09 06:35:39.126	2026-04-09 06:35:39.126	\N
779a9ce2-5995-4d16-adb4-f8766caea427	diya@millennia21.id	$2b$10$4c/38h664/UR.yDwJtQOk.wUbmQED9aWXNQIOYhnZ.PRfIi.7Ba.K	f	active	2026-04-09 06:35:39.181	2026-04-09 06:35:39.181	\N
bc787a21-afd3-4c43-bc68-8a4888a96728	dona@millennia21.id	$2b$10$S/I4pQ27wbSlJQmH3Upr8Oy/cqUxxa6dSAjXdmxCrapbfua.chGTK	f	active	2026-04-09 06:35:39.237	2026-04-09 06:35:39.237	\N
e3574f0f-e2da-4fea-b97f-0a9a09d81a78	akbarfadholi98@millennia21.id	$2b$10$O.Oz7dElUssor/JQrOYBVO578k92T67n9sAneroxeoyJyALzaoiuW	f	active	2026-04-09 06:35:39.294	2026-04-09 06:35:39.294	\N
a147b294-1332-4f34-a7ac-d1959f6f193d	fasa@millennia21.id	$2b$10$dZXT46nIfvzxLrak6y1FUe1YaEfwuWmepmf9q4edYN482DP/bAm.K	f	active	2026-04-09 06:35:39.406	2026-04-09 06:35:39.406	\N
ebb7d23d-b97a-4311-a0f8-266ceb0190b7	aya@millennia21.id	$2b$10$FtXkXghRJdADT5GGzdfL8OxZhHngke4kdHkPhiOc9AvlIQn5MS/cS	f	active	2026-04-09 06:35:39.462	2026-04-09 06:35:39.462	\N
5a27ff4d-dd48-4ad5-a494-38a9d484d4d5	jo@millennia21.id	$2b$10$Fl14EXr7kLIFeCIT.qfAJO2y9rk//lOYX3d4NbGzjV8YIW2fIqc0S	f	active	2026-04-09 06:35:39.517	2026-04-09 06:35:39.517	\N
eb2d599d-09ef-4b03-a491-a28737f3c8a7	ferlyna.balqis@millennia21.id	$2b$10$qCBNbXZRtptW4wd43CNQQOeM8zRh6Wxyrn2yQAMSw4eEYSNH3iNbG	f	active	2026-04-09 06:35:39.573	2026-04-09 06:35:39.573	\N
ecf0cb46-149c-4a68-be1f-27d5b44f0faf	fransiskaeva@millennia21.id	$2b$10$WIaiCUJvEFgGk09vvswYvud8Q5CZZB7mSpDGV3Ab21ab5R44pU7j6	f	active	2026-04-09 06:35:39.629	2026-04-09 06:35:39.629	\N
b84d8031-e053-4c50-9228-827d0602cbc4	galen@millennia21.id	$2b$10$nI1Cdt1B.wSHFHQLUMIOseMz1zFoz/DTR5ZpUYQy9RZDDMwptfdWO	f	active	2026-04-09 06:35:39.686	2026-04-09 06:35:39.686	\N
fc29bcce-a56e-490f-b485-bf16d491f885	gebby@millennia21.id	$2b$10$ap.eEHB1.Hds/Xc1Zw6qe.dDfhCuWrO6Q.jNNvG7UTrAxGiO1cyha	f	active	2026-04-09 06:35:39.742	2026-04-09 06:35:39.742	\N
c65ccd20-7803-43dd-b5bc-c52b09354947	gundah@millennia21.id	$2b$10$4AkEFWUeJfJVqP4B7oimpe3jNsWZo93zZnRlX567mcHkqWn/.i7CS	f	active	2026-04-09 06:35:39.799	2026-04-09 06:35:39.799	\N
abd35657-a575-4b80-918b-136bb88179d4	hadi@millennia21.id	$2b$10$UrjWbDHEGeJJgkt4aK3aDuuZ.y9vdsXKrkXz5SLltrSqoXqThtfZu	f	active	2026-04-09 06:35:39.854	2026-04-09 06:35:39.854	\N
ecfbde16-5fbc-450b-af22-e6dcb0b86c13	hana.fajria@millennia21.id	$2b$10$z08mT5UdLzEofMVe.KPeb.jE1huExE.XhQncUdzMuNdLWYPuJXMu.	f	active	2026-04-09 06:35:39.91	2026-04-09 06:35:39.91	\N
c612a974-799c-4374-9410-43fa1b270ecc	himawan@millennia21.id	$2b$10$TQQ0L/cYiNDk.UF5MitfnOErFe5CbhgpobhLFYPGZq/rfhwMMHrPa	f	active	2026-04-09 06:35:39.966	2026-04-09 06:35:39.966	\N
73e65845-a426-47ba-b1fe-a1e293c9e17e	ian.ahmad@millennia21.id	$2b$10$o2T07heKOOkTOA2.XxLAr.nOeo76LiN/nObahMY3vmfIhl3ahqvBu	f	active	2026-04-09 06:35:40.021	2026-04-09 06:35:40.021	\N
9e047de7-b7d3-443e-88e9-07b6c93339d7	iis@millennia21.id	$2b$10$dtclJDgTde73dMmhDksDf..5NAPjDjlFWSfwlYjoHtdWsfQIfJcKe	f	active	2026-04-09 06:35:40.076	2026-04-09 06:35:40.076	\N
26e4d891-daac-43d9-a35f-1ed0b31d3652	ikarahayu@millennia21.id	$2b$10$tQ8wwEwsVZtfcQPBVMyyn.cJp44jgLEHySj7LmpQlWgmrnvnCbi8y	f	active	2026-04-09 06:35:40.132	2026-04-09 06:35:40.132	\N
cb9d8ae3-7991-4c92-bddc-af5ce4d6a0d0	ari.wibowo@millennia21.id	$2b$10$2FGC0C1Y6J9SF9jGH6I7LOD4Z5Gf3HeAum5DBhKFRO3ODxVi95Ube	f	active	2026-04-09 06:35:38.275	2026-04-09 13:42:44.334	\N
e9e07777-3d29-44d0-afa3-70f8441b4074	faisal@millennia21.id	$2b$10$v3tlktEhhZllFiFsrUttce2jHBMDTtUoqqxy5s.TnIL49.8fbwdX6	f	active	2026-04-09 06:35:39.351	2026-04-14 09:58:10.696	\N
f660374c-0d0f-44b0-91af-c4e888cae7b1	irawan@millennia21.id	$2b$10$GD52Yvoobzj2gbzIhvsKw.bz3J2roHYWnMnNDB1nNKEDm9/sepojC	f	active	2026-04-09 06:35:40.188	2026-04-09 06:35:40.188	\N
bab72814-1cbe-4693-ac3c-bb7fd65d4b70	khairul@millennia21.id	$2b$10$16b5D/QpsSor.semHdV21Om4CJqUZzB5fyuOBNC9mKSgLzb3GY3Ii	f	active	2026-04-09 06:35:40.245	2026-04-09 06:35:40.245	\N
cd87e32b-d278-468d-8c79-f67579131a0c	kholida@millennia21.id	$2b$10$kcGnkoiiFqs6g9FGKInKOOddYWx2YYau//fqhyg4OfS..tMthqT7e	f	active	2026-04-09 06:35:40.301	2026-04-09 06:35:40.301	\N
ad102766-5f46-45e4-bbdc-e1b981ded3af	alys@millennia21.id	$2b$10$oZ9dHmqO80zrHYLGX4Z/ku01VglZY/Sg643PBYmaRC7LzEGkReR7O	f	active	2026-04-09 06:35:40.356	2026-04-09 06:35:40.356	\N
d31eb59d-daf5-4c80-9fe2-6e9e5cdc8504	sandi@millennia21.id	$2b$10$ByyTq3IrFVd6FIkmQBD6j.sMirLT0r0H2isLeaxS6pi7bxzPyidMS	f	active	2026-04-09 06:35:40.412	2026-04-09 06:35:40.412	\N
619fd9ac-d0a2-42e1-9523-aca6e352f8eb	latifah@millennia21.id	$2b$10$PnOeNafMjKwA3Xk6AzeqGeShAfGOtgBfURmJ6XOJaAl46GPtovH4a	f	active	2026-04-09 06:35:40.467	2026-04-09 06:35:40.467	\N
5923371b-a16d-4e2c-9c96-d22c0b1916f3	maria@millennia21.id	$2b$10$UM0D.d96TkpwX.mnEmxy.uR1vnlw/pu7Jy1nwHe8OhMtP6WHJRZtO	f	active	2026-04-09 06:35:40.577	2026-04-09 06:35:40.577	\N
54d39ace-0692-4c99-b56d-abfd670a3a83	maulida.yunita@millennia21.id	$2b$10$UjKc.mRAmDG6oeAXHqc0HuHjOIo59WgRirGKFuILGxNFHYJMSHTce	f	active	2026-04-09 06:35:40.633	2026-04-09 06:35:40.633	\N
6a670aae-4dae-451c-ab28-75b81b225d62	muhammad.farhan@millennia21.id	$2b$10$Qs9UQOOFmJ4./AKyWh4Ht.96TDL7Srw.KRtmq9KJ/WGqhKM3ugfgG	f	active	2026-04-09 06:35:40.688	2026-04-09 06:35:40.688	\N
0c379847-8194-4faf-95bc-557eff0ed639	fathan.qalbi@millennia21.id	$2b$10$pskGf4M7ud6NZRxjesKIGOEEZzr88jMCZfHbhK0YN4Ovgk5zW67zK	f	active	2026-04-09 06:35:40.744	2026-04-09 06:35:40.744	\N
11fc92de-c1da-4106-90b8-f6292c9b2b2e	awal@millennia21.id	$2b$10$0fv4OPi.ptIB3YsXS55dvu/4ugwjQw91xrCH8cb8Cfw0WAzLJ21Py	f	active	2026-04-09 06:35:40.8	2026-04-09 06:35:40.8	\N
47bacb6b-5ee9-4983-b2bf-a0970bd52f78	ananta@millennia21.id	$2b$10$by9eiNs7Wdntd2N9ihfqZul.byspWAAKLGzxqBBF8Vn0U4cHumW3K	f	active	2026-04-09 06:35:40.856	2026-04-09 06:35:40.856	\N
368b9376-4114-4998-9f75-2e9e2f76b037	mukron@millennia21.id	$2b$10$FYHfxM0pPg0VA9KM5QhVR.MLwHuvMsMBIW46k5.vGhpyMtjU.MWL6	f	active	2026-04-09 06:35:40.913	2026-04-09 06:35:40.913	\N
bdec744a-d9c2-49d2-bfac-72ec4c9f14a9	nadiamws@millennia21.id	$2b$10$CsiUWi7GeHSPkE3QbgS.DObO8oToQs1PcH58Pf/JVw0A.IPD8uFFK	f	active	2026-04-09 06:35:40.969	2026-04-09 06:35:40.969	\N
229c1108-7fa8-41e7-9b4c-822c52531881	sisil@millennia21.id	$2b$10$pUKcJvt4xs/d/2jJW0IOVuaOLhdIooVn5a65OiKqgmmUVhrK6tzWu	f	active	2026-04-09 06:35:41.026	2026-04-09 06:35:41.026	\N
6e9a9fc1-e5e8-45cc-be1b-7696314528cf	nanda@millennia21.id	$2b$10$xN02BBmLznVBDyX81UBur.UrQn4mrhkXTUiUeoP.Iu8Wr8IEfhhiu	f	active	2026-04-09 06:35:41.082	2026-04-09 06:35:41.082	\N
47d6cb9d-adda-4536-bb58-5c7d834a2a78	nathasya@millennia21.id	$2b$10$zvy7Gd9I2E6L1p6tgsDbFOna6eEE/.OEHxOY4PA6ymxdMFCyl3LPm	f	active	2026-04-09 06:35:41.138	2026-04-09 06:35:41.138	\N
b8687a19-2ae2-4f20-a3cb-4858f43cd410	nayandra@millennia21.id	$2b$10$IesocGEH2P6dvfX8vXJEZe2cMi/f8GQNWTntCnmlBaZJbkczU1Q4e	f	active	2026-04-09 06:35:41.194	2026-04-09 06:35:41.194	\N
bee2fc0d-bf5f-4fee-b7f9-5a8f3a6cc2d8	kusumawantari@millennia21.id	$2b$10$T7uJ91GXjy99beMWfmiVmuVzO44muUNzu7gaL0aCGiVXOsSideMC6	f	active	2026-04-09 06:35:41.252	2026-04-09 06:35:41.252	\N
cb0701a3-1cfe-4951-862b-4e686809c0db	made@millennia21.id	$2b$10$YI0VjwO7s3Kxl1mJEIBq.uwl5KVvdAQK7y2b1tyis4mY0lNdbS/TC	f	active	2026-04-09 06:35:41.31	2026-04-09 06:35:41.31	\N
05f5b88f-068d-47a0-bb2e-76eebcf24568	novan@millennia21.id	$2b$10$ZJm1jMsoosog.pMKhQL1fOCY87P4uTJWqFPERRCCZo93pYIxlx.i2	f	active	2026-04-09 06:35:41.367	2026-04-09 06:35:41.367	\N
799ffc90-fb7c-4c87-bb44-41ac39c6ac6d	novia@millennia21.id	$2b$10$A5PgX9a1WIrWHvHo0rSMvedvMvapyRNEgyyygw3Y2sHSmK6yeIXfa	f	active	2026-04-09 06:35:41.424	2026-04-09 06:35:41.424	\N
9cf78649-f0f3-4bc2-8e68-b61554427284	ismail@millennia21.id	$2b$10$kKnZw78sB.LJ8Ji/aLFCMOFz82EN9vRjC0QUhpBLvOJI3IkODWhsm	f	active	2026-04-09 06:35:41.481	2026-04-09 06:35:41.481	\N
3892d0b0-8207-4515-b6e3-bd290339e64f	widya@millennia21.id	$2b$10$9ggY34VpWetnh9BpdJtEyeCu8NXwC8xe0KphRaxsjYqSr10TLUXc2	f	active	2026-04-09 06:35:41.539	2026-04-09 06:35:41.539	\N
d5e8d615-a464-4a66-acc7-8cff2bdbb9c8	pipiet@millennia21.id	$2b$10$yxOVyI8vHgWP3iiZ77amqui0WD635gxEscvHGmhoGGvtNI/0P7Gzy	f	active	2026-04-09 06:35:41.595	2026-04-09 06:35:41.595	\N
4d989caf-0c51-4aa2-8adb-9f2e82db44c7	cecil@millennia21.id	$2b$10$aV3exkQDyUayygpuN3mQ/Osmn/HbcEk8b7wtT9cuaw2RFCQ3xxYFO	f	active	2026-04-09 06:35:41.651	2026-04-09 06:35:41.651	\N
86a62869-cf7a-4b8a-a3f9-bc89561ba4f0	prisy@millennia21.id	$2b$10$znGO8npimGoDtLflPeuzrOoEu5F4hOFib18PQHynJleZ4d.oQp8oG	f	active	2026-04-09 06:35:41.706	2026-04-09 06:35:41.706	\N
fdbc07a2-54c1-412c-ac6d-7de2ffbccdd4	putri.fitriyani@millennia21.id	$2b$10$64QO.H4Fr8cfoRBLzCVby.8x2UT9y35gz3t2b6YqwUgusCyHlCJ6.	f	active	2026-04-09 06:35:41.762	2026-04-09 06:35:41.762	\N
bd4cdfae-c2b4-4f04-a5a2-2a145d610246	radit@millennia21.id	$2b$10$fjvlMKurHa65Y.9rYUfG2.BV/xBkWqZxXlxbCpmR8yUgc84MfJjz.	f	active	2026-04-09 06:35:41.819	2026-04-09 06:35:41.819	\N
ec7e3e81-c490-4412-9d67-12344ff1be83	raisa@millennia21.id	$2b$10$zCfNBWjTxV5qSAtB5wH2QOGqLt1LBEd/j7UgvpTOpKAg46yq8CR8a	f	active	2026-04-09 06:35:41.874	2026-04-09 06:35:41.874	\N
6d785c33-3b65-4626-b0ca-2ecc65b8255f	ratna@millennia21.id	$2b$10$Sq2GtSz6o3Ou2juQAhgrAu7wiLXfTldzhf0bpGEUYDIars0gzfmr6	f	active	2026-04-09 06:35:41.93	2026-04-09 06:35:41.93	\N
61b67dc4-ac5e-482e-a6a8-ed8161d4def4	restia.widiasari@millennia21.id	$2b$10$GdmN9Effo7LvwCW3mr6/PuBql8UHlRYD0G7e4rH8mjrCoH.gI3DqG	f	active	2026-04-09 06:35:41.986	2026-04-09 06:35:41.986	\N
ce344394-f0a1-4db1-9ac3-42a204561f48	rezarizky@millennia21.id	$2b$10$/e4XLtFv693sRz/ITBqo3.aZQVS9TxPWuhMewHO/MhKitHobkv8bO	f	active	2026-04-09 06:35:42.042	2026-04-09 06:35:42.042	\N
d722e728-4d7f-4793-a20a-3e8b9b2d16e6	rifqi.satria@millennia21.id	$2b$10$ei/wo.gM/Nm/npiF7Dgf3OqpnoaDYRYK7vc.UHW6BUySQovp/dOl.	f	active	2026-04-09 06:35:42.098	2026-04-09 06:35:42.098	\N
db47af38-15f6-44bd-9c60-706f866b583d	rike@millennia21.id	$2b$10$7oi6txSYgZmj0tjtoRRscOzdpizk0Eze5uBklCZYb9np2yWyfel7S	f	active	2026-04-09 06:35:42.154	2026-04-09 06:35:42.154	\N
d0906acd-2368-4121-8c39-19cd7c51798d	risma.angelita@millennia21.id	$2b$10$2cBWN8.PivZShLPfTFyim.RrLGBHOWY2ki0c0/zCGQYVm2RZMz1zG	f	active	2026-04-09 06:35:42.21	2026-04-09 06:35:42.21	\N
1a36a031-b90d-4e54-bfda-22688ac96079	risma.galuh@millennia21.id	$2b$10$G708fr4qDfrVHhMc.9oJJe.OOm/RZqDjcK5/Mziz3uQ0ackyV9hY.	f	active	2026-04-09 06:35:42.266	2026-04-09 06:35:42.266	\N
2bcf6b44-094d-4b84-be3e-677676ab67ed	kiki@millennia21.id	$2b$10$X2Gub3tzd8/HDOuI8r2rIO6ZjuwEhAV10rWlNdajIKkTAMN3avSYy	f	active	2026-04-09 06:35:42.322	2026-04-09 06:35:42.322	\N
efd686be-cab6-4185-8341-da6ad52a797e	rizkinurul@millennia21.id	$2b$10$keb7yOohDgW0nnuid.UfVO.YimK4shNElvOPPWh69eIJbANGCr2WG	f	active	2026-04-09 06:35:42.378	2026-04-09 06:35:42.378	\N
2888756b-2773-4018-af4b-c7daaa991008	robby@millennia21.id	$2b$10$bpcOTJBQK1vZZNWgkw7.Z.Yxbdk2oSGNGsZYWkm6niZe3yoqivzBe	f	active	2026-04-09 06:35:42.434	2026-04-09 06:35:42.434	\N
e2188878-8264-4b9a-bea2-ca8fae397dae	robby.noer@millennia21.id	$2b$10$ATrKo570gez7NvhY/gYige9UXhP1KXOd/8dlMLnGp.BwxSg62hRuu	f	active	2026-04-09 06:35:42.489	2026-04-09 06:35:42.489	\N
def36142-38ec-479c-9870-3225aafef955	robiatul@millennia21.id	$2b$10$KZsza.7Hl5ZyIlqBTiNlWuaSgowKngag6POU73jargraeza/KGDa6	f	active	2026-04-09 06:35:42.546	2026-04-09 06:35:42.546	\N
683c7d83-1e6f-455f-8c3a-9c60a3aa1fdc	rohmatulloh@millennia21.id	$2b$10$2zBOMbKe72cPgbr0LNTchuQSsvxYSJrRqbZLZMs1uAny92DXJjt5e	f	active	2026-04-09 06:35:42.602	2026-04-09 06:35:42.602	\N
8c036bb3-b7cc-4a69-9caf-0188b24dbab3	roma@millennia21.id	$2b$10$93QTIKvYdWC5zRA2WG6/mONVKHof.Tb7LcicGVTdW2fx0lx0dX3Gm	f	active	2026-04-09 06:35:42.657	2026-04-09 06:35:42.657	\N
82fa6ad4-dca3-4fac-86b3-1b22c00466da	salsabiladhiyaussyifa@millennia21.id	$2b$10$NTc3h3d9heZYYjmZJWLqYOwukU.XoQc1r.4b56Y8nrC32yMWSGCs6	f	active	2026-04-09 06:35:42.714	2026-04-09 06:35:42.714	\N
4ca6fa4e-8238-43fc-b8ad-a5e2c2a52ec8	sarahyuliana@millennia21.id	$2b$10$kgDkrG8gisTDqYGsgiktFeEfUQkC5tyKRlfMFXc9X5SOYvaY7FyfC	f	active	2026-04-09 06:35:42.769	2026-04-09 06:35:42.769	\N
21a485b2-63bd-4d58-81c0-78727a02b326	sayed.jilliyan@millennia21.id	$2b$10$kSsLE/3xRmy.9TibeRwh9OVD5vTqOnzDvPZyAe99HEZYwtriGAXEi	f	active	2026-04-09 06:35:42.825	2026-04-09 06:35:42.825	\N
5084b3b5-2721-4816-9539-09292bb84291	rain@millennia21.id	$2b$10$CktEtExTH1nIxJXsaonCL.m964neFb2yFvzGTHTfrVTY4HyQiPxJm	f	active	2026-04-09 06:35:42.882	2026-04-09 06:35:42.882	\N
9d3aa0d1-7f11-464b-8895-aa31ff8bf7d2	susantika@millennia21.id	$2b$10$8EfB1wahyCLxkIE1brZ7S.4skidV8BuJgcofCNZ3LCfL/nM5T/Bkq	f	active	2026-04-09 06:35:42.939	2026-04-09 06:35:42.939	\N
2c2f4466-7c77-4d0a-9b99-a053e4ae54b4	tiastiningrum@millennia21.id	$2b$10$A8kF0cqfCU979Kx7D0lNZOJVsjTjLX2angYAt997Ye7o9buvm4GAm	f	active	2026-04-09 06:35:42.994	2026-04-09 06:35:42.994	\N
b330eb7b-39f9-4437-b8cf-941baf446912	hanny@millennia21.id	$2b$10$5vhkiU23uW4BkWUBpQrjPu7YauDtWJDBBfpNTvKHqUGRR1qQ7P4ha	f	active	2026-04-09 06:35:43.05	2026-04-09 06:35:43.05	\N
81c25e80-0160-4a62-a040-42af0f1e8861	triayulestari@millennia21.id	$2b$10$uZgp8GX006Zfy7JGegNYcu/C8e3AwIeDaxS01SGAx4D/my0RgkAqe	f	active	2026-04-09 06:35:43.106	2026-04-09 06:35:43.106	\N
866643e3-512d-401c-8434-9be45cc8a75e	triafadilla@millennia21.id	$2b$10$BCoML5WeATSF3UgGJ/YZaufVSklT/T0Pq617QUIWrM5QtfBlWmrNm	f	active	2026-04-09 06:35:43.162	2026-04-09 06:35:43.162	\N
2f5c157b-ead6-446e-9faf-1206f171031e	udom@millennia21.id	$2b$10$KC1o5KTM2pc58UnKNOgM0OEA1ETWFTY0ifw358ZMQbGlfoD2/k5/i	f	active	2026-04-09 06:35:43.218	2026-04-09 06:35:43.218	\N
1b82c6ed-070a-4720-9571-6aeb58779610	usep@millennia21.id	$2b$10$utSl8zMFar1XXhFX15He9Oqz0o2u6CzaSMw5M8ibNj2OYPBQKcPxq	f	active	2026-04-09 06:35:43.273	2026-04-09 06:35:43.273	\N
bfed3a90-278e-4ef8-89f8-eef0a622e4c6	vickiaprinando@millennia21.id	$2b$10$NT/shXqZ0nLnUFxCXyCzT.v.F6nPfj91FnBdqgo5d9c6bx9XTUpki	f	active	2026-04-09 06:35:43.33	2026-04-09 06:35:43.33	\N
e22e93f5-a4ac-4710-9262-f1cf965e2080	vinka@millennia21.id	$2b$10$XXb14uZVnGWUIWHX6FPfBubUZvPF8PB7qWkwVy2loONUREhXZsydC	f	active	2026-04-09 06:35:43.386	2026-04-09 06:35:43.386	\N
188674e7-6862-4bd4-a435-049e508fecf8	wahyu@millennia21.id	$2b$10$s9N7uH./RuK2Z.nHrmaiXOBlehFm6K4hcwWHcV9qjh0IzD00fOSzu	f	active	2026-04-09 06:35:43.441	2026-04-09 06:35:43.441	\N
56bf86c0-a849-43d5-804e-c0187a80d8e7	yeti@millennia21.id	$2b$10$4h2Ct1W243h05Lp6msQDS.UZxYHj2DMrzx38Na9EB6DioN.e9CNnu	f	active	2026-04-09 06:35:43.497	2026-04-09 06:35:43.497	\N
e484eecd-3345-4747-8b1b-21b4c3cd22c8	yohana@millennia21.id	$2b$10$kO0Pu0vC4LUmLJU1iTWsveAjB.awRBhy/djp/zCBaGlTXk73OAnRO	f	active	2026-04-09 06:35:43.553	2026-04-09 06:35:43.553	\N
ffff5638-835a-484f-8bc6-3d51dbae14e0	yosafat@millennia21.id	$2b$10$qYwixFXv2IhreWxEpGRjCerqhjGYrGa5CQsSk.pV./qptrg4Tuqji	f	active	2026-04-09 06:35:43.61	2026-04-09 06:35:43.61	\N
b1658138-9042-483b-9d79-978964fad136	oudy@millennia21.id	$2b$10$SuoRiT9arDrWiVMls8NoMuh3ZjUHrC21QGwzMBozjQUm2iqrICPWy	f	active	2026-04-09 06:35:43.666	2026-04-09 06:35:43.666	\N
a7278145-4ec8-40d6-8f7d-368d6e46e489	zolla@millennia21.id	$2b$10$IT5/IEBNY3Q.NYHX4m9jI.x1ZC3/TrUNAMh3IW71Fqit6DZWgoHxi	f	active	2026-04-09 06:35:43.721	2026-04-09 06:35:43.721	\N
b5211662-88a4-4d5c-b58f-dad83100559c	zyllian@millennia21.id	hashedpassword	f	active	2026-04-10 10:40:07.009	2026-04-10 10:40:07.009	\N
20fbef18-25ac-4fde-9cd0-3a58281dae26	dodi@millennia21.id	$2b$10$14deb7rvmm/A.Fe4EoCIwetQPr56EL6m0pzQj.lhXsV1h51IG5PSO	f	active	2026-04-09 06:35:37.88	2026-04-14 09:57:57.523	\N
07dcbcf9-d40d-4540-bd36-affa5e74b5f6	mahrukh@millennia21.id	$2b$10$1SatzVvtKGD3.7QETCsdCeO5u07emNk6USJT1gIjMdJINWMJqqnkG	f	active	2026-04-09 06:35:40.522	2026-04-14 09:58:23.263	\N
ab32b306-669a-4c6b-ab39-0e625eae5749	checklist.for.direct.instruction@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.725	2026-04-15 04:40:30.725	\N
95d96540-3471-4aa7-97c0-6514e53ee2df	special.education.teacher.supervision.instrument@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.736	2026-04-15 04:40:30.736	\N
6eb5d203-25eb-4607-9707-ec59e5f7ec13	detailed.classroom.observation@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.741	2026-04-15 04:40:30.741	\N
0a73da10-2740-4a46-8086-fde9dd29d80c	checklist.for.learning.and.understanding@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.779	2026-04-15 04:40:30.779	\N
f232abc1-86d2-460b-9307-d5b88f40bcd7	focus.on.learners.student.engagement@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.783	2026-04-15 04:40:30.783	\N
3fb37a57-99e6-459d-b0bb-a0f5df6b0567	checklist.for.differentiation@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.789	2026-04-15 04:40:30.789	\N
93b8c2e7-d572-4a06-b36e-20706dbfc1fa	focus.on.learners.small.group.or.in.pairing@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.792	2026-04-15 04:40:30.792	\N
a8622742-0637-403c-b912-279e364a4739	classroom.display.checklist@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.795	2026-04-15 04:40:30.795	\N
9deac837-7f72-49b9-8580-c49b7bc92ffa	test.observation@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.803	2026-04-15 04:40:30.803	\N
0b033927-3108-42dd-9b2e-2fa2ebbd9da3	delivery.of.instruction@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.845	2026-04-15 04:40:30.845	\N
01f9b0b2-1de9-4e90-9221-9276e121b3f1	lesson.preparation.walkthrough@millennia21.id	temporary_hash_change_me	f	active	2026-04-15 04:40:30.878	2026-04-15 04:40:30.878	\N
\.


--
-- Name: notification_preferences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: proofpoint
--

SELECT pg_catalog.setval('public.notification_preferences_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: proofpoint
--

SELECT pg_catalog.setval('public.notifications_id_seq', 4, true);


--
-- Name: ObservationAnswer ObservationAnswer_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public."ObservationAnswer"
    ADD CONSTRAINT "ObservationAnswer_pkey" PRIMARY KEY (id);


--
-- Name: Observation Observation_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public."Observation"
    ADD CONSTRAINT "Observation_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_pkey PRIMARY KEY (id);


--
-- Name: assessment_questions assessment_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_pkey PRIMARY KEY (id);


--
-- Name: assessments assessments_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_pkey PRIMARY KEY (id);


--
-- Name: department_roles department_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: kpi_domains kpi_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.kpi_domains
    ADD CONSTRAINT kpi_domains_pkey PRIMARY KEY (id);


--
-- Name: kpi_standards kpi_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.kpi_standards
    ADD CONSTRAINT kpi_standards_pkey PRIMARY KEY (id);


--
-- Name: kpis kpis_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rubric_indicators rubric_indicators_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.rubric_indicators
    ADD CONSTRAINT rubric_indicators_pkey PRIMARY KEY (id);


--
-- Name: rubric_sections rubric_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.rubric_sections
    ADD CONSTRAINT rubric_sections_pkey PRIMARY KEY (id);


--
-- Name: rubric_templates rubric_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.rubric_templates
    ADD CONSTRAINT rubric_templates_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ObservationAnswer_observationId_indicatorId_key; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE UNIQUE INDEX "ObservationAnswer_observationId_indicatorId_key" ON public."ObservationAnswer" USING btree ("observationId", "indicatorId");


--
-- Name: Observation_managerId_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX "Observation_managerId_idx" ON public."Observation" USING btree ("managerId");


--
-- Name: Observation_staffId_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX "Observation_staffId_idx" ON public."Observation" USING btree ("staffId");


--
-- Name: Observation_status_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX "Observation_status_idx" ON public."Observation" USING btree (status);


--
-- Name: approval_workflows_department_role_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX approval_workflows_department_role_id_idx ON public.approval_workflows USING btree (department_role_id);


--
-- Name: assessment_questions_assessment_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX assessment_questions_assessment_id_idx ON public.assessment_questions USING btree (assessment_id);


--
-- Name: assessments_director_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX assessments_director_id_idx ON public.assessments USING btree (director_id);


--
-- Name: assessments_manager_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX assessments_manager_id_idx ON public.assessments USING btree (manager_id);


--
-- Name: assessments_returned_by_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX assessments_returned_by_idx ON public.assessments USING btree (returned_by);


--
-- Name: assessments_staff_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX assessments_staff_id_idx ON public.assessments USING btree (staff_id);


--
-- Name: assessments_status_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX assessments_status_idx ON public.assessments USING btree (status);


--
-- Name: department_roles_department_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX department_roles_department_id_idx ON public.department_roles USING btree (department_id);


--
-- Name: department_roles_department_id_role_key; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE UNIQUE INDEX department_roles_department_id_role_key ON public.department_roles USING btree (department_id, role);


--
-- Name: department_roles_role_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX department_roles_role_idx ON public.department_roles USING btree (role);


--
-- Name: departments_parent_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX departments_parent_id_idx ON public.departments USING btree (parent_id);


--
-- Name: kpi_domains_template_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX kpi_domains_template_id_idx ON public.kpi_domains USING btree (template_id);


--
-- Name: kpi_standards_domain_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX kpi_standards_domain_id_idx ON public.kpi_standards USING btree (domain_id);


--
-- Name: kpis_standard_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX kpis_standard_id_idx ON public.kpis USING btree (standard_id);


--
-- Name: notification_preferences_user_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX notification_preferences_user_id_idx ON public.notification_preferences USING btree (user_id);


--
-- Name: notification_preferences_user_id_key; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE UNIQUE INDEX notification_preferences_user_id_key ON public.notification_preferences USING btree (user_id);


--
-- Name: notifications_assessment_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX notifications_assessment_id_idx ON public.notifications USING btree (assessment_id);


--
-- Name: notifications_status_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX notifications_status_idx ON public.notifications USING btree (status);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);


--
-- Name: profiles_department_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX profiles_department_id_idx ON public.profiles USING btree (department_id);


--
-- Name: profiles_user_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX profiles_user_id_idx ON public.profiles USING btree (user_id);


--
-- Name: profiles_user_id_key; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE UNIQUE INDEX profiles_user_id_key ON public.profiles USING btree (user_id);


--
-- Name: user_roles_user_id_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX user_roles_user_id_idx ON public.user_roles USING btree (user_id);


--
-- Name: user_roles_user_id_role_key; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_status_idx; Type: INDEX; Schema: public; Owner: proofpoint
--

CREATE INDEX users_status_idx ON public.users USING btree (status);


--
-- Name: ObservationAnswer ObservationAnswer_indicatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public."ObservationAnswer"
    ADD CONSTRAINT "ObservationAnswer_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES public.rubric_indicators(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ObservationAnswer ObservationAnswer_observationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public."ObservationAnswer"
    ADD CONSTRAINT "ObservationAnswer_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES public."Observation"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Observation Observation_director_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public."Observation"
    ADD CONSTRAINT "Observation_director_id_fkey" FOREIGN KEY (director_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Observation Observation_managerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public."Observation"
    ADD CONSTRAINT "Observation_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Observation Observation_rubricId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public."Observation"
    ADD CONSTRAINT "Observation_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES public.rubric_templates(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Observation Observation_staffId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public."Observation"
    ADD CONSTRAINT "Observation_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: approval_workflows approval_workflows_department_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_department_role_id_fkey FOREIGN KEY (department_role_id) REFERENCES public.department_roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: assessment_questions assessment_questions_asked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_asked_by_fkey FOREIGN KEY (asked_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: assessment_questions assessment_questions_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: assessment_questions assessment_questions_indicator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_indicator_id_fkey FOREIGN KEY (indicator_id) REFERENCES public.rubric_indicators(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: assessment_questions assessment_questions_responded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessment_questions
    ADD CONSTRAINT assessment_questions_responded_by_fkey FOREIGN KEY (responded_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: assessments assessments_director_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_director_id_fkey FOREIGN KEY (director_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: assessments assessments_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: assessments assessments_returned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: assessments assessments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: assessments assessments_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.assessments
    ADD CONSTRAINT assessments_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.rubric_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: department_roles department_roles_default_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_default_template_id_fkey FOREIGN KEY (default_template_id) REFERENCES public.rubric_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: department_roles department_roles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.department_roles
    ADD CONSTRAINT department_roles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: departments departments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: kpi_domains kpi_domains_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.kpi_domains
    ADD CONSTRAINT kpi_domains_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.rubric_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: kpi_standards kpi_standards_domain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.kpi_standards
    ADD CONSTRAINT kpi_standards_domain_id_fkey FOREIGN KEY (domain_id) REFERENCES public.kpi_domains(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: kpis kpis_standard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.kpis
    ADD CONSTRAINT kpis_standard_id_fkey FOREIGN KEY (standard_id) REFERENCES public.kpi_standards(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_assessment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES public.assessments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: profiles profiles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rubric_indicators rubric_indicators_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.rubric_indicators
    ADD CONSTRAINT rubric_indicators_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.rubric_sections(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rubric_sections rubric_sections_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.rubric_sections
    ADD CONSTRAINT rubric_sections_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.rubric_templates(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: rubric_templates rubric_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.rubric_templates
    ADD CONSTRAINT rubric_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: rubric_templates rubric_templates_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.rubric_templates
    ADD CONSTRAINT rubric_templates_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_directorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: proofpoint
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: proofpoint
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict p9iPQGHkSdGdkMD2qHXf8fosigNBEeb2a9daWFmEFMG2U62Lt5WyINAprOC4jx0

