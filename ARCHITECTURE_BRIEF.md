# MyBrain Finance Architecture Brief

Last updated: 2026-05-07

## Snapshot

`MyBrain finance` is a mobile-first personal and family finance app built with Next.js 14, TypeScript, Tailwind, and Supabase. It supports shared family data, per-user transaction splits, analytics, admin flows, and CSV imports.

This file is the short operational summary of the current codebase. For deeper domain detail, see `PROJECT_CONTEXT.md`.

## Product Scope

The app is centered around one main use case: tracking household income and expenses in a way that works for both the family as a whole and each person individually.

Core capabilities:

- create and edit income and expense transactions
- assign categories, subcategories, tags, comments, and declared month
- split a transaction across one or more family members
- analyze spending and income with charts, filters, comparisons, and detail tables
- manage account and family membership
- handle admin approval flows for new family requests
- import historical transactions from CSV

## Tech Stack

- `Next.js 14` with App Router
- `React 18`
- `TypeScript`
- `Tailwind CSS`
- `Supabase Auth + PostgreSQL`
- `@supabase/ssr` for server-side session handling
- `Recharts` for analytics visualizations

## High-Level Structure

- `app/`: routes, pages, route handlers
- `components/`: client UI and reusable interactive pieces
- `lib/`: business logic, Supabase access helpers, domain utilities
- `types/`: generated Supabase types plus app-level transaction types
- `scripts/`: migration and environment helpers

## Main Route Map

- `/`: home screen and primary new-transaction workflow
- `/analytics`: charts, filters, comparisons, and transaction detail views
- `/settings`: category, subcategory, and tag management
- `/account`: profile and family-related account management
- `/admin`: application admin portal
- `/login`: Supabase Google OAuth entry
- `/auth/callback`: auth callback handler
- `/unauthorized`: access-request / no-family state
- `/help`: product guidance and usage help

## Auth and Access Model

Authentication is handled with Supabase Auth. The app uses server-side user resolution in page components and route handlers.

Important pieces:

- `middleware.ts`: refreshes auth cookies and protects some navigation flows
- `lib/supabase-server.ts`: server/client factory for authenticated server access
- `components/sync-user-profile.tsx`: ensures authenticated users exist in `pml_dim_user` and updates last login

Authorization is family-based:

- regular users can access only families linked through `pml_rel_user_family`
- admin access is determined by `isAppAdmin()` in `lib/admin.ts`

Note: access control is not fully centralized. Some checks happen in `middleware.ts`, while many others are enforced inside page components or route handlers.

## Core Domain Model

The database follows a dimensional naming convention:

- `gnp_fct_transactions`: main financial fact table
- `pml_dim_family`: families
- `pml_dim_user`: app users
- `pml_dim_category`: categories
- `pml_dim_subcategory`: subcategories
- `pml_dim_tag`: tags
- `pml_dim_transaction_type`: income vs expense
- `pml_rel_user_family`: user-to-family membership
- `pml_rel_transaction_user`: per-user split amounts
- `pml_rel_transaction_tag`: tag relationships
- `pml_dim_family_request`: join/create-family request workflow
- `pml_log_transaction_changes`: audit history

The most important modeling choice is `ft_amount_user` in `pml_rel_transaction_user`. This allows analytics and summaries to reflect each user's real share of a transaction instead of always using the transaction total.

## Primary Data Flows

### Transaction creation

The main form lives in `components/TransactionForm.tsx`.

Typical flow:

1. load transaction type, categories, tags, and family members
2. validate form input
3. create transaction row in `gnp_fct_transactions`
4. create related user split rows in `pml_rel_transaction_user`
5. optionally associate tags

The form supports a recent UX improvement: save and immediately stay in "new transaction" mode.

### Analytics

Analytics is the most complex part of the app.

Main pieces:

- `app/analytics/page.tsx`
- `components/AnalyticsPageClient.tsx`
- `app/api/analytics/transactions/route.ts`
- `lib/transactions.ts`

Current approach:

- fetch a family-scoped transaction dataset
- enrich rows with category, subcategory, tag, type, and user relations
- apply user/category/tag/date filters
- recalculate totals from `ft_amount_user` when needed
- render summaries, charts, comparisons, and detail tables in the client

The codebase shows an explicit shift toward scalable analytics fetching through the API route instead of repeatedly recomputing everything with many small queries.

### Localhost mode

`lib/local-transactions.ts` provides a second execution path for local development on `localhost` using browser storage instead of Supabase writes. Home and analytics both contain logic to use this mode.

### CSV import

Historical import is handled by:

- `components/CsvImportPanel.tsx`
- `app/api/import-transactions/route.ts`

The server route validates CSV rows, resolves categories/subcategories/users, inserts transactions, and builds the corresponding `pml_rel_transaction_user` rows.

## Admin and Family Workflows

The admin area is backed by:

- `app/admin/page.tsx`
- `components/AdminPageClient.tsx`
- `lib/admin.ts`
- `app/api/admin/*`
- `app/api/family-requests/route.ts`

It supports:

- viewing families and users
- creating and deleting users
- adding or removing users from families
- approving or rejecting family access requests

## Current Architectural Strengths

- clear domain naming in the database and types
- strong mobile-first orientation in the UI
- good separation between route-level loading and client-side interactivity
- explicit support for shared household accounting through per-user amounts
- growing support for bulk operations through CSV import and analytics APIs

## Current Architectural Risks

- `README.md` is outdated and does not describe the current app accurately
- `lib/transactions.ts` is very large and mixes multiple responsibilities
- `components/AnalyticsPageClient.tsx` is also very large and state-heavy
- auth and authorization checks are distributed across multiple layers
- localhost mode introduces a second behavior path that must stay aligned with Supabase mode
- app admin identity is hardcoded in `lib/admin.ts`

## Source of Truth

When repo docs disagree:

1. trust the code first
2. trust `PROJECT_CONTEXT.md` second
3. treat `README.md` as historical unless updated

## Key Files

- `app/page.tsx`
- `components/HomePageClient.tsx`
- `components/TransactionForm.tsx`
- `app/analytics/page.tsx`
- `components/AnalyticsPageClient.tsx`
- `app/api/analytics/transactions/route.ts`
- `lib/transactions.ts`
- `lib/local-transactions.ts`
- `lib/admin.ts`
- `middleware.ts`
- `PROJECT_CONTEXT.md`
