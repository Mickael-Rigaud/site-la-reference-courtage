# -*- coding: utf-8 -*-
"""Fabrique le simulateur de La Référence Courtage à partir de celui de Christophe.

    python faire-simulateur.py

Le modèle (`modele-cg-2026-11-12.html`) est la page servie par
christophegoubetbypretto.fr/simulateur/, relevée telle quelle. On n'y touche
jamais à la main : ce script rejoue la transformation, de sorte qu'une
évolution du simulateur de Christophe se reprenne en remplaçant le modèle et
en relançant la commande.

Ce qui change, et seulement cela :
  · la palette et la typographie passent à la charte de La Référence Courtage ;
  · l'annuaire des courtiers se réduit à Mickael Rigaud — les fiches des
    autres courtiers (noms, ORIAS, téléphones, adresses) n'ont rien à faire
    dans le code source d'une page publique de l'agence ;
  · les envois ne partent plus chez Christophe : l'adresse du serveur est
    celle de l'agence, et le pixel publicitaire de son compte est retiré.

Le parcours, les questions, les calculs, les feux et les textes de conseil
restent identiques : c'est la demande.
"""
import io, os, re, shutil, sys

ICI = os.path.dirname(os.path.abspath(__file__))
MODELE = os.path.join(ICI, 'modele-cg-2026-11-12.html')

# Une variante d'habillage se passe en argument : `python faire-simulateur.py a`
# lit `habillage-a.css` et écrit dans `site-a/`. Sans argument, c'est
# l'habillage retenu (`habillage-lrc.css`) et le dossier `site/`, celui que
# le générateur du site recopie dans /simulateur/.
VARIANTE = (sys.argv[1] if len(sys.argv) > 1 else '').strip().lower()

# ⚠ UNE VARIANTE QUI N'A QU'UN ÉCRAN DE RÉSULTAT À ELLE SE COMPOSE ICI.
# `resultat-<v>.css` ne décrit que la fin du parcours : il se pose sur la
# base commune (`habillage-d.css`, la page du site). Au début ces deux
# feuilles étaient collées à la main dans un `habillage-<v>.css` — et
# toute retouche de la seconde restait sans effet jusqu'à ce qu'on
# repense à recoller. Le script assemble donc lui-même.
BASE = 'habillage-d.css'

# L'HABILLAGE RETENU (17/11/2026) : le fond de la page du site, les étapes
# numérotées, les icônes au trait orange, et le feu de carrefour sur
# l'écran de résultat. C'est ce que produit la commande sans argument,
# donc ce que le générateur du site recopie dans /simulateur/.
RETENU = [BASE, 'resultat-feu.css']

FEUILLES = (RETENU if not VARIANTE
            else [BASE, 'resultat-%s.css' % VARIANTE]
            if os.path.exists(os.path.join(ICI, 'resultat-%s.css' % VARIANTE))
            else ['habillage-%s.css' % VARIANTE])
SORTIE = os.path.join(ICI, 'site-%s' % VARIANTE if VARIANTE else 'site')

s = io.open(MODELE, encoding='utf-8').read()


def remplacer(vieux, neuf, n=1, ou=''):
    """Remplace un passage dont on attend exactement `n` occurrences."""
    global s
    vu = s.count(vieux)
    assert vu == n, 'attendu %d, trouvé %d — %s\n%r' % (n, vu, ou, vieux[:140])
    s = s.replace(vieux, neuf)


def couper(debut, fin_apres, ou=''):
    """Retire le bloc qui commence à `debut` et se termine après `fin_apres`."""
    global s
    a = s.find(debut)
    assert a >= 0, 'introuvable — %s' % ou
    b = s.find(fin_apres, a)
    assert b > a, 'fin introuvable — %s' % ou
    s = s[:a] + s[b + len(fin_apres):]


# =====================================================================
# 1. La charte : couleurs et typographie du site
# ---------------------------------------------------------------------
# Le modèle s'appuie sur des variables CSS pour toute son identité : il
# suffit de les redéfinir. Les feux (vert, orange, rouge) et les couleurs
# d'alerte ne bougent pas — ils ne sont pas décoratifs, ils portent le sens.
# =====================================================================
PALETTE = {
    '--vert:#0C806E':  '--vert:#0A6F86',   # couleur de marque : l'azur du site
    '--olive:#98AF24': '--olive:#F4801C',  # second ton : l'orange soleil
    '--creme:#FAF6F2': '--creme:#FFFCF6',
    '--encre:#1a2b28': '--encre:#15384E',
    '--gris:#6b7772':  '--gris:#4A6579',
    '--bord:#e3ddd4':  '--bord:#F2E3CE',
    '--vert-clair:#e6f1ee': '--vert-clair:#D8F1F8',
}
for vieux, neuf in PALETTE.items():
    remplacer(vieux, neuf, ou='palette')

