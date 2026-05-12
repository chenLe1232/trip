# Homepage Dynamic And HTML Download Design

## Goal

Fix the homepage so uploaded route data is shown from current storage instead of a build-time snapshot, and add a way for admins to download or copy uploaded HTML content.

## Scope

- Make the homepage render route data dynamically.
- Add an authenticated download endpoint for uploaded HTML files.
- Add admin UI actions to download HTML and copy previewed HTML content.

## Approach

- Mark the homepage route as dynamic so `readRoutes()` is evaluated on request.
- Reuse existing route metadata and storage helpers to locate uploaded files.
- Expose a download API that returns the stored HTML as an attachment using the original upload filename.
- Extend the admin page action area with download and copy controls without changing the storage schema.

## Constraints

- Keep the existing `data/routes.json` and `data/uploads/*` layout unchanged.
- Keep admin-only actions behind the current middleware/auth protection.
- Prefer minimal UI changes in the existing admin layout.
