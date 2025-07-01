export type Test = {
    id: string
    name: string
    type: "3SAT" | "LDPC"
    status: "queued" | "running" | "completed" | "failed"
    startTime: string
    duration?: string
    results?: TestResult[]
    log?: string
  }
  
  export type TestResult = {
    step: string
    value: number | string
    timestamp: string
    status: "success" | "warning" | "error"
  }