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
     type    'choice' | 'amount' | 'fiche' | 'identite' | 'resultat'
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
   ===================================================================== */
export const T_REVENUS = [
  { t: '− de 1 500 €', min: 800, max: 1500, pas: 100 },
  { t: '1 500–2 000 €', min: 1500, max: 2000, pas: 100 },
  { t: '2 000–2 500 €', min: 2000, max: 2500, pas: 100 },
  { t: '2 500–3 500 €', min: 2500, max: 3500, pas: 100 },
  { t: '3 500–5 000 €', min: 3500, max: 5000, pas: 100 },
  { t: '+ de 5 000 €', min: 5000, max: 12000, pas: 500 },
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

export const T_TRESORERIE = [
  { t: '− de 5 000 €', min: 1000, max: 5000, pas: 500 },
  { t: '5 000–10 000 €', min: 5000, max: 10000, pas: 1000 },
  { t: '10 000–20 000 €', min: 10000, max: 20000, pas: 2000 },
  { t: '20 000–40 000 €', min: 20000, max: 40000, pas: 5000 },
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
  deux: ic('<circle cx="9" cy="8.4" r="3"/><circle cx="16.4" cy="9.4" r="2.4"/><path d="M3.4 19.6c0-3.1 2.5-5 5.6-5s5.6 1.9 5.6 5"/><path d="M15.4 14.8c2.7.2 4.6 2 4.6 4.8"/>'),
};

/* Les types de crédit. L'ordre suit ce que Mickael annonce prendre en
   charge sur la page « Regroupement de crédits » du site. */
export const TYPES_CREDIT = [
  { v: 'conso', ic: ICONES.carte, label: 'Prêt personnel / conso' },
  { v: 'auto', ic: ICONES.voiture, label: 'Crédit auto ou LOA' },
  { v: 'reval', ic: ICONES.boucle, label: 'Crédit renouvelable' },
  { v: 'immo', ic: ICONES.immeuble, label: 'Prêt immobilier' },
  { v: 'autre', ic: ICONES.billets, label: 'Autre engagement' },
];

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

  /* ---------------------------------------------------------------- */
  /* 2. L'inventaire des crédits                                       */
  /* ---------------------------------------------------------------- */
  /* ⚠ UN CRÉDIT PAR ÉCRAN, SES QUATRE CHIFFRES ENSEMBLE. Une question
     par champ ferait trente-deux écrans pour huit crédits ; personne ne
     va au bout. L'écran à plusieurs champs existe déjà dans la maison —
     c'est celui des coordonnées du simulateur immobilier. */
  for (let i = 1; i <= CREDITS_MAX; i++) {
    const precedent = i === 1 ? null : `credit${i - 1}Autre`;
    out.push({
      id: `credit${i}`, sec: SEC.CRED, type: 'fiche', key: `credit${i}`,
      q: i === 1 ? 'Votre premier crédit' : `Votre ${RANG[i - 1]} crédit`,
      hint: i === 1
        ? 'Reprenez votre tableau d’amortissement ou votre relevé si vous l’avez sous la main. Sinon, cochez « je ne sais pas » : nous estimerons.'
        : 'Les mêmes informations que précédemment.',
      when: i === 1 ? null : (d) => d[precedent] === 'oui',
      champs: [
        { cle: 'type', lab: 'Type de crédit', type: 'liste', opts: TYPES_CREDIT },
        { cle: 'capital', lab: 'Capital restant dû', type: 'euros', hint: 'Ce qu’il reste à rembourser, pas le montant emprunté au départ.' },
        { cle: 'mensualite', lab: 'Mensualité', type: 'euros' },
        { cle: 'taux', lab: 'Taux annuel', type: 'pourcent', inconnu: true },
        { cle: 'mois', lab: 'Durée restante', type: 'mois', inconnu: true },
        /* ⚠ CE CHAMP NE S'AFFICHE QUE POUR UN PRÊT IMMOBILIER, et il
           n'est pas décoratif : la page du site annonce « Prêt
           immobilier — intégré au regroupement ou conservé à part ».
           Conservé à part, il ne rejoint pas le capital racheté mais
           reste une charge mensuelle. Les deux calculs n'ont rien à
           voir, et c'est au client de dire lequel il veut. */
        {
          cle: 'integre', lab: 'Ce prêt doit-il entrer dans le regroupement ?',
          type: 'ouinon', quand: (v) => v.type === 'immo', defaut: 'oui',
        },
      ],
    });
    if (i < CREDITS_MAX) {
      out.push({
        id: `credit${i}Autre`, sec: SEC.CRED, type: 'choice', key: `credit${i}Autre`,
        q: 'Avez-vous un autre crédit en cours ?',
        hint: 'Découverts et dettes se déclarent juste après : ne les comptez pas ici.',
        when: (d) => !!d[`credit${i}`],
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
    hint: 'Le reste à vivre demandé par les établissements dépend de la taille du foyer.',
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
  out.push({
    id: 'objectif', sec: SEC.OBJ, type: 'choice', key: 'objectif',
    q: 'Qu’attendez-vous de l’opération ?',
    hint: 'Votre réponse oriente le montage que nous vous proposerons.',
    opts: [
      { v: 'mensualite', ic: ICONES.fleche, label: 'Alléger ma mensualité' },
      { v: 'capacite', ic: ICONES.maison, label: 'Retrouver de la capacité d’emprunt' },
      { v: 'projet', ic: ICONES.billets, label: 'Financer un projet' },
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
  });

  out.push({ id: 'resultat', sec: '', type: 'resultat' });

  return out;
}
