#!/usr/bin/env bash
# Installs Litestream (the free tool that copies the database to cloud storage as it changes) into ./bin.
# Pinned version, checked against a known checksum, so a build never runs a surprise binary.
set -euo pipefail
VERSION=v0.3.13
SHA256=eb75a3de5cab03875cdae9f5f539e6aedadd66607003d9b1e7a9077948818ba0
URL="https://github.com/benbjohnson/litestream/releases/download/${VERSION}/litestream-${VERSION}-linux-amd64.tar.gz"

cd "$(dirname "$0")/.."
if [ -x bin/litestream ] && bin/litestream version 2>/dev/null | grep -q "$VERSION"; then exit 0; fi
mkdir -p bin
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$URL" -o "$tmp/ls.tar.gz"
echo "$SHA256  $tmp/ls.tar.gz" | sha256sum -c - >/dev/null
tar -xzf "$tmp/ls.tar.gz" -C "$tmp" litestream
mv "$tmp/litestream" bin/litestream
chmod +x bin/litestream
echo "Litestream $VERSION installed."
