
## 2026-07-01
- **Feature Parity (Web to Mobile)**:
  - Ported MyPage analytics, Featured LP selection, and dynamic Badge unlocking over to the Mobile App `MyScreen`.
  - Migrated `badges.ts` from `apps/web/src/lib/` to `packages/core-api/src/` to ensure shared badge unlocking logic.
  - Mirrored `DetailModal.tsx` tag filtering behavior from Web to Mobile.
