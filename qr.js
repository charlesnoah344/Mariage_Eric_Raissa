/**
 * Générateur de QR code minimal — versions 1 à 3, correction d'erreurs niveau M.
 * Intégré au site (aucune bibliothèque externe) pour que le billet s'affiche
 * même sans réseau une fois la page chargée.
 *
 * Usage : QR.svg('texte')  →  chaîne SVG prête à insérer.
 */
const QR = (() => {
  // --- Arithmétique de Galois GF(256), polynôme 0x11D (norme QR) -------------
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  function correction(donnees, nbEcc) {
    let g = [1];
    for (let i = 0; i < nbEcc; i++) {
      const suivant = new Array(g.length + 1).fill(0);
      for (let j = 0; j < g.length; j++) {
        suivant[j] ^= g[j];
        suivant[j + 1] ^= mul(g[j], EXP[i]);
      }
      g = suivant;
    }
    const reste = donnees.concat(new Array(nbEcc).fill(0));
    for (let i = 0; i < donnees.length; i++) {
      const facteur = reste[i];
      if (!facteur) continue;
      for (let j = 0; j < g.length; j++) reste[i + j] ^= mul(g[j], facteur);
    }
    return reste.slice(donnees.length);
  }

  // version : [codewords de données, codewords de correction]
  const VERSIONS = { 1: [16, 10], 2: [28, 16], 3: [44, 26] };

  function codewords(texte) {
    const octets = Array.from(new TextEncoder().encode(texte));

    let version = 0;
    for (const v of [1, 2, 3]) {
      if (octets.length + 2 <= VERSIONS[v][0]) { version = v; break; }
    }
    if (!version) throw new Error('Texte trop long pour ce generateur');

    const [nbDonnees, nbEcc] = VERSIONS[version];
    const bits = [];
    const pousser = (valeur, taille) => {
      for (let i = taille - 1; i >= 0; i--) bits.push((valeur >> i) & 1);
    };

    pousser(4, 4);                 // mode octet
    pousser(octets.length, 8);     // longueur (versions 1 a 9)
    octets.forEach(o => pousser(o, 8));

    const capacite = nbDonnees * 8;
    for (let i = 0; i < 4 && bits.length < capacite; i++) bits.push(0); // terminateur
    while (bits.length % 8) bits.push(0);

    const mots = [];
    for (let i = 0; i < bits.length; i += 8) {
      mots.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    }
    const bourrage = [0xec, 0x11];
    for (let i = 0; mots.length < nbDonnees; i++) mots.push(bourrage[i % 2]);

    return { version, mots: mots.concat(correction(mots, nbEcc)) };
  }

  const ALIGNEMENT = { 1: null, 2: 18, 3: 22 };

  function matrice(version) {
    const taille = 17 + 4 * version;
    const m = Array.from({ length: taille }, () => new Array(taille).fill(0));
    const reserve = Array.from({ length: taille }, () => new Array(taille).fill(false));
    const poser = (x, y, v) => { m[y][x] = v; reserve[y][x] = true; };

    // Motifs de detection (3 coins) et separateurs
    [[0, 0], [taille - 7, 0], [0, taille - 7]].forEach(([dx, dy]) => {
      for (let y = -1; y <= 7; y++) {
        for (let x = -1; x <= 7; x++) {
          const px = dx + x, py = dy + y;
          if (px < 0 || py < 0 || px >= taille || py >= taille) continue;
          const dansCarre = x >= 0 && x <= 6 && y >= 0 && y <= 6;
          const bord = x === 0 || x === 6 || y === 0 || y === 6;
          const centre = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          poser(px, py, dansCarre && (bord || centre) ? 1 : 0);
        }
      }
    });

    // Motif d'alignement (versions 2 et 3)
    const a = ALIGNEMENT[version];
    if (a) {
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const bord = Math.abs(x) === 2 || Math.abs(y) === 2;
          poser(a + x, a + y, (bord || (x === 0 && y === 0)) ? 1 : 0);
        }
      }
    }

    // Motifs de synchronisation
    for (let i = 8; i < taille - 8; i++) {
      poser(i, 6, i % 2 === 0 ? 1 : 0);
      poser(6, i, i % 2 === 0 ? 1 : 0);
    }

    poser(8, taille - 8, 1); // module toujours noir

    // Zones reservees au format
    for (let i = 0; i < 9; i++) { reserve[8][i] = true; reserve[i][8] = true; }
    for (let i = 0; i < 8; i++) { reserve[8][taille - 1 - i] = true; reserve[taille - 1 - i][8] = true; }

    return { m, reserve, taille };
  }

  function remplir(m, reserve, taille, mots) {
    const bits = [];
    mots.forEach(o => { for (let i = 7; i >= 0; i--) bits.push((o >> i) & 1); });

    let index = 0, montant = true;
    for (let colonne = taille - 1; colonne > 0; colonne -= 2) {
      if (colonne === 6) colonne--; // colonne de synchronisation
      for (let pas = 0; pas < taille; pas++) {
        const y = montant ? taille - 1 - pas : pas;
        for (const x of [colonne, colonne - 1]) {
          if (reserve[y][x]) continue;
          m[y][x] = index < bits.length ? bits[index++] : 0;
        }
      }
      montant = !montant;
    }
  }

  const MASQUES = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];

  function penalite(m, taille) {
    let score = 0;
    for (let i = 0; i < taille; i++) {
      for (const parLigne of [true, false]) {
        let precedent = -1, serie = 0;
        for (let j = 0; j < taille; j++) {
          const v = parLigne ? m[i][j] : m[j][i];
          if (v === precedent) { serie++; if (serie === 5) score += 3; else if (serie > 5) score++; }
          else { precedent = v; serie = 1; }
        }
      }
    }
    let noirs = 0;
    for (let y = 0; y < taille; y++) for (let x = 0; x < taille; x++) noirs += m[y][x];
    score += Math.floor(Math.abs(noirs * 100 / (taille * taille) - 50) / 5) * 10;
    return score;
  }

  function format(masque) {
    // Niveau M = 00, puis le numero de masque, proteges par un code BCH(15,5)
    const valeur = (0 << 3) | masque;
    let reste = valeur << 10;
    for (let i = 14; i >= 10; i--) if ((reste >> i) & 1) reste ^= 0x537 << (i - 10);
    return ((valeur << 10) | reste) ^ 0x5412;
  }

  function construire(texte) {
    const { version, mots } = codewords(texte);
    const { m, reserve, taille } = matrice(version);
    remplir(m, reserve, taille, mots);

    // Le masque le moins penalisant : l'encodage reste valide quel que soit le choix
    let meilleur = null;
    for (let masque = 0; masque < 8; masque++) {
      const essai = m.map((ligne, y) => ligne.map((v, x) =>
        reserve[y][x] ? v : (MASQUES[masque](x, y) ? v ^ 1 : v)));

      const bitsFormat = format(masque);
      const bit = (i) => (bitsFormat >> i) & 1;

      // Copie 1, autour du motif haut-gauche
      for (let i = 0; i <= 5; i++) essai[8][i] = bit(14 - i);
      essai[8][7] = bit(8);
      essai[8][8] = bit(7);
      essai[7][8] = bit(6);
      for (let r = 0; r <= 5; r++) essai[r][8] = bit(r);

      // Copie 2, le long des deux autres motifs
      for (let i = 0; i <= 7; i++) essai[8][taille - 1 - i] = bit(i);
      for (let i = 8; i <= 14; i++) essai[taille - 15 + i][8] = bit(i);

      essai[taille - 8][8] = 1; // module toujours noir

      const score = penalite(essai, taille);
      if (!meilleur || score < meilleur.score) meilleur = { score, grille: essai };
    }
    return meilleur.grille;
  }

  function svg(texte, options) {
    const o = options || {};
    const marge = o.marge === undefined ? 4 : o.marge;
    const couleur = o.couleur || '#2e0a11';
    const fond = o.fond || '#ffffff';

    const grille = construire(texte);
    const taille = grille.length;
    const total = taille + marge * 2;

    let chemin = '';
    for (let y = 0; y < taille; y++) {
      for (let x = 0; x < taille; x++) {
        if (grille[y][x]) chemin += 'M' + (x + marge) + ' ' + (y + marge) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" ' +
      'shape-rendering="crispEdges" role="img" aria-label="QR code du billet">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + fond + '"/>' +
      '<path d="' + chemin + '" fill="' + couleur + '"/></svg>';
  }

  return { svg, construire };
})();

if (typeof module !== 'undefined') module.exports = QR;
