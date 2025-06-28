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
  doc,
  setDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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


const KSatContent = ({ setActiveSection }: { setActiveSection: (section: any) => void }) => {
  // Subscribe to chip status from Firestore for KSAT chip (document id "ksat")


  const [testName, setTestName] = useState("KSAT Test");
  const [snrMin, setSnrMin] = useState(0);
  const [snrMax, setSnrMax] = useState(10);
  const [snrStep, setSnrStep] = useState(1);
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



  return (
    <div className="space-y-8">
      <Card className="bg-black">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">KSAT Solver</CardTitle>
              <CardDescription>Configure and run tests on the KSAT Solver chip</CardDescription>
            </div>
            <ChipStatusIndicator status={chipStatus.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="w-full md:w-2/3">
              <Label htmlFor="KSAT-test-name" className="mb-1.5 block">Test Name</Label>
              <Input id="KSAT-test-name" value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Enter a name for this KSAT test" />
            </div>
            <div className="flex items-center gap-2 mt-2 md:mt-8">
              <Switch id="KSAT-email-notify" checked={isEmailEnabled} onCheckedChange={setIsEmailEnabled} />
              <Label htmlFor="KSAT-email-notify" className="text-sm">
                Notify me when completed
              </Label>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">KSAT Code Type</Label>
              <Tabs value={codeType} onValueChange={(value) => setCodeType(value)} className="w-full md:w-2/3">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="standard">Standard</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                  <TabsTrigger value="wifi">WiFi/5G</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium">SNR Range Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="snr-min" className="text-sm">Minimum SNR (dB)</Label>
                  <Input id="snr-min" type="number" value={snrMin} onChange={(e) => setSnrMin(Number(e.target.value))} min="-10" max="30" step="0.5" />
                </div>
                <div>
                  <Label htmlFor="snr-max" className="text-sm">Maximum SNR (dB)</Label>
                  <Input id="snr-max" type="number" value={snrMax} onChange={(e) => setSnrMax(Number(e.target.value))} min="-10" max="30" step="0.5" />
                </div>
                <div>
                  <Label htmlFor="snr-step" className="text-sm">Step Size (dB)</Label>
                  <Input id="snr-step" type="number" value={snrStep} onChange={(e) => setSnrStep(Number(e.target.value))} min="0.1" max="5" step="0.1" />
                </div>
              </div>
              <div className="mt-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center mb-1">
                        <Label htmlFor="iterations" className="text-sm mr-1">Iterations per SNR point</Label>
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
                <Input id="iterations" type="number" value={iterations} onChange={(e) => setIterations(Number(e.target.value))} min="1" max="100" className="w-full md:w-1/3" />
                <p className="text-xs text-muted-foreground mt-1">
                  Total points: {Math.floor((snrMax - snrMin) / snrStep) + 1} × {iterations} iterations = {(Math.floor((snrMax - snrMin) / snrStep) + 1) * iterations} tests
                </p>
              </div>
            </div>
            <div className="pt-2">
              <Button
                variant="ghost"
                className="px-0 text-muted-foreground text-sm"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              >
                {showAdvancedOptions ? "Hide" : "Show"} Advanced Options
              </Button>
              {showAdvancedOptions && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 border-t pt-4">
                  <div>
                    <Label htmlFor="code-rate" className="text-sm">Code Rate</Label>
                    <select
                      id="code-rate"
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={codeRate}
                      onChange={(e) => setCodeRate(e.target.value)}
                    >
                      <option value="0.25">1/4 (0.25)</option>
                      <option value="0.333">1/3 (0.333)</option>
                      <option value="0.5">1/2 (0.5)</option>
                      <option value="0.667">2/3 (0.667)</option>
                      <option value="0.75">3/4 (0.75)</option>
                      <option value="0.8">4/5 (0.8)</option>
                      <option value="0.833">5/6 (0.833)</option>
                      <option value="0.875">7/8 (0.875)</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="block-length" className="text-sm">Block Length</Label>
                    <select
                      id="block-length"
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={blockLength}
                      onChange={(e) => setBlockLength(e.target.value)}
                    >
                      <option value="512">512 bits</option>
                      <option value="1024">1024 bits</option>
                      <option value="2048">2048 bits</option>
                      <option value="4096">4096 bits</option>
                      <option value="8192">8192 bits</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="modulation" className="text-sm">Modulation</Label>
                    <select
                      id="modulation"
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={modulation}
                      onChange={(e) => setModulation(e.target.value)}
                    >
                      <option value="BPSK">BPSK</option>
                      <option value="QPSK">QPSK</option>
                      <option value="8PSK">8-PSK</option>
                      <option value="16QAM">16-QAM</option>
                      <option value="64QAM">64-QAM</option>
                    </select>
                  </div>
                </div>
              )}
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

export default KSatContent;
