import assert from "node:assert/strict";
import test from "node:test";

import {
  AptorError,
  createProfessionalVault,
  decryptVault,
  encryptVault,
} from "../src/index.js";

const password = "Aptor vault unit password 2026!";

test("vault encryption round-trips without exposing plaintext secrets", async () => {
  const vault = createProfessionalVault();
  const encrypted = await encryptVault(vault, password);
  const serialized = JSON.stringify(encrypted);

  assert.equal(serialized.includes("holderSecret"), false);
  assert.equal(serialized.includes(vault.holderSecret), false);
  assert.deepEqual(await decryptVault(encrypted, password), vault);
});

test("vault decryption rejects wrong passwords and altered ciphertext", async () => {
  const encrypted = await encryptVault(createProfessionalVault(), password);

  await assert.rejects(
    decryptVault(encrypted, "Incorrect vault password 2026!"),
    (error: unknown) =>
      error instanceof AptorError && error.code === "INVALID_VAULT_PASSWORD",
  );

  const altered = {
    ...encrypted,
    ciphertext: `${encrypted.ciphertext.startsWith("A") ? "B" : "A"}${encrypted.ciphertext.slice(1)}`,
  };
  await assert.rejects(
    decryptVault(altered, password),
    (error: unknown) =>
      error instanceof AptorError && error.code === "INVALID_VAULT_PASSWORD",
  );
});
