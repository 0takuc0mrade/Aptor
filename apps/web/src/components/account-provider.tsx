"use client";

import {
  AptorAccountSession,
  createAptorAccount,
  hashCapability,
  type AptorAccountVaultV1,
} from "@aptor/browser";
import type { AptorNotificationV1 } from "@aptor/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { listNotifications, registerProfile } from "@/lib/delivery-client";

type AccountContextValue = Readonly<{
  busy: boolean;
  create: (
    password: string,
    handle: string,
    displayName: string,
  ) => Promise<void>;
  error: string;
  exists: boolean;
  exportBackup: () => Promise<unknown>;
  importBackup: (value: unknown, password: string) => Promise<void>;
  lock: () => void;
  notifications: AptorNotificationV1[];
  refreshNotifications: () => Promise<void>;
  save: (value: AptorAccountVaultV1) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  value: AptorAccountVaultV1 | null;
}>;

const AccountContext = createContext<AccountContextValue | null>(null);

export function AptorAccountProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session] = useState(() => new AptorAccountSession());
  const [exists, setExists] = useState(false);
  const [value, setValue] = useState<AptorAccountVaultV1 | null>(null);
  const [notifications, setNotifications] = useState<AptorNotificationV1[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void session.exists().then(setExists);
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      session.lock();
    };
  }, [session]);

  const run = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      setBusy(true);
      setError("");
      try {
        return await operation();
      } catch (operationError) {
        setError(
          operationError instanceof Error
            ? operationError.message
            : "The Aptor account operation could not be completed.",
        );
        throw operationError;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const refreshNotifications = useCallback(async () => {
    if (value === null) {
      setNotifications([]);
      return;
    }
    setNotifications(await listNotifications(value.privateProfile.accessToken));
  }, [value]);

  useEffect(() => {
    if (value === null) return;
    const timeout = window.setTimeout(() => void refreshNotifications(), 0);
    const interval = window.setInterval(
      () => void refreshNotifications(),
      15_000,
    );
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [refreshNotifications, value]);

  const context = useMemo<AccountContextValue>(
    () => ({
      busy,
      error,
      exists,
      notifications,
      value,
      async create(password, handle, displayName) {
        await run(async () => {
          const account = await createAptorAccount(handle, displayName);
          await registerProfile(
            account.profile,
            await hashCapability(account.privateProfile.accessToken),
          );
          await session.create(password, account);
          setExists(true);
          setValue(session.state);
        });
      },
      async unlock(password) {
        await run(async () => {
          await session.unlock(password);
          setValue(session.state);
        });
      },
      async save(next) {
        await run(async () => {
          await session.save(next);
          setValue(session.state);
        });
      },
      lock() {
        session.lock();
        setValue(null);
        setNotifications([]);
        setError("");
      },
      exportBackup: () => run(() => session.exportBackup()),
      async importBackup(backup, password) {
        await run(async () => {
          await session.importBackup(backup, password);
          setExists(true);
          setValue(session.state);
        });
      },
      refreshNotifications,
    }),
    [
      busy,
      error,
      exists,
      notifications,
      refreshNotifications,
      run,
      session,
      value,
    ],
  );

  return (
    <AccountContext.Provider value={context}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAptorAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (value === null) throw new Error("Aptor account context is unavailable.");
  return value;
}
