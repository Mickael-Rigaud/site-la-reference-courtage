/* =====================================================================
   moteur.js — ce que le simulateur de regroupement calcule
   ---------------------------------------------------------------------
   Rien ici ne touche à l'écran. Ce fichier prend les réponses et rend
   des nombres ; `vue.js` les met en page. Les deux se relisent donc
   séparément, et une erreur de calcul ne se cache pas derrière une
   question de mise en forme.

   CE QU'IL REND, ET DANS CET ORDRE D'IMPORTANCE
   La doctrine est écrite noir sur blanc sur la page « Regroupement de
   crédits » du site, et ce moteur ne fait que l'appliquer :

     « alléger la mensualité passe le plus souvent par un allongement de
       la durée, donc par un coût total plus élevé. […] Nous vous
       présentons systématiquement la mensualité, la durée et le coût
       total côte à côte. »

   Une fonction qui ne rendrait que la nouvelle mensualité trahirait
   cette phrase. `scenarios()` rend donc toujours les trois ensemble, et
   `surcout` — ce que l'allègement coûte en plus — n'est jamais
   optionnel.
   ===================================================================== */

/* =====================================================================
   ⚠ BLOC À VALIDER PAR MICKAEL — AUCUN DE CES CHIFFRES N'EST DE MOI
   ---------------------------------------------------------------------
   Tant que `VALIDE` vaut false, la page affiche le parcours et le feu
   mais BARRE les montants, avec un avertissement visible. C'est
   volontairement structurel : un barème oublié ne peut pas se publier
   en silence et engager l'agence sur des mensualités inventées.
   Passer `VALIDE` à true est un geste délibéré, à faire le jour où les
   taux ci-dessous sont les siens.
   ===================================================================== */
export const BAREME = {
  VALIDE: false,
  DATE: '24/11/2026',   // affichée à côté du résultat : « taux indicatifs au … »

  /* Taux annuels, hors assurance. Deux familles, parce qu'une opération
     adossée à un bien ne se finance pas au même prix qu'un rachat de
     crédits à la consommation seul. */
  TAUX: {
    sans_garantie: { 7: null, 10: null, 12: null },
    hypothecaire:  { 15: null, 20: null, 25: null },
  },

  /* Le taux d'endettement au-delà duquel l'opération n'est plus tenable.
     ⚠ CE N'EST PAS LE 35 % DU PRÊT IMMOBILIER. Les établissements
     spécialisés en regroupement vont plus haut, en regardant le reste à
     vivre. Le chiffre retenu décide de la couleur du feu : il engage
     l'agence, il doit être celui de Mickael. */
  ENDETTEMENT_CIBLE: null,   // ex. 0.40 — en dessous : feu vert
  ENDETTEMENT_MAX: null,     // ex. 0.50 — au-delà : feu rouge

  /* Reste à vivre minimum par mois, après la nouvelle mensualité.
     Par personne au foyer, enfants compris. Un dossier peut afficher un
     endettement correct et ne pas tenir : c'est ce garde-fou qui le dit. */
  RESTE_A_VIVRE_PAR_PERSONNE: null,   // ex. 500

  /* Plafond au-delà duquel un rachat sans garantie n'est plus possible
     et l'opération devient nécessairement hypothécaire. */
  PLAFOND_SANS_GARANTIE: null,   // ex. 100000

  /* Frais de l'opération, ajoutés au capital racheté : frais de dossier
     et de courtage, plus les frais de garantie quand il y en a une. */
  FRAIS: { sans_garantie: null, hypothecaire: null },   // ex. 0.05 et 0.08
};

/* Le barème est-il utilisable ? Une seule case vide suffit à le dire non :
   un barème à moitié rempli produirait des chiffres justes sur certaines
   durées et des trous sur les autres, ce qui est pire qu'un refus franc. */
export function baremeComplet() {
  if (!BAREME.VALIDE) return false;
  const nombres = [
    BAREME.ENDETTEMENT_CIBLE, BAREME.ENDETTEMENT_MAX,
    BAREME.RESTE_A_VIVRE_PAR_PERSONNE, BAREME.PLAFOND_SANS_GARANTIE,
    BAREME.FRAIS.sans_garantie, BAREME.FRAIS.hypothecaire,
    ...Object.values(BAREME.TAUX.sans_garantie),
    ...Object.values(BAREME.TAUX.hypothecaire),
  ];
  return nombres.every((v) => typeof v === 'number' && isFinite(v) && v > 0);
}

/* ------------------------------------------------------------------ */
/* 1. Arithmétique d'un prêt                                           */
/* ------------------------------------------------------------------ */

