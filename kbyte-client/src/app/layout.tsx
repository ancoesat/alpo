import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MobileNav from "@/components/MobileNav";
import LogoutButton from "@/components/LogoutButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alpo",
  description: "Kişisel finans ve yatırım takip sistemi",
  applicationName: "Alpo",
  appleWebApp: { capable: true, title: "Alpo", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#245edb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0a] text-gray-400">
        {children}
        <MobileNav />
        <LogoutButton />
        <script
          dangerouslySetInnerHTML={{
            __html: "if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js')",
          }}
        />
      </body>
    </html>
  );
}

