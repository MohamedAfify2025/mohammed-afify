import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/202611230001_dynamic_user_permissions.sql", "utf8");
const adminJs = await readFile("public-site/assets/js/admin-permissions.js", "utf8");
const traineeJs = await readFile("public-site/assets/js/student-space.js", "utf8");
const adminHtml = await readFile("public-site/admin-permissions.html", "utf8");
const studentHtml = await readFile("public-site/student-space.html", "utf8");

assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.platform_permission_definitions/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_permission_profiles/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.user_permission_grants/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.platform_permission_audit_log/);
assert.match(migration, /membership_v2_private\.is_admin\(\)/);
assert.match(migration, /SECURITY DEFINER[\s\S]*SET search_path = ''/);
assert.match(migration, /public\.has_platform_permission/);
assert.match(migration, /public\.get_my_platform_permissions/);
assert.match(migration, /permission_mode IN \('inherit', 'custom'\)/);
assert.match(migration, /NULLS NOT DISTINCT/);
assert.match(migration, /ON CONFLICT ON CONSTRAINT user_permission_scope_unique/);
assert.match(migration, /course_catalog/);
assert.match(migration, /platform_permission_audit_log/);
assert.match(migration, /REVOKE ALL ON FUNCTION public\.admin_grant_user_permission/);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.admin_grant_user_permission/);

assert.match(adminJs, /is_platform_admin/);
assert.match(adminJs, /admin_set_user_permission_mode/);
assert.match(adminJs, /admin_grant_user_permission/);
assert.match(adminJs, /admin_revoke_user_permission/);
assert.match(adminJs, /admin_upsert_platform_permission/);
assert.match(adminHtml, /إدارة الصلاحيات/);
assert.match(traineeJs, /get_my_platform_permissions/);
assert.match(traineeJs, /course\.lesson\.view/);
assert.match(studentHtml, /permissionPanel/);

console.log("Dynamic permission checks passed.");
