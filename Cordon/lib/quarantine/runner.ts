import { DockerQuarantineRunner } from "./adapters/docker";
import type { ExecutionPlan, QuarantineResult, QuarantineRunner } from "./types";

export class LocalQuarantineRunner implements QuarantineRunner {
  constructor(private readonly adapter: QuarantineRunner = new DockerQuarantineRunner()) {}

  run(plan: ExecutionPlan): Promise<QuarantineResult> {
    return this.adapter.run(plan);
  }
}
