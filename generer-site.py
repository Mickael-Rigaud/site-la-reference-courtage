# -*- coding: utf-8 -*-
"""Transforme le fichier de travail en site multipage publiable.

    python generer-site.py
    git add -A && git commit -m "mise à jour du site" && git push

`index.html` est ce que reçoit l'artifact Claude : une page unique où les dix
rubriques sont des `<article>` masqués, montrés par du JavaScript. Pratique pour
relire, mais Google n'y voit qu'une seule adresse — impossible de se positionner
sur « assurance emprunteur Nice » plutôt que sur l'accueil.

Ce script en tire un vrai site : une page par rubrique, chacune à son adresse,
avec son titre et sa description. Le style, le script et les images sont sortis
dans `/assets`, donc téléchargés une fois et gardés en cache d'une page à
l'autre — sans quoi chaque page pèserait 620 Ko.

La source reste `index.html` : on continue de travailler dessus, on régénère.
"""
import io, os, re, shutil, hashlib

ICI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ICI, 'index.html')
EXTRAS = os.path.join(ICI, 'extras')
# Le site publiable vit dans `docs/` du dépôt : c'est ce dossier que GitHub
# Pages sert. Il est effacé et recréé à chaque exécution — ne rien y ranger
# à la main, tout ce qui doit survivre passe par `extras/`.
DST = os.path.join(ICI, 'docs')

SITE = 'https://www.lareferencecourtage.fr'

# ---------------------------------------------------------------------
# Les pages : identifiant dans le fichier source, adresse, référencement
# ---------------------------------------------------------------------
PAGES = [
    ('accueil', '', 'accueil',
     "La Référence Courtage — Courtier en prêt immobilier à Nice",
     "Agence de courtage indépendante à Nice, membre du réseau Pretto Galaxie. "
     "Prêt immobilier, assurance emprunteur, regroupement de crédits, financement "
     "professionnel. Aucun honoraire avant le déblocage des fonds."),

    ('pret-immobilier', 'pret-immobilier', 'prestation',
     "Prêt immobilier à Nice — courtier en crédit | La Référence Courtage",
     "Résidence principale, investissement locatif, construction ou VEFA : nous "
     "montons votre dossier et négocions auprès de plus de cent banques via le "
     "réseau Pretto Galaxie. Étude gratuite à Nice et partout en France."),

    ('assurance', 'assurance-emprunteur', 'prestation',
     "Assurance emprunteur à Nice — loi Lemoine | La Référence Courtage",
     "Changez d'assurance de prêt à tout moment grâce à la loi Lemoine. Nous "
     "comparons coût et garanties, et prenons en charge les démarches de "
     "substitution auprès de votre banque."),

    ('regroupement', 'regroupement-de-credits', 'prestation',
     "Regroupement de crédits à Nice | La Référence Courtage",
     "Réunir vos crédits en une seule mensualité pour retrouver un budget lisible. "
     "Nous vous présentons la mensualité, la durée et le coût total ensemble, sans "
     "rien masquer."),

    ('pret-pro', 'financement-professionnel', 'prestation',
     "Financement professionnel à Nice — création, reprise, murs",
     "Création d'entreprise, reprise de fonds de commerce, murs professionnels, "
     "matériel ou crédit-bail : nous structurons votre dossier et sollicitons les "
     "partenaires adaptés à votre projet."),

    ('simulateur', 'simulateur', 'outil',
     "Simulateur de prêt immobilier — mensualité et coût total",
     "Estimez votre mensualité, le coût total de votre crédit et celui de "
     "l'assurance emprunteur. Simulation immédiate et sans engagement."),

    ('recrutement', 'nous-rejoindre', 'page',
     "Nous rejoindre — courtiers indépendants | La Référence Courtage",
     "L'agence, son fondateur et son réseau. Nous développons notre réseau de "
     "courtiers indépendants à Nice : autonomie dans votre activité, force du "
     "réseau Pretto Galaxie."),

    ('partenariat', 'partenariat', 'page',
     "Partenariat apporteur d'affaires — agents immobiliers, CGP",
     "Agents immobiliers, professionnels du bâtiment, conseils en gestion de "
     "patrimoine, experts-comptables et notaires : confiez-nous le financement de "
     "vos clients, nous prenons l'accompagnement en charge."),

    ('rdv', 'prendre-rendez-vous', 'page',
     "Prendre rendez-vous avec un courtier à Nice",
     "Un premier échange sans engagement, en visioconférence ou par téléphone. "
     "Choisissez le créneau qui vous convient, du lundi au vendredi."),

    ('mentions', 'mentions-legales', 'legal',
     "Mentions légales et politique de confidentialité",
     "Mentions légales de La Référence Courtage, intermédiaire en opérations de "
     "banque et en services de paiement, et traitement des données personnelles."),
]
SLUG = {pid: slug for pid, slug, _, _, _ in PAGES}
ADRESSE = {pid: (SITE + '/' + slug + '/' if slug else SITE + '/') for pid, slug, _, _, _ in PAGES}

