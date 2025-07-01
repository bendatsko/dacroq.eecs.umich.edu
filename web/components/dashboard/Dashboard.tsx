"use client"

import React, {useEffect, useRef, useState} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {Check, ChevronsUpDown, Share2, X, Users2} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
    AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {Cpu, Trash2, ExternalLink, Loader2} from "lucide-react";
import { useUser } from '../../../firmware/lib/user-context';
import {AnimatePresence, motion } from "framer-motion";
import TestDetailsPanel from "@/app/dashboard/content/TestDetailsPanel";
import LoadingSpinner from "@/components/LoadingSpinner";
import { cn } from "../../../firmware/lib/utils";
import { ALLOWED_USERS } from '@/config/allowed-users';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Checkbox} from "@/components/ui/checkbox";



interface QueueStatus {
    solverStats: {
        "3-SAT": { status: string; queueSize: number; totalTests: number; };
        "LDPC": { status: string; queueSize: number; totalTests: number; };
        "k-SAT": { status: string; queueSize: number; totalTests: number; };
    };
}
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
interface Test {
    id: string;
    name: string;
    dataset: string;
    type: 'benchmark' | 'custom';
    status: 'QUEUED' | 'RUNNING' | 'ANALYZING' | 'COMPLETED' | 'ERROR';
    createdAt: string;
    completedAt?: string;
    progress: string[];
    sharedWith?: string[];
    isPublic?: boolean;
}

