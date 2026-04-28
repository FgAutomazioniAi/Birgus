# Mappa migrazione DEMO -> Birgus modulare

## Identity
- DEMO: `src/lib/auth/*`, `src/app/api/auth/*`
- Target: `src/modules/identity/*`

## Modules enablement
- DEMO: non presente come modulo DB-first
- Target: `src/modules/module-management/*` + tabelle `modules`, `workspace_modules`, `user_module_overrides`

## Projects
- DEMO: `src/app/api/projects/*`, `src/lib/project-versions.ts`
- Target: `src/modules/projects/*`

## Document archive + Garage
- DEMO: `src/lib/project-files.ts`, `src/lib/storage/garage.ts`
- Target: `src/modules/document-archive/*` + `src/storage/*`

## DDT processing
- DEMO: Python service separato + proxy Next
- Target: `src/modules/ddt-processing/*` + `src/worker/services/DdtProcessingWorker.ts`

## Shipping
- DEMO: UI-oriented panel, backend limitato
- Target: `src/modules/shipping/*`

## Notifications
- DEMO: `src/lib/notifications.ts`, `src/app/api/notifications/route.ts`
- Target: `src/modules/notifications/*`

## Tenancy
- DEMO: assente
- Target: `src/core/tenancy/*` + schema multi-tenant (`organizations`, `workspaces`, memberships)
