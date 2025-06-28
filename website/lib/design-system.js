// design-system.js
// This file contains common design elements to be used across the Dacroq website

import React from 'react';
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  RefreshCcw
} from "lucide-react";

// ----------------------
// Logo Component
// ----------------------
// The logo adapts automatically to light/dark mode
export const DacroqLogo = ({ className, onClick }) => {
  // Use next-themes' useTheme hook in actual implementation
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  return (
    <div className={cn("flex items-center", className)} onClick={onClick}>
      {isDarkMode ? (
        // For dark mode (black background): white box, black symbol
        <>
          <div className="w-8 h-8 rounded-md flex items-center justify-center bg-white">
            <span className="text-black font-medium">⭓</span>
          </div>
          <div className="ml-2.5 font-medium text-white">dacroq</div>
        </>
      ) : (
        // For light mode (white background): black box, white symbol
        <>
          <div className="w-8 h-8 rounded-md flex items-center justify-center bg-black">
            <span className="text-white font-medium">⭓</span>
          </div>
          <div className="ml-2.5 font-medium text-black">dacroq</div>
        </>
      )}
    </div>
  );
};

// ----------------------
// Status Indicators
// ----------------------

// Chip Status Indicator (for hardware/solvers)
export const ChipStatusIndicator = ({ status }) => {
  const statusConfig = {
    online: { color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20", icon: CheckCircle2, label: "Online" },
    offline: { color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/20", icon: AlertCircle, label: "Offline" },
    maintenance: { color: "text-amber-500", bgColor: "bg-amber-500/10", borderColor: "border-amber-500/20", icon: RefreshCcw, label: "Maintenance" },
    connecting: { color: "text-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500/20", icon: Activity, label: "Connecting" },
  };
  
  const config = statusConfig[status] || statusConfig.offline;
  const Icon = config.icon;
  
  return (
    <div className={`inline-flex items-center rounded-full ${config.bgColor} ${config.color} border ${config.borderColor} px-2 py-1 text-xs font-medium`}>
      <Icon className="h-3.5 w-3.5 mr-1" />
      <span>{config.label}</span>
    </div>
  );
};

// Test Status Badge (for test results)
export const TestStatusBadge = ({ status }) => {
  let progressText = "";
  let baseStatus = status;

  // Handle progress indicators in status
  if (status.startsWith("running_") && status.includes("_of_")) {
    const parts = status.split('_');
    if (parts.length === 4) {
      progressText = `${parts[1]}/${parts[3]}`;
      baseStatus = "running";
    }
  }

  const getDisplayStatus = (backendStatus) => {
    if (backendStatus === "queued") return "queued";
    if (backendStatus === "completed") return "completed";
    if (["failed", "error", "email_error"].includes(backendStatus)) return "failed";
    if (["uploading_to_teensy", "transferring_files"].includes(backendStatus)) return "transferring";
    return "running";
  };

  const getStatusText = (backendStatus) => {
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

// ----------------------
// Card Styles
// ----------------------

// Consistent card styling function
export const cardStyles = {
  default: "bg-background border rounded-lg shadow-sm",
  interactive: "bg-background border rounded-lg shadow-sm hover:border-primary/30 transition-all hover:shadow-md cursor-pointer",
  stats: "bg-background border rounded-lg shadow-sm overflow-hidden",
};

// ----------------------
// Button Variants
// ----------------------

// Button style configurations
export const buttonVariants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
  // Add specialized variants
  run: "bg-primary text-primary-foreground hover:bg-primary/90 gap-2",
  reset: "bg-muted text-muted-foreground hover:bg-muted/80 gap-2",
};

// ----------------------
// Typography
// ----------------------

export const typography = {
  h1: "text-3xl font-bold tracking-tight",
  h2: "text-2xl font-bold",
  h3: "text-xl font-semibold",
  h4: "text-lg font-semibold",
  body: "text-sm",
  small: "text-xs",
  muted: "text-sm text-muted-foreground",
};

// ----------------------
// Spacing System
// ----------------------

export const spacing = {
  pageContainer: "container mx-auto px-4 py-2",
  pageHeader: "mb-6",
  sectionGap: "space-y-6",
  cardPadding: "p-4",
  cardHeaderPadding: "px-4 py-3",
  cardContentPadding: "px-4 py-2",
  cardFooterPadding: "px-4 py-3",
};

// ----------------------
// Theme Configuration
// ----------------------

// Sample theme tokens to be used in tailwind.config.js
export const themeTokens = {
  colors: {
    primary: {
      DEFAULT: "rgb(var(--primary))",
      foreground: "rgb(var(--primary-foreground))",
    },
    secondary: {
      DEFAULT: "rgb(var(--secondary))",
      foreground: "rgb(var(--secondary-foreground))",
    },
    background: "rgb(var(--background))",
    foreground: "rgb(var(--foreground))",
    card: "rgb(var(--card))",
    "card-foreground": "rgb(var(--card-foreground))",
    muted: {
      DEFAULT: "rgb(var(--muted))",
      foreground: "rgb(var(--muted-foreground))",
    },
    accent: {
      DEFAULT: "rgb(var(--accent))",
      foreground: "rgb(var(--accent-foreground))",
    },
    destructive: {
      DEFAULT: "rgb(var(--destructive))",
      foreground: "rgb(var(--destructive-foreground))",
    },
  },
};

// ----------------------
// Examples of Implementation
// ----------------------

// Example TopNavBar implementation with consistent styling
export const ExampleTopNavBar = ({ user, theme, onNavClick, onThemeToggle, onLogout }) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <DacroqLogo onClick={() => onNavClick("Portal")} />
        
        <div className="flex items-center gap-3">
          {/* Theme toggle and user menu would go here */}
        </div>
      </div>
    </header>
  );
};

// Example Login Page with consistent styling
export const ExampleLoginPage = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[360px] bg-card border rounded-lg shadow-sm">
        <div className="flex justify-center pt-6 pb-4">
          <DacroqLogo />
        </div>
        
        <div className="px-8 py-6 space-y-6">
          {/* Login button */}
          <button className="w-full h-10 px-4 py-2 flex items-center justify-center gap-2 bg-white text-black rounded-md border border-gray-200">
            {/* Google icon would go here */}
            <span>Sign in with Google</span>
          </button>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Contact: help@dacroq.eecs.umich.edu
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};