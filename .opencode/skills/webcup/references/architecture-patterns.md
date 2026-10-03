# Webcup Architecture Patterns (during the contest)

Use this file as a lookup while building features. Adapt everything to the revealed subject and to what already exists in the repository.

## Code structure (adapt to the framework in place)

```
src/
  modules/<entity>/        # routes/controller, service, repository, schema, dto
  middleware/              # auth, role, validate, rateLimit, errorHandler, requestId
  lib/                     # db, cache, logger, ai (AI provider client), mailer
  ui/components/           # design-system components with loading/empty/error states
  ui/pages/
prisma|migrations/
scripts/seed.ts            # jury accounts per role + demo data
FEATURES.md                # live feature status = final recap deliverable
```

One module per domain entity from the subject. Business logic in services, not in route handlers or UI components.

Separation of concerns inside a module, one responsibility per file:

```
modules/booking/
  booking.routes.ts        # HTTP wiring only: path, guards, validation, call service
  booking.service.ts       # business rules
  booking.repository.ts    # data access only
  booking.schema.ts        # input validation schemas
  booking.dto.ts           # response shapes
ui/pages/bookings/
  BookingsPage.tsx         # composition only
  BookingList.tsx
  BookingForm.tsx
  useBookings.ts           # data fetching/state
```

Hard limit: no file reaches 1000 lines. Split as soon as a file holds a second responsibility or passes ~300 lines.

## Shared helpers worth having (create on first need, reuse after)

- `assertOwner(resource, user)` — ownership check reused by every module.
- Validation middleware with a schema library.
- Central error handler with the JSON error contract `{ error: { code, message, fields? } }`.
- Pagination helper (cursor or offset with a max limit).
- Cache helper: `getOrSet(key, ttl, fn)` and `invalidate(prefix)`.
- AI client (`lib/ai`): provider call, timeout, fallback model list, response cache, 429 handling.

## Patterns to reach for

| Need | Pattern |
|---|---|
| Hot read endpoint (dashboard, listings) | Cache-aside with TTL, invalidate on write |
| Lists | Pagination + index on sort/filter columns |
| Duplicate-prone writes (orders, votes, submissions) | Unique constraint and/or idempotency key |
| Multi-step write | DB transaction |
| Slow work (emails, AI, exports) | Background job or async with status polling; never block the request long |
| External API / AI | Server-side call, timeout, retry with backoff (idempotent only), cache, fallback |
| Counters (likes/views) | Atomic increment, unique constraint per user |
| Search | DB full-text or indexed `ILIKE` with limit; debounce in UI |
| Stats / data exploitation | Aggregation queries + cache; charts with clear labels |
| Real-time | Polling first; WebSocket/SSE only if the feature requires it |
| Role-specific screens | Server-side role guard + separate route group; UI hides what the server already forbids |

## Scalability story (visible to a technical jury)

Keep the app server **stateless** (sessions in DB/Redis, uploads in storage), use indexes, pagination, caching, and compression. Mention these choices in `FEATURES.md` / README with a small architecture diagram: it shows intent even if traffic is small.
