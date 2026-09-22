# Site de La Référence Courtage

Site de l'agence, en ligne sur **https://www.lareferencecourtage.fr**.

Agence de courtage indépendante à Nice, membre du réseau Pretto Galaxie.

## Comment c'est fait

Tout part d'un seul fichier : **`index.html`**. Les dix rubriques y sont des
`<article>` masqués qu'un peu de JavaScript montre à tour de rôle. C'est
pratique pour relire l'ensemble d'un coup, mais un moteur de recherche n'y
verrait qu'une seule adresse — impossible de se positionner sur « assurance
emprunteur Nice » plutôt que sur l'accueil.

**`generer-site.py`** en tire donc un vrai site : une page par rubrique, à sa
propre adresse, avec son titre et sa description. Le style, le script et les
images sont sortis dans `/assets`, téléchargés une fois et gardés en cache
d'une page à l'autre — sans quoi chaque page pèserait 620 Ko au lieu de 20.

```
index.html          la source, le seul fichier à modifier
generer-site.py     le générateur
extras/             recopié tel quel à la racine du site (icônes, CNAME,
                    vérification Google Search Console)
docs/               le site publiable — effacé et recréé à chaque génération,
                    ne rien y écrire à la main
```

## Publier une modification

```bash
python generer-site.py
git add -A
git commit -m "ce qui a changé"
git push
```

GitHub Pages sert le contenu de `docs/` sur la branche `main` ; la mise en
ligne suit le push d'une poignée de secondes.

## Ce qu'il faut savoir avant de toucher au code

- **Le titre et la description de chaque page** sont dans la table `PAGES` du
  générateur : c'est là qu'on retouche le référencement, pas dans le HTML.
- **Le style et le script sont nommés d'après l'empreinte de leur contenu**
  (`style.591160fe.css`). Sans cela, les visiteurs gardent l'ancienne version
  en cache après une mise à jour et voient un site à moitié cassé.
- **Tout nouveau bloc de script doit tolérer l'absence de ses éléments.** Les
  deux simulateurs vérifient l'existence de leurs champs avant de démarrer :
  en page unique cela ne changeait rien, en multipage celui de l'accueil
  plantait sur toutes les autres pages.
- **Les mentions légales** de `docs/mentions-legales/` sont en `noindex` et
  hors du sitemap, volontairement.

## La prise de rendez-vous

Le sélecteur de créneaux appelle un worker Cloudflare (code hors de ce dépôt)
qui lit l'agenda Google de l'agence, y crée l'événement et envoie les e-mails
de confirmation. Son adresse est dans la constante `RDV_API` d'`index.html`.
Si elle est vide, le formulaire retombe proprement sur « demande à confirmer ».
