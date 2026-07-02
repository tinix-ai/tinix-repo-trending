import "../globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TrendingMarquee } from "@/components/leaderboard/trending-marquee";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Toaster } from 'sonner';
import { Inter, JetBrains_Mono, Lora } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const lora = Lora({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-serif',
  display: 'swap',
});

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HomePage" });
  
  return {
    title: {
      default: t("metaTitle"),
      template: "%s | TiniX Repo Trending",
    },
    description: t("metaDesc"),
    keywords: [
      "github trending",
      "huggingface trending",
      "open source",
      "ai projects",
      "trending repositories",
      "developer tools",
    ],
    openGraph: {
      title: "TiniX Repo Trending",
      description: "Track rising open source projects before they peak",
      url: "https://trending.tinix.ai",
      siteName: "TiniX Repo Trending",
      locale: locale === "vi" ? "vi_VN" : "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "TiniX Repo Trending",
      description: "Track rising open source projects before they peak",
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: Promise<any>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`noise-overlay ${inter.variable} ${jetbrainsMono.variable} ${lora.variable}`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <TrendingMarquee />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
            <Toaster position="top-right" richColors />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
