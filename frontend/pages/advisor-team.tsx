import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@clerk/nextjs';
import Layout from '../components/Layout';
import { API_URL } from '../lib/config';
import { emitAnalysisCompleted, emitAnalysisFailed, emitAnalysisStarted } from '../lib/events';
import Head from 'next/head';
import { Button, Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Table, type BadgeTone, type Column } from '@/components/ui';
import { AgentsIcon, ChartPieIcon, HourglassIcon, SpinnerIcon, TargetIcon, TrendUpIcon } from '@/components/icons';
import type { IconProps } from '@/components/icons';
import type { ComponentType } from 'react';

interface Agent {
  icon: ComponentType<IconProps>;
  name: string;
  role: string;
  description: string;
  tone: 'accent' | 'agent' | 'positive' | 'warning';
}

interface Job {
  id: string;
  created_at: string;
  status: string;
  job_type: string;
}

interface AnalysisProgress {
  stage: 'idle' | 'starting' | 'planner' | 'parallel' | 'completing' | 'complete' | 'error';
  message: string;
  activeAgents: string[];
  error?: string;
}

const MAX_CONSECUTIVE_AUTH_FAILURES = 3;

const getProgressValue = (stage: AnalysisProgress['stage']) =>
  stage === 'starting' ? 10 :
  stage === 'planner' ? 30 :
  stage === 'parallel' ? 70 :
  stage === 'completing' ? 90 :
  100;

const agents: Agent[] = [
  {
    icon: TargetIcon,
    name: 'Financial Planner',
    role: 'Orchestrator',
    description: 'Coordinates your financial analysis',
    tone: 'agent'
  },
  {
    icon: ChartPieIcon,
    name: 'Portfolio Analyst',
    role: 'Reporter',
    description: 'Analyzes your holdings and performance',
    tone: 'accent'
  },
  {
    icon: TrendUpIcon,
    name: 'Chart Specialist',
    role: 'Charter',
    description: 'Visualizes your portfolio composition',
    tone: 'positive'
  },
  {
    icon: HourglassIcon,
    name: 'Retirement Planner',
    role: 'Retirement',
    description: 'Projects your retirement readiness',
    tone: 'warning'
  }
];

