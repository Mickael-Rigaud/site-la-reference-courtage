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
import { questions, TYPES_CREDIT, CREDITS_MAX } from './parcours.js';
import { verdict, totaux, baremeComplet, BAREME } from './moteur.js';

const $ = (s) => document.querySelector(s);
const R = {};              // les réponses, au fil du parcours
let pas = 0;               // où l'on en est dans la liste visible

/* ------------------------------------------------------------------ */
/* Mise en forme                                                       */
/* ------------------------------------------------------------------ */
const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const eur = (n) => (n == null || !isFinite(n))
  ? '—' : Math.round(n).toLocaleString('fr-FR') + ' €';
const pct = (x) => (x == null || !isFinite(x))
  ? '—' : (x * 100).toFixed(1).replace('.', ',') + ' %';
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
function pourLeMoteur() {
  const credits = [];
  /* ⚠ LE PRÊT IMMOBILIER EN TÊTE, ET SON TYPE POSÉ ICI. L'écran ne
     demande pas son type — il vient d'être déclaré à la première
     question — donc personne ne l'a écrit dans les réponses. C'est le
     seul endroit où il manquerait : sans cette ligne, le moteur le
     prendrait pour un crédit sans nature, l'opération ne basculerait
     jamais en hypothécaire, et le récapitulatif l'appellerait
     « Crédit ». */
  if (R.pretImmo && R.pretImmo.capital) credits.push({ ...R.pretImmo, type: 'immo' });

  /* ⚠ LE TYPE EST RECOLLÉ ICI. Depuis le 25/11 il est choisi sur son
     propre écran (`credit1Type`) et ne vit plus dans l'objet du crédit :
     c'est ce qui permet de n'avoir qu'une liste à l'écran, puis les
     chiffres seuls. Le moteur, lui, a besoin des deux ensemble — et
     c'est le seul endroit qui en a besoin. */
  for (let i = 1; i <= CREDITS_MAX; i++) {
    const c = R['credit' + i];
    if (c && c.capital) credits.push({ ...c, type: R['credit' + i + 'Type'] || c.type });
  }
  return { ...R, credits };
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
function ecranChoice(q) {
  const val = R[q.key];
  return `<div class="options">` + q.opts.map((o) => `
    <button type="button" class="opt${val === o.v ? ' sel' : ''}" data-v="${esc(o.v)}">
      <span class="ic">${o.ic || ''}</span><span>${esc(o.label)}</span>
    </button>`).join('') + `</div>`;
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
  const fin = dernier ? tr.max : tr.max - tr.pas;
  for (let v = tr.min; v <= fin && out.length < 14; v += tr.pas) out.push(v);
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
function ecranFiche(q) {
  const v = R[q.key] || {};
  /* Les champs peuvent dépendre des réponses — « ce prêt doit-il entrer
     dans le regroupement ? » ne se pose que sur un prêt immobilier, et
     le type est désormais choisi à l'écran précédent. */
  const champs = typeof q.champs === 'function' ? q.champs(R) : q.champs;
  return champs.map((c) => {
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
    const unite = c.type === 'pourcent' ? '%' : (c.type === 'mois' ? 'mois' : '€');
    return `<div class="field" data-champ="${esc(c.cle)}">
      <label class="lab" for="f-${esc(c.cle)}">${esc(c.lab)} <span class="req">${unite}</span></label>
      <input class="in" id="f-${esc(c.cle)}" data-saisie="${esc(c.cle)}" inputmode="decimal"
             autocomplete="off" placeholder="0" ${inconnu ? 'disabled' : ''}
             value="${v[c.cle] == null ? ''
               : esc(c.type === 'euros' ? separerMilliers(String(v[c.cle]))
                 : c.type === 'pourcent' ? String(v[c.cle] * 100).replace('.', ',')
                 : v[c.cle])}">
      ${c.hint ? `<div class="aide">${esc(c.hint)}</div>` : ''}
      ${c.inconnu ? `<div style="margin-top:8px">
        <button type="button" class="chip${inconnu ? ' sel' : ''}" data-inconnu="${esc(c.cle)}">Je ne sais pas</button>
      </div>` : ''}
    </div>`;
  }).join('');
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
function jaugeHtml(avant, apres, cible, max) {
  const HAUT = 0.6;                       // l'échelle s'arrête à 60 %
  const pc = (x) => Math.max(0, Math.min(100, (x || 0) * 100 / HAUT));
  const zones = (cible && max)
    ? `background:linear-gradient(90deg,#BFE8CE 0,#BFE8CE ${pc(cible)}%,`
      + `#FBE2B4 ${pc(cible)}%,#FBE2B4 ${pc(max)}%,`
      + `#F3C3B5 ${pc(max)}%,#F3C3B5 100%)`
    : '';
  const ici = apres != null ? apres : avant;

  return `<div class="rg-jauge">
    <div class="rg-piste"${zones ? ` style="${zones}"` : ''}></div>
    ${apres != null && avant != null
      ? `<span class="rg-avant" style="left:${pc(avant)}%" title="Avant : ${esc(pct(avant))}"></span>` : ''}
    <!-- Elle part de zero et rejoint sa place : la transition CSS posee
         sur sa position horizontale la deplace, declenchee par
         animerResultat(). Rendue directement a sa place, elle serait
         deja arrivee et le mouvement n'aurait pas lieu.
         (Pas d'accent grave dans ce commentaire : il est DANS un gabarit
         JavaScript, et le premier refermerait la chaine.) -->
    <span class="rg-aiguille" style="left:0%" data-gauche="${pc(ici)}"></span>
    <div class="rg-legende">
      <span>0 %</span>
      ${cible ? `<span>${esc(pct(cible))}</span>` : '<span></span>'}
      <span>60 %</span>
    </div>
  </div>`;
}

/**
 * Le tableau des scénarios.
 *
 * ⚠ LES TROIS COLONNES NE SE SÉPARENT PAS. La page « Regroupement de
 * crédits » du site s'y engage : « Nous vous présentons systématiquement
 * la mensualité, la durée et le coût total côte à côte. » Une version
 * qui n'afficherait que la mensualité serait plus vendeuse et
 * contredirait l'agence par écrit.
 */
function comparatifHtml(v) {
  const t = v.totaux;
  const actuel = `<tr class="rg-aujourdhui">
      <td>Aujourd’hui</td>
      <td>${eur(t.mensualiteActuelle)}</td>
      <td>${duree(t.horizon)}</td>
      <td>${eur(t.restantAPayer)}</td>
      <td>—</td>
    </tr>`;

  const lignes = v.scenarios.map((s) => {
    const retenu = v.meilleur && s.annees === v.meilleur.annees;
    const ecart = s.surcout > 0
      ? `<td class="rg-surcout">+ ${eur(s.surcout)}</td>`
      : `<td class="rg-gain">− ${eur(Math.abs(s.surcout))}</td>`;
    return `<tr${retenu ? ' class="rg-retenu"' : ''}>
      <td>Sur ${s.annees} ans</td>
      <td>${eur(s.mensualite + t.mensualiteConservee)}</td>
      <td>${duree(s.mois)}</td>
      <td>${eur(s.coutTotal)}</td>
      ${ecart}
    </tr>`;
  }).join('');

  return `<div class="rg-tableau">
    <table>
      <thead><tr>
        <th></th><th>Mensualité</th><th>Durée</th><th>Coût total</th><th>Écart</th>
      </tr></thead>
      <tbody>${actuel}${lignes}</tbody>
    </table>
  </div>
  <div class="rg-note">La colonne « écart » est ce que l’opération coûte en plus, au total, par rapport à vos crédits menés à leur terme. C’est la contrepartie de la baisse de mensualité${t.mensualiteConservee ? ' — et la mensualité affichée comprend les crédits que vous conservez' : ''}.</div>`;
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
        ${c.estime.length ? '<span class="rg-estime">estimé</span>' : ''}
        ${c.integre ? '' : '<span class="rg-conserve">conservé à part</span>'}
      </div>`;
    }).join('')}</div>
  </div>`;
}

/** Et maintenant ? Trois étapes, pour que l'écran ne finisse pas sur un vide. */
function suiteHtml(v) {
  const rouge = v.feu === 'rouge';
  return `<div class="rg-suite">
    <b>Et maintenant&nbsp;?</b>
    <ol>
      <li>Mickael Rigaud reprend votre inventaire et vérifie les chiffres avec vous — sous 48&nbsp;h ouvrées.</li>
      <li>${rouge
        ? 'Il examine le point qui bloque : c’est souvent là qu’une solution existe, et une estimation ne connaît que vos réponses.'
        : 'Il monte le dossier et le présente aux établissements spécialisés les mieux placés.'}</li>
      <li>Aucun honoraire n’est dû avant le déblocage des fonds, et l’étude ne vous engage à rien.</li>
    </ol>
  </div>`;
}

function conseilHtml(v) {
  if (!v.scenarios.length) return '';
  const court = v.scenarios[0];
  const long = v.scenarios[v.scenarios.length - 1];
  const mots = {
    mensualite: `Vous cherchez à alléger : c’est le scénario sur ${long.annees} ans qui le fait le plus, ${eur(long.gainMensuel)} par mois — et ${eur(long.surcout)} de plus au total.`,
    capacite: `Vous visez un futur emprunt : c’est la durée la plus courte qui vous sert, ${court.annees} ans. Elle allège moins (${eur(court.gainMensuel)} par mois) mais coûte bien moins cher, et une banque regardera la date de fin.`,
    projet: `Votre projet est financé dans la même opération : vous n’avez qu’une mensualité, et c’est la durée qui décide de son poids.`,
    revenus: `Pour absorber une baisse de revenus, la mensualité la plus basse (${long.annees} ans) donne de l’air tout de suite. Nous regarderons si elle peut se raccourcir plus tard.`,
  };
  const mot = mots[R.objectif];
  return mot ? `<p>${esc(mot)}</p>` : '';
}

function ecranResultat() {
  const d = pourLeMoteur();
  const v = verdict(d);

  /* La demande part ici, au moment où le résultat s'affiche — et une seule
     fois, `envoyerAuCrm` s'en charge. */
  envoyerAuCrm(v);

  /* ⚠ LE BARÈME ABSENT N'EST PAS UNE PANNE À CACHER. Tant que Mickael
     n'a pas donné ses taux, la page montre le parcours, l'inventaire et
     l'endettement — qui ne dépendent d'aucun taux — et dit franchement
     que les montants manquent. Afficher un zéro ou un tiret sans
     explication laisserait croire à un bug ; afficher un chiffre
     inventé serait pire. */
  if (!baremeComplet()) {
    /* ⚠ SANS BARÈME, L'ÉCRAN DOIT QUAND MÊME DIRE QUELQUE CHOSE. C'est
       le reproche de Mickael le 25/11 : il ne montrait qu'un paragraphe
       et une barre grise. Tout ce qui ne dépend pas des taux — le
       nombre de crédits, le capital, ce que ça pèse aujourd'hui, le
       détail ligne par ligne — peut et doit s'afficher. */
    const cartes = [
      ['Crédits déclarés', String(v.totaux.nombre), false],
      ['Capital restant dû', eur(v.totaux.capital), true],
      ['Mensualités actuelles', eur(v.totaux.mensualiteActuelle), false],
      ['Taux d’endettement', pct(v.avant), false],
    ].map(([l, n, pivot]) => `<div class="rg-chiffre${pivot ? ' rg-pivot' : ''}">
        <span class="rg-lab">${esc(l)}</span><span class="rg-val">${esc(n)}</span>
      </div>`).join('');

    return `<div class="rg-resultat rg-neutre">
      <div class="rg-bandeau">
        <div class="rg-bandeau-txt">
          <h2>Votre inventaire est complet</h2>
          <p>Vous déclarez ${v.totaux.nombre} crédit${v.totaux.nombre > 1 ? 's' : ''}
             à regrouper${v.totaux.conserves.length ? ', et ' + v.totaux.conserves.length + ' que vous conservez' : ''}.</p>
        </div>
      </div>
      <div class="rg-chiffres">${cartes}</div>
      ${v.avant != null ? jaugeHtml(v.avant, null, null, null) : ''}
      ${creditsHtml(v)}
      <!-- ⚠ CE TEXTE EST LU PAR UN PROSPECT, pas par nous. Il disait
           « le barème n'est pas renseigné dans cette version » : exact,
           mais cela se lit comme une panne, et personne ne laisse ses
           coordonnées à un outil qui a l'air cassé. Ce qui suit est tout
           aussi vrai et se lit comme un choix — c'en est un. -->
      <div class="rg-alerte">
        <b>Votre mensualité vous sera donnée par votre courtier.</b>
        <div class="rg-note" style="margin:6px 0 0">Les conditions d’un regroupement dépendent de l’établissement sollicité
        et bougent d’un mois à l’autre. Plutôt que d’afficher un chiffre qui ne serait pas le vôtre, nous préférons
        vous le donner une fois votre dossier regardé.</div>
      </div>
      ${suiteHtml(v)}
    </div>`;
  }

  const f = FEUX[v.feu] || FEUX.orange;
  const gain = v.meilleur.gainMensuel;

  /* ⚠ UNE SEULE CARTE EST MISE EN AVANT, et c'est la réponse à la
     question posée : de combien ma mensualité baisse-t-elle ? Les
     quatre cartes avaient la même taille et la même couleur, donc
     aucune ne se détachait — c'est ce que Mickael a appelé « je ne
     comprends pas le résultat au premier coup d'œil ». */
  const cartes = [
    ['Gain mensuel', (gain > 0 ? '− ' : '+ ') + eur(Math.abs(gain)), true],
    ['Nouvelle mensualité', eur(v.meilleur.mensualite + v.totaux.mensualiteConservee), false],
    ['Capital regroupé', eur(v.montant.base), false],
    ['Endettement', pct(v.apres), false],
  ].map(([l, n, pivot]) => `<div class="rg-chiffre${pivot ? ' rg-pivot' : ''}">
      <span class="rg-lab">${esc(l)}</span><span class="rg-val">${esc(n)}</span>
    </div>`).join('');

  const variation = (v.avant != null && v.apres != null)
    ? `<p class="rg-note">Votre taux d’endettement passerait de <b>${esc(pct(v.avant))}</b>
       à <b class="${v.apres < v.avant ? 'rg-mieux' : 'rg-pire'}">${esc(pct(v.apres))}</b>
       sur la durée la plus longue.</p>` : '';

  return `<div class="rg-resultat rg-${v.feu}">
    <div class="rg-bandeau">
      ${feuHtml(v.feu)}
      <div class="rg-bandeau-txt">
        <h2>${esc(f.titre)}</h2>
        <p>${esc(f.mot)}</p>
      </div>
    </div>
    <div class="rg-chiffres">${cartes}</div>
    <div>${jaugeHtml(v.avant, v.apres, BAREME.ENDETTEMENT_CIBLE, BAREME.ENDETTEMENT_MAX)}${variation}</div>
    ${v.blocages && v.blocages.length ? `<div class="rg-blocages">
      <b>Ce qu’il faut lever</b><ul>${v.blocages.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
    <div><h3>Votre situation, et ce qu’elle deviendrait</h3>${comparatifHtml(v)}${conseilHtml(v)}</div>
    ${creditsHtml(v)}
    ${suiteHtml(v)}
    <div>
      ${v.totaux.approximatif ? `<div class="rg-note">Certains taux ou durées n’étaient pas connus : ils ont été estimés à partir du capital et de la mensualité. Les chiffres ci-dessus sont des ordres de grandeur, pas une offre.</div>` : ''}
      <div class="rg-note">Taux indicatifs au ${esc(BAREME.DATE)}, hors assurance. Estimation non contractuelle : elle ne constitue ni une offre de prêt ni un accord de financement. Un crédit vous engage et doit être remboursé.</div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------ */
/* L'envoi au CRM                                                      */
/* ------------------------------------------------------------------ */
const CRM = 'https://qnidmkufauzguultdmky.supabase.co/functions/v1/simulateur-courtage';
let envoye = false;

/** Le récapitulatif lisible, pour la fiche et pour le mail de l'agence. */
function recapHtml(v) {
  const l = (k, val) => val ? `<tr><td style="padding:4px 10px 4px 0;color:#4A6579">${esc(k)}</td>
    <td style="padding:4px 0;font-weight:600;color:#15384E">${esc(val)}</td></tr>` : '';
  const credits = v.totaux.lignes.map((c) => {
    const nom = (TYPES_CREDIT.find((t) => t.v === c.type) || {}).label || c.type || 'Crédit';
    const flou = c.estime.length ? ' (estimé)' : '';
    return `<tr><td style="padding:4px 10px 4px 0;color:#4A6579">${esc(nom)}${c.integre ? '' : ' — conservé à part'}</td>
      <td style="padding:4px 0;color:#15384E">${eur(c.capital)} · ${eur(c.mensualite)}/mois · ${c.taux != null ? pct(c.taux) : '—'} · ${duree(c.mois)}${flou}</td></tr>`;
  }).join('');

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px">
    <p style="margin:0 0 10px"><b>Simulateur de regroupement de crédits</b></p>
    <table style="border-collapse:collapse">
      ${l('Situation', { proprio_pret: 'Propriétaire avec prêt', proprio_sans_pret: 'Propriétaire sans prêt', locataire: 'Locataire', heberge: 'Hébergé' }[R.logement])}
      ${l('Objectif', { mensualite: 'Alléger la mensualité', capacite: 'Retrouver de la capacité d’emprunt', projet: 'Financer un projet', revenus: 'Absorber une baisse de revenus' }[R.objectif])}
      ${l('Revenus du foyer', eur(R.revenus))}
      ${l('Loyer', R.loyer ? eur(R.loyer) : '')}
      ${l('Emprunteurs', R.emprunteurs)}
      ${l('Enfants à charge', R.enfants)}
      ${l('Dettes à régulariser', R.dettes ? eur(R.dettes) : '')}
      ${l('Trésorerie demandée', R.tresorerie ? eur(R.tresorerie) : '')}
      ${l('Retards de paiement', { non: 'Aucun', oui_regularise: 'Régularisés', oui_en_cours: 'EN COURS' }[R.retards])}
      ${l('Nature de l’opération', v.nature === 'hypothecaire' ? 'Hypothécaire' : 'Sans garantie')}
      ${l('Endettement avant', pct(v.avant))}
      ${l('Endettement après', v.apres != null ? pct(v.apres) : 'non calculé (barème absent)')}
    </table>
    <p style="margin:14px 0 6px"><b>Crédits déclarés</b></p>
    <table style="border-collapse:collapse">${credits}</table>
    ${v.scenarios.length ? `<p style="margin:14px 0 6px"><b>Scénarios</b></p>
      <table style="border-collapse:collapse">${v.scenarios.map((s) =>
        `<tr><td style="padding:4px 10px 4px 0;color:#4A6579">${s.annees} ans</td>
         <td style="padding:4px 0;color:#15384E">${eur(s.mensualite + v.totaux.mensualiteConservee)}/mois · coût total ${eur(s.coutTotal)} · écart ${s.surcout > 0 ? '+' : ''}${eur(s.surcout)}</td></tr>`).join('')}
      </table>` : '<p style="margin:14px 0 0;color:#C0472B"><b>Aucun montant calculé : le barème de taux n’est pas renseigné.</b></p>'}
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
function envoyerAuCrm(v) {
  if (envoye) return;
  if (!R.consent) return;          // pas de consentement, pas d'envoi
  if (!R.email && !R.telephone) return;
  envoye = true;

  const t = v.totaux;
  const recap = recapHtml(v);
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
    duree_souhaitee: v.meilleur ? v.meilleur.annees + ' ans' : '',
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
      endettement: v.apres != null ? (v.apres * 100).toFixed(1) : '',
      mensualite: v.meilleur ? String(v.meilleur.mensualite) : '',
      emprunt: v.montant && v.montant.total ? String(v.montant.total) : '',
      blocages: (v.blocages || []).join(' | '),
      /* ⚠ `message` ATTERRIT DANS `recap_simulateur`, PAS DANS LES NOTES DU
         CONTACT : la fonction du CRM vide `message` avant d'appeler
         `intake_lead_v2`, précisément pour ne plus repartir avec trente
         lignes de récapitulatif dans la fiche du contact (18/11/2026). */
      message: recap,
      subject: `Regroupement — ${qui}`,
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
function animerResultat() {
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

  if (doux) return;

  document.querySelectorAll('#stage .rg-val').forEach((el) => {
    const texte = el.textContent;
    /* On n'anime que ce qui EST un nombre : « — », « Sans garantie » ou
       une plage de dates resteraient tels quels. Le préfixe (« − ») et
       le suffixe (« € », « % ») sont conservés à l'identique. */
    const m = texte.match(/^(\D*?)([\d   ,.]+)(\D*)$/);
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
      el.textContent = m[1]
        + n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
        + m[3];
      if (k < 1) requestAnimationFrame(pas);
      else el.textContent = texte;   // on finit sur le texte exact, au caractère près
    };
    requestAnimationFrame(pas);
  });
}

/* ------------------------------------------------------------------ */
/* Le moteur d'affichage                                               */
/* ------------------------------------------------------------------ */
function peindre() {
  const liste = visibles();
  pas = Math.max(0, Math.min(pas, liste.length - 1));
  const q = liste[pas];

  $('#sec').textContent = q.sec || '';
  $('#cnt').textContent = q.type === 'resultat' ? '' : `${pas + 1} / ${liste.length - 1}`;
  $('#bar').style.width = Math.round(pas * 100 / (liste.length - 1)) + '%';
  $('#back').style.display = pas > 0 && q.type !== 'resultat' ? '' : 'none';

  const hint = typeof q.hint === 'function' ? q.hint(R) : q.hint;
  const corps = q.type === 'choice' ? ecranChoice(q)
    : q.type === 'tranches' ? ecranTranches(q)
    : q.type === 'fiche' ? ecranFiche(q)
    : q.type === 'identite' ? ecranIdentite()
    : ecranResultat();

  /* L'intitulé peut dépendre des réponses — « votre premier AUTRE
     crédit » quand un prêt immobilier a déjà été saisi. */
  const intitule = typeof q.q === 'function' ? q.q(R) : q.q;
  $('#stage').innerHTML = (intitule ? `<h2>${esc(intitule)}</h2>` : '')
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

  const opt = e.target.closest('.opt');
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
    const champ = q.champs.find((c) => c.cle === cle);
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
    R[q.key] = { ...(R[q.key] || {}), [cle]: val };
    return;
  }

  const id = el.getAttribute('data-id');
  if (id) { R[id] = el.value; return; }
  if (el.id === 'rgpd') R.consent = el.checked;
});

$('#stage').addEventListener('change', (e) => {
  if (e.target.id === 'rgpd') R.consent = e.target.checked;
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
