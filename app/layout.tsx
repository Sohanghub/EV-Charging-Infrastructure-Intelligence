import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { PageTransition } from "@/components/page-transition";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "ECII — EV Charging Infrastructure Intelligence",
    template: "%s · ECII",
  },
  description:
    "A geospatial decision-support platform for deciding where India's next public EV charging stations should be built.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The font variable must sit on <html>: globals.css applies font-sans there.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-svh antialiased">
        <ThemeProvider>
          <div className="flex min-h-svh flex-col">
            <Navbar />
            <main id="content" className="flex-1">
              <PageTransition>{children}</PageTransition>
            </main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
