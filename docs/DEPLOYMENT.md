# Despliegue SG-SST

## Arquitectura de Despliegue

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Load Balancer │────▶│  Reverse Proxy  │────▶│   Fastify App   │
│   (Nginx/Traefik)│    │   (Nginx)       │    │   (Node 22)     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                          ┌──────────────────────────────┐
                                          │ SQLite (DB_BACKEND=sqlite)   │
                                          │ o Neon PostgreSQL (pg)       │
                                          └──────────────────────────────┘
```

El backend se elige con `DB_BACKEND`: `sqlite` (predeterminado) usa el archivo
local; `pg` usa `DATABASE_URL` (Neon). No cambie de backend sin ejecutar
`migrate:pg` y, si aplica, el ETL de datos.

## Opciones de Despliegue

### 1. VPS / VM Tradicional (Recomendado para microempresa)

- **OS**: Ubuntu 22.04/24.04 LTS o Debian 12
- **Node**: 22.x (via NodeSource o nvm)
- **Process Manager**: PM2 o systemd
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (Certbot)

### 2. Neon PostgreSQL + backend gestionado (Recomendado al migrar)

- Base gestionada con TLS, branch `production` y branch `dev`
- El backend puede vivir en VPS, contenedor o servicio administrado
- Respaldo lógico diario desde la app + branches/point-in-time de Neon

### 3. Docker Compose (Producción)

- Multi-stage builds para frontend + backend
- Volúmenes persistentes para SQLite + backups (solo con `DB_BACKEND=sqlite`)
- Health checks automáticos

### 4. Kubernetes (Escalabilidad futura)

- Sin volúmenes de base de datos cuando `DB_BACKEND=pg`
- Ingress + cert-manager

---

## Despliegue en VPS (Pasos Detallados)

### 1. Preparar Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y nginx certbot python3-certbot-nginx git curl

# Instalar Node 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version  # v22.x.x
npm --version   # 10.x.x

# Habilitar pnpm
corepack enable
corepack prepare pnpm@9 --activate
```

### 2. Clonar y Configurar

```bash
# Usuario deploy (no root)
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG sudo deploy
su - deploy

# Clonar repo
git clone https://github.com/tu-org/sg-sst.git
cd sg-sst

# Instalar dependencias
pnpm install --frozen-lockfile

# Configurar entorno
cp .env.example .env
# Editar .env con valores de producción
```

### 3. Variables de Entorno Producción (.env)

```bash
# Server
NODE_ENV=production
PORT=4000
HOST=127.0.0.1
SESSION_SECRET=clave-super-segura-64-chars-minimo-generar-con-openssl-rand-base64-48
SG_SST_DATA_DIR=/home/deploy/sg-sst/data

# Email (usar servicio transaccional: SendGrid, Mailgun, AWS SES, Brevo)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=tu-api-key-sendgrid
SMTP_FROM=SG-SST Alertas <alertas@tudominio.com>
ALERTS_ENABLED=true

# Frontend (build time)
VITE_API_BASE=https://tudominio.com/api

# Backend de datos: sqlite (default) | pg
DB_BACKEND=pg
DATABASE_URL=postgresql://usuario:clave@host-pooler.neon.tech/neondb?sslmode=require
PGPOOL_MAX=5
# true exige verificación completa del certificado TLS
PGSSL_STRICT=true

# Cifrado de datos sensibles (Ley 1581/2012); misma clave entre entornos que compartan datos
ENCRYPTION_SECRET=generar-con-openssl-rand-hex-32

# Respaldo automático 02:00 America/Bogota
BACKUP_ENABLED=true
BACKUP_DIR=/home/deploy/sg-sst/backups
BACKUP_RETENTION_DAYS=30
BACKUP_TIMEZONE=America/Bogota
```

En Neon use la cadena _pooled_ para la app (`-pooler`) y una cadena directa
para migraciones/ETL/restore si el pooler limita transacciones largas.

