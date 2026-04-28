# Architettura target (modulare OOP)

## Obiettivi
- Single database multi-tenant
- Moduli abilitabili per workspace e override per utente
- Separazione netta tra core, moduli, storage, worker, database
- Servizi OOP e repository per ogni dominio

## Struttura implementata
- `src/core`
  - error model (`AppError`)
  - tenancy guard (`TenancyGuard`)
  - module policy (`ModuleAccessPolicy`)
- `src/database`
  - `PrismaClientManager`
  - adapter read-model per tenancy
- `src/storage`
  - `ObjectStorage` / `ProjectBinaryStorage`
  - `GarageObjectStorage`
  - `InMemoryObjectStorage`
- `src/worker`
  - coda job in-memory
  - worker DDT + coordinator
- `src/modules`
  - `identity`
  - `module-management`
  - `projects`
  - `document-archive`
  - `ddt-processing`
  - `shipping`
  - `notifications`
- `prisma/schema.prisma`
  - modello multi-tenant unico con `workspace_id`

## Principio applicato
Ogni modulo espone:
- entita (`domain`)
- contratti (`repositories`)
- logica applicativa (`services`)
- adapter persistenti (`infra`)

I servizi applicativi non fanno I/O diretto su HTTP: ricevono command/dto e delegano ai repository.
