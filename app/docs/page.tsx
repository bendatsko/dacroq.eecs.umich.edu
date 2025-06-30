"use client";

import React, { useState } from 'react';
import { ChevronRight, Terminal, Zap } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// Documentation content sections
const DocsContent = {
  introduction: {
    title: "Introduction",
    content: `Dacroq is a powerful web interface for solving complex mathematical problems through our API. Our platform currently supports 3-SAT solving, with K-SAT and LDPC solvers coming soon.

## What is Dacroq?
The website dacroq.eecs.umich.edu acts as a web interface for an API. This API is used to control a SAT solver, a K-SAT solver, and an LDPC solver. Currently, only the SAT solver is operational.

## Platform Overview
Dacroq provides:
- Real-time solving capabilities for SAT problems
- User-friendly web interface
- Comprehensive API access
- Detailed performance metrics and benchmarking
- Support for multiple input formats`
  },

  "quick-start": {
    title: "Quick Start Guide",
    content: `## Running the 3-SAT Solver

Follow these steps to get started with your first test:

1. Prepare your input using one of these formats:
   - .cnf file
   - .zip file containing multiple .cnf files
   - Pre-loaded problems (configurable range)
   - Single problem in plaintext

2. Use the user interface to enter this configuration and press run
3. Wait for your test status to update to "Completed"
4. View results and analyze performance

## Test Management
The recent tests table shows all tests run by all users. Key features:
- All users can see all tests
- Tests can be deleted by any user
- Real-time status updates
- Comprehensive result viewing

## Input Types
Dacroq supports multiple input formats:
- Single CNF files
- Batch processing via ZIP files
- Pre-configured problem sets
- Direct plaintext input
  
## Quick Tips
- Monitor test status in real-time
- Download benchmark data for detailed analysis
- Use the reset function if needed
- Check success rates and performance metrics`
  },

  installation: {
    title: "Installation",
    content: `## Getting Access
1. Request access to Dacroq by contacting help@dacroq.eecs.umich.edu
2. Once approved, you'll receive login credentials
3. Access the platform at dacroq.eecs.umich.edu

## API Setup
For API access:
1. Log in to your account
2. Navigate to the API Documentation section
3. Follow the authentication setup guide
4. Test your connection using provided examples

## System Requirements
- Modern web browser (Chrome, Firefox, Safari)
- Internet connection
- Valid university credentials`
  },

  "3-sat-solver": {
    title: "3-SAT Solver",
    content: `The 3-SAT solver is our primary solver, designed for Boolean satisfiability problems where each clause contains exactly three literals.

## Overview
Our 3-SAT solver is built specifically for efficient handling of Boolean satisfiability problems. It utilizes advanced algorithms and hardware acceleration to solve complex SAT problems with high reliability and performance.

## Features
- Real-time solving capabilities
- Multiple input formats supported
- Detailed performance metrics
- Benchmark data export
- Batch processing support

## Performance Metrics
The solver provides comprehensive metrics:
- Success rate
- Average runtime
- Solution iterations
- Memory usage
- Hardware utilization

## Using the Solver
1. Access through web interface
2. Select input method
   - Upload CNF file
   - Use pre-loaded problems
   - Enter plaintext
3. Configure parameters
4. Run test
5. Monitor progress
6. View results

## Test Management
- View all tests in the dashboard
- Download benchmark data
- Analyze performance metrics
- Delete or re-run tests as needed
  
## Input Formats
### CNF File Format
- Standard DIMACS format
- Three literals per clause
- Comment lines start with 'c'
- Problem line format: 'p cnf variables clauses'

### Batch Processing
- ZIP files containing multiple CNF files
- Automatic processing queue
- Aggregate results reporting

### Pre-loaded Problems
- Curated test sets
- Configurable range
- Verified problem instances`
  },

  "k-sat-solver": {
    title: "K-SAT Solver",
    content: `## Overview
The K-SAT solver is an extension of our 3-SAT solver, designed to handle Boolean satisfiability problems with varying clause lengths.

## Status
🚧 Currently under development. The K-SAT solver will support:
- Variable clause lengths
- Enhanced performance metrics
- Advanced optimization techniques
- Extended benchmark capabilities

## Coming Features
- Flexible clause length support
- Advanced heuristics
- Performance optimization
- Extended benchmarking

Stay tuned for updates on the K-SAT solver release.`
  },

  "ldpc-solver": {
    title: "LDPC Solver",
    content: `## Overview
The LDPC (Low-Density Parity-Check) solver is designed for error-correcting codes and related applications.

## Status
🚧 In development. The LDPC solver will feature:
- Specialized algorithms for LDPC codes
- Performance optimization
- Integration with existing infrastructure
- Comprehensive benchmarking

## Planned Features
- Matrix representation support
- Advanced decoding algorithms
- Performance analysis tools
- Batch processing capabilities

Development updates will be posted here when available.`
  }
};