# ---------------------------------------------------------------------
# Lecture et découpe du fichier source
# ---------------------------------------------------------------------
src = io.open(SRC, encoding='utf-8').read()

titre_source = re.search(r'<title>(.*?)</title>', src, re.S).group(1)
polices = re.search(r'<link rel="preconnect".*?rel="stylesheet">', src, re.S).group(0)
css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
js = re.search(r'<script(?![^>]*src)[^>]*>(.*?)</script>', src, re.S).group(1)
nav = re.search(r'<header class="nav">.*?</header>', src, re.S).group(0)
pied = re.search(r'<footer class="foot">.*?</footer>', src, re.S).group(0)

articles = {}
for m in re.finditer(r'<article class="page[^"]*" id="page-([\w-]+)"[^>]*>.*?\n</article>', src, re.S):
    articles[m.group(1)] = m.group(0)
manquantes = [p for p, _, _, _, _ in PAGES if p not in articles]
assert not manquantes, 'articles introuvables : %s' % manquantes

# ---------------------------------------------------------------------
# Les images sortent du HTML : une fois sur le disque, elles sont mises en
# cache par le navigateur au lieu d'être retéléchargées à chaque page
# ---------------------------------------------------------------------
if os.path.isdir(DST):
    shutil.rmtree(DST)
os.makedirs(os.path.join(DST, 'assets', 'img'))

EXT = {'webp': 'webp', 'jpeg': 'jpg', 'jpg': 'jpg', 'png': 'png', 'svg+xml': 'svg'}
images = {}          # empreinte -> chemin public
poids_avant = 0

def poser_image(typ, b64, nom_voulu):
    """Écrit l'image sur le disque et renvoie son adresse publique."""
    global poids_avant
    import base64
    empreinte = hashlib.md5(b64.encode('ascii')).hexdigest()
    if empreinte in images:
        return images[empreinte]
    octets = base64.b64decode(b64 + '=' * (-len(b64) % 4))
    # « Crédit Agricole » doit devenir credit-agricole, pas cr-dit-agricole :
    # les accents se translittèrent, ils ne se suppriment pas
    import unicodedata
    sans_accent = ''.join(c for c in unicodedata.normalize('NFD', nom_voulu)
                          if unicodedata.category(c) != 'Mn')
    nom = re.sub(r'[^a-z0-9]+', '-', sans_accent.lower()).strip('-') or empreinte[:10]
    fichier = '%s.%s' % (nom, EXT.get(typ, 'bin'))
    n = 2
    while os.path.exists(os.path.join(DST, 'assets', 'img', fichier)):
        fichier = '%s-%d.%s' % (nom, n, EXT.get(typ, 'bin')); n += 1
    io.open(os.path.join(DST, 'assets', 'img', fichier), 'wb').write(octets)
    poids_avant += len(b64)
    images[empreinte] = '/assets/img/' + fichier
    return images[empreinte]

