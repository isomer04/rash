import Link from 'next/link';
import Head from 'next/head';
import { buttonClass } from '@/components/ui';
import Logomark from '@/components/brand/Logomark';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>404 - Page Not Found | Rash AI Financial Advisor</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="max-w-lg border-y border-border py-page text-center">
          <Logomark size={32} className="mx-auto mb-6 text-accent" />
          <p className="num mb-3 text-3xl text-text-muted">404</p>
          <h1 className="mb-4 font-display text-2xl font-semibold text-text">Page Not Found</h1>
          <p className="mb-8 text-text-secondary">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link href="/dashboard" className={buttonClass({ variant: 'primary', size: 'md' })}>Return to Dashboard</Link>
        </div>
      </main>
    </>
  );
}
