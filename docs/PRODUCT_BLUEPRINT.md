# Json Formatter — Product Blueprint

> A browser-first, privacy-first, local-first API development platform.
> This document analyzes the current build and lays out a strategy to become the best browser-native API platform on the web.

---

## 0. Where the product is today (grounded in the codebase)

**Stack:** Next.js 15 (App Router) · React 19 · Tailwind CSS 4 · Radix/shadcn (~50 UI primitives) · framer-motion · recharts · react-window · cmdk · zod · react-hook-form · Vercel Analytics + Speed Insights.

**Architecture:** A single `app/page.tsx` (~530 lines) renders a **7-tab** interface via Radix `Tabs`:
`formatter · collections · diff · api · websocket · graphql · performance` (+ monitoring).
Everything runs client-side.

**Already built (real capabilities):**

| Area | Where | Notes |
|---|---|---|
| JSON format / validate / tree view | `Editor`, `JsonTree`, `VirtualizedTree`, `lib/convert`, `lib/pretty`, `lib/detect`, `lib/worker` | Web Worker + `react-window` for large files — good foundation |
| Collections + folders + variables | `CollectionManger`, `lib/collection` | localStorage; Postman v2.1 import (`lib/postman`) |
| Environments & variable interpolation | `lib/collection` | `{{var}}` substitution, active-env concept |
| REST API testing | `ApiIntegration`, `lib/api` | `fetch({mode:'cors'})` + CORS-proxy option + OAuth token flow |
| Auth | `AdvancedAuth` | bearer / basic / apikey / oauth2 / etc. |
| Diff viewer | `DiffViewer`, `lib/diff` | |
| WebSocket testing | `WebSocketTesting`, `lib/websocket` | |
| GraphQL playground | `GraphQLPlayground`, `lib/graphql` | |
| Performance testing | `PerformanceTesting`, `lib/perfomance` | |
| API monitoring | `ApiMonitoring`, `lib/monitorings` | in-tab only (no background) |
| Code generation | `CodeGenration`, `lib/codegen` | multi-language + Postman export |
| Advanced search | `AdvancedSearch`, `lib/search` | |
| History / undo | `use-history`, `HistoryControls` | |
| Share via URL | `lib/share` | state encoded in URL |
| Dark / light theme | `next-themes`, `theme-toggle` | |

**The two facts that define the entire strategy:**

1. **Storage is `localStorage`-only** (collections, history, monitoring, perf, search — all of it).
   `localStorage` is synchronous, string-only, and capped at ~5–10 MB per origin. For a platform that stores collections, request history, and response bodies, **this will hit the wall.** It also blocks large-file/offline ambitions.
2. **Networking is browser `fetch`** — subject to CORS, mixed-content, and Private Network Access rules. A browser **cannot** freely call arbitrary APIs the way a desktop app (Postman/Insomnia) can. This is the single biggest competitive constraint and must be designed around, not wished away.

Two "vision vs. reality" gaps also stand out: **there is no PWA** (no manifest, no service worker → no real offline), and **there is no command palette** (the `cmdk` primitive exists in `components/ui/command.tsx` but is never mounted).

---

## 1. Missing Features (by domain)

Legend: 🟢 browser-native OK · 🟡 needs workaround (proxy/extension/agent) · 🔴 impossible in a pure browser tab.

### REST
- 🟢 Request **tabs** (multiple open requests) — *today it's one tab per feature, not per request; this is the #1 workflow gap.*
- 🟢 Response history **per request**, save response as example
- 🟢 Bulk edit headers/params, cURL import/paste, "copy as cURL/fetch"
- 🟢 Cookie jar (in-memory / IndexedDB) & response cookies view
- 🟡 Send to **localhost / private IPs** (Private Network Access + mixed content)
- 🟡 Follow redirects with full transparency, raw socket timing
- 🔴 Client TLS certificates (mutual TLS)

### GraphQL
- 🟢 Schema introspection + docs explorer, autocomplete, variables/headers panels
- 🟢 Saved queries in collections, fragments
- 🟡 GraphQL **subscriptions** over WS (works if server allows origin)

### WebSocket / Realtime
- 🟢 Message templates, auto-reconnect, message log export
- 🟢 **SSE** (EventSource) client — currently missing, easy win
- 🟡 **Socket.IO** (needs their handshake), **MQTT over WS**

