/* =====================================================================
   parcours.js — les questions, dans l'ordre, et rien d'autre
   ---------------------------------------------------------------------
   Une liste de données, pas du code. C'est délibéré : l'ordre des
   questions est une décision de Mickael, pas une décision technique, et
   il doit pouvoir changer sans qu'on touche au moteur ni à l'affichage.
   Déplacer une question, c'est déplacer une accolade.

   LE CONTRAT D'UNE QUESTION
     id      identifiant unique, sert au fil d'Ariane
     sec     la section affichée en haut de l'écran
     type    'choice' | 'multi' | 'tranches' | 'fiche' | 'identite' | 'resultat'
     q       l'intitulé
     hint     la phrase sous l'intitulé ; une fonction reçoit les réponses
     when    quand la poser ; absente = toujours
     key     où ranger la réponse
     opts    pour 'choice' : les boutons
     champs  pour 'fiche' : plusieurs saisies sur un seul écran

   ⚠ « JE NE SAIS PAS » EST UNE RÉPONSE, PAS UN ÉCHEC. Mickael a demandé
   le 24/11/2026 que l'on réclame le taux ET la durée restante de chaque
   crédit. C'est ce qu'il faut pour chiffrer juste — mais presque
   personne ne les connaît de tête, et un parcours qui les exige
   s'arrête au troisième crédit. Chaque champ porte donc sa case « je ne
   sais pas », le moteur estime ce qui manque, et l'écran de résultat le
   DIT. Un chiffre deviné qui se présente comme un chiffre su est pire
   que pas de chiffre du tout.
   ===================================================================== */

export const CREDITS_MAX = 8;

export const SEC = {
  SIT: 'Votre situation',
  CRED: 'Vos crédits',
  BUD: 'Votre budget',
  /* ⚠ LA TRÉSORERIE A SA PROPRE SECTION, et ce n'est pas cosmétique.
     Elle se pose AVANT le budget, l'objectif APRÈS — c'est l'ordre validé
     par Mickael le 24/11/2026. Les ranger tous deux sous « Votre objectif »
     faisait apparaître cette section DEUX FOIS dans le fil d'Ariane, de
     part et d'autre du budget : un lecteur y voit une erreur, et il a
     raison de se poser la question. */
  PROJ: 'Votre projet',
  OBJ: 'Votre objectif',
  ID: 'Vos coordonnées',
};

/* =====================================================================
   Les tranches de montant — la saisie en deux temps
   ---------------------------------------------------------------------
   25/11/2026, Mickael : « pour les revenus nets mensuels je voudrais le
   même système que l'autre simulateur pour être vraiment précis sur les
   chiffres ».

   Le visiteur choisit d'abord une tranche, puis la valeur exacte à
   l'intérieur. Deux gestes au lieu d'un champ libre, et on obtient un
   chiffre PRÉCIS : personne ne tape « 2 347 » dans une case, tout le
   monde sait cliquer « 2 000–2 500 » puis « 2 300 ».

   ⚠ LES TRANCHES DES REVENUS SONT CELLES DU SIMULATEUR IMMOBILIER, à
   l'euro près (sa table `R_SALAIRE`, relevée dans la page publiée). Une
   même personne peut passer par les deux simulateurs : si les tranches
   divergeaient, elle ne pourrait pas se reconnaître d'un écran à l'autre,
   et les deux fiches du CRM ne se compareraient plus.

   `pas` est l'écart entre deux valeurs précises proposées. La dernière
   tranche est ouverte : son maximum n'est qu'une borne d'affichage.
   `inclus` : la tranche propose aussi sa borne haute (les tranches qui ne
   se chevauchent pas, comme « 1 500 – 1 900 € »).
   ===================================================================== */
/* ⚠ LES REVENUS ONT LEURS PROPRES TRANCHES DEPUIS LE 26/11/2026 (Élodie :
   « les pastilles portent à confusion »). « 1 500–2 000 € » puis
   « 2 000–2 500 € » proposaient 2 000 € dans deux tranches à la fois.
   Les nouvelles ne se touchent plus — 1 500 – 1 900, 2 000 – 2 400… — et
   les valeurs précises vont toujours de cent en cent. Elles s'écartent
   donc du simulateur immobilier, et c'est voulu. */
export const T_REVENUS = [
  { t: '− de 1 500 €', min: 800, max: 1400, pas: 100, inclus: true },
  { t: '1 500 – 1 900 €', min: 1500, max: 1900, pas: 100, inclus: true },
  { t: '2 000 – 2 400 €', min: 2000, max: 2400, pas: 100, inclus: true },
  { t: '2 500 – 3 400 €', min: 2500, max: 3400, pas: 100, inclus: true },
  { t: '3 500 – 5 000 €', min: 3500, max: 5000, pas: 100, inclus: true },
  { t: '+ de 5 000 €', min: 5100, max: 7000, pas: 100 },
];

