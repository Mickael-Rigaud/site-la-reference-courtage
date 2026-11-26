# -*- coding: utf-8 -*-
"""Le hero de l'accueil et le moteur du simulateur doivent dire le même taux.

POURQUOI CE FICHIER EXISTE (26/11/2026).

Le 25/11 au soir, l'onglet « Regroupement » du hero a été écrit avec les
chiffres du barème d'alors — une fourchette de 5,50 % à 8,20 %, sur 15 ans,
hors frais — avec un commentaire priant de les changer aux deux endroits le
jour où ils bougeraient.

Le 26/11 au matin ils avaient bougé : un seul taux de 6,30 %, des durées au
choix, 3 % de frais. Le hero a donc annoncé toute une nuit une mensualité que
la page d'à côté démentait. Rien n'a cassé, les deux écrans s'affichaient très
bien, et personne n'aurait rien vu sans un calcul fait à la main.

⚠ UN COMMENTAIRE INFORME, IL NE BLOQUE PAS.

Le hero ne peut pas emprunter les chiffres au moteur : il vit dans
`index.html`, le moteur dans ses propres modules, et les deux sont servis
séparément. Mais la construction du site, elle, peut REFUSER de publier tant
qu'ils divergent. C'est le seul chiffre du site qui vit en deux endroits ; il
est désormais tenu.
"""
import io
import os
import re


class BaremeDivergent(SystemExit):
    """Arrête la construction avec un message lisible."""


def _lire(motif, texte, quoi, fichier):
    m = re.search(motif, texte)
    if not m:
        raise BaremeDivergent(
            "ARRET : impossible de lire %s dans %s.\n"
            "   Le garde-fou du hero ne sait plus ou regarder. Si la forme du\n"
            "   barème a changé, c'est ce controle qu'il faut corriger, dans\n"
            "   verifier_bareme.py — surtout pas le supprimer." % (quoi, fichier))
    return m.group(1)


