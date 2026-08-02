# Mizu App

Build a B2B SaaS web app for Japanese restaurants (Brazil 2026).
Full stack: frontend + backend + DB + WhatsApp integration.

Language UI: Portuguese (Brasil).
Multi-tenant: restaurant-based isolation.

STYLE:
Modern premium, glass liquid, matte black background, strong orange CTA, rounded cards, mobile-first.

ROLES:
- Owner/Manager (full)
- Staff (orders)
- Kitchen (KDS only)
- Public (QR menu)

================================
CORE MODULES (MVP ONLY)
================================

1) QR MENU (Public)
- Route: /m/{restaurantSlug}?t={tableToken}
- Categories + items
- Item: image, desc, price
- Cart + notes
- Upsell rules:
   temaki → drink
   combo → dessert
   always 1 high_margin item
- Checkout:
   name + whatsapp (required)
   consent_marketing checkbox
- Create Order (status NEW)

2) ORDERS PANEL (Admin)
- Kanban: NEW / PREPARING / READY / COMPLETED / CANCELED
- Change status
- View details
- Manager can cancel

3) KDS (Kitchen)
- Full screen
- Show NEW/PREPARING/READY
- Large readable layout
- Change status only

4) MENU MANAGEMENT
- CRUD categories
- CRUD items
  fields:
   name
   description
   image
   price
   cost_estimate (optional)
   margin_percent (optional)
   tags: best_seller, combo, high_margin

5) DASHBOARD
- Revenue today/week/month
- Orders count
- Avg ticket
- Top selling items
- Peak hours
- Estimated profit:
   if cost_estimate → price - cost
   if margin_percent → price * margin

6) CRM
- Capture customer at checkout
- Fields:
   name, whatsapp, consent_marketing
   total_orders
   total_spent
   last_order_at
- Segments:
   new (1 order)
   frequent (3+)
   inactive_7d
   inactive_30d

7) WHATSAPP AUTOMATIONS
- Triggers:
   POST_PURCHASE_D1
   INACTIVE_7D
   INACTIVE_30D
- Variables:
   {{name}}, {{restaurant}}, {{days}}
- Max 1 msg/day/customer
- Respect consent_marketing
- Log MessageLog

8) TABLES + QR
- Create tables
- Generate tableToken
- Show QR link

9) AGENDA (Simple)
- CRUD appointments
- Fields:
   title, date_time, notes, customer(optional)

================================
DATABASE TABLES
================================

Restaurant
User (restaurant_id, role)
Table
MenuCategory
MenuItem
Customer
Order
OrderItem
AutomationRule
MessageLog
Appointment
Settings (WhatsApp provider keys)

================================
API ENDPOINTS
================================

Auth:
POST /auth/login
GET /me

Public:
GET /public/menu
POST /public/orders

Admin:
CRUD /menu/categories
CRUD /menu/items
GET/PUT /orders
GET /dashboard/overview
GET /dashboard/items/top
GET /customers?segment=
CRUD /automations
CRUD /tables
CRUD /appointments

================================
AUTOMATION JOB (DAILY)
================================

For each restaurant:
- Select customers by trigger
- Check consent + last message
- Send WhatsApp
- Save MessageLog

================================
LANDING PAGE (PT-BR)
================================

Headline:
“Pare de anotar pedido no papel. Aumente o ticket médio com QR + Upsell.”

Sub:
“Cardápio premium, cozinha organizada e WhatsApp automático.”

CTA:
“Testar 7 dias”

Blocks:
- Dor: erro, cliente some, sem controle de lucro
- Solução: QR + KDS + Dashboard + CRM
- Preço: a partir de R$197/mês

Use sushi images + iPhone mockups.
Mobile-first.
No extra features beyond MVP.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mizuapp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/331c0092-c0a8-486f-aedb-403279b01e76).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
