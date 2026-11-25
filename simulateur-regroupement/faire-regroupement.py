# -*- coding: utf-8 -*-
"""Assemble le simulateur de regroupement de crédits.

    python faire-regroupement.py

CE QU'IL FAIT, ET POURQUOI IL NE COPIE PAS DU CSS
L'habillage n'est pas recopié ici : il est EMPRUNTÉ au simulateur immobilier
déjà publié (`../simulateur-lrc/site/index.html`), dont on extrait le bloc
`<style>` complet — 76 Ko qui contiennent la base du modèle de Christophe, les
retouches de la charte La Référence Courtage et l'écran de résultat au feu de
carrefour, déjà assemblés dans le bon ordre.

⚠ C'EST VOLONTAIRE, ET C'EST TOUT L'INTÉRÊT. Recopier les trois feuilles dans
ce dossier aurait produit deux simulateurs qui divergent au premier coup de
pinceau : on retouche l'un, l'autre reste en arrière, et personne ne s'en
aperçoit avant de les ouvrir côte à côte. En empruntant, une évolution de la
charte se répercute ici dès la prochaine commande.

⚠ DONC `faire-simulateur.py` DOIT ÊTRE PASSÉ AVANT. Si `../simulateur-lrc/site`
n'existe pas, ce script s'arrête plutôt que de produire une page sans style —
une page nue répond 200 et se publie sans bruit.

CE QU'IL PRODUIT
`site/` : `index.html`, `moteur.js`, `parcours.js`, `vue.js`, `assets/`.
Plusieurs fichiers et non un seul, contrairement au simulateur immobilier :
celui-ci est mono-fichier parce qu'il descend d'un modèle mono-fichier, pas
par choix. Des modules séparés se relisent et se corrigent un par un.
"""
import hashlib, io, os, re, shutil, sys

ICI = os.path.dirname(os.path.abspath(__file__))
MODELE = os.path.join(ICI, '..', 'simulateur-lrc', 'site', 'index.html')
SORTIE = os.path.join(ICI, 'site')

if not os.path.exists(MODELE):
    sys.exit("ARRET : %s est introuvable.\n"
             "Passez d'abord `python faire-simulateur.py` dans simulateur-lrc/ :\n"
             "c'est lui qui fabrique la page dont on emprunte l'habillage." % MODELE)

src = io.open(MODELE, encoding='utf-8').read()


def extraire(motif, quoi):
    m = re.search(motif, src, re.S)
    if not m:
        sys.exit("ARRET : %s introuvable dans le simulateur immobilier.\n"
                 "Sa structure a changé ; il faut reprendre ce script plutôt que\n"
                 "publier une page qui aura perdu ce morceau sans le dire." % quoi)
    return m.group(1)


STYLE = extraire(r'<style[^>]*>(.*?)</style>', 'le bloc <style>')

# ⚠ NOTRE FEUILLE PASSE APRÈS L'EMPRUNTÉE, et l'ordre fait tout : à
# spécificité égale, c'est la dernière règle lue qui gagne. Posée avant,
# `habillage-regroupement.css` serait écrasée sans un mot par la feuille
# du simulateur immobilier, et l'écran de résultat reprendrait les
# défauts qu'elle corrige (voir son en-tête : grille à deux colonnes,
# libellés blancs sur fond blanc).
PROPRE = os.path.join(ICI, 'habillage-regroupement.css')
if not os.path.exists(PROPRE):
    sys.exit('ARRET : habillage-regroupement.css est introuvable.')
STYLE = STYLE + '\n\n/* ===== propre au regroupement ===== */\n' \
    + io.open(PROPRE, encoding='utf-8').read()
CIEL = extraire(r'(<div class="ciel".*?</div>\s*</div>)', 'le décor de la baie')
ENTETE = extraire(r'(<header>.*?</header>)', "l'en-tête")

# ⚠ L'ACCROCHE NE PEUT PAS ÊTRE CELLE DE L'AUTRE SIMULATEUR. « Votre projet,
# vérifié en 2 min » parle d'un projet immobilier ; ici on ne vérifie pas un
# projet, on compare une situation à ce qu'elle pourrait devenir.
ENTETE = re.sub(r'<span class="accroche">.*?</span>',
                '<span class="accroche">Vos crédits, <b>comparés en 3 min</b></span>',
                ENTETE, flags=re.S)

# Le bloc « courtier » du modèle se remplit par un script qu'on n'emporte pas.
ENTETE = ENTETE.replace('<span class="courtier" id="courtierBox"></span>', '')

