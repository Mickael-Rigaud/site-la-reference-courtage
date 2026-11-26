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
    # L'exemple chiffré, écrit en dur dans deux pages
    # ------------------------------------------------------------------
    # ⚠ MÊME PIÈGE, UNE TROISIÈME FOIS. Le 26/11, la section des trois cartes
    # a laissé place à UN seul cas, affiché à deux endroits : la bande de
    # l'accueil et la page regroupement. Ses montants ne sont plus produits par
    # un script, ils sont écrits dans le markup — donc plus rien ne les retient.
    # Si le barème bouge, le montant d'après devient faux aux deux endroits,
    # en silence.
    #
    # On ne peut pas appeler le moteur depuis Python, mais on n'en a pas besoin :
    # la mensualité d'un prêt amortissable tient en une ligne. On la recalcule
    # ici À PARTIR DU BARÈME, et on vérifie que la page l'affiche.
    #
    # ⚠ L'EXEMPLE EST HYPOTHÉCAIRE DEPUIS LE 27/11/2026 : un prêt immobilier a
    # remplacé le renouvelable, Julie et Marc sont propriétaires. Le moteur
    # (`nature()`) passe alors au barème hypothécaire : son taux, ses frais,
    # et la durée du milieu de ses trois durées (`dureeRetenue()` sans
    # objectif). Lire le barème SANS GARANTIE ici, comme pour le hero,
    # comparerait l'exemple à une opération qui n'est pas la sienne.
    # ⚠ UNE SEULE SOURCE POUR LES TROIS LIGNES. Avant, deux additions séparées
    # (`14200 + 9500 + 92000` et `318 + 215 + 640`) : les montants par ligne
    # n'existaient donc nulle part ailleurs que dans ces additions, et rien ne
    # les confrontait au markup. On pouvait mettre 400 € au lieu de 318 € et la
    # page affichait trois montants faisant 1 255 € sous un total de 1 173 €,
    # sans que la construction s'arrête. Éprouvé : c'est maintenant refusé.
    LIGNES_EXEMPLE = (
        ('prêt auto',        14200, 318),
        ('crédit travaux',    9500, 215),
        ('prêt immobilier',  92000, 640),
    )
    CAPITAL_EXEMPLE = sum(c for _, c, _ in LIGNES_EXEMPLE)
    MENSU_AUJOURDHUI = sum(m for _, _, m in LIGNES_EXEMPLE)
    # Mettre à False le jour où l'exemple repasse sans garantie : les contrôles
    # de la situation décrite (propriétaires, garantie hypothécaire) tombent
    # alors d'eux-mêmes, au lieu de refuser un texte devenu juste.
    EXEMPLE_HYPOTHECAIRE = True

    bloc_h = _lire(r'hypothecaire:\s*\{([^}]*)\}', moteur,
                   'le bloc `hypothecaire` du barème', 'moteur.js')
    taux_ex = float(_lire(r'bas:\s*([\d.]+)', bloc_h, 'le taux hypothécaire', 'moteur.js'))
    frais_ex = float(_lire(r'FRAIS:\s*\{[^}]*hypothecaire:\s*([\d.]+)', moteur,
                           'les frais hypothécaires', 'moteur.js'))
    brut_h = re.search(r'DUREES:\s*\{[^}]*hypothecaire:\s*\[([^\]]*)\]', moteur)
    durees_h = [int(x) for x in re.findall(r'\d+', brut_h.group(1))] if brut_h else []
    if not durees_h:
        ecarts.append("les durees hypothecaires du moteur sont illisibles")
        durees_h = [20]
    duree = durees_h[len(durees_h) // 2]
    mois = duree * 12
    # le moteur arrondit les frais à l'euro, puis le total (`montantFinance`)
    finance = round(CAPITAL_EXEMPLE + round(CAPITAL_EXEMPLE * frais_ex))
    i = taux_ex / 12
    attendu = finance / mois if i == 0 else (finance * i) / (1 - (1 + i) ** -mois)
    attendu = int(round(attendu))
    baisse = int(round((MENSU_AUJOURDHUI - attendu) / MENSU_AUJOURDHUI * 100))
    cout_total = attendu * mois

    # ⚠ ON NE CHERCHE QUE DANS LES DEUX BLOCS DE MARKUP, JAMAIS DANS TOUT LE
    # FICHIER. Premier jet, ce matin : le contrôle du hero trouvait son taux
    # dans un commentaire et passait au vert. J'ai refait exactement la même
    # chose ici l'après-midi — le montant figurait dans un commentaire que je
    # venais d'écrire, et trois dérives sur cinq passaient à travers. Un
    # commentaire n'est pas ce que lit le visiteur.
    def bloc_markup(marque, nom):
        i = source.find(marque)
        if i < 0:
            return None, "le bloc %s (`%s`) est introuvable dans index.html" % (nom, marque)
        # on s'arrête au premier commentaire fermant ou à 2500 caractères :
        # le bloc du cas n'en fait qu'environ 900.
        return source[i:i + 2500], None

    blocs = []
    for marque, nom in (('<div class="regroup-cas">', "de l'accueil"),
                        ('<div class="rgp-cas rise">', 'de la page regroupement')):
        bloc, souci = bloc_markup(marque, nom)
        if souci:
            ecarts.append(souci)
        else:
            blocs.append((nom, bloc))

    def _compter(bloc, valeur):
        """Combien de fois ce montant est ecrit dans le bloc, toutes graphies.

        ⚠ ON DÉDUPLIQUE LES GRAPHIES AVANT DE COMPTER. Pour un montant à trois
        chiffres, « {:,}.format(318) » vaut « 318 » quelle que soit la graphie
        du séparateur de milliers : les cinq tours de boucle cherchaient donc la
        MÊME chaîne, et une seule occurrence en comptait cinq. Le seuil de deux
        était franchi par une occurrence unique, et corriger un seul des deux
        « 318 € » passait au vert — le faux vert que ce contrôle devait
        justement empêcher.
        """
        graphies = set()
        for mille in ('', '&nbsp;', ' ', ' ', ' '):
            nombre = '{:,}'.format(valeur).replace(',', mille)
            for espace in ('&nbsp;', ' ', ' ', ''):
                graphies.add('%s%s€' % (nombre, espace))
        return sum(bloc.count(g) for g in graphies)

    def present(bloc, valeur, suffixe=''):
        # ⚠ AU-DELÀ DE 999, LE MONTANT S'ÉCRIT AVEC UN SÉPARATEUR DE MILLIERS
        # (« 1&nbsp;173&nbsp;€ ») : on accepte les trois écritures du
        # séparateur, comme pour l'espace avant le symbole.
        for mille in ('', '&nbsp;', ' ', ' ', ' '):
            nombre = '{:,}'.format(valeur).replace(',', mille)
            for espace in ('&nbsp;', ' ', ' ', ''):
                if ('%s%s%s' % (nombre, espace, suffixe)) in bloc:
                    return True
        return False

    for nom, bloc in blocs:
        if not present(bloc, attendu, '€'):
            ecarts.append(
                "l'exemple %s devrait afficher %d € par mois (capital %d €,\n"
                "     frais %.0f %%, %.2f %% sur %d ans) et ne l'affiche pas"
                % (nom, attendu, CAPITAL_EXEMPLE, frais_ex * 100, taux_ex * 100, duree))
        if not present(bloc, MENSU_AUJOURDHUI, '€'):
            ecarts.append("l'exemple %s n'affiche plus %d € pour la situation "
                          "d'aujourd'hui" % (nom, MENSU_AUJOURDHUI))
        if ('&minus;%d' % baisse) not in bloc and ('−%d' % baisse) not in bloc:
            ecarts.append("l'exemple %s devrait annoncer une baisse de %d %% "
                          "(de %d € a %d €)" % (nom, baisse, MENSU_AUJOURDHUI, attendu))
        if ('sur %d ans' % duree) not in bloc:
            ecarts.append("l'exemple %s n'annonce pas « sur %d ans »" % (nom, duree))
        if not present(bloc, cout_total, '€'):
            ecarts.append("l'exemple %s devrait annoncer un cout total de %d €"
                          % (nom, cout_total))

        # ⚠ CHAQUE MONTANT DOIT FIGURER AU MOINS DEUX FOIS : dans la barre
        #   (`<em>318&nbsp;€</em>`) et dans la légende (`<b>318&nbsp;€</b>`).
        #   Un seul des deux corrigé donnait une page qui se contredisait.
        for intitule, _capital, mensu in LIGNES_EXEMPLE:
            vus = _compter(bloc, mensu)
            if vus < 2:
                ecarts.append(
                    "l'exemple %s devrait afficher %d € pour le %s a deux endroits\n"
                    "     (la barre et la legende) et ne l'affiche que %d fois"
                    % (nom, mensu, intitule, vus))

        # ⚠ ET LES LONGUEURS DES BARRES VIENNENT DES MÊMES CHIFFRES. Elles sont
        #   écrites à côté, en styles (`--m:318;--t:1173`). Un montant corrigé
        #   sous une barre restée à l'ancienne échelle est pire qu'un chiffre
        #   faux : c'est un chiffre juste avec une image fausse, et personne ne
        #   la mesure en relisant le code.
        paires = [(int(m), int(t)) for m, t in
                  re.findall(r'--m:\s*(\d+)\s*;\s*--t:\s*(\d+)', bloc)]
        attendues = sorted([(m, MENSU_AUJOURDHUI) for _, _, m in LIGNES_EXEMPLE]
                           + [(attendu, MENSU_AUJOURDHUI)])
        if sorted(paires) != attendues:
            ecarts.append(
                "l'exemple %s : les longueurs des barres ne suivent plus les\n"
                "     montants. Attendu %s, trouve %s"
                % (nom, attendues, sorted(paires)))

        # le montant de depart porte aussi par l'attribut qui anime le compte
        for de in re.findall(r'data-de="(\d+)"', bloc):
            if int(de) != MENSU_AUJOURDHUI:
                ecarts.append("l'exemple %s : `data-de` vaut %s, la mensualite "
                              "d'aujourd'hui est %d €" % (nom, de, MENSU_AUJOURDHUI))

    # ⚠ LA SITUATION DÉCRITE, ET PAS SEULEMENT LES CHIFFRES. Un locataire ne
    #   peut pas donner de garantie hypothécaire : si quelqu'un remet
    #   « locataires » — c'était le texte d'avant le 27/11, il traîne encore
    #   dans l'historique — la page se contredit sans qu'aucun chiffre bouge.
    if EXEMPLE_HYPOTHECAIRE:
        for classe, nom in (('regroup-exemple', "de l'accueil"),
                            ('rgp-exemple', 'de la page regroupement')):
            m = re.search(r'<p class="%s">(.*?)</p>' % classe, source, re.S)
            if not m:
                ecarts.append("la phrase d'exemple %s (`.%s`) est introuvable"
                              % (nom, classe))
                continue
            phrase = m.group(1)
            if 'garantie hypoth' not in phrase:
                ecarts.append(
                    "la phrase d'exemple %s n'annonce plus la garantie hypothecaire,\n"
                    "     alors que les montants sont calcules au bareme hypothecaire :\n"
                    "     le visiteur qui saisit ses credits dans l'onglet du hero (sans\n"
                    "     garantie) obtiendra un autre chiffre" % nom)
            if 'propriétaires' not in phrase:
                ecarts.append("la phrase d'exemple %s ne dit plus « proprietaires », "
                              "ce qu'exige la garantie hypothecaire" % nom)
            if 'locataires' in phrase:
                ecarts.append("la phrase d'exemple %s dit « locataires » alors que "
                              "l'operation est hypothecaire : un locataire ne peut "
                              "pas donner cette garantie" % nom)

    if ecarts:
        raise BaremeDivergent(
            "ARRET : l'accueil et le moteur du simulateur ne disent pas la meme\n"
            "   chose. Publier maintenant mettrait en ligne deux ecrans qui se\n"
            "   contredisent.\n\n   "
            + "\n   ".join('- ' + e for e in ecarts)
            + "\n\n   A corriger dans index.html :\n"
              "   - onglet Regroupement du hero : les constantes TAUX / DUREE_ANS /\n"
              "     FRAIS, la valeur affichee au repos, et la note sous la carte ;\n"
              "   - l'exemple chiffre, qui figure A DEUX ENDROITS : la bande de\n"
              "     l'accueil (`.regroup-cas`) et la page regroupement (`.rgp-cas`).\n"
              "     Les deux doivent porter les memes montants, AUX TROIS ENDROITS\n"
              "     de chaque bloc : la barre (`<em>`), la legende (`<b>`) et les\n"
              "     longueurs `--m` / `--t` ecrites dans les styles ;\n"
              "   - les deux phrases d'exemple (`.regroup-exemple` et\n"
              "     `.rgp-exemple`), qui doivent decrire la situation que le\n"
              "     bareme suppose : proprietaires, garantie hypothecaire.")

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
