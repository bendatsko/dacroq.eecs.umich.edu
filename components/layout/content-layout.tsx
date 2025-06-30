"use client"

import React from 'react'

interface ContentLayoutProps {
  title: string;
  children: React.ReactNode;
}

export function ContentLayout({ title, children }: ContentLayoutProps) {
  return (
    <div className="h-full w-full p-6">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="grid gap-4">
        {children}
      </div>
    </div>
  )
}

export function ContentCard({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode 
}) {
  return (
    <div className="rounded-lg border bg-card">
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="text-muted-foreground">
        {children}
      </div>
    </div>
  )
}