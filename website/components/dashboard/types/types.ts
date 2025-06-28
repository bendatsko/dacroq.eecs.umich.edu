// components/content/types.ts
export type TestType = '3sat' | 'ldpc';

export interface TestParameters {
  // Common parameters
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  
  // Test-specific parameters
  config: Record<string, any>;
}


