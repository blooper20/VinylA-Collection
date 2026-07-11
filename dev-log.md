
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

## 2026-07-11
- **Full UI/UX audit — 15 issues fixed across mobile + web**:
  - Fixed backdrop clicks on nested web DetailModal popups (share sheet, delete/price confirm, preview) closing the whole modal (missing `stopPropagation`).
  - Fixed featured-LP not rendering on `/my` due to a strict number/string ID comparison.
  - Fixed mobile Home grid's last row hidden behind the floating tab bar.
  - Removed an unsafe `navigation.replace('Onboarding')` call on logout/delete that could throw before the auth-driven stack swap landed.
  - Added a `USER_ID` filter to VinylGrid's realtime subscription (was refetching every client on any user's change).
  - Added responsive breakpoints to SideNav, DetailModal, and profile pages; split the app shell (`AppShell`) so `/user/[id]*` public share pages render without the authenticated sidebar/gutter for logged-out visitors.
  - Made the mobile tab bar height safe-area aware (`useTabBarHeight`), fixed odd-count scan result card stretching, keyboard covering the price prompt, hardcoded top padding vs. safe-area insets, and My screen's hero overflow on narrow devices.
  - Fixed PublicGrid/public dashboard passing the profile *owner's* OWNED/WISH status into DetailModal instead of the logged-in *viewer's*, which mislabeled the add/delete buttons.
  - Misc: theme-ignoring hardcoded colors in Wishlist/EmptyState, My screen stats going stale until a manual refresh (now `useFocusEffect`), hardcoded share URLs, `alert()` calls replaced with the toast pattern, empty-image-URL proxy guards.
- **Applied and committed the 2026-07-11 Supabase security hardening migration** (PROFILES DDL, nickname-cooldown trigger, EVENT_LOG validation + anon flood brake, USER_VINYL integrity constraints, INQUIRY auto-reopen trigger, avatars bucket policies) — verified via SQL Editor, then committed `supabase_schema.sql`.
- **Committed the scan/external-API migration** from the standalone `apps/api` Node server to Next.js API routes (`apps/web/src/app/api/scan`, `api/external/*`), plus a fix for mobile Supabase sessions being lost on every app restart (AsyncStorage wiring).
- **Docs**: Rewrote `README.md` as a client/user-facing product overview (per-page/per-screen guide) with the developer-facing content moved to its own section at the bottom; updated `VinylA_Blue_Print.md` for the chrome-free public routes, safe-area-aware tab bar, hardening migration, and `apps/api` retirement.
