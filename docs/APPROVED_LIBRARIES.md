# Birgus - Librerie approvate

Questa policy serve a rendere effettiva la regola PDF sull'uso sicuro di librerie e dipendenze.

## Regola generale

- Preferire librerie gia presenti nel progetto.
- Evitare nuove dipendenze per utility semplici risolvibili con standard library.
- Ogni nuova dipendenza deve essere motivata nella PR.
- `npm audit --omit=dev` backend e frontend deve restare senza vulnerabilita.
- Dipendenze con vulnerabilita high/critical richiedono fix o eccezione sicurezza.

## Approvate backend TypeScript

- `@nestjs/*`: framework HTTP/backend.
- `fastify`, `@fastify/multipart`, `@fastify/swagger`, `@fastify/swagger-ui`: server HTTP e API docs.
- `@prisma/client`, `prisma`: accesso database e schema.
- `zod`: validazione input.
- `nodemailer`: invio email.
- `@aws-sdk/client-s3`: storage S3/Garage.
- `docx`: generazione documenti.
- `tsx`, `typescript`: toolchain sviluppo/build.

## Approvate frontend

- `next`, `react`, `react-dom`: framework frontend.
- `react-hook-form`: gestione form.
- `zod`: validazione.
- `lucide-react`: icone UI.
- `sonner`: notifiche.
- `clsx`, `tailwind-merge`, `tailwindcss`, `@tailwindcss/postcss`: styling.
- `jspdf`, `jspdf-autotable`: export PDF.
- `@aws-sdk/client-s3`: solo se necessario per compatibilita esistente; preferire chiamate backend per nuovo codice.

## Approvate Python Modules

- `fastapi`, `uvicorn`, `pydantic`: API Python.
- `boto3`, `botocore`: storage S3/Garage.
- `numpy`, `pillow`, `pypdfium2`, `paddleocr`, `paddlepaddle`: OCR e analisi documenti.
- `python-docx`: generazione documenti.
- `openai`: client LM compatibile.
- `python-dotenv`: solo sviluppo locale.

## Processo per nuove librerie

La PR deve indicare:

- problema risolto;
- alternative considerate;
- manutenzione/stato libreria;
- impatto bundle/runtime;
- risultato audit;
- eventuali permessi, accessi rete o dati trattati.