# les trois images déclarées en variables CSS
NOMS_CSS = {'--logo-pg': 'pretto-galaxie', '--logo-txt': 'la-reference-courtage',
            '--photo-mr': 'mickael-rigaud'}
def remplacer_css(m):
    return '%s: url("%s")' % (m.group(1), poser_image(m.group(2), m.group(3), NOMS_CSS.get(m.group(1), 'image')))
css = re.sub(r'(--[\w-]+): url\("data:image/([a-z+]+);base64,([A-Za-z0-9+/=]+)"\)', remplacer_css, css)

# les logos des banques, portés par des <img> dans le carrousel
def remplacer_img(m):
    avant, typ, b64, apres = m.group(1), m.group(2), m.group(3), m.group(4)
    alt = re.search(r'alt="([^"]*)"', apres)
    return '%ssrc="%s"%s' % (avant, poser_image(typ, b64, alt.group(1) if alt else 'image'), apres)
for pid in list(articles):
    articles[pid] = re.sub(
        r'(<img[^>]*?)src="data:image/([a-z+]+);base64,([A-Za-z0-9+/=]+)"([^>]*>)',
        remplacer_img, articles[pid])

# ---------------------------------------------------------------------
# Le script perd son routage : chaque page est désormais un vrai document
# ---------------------------------------------------------------------
debut_routage = js.index("  const pages = [")
fin_routage = js.index("  document.querySelector('.burger').addEventListener")
routage = js[debut_routage:fin_routage]
assert 'hashchange' in routage and len(routage) < 2000, len(routage)

NOUVEAU_DEBUT = """  // Chaque rubrique est une page à part entière : plus rien à afficher ou
  // masquer au clic. Restent les anciennes adresses en ancre, qui ont circulé
  // pendant que le site n'était qu'une page — on les renvoie au bon endroit.
  const ANCIENNES = {
    accueil: '/', apropos: '/nous-rejoindre/', recrutement: '/nous-rejoindre/',
    partenariat: '/partenariat/', rdv: '/prendre-rendez-vous/',
    simulateur: '/simulateur/', mentions: '/mentions-legales/',
    'pret-immobilier': '/pret-immobilier/', assurance: '/assurance-emprunteur/',
    regroupement: '/regroupement-de-credits/', 'pret-pro': '/financement-professionnel/',
  };
  const ancre = (location.hash || '').slice(1);
  if (ancre && ANCIENNES[ancre] && location.pathname === '/') {
    location.replace(ANCIENNES[ancre]);
  }

"""
js = js[:debut_routage] + NOUVEAU_DEBUT + js[fin_routage:]

# le menu ne s'efface que sur l'accueil, qui seul porte le hero
js = js.replace(
    "    const surAccueil = document.getElementById('page-accueil').classList.contains('is-active');",
    "    const surAccueil = !!document.getElementById('page-accueil');")
js = js.replace("  document.addEventListener('claude:page', syncNav);\n", "")

# Le nom porte l'empreinte du contenu. Sans cela, un visiteur déjà venu garde
# l'ancien style en cache après une mise à jour, parfois plusieurs jours.
# Changer de nom force le téléchargement, et seulement quand c'est utile.
def poser_ressource(nom, ext, contenu):
    empreinte = hashlib.md5(contenu.encode('utf-8')).hexdigest()[:8]
    fichier = '%s.%s.%s' % (nom, empreinte, ext)
    io.open(os.path.join(DST, 'assets', fichier), 'w', encoding='utf-8', newline='\n').write(contenu)
    return '/assets/' + fichier

URL_CSS = poser_ressource('style', 'css', css)
URL_JS = poser_ressource('site', 'js', js)

