#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  print 'Node.js est nécessaire. Installez la version LTS depuis https://nodejs.org puis relancez ce fichier.'
  read -k 1
  exit 1
fi
node server.mjs --open
