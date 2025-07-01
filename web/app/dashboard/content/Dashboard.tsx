"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Cpu, Zap, BarChart3 } from "lucide-react";

interface DashboardContentProps {
  setActiveSection: (section: string) => void;
}

export const DashboardContent: React.FC<DashboardContentProps> = ({
  setActiveSection,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the DACROQ Platform - Monitor and control your SAT solver chips
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Chips</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tests Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              +20% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.2%</div>
            <p className="text-xs text-muted-foreground">
              Across all solvers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveSection("3-SAT Solver")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              3-SAT Solver
            </CardTitle>
            <CardDescription>
              Hardware-accelerated 3-SAT problem solving
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Access Solver
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveSection("LDPC Decoder")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              LDPC Decoder
            </CardTitle>
            <CardDescription>
              Low-density parity-check code decoder
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Access Decoder
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setActiveSection("k-SAT Solver")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              k-SAT Solver
            </CardTitle>
            <CardDescription>
              Generalized k-SAT problem solver
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">
              Access k-SAT
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest test runs and system events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">3-SAT Test Completed</p>
                <p className="text-sm text-muted-foreground">Problem solved in 2.3ms</p>
              </div>
              <span className="text-xs text-muted-foreground">2 minutes ago</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">LDPC Decode Success</p>
                <p className="text-sm text-muted-foreground">Block decoded successfully</p>
              </div>
              <span className="text-xs text-muted-foreground">5 minutes ago</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">System Health Check</p>
                <p className="text-sm text-muted-foreground">All systems operational</p>
              </div>
              <span className="text-xs text-muted-foreground">15 minutes ago</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
