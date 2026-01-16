import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/next"
import Link from "next/link";
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title:
    "JSON Formatter - Free Online JSON Validator & Beautifier | Spectrum UI",
  description:
    "Professional JSON formatter, validator, and beautifier by Spectrum UI. Convert JSON to CSV, XML, YAML. Features tree view, diff comparison, API integration, and advanced search. Free online tool for developers.",
  generator: "Spectrum UI",
  applicationName: "JSON Formatter by Spectrum UI",
  keywords: [
    "JSON formatter",
    "JSON validator",
    "JSON beautifier",
    "JSON parser",
    "JSON converter",
    "JSON to CSV",
    "JSON to XML",
    "JSON to YAML",
    "JSON tree view",
    "JSON diff",
    "JSON compare",
    "JSON minifier",
    "JSON pretty print",
    "online JSON tool",
    "free JSON formatter",
    "JSON editor",
    "JSON viewer",
    "JSON analyzer",
    "developer tools",
    "web development",
    "API testing",
    "data conversion",
    "Spectrum UI",
    "json.spectrumhq.in",
  ],
  authors: [{ name: "Spectrum UI -Arihant Jain", url: "https://ui.spectrumhq.in" }],
  creator: "Spectrum UI - Arihant Jain",
  publisher: "Spectrum UI - Arihant Jain",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title:
      "JSON Formatter - Free Online JSON Validator & Beautifier | Spectrum UI",
    description:
      "Professional JSON formatter, validator, and beautifier by Spectrum UI. Convert JSON to CSV, XML, YAML with advanced features like tree view, diff comparison, and API integration.",
    url: "https://json.spectrumhq.in",
    siteName: "JSON Formatter by Spectrum UI",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "JSON Formatter by Spectrum UI - Professional JSON Tools",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JSON Formatter - Free Online JSON Validator & Beautifier",
    description:
      "Professional JSON formatter by Spectrum UI. Convert, validate, and beautify JSON with advanced features.",
    images: ["/og-image.png"],
    creator: "@arihantcodes",
    site: "@arihantcodes",
  },
  alternates: {
    canonical: "https://json.spectrumhq.in",
  },
  category: "Developer Tools",
  classification: "Web Development Tools",
  other: {
    "google-site-verification": "your-google-verification-code",
    "msvalidate.01": "your-bing-verification-code",
  },
};

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} scroll-smooth antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "JSON Formatter by Spectrum UI",
              description:
                "Professional JSON formatter, validator, and beautifier with advanced features",
              url: "https://json.spectrumhq.in",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web Browser",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              creator: {
                "@type": "Organization",
                name: "Spectrum UI",
                url: "https://ui.spectrumhq.in",
              },
              featureList: [
                "JSON formatting and validation",
                "Convert JSON to CSV, XML, YAML",
                "Interactive tree view",
                "Diff comparison",
                "API integration",
                "Advanced search with JSONPath",
                "File upload and drag-drop",
                "Share via URL",
                "Dark/Light themes",
              ],
            }),
          }}
        />
        <link rel="canonical" href="https://json.spectrumhq.in" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5"
        />
      </head>
      <body className="font-sans ">
      <Analytics />
      <SpeedInsights />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="container mx-auto px-4 sm:px-6 lg:px-4 py-5 border-x border-border border-dashed">
          <Navbar />

          {children}
          <footer className="flex justify-between mt-10 border-t border-dashed border-border pt-6 text-center text-sm text-muted-foreground">
           <h1>
            Backed by 
            <Link href="http://ui.spectrumhq.in/" className="text-sky-500 ml-1">
            Spectrum UI
            </Link>
           </h1>

           
          <Link href="https://x.com/arihantCodes" className="">
          Follow me on Twitter
          <span className="text-sky-500 ml-1">@arihantcodes</span>
          </Link>
           
            </footer>

          </div>
          <Analytics/>
        </ThemeProvider>
      </body>
    </html>
  );
}
