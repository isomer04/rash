import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@clerk/nextjs';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Layout from '../components/Layout';
import { API_URL } from '../lib/config';
import Head from 'next/head';
import MarkdownReport from '../components/MarkdownReport';
import { SkeletonCard } from '../components/Skeleton';
import {
  Button, Card, CardBody, CardHeader, CardTitle, EmptyState,
  Tabs, Tab, TabList, TabPanel,
} from '@/components/ui';
import { ChartPieIcon, RefreshIcon, TargetIcon, TrendUpIcon } from '@/components/icons';
import { useChartTheme } from '@/lib/theme/chartTheme';
import { useTheme } from '@/lib/theme/ThemeContext';

interface Job {
  id: string;
  created_at: string;
  status: string;
  job_type: string;
  report_payload?: {
    agent: string;
    content: string;
    generated_at: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  charts_payload?: Record<string, any> | null;  // Charter stores charts with dynamic keys
  retirement_payload?: {
    agent: string;
    analysis: string;
    generated_at: string;
  };
  error_message?: string;
}

interface JobListItem {
  id: string;
  created_at: string;
  status: string;
  job_type: string;
}

type TabType = 'overview' | 'charts' | 'retirement';

export default function Analysis() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { job_id } = router.query;
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [fetchingLatest, setFetchingLatest] = useState(false);
  const chart = useChartTheme();
  const { theme } = useTheme();

