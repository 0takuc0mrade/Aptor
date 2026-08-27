# Security model

## Assumptions

Every submitted repository, archive header, filename, file body, package manifest, URL, and scan result field is untrusted. A public repository can still be malicious. GitHub is a transport source, not a trust authority.

## Controls

- Only HTTPS `github.com` repository-root URLs are accepted.
- Credentials, custom ports, extra path segments, and non-GitHub hosts are rejected.
- GitHub API and archive URLs are constructed from validated owner/name values.
- Downloads have timeouts plus compressed-size and streaming-body limits.
- Gzip expansion has an independent byte ceiling.
- TAR extraction rejects absolute paths, traversal, symlinks, and hard links.
- The archive’s outer repository directory is stripped before writing.
- Every write and every subsequent read is checked against the canonical temporary root.
- File count, entry size, source-file size, expanded bytes, and total scanned bytes are bounded.
- Binary files and generated/dependency directories are skipped.
- Temporary content is deleted in a `finally` block.
- Repository code is treated as text during static inspection. Execution requires a separate reviewed plan and quarantine worker.

## Explicit non-actions

Cordon’s scanner never runs `npm install`, package-manager hooks, repository scripts, imported modules, decoded payloads, URLs, or commands found in source. The quarantine supports only dependency installation, one selected existing package script, or a fixed Cordon probe. It does not accept arbitrary commands or repository Dockerfiles.

## Residual risks

- Decompression and archive parsing still process attacker-controlled bytes in the server process.
- Regex rules are intentionally incomplete and can produce false positives and false negatives.
- The direct job executor shares the web server’s resource and timeout envelope.
- The memory fallback is not durable or suitable for multi-instance deployment.
- The report cannot establish author intent or guarantee safety.

The Docker quarantine adds a new risk: hostile code is intentionally executed. It uses a fresh non-root container, no host mounts, no Docker socket, no host namespaces, dropped capabilities, `no-new-privileges`, bounded resources/output/time, fake canaries, and no network by default. These controls reduce exposure but do not make containers a perfect boundary. See `docs/THREAT_MODEL.md` before enabling execution outside local single-user development.
