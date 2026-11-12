SELECT
    r.name AS role_name,
    t.name AS tenant_name,
    p.name AS permission_name
FROM "RolePermission" rp
JOIN "Role" r ON r.id = rp."roleId"
JOIN "Tenant" t ON t.id = r."tenantId"
JOIN "Permission" p ON p.id = rp."permissionId"
ORDER BY t.name, r.name, p.name;
