\set ON_ERROR_STOP on

-- Run after schema deployment and again after the manual data restore.
-- This script reports counts and fails on broken user/observation references.

SELECT 'departments' AS metric, count(*)::bigint AS value FROM departments
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'users_active', count(*) FROM users WHERE status::text = 'active'
UNION ALL SELECT 'users_suspended', count(*) FROM users WHERE status::text = 'suspended'
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'user_roles', count(*) FROM user_roles
UNION ALL SELECT 'assessments', count(*) FROM assessments
UNION ALL SELECT 'assessment_questions', count(*) FROM assessment_questions
UNION ALL SELECT 'observations', count(*) FROM observations
UNION ALL SELECT 'observation_answers', count(*) FROM observation_answers
UNION ALL SELECT 'observation_updates', count(*) FROM observation_updates
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'notification_preferences', count(*) FROM notification_preferences
UNION ALL SELECT 'rubric_templates', count(*) FROM rubric_templates
UNION ALL SELECT 'rubric_indicators', count(*) FROM rubric_indicators
UNION ALL SELECT 'department_role_memberships', count(*) FROM department_role_memberships
ORDER BY metric;

DO $$
DECLARE
  violation_count bigint;
BEGIN
  SELECT count(*) INTO violation_count
  FROM profiles p
  LEFT JOIN users u ON u.id = p.user_id
  WHERE u.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'profiles contains % orphan user references', violation_count;
  END IF;

  SELECT count(*) INTO violation_count
  FROM observations o
  LEFT JOIN users u ON u.id = o."staffId"
  WHERE u.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'observations contains % orphan staff references', violation_count;
  END IF;

  SELECT count(*) INTO violation_count
  FROM observation_answers oa
  LEFT JOIN observations o ON o.id = oa.observation_id
  LEFT JOIN rubric_indicators ri ON ri.id = oa.indicator_id
  WHERE o.id IS NULL OR ri.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'observation_answers contains % orphan references', violation_count;
  END IF;

  SELECT count(*) INTO violation_count
  FROM observation_updates ou
  LEFT JOIN observations o ON o.id = ou.observation_id
  WHERE o.id IS NULL;
  IF violation_count > 0 THEN
    RAISE EXCEPTION 'observation_updates contains % orphan observation references', violation_count;
  END IF;
END $$;