/** Mensualité d'un prêt amortissable. `taux` annuel, `mois` entier. */
export function mensualite(capital, taux, mois) {
  if (!(capital > 0) || !(mois > 0)) return 0;
  const i = taux / 12;
  /* ⚠ LE CAS À TAUX ZÉRO N'EST PAS THÉORIQUE : un prêt employeur ou un
     prêt familial figure dans l'inventaire à 0 %. La formule générale
     divise alors par zéro et rend l'infini, qui s'affiche « Infinity € »
     sur la page. */
  if (i === 0) return capital / mois;
  return (capital * i) / (1 - Math.pow(1 + i, -mois));
}

/** Nombre de mois restants, déduit du capital, de la mensualité et du taux. */
export function dureeRestante(capital, mensu, taux) {
  if (!(capital > 0) || !(mensu > 0)) return 0;
  const i = taux / 12;
  if (i === 0) return Math.ceil(capital / mensu);
  /* ⚠ UNE MENSUALITÉ QUI NE COUVRE PAS LES INTÉRÊTS NE REMBOURSE RIEN :
     le logarithme reçoit alors un nombre négatif et rend NaN. Le cas
     existe (un crédit renouvelable au minimum mensuel), et il mérite
     d'être signalé plutôt que calculé. */
  if (mensu <= capital * i) return null;
  return Math.ceil(Math.log(mensu / (mensu - capital * i)) / Math.log(1 + i));
}

/**
 * Le taux d'un crédit dont on connaît le capital, la mensualité et la durée.
 *
 * ⚠ C'EST UNE ESTIMATION, ET L'ÉCRAN DOIT LE DIRE. On la calcule quand le
 * visiteur a répondu « je ne sais pas » au taux — ce qui est le cas le
 * plus fréquent, personne ne connaît ses taux de tête. Elle vaut mieux
 * qu'un trou dans le calcul, elle ne vaut pas un relevé de prêt.
 *
 * Résolution par dichotomie : l'équation n'a pas de solution analytique,
 * et une dichotomie sur 60 tours donne mieux que le centième de point.
 */
export function tauxEstime(capital, mensu, mois) {
  if (!(capital > 0) || !(mensu > 0) || !(mois > 0)) return null;
  /* Sans intérêts du tout, il faudrait au moins ça par mois. Si la
     mensualité déclarée est plus basse, les chiffres sont incohérents :
     on ne devine pas, on le dit. */
  if (mensu * mois <= capital) return null;
  let bas = 0, haut = 1;   // de 0 % à 100 % l'an : aucun crédit n'en sort
  for (let k = 0; k < 60; k++) {
    const mid = (bas + haut) / 2;
    if (mensualite(capital, mid, mois) > mensu) haut = mid; else bas = mid;
  }
  return (bas + haut) / 2;
}

/* ------------------------------------------------------------------ */
/* 2. L'inventaire des crédits                                         */
/* ------------------------------------------------------------------ */

/**
 * Complète chaque crédit déclaré : ce qui manque est estimé, et marqué.
 *
 * ⚠ CHAQUE LIGNE SAIT SI ELLE EST SÛRE. `estime` porte la liste de ce
 * qui a été deviné. L'écran s'en sert pour poser une mention à côté du
 * chiffre : un total qui mélange du déclaré et du deviné sans le dire
 * serait lu comme un devis.
 */
export function completer(credits) {
  return (credits || []).map((c) => {
    const capital = Number(c.capital) || 0;
    const mensu = Number(c.mensualite) || 0;
    let taux = (typeof c.taux === 'number' && c.taux >= 0) ? c.taux : null;
    let mois = (typeof c.mois === 'number' && c.mois > 0) ? c.mois : null;
    const estime = [];

    if (taux === null && mois !== null) {
      taux = tauxEstime(capital, mensu, mois);
      if (taux !== null) estime.push('taux');
    } else if (mois === null && taux !== null) {
      mois = dureeRestante(capital, mensu, taux);
      if (mois !== null) estime.push('duree');
    } else if (taux === null && mois === null) {
      /* ⚠ NI L'UN NI L'AUTRE : deux inconnues, une seule équation. On ne
         peut pas résoudre, et prétendre le contraire en posant un taux
         « moyen » fabriquerait un chiffre qui a l'air d'un calcul. On
         rend la durée SANS INTÉRÊTS, qui est forcément trop courte, et
         on marque la ligne comme approchée : l'écran dira que le gain
         réel est au moins celui-là. */
      mois = mensu > 0 ? Math.ceil(capital / mensu) : null;
      estime.push('taux', 'duree');
    }

    /* ⚠ UN PRÊT IMMOBILIER PEUT ÊTRE CONSERVÉ À PART, et la page du site
       le promet : « Prêt immobilier — intégré au regroupement ou
       conservé à part ». Conservé, il ne rejoint pas le capital racheté
       mais sa mensualité continue de peser sur le budget. Confondre les
       deux cas fausse tout : soit on gonfle le capital à financer, soit
       on oublie une charge et on annonce un feu vert imméritable. */
    const integre = !(c.type === 'immo' && String(c.integre) === 'non');

    return {
      ...c,
      capital, mensualite: mensu, taux, mois, estime, integre,
      /* Ce que ce crédit coûte encore si on n'y touche pas. */
      restantAPayer: (mois && mensu) ? Math.round(mois * mensu) : capital,
    };
  });
}

