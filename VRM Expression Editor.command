#!/bin/sh
cd "$(dirname "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found. Install Node.js LTS first."
  echo "https://nodejs.org"
  exit 1
fi

npm start