### 4. Build de Producción

```bash
# Build completo
pnpm build

# Verificar estructura
ls -la server/dist/ web/dist/
```

### 5. Configurar Nginx

```nginx
# /etc/nginx/sites-available/sg-sst
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    # Redirect HTTP to HTTPS (después de certbot)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tudominio.com www.tudominio.com;

    # SSL (certbot gestiona estos archivos)
    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;";

    # Gzip
    gzip on;
    gzip_types text/plain application/json application/javascript text/css application/xml;

    # Frontend (Vite build)
    location / {
        root /home/deploy/sg-sst/web/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Backend
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Cookies
        proxy_cookie_path / "/; Secure; HttpOnly; SameSite=Lax";
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:4000/api/health;
        access_log off;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/sg-sst /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL con Let's Encrypt

```bash
# Obtener certificado
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Renovación automática (systemd timer ya instalado)
sudo systemctl status certbot.timer
```

### 7. Process Manager (PM2)

```bash
# Instalar PM2
pnpm add -g pm2

# Configurar ecosystem
cat > ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'sg-sst-api',
      script: 'dist/index.js',
      cwd: '/home/deploy/sg-sst/server',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: '/home/deploy/sg-sst/logs/api-error.log',
      out_file: '/home/deploy/sg-sst/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
EOF

# Crear directorio logs
mkdir -p /home/deploy/sg-sst/logs

# Iniciar
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
```

### 8. Systemd Service (Alternativa a PM2)

```ini
# /etc/systemd/system/sg-sst.service
[Unit]
Description=SG-SST API Server
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/home/deploy/sg-sst/server
ExecStart=/usr/bin/node dist/index.js
Environment=NODE_ENV=production
Environment=PORT=4000
Restart=on-failure
RestartSec=5
StandardOutput=append:/home/deploy/sg-sst/logs/api.log
StandardError=append:/home/deploy/sg-sst/logs/api-error.log

# Seguridad
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/deploy/sg-sst/data /home/deploy/sg-sst/logs /home/deploy/sg-sst/backups

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sg-sst
sudo systemctl status sg-sst
```

---

## Docker Compose (Producción)

### Dockerfile.server

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY server/package.json server/
RUN pnpm install --frozen-lockfile --prod

FROM base AS builder
COPY . .
RUN pnpm -w server run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/src/migrations ./dist/lib/migrations
USER nodejs
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

### Dockerfile.web

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY . .
RUN pnpm -w web run build

FROM nginx:alpine AS runner
COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.server
    container_name: sg-sst-api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=4000
      - HOST=0.0.0.0
      - SESSION_SECRET=${SESSION_SECRET}
      - SG_SST_DATA_DIR=/data
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM}
      - ALERTS_ENABLED=${ALERTS_ENABLED}
      - DB_BACKEND=${DB_BACKEND:-sqlite}
      - DATABASE_URL=${DATABASE_URL}
      - ENCRYPTION_SECRET=${ENCRYPTION_SECRET}
      - BACKUP_ENABLED=${BACKUP_ENABLED:-true}
      - BACKUP_DIR=/backups
      - BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
      - BACKUP_TIMEZONE=${BACKUP_TIMEZONE:-America/Bogota}
    volumes:
      - sg-sst-data:/data
      - sg-sst-backups:/backups
      - sg-sst-logs:/app/logs
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:4000/api/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - sg-sst-network

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    container_name: sg-sst-web
    restart: unless-stopped
    depends_on:
      - api
    networks:
      - sg-sst-network

  nginx:
    image: nginx:alpine
    container_name: sg-sst-nginx
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - web
      - api
    networks:
      - sg-sst-network

  certbot:
    image: certbot/certbot
    container_name: sg-sst-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done'"

volumes:
  sg-sst-data:
  sg-sst-backups:
  sg-sst-logs:

networks:
  sg-sst-network:
    driver: bridge
```

### nginx.prod.conf

