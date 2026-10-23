SELECT
  r."name" AS role,
  p."name" AS permission
FROM "Role" AS r
JOIN "RolePermission" AS rp
  ON rp."roleId" = r.id
JOIN "Permission" AS p
  ON p.id = rp."permissionId"
WHERE p."name" LIKE 'quiz.%'
ORDER BY r."name", p."name";