remplacer('--ombre:0 4px 24px rgba(12,128,110,.10)',
          '--ombre:0 4px 24px rgba(21,56,78,.10)', ou='ombre')

# les quelques tons dérivés, écrits en dur
DERIVES = {
    '#0a6c5d': '#0C5F74',   # survol du bouton principal
    '#0F4F3F': '#0E2E40',   # fonds sombres
    '#c5e0d8': '#BBE3EF',
    '#e9f4f1': '#EAF7FB',
    '#b8c9c4': '#AFC6D2',
    '#1a2b28': '#15384E',   # encre, hors variable
    '#6b7772': '#4A6579',   # gris, hors variable
    '#e3ddd4': '#F2E3CE',
    '#e6f1ee': '#D8F1F8',
    '#0C806E': '#0A6F86',
    '#98AF24': '#F4801C',
}
for vieux, neuf in DERIVES.items():
    s = s.replace(vieux, neuf)

# La typographie du site : Fraunces pour les titres, Inter pour le texte.
remplacer(
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
    'family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&'
    'family=Inter:wght@400;500;600;700;800&display=swap">\n'
    '<link rel="icon" href="/favicon.ico" sizes="any">\n'
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n'
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    ou='polices')

remplacer(
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;'
    '-webkit-font-smoothing:antialiased',
    "font-family:'Inter',-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif;"
    '-webkit-font-smoothing:antialiased',
    ou='police de base')

# =====================================================================
# 2. Le titre de la page
# =====================================================================
# La feuille d'habillage, écrite à part et posée APRÈS celle du modèle :
# elle redessine le bandeau de mer, la frise d'étapes, la feuille blanche,
# les tuiles de choix, les champs et le pied. Elle prime par l'ordre, ce
# qui évite de retoucher les 275 règles du modèle une à une.
# Voir habillage-lrc.css.
# =====================================================================
HABILLAGE = '\n'.join(io.open(os.path.join(ICI, f), encoding='utf-8').read()
                      for f in FEUILLES)
remplacer('</style>',
          '\n/* ===== %s ===== */\n' % ' + '.join(FEUILLES) + HABILLAGE + '\n</style>',
          ou='habillage')

remplacer('<title>Vérifiez la faisabilité de votre projet immobilier</title>',
          '<title>Simulateur de faisabilité — La Référence Courtage</title>',
          ou='titre')

# =====================================================================
# 3. L'annuaire : une seule fiche, celle de Mickael
# ---------------------------------------------------------------------
# La clé reste `cg` : c'est le repli écrit en dur partout dans le code
# (`COURTIERS.cg`, `'cg'`). La renommer obligerait à relire 200 Ko de
# JavaScript pour une différence que personne ne voit.
# =====================================================================
a = s.find('const COURTIERS = {')
b = s.find('\n};', a) + 3
assert a > 0 and b > a, 'bloc COURTIERS introuvable'
s = s[:a] + '''const COURTIERS = {
  cg: { nom:"Mickael RIGAUD", site:"lareferencecourtage.fr",
        orias:"",   /* à renseigner dès que le numéro est communiqué */
        statut:"Intermédiaire en opérations de banque et en services de paiement",
        rsac:"SIREN 831 516 943",
        siege:"13 rue du Docteur Demler, 60740 Saint-Maximin",
        host:"www.lareferencecourtage.fr",
        rdv:"https://www.lareferencecourtage.fr/prendre-rendez-vous/",
        il:"il", tel:"+33 6 27 23 56 48", email:"contact@lareferencecourtage.fr",
        photo:"assets/mickael-rigaud.jpg",
        role:"Courtier en crédit immobilier", marque:"Membre du réseau Pretto Galaxie",
        mot:"La proximité d'un courtier indépendant. La force d'un réseau national.",
        chiffres:["Plus de 10 ans d'expérience",
                  "Plus de 100 banques via Pretto Galaxie",
                  "Aucun honoraire avant le déblocage des fonds"] }
};
''' + s[b:]

# Les fiches des apporteurs et les pages par courtier : des confrères, avec
# leurs coordonnées et leurs numéros ORIAS. Rien de tout cela ne concerne
# l'agence, et une page publique livre son code source.
couper('if (ORIGINE) Object.assign(COURTIERS, {', '\n});', ou='fiches apporteurs')
couper('const CHEMINS = {', '\n});', ou='pages par courtier')
s = s.replace('const SEG_COURTIER', 'const CHEMINS = {};\nconst SEG_COURTIER', 1)

