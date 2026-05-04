# Deploy e Reverse Proxy

## Scopo
Questa guida descrive come esporre Birgus con nomi dominio locali o di rete, mantenendo frontend e backend separati.

## 1) Locale singolo PC

Mappa host locali in `/etc/hosts`:

```txt
127.0.0.1 birgus.local
127.0.0.1 api.birgus.local
```

Con proxy attivo:
- `http://birgus.local` -> frontend
- `http://api.birgus.local` -> backend

## 2) Rete LAN (altri PC)

Sia `192.168.1.50` l'IP LAN del PC/server Birgus:

1. Sul server avvia il proxy su `0.0.0.0:80` (e `443` se HTTPS).
2. Su ogni client LAN aggiungi:

```txt
192.168.1.50 birgus.local
192.168.1.50 api.birgus.local
```

3. Apri firewall porte `80` (e `443`).

Nota: `app` e `frontend` sono host Docker interni, non risolvibili dal browser host o da altri PC.

## 3) Variabili consigliate dietro proxy

Nel servizio `app`:
- `TRUST_PROXY=true`
- `AUTH_COOKIE_SECURE=true` (se HTTPS)
- `AUTH_COOKIE_SAME_SITE=Lax` (o `None` se cross-site con HTTPS)
- `AUTH_COOKIE_DOMAIN=.tuodominio.it` (opzionale)

Nel servizio `frontend`:
- `BIRGUS_API_BASE_URL=http://app:3000` se frontend e backend comunicano in rete Docker

## 4) Esempio Nginx minimale

```nginx
server {
  listen 80;
  server_name birgus.local;

  location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 80;
  server_name api.birgus.local;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 5) Verifica post-deploy

```bash
curl -i http://api.birgus.local/health
curl -i http://birgus.local/login
npm run test:smoke
```
