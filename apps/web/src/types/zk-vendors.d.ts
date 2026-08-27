declare module "circomlibjs" {
  type Poseidon = ((inputs: readonly bigint[]) => unknown) & {
    F: { toObject(value: unknown): bigint };
  };
  export function buildPoseidon(): Promise<Poseidon>;
}

declare module "snarkjs" {
  export const groth16: {
    fullProve(
      input: Record<string, string>,
      wasm: string,
      zkey: string,
    ): Promise<{
      proof: {
        pi_a: [string, string, string];
        pi_b: [[string, string], [string, string], [string, string]];
        pi_c: [string, string, string];
      };
      publicSignals: string[];
    }>;
  };
}