### gRPC-Web
- 🟡 gRPC-**Web** only (needs an Envoy-style proxy + `.proto` upload/reflection)
- 🔴 Native gRPC (HTTP/2 trailers unavailable to browser fetch)

### Auth
- 🟢 OAuth 2.0 (auth-code + PKCE, client-creds), API key, basic, bearer, JWT builder/decoder
- 🟢 Digest, HMAC, AWS SigV4 (compute in-browser via WebCrypto)
- 🟡 OAuth redirect capture (popup/redirect URI must be whitelisted by provider)

### Collections / Environments / Variables
- 🟢 Nested folders (✅ types exist), folder-level auth/headers/scripts inheritance
- 🟢 Variable **scopes**: global → collection → environment → local, with `{{$dynamic}}` (guid, timestamp, randomInt…)
- 🟢 Secret variables masked + stored encrypted (WebCrypto) in IndexedDB
- 🟢 OpenAPI / Swagger **import**, Insomnia / Bruno / HAR / cURL import

### Testing / Scripting
- 🟢 **Pre-request & post-response scripts** in a sandboxed Web Worker (the biggest single feature gap vs Postman) — `pm.*`-style API
- 🟢 Assertions/test UI, per-request & collection test runs, JSON-schema validation (zod already in deps)
- 🟢 **Collection Runner** with data files (CSV/JSON iterations)
- 🟡 Newman-style CI runner → ship a companion **CLI/npm package** (not the browser)

### Mocking / Documentation
- 🟢 **Local mock server** via Service Worker intercepting matched routes (browser-native superpower)
- 🟢 Example-driven responses, dynamic templating
- 🟢 Auto-generated, shareable **API docs** from a collection (static export)

### Automation / Monitoring
- 🟢 Scheduled runs while tab open; 🟡 true background monitoring needs a server or the user's own runner
- 🟢 Notifications via `Notification` API when a scheduled check fails (tab open)