# Son WhatsApp personnel, posé après l'annuaire.
couper('COURTIERS.cg.whatsapp', '\n', ou='whatsapp')

# =====================================================================
# 4. Les envois ne partent plus chez Christophe
# ---------------------------------------------------------------------
# ENRICH_ENDPOINT vide = le simulateur calcule et affiche, sans rien
# transmettre. Le branchement sur le CRM du groupe vient ensuite.
# =====================================================================
remplacer('ENRICH_ENDPOINT: "https://galaxie-leads.christophebypretto.workers.dev/simulateur"',
          'ENRICH_ENDPOINT: "https://qnidmkufauzguultdmky.supabase.co/functions/v1/simulateur-courtage"',
          ou='endpoint')

# ---------------------------------------------------------------------
# Ce qui n'est pas branché, et qu'il vaut mieux éteindre que laisser
# frapper dans le vide.
# ---------------------------------------------------------------------
# Le simulateur d'origine dialogue avec son serveur sur quatre routes :
# création d'une fiche dès la saisie de l'e-mail, mise à jour au verdict,
# signalement d'écran, suivi de parcours. La fonction du CRM n'en traite
# qu'une — l'envoi final, complet. Laisser les autres allumées enverrait
# un POST à chaque écran à une adresse qui répondrait « demande vide »,
# vingt et une fois par visite.
remplacer('const CAPTURE_PRECOCE = true;',
          'const CAPTURE_PRECOCE = false;   /* une seule transmission, au verdict */',
          ou='capture précoce')
remplacer('const SUIVI_ACTIF = true;',
          'const SUIVI_ACTIF = false;   /* suivi de parcours non branche */',
          ou='suivi de parcours')
remplacer('function signalerEtape(nom){',
          'function signalerEtape(nom){ return;   /* signalement d’ecran non branche */',
          ou='signalement decran')
remplacer('META_PIXEL: "1077448224691701"', 'META_PIXEL: ""', ou='pixel')

# ---------------------------------------------------------------------
# Le message du feu rouge, lui, doit partir.
# ---------------------------------------------------------------------
# L'écran de verdict offre au visiteur d'expliquer ce que la simulation
# ignore — « mes parents participent à hauteur de 30 000 € », « je passe
# en CDI le mois prochain ». C'est souvent le renseignement le plus utile
# de tout le parcours.
# Dans le modèle, ce message s'accroche à la fiche créée dès la saisie de
# l'e-mail ; sans cette fiche il refuse de partir et affiche « nous
# n'avons pas pu joindre le serveur ». Comme la capture précoce est
# éteinte ici, ce refus serait SYSTÉMATIQUE : le visiteur écrirait dans
# le vide à tous les coups. On retire donc le garde et on joint l'identité
# à l'envoi — la fonction du CRM retrouve la demande par l'e-mail.
debut_garde = "  if(LEAD_ID===null){ fini('Nous n"
a = s.find(debut_garde)
assert a > 0, 'garde de l argumentaire introuvable'
b = s.find('\n', s.find('return; }', a))
s = s[:a] + s[b + 1:]

remplacer("body:JSON.stringify({id:LEAD_ID, maj_token:MAJ_TOKEN, argumentaire:msg,",
          "body:JSON.stringify({id:LEAD_ID, maj_token:MAJ_TOKEN, argumentaire:msg,"
          " prenom:lead.prenom, nom_famille:lead.nom, email:lead.email, telephone:lead.tel,",
          ou='identite sur l argumentaire')

# L'adresse à qui écrire pour ses données : celle de l'agence.
s = s.replace('contact@bypropulse.fr', 'contact@lareferencecourtage.fr')

# Le réseau affiché sous le nom, en tête de page.
remplacer("+(AFFICHE.il==='elle'?'Courtière':'Courtier')+' · Pretto Galaxie</small></span>'",
          "+(AFFICHE.il==='elle'?'Courtière':'Courtier')+' · La Référence Courtage</small></span>'",
          ou='sous-titre du courtier')

# =====================================================================
# 3 ter. Le consentement, et ce que le CRM ne recevait pas
# ---------------------------------------------------------------------
# 18/11/2026, Christophe, après un test de bout en bout : « Je n'ai pas eu la
# case à cocher pour la rgpd que je t'ai demandé ce matin », et « je ne
# retrouve pas les mêmes infos que celles déposées dans le simulateur et dans
# le crm ».
#
# ⚠ LA QUESTION A ÉTÉ RETIRÉE DU MODÈLE LE 07/10/2026, VOLONTAIREMENT — son
# commentaire le dit : « plus AUCUN champ de consentement n'est envoyé […]
# continuer à envoyer un libellé ferait enregistrer tous les visiteurs en
# "refuse" ». C'est le choix de Christophe pour SON simulateur, et il n'est pas
# remis en cause : le modèle n'est pas touché, la case est posée ici, du côté
# de l'agence. Celle-ci recueille nom, prénom, téléphone ET toute une situation
# financière — revenus, crédits, épargne, patrimoine — et les trois formulaires
# du site portent déjà une case. Ce parcours-là faisait exception.
#
# La case CONDITIONNE le passage à la suite : une case pré-cochée, ou qu'on
# peut ignorer, ne vaut pas consentement.
# =====================================================================

