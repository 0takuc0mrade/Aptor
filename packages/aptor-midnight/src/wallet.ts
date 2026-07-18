import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
  type CoinPublicKey,
  type EncPublicKey,
  type FinalizedTransaction,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import type {
  MidnightProvider,
  UnboundTransaction,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils";
import {
  type FacadeState,
  type UnshieldedKeystore,
  type WalletFacade,
} from "@midnight-ntwrk/wallet-sdk";
import {
  FluentWalletBuilder,
  type DustWalletOptions,
} from "@midnight-ntwrk/testkit-js";
import * as Rx from "rxjs";
import { WebSocket } from "ws";
import type { EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const LOCAL_GENESIS_MINT_WALLET_SEED =
  "0000000000000000000000000000000000000000000000000000000000000001";

function isStrictlyComplete(progress: unknown): boolean {
  if (!progress || typeof progress !== "object") {
    return false;
  }

  const candidate = progress as { isStrictlyComplete?: unknown };
  return (
    typeof candidate.isStrictlyComplete === "function" &&
    (candidate.isStrictlyComplete as () => boolean).call(progress)
  );
}

export class LocalWalletProvider implements MidnightProvider, WalletProvider {
  submittedTransactions = 0;
  lastSubmittedTransactionId: string | undefined;

  private constructor(
    readonly wallet: WalletFacade,
    readonly zswapSecretKeys: ZswapSecretKeys,
    readonly dustSecretKey: DustSecretKey,
    readonly unshieldedKeystore: UnshieldedKeystore,
  ) {}

  getCoinPublicKey(): CoinPublicKey {
    return this.zswapSecretKeys.coinPublicKey;
  }

  getEncryptionPublicKey(): EncPublicKey {
    return this.zswapSecretKeys.encryptionPublicKey;
  }

  async balanceTx(
    tx: UnboundTransaction,
    ttl: Date = ttlOneHour(),
  ): Promise<FinalizedTransaction> {
    const recipe = await this.wallet.balanceUnboundTransaction(
      tx,
      {
        shieldedSecretKeys: this.zswapSecretKeys,
        dustSecretKey: this.dustSecretKey,
      },
      { ttl },
    );
    const signedRecipe = await this.wallet.signRecipe(recipe, (payload) =>
      this.unshieldedKeystore.signData(payload),
    );
    return this.wallet.finalizeRecipe(signedRecipe);
  }

  async submitTx(tx: FinalizedTransaction): Promise<string> {
    const transactionId = await this.wallet.submitTransaction(tx);
    this.submittedTransactions += 1;
    this.lastSubmittedTransactionId = transactionId;
    return transactionId;
  }

  async stop(): Promise<void> {
    await this.wallet.stop();
  }

  static async build(
    environment: EnvironmentConfiguration,
  ): Promise<LocalWalletProvider> {
    const dustOptions: DustWalletOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    };
    const buildResult = await FluentWalletBuilder.forEnvironment(environment)
      .withDustOptions(dustOptions)
      .withSeed(LOCAL_GENESIS_MINT_WALLET_SEED)
      .buildWithoutStarting();

    const { wallet, seeds, keystore } = buildResult as unknown as {
      wallet: WalletFacade;
      seeds: { shielded: Uint8Array; dust: Uint8Array };
      keystore: UnshieldedKeystore;
    };
    const shieldedSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
    const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);
    await wallet.start(shieldedSecretKeys, dustSecretKey);

    const provider = new LocalWalletProvider(
      wallet,
      shieldedSecretKeys,
      dustSecretKey,
      keystore,
    );
    await provider.waitForSync();
    await provider.ensureSpendableDust();
    return provider;
  }

  private waitForSync(timeout = 300_000): Promise<FacadeState> {
    return Rx.firstValueFrom(
      this.wallet.state().pipe(
        Rx.filter(
          (state) =>
            isStrictlyComplete(state.shielded.state.progress) &&
            isStrictlyComplete(state.unshielded.progress) &&
            isStrictlyComplete(state.dust.state.progress),
        ),
        Rx.timeout({
          each: timeout,
          with: () =>
            Rx.throwError(
              () =>
                new Error(
                  `Wallet synchronization timed out after ${timeout}ms`,
                ),
            ),
        }),
      ),
    );
  }

  private async ensureSpendableDust(timeout = 300_000): Promise<void> {
    const state = await this.waitForSync(timeout);
    const unregisteredNightUtxos =
      state.unshielded.availableCoins.filter(
        (coin) => coin.meta.registeredForDustGeneration === false,
      ) ?? [];

    if (unregisteredNightUtxos.length > 0) {
      const recipe = await this.wallet.registerNightUtxosForDustGeneration(
        unregisteredNightUtxos,
        this.unshieldedKeystore.getPublicKey(),
        (payload) => this.unshieldedKeystore.signData(payload),
      );
      const finalizedTransaction = await this.wallet.finalizeRecipe(recipe);
      await this.submitTx(finalizedTransaction);
    }

    await Rx.firstValueFrom(
      this.wallet.state().pipe(
        Rx.filter((nextState) => nextState.dust.availableCoins.length >= 1),
        Rx.timeout({
          each: timeout,
          with: () =>
            Rx.throwError(
              () => new Error(`No spendable DUST coin after ${timeout}ms`),
            ),
        }),
      ),
    );
  }
}
