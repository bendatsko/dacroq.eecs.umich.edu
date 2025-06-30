"use client"

import React, {useEffect, useRef, useState} from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import * as z from "zod";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem, SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Loader2, FileDown, Plus, Cpu, SplitSquareHorizontal,
    Copy, Trash2, GripVertical, Upload, X
} from 'lucide-react';
import { useUser } from '@/lib/user-context';
import { toast } from "sonner";
import { DeviceOffline } from "@/app/dashboard/content/DeviceOffline";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    ToggleGroup,
    ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Inbox } from "lucide-react";
import {Progress} from "@/components/ui/progress";
import {Switch} from "@/components/ui/switch";
import {Label} from "recharts";
import {Textarea} from "@/components/ui/textarea";
import {ALLOWED_USERS} from "@/config/allowed-users";

// const API_BASE_URL = 'https://dacroq.eecs.umich.edu';
const API_BASE_URL = 'https://dacroq.eecs.umich.edu';


// Types and Interfaces
interface Literal {
    variable: number;
    negated: boolean;
}
const DATASET_CONSTRAINTS = {
    "uf20-91": { variables: 20, clauses: 91 },
    "uf50-218": { variables: 50, clauses: 218 },
} as const;

const MAX_SUPPORTED_CLAUSES = 228;

interface CustomDataset {
    id: string;
    name: string;
    fileName: string; // Original ZIP file name
    isPublic: boolean;
    uploadedBy: string; // User email
    uploadedAt: string;
    size: number; // In bytes
    problemCount: number; // Number of CNF files
}


const SAMPLE_CUSTOM_DATASETS: CustomDataset[] = [
    {
        id: "1",
        name: "Random 3-SAT Dataset",
        fileName: "random-3sat.zip",
        isPublic: true,
        uploadedBy: "john@umich.edu",
        uploadedAt: "2024-01-15T12:00:00Z",
        size: 1024 * 1024 * 2,
        problemCount: 100
    }
];
interface Clause {
    id: string;
    literals: Literal[];
    assignedTo: 'die1' | 'die2' | 'both';
}

