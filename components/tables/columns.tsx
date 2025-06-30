"use client"

import { ColumnDef } from "@tanstack/react-table"
import { TestResult } from "@/types/test"

export const testResultColumns: ColumnDef<TestResult>[] = [
  {
    accessorKey: "step",
    header: "Step",
  },
  {
    accessorKey: "value",
    header: "Value",
  },
  {
    accessorKey: "timestamp",
    header: "Timestamp",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <span className={
          status === "success" ? "text-green-500" :
          status === "warning" ? "text-yellow-500" :
          "text-red-500"
        }>
          {status}
        </span>
      )
    }
  },
]