export const T_LOYER = [
  { t: '− de 500 €', min: 200, max: 500, pas: 50 },
  { t: '500–700 €', min: 500, max: 700, pas: 50 },
  { t: '700–900 €', min: 700, max: 900, pas: 50 },
  { t: '900–1 200 €', min: 900, max: 1200, pas: 50 },
  { t: '1 200–1 600 €', min: 1200, max: 1600, pas: 100 },
  { t: '+ de 1 600 €', min: 1600, max: 3000, pas: 100 },
];

export const T_DETTES = [
  { t: '− de 1 000 €', min: 200, max: 1000, pas: 100 },
  { t: '1 000–3 000 €', min: 1000, max: 3000, pas: 250 },
  { t: '3 000–5 000 €', min: 3000, max: 5000, pas: 500 },
  { t: '5 000–10 000 €', min: 5000, max: 10000, pas: 1000 },
  { t: '+ de 10 000 €', min: 10000, max: 40000, pas: 2500 },
];

/* La somme supplémentaire (26/11/2026, Élodie) : des tranches qui ne se
   chevauchent plus, et les valeurs précises qu'elle a fixées — de 500 en
   500 sous 5 000 €, de 1 000 en 1 000 jusqu'à 19 000 €, de 5 000 en 5 000
   jusqu'à 39 000 €, de 10 000 en 10 000 jusqu'à 120 000 €. */
export const T_TRESORERIE = [
  { t: '− de 5 000 €', min: 1000, max: 4500, pas: 500, inclus: true },
  { t: '5 000 – 9 000 €', min: 5000, max: 9000, pas: 1000, inclus: true },
  { t: '10 000 – 19 000 €', min: 10000, max: 19000, pas: 1000, inclus: true },
  { t: '20 000 – 39 000 €', min: 20000, max: 35000, pas: 5000, inclus: true },
  { t: '+ de 40 000 €', min: 40000, max: 120000, pas: 10000 },
];

/* Les rangs, pour que l'écran dise « votre deuxième crédit » et non
   « crédit n° 2 » — on parle à quelqu'un, pas à un formulaire. */
const RANG = ['premier', 'deuxième', 'troisième', 'quatrième',
  'cinquième', 'sixième', 'septième', 'huitième'];

const ic = (d) => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const ICONES = {
  maison: ic('<path d="M3.6 10.4 12 3.8l8.4 6.6"/><path d="M5.6 11.8v8.4h12.8v-8.4"/>'),
  cle: ic('<circle cx="8.4" cy="12" r="3.6"/><path d="M12 12h8.4"/><path d="M17.6 12v3"/>'),
  carte: ic('<rect x="2.8" y="5.6" width="18.4" height="12.8" rx="2.4"/><path d="M2.8 10h18.4"/>'),
  voiture: ic('<path d="M3.4 16.4v-3l2-4.6h13.2l2 4.6v3"/><circle cx="7.2" cy="16.8" r="1.8"/><circle cx="16.8" cy="16.8" r="1.8"/>'),
  boucle: ic('<path d="M4 12a8 8 0 0 1 13.6-5.6"/><path d="M20 12a8 8 0 0 1-13.6 5.6"/><path d="M17.6 3.2v3.2h-3.2"/><path d="M6.4 20.8v-3.2h3.2"/>'),
  immeuble: ic('<rect x="5.2" y="3.4" width="13.6" height="17.2" rx="1.6"/><path d="M9 7.6h2M13 7.6h2M9 11.6h2M13 11.6h2M9 15.6h2M13 15.6h2"/>'),
  billets: ic('<rect x="2.6" y="6.4" width="18.8" height="11.2" rx="2"/><circle cx="12" cy="12" r="2.6"/>'),
  oui: ic('<circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.4 2.6 2.6 4.6-5.2"/>'),
  non: ic('<circle cx="12" cy="12" r="8.6"/><path d="M8.6 12h6.8"/>'),
  alerte: ic('<path d="M12 4.4 2.8 20h18.4Z"/><path d="M12 10v4"/><path d="M12 16.8v.2"/>'),
  fleche: ic('<path d="M4 12h16"/><path d="m14 6 6 6-6 6"/>'),
  bouclier: ic('<path d="M12 3.4 5 6v5.4c0 4 2.9 7.6 7 9.2 4.1-1.6 7-5.2 7-9.2V6Z"/>'),
  personne: ic('<circle cx="12" cy="8" r="3.4"/><path d="M5.6 20c0-3.5 2.9-5.6 6.4-5.6s6.4 2.1 6.4 5.6"/>'),
  outil: ic('<path d="M14.6 6.2a4 4 0 0 0 5.2 5.2l-8.6 8.6a2.2 2.2 0 0 1-3.2-3.2Z"/><path d="M14.6 6.2 17.4 3.4l3.2 3.2-2.8 2.8"/>'),
  deux: ic('<circle cx="9" cy="8.4" r="3"/><circle cx="16.4" cy="9.4" r="2.4"/><path d="M3.4 19.6c0-3.1 2.5-5 5.6-5s5.6 1.9 5.6 5"/><path d="M15.4 14.8c2.7.2 4.6 2 4.6 4.8"/>'),
};