# ⚠ LE LIBELLÉ AFFICHÉ EST CELUI QUI PART AVEC LA DEMANDE. C'est le texte lu
# qui engage, pas un résumé reconstitué côté serveur : une seule chaîne, ici,
# pour l'écran comme pour l'envoi. `intake_lead_v2` l'horodate et le garde sur
# le contact (`consent_at`, `consent_source`).
CONSENT_TXT = (u'J\u2019accepte que mes r\u00e9ponses et mes coordonn\u00e9es soient '
               u'utilis\u00e9es par La R\u00e9f\u00e9rence Courtage pour \u00e9tudier '
               u'mon projet et me recontacter.')

# ⚠ LE CONSENTEMENT SE MÉMORISE HORS DU DOM. `stage.innerHTML` est réécrit à
# chaque écran : au moment de l'envoi, qui part de l'écran de résultat, la case
# n'existe plus. Lire `#idc` à cet instant-là aurait donné `false` à tous les
# visiteurs — un registre de consentements entièrement faux, et faux dans le
# sens qui ne se voit pas, puisque la demande, elle, arrive bien.
# La variable sert aussi au retour en arrière : l'écran se redessine, et la
# case doit se retrouver cochée, sans quoi le bouton redevient gris sans raison.
remplacer('const CAPTURE_PRECOCE =',
          'let CONSENT_DONNE = false;\nconst CAPTURE_PRECOCE =',
          ou='memoire du consentement')

remplacer(
    # \u26a0 LES TROIS MORCEAUX SONT SUR TROIS LIGNES INDENT\u00c9ES dans le mod\u00e8le :
    # les recoller bout \u00e0 bout ne trouve rien, et `remplacer` le dit.
    '    `<div class="rassure">`+\n'
    '    `<div class="l"><span class="ic">\u2713</span><div>Vous pouvez demander leur '
    '<b>suppression \u00e0 tout moment</b>, conform\u00e9ment au RGPD.</div></div>`+\n'
    '    `</div>`+',

    '    `<label class="consent" for="idc">`+\n'
    '    `<input type="checkbox" id="idc"${CONSENT_DONNE?\' checked\':\'\'}>`+\n'
    '    `<span>' + CONSENT_TXT + ' Vous pouvez demander leur '
    '<b>suppression \u00e0 tout moment</b>, conform\u00e9ment au RGPD.</span>`+\n'
    '    `</label>`+',
    ou='case de consentement')

# Le passage à l'écran suivant l'exige, au même titre que l'adresse mail.
remplacer(
    "function identityValid(){\n"
    "  return gv('#idp').trim().length >= 2",
    "function identityValid(){\n"
    "  /* 18/11/2026 : et la case de consentement, posee par faire-simulateur.py. */\n"
    "  if (!CONSENT_DONNE) return false;\n"
    "  return gv('#idp').trim().length >= 2",
    ou='consentement obligatoire')

# ⚠ La case n'a pas la classe `.in` : l'ecouteur pose sur les champs de saisie
# ne la voit pas, et le bouton serait reste gris apres l'avoir cochee.
remplacer(
    "  aidesIdentite();\n"
    "}\n"
    "const gv=sel=>",
    "  const caseC = stage.querySelector('#idc');\n"
    "  if (caseC) caseC.addEventListener('change', () => { CONSENT_DONNE = caseC.checked; syncNext(); });\n"
    "  aidesIdentite();\n"
    "}\n"
    "const gv=sel=>",
    ou='branchement de la case')

# Ce qui part avec la demande : le consentement, son libelle, et les revenus
# ponderes. Ces derniers figuraient dans le mail interne depuis toujours et
# nulle part dans le CRM, faute d'etre envoyes : c'est l'une des infos que
# Christophe « ne retrouvait pas ».
remplacer(
    'verdict:feu, feu:res.feu, capacite:res.capaciteEmprunt,',
    # Le libellé ne porte ni guillemet double ni antislash : l'entourer suffit
    # à en faire un littéral JavaScript valide.
    'consent:CONSENT_DONNE, consent_text:"' + CONSENT_TXT + '",\n'
    '        revenus:res.revenusPonderes,\n'
    '        verdict:feu, feu:res.feu, capacite:res.capaciteEmprunt,',
    ou='consentement et revenus dans l envoi')

