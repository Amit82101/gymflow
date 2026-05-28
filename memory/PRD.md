# GymFlow — Admin Gym Management App (MVP)

## Overview
A premium dark-themed mobile-first admin app for gym owners to manage members, attendance, fees, and analytics. Built with React Native (Expo Router) + FastAPI + MongoDB + JWT auth.

## Tech Stack
- **Frontend:** React Native (Expo SDK 54), Expo Router, TypeScript
- **Backend:** FastAPI, Motor (async Mongo), PyJWT, bcrypt
- **Database:** MongoDB
- **Auth:** JWT (Bearer tokens), bcrypt hashed admin password
- **Storage:** SecureStore for token via `@/src/utils/storage`

## Features Implemented
1. **JWT Authentication** — single admin role, seeded from env on startup (`admin@gymflow.com / admin123`).
2. **Dashboard** — stat cards (active members, today check-ins, pending fees, expiring soon, monthly revenue), revenue bar chart, quick actions, last-7-days attendance line chart.
3. **Member Management** — list with search + filters (all/active/expiring/expired), CRUD (create with plan + photo + BMI), member detail with edit/delete and payment history.
4. **Attendance** — today's check-ins list, manual check-in via member picker, check-out, today/still-in stats.
5. **Fee Management** — pending fees list with "Collect" action, history tab, digital receipt screen (per payment), plan selector (monthly/quarterly/yearly), auto-extends member expiry on payment.
6. **Analytics** — separate screen with revenue (6mo bar), attendance (7d line), member growth (6mo bar), active vs inactive breakdown.

## Theme
- Background `#0A0A0A`, surface `#141414`, accent `#FF3B30`
- Bold uppercase typography, premium dark fitness aesthetic
- Bottom tab navigation (4 tabs)
- All interactive elements have `testID`

## Backend API (all prefixed `/api`)
- `POST /auth/login`, `GET /auth/me`
- `GET/POST/PUT/DELETE /members`, `GET /members/:id`
- `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance`, `GET /attendance/today`
- `POST /payments`, `GET /payments`, `GET /payments/pending`, `GET /payments/:id`
- `GET /dashboard/stats`, `GET /analytics/{revenue,attendance,member-growth}`

## Routes (frontend)
- `/login` — login screen
- `/(tabs)/dashboard` — admin dashboard
- `/(tabs)/members` — member list with search/filter
- `/(tabs)/attendance` — attendance management
- `/(tabs)/fees` — fee management & history
- `/member/new`, `/member/[id]` — create/detail/edit member
- `/receipt/[id]` — digital receipt
- `/analytics` — analytics charts

## Seed
Run `python /app/backend/seed_demo.py` to populate 6 demo members + sample attendance & payment.

## Out of Scope (deferred)
- Trainer/Member roles, workout/diet plans, member portal
- QR check-in (requires native build)
- Push notifications, WhatsApp/SMS, OTP
- Payment gateway integration (Stripe/Razorpay)
- AI workout/diet suggestions
- PDF/Excel export
