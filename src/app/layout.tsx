import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://leafos.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "LEAF — Sports Performance OS", template: "%s · LEAF" },
  description: "The verified performance intelligence layer for elite sport — athlete profiles, AI analytics and the operating system academies run on.",
  openGraph: {
    type: "website",
    siteName: "LEAF",
    title: "LEAF — Where athlete performance becomes intelligence",
    description: "Verified athlete profiles, AI performance analytics, and the academy operating system — in one platform.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LEAF — Where athlete performance becomes intelligence",
    description: "Verified athlete profiles, AI performance analytics, and the academy operating system.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