/* Les types de crédit. L'ordre suit ce que Mickael annonce prendre en
   charge sur la page « Regroupement de crédits » du site. */
export const TYPES_CREDIT = [
  { v: 'conso', ic: ICONES.carte, label: 'Prêt personnel / conso' },
  { v: 'auto', ic: ICONES.voiture, label: 'Crédit auto ou LOA' },
  { v: 'reval', ic: ICONES.boucle, label: 'Crédit renouvelable' },
  /* Prêt travaux ajouté le 26/11/2026 (Élodie). Traité comme un crédit à
     la consommation : mêmes suggestions, aucun bien en garantie. */
  { v: 'travaux', ic: ICONES.outil, label: 'Prêt travaux' },
  { v: 'immo', ic: ICONES.immeuble, label: 'Prêt immobilier' },
  { v: 'autre', ic: ICONES.billets, label: 'Autre engagement' },
];

/* =====================================================================
   Les champs d'un crédit — les mêmes pour tous (26/11/2026)
   ---------------------------------------------------------------------
   Élodie : « pour tous les prêts il faudrait demander le montant du
   départ, date de début, nombre d'échéances (mois), le nombre
   d'échéances restantes (fin du prêt) » — et ne plus afficher de
   fourchette, mais un vrai résultat.

   ⚠ ON GARDE LE CAPITAL RESTANT DÛ, LA MENSUALITÉ ET LE TAUX (son choix,
   entre « garder tout » et « remplacer »). Le capital et la mensualité
   se recalculeraient à partir du départ, du taux et de la durée — mais
   faux dès que le prêt a été modulé, ou remboursé en partie par
   anticipation, ce qui est fréquent justement chez qui veut regrouper.
   Les nouveaux champs servent à COMBLER ce que le visiteur ne sait pas :
   - le nombre d'échéances restantes remplace la « dernière échéance » ;
     s'il est inconnu, il se déduit de la date de début et du nombre
     total d'échéances ;
   - le taux inconnu se retrouve à partir du montant de départ, de la
     mensualité et du nombre total d'échéances — c'est le calcul du
     tableau d'amortissement lui-même, pas une estimation de marché.

   ⚠ LA VALEUR DU BIEN SE DEMANDE SUR CHAQUE PRÊT IMMOBILIER : c'est elle
   qui permet de pondérer une opération hypothécaire. La règle de
   pondération reste à poser dans `moteur.js` ; d'ici là, la valeur est
   recueillie et transmise à l'agence. */
/* ⚠ DES PASTILLES QUI SUGGÈRENT, UNE CASE QUI RESTE LIBRE (26/11/2026,
   Élodie : « je voudrais les pastilles pour suggérer et laisser la
   possibilité de remplir ces informations à la main »). Après trois
   maquettes refusées, la règle est nette : sélectionner pour aller vite,
   sans jamais perdre la précision. Une pastille REMPLIT la case, qu'on
   corrige ensuite au chiffre près si besoin.
   Les valeurs proposées diffèrent selon le type : un prêt immobilier ne
   se compte pas comme un crédit conso. */
const SUGG = {
  immo: {
    montantDepart: [100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000],
    capital: [50000, 100000, 150000, 200000, 250000],
    mensualite: [500, 700, 900, 1100, 1300, 1500],
    duree: [180, 240, 300],
    taux: [0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04],
    valeurBien: [150000, 200000, 250000, 300000, 400000, 500000],
  },
  autre: {
    montantDepart: [3000, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000],
    capital: [2000, 5000, 10000, 15000, 20000],
    mensualite: [100, 150, 200, 300, 400, 500],
    duree: [24, 36, 48, 60, 84, 120],
    taux: [0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.1, 0.15],
  },
};

