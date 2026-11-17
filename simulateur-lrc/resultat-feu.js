/* =====================================================================
   resultat-feu.js — un vrai feu tricolore pour annoncer le résultat
   ---------------------------------------------------------------------
   Le modèle annonce le verdict par une bille de couleur. Ici, un feu de
   carrefour : boîtier sombre, trois lampes, visières. Il s'allume comme
   un vrai — les trois feux défilent une fois, puis seule celle du
   verdict reste allumée, halo compris.

   D'OÙ VIENT LE VERDICT
   De la classe posée par le simulateur sur le conteneur du résultat :
   `.result.f-vert`, `.f-orange` ou `.f-rouge`. On ne recalcule rien, et
   si la classe manque, le feu ne s'affiche pas plutôt que de montrer une
   couleur inventée.

   ⚠ La séquence d'allumage est coupée pour qui a demandé moins
   d'animations : la bonne lampe est alors allumée d'emblée.
   ===================================================================== */
(function () {
  var COULEURS = { 'f-rouge': 'rouge', 'f-orange': 'orange', 'f-vert': 'vert' };
  var SOBRE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function couleurDu(resultat) {
    for (var c in COULEURS) if (resultat.classList.contains(c)) return COULEURS[c];
    return null;
  }

  function poser(verdict, resultat) {
    var couleur = couleurDu(resultat);
    if (!couleur) return;                       // pas de feu sans verdict
    var ancienne = verdict.querySelector('.gauge');
    if (!ancienne || verdict.querySelector('.lrc-feu')) return;

    var feu = document.createElement('div');
    feu.className = 'lrc-feu';
    feu.setAttribute('role', 'img');
    feu.setAttribute('aria-label', 'Feu ' + couleur);
    feu.innerHTML =
      '<div class="boitier">'
      + '<span class="lampe rouge"><i></i></span>'
      + '<span class="lampe orange"><i></i></span>'
      + '<span class="lampe vert"><i></i></span>'
      + '</div><span class="mat"></span>';
    ancienne.replaceWith(feu);

    if (SOBRE) { feu.classList.add('on-' + couleur); return; }

    /* La séquence : les trois lampes défilent comme à un carrefour, puis
       le feu s'arrête sur la bonne. Les durées sont courtes — personne
       n'attend devant son écran —, mais suffisantes pour qu'on lise le
       mouvement et qu'on comprenne ce qu'on regarde. */
    var temps = [[180, 'rouge'], [520, 'orange'], [860, 'vert'], [1240, couleur]];
    temps.forEach(function (etape) {
      setTimeout(function () {
        feu.className = 'lrc-feu on-' + etape[1];
        if (etape[1] === couleur && etape[0] === 1240) feu.classList.add('fixe');
      }, etape[0]);
    });
  }

  /* ------------------------------------------------------------------
     LES TROIS CHIFFRES — une icône, et une barre pour l'endettement.
     ⚠ On ne touche PAS au contenu de `.n` : le modèle y anime déjà la
     montée du chiffre depuis zéro. Tout ce qui est ajouté ici se pose
     AUTOUR, sinon les deux animations se marcheraient dessus.
     ------------------------------------------------------------------ */
  var PLAFOND_TAUX = 35;     // le repère que regardent les banques
  var ICONES = {
    euro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
        + 'stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h11M4 14h9"/>'
        + '<path d="M19.5 6.2A7.7 7.7 0 0 0 14 4a8 8 0 0 0 0 16 7.7 7.7 0 0 0 5.5-2.2"/></svg>',
    jauge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
        + 'stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 18a9 9 0 1 1 17 0"/>'
        + '<path d="m12 14 4-4"/><circle cx="12" cy="14" r="1.6"/></svg>',
    calendrier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" '
        + 'stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.2"/>'
        + '<path d="M3.5 10h17M8 3v4M16 3v4"/></svg>'
  };

  function garnirChiffres(resultat) {
    var cartes = resultat.querySelectorAll('.cards .card');
    for (var i = 0; i < cartes.length; i++) {
      var carte = cartes[i];
      if (carte.querySelector('.lrc-ico')) continue;
      var n = carte.querySelector('.n[data-unite]');
      var unite = n ? String(n.getAttribute('data-unite')) : '';
      var pourcent = unite.indexOf('%') > -1;

      var ico = document.createElement('span');
      ico.className = 'lrc-ico';
      ico.innerHTML = pourcent ? ICONES.jauge : (i === 0 ? ICONES.euro : ICONES.calendrier);
      carte.insertBefore(ico, carte.firstChild);

      if (!pourcent || !n) continue;
      var taux = Number(n.getAttribute('data-vers'));
      if (!isFinite(taux)) continue;
      // l'échelle monte à 60 % : un dossier au-dessus du repère se voit
      // DÉPASSER, au lieu de buter contre le bord de la barre.
      var part = Math.max(0, Math.min(1, taux / 60));
      var barre = document.createElement('div');
      barre.className = 'lrc-barre';
      barre.innerHTML = '<i></i><span class="repere" style="left:'
        + ((PLAFOND_TAUX / 60) * 100).toFixed(1) + '%"></span>'
        + '<b class="repere-txt" style="left:' + ((PLAFOND_TAUX / 60) * 100).toFixed(1) + '%">'
        + PLAFOND_TAUX + ' %</b>';
      carte.appendChild(barre);
      (function (b, p) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            b.querySelector('i').style.width = (p * 100).toFixed(1) + '%';
            b.classList.add('anime');
          });
        });
      })(barre, part);
    }
  }

  /* ------------------------------------------------------------------
     LE FEU VERT SE FÊTE. Une poignée de confettis tombe une fois, puis
     disparaît — uniquement au feu vert, et jamais si le visiteur a
     demandé moins d'animations. Sur orange ou rouge, ce serait déplacé.
     ------------------------------------------------------------------ */
  function confettis(hote) {
    if (SOBRE || hote.querySelector('.lrc-confettis')) return;
    var boite = document.createElement('div');
    boite.className = 'lrc-confettis';
    boite.setAttribute('aria-hidden', 'true');
    var tons = ['#F4801C', '#FFC93C', '#1FA75A', '#0FA3C4', '#FFA43D'];
    var html = '';
    for (var i = 0; i < 26; i++) {
      html += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;'
            + 'background:' + tons[i % tons.length] + ';'
            + 'animation-delay:' + (Math.random() * 0.5).toFixed(2) + 's;'
            + 'animation-duration:' + (1.6 + Math.random() * 1.1).toFixed(2) + 's;'
            + 'transform:rotate(' + Math.round(Math.random() * 360) + 'deg)"></i>';
    }
    boite.innerHTML = html;
    hote.appendChild(boite);
    setTimeout(function () { boite.remove(); }, 3200);
  }

  function balayer() {
    var resultat = document.querySelector('#stage .result');
    var verdict = resultat && resultat.querySelector('.verdict');
    if (!verdict) return;
    poser(verdict, resultat);
    garnirChiffres(resultat);
    if (resultat.classList.contains('f-vert')) setTimeout(function () { confettis(verdict); }, 1200);
  }

  /* ------------------------------------------------------------------
     La valeur en cours des écrans de montant (« ≈ 250 000 € ») change à
     chaque clic sur une tranche. Sans rien, elle se remplace en silence
     et on ne voit pas que son choix a été pris en compte : on lui fait
     marquer le coup, brièvement.
     ------------------------------------------------------------------ */
  var SOBRE_VAL = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var suivie = null;
  function suivreValeur() {
    var v = document.getElementById('affval');
    if (!v || v === suivie || SOBRE_VAL) return;
    suivie = v;
    new MutationObserver(function () {
      v.classList.remove('bouge');
      void v.offsetWidth;            // force le navigateur à rejouer l'animation
      v.classList.add('bouge');
    }).observe(v, { childList: true, characterData: true, subtree: true });
  }

  var stage = document.getElementById('stage');
  if (!stage) return;
  new MutationObserver(function () { balayer(); suivreValeur(); })
    .observe(stage, { childList: true, subtree: true });
  balayer();
  suivreValeur();
})();
