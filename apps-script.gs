/**
 * Backend du faire-part — Raïssa & Eric.
 * Lit et écrit dans la feuille « Invités » (voir apps-script-invites.gs pour la créer).
 *
 * INSTALLATION
 * 1. Google Sheet > Extensions > Apps Script.
 * 2. Remplacez tout le contenu du fichier "Code.gs" par ce fichier.
 * 3. API_AUTH ci-dessous doit être identique à RSVP_TOKEN dans config.js.
 * 4. Déployer > Gérer les déploiements > (crayon) > Version : "Nouvelle version" > Déployer.
 *    Exécuter en tant que : Moi — Qui a accès : Tout le monde.
 *    L'URL /exec ne change pas si vous mettez à jour le déploiement existant.
 *
 * Deux points d'entrée :
 *   GET  ?action=invitation&auth=…&i=TOKEN   → les infos de l'invité (prénom, places, réponse)
 *   POST action=rsvp&auth=…&i=TOKEN&…        → enregistre la réponse dans SA ligne
 *
 * Sans token valide, aucune réponse n'est acceptée : seuls les invités de la liste peuvent confirmer.
 */

const API_AUTH = 'b7dabfc3a8ec4122a10699e52fb740e7'; // = RSVP_TOKEN dans config.js
const API_FEUILLE = 'Invités';

// Code tape par l'hote sur la page de controle. Il n'apparait nulle part dans le site :
// changez-le par ce que vous voulez, et ne le communiquez qu'aux personnes a l'entree.
const ADMIN_CODE = 'Votre super password';

const C_PRENOM = 1, C_NOM = 2, C_PLACES = 4, C_TOKEN = 5,
      C_STATUT = 7, C_PLACES_OK = 8, C_REPONDU = 9,
      C_ENTREE = 10, C_ENTREES = 11, C_MESSAGE = 12;
const NB_COLONNES = 12;

const STATUT_PRESENT = 'Présent(e)';
const STATUT_ABSENT  = 'Absent(e)';

function doGet(e) {
  const p = (e && e.parameter) || {};

  if (p.action === 'liste') return listeInvites(p);

  if (p.action !== 'invitation') {
    return ContentService.createTextOutput('Le backend du faire-part fonctionne ✔');
  }
  if (p.auth !== API_AUTH) return json({ ok: false, message: 'auth' });

  const invite = trouverInvite(String(p.i || '').trim());
  if (!invite) return json({ ok: false, message: 'inconnu' });

  const l = invite.valeurs;
  const statut = String(l[C_STATUT - 1]).trim();

  return json({
    ok: true,
    prenom: String(l[C_PRENOM - 1]).trim(),
    nom: String(l[C_NOM - 1]).trim(),
    places: Number(l[C_PLACES - 1]) || 1,
    statut: statut,
    present: statut === STATUT_PRESENT ? 'oui' : (statut === STATUT_ABSENT ? 'non' : ''),
    placesConfirmees: Number(l[C_PLACES_OK - 1]) || 0,
    message: String(l[C_MESSAGE - 1] || '').trim()
  });
}

function doPost(e) {
  const p = (e && e.parameter) || {};

  if (p.auth !== API_AUTH) return json({ ok: false, message: 'auth' });
  if (p.action === 'scan') return scanner(p);

  const token = String(p.i || '').trim();
  if (!token) return json({ ok: false, message: 'token' });

  const verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(20000); // deux invités qui répondent en même temps ne s'écrasent pas
  } catch (err) {
    return json({ ok: false, message: 'occupe' });
  }

  try {
    const invite = trouverInvite(token);
    if (!invite) return json({ ok: false, message: 'inconnu' });

    const places = Number(invite.valeurs[C_PLACES - 1]) || 1;
    const present = String(p.reponse || '') === 'oui';
    const nombre = present ? Math.max(1, Math.min(Number(p.nombre) || 1, places)) : 0;

    const feuille = invite.feuille, ligne = invite.ligne;
    feuille.getRange(ligne, C_STATUT).setValue(present ? STATUT_PRESENT : STATUT_ABSENT);
    feuille.getRange(ligne, C_PLACES_OK).setValue(nombre);
    feuille.getRange(ligne, C_REPONDU).setValue(new Date());
    feuille.getRange(ligne, C_MESSAGE).setValue(String(p.message || '').trim());
    SpreadsheetApp.flush();

    return json({
      ok: true,
      prenom: String(invite.valeurs[C_PRENOM - 1]).trim(),
      placesConfirmees: nombre
    });
  } finally {
    verrou.releaseLock();
  }
}

