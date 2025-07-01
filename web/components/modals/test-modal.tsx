"use client"

import { Test } from "@/app/dashboard/types/test"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"

interface TestModalProps {
  test: Test | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TestModal({ test, open, onOpenChange }: TestModalProps) {
  if (!test) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">{test.name}</DialogTitle>
              <DialogDescription className="mt-1.5">
                Started at {test.startTime}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{test.type}</Badge>
              <Badge
                variant={
                  test.status === "completed"
                    ? "success"
                    : test.status === "running"
                    ? "warning"
                    : test.status === "failed"
                    ? "destructive"
                    : "secondary"
                }
              >
                {test.status}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-full pr-4">
          <div className="space-y-6">
            {/* Test Parameters */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Test Parameters</CardTitle>
                <CardDescription>Configuration used for this test run</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Type</p>
                  <p>{test.type}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Duration</p>
                  <p>{test.duration || "Running..."}</p>
                </div>
                {/* Add more parameters as needed */}
              </CardContent>
            </Card>

            {/* Test Results */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Results</CardTitle>
                    <CardDescription>Test execution results and metrics</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in New Tab
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {test.results && test.results.length > 0 ? (
                  <DataTable
                    columns={testResultColumns}
                    data={test.results}
                  />
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No results available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Execution Log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Execution Log</CardTitle>
                <CardDescription>Detailed test execution log</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm font-mono whitespace-pre-wrap">
                  {test.log || "No logs available"}
                </pre>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}