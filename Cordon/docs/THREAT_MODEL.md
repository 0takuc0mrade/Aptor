# Quarantine threat model

## Assets protected

- host files, home directory, application source, and application `.env`;
- real developer, cloud, package-registry, GitHub, wallet, and browser credentials;
- Docker socket and host namespaces;
- unrestricted outbound connectivity;
- host CPU, memory, PIDs, disk, logs, and worker availability.

## Adversary

Assume every repository and lifecycle/script body is intentionally hostile. It may consume resources, probe files, launch child processes, obscure behavior, attack the runtime, exploit a container or kernel vulnerability, poison logs, or behave differently when observation is detected.

## Current mitigations

- commit-pinned public archive ingestion with traversal/link/size checks;
- server-only plan construction and exact script allowlisting;
- a new container per run, non-root UID, no privilege/socket/host namespace/host mount;
- dropped capabilities and `no-new-privileges`;
- read-only root where compatible with the mode and bounded temporary writes;
- CPU, memory, PID, time, and output limits with forced removal;
- network disabled by default; installation allowlist refuses unverified configuration;
- fake canaries instead of real secrets;
- bounded/redacted events and no raw container IDs or host paths in frontend responses;
- plan-level duplicate-run prevention.

## Not guaranteed

Containers share the host kernel and are not a perfect security boundary. This milestone does not provide a seccomp profile tailored to Node, user namespaces, Landlock, gVisor, Kata, Firecracker, a microVM, immutable worker hosts, kernel exploit protection, durable queue semantics, cross-instance idempotency, authenticated tenant isolation, forensic-grade syscall capture, or independently audited egress infrastructure.

## Before production multi-tenancy

Move execution off the web process into durable authenticated jobs; use ephemeral hardened workers or microVMs; pin images by digest and verify supply-chain provenance; add seccomp/AppArmor/user namespaces; enforce and test egress outside the workload; separate tenant storage and encryption keys; sign plans; implement quotas/admission control/cancellation; retain tamper-evident logs; patch/recycle hosts; define artifact/data retention; add security monitoring and incident response; and perform an external sandbox review.

Kubernetes alone is not the missing security boundary and remains deferred.
