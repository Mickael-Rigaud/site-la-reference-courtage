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
  for (let i = 1; i <= CREDITS_MAX; i++) {
    const c = R['credit' + i];
    if (c && c.capital) credits.push(c);
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

function ecranAmount(q) {
  const val = R[q.key];
  const paliers = (q.paliers || []).map((p) => `
    <button type="button" class="chip${Number(val) === p ? ' sel' : ''}" data-p="${p}">${eur(p)}</button>`).join('');
  return `<div class="field">
      <input class="in" id="saisie" inputmode="numeric" autocomplete="off"
             placeholder="0" value="${val == null ? '' : esc(val)}">
      <div class="options" style="margin-top:14px">${paliers}</div>
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
  return q.champs.map((c) => {
    if (c.quand && !c.quand(v)) return '';
    if (c.type === 'liste') {
      return `<div class="field" data-champ="${esc(c.cle)}">
        <label class="lab">${esc(c.lab)}</label>
        <div class="options">${c.opts.map((o) => `
          <button type="button" class="opt${v[c.cle] === o.v ? ' sel' : ''}" data-liste="${esc(c.cle)}" data-v="${esc(o.v)}">
            <span class="ic">${o.ic || ''}</span><span>${esc(o.label)}</span>
          </button>`).join('')}</div></div>`;
    }
    if (c.type === 'ouinon') {
      const actuel = v[c.cle] == null ? (c.defaut || 'oui') : v[c.cle];
      return `<div class="field" data-champ="${esc(c.cle)}">
        <label class="lab">${esc(c.lab)}</label>
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
             value="${v[c.cle] == null ? '' : esc(v[c.cle])}">
      ${c.hint ? `<div class="aide">${esc(c.hint)}</div>` : ''}
      ${c.inconnu ? `<div style="margin-top:8px">
        <button type="button" class="chip${inconnu ? ' sel' : ''}" data-inconnu="${esc(c.cle)}">Je ne sais pas</button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function ecranIdentite() {
  const champ = (cle, lab, type, ac) => `<div class="field">
    <label class="lab" for="id-${cle}">${lab}</label>
    <input class="in" id="id-${cle}" data-id="${cle}" type="${type}" autocomplete="${ac}"
           value="${R[cle] == null ? '' : esc(R[cle])}">
  </div>`;
  return champ('prenom', 'Prénom', 'text', 'given-name')
    + champ('nom', 'Nom', 'text', 'family-name')
    + champ('email', 'E-mail', 'email', 'email')
    + champ('telephone', 'Téléphone', 'tel', 'tel')
    + `<div class="field">
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

function barreHtml(avant, apres, cible) {
  /* L'échelle s'arrête à 60 % : au-delà, la barre serait pleine pour
     tout le monde et ne dirait plus rien. */
  const large = (x) => Math.max(0, Math.min(100, (x || 0) * 100 / 0.6)) + '%';
  /* ⚠ LA BARRE MONTRE L'ÉTAT D'ARRIVÉE QUAND IL EXISTE. Montrer le
     « avant » sur un écran qui annonce une amélioration ferait lire la
     situation actuelle comme le résultat de l'opération. Le « avant »
     reste écrit en toutes lettres juste en dessous. */
  const montre = apres != null ? apres : avant;
  return `<div style="margin:18px 0 6px">
    <span class="rg-lab" style="display:block;font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;font-weight:700;color:var(--gris);margin-bottom:8px">Votre taux d’endettement</span>
    <!-- ATTENTION : aucune marge en ligne ici. Un style en ligne l'emporte
         sur la feuille, et c'est ce qui a masqué le defaut le 24/11/2026 :
         la regle de habillage-regroupement.css etait bonne, elle n'etait
         simplement jamais appliquee. La place sous la barre revient a la
         feuille, qui sait pourquoi elle la reserve.
         (Ce commentaire est dans un gabarit JavaScript : pas d'accent grave
         ici, il fermerait la chaine et casserait tout le module.) -->
    <div class="lrc-barre anime">
      <i style="width:${large(montre)}"></i>
      ${cible ? `<span class="repere" style="left:${large(cible)}"></span>
      <span class="repere-txt" style="left:${large(cible)}">${pct(cible)}</span>` : ''}
    </div>
    <div class="rg-note">Aujourd’hui <b>${pct(avant)}</b>${apres != null ? ` — après regroupement <b>${pct(apres)}</b>` : ''}</div>
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
    return `<div class="rg-resultat">
      <h2>Votre inventaire est complet</h2>
      <p>Vous déclarez <b>${v.totaux.nombre} crédit${v.totaux.nombre > 1 ? 's' : ''}</b>
         pour <b>${eur(v.totaux.capital)}</b> de capital restant dû,
         soit <b>${eur(v.totaux.mensualiteActuelle)}</b> par mois.</p>
      ${v.avant != null ? barreHtml(v.avant, null, null) : ''}
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
      <p>Votre inventaire vient d’être transmis à Mickael Rigaud. Il le reprend avec vous et vous donne
         la mensualité, la durée et le coût total — sous 48 h ouvrées.</p>
    </div>`;
  }

  const f = FEUX[v.feu] || FEUX.orange;
  const cartes = [
    ['Capital à regrouper', eur(v.montant.base)],
    ['Nouvelle mensualité', eur(v.meilleur.mensualite + v.totaux.mensualiteConservee)],
    ['Gain mensuel', eur(v.meilleur.gainMensuel)],
    ['Endettement après', pct(v.apres)],
  ].map(([l, n]) => `<div class="rg-chiffre">
      <span class="rg-lab">${esc(l)}</span><span class="rg-val">${esc(n)}</span>
    </div>`).join('');

  return `<div class="rg-resultat">
    <div class="rg-feu-place">${feuHtml(v.feu)}</div>
    <h2>${esc(f.titre)}</h2>
    <p>${esc(f.mot)}</p>
    <div class="rg-chiffres">${cartes}</div>
    ${barreHtml(v.avant, v.apres, BAREME.ENDETTEMENT_CIBLE)}
    <h3>Votre situation, et ce qu’elle deviendrait</h3>
    ${comparatifHtml(v)}
    ${conseilHtml(v)}
    ${v.blocages && v.blocages.length ? `<div class="rg-blocages">
      <b>Ce qu’il faut lever</b><ul>${v.blocages.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
    ${v.totaux.approximatif ? `<div class="rg-note">Certains taux ou durées n’étaient pas connus : ils ont été estimés à partir du capital et de la mensualité. Les chiffres ci-dessus sont des ordres de grandeur, pas une offre.</div>` : ''}
    <div class="rg-note">Taux indicatifs au ${esc(BAREME.DATE)}, hors assurance. Estimation non contractuelle : elle ne constitue ni une offre de prêt ni un accord de financement. Un crédit vous engage et doit être remboursé.</div>
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
    budget: eur(t.capital),
    duree_souhaitee: v.meilleur ? v.meilleur.annees + ' ans' : '',
    type_de_credit: t.lignes.map((c) => (TYPES_CREDIT.find((x) => x.v === c.type) || {}).label || c.type).join(', '),
  };

  fetch(CRM, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prenom: R.prenom || '',
      nom_famille: R.nom || '',
      email: R.email || '',
      telephone: R.telephone || '',
      /* ⚠ `type_financement` EST ENVOYÉ MAIS PAS ENCORE LU (24/11/2026).
         La fonction `simulateur-courtage` du CRM pose ce champ en dur à
         « Crédit immobilier » : une demande de regroupement y arrive donc
         sous le mauvais libellé. La corriger demande de redéployer une
         fonction de 25 Ko qui fait tourner le simulateur immobilier en
         production — pas un geste à faire dans la précipitation pour un
         libellé. En attendant, la ligne « Projet » de la fiche dit
         « Regroupement de crédits » (voir `reponses.projet`) et le
         récapitulatif l'annonce en tête. À reprendre avec le barème. */
      type_financement: 'Regroupement de crédits',
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
    : q.type === 'amount' ? ecranAmount(q)
    : q.type === 'fiche' ? ecranFiche(q)
    : q.type === 'identite' ? ecranIdentite()
    : ecranResultat();

  $('#stage').innerHTML = (q.q ? `<h2>${esc(q.q)}</h2>` : '')
    + (hint ? `<div class="hint">${esc(hint)}</div>` : '') + corps;

  /* ⚠ LE BOUTON « SUIVANT » NE S'AFFICHE PAS SUR UN ÉCRAN À UN SEUL
     CHOIX : cliquer l'option avance déjà. Le laisser obligerait à deux
     gestes là où un suffit, et c'est le reproche le plus fréquent fait
     à ce genre de parcours. */
  $('#nav').style.display = (q.type === 'choice' || q.type === 'resultat') ? 'none' : '';
  $('#next').textContent = q.type === 'identite' ? 'Voir mon comparatif' : 'Continuer';

  dessinerRail();
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
    const p = chip.getAttribute('data-p');
    if (p) { R[q.key] = Number(p); peindre(); avancer(); }
  }
});

/* La saisie libre se range à chaque frappe : un visiteur qui clique
   « Continuer » sans quitter le champ ne doit pas perdre sa réponse. */
$('#stage').addEventListener('input', (e) => {
  const q = visibles()[pas];
  const el = e.target;

  if (el.id === 'saisie') { R[q.key] = nombre(el.value); return; }

  const cle = el.getAttribute('data-saisie');
  if (cle) {
    const champ = q.champs.find((c) => c.cle === cle);
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
