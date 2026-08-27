#!/bin/sh
set -eu
umask 077

if [ "$#" -eq 0 ]; then
  echo "Cordon runtime received no validated operation." >&2
  exit 64
fi

exec "$@"
