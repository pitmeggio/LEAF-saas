import type { Metadata, Viewport } from "next";
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
  // PWA: installable on a phone, full-screen, leaf icon (apple-icon.png is
  // auto-served by Next for iOS "Add to Home Screen").
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "LEAF", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0c0f17",
  viewportFit: "cover", // draw under the iPhone notch / safe areas (the app uses env(safe-area-inset))
};

// Inline script that runs BEFORE React hydrates. Reads the user's stored
// light/dark preference (default = dark) and stamps data-theme on <html>
// so the light palette applies without a one-frame FOUC.
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = localStorage.getItem('leaf-mode');
    if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
