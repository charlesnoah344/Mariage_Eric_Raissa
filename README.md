# Faire-part de mariage — Raïssa & Eric

**Le site : https://fairepart-mariage-raissa-eric.netlify.app**

Faire-part numérique du mariage de Raïssa & Eric, le **19 décembre 2026 à Yaoundé**.
Chaque invité reçoit un lien personnel, confirme sa présence, reçoit un billet avec QR code,
et ce QR est scanné à l'entrée le jour J.

Site statique hébergé sur Netlify. Les données vivent dans un Google Sheet,
piloté par Google Apps Script. Aucun serveur à payer, aucune base de données.

---

## Les deux pages

| Adresse | À qui | À quoi ça sert |
|---|---|---|
| `/` | Les invités | Le faire-part, le programme, la réponse et le billet avec QR code |
| `/controle` | Les hôtes à l'entrée | Scanner les QR codes le jour du mariage |

La page de contrôle demande un **code d'accès**, défini dans `apps-script.gs` (`ADMIN_CODE`).
Ne la communiquez qu'aux personnes qui tiennent l'entrée.

---

## Le parcours d'un invité

1. Il reçoit par WhatsApp un lien personnel : `…netlify.app/?i=TOKEN&n=Son%20Nom`
   L'aperçu WhatsApp affiche son nom, grâce à `netlify/edge-functions/apercu.js`.
2. Il ouvre le lien : l'enveloppe s'ouvre sur le faire-part.
   Son nom et son nombre de places sont déjà remplis dans le formulaire de réponse.
3. Il confirme sa présence : la réponse s'écrit **dans sa ligne** du Google Sheet.
4. Son **billet avec QR code** s'affiche. Il le retrouve en rouvrant son lien.
5. Le jour J, son QR est scanné sur `/controle`, et son entrée est notée dans le tableur.

Sans lien valide, le faire-part reste visible mais **personne ne peut répondre** :
seuls les invités de la liste ont un token.

---

## Le Google Sheet

Un seul onglet, **« Invités »**, une ligne par **invitation** (une famille = une ligne) :

| Colonne | Qui la remplit |
|---|---|
| Prénom, Nom, Téléphone, Places | Vous, à la main |
| Token, Lien | Le menu **Invitations** du tableur |
| Statut, Places confirmées, Répondu le, Message | L'invité, en répondant |
| Entré à, Entrées comptées | La page de contrôle, le jour J |

### Ajouter des invités

1. Saisissez les nouvelles lignes (Prénom, Nom, Téléphone, Places).
2. Menu **Invitations → Générer les liens manquants**.
3. Copiez la colonne **Lien** et envoyez chaque lien à son destinataire.

Les liens déjà générés ne sont jamais modifiés : relancez autant de fois que vous voulez.

