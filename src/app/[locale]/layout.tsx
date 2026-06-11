import type { Metadata } from "next";
import "../globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export const metadata: Metadata = {
  title: {
    default: "Tinix Repo Trending — Track Rising Open Source Projects",
    template: "%s | Tinix Repo Trending",
  },
  description:
    "Track trending projects, models, and datasets across GitHub and HuggingFace. Momentum-based rankings updated daily with community reviews and AI-powered summaries.",
  keywords: [
    "github trending",
    "huggingface trending",
    "open source",
    "ai projects",
    "trending repositories",
    "developer tools",
  ],
  openGraph: {
    title: "Tinix Repo Trending",
    description: "Track rising open source projects before they peak",
    url: "https://trending.tinix.ai",
    siteName: "Tinix Repo Trending",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tinix Repo Trending",
    description: "Track rising open source projects before they peak",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="noise-overlay">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
