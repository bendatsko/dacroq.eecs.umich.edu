// hooks/useTestStatus.ts
import { useState, useEffect } from 'react';

interface Test {
    id: string;
    name: string;
    dataset: string;
    snrValues: number[];
    status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'ERROR';
    progress: string[];
    createdAt: string;
    completedAt?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export function useTestStatus(testId: string | null) {
    const [test, setTest] = useState<Test | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!testId) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/tests/${testId}`, {
                    credentials: 'include',
                });
                if (!response.ok) throw new Error('Failed to fetch test status');
                const data = await response.json();
                setTest(data);

                if (data.status === 'COMPLETED' || data.status === 'ERROR') {
                    clearInterval(pollInterval);
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error fetching status');
            }
        }, 2000);

        return () => clearInterval(pollInterval);
    }, [testId]);

    return { test, error };
}