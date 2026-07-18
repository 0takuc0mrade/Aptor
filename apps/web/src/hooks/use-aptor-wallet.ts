"use client";

import {
  AptorError,
  connectWallet,
  discoverWallets,
  type ConnectedWallet,
  type DiscoveredWallet,
} from "@aptor/browser";
import { useCallback, useEffect, useRef, useState } from "react";

import { APTOR_NETWORK } from "@/lib/midnight-config";

export type WalletUiStatus =
  | "checking"
  | "not-detected"
  | "detected"
  | "permission-requested"
  | "connected"
  | "wrong-network"
  | "rejected"
  | "connection-lost";

export type WalletSummary = Readonly<{
  id: string;
  name: string;
  rdns: string;
  apiVersion: string;
}>;

export function useAptorWallet() {
  const walletsRef = useRef<DiscoveredWallet[]>([]);
  const connectedRef = useRef<ConnectedWallet | null>(null);
  const [wallets, setWallets] = useState<WalletSummary[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState("");
  const [status, setStatus] = useState<WalletUiStatus>("checking");
  const [address, setAddress] = useState("");
  const [dustBalance, setDustBalance] = useState<bigint | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    const discovered = discoverWallets();
    walletsRef.current = discovered;
    setWallets(
      discovered.map(({ id, name, rdns, apiVersion }) => ({
        id,
        name,
        rdns,
        apiVersion,
      })),
    );
    setSelectedWalletId((current) => current || discovered[0]?.id || "");
    setStatus(discovered.length === 0 ? "not-detected" : "detected");
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  useEffect(() => {
    if (status !== "connected") return;
    const interval = window.setInterval(() => {
      const connected = connectedRef.current;
      if (connected === null) return;
      void connected.api.getConnectionStatus().then((connection) => {
        if (connection.status !== "connected") {
          connectedRef.current = null;
          setStatus("connection-lost");
          setAddress("");
          setDustBalance(null);
        } else if (connection.networkId !== APTOR_NETWORK) {
          setStatus("wrong-network");
        }
      });
    }, 8_000);
    return () => window.clearInterval(interval);
  }, [status]);

  const connect = useCallback(async () => {
    const wallet = walletsRef.current.find(
      (candidate) => candidate.id === selectedWalletId,
    );
    if (wallet === undefined) {
      setStatus("not-detected");
      throw new AptorError(
        "WALLET_NOT_DETECTED",
        "Install or enable a compatible Midnight wallet, then refresh detection.",
      );
    }
    setError("");
    setStatus("permission-requested");
    try {
      const connected = await connectWallet(wallet, APTOR_NETWORK);
      connectedRef.current = connected;
      setAddress(connected.address);
      setDustBalance(connected.dustBalance);
      setStatus("connected");
      return connected;
    } catch (connectionError) {
      const aptorError =
        connectionError instanceof AptorError
          ? connectionError
          : new AptorError(
              "WALLET_CONNECTION_REJECTED",
              "The wallet connection did not complete.",
              { cause: connectionError },
            );
      setStatus(
        aptorError.code === "WRONG_NETWORK" ? "wrong-network" : "rejected",
      );
      setError(aptorError.message);
      throw aptorError;
    }
  }, [selectedWalletId]);

  const getConnected = useCallback((): ConnectedWallet => {
    const connected = connectedRef.current;
    if (connected === null) {
      throw new AptorError(
        "WALLET_CONNECTION_LOST",
        "Connect a Midnight wallet before continuing.",
      );
    }
    return connected;
  }, []);

  const disconnect = useCallback(() => {
    connectedRef.current = null;
    setAddress("");
    setDustBalance(null);
    setError("");
    setStatus(walletsRef.current.length > 0 ? "detected" : "not-detected");
  }, []);

  return {
    address,
    connect,
    disconnect,
    dustBalance,
    error,
    getConnected,
    network: APTOR_NETWORK,
    refresh,
    selectedWalletId,
    setSelectedWalletId,
    status,
    wallets,
  };
}

export type AptorWalletController = ReturnType<typeof useAptorWallet>;
