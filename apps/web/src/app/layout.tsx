import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@vinyla/ui";
import { ThemeSync } from "../components/Theme/ThemeSync";
import { SideNav } from "../components/Navigation/SideNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VinylA Collection",
  description: "A premium vinyl collection dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} data-theme="DARK_BLACK">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider>
          <ThemeSync>
            <div className="texture-overlay" />
            <SideNav />
            <main className="main-content">
              {children}
            </main>
          </ThemeSync>
        </ThemeProvider>
      </body>
    </html>
  );
}
