# RackTrack

Free multi-user inventory manager for network/IT engineers (switches, APs, routers, firewalls, servers).
Live at https://racktrack.online. Owner: Naufal (CKI).

## How to talk to me
- Reply in casual Indonesian (lu/gw), short and to the point. No long explanations.
- For anything bigger than a small fix: propose the plan first and wait for "go" before building.
- For edits, show only the changed lines, not whole files.

## Stack
- Next.js 15 App Router, React 19, TypeScript, Tailwind 3.4
- Auth.js v5 (Google only, JWT sessions) + Drizzle adapter
- Drizzle ORM + Neon Postgres (`@neondatabase/serverless`, neon-http, lazy `getDb()`)
- zod 4 for validation (shared by server actions and the seed script)
- Fonts: self-hosted `@fontsource` IBM Plex Mono + Sans (do NOT use `next/font/google`; it broke the Vercel build)
- Deploy: Vercel (auto-deploys on push to `main`). DNS on Hostinger.

## Commands
- `npm run dev`: local dev at http://localhost:3000
- `npm run build`: production build (run before pushing)
- `npm run typecheck`: TypeScript check
- `npm run db:push`: push schema to Neon (drizzle-kit)
- `npm run db:migrate-workspaces`: one-off v1.1 migration (run once per DB, before `db:push`)
- `npm run db:migrate-statuses`: one-off v1.2 migration, dry run by default, `-- --apply` to run (before `db:push`)
- `db:push` always re-creates the composite PKs on `account` / `verificationToken` (drizzle-kit quirk, harmless)
- `npm run db:studio`: Drizzle Studio
- `npm run seed`: load `seed/devices.seed.json` into SEED_OWNER_EMAIL's own workspace (`-- --append` to add more)

## Layout
- `src/app/page.tsx`: public landing page (explains every feature; sign in with Google)
- `src/app/app/`: protected app. `layout.tsx` = auth guard + shell (desktop sidebar with nav + category counts, phone top bar + bottom tabs).
  Routes: `/app` dashboard, `/app/devices` (default view groups units by model name via `ModelList`; filters in the URL:
  `group`, `type`, `status`, `customer`, `q`, `view=grid|table`, `new=1`, `import=1`),
  `/app/devices/[id]` detail + history, `/app/projects` + `/app/projects/[id]` (customer = project; `/app/customers` redirects), `/app/locations`, `/app/cleanup` (`lib/cleanup.ts` checks + `mergeValues`),
  `/app/scan` (camera via `@zxing/browser`, loaded on demand; Look up + Receive stock via `receiveDevices`), `/app/activity`, `/app/team`.
- `/d/[id]`: short link for future QR labels, redirects to `/app/devices/[id]`. `lib/scan.ts` parses scanned text (our links, `SN:` labels, plain codes). `actions.ts` = device writes.
- `src/app/app/workspace/actions.ts`: members, invites, rename/leave/create workspace, `acceptInvite`
- `src/app/invite/[token]/`: public invite page (sign in, then join)
- `/s/[token]`: public read-only share link (no sign-in, noindex, no-referrer). Table `share_links` (kind all/customer/location/device,
  show_serial, show_customer, expires_at, views). Admin+ creates/revokes (`app/share/actions.ts`); reads in `lib/shared.ts` strip rows to
  `PublicDevice` (never notes, contact, firmware, purchase, warranty). Share buttons on Devices, Customers, Locations, device page; list on Team.
- `src/components/`: `AppNav` (sidebar + bottom tabs), `Dashboard`, `Inventory` (stats, filters, grid/table), `DeviceCard`, `DeviceDrawer` (quick view/edit/add/delete), `DeviceDetail`, `Timeline` + `LocalTime`, `StatTile`, `ImportDialog` (xlsx/csv + column mapping), `WorkspaceSwitcher`, `WorkspaceSettings`, `StatusLed` (+ `Logo`), `Backdrop` (background orbs)
- `src/components/ui/liquid-glass.tsx`: SVG-refraction glass from 21st.dev (Chromium refracts, others fall back to frosted)
- `src/lib/`: `schema.ts`, `db.ts`, `devices.ts` (server reads: devices, history, category counts), `access.ts` (active workspace + `authorize()`), `roles.ts` (roles, limits), `categories.ts` (groups/types/statuses + display labels), `validation.ts`, `importMap.ts`, `types.ts`
- `src/auth.ts` + `src/auth.config.ts` (edge-safe) + `src/middleware.ts` (protects `/app/*`)

