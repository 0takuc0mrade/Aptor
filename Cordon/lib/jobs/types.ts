import type { ScanResult } from "@/lib/scanner/types";

export type ScanRequest = {
  repositoryUrl: string;
};

export interface ScanJobExecutor {
  enqueue(request: ScanRequest): Promise<ScanResult>;
}