# ---------------------------------------------------------------------
# La navigation devient de vrais liens : c'est ce que suivent les moteurs
# ---------------------------------------------------------------------
def vrais_liens(html, page_courante):
    def lien(m):
        avant, pid, apres = m.group(1), m.group(2), m.group(3)
        url = '/' + SLUG[pid] + '/' if SLUG.get(pid) else '/'
        balise = (avant + apres).replace('href="#' + pid + '"', 'href="' + url + '"')
        if 'href=' not in balise:
            balise = balise[:balise.index(' ')] + ' href="' + url + '"' + balise[balise.index(' '):]
        if pid == page_courante and 'nav-link' in balise:
            balise = balise.replace('class="nav-link"', 'class="nav-link is-active"')
            balise = balise.replace('aria-current', 'data-ancien-aria')
            balise = balise.replace('<a ', '<a aria-current="page" ', 1)
        return balise
    html = re.sub(r'(<a\b[^>]*?)data-nav="([\w-]+)"([^>]*>)', lien, html)
    # les boutons de navigation deviennent des liens
    def bouton(m):
        attrs, pid, reste, contenu = m.group(1), m.group(2), m.group(3), m.group(4)
        url = '/' + SLUG[pid] + '/' if SLUG.get(pid) else '/'
        attrs = re.sub(r'\btype="button"\s*', '', attrs + reste)
        return '<a href="%s" %s>%s</a>' % (url, attrs.strip(), contenu)
    html = re.sub(r'<button\b([^>]*?)data-nav="([\w-]+)"([^>]*?)>(.*?)</button>', bouton, html, flags=re.S)
    # certains éléments cliquables sont des <span> : un lien que Google doit
    # pouvoir suivre ne peut pas être autre chose qu'un <a href>
    def travesti(m):
        attrs, pid, reste, contenu = m.group(1), m.group(2), m.group(3), m.group(4)
        url = '/' + SLUG[pid] + '/' if SLUG.get(pid) else '/'
        attrs = re.sub(r'\b(role|tabindex)="[^"]*"\s*', '', attrs + reste)
        return '<a href="%s" %s>%s</a>' % (url, attrs.strip(), contenu)
    html = re.sub(r'<span\b([^>]*?)data-nav="([\w-]+)"([^>]*?)>(.*?)</span>', travesti, html, flags=re.S)
    return html

# la classe « is-active » du menu était posée par le script : elle est
# maintenant écrite dans chaque page
nav_propre = nav.replace('<a class="nav-link is-active"', '<a class="nav-link"')

GABARIT = '''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(titre)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(url)s">
<meta name="theme-color" content="#FFFCF6">
<meta name="robots" content="%(robots)s">

<meta property="og:type" content="website">
<meta property="og:site_name" content="La Référence Courtage">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="%(titre)s">
<meta property="og:description" content="%(desc)s">
<meta property="og:url" content="%(url)s">
<meta name="twitter:card" content="summary">

<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
%(polices)s
<link rel="stylesheet" href="%(css)s">
%(donnees)s</head>
<body>

%(nav)s

<main>
%(article)s
</main>

%(pied)s

<script src="%(js)s" defer></script>
</body>
</html>
'''

DONNEES_AGENCE = '''<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FinancialService",
  "@id": "%(site)s/#agence",
  "name": "La Référence Courtage",
  "description": "Agence de courtage indépendante à Nice, membre du réseau Pretto Galaxie.",
  "url": "%(site)s/",
  "telephone": "+33681651591",
  "email": "contact@lareferencecourtage.fr",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "18 place Masséna",
    "postalCode": "06000",
    "addressLocality": "Nice",
    "addressCountry": "FR"
  },
  "areaServed": ["Nice", "Côte d'Azur", "France"],
  "priceRange": "Aucun honoraire avant le déblocage des fonds",
  "founder": { "@type": "Person", "name": "Mickael Rigaud" },
  "memberOf": { "@type": "Organization", "name": "Pretto Galaxie" }
}
</script>
''' % {'site': SITE}