```nginx
events {
    worker_connections 1024;
}

http {
    upstream api_backend {
        server api:4000;
    }

    upstream web_frontend {
        server web:80;
    }

    server {
        listen 80;
        server_name tudominio.com www.tudominio.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    server {
        listen 443 ssl http2;
        server_name tudominio.com www.tudominio.com;

        ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN";
        add_header X-Content-Type-Options "nosniff";
        add_header Referrer-Policy "strict-origin-when-cross-origin";

        # Frontend
        location / {
            proxy_pass http://web_frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API
        location /api/ {
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cookie_path / "/; Secure; HttpOnly; SameSite=Lax";
        }
    }
}
```

### Desplegar con Docker

```bash
# Crear .env para docker-compose
cat > .env << 'EOF'
SESSION_SECRET=tu-secret-64-chars
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=tu-api-key
SMTP_FROM=SG-SST Alertas <alertas@tudominio.com>
ALERTS_ENABLED=true
EOF

# Build y deploy
docker compose up -d --build

# Ver logs
docker compose logs -f api
docker compose logs -f web

# Ver estado
docker compose ps
```

---

## Despliegue con PostgreSQL (Neon)

Orden sugerido para el primer despliegue con `DB_BACKEND=pg`:

```bash
# 1. Aplicar esquema al branch destino
pnpm --dir server run migrate:pg

# 2. (Solo si hay datos SQLite que conservar) copiar datos en una transacción
pnpm --dir server run etl:pg -- --url-env DATABASE_URL --truncate --apply

# 3. Verificar login, empresa, un examen con campos cifrados y una exportación
# 4. Programar el respaldo (job interno 02:00 o cron externo)
pnpm --dir server run backup:pg -- --url-env DATABASE_URL
```

Variables clave: `DB_BACKEND=pg`, `DATABASE_URL`, `ENCRYPTION_SECRET` (la misma
del origen para leer datos cifrados migrados), `PGPOOL_MAX` bajo (5–10) y
`PGSSL_STRICT=true`.

### Respaldos y restauración

El respaldo es lógico y portable (JSONL + gzip por tabla, manifiesto con
conteos y SHA-256, copia de `uploads`). No requiere `pg_dump`.

```bash
# Crear
pnpm --dir server run backup:pg -- --url-env DATABASE_URL

# Validar sin escribir
pnpm --dir server run restore:pg -- --url-env DATABASE_URL --dir <nombre-backup>

# Restaurar (transaccional; exige esquema destino migrado)
pnpm --dir server run restore:pg -- --url-env DATABASE_URL --dir <nombre-backup> --apply
```

