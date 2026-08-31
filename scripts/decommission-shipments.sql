BEGIN;

-- Remove module access and permission records before deleting the module itself.
DELETE FROM "role_permissions"
WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "key" IN ('shipments.read', 'shipments.write')
);
DELETE FROM "permissions" WHERE "key" IN ('shipments.read', 'shipments.write');

DELETE FROM "module_dependencies"
WHERE "module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management')
   OR "depends_on_module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management');
DELETE FROM "user_module_overrides"
WHERE "module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management');
DELETE FROM "workspace_modules"
WHERE "module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management');

-- Workflows, tools and agents owned by the retired module cannot remain executable.
DELETE FROM "module_workflows"
WHERE "module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management');
DELETE FROM "module_tools"
WHERE "module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management');
DELETE FROM "module_agents"
WHERE "module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management');
UPDATE "documents"
SET "module_id" = NULL
WHERE "module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management');
DELETE FROM "notifications"
WHERE "module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management');
DELETE FROM "audit_logs"
WHERE "module_id" IN (SELECT "id" FROM "modules" WHERE "key" = 'shipment_management');
DELETE FROM "modules" WHERE "key" = 'shipment_management';

-- Retire relationship columns before removing the shipment tables.
ALTER TABLE "module_workflow_runs" DROP COLUMN IF EXISTS "shipment_id";
ALTER TABLE "assistant_sessions" DROP COLUMN IF EXISTS "shipment_id";
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "rows_shipments";
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "columns_shipments";

DROP TABLE IF EXISTS "shipment_events";
DROP TABLE IF EXISTS "shipment_items";
DROP TABLE IF EXISTS "shipment_specifications";
DROP TABLE IF EXISTS "shipments";
DROP TABLE IF EXISTS "shipment_statuses";

-- PostgreSQL cannot remove a value from an enum in place. Preserve documents,
-- map the retired scope to OTHER, and recreate the enum without SHIPMENT.
ALTER TABLE "documents" ALTER COLUMN "scope" DROP DEFAULT;
UPDATE "documents" SET "scope" = 'OTHER' WHERE "scope"::text = 'SHIPMENT';
ALTER TABLE "documents" ALTER COLUMN "scope" TYPE text USING "scope"::text;
DROP TYPE IF EXISTS "DocumentScope";
CREATE TYPE "DocumentScope" AS ENUM ('WORKSPACE', 'PROJECT', 'DDT', 'MEASURE_REPORT', 'OTHER');
ALTER TABLE "documents" ALTER COLUMN "scope" TYPE "DocumentScope" USING "scope"::"DocumentScope";
ALTER TABLE "documents" ALTER COLUMN "scope" SET DEFAULT 'WORKSPACE'::"DocumentScope";

COMMIT;