function champsCredit(estImmo) {
  const S = estImmo ? SUGG.immo : SUGG.autre;
  return [
    { cle: 'montantDepart', lab: 'Montant emprunté au départ', type: 'euros', inconnu: true, sugg: S.montantDepart },
    { cle: 'debut', lab: 'Date de début', type: 'moisannee', passe: true, inconnu: true,
      hint: 'Le mois de la première échéance.' },
    { cle: 'duree', lab: 'Nombre total d’échéances', type: 'mois', inconnu: true, sugg: S.duree,
      hint: 'La durée du prêt en mois : 84 pour 7 ans, 240 pour 20 ans.' },
    { cle: 'restants', lab: 'Nombre d’échéances restantes', type: 'mois', inconnu: true,
      hint: 'Les mensualités qu’il vous reste à payer jusqu’à la fin du prêt.' },
    { cle: 'capital', lab: 'Capital restant dû', type: 'euros', sugg: S.capital, hint: 'Ce qu’il reste à rembourser aujourd’hui.' },
    { cle: 'mensualite', lab: 'Mensualité (hors assurance)', type: 'euros', sugg: S.mensualite },
    { cle: 'taux', lab: 'Taux annuel', type: 'pourcent', inconnu: true, sugg: S.taux },
    ...(estImmo ? [
      { cle: 'valeurBien', lab: 'Valeur actuelle du bien', type: 'euros', inconnu: true, sugg: S.valeurBien,
        hint: 'Une estimation suffit : le prix d’achat ou une estimation récente.' },
      {
        cle: 'integre', lab: 'Ce prêt doit-il entrer dans le regroupement ?',
        type: 'ouinon', defaut: 'oui',
        hint: 'Intégré, il est racheté avec le reste et l’opération est adossée à votre bien. Conservé à part, il continue tel quel.',
      },
    ] : []),
  ];
}

/* =====================================================================
   Un crédit en trois écrans courts (26/11/2026)
   ---------------------------------------------------------------------
   Élodie : « je trouve ça lourd toutes les questions sur une même page ».
   Neuf champs d'un coup faisaient un mur. On les range par ce que le
   visiteur a sous les yeux :
     1. AU DÉPART   : ce qui est écrit sur l'offre de prêt ;
     2. AUJOURD'HUI : ce qui est écrit sur le dernier relevé ;
     3. LE BIEN     : la valeur, et le choix de l'engager — prêt
                      immobilier seulement.
   ⚠ LES TROIS ÉCRANS ÉCRIVENT DANS LA MÊME RÉPONSE (`pretImmo`,
   `credit1`…) : chaque fiche fusionne ses champs dans l'objet du crédit,
   donc le moteur et `pourLeMoteur` n'ont rien à savoir du découpage. */
/* ⚠ LE TAUX PASSE SUR LE PREMIER ÉCRAN, ET LE DEUXIÈME SE PRÉ-REMPLIT
   (26/11/2026, Élodie, avec son tableau d'amortissement Excel). Montant,
   date de début, nombre d'échéances et taux suffisent à tout recalculer :
   échéances restantes, capital restant dû, mensualité hors assurance —
   les formules mêmes du fichier (PMT, PPMT, EDATE). Le visiteur les
   trouve donc déjà remplies, et les corrige si son relevé dit autre
   chose (prêt modulé, remboursement anticipé, assurance comprise…). */
const ETAPES_CREDIT = [
  { suffixe: '', titre: 'au départ',
    hint: 'Ce qui figure sur votre offre de prêt. Une pastille remplit la case, que vous pouvez corriger.',
    cles: ['montantDepart', 'debut', 'duree', 'taux'] },
  { suffixe: 'Auj', titre: 'aujourd’hui', preremplir: true,
    hint: 'Nous avons calculé ces montants d’après votre prêt. Vérifiez-les sur votre dernier relevé.',
    cles: ['restants', 'capital', 'mensualite'] },
  { suffixe: 'Bien', titre: 'le bien', immo: true,
    hint: 'Une estimation suffit.',
    cles: ['valeurBien', 'integre'] },
];
const champsEtape = (estImmo, cles) => champsCredit(estImmo).filter((c) => cles.includes(c.cle));