# La case, dessinee comme le reste du formulaire : une vraie cible au doigt,
# pas un carre de 13 px perdu dans un paragraphe.
remplacer('</style>', """
  .consent{display:flex;gap:11px;align-items:flex-start;margin:4px 0 2px;padding:13px 15px;
    border:1.5px solid var(--bord);border-radius:13px;background:#fff;cursor:pointer;
    font-size:13.5px;line-height:1.5;color:var(--gris)}
  .consent input{width:20px;height:20px;flex:none;margin:1px 0 0;accent-color:var(--olive);cursor:pointer}
  .consent:has(input:checked){border-color:var(--olive);background:var(--vert-clair)}
  .consent b{color:var(--encre)}
</style>""", ou='style de la case de consentement')

# =====================================================================
# 3 quater. « Afin de préparer au mieux notre rendez-vous »
# ---------------------------------------------------------------------
# 19/11/2026, Mickael : « une fois que le rendez-vous est pris, on peut faire
# un système où une page s'ouvre "afin de préparer au mieux notre rendez-vous
# veuillez remplir vos informations ci-dessous" […] et je voudrais que si des
# informations ont déjà été remplies avant par le prospect au moment de la
# prise de rendez-vous que ce soit déjà rempli ».
#
# C'est le simulateur qui fait cette page : il pose déjà toutes les bonnes
# questions, et ses réponses alimentent la même fiche. On lui ajoute un mot
# d'accueil, qui dit POURQUOI on redemande quelque chose à quelqu'un qui vient
# de réserver, et la reprise de ce qu'il a déjà saisi.
#
# ⚠ LE MOT D'ACCUEIL NE S'AFFICHE QUE DANS CE CAS (`?prepa=1`). Sur le
# simulateur ordinaire, « notre rendez-vous » ne voudrait rien dire : personne
# n'en a pris.
# =====================================================================

# ⚠ ON NE DEVINE PAS LE PROJET. « Construction / VEFA » peut être une résidence
# principale comme un investissement, « Regroupement de crédits » n'est pas une
# renégociation de prêt immobilier, et l'assurance emprunteur comme le
# financement professionnel ne sont pas des projets d'achat. Ces quatre-là ne
# pré-remplissent rien : le visiteur répondra lui-même, ce qui vaut mieux
# qu'une réponse fausse déjà cochée qu'il validera sans la relire.
remplacer(
    "const lead = {",
    "/* 19/11/2026 - le simulateur sert aussi de page de preparation apres une\n"
    "   prise de rendez-vous. `?prepa=1` affiche le mot d'accueil, `?projet=` et\n"
    "   `?budget=` reprennent ce qui vient d'etre saisi sur la page de reservation. */\n"
    "const PREPA = P.get('prepa') === '1';\n"
    "const QUAND_RDV = P.get('quand') || '';\n"
    "const PROJET_RDV = ({\n"
    "  'Achat r\u00e9sidence principale': 'principale',\n"
    "  'Achat r\u00e9sidence secondaire': 'secondaire',\n"
    "  'Investissement locatif':        'locatif',\n"
    "  'Ren\u00e9gociation de pr\u00eat':        'renego',\n"
    "})[P.get('projet') || ''] || '';\n"
    "/* Le budget arrive ecrit (« 250 000 EUR ») : on n'en garde que les chiffres.\n"
    "   Zero ou illisible ne pre-remplit rien, plutot qu'un budget a 0. */\n"
    "const BUDGET_RDV = (() => {\n"
    "  const n = Number(String(P.get('budget') || '').replace(/[^0-9]/g, ''));\n"
    "  return Number.isFinite(n) && n > 0 ? n : 0;\n"
    "})();\n"
    "const lead = {",
    ou='lecture des parametres de preparation')

# ⚠ APRÈS la déclaration de `data` mais AVANT `curId`, qui calcule le premier
# écran visible à partir de ce que `data` contient déjà.
remplacer(
    "const data={ age:[], statut:[], salaire:[], primes:[] };",
    "const data={ age:[], statut:[], salaire:[], primes:[] };\n"
    "/* 19/11/2026 : ce que le visiteur vient de saisir sur /prendre-rendez-vous/.\n"
    "   ⚠ ON NE SAUTE PAS LES ECRANS CORRESPONDANTS, on les pre-remplit : le\n"
    "   budget donne a la prise de rendez-vous est approximatif, et c'est\n"
    "   justement l'occasion de le preciser. L'ecran s'affiche avec la reponse\n"
    "   deja choisie, le visiteur confirme ou corrige. */\n"
    "if (PROJET_RDV) data.projet = PROJET_RDV;\n"
    "if (BUDGET_RDV) data.prix = BUDGET_RDV;",
    ou='reprise des reponses')

