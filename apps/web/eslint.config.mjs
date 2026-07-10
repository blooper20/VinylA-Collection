import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 앨범 커버는 외부 URL(Discogs·프록시)이라 next/image 최적화 대상이 아님 — <img> 사용이 의도적
      "@next/next/no-img-element": "off",
      // App Router 프로젝트에는 해당 없음 (pages/_document 전제 규칙)
      "@next/next/no-page-custom-font": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
