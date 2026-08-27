FROM node:22.17.1-bookworm-slim

ARG CORDON_RUNTIME_VERSION=0.1.0
LABEL io.cordon.runtime.version="${CORDON_RUNTIME_VERSION}"

RUN corepack enable \
    && mkdir -p /workspace/repository /cordon /home/cordon \
    && chown -R 1000:1000 /workspace /cordon /home/cordon

COPY --chown=1000:1000 docker/entrypoint/cordon-entrypoint.sh /usr/local/bin/cordon-entrypoint
RUN chmod 0555 /usr/local/bin/cordon-entrypoint

USER 1000:1000
WORKDIR /workspace/repository
ENTRYPOINT ["/usr/local/bin/cordon-entrypoint"]
