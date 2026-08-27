"use client";

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type EIP1193Provider,
  type PublicClient,
  type WalletClient,
} from "viem";
import { useCallback, useEffect, useRef, useState } from "react";

import { HSK_CHAIN, HSK_CHAIN_ID, HSK_RPC_URL } from "@/lib/hsk-config";

export type HskWalletStatus =
  | "checking"
  | "not-detected"
  | "disconnected"
  | "connecting"
  | "wrong-network"
  | "ready"
  | "rejected";

export type ConnectedHskWallet = Readonly<{
  address: Address;
  publicClient: PublicClient;
  walletClient: WalletClient;
}>;

export function useHskWallet() {
  const providerRef = useRef<EIP1193Provider | null>(null);
  const connectedRef = useRef<ConnectedHskWallet | null>(null);
  const [status, setStatus] = useState<HskWalletStatus>("checking");
  const [address, setAddress] = useState<Address | "">("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const provider = window.ethereum;
    providerRef.current = provider ?? null;
    connectedRef.current = null;
    if (!provider) {
      setAddress("");
      setStatus("not-detected");
      return;
    }
    try {
      const [accounts, chainId] = await Promise.all([
        provider.request({ method: "eth_accounts" }) as Promise<Address[]>,
        provider.request({ method: "eth_chainId" }) as Promise<string>,
      ]);
      setAddress(accounts[0] ?? "");
      setStatus(
        Number(BigInt(chainId)) !== HSK_CHAIN_ID
          ? "wrong-network"
          : "disconnected",
      );
    } catch {
      setStatus("rejected");
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const connect = useCallback(async (): Promise<ConnectedHskWallet> => {
    const provider = providerRef.current ?? window.ethereum;
    if (!provider) throw new Error("No injected EVM wallet was detected.");
    setError("");
    setStatus("connecting");
    try {
      let chainId = (await provider.request({
        method: "eth_chainId",
      })) as string;
      if (Number(BigInt(chainId)) !== HSK_CHAIN_ID) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${HSK_CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError) {
          const code = (switchError as { code?: number }).code;
          if (code !== 4902) throw switchError;
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${HSK_CHAIN_ID.toString(16)}`,
                chainName: HSK_CHAIN.name,
                nativeCurrency: HSK_CHAIN.nativeCurrency,
                rpcUrls: [HSK_RPC_URL],
              },
            ],
          });
        }
        chainId = (await provider.request({ method: "eth_chainId" })) as string;
      }
      if (Number(BigInt(chainId)) !== HSK_CHAIN_ID) {
        setStatus("wrong-network");
        throw new Error(`Switch the wallet to chain ${HSK_CHAIN_ID}.`);
      }
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as Address[];
      const account = accounts[0];
      if (!account) throw new Error("The wallet did not return an account.");
      const publicClient = createPublicClient({
        chain: HSK_CHAIN,
        transport: http(),
      });
      const walletClient = createWalletClient({
        account,
        chain: HSK_CHAIN,
        transport: custom(provider),
      });
      const connected = { address: account, publicClient, walletClient };
      connectedRef.current = connected;
      setAddress(account);
      setStatus("ready");
      return connected;
    } catch (cause) {
      if ((cause as Error).message.includes("Switch"))
        setStatus("wrong-network");
      else setStatus("rejected");
      setError(
        cause instanceof Error ? cause.message : "Wallet connection failed.",
      );
      throw cause;
    }
  }, []);

  const getConnected = useCallback((): ConnectedHskWallet => {
    if (!connectedRef.current) {
      throw new Error("Connect an HSK wallet before continuing.");
    }
    return connectedRef.current;
  }, []);

  const disconnect = useCallback(() => {
    connectedRef.current = null;
    setError("");
    setStatus(window.ethereum ? "disconnected" : "not-detected");
  }, []);

  return {
    address,
    chainId: HSK_CHAIN_ID,
    connect,
    disconnect,
    error,
    getConnected,
    refresh,
    status,
  };
}

export type HskWalletController = ReturnType<typeof useHskWallet>;
