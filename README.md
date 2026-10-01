# 🛕 Temple Finance System

A web-based finance management system designed to organize **temple income, expenses, receipts, payment records, and financial data**.

## Overview

The project replaces manual financial record keeping with a digital workflow. The repository contains a frontend, backend, Supabase schema, migration resources, and development startup scripts.

## Features

- Income and expense management
- Receipt number generation for income entries
- Transaction conversion tracking
- Date-based transaction records
- Dashboard, filtering, and search
- Reporting and export workflow
- Supabase-backed transaction storage

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript, Vite
- **Backend:** Python, Flask
- **Database:** Supabase / PostgreSQL
- **Mobile:** Capacitor (Android)

## Database

The repository includes `supabase-schema.sql` for the database structure. The application uses a `transactions` table for financial records and related metadata.

## Run Locally

```bash
git clone https://github.com/Lakshayy2406/Temple-Finance-System.git
cd Temple-Finance-System
```

Review `supabase-schema.sql`, then configure the required Supabase credentials in the appropriate environment/configuration files. The repository includes separate `frontend` and `backend` directories and a `start-dev.bat` helper.

## Project Structure

```text
Temple-Finance-System/
├── assets/
├── backend/
├── frontend/
├── migration/
├── index.html
├── start-dev.bat
├── supabase-schema.sql
└── README.md
```

## Security

Do not commit service-role keys, passwords, or other secrets. Use environment variables or secure deployment configuration.

## Author

**Lakshay Sharma** · [GitHub](https://github.com/Lakshayy2406)