export function questions() {
  const out = [];

  /* ---------------------------------------------------------------- */
  /* 1. La situation de logement                                       */
  /* ---------------------------------------------------------------- */
  /* ⚠ ELLE PASSE EN PREMIER PARCE QU'ELLE DÉCIDE DE TOUT LE RESTE :
     c'est elle qui dit si l'opération peut être adossée à un bien, donc
     à quelle famille de taux et à quelles durées on a droit. Le visiteur
     n'a pas à connaître cette différence, et on ne la lui explique pas. */
  out.push({
    id: 'logement', sec: SEC.SIT, type: 'choice', key: 'logement',
    q: 'Votre logement actuel',
    hint: 'Votre situation de logement oriente le type d’opération possible.',
    opts: [
      { v: 'proprio_pret', ic: ICONES.maison, label: 'Propriétaire, avec un prêt en cours' },
      { v: 'proprio_sans_pret', ic: ICONES.bouclier, label: 'Propriétaire, sans prêt' },
      { v: 'locataire', ic: ICONES.cle, label: 'Locataire' },
      { v: 'heberge', ic: ICONES.personne, label: 'Hébergé à titre gratuit' },
    ],
  });

  /* La valeur du bien d'un propriétaire SANS prêt (26/11/2026, Élodie).
     Un bien déjà payé peut porter une hypothèque : c'est même le cas où
     elle est la plus large. Chez qui a un prêt en cours, la question se
     pose sur la fiche de ce prêt. */
  out.push({
    id: 'bien', sec: SEC.SIT, type: 'fiche', key: 'bien',
    q: 'La valeur de votre bien',
    hint: 'Une estimation suffit : le prix d’achat ou une estimation récente.',
    when: (d) => d.logement === 'proprio_sans_pret',
    /* ⚠ LE BIEN N'ENTRE DANS L'OPÉRATION QUE SI LE PROPRIÉTAIRE LE VEUT
       (26/11/2026, Élodie : « en hypothèque s'il souhaite l'intégrer
       dans l'opération, sinon le conserver à part »). Même question, et
       mêmes réponses, que sur un prêt immobilier. */
    champs: [
      { cle: 'valeurBien', lab: 'Valeur actuelle du bien', type: 'euros', inconnu: true, sugg: SUGG.immo.valeurBien },
      {
        cle: 'integre', lab: 'Ce bien doit-il servir de garantie à l’opération ?',
        type: 'ouinon', defaut: 'oui',
        hint: 'Intégré, l’opération est adossée à votre bien (hypothèque) : durée plus longue, taux plus bas. Conservé à part, le regroupement se fait sans garantie.',
      },
    ],
  });

  /* ---------------------------------------------------------------- */
  /* 1 bis. Le prêt immobilier, tout de suite                          */
  /* ---------------------------------------------------------------- */
  /* 25/11/2026, Mickael : « si à la première question on clique sur
     "propriétaire, avec un prêt en cours" je veux directement que l'on
     demande le capital restant dû, mensualité, taux annuel, durée
     restante et si ce prêt doit-il entrer dans le regroupement ».

     ⚠ ON NE REDEMANDE PAS LE TYPE : il vient d'être déclaré à la
     question précédente. Le faire choisir « Prêt immobilier » dans une
     liste de cinq, deux écrans après avoir dit qu'il était propriétaire
     avec un prêt en cours, c'est lui faire répéter ce qu'il a déjà dit.
     Le type est posé d'office par la vue (`fige: 'immo'`).

     ⚠ ET IL PASSE AVANT LES AUTRES CRÉDITS, parce que c'est la ligne qui
     décide de tout : si ce prêt entre dans l'opération, elle devient
     hypothécaire — d'autres durées, d'autres taux. Le demander en
     dernier aurait fait recalculer tout le reste. */
  for (const e of ETAPES_CREDIT) {
    out.push({
      id: 'pretImmo' + e.suffixe, sec: SEC.CRED, type: 'fiche', key: 'pretImmo',
      q: 'Votre prêt immobilier, ' + e.titre,
      hint: e.hint,
      when: (d) => d.logement === 'proprio_pret',
      fige: { type: 'immo' },
      preremplir: !!e.preremplir,
      champs: champsEtape(true, e.cles),
    });
  }

  out.push({
    id: 'autresCredits', sec: SEC.CRED, type: 'choice', key: 'autresCredits',
    q: 'Avez-vous d’autres crédits en cours ?',
    hint: 'Prêt personnel, crédit auto, LOA, crédit renouvelable, prêt travaux, un autre prêt immobilier.',
    /* ⚠ ELLE SE POSE MÊME SI LA FICHE PRÉCÉDENTE A ÉTÉ LAISSÉE VIDE.
       Conditionner cette question à la saisie du prêt fermait le
       parcours : qui passait l'écran sans rien remplir n'avait plus
       aucun moyen de déclarer un crédit, et arrivait au résultat avec
       un inventaire vide sans comprendre pourquoi. */
    when: (d) => d.logement === 'proprio_pret',
    opts: [
      { v: 'oui', ic: ICONES.fleche, label: 'Oui, les ajouter' },
      { v: 'non', ic: ICONES.oui, label: 'Non, c’est tout' },
    ],
  });

  /* ---------------------------------------------------------------- */
  /* 2. L'inventaire des crédits                                       */
  /* ---------------------------------------------------------------- */
  /* ⚠ UN CRÉDIT PAR ÉCRAN, SES QUATRE CHIFFRES ENSEMBLE. Une question
     par champ ferait trente-deux écrans pour huit crédits ; personne ne
     va au bout. L'écran à plusieurs champs existe déjà dans la maison —
     c'est celui des coordonnées du simulateur immobilier. */
  /* ⚠ LE PREMIER CRÉDIT NE SE POSE PLUS TOUJOURS EN PREMIER. Chez un
     propriétaire avec prêt, le prêt immobilier a déjà été saisi juste
     avant, et la liste ne s'ouvre que s'il a répondu « oui, les
     ajouter ». Chez les autres, rien ne change : l'inventaire commence
     ici, comme avant. */
  const apresPretImmo = (d) => d.logement === 'proprio_pret';

  /* ⚠ DEUX ÉCRANS PAR CRÉDIT, PAS UN (25/11/2026, Mickael : « je voudrais
     séparer les types de crédits et les champs restants, sinon il y a
     beaucoup d'informations sur une page »). Une liste de cinq types
     PLUS cinq champs chiffrés sur le même écran, c'était un mur.
     Le type d'abord — un clic, qui enchaîne tout seul —, puis les
     chiffres seuls. Et l'écran des chiffres porte le type choisi en
     titre : on sait de quel crédit on parle sans remonter.

     ⚠ LE TYPE VIT DANS SA PROPRE RÉPONSE (`credit1Type`) et n'est plus
     dans l'objet du crédit. Il y est recollé au moment du calcul, dans
     `pourLeMoteur` — c'est le seul endroit qui en a besoin. */
  for (let i = 1; i <= CREDITS_MAX; i++) {
    const precedent = i === 1 ? null : `credit${i - 1}Autre`;
    const ouvre = i === 1
      ? (d) => !apresPretImmo(d) || d.autresCredits === 'oui'
      : (d) => d[precedent] === 'oui';

    /* « Votre premier AUTRE crédit » quand le prêt immobilier est déjà
       derrière nous : sans ce mot, l'écran repartirait à « votre premier
       crédit » après en avoir déjà saisi un, ce qui se lit comme une
       erreur du formulaire. */
    const rang = (d) => (i === 1
      ? (apresPretImmo(d) ? 'Votre premier autre crédit' : 'Votre premier crédit')
      : `Votre ${RANG[i - 1]} ${apresPretImmo(d) ? 'autre ' : ''}crédit`);

    out.push({
      id: `credit${i}Type`, sec: SEC.CRED, type: 'choice', key: `credit${i}Type`,
      q: rang,
      hint: 'De quel type s’agit-il ?',
      when: ouvre,
      /* ⚠ PAS DE PRÊT IMMOBILIER POUR UN LOCATAIRE NI UN HÉBERGÉ (26/11/2026,
         Élodie). Sans bien à soi, rien à hypothéquer : la ligne ne ferait
         qu'induire en erreur sur la nature de l'opération. */
      opts: (d) => (d.logement === 'locataire' || d.logement === 'heberge'
        ? TYPES_CREDIT.filter((t) => t.v !== 'immo') : TYPES_CREDIT),
    });

    /* Le titre reprend le type qu'on vient de choisir, puis le moment :
       « Crédit auto ou LOA, au départ ». Les champs dépendent du type :
       seul un prêt immobilier porte la valeur de son bien et le choix de
       l'intégrer (la page du site l'annonce : « intégré au regroupement
       ou conservé à part »). D'où une fonction et non une liste figée. */
    for (const e of ETAPES_CREDIT) {
      const estImmo = (d) => d[`credit${i}Type`] === 'immo';
      out.push({
        id: `credit${i}${e.suffixe}`, sec: SEC.CRED, type: 'fiche', key: `credit${i}`,
        q: (d) => ((TYPES_CREDIT.find((t) => t.v === d[`credit${i}Type`]) || {}).label || rang(d)) + ', ' + e.titre,
        hint: e.hint,
        when: (d) => ouvre(d) && !!d[`credit${i}Type`] && (!e.immo || estImmo(d)),
        preremplir: !!e.preremplir,
        champs: (d) => champsEtape(estImmo(d), e.cles),
      });
    }

    if (i < CREDITS_MAX) {
      out.push({
        id: `credit${i}Autre`, sec: SEC.CRED, type: 'choice', key: `credit${i}Autre`,
        q: 'Avez-vous un autre crédit en cours ?',
        hint: 'Découverts et dettes se déclarent juste après : ne les comptez pas ici.',
        /* ⚠ ON S'APPUIE SUR LE TYPE, PAS SUR LES CHIFFRES : quelqu'un qui
           choisit un type puis laisse les montants vides doit quand même
           pouvoir continuer, sinon le parcours se ferme sur lui. */
        when: (d) => !!d[`credit${i}Type`],
        opts: [
          { v: 'oui', ic: ICONES.fleche, label: 'Oui, en ajouter un' },
          { v: 'non', ic: ICONES.oui, label: 'Non, c’est tout' },
        ],
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* 3. Dettes et retards                                              */
  /* ---------------------------------------------------------------- */
  out.push({
    id: 'dettes', sec: SEC.CRED, type: 'choice', key: 'aDesDettes',
    q: 'Avez-vous d’autres sommes à régulariser ?',
    hint: 'Découvert installé, retard d’impôts, dette familiale, charges de copropriété en retard. Elles peuvent entrer dans l’opération.',
    opts: [
      { v: 'oui', ic: ICONES.alerte, label: 'Oui' },
      { v: 'non', ic: ICONES.oui, label: 'Non' },
    ],
  });
  out.push({
    id: 'dettesMontant', sec: SEC.CRED, type: 'tranches', key: 'dettes',
    q: 'Quel montant au total ?',
    hint: 'Une estimation suffit à ce stade.',
    when: (d) => d.aDesDettes === 'oui',
    tranches: T_DETTES,
  });

  /* ⚠ LA QUESTION LA PLUS GÊNANTE DU PARCOURS, ET LA PLUS UTILE.
     Elle décide de la faisabilité : un dossier avec des incidents en
     cours ne se présente pas aux établissements dans l'état. La poser
     sèchement ferait abandonner ; l'éviter ferait annoncer un feu vert
     à quelqu'un qui n'a aucune chance. On la pose donc en expliquant
     pourquoi on la pose, et la réponse « oui » n'est pas une porte
     fermée : elle mène à « à étudier », pas à « impossible ». */
  out.push({
    id: 'retards', sec: SEC.CRED, type: 'choice', key: 'retards',
    q: 'Avez-vous des retards de paiement ?',
    hint: 'Nous posons la question parce qu’elle change la façon de monter le dossier — pas pour l’écarter. Un dossier avec des incidents se présente différemment, c’est tout.',
    opts: [
      { v: 'non', ic: ICONES.oui, label: 'Non, tout est à jour' },
      { v: 'oui_regularise', ic: ICONES.boucle, label: 'Il y en a eu, c’est régularisé' },
      { v: 'oui_en_cours', ic: ICONES.alerte, label: 'Oui, en cours' },
    ],
  });

  /* ---------------------------------------------------------------- */
  /* 4. La trésorerie complémentaire                                   */
  /* ---------------------------------------------------------------- */
  out.push({
    id: 'tresorerie', sec: SEC.PROJ, type: 'choice', key: 'aBesoinTreso',
    q: 'Avez-vous besoin d’une somme supplémentaire ?',
    hint: 'Le regroupement peut financer un projet dans la même opération : des travaux, un véhicule, un rachat de soulte après une séparation.',
    opts: [
      { v: 'oui', ic: ICONES.billets, label: 'Oui' },
      { v: 'non', ic: ICONES.non, label: 'Non, seulement regrouper' },
    ],
  });
  out.push({
    id: 'tresorerieMontant', sec: SEC.PROJ, type: 'tranches', key: 'tresorerie',
    q: 'De quel montant ?',
    when: (d) => d.aBesoinTreso === 'oui',
    tranches: T_TRESORERIE,
  });
  out.push({
    id: 'tresorerieMotif', sec: SEC.PROJ, type: 'choice', key: 'tresoMotif',
    q: 'Pour quel projet ?',
    when: (d) => d.aBesoinTreso === 'oui',
    opts: [
      { v: 'travaux', ic: ICONES.maison, label: 'Des travaux' },
      { v: 'vehicule', ic: ICONES.voiture, label: 'Un véhicule' },
      { v: 'soulte', ic: ICONES.deux, label: 'Un rachat de soulte' },
      { v: 'autre', ic: ICONES.billets, label: 'Autre chose' },
    ],
  });

  /* ---------------------------------------------------------------- */
  /* 5. Le budget du foyer                                             */
  /* ---------------------------------------------------------------- */
  out.push({
    id: 'emprunteurs', sec: SEC.BUD, type: 'choice', key: 'emprunteurs',
    q: 'L’opération est-elle à votre nom seul ?',
    opts: [
      { v: '1', ic: ICONES.personne, label: 'Oui, moi seul' },
      { v: '2', ic: ICONES.deux, label: 'Non, à deux' },
    ],
  });
  out.push({
    id: 'revenus', sec: SEC.BUD, type: 'tranches', key: 'revenus',
    q: 'Vos revenus nets mensuels',
    hint: (d) => d.emprunteurs === '2'
      ? 'Le total des deux, après impôt sur le revenu prélevé à la source. Salaires, pensions, revenus locatifs.'
      : 'Après impôt sur le revenu prélevé à la source. Salaire, pension, revenus locatifs.',
    tranches: T_REVENUS,
  });
  /* ⚠ LE LOYER NE SE DEMANDE QU'AUX NON-PROPRIÉTAIRES. Chez un
     propriétaire, la mensualité du logement est déjà déclarée comme
     crédit dans l'inventaire : la redemander ici la compterait deux
     fois, et ferait basculer en rouge des dossiers qui tiennent. */
  out.push({
    id: 'loyer', sec: SEC.BUD, type: 'tranches', key: 'loyer',
    q: 'Votre loyer mensuel',
    hint: 'Charges comprises.',
    when: (d) => d.logement === 'locataire',
    tranches: T_LOYER,
  });
  out.push({
    id: 'enfants', sec: SEC.BUD, type: 'choice', key: 'enfants',
    q: 'Combien d’enfants à charge ?',
    hint: 'Les enfants à charge entrent dans le calcul de vos charges mensuelles.',
    opts: [
      { v: '0', ic: ICONES.non, label: 'Aucun' },
      { v: '1', ic: ICONES.personne, label: 'Un' },
      { v: '2', ic: ICONES.deux, label: 'Deux' },
      { v: '3', ic: ICONES.deux, label: 'Trois ou plus' },
    ],
  });

  /* ---------------------------------------------------------------- */
  /* 6. L'objectif                                                     */
  /* ---------------------------------------------------------------- */
  /* ⚠ CETTE RÉPONSE N'ENTRE DANS AUCUN CALCUL, et elle est pourtant la
     plus importante de l'écran de résultat. La page du site le dit :
     « nous retenons le montage qui sert votre objectif, pas celui qui
     affiche la plus belle baisse de mensualité ». C'est elle qui décide
     quel scénario est mis en avant — le plus court pour qui veut
     retrouver de la capacité d'emprunt, le plus léger pour qui absorbe
     une baisse de revenus. */
  /* ⚠ PLUSIEURS RÉPONSES (26/11/2026, Élodie : « rajouter le prêt travaux
     et la trésorerie dans les raisons de ce regroupement en laissant le
     choix de faire un choix multiple »). On regroupe rarement pour une
     seule raison : alléger ET financer des travaux est le cas courant.
     Les réponses vivent dans `objectifs` (un tableau) ; `objectif`, au
     singulier, garde la première cochée pour les écrans qui ne savent
     en lire qu'une. */
  out.push({
    id: 'objectif', sec: SEC.OBJ, type: 'multi', key: 'objectifs',
    q: 'Pourquoi souhaitez-vous regrouper vos crédits ?',
    hint: 'Plusieurs réponses possibles. Elles orientent le montage que nous vous proposerons.',
    opts: [
      { v: 'mensualite', ic: ICONES.fleche, label: 'Alléger ma mensualité' },
      { v: 'capacite', ic: ICONES.maison, label: 'Retrouver de la capacité d’emprunt' },
      { v: 'travaux', ic: ICONES.immeuble, label: 'Financer des travaux' },
      { v: 'tresorerie', ic: ICONES.billets, label: 'Obtenir de la trésorerie' },
      { v: 'projet', ic: ICONES.voiture, label: 'Financer un autre projet' },
      { v: 'revenus', ic: ICONES.bouclier, label: 'Absorber une baisse de revenus' },
    ],
  });

  /* ---------------------------------------------------------------- */
  /* 7. Les coordonnées                                                */
  /* ---------------------------------------------------------------- */
  out.push({
    id: 'identite', sec: SEC.ID, type: 'identite',
    q: 'Vos coordonnées pour recevoir votre étude',
    hint: 'Elles ne servent qu’à l’étude de votre projet et ne sont ni vendues ni cédées.',
    /* ⚠ L'ÉCRAN DISPARAÎT QUAND LE VISITEUR ARRIVE DE SA PRISE DE
       RENDEZ-VOUS (25/11/2026). Il vient de saisir son nom, son
       téléphone, son adresse e-mail et son consentement sur le
       formulaire : les redemander trois écrans plus loin se lit comme
       un formulaire qui n'écoute pas, et c'est le plus sûr moyen de
       perdre quelqu'un qui avait déjà dit oui.
       `__rdv` est posé par `vue.js` à partir de `lrc-preparation`, et
       seulement si une adresse e-mail s'y trouve — sans elle, le
       serveur ne saurait pas à quel dossier rattacher l'étude, et
       l'écran doit rester. */
    when: (d) => !d.__rdv,
  });

  out.push({ id: 'resultat', sec: '', type: 'resultat' });

  return out;
}
