"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Download,
  FileText,
  Globe,
  HardDrive,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PlayCircle,
  RefreshCcw,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Terminal,
  Users,
  X,
  Zap,
  RefreshCcw as RefreshCcw2,
  Trash2,
  Omega,
  Edit,
  Origami,
  HelpCircle,
  Book,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserProvider, useUser } from "@/lib/user-context";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/icons/dacroq.svg";
import LoadingSpinner from "@/components/LoadingSpinner";
import { UserManagementModal } from "@/components/modals/user-management-modal";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import SatContent from "@/app/dashboard/content/SAT";
import DocsPage from "../docs/page";
import LDPCContent from "@/app/dashboard/content/LDPC";
import DocumentationContent from "@/app/docs/page";
import KSatContent from "@/app/dashboard/content/KSAT";
// Firebase imports
import { collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import router from "next/router";

// --------------------
// Type Definitions
// --------------------
interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
  isAdmin: boolean;
}

interface AllowedUser {
  email: string;
  isAdmin: boolean;
  lastLogin?: string;
}

type NavItem = {
  title: string;
  url?: string;
  Icon?: React.ComponentType<{ className?: string }> | string;
  items?: NavItem[];
};

interface ActiveSection {
  main: string;
  sub?: string;
}

interface ChipStatus {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline" | "maintenance" | "connecting";
  lastActive: string;
  message?: string;
  endpoints?: Array<{
    name: string;
    url: string;
    description: string;
  }>;
  performance?: {
    successRate: number;
    averageRuntime: number;
    utilizationPercentage: number;
  };
}

interface TestRun {
  id: string;
  name: string;
  chipType: string;
  status: string;
  dataset?: string;
  created: any;
  completed?: any;
  duration?: string;
  errorMessage?: string;
  inputType?: string;
  preset?: string;
  presetLimit?: number;
  textInput?: string;
  cnfStorageUrls?: Array<{
    originalName: string;
    url: string;
    path: string;
  }>;
  results?: {
    successRate?: number;
    solutionCount?: number;
    averageIterations?: number;
    summary_statistics?: string;
    csv_preview?: string;
    file_urls?: {
      performance_overview_url?: string;
      benchmark_json_url?: string;
      csv_summary_url?: string;
    }
  };
}

// --------------------
// Navigation Configuration
// --------------------
const navigationItems: NavItem[] = [
  { title: "Portal", Icon: "LayoutDashboard" },
  { title: "LDPC Solver", Icon: "Cpu" },
  { title: "3-SAT Solver", Icon: "Cpu" },
  { title: "K-SAT Solver", Icon: "Cpu" },
];

// --------------------
// Mock Chip Statuses (for demo UI elements)
// --------------------
const mockChipStatuses: ChipStatus[] = [
  {
    id: "chip-001",
    name: "3-SAT Solver",
    type: "3-SAT",
    status: "online",
    lastActive: "2025-02-25T08:30:00",
    performance: {
      successRate: 97.8,
      averageRuntime: 124,
      utilizationPercentage: 76.3,
    },
    endpoints: [
      {
        name: "Run Test",
        url: "/api/chips/chip-001/run",
        description: "Execute a 3-SAT problem on this chip",
      },
      {
        name: "Status Check",
        url: "/api/chips/chip-001/status",
        description: "Get detailed status information",
      },
    ],
  },
];

// --------------------
// UI Components
// --------------------

