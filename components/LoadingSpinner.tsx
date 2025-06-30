import React from "react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
    className?: string;
}

const LoadingSpinner = ({ className }: LoadingSpinnerProps) => {
    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            <div className="absolute w-full h-full rounded-full border-4 border-muted-foreground/15"></div>
            <div className="absolute w-full h-full rounded-full border-4 border-transparent border-t-primary animate-spin-smooth"></div>
        </div>
    );
};

export default LoadingSpinner;