const SolverCard = ({
                        title,
                        status,
                        description,
                        queueSize,
                        onClick
                    }) => (
    <Card
        className={cn(
            "group relative overflow-hidden transition-all",
            status === 'online'
                ? 'hover:border-primary/50 hover:shadow-md cursor-pointer'
                : 'opacity-75'
        )}
        onClick={status === 'online' ? onClick : undefined}
    >
        <CardHeader className="space-y-1.5 pb-4">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "h-2 w-2 rounded-full transition-colors",
                            status === 'online' ? 'bg-green-500' : 'bg-slate-500/30'
                        )} />
                        <CardTitle className="text-base font-medium">
                            {title}
                        </CardTitle>
                    </div>
                 
                </div>
                <Cpu className="h-4 w-4 text-muted-foreground/50" />
            </div>
        </CardHeader>
        <CardContent>
            <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight">
          {queueSize}
        </span>
                <span className="text-sm text-muted-foreground">
          in queue
        </span>
            </div>
        </CardContent>
        {status === 'online' && (
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent transition-opacity group-hover:opacity-100 opacity-0" />
        )}
    </Card>
);
const TableComponent = ({
                            tests,
                            loading,
                            sortConfig,
                            handleSort,
                            handleRowClick,
                            handleDeleteTest,
                            handleShare
                        }) => (
    <Card className="mt-6">
        <CardHeader className="px-6">
            <div className="space-y-1">
                <CardTitle>Recent Tests</CardTitle>
                <p className="text-sm text-muted-foreground">
                    View and manage your test runs
                </p>
            </div>
        </CardHeader>
        <CardContent className="px-0">
            {/* Scrollable Container */}
            <div className="overflow-x-auto">
                <Table className="min-w-full">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-t">
                            <TableHead className="pl-6 w-[300px] font-medium whitespace-nowrap">Name</TableHead>
                            <TableHead className="w-[150px] font-medium whitespace-nowrap">Status</TableHead>
                            <TableHead
                                className="w-[120px] font-medium cursor-pointer whitespace-nowrap"
                                onClick={() => handleSort('dataset')}
                            >
                                <div className="flex items-center gap-1">
                                    Dataset
                                    {sortConfig.key === 'dataset' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </TableHead>
                            <TableHead
                                className="font-medium cursor-pointer whitespace-nowrap"
                                onClick={() => handleSort('createdAt')}
                            >
                                <div className="flex items-center gap-1">
                                    Created
                                    {sortConfig.key === 'createdAt' && (
                                        <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </TableHead>
                            <TableHead className="font-medium whitespace-nowrap">Completed</TableHead>
                            <TableHead className="pr-4 w-[100px] whitespace-nowrap" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <AnimatePresence mode="popLayout">
                            {tests.map((test) => (
                                <motion.tr
                                    key={test.id}
                                    layout
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{
                                        opacity: 0,
                                        y: -10,
                                        transition: { duration: 0.2 }
                                    }}
                                    className={cn(
                                        "group cursor-pointer border-b border-muted/50 transition-colors",
                                        "hover:bg-muted/50"
                                    )}
                                    onClick={() => handleRowClick(test.id)}
                                >
                                    <motion.td layout className="pl-6 py-3 font-medium whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {test.sharedWith?.length > 0 && (
                                                <TooltipProvider>
                                                    <Tooltip delayDuration={300}>
                                                        <TooltipTrigger asChild>
                                                            <div className="cursor-help">
                                                                <Users2 className="h-4 w-4 text-muted-foreground" />
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right" className="space-y-2">
                                                            <p className="font-medium">
                                                                Owner: {test.username}
                                                            </p>
                                                            <div className="text-sm text-muted-foreground">
                                                                <p className="font-medium mb-1">Shared with:</p>
                                                                <div className="space-y-1">
                                                                    {test.sharedWith.map(email => (
                                                                        <p key={email} className="pl-2">• {email}</p>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                            {test.name}
                                            {test.isPublic && (
                                                <Badge variant="secondary" className="h-5 px-1.5 whitespace-nowrap">
                                                    Public
                                                </Badge>
                                            )}
                                            <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                                        </div>
                                    </motion.td>
                                    <motion.td layout className="py-3 whitespace-nowrap">
                                        <StatusBadge status={test.status} />
                                    </motion.td>
                                    <motion.td layout className="py-3 font-mono text-sm whitespace-nowrap">
                                        {test.dataset}
                                    </motion.td>
                                    <motion.td layout className="py-3 text-sm text-muted-foreground whitespace-nowrap">
                                        {new Date(test.createdAt).toLocaleString()}
                                    </motion.td>
                                    <motion.td layout className="py-3 text-sm text-muted-foreground whitespace-nowrap">
                                        {test.completedAt
                                            ? new Date(test.completedAt).toLocaleString()
                                            : test.status === 'RUNNING'
                                                ? 'In Progress'
                                                : '—'
                                        }
                                    </motion.td>
                                    <motion.td layout className="pr-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                            <DeleteButton testId={test.id} onDelete={handleDeleteTest} />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all"
                                                onClick={() => handleShare(test)}
                                            >
                                                <Share2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </motion.td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
);

const StatusBadge = ({status}) => {
    const statusConfig = {
        COMPLETED: {
            color: 'bg-green-500/10 text-green-500 ring-green-500/20',
            label: 'Completed'
        },
        RUNNING: {
            color: 'bg-blue-500/10 text-blue-500 ring-blue-500/20',
            label: 'Running'
        },
        QUEUED: {
            color: 'bg-yellow-500/10 text-yellow-500 ring-yellow-500/20',
            label: 'Queued'
        },
        PROCESSING: {
            color: 'bg-purple-500/10 text-purple-500 ring-purple-500/20',
            label: 'Processing'
        },
        ERROR: {
            color: 'bg-red-500/10 text-red-500 ring-red-500/20',
            label: 'Error'
        }
    };

    const config = statusConfig[status] || {
        color: 'bg-slate-500/10 text-slate-500 ring-slate-500/20',
        label: status
    };

    return (
        <span className={cn(
            "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
            config.color
        )}>
      {config.label}
    </span>
    );
};

// First, let's fix the DeleteButton to maintain consistent height
const DeleteButton = ({testId, onDelete}) => {
    const [showConfirm, setShowConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e) => {
        e.stopPropagation();
        setIsDeleting(true);
        try {
            await onDelete(testId);
            setShowConfirm(false);
        } catch (error) {
            console.error('Failed to delete test:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div
            className="relative flex items-center justify-end min-w-[160px] h-8" // Fixed height to match button
            onClick={e => e.stopPropagation()}
        >
            {!showConfirm ? (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-destructive"
                    onClick={() => setShowConfirm(true)}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            ) : (
                <div className="flex items-center gap-1.5 text-xs h-8"> {/* Fixed height */}
                    <span className="font-medium text-destructive">Delete?</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs hover:bg-background text-muted-foreground"
                        onClick={() => setShowConfirm(false)}
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={handleDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                <span>Deleting</span>
                            </>
                        ) : (
                            'Delete'
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
};



export const DashboardContent = ({ setActiveSection }) => {
    const [tests, setTests] = useState<Test[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTest, setSelectedTest] = useState<Test | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState({
        key: 'createdAt',
        direction: 'desc'
    });
    const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
    const { user } = useUser();

    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [testToShare, setTestToShare] = useState(null);

    const handleShare = (test) => {
        setTestToShare(test);
        setShareDialogOpen(true);
    };

    const handleShareTest = async (testId, selectedUsers) => {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_URL}/interface/tests/${testId}/share`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': user.email
                },
                body: JSON.stringify({
                    sharedWith: selectedUsers,
                    // Add a timestamp to force backend update
                    timestamp: new Date().toISOString()
                })
            });

            if (!response.ok) throw new Error('Failed to share test');

            // Optimistically update local state
            setTests(prevTests => prevTests.map(test =>
                test.id === testId ? { ...test, sharedWith: selectedUsers } : test
            ));

            // Close dialog after successful share
            setShareDialogOpen(false);
            setTestToShare(null);

        } catch (error) {
            console.error('Failed to share test:', error);
        }
    };

    // Fetch queue status
    // Add this useEffect to fetch queue status
useEffect(() => {
    const fetchQueueStatus = async () => {
        try {
            const response = await fetch('https://dacroq.eecs.umich.edu/interface/queue/status', {
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': user.email
                },
                mode: 'cors'
            });

            if (!response.ok) throw new Error('Failed to fetch queue status');
            const data = await response.json();
            setQueueStatus(data);
        } catch (error) {
            console.error('Failed to fetch queue status:', error);
        }
    };

    if (user?.email) {
        fetchQueueStatus();
        const interval = setInterval(fetchQueueStatus, 5000);
        return () => clearInterval(interval);
    }
}, [user]);

    // Create solvers array using queue status
    const solvers = [
        {
            title: "3-SAT Solver",
            status: queueStatus?.solverStats?.["3-SAT"]?.status || "offline",
            queueSize: queueStatus?.solverStats?.["3-SAT"]?.queueSize || 0,
            onClick: () => handleCardClick("3-SAT Solver")
        },
        {
            title: "LDPC Solver",
            status: queueStatus?.solverStats?.["LDPC"]?.status || "offline",
            queueSize: queueStatus?.solverStats?.["LDPC"]?.queueSize || 0
        },
        {
            title: "k-SAT Solver",
            status: queueStatus?.solverStats?.["k-SAT"]?.status || "offline",
            queueSize: queueStatus?.solverStats?.["k-SAT"]?.queueSize || 0
        }
    ];



    // Fetch tests
    useEffect(() => {
        const fetchTests = async () => {
            try {
                const response = await fetch('https://dacroq.eecs.umich.edu/interface/tests', {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Email': user.email
                    },
                    mode: 'cors'
                });

                if (!response.ok) throw new Error('Failed to fetch tests');
                const data = await response.json();
                setTests(data.map(({ progress, ...rest }) => rest));
            } catch (error) {
                console.error('Failed to fetch tests:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user?.email) {
            fetchTests();
            const interval = setInterval(fetchTests, 5000);
            return () => clearInterval(interval);
        } else {
            setLoading(false);
        }
    }, [user]);

    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortedTests = () => {
        if (!tests) return [];

        const sortedTests = [...tests].sort((a, b) => {
            switch (sortConfig.key) {
                case 'dataset':
                    return (a.dataset ?? '').localeCompare(b.dataset ?? '');
                case 'status':
                    return (a.status ?? '').localeCompare(b.status ?? '');
                case 'createdAt':
                case 'completedAt':
                    return new Date(a[sortConfig.key] || 0).getTime() -
                        new Date(b[sortConfig.key] || 0).getTime();
                default:
                    return 0;
            }
        });

        return sortConfig.direction === 'desc' ? sortedTests.reverse() : sortedTests;
    };

    const handleRowClick = (testId: string) => {
        const test = tests.find(t => t.id === testId);
        if (test) {
            setSelectedTest(test);
            setIsDialogOpen(true);
        }
    };

    const handleCardClick = (section: string) => {
        setActiveSection({
            main: section,
            sub: "Run Test"
        });
    };

    const handleDeleteTest = async (testId: string) => {
        try {
            const response = await fetch(`https://dacroq.eecs.umich.edu/interface/tests/${testId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': user.email
                },
                mode: 'cors'
            });

            if (!response.ok) throw new Error('Failed to delete test');
            setTests(prevTests => prevTests.filter(test => test.id !== testId));
        } catch (error) {
            console.error('Failed to delete test:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="h-full min-h-[calc(100vh-4rem)] bg-background">
            {!selectedTest ? (
                // Main Dashboard View
                <div className="container max-w-7xl mx-auto p-6 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {solvers.map((solver) => (
                            <SolverCard key={solver.title} {...solver} />
                        ))}
                    </div>

                    <div className="space-y-4">
                        <TableComponent
                            tests={getSortedTests()}
                            loading={loading}
                            sortConfig={sortConfig}
                            handleSort={handleSort}
                            handleRowClick={handleRowClick}
                            handleDeleteTest={handleDeleteTest}
                            handleShare={handleShare}
                        />
                    </div>
                </div>
            ) : (
                // Test Details View
                <TestDetailsPanel
                    test={selectedTest}
                    isOpen={true}
                    onClose={() => setSelectedTest(null)}
                />
            )}

            {/* Keep Share Dialog */}
            <ShareTestDialog
                test={testToShare}
                isOpen={shareDialogOpen}
                onClose={() => {
                    setShareDialogOpen(false);
                    setTestToShare(null);
                }}
                onShare={handleShareTest}
            />
        </div>
    );
};
export default DashboardContent;