/** Les totaux de l'inventaire, en séparant ce qu'on rachète de ce qu'on garde. */
export function totaux(credits) {
  const l = completer(credits);
  const rachetes = l.filter((c) => c.integre);
  const conserves = l.filter((c) => !c.integre);
  const somme = (t, f) => Math.round(t.reduce((s, c) => s + f(c), 0));

  return {
    lignes: l, rachetes, conserves,
    nombre: l.length,
    /* `capital` et `restantAPayer` ne portent QUE les crédits rachetés :
       ce sont eux qui entrent dans l'opération, et eux seuls qu'il est
       juste de comparer au nouveau prêt. */
    capital: somme(rachetes, (c) => c.capital),
    mensualite: somme(rachetes, (c) => c.mensualite),
    restantAPayer: somme(rachetes, (c) => c.restantAPayer),
    /* Les charges qui survivent à l'opération. Elles ne disparaissent pas
       du budget : elles s'ajoutent à la nouvelle mensualité. */
    mensualiteConservee: somme(conserves, (c) => c.mensualite),
    /* Le total réellement payé chaque mois aujourd'hui, les deux groupes
       confondus — c'est ce chiffre-là que le visiteur reconnaît. */
    mensualiteActuelle: somme(l, (c) => c.mensualite),
    /* La plus longue échéance qui reste parmi les crédits rachetés :
       c'est l'horizon actuel, et le point de comparaison honnête d'un
       regroupement qui allonge. */
    horizon: rachetes.reduce((m, c) => Math.max(m, c.mois || 0), 0),
    approximatif: l.some((c) => c.estime.length > 0),
  };
}

/* ------------------------------------------------------------------ */
/* 3. L'opération                                                      */
/* ------------------------------------------------------------------ */

/**
 * Hypothécaire ou non ? Ce n'est pas un choix, c'est une conséquence.
 *
 * ⚠ ON NE DEMANDE PAS AU VISITEUR DE TRANCHER : il n'a pas à connaître
 * la différence. Elle se déduit de ce qu'il a déclaré — un prêt
 * immobilier à racheter, ou un montant qui dépasse ce qu'un rachat sans
 * garantie permet, imposent la garantie.
 */
export function nature(d, totalCapital) {
  /* ⚠ SEUL UN PRÊT IMMOBILIER RACHETÉ IMPOSE LA GARANTIE. Celui que le
     client choisit de conserver à part ne change rien à la nature de
     l'opération : on ne va pas hypothéquer un bien pour racheter trois
     crédits conso sous prétexte qu'un prêt immobilier existe ailleurs. */
  const aDuImmo = (d.credits || []).some(
    (c) => c.type === 'immo' && String(c.integre) !== 'non');
  const proprietaire = d.logement === 'proprio_pret' || d.logement === 'proprio_sans_pret';
  const trop = BAREME.PLAFOND_SANS_GARANTIE !== null
    && totalCapital > BAREME.PLAFOND_SANS_GARANTIE;
  if ((aDuImmo || trop) && proprietaire) return 'hypothecaire';
  /* ⚠ ET SI LE VISITEUR N'EST PAS PROPRIÉTAIRE ? L'opération reste sans
     garantie, même au-dessus du plafond — ce qui la rendra souvent
     infaisable, et c'est précisément ce que le feu doit dire. On ne
     bascule pas en hypothécaire pour faire passer un dossier. */
  return 'sans_garantie';
}

/** Le capital à financer : les crédits, les dettes, la trésorerie, les frais. */
export function montantFinance(d) {
  const t = totaux(d.credits);
  const dettes = Number(d.dettes) || 0;
  const treso = Number(d.tresorerie) || 0;
  const base = t.capital + dettes + treso;
  const nat = nature(d, base);
  const tauxFrais = BAREME.FRAIS[nat];
  const frais = tauxFrais === null ? null : Math.round(base * tauxFrais);
  return { base: Math.round(base), nature: nat, frais, total: frais === null ? null : Math.round(base + frais) };
}

