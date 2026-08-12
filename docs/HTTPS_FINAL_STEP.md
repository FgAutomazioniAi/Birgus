# Birgus - HTTPS come ultimo step

HTTPS e considerato step finale di hardening infrastrutturale, dopo aver reso effettive le regole di sviluppo sicuro.

## Obiettivo

- Servire frontend e API solo via HTTPS negli ambienti condivisi/produzione.
- Mantenere `AUTH_COOKIE_SECURE=true` in produzione.
- Configurare reverse proxy con redirect HTTP -> HTTPS.
- Non esporre Garage Admin/API pubblicamente senza protezioni di rete.

## Opzione implementata

E stato predisposto un profilo opzionale Caddy:

- `Caddyfile.https.example`: template reverse proxy HTTPS.
- `docker-compose.https.yml`: servizio `reverse_proxy` su porte 80/443.
- `Caddyfile.https.local`: file locale ignorato da git, da creare dal template.

Preparazione:

```bash
cp Caddyfile.https.example Caddyfile.https.local
export BIRGUS_PUBLIC_HOST=birgus.example.com
```

Avvio con profilo produzione e HTTPS:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.https.yml up --build -d
```

Per dominio pubblico, Caddy richiede che DNS e porte 80/443 puntino alla macchina. Per LAN/VPN usare un dominio interno o sostituire il template con certificati interni.

## Controlli da fare nello step HTTPS

- Verificare cookie sessione con `Secure`, `HttpOnly`, `SameSite`.
- Verificare `TRUST_PROXY=true` dietro proxy.
- Verificare upload PDF e download file su HTTPS.
- Verificare redirect HTTP -> HTTPS.
- Verificare che `/documentation` resti disabilitato o protetto.
- Documentare la configurazione scelta nel runbook operativo di produzione.
