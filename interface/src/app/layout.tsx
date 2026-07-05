import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { ConversationProvider } from "@/components/chat/ConversationProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

// Display face more character than a default geometric sans, used with
// restraint for the wordmark and the greeting hero. Inter covers any glyphs
// Sora lacks (e.g. ɔ, ɛ) via the --font-display fallback chain.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Bambi African Languages Assistant",
  description:
    "Wolof speech-to-text (ASR). Record or upload audio to transcribe it.",
  icons: { icon: "/bambi.svg" },
  // Keep this site out of every search engine index. Emits
  // <meta name="robots" content="noindex, nofollow, nocache"> plus a
  // googlebot-specific tag on every page.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

// Cover the full screen on notched/edge-to-edge phones so env(safe-area-inset-*)
// reports real insets, and pin scale to 1 to avoid mobile zoom-on-focus jumps.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0a12",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable} h-full antialiased`}>
      <body className="h-full">
        <LanguageProvider>
          <ConversationProvider>{children}</ConversationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