interface Test {
    id: string;
    name: string;
    dataset: string;
    status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'ERROR';
    createdAt: string;
    completedAt?: string;
    progress: string[];
    completedTests: number;
    totalTests: number;
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


const DatasetUploadDialog = ({
                                 isOpen,
                                 onOpenChange,
                                 onUploadComplete,
                             }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onUploadComplete: (dataset: CustomDataset) => void;
}) => {
    const [uploadConfig, setUploadConfig] = useState({ name: '', alias: '', isPublic: false });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const resetState = () => {
        setUploadConfig({ name: '', alias: '', isPublic: false });
        setSelectedFile(null);
        setUploadProgress(0);
    };

    const handleFileSelect = (file: File) => {
        setSelectedFile(file);
        if (!uploadConfig.name) {
            setUploadConfig((prev) => ({
                ...prev,
                name: file.name.replace('.zip', ''),
            }));
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);

        // Simulated upload progress
        for (let i = 0; i <= 100; i += 10) {
            setUploadProgress(i);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Simulate API call
        const newDataset: CustomDataset = {
            id: Date.now().toString(),
            name: uploadConfig.name || `dataset-${Date.now()}`,
            fileName: selectedFile?.name || '',
            isPublic: uploadConfig.isPublic,
            uploadedBy: 'current@user.com',
            uploadedAt: new Date().toISOString(),
            size: selectedFile?.size || 0,
            problemCount: Math.floor(Math.random() * 100) + 50,
        };

        onUploadComplete(newDataset);
        setIsSubmitting(false);
        onOpenChange(false);
        resetState();
        toast.success('Dataset created successfully');
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!isSubmitting) {
                    onOpenChange(open);
                    if (!open) resetState();
                }
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Upload Dataset</DialogTitle>
                    <DialogDescription>
                        Configure your dataset and upload an optional ZIP file containing CNF benchmarks.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Dataset Name */}
                    <Input
                        value={uploadConfig.name}
                        onChange={(e) =>
                            setUploadConfig((prev) => ({
                                ...prev,
                                name: e.target.value,
                            }))
                        }
                        placeholder="Dataset Name (e.g., Benchmark-Set-2024)"
                    />
                    <FormDescription>
                        This will be the official name of the dataset.
                    </FormDescription>


                    {/* Public/Private Switch */}
                    {/* Public/Private Switch */}
<div className="flex items-center justify-between gap-4">
    <div>
        <p className="font-medium">Dataset Visibility</p>
        <p className="text-sm text-muted-foreground">
            Choose whether the dataset is public or private.
        </p>
    </div>
    <div className="flex items-center gap-3">
        <span className={cn(
            "text-sm",
            !uploadConfig.isPublic ? "text-foreground font-medium" : "text-muted-foreground"
        )}>Private</span>
        <Switch
            id="public"
            checked={uploadConfig.isPublic}
            onCheckedChange={(checked) =>
                setUploadConfig((prev) => ({
                    ...prev,
                    isPublic: checked,
                }))
            }
        />
        <span className={cn(
            "text-sm",
            uploadConfig.isPublic ? "text-foreground font-medium" : "text-muted-foreground"
        )}>Public</span>
    </div>
</div>

                    {/* File Upload Zone */}
                    <FileUploadZone onFileSelect={handleFileSelect} />

                    {selectedFile && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Selected File:</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Upload className="h-4 w-4" />
                                <span>{selectedFile.name}</span>
                                <span className="text-xs">
                                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Upload Progress */}
                    {isSubmitting && (
                        <div className="space-y-2">
                            <Progress value={uploadProgress} />
                            <p className="text-sm text-center text-muted-foreground">
                                {uploadProgress}% complete
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !uploadConfig.name}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting
                                </>
                            ) : (
                                'Submit Dataset'
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};


// Update SelectIt

const FileUploadZone = ({ onFileSelect }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === "application/zip") {
            setFile(files[0]);
            onFileSelect(files[0]);
        } else {
            toast.error("Please upload a ZIP file");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            if (files[0].type === "application/zip") {
                setFile(files[0]);
                onFileSelect(files[0]);
            } else {
                toast.error("Please upload a ZIP file");
            }
        }
    };

    return (
        <div
            className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                "hover:border-primary/50 hover:bg-muted/50",
                isDragging && "border-primary bg-muted/50",
                "relative"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
        >
            <input
                type="file"
                accept=".zip"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
            />
            <div className="space-y-4">
                <div className="flex flex-col items-center gap-2">
                    {file ? (
                        <>
                            <Upload className="h-8 w-8 text-primary" />
                            <p className="text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </>
                    ) : (
                        <>
                            <Inbox className="h-8 w-8 text-muted-foreground" />
                            <div className="space-y-2">
                                <p className="font-medium">Drag and drop your dataset</p>
                                <p className="text-sm text-muted-foreground">
                                    or click to select a ZIP file containing .cnf files
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};





// Form Schemas
// Update schemas
// Form Schemas
// Update schemas

type DatasetId = keyof typeof DATASET_CONSTRAINTS | string;
const benchmarkSchema = z.object({
    name: z.string()
        .optional()
        .transform((val, ctx) =>
            val ?? `benchmark-${new Date().toISOString().split('T')[0]}`
        ),
    dataset: z.string(), // Allow any string instead of enum
    startProblem: z.preprocess(
        (val) => Number(val) || 1,
        z.number().min(1).max(1000)
    ),
    endProblem: z.preprocess(
        (val) => Number(val) || 1000,
        z.number().min(1).max(1000)
    ),
    numClauses: z.preprocess(
        (val) => Number(val) || undefined,
        z.number().optional()
    ),
    runsPerProblem: z.preprocess(
        (val) => Number(val) || 1,
        z.number().min(1)
    )
});

// Add helper function to check if dataset is built-in
const isBuiltInDataset = (dataset: string): dataset is keyof typeof DATASET_CONSTRAINTS => {
    return dataset in DATASET_CONSTRAINTS;
};

const getMaxClauses = (dataset: string) => {
    if (isBuiltInDataset(dataset)) {
        return Math.min(DATASET_CONSTRAINTS[dataset].clauses, MAX_SUPPORTED_CLAUSES);
    }
    return MAX_SUPPORTED_CLAUSES;
};


const customSchema = z.object({
    name: z.string()
        .min(1, "Name is required")
        .max(100, "Name must be less than 100 characters")
        .refine(value => !value.match(/[<>{}]/), "Name cannot contain <, >, {, or } characters")
        .transform((val, ctx) =>
            val ?? `custom-${new Date().toISOString().split('T')[0]}`
        ),
    format: z.enum(["cnf", "dimacs"]),
    content: z.string().optional() // Make content optional during regular interactions
}).refine((data) => {
    // Only validate content on actual form submission
    if (data._type === "submit") {
        return data.content && data.content.length > 0;
    }
    return true;
});

type BenchmarkFormData = z.infer<typeof benchmarkSchema>;
type CustomFormData = z.infer<typeof customSchema>;

// Example presets for both CNF and DIMACS formats
const FORMULA_PRESETS = {
    cnf: {
        simple: {
            name: "Simple SAT Example",
            description: "Basic 3-SAT formula with 3 variables",
            format: "cnf",
            content: "(x₁ ∨ x₂ ∨ x₃) ∧ (¬x₁ ∨ x₂ ∨ x₃) ∧ (x₁ ∨ ¬x₂ ∨ x₃) ∧ (x₁ ∨ x₂ ∨ ¬x₃)"
        },
        medium: {
            name: "Medium Example",
            description: "5-variable formula with mixed clauses",
            format: "cnf",
            content: "(x₁ ∨ ¬x₂ ∨ x₃) ∧ (¬x₁ ∨ x₄ ∨ ¬x₅) ∧ (x₂ ∨ x₃ ∨ x₄) ∧ (¬x₃ ∨ ¬x₄ ∨ x₅)"
        }
    },
    dimacs: {
        simple: {
            name: "Simple DIMACS Example",
            description: "Basic 3-SAT in DIMACS format",
            format: "dimacs",
            content:
                `c Simple 3-SAT example
p cnf 3 4
1 2 3 0
-1 2 3 0
1 -2 3 0
1 2 -3 0`
        },
        medium: {
            name: "Medium DIMACS Example",
            description: "5-variable DIMACS format",
            format: "dimacs",
            content:
                `c Medium complexity example
p cnf 5 4
1 -2 3 0
-1 4 -5 0
2 3 4 0
-3 -4 5 0`
        }
    }
};



const VariableButton = ({ variable, negated, onClick }) => (
    <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        className={cn(
            "h-8 px-3 font-mono transition-colors relative select-none",
            "hover:bg-muted/50 active:scale-95",
            negated && "text-muted-foreground"
        )}
    >
        {negated ? "¬" : ""}x<sub>{variable}</sub>
    </Button>
);


// Custom CNF Visualizer Component
const CNFVisualizer = ({
                           clauses,
                           setClauses,
                           processingMode,
                           setProcessingMode,
                           onFormulaChange
                       }) => {
    // Existing state management code remains the same
    const [showPartitioning, setShowPartitioning] = useState(false);
    const [isSatisfiable, setIsSatisfiable] = useState(null);

    const onDragEnd = (result) => {
        if (!result.destination) return;
        const items = Array.from(clauses);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setClauses(items);
        onFormulaChange(items);
    };

    const addClause = () => {
        const maxVar = Math.max(...clauses.flatMap(c => c.literals.map(l => l.variable)), 0);
        setClauses([...clauses, {
            id: Date.now().toString(),
            literals: [{ variable: 1, negated: false }, { variable: 2, negated: false }, { variable: 3, negated: false }],
            assignedTo: processingMode === 'both' ?
                (clauses.length % 2 === 0 ? 'die1' : 'die2') :
                processingMode
        }]);
    };

    const toggleLiteral = (clauseId, literalIndex) => {
        const newClauses = clauses.map(clause =>
            clause.id === clauseId ? {
                ...clause,
                literals: clause.literals.map((lit, i) =>
                    i === literalIndex ? { ...lit, negated: !lit.negated } : lit
                )
            } : clause
        );
        setClauses(newClauses);
        onFormulaChange(newClauses);
    };

    const addLiteral = (clauseId) => {
        const maxVar = Math.max(...clauses.flatMap(c => c.literals.map(l => l.variable)));
        const newClauses = clauses.map(clause => {
            if (clause.id === clauseId) {
                return {
                    ...clause,
                    literals: [...clause.literals, { variable: maxVar + 1, negated: false }]
                };
            }
            return clause;
        });
        setClauses(newClauses);
        onFormulaChange(newClauses);
    };

    const duplicateClause = (clauseId) => {
        const clauseToDuplicate = clauses.find(c => c.id === clauseId);
        if (clauseToDuplicate) {
            const newClauses = [...clauses, {
                ...clauseToDuplicate,
                id: Date.now().toString(),
            }];
            setClauses(newClauses);
            onFormulaChange(newClauses);
        }
    };

    const deleteClause = (clauseId) => {
        const newClauses = clauses.filter(c => c.id !== clauseId);
        setClauses(newClauses);
        onFormulaChange(newClauses);
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="clauses">
                {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                        {clauses.map((clause, index) => (
                            <Draggable key={clause.id} draggableId={clause.id} index={index}>
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.draggableProps}>
                                        <Card className="relative group bg-background/50">
                                            <CardContent className="p-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div
                                                        {...provided.dragHandleProps}
                                                        className="flex items-center gap-2 min-w-[4rem] text-muted-foreground/60"
                                                    >
                                                        <GripVertical className="h-4 w-4"/>
                                                        <span className="text-sm font-mono">C{index + 1}</span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {clause.literals.map((literal, literalIndex) => (
                                                            <React.Fragment key={literalIndex}>
                                                                <VariableButton
                                                                    variable={literal.variable}
                                                                    negated={literal.negated}
                                                                    onClick={() => toggleLiteral(clause.id, literalIndex)}
                                                                />
                                                                {literalIndex < clause.literals.length - 1 && (
                                                                    <span className="text-muted-foreground mx-1">∨</span>
                                                                )}
                                                            </React.Fragment>
                                                        ))}
                                                    
                                                    </div>

                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="flex items-center gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => duplicateClause(clause.id)}
                                                                className="h-8 w-8 p-0"
                                                            >
                                                                <Copy className="h-4 w-4"/>
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => deleteClause(clause.id)}
                                                                className="h-8 w-8 p-0 hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4"/>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
            <Button variant="outline" onClick={addClause} className="w-full mt-3">
                Add Clause
            </Button>
        </DragDropContext>
    );
};

// Update SelectItem rendering in the dataset dropdown to show visibility
const DatasetSelectItem = ({ dataset }: { dataset: CustomDataset | string }) => {
    if (typeof dataset === 'string') {
        // Built-in dataset format: 'uf50-218' (e.g., 50 variables and 218 clauses)
        const match = dataset.match(/uf(\d+)-(\d+)/);
        const variables = match ? match[1] : '?';
        const clauses = match ? match[2] : '?';

        return (
            <SelectItem value={dataset}>
                <div className="flex items-center gap-2"> {/* Added gap-4 for spacing */}
                    <span>{dataset}</span>
                    <span className="text-xs text-muted-foreground">
                        {variables} vars, {clauses} clauses
                    </span>
                </div>
            </SelectItem>
        );
    }

    // Custom dataset
    return (
        <SelectItem value={dataset.id}>
            <div className="flex items-center justify-between gap-2">
                <span>{dataset.name}</span>
                <div className="flex items-center gap-2">
                    {dataset.isPublic ? (
                        <Badge variant="secondary" className="text-xs">Public</Badge>
                    ) : (
                        <Badge variant="outline" className="text-xs">Private</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                        {dataset.problemCount} problems
                    </span>
                </div>
            </div>
        </SelectItem>
    );
};




// Main SAT Content Component
export const SATContent: React.FC<{ setActiveSection: (section: object) => void }> = ({ setActiveSection }) => {
    const { user } = useUser();
    const [mode, setMode] = useState<'benchmark' | 'custom'>('benchmark');
    const [inputFormat, setInputFormat] = useState<'cnf' | 'dimacs'>('cnf');
    const [activeTest, setActiveTest] = useState<Test | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [solverStatus, setSolverStatus] = useState('offline');
    const [uploadedDataset, setUploadedDataset] = useState<File | null>(null);
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);


    const [clauses, setClauses] = useState<Clause[]>([
        {
            id: '1',
            literals: [
                { variable: 1, negated: true },
                { variable: 2, negated: false },
                { variable: 3, negated: false }
            ],
            assignedTo: 'both'
        },
        {
            id: '2',
            literals: [
                { variable: 1, negated: false },
                { variable: 2, negated: true },
                { variable: 3, negated: false }
            ],
            assignedTo: 'both'
        },
        {
            id: '3',
            literals: [
                { variable: 1, negated: false },
                { variable: 2, negated: false },
                { variable: 3, negated: true }
            ],
            assignedTo: 'both'
        },
        {
            id: '4',
            literals: [
                { variable: 1, negated: true },
                { variable: 2, negated: true },
                { variable: 3, negated: false }
            ],
            assignedTo: 'both'
        }
    ]);
    const [processingMode, setProcessingMode] = useState<'die1' | 'die2' | 'both'>('die1');

    // Form setup
    const benchmarkForm = useForm<BenchmarkFormData>({
        resolver: zodResolver(benchmarkSchema),
        defaultValues: {
            dataset: "uf20-91",
            startProblem: 1,
            endProblem: 1000,
            runsPerProblem: 1
        },
        mode: "onSubmit",
    });



    const customForm = useForm<CustomFormData>({
        resolver: zodResolver(customSchema),
        defaultValues: {
            format: "cnf",
            content: "",
        },
        mode: "onSubmit", // Only validate on submit
    });

    useEffect(() => {
        const dataset = benchmarkForm.watch("dataset");
        let maxClauses = MAX_SUPPORTED_CLAUSES;

        // Only try to get clauses from DATASET_CONSTRAINTS if it's a built-in dataset
        if (dataset in DATASET_CONSTRAINTS) {
            maxClauses = Math.min(
                DATASET_CONSTRAINTS[dataset].clauses,
                MAX_SUPPORTED_CLAUSES
            );
        }

        benchmarkForm.setValue("numClauses", maxClauses);
    }, [benchmarkForm.watch("dataset")]);

    useEffect(() => {
        if (inputFormat === 'dimacs') {
            // Use a simple DIMACS example as default content or pull from predefined presets
            const initialDIMACS = FORMULA_PRESETS.dimacs.simple.content;
            setContent(initialDIMACS);
            customForm.setValue('content', initialDIMACS); // Ensure form state is also updated
        }
    }, [inputFormat, customForm]); // Make sure to include customForm in the dependency array

    // Fetch solver status
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/interface/queue/status`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-Email': user.email
                    },
                    mode: 'cors'
                });

                if (!response.ok) throw new Error('Failed to fetch status');
                const data = await response.json();
                setSolverStatus('online');
                // setSolverStatus(data.solverStats?.["3-SAT"]?.status || 'offline');
            } catch (error) {
                console.error('Error fetching solver status:', error);
                // setSolverStatus('offline');
                setSolverStatus('online');  // <-- This is already in your code

            }
        };

        if (user?.email) {
            fetchStatus();
            const interval = setInterval(fetchStatus, 5000);
            return () => clearInterval(interval);
        }
    }, [user]);

    // Handlers
    const handleBenchmarkSubmit = async (data: BenchmarkFormData) => {
        try {
            setIsSubmitting(true);
            setError(null);

            // Use the user-provided name or generate a default name if none is provided
            const testName = data.name?.trim() || `benchmark-${new Date().toISOString().split('T')[0]}`;

            const response = await fetch(`${API_BASE_URL}/interface/tests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': user.email,
                },
                body: JSON.stringify({
                    username: user.email,
                    name: testName,
                    dataset: data.dataset,
                    startTest: data.startProblem,
                    endTest: data.endProblem,
                }),
            });

            if (!response.ok) throw new Error('Failed to start benchmark test');

            const result = await response.json();
            toast.success('Benchmark test started');
            setActiveSection({ main: "Dashboard" });

        } catch (error) {
            setError(error.message);
            toast.error('Failed to start test');
        } finally {
            setIsSubmitting(false);
        }
    };



    // Convert CNF to DIMACS format
    const convertToDIMACS = (clauses: Clause[]): string => {
        const variables = new Set<number>();
        clauses.forEach(clause => {
            clause.literals.forEach(lit => variables.add(lit.variable));
        });

        const header = `p cnf ${variables.size} ${clauses.length}`;
        const clauseStrings = clauses.map(clause => {
            return clause.literals.map(lit =>
                `${lit.negated ? '-' : ''}${lit.variable}`
            ).join(' ') + ' 0';
        });

        return [header, ...clauseStrings].join('\n');
    };

    // Parse DIMACS format
    // Parse DIMACS format
    const parseDIMACS = (content: string): Clause[] => {
        try {
            const lines = content.split('\n').filter(line => line.trim() !== '');
            const clauses: Clause[] = [];

            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('c') || line.startsWith('p cnf')) continue; // Skip comments and the problem line

                const literals = line.split(/\s+/) // Split on whitespace
                    .map(num => parseInt(num, 10))
                    .filter(num => num !== 0); // Filter out the terminating 0

                if (literals.length > 0) {
                    const clauseLiterals = literals.map(num => ({
                        variable: Math.abs(num),
                        negated: num < 0
                    }));

                    clauses.push({
                        id: `clause-${Date.now()}${Math.random()}`, // Unique ID for react keys
                        literals: clauseLiterals,
                        assignedTo: 'both' // Default assignment
                    });
                }
            }
            return clauses;
        } catch (error) {
            console.error('Failed to parse DIMACS:', error);
            toast.error('Invalid DIMACS format');
            return [];
        }
    };




    const [content, setContent] = useState("");




    const handleCustomSubmit = async (data: CustomFormData) => {
        try {
            setIsSubmitting(true);
            setError(null);

            // Generate a default name if none provided
            const testName = data.name || `custom-${new Date().toISOString().split('T')[0]}`;

            const dimacsContent = inputFormat === 'cnf' ? convertToDIMACS(clauses) : data.content;

            const response = await fetch(`${API_BASE_URL}/interface/cnf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Email': user.email,
                },
                body: JSON.stringify({
                    ...data,
                    name: testName,  // Use the generated name
                    content: dimacsContent,
                    processingMode,
                    username: user.email,
                }),
            });

            if (!response.ok) throw new Error('Failed to submit formula');

            const result = await response.json();
            toast.success('Custom formula test started');
            setActiveSection({ main: "Dashboard" });

        } catch (error) {
            setError(error.message);
            toast.error('Failed to submit formula');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFormatChange = (format: 'cnf' | 'dimacs') => {
        setInputFormat(format);
        if (format === 'dimacs') {
            customForm.setValue('content', convertToDIMACS(clauses));
        } else {
            try {
                setClauses(parseDIMACS(customForm.getValue('content')));
            } catch (error) {
                toast.error('Failed to parse DIMACS format');
            }
        }
    };

    // Render
    if (solverStatus === 'offline') {
        return <DeviceOffline title="Solver offline" />;
    }



    return (
        <div className="container p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-2xl font-bold">SAT Solver</h1>
                <p className="text-muted-foreground">
                    Run SAT solver tests using standard SATLIB benchmarks or create custom formulas.
                    Each benchmark dataset contains 1000 unique SAT problems.
                </p>
            </div>

            {/* Error Display */}
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Mode Selection */}
            <Tabs value={mode} onValueChange={(v: 'benchmark' | 'custom') => setMode(v)}>
                <TabsList>
                    <TabsTrigger value="benchmark">SATLIB Benchmarks</TabsTrigger>
                    <TabsTrigger value="custom">Custom Benchmarks</TabsTrigger>
                </TabsList>

                <TabsContent value="benchmark">
                    <Card>
                        <CardHeader>
                            <CardTitle>SATLIB Benchmarks</CardTitle>
                            <CardDescription>
                                Select problems from standard SATLIB uniform random 3-SAT benchmarks
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FormProvider {...benchmarkForm}>
                                <form onSubmit={benchmarkForm.handleSubmit(handleBenchmarkSubmit)}
                                      className="space-y-6">
                                    <FormField
                                        control={benchmarkForm.control}
                                        name="name"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormLabel>Test Name</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        placeholder="Name your test (optional)"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={benchmarkForm.control}
                                        name="dataset"
                                        render={({field}) => (
                                            <FormItem className="space-y-4">
                                                <FormLabel>Dataset</FormLabel>
                                                <div className="flex flex-col gap-4">
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Select dataset" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectGroup>
                                                                <SelectLabel>Built-in Datasets</SelectLabel>
                                                                <DatasetSelectItem dataset="uf20-91" />
                                                                <DatasetSelectItem dataset="uf50-218" />
                                                            </SelectGroup>
                                                            {SAMPLE_CUSTOM_DATASETS.length > 0 && (
                                                                <SelectGroup>
                                                                    <SelectLabel>Custom Datasets</SelectLabel>
                                                                    {SAMPLE_CUSTOM_DATASETS.map(dataset => (
                                                                        <DatasetSelectItem key={dataset.id} dataset={dataset} />
                                                                    ))}
                                                                </SelectGroup>
                                                            )}
                                                        </SelectContent>
                                                    </Select>


                                                </div>
                                                <FormDescription>
                                                    Select from standard SATLIB benchmarks or upload your own dataset.

                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {/*<DatasetUploadDialog*/}
                                    {/*    isOpen={isUploadDialogOpen}*/}
                                    {/*    onOpenChange={setIsUploadDialogOpen}*/}
                                    {/*    onUploadComplete={(dataset) => {*/}
                                    {/*        // Add dataset to list (this would be handled by your backend)*/}
                                    {/*        // For now, we can simulate it*/}
                                    {/*        SAMPLE_CUSTOM_DATASETS.push(dataset);*/}
                                    {/*    }}*/}
                                    {/*/>*/}

                                    <div className="grid gap-6">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={benchmarkForm.control}
                                                name="startProblem"
                                                render={({field}) => (
                                                    <FormItem>
                                                        <FormLabel>Start Problem</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                max={1000}
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormDescription>
                                                            First problem to test (1-1000)
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={benchmarkForm.control}
                                                name="endProblem"
                                                render={({field}) => (
                                                    <FormItem>
                                                        <FormLabel>End Problem</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                max={1000}
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormDescription>
                                                            Last problem to test (1-1000)
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={benchmarkForm.control}
                                                name="numClauses"
                                                render={({field}) => {
                                                    const dataset = benchmarkForm.watch("dataset");
                                                    const maxClauses = getMaxClauses(dataset);

                                                    return (
                                                        <FormItem>
                                                            <FormLabel>Number of Clauses</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    max={maxClauses}
                                                                    placeholder={String(maxClauses)}
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormDescription>
                                                                Limit clauses (default is {isBuiltInDataset(dataset) ?
                                                                `dataset maximum: ${maxClauses}` :
                                                                `hardware maximum: ${MAX_SUPPORTED_CLAUSES}`})
                                                            </FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    );
                                                }}
                                            />

                                            <FormField
                                                control={benchmarkForm.control}
                                                name="runsPerProblem"
                                                render={({field}) => (
                                                    <FormItem>
                                                        <FormLabel>Runs Per Problem</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormDescription>
                                                            Times to run each problem
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Starting Benchmark Test
                                            </>
                                        ) : (
                                            'Add Test to Queue'
                                        )}
                                    </Button>
                                </form>
                            </FormProvider>



                        </CardContent>
                    </Card>
                </TabsContent>

                {/* In the TabsContent for "custom" */}
                <TabsContent value="custom">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Custom SAT Benchmarks</CardTitle>
                                <CardDescription>
                                    Create your own SAT formula, import from DIMACS format, or upload your own dataset as a .zip containing .cnf files.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Top controls outside form */}
                                <div className="space-y-4">
                                    <Input
                                        placeholder="Name your test (optional)"
                                        // defaultValue={`custom-${new Date().toISOString().split('T')[0]}`}
                                        onChange={(e) => customForm.setValue('name', e.target.value || undefined)}

                                    />


                                    <Select
                                        defaultValue={inputFormat}
                                        onValueChange={(value: 'cnf' | 'dimacs') => {
                                            setInputFormat(value);
                                            customForm.setValue('format', value);
                                            handleFormatChange(value);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select format"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cnf">
                                                Visual CNF Editor
                                            </SelectItem>
                                            <SelectItem value="dimacs">
                                                DIMACS Format
                                            </SelectItem>
                                        </SelectContent>


                                    </Select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Separator className="flex-1"/>
                                    <span className="text-xs text-muted-foreground">OR</span>
                                    <Separator className="flex-1"/>
                                </div>

                                <Button
                                    variant="outline"
                                    className="w-full"
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setIsUploadDialogOpen(true);
                                    }}
                                >
                                    <Upload className="h-4 w-4 mr-2"/>
                                    Upload Custom Dataset
                                </Button>

                                {/* CNF Editor or DIMACS input */}
                                {inputFormat === 'cnf' ? (
                                    <div className="space-y-6">
                                        <CNFVisualizer
                                            clauses={clauses}
                                            setClauses={setClauses}
                                            processingMode={processingMode}
                                            setProcessingMode={setProcessingMode}
                                            onFormulaChange={(newClauses) => {
                                                setClauses(newClauses);
                                                // Update hidden form field without validation
                                                customForm.setValue('content', convertToDIMACS(newClauses), {
                                                    shouldValidate: false
                                                });
                                            }}
                                        />


                                    </div>
                                ) : (
                                    <div className="space-y-6">


                                        <Textarea
                                            value={content}
                                            onChange={(e) => {
                                                setContent(e.target.value);
                                                customForm.setValue('content', e.target.value); // Keep form state synchronized
                                            }}
                                            className="w-full min-h-[300px] p-3 font-mono text-sm rounded-md border bg-background"
                                            placeholder="Enter DIMACS format..."
                                        />


                                    </div>
                                )}
                                <Button
                                    disabled={isSubmitting}
                                    onClick={() => handleCustomSubmit(customForm.getValues())}
                                    className="w-full"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                            Submitting...
                                        </>
                                    ) : (
                                        'Add Test to Queue'
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    <FormProvider {...customForm}>
                        <DatasetUploadDialog
                            isOpen={isUploadDialogOpen}
                            onOpenChange={setIsUploadDialogOpen}
                            onUploadComplete={(dataset) => {
                                // Add dataset to list (this would be handled by your backend)
                                // For now, we can simulate it
                                SAMPLE_CUSTOM_DATASETS.push(dataset);
                            }}
                        />
                    </FormProvider>




                </TabsContent>
            </Tabs>
        </div>
    );
};

export default SATContent;