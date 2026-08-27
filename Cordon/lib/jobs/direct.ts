import { withPublicRepository } from "@/lib/github/client";
import { scanRepository } from "@/lib/scanner";

import type { ScanJobExecutor } from "./types";

export class DirectScanJobExecutor implements ScanJobExecutor {
  async enqueue({ repositoryUrl }: { repositoryUrl: string }) {
    return withPublicRepository(repositoryUrl, (root, metadata) => scanRepository(root, metadata));
  }
}

export const scanJobs: ScanJobExecutor = new DirectScanJobExecutor();