> **Ne videz jamais la colonne Token.** C'est l'identité de l'invitation :
> l'effacer invalide tous les liens déjà envoyés et détache les réponses reçues.
> Pour reconstruire des liens (changement d'adresse du site, par exemple),
> videz uniquement la colonne **Lien**, puis relancez la génération.

---

## Les fichiers

### Le site

| Fichier | Rôle |
|---|---|
| `index.html` | Le faire-part en entier : mise en page, programme, réponse, billet |
| `controle.html` | La page de scan des entrées |
| `qr.js` | Génère les QR codes, sans bibliothèque externe, pour qu'un billet s'affiche même hors ligne |
| `vendor/jsqr.js` | Lit les QR codes quand le navigateur ne sait pas le faire (Safari). Licence Apache 2.0 |
| `netlify/edge-functions/apercu.js` | Met le nom de l'invité dans l'aperçu WhatsApp du lien |
| `config.js` | `SCRIPT_URL` et `RSVP_TOKEN` — l'adresse du script Google et la clé partagée |
| `og-invitation.jpg` | L'image affichée dans l'aperçu des liens |

### Le tableur (à coller dans Apps Script)

| Fichier | Rôle |
|---|---|
| `apps-script.gs` | Le backend : lit une invitation, enregistre une réponse, scanne une entrée |
| `apps-script-invites.gs` | Le menu **Invitations** du tableur : prépare la feuille, génère les liens |

Le projet Apps Script doit contenir **exactement deux fichiers** (`Code.gs` et le générateur).
Un fichier en double provoque l'erreur `Identifier 'SITE_URL' has already been declared`,
et **plus rien ne fonctionne** — ni le menu, ni le site.

---

## Modifier le script du tableur

Google Sheet → **Extensions → Apps Script** → collez le fichier → **Enregistrer**.

> **Enregistrer ne suffit pas.** Le site continue d'appeler l'ancienne version tant que
> vous n'avez pas fait : **Déployer → Gérer les déploiements → l'icône crayon →
> Version : « Nouvelle version » → Déployer.**
>
> Attention, « Déployer → **Nouveau** déploiement » crée une **nouvelle adresse `/exec`** :
> il faudrait alors reporter cette adresse dans `config.js`.

Pour vérifier qu'une nouvelle version est bien en ligne, ouvrez dans un navigateur
(en remplaçant `URL_DU_SCRIPT` par la valeur de `SCRIPT_URL`, et le code d'accès par le vôtre) :

```
URL_DU_SCRIPT?action=liste&auth=LA_CLE_RSVP_TOKEN&admin=LE_CODE_ADMIN
```

- La liste de vos invités en JSON → c'est à jour.
- « Le backend du faire-part fonctionne ✔ » → l'ancienne version répond encore.

---

## Le jour du mariage

1. Ouvrez `/controle` sur le téléphone de chaque personne à l'entrée, **avant** l'arrivée des invités.
2. Saisissez le code d'accès : la liste des invités est téléchargée sur le téléphone.
3. **Démarrer la caméra**, puis scannez les billets.

Ce que le contrôleur voit :

| Couleur | Signification |
|---|---|
| Vert « Bienvenue » | Entrée validée, avec le nom et le nombre de places |
| Rouge « Déjà entré » | Ce QR a déjà servi, avec l'heure du premier passage |
| Orange « Entrée notée » | La personne n'avait pas confirmé sa présence, mais elle est attendue |
| Gris « Billet inconnu » | Ce code ne correspond à aucune invitation |

**Si le réseau lâche**, la page continue de fonctionner avec la liste téléchargée.
Les entrées sont mises en attente et partent toutes seules dès le retour de la connexion
(le compteur en bas indique « X à synchroniser »).

**Toujours possible en secours** : saisir à la main le code écrit sous le QR du billet.
Les codes n'utilisent aucun caractère ambigu (ni `0`/`O`, ni `1`/`l`), ils se dictent au téléphone.

---

## En cas de problème

| Symptôme | Cause la plus probable |
|---|---|
| La page de contrôle refuse le bon code | Le script n'a pas été redéployé en **nouvelle version** |
| Le formulaire dit « Utilisez le lien personnel » | Le lien ouvert n'a pas de `?i=TOKEN`, ou le token n'existe plus dans la feuille |
| Le site ne reconnaît plus aucun lien | `config.js` absent du déploiement, ou `SCRIPT_URL` pointe vers un ancien déploiement |
| Le déploiement Netlify échoue | Une commande de build est inscrite dans l'interface Netlify. Le site est statique : **Build command** doit rester vide, **Publish directory** à `.` |
| L'aperçu WhatsApp est resté l'ancien | WhatsApp garde les aperçus en mémoire par lien. Testez avec un lien jamais partagé, ou ajoutez `&v=2` à la fin |
| Le premier chargement est lent | Réveil à froid de Google Apps Script : la première requête peut prendre plusieurs secondes |

---

## Le mot de passe et les clés

| Où | Quoi |
|---|---|
| `config.js` | `RSVP_TOKEN` — clé partagée site ↔ script. Visible par les visiteurs, ce n'est pas un secret : elle écarte seulement les robots |
| `apps-script.gs` | `API_AUTH` — doit être **identique** à `RSVP_TOKEN` |
| `apps-script.gs` | `ADMIN_CODE` — le vrai secret : il ouvre la page de contrôle. Il reste côté Google, jamais dans le site |

## Auteur

Charles Noah