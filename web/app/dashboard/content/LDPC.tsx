"use client";

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  PlayCircle,
  ArrowDown,
  Activity,
  Info,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
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
import { Slider } from "@/components/ui/slider";

interface ChipStatus {
  id: string;
  name: string;
  type: string;
  status: "online" | "offline" | "maintenance" | "connecting";
  message?: string;
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
  snrRange?: {
    min: number;
    max: number;
    step: number;
  };
  iterations?: number;
  dataset?: string;
  created: any;
  completed?: any;
  duration?: string;
  results?: any;
}

// Test Status Badge Component
const TestStatusBadge = ({ status }: { status: string }) => {
  let progressText = "";
  let baseStatus = status;
  if (status.startsWith("running_") && status.includes("_of_")) {
    const parts = status.split("_");
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
    if (backendStatus.includes("_")) {
      return backendStatus
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
    }
    return backendStatus.charAt(0).toUpperCase() + backendStatus.slice(1);
  };
  const displayStatus = getDisplayStatus(baseStatus);
  const displayText = getStatusText(baseStatus);
  const statusConfig = {
    queued: { color: "bg-blue-500/10 text-blue-500", icon: Clock },
    running: { color: "bg-purple-500/10 text-purple-500", icon: Activity },
    transferring: { color: "bg-amber-500/10 text-amber-500", icon: RefreshCw },
    completed: { color: "bg-green-500/10 text-green-500", icon: CheckCircle2 },
    failed: { color: "bg-red-500/10 text-red-500", icon: AlertCircle },
  };
  const config = statusConfig[displayStatus];
  const Icon = config.icon;
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.color} gap-1`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="capitalize">{displayText}</span>
    </div>
  );
};

const DeviceOffline = ({ title = "Device Offline" }: { title?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto">
      <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6">
        This solver is currently offline for maintenance. Please check back later or contact the administrator for more information.
      </p>
      <Button variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Check Status
      </Button>
    </div>
  );
};

const ChipStatusIndicator = ({ status }: { status: ChipStatus["status"] }) => {
  const statusConfig = {
    online: {
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      icon: CheckCircle2,
      label: "Online",
    },
    offline: {
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      icon: AlertCircle,
      label: "Offline",
    },
    maintenance: {
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      icon: Activity,
      label: "Maintenance",
    },
    connecting: {
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      icon: RefreshCw,
      label: "Connecting",
    },
  };
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${config.bgColor} ${config.color}`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </div>
  );
};

