"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CircleOff } from "lucide-react"

interface DeviceOfflineProps {
  title?: string;
}

export function DeviceOffline({ title = "Device unavailable" }: DeviceOfflineProps) {
  return (
    <div className="container p-6">
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-24 ">
            <CircleOff className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">{title}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

