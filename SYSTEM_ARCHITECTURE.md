# Adz10x — High-Level System Architecture

## Overview

Adz10x is a **society advertising platform** that connects **companies** (advertisers) with **societies** (residential complexes) for running campaigns. **Admin** manages master data, approvals, and platform settings.

---

## System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USERS / CLIENTS                                 │
├──────────────┬──────────────┬──────────────┬─────────────────────────────┤
│   Website    │   Portal     │   Portal     │   Portal                    │
│  (Public)    │  (Society)   │  (Company)   │  (Admin)                    │
│  adz10x.in   │  /society    │  /company    │  /admin                    │
└──────┬───────┴──────┬───────┴──────┬───────┴──────────────┬─────────────┘
       │              │              │                      │
       │              └──────────────┼──────────────────────┘
       │                             │
       ▼                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NGINX (Reverse Proxy)                             │
│              portal.adz10x.in  →  portal (static)                        │
│              api.adz10x.in     →  API (Node)                             │
└─────────────────────────────────────────────────────────────────────────┘
       │                             │
       │                             ▼
       │              ┌──────────────────────────────────────────────────┐
       │              │              API (Node.js / Express)              │
       │              │  • REST endpoints                                 │
       │              │  • JWT auth (Admin / Company / Society)            │
       │              │  • Business logic (campaigns, wallet, reports)   │
       │              └──────────────────────┬─────────────────────────────┘
       │                                     │
       │                                     ▼
       │              ┌──────────────────────────────────────────────────┐
       │              │              Database (PostgreSQL)                 │
       │              │  society_registration, company_registration,       │
       │              │  campaign, wallet, master_admin, etc.              │
       │              └──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Website: Marketing site, contact, chatbot (optional API calls)         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Repositories / Applications

| Repo       | Purpose | Tech | Deployed As |
|------------|--------|------|-------------|
| **api**    | Backend REST API, auth, business logic | Node.js, Express, Sequelize | api.adz10x.in |
| **portal** | Single web app for Society, Company, and Admin UIs | React, Vite, Redux, MUI | portal.adz10x.in |
| **website**| Public marketing site (landing, contact, policies) | React, Vite | adz10x.in (or same server) |

The **portal** is one React app with role-based routes:
- **/login**, **/society/** → Society users
- **/company/** → Company users  
- **/admin/login**, **/admin/** → Admin users

---

## User Roles & Flows

### Society
- Registers on the portal; admin approves (KYC) and can assign a **Relationship Manager**.
- Manages profile, **media rate cards** (e.g. lift branding, notice board), **ad slots** (days/times).
- Sees campaigns, advertisements, wallet, payments, reports.

### Company
- Registers on the portal; admin approves.
- **Creates campaigns**: selects platform (media type), city, area, date; API returns matching societies (by `kyc_status`/`account_status`, ad slots, media rates).
- Manages wallet, payments, users, reports.

### Admin
- Manages **master data**: cities, areas, sectors, campaign configuration.
- **Societies**: list, approve/reject, assign Relationship Manager, set commission, ad slots.
- **Companies**: list, approve/reject, assign Relationship Manager.
- **Campaigns / Ads**: view, approve; **Payments**: withdrawals, payouts.
- **System Users**: e.g. Relationship Managers (role in `master_admin`).
- Settings, notifications, reports.

---

## API Structure (High Level)

- **Base**: login/logout (society, company, admin), OTP, forgot password, contact, chatbot.
- **Society**: registration, profile, dashboard, advertisements, wallet, payments, reports, notifications.
- **Company**: registration, profile, dashboard, **campaigns** (create, list, get societies for campaign), wallet, payments, users, reports, notifications.
- **Admin**: dashboard, cities/areas/sectors, campaign configuration, societies CRUD + approve/assign RM, companies CRUD + approve/assign, campaigns/ads view/approve, payments, system users, settings, notifications, reports.

Auth: JWT in `Authorization: Bearer <token>`; middleware per role (`authenticateUser` for admin, `authenticateCompanyUser`, `authenticateSocietyUser`).

---

## Key Data Concepts

- **Society** → `society_registration` (+ profile, rate cards, ad slots). Approved when `kyc_status`/`account_status` = approved.
- **Company** → `company_registration` (+ profile, users). Approved similarly.
- **Campaign** → company creates; links to societies via **campaign logs**; has creative, dates, platform (media type).
- **Wallet** → company wallet for campaign spend; society wallet for earnings.
- **Master data** → cities, areas, sectors; campaign configuration (e.g. allowed days); media types aligned with society rate cards.

---

## Deployment (Typical)

- **Server**: e.g. DigitalOcean droplet.
- **Nginx**: serves portal static build (`/var/www/adz10x/portal/dist`) for portal.adz10x.in; proxies API to Node (e.g. api.adz10x.in → `http://localhost:3000`).
- **API**: Node process (e.g. `node server.js` or PM2).
- **Database**: PostgreSQL (e.g. `adz10x_db`); connection via API `.env`.

---

## Document Info

- **Scope**: High-level only; no class-level or file-level detail.
- **Audience**: Developers and stakeholders onboarding to the system.
- **Last updated**: 2026.
