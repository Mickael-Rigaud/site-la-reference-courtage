/* =====================================================================
   resultat-anime.js — l'anneau d'endettement de l'écran de résultat
   ---------------------------------------------------------------------
   Le simulateur affiche le taux d'endettement dans une carte, en texte.
   Ce script le remplace par un anneau qui se remplit, avec le repère des
   35 % — la limite que les banques regardent — tracé par-dessus.

   POURQUOI UN OBSERVATEUR, ET PAS UN APPEL DIRECT
   L'écran de résultat est fabriqué par le simulateur lui-même, à la fin
   du parcours, et il peut être redessiné (retour en arrière, mise à jour
   après un message). On surveille donc le conteneur plutôt que de
   s'accrocher à un instant précis — c'est la seule façon de ne pas
   dépendre de l'ordre interne du modèle, qu'une mise à jour de son code
   pourrait changer.

   ⚠ Ce script ne calcule rien. Le taux vient de `data-vers`, posé par le
   simulateur ; s'il manque, la carte reste telle quelle.
   ===================================================================== */
(function () {
  var RAYON = 54;                    // rayon de l'anneau, en unités SVG
  var CIRC = 2 * Math.PI * RAYON;    // sa circonférence : l'unité du tracé
  var PLAFOND = 35;                  // le repère réglementaire, en %

  function anneau(carte) {
    var n = carte.querySelector('.n[data-vers]');
    if (!n) return;
    var taux = Number(n.getAttribute('data-vers'));
    if (!isFinite(taux)) return;

    // ÉCHELLE : le tour complet vaut 60 %. Choisi pour que le repère des
    // 35 % tombe aux deux tiers et qu'un dossier au-dessus se voie
    // DÉPASSER, au lieu de saturer l'anneau. À 50 %, un dossier à 53 %
    // faisait un tour plein : plus rien ne distinguait 53 de 70.
    var part = Math.max(0, Math.min(1, taux / 60));
    var libelle = carte.querySelector('.l');
    var texte = libelle ? libelle.innerHTML : 'Taux d’endettement estimé';

    carte.classList.add('lrc-anneau');
    carte.innerHTML =
      '<div class="lrc-cercle" style="--circ:' + CIRC.toFixed(1) + ';--reste:'
        + (CIRC * (1 - part)).toFixed(1) + '">'
      +   '<svg viewBox="0 0 128 128" aria-hidden="true">'
      +     '<circle class="piste" cx="64" cy="64" r="' + RAYON + '"></circle>'
      +     '<circle class="trace" cx="64" cy="64" r="' + RAYON + '"></circle>'
      +     ligneSeuil()
      +   '</svg>'
      +   '<div class="valeur"><b>' + taux + ' %</b><span>endettement</span></div>'
      + '</div>'
      + '<div class="l">' + texte + '</div>'
      + '<div class="lrc-legende">Repère des banques : <b>' + PLAFOND + ' %</b></div>';

    // le remplissage part d'un cadre d'affichage plus tard : sans cela, la
    // valeur serait déjà posée au moment où le navigateur peint, et il n'y
    // aurait aucun mouvement à voir.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var c = carte.querySelector('.lrc-cercle');
        if (c) c.classList.add('anime');
      });
    });
  }

  /* Le trait du seuil, posé sur l'anneau à la hauteur des 35 %. */
  function ligneSeuil() {
    var angle = (PLAFOND / 60) * 2 * Math.PI;      // même échelle que le tracé
    var dedans = RAYON - 9, dehors = RAYON + 9;
    var x1 = 64 + dedans * Math.cos(angle), y1 = 64 + dedans * Math.sin(angle);
    var x2 = 64 + dehors * Math.cos(angle), y2 = 64 + dehors * Math.sin(angle);
    return '<line class="seuil" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1)
         + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"></line>';
  }

  function balayer() {
    var cartes = document.querySelectorAll('#stage .cards .card');
    for (var i = 0; i < cartes.length; i++) {
      var c = cartes[i];
      if (c.classList.contains('lrc-anneau')) continue;
      var n = c.querySelector('.n[data-unite]');
      if (n && String(n.getAttribute('data-unite')).indexOf('%') > -1) anneau(c);
    }
  }

  var stage = document.getElementById('stage');
  if (!stage) return;                 // la page n'est pas celle du simulateur
  new MutationObserver(balayer).observe(stage, { childList: true, subtree: true });
  balayer();
})();
