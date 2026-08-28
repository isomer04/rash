import { useUser, useAuth } from "@clerk/nextjs";
import { useEffect, useState, useCallback } from "react";
import { API_URL } from "../lib/config";
import Layout from "../components/Layout";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { showToast } from "../components/Toast";
import Head from "next/head";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { Button, Card, Input, Stat, StatGrid } from "@/components/ui";
import { useChartTheme } from "@/lib/theme/chartTheme";
import { useTheme } from "@/lib/theme/ThemeContext";

interface AllocationDatum {
  name: string;
  value: number;
  percentage?: number;
}

function AllocationChart({
  data,
  height = 128,
  innerRadius = 0,
  valuePrefix = "",
  valueSuffix = "%",
  showLegend = true,
}: {
  data: AllocationDatum[];
  height?: number;
  innerRadius?: number;
  valuePrefix?: string;
  valueSuffix?: string;
  showLegend?: boolean;
}) {
  const chart = useChartTheme();
  const { theme } = useTheme();
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" key={theme}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={40}
              paddingAngle={2}
              dataKey="value"
              isAnimationActive={chart.animate}
            >
              {data.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={chart.series[index % chart.series.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => `${valuePrefix}${Number(value).toLocaleString()}${valueSuffix}`}
              contentStyle={{ background: chart.tooltipBg, borderColor: chart.tooltipBorder, color: chart.tooltipText, borderRadius: 3 }}
              itemStyle={{ color: chart.tooltipText }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {showLegend ? (
        <div className="mt-snug flex flex-wrap justify-center gap-x-base gap-y-tight text-xs text-text-secondary">
          {data.map((entry, index) => (
            <span key={entry.name} className="inline-flex items-center gap-tight">
              <span className="size-2 rounded-xs" style={{ backgroundColor: chart.series[index % chart.series.length] }} aria-hidden="true" />
              {entry.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface UserData {
  clerk_user_id: string;
  display_name: string;
  years_until_retirement: number;
  target_retirement_income: number;
  asset_class_targets: Record<string, number>;
  region_targets: Record<string, number>;
}

interface Account {
  account_id: string;
  clerk_user_id: string;
  account_name: string;
  account_type: string;
  account_purpose: string;
  cash_balance: number;
  created_at: string;
  updated_at: string;
}

interface Position {
  position_id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

interface Instrument {
  symbol: string;
  name: string;
  instrument_type: string;
  current_price?: number;
  asset_class_allocation?: Record<string, number>;
  region_allocation?: Record<string, number>;
  sector_allocation?: Record<string, number>;
}

export default function Dashboard() {
  const { user, isLoaded: userLoaded } = useUser();
  const { getToken } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [positions, setPositions] = useState<Record<string, Position[]>>({});
  const [instruments, setInstruments] = useState<Record<string, Instrument>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalysisDate, setLastAnalysisDate] = useState<string | null>(null);

  // Form state for editable fields - start empty to avoid flicker
  const [displayName, setDisplayName] = useState("");
  const [yearsUntilRetirement, setYearsUntilRetirement] = useState(0);
  const [targetRetirementIncome, setTargetRetirementIncome] = useState(0);
  const [equityTarget, setEquityTarget] = useState(0);
  const [fixedIncomeTarget, setFixedIncomeTarget] = useState(0);
  const [northAmericaTarget, setNorthAmericaTarget] = useState(0);
  const [internationalTarget, setInternationalTarget] = useState(0);

  // Calculate portfolio summary
  const calculatePortfolioSummary = useCallback(() => {
    let totalValue = 0;
    const assetClassBreakdown: Record<string, number> = {
      equity: 0,
      fixed_income: 0,
      alternatives: 0,
      cash: 0
    };

    // Add cash balances
    accounts.forEach(account => {
      const cashBalance = Number(account.cash_balance);
      totalValue += cashBalance;
      assetClassBreakdown.cash += cashBalance;
    });

    // Add position values
    Object.entries(positions).forEach(([, accountPositions]) => {
      accountPositions.forEach(position => {
        const instrument = instruments[position.symbol];
        if (instrument?.current_price) {
          const positionValue = Number(position.quantity) * Number(instrument.current_price);
          totalValue += positionValue;

          // Add to asset class breakdown
          if (instrument.asset_class_allocation) {
            Object.entries(instrument.asset_class_allocation).forEach(([assetClass, percentage]) => {
              assetClassBreakdown[assetClass] = (assetClassBreakdown[assetClass] || 0) + (positionValue * percentage / 100);
            });
          }
        }
      });
    });

    return { totalValue, assetClassBreakdown };
  }, [accounts, positions, instruments]);

  // Load user data and accounts
  useEffect(() => {
    async function loadData() {
      if (!userLoaded || !user) return;

      try {
        let token = await getToken();
        if (!token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        // Get/create user
        let userResponse = await fetch(`${API_URL}/api/user`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        // Clerk may briefly return a cached session token after a local dev
        // server restart. Refresh it once before treating an auth rejection as
        // an expired session.
        if (userResponse.status === 401 || userResponse.status === 403) {
          const refreshedToken = await getToken({ skipCache: true });

          if (refreshedToken) {
            token = refreshedToken;
            userResponse = await fetch(`${API_URL}/api/user`, {
              headers: {
                "Authorization": `Bearer ${token}`,
              },
            });
          }
        }

        if (!userResponse.ok) {
          const errorPayload = await userResponse.json().catch(() => ({ detail: "" }));
          const serverDetail = typeof errorPayload.detail === "string" ? errorPayload.detail : "";

          if (userResponse.status === 401) {
            const message = serverDetail || "Session expired. Please sign in again.";
            showToast("error", message);
            setError(message);
            setTimeout(() => {
              window.location.href = "/";
            }, 2000);
            return;
          }

          if (userResponse.status === 403) {
            const sessionExpired = /session.*(?:expired|invalid)|(?:expired|invalid).*session/i.test(serverDetail);

            if (sessionExpired) {
              showToast("error", serverDetail);
              setError(serverDetail);
              setTimeout(() => {
                window.location.href = "/";
              }, 2000);
            } else {
              setError(serverDetail || "You do not have permission to access this resource.");
            }
            return;
          }

          throw new Error(serverDetail || `Failed to sync user: ${userResponse.status}`);
        }

        const response = await userResponse.json();
        const userData = response.user; // Extract user from response
        setUserData(userData);
        setDisplayName(userData.display_name || "");
        setYearsUntilRetirement(userData.years_until_retirement || 0);
        // Ensure target_retirement_income is a number
        const income = userData.target_retirement_income
          ? (typeof userData.target_retirement_income === 'string'
            ? parseFloat(userData.target_retirement_income)
            : userData.target_retirement_income)
          : 0;
        setTargetRetirementIncome(income);
        setEquityTarget(userData.asset_class_targets?.equity || 0);
        setFixedIncomeTarget(userData.asset_class_targets?.fixed_income || 0);
        setNorthAmericaTarget(userData.region_targets?.north_america || 0);
        setInternationalTarget(userData.region_targets?.international || 0);

        // Get accounts
        const accountsResponse = await fetch(`${API_URL}/api/accounts`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          setAccounts(accountsData);

          // Get positions for each account
          const positionsMap: Record<string, Position[]> = {};
          const instrumentsMap: Record<string, Instrument> = {};

          for (const account of accountsData) {
            // Skip if account has no ID
            if (!account.id) {
              console.warn('Account missing ID in dashboard:', account);
              continue;
            }

            const positionsResponse = await fetch(`${API_URL}/api/accounts/${account.id}/positions`, {
              headers: {
                "Authorization": `Bearer ${token}`,
              },
            });

            if (positionsResponse.ok) {
              const positionsData = await positionsResponse.json();
              // API returns positions in a positions key
              positionsMap[account.id] = positionsData.positions || [];

              // Store instrument data from each position
              for (const position of positionsData.positions || []) {
                if (position.instrument) {
                  instrumentsMap[position.symbol] = position.instrument as Instrument;
                }
              }
            }
          }

          setPositions(positionsMap);
          setInstruments(instrumentsMap);
        }

        // Get last analysis date from jobs endpoint
        const jobsResponse = await fetch(`${API_URL}/api/jobs`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (jobsResponse.ok) {
          const jobsData = await jobsResponse.json();
          const lastJob = (jobsData.jobs || []).find(
            (job: { status: string }) => job.status === "completed"
          );
          if (lastJob) {
            setLastAnalysisDate(lastJob.completed_at || lastJob.created_at);
          }
        }

      } catch (err) {
        console.warn("Error loading dashboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [userLoaded, user, getToken]);

  // Listen for analysis completion events to refresh data
  useEffect(() => {
    if (!userLoaded || !user) return;

    const handleAnalysisCompleted = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        console.log('Analysis completed - refreshing dashboard data...');

        // Refresh accounts to get latest prices
        const accountsResponse = await fetch(`${API_URL}/api/accounts`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          setAccounts(accountsData.accounts || []);

          // Load positions for each account
          const positionsData: Record<string, Position[]> = {};
          const instrumentsData: Record<string, Instrument> = {};

          for (const account of accountsData.accounts || []) {
            const positionsResponse = await fetch(
              `${API_URL}/api/accounts/${account.id}/positions`,
              {
                headers: {
                  "Authorization": `Bearer ${token}`,
                },
              }
            );

            if (positionsResponse.ok) {
              const data = await positionsResponse.json();
              positionsData[account.id] = data.positions || [];

              // Extract instruments from positions
              for (const position of data.positions || []) {
                if (position.instrument) {
                  instrumentsData[position.symbol] = position.instrument;
                }
              }
            }
          }

          setPositions(positionsData);
          setInstruments(instrumentsData);

          // Portfolio will be recalculated on render
        }
      } catch (err) {
        console.error("Error refreshing dashboard data:", err);
      }
    };

    // Listen for the completion event
    window.addEventListener('analysis:completed', handleAnalysisCompleted);

    return () => {
      window.removeEventListener('analysis:completed', handleAnalysisCompleted);
    };
  }, [userLoaded, user, getToken, calculatePortfolioSummary]);

  // Save user settings
  const handleSaveSettings = async () => {
    if (!userData) return;

    // Input validation
    if (!displayName || displayName.trim().length === 0) {
      showToast('error', 'Display name is required');
      return;
    }

    if (yearsUntilRetirement < 0 || yearsUntilRetirement > 50) {
      showToast('error', 'Years until retirement must be between 0 and 50');
      return;
    }

    if (targetRetirementIncome < 0) {
      showToast('error', 'Target retirement income must be positive');
      return;
    }

    // Validate allocation percentages
    const equityFixed = equityTarget + fixedIncomeTarget;
    if (Math.abs(equityFixed - 100) > 0.01) {
      showToast('error', 'Equity and Fixed Income must sum to 100%');
      return;
    }

    const regionTotal = northAmericaTarget + internationalTarget;
    if (Math.abs(regionTotal - 100) > 0.01) {
      showToast('error', 'North America and International must sum to 100%');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const updateData = {
        display_name: displayName.trim(),
        years_until_retirement: yearsUntilRetirement,
        target_retirement_income: targetRetirementIncome,
        asset_class_targets: {
          equity: equityTarget,
          fixed_income: fixedIncomeTarget
        },
        region_targets: {
          north_america: northAmericaTarget,
          international: internationalTarget
        }
      };

      const response = await fetch(`${API_URL}/api/user`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.status}`);
      }

      const updatedUser = await response.json();
      setUserData(updatedUser);

      // Show success toast
      showToast('success', 'Settings saved successfully!');

    } catch (err) {
      console.error("Error saving settings:", err);
      showToast('error', err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const { totalValue, assetClassBreakdown } = calculatePortfolioSummary();

  // Prepare data for pie chart
  const pieChartData = Object.entries(assetClassBreakdown)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
      value: Math.round(value),
      percentage: totalValue > 0 ? Math.round(value / totalValue * 100) : 0
    }));

  return (
    <>
      <Head>
        <title>Dashboard - Rash AI Financial Advisor</title>
      </Head>
      <Layout>
      <div className="mx-auto max-w-[1240px] px-loose py-page">
        <h1 className="mb-section font-display text-2xl font-semibold text-text">Dashboard</h1>

        {loading ? (
          <div className="space-y-section">
            <div className="grid grid-cols-1 gap-base sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}><Skeleton className="mx-auto mb-snug h-4 w-3/4" /><Skeleton className="mx-auto h-8 w-1/2" /></Card>
              ))}
            </div>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            <Card padding="none" className="mb-section">
              <StatGrid columns={4}>
                <Stat align="end" label="Total Portfolio Value" value={<>${totalValue % 1 === 0
                  ? totalValue.toLocaleString('en-US')
                  : totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>} />
                <Stat align="end" label="Number of Accounts" value={accounts.length} />
                <div className="p-base text-center">
                  <p className="mb-tight text-2xs uppercase text-text-muted">Asset Allocation</p>
                  {pieChartData.length > 0 ? (
                    <AllocationChart data={pieChartData} height={96} innerRadius={20} valuePrefix="$" valueSuffix="" showLegend={false} />
                  ) : (
                    <p className="text-sm text-text-muted">No positions yet</p>
                  )}
                </div>
                <Stat align="end" label="Last Analysis" value={lastAnalysisDate ? new Date(lastAnalysisDate).toLocaleDateString() : "Never"} />
              </StatGrid>
            </Card>

        {/* User Settings Section */}
        <section className="border-y border-border bg-surface-raised p-loose">
          <h2 className="mb-loose text-xl font-medium text-text">User Settings</h2>

          {loading ? (
            <p className="text-text-muted">Loading...</p>
          ) : error && !error.includes("success") ? (
            <Card className="mb-base border-l-2 border-l-negative" padding="base">
              <div className="flex items-start gap-snug text-negative"><AlertIcon size={18} className="mt-hair shrink-0" /><p>{error}</p></div>
            </Card>
          ) : error && error.includes("success") ? (
            <div className="mb-base flex items-center gap-snug border-y border-positive bg-positive-soft p-base text-positive">
              <CheckIcon size={18} /><p>{error}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-loose md:grid-cols-2">
            {/* Basic Info */}
            <div>
              <Input
                label="Display Name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>

            <div>
              <Input
                label="Target Retirement Income (Annual)"
                type="text"
                numeric
                value={targetRetirementIncome ? targetRetirementIncome.toLocaleString('en-US') : ''}
                onChange={(e) => {
                  // Remove commas and parse as number
                  const value = e.target.value.replace(/,/g, '');
                  const num = parseInt(value) || 0;
                  if (!isNaN(num)) {
                    setTargetRetirementIncome(num);
                  }
                }}
              />
            </div>

            {/* Retirement Slider */}
            <div className="md:col-span-2">
              <label htmlFor="retirement-years" className="mb-snug block text-sm font-medium text-text">
                Years Until Retirement: <span className="num">{yearsUntilRetirement}</span>
              </label>
              <input
                id="retirement-years"
                type="range"
                min="0"
                max="50"
                value={yearsUntilRetirement}
                onChange={(e) => setYearsUntilRetirement(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="num flex justify-between text-xs text-text-muted">
                <span>0</span>
                <span>10</span>
                <span>20</span>
                <span>30</span>
                <span>40</span>
                <span>50</span>
              </div>
            </div>

            {/* Target Allocations */}
            <Card>
              <h3 className="mb-base text-2xs uppercase text-text-muted">Target Asset Class Allocation</h3>
              <div className="space-y-base">
                <div>
                  <label htmlFor="equity-target" className="text-sm text-text-secondary">Equity: <span className="num">{equityTarget}%</span></label>
                  <input
                    id="equity-target"
                    type="range"
                    min="0"
                    max="100"
                    value={equityTarget}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEquityTarget(val);
                      setFixedIncomeTarget(100 - val);
                    }}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <label htmlFor="fixed-income-target" className="text-sm text-text-secondary">Fixed Income: <span className="num">{fixedIncomeTarget}%</span></label>
                  <input
                    id="fixed-income-target"
                    type="range"
                    min="0"
                    max="100"
                    value={fixedIncomeTarget}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFixedIncomeTarget(val);
                      setEquityTarget(100 - val);
                    }}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              {/* Mini pie chart for asset allocation */}
              <div className="mt-base">
                <AllocationChart data={[
                  { name: 'Equity', value: equityTarget },
                  { name: 'Fixed Income', value: fixedIncomeTarget }
                ]} />
              </div>
            </Card>

            <Card>
              <h3 className="mb-base text-2xs uppercase text-text-muted">Target Regional Allocation</h3>
              <div className="space-y-base">
                <div>
                  <label htmlFor="north-america-target" className="text-sm text-text-secondary">North America: <span className="num">{northAmericaTarget}%</span></label>
                  <input
                    id="north-america-target"
                    type="range"
                    min="0"
                    max="100"
                    value={northAmericaTarget}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setNorthAmericaTarget(val);
                      setInternationalTarget(100 - val);
                    }}
                    className="w-full accent-primary"
                  />
                </div>
                <div>
                  <label htmlFor="international-target" className="text-sm text-text-secondary">International: <span className="num">{internationalTarget}%</span></label>
                  <input
                    id="international-target"
                    type="range"
                    min="0"
                    max="100"
                    value={internationalTarget}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setInternationalTarget(val);
                      setNorthAmericaTarget(100 - val);
                    }}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              {/* Mini pie chart for regional allocation */}
              <div className="mt-base">
                <AllocationChart data={[
                  { name: 'North America', value: northAmericaTarget },
                  { name: 'International', value: internationalTarget }
                ]} />
              </div>
            </Card>
          </div>

          <div className="mt-loose">
            <Button
              variant="primary"
              onClick={handleSaveSettings}
              disabled={loading}
              loading={saving}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </section>
          </>
        )}
      </div>
      </Layout>
    </>
  );
}
