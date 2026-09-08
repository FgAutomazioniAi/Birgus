# Frontend Birgus

Il frontend Next.js fa parte dello stack Birgus e non viene installato separatamente.

Per una prima installazione partire dalla guida nel [README principale](../README.md). Il comando consigliato costruisce e avvia frontend, backend e servizi collegati:

```bash
docker compose up -d --build
```

Per lo sviluppo con reload automatico:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Il frontend risponde su `http://localhost:13100`; l'accesso pubblico standard passa dal reverse proxy su `http://localhost/`.
