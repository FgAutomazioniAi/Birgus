# Analisi codebase DEMO

Sorgente analizzato: `/home/samuel/Progetti/DEMO/Birgus/v1_Birgus`

## Stack individuato
- Next.js App Router con route handlers in `src/app/api`
- Prisma + PostgreSQL
- Storage Garage (S3-compatible)
- DDT reader Python separato (`integrations/ddt-reader-backend`)
- Orchestrator Python separato (`py_orchestrator`)

## Moduli funzionali osservati
- Identity: login/logout/reset password/session management
- Project management: CRUD progetti, versioning, stato, linking cliente
- Document archive: nodi/documenti + storage path su Garage
- DDT reader: upload/analyze/list/delete PDF e metadati OCR/AI
- Shipping: logica principalmente frontend, non modellata come modulo backend completo
- Notifications: feed notifiche per utente

## Criticita architetturali rilevate
- Molta logica business direttamente nei route handler (accoppiamento transport + domain)
- Pattern misto procedurale/funzionale, OOP non sistematico
- Separazione per modulo non rigida: dipendenze trasversali in `src/lib`
- Multi-tenancy assente nel modello dati originale
- DDT e orchestrator in processi/DB separati rispetto al dominio principale

## Esito
La codebase DEMO contiene i mattoni funzionali corretti, ma richiede rifattorizzazione strutturale per ottenere:
- modularita composabile per workspace/utente
- single database multi-tenant
- servizi OOP con repository, policy e worker separati
