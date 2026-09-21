/**
 * Générateur de liens d'invitation personnalisés — Raïssa & Eric.
 *
 * Ce fichier s'ajoute À CÔTÉ de apps-script.gs, dans le même projet Apps Script :
 * 1. Ouvrez le Google Sheet > Extensions > Apps Script.
 * 2. Bouton "+" à côté de "Fichiers" > Script > nommez-le "invites".
 * 3. Collez tout le contenu de ce fichier, puis enregistrez.
 * 4. Rechargez le Google Sheet : un menu "Invitations" apparaît à côté de "Aide".
 *
 * Utilisation :
 *   Invitations > Préparer la feuille « Invités »   (une seule fois)
 *   puis vous saisissez les invités (une ligne = une invitation, pas une personne)
 *   Invitations > Générer les liens manquants       (à relancer après chaque ajout)
 *
 * Un lien déjà généré n'est JAMAIS modifié : vous pouvez relancer sans risque.
 */

const SITE_URL = 'https://invitation-mariage-raissa-eric.netlify.app/';
const FEUILLE_INVITES = 'Invités';

const COLONNES = [
  'Prénom', 'Nom', 'Téléphone', 'Places', 'Token', 'Lien',
  'Statut', 'Places confirmées', 'Répondu le', 'Entré à', 'Entrées comptées', 'Message'
];

const COL_PRENOM = 1, COL_NOM = 2, COL_PLACES = 4, COL_TOKEN = 5, COL_LIEN = 6;

// Alphabet sans caractères ambigus (ni 0/O, ni 1/l/I) : un token reste lisible et dictable.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
const LONGUEUR_TOKEN = 10;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Invitations')
    .addItem('Préparer la feuille « Invités »', 'preparerFeuilleInvites')
    .addItem('Générer les liens manquants', 'genererLiensManquants')
    .addToUi();
}

function preparerFeuilleInvites() {
  const classeur = SpreadsheetApp.getActiveSpreadsheet();
  let feuille = classeur.getSheetByName(FEUILLE_INVITES);

  if (!feuille) {
    // En dernière position, et on rend la 1ère feuille active : apps-script.gs (RSVP)
    // écrit dans la feuille active, il ne doit jamais atterrir dans « Invités ».
    feuille = classeur.insertSheet(FEUILLE_INVITES, classeur.getNumSheets());
    classeur.setActiveSheet(classeur.getSheets()[0]);
  }

  const entetes = feuille.getRange(1, 1, 1, COLONNES.length);
  entetes.setValues([COLONNES])
    .setFontWeight('bold')
    .setBackground('#5e1622')
    .setFontColor('#e2c489');
  feuille.setFrozenRows(1);
  feuille.setColumnWidth(COL_LIEN, 320);
  feuille.getRange(2, COL_PLACES, feuille.getMaxRows() - 1, 1).setHorizontalAlignment('center');

  SpreadsheetApp.getUi().alert(
    'Feuille « ' + FEUILLE_INVITES + ' » prête.\n\n' +
    'Saisissez une ligne par invitation : Prénom, Nom, Téléphone, Places.\n' +
    'Les colonnes Token et Lien se remplissent toutes seules.\n' +
    'Les quatre dernières colonnes seront remplies le jour J : ne les modifiez pas à la main.'
  );
}

function genererLiensManquants() {
  const ui = SpreadsheetApp.getUi();
  const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(FEUILLE_INVITES);

  if (!feuille) {
    ui.alert('La feuille « ' + FEUILLE_INVITES + ' » n\'existe pas encore.\n\n' +
             'Lancez d\'abord : Invitations > Préparer la feuille « Invités ».');
    return;
  }

  const nbLignes = feuille.getLastRow() - 1;
  if (nbLignes < 1) {
    ui.alert('Aucun invité saisi pour le moment.');
    return;
  }

  const donnees = feuille.getRange(2, 1, nbLignes, COLONNES.length).getValues();
  const tokensUtilises = {};
  donnees.forEach(ligne => {
    const token = String(ligne[COL_TOKEN - 1]).trim();
    if (token) tokensUtilises[token] = true;
  });

  const tokens = [], liens = [];
  let generes = 0, ignorees = 0;

  donnees.forEach(ligne => {
    const identifie = String(ligne[COL_PRENOM - 1]).trim() || String(ligne[COL_NOM - 1]).trim();
    let token = String(ligne[COL_TOKEN - 1]).trim();

    if (token) {
      // Lien déjà généré : on le laisse intact, on répare seulement une URL manquante.
      tokens.push([token]);
      liens.push([String(ligne[COL_LIEN - 1]).trim() || lienPour(token, ligne[COL_PRENOM - 1])]);
      return;
    }

    if (!identifie) {
      // Ligne vide ou incomplète : on ne crée pas d'invitation fantôme.
      tokens.push(['']);
      liens.push(['']);
      if (String(ligne[COL_LIEN - 1]).trim() === '' && ligne.some(v => String(v).trim() !== '')) ignorees++;
      return;
    }

    token = nouveauToken(tokensUtilises);
    tokensUtilises[token] = true;
    tokens.push([token]);
    liens.push([lienPour(token, ligne[COL_PRENOM - 1])]);
    generes++;
  });

  feuille.getRange(2, COL_TOKEN, nbLignes, 1).setValues(tokens);
  feuille.getRange(2, COL_LIEN, nbLignes, 1).setValues(liens);

  let message = generes === 0
    ? 'Aucun nouveau lien à générer : tous les invités saisis en ont déjà un.'
    : generes + (generes > 1 ? ' nouveaux liens générés.' : ' nouveau lien généré.');

  if (ignorees > 0) {
    message += '\n\n' + ignorees + (ignorees > 1 ? ' lignes ont été ignorées' : ' ligne a été ignorée') +
               ' car ni le prénom ni le nom n\'était renseigné.';
  }

  ui.alert(message);
}

function lienPour(token, prenom) {
  // Le prénom voyage dans le lien pour que l'invité voie « Bonjour X » immédiatement,
  // sans attendre la réponse du serveur. Il reste purement décoratif : c'est le token
  // qui identifie l'invitation et lui seul permet de répondre.
  const p = String(prenom || '').trim();
  return SITE_URL + '?i=' + token + (p ? '&n=' + encodeURIComponent(p) : '');
}

function nouveauToken(dejaUtilises) {
  for (let essai = 0; essai < 50; essai++) {
    let token = '';
    for (let i = 0; i < LONGUEUR_TOKEN; i++) {
      token += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
    }
    if (!dejaUtilises[token]) return token;
  }
  throw new Error('Impossible de générer un token unique — relancez l\'opération.');
}