def donnees_fil(pid, slug, titre):
    """Le fil d'Ariane que Google affiche sous le titre dans ses résultats."""
    if not slug:
        return DONNEES_AGENCE
    return DONNEES_AGENCE + '''<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "%s/" },
    { "@type": "ListItem", "position": 2, "name": "%s" }
  ]
}
</script>
''' % (SITE, titre.split('—')[0].split('|')[0].strip())

for pid, slug, genre, titre, desc in PAGES:
    article = articles[pid]
    # chaque page n'en porte qu'un : il est visible d'emblée
    article = re.sub(r'^<article class="page(?! is-active)',
                     '<article class="page is-active', article, count=1)
    article = vrais_liens(article, pid)
    page = GABARIT % {
        'titre': titre, 'desc': ' '.join(desc.split()),
        'url': ADRESSE[pid], 'polices': polices,
        'robots': 'noindex, follow' if genre == 'legal' else 'index, follow',
        'donnees': donnees_fil(pid, slug, titre),
        'css': URL_CSS, 'js': URL_JS,
        'nav': vrais_liens(nav_propre, pid),
        'article': article,
        'pied': vrais_liens(pied, pid),
    }
    dossier = DST if not slug else os.path.join(DST, slug)
    os.makedirs(dossier, exist_ok=True)
    io.open(os.path.join(dossier, 'index.html'), 'w', encoding='utf-8', newline='\n').write(page)

# la page servie quand l'adresse ne correspond à rien
shutil.copy(os.path.join(DST, 'index.html'), os.path.join(DST, '200.html'))
# GitHub Pages sert `404.html` quand l'adresse demandée n'existe pas.
# Sans ce fichier, le visiteur tombe sur la page noire de GitHub, qui ne
# ressemble à rien et ne propose aucun chemin de retour.
shutil.copy(os.path.join(DST, 'index.html'), os.path.join(DST, '404.html'))

# ---------------------------------------------------------------------
# Les à-côtés
# ---------------------------------------------------------------------
def ecrire(nom, contenu):
    io.open(os.path.join(DST, nom), 'w', encoding='utf-8', newline='\n').write(contenu)

ecrire('favicon.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -4 92 108">'
    '<rect x="0" y="56.73" width="23.32" height="43.27" rx="6.1" fill="#4FB3D3"/>'
    '<rect x="28.34" y="39.52" width="23.32" height="60.48" rx="6.1" fill="#2A93B8"/>'
    '<rect x="56.68" y="23.3" width="23.32" height="76.7" rx="6.1" fill="#1D5B78"/>'
    '<circle cx="68.34" cy="9.13" r="9.1" fill="#F4801C"/></svg>')

ecrire('robots.txt', 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' % SITE)

urls = []
for pid, slug, genre, titre, desc in PAGES:
    if genre == 'legal':
        continue          # inutile de proposer les mentions légales à l'indexation
    urls.append('  <url>\n    <loc>%s</loc>\n    <changefreq>monthly</changefreq>\n'
                '    <priority>%s</priority>\n  </url>' % (ADRESSE[pid], '1.0' if not slug else '0.8'))
ecrire('sitemap.xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s\n</urlset>\n' % '\n'.join(urls))

ecrire('CNAME', 'www.lareferencecourtage.fr\n')

if os.path.isdir(EXTRAS):
    for f in sorted(os.listdir(EXTRAS)):
        shutil.copy(os.path.join(EXTRAS, f), DST)

# ---------------------------------------------------------------------
print('site généré dans', DST)
total = 0
for racine, _, fichiers in os.walk(DST):
    for f in sorted(fichiers):
        chemin = os.path.join(racine, f)
        taille = os.path.getsize(chemin)
        total += taille
        rel = os.path.relpath(chemin, DST).replace('\\', '/')
        if taille > 3000 or rel.count('/') == 0:
            print('  %-46s %7d o' % (rel, taille))
print('  %-46s %7d o' % ('(total)', total))
print('\n%d images extraites, %d Ko de base64 retirés du HTML'
      % (len(images), poids_avant // 1024))