remplacer(
    '<form id="form" onsubmit="return false"><div id="stage"></div></form>',
    '<div class="prepa-mot" id="prepa-mot" style="display:none">'
    '<b>Afin de pr\u00e9parer au mieux notre rendez-vous</b>'
    '<span>Remplissez vos informations ci-dessous. Vos r\u00e9ponses permettent \u00e0 '
    'votre courtier d\u2019arriver avec des chiffres plut\u00f4t qu\u2019avec des questions '
    '\u2014 et vous obtenez votre avis de faisabilit\u00e9 tout de suite. '
    'Rien n\u2019est obligatoire&nbsp;: votre rendez-vous est d\u00e9j\u00e0 r\u00e9serv\u00e9.</span>'
    '</div>\n'
    '    <form id="form" onsubmit="return false"><div id="stage"></div></form>',
    ou='bloc du mot d accueil')

remplacer(
    "const hasIdentity = !!lead.email;",
    "/* Le mot d'accueil n'existe que pour qui vient de prendre rendez-vous. */\n"
    "if (PREPA) {\n"
    "  const m = document.getElementById('prepa-mot');\n"
    "  if (m) {\n"
    "    m.style.display = '';\n"
    # ⚠ LA CONFIRMATION EN TÊTE, ET EN PREMIER. Le visiteur arrive ici sans
    # plus voir l'écran qui lui disait que son créneau était pris : sans ce
    # rappel, la page ressemble à un formulaire de plus, et il peut croire
    # que son rendez-vous n'a pas abouti.
    # `textContent` et non `innerHTML` : la valeur vient de l'adresse.
    "    if (QUAND_RDV) {\n"
    "      const c = document.createElement('b');\n"
    "      c.className = 'prepa-ok';\n"
    "      c.textContent = '\\u2713 Votre rendez-vous du ' + QUAND_RDV + ' est confirm\\u00e9.';\n"
    "      m.prepend(c);\n"
    "    }\n"
    "  }\n"
    "}\n"
    "const hasIdentity = !!lead.email;",
    ou='affichage du mot d accueil')

# ⚠ L'ÉCRAN DU BUDGET N'AFFICHE SA VALEUR QU'UNE FOIS UNE TRANCHE CHOISIE.
# Poser `data.prix` suffit pour que « Suivant » s'active et que le calcul soit
# juste — éprouvé — mais l'écran continue d'afficher « À choisir », et le
# visiteur croit qu'on ne lui a rien repris. Reconstituer l'état de tranche
# demanderait d'entrer dans la mécanique des paliers, qui s'est déjà révélée
# fragile : on dit donc la reprise en toutes lettres, sous la question. C'est
# vrai, c'est visible, et cela l'invite à préciser plutôt qu'à ressaisir.
remplacer(
    'hint:d=>d.projet===\'renego\'?\'Le capital restant dû de votre crédit : ce que vous devez '
    'encore à la banque. Au millier près, cela suffit.\':"Une estimation suffit si vous '
    'n\'avez pas encore trouvé.",',
    # ⚠ PAS `eur()` ICI : la fonction n'est pas encore visible au moment où le
    # hint s'évalue (zone morte temporelle), et l'écran restait VIDE — sans
    # faute de syntaxe, donc invisible à `node --check`. On formate à la main.
    'hint:d=>(PREPA && BUDGET_RDV ? \'Vous avez indiqué \' + BUDGET_RDV.toLocaleString(\'fr-FR\') + \' €\' +'
    '\' en prenant rendez-vous — précisez si vous le souhaitez. \' : \'\') + '
    '(d.projet===\'renego\'?\'Le capital restant dû de votre crédit : ce que vous devez '
    'encore à la banque. Au millier près, cela suffit.\':"Une estimation suffit si vous '
    'n\'avez pas encore trouvé."),',
    ou='rappel du budget deja donne')

remplacer('</style>', """
  .prepa-mot{display:flex;flex-direction:column;gap:6px;margin:0 0 20px;padding:15px 17px;
    border:1.5px solid var(--olive);border-radius:14px;background:var(--vert-clair)}
  .prepa-mot b{font-size:16px;color:var(--encre)}
  .prepa-mot .prepa-ok{display:block;font-size:14.5px;color:var(--vert);font-weight:700;margin-bottom:2px}
  .prepa-mot span{font-size:13.5px;line-height:1.55;color:var(--gris)}
</style>""", ou='style du mot d accueil')

