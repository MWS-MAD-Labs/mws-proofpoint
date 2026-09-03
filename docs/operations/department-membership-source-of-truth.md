# Department Membership Source of Truth Rollout

## Summary

Department role memberships are the authoritative source for organizational access.

Canonical role scope:

- `admin` and `director` are global roles and use a `department_roles` row whose `department_id` is `NULL`.
- `manager`, `supervisor`, and `staff` are departmental roles and require a non-null `department_id`.
- A user may hold different roles in multiple departments.
- `user_roles` remains a compatibility projection and is rebuilt from valid `department_role_memberships`.
- `profiles.department_id` is no longer an authorization or assignment source.

Administrators manage assignments from **Administration → Departments**. The Admin Users area displays those assignments but does not independently edit department or role access.

## Deployment

Apply the migration before starting the updated application:

```sh
npm run db:migrate:deploy
```

The migration:

1. Archives the previous `user_roles` state.
2. Creates missing supervisor roles for existing departments.
3. Creates missing global admin and director role definitions.
4. Backfills departmental memberships where a legacy profile department allows an unambiguous mapping.
5. Backfills and promotes admin/director grants to global memberships.
6. Removes invalidly scoped memberships and role definitions.
7. Records roles that could not be mapped.
8. Rebuilds `user_roles` from canonical memberships.

## Audit tables

The migration creates two intentionally retained audit tables:

- `user_roles_pre_membership_migration`: complete snapshot of the previous compatibility-role state.
- `unmapped_user_roles_after_membership_migration`: roles that could not be represented by a canonical membership, with a reconciliation reason.

These tables are represented as ignored models in `prisma/schema.prisma`, so their presence does not cause Prisma schema drift.

Review unresolved users after deployment:

```sql
SELECT
  user_id,
  role,
  legacy_department_id,
  unmapped_reason,
  recorded_at
FROM unmapped_user_roles_after_membership_migration
ORDER BY recorded_at, user_id, role;
```

For each unresolved user, assign the correct departmental role from **Administration → Departments**. Do not restore access by inserting directly into `user_roles`.

## Verification

After migration:

1. Confirm at least one global administrator remains assigned.
2. Confirm directors appear under organization-wide roles.
3. Confirm managers assigned to multiple departments can access staff in each department they manage.
4. Confirm staff with multiple departmental assignments appear once in observation selection.
5. Confirm a manager with no `profiles.department_id` can observe staff through their manager membership.
6. Review the unmapped-role audit table and reconcile every expected active user.
7. Run:

```sh
npm run db:migrate:check
npm run test:observations
npm run test:observations:integration
npm run build
```

## Rollback and recovery

The migration does not delete the legacy role history. If an assignment must be investigated, use `user_roles_pre_membership_migration` to compare the previous role grant with the user's profile and current department memberships.

Do not copy archived rows directly back into `user_roles`; that table is a derived compatibility projection. Restore access by creating the appropriate canonical department-role membership.
