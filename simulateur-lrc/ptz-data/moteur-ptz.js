/* ======================================================================
   moteur-ptz.js — Moteur du prêt à taux zéro (PTZ) du simulateur Galaxie
   ----------------------------------------------------------------------
   Fichier autonome : aucune dépendance, aucun accès au DOM. Toutes les
   fonctions sont PURES (mêmes entrées → mêmes sorties). Il expose
   globalThis.PTZ (et module.exports sous Node, pour les tests).

   Sources des barèmes : etude-ptz/01-regles-ptz-sourcees.md — compte rendu
   sourcé « PTZ au 3 septembre 2026 » (Légifrance CCH L31-10 / D31-10-1 à
   D31-10-12, ANIL « offres à compter du 1er avril 2025 », service-public
   F10871). Les sections citées ci-dessous (§1, §2, §3a…§3e, §4, §5) sont
   celles de ce compte rendu. En cas d'écart, etude-ptz/rapport.html fait
   foi. Décisions d'intégration : Christophe Goubet, 07/09/2026.

   Conventions :
     · les montants sont en euros, les taux en fraction (0.0345 = 3,45 %),
       les durées en années ;
     · zone ∈ 'Abis' | 'A' | 'B1' | 'B2' | 'C' (A bis = A pour tous les
       barèmes) ;
     · nature ∈ 'collectif' (appartement neuf) | 'individuel' (terrain +
       construction) ;
     · le coût d'opération PTZ = prix + travaux, frais de notaire exclus (§5).

   Point d'entrée : PTZ.simulerPtz(entrees) — voir le commentaire de la
   fonction pour la liste des entrées et des sorties.
   ====================================================================== */