// Documentation page component
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction');

  const renderMarkdown = (content) => {
    // Split by actual newlines without preserving indentation
    const lines = content.split('\n');
    let currentList = [];
    let inList = false;
    const elements = [];
    let key = 0;

    const finishList = () => {
      if (inList && currentList.length > 0) {
        elements.push(
          <ul key={key++} className="my-4 ml-6 list-disc space-y-2">
            {currentList}
          </ul>
        );
        currentList = [];
        inList = false;
      }
    };

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        finishList();
        elements.push(<div key={key++} className="my-4" />);
      }
      else if (trimmedLine.startsWith('## ')) {
        finishList();
        elements.push(
          <h2 key={key++} className="text-2xl font-semibold mt-8 mb-4 text-foreground">
            {trimmedLine.substring(3)}
          </h2>
        );
      }
      else if (trimmedLine.startsWith('### ')) {
        finishList();
        elements.push(
          <h3 key={key++} className="text-xl font-semibold mt-6 mb-3 text-foreground">
            {trimmedLine.substring(4)}
          </h3>
        );
      }
      else if (trimmedLine.startsWith('- ')) {
        inList = true;
        currentList.push(
          <li key={key++} className="text-foreground/90">
            {trimmedLine.substring(2)}
          </li>
        );
      }
      else if (trimmedLine.match(/^\d+\./)) {
        finishList();
        elements.push(
          <div key={key++} className="ml-6 my-2 text-foreground/90">
            {trimmedLine}
          </div>
        );
      }
      else {
        finishList();
        elements.push(
          <p key={key++} className="leading-7 text-foreground/90">
            {trimmedLine}
          </p>
        );
      }
    });

    finishList();
    return elements;
  };

  const sections = [
    {
      title: "GETTING STARTED",
      items: [
        { id: "introduction", title: "Introduction" },
        { id: "quick-start", title: "Quick Start" },
        { id: "installation", title: "Installation" }
      ]
    },
    {
      title: "SOLVERS",
      items: [
        { id: "3-sat-solver", title: "3-SAT Solver" },
        { id: "k-sat-solver", title: "K-SAT Solver" },
        { id: "ldpc-solver", title: "LDPC Solver" }
      ]
    }
  ];

  const getCurrentSectionName = () => {
    for (const section of sections) {
      const item = section.items.find(item => item.id === activeSection);
      if (item) return item.title;
    }
    return '';
  };

  // Quick links for the introduction page
  const QuickLinks = () => (
    <div className="grid gap-4 md:grid-cols-2 my-8">
      <Card className="relative overflow-hidden hover:border-primary/50 transition-colors">
        <CardContent className="p-6">
          <div className="flex flex-col h-[180px] justify-between">
            <div className="space-y-2">
              <Terminal className="h-6 w-6" />
              <h3 className="font-bold">Quick Start Guide</h3>
              <p className="text-sm text-muted-foreground">
                Get up and running with Dacroq in less than 5 minutes.
              </p>
            </div>
            <Button 
              variant="ghost" 
              className="justify-start gap-2"
              onClick={() => setActiveSection('quick-start')}
            >
              Learn more <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden hover:border-primary/50 transition-colors">
        <CardContent className="p-6">
          <div className="flex flex-col h-[180px] justify-between">
            <div className="space-y-2">
              <Zap className="h-6 w-6" />
              <h3 className="font-bold">3-SAT Solver</h3>
              <p className="text-sm text-muted-foreground">
                Learn how to use our primary solver.
              </p>
            </div>
            <Button 
              variant="ghost" 
              className="justify-start gap-2"
              onClick={() => setActiveSection('3-sat-solver')}
            >
              View docs <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r hidden lg:block">
        <ScrollArea className="h-full py-6">
          <div className="px-4 py-2">
            <h4 className="text-sm font-medium">Documentation</h4>
          </div>
          <nav className="space-y-6 px-2">
            {sections.map((section, i) => (
              <div key={i} className="space-y-2">
                <h5 className="px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h5>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? "secondary" : "ghost"}
                      className="w-full justify-start text-sm font-normal"
                      onClick={() => setActiveSection(item.id)}
                    >
                      <span>{item.title}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1">
        <div className="h-full px-8 py-6 lg:px-12">
          <div className="mx-auto max-w-4xl">
            {/* Breadcrumb */}
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-8">
              <span>Documentation</span>
              <ChevronRight className="h-4 w-4" />
              <span>{getCurrentSectionName()}</span>
            </div>

            {/* Content */}
            <div className="space-y-6">
              <h1 className="text-4xl font-bold tracking-tight">
                {DocsContent[activeSection].title}
              </h1>
              
              {activeSection === 'introduction' && <QuickLinks />}
              
              <div className="docs-content">
                {renderMarkdown(DocsContent[activeSection].content)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}