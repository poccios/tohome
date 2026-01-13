# ToHome Monorepo

Monorepo contenente backend (Fastify) e frontend (Next.js) per l'applicazione ToHome.

## Struttura del progetto

```
ToHome/
├── backend/              # API Backend con Fastify
│   ├── src/
│   │   ├── db/
│   │   │   └── index.ts       # Layer database (query, transaction)
│   │   ├── middleware/
│   │   │   ├── auth.ts        # Middleware autenticazione JWT
│   │   │   ├── adminAuth.ts   # Middleware admin (x-admin-key)
│   │   │   └── rateLimiter.ts # Rate limiting
│   │   ├── routes/
│   │   │   ├── auth.ts        # Routes autenticazione
│   │   │   ├── me.ts          # Route profilo utente
│   │   │   ├── restaurants.ts # Routes ristoranti (pubblici) + menu
│   │   │   ├── orders.ts      # Routes ordini (client)
│   │   │   └── admin/
│   │   │       ├── restaurants.ts # Routes ristoranti (admin)
│   │   │       ├── menu.ts        # Routes menu (admin)
│   │   │       └── orders.ts      # Routes ordini (admin)
│   │   ├── repos/
│   │   │   ├── restaurantsRepo.ts # Repository layer ristoranti
│   │   │   ├── menuRepo.ts        # Repository layer menu
│   │   │   └── ordersRepo.ts      # Repository layer ordini
│   │   ├── email/
│   │   │   ├── EmailProvider.ts      # Interface Email provider
│   │   │   ├── SmtpEmailProvider.ts  # SMTP provider (Gmail)
│   │   │   └── index.ts              # Factory Email provider
│   │   ├── utils/
│   │   │   ├── crypto.ts      # Hashing e token generation (SHA256, OTP)
│   │   │   ├── jwt.ts         # JWT utilities
│   │   │   └── openNow.ts     # Calcolo orari apertura (Europe/Rome)
│   │   └── index.ts           # Entry point del server
│   ├── scripts/
│   │   └── migrate.ts         # Script per eseguire migrazioni
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_add_email_support.sql
│   │   ├── 003_add_email_otp.sql
│   │   ├── 004_restaurants.sql
│   │   ├── 005_menu.sql
│   │   └── 006_orders.sql
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                   # Variabili d'ambiente
│   └── .env.example
├── frontend/            # Frontend con Next.js
│   ├── src/
│   │   └── app/
│   │       ├── layout.tsx
│   │       └── page.tsx
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── .env.local       # Variabili d'ambiente
│   └── .env.local.example
├── package.json         # Root package.json per workspace
└── README.md
```

## Tecnologie utilizzate