# ---------------------------------------------------------------------
# L'empreinte des modules, pour que le navigateur cesse de servir l'ancien
# ---------------------------------------------------------------------
# ⚠ SANS ELLE, UNE CORRECTION MET JUSQU'À DIX MINUTES À ARRIVER — et c'est
# arrivé le 25/11/2026 : une regression publiée puis corrigée dans la foulée
# restait visible sur le site, parce que `vue.js` porte toujours le même nom
# et que GitHub Pages le fait garder dix minutes (`max-age=600`). Le fichier
# du serveur était bon, celui du navigateur ne l'était pas, et recharger la
# page n'y changeait rien : la page était neuve, le script restait en cache.
#
# On suffixe donc chaque module d'une empreinte de SON CONTENU. Le nom change
# dès que le code change, et le navigateur va chercher le nouveau.
#
# ⚠ ET LES IMPORTS AUSSI, pas seulement la balise `<script>`. `vue.js`
# importe `moteur.js` et `parcours.js` : sans empreinte sur ces deux
# adresses-là, on servirait un `vue.js` neuf qui va rechercher un moteur
# périmé — le pire des deux mondes, un mélange que rien ne signale.
#
# La page et les modules sont gardés la même durée, donc ils voyagent
# ensemble : une page périmée demande les modules périmés qui vont avec, et
# une page fraîche demande les frais. Jamais de mélange.
MODULES = ('moteur.js', 'parcours.js', 'vue.js')
empreinte = hashlib.md5()
for f in MODULES:
    empreinte.update(io.open(os.path.join(ICI, f), 'rb').read())
V = empreinte.hexdigest()[:8]

PAGE = u"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Regroupement de crédits — simulateur | La Référence Courtage</title>
<meta name="description" content="Comparez votre situation actuelle et un regroupement de crédits : mensualité, durée et coût total côte à côte. Étude sans engagement.">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<!-- LES TROIS POLICES DE LA PAGE (25/11/2026).

     CONSTAT DE CE SOIR : cette page n'avait JAMAIS charge la moindre
     police distante. Le <style> emprunte a la page de Christophe
     reclame 'Fraunces' pour les titres et 'Inter' pour le texte, mais
     les <link> qui les chargent vivent dans SON <head>, que ce script
     ne recopie pas. Tout tombait sur les replis -- Georgia pour les
     titres, dont les chiffres sont de hauteurs inegales, et c'est
     exactement ce que Mickael voyait.

     Montserrat s'ajoute pour les chiffres seuls : « mets les chiffres
     en Montserrat ou Arial ». Fraunces et Inter rejoignent la liste le
     meme soir, sur sa demande -- la page ressemble enfin vraiment au
     site dont elle emprunte l'habillage.

     ⚠ LES MEMES GRAISSES QUE LA PAGE HOTE, pas d'autres. Une graisse
     absente ne produit aucune erreur : le navigateur la fabrique en
     epaississant la normale, et le texte paraît simplement sale. Les
     valeurs ci-dessous sont recopiees du <head> de
     simulateur-lrc/site/index.html.

     ⚠ UNE SEULE REQUETE POUR LES TROIS. Deux <link> vers le meme
     domaine, c'est deux allers-retours la ou l'API en accepte autant
     de 'family' qu'on veut.

     La page se degrade proprement : sans Google Fonts, les titres
     retombent sur Georgia et les chiffres sur Arial, que Mickael a
     nommee lui-meme comme acceptable. -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@500;600;700&display=swap">
<style>
%(style)s
</style>
</head>
<body>
%(ciel)s
%(entete)s
<div class="progress"><i id="bar"></i></div>
<div class="layout">
  <nav class="rail"><ol id="rail"></ol></nav>
  <div class="main">
    <div class="top"><span class="sec" id="sec"></span><span class="step-count" id="cnt"></span></div>
    <button type="button" class="backlink" id="back" style="display:none">&larr; Retour</button>
    <form id="form" onsubmit="return false"><div id="stage"></div></form>
    <div class="nav" id="nav">
      <button type="button" class="btn btn-p" id="next">Commencer</button>
    </div>
  </div>
</div>
<footer id="pied"></footer>
<script type="module" src="vue.js?v=%(v)s"></script>
</body>
</html>
""" % {'style': STYLE, 'ciel': CIEL, 'entete': ENTETE, 'v': V}

if os.path.isdir(SORTIE):
    shutil.rmtree(SORTIE)
os.makedirs(SORTIE)

io.open(os.path.join(SORTIE, 'index.html'), 'w', encoding='utf-8').write(PAGE)

for f in MODULES:
    code = io.open(os.path.join(ICI, f), encoding='utf-8').read()
    # Les imports entre modules portent l'empreinte eux aussi.
    code = re.sub(r"(from\s+'\./)(moteur|parcours|vue)(\.js')",
                  r"\1\2.js?v=%s'" % V, code)
    io.open(os.path.join(SORTIE, f), 'w', encoding='utf-8', newline='\n').write(code)

# Les images de l'en-tête viennent du simulateur immobilier, qui les a déjà.
ASSETS_SRC = os.path.join(ICI, '..', 'simulateur-lrc', 'site', 'assets')
if os.path.isdir(ASSETS_SRC):
    shutil.copytree(ASSETS_SRC, os.path.join(SORTIE, 'assets'), dirs_exist_ok=True)

total = 0
for dossier, _, fichiers in os.walk(SORTIE):
    for f in fichiers:
        total += os.path.getsize(os.path.join(dossier, f))
print(u'site/ écrit — %d fichiers, %d Ko' % (
    sum(len(f) for _, _, f in os.walk(SORTIE)), total // 1024))
print(u'habillage emprunté au simulateur immobilier : %d Ko de CSS' % (len(STYLE) // 1024))
