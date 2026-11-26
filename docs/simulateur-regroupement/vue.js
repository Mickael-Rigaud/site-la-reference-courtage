/* =====================================================================
   vue.js — ce que le visiteur voit, et rien de ce qu'il calcule
   ---------------------------------------------------------------------
   Ce fichier pose des éléments dans la page et lit ce qu'on y saisit. Il
   ne décide d'aucun chiffre : tout vient de `moteur.js`, toutes les
   questions viennent de `parcours.js`. Une faute ici se voit à l'écran ;
   une faute là-bas se voit dans les nombres. Les deux ne se cachent pas
   l'une derrière l'autre.

   ⚠ LES CLASSES CSS NE SONT PAS LIBRES. L'habillage est emprunté au
   simulateur immobilier (voir `faire-regroupement.py`) : `.opt`, `.in`,
   `label.lab`, `.field`, `.chip`, `.cards .card`, `.verdict`, `#rail li`
   avec `.rdot` et `.rlbl`, `.lrc-feu` avec son `.boitier` et ses trois
   `.lampe`. Renommer l'une d'elles ne casse rien visiblement : la page
   s'affiche, simplement nue. Il faut donc la regarder, pas la supposer.
   ===================================================================== */
import { questions, TYPES_CREDIT, CREDITS_MAX } from './parcours.js?v=36e8ceac';
import { verdict, totaux, fourchettePrete, seuilsPrets, BAREME, dureesProposees } from './moteur.js?v=36e8ceac';

const $ = (s) => document.querySelector(s);
const R = {};              // les réponses, au fil du parcours
let pas = 0;               // où l'on en est dans la liste visible

/* =====================================================================
   CE QUI VIENT DE LA PRISE DE RENDEZ-VOUS — 25/11/2026
   ---------------------------------------------------------------------
   Mickael : « quand on prend rendez-vous pour le projet regroupement de
   crédits, je voudrais que l'on change le simulateur que l'on peut
   retrouver juste après la prise de rendez-vous ».

   Jusqu'ici la page de rendez-vous envoyait TOUT LE MONDE sur
   `/simulateur/` — le simulateur de faisabilité d'achat — quel que soit
   le projet déclaré. Elle route désormais vers celui-ci quand le projet
   est « Regroupement de crédits ».

   ⚠ CHANGER LE LIEN NE SUFFISAIT PAS, ET C'EST LE PIÈGE. Le simulateur
   immobilier sait relire les réponses déjà données ; celui-ci ne savait
   rien. Lié tel quel, il aurait redemandé le nom et l'adresse e-mail que
   le visiteur venait de saisir, et le serveur aurait ouvert un SECOND
   dossier à côté du rendez-vous au lieu de compléter le premier.

   ⚠ MÊME CLÉ, MÊME FORME QUE LE SIMULATEUR IMMOBILIER. `lrc-preparation`
   est écrite par la page de rendez-vous ET par `/preparer/` (le lien du
   mail). Inventer ici une seconde clé aurait donné deux chemins qui
   dérivent — c'est précisément ce que le commentaire de la page de
   rendez-vous s'engage à éviter.

   ⚠ `sessionStorage` MEURT AVEC L'ONGLET, et c'est voulu : ces
   coordonnées n'ont pas à traîner sur l'appareil après la visite. On ne
   l'efface pas tout de suite pour autant — un rechargement ne doit pas
   vider le questionnaire sous les doigts du visiteur.

   ⚠ UN STOCKAGE REFUSÉ NE DOIT RIEN CASSER (navigation privée, réglages
   restrictifs) : le parcours s'ouvre alors normalement, écran des
   coordonnées compris. C'est le comportement d'avant, pas une panne.
   ===================================================================== */
const PREPARATION = (() => {
  try {
    const brut = sessionStorage.getItem('lrc-preparation');
    const o = brut ? JSON.parse(brut) : null;
    return (o && typeof o === 'object') ? o : null;
  } catch (e) { return null; }
})();

const texte = (v) => (v === undefined || v === null) ? '' : String(v).trim();

if (PREPARATION && texte(PREPARATION.email)) {
  R.prenom = texte(PREPARATION.prenom);
  R.nom = texte(PREPARATION.nom);
  R.email = texte(PREPARATION.email);
  /* ⚠ LE CONSENTEMENT VIENT DU FORMULAIRE DE RENDEZ-VOUS, où il est
     exigé avant l'envoi (`consentementDonne`). On ne le fabrique pas :
     on le reprend, et seulement quand une adresse e-mail prouve que le
     formulaire est bien allé jusqu'au bout. C'est aussi ce que fait le
     simulateur immobilier, qui saute son écran « Vos coordonnées » dans
     exactement le même cas. */
  R.consent = true;
  /* Lu par `parcours.js` pour masquer l'écran des coordonnées. Le double
     souligné dit qu'il ne s'agit pas d'une réponse du visiteur. */
  R.__rdv = true;
  R.__quand = texte(PREPARATION.quand);
}

/* ------------------------------------------------------------------ */
/* Mise en forme                                                       */
/* ------------------------------------------------------------------ */
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* ⚠ UNE INSÉCABLE ORDINAIRE, PAS LA FINE DE `toLocaleString`.
   25/11/2026, Mickael : « la séparation tous les 3 chiffres ne s'applique
   pas partout ». Mesuré : elle s'appliquait PARTOUT — mais avec deux
   caractères différents. `toLocaleString('fr-FR')` pose une espace FINE
   insécable (U+202F), très étroite : à la taille d'une carte de résultat
   elle se voit à peine, et « 148 000 € » se lit comme un seul bloc. Les
   champs de saisie, eux, employaient une espace ordinaire, bien visible.
   D'où l'impression que la séparation sautait par endroits.

   On remplace donc la fine par une insécable ordinaire (U+00A0) : même
   largeur qu'une espace normale, donc identique aux champs de saisie, et
   elle ne casse pas un montant en fin de ligne. */
const ESPACE_FINE = ' ';
const INSECABLE = ' ';
const milliers = (n, options) => n.toLocaleString('fr-FR', options)
  .split(ESPACE_FINE).join(INSECABLE);

const eur = (n) => (n == null || !isFinite(n))
  ? '—' : milliers(Math.round(n)) + INSECABLE + '€';
/* L'espace devant le « % » est insécable elle aussi : un pourcentage
   coupé en fin de ligne se lit mal, et on garde la même espace que
   devant le « € » pour que les deux aient la même allure. */
const pct = (x) => (x == null || !isFinite(x))
  ? '—' : (x * 100).toFixed(1).replace('.', ',') + INSECABLE + '%';
const duree = (mois) => {
  if (!mois) return '—';
  const a = Math.floor(mois / 12), m = mois % 12;
  return a + ' an' + (a > 1 ? 's' : '') + (m ? ' et ' + m + ' mois' : '');
};

/* ⚠ UNE SAISIE EN EUROS N'ARRIVE PAS PROPRE : « 1 200 € », « 1.200 »,
   « 1 200,50 ». On retire tout ce qui n'est pas un chiffre ou une
   virgule, et la virgule devient le point du JavaScript. Sans ça,
   `Number('1 200')` rend NaN et le total du foyer part à zéro sans que
   rien ne le signale. */
const nombre = (v) => {
  const t = String(v == null ? '' : v).replace(/[^\d,.-]/g, '').replace(',', '.');
  const n = parseFloat(t);
  return isFinite(n) ? n : null;
};

/* ------------------------------------------------------------------ */
/* Les milliers se séparent pendant la frappe                          */
/* ------------------------------------------------------------------ */
/* 25/11/2026, Mickael : « quand on met les chiffres, je voudrais une
   séparation à chaque 3 chiffres ». « 148000 » se relit en comptant les
   zéros ; « 148 000 » se lit.

   ⚠ UNE ESPACE ORDINAIRE, PAS UNE ESPACE FINE INSÉCABLE. Le reste du
   site compose ses montants avec `toLocaleString`, qui pose une fine
   insécable — parfaite pour du texte, mauvaise dans un champ de saisie :
   selon le clavier et le navigateur, elle se sélectionne mal et se
   supprime à moitié. `nombre()` retire de toute façon tout ce qui n'est
   pas un chiffre, donc la valeur enregistrée est la même. */
const separerMilliers = (chiffres) => chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Reformate un champ de montant sans faire sauter le curseur.
 *
 * ⚠ ON NE REPOSE PAS LE CURSEUR AU MÊME INDICE : ajouter une espace
 * devant lui le décalerait d'un cran à chaque millier franchi, et
 * corriger un chiffre au milieu de « 1 480 00 » deviendrait impossible.
 * On compte les CHIFFRES à sa gauche, et on le replace après le même
 * nombre de chiffres une fois la chaîne reformatée.
 */
function formaterMontant(el) {
  const avant = el.value;
  const curseur = el.selectionStart;
  const chiffresAGauche = avant.slice(0, curseur).replace(/\D/g, '').length;

  const chiffres = avant.replace(/\D/g, '');
  const apres = chiffres ? separerMilliers(chiffres) : '';
  if (apres === avant) return;
  el.value = apres;

  let vus = 0, pos = 0;
  while (pos < apres.length && vus < chiffresAGauche) {
    if (/\d/.test(apres[pos])) vus++;
    pos++;
  }
  try { el.setSelectionRange(pos, pos); } catch (e) { /* champ non sélectionnable */ }
}

/* ------------------------------------------------------------------ */
/* Les questions réellement posées                                     */
/* ------------------------------------------------------------------ */
const TOUTES = questions();
const visibles = () => TOUTES.filter((q) => !q.when || q.when(R));

/**
 * Les réponses mises dans la forme attendue par le moteur.
 *
 * ⚠ LES CRÉDITS SONT RANGÉS PAR ÉCRAN (`credit1`, `credit2`…) et lus en
 * tableau. La conversion se fait ici, à un seul endroit : si elle
 * traînait dans le moteur, le moteur dépendrait de la façon dont les
 * questions sont numérotées, ce qui n'est pas son affaire.
 */
/**
 * Les mois qui restent jusqu'à une dernière échéance.
 *
 * ⚠ LA CONVERSION VIT ICI, ET NULLE PART AILLEURS. Depuis le 25/11/2026
 * l'écran demande une date — « novembre 2031 » se lit sur un tableau
 * d'amortissement, « 186 mois » demande un calcul que personne ne fait.
 * Le moteur, lui, raisonne en mois : c'est le seul endroit qui doit
 * connaître les deux.
 *
 * ⚠ ON COMPTE EN MOIS PLEINS, PAS EN JOURS. Le jour exact de l'échéance
 * ne change rien à une estimation, et le demander aurait ajouté une
 * question pour rien. Une date déjà passée rend 0 : le crédit est fini,
 * et c'est au moteur de décider quoi en faire, pas à cette fonction.
 */
function moisJusqua(aaaaMm) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(aaaaMm || '').trim());
  if (!m) return null;
  const an = Number(m[1]), mois = Number(m[2]);
  if (!(mois >= 1 && mois <= 12) || !(an >= 2000 && an <= 2100)) return null;
  const now = new Date();
  const ecart = (an - now.getFullYear()) * 12 + (mois - (now.getMonth() + 1));
  return Math.max(0, ecart);
}

/* =====================================================================
   Le tableau d'amortissement d'Élodie (26/11/2026)
   ---------------------------------------------------------------------
   Repris de son fichier Excel « Tableau d'amortissement » :
     mensualité  = PMT(taux/12 ; durée ; -montant)
     capital dû  = montant − Σ PPMT des échéances passées
     échéances   = EDATE mois par mois depuis la première
   Assurance à 0 dans le fichier : tout est hors assurance.
   ⚠ UNE ÉCHÉANCE DU MOIS EN COURS EST COMPTÉE PAYÉE. On ne connaît que le
   mois de la première échéance, pas son jour : la règle la plus simple
   à vérifier pour le visiteur est « celle de ce mois-ci est passée ».
   ===================================================================== */
function echeancesPayees(aaaaMm) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(aaaaMm || '').trim());
  if (!m) return null;
  const now = new Date();
  const ecart = (now.getFullYear() - Number(m[1])) * 12 + ((now.getMonth() + 1) - Number(m[2]));
  return ecart >= 0 ? ecart + 1 : 0;
}
function amortissement(c) {
  const P = Number(c.montantDepart) || 0;
  const n = (typeof c.duree === 'number' && c.duree > 0) ? c.duree : 0;
  const t = (typeof c.taux === 'number' && c.taux >= 0) ? c.taux : null;
  const out = { restants: null, capital: null, mensualite: null };
  const payees = echeancesPayees(c.debut);
  if (n && payees !== null) out.restants = Math.max(0, n - Math.min(n, payees));
  if (P > 0 && n && t !== null) {
    const i = t / 12;
    out.mensualite = Math.round((i ? P * i / (1 - Math.pow(1 + i, -n)) : P / n) * 100) / 100;
    if (payees !== null) {
      const k = Math.min(n, payees);
      const crd = i ? P * (Math.pow(1 + i, n) - Math.pow(1 + i, k)) / (Math.pow(1 + i, n) - 1) : P * (1 - k / n);
      out.capital = Math.max(0, Math.round(crd));
    }
  }
  return out;
}

/* Pré-remplit l'écran « aujourd'hui » d'un crédit. Une valeur que le
   visiteur a saisie ou corrigée (`…Saisi`) ou déclarée inconnue n'est
   jamais écrasée ; les autres suivent les réponses du premier écran,
   même si on y revient les modifier. `…Calcule` marque ce qui vient du
   calcul, pour l'écran et pour l'agence. */
function preremplir(q) {
  if (!q || !q.preremplir) return;
  const v = { ...(R[q.key] || {}) };
  const calc = amortissement(v);
  for (const cle of ['restants', 'capital', 'mensualite']) {
    if (v[cle + 'Saisi'] || v[cle + 'Inconnu']) continue;
    if (calc[cle] != null) { v[cle] = cle === 'mensualite' ? Math.round(calc[cle]) : calc[cle]; v[cle + 'Calcule'] = true; }
    else if (v[cle + 'Calcule']) { delete v[cle]; delete v[cle + 'Calcule']; }
  }
  R[q.key] = v;
}