// Enhanced Chip Status Indicator
const ChipStatusIndicator = ({ status }: { status: ChipStatus["status"] }) => {
  const statusConfig = {
    online: { color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20", icon: CheckCircle2, label: "Online" },
    offline: { color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/20", icon: AlertCircle, label: "Offline" },
    maintenance: { color: "text-amber-500", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20", icon: Settings, label: "Maintenance" },
    connecting: { color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20", icon: RefreshCcw, label: "Connecting" },
  };
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <div className={`inline-flex items-center rounded-full ${config.bgColor} ${config.color} border ${config.borderColor} px-2 py-1 text-xs font-medium`}>
      <Icon className="h-3.5 w-3.5 mr-1" />
      <span>{config.label}</span>
    </div>
  );
};

// Enhanced Test Status Badge
const TestStatusBadge = ({ status }: { status: string }) => {
  let progressText = "";
  let baseStatus = status;

  if (status.startsWith("running_") && status.includes("_of_")) {
    const parts = status.split('_');
    if (parts.length === 4) {
      progressText = `${parts[1]}/${parts[3]}`;
      baseStatus = "running";
    }
  }

  const getDisplayStatus = (backendStatus: string): "queued" | "running" | "transferring" | "completed" | "failed" => {
    if (backendStatus === "queued") return "queued";
    if (backendStatus === "completed") return "completed";
    if (["failed", "error", "email_error"].includes(backendStatus)) return "failed";
    if (["uploading_to_teensy", "transferring_files"].includes(backendStatus)) return "transferring";
    return "running";
  };

  const getStatusText = (backendStatus: string): string => {
    if (backendStatus === "running" && progressText) {
      return `Running ${progressText}`;
    }
    if (backendStatus.includes('_')) {
      return backendStatus.split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    return backendStatus.charAt(0).toUpperCase() + backendStatus.slice(1);
  };

  const displayStatus = getDisplayStatus(baseStatus);
  const displayText = getStatusText(baseStatus);

  const statusConfig = {
    queued: { color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: Clock },
    running: { color: "bg-purple-500/10 text-purple-500 border-purple-500/20", icon: Activity },
    transferring: { color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: RefreshCcw },
    completed: { color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle2 },
    failed: { color: "bg-red-500/10 text-red-500 border-red-500/20", icon: AlertCircle },
  };

  const config = statusConfig[displayStatus];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${config.color} gap-1`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="capitalize">{displayText}</span>
    </div>
  );
};

// User Avatar
const UserAvatar = ({ user, className = "" }: { user: User; className?: string }) => (
  <Avatar className={className}>
    <AvatarImage src={user.picture} alt={user.name} />
    <AvatarFallback className="rounded-lg">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
  </Avatar>
);

// Rename Test Dialog Component
const RenameTestDialog = ({
  test,
  isOpen,
  onClose,
  onRename,
}: {
  test: TestRun | null;
  isOpen: boolean;
  onClose: () => void;
  onRename: (testId: string, newName: string) => void;
}) => {
  const [newName, setNewName] = useState(test?.name || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (test) {
      setNewName(test.name);
    }
  }, [test]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (test && newName.trim()) {
      onRename(test.id, newName.trim());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Test</DialogTitle>
            <DialogDescription>
              Enter a new name for this test.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Test name"
              className="w-full"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Custom Rerun Test Dialog with name customization
const RerunTestDialog = ({
  test,
  isOpen,
  onClose,
  onRerun,
}: {
  test: TestRun | null;
  isOpen: boolean;
  onClose: () => void;
  onRerun: (test: TestRun, customName: string) => void;
}) => {
  const [customName, setCustomName] = useState("");
  const [usesCustomName, setUsesCustomName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (test) {
      setCustomName(`Rerun: ${test.name}`);
    }
  }, [test]);

  useEffect(() => {
    if (usesCustomName && inputRef.current) {
      inputRef.current.focus();
    }
  }, [usesCustomName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (test) {
      onRerun(test, usesCustomName ? customName.trim() : `Rerun: ${test.name}`);
      onClose();
    }
  };

  if (!test) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Re-run Test</DialogTitle>
            <DialogDescription>
              Re-run this test with the same configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="custom-name"
                checked={usesCustomName}
                onCheckedChange={setUsesCustomName}
              />
              <label
                htmlFor="custom-name"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Use custom name for this re-run
              </label>
            </div>

            {usesCustomName && (
              <Input
                ref={inputRef}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Custom test name"
                className="w-full"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="gap-1">
              <RefreshCcw className="h-4 w-4" />
              Re-run Test
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Action Panel for Bulk Operations
const ActionPanel = ({
  isVisible,
  selectedCount,
  onDelete,
  onRerun,
  onCancel,
}: {
  isVisible: boolean;
  selectedCount: number;
  onDelete: () => void;
  onRerun: () => void;
  onCancel: () => void;
}) => {
  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="bg-background border rounded-lg shadow-lg py-3 px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border-r pr-4">
            <span className="font-medium">{selectedCount}</span>
            <span className="text-muted-foreground"> {selectedCount === 1 ? 'test' : 'tests'} selected</span>
          </div>

          <Button className="h-9 gap-2 action-button" onClick={onRerun} size="sm">
            <RefreshCcw className="h-4 w-4" />
            Rerun
          </Button>

          <Button className="h-9 gap-2 action-button" variant="destructive" onClick={onDelete} size="sm">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>

          <Button variant="outline" size="icon" className="h-9 w-9 action-button" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

// Enhanced Top Navigation Bar
const TopNavBar = ({
  user,
  theme,
  activeSection,
  onNavClick,
  onThemeToggle,
  onLogout,
  onManageUsers,
  navigationItems,
}: {
  user: User;
  theme: string;
  activeSection: ActiveSection;
  onNavClick: (title: string, parentTitle?: string) => void;
  onThemeToggle: () => void;
  onLogout: () => void;
  onManageUsers: () => void;
  navigationItems: NavItem[];
}) => {
  const resolveIcon = (iconName: string) => {
    const icons: { [key: string]: React.ComponentType<{ className?: string }> } = {
      LayoutDashboard, PlayCircle, Activity, Settings, Cpu, HardDrive, BarChart3
    };
    return icons[iconName] || LayoutDashboard;
  };

  return (
    <header className="sticky text-fancy  top-0 z-40 w-full bg-background/95 backdrop-blur-sm border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">

        <div className="flex items-center hover:cursor-pointer" onClick={() => onNavClick("Portal")}>
          <div className="w-[16px] h-[16px] bg-primary/90 flex items-center justify-center text-white mr-1">
            <span className="text-[12px] text-fancy  background dark:text-black">⭓</span>
          </div>
          <h1 className="text-lg text-fancy font-medium">dacroq</h1>
        </div>
        <div className="flex items-center ">
          <TooltipProvider>
            <Button 
              variant="ghost"
              onClick={() => onNavClick("Documentation", "Help")} 
            >
              <a className="text-xs">Get Started</a>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onThemeToggle}>
                  {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle Theme</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-2 rounded-full overflow-hidden">
                <UserAvatar user={user} className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-1">
                <span className="font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user.isAdmin && (
                <DropdownMenuItem onClick={onManageUsers} className="gap-2">
                  <Users className="h-4 w-4" />
                  <span>Manage Users</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onLogout} className="gap-2">
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

// Benchmark Viewer Component
const BenchmarkViewer = ({ data }) => {
  const [benchmarks, setBenchmarks] = useState([]);

  // Helper function to format runtime in microseconds
  const formatRuntime = (seconds) => {
    const microseconds = seconds * 1000000; // Convert to microseconds
    return `${microseconds.toFixed(2)} µs`;
  };

  useEffect(() => {
    if (data) {
      if (Array.isArray(data)) {
        setBenchmarks(data);
      } else if (data.largeFileUrl) {
        const baseUrl = "https://dacroq.eecs.umich.edu/teensysat";
        const fullUrl = data.largeFileUrl.startsWith("/")
          ? `${baseUrl}${data.largeFileUrl}`
          : `${baseUrl}/${data.largeFileUrl}`;
          
        fetch(fullUrl)
          .then((res) => res.json())
          .then((jsonData) => {
            setBenchmarks(jsonData);
          })
          .catch((err) => {
            console.error("Error fetching benchmark data:", err);
            setBenchmarks([]);
          });
      } else {
        setBenchmarks([]);
      }
    } else {
      setBenchmarks([]);
    }
  }, [data]);

  if (!benchmarks || benchmarks.length === 0) {
    return (
      <div className="border rounded-md bg-zinc-50 dark:bg-zinc-900 p-4 text-center text-muted-foreground text-sm">
        No benchmark data available
      </div>
    );
  }

  return (
    <div className="border rounded-md bg-zinc-50 dark:bg-zinc-900 p-3 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Idx</TableHead>
            <TableHead>Success Rate</TableHead>
            <TableHead>Runs</TableHead>
            <TableHead>Avg Runtime</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {benchmarks.map((instance, idx) => {
            const totalRuns = instance.runs_attempted || 0;
            const successRuns = instance.runs_solved || 0;
            const successRate = totalRuns > 0 ? (successRuns / totalRuns) * 100 : 0;
            
            // Calculate average runtime in seconds
            const runtimes = instance.hardware_time_seconds || [];
            const avgRuntime = runtimes.length > 0
              ? runtimes.reduce((sum, time) => sum + parseFloat(time), 0) / runtimes.length
              : 0;

            return (
              <TableRow key={idx}>
                <TableCell>{instance.instance_idx}</TableCell>
                <TableCell>{successRate.toFixed(1)}%</TableCell>
                <TableCell>{successRuns}/{totalRuns}</TableCell>
                <TableCell>{formatRuntime(avgRuntime)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

// Enhanced Test Details Dialog
const TestDetailsDialog = ({ test, isOpen, onClose }) => {
  const [downloadUrl, setDownloadUrl] = useState("");
  
  useEffect(() => {
    if (test) {
      // Format the correct download URL using the test ID
      const testId = test.id;
      setDownloadUrl(`https://dacroq.eecs.umich.edu/teensysat/download_benchmark/${testId}`);
    }
  }, [test]);
  
  const handleDownload = () => {
    if (test && test.id) {
      // Open in a new tab if direct download doesn't work
      window.open(downloadUrl, '_blank');
    }
  };
  
  if (!test) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">
            {test.name}
          </DialogTitle>
          <DialogDescription>
            Test details and benchmark data
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-grow pr-4 overflow-y-auto">
          <div className="py-4">
            {/* Test information */}
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4 items-center">
                <span className="text-sm font-medium">Status:</span>
                <div className="col-span-3">
                  <TestStatusBadge status={test.status} />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-4 items-center">
                <span className="text-sm font-medium">Chip Type:</span>
                <span className="col-span-3">{test.chipType || "3-SAT"}</span>
              </div>
              
              <div className="grid grid-cols-4 gap-4 items-center">
                <span className="text-sm font-medium">Dataset:</span>
                <code className="col-span-3 font-mono text-xs bg-muted px-2 py-1 rounded overflow-auto">
                  {test.dataset || (test.inputType === "preset" ? `Preset: ${test.preset}` : "Custom Input")}
                </code>
              </div>
              
              <div className="grid grid-cols-4 gap-4 items-center">
                <span className="text-sm font-medium">Created:</span>
                <span className="col-span-3">
                  {new Date(test.created?.seconds * 1000 || test.created).toLocaleString()}
                </span>
              </div>
              
              {test.completed && (
                <div className="grid grid-cols-4 gap-4 items-center">
                  <span className="text-sm font-medium">Completed:</span>
                  <span className="col-span-3">
                    {new Date(test.completed?.seconds * 1000 || test.completed).toLocaleString()}
                  </span>
                </div>
              )}
              
              {test.results && test.results.successRate !== undefined && (
                <div className="grid grid-cols-4 gap-4 items-center">
                  <span className="text-sm font-medium">Success Rate:</span>
                  <span className="col-span-3 font-medium">{test.results.successRate?.toFixed(2)}%</span>
                </div>
              )}
              
              {test.results && test.results.solutionCount !== undefined && (
                <div className="grid grid-cols-4 gap-4 items-center">
                  <span className="text-sm font-medium">Solutions:</span>
                  <span className="col-span-3">{test.results.solutionCount}</span>
                </div>
              )}

              {test.results && test.results.averageIterations !== undefined && (
                <div className="grid grid-cols-4 gap-4 items-center">
                  <span className="text-sm font-medium">Avg Iterations:</span>
                  <span className="col-span-3">{test.results.averageIterations?.toFixed(2)}</span>
                </div>
              )}
            </div>
            
            {/* Download section */}
            <div className="mt-8 bg-muted/30 p-4 rounded-lg">
              <h3 className="text-base font-semibold mb-2">Benchmark Data</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Download the benchmark data for detailed analysis of test performance.
              </p>
              <Button 
                variant="outline" 
                size="default"
                className="gap-2"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
                Download Benchmark Data
              </Button>
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="pt-4 border-t mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Notification Banner Component
const NotificationBanner = ({
  message,
  type = "info",
  isVisible = true,
  onDismiss,
}: {
  message: string;
  type?: "info" | "warning" | "error" | "success";
  isVisible?: boolean;
  onDismiss?: () => void;
}) => {
  if (!isVisible) return null;
  const typeConfig = {
    info: { bgColor: "bg-blue-500/10", textColor: "text-blue-700 dark:text-blue-400", borderColor: "border-blue-500/30", icon: HelpCircle },
    warning: { bgColor: "bg-amber-500/10", textColor: "text-amber-700 dark:text-amber-400", borderColor: "border-amber-500/30", icon: AlertCircle },
    error: { bgColor: "bg-red-500/10", textColor: "text-red-700 dark:text-red-400", borderColor: "border-red-500/30", icon: ShieldAlert },
    success: { bgColor: "bg-green-500/10", textColor: "text-green-700 dark:text-green-400", borderColor: "border-green-500/30", icon: CheckCircle2 },
  };
  const config = typeConfig[type];
  const Icon = config.icon;
  return (
    <div className={`w-full ${config.bgColor} ${config.borderColor} border-l-4 py-3`}>
      <div className="container mx-auto flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${config.textColor}`} />
          <span className={`text-sm font-medium ${config.textColor}`}>{message}</span>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// --------------------
// Enhanced Dashboard Content Component
// --------------------
const DashboardContent = ({ onNavClick }: { onNavClick: (title: string, parentTitle?: string) => void }) => {
  const [selectedTest, setSelectedTest] = useState<TestRun | null>(null);
  const [isTestDetailsOpen, setIsTestDetailsOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isRerunDialogOpen, setIsRerunDialogOpen] = useState(false);
  const [testToRename, setTestToRename] = useState<TestRun | null>(null);
  const [testToRerun, setTestToRerun] = useState<TestRun | null>(null);
  const [tests, setTests] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const suppressRowClickRef = useRef(false);

  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectionStart, setSelectionStart] = useState<string | null>(null);
  const [isActionPanelVisible, setIsActionPanelVisible] = useState<boolean>(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    const tableElement = tableRef.current;
    if (!tableElement) return;
    if (selectionMode) {
      tableElement.classList.add("selection-active");
    } else {
      tableElement.classList.remove("selection-active");
    }
    return () => {
      if (tableElement) {
        tableElement.classList.remove("selection-active");
      }
    };
  }, [selectionMode]);

  const [chipStatuses, setChipStatuses] = useState<ChipStatus[]>(mockChipStatuses);
  const [deletingTestIds, setDeletingTestIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchTests = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "tests"));
        const testsData: TestRun[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TestRun[];
        testsData.sort((a, b) => {
          const dateA = a.created?.seconds ? a.created.seconds * 1000 : new Date(a.created).getTime();
          const dateB = b.created?.seconds ? b.created.seconds * 1000 : new Date(b.created).getTime();
          return dateB - dateA;
        });
        setTests(testsData);
      } catch (error) {
        console.error("Error fetching tests from Firebase:", error);
        toast.error("Failed to load tests");
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      fetchTests();
      const interval = setInterval(fetchTests, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const filteredTests = filterText 
    ? tests.filter((test) => 
        test.name.toLowerCase().includes(filterText.toLowerCase()) || 
        test.chipType?.toLowerCase().includes(filterText.toLowerCase()) ||
        test.status.toLowerCase().includes(filterText.toLowerCase())
      )
    : tests;

  const toggleTestSelection = (testId: string, multiSelect: boolean = false) => {
    setSelectedTests((prev) => {
      const newSelection = new Set(prev);
      if (multiSelect) {
        if (newSelection.has(testId)) {
          newSelection.delete(testId);
        } else {
          newSelection.add(testId);
        }
      } else {
        if (newSelection.size === 1 && newSelection.has(testId)) {
          newSelection.clear();
        } else {
          newSelection.clear();
          newSelection.add(testId);
        }
      }
      return newSelection;
    });
  };

  const handleRowMouseDown = (test: TestRun, e: React.MouseEvent) => {
    e.preventDefault();
    if (e.button !== 0) return;
    const shiftKey = e.shiftKey;
    const cmdKey = e.metaKey || e.ctrlKey;
    if (shiftKey || cmdKey) {
      handleSelectionMode(test, shiftKey, cmdKey);
      return;
    }
    const timer = setTimeout(() => {
      setIsLongPress(true);
      handleSelectionMode(test, false, false);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleSelectionMode = (test: TestRun, shiftKey: boolean, cmdKey: boolean) => {
    if (shiftKey && selectionStart) {
      const startIndex = filteredTests.findIndex((t) => t.id === selectionStart);
      const endIndex = filteredTests.findIndex((t) => t.id === test.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        const newSelection = new Set<string>();
        for (let i = start; i <= end; i++) {
          newSelection.add(filteredTests[i].id);
        }
        setSelectedTests(newSelection);
      }
    } else {
      toggleTestSelection(test.id, cmdKey);
      setSelectionStart(test.id);
      setSelectionMode(true);
    }
    if (!isActionPanelVisible && (selectedTests.size > 0 || !selectedTests.has(test.id))) {
      setIsActionPanelVisible(true);
    }
  };

  const handleRowMouseOver = (test: TestRun) => {
    if (selectionMode && selectionStart) {
      const startIndex = filteredTests.findIndex((t) => t.id === selectionStart);
      const currentIndex = filteredTests.findIndex((t) => t.id === test.id);
      if (startIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(startIndex, currentIndex);
        const end = Math.max(startIndex, currentIndex);
        const newSelection = new Set<string>();
        for (let i = start; i <= end; i++) {
          newSelection.add(filteredTests[i].id);
        }
        setSelectedTests(newSelection);
      }
    }
  };

  const handleRowMouseUp = (e: React.MouseEvent, test: TestRun) => {
    if ((e.target as HTMLElement).closest(".action-button")) {
      return;
    }
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    if (isLongPress) {
      setIsLongPress(false);
      return;
    }
    if ((!selectionMode || selectedTests.size === 0) && !deletingTestIds.has(test.id)) {
      handleViewDetails(test);
    }
    setSelectionMode(false);
  };

  const handleTableMouseLeave = () => {
    setSelectionMode(false);
  };

  useEffect(() => {
    if (selectedTests.size === 0) {
      setIsActionPanelVisible(false);
    }
  }, [selectedTests]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        setLongPressTimer(null);
      }
      setSelectionMode(false);
    };
    document.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [longPressTimer]);

  const handleTouchCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPress(false);
  };

  const handleBulkDelete = () => {
    if (selectedTests.size === 0) return;
    const selectedTestsArray = tests.filter((test) => selectedTests.has(test.id));
    const confirmMessage =
      selectedTests.size === 1
        ? `Are you sure you want to delete "${selectedTestsArray[0].name}"?`
        : `Are you sure you want to delete ${selectedTests.size} tests?`;
    if (confirm(confirmMessage)) {
      Promise.all(
        Array.from(selectedTests).map((testId) =>
          deleteDoc(doc(db, "tests", testId))
        )
      )
        .then(() => {
          setTests((prev) => prev.filter((t) => !selectedTests.has(t.id)));
          setSelectedTests(new Set());
          toast.success(
            `Deleted ${selectedTests.size} test${selectedTests.size === 1 ? "" : "s"} successfully`
          );
        })
        .catch((error) => {
          console.error("Error deleting tests:", error);
          toast.error("Failed to delete some tests");
        });
    }
  };

  const handleBulkRerun = () => {
    if (selectedTests.size === 0) return;
    const selectedTestsArray = tests.filter((test) => selectedTests.has(test.id));
    if (selectedTests.size > 1) {
      if (!confirm(`Are you sure you want to rerun ${selectedTests.size} tests?`)) {
        return;
      }
    }
    let successCount = 0;
    let promises = selectedTestsArray.map((test) => {
      if (
        test.status === "running" ||
        test.status.startsWith("running_") ||
        test.status === "queued" ||
        test.status === "calibrating" ||
        test.status === "processing"
      ) {
        return Promise.resolve();
      }
      const rerunData = {
        isRerun: true,
        originalTestId: test.id,
        testConfig: {
          name: `Rerun: ${test.name}`,
          inputType: test.inputType,
          files: test.inputType === "file" ? test.files : [],
          preset: test.preset,
          presetLimit: test.presetLimit,
          chipType: test.chipType || "3-SAT",
        },
      };
      return fetch("https://dacroq.eecs.umich.edu/teensysat/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rerunData),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to rerun test: ${test.name}`);
          }
          return response.json();
        })
        .then((result) => {
          if (result.status === "success") {
            successCount++;
          }
        });
    });
    Promise.all(promises)
      .then(() => {
        if (successCount > 0) {
          toast.success(`Rerunning ${successCount} test${successCount === 1 ? "" : "s"}`);
          setSelectedTests(new Set());
        }
      })
      .catch((error) => {
        console.error("Error rerunning tests:", error);
        toast.error("Failed to rerun some tests");
      });
  };

  const handleViewDetails = (test: TestRun) => {
    setSelectedTest(test);
    setIsTestDetailsOpen(true);
  };

  const handleRenameTest = (test: TestRun) => {
    setTestToRename(test);
    setIsRenameDialogOpen(true);
  };

  const handleInitiateRerun = (test: TestRun) => {
    setTestToRerun(test);
    setIsRerunDialogOpen(true);
  };

  const handleSaveRename = async (testId: string, newName: string) => {
    try {
      await updateDoc(doc(db, "tests", testId), { name: newName });
      setTests((prev) =>
        prev.map((test) => (test.id === testId ? { ...test, name: newName } : test))
      );
      if (selectedTest?.id === testId) {
        setSelectedTest((prev) => (prev ? { ...prev, name: newName } : null));
      }
      toast.success(`Test renamed to "${newName}"`);
    } catch (error) {
      console.error("Error renaming test:", error);
      toast.error("Failed to rename test");
    }
  };

  const handleRerunTest = async (test: TestRun, customName?: string) => {
    try {
      const rerunData = {
        isRerun: true,
        originalTestId: test.id,
        testConfig: {
          name: customName || `Rerun: ${test.name}`,
          inputType: test.inputType,
          files: test.inputType === "file" ? test.files : [],
          preset: test.preset,
          presetLimit: test.presetLimit,
          chipType: test.chipType || "3-SAT",
        },
      };
      const response = await fetch("https://dacroq.eecs.umich.edu/teensysat/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rerunData),
      });
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      const result = await response.json();
      if (result.status === "success") {
        toast.success(`Re-running test: ${customName || `Rerun: ${test.name}`}`);
        setIsTestDetailsOpen(false);
        setSelectedTest(null);
      } else {
        toast.error(`Failed to re-run test: ${result.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error re-running test:", error);
      toast.error(`Failed to re-run test: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleDeleteTest = async (test: TestRun) => {
    try {
      setDeletingTestIds((prev) => new Set([...prev, test.id]));
      await deleteDoc(doc(db, "tests", test.id));
      setTests((prev) => prev.filter((t) => t.id !== test.id));
      if (selectedTest?.id === test.id) {
        setIsTestDetailsOpen(false);
        setSelectedTest(null);
      }
      toast.success(`Test deleted`);
    } catch (error) {
      console.error("Error deleting test:", error);
      toast.error("Failed to delete test");
    } finally {
      setDeletingTestIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(test.id);
        return newSet;
      });
    }
  };

  const runningTests = tests.filter((t) =>
    t.status === "running" ||
    t.status.startsWith("running_") ||
    t.status === "calibrating" ||
    t.status === "uploading" ||
    t.status === "processing"
  ).length;
  
  const completedTests = tests.filter((t) => t.status === "completed").length;
  const failedTests = tests.filter((t) => t.status === "failed" || t.status === "error").length;
  const totalChips = chipStatuses.length;
  const activeChips = chipStatuses.filter((c) => c.status === "online").length;

  return (
    <div className="space-y-6">
      {/* Enhanced Summary and Chip Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Summary Card */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Tests Queued</div>
                <div className="text-2xl font-bold flex items-center">
                  {runningTests}
                  {runningTests > 0 && (
                    <span className="ml-2 text-xs text-amber-500 flex items-center">
                      <Activity className="h-3 w-3 mr-1" />
                      Active
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Tests Run</div>
                <div className="text-2xl font-bold">{completedTests}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Solvers</div>
                <div className="text-2xl font-bold flex items-center">
                  {activeChips}/{totalChips}
                  <span className="ml-2 text-xs text-green-500 flex items-center">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Online
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Chip Status Cards */}
        {chipStatuses.map((chip) => {
          const [resetInProgress, setResetInProgress] = useState(false);
          
          const handleResetChip = async (e, chip) => {
            e.stopPropagation();
            setResetInProgress(true);
            
            try {
              const response = await fetch("https://dacroq.eecs.umich.edu/teensysat/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chipType: chip.type }),
              });
              
              if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
              }
              
              const result = await response.json();
              
              if (result.status === "success") {
                toast.success(`${chip.name} successfully reset`);
                setChipStatuses(prevStatuses => 
                  prevStatuses.map(c => 
                    c.id === chip.id ? { ...c, status: "online" } : c
                  )
                );
              } else {
                toast.error(`Failed to reset ${chip.name}: ${result.message}`);
              }
            } catch (error) {
              console.error("Error resetting chip:", error);
              toast.error(`Failed to reset ${chip.name}: ${error.message}`);
            } finally {
              setResetInProgress(false);
            }
          };
          
          return (
            <Card
              key={chip.id}
              className={cn("shadow-sm border cursor-pointer transition-colors hover:shadow-md", 
                chip.status === "offline" ? "opacity-75" : "hover:border-primary/30")}
              onClick={() => chip.status === "online" && !resetInProgress && onNavClick(`${chip.type} Solver`, "Run Solver")}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-semibold">{chip.name}</CardTitle>
                  <ChipStatusIndicator status={resetInProgress ? "connecting" : chip.status} />
                </div>
              </CardHeader>
              <CardContent className="pb-2 space-y-3">
                {chip.performance && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Success Rate</div>
                      <div className="font-semibold">{chip.performance.successRate}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Avg Runtime</div>
                      <div className="font-semibold">{chip.performance.averageRuntime} µs</div>
                    </div>
                  </div>
                )}
                {chip.message && <p className="text-xs text-muted-foreground italic">{chip.message}</p>}
              </CardContent>
              <CardFooter className="pt-0">
                <div className="flex gap-2 w-full">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1 h-9"
                    disabled={chip.status !== "online" || resetInProgress}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavClick(`${chip.type} Solver`, "Run Solver");
                    }}
                  >
                    <PlayCircle className="h-4 w-4 mr-1.5" />
                    Run Test
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-24 h-9"
                    disabled={chip.status !== "online" || resetInProgress}
                    onClick={(e) => handleResetChip(e, chip)}
                  >
                    {resetInProgress ? (
                      <>
                        <RefreshCcw2 className="h-4 w-4 mr-1.5 animate-spin" />
                        <span>Resetting...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCcw2 className="h-4 w-4 mr-1.5" />
                        <span>Reset</span>
                      </>
                    )}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Enhanced Recent Tests Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="font-semibold">Recent Tests</CardTitle>
            <div className="relative">
              <Input
                placeholder="Search tests..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-64 h-8 pl-8"
              />
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              {filterText && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1 h-6 w-6"
                  onClick={() => setFilterText("")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedTests.size > 0 && (
            <div className="py-2 px-5 mb-4 flex justify-between items-center bg-primary/5 border rounded-md">
              <span className="text-sm">
                <span className="font-medium">{selectedTests.size}</span>
                <span className="text-muted-foreground"> {selectedTests.size === 1 ? "test" : "tests"} selected</span>
              </span>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setSelectedTests(new Set())}>
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            </div>
          )}
          <div className="rounded-md border overflow-hidden" ref={tableRef} onMouseLeave={handleTableMouseLeave}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-medium">Name</TableHead>
                  <TableHead className="font-medium">Type</TableHead>
                  <TableHead className="font-medium">Status</TableHead>
                  <TableHead className="font-medium hidden md:table-cell">Created</TableHead>
                  <TableHead className="font-medium text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <LoadingSpinner className="mx-auto h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ) : filteredTests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {filterText ? "No matching tests found" : "No tests found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTests.map((test) => (
                    <TableRow
                      key={test.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 relative table-row-transition",
                        selectedTests.has(test.id) && "bg-primary/5 hover:bg-primary/10",
                        isLongPress && test.id === selectionStart && "long-press-active"
                      )}
                      onMouseDown={(e) => handleRowMouseDown(test, e)}
                      onMouseOver={() => handleRowMouseOver(test)}
                      onMouseUp={(e) => handleRowMouseUp(e, test)}
                      onMouseLeave={() => {
                        if (longPressTimer) {
                          clearTimeout(longPressTimer);
                          setLongPressTimer(null);
                        }
                      }}
                      onTouchStart={() => {
                        const timer = setTimeout(() => {
                          setIsLongPress(true);
                          handleSelectionMode(test, false, false);
                          if (navigator.vibrate) {
                            navigator.vibrate(50);
                          }
                        }, 500);
                        setLongPressTimer(timer);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimer) {
                          clearTimeout(longPressTimer);
                          setLongPressTimer(null);
                        }
                        if (isLongPress) {
                          setIsLongPress(false);
                          return;
                        }
                        if (!selectionMode || selectedTests.size === 0) {
                          handleViewDetails(test);
                        }
                      }}
                      onTouchMove={handleTouchCancel}
                      onTouchCancel={handleTouchCancel}
                    >
                      {longPressTimer && test.id === selectionStart && (
                        <div className="long-press-indicator" />
                      )}
                      <TableCell className="font-medium">{test.name}</TableCell>
                      <TableCell>{test.chipType || "3-SAT"}</TableCell>
                      <TableCell>
                        <TestStatusBadge status={test.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap hidden md:table-cell">
                        {new Date(
                          test.created?.seconds ? test.created.seconds * 1000 : test.created
                        ).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500/70 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 action-button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteTest(test);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Test</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {!loading && filteredTests.length > 0 && (
            <div className="mt-4 flex justify-between items-center text-sm text-muted-foreground">
              <div>
                Showing {filteredTests.length} of {tests.length} tests
                {filterText && ' (filtered)'}
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled className="h-8">
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled className="h-8">
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs and Action Panel */}
      <TestDetailsDialog
        test={selectedTest}
        isOpen={isTestDetailsOpen}
        onClose={() => setIsTestDetailsOpen(false)}
        onRerun={(test) => {
          setIsTestDetailsOpen(false);
          setTestToRerun(test);
          setIsRerunDialogOpen(true);
        }}
      />
      <RenameTestDialog
        test={testToRename}
        isOpen={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
        onRename={handleSaveRename}
      />
      <RerunTestDialog
        test={testToRerun}
        isOpen={isRerunDialogOpen}
        onClose={() => setIsRerunDialogOpen(false)}
        onRerun={handleRerunTest}
      />
      <AnimatePresence>
        {isActionPanelVisible && (
          <ActionPanel
            isVisible={isActionPanelVisible}
            selectedCount={selectedTests.size}
            onDelete={handleBulkDelete}
            onRerun={handleBulkRerun}
            onCancel={() => {
              setSelectedTests(new Set());
              setIsActionPanelVisible(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --------------------
// Main Dashboard Page Component
// --------------------
export default function DashboardPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ActiveSection>({ main: "Portal" });
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);


  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (window.location.pathname.startsWith("/demo")) {
          const demoUser = {
            id: "demo-instance",
            name: "Demo User",
            email: "demo@umich.edu",
            picture: "",
            isAdmin: true,
          };
          setUser(demoUser);
          setIsLoading(false);
          return;
        }
        if (response.ok) {
          const data = await response.json();
          setUser({ ...data });
        } else {
          router.push("/login");
        }
      } catch (error) {
        console.error("Authentication error:", error);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [router]);

  const handleNavClick = (title: string, parentTitle?: string) => {
    setActiveSection({ main: title, sub: parentTitle });
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleLogout = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((cookie) => {
        const cookieName = cookie.split("=")[0].trim();
        document.cookie = `${cookieName}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;`;
      });
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (error) {
      toast.error("Error during logout");
    }
  };


  const renderContent = () => {
    if (activeSection.main === "Portal") {
      return <DashboardContent onNavClick={handleNavClick} />;
    } else if (activeSection.main === "3-SAT Solver") {
      return <SatContent setActiveSection={setActiveSection} />;
    } else if (activeSection.main === "LDPC Solver") {
      return <LDPCContent setActiveSection={setActiveSection} />;
    } else if (activeSection.main === "K-SAT Solver") {
      return <KSatContent setActiveSection={setActiveSection} />;
    } else if (activeSection.main === "Documentation") {
      return <DocumentationContent setActiveSection={setActiveSection} />;
    } else {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
          <div className="h-12 w-12 mb-4">⚠️</div>
          <h2 className="text-xl font-medium mb-2">Coming Soon</h2>
          <p>This feature is under development and will be available soon.</p>
        </div>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <UserProvider value={{ user, setUser }}>
      <div className="flex min-h-screen flex-col bg-background">
    
        <TopNavBar
          user={user}
          theme={theme}
          activeSection={activeSection}
          onNavClick={handleNavClick}
          onThemeToggle={toggleTheme}
          onLogout={handleLogout}
          onManageUsers={() => setIsUserManagementOpen(true)}
          navigationItems={navigationItems}
        />
        <main className="flex-1 overflow-auto pt-4">
          <div className="container mx-auto px-4 py-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection.main}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        <UserManagementModal open={isUserManagementOpen} onOpenChange={setIsUserManagementOpen} />
      </div>
    </UserProvider>
  );
}