### Collaboration / Import-Export
- 🟢 Export/import everything as a single file; **shareable links** (already started) with optional E2E-encrypted payloads
- 🟡 Real-time multiplayer → needs a sync backend (breaks "no server" unless P2P/WebRTC or user-supplied Git)
- 🟢 **Git-as-sync**: export collections as files a user commits to their own repo (Bruno's model — fully privacy-preserving)

### AI
- 🟢 Natural-language → request, explain response, generate tests/docs, fix failing assertions
- 🟢 **Bring-your-own-key** (user's OpenAI/Anthropic key stored locally) or on-device WebLLM for a zero-data-egress mode
- 🟢 Smart mock generation, schema inference from responses

---

## 2. Postman Feature Parity — the honest matrix

| Postman feature | Browser status | Approach |
|---|---|---|
| Request builder, collections, environments | 🟢 Replicable | Already partly built |
| Pre-request / test scripts | 🟢 Replicable | Sandbox in Web Worker + `pm`-compatible shim |
| Collection Runner + data files | 🟢 Replicable | Worker-driven iteration |
| Mock servers | 🟢 **Better in browser** | Service Worker interception, zero deploy |
| Cookie management | 🟢 Mostly | Manual jar; browser hides HttpOnly cookies |
| OAuth 2.0 flows | 🟢 with caveats | PKCE in-browser; redirect URIs must be registered |
| Call **any** public API | 🟡 Workaround | CORS is the blocker — see below |
| Call **localhost / internal** APIs | 🟡 Workaround | PNA + mixed content → needs extension/agent |
| Client certificates (mTLS) | 🔴 Impossible | Browser won't expose client certs to fetch |
| Native gRPC | 🔴 Impossible | Use gRPC-Web + proxy |
| Raw TCP/UDP/MQTT-native/Socket testing | 🔴 Impossible | WS/SSE/gRPC-Web only |
| Background monitors (cloud) | 🔴 Not pure-browser | Needs a server or user's CI |
| Newman CI | 🟡 Companion | Ship an npm CLI that runs the same collection format |
| Team sync / RBAC / SSO | 🟡 Tradeoff | Conflicts with "no accounts" — offer Git-sync or self-host |

### The CORS problem — the defining decision
A browser tab cannot bypass CORS. Your options, in order of privacy preference:

1. **CORS-enabled APIs work today** (already supported). Lead with this; many modern APIs send permissive headers.
2. **Optional CORS proxy** (already an option) — but data flows through a server, which **violates the privacy promise** unless self-hosted. Make it opt-in, clearly labeled, and offer a **one-click self-host** (Deno Deploy / Cloudflare Worker template).
3. **Browser extension** — grants host permissions to bypass CORS *locally*, no data leaves the device. This is how you honestly deliver "call any API" while staying privacy-first. **Strongly recommended.**
4. **Local companion agent** (like Hoppscotch Agent / Postman desktop) — a tiny optional binary that proxies on `localhost`. Best for internal/localhost APIs. Optional download, still no cloud.

**Recommendation:** ship the extension + agent as *optional privacy-preserving connectors*, and be explicit in the UI about which mode is active and where the request is actually going. That transparency is itself a differentiator.

---

## 3. UX — a world-class information architecture

**Shift the mental model from "tabs of tools" to "one workspace with request tabs."** Today's 7 feature-tabs should become a persistent shell.

```
┌───────────────────────────────────────────────────────────────┐
│  Activity Bar │  Sidebar (contextual)     │  Main (tabbed)      │
│  (icons)      │                           │                     │
│  ▸ Collections│  ▾ My API                 │ [GET /users] [+]    │
│  ▸ History    │    ▾ Auth                 │ ┌─ Request ───────┐ │
│  ▸ Environments│    GET  /users           │ │ URL · params    │ │
│  ▸ Mock       │    POST /login            │ │ headers · body  │ │
│  ▸ Docs       │  ▾ GraphQL                │ └─────────────────┘ │
│  ▸ Runner     │                           │ ┌─ Response ──────┐ │
│               │  [ Environment ▾ ]        │ │ status · time   │ │
│               │                           │ │ body · tests    │ │
└───────────────────────────────────────────────────────────────┘
   Status bar: active env · request count · storage used · sync/offline
```

- **Information architecture:** left activity bar (VS Code style) → contextual sidebar → tabbed main → detail panels. Formatter/Diff become *tools*, not top-level peers of the API workspace.
- **Navigation:** everything reachable via sidebar + **command palette** (⌘K) + keyboard.
- **Request builder:** URL bar with inline `{{var}}` highlighting & autocomplete; tabbed sub-panels (Params / Headers / Body / Auth / Scripts / Tests / Docs); send button with method-colored accent; response panel with Pretty/Raw/Preview/Headers/Cookies/Tests/Timeline.
- **Environment UX:** quick-switch dropdown in the top bar + inline "resolve variable" hover tooltips showing final value; secret masking with reveal-on-click.
- **Testing UX:** tests written in a mini-editor with `pm`-style autocomplete; green/red inline results; runner shows a run report with pass/fail per iteration.
- **Empty states:** every panel gets a purposeful empty state ("No requests yet — paste a cURL, import a collection, or ⌘K → New Request").
- **Onboarding:** zero-login; a 30-second interactive sample collection that hits a public demo API; a dismissible "privacy: your data never leaves this device" banner.
- **Accessibility:** Radix already gives you a11y primitives — enforce focus-visible rings, full keyboard nav, ARIA live regions for responses, prefers-reduced-motion (you use framer-motion), and AA contrast in both themes.
- **Keyboard shortcuts:** ⌘K palette, ⌘↵ send, ⌘S save, ⌘T new tab, ⌘\ split, ⌘P quick-open request, ⌘E switch env.
- **Command palette (⌘K):** the `cmdk` primitive is already in the repo — mount it. Actions: new request, switch env, run collection, open request, toggle theme, import, generate code, ask AI.

---

## 4. Modern UI — VS Code / Linear / Raycast / Vercel language

- **Layout:** app shell with `react-resizable-panels` (already a dependency) for sidebar / main / response split; support horizontal & vertical split views and drag-to-resize.
- **Sidebar:** dense, quiet, monochrome-until-hover; method badges as small colored chips (GET green, POST amber, DELETE red); collapsible folders; inline rename.
- **Request tabs:** VS Code-style tabs with method color, dirty-dot for unsaved, middle-click to close, drag to reorder, "pin" support.
- **Split views:** request | response side-by-side on wide screens; stacked on narrow.
- **Type & spacing:** you have Geist — use it; 13–14px base, tight line-height, generous panel padding, a single accent color, subtle borders over shadows (Linear aesthetic).
- **Dark & light:** you have `next-themes` — ship a genuinely great dark theme (default) and a clean light theme; sync editor theme (CodeMirror/Monaco) to app theme.
- **Motion:** framer-motion for panel transitions and micro-interactions only — never block interaction; respect reduced-motion.
- **Responsive:** desktop-first (this is a dev tool) but degrade gracefully — the 7-tab mobile scroll you have today becomes a bottom sheet / drawer nav on small screens.
- **Editor upgrade:** consider CodeMirror 6 for the request/response/script editors (lint, folding, JSON schema hints, search) — a big perceived-quality jump over a textarea.

---

## 5. Advanced / innovative features (things Postman doesn't do well)

- **Zero-egress AI mode:** BYO-key *or* on-device WebLLM. NL→request, explain-this-response, auto-generate tests & docs, "why did this fail?", schema inference. AI runs against data that never leaves the device — a story Postman literally cannot tell.
- **Service-Worker mock server:** spin up a local mock from a collection with one click, intercepting fetch in the page and (optionally) across the origin — no deploy, no account.
- **Git-as-sync (Bruno model):** collections serialize to human-readable files; users sync via their *own* Git repo. Real collaboration, zero vendor lock-in, zero server.
- **Encrypted shareable links:** payload E2E-encrypted; the key lives in the URL fragment (never sent to a server). Share a request without exposing secrets to any backend.
- **Local-first time travel:** full local history of every request/response with diffing between runs (you already have a diff engine — connect it to API history).
- **Offline-complete:** as a PWA, the entire app + all collections work on a plane. This is a genuine browser-native advantage over Electron apps that still phone home.
- **"Privacy inspector":** a live panel showing exactly what network calls the app itself makes (ideally: none but the API under test). Builds trust — nobody else does this.
- **Instant, no-install:** open a URL, paste a cURL, hit send. Time-to-first-request in seconds vs. a multi-hundred-MB Postman download + login.

---

## 6. Technical Architecture (recommendations)

- **Frontend:** keep **Next.js 15 + React 19**, but treat it as a **static-exported SPA/PWA** (`output: 'export'`) — the product is client-side; you don't need a server, and static hosting reinforces the privacy story. Move the monolithic `app/page.tsx` into a routed workspace shell with feature modules.
- **State management:** introduce **Zustand** (or Jotai) for workspace/request/tab state; keep server-less. Model: `workspace → collections → requests → tabs`, `environments`, `history`, `settings`. Persist via a storage middleware.
- **Storage strategy (highest-priority refactor):**
  - Replace `localStorage` with **IndexedDB** via **Dexie** (or `idb`). Async, large-capacity, structured, queryable — fixes the ~5–10 MB wall.
  - Store large response bodies / imported files in **OPFS** (Origin Private File System) or as Blobs in IndexedDB.
  - Use **Cache Storage** (via the service worker) for app-shell offline.
  - Encrypt secret variables & tokens with **WebCrypto** (AES-GCM, key derived from a user passphrase or a non-extractable key) before persisting.
  - Provide a **storage-usage meter** and export/wipe controls (privacy affordance).
- **API layer:** a single request-execution core that abstracts the transport — direct fetch → CORS-proxy → extension → agent — behind one interface, with the active mode surfaced in the UI. Centralize interpolation, auth signing (WebCrypto), and scripting hooks here.
- **Scripting/sandbox:** run pre/post scripts and the collection runner in a **Web Worker** with a locked-down `pm`-compatible API and no DOM/network except through a message-passed proxy — safe and non-blocking.
- **Security model:** no accounts, no telemetry of user API data; secrets encrypted at rest; explicit egress transparency; CSP that forbids the app from calling anything but the API under test + declared services; strip Vercel analytics from any "strict privacy" build or make it opt-in.
- **Offline / PWA:** add a **web app manifest + service worker** (Workbox or Next PWA). Precache the shell; the SW also powers the mock server. This directly delivers the "return after months, workspace still here, works offline" requirement.
- **Performance:** you already use a Web Worker for parsing and `react-window` for the tree — extend virtualization to history/collection lists; lazy-load heavy modules (GraphQL, gRPC-Web, AI) via dynamic import; stream large responses; debounce interpolation; keep the main thread free during runs.

---

## 7. Competitive Positioning

**vs. Postman:** No login, no 300 MB download, no cloud account, no "your data on our servers." Instant in-browser, genuinely offline-capable, and the *only* one with a zero-data-egress AI mode. Postman's edge (native networking, cloud monitors, teams) is exactly where you lean on optional extension/agent + Git-sync without compromising the core promise.

**vs. Hoppscotch:** Hoppscotch is the closest competitor (browser-first, open). Differentiate on **local-first depth** (IndexedDB/OPFS + full offline PWA), **privacy transparency** (egress inspector, E2E-encrypted shares, encrypted secrets), **on-device AI**, and a **more polished, VS Code-grade workspace UX**.

**vs. Insomnia:** Insomnia is desktop/Electron and increasingly account-gated. You win on zero-install, browser-native, and privacy-by-architecture — while matching its clean design.

**Unique selling points:** (1) Truly local-first — your workspace is *yours*, on your device, forever, no account. (2) Radical privacy transparency. (3) Zero-egress AI. (4) Instant, installable PWA. (5) Git-native collaboration with no vendor lock-in.

**Positioning line:** *"The API platform that never sees your data. Open a tab, not an account."*

---

## 8. Product Roadmap

Prioritized by (user value × competitive impact) ÷ effort.

### Phase 1 — Foundation & table stakes (must-have)
1. **Storage migration: localStorage → IndexedDB (Dexie) + OPFS** for blobs. *(unblocks everything)*
2. **Workspace shell + request tabs** (multiple open requests, split view). *(closes the biggest UX gap)*
3. **Command palette (⌘K)** — mount the existing `cmdk`. + core keyboard shortcuts.
4. **PWA**: manifest + service worker → installable & offline.
5. **SSE client** + cURL import + "copy as cURL/fetch". *(cheap, high-value)*
6. **Encrypted secrets** (WebCrypto) + storage-usage meter + export/wipe.

### Phase 2 — Advanced testing (power features)
1. **Pre-request & post-response scripts** in a Web Worker (`pm`-compatible).
2. **Collection Runner** with CSV/JSON data iterations + run reports.
3. **OpenAPI/Swagger import**, plus Insomnia/Bruno/HAR import.
4. **CodeMirror 6** editors (schema hints, lint, folding) across request/response/scripts.
5. Full **variable scopes** + `{{$dynamic}}` helpers; environment quick-switch + resolve-hover.

### Phase 3 — Differentiation (privacy & local-first moat)
1. **Service-Worker mock server** from collections.
2. **Zero-egress AI** (BYO-key + on-device WebLLM): NL→request, explain, generate tests/docs.
3. **Git-as-sync** (file serialization) + **E2E-encrypted shareable links**.
4. **Privacy/egress inspector** panel.
5. **Optional browser extension** to bypass CORS locally (privacy-preserving "call any API").

### Phase 4 — Industry-leading
1. **gRPC-Web** support (proto upload/reflection + proxy template).
2. **Optional local agent** for localhost/internal APIs + true background monitoring.
3. **Companion CLI (npm)** running the same collection format for CI (Newman alternative).
4. **Auto-generated, publishable API docs** from collections.
5. **Self-host one-click templates** (Cloudflare Worker / Deno) for proxy, mock, and docs.

---

## Growth opportunities
- **Open-source the core** → community trust + contributions (matches the privacy ethos and competes with Hoppscotch/Bruno on openness).
- **Shareable-link virality**: every encrypted share is a landing page that shows off the product.
- **Docs-as-marketing**: published API docs generated by the tool carry a subtle footer.
- **Extension/agent as distribution**: listing in browser stores is a discovery channel.
- **Template gallery**: prebuilt collections for popular public APIs (Stripe, GitHub, OpenAI…) → SEO + instant value.
- **Monetization without breaking privacy**: paid self-host/team sync, priority extension features, or a supporter tier — never gate the local-first core.
