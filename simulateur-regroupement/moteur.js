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
  DATE: '25/11/2026',   // affichée à côté du résultat : « taux indicatifs au … »

  /* ------------------------------------------------------------------
     LA FOURCHETTE — donnée par Mickael le 25/11/2026
     ------------------------------------------------------------------
     25/11, Mickael : « est-ce qu'on peut donner une fourchette du
     nouveau taux d'endettement avec les nouvelles mensualités ? »

     Oui, et c'est plus honnête qu'un chiffre unique : le taux d'un
     regroupement dépend de l'établissement sollicité, et l'annoncer au
     centime laisserait croire le contraire.

     ⚠ CE SONT DES FOURCHETTES INDICATIVES DE MARCHÉ, pas le barème
     propre de l'agence. L'écran l'écrit, avec la date. Le jour où
     Mickael a ses propres conditions, ces six nombres se remplacent ici
     et rien d'autre ne bouge.

     `bas` et `haut` encadrent le taux annuel hors assurance.
     `dureeMax` est la durée la plus longue praticable : c'est elle qui
     donne la mensualité la plus basse, donc le meilleur allègement.
     ------------------------------------------------------------------ */
  FOURCHETTE: {
    sans_garantie: { bas: 0.0550, haut: 0.0820, dureeMax: 15 },
    hypothecaire:  { bas: 0.0480, haut: 0.0700, dureeMax: 25 },
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

const chiffre = (v) => typeof v === 'number' && isFinite(v) && v > 0;

/**
 * Peut-on annoncer des montants ?
 *
 * ⚠ DEUX GARDE-FOUS SÉPARÉS, ET C'EST VOULU. Les six nombres de la
 * fourchette suffisent à calculer une mensualité ; les quatre seuils
 * servent à COLORER le verdict. Les confondre, comme avant le 25/11,
 * obligeait à tout avoir pour afficher quoi que ce soit — alors que la
 * fourchette seule est déjà utile au visiteur.
 */
export function fourchettePrete() {
  return ['sans_garantie', 'hypothecaire'].every((f) => {
    const t = BAREME.FOURCHETTE[f] || {};
    return chiffre(t.bas) && chiffre(t.haut) && chiffre(t.dureeMax) && t.haut >= t.bas;
  });
}

/** Peut-on allumer le feu ? Les seuils engagent l'agence, pas le marché. */
export function seuilsPrets() {
  return chiffre(BAREME.ENDETTEMENT_CIBLE)
    && chiffre(BAREME.ENDETTEMENT_MAX)
    && chiffre(BAREME.RESTE_A_VIVRE_PAR_PERSONNE)
    && BAREME.ENDETTEMENT_MAX >= BAREME.ENDETTEMENT_CIBLE;
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

    /* ⚠ UNE LIGNE PEUT ÊTRE ARITHMÉTIQUEMENT IMPOSSIBLE, ET IL FAUT LE
       VOIR AVANT DE COMPARER QUOI QUE CE SOIT (25/11/2026, Mickael :
       « la situation après le regroupement, les mensualités et le coût
       total sont plus élevés qu'aujourd'hui, ce n'est pas normal »).

       Sa capture montrait 101 000 € de capital et 42 977 € de « coût
       total aujourd'hui ». C'est impossible : qui doit 101 000 € en
       paiera au moins 101 000 €, intérêts en plus. La cause : la date
       de dernière échéance déclarée ne tenait pas avec le capital et la
       mensualité — 427 € par mois pendant 164 mois ne remboursent pas
       101 000 €, il y faut au bas mot 237 mois, et encore SANS le
       moindre intérêt.

       Rien ne cassait pour autant. `tauxEstime` rendait bien `null`,
       comme il doit, mais la durée impossible restait en place, le
       « aujourd'hui » devenait deux fois moins cher qu'en réalité, et
       le regroupement passait pour une catastrophe. Une erreur de
       saisie se transformait en verdict.

       ⚠ ON NE SAIT PAS LAQUELLE DES TROIS RÉPONSES EST FAUSSE — la date,
       la mensualité ou le capital. On écarte donc la date, qui est la
       seule des trois à ne pas figurer sur un relevé mensuel, on laisse
       les branches ci-dessous reconstituer la durée, et on marque la
       ligne : l'écran demandera de vérifier plutôt que de trancher. */
    const plancher = mensu > 0 ? Math.ceil(capital / mensu) : null;
    const incoherent = mois !== null && plancher !== null && mois < plancher;
    if (incoherent) mois = null;

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
      capital, mensualite: mensu, taux, mois, estime, integre, incoherent,
      /* Ce que ce crédit coûte encore si on n'y touche pas.
         ⚠ JAMAIS MOINS QUE LE CAPITAL : c'est une certitude arithmétique,
         pas une prudence. Ce plancher est la deuxième ceinture, après
         celle posée plus haut — si un jour une durée impossible arrive
         par un autre chemin, le total restera au moins vrai au lieu de
         fabriquer un « aujourd'hui » moins cher que la dette elle-même. */
      restantAPayer: Math.max(capital, (mois && mensu) ? Math.round(mois * mensu) : capital),
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
    /* Les lignes dont les trois réponses ne tiennent pas ensemble.
       L'écran les nomme : c'est à leur auteur de dire laquelle corriger. */
    incoherents: l.filter((c) => c.incoherent),
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

/**
 * Le capital à financer : les crédits, les dettes, la trésorerie — et les
 * frais quand on les connaît.
 *
 * ⚠ LES FRAIS SONT FACULTATIFS, ET LEUR ABSENCE SE DIT. Mickael a donné
 * ses fourchettes de taux le 25/11 mais pas son taux de frais. Les
 * inventer gonflerait la mensualité d'un chiffre qui n'est pas le sien ;
 * les ignorer en silence l'annoncerait plus basse qu'elle ne sera. On
 * calcule donc sans eux ET on rend `fraisInclus: false`, que l'écran
 * transforme en « hors frais de dossier et de garantie ».
 */
export function montantFinance(d) {
  const t = totaux(d.credits);
  const dettes = Number(d.dettes) || 0;
  const treso = Number(d.tresorerie) || 0;
  const base = t.capital + dettes + treso;
  const nat = nature(d, base);
  const tauxFrais = (BAREME.FRAIS || {})[nat];
  const connus = chiffre(tauxFrais);
  const frais = connus ? Math.round(base * tauxFrais) : 0;
  return {
    base: Math.round(base), nature: nat,
    frais, fraisInclus: connus,
    total: Math.round(base + frais),
  };
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
export function fourchette(d) {
  const t = totaux(d.credits);
  const m = montantFinance(d);
  const f = BAREME.FOURCHETTE[m.nature];
  if (!fourchettePrete() || !f || !m.total) return null;

  const mois = Math.round(f.dureeMax * 12);

  /* ⚠ LES DEUX BORNES SE CALCULENT À LA MÊME DURÉE, la plus longue.
     Faire varier la durée EN PLUS du taux donnerait une fourchette si
     large qu'elle ne dirait plus rien — et mélangerait deux incertitudes
     de nature différente : le taux, qu'on subit, et la durée, qu'on
     choisit. Ici la fourchette ne parle que du taux. */
  const borne = (taux) => {
    const mensu = Math.round(mensualite(m.total, taux, mois));
    const coutTotal = mensu * mois;
    return {
      taux, mensu, coutTotal,
      /* Ce qu'il en coûte en plus par rapport aux crédits menés à terme.
         La page du site s'engage à le montrer à côté du gain. */
      surcout: coutTotal - t.restantAPayer,
      gain: t.mensualite - mensu,
    };
  };

  /* Le taux le plus BAS donne la mensualité la plus basse : c'est la
     borne favorable. Le plus haut, la défavorable. */
  const favorable = borne(f.bas);
  const defavorable = borne(f.haut);

  return {
    mois, annees: f.dureeMax, nature: m.nature,
    tauxBas: f.bas, tauxHaut: f.haut,
    /* Rangées du plus avantageux au moins avantageux pour le foyer. */
    mensualiteBasse: favorable.mensu,
    mensualiteHaute: defavorable.mensu,
    gainMax: favorable.gain,
    gainMin: defavorable.gain,
    coutBas: favorable.coutTotal,
    coutHaut: defavorable.coutTotal,
    surcoutBas: favorable.surcout,
    surcoutHaut: defavorable.surcout,
    coutActuel: t.restantAPayer,
    montant: m,
  };
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
  const m = montantFinance(d);
  const f = fourchette(d);

  /* ⚠ CE QUI RESTE À PAYER APRÈS L'OPÉRATION n'est pas seulement la
     nouvelle mensualité : s'y ajoutent le loyer et les crédits que le
     client a choisi de conserver. Les oublier annoncerait un
     endettement plus bas que le vrai, donc un feu plus vert que le vrai. */
  const chargesApres = loyer + t.mensualiteConservee;

  /* Avant : TOUS les crédits en cours, rachetés ou non, plus le loyer.
     C'est le chiffre que le visiteur reconnaît sur son relevé. */
  const avant = revenus > 0 ? (t.mensualiteActuelle + loyer) / revenus : null;

  const base = { avant, nature: m.nature, montant: m, totaux: t, fourchette: f };

  /* Pas de fourchette utilisable : on rend ce qui ne dépend d'aucun taux
     — l'inventaire et l'endettement d'aujourd'hui. L'écran le dit. */
  if (!f) return { ...base, feu: null, motif: 'bareme', apresBas: null, apresHaut: null };

  const endettement = (mensu) => (revenus > 0 ? (mensu + chargesApres) / revenus : null);
  const apresBas = endettement(f.mensualiteBasse);    // la plus favorable
  const apresHaut = endettement(f.mensualiteHaute);   // la moins favorable
  const resteBas = revenus - f.mensualiteHaute - chargesApres;   // au pire
  const resteParPersonne = resteBas / foyer(d);

  /* ⚠ SANS LES SEUILS, PAS DE COULEUR — mais les montants s'affichent.
     Les seuils disent ce que l'agence accepte : ils lui appartiennent,
     et aucune valeur de marché ne peut les remplacer. Le bandeau reste
     neutre, la fourchette est là. */
  if (!seuilsPrets()) {
    return { ...base, feu: null, motif: 'seuils', apresBas, apresHaut, resteParPersonne, blocages: [] };
  }

  const blocages = [];
  /* ⚠ ON JUGE L'IMPOSSIBILITÉ SUR LA BORNE LA PLUS FAVORABLE : si même
     au meilleur taux le dossier ne passe pas, il ne passe pas. */
  if (apresBas !== null && apresBas > BAREME.ENDETTEMENT_MAX) {
    blocages.push('Même au meilleur taux et sur la durée la plus longue, le taux d’endettement reste au-dessus de ce que les établissements acceptent.');
  }
  if (resteParPersonne < BAREME.RESTE_A_VIVRE_PAR_PERSONNE) {
    blocages.push('Le reste à vivre après la nouvelle mensualité est inférieur au minimum demandé pour un foyer de cette taille.');
  }
  if (m.nature === 'sans_garantie' && chiffre(BAREME.PLAFOND_SANS_GARANTIE)
      && m.total > BAREME.PLAFOND_SANS_GARANTIE) {
    blocages.push('Le montant dépasse ce qu’un rachat sans garantie permet, et vous n’êtes pas propriétaire d’un bien à mettre en garantie.');
  }
  if (d.retards === 'oui_en_cours') {
    blocages.push('Des retards de paiement en cours doivent être examinés avant toute présentation aux établissements.');
  }

  /* ⚠ LE VERT SE JUGE SUR LA BORNE DÉFAVORABLE, et c'est l'inverse du
     rouge : on n'annonce « jouable » que si l'opération tient MÊME au
     taux le plus haut. Un vert obtenu au meilleur taux serait une
     promesse qu'on ne tient qu'une fois sur deux. */
  let feu;
  if (blocages.length) feu = 'rouge';
  else if (apresHaut !== null && apresHaut > BAREME.ENDETTEMENT_CIBLE) feu = 'orange';
  else feu = 'vert';

  return { ...base, feu, motif: null, apresBas, apresHaut, resteParPersonne, blocages };
}
