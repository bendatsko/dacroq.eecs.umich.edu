import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export  function ClearBlockage() {
    const [isResetting, setIsResetting] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    const clearLogs = () => {
        setLogs([]);
    };

    const handleClearBlockage = async () => {
        setIsResetting(true);
        setLogs([]);

        try {
            const response = await fetch('https://dacroq.eecs.umich.edu:8020/restart', {
                method: 'POST',
            });

            if (!response.ok || !response.body) {
                throw new Error('Reset request failed');
            }

            // Handle the streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n');

                // Process each line
                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        const message = line.substring(6);
                        setLogs(prev => [...prev, message]);

                        // Check for success/failure
                        if (message.includes('[SUCCESS]')) {
                            toast.success('Reset completed successfully');
                        } else if (message.includes('[FAILED]')) {
                            toast.error('Reset failed');
                        }
                    }
                });
            }
        } catch (error) {
            toast.error('Failed to reset device');
            console.error('Reset error:', error);
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <Card className="border border-border/50 bg-background/50 backdrop-blur">
            <CardHeader>
                <CardTitle>Clear Device Blockage</CardTitle>
                <CardDescription>
                    Reset the device if it becomes unresponsive
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-4">
                    <Button
                        onClick={handleClearBlockage}
                        disabled={isResetting}
                        className="w-32"
                    >
                        {isResetting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Resetting
                            </>
                        ) : (
                            'Clear Blockage'
                        )}
                    </Button>
                    {logs.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={clearLogs}
                            disabled={isResetting}
                        >
                            Clear Log
                        </Button>
                    )}
                </div>

                {logs.length > 0 && (
                    <ScrollArea className="h-[200px] rounded-md border p-4">
                        <div className="space-y-2 font-mono text-sm">
                            {logs.map((log, index) => (
                                <div
                                    key={index}
                                    className={`text-sm ${
                                        log.includes('[SUCCESS]')
                                            ? 'text-green-500'
                                            : log.includes('[FAILED]')
                                                ? 'text-red-500'
                                                : ''
                                    }`}
                                >
                                    {log}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
}