(function (root) {
  'use strict';

  /* =================================================================
     CONFIG_PTZ — toutes les constantes, datées.
     ================================================================= */
  var CONFIG_PTZ = {
    version: 'Barèmes du 1er avril 2025 (LF 2025 art. 90, décret 2025-299, CCH D31-10-1 à D31-10-12), inchangés au 07/09/2026',
    dateBaremes: '2025-04-01',
    dateReleve: '2026-09-07',
    valableJusquAu: '2027-12-31',
    mention: 'Barèmes PTZ du 1er avril 2025, valables pour une offre de prêt émise avant le 31/12/2027',
    zonage: {
      date: '2026-06-26',
      source: 'data.gouv.fr — liste des communes selon le zonage ABC, version en vigueur au 26/06/2026 (arrêtés du 05/09/2025 et du 23/06/2026)',
      fichiers: 'ptz-data/zones/<département>.json — { "codeINSEE": "Abis|A|B1|B2|C" }'
    },

    ZONES: ['Abis', 'A', 'B1', 'B2', 'C'],
    /* §2 : « Zone A bis = zone A » pour les plafonds, seuils et plafonds d'opération. */
    GRILLE_PAR_ZONE: { Abis: 'A', A: 'A', B1: 'B1', B2: 'B2', C: 'C' },

    /* §2 — Plafonds de ressources (CCH D31-10-3-1, version 04/04/2024).
       Index 0 = 1 personne … index 7 = 8 personnes et plus. RFR N-2 de tous
       les occupants, ou coût ÷ 9 si plus élevé. */
    PLAFONDS_RESSOURCES: {
      A:  [49000, 73500, 88200, 102900, 117600, 132300, 147000, 161700],
      B1: [34500, 51750, 62100, 72450,  82800,  93150,  103500, 113850],
      B2: [31500, 47250, 56700, 66150,  75600,  85050,  94500,  103950],
      C:  [28500, 42750, 51300, 59850,  68400,  76950,  85500,  94050]
    },

    /* §3a — Coefficient familial (ANIL 2025 ; L31-10-10 jusqu'à 2,4).
       Index 0 = 1 personne … index 7 = 8 et plus. */
    COEFFICIENTS: [1, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.3],

    /* §3b — Seuils des tranches sur (ressources ÷ coefficient), CCH D31-10-9
       version 31/03/2025. Tranche i si revenu ≤ SEUILS[i-1] (bornes hautes).
       Le 4e seuil × coefficient = plafond de ressources (cohérence vérifiée). */
    SEUILS_TRANCHES: {
      A:  [25000, 31000, 37000, 49000],
      B1: [21500, 26000, 30000, 34500],
      B2: [18000, 22500, 27000, 31500],
      C:  [15000, 19500, 24000, 28500]
    },

    /* §3c — Quotités par tranche (index 0 = tranche 1).
       collectif  : neuf en bâtiment collectif (D31-10-9 I) ;
       individuel : maison individuelle neuve, décret 2025-299 (D31-10-9 II bis),
                    valable pour les offres du 01/04/2025 au 31/12/2027. */
    QUOTITES: {
      collectif:  [0.50, 0.40, 0.40, 0.20],
      individuel: [0.30, 0.20, 0.20, 0.10]
    },

    /* §3d — Plafond du coût de l'opération pris en compte (CCH D31-10-10,
       version 04/04/2024). Index 0 = 1 personne … index 4 = 5 et plus. */
    PLAFONDS_OPERATION: {
      A:  [150000, 225000, 270000, 315000, 360000],
      B1: [135000, 202500, 243000, 283500, 324000],
      B2: [110000, 165000, 198000, 231000, 264000],
      C:  [100000, 150000, 180000, 210000, 240000]
    },

    /* §4 — Durée et différé par tranche (CCH D31-10-11, décret 2024-304).
       Index 0 = tranche 1. Différé = période sans aucune mensualité PTZ ;
       remboursement = période 2, mensualités constantes = montant ÷ mois. */
    ECHEANCIER: [
      { tranche: 1, differe: 10, remboursement: 15 },   /* 25 ans */
      { tranche: 2, differe: 8,  remboursement: 12 },   /* 20 ans */
      { tranche: 3, differe: 2,  remboursement: 13 },   /* 15 ans */
      { tranche: 4, differe: 0,  remboursement: 10 }    /* 10 ans */
    ],
    /* §4 + rapport.html §3 : le différé ne peut pas dépasser la durée du prêt
       le plus long (L31-10-11) ; l'emprunteur peut réduire son différé.
       Convention du simulateur (décision 8) : sur 15/20 ans on réduit le
       différé pour aligner les deux prêts, avec ce minimum. */
    DIFFERE_MIN: 2,
    DUREE_MAX_PTZ: 25,

    /* §5 — PTZ ≤ somme des autres prêts d'au moins 2 ans (L31-10-9) ;
       en tranche 1 (quotité 50 %) : PTZ ≤ 1,25 × les autres prêts. */
    RATIO_AUTRES_PRETS: [1.25, 1, 1, 1],
    DUREE_MIN_AUTRES_PRETS: 2,

    /* §2 — Revenu plancher : ressources retenues = max(RFR, coût ÷ 9) (D31-10-3-2). */
    DIVISEUR_REVENU_PLANCHER: 9,

    /* Décision 4b — RFR inconnu : estimation 11 × net mensuel du ménage ;
       contrôle de cohérence d'un RFR déclaré : entre 8 et 14 × le net mensuel. */
    RFR_ESTIMATION_MULTIPLE: 11,
    RFR_COHERENCE: { min: 8, max: 14 },

    /* Décision 7 — zones grises « à la limite » : ± 500 € de RFR d'une borne
       de tranche ou du plafond ; ± 0,5 point d'endettement d'un seuil. */
    LIMITE_RFR: 500,
    LIMITE_ENDETTEMENT: 0.005,

    /* Décision 6 — assurance emprunteur : taux annuel forfaitaire sur le
       capital initial, par âge de l'emprunteur le plus âgé, sur TOUS les prêts
       (PTZ compris, due dès le premier mois). Hypothèse simulateur, à ajuster. */
    ASSURANCE: {
      date: '2026-09-07',
      note: 'Taux forfaitaires annuels sur le capital initial, hypothèse du simulateur au 07/09/2026, à ajuster',
      tranches: [
        { ageMax: 35,       taux: 0.0025, libelle: 'jusqu’à 35 ans' },
        { ageMax: 45,       taux: 0.0035, libelle: '36 à 45 ans' },
        { ageMax: 55,       taux: 0.0050, libelle: '46 à 55 ans' },
        { ageMax: Infinity, taux: 0.0070, libelle: 'plus de 55 ans' }
      ],
      tauxDefaut: 0.0035
    },

    /* Copie de la grille du simulateur (index.html CONFIG, 07/09/2026), utilisée
       UNIQUEMENT si simulerPtz ne reçoit pas de taux. Frais : 3 % neuf, 8 % ancien,
       terrain 8 % + construction 3 %. */
    TAUX_DEFAUT: { 15: 0.0295, 20: 0.0325, 25: 0.0345 },
    FRAIS: { neuf: 0.03, ancien: 0.08, terrain: 0.08, construction: 0.03 },

    /* Seuils du feu (index.html CONFIG.ENDETTEMENT_MAX = 0,35 ; orange jusqu'à 0,40). */
    ENDETTEMENT: { vert: 0.35, orange: 0.40 },

    TEXTE_MENTION: 'PTZ estimé sur vos déclarations, à confirmer par votre courtier'
  };

  /* =================================================================
     Utilitaires purs
     ================================================================= */
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function arrondi(v, dec) { var p = Math.pow(10, dec || 0); return Math.round(v * p) / p; }
  function formaterEuros(n) {
    /* Même mise en forme que fmtEUR d'index.html : Number.toLocaleString('fr-FR') + ' €'. */
    if (n === null || n === undefined || !isFinite(Number(n))) return '—';
    return Math.round(Number(n)).toLocaleString('fr-FR') + ' €';
  }
  function formaterPct(taux, dec) {
    var d = dec === undefined ? 2 : dec;
    return (taux * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
  }
  /* Un taux qui dépasse un seuil de peu. Entre 40,00 % et 40,05 %, l'arrondi à une
     décimale ne prouve rien : il affiche « 40,0 % » (on croit le seuil non franchi)
     ou « 40,1 % » selon la valeur flottante, pour un même 40,05 % affiché. Dans
     cette plage — un demi-cran d'affichage — on passe à deux décimales (06/09/2026). */
  var MARGE_DEPASSEMENT = 0.0005;   /* 0,05 point de pourcentage */
  function formaterPctDepassement(taux, seuil) {
    var d = (taux > seuil && (taux - seuil) <= MARGE_DEPASSEMENT + 1e-12) ? 2 : 1;
    return formaterPct(taux, d);
  }
  function normaliserZone(z) {
    if (z === null || z === undefined) return null;
    var s = String(z).replace(/[\s_-]+/g, '').toUpperCase();
    if (s === 'ABIS') return 'Abis';
    if (s === 'A' || s === 'B1' || s === 'B2' || s === 'C') return s;
    return null;
  }
  function grille(zone) {
    var z = normaliserZone(zone);
    return z ? CONFIG_PTZ.GRILLE_PAR_ZONE[z] : null;
  }
  function libelleZone(zone) {
    var z = normaliserZone(zone);
    return z === 'Abis' ? 'A bis' : (z || null);
  }
  /* « la commune de … » : élision devant une voyelle ou un h muet (d’Achères-
     la-Forêt, d’Hyères) et article contracté devant Le / Les (du Havre, des
     Mureaux). Les h aspirés les plus courants sont listés ; la liste s'étend. */
  var H_ASPIRE = /^(Honfleur|Houilles|Houdan|Hazebrouck|Haguenau|Hautmont|Hem|Hondschoote)\b/i;
  function deCommune(nom) {
    var s = String(nom || '').trim();
    if (!s) return '';
    if (/^Le\s/i.test(s)) return 'du ' + s.replace(/^Le\s+/i, '');
    if (/^Les\s/i.test(s)) return 'des ' + s.replace(/^Les\s+/i, '');
    if (/^[aeiouyàâäéèêëîïôöùûüœ]/i.test(s) || (/^h/i.test(s) && !H_ASPIRE.test(s))) return 'd’' + s;
    return 'de ' + s;
  }
  function nbOccupants(n) {
    var v = Math.floor(Number(n));
    return (isFinite(v) && v >= 1) ? v : 1;
  }
  function coefficientFamilial(occupants) {
    return CONFIG_PTZ.COEFFICIENTS[Math.min(nbOccupants(occupants), 8) - 1];
  }
  function natureOperation(natureBien) {
    /* Décision 1-2 : PTZ simulé uniquement pour « appartement neuf » (collectif)
       et « terrain + construction » (individuel). */
    if (natureBien === 'collectif' || natureBien === 'individuel') return natureBien;
    var s = String(natureBien || '').toLowerCase();
    if (s === 'neuf' || s === 'appartement' || s === 'appartement_neuf' || s === 'appartementneuf' || s === 'vefa') return 'collectif';
    if (s === 'terrain' || s === 'construction' || s === 'terrain_construction' || s === 'maison') return 'individuel';
    return null;
  }

  /* =================================================================
     Zonage — table par département : { "codeINSEE": "Abis|A|B1|B2|C" }
     ================================================================= */
  function departementPourCode(codeInsee) {
    var c = String(codeInsee || '').trim().toUpperCase();
    if (!/^[0-9][0-9AB][0-9]{3}$/.test(c)) return null;
    if (c.charAt(0) === '9' && (c.charAt(1) === '7' || c.charAt(1) === '8')) return c.substr(0, 3); /* DOM */
    return c.substr(0, 2); /* y compris 2A / 2B (Corse) */
  }
  function fichierZones(codeInsee, base) {
    var d = departementPourCode(codeInsee);
    return d ? (base === undefined ? 'ptz-data/zones/' : base) + d + '.json' : null;
  }
  function zonePourCode(codeInsee, tableDep) {
    if (!tableDep || typeof tableDep !== 'object') return null;
    var c = String(codeInsee || '').trim().toUpperCase();
    if (!c) return null;
    var v = Object.prototype.hasOwnProperty.call(tableDep, c) ? tableDep[c] : undefined;
    return normaliserZone(v);
  }

  /* =================================================================
     Année du RFR — règles de la date de l'offre (décision 9).
     Offre en N → RFR des revenus N-2, avis d'imposition N-1.
     ================================================================= */
  function anneeRfr(dateOffre) {
    var d = dateOffre ? new Date(dateOffre) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var y = d.getFullYear();
    return {
      anneeOffre: y,
      anneeRevenus: y - 2,
      anneeAvis: y - 1,
      baremesValables: d.getTime() <= new Date(CONFIG_PTZ.valableJusquAu + 'T23:59:59').getTime()
    };
  }

  /* =================================================================
     §2 — Ressources retenues = max(RFR, coût d'opération ÷ 9)
     → { ressources, rfr, plancher, plancherApplique }
     ================================================================= */
  function ressourcesRetenues(p) {
    p = p || {};
    var rfr = Math.max(0, num(p.rfr));
    var cout = Math.max(0, num(p.coutOperation));
    var plancher = cout / CONFIG_PTZ.DIVISEUR_REVENU_PLANCHER;
    var ress = Math.max(rfr, plancher);
    return { ressources: ress, rfr: rfr, plancher: plancher, plancherApplique: plancher > rfr };
  }

  /* =================================================================
     §2 + §3a + §3b — Tranche 1..4 ou null (inéligible)
     → { tranche, eligible, coef, revenuTranche, plafond, bornes,
         borneProche:{tranche, valeur}, ecart, aLaLimite }
     `bornes` = seuils × coefficient, exprimés en € de ressources ;
     `ecart` = ressources − borne la plus proche (négatif = en dessous).
     ================================================================= */
  function tranche(p) {
    p = p || {};
    var g = grille(p.zone);
    var n = nbOccupants(p.occupants);
    var coef = coefficientFamilial(n);
    var ress = Math.max(0, num(p.ressources));
    var out = { tranche: null, eligible: false, zone: normaliserZone(p.zone), grille: g, occupants: n, coef: coef,
                ressources: ress, revenuTranche: ress / coef, plafond: null, bornes: [], borneProche: null, ecart: null, aLaLimite: false };
    if (!g) return out;
    var seuils = CONFIG_PTZ.SEUILS_TRANCHES[g];
    var bornes = seuils.map(function (s) { return Math.round(s * coef); });
    out.bornes = bornes;
    out.plafond = CONFIG_PTZ.PLAFONDS_RESSOURCES[g][Math.min(n, 8) - 1];
    for (var i = 0; i < bornes.length; i++) {
      if (ress <= bornes[i]) { out.tranche = i + 1; break; }
    }
    out.eligible = out.tranche !== null;
    var best = null, bestEcart = Infinity;
    for (var j = 0; j < bornes.length; j++) {
      var e = ress - bornes[j];
      if (Math.abs(e) < Math.abs(bestEcart)) { bestEcart = e; best = { tranche: j + 1, valeur: bornes[j] }; }
    }
    out.borneProche = best;
    out.ecart = bestEcart;
    out.aLaLimite = Math.abs(bestEcart) <= CONFIG_PTZ.LIMITE_RFR;
    return out;
  }
  function numeroTranche(p) { return tranche(p).tranche; }

  /* =================================================================
     §3c + §3d + §5 — Montant du PTZ
     entrées : { coutOperation, zone, occupants, tranche, nature, autresPrets, aFinancer }
       · autresPrets : montant connu des autres prêts ≥ 2 ans (si fourni) ;
       · aFinancer   : sinon, total à emprunter PTZ compris ; les autres prêts
                       valent alors aFinancer − PTZ, d'où PTZ ≤ aFinancer × k/(1+k)
                       (k = 1, ou 1,25 en tranche 1).
     → { base, plafondOperation, plafonneParOperation, quotite, montantTheorique,
         limiteAutresPrets, ratioAutresPrets, montant, plafonneParAutresPrets }
     ================================================================= */
  function montantPtz(p) {
    p = p || {};
    var g = grille(p.zone);
    var n = nbOccupants(p.occupants);
    var t = Number(p.tranche);
    var nature = (p.nature === 'individuel') ? 'individuel' : 'collectif';
    var cout = Math.max(0, num(p.coutOperation));
    var out = { zone: normaliserZone(p.zone), occupants: n, tranche: t, nature: nature, coutOperation: cout,
                base: 0, plafondOperation: null, plafonneParOperation: false, quotite: 0, montantTheorique: 0,
                limiteAutresPrets: null, ratioAutresPrets: null, montant: 0, plafonneParAutresPrets: false };
    if (!g || !(t >= 1 && t <= 4)) return out;
    out.plafondOperation = CONFIG_PTZ.PLAFONDS_OPERATION[g][Math.min(n, 5) - 1];
    out.plafonneParOperation = cout > out.plafondOperation;
    out.base = Math.min(cout, out.plafondOperation);
    out.quotite = CONFIG_PTZ.QUOTITES[nature][t - 1];
    out.montantTheorique = Math.round(out.base * out.quotite);
    var k = CONFIG_PTZ.RATIO_AUTRES_PRETS[t - 1];
    out.ratioAutresPrets = k;
    if (typeof p.autresPrets === 'number' && isFinite(p.autresPrets)) {
      out.limiteAutresPrets = Math.max(0, p.autresPrets) * k;
    } else if (typeof p.aFinancer === 'number' && isFinite(p.aFinancer)) {
      out.limiteAutresPrets = Math.max(0, p.aFinancer) * k / (1 + k);
    }
    var m = out.montantTheorique;
    if (out.limiteAutresPrets !== null && m > out.limiteAutresPrets) {
      m = out.limiteAutresPrets;
      out.plafonneParAutresPrets = true;
    }
    out.montant = Math.max(0, Math.round(m));
    return out;
  }

  /* =================================================================
     §4 — Échéancier du PTZ
     entrées : { montant, tranche, dureePrincipale }
     → { differe, remboursement, total, mensualitePtz, differeReduit,
         differeLegal, totalLegal, depasseLePrincipal, anneesSeul }
     Le différé légal est réduit pour aligner la fin du PTZ sur la fin du
     prêt principal (min DIFFERE_MIN) ; sur 25 ans rien ne change.
     ================================================================= */
  function echeancier(p) {
    p = p || {};
    var t = Number(p.tranche);
    var legal = CONFIG_PTZ.ECHEANCIER[t - 1];
    var montant = Math.max(0, num(p.montant));
    var dureeP = Number(p.dureePrincipale) || CONFIG_PTZ.DUREE_MAX_PTZ;
    if (!legal) return { tranche: t, differe: 0, remboursement: 0, total: 0, mensualitePtz: 0, differeReduit: false,
                         differeLegal: 0, totalLegal: 0, depasseLePrincipal: false, anneesSeul: 0 };
    var differe = legal.differe, remb = legal.remboursement, reduit = false;
    if (differe + remb > dureeP && differe > 0) {
      var cible = Math.max(CONFIG_PTZ.DIFFERE_MIN, dureeP - remb);
      if (cible < differe) { differe = cible; reduit = true; }
    }
    var total = differe + remb;
    return {
      tranche: t, montant: montant,
      differe: differe, remboursement: remb, total: total,
      mensualitePtz: remb > 0 ? montant / (remb * 12) : 0,
      differeReduit: reduit, differeLegal: legal.differe, totalLegal: legal.differe + legal.remboursement,
      dureePrincipale: dureeP,
      depasseLePrincipal: total > dureeP,
      anneesSeul: Math.max(0, total - dureeP)
    };
  }

  /* =================================================================
     Mensualité d'un prêt amortissable classique (hors assurance)
     ================================================================= */
  function mensualitePrincipale(capital, duree, taux) {
    var c = Math.max(0, num(capital)), n = Math.round(num(duree) * 12), r = num(taux) / 12;
    if (c <= 0 || n <= 0) return 0;
    if (r === 0) return c / n;
    return c * r / (1 - Math.pow(1 + r, -n));
  }

  /* =================================================================
     Lissage — mensualité totale constante (prêt principal à paliers + PTZ)
     entrées : { capitalPrincipal, duree, taux, ptz:{ montant, differe, remboursement, mensualitePtz } }
     → { lissee, mensualitePrincipale, mensualitePtz,
         phases:[{de, a, mois, mensualite, principal, ptz}]        (non lissé)
         phasesLissees:[…], phase2:{…} (phase non lissée la plus haute),
         queue:{de, a, mensualite}|null (PTZ seul après la fin du principal),
         paliersNegatifs, iterations, controle }
     Résolution numérique par bissection (précision 0,01 €) de M tel que la
     valeur actuelle des paiements (M − PTZ(m)) sur la durée du prêt principal
     soit égale au capital principal.
     ================================================================= */
  function lissage(p) {
    p = p || {};
    var capital = Math.max(0, num(p.capitalPrincipal));
    var duree = num(p.duree), taux = num(p.taux);
    var ptz = p.ptz || {};
    var N = Math.round(duree * 12), r = taux / 12;
    var d = Math.round(num(ptz.differe) * 12), f = d + Math.round(num(ptz.remboursement) * 12);
    var pM = (typeof ptz.mensualitePtz === 'number' && isFinite(ptz.mensualitePtz)) ? ptz.mensualitePtz
           : ((num(ptz.montant) > 0 && num(ptz.remboursement) > 0) ? num(ptz.montant) / (num(ptz.remboursement) * 12) : 0);
    var payPtz = function (m) { return (m > d && m <= f) ? pM : 0; };
    var mensP = mensualitePrincipale(capital, duree, taux);
    var q = 1 / (1 + r);
    var pv = function (M) {
      var s = 0, v = 1;
      for (var m = 1; m <= N; m++) { v *= q; s += (M - payPtz(m)) * v; }
      return s;
    };
    var lo = 0, hi = mensP + pM + 1, it = 0, M = 0;
    if (capital > 0 && N > 0) {
      while (hi - lo > 0.005 && it < 200) {
        var mid = (lo + hi) / 2;
        if (pv(mid) < capital) lo = mid; else hi = mid;
        it++;
      }
      M = (lo + hi) / 2;
    }
    var H = Math.max(N, f);
    var construire = function (fn) {
      var phases = [], cur = null;
      for (var m = 1; m <= H; m++) {
        var v = fn(m);
        var key = v.total.toFixed(4) + '|' + v.principal.toFixed(4);
        if (cur && cur.key === key) { cur.fin = m; }
        else { cur = { key: key, debut: m, fin: m, total: v.total, principal: v.principal, ptz: v.ptz }; phases.push(cur); }
      }
      return phases.map(function (ph) {
        return { de: Math.floor((ph.debut - 1) / 12) + 1, a: Math.ceil(ph.fin / 12), mois: ph.fin - ph.debut + 1,
                 mensualite: ph.total, principal: ph.principal, ptz: ph.ptz };
      });
    };
    var phases = construire(function (m) {
      var pr = m <= N ? mensP : 0, pz = payPtz(m);
      return { total: pr + pz, principal: pr, ptz: pz };
    });
    var phasesLissees = construire(function (m) {
      var pz = payPtz(m);
      if (m <= N) return { total: M, principal: M - pz, ptz: pz };
      return { total: pz, principal: 0, ptz: pz };
    });
    var phase2 = phases.length ? phases.reduce(function (a, b) { return b.mensualite > a.mensualite ? b : a; }, phases[0]) : null;
    return {
      lissee: M, mensualitePrincipale: mensP, mensualitePtz: pM, capitalPrincipal: capital, duree: duree, taux: taux,
      phases: phases, phasesLissees: phasesLissees, phase2: phase2,
      queue: f > N ? { de: Math.floor(N / 12) + 1, a: Math.ceil(f / 12), mensualite: pM } : null,
      paliersNegatifs: capital > 0 && M < pM,
      iterations: it, controle: capital > 0 ? pv(M) - capital : 0
    };
  }

  /* =================================================================
     Décision 6 — Assurance emprunteur sur le capital initial
     → { mensualite, annuelle, taux, capital, ageMax, tranche }
     ================================================================= */
  function tauxAssurance(ageMax) {
    var a = Number(ageMax), tr = CONFIG_PTZ.ASSURANCE.tranches;
    if (!isFinite(a) || a <= 0) return { taux: CONFIG_PTZ.ASSURANCE.tauxDefaut, tranche: null };
    for (var i = 0; i < tr.length; i++) if (a <= tr[i].ageMax) return { taux: tr[i].taux, tranche: tr[i] };
    return { taux: tr[tr.length - 1].taux, tranche: tr[tr.length - 1] };
  }
  function assuranceMensuelle(p) {
    p = p || {};
    var cap = Math.max(0, num(p.capital));
    var t = tauxAssurance(p.ageMax);
    return { mensualite: cap * t.taux / 12, annuelle: cap * t.taux, taux: t.taux, capital: cap,
             ageMax: (isFinite(Number(p.ageMax)) && Number(p.ageMax) > 0) ? Number(p.ageMax) : null, tranche: t.tranche };
  }

  /* =================================================================
     Décisions 1-3 — Le PTZ est-il possible avant même les 4 questions ?
     entrées : { projet, natureBien, logement, primo2ans }
       primo2ans = réponse à « Avez-vous été propriétaire de votre résidence
       principale au cours des 2 dernières années ? » : 'oui' → pas de PTZ.
     → { possible, statut, motif, motifTexte, nature }
     ================================================================= */
  function eligibilitePtz(e) {
    e = e || {};
    var nature = natureOperation(e.natureBien);
    var r = { possible: false, statut: null, motif: '', motifTexte: '', nature: nature };
    var non = function (statut, motif, texte) { r.statut = statut; r.motif = motif; r.motifTexte = texte; return r; };
    if (e.projet !== 'principale') return non('non_applicable', 'projet', 'Le PTZ est réservé à l’achat de la résidence principale.');
    if (!nature) {
      if (String(e.natureBien || '') === 'ancien') return non('non_applicable', 'ancien',
        'Dans l’ancien, le PTZ n’est possible qu’en zone B2 ou C avec d’importants travaux : le simulateur ne le calcule pas, votre courtier vérifiera vos aides.');
      return non('non_applicable', 'autre', 'Votre courtier vérifiera vos aides.');
    }
    if (e.logement === 'proprio') return non('ineligible', 'proprietaire',
      'Vous êtes propriétaire de votre logement actuel : pas de PTZ (sauf cas particuliers — invalidité, sinistre — à voir avec votre courtier).');
    if (e.primo2ans === 'oui') return non('ineligible', 'proprietaire_2ans',
      'Vous avez été propriétaire de votre résidence principale au cours des 2 dernières années : pas de PTZ (sauf cas particuliers — invalidité, sinistre — à voir avec votre courtier).');
    if (e.primo2ans !== 'non') return non('non_applicable', 'primo_inconnu', 'Condition de primo-accession non renseignée.');
    r.possible = true;
    return r;
  }
  function ptzPossible(e) { return eligibilitePtz(e).possible; }

  /* =================================================================
     Cœur du calcul pour une zone donnée (utilisé par simulerPtz et pour
     la fourchette quand la commune est inconnue).
     ================================================================= */
  function calculerCoeur(p) {
    var ress = ressourcesRetenues({ rfr: p.rfr, coutOperation: p.coutOperation });
    var tr = tranche({ ressources: ress.ressources, zone: p.zone, occupants: p.occupants });
    var out = { zone: normaliserZone(p.zone), ressources: ress, trancheDetail: tr, tranche: tr.tranche,
                montantDetail: null, montant: 0, echeancier: null, lissage: null };
    if (!tr.tranche) return out;
    var m = montantPtz({ coutOperation: p.coutOperation, zone: p.zone, occupants: p.occupants, tranche: tr.tranche,
                         nature: p.nature, autresPrets: p.autresPrets, aFinancer: p.aFinancer });
    out.montantDetail = m;
    out.montant = m.montant;
    if (!(m.montant > 0)) return out;
    var ech = echeancier({ montant: m.montant, tranche: tr.tranche, dureePrincipale: p.duree });
    out.echeancier = ech;
    out.lissage = lissage({ capitalPrincipal: p.aFinancer - m.montant, duree: p.duree, taux: p.taux,
                            ptz: { montant: m.montant, differe: ech.differe, remboursement: ech.remboursement, mensualitePtz: ech.mensualitePtz } });
    return out;
  }
  function fourchettePtz(p) {
    var zones = ['A', 'B1', 'B2', 'C'], parZone = {}, min = Infinity, max = -Infinity;
    zones.forEach(function (z) {
      var c = calculerCoeur({ zone: z, rfr: p.rfr, coutOperation: p.coutOperation, occupants: p.occupants, nature: p.nature,
                              autresPrets: p.autresPrets, aFinancer: p.aFinancer, duree: p.duree, taux: p.taux });
      parZone[z] = { montant: c.montant, tranche: c.tranche, lissee: c.lissage ? c.lissage.lissee : null };
      if (c.montant < min) min = c.montant;
      if (c.montant > max) max = c.montant;
    });
    return { min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 0, parZone: parZone };
  }

  /* =================================================================
     simulerPtz — l'orchestrateur.
     ENTRÉES (toutes optionnelles sauf celles marquées *) :
       projet*        'principale' | 'secondaire' | 'locatif' | 'renego'
       natureBien*    'neuf' (appartement neuf) | 'terrain' (terrain + construction) | 'ancien' | 'autre'
       logement       'locataire' | 'proprio' | 'gratuit' | 'fonction'
       primo2ans*     'oui' | 'non' — a été propriétaire de sa RP dans les 2 ans ?
       prix, travaux, apport, prixTerrain, prixConstruction, frais (montant, sinon calculé),
       aFinancer      (si absent : prix + travaux + frais − apport, comme index.html)
       zone           'Abis'|'A'|'B1'|'B2'|'C' | null (« je ne sais pas encore »)
       commune, codeInsee   (repris tels quels dans le recap)
       rfr, rfrSource 'declare' | 'estime' ; netMensuel (net mensuel du ménage, sert à
                      l'estimation 11 × et au contrôle de cohérence 8-14 ×)
       occupants      (sinon emprunteurs + enfants, sinon 1)
       duree, taux, ageMax, autresPrets (montant connu d'autres prêts ≥ 2 ans, rare),
       dateOffre      (date probable de l'offre, défaut aujourd'hui),
       revenus, charges (revenus pondérés et charges mensuels : si fournis, le
                      taux d'endettement assurance incluse et le plafond de feu sont calculés)
     SORTIE : voir l'objet `res` ci-dessous ; les clés principales sont
       statut, motif, motifTexte, eligible, aLaLimite, zone, tranche, montant,
       echeancier, mensualiteSansPtz, mensualiteAvecPtz (lissée), phases, phase2,
       assurance, endettement, textes, recap.
     ================================================================= */
  function simulerPtz(e) {
    e = e || {};
    var duree = Number(e.duree) || 25;
    var taux = (typeof e.taux === 'number' && isFinite(e.taux)) ? e.taux : (CONFIG_PTZ.TAUX_DEFAUT[duree] || 0.0345);
    var ageMax = (isFinite(Number(e.ageMax)) && Number(e.ageMax) > 0) ? Number(e.ageMax) : null;
    var natureBien = e.natureBien;
    var nature = natureOperation(natureBien);
    var travaux = Math.max(0, num(e.travaux)), apport = Math.max(0, num(e.apport));
    var prixTerrain = Math.max(0, num(e.prixTerrain)), prixConstruction = Math.max(0, num(e.prixConstruction));
    var prix = Math.max(0, num(e.prix));
    var prixBien = (natureBien === 'terrain' && (prixTerrain + prixConstruction) > 0) ? prixTerrain + prixConstruction : prix;
    var frais;
    if (typeof e.frais === 'number' && isFinite(e.frais)) frais = Math.max(0, e.frais);
    else if (natureBien === 'terrain' && (prixTerrain + prixConstruction) > 0) frais = prixTerrain * CONFIG_PTZ.FRAIS.terrain + prixConstruction * CONFIG_PTZ.FRAIS.construction;
    else if (nature === 'collectif') frais = prixBien * CONFIG_PTZ.FRAIS.neuf;
    else if (nature === 'individuel') frais = prixBien * CONFIG_PTZ.FRAIS.terrain;
    else frais = prixBien * CONFIG_PTZ.FRAIS.ancien;
    var coutOperation = prixBien + travaux;                     /* §5 : frais de notaire exclus */
    var aFinancer = (typeof e.aFinancer === 'number' && isFinite(e.aFinancer)) ? Math.max(0, e.aFinancer)
                  : Math.max(0, prixBien + travaux + frais - apport);
    var occupants = (e.occupants !== undefined && e.occupants !== null && e.occupants !== '')
                  ? nbOccupants(e.occupants)
                  : nbOccupants((parseInt(e.emprunteurs, 10) || 1) + (parseInt(e.enfants, 10) || 0));
    var zone = normaliserZone(e.zone);
    var annees = anneeRfr(e.dateOffre);
    var netMensuel = Math.max(0, num(e.netMensuel));

    /* --- RFR : déclaré, estimé (11 × net) ou inconnu --- */
    var rfr = Math.max(0, num(e.rfr));
    var rfrSource = (e.rfrSource === 'estime') ? 'estime' : 'declare';
    var rfrCoherent = null;
    if (rfrSource === 'estime' || !(rfr > 0)) {
      if (netMensuel > 0) { rfr = Math.round(CONFIG_PTZ.RFR_ESTIMATION_MULTIPLE * netMensuel); rfrSource = 'estime'; }
      else { rfr = 0; rfrSource = 'inconnu'; }
    } else if (netMensuel > 0) {
      var ratio = rfr / netMensuel;
      rfrCoherent = ratio >= CONFIG_PTZ.RFR_COHERENCE.min && ratio <= CONFIG_PTZ.RFR_COHERENCE.max;
    }
    var texteRfrIncoherent = 'Le revenu fiscal de référence déclaré (' + formaterEuros(rfr) + ') est éloigné de vos revenus nets actuels (' + formaterEuros(netMensuel) + '/mois) : à vérifier sur votre avis d’imposition ' + annees.anneeAvis + '.';

    var res = {
      statut: null, motif: '', motifTexte: '', eligible: false, calcule: false, aLaLimite: false,
      projet: e.projet || null, natureBien: natureBien || null, nature: nature, logement: e.logement || null, primo2ans: e.primo2ans || null,
      zone: zone, zoneLibelle: libelleZone(zone), zoneGrille: grille(zone), commune: e.commune || null, codeInsee: e.codeInsee || null,
      occupants: occupants, coef: coefficientFamilial(occupants),
      prix: prixBien, travaux: travaux, frais: frais, apport: apport, coutOperation: coutOperation, aFinancer: aFinancer,
      rfr: rfr, rfrSource: rfrSource, rfrCoherent: rfrCoherent, netMensuel: netMensuel,
      anneeRevenus: annees.anneeRevenus, anneeAvis: annees.anneeAvis, anneeOffre: annees.anneeOffre, baremesValables: annees.baremesValables,
      ressources: null, plancher: null, plancherApplique: false,
      tranche: null, trancheDetail: null,
      montant: null, montantTheorique: null, plafondOperation: null, quotite: null, plafonneParAutresPrets: false, plafonneParOperation: false,
      echeancier: null, differe: null, remboursement: null,
      duree: duree, taux: taux,
      mensualiteSansPtz: null, mensualitePrincipale: null, mensualitePtz: null,
      lissage: null, mensualiteAvecPtz: null, phases: null, phase2: null, queue: null, differeReduit: false,
      assurance: null, mensualiteSansPtzAssurance: null, mensualiteAvecPtzAssurance: null,
      fourchette: null, endettement: null, ineligibleSurRfrEstime: false, textes: {}, recap: {},
      config: { version: CONFIG_PTZ.version, mention: CONFIG_PTZ.mention, valableJusquAu: CONFIG_PTZ.valableJusquAu, zonageDate: CONFIG_PTZ.zonage.date }
    };
    var poser = function (statut, motif, texte) { res.statut = statut; res.motif = motif; res.motifTexte = texte; };

    /* --- 1. Préalables (projet, nature, propriétaire, primo) --- */
    var pre = eligibilitePtz({ projet: e.projet, natureBien: natureBien, logement: e.logement, primo2ans: e.primo2ans });
    if (!pre.possible) poser(pre.statut, pre.motif, pre.motifTexte);
    else if (aFinancer <= 0) poser('ineligible', 'sans_pret', 'Aucun emprunt nécessaire : le PTZ complète obligatoirement un autre prêt.');

    /* --- 2. Zone inconnue (« je ne sais pas encore ») : fourchette, pas de montant --- */
    if (!res.statut && !zone) {
      /* Deux cas distincts (06/09/2026) : la commune n'a pas été saisie (« je ne sais
         pas encore »), ou elle l'a été mais sa zone reste introuvable (fichier de
         département absent, commune hors table). On ne dit plus « non renseignée »
         à quelqu'un qui vient de la renseigner. */
      if (res.commune || res.codeInsee) {
        poser('a_verifier', 'zone_introuvable', 'Zone introuvable pour ' + (res.commune || 'la commune saisie') +
          (res.codeInsee ? ' (' + res.codeInsee + ')' : '') + ' : votre courtier la vérifiera. La zone (A bis, A, B1, B2, C) fixe le montant du PTZ.');
      } else {
        poser('a_verifier', 'zone_inconnue', 'Commune non renseignée : la zone (A bis, A, B1, B2, C) fixe le montant du PTZ. Votre courtier le calculera avec vous.');
      }
      if (rfrSource !== 'inconnu') {
        res.fourchette = fourchettePtz({ rfr: rfr, coutOperation: coutOperation, occupants: occupants, nature: nature,
                                         autresPrets: (typeof e.autresPrets === 'number') ? e.autresPrets : undefined,
                                         aFinancer: aFinancer, duree: duree, taux: taux });
      }
    }

    /* --- 3. RFR inconnu et aucun revenu net : impossible d'estimer --- */
    if (!res.statut && rfrSource === 'inconnu') {
      poser('a_verifier', 'rfr_inconnu', 'Revenu fiscal de référence non renseigné et revenus nets inconnus : PTZ à vérifier avec votre courtier.');
    }

    /* --- 4. Calcul --- */
    if (!res.statut) {
      var coeur = calculerCoeur({ zone: zone, rfr: rfr, coutOperation: coutOperation, occupants: occupants, nature: nature,
                                  autresPrets: (typeof e.autresPrets === 'number') ? e.autresPrets : undefined,
                                  aFinancer: aFinancer, duree: duree, taux: taux });
      res.ressources = coeur.ressources.ressources;
      res.plancher = coeur.ressources.plancher;
      res.plancherApplique = coeur.ressources.plancherApplique;
      res.trancheDetail = coeur.trancheDetail;
      res.tranche = coeur.tranche;
      res.aLaLimite = !!coeur.trancheDetail.aLaLimite;
      if (!coeur.tranche) {
        var plafondTxt = formaterEuros(coeur.trancheDetail.plafond) + ' pour ' + occupants + ' personne' + (occupants > 1 ? 's' : '') + ' en zone ' + libelleZone(zone);
        /* Cohérence du RFR AVANT l'éligibilité (06/09/2026) : un RFR déclaré hors
           de 8 à 14 × le net mensuel n'est pas fiable, même au-dessus du plafond →
           « à vérifier » (plafond orange), jamais « inéligible » en silence. */
        if (rfrCoherent === false) poser('a_verifier', 'rfr_incoherent',
          texteRfrIncoherent + ' Tel que déclaré, il dépasse le plafond PTZ de ' + plafondTxt + ' : le PTZ ne sera calculé qu’une fois ce revenu confirmé.');
        else poser('ineligible', 'ressources',
          'Vos ressources (' + formaterEuros(coeur.ressources.ressources) + (coeur.ressources.plancherApplique ? ', revenu plancher = coût de l’opération ÷ 9' : '') +
          ') dépassent le plafond PTZ de ' + plafondTxt + (res.aLaLimite ? ' — à la limite, votre courtier vérifiera' : '') + '.');
      } else {
        var md = coeur.montantDetail;
        res.montantTheorique = md.montantTheorique;
        res.plafondOperation = md.plafondOperation;
        res.quotite = md.quotite;
        res.plafonneParAutresPrets = md.plafonneParAutresPrets;
        res.plafonneParOperation = md.plafonneParOperation;
        if (!(coeur.montant > 0)) {
          poser('ineligible', 'montant_nul', 'Le montant de PTZ calculé est nul.');
        } else {
          res.montant = coeur.montant;
          res.eligible = true; res.calcule = true;
          res.echeancier = coeur.echeancier;
          res.differe = coeur.echeancier.differe;
          res.remboursement = coeur.echeancier.remboursement;
          res.differeReduit = coeur.echeancier.differeReduit;
          res.lissage = coeur.lissage;
          res.mensualitePrincipale = coeur.lissage.mensualitePrincipale;
          res.mensualitePtz = coeur.lissage.mensualitePtz;
          res.mensualiteAvecPtz = coeur.lissage.lissee;
          res.phases = coeur.lissage.phases;
          res.phase2 = coeur.lissage.phase2;
          res.queue = coeur.lissage.queue;
          if (rfrSource === 'estime') poser('estime', 'rfr_estime', 'Revenu fiscal de référence estimé à ' + CONFIG_PTZ.RFR_ESTIMATION_MULTIPLE + ' × vos revenus nets mensuels.');
          else if (rfrCoherent === false) poser('a_verifier', 'rfr_incoherent', texteRfrIncoherent);
          else poser('ok', 'ok', 'PTZ calculé sur le revenu fiscal de référence déclaré.');
        }
      }
    }
    if (!annees.baremesValables && res.statut !== 'non_applicable') {
      res.motifTexte += ' Attention : la date probable de l’offre dépasse la validité des barèmes (' + CONFIG_PTZ.valableJusquAu + ').';
    }

    /* --- 5. Mensualités et assurance (calculées quel que soit le statut) --- */
    res.mensualiteSansPtz = mensualitePrincipale(aFinancer, duree, taux);
    var ass = assuranceMensuelle({ capital: aFinancer, ageMax: ageMax });
    res.assurance = {
      mensualite: ass.mensualite, annuelle: ass.annuelle, taux: ass.taux, ageMax: ass.ageMax, capital: aFinancer,
      principal: res.calcule ? (aFinancer - res.montant) * ass.taux / 12 : ass.mensualite,
      ptz: res.calcule ? res.montant * ass.taux / 12 : 0,
      libelleTranche: ass.tranche ? ass.tranche.libelle : 'âge inconnu (taux par défaut)'
    };
    res.mensualiteSansPtzAssurance = res.mensualiteSansPtz + ass.mensualite;
    res.mensualiteAvecPtzAssurance = res.calcule ? res.mensualiteAvecPtz + ass.mensualite : null;

    /* --- 6. Endettement et plafond de feu (décision 7), si revenus fournis --- */
    var revenus = Math.max(0, num(e.revenus)), charges = Math.max(0, num(e.charges));
    if (revenus > 0) {
      var tSans = (res.mensualiteSansPtz + ass.mensualite + charges) / revenus;
      var tLisse = res.calcule ? (res.mensualiteAvecPtz + ass.mensualite + charges) / revenus : null;
      var tPhase2 = res.calcule ? (res.phase2.mensualite + ass.mensualite + charges) / revenus : null;
      var tRetenu = res.calcule ? tLisse : tSans;
      var plafondFeu = 'vert';
      var raisons = [];
      if (res.statut === 'estime' || res.statut === 'a_verifier') { plafondFeu = 'orange'; raisons.push('PTZ ' + (res.statut === 'estime' ? 'estimé' : 'à vérifier')); }
      if (tPhase2 !== null && tPhase2 > CONFIG_PTZ.ENDETTEMENT.orange) {
        plafondFeu = 'orange';
        raisons.push('phase 2 non lissée : dépasserait ' + formaterPct(CONFIG_PTZ.ENDETTEMENT.orange, 0) +
                     ' (' + formaterPctDepassement(tPhase2, CONFIG_PTZ.ENDETTEMENT.orange) + ')');
      }
      var lim = CONFIG_PTZ.LIMITE_ENDETTEMENT;
      var feuALaLimite = Math.abs(tRetenu - CONFIG_PTZ.ENDETTEMENT.vert) <= lim || Math.abs(tRetenu - CONFIG_PTZ.ENDETTEMENT.orange) <= lim;
      /* Phase 2 non lissée entre 39,5 % et 40 % : « à la limite » (texte seul,
         le feu ne change pas) ; au-delà de 40 %, c'est le plafond orange ci-dessus. */
      var phase2ALaLimite = tPhase2 !== null && tPhase2 <= CONFIG_PTZ.ENDETTEMENT.orange && tPhase2 >= CONFIG_PTZ.ENDETTEMENT.orange - lim;
      res.endettement = { revenus: revenus, charges: charges, sansPtz: tSans, lisse: tLisse, phase2: tPhase2, retenu: tRetenu,
                          plafondFeu: plafondFeu, raisonsPlafond: raisons, aLaLimite: feuALaLimite, phase2ALaLimite: phase2ALaLimite, assuranceIncluse: true };
    }

    /* RFR ESTIMÉ (11 × net) au-dessus du plafond : le prospect n'a pas saisi son
       revenu fiscal, on ne l'écarte pas en silence — « probablement non éligible »
       et la porte reste ouverte si son RFR réel est plus bas (06/09/2026). */
    res.ineligibleSurRfrEstime = res.statut === 'ineligible' && res.motif === 'ressources' &&
      rfrSource === 'estime' && !!res.trancheDetail && rfr > res.trancheDetail.plafond;

    /* --- 7. Textes prêts à afficher --- */
    var T = res.textes;
    T.mention = CONFIG_PTZ.TEXTE_MENTION;
    T.baremes = CONFIG_PTZ.mention;
    T.occupation = 'Le logement doit rester votre résidence principale pendant 6 ans (au moins 8 mois par an) : une vente ou une mise en location avant ce terme entraîne le remboursement anticipé du PTZ.';
    T.assurance = 'Assurance estimée : ' + formaterEuros(ass.mensualite) + '/mois (' + formaterPct(ass.taux) + ' par an du capital emprunté' +
                  (ass.ageMax ? ', emprunteur le plus âgé ' + ass.ageMax + ' ans' : '') + '), incluse dans le taux d’endettement.';
    T.motif = res.motifTexte;
    if (res.calcule) {
      var ech = res.echeancier;
      var lieu = res.commune ? 'la commune ' + deCommune(res.commune) + ' (zone ' + res.zoneLibelle + ')' : 'la zone ' + res.zoneLibelle;
      var rfrTxt = rfrSource === 'estime'
        ? 'un revenu fiscal de référence estimé à ' + formaterEuros(rfr) + ' (' + CONFIG_PTZ.RFR_ESTIMATION_MULTIPLE + ' × vos revenus nets mensuels)'
        : 'un revenu fiscal de référence de ' + formaterEuros(rfr);
      var remb = ech.differe > 0
        ? 'sans mensualité pendant ' + ech.differe + ' ans'
        : 'remboursé sur ' + ech.remboursement + ' ans dès le premier mois';
      T.ligne = 'Votre PTZ estimé : ' + formaterEuros(res.montant) + ' à 0 %, ' + remb + ', calculé sur ' + lieu + ' et ' + rfrTxt +
                ' — à confirmer par votre courtier sur votre avis d’imposition ' + annees.anneeAvis;
      T.titre = formaterEuros(res.mensualiteAvecPtz) + ' /mois avec PTZ lissé (estimation)';
      T.sansPtz = 'sans PTZ : ' + formaterEuros(res.mensualiteSansPtz);
      T.sansLissage = 'si la banque ne lisse pas : ' + res.phases.map(function (ph, i) {
        var n = ph.a - ph.de + 1;
        return (i === 0 ? '' : 'puis ') + formaterEuros(ph.mensualite) + ' pendant ' + n + ' an' + (n > 1 ? 's' : '');
      }).join(', ');
      if (ech.differeReduit) {
        T.duree = 'Sur ' + duree + ' ans, le différé du PTZ est réduit de ' + ech.differeLegal + ' à ' + ech.differe + ' ans pour aligner les deux prêts (convention du simulateur, 2 ans minimum)' +
                  (ech.anneesSeul > 0 ? ' ; le PTZ se rembourse seul pendant ' + ech.anneesSeul + ' an' + (ech.anneesSeul > 1 ? 's' : '') + ' après la fin du prêt principal' : '') +
                  ' ; votre courtier vérifiera le montage.';
      }
      if (res.plafonneParAutresPrets) T.autresPrets = 'Un apport très élevé réduit le PTZ (il ne peut pas dépasser ' + (res.tranche === 1 ? '1,25 fois ' : '') + 'le montant des autres prêts) ; votre courtier peut arbitrer apport et épargne.';
      if (res.plancherApplique) T.plancher = 'Revenu plancher appliqué : le coût de l’opération ÷ 9 (' + formaterEuros(res.plancher) + ') dépasse votre revenu fiscal de référence.';
      /* Les textes « limite » sont affichés par index.html derrière le préfixe
         « À la limite : » — ils ne le répètent donc pas. */
      if (res.aLaLimite) {
        var bp = res.trancheDetail.borneProche || {};
        T.limite = (res.plancherApplique ? 'vos ressources retenues sont à ' : 'votre revenu fiscal de référence est à ') + formaterEuros(Math.abs(res.trancheDetail.ecart)) +
                   ' d’une borne de tranche du PTZ ; cet écart peut changer le montant du prêt' + (bp.tranche === 4 ? ', voire l’éligibilité' : '') + '.';
      }
      if (res.endettement && res.endettement.phase2ALaLimite) {
        T.phase2Limite = 'si la banque ne lisse pas, votre endettement en phase 2 atteindrait ' + formaterPct(res.endettement.phase2, 1) +
                         ', tout près du seuil de ' + formaterPct(CONFIG_PTZ.ENDETTEMENT.orange, 0) + '.';
      }
    } else if (res.fourchette && res.fourchette.max > 0) {
      T.fourchette = 'PTZ possible entre ' + formaterEuros(res.fourchette.min) + ' et ' + formaterEuros(res.fourchette.max) + ' selon la commune (zone) — indiquez-la à votre courtier.';
    } else if (res.statut === 'ineligible' && res.motif === 'ressources' && res.aLaLimite && res.trancheDetail) {
      /* Au-dessus du plafond de moins de 500 € : une ligne pour le prospect, feu inchangé. */
      T.limite = (res.plancherApplique ? 'vos ressources retenues dépassent' : 'votre revenu fiscal de référence dépasse') + ' le plafond du PTZ de ' +
                 formaterEuros(res.ressources - res.trancheDetail.plafond) + ' seulement — à vérifier avec votre courtier.';
    }
    if (res.ineligibleSurRfrEstime) {
      T.ineligibleEstime = 'D’après une estimation de votre revenu fiscal (' + formaterEuros(rfr) + ', ' + CONFIG_PTZ.RFR_ESTIMATION_MULTIPLE +
        ' × vos revenus nets mensuels), vous dépassez le plafond de ' + formaterEuros(res.trancheDetail.plafond) + ' pour ' + occupants +
        ' personne' + (occupants > 1 ? 's' : '') + ' en zone ' + libelleZone(zone) + '. Si votre revenu fiscal de référence réel est inférieur à ' +
        formaterEuros(res.trancheDetail.plafond) + ', vérifiez avec votre courtier.';
    }

    /* --- 8. Récapitulatif pour le Worker et le courtier (décision 10) --- */
    var STATUT_LIB = {
      ok: 'Calculé sur le RFR déclaré — à confirmer par le courtier',
      estime: 'Estimé (RFR non saisi, 11 × revenus nets) — à confirmer par le courtier',
      a_verifier: 'À vérifier',
      ineligible: 'Inéligible',
      non_applicable: 'Non concerné'
    };
    var MOTIF_LIB = {
      projet: 'pas une résidence principale', ancien: 'logement ancien (non simulé)', autre: 'type de bien « autre » (aides à vérifier par le courtier)',
      proprietaire: 'propriétaire de son logement actuel', proprietaire_2ans: 'propriétaire de sa RP dans les 2 dernières années',
      primo_inconnu: 'primo-accession non renseignée', sans_pret: 'aucun emprunt', zone_inconnue: 'commune non renseignée',
      zone_introuvable: 'zone introuvable',
      rfr_inconnu: 'RFR et revenus inconnus', ressources: 'ressources au-dessus du plafond', montant_nul: 'montant nul',
      rfr_estime: 'RFR estimé', rfr_incoherent: 'RFR incohérent avec les revenus nets', ok: ''
    };
    var statutTexte = STATUT_LIB[res.statut] || res.statut;
    var motifLib = MOTIF_LIB[res.motif];
    if (res.motif === 'zone_introuvable') motifLib = 'zone introuvable pour ' + (res.commune || 'la commune saisie');
    if (res.statut !== 'ok' && res.statut !== 'estime' && motifLib) statutTexte += ' (' + motifLib + ')';
    if (res.aLaLimite) statutTexte += ' — à la limite d’une tranche';
    if (res.ineligibleSurRfrEstime) statutTexte = 'Probablement inéligible (RFR estimé) — à vérifier';
    var communeTxt = res.commune ? res.commune : (res.statut === 'non_applicable' ? '—' : 'Ne sait pas encore');
    res.recap = {
      ptz_eligible: res.calcule ? 'Oui' : (res.statut === 'non_applicable' ? 'Non concerné' : (res.statut === 'a_verifier' ? 'À vérifier' : 'Non')),
      ptz_montant: res.calcule ? formaterEuros(res.montant) : (res.fourchette && res.fourchette.max > 0 ? 'entre ' + formaterEuros(res.fourchette.min) + ' et ' + formaterEuros(res.fourchette.max) + ' selon la zone' : '—'),
      ptz_tranche: res.tranche ? 'Tranche ' + res.tranche : '—',
      ptz_differe: res.calcule ? (res.differe > 0 ? res.differe + ' ans (puis ' + res.remboursement + ' ans de remboursement)' : 'Aucun (' + res.remboursement + ' ans de remboursement)') + (res.differeReduit ? ' — différé réduit pour s’aligner sur ' + duree + ' ans' : '') : '—',
      ptz_zone: res.statut === 'non_applicable' ? '—' : (res.zoneLibelle || (res.motif === 'zone_introuvable' ? 'Introuvable' : 'Inconnue')),
      ptz_commune: communeTxt,
      ptz_code_insee: res.codeInsee ? String(res.codeInsee) : '—',
      ptz_rfr: (rfrSource !== 'inconnu' && res.statut !== 'non_applicable') ? formaterEuros(rfr) : '—',
      ptz_rfr_source: res.statut === 'non_applicable' ? '—' : (rfrSource === 'declare' ? 'Déclaré (avis ' + annees.anneeAvis + ', revenus ' + annees.anneeRevenus + ')' : (rfrSource === 'estime' ? 'Estimé (' + CONFIG_PTZ.RFR_ESTIMATION_MULTIPLE + ' × revenus nets mensuels)' : 'Inconnu')),
      ptz_occupants: res.statut === 'non_applicable' ? '—' : String(occupants),
      mensualite_sans_ptz: formaterEuros(res.mensualiteSansPtz) + ' (hors assurance)',
      mensualite_avec_ptz: res.calcule ? formaterEuros(res.mensualiteAvecPtz) + ' (lissée, hors assurance)' : '—',
      assurance_mensuelle: formaterEuros(ass.mensualite) + '/mois (' + formaterPct(ass.taux) + ' du capital' + (ass.ageMax ? ', ' + ass.ageMax + ' ans' : '') + ')',
      ptz_statut: statutTexte,
      ptz_sans_lissage: res.calcule ? T.sansLissage.replace(/^si la banque ne lisse pas : /, '') : '—'
    };
    return res;
  }

  /* =================================================================
     Export
     ================================================================= */
  var PTZ = {
    version: '1.2.0 (06/09/2026) — zone introuvable distinguée de la commune non renseignée, dépassement du seuil de 40 % à deux décimales, RFR estimé au-dessus du plafond',
    CONFIG_PTZ: CONFIG_PTZ,
    CONFIG: CONFIG_PTZ,
    zonePourCode: zonePourCode,
    zonePourCommune: zonePourCode,
    departementPourCode: departementPourCode,
    fichierZones: fichierZones,
    normaliserZone: normaliserZone,
    libelleZone: libelleZone,
    anneeRfr: anneeRfr,
    ressourcesRetenues: ressourcesRetenues,
    tranche: tranche,
    numeroTranche: numeroTranche,
    coefficientFamilial: coefficientFamilial,
    natureOperation: natureOperation,
    montantPtz: montantPtz,
    echeancier: echeancier,
    mensualitePrincipale: mensualitePrincipale,
    lissage: lissage,
    tauxAssurance: tauxAssurance,
    assuranceMensuelle: assuranceMensuelle,
    eligibilitePtz: eligibilitePtz,
    ptzPossible: ptzPossible,
    calculerCoeur: calculerCoeur,
    fourchettePtz: fourchettePtz,
    simulerPtz: simulerPtz,
    formaterEuros: formaterEuros,
    formaterPct: formaterPct,
    formaterPctDepassement: formaterPctDepassement,
    deCommune: deCommune
  };
  root.PTZ = PTZ;
  if (typeof module !== 'undefined' && module.exports) module.exports = PTZ;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
