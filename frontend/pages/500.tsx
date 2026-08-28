import Link from 'next/link';
import Head from 'next/head';
import { buttonClass } from '@/components/ui';
import Logomark from '@/components/brand/Logomark';

export default function Custom500() {
  return (
    <>
      <Head>
        <title>500 - Server Error | Rash AI Financial Advisor</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="max-w-lg border-y border-border py-page text-center">
          <Logomark size={32} className="mx-auto mb-6 text-negative" />
          <p className="num mb-3 text-3xl text-negative">500</p>
          <h1 className="mb-4 font-display text-2xl font-semibold text-text">Internal Server Error</h1>
          <p className="mb-8 text-text-secondary">
            Something went wrong on our end. Please try again later.
          </p>
          <Link href="/dashboard" className={buttonClass({ variant: 'primary', size: 'md' })}>Return to Dashboard</Link>
        </div>
      </main>
    </>
  );
}