/**
 * Les scénarios de durée : mensualité, durée et coût total, côte à côte.
 *
 * ⚠ LE SURCOÛT EST RENDU AVEC, TOUJOURS. C'est la contrepartie de
 * l'allègement, et la page du site s'engage à la montrer. Il se compare
 * à ce que le foyer paierait en ne faisant rien (`restantAPayer`), pas
 * au capital : comparer une somme d'intérêts futurs à un capital ferait
 * paraître l'opération bien pire qu'elle n'est.
 */
export function scenarios(d) {
  const t = totaux(d.credits);
  const m = montantFinance(d);
  if (m.total === null) return [];
  const grille = BAREME.TAUX[m.nature] || {};

  return Object.keys(grille)
    .map(Number)
    .sort((a, b) => a - b)
    .map((annees) => {
      const taux = grille[annees];
      if (typeof taux !== 'number') return null;
      const mois = annees * 12;
      const mensu = Math.round(mensualite(m.total, taux, mois));
      const coutTotal = mensu * mois;
      return {
        annees, mois, taux,
        mensualite: mensu,
        coutTotal,
        /* Ce que le foyer paie aujourd'hui, tout compris, jusqu'au bout. */
        coutActuel: t.restantAPayer,
        surcout: coutTotal - t.restantAPayer,
        gainMensuel: t.mensualite - mensu,
      };
    })
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* 4. Le verdict                                                       */
/* ------------------------------------------------------------------ */

/** Nombre de personnes au foyer, pour le reste à vivre. */
function foyer(d) {
  return Math.max(1, (Number(d.emprunteurs) || 1) + (Number(d.enfants) || 0));
}

/**
 * Le feu.
 *
 * ⚠ IL NE SE DÉCIDE PAS SUR LA SEULE BAISSE DE MENSUALITÉ. Un dossier
 * peut afficher un bel allègement et ne pas passer : endettement encore
 * trop haut après l'opération, reste à vivre insuffisant, ou pas de
 * garantie possible pour un montant qui l'exige. Le verdict regarde donc
 * le scénario le plus favorable — la durée la plus longue, celle qui
 * allège le plus — et dit si MÊME CELUI-LÀ tient.
 */
export function verdict(d) {
  const t = totaux(d.credits);
  const revenus = Number(d.revenus) || 0;
  const loyer = Number(d.loyer) || 0;
  const sc = scenarios(d);
  const m = montantFinance(d);

  /* ⚠ CE QUI RESTE À PAYER APRÈS L'OPÉRATION n'est pas seulement la
     nouvelle mensualité : s'y ajoutent le loyer et les crédits que le
     client a choisi de conserver. Les oublier annoncerait un
     endettement plus bas que le vrai, donc un feu plus vert que le vrai. */
  const chargesApres = loyer + t.mensualiteConservee;

  /* Avant : TOUS les crédits en cours, rachetés ou non, plus le loyer.
     C'est le chiffre que le visiteur reconnaît sur son relevé. */
  const avant = revenus > 0 ? (t.mensualiteActuelle + loyer) / revenus : null;

  if (!sc.length || !baremeComplet()) {
    return { feu: null, motif: 'bareme', avant, apres: null, meilleur: null, scenarios: sc, nature: m.nature, totaux: t };
  }

  const meilleur = sc[sc.length - 1];   // la durée la plus longue allège le plus
  const apres = revenus > 0 ? (meilleur.mensualite + chargesApres) / revenus : null;
  const resteAVivre = revenus - meilleur.mensualite - chargesApres;
  const resteParPersonne = resteAVivre / foyer(d);

  const blocages = [];
  if (apres !== null && apres > BAREME.ENDETTEMENT_MAX) {
    blocages.push('Même sur la durée la plus longue, le taux d’endettement reste au-dessus de ce que les établissements acceptent.');
  }
  if (resteParPersonne < BAREME.RESTE_A_VIVRE_PAR_PERSONNE) {
    blocages.push('Le reste à vivre après la nouvelle mensualité est inférieur au minimum demandé pour un foyer de cette taille.');
  }
  if (m.nature === 'sans_garantie' && BAREME.PLAFOND_SANS_GARANTIE !== null
      && m.total > BAREME.PLAFOND_SANS_GARANTIE) {
    blocages.push('Le montant dépasse ce qu’un rachat sans garantie permet, et vous n’êtes pas propriétaire d’un bien à mettre en garantie.');
  }
  if (d.retards === 'oui_en_cours') {
    blocages.push('Des retards de paiement en cours doivent être examinés avant toute présentation aux établissements.');
  }

  let feu;
  if (blocages.length) feu = 'rouge';
  else if (apres !== null && apres > BAREME.ENDETTEMENT_CIBLE) feu = 'orange';
  else feu = 'vert';

  return {
    feu, motif: null, avant, apres, resteAVivre, resteParPersonne,
    meilleur, scenarios: sc, blocages, nature: m.nature, montant: m, totaux: t,
  };
}
