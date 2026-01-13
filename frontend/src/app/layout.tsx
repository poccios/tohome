import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '@/lib/cart/CartContext';

export const metadata: Metadata = {
  title: 'ToHome',
  description: 'ToHome application',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
