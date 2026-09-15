import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { withBasePath } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: "SandPatch Field App",
    template: "%s · SandPatch Field App",
  },
  description:
    "Offline-first sand patch texture depth field data capture for road surfacing QA.",
  applicationName: "SandPatch Field App",
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    title: "SandPatch",
    statusBarStyle: "black-translucent",
  },
  icons: {
    // Next auto-prefixes next/link hrefs and _next/static asset URLs with
    // basePath, but not arbitrary metadata string values - these need it
    // added explicitly so they still resolve under a GitHub Pages subpath.
    icon: [
      { url: withBasePath("/icons/favicon-32.png"), sizes: "32x32", type: "image/png" },
      { url: withBasePath("/icons/icon-192.png"), sizes: "192x192", type: "image/png" },
      { url: withBasePath("/icons/icon-512.png"), sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: withBasePath("/icons/apple-touch-icon.png"), sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101826",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-paper text-ink antialiased">
        <ServiceWorkerRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