  useEffect(() => {
    const loadJob = async (jobId: string) => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const jobData = await response.json();
          setJob(jobData);
        } else {
          console.error('Failed to fetch job');
        }
      } catch (error) {
        console.error('Error fetching job:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadLatestJob = async () => {
      setFetchingLatest(true);
      try {
        const token = await getToken();
        // First, get the list of jobs to find the latest completed one
        const response = await fetch(`${API_URL}/api/jobs`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const jobs: JobListItem[] = data.jobs || [];
          // Find the latest completed job
          const latestCompletedJob = jobs
            .filter(j => j.status === 'completed')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

          if (latestCompletedJob) {
            // Load the full job details
            await loadJob(latestCompletedJob.id);
            // Update the URL to include the job_id without causing a page reload
            router.replace(`/analysis?job_id=${latestCompletedJob.id}`, undefined, { shallow: true });
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching latest job:', error);
        setLoading(false);
      } finally {
        setFetchingLatest(false);
      }
    };

    if (job_id) {
      loadJob(job_id as string);
    } else if (router.isReady) {
      // Router is ready but no job_id provided - fetch the latest analysis
      loadLatestJob();
    }
  }, [job_id, router.isReady, getToken, router]);


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-4 py-page sm:px-6 lg:px-8" aria-busy="true"><SkeletonCard /></div>
      </Layout>
    );
  }

  if (!job) {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-4 py-page sm:px-6 lg:px-8">
            <EmptyState icon={<ChartPieIcon size={24} />} title={
                fetchingLatest ? 'Loading Latest Analysis...' : 'No Analysis Available'
              } description={
                fetchingLatest
                  ? 'Please wait while we load your latest analysis.'
                  : 'You have not completed any analyses yet. Start a new analysis to see results here.'
              } action={
              !fetchingLatest && (
                <Button onClick={() => router.push('/advisor-team')} variant="agent">Start new analysis</Button>
              )
              } />
        </div>
      </Layout>
    );
  }

  if (job.status === 'running' || job.status === 'pending') {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-4 py-page sm:px-6 lg:px-8">
          <EmptyState icon={<RefreshIcon className="animate-spin text-agent" size={24} />} title="Analysis in progress"
            description="Your analysis is still being processed. Please check back in a few moments."
            action={<Button onClick={() => window.location.reload()} variant="secondary">Refresh</Button>} />
        </div>
      </Layout>
    );
  }

  if (job.status === 'failed') {
    return (
      <Layout>
        <div className="mx-auto max-w-7xl px-4 py-page sm:px-6 lg:px-8">
            <Card className="border-l-2 border-negative">
              <CardTitle className="text-2xl text-negative">Analysis failed</CardTitle>
              <p className="mb-4 text-text-secondary">The analysis encountered an error and could not be completed.</p>
              {job.error_message && (
                <div className="mb-6 bg-negative-soft p-4">
                  <p className="text-sm text-negative">{job.error_message}</p>
                </div>
              )}
              <Button onClick={() => router.push('/advisor-team')} variant="agent">Try another analysis</Button>
            </Card>
        </div>
      </Layout>
    );
  }


  // Tab content renderers
  const renderOverview = () => {
    const report = job?.report_payload?.content;
    if (!report) {
      return (
        <EmptyState title="No portfolio report available" description="This analysis did not include a narrative report." />
      );
    }

    return <MarkdownReport>{report}</MarkdownReport>;
  };

  const renderCharts = () => {
    const chartsPayload = job?.charts_payload;
    if (!chartsPayload || Object.keys(chartsPayload).length === 0) {
      return (
        <EmptyState title="No chart data available" description="This analysis did not include chart specifications." />
      );
    }

    // Helper function to format chart title from key
    const formatTitle = (key: string): string => {
      return key
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    // Helper function to determine chart type based on data structure or chart metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getChartType = (chartData: any): 'pie' | 'donut' | 'bar' | 'horizontalBar' | 'line' => {
      // If the charter agent specifies a type, use it directly if supported
      if (chartData.type) {
        const supportedTypes = ['pie', 'donut', 'bar', 'horizontalBar', 'line'];
        if (supportedTypes.includes(chartData.type)) {
          return chartData.type;
        }
        // Map variations to supported types
        const typeMap: Record<string, 'pie' | 'donut' | 'bar' | 'horizontalBar' | 'line'> = {
          'column': 'bar',
          'area': 'line'
        };
        if (typeMap[chartData.type]) {
          return typeMap[chartData.type];
        }
      }

      // Otherwise, make an intelligent guess based on the data
      // If data has dates/time series, use line chart
      if (chartData.data?.[0]?.date || chartData.data?.[0]?.year) return 'line';

      // If data represents parts of a whole (has percentages or small dataset), use pie
      if (chartData.data?.length <= 10 && chartData.data?.[0]?.value) return 'pie';

      // Default to bar chart for other cases
      return 'bar';
    };

    // Dynamically render all charts provided by the charter agent
    const chartEntries = Object.entries(chartsPayload);

    return (
      <div className="grid grid-cols-1 gap-section lg:grid-cols-2">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {chartEntries.map(([key, chartData]: [string, any]) => {
          // Skip if no data
          if (!chartData?.data || chartData.data.length === 0) return null;

          const chartType = getChartType(chartData);
          const title = chartData.title || formatTitle(key);

          return (
            <Card key={`${theme}-${key}`} padding="loose">
              <CardTitle className="mb-4 text-xl">{title}</CardTitle>
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'pie' || chartType === 'donut' ? (
                  <PieChart>
                    <Pie
                      data={chartData.data}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label
                      outerRadius={100}
                      innerRadius={chartType === 'donut' ? 60 : 0}  // Donut has inner radius
                      fill={chart.series[0]}
                      dataKey="value"
                      isAnimationActive={chart.animate}
                    >
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {chartData.data.map((entry: any, idx: number) => (
                        <Cell key={`cell-${idx}`} fill={chart.series[idx % chart.series.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} contentStyle={{ backgroundColor: chart.tooltipBg, borderColor: chart.tooltipBorder, color: chart.tooltipText }} />
                  </PieChart>
                ) : chartType === 'horizontalBar' ? (
                  // For horizontal bars, just use regular vertical bars with rotated labels
                  // Recharts horizontal layout can be problematic
                  <BarChart
                    data={chartData.data}
                    margin={{ left: 10, right: 30, top: 5, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis
                      dataKey="name"
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={60}
                      stroke={chart.axis}
                    />
                    <YAxis
                      tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`}
                      stroke={chart.axis}
                    />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} contentStyle={{ backgroundColor: chart.tooltipBg, borderColor: chart.tooltipBorder, color: chart.tooltipText }} />
                    <Bar dataKey="value">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {chartData.data?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={chart.series[index % chart.series.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={chartData.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} stroke={chart.axis} />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} stroke={chart.axis} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} contentStyle={{ backgroundColor: chart.tooltipBg, borderColor: chart.tooltipBorder, color: chart.tooltipText }} />
                    <Bar dataKey="value" fill={chart.series[0]} isAnimationActive={chart.animate} />
                  </BarChart>
                ) : (
                  // Line chart for time series data
                  <LineChart data={chartData.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                    <XAxis dataKey={chartData.xKey || "year"} stroke={chart.axis} />
                    <YAxis tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} stroke={chart.axis} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString('en-US')}`} contentStyle={{ backgroundColor: chart.tooltipBg, borderColor: chart.tooltipBorder, color: chart.tooltipText }} />
                    <Line type="monotone" dataKey="value" stroke={chart.series[0]} strokeWidth={2} isAnimationActive={chart.animate} />
                  </LineChart>
                )}
              </ResponsiveContainer>

              {/* Add legend for pie/donut charts with many items */}
              {(chartType === 'pie' || chartType === 'donut') && chartData.data.length > 6 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {chartData.data.map((entry: any, idx: number) => (
                    <div key={entry.name} className="flex items-center text-sm">
                      <div
                        className="mr-2 h-3 w-3 rounded-xs"
                        style={{ backgroundColor: chart.series[idx % chart.series.length] }}
                      />
                      <span className="text-text-secondary">{entry.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    );
  };

  const renderRetirement = () => {
    const retirement = job?.retirement_payload;
    if (!retirement) {
      return (
        <EmptyState title="No retirement projection available" description="Add retirement goals before running another analysis." />
      );
    }

    // Backend provides 'analysis' as markdown text
    const retirementAnalysis = retirement.analysis;

    return (
      <div className="space-y-8">
        {/* Analysis Section */}
        {retirementAnalysis && (
          <div className="rounded-md border border-agent bg-agent-soft p-loose shadow-raise">
            <MarkdownReport>{retirementAnalysis}</MarkdownReport>
          </div>
        )}

      </div>
    );
  };

  return (
    <>
      <Head>
        <title>Analysis - Rash AI Financial Advisor</title>
      </Head>
      <Layout>
      <div className="mx-auto max-w-7xl space-y-section px-4 py-page sm:px-6 lg:px-8">
          {/* Header */}
          <Card>
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-2xs uppercase tracking-[0.08em] text-text-muted">Advisory record</p>
                <CardTitle className="mt-1 text-2xl">Portfolio analysis results</CardTitle>
                <p className="mt-2 text-text-secondary">
                  Completed on {formatDate(job.created_at)}
                </p>
              </div>
              <Button onClick={() => router.push('/advisor-team')} variant="agent">New analysis</Button>
            </CardHeader>
          </Card>

          <Card padding="none">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
              <TabList label="Analysis sections">
                <Tab value="overview"><ChartPieIcon size={16} /> Overview</Tab>
                <Tab value="charts"><TrendUpIcon size={16} /> Charts</Tab>
                <Tab value="retirement"><TargetIcon size={16} /> Retirement projection</Tab>
              </TabList>
              <CardBody>
                <TabPanel value="overview">{renderOverview()}</TabPanel>
                <TabPanel value="charts">{renderCharts()}</TabPanel>
                <TabPanel value="retirement">{renderRetirement()}</TabPanel>
              </CardBody>
            </Tabs>
          </Card>
      </div>
      </Layout>
    </>
  );
}
