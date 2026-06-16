# 🏦 Escrowly — Backend Platform

> A production-grade, **event-driven microservices backend** for a multi-chain cryptocurrency **escrow & wallet** platform. Built with NestJS, PostgreSQL, Prisma, Kafka and Redis — with on-chain settlement across **5 blockchains**, double-entry accounting, and bank-grade security.

<p align="left">
  <img alt="Node" src="https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js&logoColor=white">
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white">
  <img alt="Kafka" src="https://img.shields.io/badge/Apache%20Kafka-Event%20Driven-231F20?logo=apachekafka&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white">
</p>

<p align="left">
  <a href="https://escrowly.com/"><img alt="Live" src="https://img.shields.io/badge/🌐_Live-escrowly.com-2563EB?style=for-the-badge"></a>
</p>

> 🌐 **Live platform:** [escrowly.com](https://escrowly.com/)

### 🖥️ Powering the platform

![Escrowly platform](../images/escrolwy-userdashbord.png)

*The public-facing Escrowly experience — every escrow, wallet, payout and KYC check shown here is driven by the microservices in this repository.*

![Escrowly Admin Dashboard](../images/escrolwy-admin1.png)

*The admin console reads its escrow stats, revenue, payouts and user data straight from these services through the BFF gateway.*

---

## 📋 Table of Contents

1. [What is Escrowly?](#-what-is-escrowly)
2. [Why this architecture matters](#-why-this-architecture-matters)
3. [System architecture](#-system-architecture)
4. [The microservices](#-the-microservices)
5. [The escrow lifecycle](#-the-escrow-lifecycle)
6. [Money & the double-entry ledger](#-money--the-double-entry-ledger)
7. [Multi-chain wallet engine](#-multi-chain-wallet-engine)
8. [Security model](#-security-model)
9. [API reference](#-api-reference)
10. [Tech stack](#-tech-stack)
11. [Getting started](#-getting-started)
12. [Environment variables](#-environment-variables)
13. [Project structure](#-project-structure)

---

## 🎯 What is Escrowly?

**Escrowly** is the backend for a crypto escrow marketplace. When two parties don't trust each other, Escrowly acts as the neutral middleman that **holds the funds on-chain** until both sides fulfil their side of the deal.

```
  Buyer wants to buy from Seller — but neither trusts the other.

  1.  Buyer & Seller agree on an escrow (amount, asset, chain, terms)
  2.  Buyer funds the escrow  →  funds are LOCKED by the platform
  3.  Seller sees the funds are secured and delivers the goods/service
  4.  Buyer inspects and confirms delivery
  5.  Escrowly RELEASES the funds on-chain to the Seller
        ↘ if something goes wrong → either side opens a DISPUTE → admin resolves
```

The platform supports **USDT / USDC** settlement across **Ethereum, BNB Smart Chain, Polygon, Solana and TRON**, custodial deposit wallets per user, an internal accounting ledger, KYC/AML compliance, support inquiries, transactional email, and a full admin back office.

---

## 💡 Why this architecture matters

This isn't a monolith with a single `routes` folder. It's a **distributed system** engineered around the realities of handling other people's money:

| Concern | How Escrowly solves it |
|---|---|
| **Money must never be lost or double-counted** | Every balance change is a **double-entry journal** (debits = credits). Nothing is mutated in place. |
| **Services must not lose events if Kafka is down** | **Transactional Outbox pattern** — events are written to the DB in the same transaction as the state change, then relayed to Kafka. |
| **Operations must be safely retryable** | **Idempotency keys** + `ProcessedEvent` tables guarantee an event is only acted on once. |
| **Blockchain is async & unreliable** | A dedicated **Listener Engine** watches chains block-by-block and emits confirmed deposit events. |
| **Blast radius must be contained** | Each domain is an **independent service with its own database schema** — auth can't write to the ledger's tables. |
| **The frontend should talk to one door** | A **BFF (Backend-for-Frontend) gateway** authenticates every request and fans out to internal services. |

---

## 🏗️ System architecture

```
                          ┌──────────────────────────────┐
                          │   Frontends (Admin + User)    │
                          │      React / Vite SPAs        │
                          └───────────────┬───────────────┘
                                          │  HTTPS  /api/v1/*
                                          ▼
                          ┌──────────────────────────────┐
                          │     BFF  —  API Gateway       │   • Validates JWT
                          │        (Port 3001)            │   • Routes & aggregates
                          └───────────────┬───────────────┘   • Single public surface
        ┌──────────────┬──────────────┬───┴───────────┬──────────────┬──────────────┐
        ▼              ▼              ▼               ▼              ▼              ▼
   ┌─────────┐    ┌─────────┐   ┌──────────┐    ┌─────────┐   ┌──────────┐   ┌────────────┐
   │  Auth   │    │ Escrow  │   │  Wallet  │    │ Ledger  │   │ Inquiry  │   │   Admin    │
   │  2FA    │    │  State  │   │ On-chain │    │ Double  │   │ Tickets  │   │ Blog/Help  │
   │  JWT    │    │ Machine │   │ Payouts  │    │  Entry  │   │ + WS     │   │  + S3      │
   └────┬────┘    └────┬────┘   └────┬─────┘    └────┬────┘   └────┬─────┘   └─────┬──────┘
        │              │             │               │             │              │
        └──────────────┴──────────────┴──── Apache Kafka ──────────┴──────────────┘
                        (transactional outbox · event-driven choreography)
        ┌──────────────┬──────────────┬───────────────┬──────────────┐
        ▼              ▼              ▼               ▼              ▼
  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐
  │ Compliance │ │Notification│ │   Listener   │ │ Reporting  │ │  Redis 7   │
  │  (Persona) │ │  (Resend)  │ │    Engine    │ │ & Alerts   │ │  sessions  │
  │  KYC/AML   │ │   email    │ │  5 chains    │ │            │ │  + cache   │
  └────────────┘ └────────────┘ └──────────────┘ └────────────┘ └────────────┘

                  ┌─────────────────────────────────────────────┐
                  │   PostgreSQL 16  —  schema-isolated per svc  │
                  │  auth_db · escrow_db · wallet_db · ledger_db │
                  │  inquiry_db · notification_db · admin_db ·   │
                  │  compliance_db · listener_engine_db          │
                  └─────────────────────────────────────────────┘
```

**Communication patterns**

- **Synchronous** (request/response): Frontend → BFF → service, for reads and user-initiated commands.
- **Asynchronous** (events): services publish domain events (`escrow.completed`, `wallet.deposit.detected`, …) to **Kafka**; interested services react independently (e.g. Notification sends an email, Ledger settles funds, Compliance updates risk).

---

## 🧩 The microservices

| Service | Port | Responsibility | Database schema |
|---|---|---|---|
| **BFF** | 3001 | API gateway — JWT validation, routing, response aggregation. The only public entry point. | — |
| **Auth** | 3000 | Registration, login, JWT issuance, **TOTP 2FA**, backup codes, password reset, OAuth, profile, KYC status mirror. | `auth_db` |
| **Escrow** | 3004 | Core **escrow state machine** + immutable transition audit trail, fee splits, SLA reminders. | `escrow_db` |
| **Wallet** | 3004 | Custodial wallet generation, on-chain **deposit detection & payout execution**, hot/funding/cold platform keys. | `wallet_db` |
| **Ledger** | 3005 | **Double-entry accounting** — accounts, journals, entries, reservations, internal/external transfers. | `ledger_db` |
| **Inquiry** | 3003 | Support tickets & messaging tied to escrows, attachments, **real-time chat via Socket.IO**. | `inquiry_db` |
| **Notification** | 3005 | Email delivery via **Resend**, per-user notification settings, Handlebars templates, delivery logs. | `notification_db` |
| **Listener Engine** | 3010–3015 | Block-by-block **blockchain event listeners** across 5 chains; emits confirmed transfer events. | `listener_engine_db` |
| **Compliance** | — | **KYC/AML** via **Persona**, risk scoring, per-user limits, webhook ingestion, audit log. | `compliance_db` |
| **Admin** | 3002 | Blog CMS, Help Desk / FAQ, file uploads to **AWS S3**. | `admin_db` |
| **Reporting** | — | Reporting & operational alerting. | — |

**Shared packages** (`/packages`): `auth-common` (JWT guards & decorators), `kafka-core` (consumer/producer patterns), `kafka-publisher` (outbox relay), `shared-config`, `chain-config` (per-chain blockchain settings).

---

## 🔄 The escrow lifecycle

The Escrow service is a **finite state machine**. Every transition is recorded as an immutable `EscrowTransition` row (who changed it, from→to, reason, metadata) — a tamper-evident audit trail.

```
   ┌───────────┐  accept   ┌──────────┐  pay     ┌──────────┐  ship     ┌──────────┐
   │ AGREEMENT │ ────────► │ ACCEPTED │ ───────► │ PAYMENT  │ ────────► │ DELIVERY │
   └───────────┘           └──────────┘          └──────────┘           └────┬─────┘
        │  cancel                                  funds reserved             │ inspect
        ▼                                          in ledger                  ▼
   ┌───────────┐                                                        ┌────────────┐
   │ CANCELLED │                                                        │ INSPECTION │
   └───────────┘                                                        └─────┬──────┘
                                                          satisfied ┌─────────┴────────┐ not satisfied
                                                                    ▼                  ▼
                                                            ┌────────────┐       ┌──────────┐
                                                            │ COMPLETION │       │ DISPUTED │
                                                            │ funds → ✅ │       │ admin ⚖  │
                                                            │   seller   │       └──────────┘
                                                            └────────────┘
```

| Step | Endpoint | What happens |
|---|---|---|
| Create | `POST /escrows` | New escrow in `agreement`; `escrow.created` event published. |
| Accept | `POST /escrows/:id/accept` | Parties agree → `accepted`; Ledger **reserves** buyer funds. |
| Payment | `POST /escrows/:id/payment` | Buyer funds the escrow on-chain → `payment`. |
| Delivery | `POST /escrows/:id/delivery` | Seller marks goods delivered → `delivery`. |
| Inspection | `POST /escrows/:id/inspection` | Buyer confirms receipt → `inspection`. |
| Complete | `POST /escrows/:id/complete` | Funds **released on-chain** to seller, fees taken → `completion`. |
| Dispute | `POST /escrows/:id/dispute` | Either party escalates → `disputed`; admin resolves (refund / split / release). |
| Cancel | `POST /escrows/:id/cancel` | Aborts before funding → `cancelled`. |

**Fees** are first-class: `EscrowFeeSplit` records exactly what % the buyer, seller and broker each pay, and fees post to the platform's ledger account on completion.

---

## 💰 Money & the double-entry ledger

Escrowly never just "updates a balance." Every movement of value is a **balanced journal** — total debits always equal total credits, the same principle banks use.

```
   Journal: escrow_pay_released
   ┌────────────────────────────────────┬──────────────┐
   │ Account                            │   Amount     │
   ├────────────────────────────────────┼──────────────┤
   │ Platform escrow-holding (reserved) │   −1,000 USDT │   (debit)
   │ Seller spendable                   │   +  970 USDT │   (credit)
   │ Platform fees                      │   +   30 USDT │   (credit)
   └────────────────────────────────────┴──────────────┘
                                            Σ = 0  ✅ always balances
```

**Core ledger models**

- **Account** — owned by a `user` or the `platform`, with a `purpose` (`spendable`, `reserved`, `fees`, `treasury_hot`), per `asset` + `chain`.
- **Journal** + **Entry** — a journal groups the `±` entries of one logical event; entries are the individual debits/credits.
- **Reservation** — funds locked for an in-flight escrow (`reserved` → `released` / `cancelled`).
- **Transfer** — internal (user→user) or external (user→on-chain address) value movement, guarded by an `idempotencyKey`.

Because everything is journaled, the platform can reconstruct any balance at any point in time and reconcile against the chain.

---

## ⛓️ Multi-chain wallet engine

The Wallet service is fully custodial and chain-agnostic, supporting three address families covering **5 networks**:

| Family | Chains | Library |
|---|---|---|
| `evm` | Ethereum · BNB Smart Chain · Polygon | **ethers v6** |
| `sol` | Solana | **@solana/web3.js** |
| `trc` | TRON | **tronweb** |

**How deposits & payouts flow**

```
  DEPOSIT                                   PAYOUT
  ───────                                   ──────
  User gets a unique deposit address        Ledger emits a payout request (Kafka)
        │                                          │
  Listener Engine scans blocks  ───────►    Wallet picks it up (idempotent on eventId)
        │ confirmed transfer                       │
  DepositTransaction recorded                Signs & broadcasts on-chain tx
        │                                          │
  Ledger credits user's spendable            PayoutRequest → fulfilled (txHash stored)
                                              └ retries logged in PayoutAttempt on failure
```

**Key management** is tiered — `hot`, `funding`, and `cold` `PlatformKey`s. Private keys are encrypted either locally or with **AWS KMS** (`ENCRYPTION_MODE=kms`). An auto-funding mechanism tops up hot wallets from funding wallets when they fall below per-chain thresholds.

---

## 🔐 Security model

- **Passwords** hashed with **Argon2** (memory-hard, the current best practice).
- **JWT** access tokens (15 min) + refresh tokens (7 days), HS256, with Redis-backed session tracking for real logout / logout-all.
- **TOTP 2FA** (`otplib`) with QR provisioning and encrypted single-use **backup codes**.
- **Role-based access** — `user`, `staff-website`, `super-admin`; `@Public()` decorator opts routes out of the global JWT guard.
- **Service-to-service auth** via a shared `SERVICE_TO_SERVICE_TOKEN` — internal services are never publicly exposed.
- **KYC/AML** through Persona with risk records and per-user transaction limits.
- **Private keys** encrypted at rest (local or AWS KMS).
- **Idempotency & outbox** prevent double-spends and lost events under failure.

---

## 📡 API reference

All routes are exposed through the **BFF** under the base path **`/api/v1`** and require a JWT unless marked _public_. Interactive **Swagger / OpenAPI** docs are served per service.

<details>
<summary><b>🔑 Auth</b></summary>

| Method | Path | Description |
|---|---|---|
| POST | `/auth/signup` | Register _(public)_ |
| POST | `/auth/login` | Login, optional MFA code _(public)_ |
| POST | `/auth/token/refresh` | Refresh access token _(public)_ |
| GET | `/auth/me` | Current user |
| PATCH | `/auth/profile` | Update profile |
| POST | `/auth/logout` · `/auth/logout-all` | End session(s) |
| POST | `/auth/2fa/setup` · `/2fa/disable` · `GET /2fa/status` | Manage 2FA |
| POST | `/auth/2fa/backup/consume` | Use a backup code |
| POST | `/auth/password/forgot` · `/password/reset` | Reset flow _(public)_ |
| POST | `/auth/password/change` | Change password |
| POST | `/auth/oauth/:provider/start` · `/callback` | OAuth _(public)_ |
</details>

<details>
<summary><b>🤝 Escrow</b></summary>

| Method | Path | Description |
|---|---|---|
| POST | `/escrows` | Create escrow |
| GET | `/escrows/me` | My escrows |
| GET | `/escrows/:id` · `/:id/history` | Escrow + state history |
| POST | `/escrows/:id/accept` · `/payment` · `/delivery` · `/inspection` · `/complete` · `/cancel` · `/dispute` | Drive the state machine |
</details>

<details>
<summary><b>💵 Ledger</b></summary>

| Method | Path | Description |
|---|---|---|
| GET | `/ledger/accounts/:id/balance` | Account balance |
| GET | `/ledger/users/:id/balances` | All balances for a user |
| POST/GET | `/ledger/transfers` · `/transfers/:id` | Transfers |
| POST/GET | `/ledger/internal/transfer` · `/:id` | User-to-user transfer |
| POST/GET | `/ledger/external/transfer` · `/:id` | On-chain withdrawal |
</details>

<details>
<summary><b>👛 Wallet</b></summary>

| Method | Path | Description |
|---|---|---|
| GET | `/wallets?user_id=` | User wallets |
| GET | `/wallets/platform` · `/platform/balances` | Platform wallets & balances |
</details>

<details>
<summary><b>💬 Inquiry</b></summary>

| Method | Path | Description |
|---|---|---|
| POST | `/inquiries` | Open inquiry |
| GET | `/inquiries/:inquiryId` · `/escrow/:escrowId` | Fetch inquiry |
| POST | `/inquiries/:inquiryId/close` | Close |
| POST/GET | `/inquiries/:inquiryId/messages` | Messages (paginated) |
| POST/GET | `/inquiries/:inquiryId/attachments` · `/upload` | Attachments |
</details>

<details>
<summary><b>🔔 Notifications & 📰 Admin/Blog</b></summary>

| Method | Path | Description |
|---|---|---|
| GET/PUT | `/notifications/settings` | Notification preferences |
| GET | `/notifications/user/:userId` | Notification history |
| GET | `/admin/blogs` · `/blogs/:id` · `/blogs/slug/:slug` | Blog (public reads) |
| POST/PATCH/DELETE | `/admin/blogs` · `/blogs/:id` | Manage posts |
| CRUD | `/admin/blogs/categories*` | Blog categories |
| POST | `/admin/upload` | Upload file to S3 |
</details>

---

## 🛠️ Tech stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js ≥ 20, TypeScript 5.9 |
| **Framework** | NestJS 10 (modular microservices) |
| **Database** | PostgreSQL 16 (schema-per-service), Prisma 6 ORM |
| **Messaging** | Apache Kafka (KafkaJS) — Redpanda-compatible in dev |
| **Cache / sessions** | Redis 7 (ioredis) |
| **Auth** | JWT (`@nestjs/jwt`, Passport), Argon2, otplib (TOTP), qrcode |
| **Blockchain** | ethers v6, @solana/web3.js, tronweb |
| **Cloud** | AWS S3 (storage), AWS KMS (key encryption) |
| **Email** | Resend |
| **KYC/AML** | Persona |
| **Real-time** | Socket.IO |
| **Docs** | Swagger / OpenAPI (`@nestjs/swagger`) |
| **Validation** | class-validator, class-transformer |
| **Containerization** | Docker + Docker Compose |

---

## 🚀 Getting started

### Prerequisites

- **Node.js ≥ 20** and **npm ≥ 10**
- **Docker** & **Docker Compose** (for Postgres, Redis, Kafka)

### Run the full stack

```bash
# 1. Clone & install
git clone <repo-url>
cd escrowly-backend
npm install

# 2. Configure environment (per service .env files — see below)
cp .env.example .env

# 3. Bring up infrastructure + all services
npm run docker:up        # start everything
npm run docker:logs      # stream logs
npm run docker:down      # stop everything
```

### Run a single service in watch mode

```bash
npm run auth:dev                 # start the Auth service with hot reload
npm run auth:prisma:migrate      # apply DB migrations
npm run auth:prisma:studio       # visual DB browser
npm run auth:prisma:generate     # regenerate the Prisma client
```

> The same `:<svc>:` script pattern works for each service (`auth`, `escrow`, `wallet`, `ledger`, …).

### Handy scripts

```bash
npm run docker:restart           # restart services
npm run docker:clean             # tear down + remove volumes
npm run test:bff                 # smoke-test the gateway
npm run test:auth:signup         # exercise the signup flow
npm run test:solana:deposit      # simulate a Solana deposit
npm run test:tron:withdrawal     # simulate a TRON payout
```

---

## ⚙️ Environment variables

Each service reads its own `.env`. The most important keys:

```bash
# ── Core ───────────────────────────────────────────────
NODE_ENV=development
PORT=3000
SERVICE_NAME=auth
LOG_LEVEL=info

# ── Database (schema-isolated per service) ─────────────
DATABASE_URL=postgresql://user:pass@localhost:5432/escrowly?schema=auth_db

# ── Auth / JWT ─────────────────────────────────────────
JWT_SECRET=<min-32-chars-shared-across-services>
JWT_ACCESS_TOKEN_EXPIRY=15m
JWT_REFRESH_TOKEN_EXPIRY=7d
SERVICE_TO_SERVICE_TOKEN=<internal-service-token>

# ── Redis ──────────────────────────────────────────────
REDIS_URL=redis://:password@localhost:6379

# ── Kafka ──────────────────────────────────────────────
KAFKA_ENABLED=true
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=auth-service
KAFKA_GROUP_ID=auth-consumer

# ── Blockchain RPCs ────────────────────────────────────
ETH_RPC_URL=...        BSC_RPC_URL=...      POLYGON_RPC_URL=...
SOLANA_RPC_URL=...     TRON_RPC_URL=...

# ── Wallet key management ──────────────────────────────
ENCRYPTION_MODE=local            # or "kms"
WALLET_ENCRYPTION_KEY=...        # local mode only
EVM_HOT_WALLET=...   SOL_HOT_WALLET=...   TRC_HOT_WALLET=...
EVM_FUNDING_THRESHOLD=0.1   EVM_FUNDING_AMOUNT=0.5   # auto top-up

# ── AWS ────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=...   AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1    S3_BUCKET=...

# ── Integrations ───────────────────────────────────────
RESEND_API_KEY=...               # email
PERSONA_API_KEY=...              # KYC
PERSONA_TEMPLATE_ID=...

# ── CORS ───────────────────────────────────────────────
FRONTEND_URL=http://localhost:5173
```

---

## 📂 Project structure

```
escrowly-backend/
├── services/                  # 11 independent NestJS microservices
│   ├── bff/                   # API gateway (public surface)
│   ├── auth/                  # identity, JWT, 2FA, OAuth
│   ├── escrow/                # escrow state machine + audit trail
│   ├── wallet/                # custodial wallets, on-chain payouts
│   ├── ledger/                # double-entry accounting
│   ├── inquiry/               # support tickets + Socket.IO chat
│   ├── notification/          # Resend email + templates
│   ├── listener-engine/       # blockchain block scanners (5 chains)
│   ├── compliance/            # Persona KYC/AML, risk, limits
│   ├── admin/                 # blog CMS, help desk, S3 uploads
│   └── reporting/             # reporting & alerts
├── packages/                  # shared libraries
│   ├── auth-common/           # JWT guards, decorators
│   ├── kafka-core/            # producer/consumer patterns
│   ├── kafka-publisher/       # transactional outbox relay
│   ├── shared-config/         # common configuration
│   └── chain-config/          # per-chain blockchain config
├── scripts/                   # DB init & helper scripts
├── docker-compose.yml         # full-stack orchestration
└── package.json               # workspace root + scripts
```

---

<p align="center">
  <i>Engineered with NestJS · Kafka · PostgreSQL · Prisma · Redis · Docker — designed for correctness, auditability, and scale.</i>
</p>
