-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('draft', 'self_submitted', 'manager_reviewed', 'director_approved', 'admin_reviewed', 'acknowledged', 'rejected', 'returned');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('pending', 'answered', 'closed');

-- CreateEnum
CREATE TYPE "WorkflowStepType" AS ENUM ('review', 'approval', 'review_and_approval', 'acknowledge', 'admin_review');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('assessment_submitted', 'manager_review_completed', 'director_approved', 'admin_released', 'assessment_returned', 'assessment_acknowledged');

-- CreateEnum
CREATE TYPE "app_role" AS ENUM ('admin', 'staff', 'manager', 'director', 'supervisor');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "niy" TEXT,
    "job_title" TEXT,
    "department_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "role" "app_role" NOT NULL DEFAULT 'staff',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_templates" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department_id" TEXT,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubric_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_sections" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DECIMAL(5,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubric_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_indicators" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "evidence_guidance" TEXT,
    "score_options" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubric_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_domains" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_standards" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "domain_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpis" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "standard_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "evidence_guidance" TEXT,
    "trainings" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "rubric_4" TEXT NOT NULL,
    "rubric_3" TEXT NOT NULL,
    "rubric_2" TEXT NOT NULL,
    "rubric_1" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "staff_id" TEXT NOT NULL,
    "manager_id" TEXT,
    "director_id" TEXT,
    "template_id" TEXT,
    "period" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL,
    "staff_scores" JSONB NOT NULL DEFAULT '{}',
    "manager_scores" JSONB NOT NULL DEFAULT '{}',
    "staff_evidence" JSONB NOT NULL DEFAULT '{}',
    "manager_evidence" JSONB NOT NULL DEFAULT '{}',
    "manager_notes" TEXT,
    "director_comments" TEXT,
    "return_feedback" TEXT,
    "returned_at" TIMESTAMP(3),
    "returned_by" TEXT,
    "final_score" DECIMAL(4,2),
    "final_grade" TEXT,
    "staff_submitted_at" TIMESTAMP(3),
    "manager_reviewed_at" TIMESTAMP(3),
    "director_approved_at" TIMESTAMP(3),
    "staff_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "indicator_id" TEXT,
    "asked_by" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "responded_by" TEXT,
    "responded_at" TIMESTAMP(3),
    "status" "QuestionStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_roles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "department_id" TEXT,
    "role" "app_role" NOT NULL,
    "default_template_id" TEXT,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "department_role_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_role" "app_role" NOT NULL,
    "step_type" "WorkflowStepType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "assessment_id" TEXT,
    "user_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "assessment_submitted" BOOLEAN NOT NULL DEFAULT true,
    "manager_review_done" BOOLEAN NOT NULL DEFAULT true,
    "director_approved" BOOLEAN NOT NULL DEFAULT true,
    "admin_released" BOOLEAN NOT NULL DEFAULT true,
    "assessment_returned" BOOLEAN NOT NULL DEFAULT true,
    "assessment_acknowledged" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "profiles_user_id_idx" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "profiles_department_id_idx" ON "profiles"("department_id");

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE INDEX "kpi_domains_template_id_idx" ON "kpi_domains"("template_id");

-- CreateIndex
CREATE INDEX "kpi_standards_domain_id_idx" ON "kpi_standards"("domain_id");

-- CreateIndex
CREATE INDEX "kpis_standard_id_idx" ON "kpis"("standard_id");

-- CreateIndex
CREATE INDEX "assessments_staff_id_idx" ON "assessments"("staff_id");

-- CreateIndex
CREATE INDEX "assessments_manager_id_idx" ON "assessments"("manager_id");

-- CreateIndex
CREATE INDEX "assessments_director_id_idx" ON "assessments"("director_id");

-- CreateIndex
CREATE INDEX "assessments_status_idx" ON "assessments"("status");

-- CreateIndex
CREATE INDEX "assessments_returned_by_idx" ON "assessments"("returned_by");

-- CreateIndex
CREATE INDEX "assessment_questions_assessment_id_idx" ON "assessment_questions"("assessment_id");

-- CreateIndex
CREATE INDEX "department_roles_department_id_idx" ON "department_roles"("department_id");

-- CreateIndex
CREATE INDEX "department_roles_role_idx" ON "department_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "department_roles_department_id_role_key" ON "department_roles"("department_id", "role");

-- CreateIndex
CREATE INDEX "approval_workflows_department_role_id_idx" ON "approval_workflows"("department_role_id");

-- CreateIndex
CREATE INDEX "notifications_assessment_id_idx" ON "notifications"("assessment_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_templates" ADD CONSTRAINT "rubric_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_templates" ADD CONSTRAINT "rubric_templates_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_sections" ADD CONSTRAINT "rubric_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "rubric_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_indicators" ADD CONSTRAINT "rubric_indicators_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "rubric_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_domains" ADD CONSTRAINT "kpi_domains_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "rubric_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_standards" ADD CONSTRAINT "kpi_standards_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "kpi_domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_standard_id_fkey" FOREIGN KEY ("standard_id") REFERENCES "kpi_standards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_returned_by_fkey" FOREIGN KEY ("returned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "rubric_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_asked_by_fkey" FOREIGN KEY ("asked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "rubric_indicators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_roles" ADD CONSTRAINT "department_roles_default_template_id_fkey" FOREIGN KEY ("default_template_id") REFERENCES "rubric_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_roles" ADD CONSTRAINT "department_roles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_department_role_id_fkey" FOREIGN KEY ("department_role_id") REFERENCES "department_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
