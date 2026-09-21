/**
 * Aperçu de lien personnalisé (WhatsApp, Facebook, iMessage…).
 *
 * WhatsApp n'exécute pas le JavaScript de la page : il lit uniquement le HTML brut.
 * Le prénom doit donc être injecté côté serveur. Cette fonction s'exécute à chaque
 * ouverture de la page d'accueil et remplace les balises d'aperçu quand le lien
 * contient un prénom (?n=Noah). Sans prénom, la page est renvoyée telle quelle.
 *
 * Aucune configuration nécessaire : Netlify détecte ce dossier automatiquement.
 */

const echapper = (texte) => texte
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export default async (request, context) => {
  const prenom = (new URL(request.url).searchParams.get('n') || '').trim().slice(0, 40);
  if (!prenom) return; // pas de prénom : rien à personnaliser

  const reponse = await context.next();
  if (!(reponse.headers.get('content-type') || '').includes('text/html')) return reponse;

  const titre = echapper('Bonjour ' + prenom + ', nous vous invitons à notre mariage');
  const html = (await reponse.text())
    .replace('<meta property="og:title" content="&#8203;">',
             '<meta property="og:title" content="' + titre + '">')
    .replace('<meta property="og:description" content="&#8203;">',
             '<meta property="og:description" content="19 décembre 2026 · Yaoundé, Cameroun">')
    .replace('<meta name="twitter:card" content="summary_large_image">',
             '<meta name="twitter:card" content="summary_large_image">\n'
             + '<meta name="twitter:title" content="' + titre + '">');

  // Le HTML a changé de taille : ces en-têtes ne sont plus valables et tronqueraient la page.
  const entetes = new Headers(reponse.headers);
  entetes.delete('content-length');
  entetes.delete('etag');

  return new Response(html, { status: reponse.status, headers: entetes });
};

export const config = { path: '/' };
