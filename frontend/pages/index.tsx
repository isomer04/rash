import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import Head from "next/head";
import Logomark from "@/components/brand/Logomark";
import Wordmark from "@/components/brand/Wordmark";
import {
  BoltIcon,
  ChartPieIcon,
  DocumentIcon,
  HourglassIcon,
  ShieldIcon,
  TargetIcon,
  TrendUpIcon,
  type IconProps,
} from "@/components/icons";
import { Button, ThemeToggle, buttonClass } from "@/components/ui";

/**
 * The landing page, set as a ruled sheet rather than a stack of cards.
 *
 * Separation is by hairline throughout: the sections are divided by rules, the
 * advisory team is a ruled list rather than a three-column card grid, and the one
 * band that changes tone does so by dropping to the sunken surface between two
 * rules. Nothing lifts, nothing is tinted, and the only saturated colour on the
 * page is the agent tone inside the logomark.
 */

/** The advisory team, as ruled rows: eyebrow, icon, one line of copy. */
const TEAM: ReadonlyArray<{
  role: string;
  line: string;
  Icon: (p: IconProps) => React.ReactElement;
}> = [
  {
    role: "Financial Planner",
    line: "Coordinates the run and decides which specialists a portfolio actually needs.",
    Icon: TargetIcon,
  },
  {
    role: "Portfolio Analyst",
    line: "Reads holdings, performance and concentration, and writes the findings up.",
    Icon: ChartPieIcon,
  },
  {
    role: "Chart Specialist",
    line: "Turns allocation and exposure into charts you can read at a glance.",
    Icon: TrendUpIcon,
  },
  {
    role: "Retirement Planner",
    line: "Projects retirement readiness against your contributions and target date.",
    Icon: HourglassIcon,
  },
];

/** What a completed run returns, as a ruled index of the deliverable. */
const DELIVERABLES: readonly string[] = [
  "Portfolio summary and total value",
  "Asset-class and regional allocation",
  "Holdings analysis with concentration notes",
  "Retirement projection against your target",
  "A written report you can keep",
];

const BENEFITS: ReadonlyArray<{
  title: string;
  line: string;
  Icon: (p: IconProps) => React.ReactElement;
}> = [
  {
    title: "Analysis in parallel",
    line: "Specialists run concurrently, so a full review returns in one pass rather than one queue.",
    Icon: BoltIcon,
  },
  {
    title: "Your data stays yours",
    line: "The browser sends your signed-in session with account and position requests, leaving access control to the server.",
    Icon: ShieldIcon,
  },
  {
    title: "Written, not just plotted",
    line: "Every run produces prose alongside the charts, so a figure always arrives with its reason.",
    Icon: DocumentIcon,
  },
];

