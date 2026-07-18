import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import "./globals.css";
import { Toaster } from '@/components/ui/sonner';
import { QueryClientProvider_ } from '@/context/queryClientProvider';
import { SessionProvider } from 'next-auth/react';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consumer Store",
  description: "Store Management App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <QueryClientProvider_>
            <Toaster richColors position="top-right" />
            {children}
          </QueryClientProvider_>
        </SessionProvider>

      </body>
    </html>
  );
}