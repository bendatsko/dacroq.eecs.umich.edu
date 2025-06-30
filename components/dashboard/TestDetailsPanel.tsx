"use client";

import React, { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Activity,
  ArrowLeft,
  AlertCircle,
  Download,
  Maximize2,
  Share2,
  Trash2,
  LineChart,
  BoxSelect,
  TrendingUp,
  FileDown,
  Link2,
  BrainCircuit,
  Timer,
  CheckCircle2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import {Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {ALLOWED_USERS} from "@/config/allowed-users";

// Complete interfaces
interface TestDetails {
  id: string;
  name: string;
  dataset: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'ERROR' | 'ANALYZING';
  startTest: number;
  endTest: number;
  createdAt: string;
  completedAt?: string;
  progress: string[];
  completedTests: number;
  isPublic: boolean;
  analysisCompleted: boolean;
  analysisTimestamp?: string;
  analysisResults?: {
    mean_tts: number;
    median_tts: number;
    mean_success_rate: number;
    best_iteration: string;
  };
}

interface AnalysisResults {
  test_id: string;
  test_name: string;
  dataset: string;
  analysis_timestamp: string;
  mean_tts: number;
  median_tts: number;
  mean_success_rate: number;
  total_problems: number;
  solved_problems: number;
  best_iteration: string;
  tts_std: number;
  tts_min: number;
  tts_max: number;
  device?: {
    clock_freq_mhz: number;
    problem_size?: {
      variables: number;
      clauses: number;
    };
  };
  performance?: {
    success_rate: number;
    median_solution_time_us: number;
    mean_solution_time_us: number;
    min_solution_time_us: number;
    percentile_95_us: number;
    total_solutions: number;
  };
}

interface TestDetailsPanelProps {
  test: TestDetails | null;
  onClose: () => void;
  onDelete?: (testId: string) => Promise<void>;
  onShare?: (testId: string, isPublic: boolean) => Promise<void>;
  refreshTests?: () => Promise<void>;
}

// Helper Components
const MetricCard = ({ label, value, unit = '', trend = null }) => (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-semibold tracking-tight">
          {typeof value === 'number' ? value.toFixed(2) : value || '-'}
          <span className="text-sm font-normal text-muted-foreground ml-1">
                    {unit}
                </span>
        </div>
        {trend !== null && (
            <span className={cn(
                "text-sm",
                trend > 0 ? "text-green-500" : "text-red-500"
            )}>
                    {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                </span>
        )}
      </div>
    </div>
);
const PlotVisualization = ({ url, title, loading, error, onExpand }) => {
  if (loading) {
    return (
        <div className="flex items-center justify-center h-[300px]">
          <div className="flex flex-col items-center gap-2">
            <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading visualization...</p>
          </div>
        </div>
    );
  }

  if (error || !url) {
    return (
        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <AlertCircle className="h-8 w-8 mb-2" />
          <p className="text-sm">{error || `Failed to load ${title}`}</p>
        </div>
    );
  }

  return (
      <div className="relative group">
        <img
            src={url}
            alt={title}
            className="w-full h-[300px] object-contain bg-background rounded-md"
        />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8"
              onClick={() => onExpand?.({ url, title })}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
  );
};


const TestStatusIcon = ({ status }: { status: string }) => {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'RUNNING':
      return <Activity className="h-5 w-5 text-blue-500 animate-pulse" />;
    case 'ANALYZING':
      return <BrainCircuit className="h-5 w-5 text-purple-500 animate-pulse" />;
    case 'ERROR':
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Timer className="h-5 w-5 text-yellow-500" />;
  }
};

const PlotContainer = ({ title, description, children, className }) => (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      <div className="border-b border-border/50 bg-muted/50">
        <div className="p-4">
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-2">{children}</div>
    </div>
);


const ShareTestDialog = ({ test, isOpen, onClose, onShare }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSelectedUsers(test?.sharedWith || []);
  }, [test]);

  const availableUsers = ALLOWED_USERS.filter(user =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selectedUsers.includes(user.email)
  );

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Share Test Results</DialogTitle>

          {/* Search Input */}
          <div className="relative">
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search emails..."
                className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {searchTerm && availableUsers.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
                  <ScrollArea className="max-h-48">
                    {availableUsers.map(user => (
                        <div
                            key={user.email}
                            className="relative flex w-full cursor-default select-none items-center rounded-sm px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                            onClick={() => {
                              setSelectedUsers([...selectedUsers, user.email]);
                              setSearchTerm('');
                            }}
                        >
                          {user.email}
                        </div>
                    ))}
                  </ScrollArea>
                </div>
            )}
          </div>

          {/* Selected Users */}
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map(email => (
                <Badge key={email} variant="secondary" className="flex items-center gap-2">
                  {email}
                  <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => setSelectedUsers(selectedUsers.filter(e => e !== email))}
                  />
                </Badge>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => {
              onShare(test.id, selectedUsers);
              onClose();
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
};



export const TestDetailsPanel: React.FC<TestDetailsPanelProps> = ({
                                                                    test,
                                                                    onClose,
                                                                    onDelete,
                                                                    onShare,
                                                                    refreshTests,
                                                                  }) => {
  const { user } = useUser();
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [plotUrls, setPlotUrls] = useState<{
    tts: string | null;
    box: string | null;
    cumulative: string | null;
  }>({
    tts: null,
    box: null,
    cumulative: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [expandedImage, setExpandedImage] = useState<{url: string, title: string} | null>(null);



  useEffect(() => {
    if (!test?.id || !user?.email) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const resultsRes = await fetch(
            `https://dacroq.eecs.umich.edu/interface/tests/${test.id}/files/results`,
            {
              headers: {
                'X-User-Email': user.email,
              },
            }
        );

        if (resultsRes.ok) {
          const resultsData = await resultsRes.json();
          setResults(resultsData);
        }

        const plots = {
          tts: 'tts_best_case.png',
          box: 'solution_boxplot.png',
          cumulative: 'cdf_plot.png'
        };

        const urls: {tts: string | null, box: string | null, cumulative: string | null} = {
          tts: null,
          box: null,
          cumulative: null
        };

        await Promise.all(
            Object.entries(plots).map(async ([key, filename]) => {
              try {
                const plotRes = await fetch(
                    `https://dacroq.eecs.umich.edu/interface/tests/${test.id}/files/${filename}`,
                    {
                      headers: {
                        'X-User-Email': user.email,
                      },
                    }
                );

                if (plotRes.ok) {
                  const plotBlob = await plotRes.blob();
                  urls[key as keyof typeof urls] = URL.createObjectURL(plotBlob);
                }
              } catch (err) {
                console.error(`Failed to fetch ${filename}:`, err);
              }
            })
        );

        setPlotUrls(urls);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      Object.values(plotUrls).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [test?.id, test?.status, user?.email]);

  const handleDelete = async () => {
    if (!test || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(test.id);
      toast.success('Test deleted successfully');
      onClose();
      if (refreshTests) await refreshTests();
    } catch (error) {
      toast.error('Failed to delete test');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleShare = async (isPublic: boolean) => {
    if (!test || !onShare) return;

    setIsSharing(true);
    try {
      await onShare(test.id, isPublic);
      toast.success(`Test is now ${isPublic ? 'public' : 'private'}`);
      if (refreshTests) await refreshTests();
    } catch (error) {
      toast.error('Failed to update sharing settings');
    } finally {
      setIsSharing(false);
      setShowShareDialog(false);
    }
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  if (!test) return null;
  const metrics = [
    {
      label: "Success Rate",
      value: results?.performance?.success_rate,
      unit: "%",
    },
    {
      label: "Mean Time",
      value: results?.performance?.mean_solution_time_us,
      unit: "µs",
    },
    {
      label: "Problem Size",
      value: `${results?.device?.problem_size?.variables} vars,  ${results?.device?.problem_size?.clauses} clauses`,
      description: "Variables/Clauses"
    },
    // {
    //   label: "Solutions Found",
    //   value: results?.performance?.total_solutions,
    // }
  ];

  const detailedMetrics = [

    {
      group: "Performance",
      metrics: [
        { label: "Median Solution Time", value: results?.performance?.median_solution_time_us, unit: "µs" },
        { label: "Min Solution Time", value: results?.performance?.min_solution_time_us, unit: "µs" },
        { label: "95th Percentile", value: results?.performance?.percentile_95_us, unit: "µs" },
      ]
    },
    {
      group: "Hardware",
      metrics: [
        { label: "Clock Frequency", value: results?.device?.clock_freq_mhz, unit: "MHz" },
      ]
    },
  ];

  return (
      <div className="min-h-screen bg-background">
        {/* Fixed Header */}
        {/* Fixed Header */}
        <div className="sticky top-0 z-10 border-b bg-background">
          <div className="container max-w-7xl mx-auto py-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Button
                    variant="ghost"
                    onClick={onClose}
                    className="h-9 px-0"
                >
                  <ArrowLeft className="h-4 w-4 mr-2"/>
                  Back
                </Button>
                <div className="flex items-center gap-3 border-l pl-6">
                  <TestStatusIcon status={test.status}/>
                  <div>
                    <h1 className="text-xl font-medium leading-none">
                      {test.name}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="font-mono">
                        ID: {test.id}
                      </Badge>
                      <Badge>{test.dataset}</Badge>
                      {test.status === 'COMPLETED' && (
                          <Badge variant="outline" className="text-green-500">
                            Completed
                          </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    className="h-8 gap-2"
                    onClick={() => setShowShareDialog(true)}
                >
                  <Share2 className="h-4 w-4"/>
                  Share
                </Button>
                <Button
                    variant="outline"
                    className="h-8 gap-2"
                    onClick={() => {
                      const downloadData = {
                        testInfo: {
                          id: test.id,
                          name: test.name,
                          dataset: test.dataset,
                          startedAt: test.createdAt,
                          completedAt: test.completedAt,
                          status: test.status,
                        },
                        analysisResults: results,
                      };

                      const blob = new Blob([JSON.stringify(downloadData, null, 2)], {
                        type: 'application/json',
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `test-${test.id}-results.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    disabled={!results}
                >
                  <FileDown className="h-4 w-4"/>
                  Download Results
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container max-w-7xl mx-auto py-6 px-4">
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {metrics.map((metric, idx) => (
                <MetricCard
                    key={idx}
                    label={metric.label}
                    value={metric.value}
                    unit={metric.unit}
                />
            ))}
          </div>
          {/* Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PlotContainer
                title="Statistical Distribution"
                description="Box plot showing quartiles and outliers"
            >
              <PlotVisualization
                  url={plotUrls.box}
                  title="Box Plot"
                  loading={loading}
                  error={error}
                  onExpand={setExpandedImage}
              />
            </PlotContainer>

            <PlotContainer
                title="Time to Solution Analysis"
                description="Distribution of solution times across all test runs"
            >
              <PlotVisualization
                  url={plotUrls.tts}
                  title="TTS Plot"
                  loading={loading}
                  error={error}
                  onExpand={setExpandedImage}
              />
            </PlotContainer>

            <PlotContainer
                title="Cumulative Performance"
                description="Distribution of problems solved over time"
            >
              <PlotVisualization
                  url={plotUrls.cumulative}
                  title="CDF Plot"
                  loading={loading}
                  error={error}
                  onExpand={setExpandedImage}
              />
            </PlotContainer>
          </div>

          {/* Detailed Metrics */}
          <div className="mt-6">
            <PlotContainer
                title="Detailed Test Information"
                description="Comprehensive analysis results and statistics"
            >
              <div className="divide-y">
                {detailedMetrics.map((group, groupIdx) => (
                    <div key={groupIdx} className="py-4 first:pt-2 last:pb-2">
                      <div className="px-4 mb-3 text-sm font-medium text-muted-foreground">
                        {group.group}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4">
                        {group.metrics.map((metric, idx) => (
                            <div
                                key={idx}
                                className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                            >
                                <span className="text-sm text-muted-foreground">
                                    {metric.label}
                                </span>
                              <span className="font-mono text-sm">
                                    {typeof metric.value === 'number'
                                        ? `${metric.value.toFixed(2)}${metric.unit || ''}`
                                        : '-'}
                                </span>
                            </div>
                        ))}
                      </div>
                    </div>
                ))}
              </div>
            </PlotContainer>
          </div>
        </div>

        {/* Image Expansion Dialog */}
        <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
          <DialogContent className="max-w-screen-xl max-h-[90vh] p-0">
            <DialogHeader className="px-4 py-2">
              <DialogTitle>{expandedImage?.title}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto p-4">
              <img
                  src={expandedImage?.url}
                  alt={expandedImage?.title}
                  className="w-full h-auto max-h-[calc(90vh-6rem)] object-contain mx-auto bg-background rounded-md"
              />
            </div>
          </DialogContent>
        </Dialog>



        <ShareTestDialog
            test={test} // Pass the test details
            isOpen={showShareDialog} // Control dialog visibility
            onClose={() => setShowShareDialog(false)} // Close dialog on cancel or completion
            onShare={(testId, selectedUsers) => {
              // Handle share logic here
              console.log(`Sharing Test ID: ${testId} with Users:`, selectedUsers);
              toast.success(`Test shared with selected users.`);
            }}
        />



        {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Test</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this test? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isDeleting}
                >
                  {isDeleting ? (
                      <Activity className="mr-2 h-4 w-4 animate-spin"/>
                  ) : (
                      <Trash2 className="mr-2 h-4 w-4"/>
                  )}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/*/!* Share Settings Dialog *!/*/}
          {/*<AlertDialog open={showShareDialog} onOpenChange={setShowShareDialog}>*/}
          {/*  <AlertDialogContent>*/}
          {/*    <AlertDialogHeader>*/}
          {/*      <AlertDialogTitle>Share Test</AlertDialogTitle>*/}
          {/*      <AlertDialogDescription>*/}
          {/*        {test.isPublic*/}
          {/*            ? "Make this test private? Only you will be able to see it."*/}
          {/*            : "Make this test public? Other users will be able to view the results."}*/}
          {/*      </AlertDialogDescription>*/}
          {/*    </AlertDialogHeader>*/}
          {/*    <AlertDialogFooter>*/}
          {/*      <AlertDialogCancel disabled={isSharing}>Cancel</AlertDialogCancel>*/}
          {/*      <AlertDialogAction*/}
          {/*          onClick={() => handleShare(!test.isPublic)}*/}
          {/*          disabled={isSharing}*/}
          {/*      >*/}
          {/*        {isSharing ? (*/}
          {/*            <Activity className="mr-2 h-4 w-4 animate-spin"/>*/}
          {/*        ) : (*/}
          {/*            <Link2 className="mr-2 h-4 w-4"/>*/}
          {/*        )}*/}
          {/*        {test.isPublic ? "Make Private" : "Make Public"}*/}
          {/*      </AlertDialogAction>*/}
          {/*    </AlertDialogFooter>*/}
          {/*  </AlertDialogContent>*/}
          {/*</AlertDialog>*/}
        </div>
        );
        };

        export default TestDetailsPanel;