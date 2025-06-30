"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  FileText,
  AlertCircle,
  Upload,
  Copy,
  RefreshCw,
  PlayCircle,
  Clock,
  PlusCircle,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
// Removed Firebase imports - using mock data instead
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown } from "lucide-react";

// --- Interfaces ---
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
  dataset?: string;
  created: any;
  completed?: any;
  duration?: string;
  results?: any;
  inputType?: string;
  preset?: string;
}

// --- Components ---
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
    if (["uploading_to_teensy", "transferring_files"].includes(backendStatus))
      return "transferring";
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


const SatContent = ({ setActiveSection }: { setActiveSection: (section: any) => void }) => {
  // Subscribe to chip status for 3-SAT chip (document id "3sat")
  const [chipStatus, setChipStatus] = useState<ChipStatus>({
    id: "3sat",
    name: "3-SAT Solver Core",
    type: "3-SAT",
    status: "online",
  });
  useEffect(() => {
    const chipDocRef = doc(db, "chips", "3sat");
    const unsubscribe = onSnapshot(chipDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setChipStatus(docSnap.data() as ChipStatus);
      }
    });
    return () => unsubscribe();
  }, []);

  const [inputType, setInputType] = useState<"preset" | "file" | "text" | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [textInput, setTextInput] = useState(`c Example 3SAT problem
p cnf 4 3
1 2 3 0
-2 3 4 0
-1 -3 -4 0`);
  const [selectedSample, setSelectedSample] = useState("");
  const [presets, setPresets] = useState<string[]>([]);
  const [presetTotal, setPresetTotal] = useState<number>(0);
  const [presetLimit, setPresetLimit] = useState<number>(0);
  const [isEmailEnabled, setIsEmailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [testName, setTestName] = useState("Untitled Test");

  const API_URL = "https://dacroq.eecs.umich.edu/teensysat";

  useEffect(() => {
    fetch(`${API_URL}/presets`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success" && data.presets) {
          setPresets(data.presets);
        } else {
          setPresets([
            "Darpa_TNE_3SAT",
            "Darpa_TNE_2SAT",
            "uf50-218_1-100",
            "uf50-218_1-1000",
            "decomposition-mini",
          ]);
        }
      })
      .catch((err) => {
        setPresets([
          "Darpa_TNE_3SAT",
          "Darpa_TNE_2SAT",
          "uf50-218_1-100",
          "uf50-218_1-1000",
          "decomposition-mini",
        ]);
      });
  }, []);

  useEffect(() => {
    const savedEmail = localStorage.getItem("savedEmail");
    if (savedEmail) setEmail(savedEmail);
  }, []);

  const handleFileSelect = (files: File[]) => {
    setSelectedFiles(files);
    if (files.length > 0 && testName === "Untitled Test") {
      const firstFileName = files[0].name;
      setTestName(firstFileName.replace(/\.(cnf|sat|zip)$/, ""));
    }
  };

  const handleSampleSelect = (sample: string) => {
    setSelectedSample(sample);
    setTestName(sample);
    setPresetTotal(0);
    fetch(`${API_URL}/presets/count?preset=${encodeURIComponent(sample)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          setPresetTotal(data.total);
          setPresetLimit(data.total);
        } else {
          toast.error(`Failed to get file count: ${data.message}`);
        }
      })
      .catch((err) => {
        toast.error("Failed to connect to server");
      });
  };

  const logTestToDatabase = async (testId: string, testConfig: any) => {
    try {
      const docData: any = {
        name: testConfig.name || "Untitled Test",
        chipType: "3-SAT",
        inputType: testConfig.inputType,
        created: testConfig.created || new Date(),
        status: testConfig.status || "queued",
      };
      if (testConfig.inputType === "file" && testConfig.files) {
        docData.files = testConfig.files;
      }
      if (testConfig.inputType === "preset") {
        if (testConfig.preset) docData.preset = testConfig.preset;
        if (testConfig.presetLimit) docData.presetLimit = testConfig.presetLimit;
        if (testConfig.presetRange) docData.presetRange = testConfig.presetRange;
      }
      if (testConfig.inputType === "text" && testConfig.textInput) {
        docData.textInput = testConfig.textInput;
      }
      if (testConfig.timeout) docData.timeout = testConfig.timeout;
      if (testConfig.maxIterations) docData.maxIterations = testConfig.maxIterations;
      if (testConfig.solutionLimit) docData.solutionLimit = testConfig.solutionLimit;
      if (testConfig.optimizationGoal) docData.optimizationGoal = testConfig.optimizationGoal;
      if (testConfig.priority) docData.priority = testConfig.priority;
      if (testConfig.email) docData.email = testConfig.email;
      await setDoc(doc(db, "tests", testId), docData);
    } catch (error) {
      console.error("Error logging test to database:", error);
    }
  };

  const handleViewTestDetails = (test: TestRun) => {
    toast.info(`Viewing details for test: ${test.name}`);
  };

  const handleRunTest = async () => {
    if (inputType === "file" && selectedFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }
    if (inputType === "preset" && !selectedSample) {
      toast.error("Please select a preset dataset");
      return;
    }
    if (inputType === "text" && !textInput.trim()) {
      toast.error("Please enter CNF text");
      return;
    }
    if (!inputType) {
      toast.error("Please select an input type (Preset, File, or Custom CNF)");
      return;
    }
    setIsRunning(true);
    try {
      const testId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      if (inputType === "text") {
        const uploadResponse = await fetch(`${API_URL}/upload_text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cnf_text: textInput }),
        });
        if (!uploadResponse.ok) throw new Error("Failed to upload CNF text");
      } else if (inputType === "file") {
        const formData = new FormData();
        selectedFiles.forEach((file) => formData.append("files[]", file));
        const uploadResponse = await fetch(`${API_URL}/upload`, {
          method: "POST",
          body: formData,
        });
        if (!uploadResponse.ok) throw new Error("Failed to upload files");
      } else if (inputType === "preset") {
        const start_index = 0;
        const end_index = presetLimit - 1;
        const presetResponse = await fetch(`${API_URL}/presets/load`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preset: selectedSample,
            start_index: start_index,
            end_index: end_index,
          }),
        });
        if (!presetResponse.ok) throw new Error("Failed to load preset");
      }
      await logTestToDatabase(testId, {
        name: testName,
        inputType,
        ...(inputType === "preset" && {
          preset: selectedSample,
          presetLimit: presetLimit,
          presetRange: { start: 0, end: presetLimit - 1 },
        }),
        ...(inputType === "text" && { textInput }),
        ...(inputType === "file" && { files: selectedFiles.map((f) => f.name) }),
        email: isEmailEnabled ? email : "",
        created: new Date(),
        status: "queued",
      });
      const runResponse = await fetch(`${API_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: isEmailEnabled ? email : "", 
          testId,
          name: testName
        }),
      });
      if (!runResponse.ok) {
        const errorData = await runResponse.json().catch(() => ({}));
        throw new Error(errorData.message || "Test submission failed");
      }
      toast.success("Test submitted successfully");
      if (inputType === "file") {
        setSelectedFiles([]);
      }
      setTestName("Untitled Test");
      setInputType(null);
      setSelectedSample("");
      setPresetTotal(0);
      setPresetLimit(0);
      setTextInput(`c Example 3SAT problem
p cnf 4 3
1 2 3 0
-2 3 4 0
-1 -3 -4 0`);
      setActiveSection({ main: "Portal" });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "An error occurred while submitting the test");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">3-SAT Solver</CardTitle>
              <CardDescription>
                Configure and run tests on the 3-SAT Solver chip
              </CardDescription>
            </div>
            <ChipStatusIndicator status={chipStatus.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="w-full md:w-2/3">
              <Label htmlFor="test-name" className="mb-1.5 block">
                Test Name
              </Label>
              <Input
                id="test-name"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Enter a name for this test"
              />
            </div>
           
          </div>
          <div>
            <CardTitle className="text-sm">
              Choose a default preset or another input method
            </CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {presets.map((preset) => (
                <div
                  key={preset}
                  onClick={() => {
                    setInputType("preset");
                    handleSampleSelect(preset);
                  }}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    inputType === "preset" && selectedSample === preset
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm">{preset}</h3>
                    {inputType === "preset" && selectedSample === preset && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
              {/* <div
                onClick={() => {
                  setInputType("file");
                  setSelectedSample("");
                }}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  inputType === "file"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Upload Files</h3>
                  {inputType === "file" && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </div>
              </div> */}
              <div
                onClick={() => {
                  setInputType("text");
                  setSelectedSample("");
                }}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  inputType === "text"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm">Custom CNF</h3>
                  {inputType === "text" ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <PlusCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          </div>
          {inputType === "preset" && selectedSample && (
            <div className="mt-6 bg-muted/20 p-4 rounded-lg border">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                <Label className="text-sm font-medium">
                  Number of tests to run
                  {presetTotal > 0 ? ` (1 - ${presetTotal})` : ""}
                </Label>
                <div className="font-medium text-right">
                  {presetLimit} / {presetTotal > 0 ? presetTotal : "..."}
                </div>
              </div>
              {presetTotal > 0 ? (
                <>
                  <div className="mt-3">
                    <input
                      type="range"
                      min="1"
                      max={presetTotal}
                      value={presetLimit}
                      onChange={(e) => setPresetLimit(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Running {presetLimit} out of {presetTotal} total available tests.
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading test count...
                  </span>
                </div>
              )}
            </div>
          )}
          {inputType === "file" && (
            <div className="mt-4">
              {/* Assume FileUploadZone is implemented elsewhere and imported */}
              {/* For brevity, you can use your existing FileUploadZone component */}
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <p>File upload zone placeholder</p>
              </div>
            </div>
          )}
          {inputType === "text" && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(textInput);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy
                </Button>
              </div>
              <Textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="font-mono text-sm min-h-[220px]"
                placeholder="Enter DIMACS CNF format here..."
              />
              <p className="text-xs text-muted-foreground">
                Format: p cnf [num_variables] [num_clauses] followed by clauses, one per line, ending with 0
              </p>
            </div>
          )}
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

export default SatContent;
