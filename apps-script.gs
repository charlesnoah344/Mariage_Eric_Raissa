/**
 * Backend RSVP gratuit pour le site de mariage — Google Sheets + Apps Script.
 *
 * INSTALLATION (5 minutes) :
 * 1. Créez un Google Sheet (ex: "RSVP Mariage Raïssa & Eric").
 *    Sur la 1ère ligne, mettez les en-têtes : Date | Nom | Réponse | Nombre | Message
 * 2. Dans ce Sheet : Extensions > Apps Script.
 * 3. Supprimez le code par défaut, collez tout le contenu de ce fichier.
 * 4. Remplacez TOKEN ci-dessous par la même valeur que RSVP_TOKEN dans config.js
 *    (protège contre le spam si quelqu'un retrouve l'URL du script).
 * 5. Cliquez sur "Déployer" > "Nouveau déploiement" > type "Application Web".
 *    - Exécuter en tant que : Moi
 *    - Qui a accès : Tout le monde
 * 6. Autorisez l'accès, copiez l'URL qui se termine par /exec.
 *    Collez cette URL dans config.js (voir config.example.js à la racine du site).
 *
 * Pour relire les réponses : ouvrez simplement le Google Sheet, il se remplit en direct.
 * Pour un total en direct (ex: "247 / 300 invités confirmés"), ajoutez une formule
 * dans une cellule à part, ex: =SOMME(D2:D1000) (colonne "Nombre").
 */

const TOKEN = 'b7dabfc3a8ec4122a10699e52fb740e7'; // doit correspondre à RSVP_TOKEN dans config.js

function doPost(e) {
  const p = e.parameter;

  if (p.token !== TOKEN) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: 'invalid token' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([
    new Date(),
    p.nom || '',
    p.reponse || '',
    Number(p.nombre) || 1,
    p.message || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Pratique pour vérifier que le déploiement fonctionne (ouvrez l'URL /exec dans un navigateur)
function doGet(e) {
  return ContentService
    .createTextOutput('Le backend RSVP fonctionne ✔')
    .setMimeType(ContentService.MimeType.TEXT);
}
