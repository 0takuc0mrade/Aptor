"use client";

import {
  VaultSession,
  type AptorVaultKind,
  type IssuerVaultV1,
  type ProfessionalVaultV1,
} from "@aptor/browser";
import { useCallback, useEffect, useState } from "react";

type VaultFor<K extends AptorVaultKind> = K extends "professional"
  ? ProfessionalVaultV1
  : IssuerVaultV1;

export function useVaultSession<K extends AptorVaultKind>(kind: K) {
  const [session] = useState(() => new VaultSession(kind));
  const [exists, setExists] = useState(false);
  const [value, setValue] = useState<VaultFor<K> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const inspect = useCallback(async () => {
    setExists(await session.exists());
  }, [session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void inspect(), 0);
    return () => {
      window.clearTimeout(timeout);
      session.lock();
    };
  }, [inspect, session]);

  const run = useCallback(async <T>(operation: () => Promise<T>) => {
    setBusy(true);
    setError("");
    try {
      return await operation();
    } catch (operationError) {
      setError(
        operationError instanceof Error
          ? operationError.message
          : "The vault operation could not be completed.",
      );
      throw operationError;
    } finally {
      setBusy(false);
    }
  }, []);

  const create = useCallback(
    async (password: string, initial: VaultFor<K>) =>
      run(async () => {
        await session.create(password, initial);
        setExists(true);
        setValue(session.state);
      }),
    [run, session],
  );

  const unlock = useCallback(
    async (password: string) =>
      run(async () => {
        const unlocked = await session.unlock(password);
        setValue(unlocked);
        return unlocked;
      }),
    [run, session],
  );

  const save = useCallback(
    async (next: VaultFor<K>) =>
      run(async () => {
        await session.save(next);
        setValue(session.state);
      }),
    [run, session],
  );

  const lock = useCallback(() => {
    session.lock();
    setValue(null);
    setError("");
  }, [session]);

  const deleteLocal = useCallback(
    async () =>
      run(async () => {
        await session.deleteLocal();
        setValue(null);
        setExists(false);
      }),
    [run, session],
  );

  const exportBackup = useCallback(
    () => run(() => session.exportBackup()),
    [run, session],
  );

  const importBackup = useCallback(
    async (backup: unknown, password: string) =>
      run(async () => {
        const restored = await session.importBackup(backup, password);
        setValue(restored);
        setExists(true);
        return restored;
      }),
    [run, session],
  );

  return {
    busy,
    create,
    deleteLocal,
    error,
    exists,
    exportBackup,
    importBackup,
    inspect,
    lock,
    save,
    unlock,
    value,
  };
}

export type ProfessionalVaultController = ReturnType<
  typeof useVaultSession<"professional">
>;
export type IssuerVaultController = ReturnType<
  typeof useVaultSession<"issuer">
>;
