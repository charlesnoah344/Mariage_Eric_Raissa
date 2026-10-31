/**
 * Personnalisation de l'aperçu de lien (WhatsApp, Facebook, iMessage…).
 *
 * WhatsApp n'exécute pas le JavaScript de la page : il lit uniquement le HTML brut.
 * Le nom de l'invité doit donc être injecté côté serveur, à chaque ouverture du lien.
 *
 * Ce module est partagé par les deux hébergeurs :
 *   - Netlify    → netlify/edge-functions/apercu.js
 *   - Cloudflare → functions/_middleware.js
 * Les chaînes ci-dessous doivent rester identiques, au caractère près, à celles
 * d'index.html : c'est pour cela qu'elles ne vivent qu'à un seul endroit.
 */

const ORIGINE_FIGEE = 'https://fairepart-mariage-raissa-eric.netlify.app';

const echapper = (texte) => texte
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Y a-t-il quelque chose à changer ? À vérifier AVANT de lire le corps de la réponse,
 *  qui ne peut être lu qu'une seule fois. */
export function aPersonnaliser(url) {
  const adresse = new URL(url);
  const prenom = (adresse.searchParams.get('n') || '').trim();
  return Boolean(prenom) || adresse.origin !== ORIGINE_FIGEE;
}

/**
 * @param {string} html  la page telle que servie par l'hébergeur
 * @param {string} url   l'adresse complète demandée par le visiteur
 * @returns {string} le HTML, modifié si nécessaire
 */
export function personnaliser(html, url) {
  const adresse = new URL(url);
  const prenom = (adresse.searchParams.get('n') || '').trim().slice(0, 60);
  const memeOrigine = adresse.origin === ORIGINE_FIGEE;

  let resultat = html;

  if (prenom) {
    const nom = echapper(prenom);
    resultat = resultat
      .replace('<meta property="og:description" content="19 décembre 2026 · Yaoundé, Cameroun">',
               '<meta property="og:description" content="' + nom + '">')
      .replace('<meta name="twitter:card" content="summary_large_image">',
               '<meta name="twitter:card" content="summary_large_image">\n'
               + '<meta name="twitter:description" content="' + nom + '">');
  }

  // L'image d'aperçu et l'adresse canonique sont figées sur Netlify dans index.html.
  // Servies depuis un autre hébergeur, elles renverraient l'invité vers Netlify —
  // justement l'hébergeur que certains n'arrivent pas à joindre.
  if (!memeOrigine) {
    resultat = resultat.split(ORIGINE_FIGEE).join(adresse.origin);
  }

  return resultat;
}

/**
 * Réponse prête à renvoyer, ou la réponse d'origine si rien n'a changé.
 * Commun aux deux hébergeurs : même traitement du type de contenu et des en-têtes.
 */
export async function reponsePersonnalisee(reponse, url) {
  if (!(reponse.headers.get('content-type') || '').includes('text/html')) return reponse;
  if (!aPersonnaliser(url)) return reponse;

  const html = personnaliser(await reponse.text(), url);

  // Le HTML a changé de taille : ces en-têtes tronqueraient la page.
  const entetes = new Headers(reponse.headers);
  entetes.delete('content-length');
  entetes.delete('etag');

  return new Response(html, { status: reponse.status, headers: entetes });
}
