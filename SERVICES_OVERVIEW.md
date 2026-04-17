# 📋 Escrowly Services Overview

Complete list of all microservices in the Escrowly platform.

---

## 🎯 **Core Services (9 Services)**

| #   | Service Name             | Database Schema   | Status       | Description                                    |
| --- | ------------------------ | ----------------- | ------------ | ---------------------------------------------- |
| 1   | **Auth Service**         | `auth_db`         | ✅ **READY** | User authentication, JWT tokens, sessions, MFA |
| 2   | **Wallet Service**       | `wallet_db`       | 🔜 Pending   | Crypto wallet management, addresses, balances  |
| 3   | **Ledger Service**       | `ledger_db`       | 🔜 Pending   | Transaction ledger, accounting, balances       |
| 4   | **Escrow Service**       | `escrow_db`       | 🔜 Pending   | Escrow transactions, releases, disputes        |
| 5   | **Inquiry Service**      | `inquiry_db`      | 🔜 Pending   | Customer support, tickets, inquiries           |
| 6   | **Compliance Service**   | `compliance_db`   | 🔜 Pending   | KYC/AML, verification, compliance checks       |
| 7   | **Admin Service**        | `admin_db`        | 🔜 Pending   | Admin dashboard, user management, settings     |
| 8   | **Reporting Service**    | `reporting_db`    | 🔜 Pending   | Analytics, reports, metrics, dashboards        |
| 9   | **Notification Service** | `notification_db` | 🔜 Pending   | Email, SMS, push notifications, templates      |

---

## 🌐 **API Gateway Service**

| #   | Service Name                   | Database Schema | Status     | Description                                    |
| --- | ------------------------------ | --------------- | ---------- | ---------------------------------------------- |
| 10  | **BFF (Backend for Frontend)** | None            | 🔜 Pending | API gateway, request routing, response shaping |

**Note:** BFF doesn't have its own database schema. It acts as a router/gateway to other services.

---

## ⛓️ **Blockchain Services**

| #   | Service Name           | Database Schema        | Status       | Description                                         |
| --- | ---------------------- | ---------------------- | ------------ | --------------------------------------------------- |
| 11  | **Listener Engine**    | `listener_engine_db`   | ✅ **READY** | Blockchain transfer event listener (5 chains)       |

**Note:** Listener Engine runs as 5 separate containers (one per chain: ETH, BSC, Polygon, Solana, Tron).

---

## ⚙️ **Background Workers**

| #   | Worker Name       | Database Schema  | Status     | Description                            |
| --- | ----------------- | ---------------- | ---------- | -------------------------------------- |
| 12  | **Sweep Workers** | Uses `wallet_db` | 🔜 Pending | Automated wallet sweeps, consolidation |
| 13  | **Custody Ops**   | Uses `wallet_db` | 🔜 Pending | Custody operations, key management     |

**Note:** Workers don't have separate schemas. They use existing service schemas.

---

## 📊 **Summary**

### **By Status:**

- ✅ **Ready:** 2 services (Auth Service, Listener Engine)
- 🔜 **Pending:** 11 services/workers

### **By Type:**

- **Core Business Services:** 9 (with database schemas)
- **Blockchain Services:** 1 (Listener Engine - 5 chain containers)
- **API Gateway:** 1 (BFF - no database)
- **Background Workers:** 2 (use existing schemas)

### **Total:** 13 services/workers

---

## 🗄️ **Database Schemas**

All services use **shared PostgreSQL instance** with separate schemas:

```
Aurora PostgreSQL (single instance)
├── auth_db              ✅ (Auth Service)
├── listener_engine_db   ✅ (Listener Engine)
├── wallet_db            🔜 (Wallet Service)
├── ledger_db            🔜 (Ledger Service)
├── escrow_db            🔜 (Escrow Service)
├── inquiry_db           🔜 (Inquiry Service)
├── compliance_db        🔜 (Compliance Service)
├── admin_db             🔜 (Admin Service)
├── reporting_db         🔜 (Reporting Service)
└── notification_db      🔜 (Notification Service)
```

**Note:** BFF and workers don't have their own schemas.

---

## 🏗️ **Service Dependencies**

### **Auth Service** (Ready)

- **Depends on:** None (foundational)
- **Used by:** All services (for authentication)

### **Wallet Service** (Pending)

- **Depends on:** Auth Service
- **Used by:** Escrow Service, Ledger Service

### **Ledger Service** (Pending)

- **Depends on:** Auth Service, Wallet Service
- **Used by:** Escrow Service, Reporting Service

### **Escrow Service** (Pending)

- **Depends on:** Auth Service, Wallet Service, Ledger Service
- **Used by:** Reporting Service, Admin Service

### **BFF Service** (Pending)

- **Depends on:** All services (routes to them)
- **Used by:** Client applications (web/mobile)

### **Other Services**

- **Inquiry Service:** Depends on Auth Service
- **Compliance Service:** Depends on Auth Service
- **Admin Service:** Depends on Auth Service, other services
- **Reporting Service:** Depends on Auth Service, other services
- **Notification Service:** Depends on Auth Service

---

## 🏗️ **Listener Engine Details**

The Listener Engine service monitors blockchain Transfer events for USDT, USDC, and DAI tokens:

| Chain    | Container Name         | Port  | Queue Name        |
| -------- | ---------------------- | ----- | ----------------- |
| Ethereum | `escrowly-listener-eth`| 3010  | `raw_events_eth`  |
| BSC      | `escrowly-listener-bnb`| 3011  | `raw_events_bnb`  |
| Polygon  | `escrowly-listener-poly`| 3012 | `raw_events_poly` |
| Solana   | `escrowly-listener-sol`| 3013  | `raw_events_sol`  |
| Tron     | `escrowly-listener-trc`| 3014  | `raw_events_trc`  |

---

## 📝 **Next Steps**

1. ✅ **Auth Service** - Complete (ready for development)
2. ✅ **Listener Engine** - Complete (5 chain listeners)
3. 🔜 **Wallet Service** - Next to implement
4. 🔜 **Ledger Service** - After Wallet
5. 🔜 **Escrow Service** - After Ledger
6. 🔜 **Worker Service** - Process events from Listener Engine
7. 🔜 **BFF Service** - After core services
8. 🔜 **Other Services** - As needed

---

**Last Updated:** December 2024