/** Les mois écoulés depuis une date de début « AAAA-MM ». */
function moisDepuis(aaaaMm) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(aaaaMm || '').trim());
  if (!m) return null;
  const now = new Date();
  const ecart = (now.getFullYear() - Number(m[1])) * 12 + ((now.getMonth() + 1) - Number(m[2]));
  return ecart >= 0 ? ecart : null;
}

/**
 * Un crédit tel que le moteur l'attend : sa durée restante en mois.
 *
 * ⚠ TROIS SOURCES, DANS CET ORDRE (26/11/2026) :
 *   1. le nombre d'échéances restantes, quand le visiteur le donne ;
 *   2. sinon le nombre total d'échéances moins celles déjà passées
 *      depuis la date de début — la première échéance comptée payée ;
 *   3. sinon la « dernière échéance » des saisies d'avant le 26/11.
 * Aucune ne passe ? `mois` reste absent, et le moteur le reconstitue à
 * partir du taux, ou le marque comme approché.
 */
function avecDuree(c) {
  if (!c) return c;
  let mois = (typeof c.restants === 'number' && c.restants > 0) ? c.restants : null;
  if (mois === null && typeof c.duree === 'number' && c.duree > 0) {
    const passes = echeancesPayees(c.debut);
    if (passes !== null && c.duree - passes > 0) mois = c.duree - passes;
  }
  if (mois === null) mois = moisJusqua(c.fin);
  return mois === null ? c : { ...c, mois };
}

function pourLeMoteur() {
  const credits = [];
  /* ⚠ LE PRÊT IMMOBILIER EN TÊTE, ET SON TYPE POSÉ ICI. L'écran ne
     demande pas son type — il vient d'être déclaré à la première
     question — donc personne ne l'a écrit dans les réponses. C'est le
     seul endroit où il manquerait : sans cette ligne, le moteur le
     prendrait pour un crédit sans nature, l'opération ne basculerait
     jamais en hypothécaire, et le récapitulatif l'appellerait
     « Crédit ». */
  if (R.pretImmo && R.pretImmo.capital) credits.push(avecDuree({ ...R.pretImmo, type: 'immo' }));

  /* ⚠ LE TYPE EST RECOLLÉ ICI. Depuis le 25/11 il est choisi sur son
     propre écran (`credit1Type`) et ne vit plus dans l'objet du crédit :
     c'est ce qui permet de n'avoir qu'une liste à l'écran, puis les
     chiffres seuls. Le moteur, lui, a besoin des deux ensemble — et
     c'est le seul endroit qui en a besoin. */
  for (let i = 1; i <= CREDITS_MAX; i++) {
    const c = R['credit' + i];
    if (c && c.capital) credits.push(avecDuree({ ...c, type: R['credit' + i + 'Type'] || c.type }));
  }
  /* Un crédit déclaré « prêt immobilier » avant de passer locataire ne
     compte plus comme tel : l'écran ne le propose plus, le moteur ne doit
     pas le voir non plus. */
  const sansBien = R.logement === 'locataire' || R.logement === 'heberge';
  const propres = sansBien ? credits.map((c) => (c.type === 'immo' ? { ...c, type: 'autre' } : c)) : credits;
  return { ...R, credits: propres, dureeChoisie: R.__duree };
}

/* ------------------------------------------------------------------ */
/* Le fil d'Ariane                                                     */
/* ------------------------------------------------------------------ */
function dessinerRail() {
  const liste = visibles();
  const sections = [];
  liste.forEach((q, i) => {
    if (!q.sec) return;
    const d = sections[sections.length - 1];
    if (!d || d.nom !== q.sec) sections.push({ nom: q.sec, de: i, a: i });
    else d.a = i;
  });

  $('#rail').innerHTML = sections.map((s) => {
    const etat = pas > s.a ? 'done' : (pas >= s.de ? 'cur' : '');
    const combien = s.a - s.de + 1;
    return `<li class="${etat}"><span class="rdot"></span>
      <span class="rlbl">${esc(s.nom)}<small>${combien} question${combien > 1 ? 's' : ''}</small></span></li>`;
  }).join('') + `<li class="rfin ${pas >= liste.length - 1 ? 'cur' : ''}">
      <span class="rdot"></span><span class="rlbl">Votre comparatif</span></li>`;
}

/* ------------------------------------------------------------------ */
/* Les écrans                                                          */
/* ------------------------------------------------------------------ */
/* Les options d'une question : une liste, ou une fonction des réponses
   (les types de crédit n'offrent pas le prêt immobilier à un locataire). */
const optsDe = (q) => (typeof q.opts === 'function' ? q.opts(R) : (q.opts || []));

function ecranChoice(q) {
  const val = R[q.key];
  return `<div class="options">` + optsDe(q).map((o) => `
    <button type="button" class="opt${val === o.v ? ' sel' : ''}" data-v="${esc(o.v)}">
      <span class="ic">${o.ic || ''}</span><span>${esc(o.label)}</span>
    </button>`).join('') + `</div>`;
}

/* Plusieurs réponses (26/11/2026) : un clic coche ou décoche, et c'est
   « Continuer » qui avance — sur un écran à choix multiple, avancer au
   premier clic empêcherait justement d'en cocher un second.
   `aria-pressed` dit l'état à qui n'en voit pas la couleur. */
function ecranMulti(q) {
  const choisis = Array.isArray(R[q.key]) ? R[q.key] : [];
  return `<div class="options">` + q.opts.map((o) => {
    const on = choisis.includes(o.v);
    return `<button type="button" class="opt rg-multi${on ? ' sel' : ''}" data-multi="${esc(o.v)}" aria-pressed="${on}">
      <span class="ic">${o.ic || ''}</span><span>${esc(o.label)}</span>
      <span class="rg-coche" aria-hidden="true">${on ? '✓' : ''}</span>
    </button>`;
  }).join('') + `</div>`;
}

/**
 * Un montant, en deux gestes : la tranche, puis la valeur exacte.
 *
 * 25/11/2026, Mickael : « le même système que l'autre simulateur pour
 * être vraiment précis sur les chiffres ». Un champ libre produit des
 * chiffres ronds — 2 000, 3 000 — parce que personne ne tape son
 * salaire à l'euro près dans une case. Deux rangées de pastilles, et on
 * obtient 2 300.
 *
 * ⚠ LA VALEUR EXACTE S'ARRÊTE AVANT LE HAUT DE LA TRANCHE. Proposer
 * 2 500 dans la tranche « 2 000–2 500 » le proposerait DEUX FOIS, ici et
 * en tête de la tranche suivante — et les deux clics ne rangeraient pas
 * la réponse au même endroit. Seule la dernière tranche, qui est
 * ouverte, va jusqu'à sa borne.
 */
function valeursDe(tr, dernier) {
  const out = [];
  const fin = (dernier || tr.inclus) ? tr.max : tr.max - tr.pas;
  for (let v = tr.min; v <= fin && out.length < 20; v += tr.pas) out.push(v);
  return out;
}

function ecranTranches(q) {
  const liste = q.tranches || [];
  const i = R[q.key + '_tr'];
  const choisie = (typeof i === 'number') ? liste[i] : null;
  const val = R[q.key];

  const tranches = liste.map((tr, k) => `
    <button type="button" class="chip${i === k ? ' sel' : ''}" data-tranche="${k}">${esc(tr.t)}</button>`).join('');

  const precis = choisie ? valeursDe(choisie, i === liste.length - 1).map((v) => `
    <button type="button" class="chip${Number(val) === v ? ' sel' : ''}" data-val="${v}">${eur(v)}</button>`).join('') : '';

  return `<div class="field">
      <span class="rg-valeur">${val != null ? esc(eur(val)) : (choisie ? esc(choisie.t) : '')}</span>
      <div class="rg-tranches">${tranches}</div>
      ${choisie ? `<div class="rg-precis-mot">Choisissez la valeur précise ci-dessous.</div>
        <div class="rg-precis">${precis}</div>` : ''}
      ${/* La saisie à la main, toujours possible (26/11/2026) : un montant
            hors des pastilles — 7 350 € de revenus, par exemple — doit
            pouvoir s'écrire sans passer par une tranche. */ ''}
      <div class="rg-libre">
        <label class="lab" for="t-${esc(q.key)}">Ou saisissez le montant exact</label>
        <input class="in" id="t-${esc(q.key)}" data-libre="${esc(q.key)}" inputmode="numeric" autocomplete="off"
               placeholder="0" value="${val != null && !(choisie && valeursDe(choisie, i === liste.length - 1).includes(Number(val))) ? esc(separerMilliers(String(val))) : ''}">
      </div>
    </div>`;
}

/**
 * Un crédit : ses quatre chiffres sur un seul écran.
 *
 * ⚠ « JE NE SAIS PAS » DOIT ÊTRE AUSSI FACILE À COCHER QUE LE CHAMP EST
 * À REMPLIR. C'est la condition pour que l'inventaire aille au bout. La
 * case grise le champ au lieu de le masquer : un champ qui disparaît
 * donne l'impression d'avoir perdu sa réponse.
 */
/**
 * La liste des champs d'une fiche.
 *
 * ⚠ ELLE PEUT ÊTRE UNE FONCTION, et il faut la résoudre PARTOUT où on la
 * lit. « Ce prêt doit-il entrer dans le regroupement ? » ne se pose que
 * sur un prêt immobilier, et le type est choisi à l'écran précédent :
 * d'où une liste qui dépend des réponses. Le 25/11/2026 je l'ai résolue
 * à l'affichage et oublié dans le gestionnaire de saisie, qui faisait
 * `q.champs.find(...)` sur une fonction : exception à chaque frappe, et
 * le montant n'était pas enregistré. Les essais passaient parce qu'ils
 * injectaient les réponses directement, sans traverser la saisie.
 * Un seul point de lecture, donc, pour que l'oubli ne puisse plus se
 * répéter.
 */
const champsDe = (q) => (typeof q.champs === 'function' ? q.champs(R) : (q.champs || []));

