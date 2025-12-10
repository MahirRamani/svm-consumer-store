// app/login/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login - Hostel Store Management',
  description: 'Sign in to your account',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}