En `NODE_ENV=production` el restore exige `--allow-production` y debe hacerse
con el servidor detenido y aprobación de la empresa. Detalle completo en
[`docs/DATABASE.md`](./DATABASE.md#backup-y-restore-postgresql-neon).

Complementos: branches de Neon y point-in-time restore para desastres; el
respaldo lógico sirve para auditoría y traslado entre entornos. Neon escala a
cero: mida el cold start tras inactividad y ajuste el autosuspend o un
keep-alive barato si afecta la operación.

---

## Backup Automatizado

### Script de Backup (backup.sh)

```bash
#!/bin/bash
# /home/deploy/sg-sst/scripts/backup.sh

set -euo pipefail

DATA_DIR="/home/deploy/sg-sst/data"
BACKUP_DIR="/home/deploy/sg-sst/backups"
DATE=$(date +%Y%m%d-%H%M%S)
DB_FILE="sg-sst.db"
BACKUP_FILE="sg-sst-${DATE}.db"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"

# Checkpoint WAL para consistencia
sqlite3 "$DATA_DIR/$DB_FILE" "PRAGMA wal_checkpoint(FULL);"

# Copia atómica
cp "$DATA_DIR/$DB_FILE" "$BACKUP_DIR/$BACKUP_FILE"

# Comprimir
gzip "$BACKUP_DIR/$BACKUP_FILE"

# Limpiar backups antiguos
find "$BACKUP_DIR" -name "sg-sst-*.db.gz" -mtime +$KEEP_DAYS -delete

echo "Backup completado: $BACKUP_FILE.gz"

# Opcional: Subir a S3/GCS
# aws s3 cp "$BACKUP_DIR/$BACKUP_FILE.gz" s3://tu-bucket/backups/
```

```bash
chmod +x scripts/backup.sh

# Cron diario a las 03:00
crontab -e
# 0 3 * * * /home/deploy/sg-sst/scripts/backup.sh >> /home/deploy/sg-sst/logs/backup.log 2>&1
```

### Restore

```bash
# Detener servicio
sudo systemctl stop sg-sst  # o pm2 stop sg-sst-api

# Restaurar
gunzip -c backups/sg-sst-20260115-030000.db.gz > data/sg-sst.db

# Iniciar servicio
sudo systemctl start sg-sst
```

---

## Monitoreo y Logs

### Logs Centralizados

```bash
# Journald (systemd)
sudo journalctl -u sg-sst -f

# PM2
pm2 logs sg-sst-api --lines 100

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Health Checks

```bash
# API
curl -f http://localhost:4000/api/health

# Frontend
curl -f https://tudominio.com/

# DB (SQLite)
sqlite3 data/sg-sst.db "PRAGMA integrity_check;"

# DB (PostgreSQL/Neon), sin imprimir credenciales
pnpm --dir server run backup:pg -- --url-env DATABASE_URL
```

### Métricas Básicas (Prometheus + Node Exporter - Opcional)

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - '9090:9090'

  node-exporter:
    image: prom/node-exporter
    ports:
      - '9100:9100'
```

---

## Checklist Pre-Despliegue

- [ ] Variables de entorno configuradas (.env)
- [ ] `SESSION_SECRET` generado seguro (64+ chars)
- [ ] SMTP configurado y probado
- [ ] DNS apuntando al servidor (A record)
- [ ] Puertos 80/443 abiertos en firewall
- [ ] `pnpm build` exitoso
- [ ] `pnpm test` pasa
- [ ] `pnpm lint` sin warnings
- [ ] `pnpm typecheck` sin errores
- [ ] `DB_BACKEND` y `DATABASE_URL` acordes al entorno elegido
- [ ] `migrate:pg` aplicado si `DB_BACKEND=pg` (sin migraciones pendientes)
- [ ] Backup configurado y probado (script SQLite o `backup:pg` + retención)
- [ ] Restore validado con `restore:pg --dir <backup>` en entorno separado
- [ ] SSL certificado obtenido (Let's Encrypt)
- [ ] Health check endpoint responde
- [ ] Logs rotados (logrotate configurado)
- [ ] Monitoreo básico configurado

---

## Rollback Rápido

```bash
# Docker
docker compose down
docker compose up -d --build  # versión anterior en git

# PM2
pm2 stop sg-sst-api
git checkout v1.2.3  # tag anterior
pnpm -w server run build
pm2 start ecosystem.config.cjs

# Systemd
sudo systemctl stop sg-sst
git checkout v1.2.3
pnpm -w server run build
sudo systemctl start sg-sst
```

---

## Estado de la migración a PostgreSQL

La migración a Neon ya está implementada en el backend (servicios `*.pg.ts`,
`DB_BACKEND=pg`, ETL y respaldo/restore). SQLite sigue como predeterminado
hasta que la empresa apruebe el corte. El plan y el estado por fase están en
[`PLAN_MIGRACION_NEON.md`](../PLAN_MIGRACION_NEON.md); no ejecute el ETL ni el
corte sobre producción sin aprobación explícita.

Para volúmenes que superen el respaldo lógico (decenas de miles de filas o
archivos muy grandes), complemente con `pg_dump`/`pg_restore` o branches de
Neon.
