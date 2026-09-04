# Aptor HSK mainnet deployment evidence

## Verdict

**Verified on 2026-09-04:** Aptor's three HSK contracts are deployed on
HashKey Chain mainnet. HashKey's official network documentation identifies
chain ID `177` (`0xb1`) and RPC `https://mainnet.hsk.xyz` as mainnet. Live
queries to that RPC returned successful contract-creation receipts and
non-empty runtime bytecode for all three addresses below.

- [HashKey official network information](https://docs.hskchain.net/docs/Build-on-HashKey-Chain/network-info)
- [Run the repository's live verifier](../scripts/verify-hsk-mainnet-deployment.sh)

## Public deployment record

All three creations finalized in block
[`26744614`](https://hsk.blockscout.com/block/26744614) at
`2026-08-27T13:12:43Z`. The block hash is
`0x14eee815ab0dc318cef10fcaed1c95bc3d24dbb778381dfe1a17e6f3aeaf307b`.

| Contract            | Mainnet address                                                                                                               | Creation transaction                                                                                                                                                     | Receipt         | Runtime code |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ------------ |
| Groth16 verifier    | [`0xb4aFc36F8f8b99Da2175548cB2780476a544029b`](https://hsk.blockscout.com/address/0xb4aFc36F8f8b99Da2175548cB2780476a544029b) | [`0x4743f936c2d89e613b8ff6100ff85a50c0a9cc2a380b928b66bc708c0bf6399e`](https://hsk.blockscout.com/tx/0x4743f936c2d89e613b8ff6100ff85a50c0a9cc2a380b928b66bc708c0bf6399e) | Success (`0x1`) | 1,909 bytes  |
| Credential registry | [`0x0E4100F542106e0b60c918E01cE7f75dF0bb79e6`](https://hsk.blockscout.com/address/0x0E4100F542106e0b60c918E01cE7f75dF0bb79e6) | [`0xf945fb241f16beb1ab126772e5eeb74a417093379f80f4e4219eb744b2481889`](https://hsk.blockscout.com/tx/0xf945fb241f16beb1ab126772e5eeb74a417093379f80f4e4219eb744b2481889) | Success (`0x1`) | 1,325 bytes  |
| Proof requests      | [`0x296F105eFA96eD3e672983bda9a2627Ba39a44C0`](https://hsk.blockscout.com/address/0x296F105eFA96eD3e672983bda9a2627Ba39a44C0) | [`0x58c0c0f666f9720137c8f74381c45593f728873e70a740915f3758f2831133c3`](https://hsk.blockscout.com/tx/0x58c0c0f666f9720137c8f74381c45593f728873e70a740915f3758f2831133c3) | Success (`0x1`) | 2,328 bytes  |

The deployment account for every receipt is
[`0x4d313DA68C5870dEf4c6e2989CBd178Be630163A`](https://hsk.blockscout.com/address/0x4d313DA68C5870dEf4c6e2989CBd178Be630163A).

## Independent wiring checks

Read-only contract calls through the public mainnet RPC returned:

| Query                                     | Returned value                               |
| ----------------------------------------- | -------------------------------------------- |
| `AptorCredentialRegistry.owner()`         | `0x4d313DA68C5870dEf4c6e2989CBd178Be630163A` |
| `AptorProofRequests.proofVerifier()`      | `0xb4aFc36F8f8b99Da2175548cB2780476a544029b` |
| `AptorProofRequests.credentialRegistry()` | `0x0E4100F542106e0b60c918E01cE7f75dF0bb79e6` |

These results show that the deployed request contract is wired to the deployed
Groth16 verifier and credential registry, and that the registry has the
expected administrator.

## Repository artifact match

The `input` of each public creation transaction was also compared byte for byte
with the corresponding Foundry creation bytecode built from this repository.
The registry comparison included its ABI-encoded administrator constructor
argument; the request-contract comparison included its verifier and registry
constructor arguments. All three comparisons were exact matches.

## Reproduce the verification

From the repository root, run:

```bash
npm run hsk:mainnet:verify
```

The script uses only public JSON-RPC reads. It requires `curl` and `jq`, uses no
wallet, sends no transaction, and reads no private key. It fails if the endpoint
is not chain `177`, any creation receipt is missing or unsuccessful, a receipt
does not create the expected contract in block `26744614`, runtime bytecode is
missing, or the contracts are not wired as recorded above.

## Scope of this evidence

This evidence proves deployment and live contract code on HSK mainnet. It does
not claim that the explorer's separate source-verification badge is complete or
that a full issuer/holder/verifier lifecycle has been completed on mainnet.
Those are separate checks from contract deployment.

The same addresses also exist on HSK testnet because the same deployment account
created the contracts at the same nonce on both EVM chains. The network identity
and mainnet-specific transaction hashes above distinguish this deployment:
mainnet is chain `177`; testnet is chain `133`.
