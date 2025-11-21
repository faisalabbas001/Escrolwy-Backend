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

## ⚙️ **Background Workers**

| #   | Worker Name       | Database Schema  | Status     | Description                            |
| --- | ----------------- | ---------------- | ---------- | -------------------------------------- |
| 11  | **Sweep Workers** | Uses `wallet_db` | 🔜 Pending | Automated wallet sweeps, consolidation |
| 12  | **Custody Ops**   | Uses `wallet_db` | 🔜 Pending | Custody operations, key management     |

**Note:** Workers don't have separate schemas. They use existing service schemas.

---

## 📊 **Summary**

### **By Status:**

- ✅ **Ready:** 1 service (Auth Service)
- 🔜 **Pending:** 11 services/workers

### **By Type:**

- **Core Business Services:** 9 (with database schemas)
- **API Gateway:** 1 (BFF - no database)
- **Background Workers:** 2 (use existing schemas)

### **Total:** 12 services/workers

---

## 🗄️ **Database Schemas**

All services use **shared PostgreSQL instance** with separate schemas:

```
Aurora PostgreSQL (single instance)
├── auth_db          ✅ (Auth Service)
├── wallet_db        🔜 (Wallet Service)
├── ledger_db        🔜 (Ledger Service)
├── escrow_db        🔜 (Escrow Service)
├── inquiry_db       🔜 (Inquiry Service)
├── compliance_db    🔜 (Compliance Service)
├── admin_db         🔜 (Admin Service)
├── reporting_db     🔜 (Reporting Service)
└── notification_db  🔜 (Notification Service)
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

## 📝 **Next Steps**

1. ✅ **Auth Service** - Complete (ready for development)
2. 🔜 **Wallet Service** - Next to implement
3. 🔜 **Ledger Service** - After Wallet
4. 🔜 **Escrow Service** - After Ledger
5. 🔜 **BFF Service** - After core services
6. 🔜 **Other Services** - As needed

---

**Last Updated:** November 20, 2025
