
## 2026-07-01
- **Feature Parity (Web to Mobile)**:
  - Ported MyPage analytics, Featured LP selection, and dynamic Badge unlocking over to the Mobile App `MyScreen`.
  - Migrated `badges.ts` from `apps/web/src/lib/` to `packages/core-api/src/` to ensure shared badge unlocking logic.
  - Mirrored `DetailModal.tsx` tag filtering behavior from Web to Mobile.

## 2026-07-10
- **Error Handling Architecture**:
  - Introduced centralized `AppError` and custom error code system (`AUTH-`, `DB-`, `EXT-`, `NET-`, `SYS-`) in `packages/core-api/src/errors.ts`.
  - Implemented offline fallback (`NET-001`) to protect data when saving without a network connection.
  - Refactored `supabaseDb.ts` and `externalApi.ts` to throw explicit error codes instead of generic errors.
  - Updated Web and Mobile UI (`SearchScreen`, `DetailModal`) to display localized error messages via `getErrorMessage()`.