const RecentLdpcTests = ({ onViewDetails }: { onViewDetails: (test: TestRun) => void }) => {
  const [tests, setTests] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchRecentTests = async () => {
      try {
        // Mock recent tests - no Firebase needed
        const mockTests: TestRun[] = [
          {
            id: "ldpc-test-1",
            name: "LDPC Decode Test 1",
            chipType: "LDPC",
            status: "completed",
            created: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
            runtime: "2.5s",
            result: "Success: 98.5% decoding rate"
          },
          {
            id: "ldpc-test-2", 
            name: "LDPC Decode Test 2",
            chipType: "LDPC",
            status: "completed",
            created: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
            runtime: "1.8s",
            result: "Success: 97.2% decoding rate"
          }
        ];
        setTests(mockTests);
      } catch (error) {
        console.error("Error fetching tests:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecentTests();
  }, []);
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-lg">Recent LDPC Tests</CardTitle>
        <CardDescription>Your recently run LDPC solver tests</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">SNR Range</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex justify-center">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : tests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No recent LDPC tests found
                  </TableCell>
                </TableRow>
              ) : (
                tests.map((test) => (
                  <TableRow key={test.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{test.name}</TableCell>
                    <TableCell>
                      <TestStatusBadge status={test.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {test.snrRange ? `${test.snrRange.min}dB to ${test.snrRange.max}dB (${test.snrRange.step}dB steps)` : "N/A"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {new Date(
                        test.created?.seconds ? test.created.seconds * 1000 : test.created
                      ).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => onViewDetails(test)} className="h-8">
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" className="ml-auto gap-1">
          <ArrowDown className="h-3.5 w-3.5" />
          View All Tests
        </Button>
      </CardFooter>
    </Card>
  );
};

const LDPCContent = ({ setActiveSection }: { setActiveSection: (section: any) => void }) => {
  // Subscribe to chip status from Firestore for LDPC chip (document id "ldpc")
  const [chipStatus, setChipStatus] = useState<ChipStatus>({
    id: "ldpc",
    name: "LDPC Solver Core",
    type: "LDPC",
    status: "offline",
    message: "",
  });
  useEffect(() => {
    // Mock chip status - no Firebase needed
    const mockChipStatus = {
      id: "ldpc",
      name: "LDPC Decoder Core",
      type: "LDPC",
      status: "online" as const,
      message: "Ready for decoding operations",
    };
    setChipStatus(mockChipStatus);
  }, []);

  const [testName, setTestName] = useState("LDPC Test");
  const [snrRange, setSnrRange] = useState<[number, number]>([1, 7]);
  const [iterations, setIterations] = useState(10);
  const [codeType, setCodeType] = useState("standard");
  const [isEmailEnabled, setIsEmailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [codeRate, setCodeRate] = useState("0.5");
  const [blockLength, setBlockLength] = useState("1024");
  const [modulation, setModulation] = useState("BPSK");

  useEffect(() => {
    const savedEmail = localStorage.getItem("savedEmail");
    if (savedEmail) setEmail(savedEmail);
  }, []);

  if (chipStatus.status === "offline" || chipStatus.status === "maintenance") {
    return (
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">LDPC Solver</CardTitle>
                <CardDescription>Configure and run tests on the LDPC Solver chip</CardDescription>
              </div>
              <ChipStatusIndicator status={chipStatus.status} />
            </div>
          </CardHeader>
          <CardContent>
            <DeviceOffline title="LDPC Solver Offline" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const logTestToDatabase = async (testId: string, testConfig: any) => {
    try {
      // Mock test logging - no Firebase needed
      console.log("Test logged (mock):", testId, {
        name: testConfig.name,
        chipType: "LDPC",
        snrRange: testConfig.snrRange,
        iterations: testConfig.iterations,
        codeType: testConfig.codeType,
        codeRate: testConfig.codeRate,
        blockLength: testConfig.blockLength,
        modulation: testConfig.modulation,
        email: testConfig.email,
        created: new Date(),
        status: "queued",
      });
    } catch (error) {
      console.error("Error logging test to database:", error);
    }
  };

  const handleViewTestDetails = (test: TestRun) => {
    toast.info(`Viewing details for test: ${test.name}`);
  };

  const handleRunTest = async () => {
    if (snrRange[0] >= snrRange[1]) {
      toast.error("Minimum SNR must be less than maximum SNR");
      return;
    }
    setIsRunning(true);
    const testId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await logTestToDatabase(testId, {
        name: testName,
        snrRange: { min: snrRange[0], max: snrRange[1], step: 1 },
        iterations,
        codeType,
        codeRate,
        blockLength,
        modulation,
        email: isEmailEnabled ? email : null,
      });
      toast.success("LDPC test submitted successfully");
      setIsRunning(false);
      setTestName("LDPC Test");
      setActiveSection({ main: "Dashboard" });
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while submitting the test");
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">LDPC Solver</CardTitle>
              <CardDescription>Configure and run tests on the LDPC Solver chip</CardDescription>
            </div>
            <ChipStatusIndicator status={chipStatus.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="w-full md:w-2/3">
              <Label htmlFor="ldpc-test-name" className="mb-1.5 block">
                Test Name
              </Label>
              <Input
                id="ldpc-test-name"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Enter a name for this LDPC test"
              />
            </div>
            <div className="flex items-center gap-2 mt-2 md:mt-8">
              <Switch
                id="ldpc-email-notify"
                checked={isEmailEnabled}
                onCheckedChange={setIsEmailEnabled}
              />
              <Label htmlFor="ldpc-email-notify" className="text-sm">
                Notify me when completed
              </Label>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">LDPC Code Type</Label>
              <Tabs
                value={codeType}
                onValueChange={(value) => setCodeType(value)}
                className="w-full md:w-2/3"
              >
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="standard">Standard</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                  <TabsTrigger value="wifi">WiFi/5G</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">SNR Range Configuration</h3>
              <div className="mt-2">
                <Label className="text-sm">Select SNR Range (dB)</Label>
                <Slider
                  value={snrRange}
                  onValueChange={(value: number[]) => setSnrRange([value[0], value[1]])}
                  min={1}
                  max={7}
                  step={1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Selected range: {snrRange[0]} dB to {snrRange[1]} dB
                </p>
              </div>
              <div className="mt-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center mb-1">
                        <Label htmlFor="iterations" className="text-sm mr-1">
                          Iterations per SNR point
                        </Label>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-xs">
                        Higher iterations give more accurate BER measurements but take longer to complete.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Input
                  id="iterations"
                  type="number"
                  value={iterations}
                  onChange={(e) => setIterations(Number(e.target.value))}
                  min="1"
                  max="100"
                  className="w-full md:w-1/3"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total points: {(snrRange[1] - snrRange[0] + 1)} × {iterations} iterations ={" "}
                  {(snrRange[1] - snrRange[0] + 1) * iterations} tests
                </p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={handleRunTest}
            disabled={isRunning || chipStatus.status !== "online"}
            className="gap-2 min-w-[120px]"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            {isRunning ? "Submitting..." : "Run Test"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LDPCContent;