function ecranFiche(q) {
  const v = R[q.key] || {};
  /* ⚠ L'ÉCRAN PRÉ-REMPLI LE DIT EN CLAIR (26/11/2026, Élodie : « il
     faudrait rajouter une mention sur le fait que les informations
     peuvent être modifiées »). Des cases déjà remplies se lisent comme
     un constat ; sans ce bandeau, personne ne pense à les corriger. */
  const bandeau = q.preremplir ? `<div class="rg-modifiable">
      <b>Ces montants sont modifiables.</b>
      Ils sont calculés d’après les informations de votre prêt : s’ils ne correspondent pas à votre dernier relevé, touchez la case et corrigez-la.
    </div>` : '';
  return bandeau + champsDe(q).map((c) => {
    if (c.quand && !c.quand(v)) return '';
    /* Il y avait ici un champ « liste » — une liste de choix POSÉE DANS
       une fiche. Plus personne ne s'en sert depuis le 25/11 : le type de
       crédit a son propre écran, ce qui était justement la demande.
       Retiré plutôt que gardé au cas où : un bout de code que rien
       n'exerce est un bout de code qu'on croit juste. */
    if (c.type === 'ouinon') {
      const actuel = v[c.cle] == null ? (c.defaut || 'oui') : v[c.cle];
      return `<div class="field" data-champ="${esc(c.cle)}">
        <label class="lab">${esc(c.lab)}</label>
        ${c.hint ? `<div class="aide" style="margin:0 0 10px">${esc(c.hint)}</div>` : ''}
        <div class="options">
          <button type="button" class="opt${actuel === 'oui' ? ' sel' : ''}" data-liste="${esc(c.cle)}" data-v="oui"><span>Oui, l’intégrer</span></button>
          <button type="button" class="opt${actuel === 'non' ? ' sel' : ''}" data-liste="${esc(c.cle)}" data-v="non"><span>Non, le conserver à part</span></button>
        </div></div>`;
    }
    const inconnu = v[c.cle + 'Inconnu'] === true;

    /* ⚠ ON DEMANDE UNE DATE, PAS UN NOMBRE DE MOIS (25/11/2026, Mickael :
       « au lieu de mettre le champ durée restante en mois, est-ce qu'on
       pourrait plutôt demander la date de fin de crédit ? ce serait plus
       simple pour la personne au lieu de compter le nombre de mois »).
       Il a raison : la dernière échéance est écrite sur le tableau
       d'amortissement, alors que « 186 mois » demande un calcul que
       personne ne fait. Le moteur, lui, continue de raisonner en mois :
       la conversion se fait au seul endroit qui en a besoin,
       `pourLeMoteur`. */
    if (c.type === 'moisannee') {
      /* ⚠ DEUX LISTES, PAS LE CALENDRIER NATIF (25/11/2026, Mickael :
         « le calendrier de la dernière échéance n'est pas clair, je
         voudrais quelque chose de plus simple et de plus ergonomique »).
         `type="month"` ouvre un sélecteur différent sur chaque appareil
         — une grille de mois ici, un champ à taper là — et plusieurs
         navigateurs se rabattent sur « AAAA-MM » en texte brut.
         Deux listes déroulantes, elles, ouvrent partout la roulette
         native du téléphone, se lisent sans mode d'emploi, et
         n'autorisent aucune saisie invalide. */
      const [anSel, moisSel] = String(v[c.cle] || '').split('-');
      const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const anneeCourante = new Date().getFullYear();
      /* De cette année à +40 : un prêt immobilier souscrit aujourd'hui sur
         25 ans finit bien avant, et un crédit qui se termine ce mois-ci
         doit rester saisissable. */
      const annees = [];
      /* ⚠ UNE DATE DE DÉBUT EST DANS LE PASSÉ (26/11/2026) : la liste
         part de cette année et REMONTE quarante ans, la plus récente en
         tête — c'est elle qu'on cherche le plus souvent. */
      if (c.passe) for (let y = anneeCourante; y >= anneeCourante - 40; y--) annees.push(y);
      else for (let y = anneeCourante; y <= anneeCourante + 40; y++) annees.push(y);

      return `<div class="field" data-champ="${esc(c.cle)}">
        <label class="lab" for="f-${esc(c.cle)}">${esc(c.lab)}</label>
        <div class="rg-moisannee">
          <select class="in" id="f-${esc(c.cle)}" data-moisannee="${esc(c.cle)}" data-part="mois" ${inconnu ? 'disabled' : ''}>
            <option value="">Mois</option>
            ${MOIS.map((m, i) => {
              const val = String(i + 1).padStart(2, '0');
              return `<option value="${val}"${moisSel === val ? ' selected' : ''}>${m}</option>`;
            }).join('')}
          </select>
          <select class="in" data-moisannee="${esc(c.cle)}" data-part="annee" ${inconnu ? 'disabled' : ''}>
            <option value="">Année</option>
            ${annees.map((y) => `<option value="${y}"${anSel === String(y) ? ' selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
        ${c.hint ? `<div class="aide">${esc(c.hint)}</div>` : ''}
        ${c.inconnu ? `<div style="margin-top:8px">
          <button type="button" class="chip${inconnu ? ' sel' : ''}" data-inconnu="${esc(c.cle)}">Je ne sais pas</button>
        </div>` : ''}
      </div>`;
    }

    const unite = c.type === 'pourcent' ? '%' : c.type === 'mois' ? 'mois' : '€';
    /* Les pastilles de suggestion : elles remplissent la case, qui reste
       modifiable (26/11/2026). Cochée « je ne sais pas », la question n'en
       propose plus — elles se grisent avec la case. */
    const suggestions = (c.sugg && c.sugg.length) ? `<div class="rg-sugg">${c.sugg.map((x) => `
        <button type="button" class="rg-sugg-pil${v[c.cle] === x ? ' sel' : ''}" data-sugg="${esc(c.cle)}" data-v="${x}" ${inconnu ? 'disabled' : ''}>${esc(libSugg(c, x))}</button>`).join('')}
      </div>` : '';
    return `<div class="field" data-champ="${esc(c.cle)}">
      <label class="lab" for="f-${esc(c.cle)}">${esc(c.lab)} <span class="req">${unite}</span>${
        v[c.cle + 'Calcule'] && !v[c.cle + 'Saisi'] ? ' <span class="rg-calcule">calculé pour vous</span>' : ''}</label>
      <input class="in" id="f-${esc(c.cle)}" data-saisie="${esc(c.cle)}" inputmode="${c.type === 'mois' ? 'numeric' : 'decimal'}"
             autocomplete="off" placeholder="0" ${inconnu ? 'disabled' : ''}
             value="${v[c.cle] == null ? ''
               : esc(c.type === 'euros' ? separerMilliers(String(v[c.cle]))
                 : c.type === 'pourcent' ? String(v[c.cle] * 100).replace('.', ',')
                 : v[c.cle])}">
      ${suggestions}
      ${c.hint ? `<div class="aide">${esc(c.hint)}</div>` : ''}
      ${c.inconnu ? `<div style="margin-top:8px">
        <button type="button" class="chip${inconnu ? ' sel' : ''}" data-inconnu="${esc(c.cle)}">Je ne sais pas</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

/* Le libellé d'une pastille : « 150 000 € », « 20 ans », « 2,5 % ». */
function libSugg(c, x) {
  if (c.type === 'pourcent') return (x * 100).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + INSECABLE + '%';
  if (c.type === 'mois') return (x % 12 === 0) ? (x / 12) + ' ans' : x + ' mois';
  return eur(x);
}

/* La case d'une fiche telle qu'on l'affiche pour une valeur donnée. */
function valeurAffichee(c, val) {
  if (val == null) return '';
  if (c.type === 'euros') return separerMilliers(String(val));
  if (c.type === 'pourcent') return String(Math.round(val * 10000) / 100).replace('.', ',');
  return String(val);
}

/* Les pastilles d'un champ suivent la case : celle qui vaut la saisie
   s'allume, les autres s'éteignent — qu'on ait cliqué ou tapé. */
function allumerSugg(cle, val) {
  document.querySelectorAll(`#stage [data-sugg="${cle}"]`).forEach((b) =>
    b.classList.toggle('sel', Number(b.getAttribute('data-v')) === val));
}

/* 25/11/2026, Mickael : « réadapte les champs sur deux lignes
   nom/prénom et e-mail/téléphone en 4 champs ». Quatre champs empilés
   faisaient défiler un écran entier pour quatre mots. Deux par ligne,
   et ils reviennent à une colonne sur téléphone — à 375 px, une adresse
   e-mail dans une demi-largeur ne se relit pas. */
function ecranIdentite() {
  const champ = (cle, lab, type, ac) => `<div class="field">
    <label class="lab" for="id-${cle}">${lab}</label>
    <input class="in" id="id-${cle}" data-id="${cle}" type="${type}" autocomplete="${ac}"
           value="${R[cle] == null ? '' : esc(R[cle])}">
  </div>`;
  return `<div class="rg-duo">
      ${champ('prenom', 'Prénom', 'text', 'given-name')}
      ${champ('nom', 'Nom', 'text', 'family-name')}
      ${champ('email', 'E-mail', 'email', 'email')}
      ${champ('telephone', 'Téléphone', 'tel', 'tel')}
    </div>
    <div class="field">
      <label class="lab" style="display:flex;gap:10px;align-items:flex-start;font-weight:500">
        <input type="checkbox" id="rgpd" style="margin-top:3px" ${R.consent ? 'checked' : ''}>
        <span>J’accepte que mes réponses soient utilisées pour étudier mon projet et me recontacter. Elles ne sont ni vendues ni cédées.</span>
      </label>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* L'écran de résultat                                                 */
/* ------------------------------------------------------------------ */
const FEUX = {
  vert: { titre: 'Le regroupement est jouable', mot: 'Vos réponses décrivent une opération que les établissements spécialisés acceptent de regarder.' },
  orange: { titre: 'L’opération mérite d’être travaillée', mot: 'C’est possible, mais le montage compte : la durée retenue et les crédits intégrés changent beaucoup le résultat.' },
  rouge: { titre: 'Il y a un point à lever d’abord', mot: 'En l’état, l’estimation bute sur quelque chose. Cela ne ferme pas la porte : c’est précisément ce qu’un rendez-vous sert à examiner.' },
};

function feuHtml(couleur) {
  return `<div class="lrc-feu on-${couleur} fixe" role="img" aria-label="Avis : ${couleur}">
    <div class="boitier">
      <div class="lampe rouge"><i></i></div>
      <div class="lampe orange"><i></i></div>
      <div class="lampe vert"><i></i></div>
    </div><div class="mat"></div></div>`;
}

/**
 * La jauge d'endettement, avec ses zones.
 *
 * 25/11/2026, Mickael : « je ne comprends pas vraiment le résultat au
 * premier coup d'œil ». Un taux de 43 % ne dit rien à qui n'a pas la
 * règle en tête. Posé sur une bande qui passe du vert au rouge, il se
 * lit sans explication — et le trait gris du « avant » montre le chemin
 * parcouru, qui est tout l'intérêt de l'opération.
 *
 * ⚠ PAS DE ZONES SANS BARÈME, et c'est la même règle que pour les
 * montants : les seuils qui les dessinent sont ceux de l'agence. Tant
 * qu'ils ne sont pas posés, la bande reste neutre — colorier au jugé
 * reviendrait à annoncer « vous êtes dans le rouge » sur une limite
 * inventée.
 */
/* ⚠ UNE SEULE ÉCHELLE POUR TOUT L'ÉCRAN. Les deux barres du bloc
   « taux d'endettement » et la jauge en dessous mesurent la même chose :
   si chacune avait son maximum, une barre à mi-course et une aiguille à
   mi-course ne diraient plus le même nombre, et l'œil ne le verrait
   jamais. La constante vit ici, les deux s'en servent. */
const ECHELLE_HAUT = 0.6;                 // l'échelle s'arrête à 60 %
const surEchelle = (x) => Math.max(0, Math.min(100, (x || 0) * 100 / ECHELLE_HAUT));

function jaugeHtml(avant, bas, haut, cible, max) {
  const pc = surEchelle;
  const zones = (cible && max)
    ? `background:linear-gradient(90deg,#BFE8CE 0,#BFE8CE ${pc(cible)}%,`
      + `#FBE2B4 ${pc(cible)}%,#FBE2B4 ${pc(max)}%,`
      + `#F3C3B5 ${pc(max)}%,#F3C3B5 100%)`
    : '';

  /* ⚠ TROIS REPÈRES, CHACUN NOMMÉ SUR LA JAUGE (25/11/2026, Élodie :
     « l'échelle plus claire visuellement », « le trait de la situation
     actuelle plus clair », « on ne comprend pas tellement ce serait la
     situation après le regroupement »). Un trait gris, une zone foncée et
     une aiguille noire se lisaient seulement avec la phrase du dessous.
     Chacun porte maintenant son étiquette, là où il est :
       - AUJOURD'HUI : un trait marine et une bulle au-dessus de la bande ;
       - APRÈS REGROUPEMENT : la plage, en bleu de l'agence, avec son
         accolade et ses deux chiffres en dessous ;
       - 40 % : un trait rouge en pointillés, toujours au même endroit.
     L'aiguille noire est retirée : posée sur la borne défavorable de la
     plage, elle faisait un quatrième repère sans nom.

     ⚠ L'APRÈS RESTE UNE PLAGE, PAS UN POINT : il dépend du taux obtenu, et
     le dessiner comme une position unique le ferait lire comme acquis.

     ⚠ LE TRAIT EST À 40 %, PAS À 35 % (26/11/2026, Élodie : « dans le
     résultat passe à 40 % d'endettement »). Le 35 % est la règle du prêt
     immobilier (HCSF) ; un regroupement de crédits se monte au-delà. Il
     ne s'appelle donc plus « plafond en France » — ce serait faux à
     40 % — mais « seuil d'endettement ». */
  const ancre = (p) => (p < 14 ? 'g' : p > 86 ? 'd' : 'c');
  const plage = (bas != null && haut != null);
  const pBas = plage ? pc(Math.min(bas, haut)) : 0;
  const pHaut = plage ? pc(Math.max(bas, haut)) : 0;
  const pMilieu = (pBas + pHaut) / 2;
  const texteApres = plage
    ? (Math.abs(haut - bas) < 0.0005 ? esc(pct(bas)) : `${esc(pct(Math.min(bas, haut)))} à ${esc(pct(Math.max(bas, haut)))}`)
    : '';

  return `<div class="rg-jauge${plage ? ' rg-avec-apres' : ''}">
    ${avant != null ? `<div class="rg-j-haut">
      <span class="rg-j-bulle rg-j-auj ancre-${ancre(pc(avant))}" style="left:${pc(avant)}%">
        Aujourd’hui <b>${esc(pct(avant))}</b></span>
    </div>` : ''}
    <div class="rg-j-bande">
      <div class="rg-piste"${zones ? ` style="${zones}"` : ''}></div>
      ${plage ? `<span class="rg-plage" style="left:${pBas}%;width:${Math.max(1.2, pHaut - pBas)}%"></span>` : ''}
      <span class="rg-seuil" style="left:${pc(SEUIL_FRANCE)}%"></span>
      ${avant != null ? `<span class="rg-avant" style="left:${pc(avant)}%"></span>` : ''}
    </div>
    ${plage ? `<div class="rg-j-bas">
      <span class="rg-j-accolade" style="left:${pBas}%;width:${Math.max(1.2, pHaut - pBas)}%"></span>
      <span class="rg-j-bulle rg-j-apres ancre-${ancre(pMilieu)}" style="left:${pMilieu}%">
        Après regroupement <b>${texteApres}</b></span>
    </div>` : ''}
    <div class="rg-legende">
      <span>0 %</span>
      <span class="rg-j-seuil-lab" style="left:${pc(SEUIL_FRANCE)}%">40 % · seuil d’endettement</span>
      <span>60 %</span>
    </div>
  </div>`;
}

/* Le seuil d'endettement retenu pour un regroupement de crédits (40 %,
   Élodie, 26/11/2026). Le même pour tout le monde, quel que soit le
   résultat : c'est le repère fixe par rapport auquel chacun se situe.
   (Le nom de la constante date du 35 % HCSF du 25/11.) */
const SEUIL_FRANCE = 0.40;

/**
 * Le tableau des scénarios.
 *
 * ⚠ LES TROIS COLONNES NE SE SÉPARENT PAS. La page « Regroupement de
 * crédits » du site s'y engage : « Nous vous présentons systématiquement
 * la mensualité, la durée et le coût total côte à côte. » Une version
 * qui n'afficherait que la mensualité serait plus vendeuse et
 * contredirait l'agence par écrit.
 */
/**
 * Aujourd'hui contre apres : deux cartes face a face.
 *
 * 25/11/2026, Mickael : « le tableau de la situation et de ce qu'elle
 * deviendrait n'est pas assez clair, ca ne donne pas envie ». Un tableau
 * a cinq colonnes se lit comme un releve de banque ; deux cartes en
 * vis-a-vis se lisent comme un avant/apres, sans effort.
 *
 * ⚠ LE COUT TOTAL RESTE A COTE DE LA MENSUALITE ET DE LA DUREE. La page
 * « Regroupement de credits » du site s'y engage par ecrit. Changer la
 * mise en forme ne change pas la promesse : les trois sont dans chaque
 * carte, et l'ecart figure en toutes lettres sous la seconde.
 */
function comparatifHtml(v) {
  const t = v.totaux;
  const f = v.fourchette;
  if (!f) return '';
  const plage = (bas, haut) => (bas === haut ? eur(bas) : `${eur(bas)} \u2013 ${eur(haut)}`);

  /* L'ecart peut etre negatif des deux cotes, positif des deux, ou
     traverser zero. Les trois cas se disent differemment — en annoncer
     un seul reviendrait a choisir celui qui arrange. */
  const ecart = f.surcoutBas > 0
    ? `<span class="rg-surcout">+ ${esc(plage(f.surcoutBas, f.surcoutHaut))} au total</span>`
    : (f.surcoutHaut <= 0
      ? `<span class="rg-gain">\u2212 ${esc(plage(Math.abs(f.surcoutHaut), Math.abs(f.surcoutBas)))} au total</span>`
      : `<span>de <b class="rg-gain">\u2212 ${esc(eur(Math.abs(f.surcoutBas)))}</b> \u00e0 <b class="rg-surcout">+ ${esc(eur(f.surcoutHaut))}</b> au total</span>`);

  return `<div class="rg-duel">
    <div class="rg-duel-carte rg-duel-avant">
      <div class="rg-duel-titre">Aujourd\u2019hui</div>
      <div class="rg-duel-gros">${esc(eur(t.mensualiteActuelle))}<small>par mois</small></div>
      <div class="rg-duel-lignes">
        <div><span>Jusqu\u2019en</span><b>${esc(duree(t.horizon))}</b></div>
        <div><span>Co\u00fbt total</span><b>${esc(eur(t.restantAPayer))}</b></div>
        <div><span>Cr\u00e9dits</span><b>${t.nombre}</b></div>
      </div>
    </div>

    <div class="rg-duel-vs" aria-hidden="true">&rarr;</div>

    <div class="rg-duel-carte rg-duel-apres">
      <div class="rg-duel-titre">Apr\u00e8s regroupement</div>
      <div class="rg-duel-gros">${esc(plage(f.mensualiteBasse + t.mensualiteConservee, f.mensualiteHaute + t.mensualiteConservee))}<small>par mois</small></div>
      <div class="rg-duel-lignes">
        <div><span>Sur</span><b>${esc(duree(f.mois))}</b></div>
        <div><span>Co\u00fbt total</span><b>${esc(plage(f.coutBas, f.coutHaut))}</b></div>
        <div><span>Mensualit\u00e9s</span><b>1 seule</b></div>
      </div>
    </div>
  </div>
  <div class="rg-note">${ecart} &mdash; par rapport \u00e0 vos cr\u00e9dits men\u00e9s \u00e0 leur terme.
  ${f.tauxBas === f.tauxHaut
    ? `Calcul\u00e9 au taux de ${esc(pct(f.tauxBas))} sur ${f.annees} ans, hors assurance`
    : `La fourchette vient du taux, qui d\u00e9pend de l\u2019\u00e9tablissement sollicit\u00e9 : ${esc(pct(f.tauxBas))} au mieux, ${esc(pct(f.tauxHaut))} au plus haut`}${t.mensualiteConservee ? ', et la mensualit\u00e9 affich\u00e9e comprend les cr\u00e9dits que vous conservez' : ''}.</div>`;
}

/** Ce que le simulateur a compris, crédit par crédit. */
function creditsHtml(v) {
  const l = v.totaux.lignes;
  if (!l.length) return '';
  return `<div>
    <h3>Ce que nous avons compris</h3>
    <div class="rg-credits">${l.map((c) => {
      const nom = (TYPES_CREDIT.find((t) => t.v === c.type) || {}).label || 'Crédit';
      const det = [eur(c.capital) + ' restant dû', eur(c.mensualite) + ' par mois',
        c.taux != null ? pct(c.taux) : null, c.mois ? duree(c.mois) : null]
        .filter(Boolean).join(' · ');
      return `<div class="rg-credit">
        <span class="rg-credit-nom">${esc(nom)}</span>
        <span class="rg-credit-det">${esc(det)}</span>
        ${c.incoherent ? '<span class="rg-douteux">date à vérifier</span>' : ''}
        ${c.estime.length ? '<span class="rg-estime">estimé</span>' : ''}
        ${c.integre ? '' : '<span class="rg-conserve">conservé à part</span>'}
      </div>`;
    }).join('')}</div>
  </div>`;
}

/** Et maintenant ? Trois étapes, pour que l'écran ne finisse pas sur un vide. */
/**
 * Une solution, quelle que soit la situation.
 *
 * 25/11/2026, Mickael : « je veux que le prospect ait une solution qui
 * lui soit donnee peu importe sa situation ».
 *
 * ⚠ CE BLOC NE DISPARAIT JAMAIS. Un ecran qui se termine sur « ca ne
 * passe pas » renvoie quelqu'un a son probleme sans rien lui donner — et
 * c'est precisement celui-la qui avait le plus besoin d'un courtier. Le
 * texte change selon le cas, sa presence non.
 */
function suiteHtml(v) {
  const f = v.fourchette;
  const bloque = v.blocages && v.blocages.length;
  const monte = f && f.gainMax <= 0;

  let titre, mot;
  if (bloque) {
    titre = 'Il y a quand m\u00eame une solution \u00e0 chercher';
    mot = 'Une estimation ne conna\u00eet que vos r\u00e9ponses. Le point qui bloque ici se traite souvent autrement : '
      + 'une dur\u00e9e diff\u00e9rente, un cr\u00e9dit laiss\u00e9 de c\u00f4t\u00e9, une garantie, ou un \u00e9tablissement '
      + 'qui regarde votre dossier autrement. C\u2019est exactement ce pour quoi un courtier existe.';
  } else if (monte) {
    titre = 'Le regroupement n\u2019est peut-\u00eatre pas la bonne porte';
    /* \u26a0 DEUX CAUSES BIEN DIFF\u00c9RENTES, ET ON NE DOIT PAS LES CONFONDRE.
       Une mensualit\u00e9 qui monte vient soit de cr\u00e9dits d\u00e9j\u00e0 bien plac\u00e9s,
       soit \u2014 bien plus souvent \u2014 d'une dur\u00e9e de rachat plus COURTE que
       l'\u00e9ch\u00e9ance actuelle : rembourser la m\u00eame somme en moins de temps
       co\u00fbte forc\u00e9ment plus par mois, quel que soit le taux. Attribuer
       le second cas au premier donnait une explication fausse \u00e0
       quelqu'un qui cherche pr\u00e9cis\u00e9ment \u00e0 comprendre. */
    const plusCourt = f && v.totaux && v.totaux.horizon > f.mois;
    mot = plusCourt
      ? `Vos cr\u00e9dits actuels courent encore ${duree(v.totaux.horizon)}, et la dur\u00e9e choisie ici est de `
        + `${f.annees} ans : rembourser la m\u00eame somme en moins de temps co\u00fbte forc\u00e9ment plus par mois, `
        + 'quel que soit le taux obtenu. Cela reste utile si vous cherchez une seule \u00e9ch\u00e9ance ou une tr\u00e9sorerie \u2014 '
        + 'et sinon, Mickael Rigaud vous le dira franchement et regardera les autres pistes avec vous.'
      : 'Vos cr\u00e9dits actuels sont \u00e0 de bonnes conditions : les regrouper co\u00fbterait plus cher chaque mois. '
        + 'Cela reste utile si vous cherchez une seule \u00e9ch\u00e9ance ou une tr\u00e9sorerie \u2014 et sinon, '
        + 'Mickael Rigaud vous le dira franchement et regardera les autres pistes avec vous.';
  } else if (!f) {
    titre = 'Votre situation est entre de bonnes mains';
    mot = 'Votre inventaire est complet. Mickael Rigaud reprend vos chiffres et vous donne '
      + 'la mensualit\u00e9, la dur\u00e9e et le co\u00fbt total exacts.';
  } else {
    titre = 'Voici comment on avance';
    mot = 'Les chiffres ci-dessus sont une estimation : le montage r\u00e9el se travaille, et c\u2019est l\u00e0 '
      + 'que se gagnent les meilleures conditions.';
  }

  const etapes = bloque
    ? ['Mickael Rigaud vous rappelle sous 48\u00a0h ouvr\u00e9es pour comprendre ce qui bloque vraiment.',
       'Il cherche le montage qui contourne le point de blocage, ou vous dit franchement s\u2019il n\u2019y en a pas.',
       'Aucun honoraire n\u2019est d\u00fb avant le d\u00e9blocage des fonds, et l\u2019\u00e9tude ne vous engage \u00e0 rien.']
    : ['Mickael Rigaud reprend votre inventaire et v\u00e9rifie vos chiffres \u2014 sous 48\u00a0h ouvr\u00e9es.',
       'Il monte le dossier et le pr\u00e9sente aux \u00e9tablissements sp\u00e9cialis\u00e9s les mieux plac\u00e9s.',
       'Aucun honoraire n\u2019est d\u00fb avant le d\u00e9blocage des fonds, et l\u2019\u00e9tude ne vous engage \u00e0 rien.'];

  return `<div class="rg-suite">
    <b>${esc(titre)}</b>
    <div class="rg-suite-mot">${esc(mot)}</div>
    <ol>${etapes.map((e) => `<li>${esc(e)}</li>`).join('')}</ol>
  </div>`;
}

function conseilHtml(v) {
  const f = v.fourchette;
  if (!f) return '';
  /* ⚠ CETTE PHRASE N'ENTRE DANS AUCUN CALCUL et c'est la plus importante
     de l'écran. La page du site le dit : « nous retenons le montage qui
     sert votre objectif, pas celui qui affiche la plus belle baisse de
     mensualité. » Elle reprend donc ce que le visiteur a déclaré vouloir. */
  const mots = {
    /* ⚠ « BAISSERAIT » EST FAUX QUAND LA MENSUALITÉ MONTE, et c'est le
       cas quand les crédits actuels sont à taux bas et à longue
       échéance. Annoncer un allègement à quelqu'un dont la mensualité
       augmenterait serait la pire des phrases de cet écran. */
    mensualite: f.gainMin >= 0
      ? (f.gainMin === f.gainMax
        ? `Vous cherchez à alléger : sur ${f.annees} ans, votre mensualité baisserait de ${eur(f.gainMin)} par mois.`
        : `Vous cherchez à alléger : sur ${f.annees} ans, votre mensualité baisserait de ${eur(f.gainMin)} à ${eur(f.gainMax)} par mois selon le taux obtenu.`)
      : f.gainMax <= 0
        /* ⚠ PAS DE CAUSE AVANCÉE ICI. Elle est donnée une seule fois, et
           au bon endroit : `suiteHtml` sait distinguer la durée plus
           courte des bonnes conditions actuelles. Deux explications
           légèrement différentes du même chiffre, sur le même écran, se
           contrediraient tôt ou tard. */
        ? `Vous cherchez à alléger, et sur ${f.annees} ans le regroupement coûterait ${f.gainMin === f.gainMax ? eur(Math.abs(f.gainMax)) : eur(Math.abs(f.gainMax)) + ' à ' + eur(Math.abs(f.gainMin))} de plus par mois. Il reste utile pour d’autres raisons — une seule échéance, une trésorerie — et c’est à regarder ensemble.`
        : `Vous cherchez à alléger : selon le taux obtenu, votre mensualité irait de ${eur(Math.abs(f.gainMin))} de plus à ${eur(f.gainMax)} de moins. Tout se joue sur les conditions décrochées, et c’est précisément le travail du courtier.`,
    capacite: `Vous visez un futur emprunt : c’est votre taux d’endettement qui compte, et il passerait sous la barre indiquée ci-dessus. Une durée plus courte le ferait remonter mais coûterait bien moins cher — nous regarderons les deux ensemble.`,
    projet: `Votre projet est financé dans la même opération : vous n’avez plus qu’une seule mensualité, et c’est la durée qui décide de son poids.`,
    revenus: `Pour absorber une baisse de revenus, c’est la mensualité qui compte : elle passerait de ${eur(v.totaux.mensualiteActuelle)} à ${f.mensualiteBasse === f.mensualiteHaute
      ? eur(f.mensualiteBasse + v.totaux.mensualiteConservee)
      : eur(f.mensualiteBasse + v.totaux.mensualiteConservee) + ' – ' + eur(f.mensualiteHaute + v.totaux.mensualiteConservee)} par mois.`,
  };
  const mot = mots[R.objectif];
  return mot ? `<p>${esc(mot)}</p>` : '';
}

/* =====================================================================
   Modifier ses réponses (26/11/2026)
   ---------------------------------------------------------------------
   Élodie : « une fois le résultat donné je voudrais avoir la possibilité
   de revenir en arrière […] et modifier mes informations », puis, après
   une première version qui relisait chaque écran en une ligne : « la
   liste est trop longue, je voudrais tout simplement un bouton pour
   retourner sur le formulaire et modifier toutes mes informations ».
   Un bouton, donc : il ramène au premier écran, toutes les réponses déjà
   remplies. Pendant la correction, « Revoir mon résultat » ramène au
   résultat sans repasser par tous les écrans suivants.
   ===================================================================== */
function modifierHtml() {
  return `<div class="rg-modifier">
    <span>Une information à corriger ?</span>
    <button type="button" class="rg-modifier-btn" data-modifier="0">Modifier mes réponses</button>
  </div>`;
}

/* =====================================================================
   Les trois durées, côte à côte (26/11/2026)
   ---------------------------------------------------------------------
   Élodie : « je voudrais pouvoir proposer 3 durées : non hypothécaire =
   5, 10, 15 ans et hypothécaire = 15, 20, 25 ans ».
   Trois cartes : mensualité, coût total, taux d'endettement. Un clic en
   choisit une, et tout le résultat suit — feu, cartes, comparatif. La
   plus courte coûte moins au total, la plus longue allège le mois : le
   visiteur voit l'arbitrage au lieu de le subir.
   ===================================================================== */
function dureesHtml(d, v) {
  const f = v.fourchette;
  if (!f) return '';
  const liste = dureesProposees(f.nature);
  if (liste.length < 2) return '';
  const cartes = liste.map((a) => {
    const w = a === f.annees ? v : verdict({ ...d, dureeChoisie: a });
    const g = w.fourchette;
    if (!g) return '';
    const mensu = g.mensualiteHaute + w.totaux.mensualiteConservee;
    const on = a === f.annees;
    return `<button type="button" class="rg-duree${on ? ' sel' : ''}" data-duree="${a}" aria-pressed="${on}">
      <span class="rg-duree-ans">${a} ans</span>
      <span class="rg-duree-mensu">${esc(eur(mensu))}<small> / mois</small></span>
      <span class="rg-duree-ligne"><span>Coût total</span><b>${esc(eur(g.coutHaut))}</b></span>
      <span class="rg-duree-ligne"><span>Endettement</span><b>${esc(pct(w.apresHaut))}</b></span>
      <span class="rg-duree-choix">${on ? 'Durée affichée' : 'Choisir cette durée'}</span>
    </button>`;
  }).join('');
  return `<div class="rg-durees">
    <h3>Choisissez votre durée</h3>
    <p class="rg-note" style="margin:0 0 12px">Plus la durée est courte, plus le coût total baisse ; plus elle est longue, plus la mensualité s’allège.</p>
    <div class="rg-durees-grille">${cartes}</div>
  </div>`;
}

function ecranResultat() {
  const d = pourLeMoteur();
  const v = verdict(d);

  /* La demande part ici, au moment où le résultat s'affiche — et une seule
     fois, `envoyerAuCrm` s'en charge. */
  envoyerAuCrm(v);

  const f = v.fourchette;
  const t = v.totaux;
  const plage = (bas, haut) => (bas === haut ? eur(bas) : `${eur(bas)} – ${eur(haut)}`);

  /* ⚠ UNE SAISIE IMPOSSIBLE SE DIT AVANT LES CHIFFRES, PAS APRÈS.
     Quand une durée déclarée ne tient pas avec le capital et la
     mensualité, tout le « aujourd'hui » est faussé — et donc toute la
     comparaison. L'avertissement est donc placé en tête du résultat,
     pas en note de bas de page où il serait lu trop tard. Et il est
     défini AVANT le retour « sans fourchette » : l'inventaire seul est
     tout aussi faux, barème ou pas. */
  const douteux = (t.incoherents || []).length;
  const alerteSaisie = douteux ? `<div class="rg-alerte rg-alerte-saisie">
      <b>Une date de fin ne colle pas avec vos chiffres</b>
      <div class="rg-note" style="margin:6px 0 0">Sur ${douteux === 1 ? 'un de vos crédits' : `${douteux} de vos crédits`},
      la dernière échéance indiquée arrive trop tôt pour que la mensualité déclarée rembourse le capital restant dû.
      Nous avons recalculé la durée au plus juste, mais vérifiez la date — ou la mensualité — avant de vous fier à la comparaison.</div>
    </div>` : '';

  /* ------------------------------------------------- sans fourchette */
  /* ⚠ IL RESTE BEAUCOUP À DIRE SANS LE MOINDRE TAUX : le nombre de
     crédits, le capital, ce que ça pèse aujourd'hui, le détail ligne par
     ligne. C'était le reproche de Mickael le 25/11 sur l'écran d'avant. */
  if (!f) {
    const cartes = [
      ['Crédits déclarés', String(t.nombre), false],
      ['Capital restant dû', eur(t.capital), true],
      ['Mensualités actuelles', eur(t.mensualiteActuelle), false],
      ['Taux d’endettement', pct(v.avant), false],
    ].map(([l, n, pivot]) => `<div class="rg-chiffre${pivot ? ' rg-pivot' : ''}">
        <span class="rg-lab">${esc(l)}</span><span class="rg-val">${esc(n)}</span>
      </div>`).join('');

    return `<div class="rg-resultat rg-neutre">
      <div class="rg-bandeau">
        <div class="rg-bandeau-txt">
          <h2>Votre inventaire est complet</h2>
          <p>Vous déclarez ${t.nombre} crédit${t.nombre > 1 ? 's' : ''} à regrouper${t.conserves.length ? ', et ' + t.conserves.length + ' que vous conservez' : ''}.</p>
        </div>
      </div>
      ${alerteSaisie}
      <div class="rg-chiffres">${cartes}</div>
      ${v.avant != null ? jaugeHtml(v.avant, null, null, null, null) : ''}
      ${creditsHtml(v)}
      <div class="rg-alerte">
        <b>Votre mensualité vous sera donnée par votre courtier.</b>
        <div class="rg-note" style="margin:6px 0 0">Les conditions d’un regroupement dépendent de l’établissement sollicité.
        Plutôt que d’afficher un chiffre qui ne serait pas le vôtre, nous préférons vous le donner une fois votre dossier regardé.</div>
      </div>
      ${suiteHtml(v)}
      ${modifierHtml()}
    </div>`;
  }

  /* ------------------------------------------------- avec fourchette */
  const F = FEUX[v.feu] || null;
  const mensuBasse = f.mensualiteBasse + t.mensualiteConservee;
  const mensuHaute = f.mensualiteHaute + t.mensualiteConservee;

  /* ⚠ « GAIN » EST FAUX QUAND LA MENSUALITÉ MONTE. Sur un dossier dont
     les crédits actuels sont à taux bas et à longue échéance, racheter
     au taux haut COÛTE plus par mois : la carte affichait alors « Gain
     par mois : -204 € – 68 € », un gain négatif, qui ne se lit pas.
     Le libellé suit donc ce que disent les chiffres, et les trois cas
     sont nommés. */
  const [labGain, valGain] = (f.gainMin >= 0)
    ? ['Gain par mois', plage(f.gainMin, f.gainMax)]
    : (f.gainMax <= 0)
      ? ['Mensualité en plus', plage(Math.abs(f.gainMax), Math.abs(f.gainMin))]
      /* La fourchette traverse zéro : selon le taux obtenu, la mensualité
         baisse ou monte. On le dit dans les deux sens plutôt que de
         choisir celui qui arrange. */
      : ['Variation mensuelle', `${eur(Math.abs(f.gainMin))} de plus à ${eur(f.gainMax)} de moins`];

  /* ⚠ L'ENDETTEMENT N'EST PLUS UNE CARTE : il a son propre bloc, juste
     en dessous et bien plus gros (demande de Mickael du 25/11). Le
     garder ici en plus l'aurait dit deux fois, dont une en petit. */
  const cartes = [
    ['Nouvelle mensualité', plage(mensuBasse, mensuHaute), true],
    [labGain, valGain, false],
    ['Capital regroupé', eur(f.montant.base), false],
  ].map(([l, n, pivot]) => {
    /* ⚠ UNE VALEUR QUI N'EST PAS UN MONTANT DOIT POUVOIR REVENIR À LA
       LIGNE. « 228 € de plus à 187 € de moins » ne tient pas sur une
       ligne, et la carte la coupait en silence — vu sur une capture de
       Mickael, le texte finissait par « de moi… ». */
    const long = String(n).length > 16;
    return `<div class="rg-chiffre${pivot ? ' rg-pivot' : ''}">
      <span class="rg-lab">${esc(l)}</span>
      <span class="rg-val${long ? ' rg-val-texte' : ''}">${esc(n)}</span>
    </div>`;
  }).join('');

  /* Le bandeau : coloré quand les seuils de l'agence sont posés, neutre
     sinon — on ne qualifie pas un dossier sur une limite qu'on aurait
     inventée. Les chiffres, eux, s'affichent dans les deux cas. */
  /* ⚠ EN HYPOTHÉCAIRE, LE FEU VIENT DE LA QUOTITÉ (26/11/2026) : on dit
     donc d'où il vient, avec les deux chiffres qui le font. Un feu sans
     sa raison se lit comme un avis ; avec elle, comme un calcul. */
  const motQuotite = (v.motif === 'quotite' && f.montant.valeur)
    ? `<p class="rg-quotite">Montant à financer, frais compris : <b>${esc(eur(f.montant.total))}</b>, soit <b>${esc(pct(v.quotite))}</b> de la valeur de votre bien (${esc(eur(f.montant.valeur))}).</p>`
    : '';
  const bandeau = F
    ? `<div class="rg-bandeau">${feuHtml(v.feu)}
         <div class="rg-bandeau-txt"><h2>${esc(F.titre)}</h2><p>${esc(F.mot)}</p>${motQuotite}</div>
       </div>`
    : `<div class="rg-bandeau"><div class="rg-bandeau-txt">
         <h2>Voici ce que donnerait l’opération</h2>
         <p>${f.tauxBas === f.tauxHaut
           ? `Calculé au taux moyen de ${esc(pct(f.tauxBas))} sur ${f.annees} ans. Mickael Rigaud affinera avec vous selon l’établissement retenu.`
           : 'Une fourchette, et non un chiffre unique : le taux dépend de l’établissement sollicité. Mickael Rigaud affinera avec vous.'}</p>
       </div></div>`;

  /* ⚠ LE CHIFFRE QUI RÉSUME TOUT, ÉCRIT EN GRAND. Mickael, 25/11 :
     « l'ancien et le nouveau taux d'endettement je voudrais qu'il soit
     plus en avant ». Il était en petit sous la jauge, dans la même
     graisse que les mentions légales. L'ancien est maintenant barré, le
     nouveau est gros et coloré : on lit le mouvement avant les mots. */
  /* ⚠ DEUX BLOCS, PAS UN SEUL (25/11/2026, Mickael : « sépare le taux
     d'endettement et l'échelle de mesure »). Ils répondaient à deux
     questions différentes dans le même cadre : « de combien je passe à
     combien », qui se lit en une seconde, et « où ça me situe », qui
     demande de comprendre une règle graduée. Empilés, le second noyait
     le premier — le chiffre qui résume tout se lisait par-dessus une
     bande de couleur qui attirait l'œil davantage.

     Le premier bloc ne porte donc plus aucune graduation : deux cartes
     côte à côte, deux barres de longueur comparable, et c'est tout. La
     règle graduée a son propre encadré, en dessous, avec sa légende. */
  const points = (x) => Math.abs(x * 100).toFixed(1).replace('.', ',') + ' points';
  const baisse = v.apresHaut != null && v.apresHaut < v.avant;   // baisse même au pire
  const hausse = v.apresBas != null && v.apresBas > v.avant;     // monte même au mieux

  const tauxHtml = (v.avant != null && v.apresBas != null) ? `<div class="rg-taux">
      <div class="rg-taux-lab">Votre taux d’endettement</div>
      <div class="rg-taux-duo">
        <div class="rg-taux-carte">
          <span class="rg-taux-quand">Aujourd’hui</span>
          <span class="rg-taux-val">${esc(pct(v.avant))}</span>
          <span class="rg-taux-barre"><i style="width:${surEchelle(v.avant)}%"></i></span>
        </div>
        <div class="rg-taux-fleche" aria-hidden="true">&rarr;</div>
        <div class="rg-taux-carte rg-taux-apres${baisse ? ' est-mieux' : (hausse ? ' est-pire' : '')}">
          <span class="rg-taux-quand">Après regroupement</span>
          <span class="rg-taux-val">${v.apresBas === v.apresHaut ? esc(pct(v.apresBas)) : `${esc(pct(v.apresBas))} – ${esc(pct(v.apresHaut))}`}</span>
          <!-- Deux longueurs : la barre pleine va jusqu'a la borne
               favorable, la claire prolonge jusqu'a la defavorable. La
               plage se voit sans qu'un seul chiffre soit presente comme
               acquis. (Pas d'accent grave ici : commentaire DANS un
               gabarit JavaScript.) -->
          <span class="rg-taux-barre"><i style="width:${surEchelle(v.apresBas)}%"></i><u style="left:${surEchelle(v.apresBas)}%;width:${Math.max(0, surEchelle(v.apresHaut) - surEchelle(v.apresBas))}%"></u></span>
        </div>
      </div>
      <div class="rg-taux-mot">${baisse
        ? (v.apresBas === v.apresHaut
          ? `Soit <b class="rg-mieux">${esc(points(v.avant - v.apresHaut))} de moins</b>.`
          : `Soit <b class="rg-mieux">${esc(points(v.avant - v.apresHaut))} de moins</b> au minimum, et jusqu’à ${esc(points(v.avant - v.apresBas))} selon le taux obtenu.`)
        : (hausse
          ? `Soit <b class="rg-pire">${esc(points(v.apresBas - v.avant))} de plus</b> au mieux : sur cette durée, l’opération alourdit le budget au lieu de l’alléger.`
          : `Selon le taux obtenu, il passerait en dessous ou au-dessus d’aujourd’hui : tout se joue sur les conditions décrochées.`)}</div>
    </div>` : '';

  const echelleHtml = (v.avant != null && v.apresBas != null) ? `<div class="rg-echelle">
      <div class="rg-echelle-lab">Où cela vous situe</div>
      ${jaugeHtml(v.avant, v.apresBas, v.apresHaut, BAREME.ENDETTEMENT_CIBLE, BAREME.ENDETTEMENT_MAX)}
      <div class="rg-echelle-mot">
        <span class="rg-cle"><i class="rg-cle-auj"></i>Aujourd’hui : votre taux d’endettement actuel</span>
        <span class="rg-cle"><i class="rg-cle-apres"></i>Après regroupement : ce qu’il deviendrait${v.apresBas === v.apresHaut ? '' : ', selon le taux obtenu'}</span>
        <span class="rg-cle"><i class="rg-cle-seuil"></i>40 % : le seuil d’endettement retenu pour un regroupement de crédits</span>
        <span class="rg-cle-fin">Plus c’est à gauche, plus votre budget respire.</span>
      </div>
    </div>` : '';

  return `<div class="rg-resultat rg-${v.feu || 'neutre'}">
    ${bandeau}
    ${alerteSaisie}
    <div class="rg-chiffres">${cartes}</div>
    ${tauxHtml}
    ${echelleHtml}
    ${v.blocages && v.blocages.length ? `<div class="rg-blocages">
      <b>Ce qu’il faut lever</b><ul>${v.blocages.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
    ${dureesHtml(d, v)}
    <div><h3>Votre situation, et ce qu’elle deviendrait</h3>${comparatifHtml(v)}${conseilHtml(v)}</div>
    ${creditsHtml(v)}
    ${suiteHtml(v)}
    ${modifierHtml()}
    <div>
      ${t.approximatif ? `<div class="rg-note">Certains taux ou durées n’étaient pas connus : ils ont été estimés à partir du capital et de la mensualité.</div>` : ''}
      ${!f.montant.fraisInclus ? `<div class="rg-note">Calculé hors frais de dossier et de garantie, qui dépendent de l’établissement retenu.</div>`
        /* Ni taux ni montant côté visiteur (26/11/2026, Élodie : « mets juste
           frais de notaire, frais de dossiers et de courtage, ne mets pas le
           détail ni le montant »). Le mail interne, lui, garde le détail. */
        : `<div class="rg-note">Frais inclus dans le montant financé : ${f.montant.nature === 'hypothecaire'
          ? 'frais de notaire, frais de dossier et de courtage'
          : 'frais de dossier et de courtage'}.</div>`}
      <div class="rg-note">${f.tauxBas === f.tauxHaut ? `Taux annuel moyen de ${esc(pct(f.tauxBas))}` : 'Fourchettes de taux indicatives'} au ${esc(BAREME.DATE)}, hors assurance, sur ${f.annees} ans.
      Estimation non contractuelle : elle ne constitue ni une offre de prêt ni un accord de financement.
      Un crédit vous engage et doit être remboursé : vérifiez vos capacités de remboursement avant de vous engager.</div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* L'envoi au CRM                                                      */
/* ------------------------------------------------------------------ */
const CRM = 'https://qnidmkufauzguultdmky.supabase.co/functions/v1/simulateur-courtage';
let envoye = false;

/** Le récapitulatif lisible, pour la fiche et pour le mail de l'agence. */
/* =====================================================================
   Le message qui arrive a l'agence
   ---------------------------------------------------------------------
   25/11/2026, Mickael : « on ne comprend pas directement de quelle
   demande il s'agit, je veux quelque chose de comprehensible
   visuellement ».

   Le message precedent etait une suite de lignes grises, sans en-tete et
   sans hierarchie : ouvert sur un telephone, entre un rendez-vous et une
   candidature, rien ne disait d'ou il venait ni quoi en faire.

   ⚠ TROIS CHOSES DOIVENT SE LIRE EN UNE SECONDE, et dans cet ordre : DE
   QUOI il s'agit (un regroupement, pas un achat), QUI appelle (avec son
   numero cliquable), et CE QU'IL FAUT RETENIR (la fourchette). Le reste
   — l'inventaire, le budget — vient apres, pour preparer l'appel.

   ⚠ PAS D'APLAT DE COULEUR SUR UN BOUTON : les filtres anti-spam
   declassent les boutons a fond plein, lecon deja payee sur les envois de
   RGD. Le bandeau de titre n'est pas un bouton, lui, il peut etre plein.
   Le lien vers la fiche est ajoute par le serveur, et il est a contour.

   ⚠ TOUT EN TABLES ET EN STYLES EN LIGNE : une messagerie n'applique ni
   feuille externe, ni grille moderne.
   ===================================================================== */
function recapHtml(v) {
  const t = v.totaux;
  const f = v.fourchette;
  const qui = [R.prenom, R.nom].filter(Boolean).join(' ').trim() || 'Sans nom';

  /* La couleur du bandeau redit le feu, et reste neutre tant que les
     seuils de l'agence ne sont pas poses. */
  const TONS = { vert: '#1B8A4B', orange: '#C77A08', rouge: '#C0472B' };
  const ton = TONS[v.feu] || '#0A6F86';
  const verdict = v.feu
    ? { vert: 'Feu vert', orange: 'Feu orange', rouge: 'Feu rouge' }[v.feu]
    : 'Avis non attribué';

  const ligne = (k, val, gras) => (val ? `<tr>
    <td style="padding:6px 14px 6px 0;color:#4A6579;font-size:13.5px;white-space:nowrap">${esc(k)}</td>
    <td style="padding:6px 0;color:#15384E;font-size:14px${gras ? ';font-weight:700' : ''}">${val}</td></tr>` : '');

  /* La deuxième ligne d'un crédit : ce qu'il était à la signature, et la
     valeur du bien quand c'est un prêt immobilier (26/11/2026). Rien ne
     s'écrit pour un champ laissé à « je ne sais pas ». */
  const MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const dateFr = (aaaaMm) => {
    const m = /^(\d{4})-(\d{2})$/.exec(String(aaaaMm || ''));
    return m ? MOIS_FR[Number(m[2]) - 1] + ' ' + m[1] : '';
  };
  const origine = (c) => {
    const bouts = [
      c.montantDepart ? 'emprunté ' + esc(eur(c.montantDepart)) : '',
      c.debut ? 'depuis ' + esc(dateFr(c.debut)) : '',
      c.duree ? esc(String(c.duree)) + ' échéances' + (c.restants ? ', ' + esc(String(c.restants)) + ' restantes' : '') : (c.restants ? esc(String(c.restants)) + ' échéances restantes' : ''),
      c.valeurBien ? 'bien estimé <b style="color:#15384E">' + esc(eur(c.valeurBien)) + '</b>' : '',
    ].filter(Boolean);
    return bouts.length ? `<div style="font-size:12.5px;color:#8CA2B3;margin-top:2px">${bouts.join(' &middot; ')}</div>` : '';
  };

  const credits = t.lignes.map((c) => {
    const nom = (TYPES_CREDIT.find((x) => x.v === c.type) || {}).label || 'Crédit';
    const marques = [
      /* ⚠ UNE SAISIE INTENABLE SE DIT À L'AGENCE, PAS SEULEMENT AU
         VISITEUR. La date déclarée ne remboursait pas le capital : la
         durée affichée ici est la nôtre, pas la sienne. Sans cette
         mention, Mickael rappellerait en croyant lire ce que le
         prospect a écrit — et c'est la première question à lui poser. */
      c.incoherent ? '<span style="color:#C77A08;font-weight:700">date déclarée intenable &mdash; durée recalculée</span>' : '',
      c.integre ? '' : '<span style="color:#0A6F86">conservé à part</span>',
      c.estime.length ? '<span style="color:#8CA2B3">estimé</span>' : '',
    ].filter(Boolean).join(' &middot; ');
    return `<tr>
      <td style="padding:7px 14px 7px 0;border-bottom:1px solid #EADFCE;font-size:13.5px;font-weight:600;color:#15384E;white-space:nowrap">${esc(nom)}</td>
      <td style="padding:7px 0;border-bottom:1px solid #EADFCE;font-size:13.5px;color:#4A6579">
        <b style="color:#15384E">${esc(eur(c.capital))}</b> &middot; ${esc(eur(c.mensualite))}/mois &middot;
        ${c.taux != null ? esc(pct(c.taux)) : '&mdash;'} &middot; ${esc(duree(c.mois))}${marques ? ' &middot; ' + marques : ''}
        ${origine(c)}
      </td></tr>`;
  }).join('');

  const tel = String(R.telephone || '').replace(/[^0-9+]/g, '');
  const OBJECTIFS = { mensualite: 'Alléger la mensualité', capacite: 'Retrouver de la capacité d\u2019emprunt',
    travaux: 'Financer des travaux', tresorerie: 'Obtenir de la trésorerie',
    projet: 'Financer un projet', revenus: 'Absorber une baisse de revenus' };
  /* Plusieurs raisons depuis le 26/11 ; une fiche d'avant n'en porte qu'une. */
  const raisons = (Array.isArray(R.objectifs) && R.objectifs.length ? R.objectifs : [R.objectif])
    .map((o) => OBJECTIFS[o]).filter(Boolean).join(', ');
  const LOGEMENTS = { proprio_pret: 'Propriétaire avec prêt', proprio_sans_pret: 'Propriétaire sans prêt',
    locataire: 'Locataire', heberge: 'Hébergé' };
  const MOTIFS = { travaux: 'travaux', vehicule: 'véhicule', soulte: 'rachat de soulte', autre: 'autre' };

  /* ⚠ LES RETARDS EN COURS SE VOIENT DE LOIN. C'est l'information qui
     decide si le dossier est presentable : noyee en gris au milieu d'une
     liste, elle se decouvre au telephone, trop tard. */
  const retards = R.retards === 'oui_en_cours'
    ? '<b style="color:#C0472B">EN COURS &mdash; à examiner avant toute présentation</b>'
    : esc({ non: 'Aucun', oui_regularise: 'Régularisés' }[R.retards] || '');

  const bloc = (titre, corps) => `<div style="font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:#8CA2B3;font-weight:700;margin:20px 0 6px">${titre}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${corps}</table>`;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ton};border-radius:14px 14px 0 0">
    <tr><td style="padding:16px 20px">
      <div style="font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.82);font-weight:700">Simulateur &mdash; Regroupement de crédits</div>
      <div style="font-size:21px;font-weight:700;color:#FFFFFF;margin-top:3px">${esc(qui)}</div>
      <div style="font-size:13.5px;color:rgba(255,255,255,.92);margin-top:2px">${esc(verdict)}${f ? ' &middot; ' + esc(f.nature === 'hypothecaire' ? 'Hypothécaire' : 'Sans garantie') + ' sur ' + f.annees + ' ans' : ''}</div>
    </td></tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFCF6;border:1px solid #EADFCE;border-top:0;border-radius:0 0 14px 14px">
    <tr><td style="padding:18px 20px">

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
        ${ligne('Téléphone', tel ? `<a href="tel:${esc(tel)}" style="color:#F4801C;text-decoration:none;font-weight:700;font-size:16px">${esc(R.telephone)}</a>` : '')}
        ${ligne('E-mail', R.email ? `<a href="mailto:${esc(R.email)}" style="color:#0A6F86;text-decoration:none">${esc(R.email)}</a>` : '')}
        ${ligne('Ce qu\u2019il veut', esc(raisons), true)}
        ${ligne('Retards de paiement', retards, R.retards === 'oui_en_cours')}
      </table>

      ${f ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#FFFFFF;border:1px solid #EADFCE;border-left:3px solid ${ton};border-radius:10px">
        <tr><td style="padding:14px 16px">
          <div style="font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:#8CA2B3;font-weight:700;margin-bottom:8px">Ce que donnerait l\u2019opération</div>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${ligne('Mensualité', esc(eur(f.mensualiteBasse + t.mensualiteConservee)) + (f.mensualiteBasse === f.mensualiteHaute ? '' : ' &ndash; ' + esc(eur(f.mensualiteHaute + t.mensualiteConservee))), true)}
            ${ligne('Aujourd\u2019hui', esc(eur(t.mensualiteActuelle)))}
            ${ligne('Endettement', v.apresBas != null ? esc(pct(v.avant)) + ' &rarr; <b>' + esc(pct(v.apresBas)) + (v.apresBas === v.apresHaut ? '' : ' &ndash; ' + esc(pct(v.apresHaut))) + '</b>' : esc(pct(v.avant)))}
            ${ligne('Capital regroupé', esc(eur(f.montant.base)), true)}
            ${ligne('Frais inclus', f.montant.frais ? esc(eur(f.montant.frais)) + ' <span style="color:#8CA2B3">(' + esc(String(Math.round((f.montant.tauxFrais || 0) * 100))) + ' %)</span>' : '')}
            ${ligne('Quotité', v.quotite != null ? '<b>' + esc(pct(v.quotite)) + '</b> de ' + esc(eur(f.montant.valeur)) : '', v.quotite != null)}
            ${ligne('Coût total', esc(eur(f.coutBas)) + (f.coutBas === f.coutHaut ? '' : ' &ndash; ' + esc(eur(f.coutHaut))) + ' <span style="color:#8CA2B3">(aujourd\u2019hui ' + esc(eur(f.coutActuel)) + ')</span>')}
          </table>
        </td></tr>
      </table>` : `<div style="margin-top:16px;padding:12px 14px;border:1px solid #F3C3B5;background:#FDF1EE;border-radius:10px;font-size:13.5px;color:#C0472B">
        <b>Aucun montant calculé</b> &mdash; les fourchettes de taux ne sont pas renseignées dans le simulateur.
      </div>`}

      ${v.blocages && v.blocages.length ? `<div style="margin-top:14px;padding:12px 14px;border-left:3px solid #C0472B;background:#FDF1EE;border-radius:0 8px 8px 0">
        <div style="font-size:13px;font-weight:700;color:#C0472B;margin-bottom:4px">À lever</div>
        ${v.blocages.map((b) => `<div style="font-size:13px;color:#4A6579;margin-top:3px">&bull; ${esc(b)}</div>`).join('')}
      </div>` : ''}

      ${bloc('Ses crédits (' + t.nombre + ')', credits)}

      ${bloc('Son budget', [
        ligne('Revenus du foyer', esc(eur(R.revenus))),
        ligne('Logement', esc(LOGEMENTS[R.logement] || '')),
        ligne('Valeur du bien', R.bien && R.bien.valeurBien ? esc(eur(R.bien.valeurBien)) : ''),
        ligne('Loyer', R.loyer ? esc(eur(R.loyer)) : ''),
        ligne('Emprunteurs', esc(String(R.emprunteurs || ''))),
        ligne('Enfants à charge', R.enfants == null || R.enfants === '' ? '' : esc(String(R.enfants))),
        ligne('Dettes à régulariser', R.dettes ? esc(eur(R.dettes)) : ''),
        ligne('Trésorerie demandée', R.tresorerie ? esc(eur(R.tresorerie)) + (R.tresoMotif ? ' <span style="color:#8CA2B3">(' + esc(MOTIFS[R.tresoMotif] || '') + ')</span>' : '') : ''),
      ].join(''))}

      ${t.approximatif ? `<div style="margin-top:16px;font-size:12px;color:#8CA2B3;line-height:1.5">Certains taux ou durées n\u2019étaient pas connus du client : ils ont été estimés à partir du capital et de la mensualité.</div>` : ''}
      <div style="margin-top:10px;font-size:12px;color:#8CA2B3;line-height:1.5">${f && f.tauxBas === f.tauxHaut ? 'Taux annuel moyen de ' + esc(pct(f.tauxBas)) + ' sur ' + f.annees + ' ans' : 'Fourchettes indicatives'} au ${esc(BAREME.DATE)}, hors assurance, frais inclus.</div>

    </td></tr>
  </table>
</div>`;
}

/**
 * La demande part dans le CRM.
 *
 * ⚠ ELLE PART MÊME SANS BARÈME, et c'est le point entier. Tant que les
 * taux ne sont pas posés, l'écran n'affiche aucun montant — mais la
 * personne a répondu à dix questions et laissé ses coordonnées. Les
 * perdre serait bien pire que de ne pas afficher de chiffre.
 *
 * ⚠ ON NE BLOQUE PAS L'AFFICHAGE DESSUS. L'appel part en arrière-plan ;
 * le visiteur voit son résultat tout de suite, qu'il aboutisse ou non.
 *
 * ⚠ ET ON N'ENVOIE QU'UNE FOIS : un retour en arrière suivi d'un nouveau
 * « Continuer » repasse par l'écran de résultat, ce qui ouvrirait un
 * second dossier pour la même personne.
 */
/* ⚠ UNE CORRECTION SE RENVOIE (26/11/2026, Élodie : « renvoie la version
   corrigée »). Le visiteur peut modifier ses réponses depuis le résultat ;
   sans nouvel envoi, l'agence garderait des chiffres qui ne sont plus les
   bons. On compare donc les réponses à celles du dernier envoi : identiques,
   rien ne part (le résultat se réaffiche à chaque « Revoir mon résultat ») ;
   différentes, la version corrigée part, marquée « mise à jour ». Le CRM en
   fait un nouveau dossier — Mickael veut voir chaque demande (19/11). */
let derniereEmpreinte = null;
const empreinte = () => JSON.stringify(Object.keys(R).filter((k) => !k.startsWith('__')).sort()
  .map((k) => [k, R[k]]));

function envoyerAuCrm(v) {
  if (!R.consent) return;          // pas de consentement, pas d'envoi
  if (!R.email && !R.telephone) return;
  const e = empreinte();
  if (e === derniereEmpreinte) return;
  const miseAJour = envoye;
  derniereEmpreinte = e;
  envoye = true;

  const t = v.totaux;
  const recap = (miseAJour
    ? '<p style="font-family:Arial,sans-serif;font-size:14px;color:#C77A08;font-weight:700;margin:0 0 12px">Mise à jour : le client a corrigé ses réponses après avoir vu son résultat. Cette version remplace la précédente.</p>'
    : '') + recapHtml(v);
  const qui = [R.prenom, R.nom].filter(Boolean).join(' ') || R.email || R.telephone;

  /* ⚠ LES CLÉS DE `reponses` SONT CELLES QUE LA FONCTION DU CRM SAIT LIRE,
     et pas des noms inventés : `fn_fields_whitelist` écarte en silence
     toute clé qu'elle ne nomme pas — le piège s'est refermé quatre fois
     sur ce projet. Celles-ci existent toutes déjà, donc aucune migration
     n'est nécessaire pour que la fiche se remplisse. */
  const reponses = {
    projet: 'Regroupement de crédits',
    logement_actuel: { proprio_pret: 'Propriétaire avec prêt', proprio_sans_pret: 'Propriétaire sans prêt', locataire: 'Locataire', heberge: 'Hébergé' }[R.logement] || '',
    loyer_ou_mensualite: R.loyer ? eur(R.loyer) : '',
    nombre_emprunteurs: R.emprunteurs || '',
    enfants_a_charge: R.enfants || '',
    credits_en_cours: eur(t.mensualiteActuelle),
    nombre_de_credits: String(t.nombre),
    regroupement_credits: 'Demande via le simulateur de regroupement',
    duree_souhaitee: v.fourchette ? v.fourchette.annees + ' ans' : '',
    type_de_credit: t.lignes.map((c) => (TYPES_CREDIT.find((x) => x.v === c.type) || {}).label || c.type).join(', '),

    /* 25/11/2026 — LES SIX LIGNES VALIDÉES PAR MICKAEL.
       ⚠ `capital_rachete` ET PAS `budget`. La fiche affiche `budget` sous le
       libellé « Budget », qui est le prix d'un bien qu'on achète. Y poser la
       somme des capitaux rachetés ferait lire un achat de 29 200 € là où il
       y a un rachat de crédits. La ligne a donc sa propre clé, et `budget`
       n'est plus envoyé du tout. */
    capital_rachete: eur(t.capital),
    /* L'endettement d'AVANT. La fiche a déjà celui d'après dans
       `endettement` : avec les deux, elle affiche le mouvement — c'est lui
       qui porte le sens, pas le chiffre d'arrivée seul. */
    endettement_avant: v.avant != null ? (v.avant * 100).toFixed(1) : '',
    retards_paiement: { non: 'Aucun', oui_regularise: 'Régularisés', oui_en_cours: 'En cours' }[R.retards] || '',
    tresorerie: R.tresorerie ? eur(R.tresorerie) : '',
    tresorerie_motif: { travaux: 'Travaux', vehicule: 'Véhicule', soulte: 'Rachat de soulte', autre: 'Autre' }[R.tresoMotif] || '',
    nature_operation: v.nature === 'hypothecaire' ? 'Hypothécaire' : 'Sans garantie',
  };

  fetch(CRM, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prenom: R.prenom || '',
      nom_famille: R.nom || '',
      email: R.email || '',
      telephone: R.telephone || '',
      /* ⚠ CES DEUX-LÀ FONT BASCULER LA FICHE DU CRM (depuis le 25/11/2026,
         fonction `simulateur-courtage` v14). Le formulaire du courtage
         décide SUR CES CHAMPS de masquer le type de bien, le
         primo-accédant, la région et le prêt à taux zéro : sans eux, la
         fiche d'un rachat de crédits conso posait des questions d'achat
         immobilier. `type_financement` est la valeur du schéma,
         `objectif` celle que lisent les filtres et les listes. */
      type_financement: 'Regroupement de crédits',
      objectif: 'Rachat / renégociation',
      projet: 'renego',
      reponses,
      feu: v.feu || '',
      verdict: (FEUX[v.feu] || {}).titre || '',
      /* ⚠ LA BORNE DEFAVORABLE, pas la favorable : la fiche doit porter
         le chiffre qu'il faudra assumer au telephone, pas le meilleur. */
      endettement: v.apresHaut != null ? (v.apresHaut * 100).toFixed(1) : '',
      mensualite: v.fourchette ? String(v.fourchette.mensualiteHaute) : '',
      emprunt: v.montant && v.montant.total ? String(v.montant.total) : '',
      blocages: (v.blocages || []).join(' | '),
      /* ⚠ `message` ATTERRIT DANS `recap_simulateur`, PAS DANS LES NOTES DU
         CONTACT : la fonction du CRM vide `message` avant d'appeler
         `intake_lead_v2`, précisément pour ne plus repartir avec trente
         lignes de récapitulatif dans la fiche du contact (18/11/2026). */
      message: recap,
      subject: `Regroupement${miseAJour ? ' (mise à jour)' : ''} — ${qui}`,
      html: recap,
      consent: R.consent === true,
      consent_text: 'J’accepte que mes réponses soient utilisées pour étudier mon projet et me recontacter. Elles ne sont ni vendues ni cédées.',
      source_url: location.href,
    }),
  }).catch(() => {
    /* ⚠ ON NE REMET PAS `envoye` À FAUX. Un réseau qui coupe au mauvais
       moment peut avoir laissé passer la requête : réessayer créerait un
       doublon. La demande se rattrape par le mail, qui part du serveur. */
  });
}

/* ------------------------------------------------------------------ */
/* L'arrivée des chiffres                                              */
/* ------------------------------------------------------------------ */
/**
 * Les nombres montent jusqu'à leur valeur, l'aiguille rejoint sa place.
 *
 * 25/11/2026, Mickael : « le résultat manque […] d'animation ». Ce n'est
 * pas qu'un agrément : un chiffre qui se pose attire l'œil là où il faut
 * regarder, dans l'ordre où il faut lire.
 *
 * ⚠ ON RESPECTE `prefers-reduced-motion`. Quelqu'un qui a demandé à son
 * appareil de limiter les animations a souvent une bonne raison — le
 * mouvement peut lui donner la nausée. Il reçoit les chiffres posés.
 */
/**
 * Aucun chiffre ne dépasse de sa carte.
 *
 * 25/11/2026, Mickael : « les chiffres sortent de leur cadre ». La
 * feuille de style donne déjà une taille qui suit la largeur, mais elle
 * ne peut pas savoir qu'un montant à sept chiffres est plus large qu'un
 * à cinq. Ici on MESURE, et on réduit jusqu'à ce que ça rentre.
 *
 * ⚠ ON MESURE APRÈS L'ANIMATION D'ARRIVÉE DES CARTES, pas pendant : une
 * carte encore en cours de grandissement est plus étroite qu'à l'arrêt,
 * et on réduirait des chiffres qui tenaient très bien.
 */
/* ⚠ MESURER AVANT QUE LA POLICE N'ARRIVE, C'EST MESURER LA MAUVAISE.
   Depuis le 25/11 les montants sont en Montserrat, chargée depuis
   Google Fonts : tant qu'elle n'est pas là, le navigateur affiche
   Arial, plus étroite. Un ajustement calculé sur Arial laisse déborder
   le même montant une fois Montserrat posée — et le défaut n'apparaît
   que chez les visiteurs au réseau lent, donc jamais pendant nos
   essais. On remesure donc quand la page dit que ses polices sont
   prêtes. `document.fonts` manque sur les très vieux navigateurs : on
   ne s'y fie pas, on l'utilise s'il est là. */
function ajusterQuandLaPoliceEstLa() {
  ajusterChiffres();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(ajusterChiffres).catch(() => {});
  }
}

/* ⚠ LA MESURE NE SURVIT PAS À UN CHANGEMENT DE LARGEUR, et jusqu'ici
   personne ne la refaisait. Les cartes vivent dans une grille
   `auto-fit` : à 900 px elles sont trois par rangée, à 700 px deux —
   donc plus larges — et à 500 px une seule. Le montant, lui, garde la
   taille calculée pour la largeur d'avant. Vu en mesurant : « 274 € –
   324 € » demandait 215 px dans une carte qui n'en offrait plus que
   178, sans que rien ne le signale.

   Le cas n'est pas théorique : une rotation de téléphone, une fenêtre
   qu'on redimensionne, un clavier virtuel qui s'ouvre. C'est le même
   défaut que Mickael avait signalé le 25/11 — « les chiffres sortent de
   leur cadre » — par un autre chemin.

   Le délai regroupe la rafale d'événements qu'un redimensionnement
   produit : mesurer à chaque pixel ferait travailler la page pour rien. */
let minuteurMesure = null;
window.addEventListener('resize', () => {
  clearTimeout(minuteurMesure);
  minuteurMesure = setTimeout(ajusterChiffres, 120);
});

/* ⚠ DEUX FAMILLES DE CARTES, LE MÊME DÉBORDEMENT. Les cartes du haut
   (`.rg-chiffre`) étaient protégées depuis le 25/11 ; celles du bloc
   « taux d'endettement » ne l'étaient pas, et « 29,5 % – 34,9 % » est
   sorti de son cadre dès le premier essai — deux fois plus long qu'un
   taux seul, et c'est le cas normal, pas le cas limite. Une seule
   fonction les mesure, sinon la prochaine carte chiffrée oubliera à
   son tour. */
const CARTES_CHIFFREES = [
  ['.rg-chiffre', '.rg-val'],
  ['.rg-taux-carte', '.rg-taux-val'],
];

function ajusterChiffres() {
  CARTES_CHIFFREES.forEach(([cadre, valeur]) =>
    document.querySelectorAll('#stage ' + cadre).forEach((carte) => {
    const val = carte.querySelector(valeur);
    if (!val) return;
    val.style.fontSize = '';
    const place = carte.clientWidth
      - parseFloat(getComputedStyle(carte).paddingLeft)
      - parseFloat(getComputedStyle(carte).paddingRight);
    let taille = parseFloat(getComputedStyle(val).fontSize);
    /* 14 px est le plancher : en dessous, le chiffre cesse d'être le
       chiffre qu'on vient lire. S'il ne rentre toujours pas, mieux vaut
       qu'il dépasse visiblement — on le verra et on corrigera la carte,
       plutôt que de livrer un montant illisible. */
    let garde = 24;
    while (val.scrollWidth > place + 0.5 && taille > 14 && garde-- > 0) {
      taille -= 1;
      val.style.fontSize = taille + 'px';
    }
  }));
}

/* ⚠ UNE ÉTIQUETTE DE LA JAUGE NE SORT JAMAIS DE SON CADRE. Centrée sur
   son repère, « Après regroupement 36,0 % à 43,0 % » dépassait de 17 px
   à droite sur un téléphone de 390 px (mesuré le 25/11/2026), et la page
   défilait en largeur. Les classes `ancre-*` ne suffisent pas : elles
   devinent d'après la position, sans connaître la largeur du texte. On
   mesure donc, et on pousse l'étiquette à l'intérieur — elle reste aussi
   près de son repère que la largeur le permet. */
function calerBulles() {
  document.querySelectorAll('#stage .rg-j-bulle').forEach((b) => {
    const cadre = b.closest('.rg-jauge');
    if (!cadre) return;
    b.style.marginLeft = '0px';
    const c = cadre.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    let decale = 0;
    if (r.right > c.right) decale = c.right - r.right;
    if (r.left + decale < c.left) decale = c.left - r.left;
    b.style.marginLeft = decale + 'px';
  });
}
let calageEcoute = false;

function animerResultat() {
  calerBulles();
  // La police arrivée après coup élargit le texte : on recale une fois.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(calerBulles);
  if (!calageEcoute) { calageEcoute = true; window.addEventListener('resize', calerBulles); }
  const doux = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* L'aiguille : un tour de boucle d'affichage suffit pour que le
     navigateur voie les deux positions et interpole entre elles. */
  const aig = $('#stage .rg-aiguille');
  if (aig) {
    const cible = aig.getAttribute('data-gauche');
    if (doux) aig.style.left = cible + '%';
    else requestAnimationFrame(() => { aig.style.left = cible + '%'; });
  }

  if (doux) { ajusterQuandLaPoliceEstLa(); return; }

  document.querySelectorAll('#stage .rg-val').forEach((el) => {
    const texte = el.textContent;
    /* On n'anime que ce qui EST un nombre : « — », « Sans garantie » ou
       une plage de dates resteraient tels quels. Le préfixe (« − ») et
       le suffixe (« € », « % ») sont conservés à l'identique. */
    /* ⚠ LE NOMBRE DOIT COMMENCER ET FINIR PAR UN CHIFFRE. Avec un simple
       `[\d\s.,]+`, le groupe avalait aussi l'espace insécable qui précède
       le « € » : le suffixe se réduisait à « € », et le nombre réécrit
       pendant l'animation sortait collé au symbole, « 148 000€ », avant
       de se décoller d'un coup à l'arrivée. */
    const m = texte.match(/^(\D*?)(\d[\d   ,.]*\d|\d)(\D*)$/);
    if (!m) return;
    const brut = m[2].replace(/[  \s.]/g, '').replace(',', '.');
    const fin = parseFloat(brut);
    if (!isFinite(fin) || fin === 0) return;
    const decimales = (brut.split('.')[1] || '').length;

    const duree = 700;
    const depart = performance.now();
    const pas = (t) => {
      const k = Math.min(1, (t - depart) / duree);
      /* Décélération : vite au début, posé à l'arrivée. */
      const e = 1 - Math.pow(1 - k, 3);
      const n = fin * e;
      /* Même séparateur que `eur()` : sans ça, le nombre changerait de
         graisse apparente en arrivant à sa valeur finale. */
      el.textContent = m[1]
        + milliers(n, { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
        + m[3];
      if (k < 1) requestAnimationFrame(pas);
      else {
        el.textContent = texte;   // on finit sur le texte exact, au caractère près
        ajusterQuandLaPoliceEstLa();   // et c'est le texte final qu'on mesure
      }
    };
    requestAnimationFrame(pas);
  });

  /* Les cartes finissent d'arriver vers 0,85 s ; on mesure après, une
     fois qu'elles ont leur largeur définitive. Les valeurs qui ne sont
     pas des nombres (« 3 », « Sans garantie ») ne passent pas par
     l'animation ci-dessus et seraient sinon jamais mesurées. */
  setTimeout(ajusterQuandLaPoliceEstLa, 950);
}

/* ------------------------------------------------------------------ */
/* Le moteur d'affichage                                               */
/* ------------------------------------------------------------------ */
/**
 * Le rappel du créneau, pour qui arrive de sa prise de rendez-vous.
 *
 * ⚠ IL RESTE VISIBLE SUR TOUS LES ÉCRANS, et ce n'est pas un détail. Le
 * visiteur vient de demander un créneau ; s'il ne le voit plus, un
 * questionnaire qui s'ouvre à la place de sa confirmation se lit comme
 * une étape OBLIGATOIRE de plus avant d'être rappelé. Rappelé à chaque
 * écran, le rendez-vous reste acquis et le reste devient facultatif —
 * ce qu'il est.
 */
function rappelRdvHtml() {
  if (!R.__rdv) return '';
  const quand = texte(R.__quand);
  return `<div class="rg-rdv">
    <span class="rg-rdv-coche" aria-hidden="true">&#10003;</span>
    <span><b>Votre demande de rendez-vous est enregistrée${quand ? ' pour le ' + esc(quand) : ''}.</b>
    Ces questions servent à préparer l’échange : Mickael Rigaud arrive avec des chiffres plutôt qu’avec des questions.</span>
  </div>`;
}

function peindre() {
  const liste = visibles();
  pas = Math.max(0, Math.min(pas, liste.length - 1));
  const q = liste[pas];

  $('#sec').textContent = q.sec || '';
  $('#cnt').textContent = q.type === 'resultat' ? '' : `${pas + 1} / ${liste.length - 1}`;
  $('#bar').style.width = Math.round(pas * 100 / (liste.length - 1)) + '%';
  $('#back').style.display = pas > 0 ? '' : 'none';
  if (q.type === 'resultat') R.__correction = false;

  preremplir(q);
  const hint = typeof q.hint === 'function' ? q.hint(R) : q.hint;
  const corps = q.type === 'choice' ? ecranChoice(q)
    : q.type === 'multi' ? ecranMulti(q)
    : q.type === 'tranches' ? ecranTranches(q)
    : q.type === 'fiche' ? ecranFiche(q)
    : q.type === 'identite' ? ecranIdentite()
    : ecranResultat();

  /* L'intitulé peut dépendre des réponses — « votre premier AUTRE
     crédit » quand un prêt immobilier a déjà été saisi. */
  const intitule = typeof q.q === 'function' ? q.q(R) : q.q;
  $('#stage').innerHTML = rappelRdvHtml()
    + (R.__correction && q.type !== 'resultat'
      ? '<button type="button" class="rg-vers-resultat" data-vers-resultat="1">Revoir mon résultat &rarr;</button>' : '')
    + (intitule ? `<h2>${esc(intitule)}</h2>` : '')
    + (hint ? `<div class="hint">${esc(hint)}</div>` : '') + corps;

  /* ⚠ LE BOUTON « SUIVANT » NE S'AFFICHE PAS SUR UN ÉCRAN À UN SEUL
     CHOIX : cliquer l'option avance déjà. Le laisser obligerait à deux
     gestes là où un suffit, et c'est le reproche le plus fréquent fait
     à ce genre de parcours. */
  $('#nav').style.display = (q.type === 'choice' || q.type === 'resultat') ? 'none' : '';
  $('#next').textContent = q.type === 'identite' ? 'Voir mon comparatif' : 'Continuer';

  dessinerRail();
  if (q.type === 'resultat') animerResultat();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function avancer() {
  const liste = visibles();
  if (pas < liste.length - 1) { pas++; peindre(); }
}

/* ------------------------------------------------------------------ */
/* Les gestes                                                          */
/* ------------------------------------------------------------------ */
$('#stage').addEventListener('click', (e) => {
  const liste = visibles();
  const q = liste[pas];

  /* Une durée choisie : tout le résultat se recalcule, sans remonter la
     page — le visiteur regarde justement les cartes qu'il compare. */
  const dur = e.target.closest('[data-duree]');
  if (dur) {
    R.__duree = Number(dur.getAttribute('data-duree'));
    const y = window.scrollY;
    peindre();
    requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }));
    return;
  }

  /* « Modifier » une réponse depuis le résultat, et le chemin du retour. */
  const mod = e.target.closest('[data-modifier]');
  if (mod) {
    R.__correction = true;
    pas = Number(mod.getAttribute('data-modifier'));
    peindre();
    return;
  }
  if (e.target.closest('[data-vers-resultat]')) {
    pas = visibles().length - 1;
    peindre();
    return;
  }

  const opt = e.target.closest('.opt');
  if (opt && opt.hasAttribute('data-multi')) {
    const v = opt.getAttribute('data-multi');
    const avant = Array.isArray(R[q.key]) ? R[q.key] : [];
    /* L'ordre des options, pas l'ordre des clics : la première cochée
       dans la liste devient l'objectif principal (`objectif`). */
    const apres = q.opts.map((o) => o.v)
      .filter((x) => (x === v ? !avant.includes(v) : avant.includes(x)));
    R[q.key] = apres;
    if (q.key === 'objectifs') R.objectif = apres[0] || null;
    /* On retouche le bouton seul, sans repeindre : `peindre` remonte la
       page en haut, et chaque coche ferait sauter l'écran. */
    const on = apres.includes(v);
    opt.classList.toggle('sel', on);
    opt.setAttribute('aria-pressed', String(on));
    opt.querySelector('.rg-coche').textContent = on ? '✓' : '';
    return;
  }
  if (opt) {
    const cle = opt.getAttribute('data-liste');
    if (cle) {                                  // un champ de fiche
      R[q.key] = { ...(R[q.key] || {}), [cle]: opt.getAttribute('data-v') };
      peindre();                                 // le type peut ouvrir un champ de plus
      return;
    }
    R[q.key] = opt.getAttribute('data-v');
    /* ⚠ ON REPEINT AVANT D'AVANCER : la réponse peut faire apparaître ou
       disparaître des questions plus loin, donc changer la liste visible.
       Avancer sur une liste périmée saute un écran, au hasard. */
    peindre();
    avancer();
    return;
  }

  /* Une pastille de suggestion remplit sa case. On ne repeint pas tout
     l'écran : `peindre` remonte en haut de la page, et le visiteur perdrait
     la question qu'il est en train de remplir. */
  const sugg = e.target.closest('[data-sugg]');
  if (sugg) {
    const cle = sugg.getAttribute('data-sugg');
    const val = Number(sugg.getAttribute('data-v'));
    const c = champsDe(q).find((x) => x.cle === cle);
    R[q.key] = { ...(R[q.key] || {}), [cle]: val, [cle + 'Saisi']: true };
    const champ = document.getElementById('f-' + cle);
    const badge = champ && champ.closest('.field') && champ.closest('.field').querySelector('.rg-calcule');
    if (badge) badge.remove();
    if (champ && c) champ.value = valeurAffichee(c, val);
    allumerSugg(cle, val);
    return;
  }

  const chip = e.target.closest('.chip');
  if (chip) {
    const inconnu = chip.getAttribute('data-inconnu');
    if (inconnu) {
      const v = { ...(R[q.key] || {}) };
      v[inconnu + 'Inconnu'] = !v[inconnu + 'Inconnu'];
      if (v[inconnu + 'Inconnu']) delete v[inconnu];
      R[q.key] = v;
      peindre();
      return;
    }
    /* Première rangée : la tranche. On efface la valeur exacte au
       passage — garder « 2 300 » après être passé à « 3 500–5 000 »
       afficherait une réponse qui n'est plus dans la tranche montrée. */
    const tr = chip.getAttribute('data-tranche');
    if (tr !== null) {
      R[q.key + '_tr'] = Number(tr);
      delete R[q.key];
      peindre();
      return;
    }

    /* Seconde rangée : la valeur exacte. C'est la réponse, on enchaîne. */
    const val = chip.getAttribute('data-val');
    if (val !== null) { R[q.key] = Number(val); peindre(); avancer(); }
  }
});

/* La saisie libre se range à chaque frappe : un visiteur qui clique
   « Continuer » sans quitter le champ ne doit pas perdre sa réponse. */
$('#stage').addEventListener('input', (e) => {
  const q = visibles()[pas];
  const el = e.target;

  const cle = el.getAttribute('data-saisie');
  if (cle) {
    const champ = champsDe(q).find((c) => c.cle === cle);
    /* Les milliers se séparent sous les doigts. On formate AVANT de
       lire la valeur : `nombre()` retire les espaces de toute façon,
       mais lire d'abord puis formater ferait repeindre le champ avec un
       cran de retard sur la frappe. */
    if (champ && champ.type === 'euros') formaterMontant(el);


    let val = nombre(el.value);
    /* Un taux se saisit en « 5,9 » et se calcule en 0,059. La durée se
       saisit en mois et s'arrondit à l'entier. */
    if (champ && champ.type === 'pourcent' && val != null) val = val / 100;
    if (champ && champ.type === 'mois' && val != null) val = Math.round(val);
    R[q.key] = { ...(R[q.key] || {}), [cle]: val, [cle + 'Saisi']: true };
    const badge = el.closest('.field') && el.closest('.field').querySelector('.rg-calcule');
    if (badge) badge.remove();
    allumerSugg(cle, val);
    return;
  }

  /* Le montant exact tapé sous les tranches : il devient la réponse, et
     les pastilles de valeur précise s'éteignent. */
  const libre = el.getAttribute('data-libre');
  if (libre) {
    formaterMontant(el);
    const n = nombre(el.value);
    R[libre] = n;
    document.querySelectorAll('#stage [data-val]').forEach((x) => x.classList.toggle('sel', Number(x.getAttribute('data-val')) === n));
    const aff = document.querySelector('#stage .rg-valeur');
    if (aff) aff.textContent = n != null ? eur(n) : '';
    return;
  }

  const id = el.getAttribute('data-id');
  if (id) { R[id] = el.value; return; }
  if (el.id === 'rgpd') R.consent = el.checked;
});

$('#stage').addEventListener('change', (e) => {
  if (e.target.id === 'rgpd') { R.consent = e.target.checked; return; }

  /* ⚠ LES DEUX LISTES ÉCRIVENT UNE SEULE RÉPONSE, « AAAA-MM ». Le moteur
     et `moisJusqua` n'ont jamais connu que cette forme : les laisser
     écrire chacune la sienne aurait obligé tout le reste à savoir qu'une
     date se saisit en deux morceaux. Tant que l'un des deux manque, la
     réponse reste vide — une demi-date ne vaut rien. */
  const cle = e.target.getAttribute('data-moisannee');
  if (!cle) return;
  const q = visibles()[pas];
  const champ = e.target.closest('.field');
  const mois = champ.querySelector('[data-part="mois"]').value;
  const annee = champ.querySelector('[data-part="annee"]').value;
  R[q.key] = { ...(R[q.key] || {}), [cle]: (mois && annee) ? `${annee}-${mois}` : null };
});

$('#next').addEventListener('click', avancer);
$('#back').addEventListener('click', () => { if (pas > 0) { pas--; peindre(); } });

/* ------------------------------------------------------------------ */
/* Une poignée pour la mise au point — SUR LE POSTE DE TRAVAIL SEULEMENT */
/* ------------------------------------------------------------------ */
/* ⚠ CONDITIONNÉE À `localhost`, ET CE N'EST PAS UNE PRÉCAUTION DE
   PRINCIPE. Cette poignée donne accès au barème ET permet de sauter à
   l'écran de résultat : exposée sur le site publié, elle offrirait à
   n'importe qui le moyen d'afficher une page aux couleurs de l'agence
   portant des taux de son choix, puis d'en faire une capture. Sur
   lareferencecourtage.fr, `window.__lrc` n'existe pas.
   Elle sert à éprouver l'écran de résultat tant que les vrais taux ne
   sont pas connus — sans jamais écrire un chiffre inventé dans un
   fichier, d'où il pourrait partir en production un jour d'inattention. */
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  window.__lrc = {
    R, BAREME,
    peindre,
    allerA: (id) => { pas = visibles().findIndex((q) => q.id === id); peindre(); },
    repondre: (obj) => { Object.assign(R, obj); peindre(); },
  };
}

peindre();