export default function AdvisorTeam() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: 'idle',
    message: '',
    activeAgents: []
  });
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const authFailureCount = useRef(0);

  const clearProgressTimer = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  };

  const stopWithError = (message: string, error: string) => {
    authFailureCount.current = 0;
    setProgress({ stage: 'error', message, activeAgents: [], error });
    clearProgressTimer();
    setIsAnalyzing(false);
    setCurrentJobId(null);
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const checkJobStatusLocal = async (jobId: string) => {
      try {
        const token = await getToken();
        const response = await fetch(`${API_URL}/api/jobs/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401 || response.status === 403) {
          authFailureCount.current += 1;
          if (authFailureCount.current >= MAX_CONSECUTIVE_AUTH_FAILURES) {
            stopWithError(
              'Authentication failed',
              'Your session could not be authenticated while checking analysis status.'
            );
          }
          return;
        }

        authFailureCount.current = 0;

        if (response.ok) {
          const job = await response.json();

          if (job.status === 'completed') {
            setProgress({
              stage: 'complete',
              message: 'Analysis complete!',
              activeAgents: []
            });

            clearProgressTimer();

            // Emit completion event so other components can refresh
            emitAnalysisCompleted(jobId);

            // Also refresh our own jobs list
            fetchJobs();

            setTimeout(() => {
              router.push(`/analysis?job_id=${jobId}`);
            }, 1500);
          } else if (job.status === 'failed') {
            // Emit failure event
            emitAnalysisFailed(jobId, job.error);

            stopWithError(
              'Analysis failed',
              job.error || 'Analysis encountered an error'
            );
          }
        }
      } catch (error) {
        console.error('Error checking job status:', error);
      }
    };

    if (currentJobId && !pollInterval) {
      const interval = setInterval(() => {
        checkJobStatusLocal(currentJobId);
      }, 2000);
      setPollInterval(interval);
    }

    return () => {
      clearProgressTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentJobId, pollInterval, router]);

  const fetchJobs = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/jobs`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setProgress({
      stage: 'starting',
      message: 'Initializing analysis...',
      activeAgents: []
    });

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          analysis_type: 'portfolio',
          options: {}
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (typeof data.job_id !== 'string' || data.job_id.trim() === '') {
          throw new Error('Analysis response did not include a valid job ID');
        }

        setCurrentJobId(data.job_id);

        // Emit start event
        emitAnalysisStarted(data.job_id);

        setProgress({
          stage: 'planner',
          message: 'Financial Planner coordinating analysis...',
          activeAgents: ['Financial Planner']
        });

        setTimeout(() => {
          setProgress({
            stage: 'parallel',
            message: 'Agents working in parallel...',
            activeAgents: ['Portfolio Analyst', 'Chart Specialist', 'Retirement Planner']
          });
        }, 5000);
      } else {
        throw new Error('Failed to start analysis');
      }
    } catch (error) {
      console.error('Error starting analysis:', error);
      setProgress({
        stage: 'error',
        message: 'Failed to start analysis',
        activeAgents: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setIsAnalyzing(false);
      setCurrentJobId(null);
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusTone = (status: string): BadgeTone => {
    switch (status) {
      case 'completed':
        return 'positive';
      case 'failed':
        return 'negative';
      case 'running':
        return 'agent';
      default:
        return 'neutral';
    }
  };

  const isAgentActive = (agentName: string) => {
    return progress.activeAgents.includes(agentName);
  };

  const jobColumns: Column<Job>[] = [
    { key: 'analysis', header: 'Analysis', render: (job) => <div><p className="font-medium text-text">Analysis #{job.id.slice(0, 8)}</p><p className="text-xs text-text-muted">{formatDate(job.created_at)}</p></div> },
    { key: 'status', header: 'Status', render: (job) => <Badge tone={getStatusTone(job.status)} dot>{job.status.charAt(0).toUpperCase() + job.status.slice(1)}</Badge> },
    { key: 'actions', header: 'Actions', srOnlyHeader: true, align: 'end', render: (job) => job.status === 'completed' ? <Button size="sm" variant="secondary" onClick={() => router.push(`/analysis?job_id=${job.id}`)}>View</Button> : null },
  ];

  return (
    <>
      <Head>
        <title>Advisor Team - Rash AI Financial Advisor</title>
      </Head>
      <Layout>
      <div className="mx-auto max-w-7xl space-y-section px-4 py-page sm:px-6 lg:px-8">
          <Card>
            <p className="text-2xs uppercase tracking-[0.08em] text-text-muted">Agent desk</p>
            <CardTitle className="mt-1 text-2xl">Your AI advisory team</CardTitle>
            <p className="mt-2 text-text-secondary">
              Meet your team of specialized AI agents that work together to provide comprehensive financial analysis.
            </p>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {agents.map((agent) => {
              const AgentIcon = agent.icon;
              const active = isAgentActive(agent.name);
              const toneClass = { accent: 'text-accent', agent: 'text-agent', positive: 'text-positive', warning: 'text-warning' }[agent.tone];
              return (
                <Card key={agent.name} className={active ? 'bg-agent-soft ring-2 ring-agent' : ''}>
                  <AgentIcon size={24} className={`mb-4 ${toneClass}`} />
                  <CardTitle className="text-lg">{agent.name}</CardTitle>
                  <p className="mb-3 text-xs text-text-muted">{agent.role}</p>
                  <p className="text-sm text-text-secondary">{agent.description}</p>
                  {active && <Badge tone="agent" dot className="mt-4"><span className="animate-strong-pulse">Active</span></Badge>}
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-4 border-b border-border pb-loose md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-xl">Analysis center</CardTitle>
              <Button
                onClick={startAnalysis}
                loading={isAnalyzing}
                variant="agent"
                iconLeft={<AgentsIcon size={18} />}
              >
                Start new analysis
              </Button>
            </CardHeader>
            <CardBody className="space-y-section pt-loose">

            {isAnalyzing && (
              <div className="border border-agent bg-agent-soft p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text">Analysis progress</h3>
                  {progress.stage !== 'error' && progress.stage !== 'complete' && (
                    <SpinnerIcon className="animate-spin text-agent" aria-hidden="true" />
                  )}
                </div>

                <p className={`text-sm mb-4 ${
                  progress.stage === 'error' ? 'text-negative' : 'text-text-secondary'
                }`}>
                  {progress.message}
                </p>

                {progress.stage === 'error' && progress.error && (
                  <div className="mt-4 border-l-2 border-negative bg-negative-soft p-4">
                    <p className="text-sm text-negative">{progress.error}</p>
                    <Button
                      onClick={() => {
                        setIsAnalyzing(false);
                        setCurrentJobId(null);
                        setProgress({ stage: 'idle', message: '', activeAgents: [] });
                      }}
                      className="mt-3" variant="danger" size="sm"
                    >
                      Try again
                    </Button>
                  </div>
                )}

                {progress.stage !== 'idle' && progress.stage !== 'error' && (
                  <div className="h-2 w-full overflow-hidden rounded-xs bg-surface-sunken">
                    <div
                      className="h-2 bg-agent transition-[width] duration-slow"
                      role="progressbar"
                      aria-valuenow={getProgressValue(progress.stage)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      style={{ width: `${getProgressValue(progress.stage)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="mb-4 text-lg font-semibold text-text">Previous analyses</h3>
              {jobs.length === 0 ? (
                <EmptyState title="No previous analyses found" description="Start your first analysis above." />
              ) : (
                <Table columns={jobColumns} rows={jobs.slice(0, 5)} getRowKey={(job) => job.id} caption="Previous analyses" />
              )}
            </div>
            </CardBody>
          </Card>
      </div>
      </Layout>
    </>
  );
}
