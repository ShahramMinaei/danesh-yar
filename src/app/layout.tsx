import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "دانش‌یار · دستیار فنی",
  description: "پاسخ دقیق به پرسش‌های فنی، مستند به بندهای اسناد و آیین‌نامه‌ها.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#10111c",
};

// Applies the saved theme before first paint to avoid a flash of the default theme.
const themeBoot = `try{var p=JSON.parse(localStorage.getItem("danesh-yar:prefs")||"{}");if(p.theme)document.documentElement.dataset.theme=p.theme}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <body>
        {/* beforeInteractive is injected into <head> and runs before hydration; a raw <script> inside a React tree warns in React 19 */}
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBoot}
        </Script>
        {children}
      </body>
    </html>
  );
}
