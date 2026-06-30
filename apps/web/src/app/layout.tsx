import type { Metadata } from "next";
import { ThemeProvider } from "@vinyla/ui";
import { ThemeSync } from "../components/Theme/ThemeSync";
import { SideNav } from "../components/Navigation/SideNav";
import { AuthGuard } from "../components/Auth/AuthGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "VinylA — 나의 바이닐 컬렉션",
  description: "LP 수집가를 위한 프리미엄 바이닐 컬렉션 대시보드",
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
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <ThemeSync>
            {/* Atmospheric background */}
            <div className="atmo-bg" />
            {/* Film grain texture */}
            <div className="texture-overlay" />
            {/* Layout shell */}
            <AuthGuard>
              <div className="layout-shell">
                <SideNav />
                <main className="main-content">
                  {children}
                </main>
              </div>
            </AuthGuard>
          </ThemeSync>
        </ThemeProvider>
      </body>
    </html>
  );
}