### Backend
- Node.js + TypeScript
- Fastify (web framework)
- PostgreSQL + pg (database)
- jsonwebtoken (JWT per autenticazione)
- dotenv (gestione variabili d'ambiente)
- zod (validazione schema)
- @fastify/cookie (gestione cookie httpOnly)
- @fastify/cors (CORS configurato per frontend)
- nodemailer (SMTP Email provider per OTP)
- luxon (gestione timezone Europe/Rome per orari)

### Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript

## Setup iniziale

### 1. Prerequisiti

Assicurati di avere installato:
- Node.js (v18 o superiore)
- PostgreSQL (v14 o superiore)

### 2. Installazione dipendenze

Dalla root del progetto:

```bash
npm install
```

Questo installerà tutte le dipendenze per entrambi i progetti grazie ai workspaces.

### 3. Setup PostgreSQL

Crea un database PostgreSQL per il progetto:

```bash
# Accedi a PostgreSQL
psql -U postgres

# Crea il database
CREATE DATABASE tohome;

# Esci da psql
\q
```

### 4. Configurazione variabili d'ambiente

#### Backend

Copia il file `.env.example` in `.env` (già fatto per comodità):

```bash
cd backend
cp .env.example .env
```

Contenuto `.env`:
```
PORT=4000
FRONTEND_URL=http://localhost:3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tohome
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-in-production
ADMIN_API_KEY=your-admin-secret-key-minimum-32-characters-long

# Email Configuration
EMAIL_PROVIDER=smtp
APP_PUBLIC_URL=http://localhost:3000

# SMTP Configuration (required for EMAIL_PROVIDER=smtp)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=ToHome <no-reply@tohome.local>
```

**Importante:**
- Modifica `DATABASE_URL` con le tue credenziali PostgreSQL se diverse da quelle di default
- **CAMBIA** `JWT_SECRET` in produzione con una chiave segreta forte (minimo 32 caratteri)
- **CAMBIA** `ADMIN_API_KEY` in produzione con una chiave segreta forte (minimo 32 caratteri) - usata per endpoint admin (es: gestione ristoranti)

**Configurazione Email SMTP (Gmail):**
- `EMAIL_PROVIDER`: Impostare su `smtp` (usa Gmail SMTP)
- `APP_PUBLIC_URL`: URL pubblico dell'app (es: `https://tohome.it` in produzione)
- `SMTP_HOST`: Server SMTP (default: `smtp.gmail.com`)
- `SMTP_PORT`: Porta SMTP (default: `587` per TLS)
- `SMTP_USER`: Indirizzo email Gmail completo
- `SMTP_PASS`: **App Password** di Gmail (NON la password dell'account normale)
- `EMAIL_FROM`: Nome e indirizzo mittente mostrato nelle email

**Come ottenere una Gmail App Password:**
1. Vai su [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. Accedi con il tuo account Gmail
3. Seleziona "Mail" come app e il tuo dispositivo
4. Clicca "Genera" e copia la password di 16 caratteri
5. Usa quella password come `SMTP_PASS` (senza spazi)

#### Frontend

Copia il file `.env.local.example` in `.env.local` (già fatto per comodità):

```bash
cd frontend
cp .env.local.example .env.local
```

Contenuto `.env.local`:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

### 5. Eseguire le migrazioni del database

Dopo aver configurato PostgreSQL e le variabili d'ambiente, esegui le migrazioni:

```bash
cd backend
npm run migrate
```

Questo script:
- Crea automaticamente la tabella `schema_migrations` per tracciare le migrazioni eseguite
- Esegue tutti i file `.sql` nella cartella `migrations/` in ordine alfabetico
- Salta le migrazioni già eseguite
- Esegue ogni migrazione in una transazione (rollback automatico in caso di errore)

Output esempio:
```
Starting migrations...

✓ schema_migrations table ready
Found 1 pending migration(s)

Executing migration: 001_initial_schema.sql
✓ Migration completed: 001_initial_schema.sql

✓ All migrations completed successfully
```

#### Schema creato dalle migrazioni

**Migrazione `001_initial_schema.sql`** (schema iniziale):

- **users**: Utenti dell'applicazione
  - `id` (UUID), `phone_e164`, `name`, `email`, `status`, `created_at`, `last_login_at`

- **login_links**: Token di autenticazione via link
  - `id` (UUID), `phone_e164`, `token_hash`, `expires_at`, `used_at`, `device_id`, `ip_hash`, `created_at`

- **sessions**: Sessioni utente attive
  - `id` (UUID), `user_id` (FK), `refresh_token_hash`, `device_id`, `user_agent`, `ip_hash`, `expires_at`, `revoked_at`, `created_at`

**Migrazione `002_add_email_support.sql`** (supporto email):

- Aggiunge `email` (TEXT UNIQUE) alla tabella `users`
- Rende `phone_e164` nullable in `users`
- Aggiunge `email` (TEXT) alla tabella `login_links`
- Rende `phone_e164` nullable in `login_links`
- Aggiunge constraint CHECK: ogni record deve avere `email` OR `phone_e164` (non entrambi)
- Crea indici su `users.email` e `login_links.email`

**Migrazione `003_add_email_otp.sql`** (autenticazione OTP):

- Crea tabella `email_otp_challenges`:
  - `id` (UUID), `email`, `code_hash`, `expires_at`, `attempts`, `max_attempts`, `send_count`, `last_sent_at`, `locked_until`, `device_id`, `ip_hash`, `created_at`
- Crea indici su `(email, created_at DESC)` e `expires_at`
- Assicura `users.email` UNIQUE (idempotente)

#### Creare nuove migrazioni

Per creare una nuova migrazione:

1. Crea un nuovo file `.sql` in `backend/migrations/` con un nome numerato sequenziale (es. `002_add_user_preferences.sql`)
2. Scrivi il codice SQL della migrazione
3. Esegui `npm run migrate` per applicarla

Le migrazioni vengono eseguite in ordine alfabetico, quindi usa prefissi numerici (001_, 002_, ecc.).

## Comandi disponibili

### Database

#### Eseguire migrazioni
```bash
cd backend
npm run migrate
```

### Testing

#### Eseguire test backend
```bash
cd backend
npm test
```

#### Test in watch mode
```bash
cd backend
npm run test:watch
```

### Avvio in sviluppo

#### Entrambi i servizi (dalla root)
```bash
npm run dev
```

#### Solo backend
```bash
npm run dev:backend
```

#### Solo frontend
```bash
npm run dev:frontend
```

### Build

#### Build di entrambi (dalla root)
```bash
npm run build
```

#### Build singoli
```bash
npm run build:backend
npm run build:frontend
```

### Avvio in produzione

#### Entrambi i servizi (dalla root)
```bash
npm start
```

#### Singoli servizi
```bash
npm run start:backend
npm run start:frontend
```

## Endpoints API

### Backend (http://localhost:4000)

#### Health Check
- `GET /health` - Health check endpoint
  - Response: `{ "ok": true }`

#### Autenticazione

- **`POST /auth/email-otp/request`** - Richiedi codice OTP via Email
  - Body:
    ```json
    {
      "email": "string (valid email format)",
      "device_id": "string (optional)"
    }
    ```
  - **Rate Limiting**:
    - 1 richiesta per minuto per IP + email
    - 3 richieste per 10 minuti per IP + email
    - 10 richieste per giorno per IP + email
    - HTTP 429 se superato limite
  - Funzionamento:
    1. Verifica rate limits e check account lock
    2. Genera OTP 6 cifre random e lo hasha (SHA256)
    3. Crea record `email_otp_challenges` con `expires_at` (5 min)
    4. Invia email con codice OTP tramite SMTP (Gmail)
  - Response success: `{ "ok": true, "message": "OTP code sent" }`
  - Response rate limit: `{ "error": "Too many requests", "retryAfter": seconds }`
  - Response locked: `{ "error": "Account temporarily locked", "retryAfter": seconds }`

- **`POST /auth/email-otp/verify`** - Verifica codice OTP
  - Body:
    ```json
    {
      "email": "string (valid email format)",
      "code": "string (6 digits)",
      "device_id": "string (optional)"
    }
    ```
  - Funzionamento:
    1. Trova challenge più recente non scaduto
    2. Incrementa attempts counter
    3. Se attempts > 5 → lock account per 15 minuti
    4. Confronta hash del codice
    5. Se codice corretto:
       - Cancella challenge (one-time use)
       - Crea o trova user per email
       - Crea session con refresh_token (hash salvato in DB)
       - Genera access token JWT (15 min) e refresh token JWT (30 giorni)
       - Setta cookie httpOnly: `access_token` e `refresh_token`
  - Response success: `{ "ok": true }`
  - Response error: `{ "error": "Invalid code" }` o `{ "error": "Account locked" }`
  - Cookie settati:
    - `access_token`: httpOnly, 15 min, sameSite=lax
    - `refresh_token`: httpOnly, 30 giorni, sameSite=lax
    - `secure: true` in production
  - **Sicurezza**:
    - OTP valido 5 minuti
    - Max 5 tentativi per challenge
    - Lock account 15 minuti dopo 5 tentativi falliti
    - Codice eliminato dopo uso corretto (one-time)

- **`POST /auth/token/refresh`** - Rinnova access token usando refresh token
  - Legge `refresh_token` cookie
  - Verifica validità sessione in DB
  - Ruota refresh token (genera nuovo)
  - Genera nuovo access token
  - Aggiorna cookie con nuovi token
  - Response: `{ "ok": true }`

#### Profilo Utente

- **`GET /me`** - Ottieni informazioni utente corrente
  - Richiede: cookie `access_token` valido
  - Response:
    ```json
    {
      "user": {
        "id": "uuid",
        "phone": "string",
        "name": "string",
        "email": "string | null",
        "status": "string",
        "createdAt": "timestamp",
        "lastLoginAt": "timestamp"
      }
    }
    ```

#### Ristoranti (Pubblici)

- **`GET /restaurants`** - Lista ristoranti attivi
  - Query params (opzionali):
    - `open_now=true|false` - Filtra per ristoranti aperti ora
    - `zone=string` - Filtra per zona (es: "centro", "trastevere")
  - Response:
    ```json
    {
      "ok": true,
      "data": [
        {
          "id": "uuid",
          "slug": "string",
          "name": "string",
          "description": "string | null",
          "phone": "string | null",
          "address": "string",
          "city": "string",
          "zone": "string | null",
          "lat": "number | null",
          "lng": "number | null",
          "is_active": "boolean",
          "created_at": "timestamp",
          "is_open_now": "boolean",
          "hours": [
            {
              "day_of_week": "number (0-6, 0=Sunday)",
              "open_time": "string (HH:MM:SS)",
              "close_time": "string (HH:MM:SS)",
              "is_closed": "boolean"
            }
          ],
          "delivery_rules": {
            "id": "uuid",
            "restaurant_id": "uuid",
            "min_order_cents": "number",
            "delivery_fee_cents": "number",
            "eta_min": "number",
            "eta_max": "number"
          }
        }
      ]
    }
    ```
  - Esempi:
    ```bash
    # Lista tutti i ristoranti
    curl http://localhost:4000/restaurants

    # Solo ristoranti aperti ora
    curl http://localhost:4000/restaurants?open_now=true

    # Ristoranti in zona centro
    curl http://localhost:4000/restaurants?zone=centro

    # Ristoranti aperti in zona centro
    curl http://localhost:4000/restaurants?open_now=true&zone=centro
    ```

- **`GET /restaurants/:slug`** - Ottieni singolo ristorante per slug
  - Response: stesso formato di GET /restaurants ma singolo oggetto
  - Status 404 se ristorante non trovato

#### Ristoranti (Admin - Protetti)

**IMPORTANTE**: Tutti gli endpoint admin richiedono l'header `x-admin-key` con il valore di `ADMIN_API_KEY` configurato in `.env`.

```bash
# Setup ADMIN_API_KEY in .env
ADMIN_API_KEY=your-secret-key-min-32-chars
```

- **`POST /admin/restaurants`** - Crea nuovo ristorante
  - Richiede: header `x-admin-key`
  - Body:
    ```json
    {
      "slug": "string (optional, auto-generated from name)",
      "name": "string (required)",
      "description": "string (optional)",
      "phone": "string (optional)",
      "address": "string (required)",
      "city": "string (required)",
      "zone": "string (optional)",
      "lat": "number (optional)",
      "lng": "number (optional)",
      "is_active": "boolean (optional, default true)"
    }
    ```
  - Response: `{ "ok": true, "data": { restaurant } }`
  - Status 401 se header mancante o chiave invalida
  - Status 409 se slug già esistente
  - Esempio:
    ```bash
    curl -X POST http://localhost:4000/admin/restaurants \
      -H "x-admin-key: your-secret-key-min-32-chars" \
      -H "Content-Type: application/json" \
      -d '{
        "name": "Pizza da Mario",
        "address": "Via Roma 1",
        "city": "Roma",
        "zone": "centro",
        "phone": "+39061234567"
      }'
    ```

- **`PATCH /admin/restaurants/:id`** - Aggiorna ristorante (partial update)
  - Richiede: header `x-admin-key`
  - Body: campi opzionali da aggiornare (stesso formato di POST)
  - Response: `{ "ok": true, "data": { restaurant } }`
  - Status 404 se ristorante non trovato

- **`PUT /admin/restaurants/:id/hours`** - Sostituisci tutti gli orari
  - Richiede: header `x-admin-key`
  - Body:
    ```json
    {
      "hours": [
        {
          "day_of_week": "number (0-6, 0=Sunday)",
          "open_time": "string (HH:MM or HH:MM:SS)",
          "close_time": "string (HH:MM or HH:MM:SS)",
          "is_closed": "boolean (optional, default false)"
        }
      ]
    }
    ```
  - **Nota**: Elimina tutti gli orari esistenti e inserisce i nuovi (transazione atomica)
  - Response: `{ "ok": true, "message": "Hours updated successfully" }`
  - Status 404 se ristorante non trovato
  - Esempio:
    ```bash
    curl -X PUT http://localhost:4000/admin/restaurants/{id}/hours \
      -H "x-admin-key: your-secret-key-min-32-chars" \
      -H "Content-Type: application/json" \
      -d '{
        "hours": [
          { "day_of_week": 0, "open_time": "12:00", "close_time": "23:00" },
          { "day_of_week": 1, "open_time": "12:00", "close_time": "23:00" },
          { "day_of_week": 2, "open_time": "00:00", "close_time": "00:00", "is_closed": true }
        ]
      }'
    ```

- **`PUT /admin/restaurants/:id/delivery-rules`** - Aggiorna regole di consegna
  - Richiede: header `x-admin-key`
  - Body (tutti campi opzionali):
    ```json
    {
      "min_order_cents": "number (default 0)",
      "delivery_fee_cents": "number (default 0)",
      "eta_min": "number (default 25)",
      "eta_max": "number (default 45)"
    }
    ```
  - **Nota**: Upsert (crea se non esiste, aggiorna se esiste)
  - Response: `{ "ok": true, "data": { delivery_rules } }`
  - Status 404 se ristorante non trovato
  - Esempio:
    ```bash
    curl -X PUT http://localhost:4000/admin/restaurants/{id}/delivery-rules \
      -H "x-admin-key: your-secret-key-min-32-chars" \
      -H "Content-Type: application/json" \
      -d '{
        "min_order_cents": 1500,
        "delivery_fee_cents": 300,
        "eta_min": 30,
        "eta_max": 45
      }'
    ```

#### Menu Ristoranti (Pubblico)

- **`GET /restaurants/:slug/menu`** - Ottieni menu completo del ristorante
  - Response:
    ```json
    {
      "ok": true,
      "data": {
        "restaurant": {
          "id": "uuid",
          "slug": "string",
          "name": "string"
        },
        "categories": [
          {
            "id": "uuid",
            "name": "string",
            "sort_order": "number",
            "products": [
              {
                "id": "uuid",
                "name": "string",
                "description": "string | null",
                "image_url": "string | null",
                "base_price_cents": "number",
                "sort_order": "number",
                "allergens": "string | null",
                "option_groups": [
                  {
                    "id": "uuid",
                    "name": "string",
                    "min_select": "number",
                    "max_select": "number",
                    "sort_order": "number",
                    "items": [
                      {
                        "id": "uuid",
                        "name": "string",
                        "price_delta_cents": "number",
                        "sort_order": "number"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    }
    ```
  - **Note**:
    - Solo categorie, prodotti e opzioni con `is_active=true` sono inclusi
    - Ordinamento: `sort_order ASC, name ASC`
    - `price_delta_cents` può essere negativo (sconti) o positivo (supplementi)
  - Status 404 se ristorante non trovato

#### Menu Ristoranti (Admin - Protetti)

**IMPORTANTE**: Tutti gli endpoint admin menu richiedono l'header `x-admin-key`.

**Categorie:**

- **`POST /admin/restaurants/:restaurantId/categories`** - Crea categoria menu
  - Body:
    ```json
    {
      "name": "string (required)",
      "sort_order": "number (optional, default 0)",
      "is_active": "boolean (optional, default true)"
    }
    ```
  - Status 409 se categoria con stesso nome già esiste
  - Esempio:
    ```bash
    curl -X POST http://localhost:4000/admin/restaurants/{restaurantId}/categories \
      -H "x-admin-key: your-secret-key-min-32-chars" \
      -H "Content-Type: application/json" \
      -d '{"name": "Pizze", "sort_order": 0}'
    ```

- **`PATCH /admin/categories/:categoryId`** - Aggiorna categoria
  - Body: campi opzionali (name, sort_order, is_active)
  - Status 404 se categoria non trovata

**Prodotti:**

- **`POST /admin/restaurants/:restaurantId/products`** - Crea prodotto menu
  - Body:
    ```json
    {
      "category_id": "uuid (required)",
      "name": "string (required)",
      "description": "string (optional)",
      "image_url": "string url (optional)",
      "base_price_cents": "number >= 0 (required)",
      "sort_order": "number (optional, default 0)",
      "is_active": "boolean (optional, default true)",
      "allergens": "string (optional)"
    }
    ```
  - Status 409 se prodotto con stesso nome già esiste
  - Esempio:
    ```bash
    curl -X POST http://localhost:4000/admin/restaurants/{restaurantId}/products \
      -H "x-admin-key: your-secret-key-min-32-chars" \
      -H "Content-Type: application/json" \
      -d '{
        "category_id": "{categoryId}",
        "name": "Margherita",
        "description": "Pomodoro e mozzarella",
        "base_price_cents": 800,
        "allergens": "Glutine, Lattosio"
      }'
    ```

- **`PATCH /admin/products/:productId`** - Aggiorna prodotto
  - Body: campi opzionali (stesso formato di POST)
  - Status 404 se prodotto non trovato

- **`DELETE /admin/products/:productId`** - Elimina prodotto (soft delete)
  - Imposta `is_active=false`
  - Il prodotto non appare più nel menu pubblico
  - Response: `{ "ok": true, "message": "Product deleted successfully" }`

**Opzioni Prodotto:**

- **`PUT /admin/products/:productId/options`** - Sostituisci tutte le opzioni del prodotto
  - Body:
    ```json
    {
      "groups": [
        {
          "name": "string (required)",
          "min_select": "number >= 0 (required)",
          "max_select": "number >= min_select (required)",
          "sort_order": "number (optional, default 0)",
          "items": [
            {
              "name": "string (required)",
              "price_delta_cents": "number (required, può essere negativo)",
              "is_active": "boolean (optional, default true)",
              "sort_order": "number (optional, default 0)"
            }
          ]
        }
      ]
    }
    ```
  - **Nota**: Elimina TUTTI i gruppi/opzioni esistenti e inserisce i nuovi (transazione atomica)
  - `price_delta_cents` negativo = sconto, positivo = supplemento
  - Status 404 se prodotto non trovato
  - Status 400 se `max_select < min_select`
  - Esempio:
    ```bash
    curl -X PUT http://localhost:4000/admin/products/{productId}/options \
      -H "x-admin-key: your-secret-key-min-32-chars" \
      -H "Content-Type: application/json" \
      -d '{
        "groups": [
          {
            "name": "Dimensione",
            "min_select": 1,
            "max_select": 1,
            "items": [
              {"name": "Normale", "price_delta_cents": 0, "sort_order": 0},
              {"name": "Maxi", "price_delta_cents": 300, "sort_order": 1}
            ]
          },
          {
            "name": "Extra",
            "min_select": 0,
            "max_select": 3,
            "items": [
              {"name": "Mozzarella extra", "price_delta_cents": 150},
              {"name": "Sconto studenti", "price_delta_cents": -100}
            ]
          }
        ]
      }'
    ```

#### Ordini (Client - Protetti con JWT)

**IMPORTANTE**: Tutti gli endpoint ordini richiedono autenticazione tramite cookie `access_token` (JWT).

- **`POST /orders`** - Crea nuovo ordine
  - Richiede: cookie `access_token` valido
  - Body:
    ```json
    {
      "restaurant_id": "uuid (required)",
      "payment_method": "ONLINE | CASH (required)",
      "delivery_address": {
        "street": "string (required)",
        "city": "string (required)",
        "postal_code": "string (required)",
        "notes": "string (optional)"
      },
      "items": [
        {
          "product_id": "uuid (required)",
          "qty": "number > 0 (required)",
          "options": [
            {
              "group_id": "uuid (required)",
              "item_id": "uuid (required)"
            }
          ]
        }
      ],
      "notes": "string (optional)"
    }
    ```
  - **Logica**:
    - Valida ristorante attivo e aperto
    - Valida prodotti attivi e opzioni (min/max select)
    - Verifica min_order_cents (da restaurant_delivery_rules)
    - Crea snapshot prezzi (non cambiano se menu cambia)
    - **CASH**: auto-accept → status=ACCEPTED, payment_status=PAID
    - **ONLINE**: status=CREATED, payment_status=PENDING (richiede /pay)
  - Response: `{ "ok": true, "data": { order con items e options } }`
  - Status 400 se:
    - Ristorante chiuso o non attivo
    - Carrello vuoto
    - Prodotto non attivo
    - Opzioni non rispettano min/max select
    - Ordine sotto minimo
  - Status 404 se ristorante/prodotto non trovato
  - Esempio:
    ```bash
    curl -X POST http://localhost:4000/orders \
      -H "Cookie: access_token=YOUR_JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "restaurant_id": "uuid",
        "payment_method": "CASH",
        "delivery_address": {
          "street": "Via Roma 123",
          "city": "Roma",
          "postal_code": "00100"
        },
        "items": [
          {
            "product_id": "uuid",
            "qty": 2,
            "options": [
              {"group_id": "uuid", "item_id": "uuid"}
            ]
          }
        ]
      }'
    ```

- **`GET /orders/:orderId`** - Ottieni dettagli ordine
  - Richiede: cookie `access_token` valido
  - Verifica ownership (solo proprietario può vedere)
  - Response:
    ```json
    {
      "ok": true,
      "data": {
        "id": "uuid",
        "user_id": "uuid",
        "restaurant_id": "uuid",
        "status": "CREATED | PAID | ACCEPTED | PREPARING | READY | PICKED_UP | DELIVERING | DELIVERED | CANCELLED",
        "payment_method": "ONLINE | CASH",
        "payment_status": "PENDING | PAID",
        "subtotal_cents": "number",
        "delivery_fee_cents": "number",
        "service_fee_cents": "number",
        "total_cents": "number",
        "address_json": "object",
        "notes": "string | null",
        "created_at": "timestamp",
        "updated_at": "timestamp",
        "items": [
          {
            "id": "uuid",
            "product_id": "uuid | null",
            "name": "string (snapshot)",
            "unit_price_cents": "number (snapshot)",
            "qty": "number",
            "total_cents": "number",
            "options": [
              {
                "group_name": "string (snapshot)",
                "item_name": "string (snapshot)",
                "price_delta_cents": "number (snapshot)"
              }
            ]
          }
        ]
      }
    }
    ```
  - Status 404 se ordine non trovato o non di proprietà dell'utente

- **`GET /orders`** - Lista ordini utente corrente
  - Richiede: cookie `access_token` valido
  - Query params (opzionali):
    - `limit=number` - Numero massimo risultati (default: 20)
    - `offset=number` - Offset paginazione (default: 0)
  - Response: `{ "ok": true, "data": [array di ordini] }`
  - Ordinamento: created_at DESC (più recenti prima)

- **`POST /orders/:orderId/pay`** - Paga ordine ONLINE (mock payment)
  - Richiede: cookie `access_token` valido
  - Solo per ordini con payment_method=ONLINE
  - Aggiorna: payment_status=PAID, status=ACCEPTED
  - Response: `{ "ok": true, "data": { order aggiornato } }`
  - Status 400 se:
    - Ordine già pagato
    - Metodo pagamento non è ONLINE
  - Status 404 se ordine non trovato o non di proprietà

#### Ordini (Admin - Protetti)

- **`PATCH /admin/orders/:orderId/status`** - Aggiorna stato ordine
  - Richiede: header `x-admin-key`
  - Body:
    ```json
    {
      "status": "CREATED | PAID | ACCEPTED | PREPARING | READY | PICKED_UP | DELIVERING | DELIVERED | CANCELLED"
    }
    ```
  - Response: `{ "ok": true, "data": { order aggiornato } }`
  - Status 404 se ordine non trovato
  - Status 400 se status non valido
  - Esempio:
    ```bash
    curl -X PATCH http://localhost:4000/admin/orders/{orderId}/status \
      -H "x-admin-key: your-secret-key-min-32-chars" \
      -H "Content-Type: application/json" \
      -d '{"status": "PREPARING"}'
    ```

**Note importanti**:
- Ordini CASH: auto-accepted (status=ACCEPTED, payment_status=PAID)
- Ordini ONLINE: richiedono POST /orders/:id/pay per passare ad ACCEPTED
- **Price snapshots**: prezzi e nomi congelati al momento dell'ordine
- Workflow status: CREATED → PAID → ACCEPTED → PREPARING → READY → PICKED_UP → DELIVERING → DELIVERED
- Status CANCELLED può essere settato in qualsiasi momento

#### Calcolo `is_open_now`

Il campo `is_open_now` viene calcolato server-side usando il timezone **Europe/Rome** e gli orari del ristorante:
- Verifica giorno della settimana corrente (0=Domenica, 6=Sabato)
- Controlla se l'ora corrente è dentro uno slot aperto
- Gestisce slot che attraversano la mezzanotte (es: 19:00-02:00)
- Ignora slot con `is_closed=true`

## Frontend (http://localhost:3000)

La pagina principale mostra:
- Titolo "ToHome"
- Stato del backend chiamando `GET /health`
- Indicatore visivo dello stato (verde se ok, rosso se errore)

## Sviluppo locale

1. Assicurati di aver eseguito le migrazioni:
```bash
cd backend
npm run migrate
```

2. Avvia il backend:
```bash
npm run dev:backend
```

Il server sarà disponibile su `http://localhost:4000`

3. In un altro terminale, avvia il frontend:
```bash
npm run dev:frontend
```

Il frontend sarà disponibile su `http://localhost:3000`

4. Apri il browser su `http://localhost:3000` per vedere l'applicazione

## Testing

Il backend usa **Vitest** per i test con **Supertest** per testare gli endpoint Fastify.

### Setup Database Test

Prima di eseguire i test, crea un database PostgreSQL separato per i test:

```bash
psql -U postgres -c "CREATE DATABASE tohome_test;"
```

Esegui le migrazioni sul database di test:

```bash
# Usa DATABASE_URL del database test
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tohome_test npm run migrate
```

### Configurazione Test

Il file `.env.test` contiene la configurazione per i test:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tohome_test
SMS_PROVIDER=mock
NODE_ENV=test
```

- **Database separato**: `tohome_test` per non interferire con dati di sviluppo
- **Mock SMS**: `SMS_PROVIDER=mock` forzato nei test
- **Reset automatico**: Tutte le tabelle vengono troncate prima di ogni test

### Eseguire i Test

```bash
cd backend

# Esegui tutti i test una volta
npm test

# Esegui i test in watch mode (utile durante sviluppo)
npm run test:watch
```

### Test Implementati

#### Health Endpoint (`tests/health.test.ts`)
- Verifica che `GET /health` ritorni `{ ok: true }`

#### Auth Endpoints (`tests/auth.test.ts`)
- **POST /auth/sms-link/request**:
  - Crea login link con numero valido
  - Rifiuta formato telefono non valido
  - Rifiuta richiesta senza telefono
  - Funziona senza device_id
- **POST /auth/sms-link/verify**:
  - Verifica token valido
  - Setta cookie httpOnly (access_token + refresh_token)
  - Rifiuta token non valido
  - Rifiuta token già usato (one-time use)

#### Auth Request Integration Tests (`tests/auth-request.integration.test.ts`)
Test completi per POST /auth/sms-link/request con assertions su DB:

- **Caso 1: Numero valido**
  - HTTP 200 OK
  - Record `login_links` creato in DB
  - `used_at` = NULL
  - `expires_at` valido (~10 min futuro)
  - `token_hash` SHA256 (64 char)

- **Caso 2: Rate limit 1/minuto**
  - Primo request → 200 OK
  - Secondo request immediato → 429 Too Many Requests
  - `retryAfter` presente in response
  - Solo 1 record in DB

- **Caso 3: Rate limit 3/10 minuti**
  - Request 1, 2, 3 → 200 OK
  - Request 4 → 429 Too Many Requests
  - Solo 3 record in DB

- **Caso 4: Challenge in DB**
  - `expires_at` corretto (10 min)
  - `token_hash` != token plain
  - `ip_hash` presente
  - `device_id` salvato correttamente

- **Caso 5: Mock SMS**
  - Verifica `SMS_PROVIDER=mock` in test
  - Nessun SMS reale inviato
  - Link ritornato in response (dev mode)

#### Auth Verify Integration Tests (`tests/auth-verify.integration.test.ts`)
Test completi per POST /auth/sms-link/verify con assertions su DB e cookies:

- **Caso 1: Token valido → login OK**
  - HTTP 200 OK
  - User creato se non esiste (con default name)
  - User riutilizzato se esiste
  - `login_links.used_at` settato
  - Session creata in DB
  - `last_login_at` aggiornato

- **Caso 2: Token usato 2 volte → secondo 401**
  - Primo verify → 200 OK
  - Secondo verify con stesso token → 400
  - Solo 1 user e 1 session in DB
  - Race condition prevented (atomic update)

- **Caso 3: Token scaduto → 401**
  - Token expired → 400
  - No user creato
  - No session creata
  - `used_at` rimane NULL

- **Caso 4: Cookie access + refresh presenti**
  - `access_token` cookie: HttpOnly, 15 min, SameSite=Lax
  - `refresh_token` cookie: HttpOnly, 30 giorni, SameSite=Lax
  - JWT format valido (3 parti)
  - Payload contiene `userId`, `phone`, `exp`
  - Token diversi per login diversi

- **Caso 5: User creato se non esiste**
  - Primo login → user creato
  - Secondo login → user riutilizzato (stesso ID)
  - Phone diverse → user diversi
  - Default values: `status='active'`, `email=null`

#### Auth Refresh Integration Tests (`tests/auth-refresh.integration.test.ts`)
Test completi per POST /auth/token/refresh con token rotation e revocation:

- **Caso 1: Refresh valido → nuovi cookie**
  - HTTP 200 OK con `{ ok: true }`
  - Nuovi cookie `access_token` e `refresh_token`
  - Token diversi da precedenti (rotation)
  - `sessions.refresh_token_hash` aggiornato in DB
  - `sessions.expires_at` esteso (30 giorni)
  - JWT payload corretto (`userId`, `phone`, `exp`)
  - Cookie attributes: HttpOnly, SameSite=Lax, Max-Age

- **Caso 2: Refresh ruotato → vecchio non valido**
  - Primo refresh → 200 OK con nuovi token
  - Secondo refresh con vecchi token → 401
  - Terzo refresh con nuovi token → 200 OK
  - `refresh_token_hash` diverso ad ogni rotation
  - Session ID rimane invariato
  - Multiple rotations mantengono continuità

- **Caso 3: Refresh revocato → 401**
  - Session revocata (`revoked_at` NOT NULL) → 401
  - Message: "revoked"
  - `refresh_token_hash` non aggiornato
  - Multiple sessions: solo non-revoked funzionano

- **Edge cases**:
  - Missing refresh token → 401
  - Invalid JWT → 401
  - Session expired → 401
  - Session deleted → 401
  - User mismatch → 401
  - Concurrent refresh requests handled

### Struttura Test

```
backend/tests/
├── setup.ts                           # Setup globale (carica .env.test)
├── helpers/
│   ├── app.ts                        # Crea app Fastify per test
│   └── db.ts                         # Helper reset database
├── health.test.ts                    # Test health endpoint (1 test)
├── auth.test.ts                      # Test auth endpoints (8 test)
├── auth-request.integration.test.ts  # Test integrazione auth request (15 test)
└── auth-verify.integration.test.ts   # Test integrazione auth verify (18 test)
```

### Note sui Test

- **Isolamento**: Ogni test resetta il DB (truncate tabelle)
- **MockSmsProvider**: SMS non inviati realmente, solo loggati
- **No server listen**: Supertest usa app.server direttamente
- **Cookie testing**: Verifica presenza e formato cookie httpOnly
- **Database pool**: Chiuso dopo ogni suite test

### Aggiungere Nuovi Test

Esempio di nuovo test:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers/app';
import { resetDatabase, closeDatabasePool } from './helpers/db';

describe('My Feature', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
    await app.ready();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await closeDatabasePool();
  });

  it('should do something', async () => {
    const response = await request(app.server)
      .get('/my-endpoint');

    expect(response.status).toBe(200);
  });
});
```

## Integrazione Email con Gmail SMTP

L'applicazione supporta l'invio di email di autenticazione tramite Gmail SMTP per i codici OTP (One-Time Password).

### Architettura Email Provider

Il sistema usa un pattern adapter con implementazione SMTP:

**SmtpEmailProvider** (usando nodemailer):
   - Invio email via Gmail SMTP (smtp.gmail.com:587)
   - Supporta TLS per connessioni sicure
   - Richiede Gmail App Password (non password normale)
   - Configurabile per altri provider SMTP

### Configurazione Gmail SMTP

Per usare l'invio email in produzione:

1. **Crea una Gmail App Password**:
   - Vai su [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Accedi con il tuo account Gmail
   - Seleziona "Mail" come app e il tuo dispositivo
   - Clicca "Genera" e copia la password di 16 caratteri
   - **Nota**: L'account Gmail deve avere la verifica in due passaggi attivata

2. **Configura variabili d'ambiente**:
   ```env
   EMAIL_PROVIDER=smtp
   APP_PUBLIC_URL=https://tohome.it
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password-16-chars
   EMAIL_FROM=ToHome <no-reply@tohome.local>
   ```

3. **Avvia il server** - il provider SMTP sarà attivato automaticamente

### Flusso Email OTP Authentication

```
1. POST /auth/email-otp/request con email
   ↓
2. Backend genera OTP 6 cifre + crea email_otp_challenges in DB (expires 5 min)
   ↓
3. SmtpEmailProvider.send():
   a. Connessione a Gmail SMTP (TLS)
   b. Autenticazione con SMTP_USER e SMTP_PASS
   c. Invio email con codice OTP
   ↓
4. Email inviata con codice OTP: 123456
   ↓
5. Utente inserisce codice nella UI → POST /auth/email-otp/verify → login
```

### Contenuto Email

Oggetto: **Codice ToHome**

Corpo (plain text):
```
Ciao,

Il tuo codice di accesso è: 123456

Il codice è valido per 5 minuti.

Se non hai richiesto questo codice, ignora questa email.

--
ToHome
```

### Gestione Errori Email

- **Email send fallisce**: HTTP 502 con `{ ok: false, error: "EMAIL_SEND_FAILED" }`
- **OTP expires**: Codice OTP valido 5 minuti
- **SMTP errors**: Loggati nel backend senza esporre credenziali
- **Invalid credentials**: Errore al startup del server
- **Too many attempts**: Account locked 15 minuti dopo 5 tentativi falliti

### Test con curl

**Development - Request OTP**:
```bash
curl -X POST http://localhost:4000/auth/email-otp/request \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","device_id":"test-device"}'

# Response:
# { "ok": true, "message": "OTP code sent" }
# Email inviata con codice 6 cifre
```

**Development - Verify OTP**:
```bash
curl -X POST http://localhost:4000/auth/email-otp/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","code":"123456","device_id":"test-device"}'

# Response (se codice corretto):
# { "ok": true }
# Cookie access_token e refresh_token settati
```

**Production**:
```bash
curl -X POST https://tohome.it/api/auth/email-otp/request \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","device_id":"device-123"}'

# Response:
# { "ok": true, "message": "OTP code sent" }
# Email inviata via Gmail SMTP
```

### Note SMTP Gmail

- **App Password obbligatoria**: Non usare mai la password normale dell'account
- **Verifica in due passaggi**: Deve essere attiva per generare App Password
- **Limiti Gmail**: ~500 email/giorno per account Gmail gratuito
- **Alternative SMTP**: Il codice supporta qualsiasi server SMTP (cambiare SMTP_HOST e SMTP_PORT)
- **TLS**: Porta 587 usa TLS automaticamente (secure: false + STARTTLS)

## Architettura Autenticazione

### Sistema JWT con Cookie HttpOnly

L'applicazione implementa un sistema di autenticazione basato su:

1. **Login via Email OTP (One-Time Password)**
   - Viene generato un codice OTP di 6 cifre random
   - Il codice viene hashato (SHA256) e salvato in `email_otp_challenges`
   - Il codice OTP viene inviato via email tramite Gmail SMTP
   - L'utente inserisce il codice nella UI (2-step flow)
   - Max 5 tentativi per challenge, poi lock 15 minuti
   - Il codice scade dopo 5 minuti
   - Alla verifica corretta, il challenge viene eliminato (one-time use)

2. **Token JWT Dual**
   - **Access Token**: JWT di breve durata (15 minuti) contenente `userId` e `phone` (backward compatibility)
   - **Refresh Token**: JWT di lunga durata (30 giorni) contenente `userId` e `sessionId`
   - Entrambi salvati in cookie httpOnly per sicurezza

3. **Gestione Sessioni**
   - Ogni login crea una `session` nel database
   - Il refresh token (hash) è salvato in DB per validazione
   - Token rotation: ogni refresh genera un nuovo refresh token

4. **Sicurezza**
   - Cookie httpOnly: non accessibili da JavaScript (XSS protection)
   - sameSite=lax: protezione CSRF
   - secure=true in production (HTTPS only)
   - Hash SHA256 per codici OTP
   - Validazione atomica con transactions
   - Rate limiting per email + IP (1/min, 3/10min, 10/day)
   - Brute force protection: max 5 tentativi, poi lock 15 min
   - OTP one-time use (eliminato dopo verifica corretta)
   - OTP scadenza 5 minuti

5. **Middleware Authentication**
   - `authenticate` middleware verifica access token dai cookie
   - Inietta `request.user` per route protette
   - Utilizzato da endpoint come `GET /me`

### Flusso di Autenticazione

```
1. POST /auth/email-otp/request → Email con OTP 6 cifre
   ↓
2. Utente inserisce OTP nella UI → POST /auth/email-otp/verify
   ↓
3. Verifica codice + Crea/trova user + Crea session
   ↓
4. Genera JWT (access + refresh) → Cookie httpOnly
   ↓
5. Client può chiamare GET /me (usa access token)
   ↓
6. Access token scade → POST /auth/token/refresh
   ↓
7. Verifica refresh token + Ruota token → Nuovi cookie
```

## Note

- Il backend è configurato con CORS per accettare richieste da `http://localhost:3000`
- Il frontend chiama automaticamente l'endpoint `/health` del backend al caricamento della pagina
- Entrambi i progetti usano TypeScript con configurazione strict
- Il monorepo usa npm workspaces per la gestione delle dipendenze
- Il layer database (`backend/src/db/index.ts`) espone funzioni `query()` e `transaction()` per interagire con PostgreSQL
- Le migrazioni SQL sono file-based senza librerie esterne, gestite dallo script `migrate.ts`
- Sistema di autenticazione con JWT e cookie httpOnly per massima sicurezza
