#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
# Manuelt tvinge nedlasting av chrome for å ha bedre kontroll på prosessen
node node_modules/puppeteer/install.mjs
