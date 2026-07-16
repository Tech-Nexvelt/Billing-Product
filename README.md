<div align="center">

# 🍽️ NexVelt POS

### Enterprise Cloud Restaurant Management & Point of Sale System

Modern • Fast • Secure • Scalable

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4.x-38B2AC?logo=tailwindcss)
![License](https://img.shields.io/badge/License-Proprietary-red)

</div>

---

## 📖 Overview

NexVelt POS is a modern cloud-native Restaurant Management and Point of Sale (POS) platform designed for cafés, restaurants, bakeries, cloud kitchens, and food chains.

The platform provides a complete operational ecosystem covering order management, kitchen workflows, QR ordering, billing, menu management, reporting, staff administration, and realtime synchronization.

Designed with enterprise SaaS architecture, NexVelt POS is built for scalability, security, and exceptional user experience.

---

## ✨ Features

### 🍽 Restaurant Management

- Restaurant Configuration
- Floor Management
- Table Management
- QR Code Management
- Tax Profiles
- Receipt Configuration

---

### 🧾 POS Billing

- Fast Cashier Interface
- Order Management
- Split Bills
- Discounts
- Taxes
- Multiple Payment Methods
- Receipt Printing

---

### 👨‍🍳 Kitchen Display System (KDS)

- Live Kitchen Queue
- Order Status Tracking
- Realtime Updates
- Preparation Workflow

---

### 📱 QR Ordering

- QR Table Ordering
- Digital Menu
- Cart System
- Customer Notes
- Live Order Tracking

---

### 🍔 Menu Management

- Categories
- Menu Items
- Pricing
- Availability
- Image Management
- Bulk Image Upload
- Placeholder Images
- Image History

---

### 👥 User Management

- Owner
- Manager
- Cashier
- Kitchen

Includes:

- Role-Based Access Control (RBAC)
- Permissions
- Activity Logs
- Archive & Restore
- Session Management

---

### 📊 Reports

- Sales Reports
- Revenue Analytics
- Product Performance
- Category Analytics
- Payment Reports

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Backend | Supabase |
| Database | PostgreSQL |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |

---

## 🏗 Architecture

```
                 React + TypeScript
                        │
                        ▼
                 Supabase Backend
        ┌──────────┬──────────┬──────────┐
        │          │          │          │
 PostgreSQL   Authentication Storage  Realtime
```

---

## 👤 User Roles

| Role | Access |
|---|---|
| Owner | Full Platform Access |
| Manager | Restaurant Operations |
| Cashier | POS & Billing |
| Kitchen | Kitchen Display System |

---

## 📂 Project Structure

```
src/
├── components/
├── features/
├── hooks/
├── layouts/
├── pages/
├── routes/
├── services/
├── stores/
├── utils/

database/
├── migrations/

supabase/
├── functions/

public/
```

---

## 🔒 Security

- JWT Authentication
- Row Level Security (RLS)
- Multi-Tenant Isolation
- Role-Based Access Control
- Activity Logging
- Secure Storage Policies
- Soft Delete Support

---

## ⚡ Realtime Features

- Live Orders
- Live Kitchen Updates
- Live Menu Synchronization
- Live Notifications
- Live Staff Updates

---

## 🖼 Enterprise Image System

- Lazy Loading
- Skeleton Loading
- Blur-Up Animation
- WebP Optimization
- Square Cropping
- Placeholder Images
- Owner Image Management
- Bulk Upload

---

## ⚙ Installation

Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/nexvelt-pos.git
```

Move into the project

```bash
cd nexvelt-pos
```

Install dependencies

```bash
npm install
```

---

## 🔑 Environment Variables

Create a `.env` file

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

---

## ▶ Running the Project

Development

```bash
npm run dev
```

Production Build

```bash
npm run build
```

Preview Production Build

```bash
npm run preview
```

---

## 📌 Roadmap

- Inventory Management
- Purchase Management
- Supplier Management
- CRM
- Loyalty Program
- Mobile Applications
- Multi-Branch Management
- AI Analytics
- Financial Dashboard

---

## 📄 License

This software is proprietary.

Copyright © NexVelt.

All rights reserved.

Unauthorized copying, distribution, modification, reverse engineering, or commercial use is prohibited without written permission from NexVelt.

---

## 👨‍💻 Developed By

### NexVelt

Enterprise SaaS • AI Automation • Digital Transformation • Custom Software Solutions

---

<div align="center">

### ⭐ If you found this project useful, consider starring the repository.

</div>
