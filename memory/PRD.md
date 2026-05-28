# GymFlow — Admin Gym Management App

## Overview
A premium dark-themed mobile-first admin app for gym owners to manage members (with QR-based attendance), check-ins, fees, and analytics. Built with React Native (Expo Router) + FastAPI + MongoDB + JWT auth.

## Tech Stack
- **Frontend:** React Native (Expo SDK 54), Expo Router, TypeScript, expo-camera
- **Backend:** FastAPI, Motor (async Mongo), PyJWT, bcrypt, qrcode[pil]
- **Database:** MongoDB
- **Auth:** JWT (Bearer tokens), bcrypt hashed admin password
- **Storage:** SecureStore via `@/src/utils/storage`

## Features

### Auth
- JWT login, admin seeded at startup (`admin@gymflow.com / admin123`).

### Dashboard
- Bento stat cards: active members, today check-ins, pending fees, expiring soon.
- Hero revenue card with 6-month bar chart.
- Quick actions: SCAN QR · ADD MEMBER · COLLECT FEE.
- Last-7-days attendance line chart.

### Member Management
- CRUD with photo, plan, BMI auto-calc, address, emergency contact, notes.
- Auto-generates unique member ID + **QR code (PNG base64)** containing `{v, gym, id, name, exp}`.
- Search + status filters (all/active/expiring/expired).
- Member detail with **VIEW QR & SEND** action.

### QR Attendance
- `/scanner` — full-screen camera (expo-camera) with corner-frame overlay.
- On web preview, falls back to a "Simulate Scan" button (camera doesn't work in headless).
- Backend `POST /api/attendance/scan` accepts JSON payload or raw member-id:
  - `checked_in` → first scan of day
  - `duplicate` → within 10-minute window
  - `checked_out` → auto check-out after window (still inside)
  - `expired` → blocks attendance, shows "Membership Expired" alert
- Result sheet shows member name, photo, plan badge, membership + fee status.

### Member QR Card + WhatsApp
- `/member/[id]/qr` — premium QR card with brand, member ID, validity.
- **SEND VIA WHATSAPP** button uses `whatsapp://send?phone=…` (falls back to `wa.me`) with pre-filled welcome message including member ID for daily check-in.

### Attendance (Manual)
- Today's list with stats (Total / Still in gym).
- SCAN and MANUAL buttons; modal picker for manual check-in/out.

### Fee Management
- Plan selector (monthly/quarterly/yearly), pending list, "COLLECT" flow.
- Auto-extends member expiry on payment, generates digital receipt.
- Receipt screen `/receipt/[id]`.

### Analytics
- Revenue (6mo bar), attendance (7d line), member growth (6mo bar).
- **Peak hours** (last 7 days, by hour of day).
- Active vs inactive vs expiring tiles.

## Backend API (all prefixed `/api`)
- `POST /auth/login`, `GET /auth/me`
- `GET/POST/PUT/DELETE /members`, `GET /members/:id`, `GET /members/:id/qr`
- `POST /attendance/scan`, `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance`, `GET /attendance/today`
- `POST /payments`, `GET /payments`, `GET /payments/pending`, `GET /payments/:id`
- `GET /dashboard/stats`, `GET /analytics/{revenue,attendance,member-growth,peak-hours,absent-members}`

## Permissions
- Android: `CAMERA`
- iOS: `NSCameraUsageDescription` ("Scan member QR codes for gym attendance")

## Seed
`python /app/backend/seed_demo.py` adds 6 demo members + attendance + 1 payment.

## Limitations
- **Camera scanner is testable only on Expo Go or a native build** (not web preview).
- WhatsApp sending = click-to-send (admin taps Send in WhatsApp after the pre-fill).
- No payment gateway, no push notifications, no AI features (deferred).