# =====================================================================
# 4 ter. Le décor de la page d'accueil
# ---------------------------------------------------------------------
# Le site ouvre sur une affiche : ciel dégradé, soleil, et la Baie des
# Anges dessinée bord à bord. Le simulateur reprend ce même fond — c'est
# le décor du site, pas une illustration de plus, et il est repris tel
# quel depuis `index.html` pour que les deux ne divergent jamais.
# =====================================================================
SCENE = io.open(os.path.join(ICI, 'scene-accueil.html'), encoding='utf-8').read()
remplacer('<body>',
          '<body>\n<div class="ciel" aria-hidden="true">\n<div class="soleil"></div>\n'
          + SCENE + '\n</div>',
          ou='décor')

# =====================================================================
# 4 bis. L'en-tête porte le logo du site, et ramène au site
# ---------------------------------------------------------------------
# La page est servie seule, sans la barre de navigation : le visiteur doit
# pouvoir rentrer. Le lockup est celui du site — symbole vectoriel et nom en
# image —, repris tel quel pour que ce soit la même marque, pas une imitation.
# =====================================================================
SYMBOLE = ('<svg viewBox="0 0 80.03 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
           '<rect x="0" y="56.73" width="23.32" height="43.27" rx="6.1" fill="#4FB3D3"/>'
           '<rect x="28.34" y="39.52" width="23.32" height="60.48" rx="6.1" fill="#2A93B8"/>'
           '<rect x="56.68" y="23.3" width="23.32" height="76.7" rx="6.1" fill="#1D5B78"/>'
           '<circle cx="68.34" cy="9.13" r="9.1" fill="#F4801C"/></svg>')

remplacer('<span class="marque">Votre projet, <b>vérifié en 2 min</b></span>',
          '<a class="marque marque-lrc" href="https://www.lareferencecourtage.fr/" '
          'title="Retour au site">' + SYMBOLE +
          '<img src="assets/la-reference-courtage.webp" alt="La Référence Courtage">'
          '</a><span class="accroche">Votre projet, <b>vérifié en 2 min</b></span>',
          ou='en-tête')

remplacer('</style>', """
  /* le lockup du site, aux proportions de son fichier d'origine */
  .marque-lrc { display:flex; align-items:flex-end; gap:5px; text-decoration:none; flex:0 0 auto }
  .marque-lrc svg { width:23px; height:29px; display:block }
  .marque-lrc img { width:87px; height:17px; margin-bottom:2px; display:block }
  .accroche { font-weight:600; font-size:14px; color:var(--gris); letter-spacing:-.2px;
    padding-left:13px; margin-left:3px; border-left:1px solid var(--bord) }
  .accroche b { color:var(--vert) }
  @media (max-width:560px){ .accroche{ display:none } }
</style>""", ou='style de l en-tête')

# =====================================================================
# 4 quater. Les coordonnées se demandent à la fin
# ---------------------------------------------------------------------
# Chez Christophe elles ouvrent le parcours : on ne répond à vingt
# questions qu'après s'être nommé. Ici, l'inverse — le visiteur répond
# d'abord, et ne donne son nom qu'une fois son avis construit. Le code
# le prévoit : « c'est son rang DANS CETTE TABLE qui fixe l'ordre du fil
# des sections et de la navigation, rien d'autre : le déplacer suffit. »
#
# ⚠ LES FEUX RESTENT (décision du 17/11/2026, après un aller-retour).
# Ils avaient été retirés de l'écran le matin même, puis remis : le feu
# vert, orange ou rouge est ce que le visiteur vient chercher, et il est
# ce qui donne leur sens aux conseils qui suivent. Rien de ce qui touche
# au verdict n'est donc modifié — seuls les textes de l'écran des
# coordonnées changent, parce qu'il ferme le parcours au lieu de l'ouvrir.
# =====================================================================

ANCIEN_RANG = ("""{id:'identite',sec:SEC.ID,type:'identity',"""
               """q:'Entrez vos coordonnées pour accéder au simulateur',when:()=>!hasIdentity},""")
assert ANCIEN_RANG in s, "l'écran des coordonnées est introuvable dans SCREENS"
s = s.replace(ANCIEN_RANG + '\n', '', 1)
remplacer("{id:'result',sec:'',type:'result'}",
          "{id:'identite',sec:SEC.ID,type:'identity',"
          "q:'Vos coordonnées pour recevoir votre avis de faisabilité',when:()=>!hasIdentity},\n"
          " {id:'result',sec:'',type:'result'}",
          ou='rang des coordonnées')

