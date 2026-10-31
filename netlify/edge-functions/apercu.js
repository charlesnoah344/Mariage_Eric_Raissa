/**
 * Netlify — personnalisation de l'aperçu de lien.
 *
 * Toute la logique est dans apercu-commun.js, partagée avec Cloudflare Pages
 * (functions/_middleware.js), pour que les deux hébergeurs servent exactement
 * le même aperçu.
 */
import { reponsePersonnalisee } from '../../apercu-commun.js';

export default async (request, context) => {
  const reponse = await context.next();
  return reponsePersonnalisee(reponse, request.url);
};

export const config = { path: '/' };
