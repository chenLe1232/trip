# Agent Working Notes

## UI / Frontend conventions
- Prefer utility-first styles with Tailwind CSS in TSX files.
- Prefer `shadcn/ui` components from `components/ui` for common UI blocks (Button, Card, Input, Label, etc.).
- Avoid reintroducing large global class-name based style systems for page-level UI.

## Routing feature conventions
- Uploaded route metadata is stored in `data/routes.json`.
- Uploaded HTML files are stored in `data/uploads/`.
- Admin actions that remove data should keep a user confirmation step.

## Dev commands
- Install: `npm ci`
- Lint: `npm run lint`
- Build: `npm run build`
- Start: `npm run start`