# ⚠ Ces textes ouvraient le parcours ; ils le ferment désormais. Promettre
# « à la fin de ce questionnaire » à quelqu'un qui vient de répondre aux
# vingt questions n'aurait aucun sens, pas plus que « accéder au
# simulateur » sur le dernier bouton.
remplacer('<h1 class="q">Obtenez <b>gratuitement</b> votre avis de faisabilité</h1>',
          '<h1 class="q">Votre avis de faisabilité est <b>prêt</b></h1>',
          ou='titre de l ecran des coordonnees')

remplacer('<b>À la fin de ce questionnaire, vous aurez un avis de faisabilité : '
          'feu vert, feu orange ou feu rouge.</b> Il vous dira où en est votre projet, '
          'et ce qui reste à travailler.',
          "<b>Vos réponses sont enregistrées.</b> Indiquez vos coordonnées pour "
          "afficher votre avis de faisabilité — feu vert, feu orange ou feu rouge — "
          "et pour que Mickael Rigaud puisse vous rappeler.",
          ou='promesse de l ecran des coordonnees')

remplacer("next.textContent=dejaResultat?'Revenir à mon résultat':'Accéder au simulateur'",
          "next.textContent=dejaResultat?'Revenir à mon résultat':'Voir mon avis de faisabilité'",
          ou='bouton des coordonnees')

# =====================================================================
# 4 sexies. Des icônes au trait à la place des émojis
# ---------------------------------------------------------------------
# Chaque réponse du questionnaire est illustrée par un émoji. Ils ne
# s'alignent pas — chaque police les dessine à sa façon, avec sa propre
# hauteur —, changent d'aspect d'un appareil à l'autre, et donnent à la
# page un air de message texte. On les remplace par un jeu de tracés
# dessinés sur la même grille, de la même épaisseur, qui prennent la
# couleur du texte et se centrent d'eux-mêmes. Voir icones.py.
#
# ⚠ `ic` est injecté en HTML par le modèle (`<span class="ic">${o.ic}</span>`) :
# on peut donc y mettre un SVG. Les tracés n'emploient que des guillemets
# doubles — ils vivent dans `ic:'…'`, une chaîne à apostrophes.
# =====================================================================
sys.path.insert(0, ICI)
from icones import table as _table_icones   # noqa: E402

poses = 0
for emoji, svg in _table_icones().items():
    avant = s.count("ic:'%s'" % emoji)
    if avant:
        s = s.replace("ic:'%s'" % emoji, "ic:'%s'" % svg)
        poses += avant
print('icônes posées : %d' % poses)

# =====================================================================
# 4 quinquies. L'écran de résultat animé, s'il est demandé
# ---------------------------------------------------------------------
# La feuille d'habillage peut s'accompagner d'un script : une variante
# nommée `x` prend `resultat-x.js` s'il existe. C'est ce qui permet à la
# présentation animée d'ajouter son anneau d'endettement sans toucher au
# code du modèle.
# =====================================================================
SCRIPT = os.path.join(ICI, 'resultat-%s.js' % (VARIANTE or 'feu'))
if SCRIPT and os.path.exists(SCRIPT):
    remplacer('</body>',
              '<script>\n' + io.open(SCRIPT, encoding='utf-8').read() + '\n</script>\n</body>',
              ou='script de la variante')

# =====================================================================
# 5. Sortie
# =====================================================================
if os.path.isdir(SORTIE):
    shutil.rmtree(SORTIE)
os.makedirs(os.path.join(SORTIE, 'assets'))
io.open(os.path.join(SORTIE, 'index.html'), 'w', encoding='utf-8', newline='\n').write(s)
shutil.copytree(os.path.join(ICI, 'ptz-data'), os.path.join(SORTIE, 'ptz-data'))

# le portrait de Mickael, déjà extrait par le générateur du site
PORTRAIT = os.path.join(os.path.dirname(ICI), 'docs', 'assets', 'img', 'mickael-rigaud.jpg')
if os.path.exists(PORTRAIT):
    shutil.copy(PORTRAIT, os.path.join(SORTIE, 'assets', 'mickael-rigaud.jpg'))

NOM = os.path.join(os.path.dirname(ICI), 'docs', 'assets', 'img', 'la-reference-courtage.webp')
if os.path.exists(NOM):
    shutil.copy(NOM, os.path.join(SORTIE, 'assets', 'la-reference-courtage.webp'))

poids = sum(os.path.getsize(os.path.join(r, f))
            for r, _, fs in os.walk(SORTIE) for f in fs)
print('simulateur écrit dans', SORTIE)
print('%d fichiers, %d Ko' % (sum(len(fs) for _, _, fs in os.walk(SORTIE)), poids // 1024))
for mot in ('christophebypretto', 'Goubet', 'Deravine', 'Baudouin', 'bypropulse'):
    n = s.count(mot)
    print('  reste « %s » : %d' % (mot, n))
