# Homepage Dynamic And HTML Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the homepage reflect current uploaded route data and let admins download or copy uploaded HTML.

**Architecture:** The homepage stays server-rendered but is explicitly marked dynamic so route data is read per request. Admin download is handled by a new API route that returns the stored HTML as an attachment, while the existing admin screen gets lightweight action buttons for download and clipboard copy.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing filesystem storage helpers

---

### Task 1: Homepage Runtime Data

**Files:**
- Modify: `app/page.tsx`

- [ ] Add a route-level dynamic rendering export so homepage route data is not frozen at build time.
- [ ] Keep the existing `readRoutes()` call and rendered layout intact.

### Task 2: HTML Download API

**Files:**
- Create: `app/api/routes/download/route.ts`
- Modify: `lib/storage.ts`

- [ ] Add a helper that can return the raw uploaded HTML content for a stored file.
- [ ] Create an API route that reads the route by `id`, loads the stored HTML, and returns it with download headers using the original filename.
- [ ] Return `400` for missing `id`, `404` for missing route or file.

### Task 3: Admin Actions

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] Add a download action per route that hits the new API endpoint.
- [ ] Add a copy button inside the expanded preview area that copies the loaded HTML to the clipboard.
- [ ] Show success or failure status for clipboard actions using the existing status message area.

### Task 4: Verification

**Files:**
- Modify: none

- [ ] Run `npm run build`.
- [ ] Confirm the homepage route is emitted as dynamic in the build output.
- [ ] Confirm the build succeeds after the admin and API changes.
