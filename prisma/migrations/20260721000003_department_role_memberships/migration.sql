DO $$
DECLARE
  department_role_id_type TEXT;
  user_id_type TEXT;
  department_role_enum_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO department_role_id_type
    FROM pg_attribute a
   WHERE a.attrelid = 'department_roles'::regclass
     AND a.attname = 'id'
     AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO department_role_enum_type
    FROM pg_attribute a
   WHERE a.attrelid = 'department_roles'::regclass
     AND a.attname = 'role'
     AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO user_id_type
    FROM pg_attribute a
   WHERE a.attrelid = 'users'::regclass
     AND a.attname = 'id'
     AND NOT a.attisdropped;

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS department_role_memberships (
       id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
       department_role_id %s NOT NULL REFERENCES department_roles(id) ON DELETE CASCADE,
       user_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       CONSTRAINT department_role_memberships_role_user_key UNIQUE (department_role_id, user_id)
     )',
    department_role_id_type,
    user_id_type
  );

  EXECUTE format(
    'INSERT INTO department_roles (department_id, role, name, created_at, updated_at)
     SELECT d.id, role_value::%s, d.name || '' '' || role_value, NOW(), NOW()
       FROM departments d
      CROSS JOIN (VALUES (''manager''), (''staff'')) AS roles_to_create(role_value)
      WHERE NOT EXISTS (
        SELECT 1 FROM department_roles existing
         WHERE existing.department_id = d.id
           AND existing.role::text = roles_to_create.role_value
      )',
    department_role_enum_type
  );

  EXECUTE format(
    'INSERT INTO department_roles (department_id, role, name, created_at, updated_at)
     SELECT NULL, role_value::%s, ''Global '' || role_value, NOW(), NOW()
       FROM (VALUES (''director''), (''admin'')) AS global_roles(role_value)
      WHERE NOT EXISTS (
        SELECT 1 FROM department_roles existing
         WHERE existing.department_id IS NULL
           AND existing.role::text = global_roles.role_value
      )',
    department_role_enum_type
  );
END
$$;

CREATE INDEX IF NOT EXISTS department_role_memberships_role_idx
  ON department_role_memberships(department_role_id);
CREATE INDEX IF NOT EXISTS department_role_memberships_user_idx
  ON department_role_memberships(user_id);



INSERT INTO department_role_memberships (department_role_id, user_id)
SELECT dr.id, p.user_id
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.user_id
  JOIN department_roles dr
    ON dr.department_id = p.department_id
   AND dr.role::text = ur.role::text
 WHERE p.department_id IS NOT NULL
ON CONFLICT (department_role_id, user_id) DO NOTHING;

INSERT INTO department_role_memberships (department_role_id, user_id)
SELECT dr.id, ur.user_id
  FROM user_roles ur
  JOIN department_roles dr
    ON dr.department_id IS NULL
   AND dr.role::text = ur.role::text
 WHERE ur.role::text IN ('director', 'admin')
ON CONFLICT (department_role_id, user_id) DO NOTHING;