## Data rules (do not break)
- Devices belong to a workspace, not a user. Every query and server action must filter by a workspace id that went
  through `authorize(workspaceId, minRole)` (or `getAppContext()` for pages). Never trust ids from the browser alone.
- Roles: owner > admin > editor > viewer. Viewer is read only; editor edits devices; admin also manages members.
  You can only grant up to your own role and only manage people ranked below you. One owner per workspace; the owner can't leave.
- Every user gets a personal workspace on first visit. Invites are links bound to one email (no email sending yet), valid 7 days.
- Active workspace lives in the `rt_ws` cookie; invalid values fall back to the user's oldest workspace.
- Max 300 devices per workspace, checked server-side in `createDevice` and `importDevices` (import is all-or-nothing).
  Max 5 owned workspaces per user, 50 members + pending invites per workspace.
- Stored values never get renamed; the UI shows labels via `statusLabel()`, `groupLabel()`, `categoryLabel()` in `categories.ts`.
  Statuses (stored → label): `Available` → In Stock, `In Use` → At Customer, `Internal` → Internal Use, `Faulty`,
  `Hilang` → Missing, `Retired`. Categories keep `Lainnya`, `POE Injektor`, `Sparepart Server` (Lainnya → Others/Other).
- Stock vs customer: only `In Use` devices carry customer details. `In Use` requires a customer and `assignment`
  (`loan` needs a return date; `installed` stays). `Hilang` keeps the last known customer. Every other status clears
  customer/contact/out/return/assignment (enforced in `deviceInputSchema`). Overdue = loan past its return date.
- Locations: table `locations` (site = parent_id null, spot = inside a site; two levels max). `devices.location_id` is the
  source of truth; `devices.location` is its display label ("Site › Spot"), always written by the server via `resolvePlace`
  (`lib/devices.ts`). Free text only comes from imports and is matched or turned into a new site. A location stays set
  while a device is out, as the place it returns to. Only empty places can be deleted; renames relabel devices.
- Email digest: `/api/cron/digest` (Vercel Cron, `vercel.json`, 00:00 UTC = 07:00 WIB) builds mails in `lib/digest.ts`
  (overdue, due in 3 days, low stock, changes) and sends via Resend (`lib/email.ts`). Per-member preference
  `workspace_members.digest` (null = owner/admin daily, others off; `effectiveDigest()`), set on the Team page. `?dry=1` previews.
- Low stock: `stock_minimums` (workspace, model_key = `modelKey(name)`, min). Set from the By model view; shown as LOW there
  and on the dashboard (`lowStock()` in `lib/models.ts`).
- `npm run db:migrate-locations`: one-off v1.3 migration (dry run by default, `-- --apply`), before `db:push`.
- Bulk: Devices page "Select" mode (checkboxes in By model / grid / table, "pick N in stock" per model) + action bar →
  `BulkMoveDialog` → `moveDevices` (all or nothing; Send can jump straight to a tanda terima with `?devices=` preselected).
- Status moves go through `moveDevice` (Send to customer, Return to stock, Mark faulty/missing/retired, Found, Repaired),
  (a wrapper around `moveDevices` / `planMove`), which merges the move into the row and re-validates with `deviceInputSchema`. The edit form can still change status for corrections.
- Projects: a customer IS a project. Table `projects` (workspace, name unique = devices.customer, status active/done, PIC user,
  city, start/end, notes). `ensureProjects()` creates rows whenever a device gets a new customer; `device_history.project` tags
  the project a change touched (to or from) so project pages keep returned devices. Renames/merges go through
  `renameProjectStatements()` (devices, history tags, share links). `npm run db:migrate-projects` = one-off v1.4 backfill (after db:push).
- Tanda terima (goods receipt): project page → `/app/projects/[id]/receipt` (pick on-site devices) → `createReceipt` stores a
  snapshot in `receipts` (number from `workspaces.receipt_format`, tokens {YYYY} {YY} {MM} {DD} {NNN}, seq resets yearly) →
  printable A4 at `/receipt/[id]` (outside /app, membership checked in the page; `ReceiptSheet`), with a QR to
  wa.me/<workspaces.receipt_wa>. Letterhead image is a data URL on `workspaces` (Team page, admins). Printed text is Indonesian.