def controler(racine, source):
    """`racine` : le dossier du dépôt. `source` : le contenu d'index.html."""
    chemin = os.path.join(racine, 'simulateur-regroupement', 'moteur.js')
    if not os.path.exists(chemin):
        return []                    # le simulateur n'est pas du voyage
    moteur = io.open(chemin, encoding='utf-8').read()

    # ⚠ LE HERO NE PARLE QUE DU RACHAT SANS GARANTIE : il ne sait pas si le
    # visiteur est propriétaire ni s'il rachète un prêt immobilier, les deux
    # conditions qui font basculer l'opération en hypothécaire. Il prend donc
    # la fourchette la plus chère des deux — il pourra annoncer pire que le
    # simulateur complet, jamais mieux.
    bloc = _lire(r'sans_garantie:\s*\{([^}]*)\}', moteur,
                 'le bloc `sans_garantie` du barème', 'moteur.js')
    taux_bas = float(_lire(r'bas:\s*([\d.]+)', bloc, 'le taux bas', 'moteur.js'))
    taux_haut = float(_lire(r'haut:\s*([\d.]+)', bloc, 'le taux haut', 'moteur.js'))
    frais = float(_lire(r'FRAIS:\s*\{\s*sans_garantie:\s*([\d.]+)', moteur,
                        'les frais sans garantie', 'moteur.js'))

    brut = re.search(r'DUREES:\s*\{\s*sans_garantie:\s*\[([^\]]*)\]', moteur)
    durees = [int(x) for x in re.findall(r'\d+', brut.group(1))] if brut else []

    h_taux = float(_lire(r'const TAUX = ([\d.]+)', source,
                         'la constante TAUX du hero', 'index.html'))
    h_duree = int(_lire(r'DUREE_ANS = (\d+)', source,
                        'la constante DUREE_ANS du hero', 'index.html'))
    h_frais = float(_lire(r'FRAIS = ([\d.]+)', source,
                          'la constante FRAIS du hero', 'index.html'))

    ecarts = []
    if taux_bas != taux_haut:
        # Le moteur est revenu à une vraie fourchette : le hero n'affiche
        # qu'un chiffre, il ne peut plus la représenter honnêtement.
        ecarts.append(
            "le moteur annonce de nouveau une FOURCHETTE (%.2f %% a %.2f %%), "
            "alors que le hero n'affiche qu'un seul chiffre"
            % (taux_bas * 100, taux_haut * 100))
    elif abs(h_taux - taux_bas) > 1e-9:
        ecarts.append("taux : le hero dit %.2f %%, le moteur %.2f %%"
                      % (h_taux * 100, taux_bas * 100))

    if abs(h_frais - frais) > 1e-9:
        ecarts.append("frais : le hero dit %.1f %%, le moteur %.1f %%"
                      % (h_frais * 100, frais * 100))

    if durees and h_duree not in durees:
        ecarts.append("duree : le hero annonce %d ans, le moteur ne propose que %s"
                      % (h_duree, ' / '.join(str(d) for d in durees)))

    # La note sous la carte porte les mêmes chiffres en toutes lettres : un
    # calcul juste sous une phrase fausse reste une page fausse.
    #
    # ⚠ ON NE CHERCHE QUE DANS LA NOTE, PAS DANS TOUTE LA PAGE. Premier jet :
    # « le taux figure-t-il quelque part dans index.html ? ». Il figurait — dans
    # un commentaire du markup, juste au-dessus. Le controle passait au vert
    # avec une phrase fausse sous les yeux du visiteur. Vu en essayant de le
    # mettre en defaut, pas en le relisant.
    volet = source.split('id="h-vol-regr"', 1)
    note = ''
    if len(volet) == 2:
        m = re.search(r'<p class="hero-sim-note">(.*?)</p>', volet[1], re.S)
        if m:
            note = m.group(1)
    if not note:
        ecarts.append("la note sous la carte du hero est introuvable : le volet "
                      "`h-vol-regr` ou son `<p class=\"hero-sim-note\">` a change de forme")
    else:
        taux_ecrit = ('%.2f' % (taux_bas * 100)).replace('.', ',')
        if taux_ecrit + ' %' not in note:
            ecarts.append("la note sous la carte du hero ne dit pas « %s %% » : "
                          "le calcul est peut-etre juste, la phrase ne l'est plus"
                          % taux_ecrit)
        if ('Sur %d ans' % h_duree) not in note:
            ecarts.append("la note sous la carte du hero n'annonce pas « Sur %d ans »"
                          % h_duree)

    # ------------------------------------------------------------------
    # Les trois cas concrets portent eux aussi des chiffres du moteur
    # ------------------------------------------------------------------
    # ⚠ MÊME PIÈGE, DEUX FOIS DE SUITE. Les montants des cartes « Julie &
    # Marc », « Sandrine » et « Thierry » sont des résultats du moteur, figés
    # dans `index.html` le 26/11. Si le barème bouge, ils deviennent faux
    # exactement comme le hero l'était la veille — et, comme lui, sans que
    # rien ne casse. On ne peut pas les recalculer ici (le moteur est en
    # JavaScript), mais on peut vérifier que la note sous les cartes annonce
    # toujours les taux du moteur : si elle ne les annonce plus, c'est que le
    # barème a changé et que les trois cas sont à recalculer.
    taux_hypo = None
    bloc_hypo = re.search(r'hypothecaire:\s*\{([^}]*)\}', moteur)
    if bloc_hypo:
        m = re.search(r'bas:\s*([\d.]+)', bloc_hypo.group(1))
        if m:
            taux_hypo = float(m.group(1))

    note_cas = re.search(r'const NOTE =(.*?);\s', source, re.S)
    if not note_cas:
        ecarts.append("la note des trois cas concrets (`const NOTE`) est introuvable "
                      "dans index.html")
    else:
        texte = note_cas.group(1)
        attendus = [('%.2f' % (taux_bas * 100)).replace('.', ',')]
        if taux_hypo is not None:
            attendus.append(('%.2f' % (taux_hypo * 100)).replace('.', ','))
        manquants = [t for t in attendus if t not in texte]
        if manquants:
            ecarts.append(
                "la note des trois cas concrets n'annonce plus %s : le bareme a\n"
                "     change, donc les montants des cartes Julie & Marc / Sandrine /\n"
                "     Thierry sont a RECALCULER avec le moteur (voir le commentaire\n"
                "     au-dessus de `const CAS` dans index.html)"
                % ' ni '.join('« %s %% »' % t for t in manquants))

    if ecarts:
        raise BaremeDivergent(
            "ARRET : l'accueil et le moteur du simulateur ne disent pas la meme\n"
            "   chose. Publier maintenant mettrait en ligne deux ecrans qui se\n"
            "   contredisent.\n\n   "
            + "\n   ".join('- ' + e for e in ecarts)
            + "\n\n   A corriger dans index.html :\n"
              "   - onglet Regroupement du hero : les constantes TAUX / DUREE_ANS /\n"
              "     FRAIS, la valeur affichee au repos, et la note sous la carte ;\n"
              "   - trois cas concrets : relancer le moteur sur les trois dossiers\n"
              "     et reporter les montants dans `const CAS`, puis la note.")

    return [taux_bas, h_duree, frais]


if __name__ == '__main__':
    ici = os.path.dirname(os.path.abspath(__file__))
    src = io.open(os.path.join(ici, 'index.html'), encoding='utf-8').read()
    valeurs = controler(ici, src)
    if valeurs:
        print("hero et moteur d'accord : %.2f %%, %d ans, frais %.1f %%"
              % (valeurs[0] * 100, valeurs[1], valeurs[2] * 100))
    else:
        print("pas de simulateur a verifier")
