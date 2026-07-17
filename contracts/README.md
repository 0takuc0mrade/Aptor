# Compact contracts

This directory contains Aptor's Compact source packages and generated-artifact
boundaries.

`aptor-credential/` implements Aptor's authenticated private-duration proof. An
accepted issuer signs a domain-separated credential containing a holder
commitment and duration. `proveCredentialDuration` verifies the signature,
holder secret, and public minimum before changing public state.

## Verified local toolchain

- Compact devtools: `0.5.1`
- Compact compiler: `0.31.1`
- Compact language: `0.23.0`
- Compact runtime: `0.16.0`
- Docker: `29.1.3`
- Docker Compose: `2.40.3`

The current official Midnight compatibility matrix lists compiler `0.31.1`,
Midnight.js `4.1.1`, Wallet SDK `1.2.0`, DApp Connector API `4.0.1`, and proof
server `8.1.0` for Preview and Preprod. The local integration package pins its
own compatible node, indexer, wallet, and proof-server dependencies.

Generated contract code, keys, and ZKIR content are ignored because they can be
reproduced by the compiler and may include large cryptographic artifacts.

See [`docs/CONTRACT_MILESTONE_3.md`](../docs/CONTRACT_MILESTONE_3.md).