- Stock opname (`/app/opname`, `/app/opname/[id]`, printable `/opname-report/[id]`): `stock_counts` (area = location_id or null = all,
  `expected` = frozen snapshot of In Stock/Internal/Faulty devices in that area, status open → review → closed) + `stock_count_scans`
  (unique per count+serial, several people can scan; page refreshes every 6 s while open). `compareCount()` in `lib/countTypes.ts`
  sorts results into found / not found / wrong place / not recorded and marks rows fixed once the device changed. Fixes reuse
  `moveDevices` (new `relocate` move, Hilang, send to project) and `receiveDevices` (now returns ids). Dashboard shows active counts.
- Label reading: `lib/labels.ts` (H3C serial = 21/29 + 8-char BOM; BOM → model learned from existing devices; skips MAC/EAN codes),
  `lib/photo.ts` (zxing-wasm multi-barcode, tesseract.js OCR fallback for the model; both lazy, WASM/lang data from jsDelivr),
  `PhotoScan` button, `NewSerials` (add unknown serials grouped by guessed model). Scan page has Look up / Receive stock / Send out.
- Status/location/customer changes write to `device_history` with the acting `user_id` (shown on device pages, dashboard and Activity).
- Groups are derived from category in code, not stored.

## Design rules
- Look: dark NOC + liquid glass with warm amber/orange light.
- Logo: a rack unit (green LED, amber bar) inside amber scan corners + "RackTrack" in IBM Plex Mono. Shapes live in
  `lib/brand.ts` (generated PNGs: `apple-icon`, `/icons/[size]`, `opengraph-image`), `<Logo>` and `app/icon.svg`; keep them in sync.
- All UI text in English. All headings (h1/h2/h3) uppercase (global CSS), plus mono uppercase eyebrows. Device names are never uppercased (`normal-case`).
- Colors: page bg #07090D, amber #EF9B3E (buttons: gradient #FFD08A → #F7A23A → #E3841E), green #4FD199, red #F0664C, cyan #5DC9E0 (Wireless), violet #9B8CF2 (Networking), grey #8B97A8 (Others). Text on glass: #F1F4F8, secondary #BAC3CF / #AEB8C5.
- Glass classes in `globals.css` (inside `@layer components`, so Tailwind utilities can override):
  `.lg` (base glass), `.lg-dark`, `.lg-solid` (drawers/dialogs), `.lg-amber` (highlight), `.glass-rim` (rim for `<LiquidGlass>`), `.sheen`, `.chip`/`.chip-on`, `.eyebrow`, `.btn-primary`/`.btn-ghost`/`.btn-danger`, `.input`.
- Use `<LiquidGlass>` only for a few hero elements (navbars, stat cards). It builds a displacement map per element, so plain `.lg` is for repeated items like device cards.
- Give `<LiquidGlass>` a dark `backgroundColor` (about rgba(10,12,16,.5)) or text becomes unreadable over the orange orbs.
- Inputs stay solid dark for contrast. Keep text contrast at 4.5:1 or better.
- Dashboard uses `<Backdrop dim />`; landing uses `<Backdrop />`.
- Respect `prefers-reduced-motion`; lighter blur on mobile. Must work at 390px wide with no horizontal scroll.
- Don't name the class `.ring` (it clashes with Tailwind's `ring`); background circles are `.halo`.

## Secrets
- Real values live only in `.env.local` (gitignored) and Vercel env vars. Never print, commit or paste them.
- Env vars: DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, SEED_OWNER_EMAIL (local only),
  CRON_SECRET (Vercel Cron auth), RESEND_API_KEY (email; without it the digest only dry-runs), DIGEST_FROM (optional sender).
- `seed/*.json` is gitignored (real customer names and serials).

## Known open items
- Google OAuth consent screen is still in Testing mode; finish Branding and publish so other users can sign in.
- The 300 cap is check-then-insert (small race); a DB-level guard can come later.
- Restructure roadmap: Fase 2 = app shell + dashboard + table + device detail/history (done), then Locations (Site → Rack), check-out/check-in, custom categories;
  Fase 3 = check-out/check-in, CSV export, QR labels, warranty alerts, read-only demo.
- Out of scope so far: photos, map, printing QR labels (Q3), export.
- Mobile app plan (Capacitor, iOS + Android) proposed; waiting on Apple/Google developer accounts + D-U-N-S.
