DO $$
DECLARE
  department_role_enum_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO department_role_enum_type
    FROM pg_attribute a
   WHERE a.attrelid = 'department_roles'::regclass
     AND a.attname = 'role'
     AND NOT a.attisdropped;

  IF department_role_enum_type IS NULL THEN
    RAISE EXCEPTION 'Unable to determine department_roles.role type';
  END IF;

  EXECUTE format(
    'INSERT INTO department_roles (department_id, role, name, created_at, updated_at)
     SELECT d.id, required_role.role_value::%s,
            d.name || '' '' || required_role.role_value,
            NOW(), NOW()
       FROM departments d
      CROSS JOIN (VALUES (''manager''), (''staff'')) AS required_role(role_value)
      WHERE NOT EXISTS (
        SELECT 1
          FROM department_roles existing
         WHERE existing.department_id = d.id
           AND existing.role::text = required_role.role_value
      )',
    department_role_enum_type
  );
END
$$;
