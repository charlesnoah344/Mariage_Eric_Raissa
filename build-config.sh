#!/bin/sh
# Écrit config.js à partir des variables d'environnement Netlify.
# Échoue volontairement si une variable manque : mieux vaut un déploiement en erreur
# qu'un site en ligne où plus personne ne peut répondre.
set -e

if [ -z "$SCRIPT_URL" ] || [ -z "$RSVP_TOKEN" ]; then
  echo "ERREUR : définissez SCRIPT_URL et RSVP_TOKEN dans Netlify > Site configuration > Environment variables."
  exit 1
fi

cat > config.js <<CONFIG
const SCRIPT_URL = '$SCRIPT_URL';
const RSVP_TOKEN = '$RSVP_TOKEN';
CONFIG

echo "config.js généré pour $SCRIPT_URL"