/**
 * Entree du mariage : on marque l'arrivee de l'invite et on previent si son QR
 * a deja ete scanne. Reserve aux personnes qui connaissent le code d'acces.
 */
function scanner(p) {
  if (p.admin !== ADMIN_CODE) return json({ ok: false, message: 'admin' });

  const token = String(p.i || '').trim();
  if (!token) return json({ ok: false, message: 'token' });

  const verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(20000); // deux hotes qui scannent en meme temps
  } catch (err) {
    return json({ ok: false, message: 'occupe' });
  }

  try {
    const invite = trouverInvite(token);
    if (!invite) return json({ ok: false, message: 'inconnu' });

    const l = invite.valeurs;
    const statut = String(l[C_STATUT - 1]).trim();
    const dejaEntre = String(l[C_ENTREE - 1]).trim() !== '';
    const places = Number(l[C_PLACES_OK - 1]) || Number(l[C_PLACES - 1]) || 1;

    if (!dejaEntre) {
      invite.feuille.getRange(invite.ligne, C_ENTREE).setValue(new Date());
      invite.feuille.getRange(invite.ligne, C_ENTREES).setValue(places);
      SpreadsheetApp.flush();
    }

    return json({
      ok: true,
      prenom: String(l[C_PRENOM - 1]).trim(),
      nom: String(l[C_NOM - 1]).trim(),
      places: places,
      statut: statut,
      dejaEntre: dejaEntre,
      entreA: dejaEntre ? String(l[C_ENTREE - 1]) : new Date().toISOString()
    });
  } finally {
    verrou.releaseLock();
  }
}

/**
 * Liste complete pour la page de controle : elle la garde en reserve et continue
 * de fonctionner si le reseau lache a l'entree.
 */
function listeInvites(p) {
  if (p.auth !== API_AUTH) return json({ ok: false, message: 'auth' });
  if (p.admin !== ADMIN_CODE) return json({ ok: false, message: 'admin' });

  const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(API_FEUILLE);
  if (!feuille) return json({ ok: false, message: 'feuille' });

  const nbLignes = feuille.getLastRow() - 1;
  if (nbLignes < 1) return json({ ok: true, invites: [] });

  const valeurs = feuille.getRange(2, 1, nbLignes, NB_COLONNES).getValues();
  const invites = [];
  valeurs.forEach(l => {
    const token = String(l[C_TOKEN - 1]).trim();
    if (!token) return;
    invites.push({
      token: token,
      prenom: String(l[C_PRENOM - 1]).trim(),
      nom: String(l[C_NOM - 1]).trim(),
      places: Number(l[C_PLACES_OK - 1]) || Number(l[C_PLACES - 1]) || 1,
      statut: String(l[C_STATUT - 1]).trim(),
      entree: String(l[C_ENTREE - 1]).trim() !== ''
    });
  });

  return json({ ok: true, invites: invites });
}

function trouverInvite(token) {
  if (!token) return null;

  const feuille = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(API_FEUILLE);
  if (!feuille) return null;

  const nbLignes = feuille.getLastRow() - 1;
  if (nbLignes < 1) return null;

  const valeurs = feuille.getRange(2, 1, nbLignes, NB_COLONNES).getValues();
  for (let i = 0; i < valeurs.length; i++) {
    if (String(valeurs[i][C_TOKEN - 1]).trim() === token) {
      return { feuille: feuille, ligne: i + 2, valeurs: valeurs[i] };
    }
  }
  return null;
}

function json(objet) {
  return ContentService
    .createTextOutput(JSON.stringify(objet))
    .setMimeType(ContentService.MimeType.JSON);
}
