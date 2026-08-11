import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { AppToastProvider } from "@/components/toast-provider";
import { Toaster } from "@/components/toaster";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orbis Scheduler",
  description:
    "Multi-tenant scheduling platform for small service based businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${geistMono.variable} h-full antialiased`}
      // The booking page's ThemeScript (app/(public)/book/[businessId]/theme-script.tsx)
      // mutates this element's class before hydration runs, to apply dark mode without a
      // flash — that's a deliberate, out-of-band DOM write React can't know about ahead of
      // time, and would otherwise log a hydration-mismatch warning every load. Standard,
      // narrowly-scoped fix for exactly this pattern (same one Next's own dark-mode guide
      // and next-themes use) — only silences mismatches on this element's own attributes,
      // not anywhere else in the tree.
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <AppToastProvider>
          {children}
          <Toaster />
        </AppToastProvider>
      </body>
    </html>
  );
}
