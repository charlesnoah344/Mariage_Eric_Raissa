/**
 * Cloudflare Pages — personnalisation de l'aperçu de lien.
 *
 * Site de secours pour les invités dont l'opérateur n'atteint pas Netlify.
 * Toute la logique est dans apercu-commun.js, partagée avec la fonction Netlify.
 */
import { reponsePersonnalisee } from '../apercu-commun.js';

export async function onRequest(context) {
  const reponse = await context.next();
  return reponsePersonnalisee(reponse, context.request.url);
}
