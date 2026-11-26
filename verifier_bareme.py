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


def _mensualite(capital, taux_annuel, mois):
    """La mensualite d'un pret amortissable a echeances constantes.

    ⚠ Le taux zero est traite a part : la formule generale divise par
    `1 - (1+i)^-n`, nul quand i vaut 0, et rendrait `inf`.
    """
    i = taux_annuel / 12
    if i == 0:
        return capital / mois
    return capital * i / (1 - (1 + i) ** -mois)


def _euros(texte):
    """Tous les montants en euros d'un fragment, dans l'ordre."""
    plat = texte.replace('&nbsp;', '\u00a0')
    return [int(re.sub(r'[^0-9]', '', m))
            for m in re.findall(r'(\d[\d\u00a0 ]*)\s*\u20ac', plat)]


def _controler_chiffres_immo(source, ecarts):
    """La section « En chiffres » de la page Pret immobilier.

    Tout est recalcule depuis les hypotheses que la page ecrit. Quand une
    hypothese devient illisible, on le DIT : un controle saute en silence est
    pire que pas de controle du tout.
    """
    m_sec = re.search(r'<section class="pi-c1">(.*?)</section>', source, re.S)
    if not m_sec:
        return          # la section n'existe pas (encore) : ce n'est pas un ecart
    sec = m_sec.group(1)
    plat = sec.replace('&nbsp;', '\u00a0')

    def souci(quoi):
        ecarts.append("« En chiffres » (pret immobilier) : %s" % quoi)

    # ---- les hypotheses, lues dans la page
    m_q = re.search(r'Sur (\d[\d\u00a0 ]*)\s*\u20ac et (\d+)\s*ans.*?'
                    r'qu\u2019\u00e0 (\d+,\d+)\s*%', plat, re.S)
    m_ecart = re.search(r'id="pi-c1-ei"[^>]*value="([\d.]+)"', sec)
    m_rev = re.search(r'id="pi-c1-vi"[^>]*value="(\d+)"', sec)
    m_endet = re.search(r'taux d\u2019endettement de (\d+)\s*%', plat)
    m_assur = re.search(r'assurance \u00e0 (\d+,\d+)\s*% par an', plat)
    m_caution = re.search(r'caution \u00e0 (\d+,\d+)\s*%', plat)
    m_frais = re.search(r'(\d[\d\u00a0 ]*)\s*\u20ac de frais de dossier', plat)
    manquantes = [n for n, m in (('le montant et la duree', m_q),
                                 ("l'ecart de taux (curseur)", m_ecart),
                                 ('les revenus (curseur)', m_rev),
                                 ("le taux d'endettement", m_endet),
                                 ("le taux d'assurance", m_assur),
                                 ('le taux de caution', m_caution),
                                 ('les frais de dossier', m_frais)) if not m]
    if manquantes:
        souci("la page n'enonce plus %s, le controle ne peut plus recalculer "
              "ses chiffres" % ', '.join(manquantes))
        return

    def _nb(x):
        return int(re.sub(r'[^0-9]', '', x))

    capital = _nb(m_q.group(1))
    annees = int(m_q.group(2))
    mois = annees * 12
    taux_haut = float(m_q.group(3).replace(',', '.')) / 100
    taux_bas_pi = taux_haut - float(m_ecart.group(1)) / 100
    revenus = int(m_rev.group(1))
    endet = int(m_endet.group(1)) / 100
    assur = float(m_assur.group(1).replace(',', '.')) / 100
    caution = float(m_caution.group(1).replace(',', '.')) / 100
    frais = _nb(m_frais.group(1))

    # ---- 1. les deux mensualites et l'ecart
    m_haut = round(_mensualite(capital, taux_haut, mois))
    m_bas = round(_mensualite(capital, taux_bas_pi, mois))
    for ident, attendu_m, quoi in (('pi-c1-m', m_bas, 'la mensualite au taux negocie'),):
        m_aff = re.search(r'id="%s"[^>]*>(.*?)</b>' % ident, sec, re.S)
        if not m_aff or _euros(m_aff.group(1))[:1] != [attendu_m]:
            souci("%s devrait valoir %d \u20ac (%.2f %% sur %d ans), la page affiche %s"
                  % (quoi, attendu_m, taux_bas_pi * 100, annees,
                     m_aff.group(1).strip() if m_aff else 'rien'))
    if m_haut not in _euros(sec):
        souci("la mensualite au taux de depart devrait valoir %d \u20ac "
              "(%.2f %% sur %d ans) et n'apparait pas"
              % (m_haut, taux_haut * 100, annees))

    m_r = re.search(r'id="pi-c1-r"[^>]*>(.*?)</b>', sec, re.S)
    attendu_ecart = (m_haut - m_bas) * mois
    if not m_r or _euros(m_r.group(1))[:1] != [attendu_ecart]:
        souci("l'economie annoncee devrait valoir %d \u20ac ((%d \u2212 %d) \u00d7 %d), "
              "la page affiche %s"
              % (attendu_ecart, m_haut, m_bas, mois,
                 m_r.group(1).strip() if m_r else 'rien'))

    # ---- la largeur de la seconde barre est le rapport des deux mensualites
    #      ⚠ DEUX BASES LEGITIMES, ET ON LES ACCEPTE TOUTES DEUX. La page
    #      calcule ce rapport sur les mensualites NON ARRONDIES (97,86 % ->
    #      97,9 %) ; un calcul sur les arrondies donne 97,83 % -> 97,8 %. Ma
    #      premiere version n'admettait que la seconde et arretait la
    #      construction d'une page juste — un faux positif, dont la reaction
    #      naturelle aurait ete de « corriger » un chiffre qui etait bon.
    #      Une barre restee a l'ancienne echelle, elle, sort de cette
    #      fourchette de plusieurs points : le controle garde son mordant.
    m_b2 = re.search(r'id="pi-c1-b2"[^>]*--w:([\d.]+)%', sec)
    if m_b2:
        brut = _mensualite(capital, taux_bas_pi, mois) / _mensualite(capital, taux_haut, mois)
        bornes = sorted((round(brut * 100, 1), round(m_bas / m_haut * 100, 1)))
        vu = float(m_b2.group(1))
        if not (bornes[0] - 0.05 <= vu <= bornes[1] + 0.05):
            souci("la seconde barre est a %s %% alors que le rapport des deux "
                  "mensualites donne %s %% : une barre restee a l'ancienne echelle "
                  "sous un montant corrige" % (m_b2.group(1),
                  ' a '.join('%.1f' % b for b in bornes) if bornes[0] != bornes[1]
                  else '%.1f' % bornes[0]))

    # ---- 2. la capacite d'emprunt
    m_c = re.search(r'id="pi-c1-c"[^>]*>(.*?)</b>', sec, re.S)
    i = taux_bas_pi / 12
    cap = revenus * endet * (1 - (1 + i) ** -mois) / i
    att_cap = int(round(cap / 1000) * 1000)
    if not m_c or _euros(m_c.group(1))[:1] != [att_cap]:
        souci("la capacite d'emprunt devrait valoir %d \u20ac (%d \u20ac \u00d7 %d %%, "
              "a %.2f %% sur %d ans, arrondi au millier), la page affiche %s"
              % (att_cap, revenus, endet * 100, taux_bas_pi * 100, annees,
                 m_c.group(1).strip() if m_c else 'rien'))

    # ---- 3. les quatre lignes de cout, leur total et les largeurs empilees
    interets = m_bas * mois - capital
    assurance = round(capital * assur * annees)
    garantie = round(capital * caution)
    total = interets + assurance + garantie + frais
    m_leg = re.search(r'<ul class="pi-c1-leg">(.*?)</ul>', sec, re.S)
    if not m_leg:
        souci("la legende des quatre lignes de cout (`.pi-c1-leg`) est introuvable")
    else:
        vus = _euros(m_leg.group(1))
        attendus = [interets, assurance, garantie, frais]
        if vus != attendus:
            souci("les quatre lignes de cout devraient etre %s, la page affiche %s "
                  "(interets = %d \u00d7 %d \u2212 %d ; assurance = %d \u00d7 %.2f %% \u00d7 %d ans ; "
                  "garantie = %d \u00d7 %.1f %%)"
                  % (attendus, vus, m_bas, mois, capital, capital, assur * 100,
                     annees, capital, caution * 100))
    m_note = re.search(r'<p class="pi-c1-note">(.*?)</p>', sec, re.S)
    if not m_note or total not in _euros(m_note.group(1)):
        souci("le cout total devrait valoir %d \u20ac (%d + %d + %d + %d) et n'est pas "
              "annonce sous la pile" % (total, interets, assurance, garantie, frais))

    m_pile = re.search(r'class="pi-c1-pile"(.*?)</div>', sec, re.S)
    if m_pile:
        larg = [float(x) for x in re.findall(r'--w:([\d.]+)%', m_pile.group(1))]
        att_l = [round(v / total * 100, 1) for v in (interets, assurance, garantie, frais)]
        if len(larg) != 4:
            souci("la pile du cout devrait avoir quatre segments, elle en a %d" % len(larg))
        elif any(abs(a - b) > 0.05 for a, b in zip(larg, att_l)):
            souci("les largeurs de la pile sont %s alors que les montants donnent %s : "
                  "l'image ne suit plus les chiffres" % (larg, att_l))
        # l'etiquette d'accessibilite redit les cinq montants : elle doit suivre
        m_aria = re.search(r'aria-label="([^"]*)"', m_pile.group(1))
        if m_aria:
            vus_aria = _euros(m_aria.group(1))
            att_aria = [total, interets, assurance, garantie, frais]
            if vus_aria != att_aria:
                souci("l'etiquette d'accessibilite de la pile annonce %s, les montants "
                      "sont %s : un lecteur d'ecran entendrait autre chose que ce qui "
                      "est affiche" % (vus_aria, att_aria))


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

    # =================================================================
    # L'ARTICLE DE CONSEILS, TROISIEME ENDROIT OU VIT CET EXEMPLE
    # -----------------------------------------------------------------
    # ⚠ IL REFAIT TOUT LE CALCUL A LA MAIN. « Le regroupement de credits est-il
    # une bonne idee ? » reecrit les trois mensualites, les trois capitaux,
    # leurs sommes, les frais, la mensualite regroupee, le cout total, le gain
    # mensuel — et il ajoute une comparaison « sans regroupement » avec ses
    # propres durees restantes, puis un SECOND exemple sans garantie. Une
    # vingtaine de montants qu'aucun controle ne tenait.
    #
    # Sans cela, le jour ou l'exemple change, les deux blocs de markup
    # arretent la construction et l'article continue d'annoncer les anciens
    # chiffres : un troisieme ecran qui contredit les deux autres.
    #
    # ⚠ AUCUN CHIFFRE DE L'ARTICLE N'EST RECOPIE ICI. Tout est recalcule depuis
    # `LIGNES_EXEMPLE`, le bareme, et les durees lues dans le texte. Un garde
    # qui porterait une copie des montants serait un deuxieme endroit a tenir a
    # jour, donc un deuxieme endroit qui ment.
    # =================================================================
    debut = source.find('id="page-conseils-regroupement-credits-bonne-idee"')
    if debut >= 0:          # absent avant sa publication : ce n'est pas un ecart
        fin = source.find('id="page-', debut + 10)
        art = source[debut:fin if fin > 0 else len(source)]

        def _n(x):
            return int(re.sub(r'[^0-9]', '', x))

        PRODUIT = (r'(\d[\d&nbsp;\u00a0 ]*)\s*(?:&nbsp;|\u00a0| )?€'
                   r'\s*×\s*(\d+)\s*=\s*(\d[\d&nbsp;\u00a0 ]*)\s*(?:&nbsp;|\u00a0| )?€')

        # --- 1. TOUTE EQUATION ECRITE DANS L'ARTICLE DOIT TOMBER JUSTE
        #     ⚠ ET C'EST LA LE VRAI CONTROLE, pas la presence des montants.
        #     Premiere version : je demandais « ce montant figure-t-il quelque
        #     part ? ». Fausser le gain mensuel dans la phrase passait au vert,
        #     parce que le bon chiffre restait dans l'encadre de resume — et le
        #     capital regroupe est cite quatre fois. Un montant juste ailleurs
        #     ne repare pas un montant faux ici.
        #
        #     L'article pose ses calculs en toutes lettres. On les recalcule :
        #     fausser un resultat casse son equation, fausser un operande casse
        #     la meme equation. Plus d'endroit ou se cacher. Et c'est durable :
        #     une reecriture avec plus ou moins de repetitions ne declenche rien,
        #     alors qu'un seuil d'occurrences aurait refuse une page juste.
        texte = art.replace('&nbsp;', '\u00a0').replace('&minus;', '−')

        # « 318 € × 48 = 15 264 € », « 795 € × 240 = 190 800 € »
        for brut_m, brut_mois, brut_tot in re.findall(PRODUIT, art):
            m, mois, tot = _n(brut_m), int(brut_mois), _n(brut_tot)
            if m * mois != tot:
                ecarts.append("l'article ecrit %d € × %d = %d €, soit %d € d'ecart"
                              % (m, mois, tot, tot - m * mois))

        # « 115 700 × 1,05 = 121 485 € » : un multiplicateur decimal
        NB = r'\d[\d\u00a0 ]*'
        for a, mult, r in re.findall(r'(%s)\s*×\s*(\d,\d+)\s*=\s*(%s)' % (NB, NB), texte):
            att = round(_n(a) * float(mult.replace(',', '.')))
            if _n(r) != att:
                ecarts.append("l'article ecrit %d × %s = %d, le calcul donne %d"
                              % (_n(a), mult, _n(r), att))

        # « 1 173 − 795 = 378 € » : la difference
        for a, b, r in re.findall(r'(%s)\s*−\s*(%s)\s*=\s*(%s)' % (NB, NB, NB), texte):
            if _n(a) - _n(b) != _n(r):
                ecarts.append("l'article ecrit %d − %d = %d, le calcul donne %d"
                              % (_n(a), _n(b), _n(r), _n(a) - _n(b)))

        # « 318 + 215 + 640 = 1 173 € » et « 14 200 + 9 500 + 92 000 = 115 700 € »
        for brut, r in re.findall(r'((?:%s)(?:\s*\+\s*%s)+)\s*=\s*(%s)' % (NB, NB, NB), texte):
            parts = [_n(x) for x in re.split(r'\s*\+\s*', brut)]
            if sum(parts) != _n(r):
                ecarts.append("l'article ecrit %s = %d, la somme fait %d"
                              % (' + '.join(str(p) for p in parts), _n(r), sum(parts)))

        # --- 2. les montants de l'exemple principal, recalcules
        for intitule, capital, mensu in LIGNES_EXEMPLE:
            if not present(art, mensu, '€'):
                ecarts.append("l'article n'affiche plus %d € pour le %s"
                              % (mensu, intitule))
            if not present(art, capital) and not present(art, capital, '€'):
                ecarts.append("l'article n'affiche plus le capital de %d € du %s"
                              % (capital, intitule))
        finance_art = round(CAPITAL_EXEMPLE + round(CAPITAL_EXEMPLE * frais_ex))
        gain = MENSU_AUJOURDHUI - attendu
        for valeur, quoi in ((MENSU_AUJOURDHUI, 'les mensualites actuelles'),
                             (CAPITAL_EXEMPLE, 'le capital regroupe'),
                             (finance_art, 'le montant a financer, frais compris'),
                             (attendu, 'la mensualite regroupee'),
                             (cout_total, 'le cout total'),
                             (gain, 'le gain mensuel')):
            if not present(art, valeur, '€') and not present(art, valeur):
                ecarts.append("l'article devrait annoncer %d € pour %s, recalcule "
                              "depuis le bareme, et ne l'affiche pas" % (valeur, quoi))
        if ('&minus;%d' % baisse) not in art and ('−%d' % baisse) not in art:
            ecarts.append("l'article n'annonce plus la baisse de %d %%" % baisse)
        if ('%d ans' % duree) not in art:
            ecarts.append("l'article n'annonce plus la duree de %d ans" % duree)

        # --- 3. la comparaison « sans regroupement », dans SA liste seulement
        #     ⚠ On ne cherche pas dans tout l'article : il porte un second
        #     exemple dont les produits n'ont rien a voir avec cette table.
        #     Premiere version du controle : six produits trouves la ou j'en
        #     attendais trois, et un faux ecart annonce.
        apres = art.find('Et sans regroupement')
        if apres < 0:
            ecarts.append("l'article ne compare plus le cout « sans regroupement » : "
                          "c'est la phrase qui dit que l'operation coute plus cher au "
                          "total, la page regroupement s'y engage")
        else:
            liste = art[apres:art.find('</ul>', apres) + 5]
            trois = re.findall(PRODUIT, liste)
            table = sorted(m for _, _, m in LIGNES_EXEMPLE)
            if sorted(_n(a) for a, _, _ in trois) != table:
                ecarts.append(
                    "l'article compare des mensualites qui ne sont plus celles de\n"
                    "     l'exemple : sa liste detaille %s, la table dit %s"
                    % (sorted(_n(a) for a, _, _ in trois), table))
            else:
                somme = sum(_n(a) * int(b) for a, b, _ in trois)
                if not present(art, somme, '€'):
                    ecarts.append("l'article devrait annoncer %d € de total restant a "
                                  "payer sans regroupement (somme de ses trois lignes)"
                                  % somme)
                if not present(art, abs(cout_total - somme), '€'):
                    ecarts.append("l'article devrait annoncer un ecart de %d € entre "
                                  "les %d € du regroupement et les %d € restants"
                                  % (abs(cout_total - somme), cout_total, somme))

        # --- 3 bis. L'ENCADRE DE RESUME, CASE PAR CASE
        #     ⚠ C'EST LA DERNIERE PANNE QUI PASSAIT. Fausser le gain mensuel
        #     dans cet encadre passait au vert : l'equation « 1 173 − 795 =
        #     378 » restait juste plus bas. Or l'encadre est ce que le lecteur
        #     presse retient, et le seul endroit ou les trois chiffres cles
        #     sont donnes SANS leur calcul — donc le plus visible et le moins
        #     rattrapable.
        #
        #     Ce n'est pas un comptage d'occurrences : l'encadre a un role
        #     defini — mensualites actuelles, mensualite regroupee, baisse et
        #     gain — et on verifie ce role, case par case.
        m_enc = re.search(r'<div class="pa-calcul">(.*?)</div>\s*</div>', art, re.S)
        if not m_enc:
            ecarts.append("l'encadre de resume de l'article (`.pa-calcul`) est "
                          "introuvable : il portait les trois chiffres cles")
        else:
            cases = re.findall(r'<b>(.*?)</b>\s*<span>(.*?)</span>', m_enc.group(0), re.S)
            if len(cases) != 3:
                ecarts.append("l'encadre de resume de l'article devrait porter trois "
                              "cases, il en a %d" % len(cases))
            else:
                (b1, _), (b2, _), (b3, s3) = cases
                if _n(b1) != MENSU_AUJOURDHUI:
                    ecarts.append("l'encadre de l'article annonce %d € de mensualites "
                                  "actuelles, l'exemple en compte %d"
                                  % (_n(b1), MENSU_AUJOURDHUI))
                if _n(b2) != attendu:
                    ecarts.append("l'encadre de l'article annonce %d € de mensualite "
                                  "regroupee, le bareme donne %d €" % (_n(b2), attendu))
                if _n(b3) != baisse:
                    ecarts.append("l'encadre de l'article annonce %d %% de baisse, "
                                  "le calcul donne %d %%" % (_n(b3), baisse))
                gain_enc = re.search(r'(\d[\d&nbsp;\u00a0 ]*)\s*(?:&nbsp;|\u00a0| )?€', s3)
                if not gain_enc:
                    ecarts.append("l'encadre de l'article n'annonce plus le gain "
                                  "mensuel en euros")
                elif _n(gain_enc.group(1)) != gain:
                    ecarts.append("l'encadre de l'article annonce %d € de gain mensuel, "
                                  "le calcul donne %d € (%d − %d)"
                                  % (_n(gain_enc.group(1)), gain,
                                     MENSU_AUJOURDHUI, attendu))

        # --- 4. les deux taux cites dans le texte
        #     Celui de l'exemple principal (hypothecaire) et celui du second
        #     exemple (sans garantie) sont les deux taux du moteur. Un taux
        #     recopie dans une phrase ne suit pas le bareme tout seul.
        for taux, nom_taux in ((taux_ex, 'hypothecaire'), (taux_bas, 'sans garantie')):
            ecrit = ('%.2f' % (taux * 100)).replace('.', ',')
            if ecrit not in art.replace('&nbsp;', ' '):
                ecarts.append("l'article ne cite plus le taux %s de %s %% du moteur"
                              % (nom_taux, ecrit))

    # =================================================================
    # « EN CHIFFRES » DE LA PAGE PRET IMMOBILIER (`.pi-c1`)
    # -----------------------------------------------------------------
    # Onze valeurs derivees, calculees par un script absent du depot. On les
    # recalcule a partir des hypotheses QUE LA PAGE ENONCE ELLE-MEME, sans
    # recopier une seule constante ici.
    # =================================================================
    _controler_chiffres_immo(source, ecarts)

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