export default function Home() {
  return (
    <>
      <Head>
        <title>Rash — AI financial advisor</title>
      </Head>

      <div className="min-h-screen bg-surface text-text">
        {/* ---- Nav: a hairline rule, no shadow, no status dot ------------- */}
        <header className="border-b border-border">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-snug px-base sm:px-loose">
            <Wordmark size="sm" />
            <div className="flex items-center gap-tight sm:gap-snug">
              <ThemeToggle size="sm" />
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button variant="primary" size="sm">
                    Get started
                  </Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className={buttonClass({ variant: "primary", size: "sm" })}
                >
                  Open dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </div>
        </header>

        {/* ---- Hero: asymmetric two-column grid, flat surface ------------- */}
        <section className="mx-auto max-w-6xl px-base py-page sm:px-loose">
          <div className="grid gap-section md:grid-cols-12 md:gap-page">
            <div className="md:col-span-7">
              <p className="text-2xs uppercase text-text-muted">
                AI financial advisor
              </p>
              {/*
                Display face at the `display` step. Presence comes from the
                condensed face's own width and tracking rather than from a heavy
                weight at an oversized step, which is the template treatment this
                replaces.
              */}
              <h1 className="mt-snug font-display text-display font-medium tracking-[-0.02em] text-text">
                Five agents read your portfolio, then write it up.
              </h1>
              <p className="mt-base max-w-[65ch] text-lg text-text-secondary">
                Autonomous specialists work in parallel across your holdings,
                your allocation and your retirement horizon, and return a
                written report with the charts that back it.
              </p>
              <div className="mt-section flex flex-wrap items-center gap-snug">
                <SignedOut>
                  <SignUpButton mode="modal">
                    <Button variant="primary" size="lg">
                      Start an analysis
                    </Button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <Link
                    href="/dashboard"
                    className={buttonClass({ variant: "primary", size: "lg" })}
                  >
                    Open dashboard
                  </Link>
                </SignedIn>
                <a
                  href="#advisory-team"
                  className={buttonClass({ variant: "ghost", size: "lg" })}
                >
                  Meet the team
                </a>
              </div>
            </div>

            {/*
              The right column is the ledger the direction is named for: a ruled
              index of the deliverable, mono figures on the left rail.
            */}
            <aside className="border-t border-border pt-base md:col-span-5 md:border-l md:border-t-0 md:pl-loose md:pt-0">
              <p className="text-2xs uppercase text-text-muted">
                What a run returns
              </p>
              <ol className="mt-base border-t border-border">
                {DELIVERABLES.map((item, index) => (
                  <li
                    key={item}
                    className="flex items-baseline gap-snug border-b border-border py-snug"
                  >
                    <span className="num-left shrink-0 text-xs text-text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm text-text-secondary">{item}</span>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </section>

        {/* ---- Advisory team: ruled rows, never a card grid --------------- */}
        <section id="advisory-team" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-base py-page sm:px-loose">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text">
              The advisory team
            </h2>
            <p className="mt-snug max-w-[65ch] text-base text-text-secondary">
              Four specialists and one orchestrator. Each writes into the same
              report, so the findings arrive as one document rather than four.
            </p>
            <ul className="mt-section border-t border-border">
              {TEAM.map(({ role, line, Icon }) => (
                <li
                  key={role}
                  className="grid grid-cols-[1.25rem_1fr] items-baseline gap-x-snug gap-y-tight border-b border-border py-base md:grid-cols-[1.25rem_13rem_1fr] md:gap-x-loose"
                >
                  <Icon className="text-text-muted" />
                  <span className="text-2xs uppercase text-text-muted">
                    {role}
                  </span>
                  <span className="col-span-2 text-base text-text-secondary md:col-span-1">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Benefits band: sunken surface between two hairlines -------- */}
        <section className="border-y border-border bg-surface-sunken">
          <div className="mx-auto max-w-6xl px-base py-page sm:px-loose">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-text">
              Built to be read, not admired
            </h2>
            {/* Columns separated by vertical rules rather than by containers. */}
            <div className="mt-section grid gap-base md:grid-cols-3 md:gap-0 md:divide-x md:divide-border">
              {BENEFITS.map(({ title, line, Icon }) => (
                <div
                  key={title}
                  className="border-t border-border pt-base md:border-t-0 md:px-loose md:pt-0 md:first:pl-0 md:last:pr-0"
                >
                  <Icon className="text-text-muted" />
                  <h3 className="mt-snug text-lg font-medium text-text">
                    {title}
                  </h3>
                  <p className="mt-tight text-base text-text-secondary">
                    {line}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- CTA: an inverted panel, driven by the text tokens ---------- */}
        <section className="bg-text text-text-inverse">
          <div className="mx-auto max-w-6xl px-base py-page sm:px-loose">
            <div className="grid items-end gap-section md:grid-cols-12">
              <div className="md:col-span-8">
                <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">
                  Point it at your accounts and read what comes back.
                </h2>
                <p className="mt-snug max-w-[65ch] text-base">
                  Add a portfolio, run the team, and keep the report.
                </p>
              </div>
              <div className="md:col-span-4 md:justify-self-end">
                <SignedOut>
                  <SignUpButton mode="modal">
                  {/*
                    Inside an inverted panel the maximum-contrast surface is the
                    inverse one, so the primary recipe's fill and text are
                    swapped for their inverse tokens rather than hard-coded.
                  */}
                  <Button
                    variant="primary"
                    size="lg"
                    className="bg-text-inverse text-text hover:bg-surface-raised"
                  >
                    Get started
                  </Button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <Link
                    href="/dashboard"
                    className={buttonClass({
                      variant: "primary",
                      size: "lg",
                      className: "bg-text-inverse text-text hover:bg-surface-raised",
                    })}
                  >
                    Open dashboard
                  </Link>
                </SignedIn>
              </div>
            </div>
          </div>
        </section>

        {/* ---- Footer ----------------------------------------------------- */}
        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-base py-section sm:px-loose">
            <div className="flex flex-wrap items-center justify-between gap-snug">
              <Logomark size={20} className="text-text-muted" />
              <p className="text-xs text-text-muted">
                &copy; {new Date().getFullYear()} Rash. All rights reserved.
              </p>
            </div>
            {/*
              The one sanctioned left accent rule on this page: severity. The
              disclaimer text is unchanged.
            */}
            <p className="mt-base max-w-[72ch] border-l-2 border-warning pl-snug text-xs text-text-secondary">
              This AI-generated advice has not been vetted by a qualified
              financial advisor and should not be used for trading decisions. For
              informational purposes only.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
