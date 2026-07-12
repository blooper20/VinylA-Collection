import type { Metadata } from "next";
import { ThemeProvider } from "@vinyla/ui";
import { LocaleProvider } from "@vinyla/i18n";
import { ThemeSync } from "../components/Theme/ThemeSync";
import { LocaleSync } from "../components/Locale/LocaleSync";
import { AppShell } from "../components/Layout/AppShell";
import { AuthGuard } from "../components/Auth/AuthGuard";
import { AttributionTracker } from "../components/Analytics/AttributionTracker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://vinyla.vercel.app'),
  title: "VinylA Collection — 나의 바이닐 컬렉션",
  description: "LP 수집가를 위한 프리미엄 바이닐 컬렉션 대시보드",
  openGraph: {
    title: "VinylA Collection",
    description: "LP 수집가를 위한 프리미엄 바이닐 컬렉션 대시보드",
    url: "https://vinyla.vercel.app",
    siteName: "VinylA Collection",
    images: [
      {
        url: "/logo.png",
        width: 800,
        height: 600,
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VinylA Collection",
    description: "LP 수집가를 위한 프리미엄 바이닐 컬렉션 대시보드",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 아이콘 폰트는 로딩 전 리거처 텍스트가 보이면 안 되므로 display=block이 맞다 */}
        {/* eslint-disable-next-line @next/next/google-font-display */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body>
        <AttributionTracker />
        <ThemeProvider>
          <LocaleProvider>
            <ThemeSync>
              <LocaleSync>
                {/* Atmospheric background */}
                <div className="atmo-bg" />
                {/* Film grain texture */}
                <div className="texture-overlay" />
                {/* Layout shell */}
                <AuthGuard>
                  <AppShell>{children}</AppShell>
                </AuthGuard>
              </LocaleSync>
            </ThemeSync>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
