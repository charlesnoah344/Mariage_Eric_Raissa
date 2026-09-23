/**
 * Apercu de lien personnalise (WhatsApp, Facebook, iMessage...).
 *
 * WhatsApp n'execute pas le JavaScript de la page : il lit uniquement le HTML brut.
 * Cette fonction s'execute sur le serveur a chaque ouverture du lien et remplace la
 * ligne de description par le nom de l'invite quand le lien en contient un (?n=Noah).
 * Sans prenom, la page est renvoyee telle quelle.
 *
 * Aucune configuration : Netlify detecte ce dossier automatiquement.
 */

const echapper = (texte) => texte
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export default async (request, context) => {
  const prenom = (new URL(request.url).searchParams.get('n') || '').trim().slice(0, 60);
  if (!prenom) return; // pas de prenom : rien a personnaliser

  const reponse = await context.next();
  if (!(reponse.headers.get('content-type') || '').includes('text/html')) return reponse;

  const salutation = echapper(prenom);
  const html = (await reponse.text())
    .replace('<meta property="og:description" content="19 décembre 2026 · Yaoundé, Cameroun">',
             '<meta property="og:description" content="' + salutation + '">')
    .replace('<meta name="twitter:card" content="summary_large_image">',
             '<meta name="twitter:card" content="summary_large_image">\n'
             + '<meta name="twitter:description" content="' + salutation + '">');

  // Le HTML a change de taille : ces en-tetes tronqueraient la page.
  const entetes = new Headers(reponse.headers);
  entetes.delete('content-length');
  entetes.delete('etag');

  return new Response(html, { status: reponse.status, headers: entetes });
};

export const config = { path: '/' };
