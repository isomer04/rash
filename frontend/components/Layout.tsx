import { Protect, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ComponentType, ReactElement, ReactNode } from "react";
import Wordmark from "@/components/brand/Wordmark";
import {
  AgentsIcon,
  AlertIcon,
  ChartPieIcon,
  DocumentIcon,
  type IconProps,
  WalletIcon,
} from "@/components/icons";
import PageTransition from "@/components/PageTransition";
import { Card, ThemeToggle } from "@/components/ui";
import { mergeClasses } from "@/lib/cx.mjs";
import { useClerkAppearance } from "@/lib/theme/clerkAppearance";

interface LayoutProps {
  children: ReactNode;
}

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: ChartPieIcon },
  { href: "/accounts", label: "Accounts", icon: WalletIcon },
  { href: "/advisor-team", label: "Advisor Team", icon: AgentsIcon },
  { href: "/analysis", label: "Analysis", icon: DocumentIcon },
] as const;

function NavLinks({ variant }: { variant: "desktop" | "mobile" }): ReactElement {
  const router = useRouter();
  return (
    <div
      className={mergeClasses(
        "items-center",
        variant === "desktop" ? "hidden gap-base md:flex" : "flex min-w-max gap-tight md:hidden",
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = router.pathname === href || (href === "/accounts" && router.pathname.startsWith("/accounts/"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={mergeClasses(
              "relative inline-flex h-10 items-center gap-tight border-b-2 px-snug text-sm font-medium transition-colors duration-quick focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              active
                ? "border-primary text-text"
                : "border-transparent text-text-muted hover:text-text",
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export default function Layout({ children }: LayoutProps): ReactElement {
  const { user } = useUser();
  const appearance = useClerkAppearance();

  return (
    <Protect
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-surface">
          <p className="text-sm text-text-secondary">Redirecting to sign in...</p>
        </div>
      }
    >
      <div className="flex min-h-screen flex-col bg-surface text-text">
        <nav className="border-b border-border bg-surface-raised">
          <div className="mx-auto max-w-[1240px] px-loose">
            <div className="flex h-16 items-center justify-between gap-base">
              <div className="flex min-w-0 items-center gap-section">
                <Link href="/dashboard" className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" aria-label="Rash dashboard">
                  <Wordmark size="md" />
                </Link>
                <NavLinks variant="desktop" />
              </div>

              <div className="flex shrink-0 items-center gap-snug">
                <span className="hidden max-w-48 truncate text-sm text-text-secondary sm:inline">
                  {user?.firstName || user?.emailAddresses[0]?.emailAddress}
                </span>
                <ThemeToggle />
                <UserButton appearance={appearance.userButton} afterSignOutUrl="/" />
              </div>
            </div>
            <div className="-mx-loose overflow-x-auto px-loose md:hidden">
              <NavLinks variant="mobile" />
            </div>
          </div>
        </nav>

        <main className="flex-1">
          <PageTransition>{children}</PageTransition>
        </main>

        <footer className="mt-auto border-t border-border bg-surface-raised">
          <div className="mx-auto max-w-[1240px] px-loose py-loose">
            <Card className="border-l-2 border-l-warning" padding="base">
              <div className="flex items-start gap-snug">
                <AlertIcon size={18} className="mt-hair shrink-0 text-warning" />
                <div>
                  <p className="mb-tight text-sm font-medium text-text">Important Disclaimer</p>
                  <p className="text-xs text-text-secondary">
                    This AI-generated advice has not been vetted by a qualified financial advisor and should not be used for trading decisions.
                    For informational purposes only. Always consult with a licensed financial professional before making investment decisions.
                  </p>
                </div>
              </div>
            </Card>
            <div className="mt-base border-t border-border pt-base">
              <p className="text-center text-xs text-text-muted">
                &copy; 2026 Rash AI Financial Advisor. Powered by AI agents and built with care.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </Protect>
  );
}
