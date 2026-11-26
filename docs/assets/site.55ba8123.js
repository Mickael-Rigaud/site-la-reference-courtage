
/* Mesure d'audience sans cookie (12/10/2026).
   Envoie au CRM du groupe la page, la provenance et le type d'écran, et rien
   d'autre : aucun cookie, rien d'enregistré sur l'appareil, aucun identifiant.
   Une « visite » est une arrivée depuis l'extérieur du site. Posé en tête du
   script pour qu'une erreur plus bas ne l'empêche jamais de partir. */
(function () {
  try {
    var hote = location.hostname.replace(/^www\./, "");
    if (hote !== "lareferencecourtage.fr" || navigator.webdriver || !navigator.sendBeacon) return;
    var ref = "";
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch (e) { ref = ""; }
    var interne = ref === hote;
    var utm = "";
    try { utm = new URLSearchParams(location.search).get("utm_source") || ""; } catch (e) { utm = ""; }
    var l = window.innerWidth || 1200;
    navigator.sendBeacon("https://qnidmkufauzguultdmky.supabase.co/functions/v1/site-visite",
      new Blob([JSON.stringify({
        s: hote, p: location.pathname, r: interne ? "" : ref, u: utm, e: !interne,
        a: l < 768 ? "mobile" : (l < 1100 ? "tablette" : "ordinateur")
      })], { type: "text/plain" }));
  } catch (e) { /* une mesure perdue ne doit jamais gêner la page */ }
})();

  // Chaque rubrique est une page à part entière : plus rien à afficher ou
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

  document.querySelector('.burger').addEventListener('click', function() {
    const open = document.getElementById('nav-links').classList.toggle('open');
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  // Le site n'a qu'une seule tenue : celle du plein soleil.
  // On neutralise le thème sombre que l'hôte ou l'OS pourrait imposer
  // aux champs de formulaire et aux barres de défilement.
  const root = document.documentElement;
  const forceLight = () => {
    if (root.style.colorScheme !== 'light') root.style.colorScheme = 'light';
  };
  forceLight();
  new MutationObserver(forceLight).observe(root, { attributes: true, attributeFilter: ['style', 'data-theme'] });

  // ---------- Candidature ----------
  (() => {
    // deux formulaires, le même traitement : celui des courtiers et celui
    // des apporteurs d'affaires. Les champs se repèrent par leur suffixe.
    document.querySelectorAll('form.job-form').forEach(form => {
      const champ = (nom) => form.querySelector('[id$="-' + nom + '"]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statut = form.querySelector('.job-status');
        const piege = champ('piege').value;
        if (piege) return;
        const prenom = champ('prenom').value.trim();
        const nom = champ('nom').value.trim();
        const tel = champ('tel').value.trim();
        const email = champ('email').value.trim();
        const profil = champ('profil').value;
        const mot = champ('mot').value.trim();
        /* ⚠ CE CHAMP N'EXISTE QUE SUR UN DES DEUX FORMULAIRES. Le traitement
           est partagé ; celui des courtiers n'a pas d'enseigne à donner. */
        const cabinet = (champ('cabinet')?.value || '').trim();

        if (!prenom || !tel) {
          statut.textContent = MSG_TEL_CANDIDAT;
          return;
        }
        if (!estEmail(email)) {
          statut.textContent = MSG_EMAIL_CANDIDAT;
          return;
        }
        if (!consentementDonne(form)) { statut.textContent = MSG_RGPD; return; }

        const bouton = form.querySelector('button[type="submit"]');
        if (RDV_API) {
          statut.textContent = 'Envoi…';
          bouton.disabled = true;
          try {
            await fetch(RDV_API + '/candidature', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              /* ⚠ `origine` DIT LEQUEL DES DEUX FORMULAIRES PARLE, et ce n'est
                 pas un détail : le serveur en déduit le mail envoyé ET s'il
                 faut créer une fiche dans le répertoire des apporteurs. Avant
                 le 19/11/2026 il le devinait en cherchant « apporteur » dans
                 l'activité choisie — aucune des six n'y correspondait, et tous
                 les apporteurs recevaient le mail des courtiers. */
              body: JSON.stringify({ prenom, nom, cabinet, telephone: tel, email, profil, message: mot, piege,
                origine: form.id === 'part-form' ? 'partenaire' : 'recrutement',
                consentement: traceConsentement(form) }),
            });
          } catch (err) {
            // le formulaire reste utile même si le service ne répond pas
          }
          bouton.disabled = false;
        }

        statut.textContent = 'Merci ' + prenom + ', votre demande est enregistrée. '
          + 'Un accusé de réception part vers ' + email + ', et nous vous rappelons sous 48 h ouvrées.';
        form.reset();
      });
    });
  })();

  // ---------- Le menu s'efface au-dessus du hero ----------
  const navEl = document.querySelector('.nav');
  const setNavHeight = () => {
    document.documentElement.style.setProperty('--nav-h', navEl.offsetHeight + 'px');
  };
  const syncNav = () => {
    const surAccueil = !!document.getElementById('page-accueil');
    document.documentElement.classList.toggle('nav-over', surAccueil && window.scrollY < 40);
  };
  setNavHeight();
  syncNav();
  window.addEventListener('resize', () => { setNavHeight(); syncNav(); });
  window.addEventListener('scroll', syncNav, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setNavHeight);

  // ---------- Le fil de la frise se dessine ----------
  const frise = document.querySelector('.process');
  if (frise) {
    if ('IntersectionObserver' in window) {
      const fo = new IntersectionObserver((es, obs) => {
        es.forEach(e => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-drawn');
          obs.unobserve(e.target);
        });
      }, { threshold: 0.25 });
      fo.observe(frise);
      setTimeout(() => frise.classList.add('is-drawn'), 2500);
    } else {
      frise.classList.add('is-drawn');
    }
  }

  // ---------- Arrivées au défilement ----------
  const risers = document.querySelectorAll('.rise');
  const revealAll = () => risers.forEach(el => el.classList.add('is-in'));
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('reveal');
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const siblings = [...entry.target.parentElement.children].filter(el => el.classList.contains('rise'));
        entry.target.style.transitionDelay = Math.min(siblings.indexOf(entry.target), 6) * 70 + 'ms';
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    risers.forEach(el => io.observe(el));
    // filet de sécurité : si l'observateur reste muet (onglet ouvert en arrière-plan,
    // rendu suspendu), on montre tout au bout de deux secondes et demie.
    setTimeout(revealAll, 2500);
  }

  // Adresse du worker Cloudflare : agenda Google et envoi des e-mails.
  // Chaîne vide : les formulaires fonctionnent seuls, sans vérifier les
  // disponibilités, sans créer d’événement et sans rien envoyer.
  const RDV_API = 'https://rdv-la-reference-courtage.lareferencecourtage.workers.dev';

  // une adresse est demandée dans les deux formulaires : c’est par là que
  // partent la confirmation du rendez-vous et l’accusé de candidature
  const estEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
  const MSG_EMAIL_RDV = 'Merci d’indiquer une adresse e-mail valide : c’est là que part votre confirmation.';
  const MSG_EMAIL_CANDIDAT = 'Merci d’indiquer une adresse e-mail valide : c’est là que part notre réponse.';
  const MSG_TEL_CANDIDAT = 'Merci d’indiquer votre prénom et votre téléphone.';
  const MSG_RGPD = 'Merci de cocher la case : sans votre accord, '
    + 'nous ne pouvons pas traiter votre demande.';

  /* ⚠ LES TROIS FORMULAIRES SONT EN `novalidate` : le navigateur ne vérifie
     aucun `required`. C'est donc ici — et nulle part ailleurs — que l'envoi
     est retenu tant que la case n'est pas cochée. */
  function consentementDonne(form) {
    const boite = form.querySelector('.form-consent');
    const coche = form.querySelector('input[id$="-rgpd"]');
    if (!coche || coche.checked) { if (boite) boite.classList.remove('manque'); return true; }
    /* On désigne la case elle-même : un message sous le bouton laisse le
       visiteur chercher ce qui manque, surtout sur un téléphone où la case
       est hors de l'écran. */
    if (boite) {
      boite.classList.add('manque');
      boite.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    coche.focus({ preventScroll: true });
    return false;
  }
  /* Ce qui part au serveur avec la demande. Un consentement réduit à `true`
     ne prouve rien : il faut savoir à QUOI la personne a consenti, et QUAND.
     Le libellé est relu dans la page — pas recopié ici — pour qu'il ne
     puisse pas diverger de ce qu'elle avait sous les yeux. */
  function traceConsentement(form) {
    const etiquette = form.querySelector('.form-consent label');
    return {
      donne: true,
      date: new Date().toISOString(),
      texte: etiquette ? etiquette.textContent.replace(/\s+/g, ' ').trim() : '',
    };
  }

  /* La mise en avant s'efface dès que le visiteur coche, sans attendre un
     deuxième envoi. */
  document.addEventListener('change', (e) => {
    const c = e.target;
    if (c && c.matches && c.matches('input[id$="-rgpd"]') && c.checked) {
      const b = c.closest('.form-consent');
      if (b) b.classList.remove('manque');
    }
  });

  // ---------- Prise de rendez-vous ----------
  (() => {

    const modesEl = document.getElementById('rdv-modes');
    if (!modesEl) return;
    const daysEl = document.getElementById('rdv-days');
    const slotsEl = document.getElementById('rdv-slots');
    const monthEl = document.getElementById('rdv-month');
    const prevBtn = document.getElementById('rdv-prev');
    const nextBtn = document.getElementById('rdv-next');
    const form = document.getElementById('rdv-form');
    const statusEl = document.getElementById('rdv-status');
    const panel = document.getElementById('rdv-panel');
    const done = document.getElementById('rdv-done');

    const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
    const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
                  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    const SEMAINES_MAX = 8;

    const auMatin = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const memeJour = (a, b) => a && b && a.toDateString() === b.toDateString();
    const enISO = d => d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    let debut = plusJours(auMatin(new Date()), 1);
    while (debut.getDay() === 0 || debut.getDay() === 6) debut = plusJours(debut, 1);
    const premier = new Date(debut);
    let offset = 0;

    const etat = { mode: 'Téléphone', duree: '20 min', minutes: 20, jour: null, heure: null };
    let occupes = [];          // périodes prises, renvoyées par l'agenda
    let agendaBranche = false; // le worker a-t-il répondu au moins une fois ?
    let chargement = false;

    // les rendez-vous se prennent du lundi au vendredi, à six horaires fixes
    const HORAIRES = [750, 810, 870, 930, 990, 1050];   // 12 h 30 → 17 h 30
    function creneaux(d) {
      const jour = d.getDay();
      return (jour === 0 || jour === 6) ? [] : HORAIRES.slice();
    }
    const enHeure = m => String(Math.floor(m / 60)).padStart(2, '0') + ' h' +
                          (m % 60 ? ' ' + String(m % 60).padStart(2, '0') : '');

    /** Le créneau chevauche-t-il une période déjà occupée ? */
    function estPris(jour, minutes) {
      if (!agendaBranche) return false;
      const d = new Date(jour); d.setHours(0, minutes, 0, 0);
      const f = new Date(d.getTime() + etat.minutes * 60000);
      return occupes.some(p => new Date(p.debut) < f && new Date(p.fin) > d);
    }

    async function chargeDisponibilites() {
      if (!RDV_API) return;
      const base = plusJours(premier, offset * 7);
      chargement = true;
      dessineCreneaux();
      try {
        const rep = await fetch(RDV_API + '/disponibilites?du=' + enISO(base) +
                                '&au=' + enISO(plusJours(base, 6)));
        if (!rep.ok) throw new Error(rep.status);
        const data = await rep.json();
        occupes = data.occupes || [];
        agendaBranche = true;
        // l'agenda répond : le créneau choisi est réservé pour de bon
        const lib = document.getElementById('rdv-libelle');
        const note = document.getElementById('rdv-note');
        if (lib) lib.textContent = 'Confirmer mon rendez-vous';
        if (note) note.textContent = 'Le rendez-vous est enregistré dans notre agenda dès la validation. '
          + 'Aucun engagement, aucun frais.';
      } catch (e) {
        // agenda injoignable : on garde le mode « demande à confirmer »
        occupes = [];
        agendaBranche = false;
      } finally {
        chargement = false;
        dessineCreneaux();
      }
    }

    function dessineJours() {
      daysEl.innerHTML = '';
      const base = plusJours(premier, offset * 7);
      const mois = new Set();
      for (let i = 0; i < 7; i++) {
        const d = plusJours(base, i);
        mois.add(MOIS[d.getMonth()] + ' ' + d.getFullYear());
        const b = document.createElement('button');
        b.type = 'button';
        const weekend = d.getDay() === 0 || d.getDay() === 6;
        /* La classe ne sert qu'a l'ecran du telephone, ou ces deux pastilles
           grises mangeaient un tiers de la largeur sans rien offrir. */
        b.className = weekend ? 'rdv-day rdv-day-we' : 'rdv-day';
        b.disabled = weekend;
        b.setAttribute('aria-pressed', memeJour(d, etat.jour) ? 'true' : 'false');
        b.innerHTML = '<span class="d-dow">' + JOURS[d.getDay()] + '</span>' +
                      '<span class="d-num">' + d.getDate() + '</span>' +
                      '<span class="d-mon">' + MOIS[d.getMonth()] + '</span>';
        b.addEventListener('click', () => {
          etat.jour = d; etat.heure = null;
          dessineJours(); dessineCreneaux(); majRecap();
        });
        daysEl.appendChild(b);
      }
      monthEl.textContent = [...mois].join(' — ');
      prevBtn.disabled = offset === 0;
      nextBtn.disabled = offset >= SEMAINES_MAX - 1;
    }

    function dessineCreneaux() {
      slotsEl.innerHTML = '';
      if (!etat.jour) {
        slotsEl.innerHTML = '<p class="rdv-slots-empty">Choisissez d\'abord un jour ci-dessus.</p>';
        return;
      }
      if (chargement) {
        slotsEl.innerHTML = '<p class="rdv-loading">Consultation de l\'agenda…</p>';
        return;
      }
      const liste = creneaux(etat.jour);
      if (!liste.length) {
        slotsEl.innerHTML = '<p class="rdv-slots-empty">Aucun créneau ce jour-là. Choisissez un jour de semaine.</p>';
        return;
      }
      let libres = 0;
      liste.forEach(m => {
        const pris = estPris(etat.jour, m);
        if (!pris) libres++;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rdv-slot';
        b.textContent = enHeure(m);
        b.disabled = pris;
        if (pris) b.title = 'Créneau déjà réservé';
        b.setAttribute('aria-pressed', etat.heure === m ? 'true' : 'false');
        b.addEventListener('click', () => { etat.heure = m; dessineCreneaux(); majRecap(); });
        slotsEl.appendChild(b);
      });
      if (!libres) {
        const p = document.createElement('p');
        p.className = 'rdv-slots-empty';
        p.textContent = 'Journée complète. Essayez un autre jour.';
        slotsEl.appendChild(p);
      }
    }

    const dateLongue = d =>
      d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    const ICONES = {
      Visio: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<polygon points="23 7 16 12 23 17 23 7"/>'
        + '<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
      'Téléphone': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    };
    function majRecap() {
      document.getElementById('r-mode').textContent =
        (etat.mode === 'Visio' ? 'En visio' : 'Par téléphone') + ' · ' + etat.duree;
      document.getElementById('r-mode-ico').innerHTML = ICONES[etat.mode];
      const dEl = document.getElementById('r-date');
      const hEl = document.getElementById('r-heure');
      if (etat.jour) { dEl.textContent = dateLongue(etat.jour); dEl.classList.remove('todo-val'); }
      else { dEl.textContent = 'Choisissez un jour'; dEl.classList.add('todo-val'); }
      if (etat.heure !== null) { hEl.textContent = enHeure(etat.heure); hEl.classList.remove('todo-val'); }
      else { hEl.textContent = 'Choisissez un horaire'; hEl.classList.add('todo-val'); }
    }

    const montantEl = document.getElementById('r-montant');
    montantEl.addEventListener('input', () => {
      const chiffres = montantEl.value.replace(/[^\d]/g, '');
      montantEl.value = chiffres
        ? Number(chiffres).toLocaleString('fr-FR').replace(/\s/g, ' ') + ' €'
        : '';
    });

    /* ⚠ L’ÉTIQUETTE DU MONTANT SUIT LE PROJET, ET LE CHAMP N’EXISTE PAS
       TANT QU’AUCUN PROJET N’EST CHOISI (25/11/2026, Mickael : « adapte
       l’étiquette du montant au projet », et « si c’est un regroupement de
       crédits on ne demande pas le montant »).
       Un seul champ posait en réalité sept questions différentes : 250 000 €
       sont un prix de bien pour un achat, un capital restant dû pour une
       rénégociation, un capital assuré pour une assurance emprunteur. Le
       visiteur devait deviner lequel on attendait de lui. Maintenant que le
       projet est demandé avant, on peut le lui dire.
       ⚠ POUR UN REGROUPEMENT, IL N’Y A PAS D’ÉTIQUETTE QUI MARCHE : le
       chiffre utile n’est pas une somme globale mais la liste des crédits,
       que le simulateur recueille ligne par ligne juste après. Le champ
       disparaît, au lieu de réclamer un total que personne ne sait de tête
       avant d’avoir obtenu son créneau.
       ⚠ ON TESTE LE MOT, PAS LE LIBELLÉ EXACT, comme pour le choix du
       simulateur plus bas : la liste des projets peut être reformulée un
       jour. Une table indexée sur le libellé exact rendrait alors la
       mauvaise étiquette sans qu’aucune erreur ne le signale — ici, au
       pire, on retombe sur le mot neutre « Montant ».
       ⚠ L’ORDRE DE CETTE LISTE COMPTE : le premier motif qui reconnaît le
       projet gagne. « Construction / VEFA » doit être vu avant le motif des
       achats, sans quoi un terrain à bâtir s’annoncerait comme un prix de
       bien déjà construit. */
    const MONTANT_SELON_PROJET = [
      [/regroupement/i,            null,                  null],
      [/assurance/i,               'Capital assuré',      '250 000 €'],
      [/négociation|negociation/i,  'Capital restant dû',  '180 000 €'],
      [/construction|vefa/i,       'Budget total du projet', '320 000 €'],
      [/professionnel/i,           'Montant recherché',    '120 000 €'],
      [/achat|locatif|résidence|residence/i, 'Prix du bien', '250 000 €'],
    ];
    const projetEl = document.getElementById('r-projet');
    const ligneMontant = document.getElementById('r-ligne-montant');
    const etiquetteMontant = document.querySelector('#r-champ-montant label');

    function montantSelonProjet() {
      const choix = projetEl.value || '';
      const regle = choix ? MONTANT_SELON_PROJET.find((r) => r[0].test(choix)) : null;
      /* Pas encore de projet choisi, ou un projet qui n’appelle pas de
         montant : dans les deux cas le champ n’a rien à demander. */
      /* ⚠ LE BOOLÉEN DOIT EN ÊTRE UN. « Autre projet » ne figure dans
         aucun motif : `regle` vaut alors `undefined`, et
         `classList.toggle(nom, undefined)` IGNORE le second argument et
         bascule la classe au lieu de la poser. Le champ disparaissait
         donc une fois sur deux, selon le projet précédemment choisi.
         Vu en essayant les neuf projets un par un, pas à la lecture. */
      const sansMontant = !choix || !!(regle && regle[1] === null);
      ligneMontant.classList.toggle('sans-montant', sansMontant);
      if (!sansMontant) {
        etiquetteMontant.textContent = regle ? regle[1] : 'Montant';
        montantEl.placeholder = regle ? regle[2] : '250 000 €';
      }
      /* ⚠ ON VIDE LE CHAMP, ON NE FAIT PAS QUE LE CACHER. Un montant tapé
         avant de changer de projet partirait quand même au serveur, et la
         fiche porterait un chiffre que le visiteur a cessé de vouloir
         donner — sans que rien ne le signale, puisque le champ n’est plus
         à l’écran pour le démentir. */
      if (sansMontant && montantEl.value) montantEl.value = '';
      /* Hors du parcours au clavier tant qu’il est masqué. */
      montantEl.disabled = sansMontant;
    }
    projetEl.addEventListener('change', montantSelonProjet);
    montantSelonProjet();   /* et au chargement, si le navigateur a restauré un choix */

    modesEl.addEventListener('click', e => {
      const b = e.target.closest('.rdv-mode');
      if (!b) return;
      [...modesEl.querySelectorAll('.rdv-mode')].forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      etat.mode = b.dataset.mode;
      etat.duree = b.dataset.duree;
      etat.minutes = parseInt(b.dataset.duree, 10);
      dessineCreneaux();
      majRecap();
    });
    prevBtn.addEventListener('click', () => {
      if (offset > 0) { offset--; dessineJours(); chargeDisponibilites(); }
    });
    nextBtn.addEventListener('click', () => {
      if (offset < SEMAINES_MAX - 1) { offset++; dessineJours(); chargeDisponibilites(); }
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nom = document.getElementById('r-nom').value.trim();
      const tel = document.getElementById('r-tel').value.trim();
      const email = document.getElementById('r-email').value.trim();
      const projet = document.getElementById('r-projet').value;
      const montant = document.getElementById('r-montant').value.trim();
      const ville = document.getElementById('r-ville').value.trim();
      const mot = document.getElementById('r-mot').value.trim();
      const piege = document.getElementById('r-piege').value;

      if (!etat.jour || etat.heure === null) { statusEl.textContent = 'Choisissez un jour et un horaire.'; return; }
      if (!nom || !tel) { statusEl.textContent = 'Merci d\'indiquer votre nom et votre téléphone.'; return; }
      if (!estEmail(email)) {
        statusEl.textContent = MSG_EMAIL_RDV;
        return;
      }
      /* ⚠ LE PROJET EST OBLIGATOIRE DEPUIS QU’IL N’EST PLUS PRÉ-COCHÉ
         (25/11/2026). Sans ce contrôle, retirer le pré-rempli aurait
         seulement remplacé un projet faux par un projet vide — et le
         visiteur serait reparti vers le simulateur d’achat par défaut,
         quel que soit son besoin. */
      if (!projet) { statusEl.textContent = 'Merci de choisir votre projet.'; projetEl.focus(); return; }
      if (!consentementDonne(form)) { statusEl.textContent = MSG_RGPD; return; }

      const bouton = form.querySelector('button[type="submit"]');
      let confirme = false;

      if (RDV_API) {
        statusEl.textContent = 'Enregistrement…';
        bouton.disabled = true;
        try {
          const rep = await fetch(RDV_API + '/reserver', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              date: enISO(etat.jour), minutes: etat.heure, mode: etat.mode,
              nom, telephone: tel, email, projet, montant, ville, message: mot, piege,
              consentement: traceConsentement(form),
            }),
          });
          const data = await rep.json().catch(() => ({}));
          if (rep.status === 409) {
            statusEl.textContent = 'Ce créneau vient d\'être réservé. Choisissez-en un autre.';
            bouton.disabled = false;
            etat.heure = null;
            await chargeDisponibilites();
            majRecap();
            return;
          }
          confirme = rep.ok && data.ok === true;
        } catch (err) {
          confirme = false;   // on bascule sur la demande à confirmer
        }
        bouton.disabled = false;
      }

      statusEl.textContent = '';
      document.getElementById('d-slot').textContent =
        dateLongue(etat.jour) + ' à ' + enHeure(etat.heure);
      document.querySelector('#rdv-done h3').textContent =
        confirme ? 'Rendez-vous confirmé' : 'Demande envoyée';
      document.getElementById('d-msg').textContent = confirme
        ? 'Merci ' + nom.split(' ')[0] + '. Le rendez-vous est enregistré : nous vous appelons au '
          + tel + ' à cet horaire. Un e-mail de confirmation vient de partir vers ' + email + '.'
        : 'Merci ' + nom.split(' ')[0] + '. Nous vous rappelons au ' + tel
          + ' sous 24 h ouvrées pour confirmer ce créneau.';
      /* ⚠ PLUS RIEN DANS L'ADRESSE (19/11/2026, Mickael : « oui fais le
         jeton »). Les coordonnées partaient jusqu'ici en paramètres
         (?prenom=&nom=&email=). Une adresse se retrouve dans l'historique du
         navigateur et dans les journaux de l'hébergeur, et un lien se
         transfère. Ici le navigateur a DÉJÀ les réponses sous la main — il
         vient de les recueillir : il les range dans `sessionStorage`, qui ne
         quitte ni l'onglet ni l'appareil, et l'adresse ne porte plus que
         `?prepa=1`.
         ⚠ C'EST LE MÊME RANGEMENT QUE CELUI DE LA PAGE /preparer/, qui fait
         ce travail pour qui revient plus tard par le lien du mail. Le
         simulateur n'a ainsi qu'une seule façon de retrouver ces réponses —
         la même clé, la même forme — au lieu de deux chemins qui dérivent.
         ⚠ ET TOUJOURS PAS L'IDENTIFIANT DU DOSSIER : les coordonnées
         suffisent, le serveur retrouve le dossier ouvert par le même
         rapprochement qu'ailleurs — moyen de contact ET nom — et complète
         celui-là au lieu d'en créer un second. */
      const morceaux = nom.trim().split(/\s+/);
      const prepa = document.getElementById('d-prepa');
      const reponses = {};
      if (morceaux.length > 1) { reponses.prenom = morceaux[0]; reponses.nom = morceaux.slice(1).join(' '); }
      else if (morceaux[0]) { reponses.nom = morceaux[0]; }
      if (email) reponses.email = email;
      /* ⚠ PAS LE TÉLÉPHONE. Retiré le 19/11/2026 : il ne sert à rien ici —
         c'est l'adresse e-mail qui fait sauter l'écran des coordonnées, et
         c'est elle, avec le nom, qui permet au serveur de rattacher les
         réponses au bon dossier. Le numéro est déjà sur la fiche, saisi à la
         réservation : le redonner n'ajouterait rien et l'exposerait. */
      /* Ce qu'il vient de saisir sur le projet suit aussi : le simulateur
         ouvre alors ses écrans « Quel est votre projet ? » et « Le budget de
         votre projet » DÉJÀ RÉPONDUS (19/11/2026, Mickael : « si des
         informations ont déjà été remplies avant par le prospect […] que ce
         soit déjà rempli »).
         ⚠ Les écrans ne sont pas sautés pour autant : le budget donné ici est
         approximatif, et c'est justement l'occasion de le préciser. */
      if (projet) reponses.projet = projet;
      if (montant) reponses.budget = montant;
      /* La confirmation voyage avec : elle s'affiche en tête du questionnaire,
         pour que le visiteur voie son créneau acquis avant qu'on lui demande
         autre chose. */
      reponses.quand = dateLongue(etat.jour) + ' à ' + enHeure(etat.heure);
      /* ⚠ UN STOCKAGE REFUSÉ NE DOIT RIEN CASSER (navigation privée, réglages
         restrictifs) : le questionnaire s'ouvrira simplement vierge. */
      try { sessionStorage.setItem('lrc-preparation', JSON.stringify(reponses)); } catch (e) {}

      /* ⚠ LE SIMULATEUR SUIT LE PROJET DÉCLARÉ (25/11/2026, Mickael :
         « quand on prend rendez-vous pour le projet regroupement de
         crédits […] je veux le bon simulateur »).
         Jusqu'ici tout le monde partait sur `/simulateur/`, qui calcule
         une faisabilité d'ACHAT immobilier : à quelqu'un venu alléger
         ses mensualités, il demandait le prix du bien et la ville du
         projet. Rien ne cassait — c'était simplement la mauvaise
         question, posée juste après avoir obtenu son créneau.
         ⚠ ON TESTE LE MOT, PAS LE LIBELLÉ EXACT : la liste des projets
         peut être reformulée un jour, et un test d'égalité stricte
         renverrait alors tout le monde sur le simulateur d'achat sans
         qu'aucune erreur ne le signale.
         ⚠ LA MÊME RÈGLE EST ÉCRITE DANS `extras/preparer/index.html`,
         qui fait ce travail pour qui revient par le lien du mail. Les
         deux doivent changer ensemble. */
      const versRegroupement = /regroupement/i.test(projet || '');
      const cibleSimulateur = versRegroupement
        ? '/simulateur-regroupement/?prepa=1'
        : '/simulateur/?prepa=1';

      if (prepa) {
        prepa.href = cibleSimulateur;
        if (versRegroupement) {
          /* « Avis de faisabilité » est le mot de l'autre simulateur.
             Celui-ci rend un comparatif : promettre l'un et livrer
             l'autre se remarque au premier écran. */
          const dit = prepa.querySelector('.rdv-prepa-dit');
          if (dit) dit.textContent = 'Vos réponses permettent à Mickael d’arriver avec des chiffres plutôt qu’avec des questions — et vous voyez tout de suite ce que donnerait le regroupement.';
        }
      }

      panel.style.display = 'none';
      done.classList.add('is-on');

      /* ⚠ LA PAGE S'OUVRE D'ELLE-MÊME (19/11/2026, Mickael : « je voulais
         qu'une page s'ouvre pour continuer le formulaire »). Un encadré à
         cliquer laissait le questionnaire invisible pour qui ne le remarquait
         pas — et c'est justement celui qu'on voulait atteindre.
         ⚠ L'écran de confirmation reste en place derrière : si la redirection
         est bloquée (navigateur restrictif, lien ouvert autrement), l'encadré
         est toujours là et reste cliquable. On ne remplace pas un chemin sûr
         par un chemin unique. */
      setTimeout(() => { location.href = cibleSimulateur; }, 900);
    });

    document.getElementById('rdv-again').addEventListener('click', () => {
      done.classList.remove('is-on');
      panel.style.display = '';
      etat.heure = null;
      chargeDisponibilites();
      dessineCreneaux(); majRecap();
    });

    dessineJours();
    dessineCreneaux();
    majRecap();
    chargeDisponibilites();
  })();

  // ---------- Simulateur express du hero ----------
  (() => {
  const hFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const hEls = {
    montant: document.getElementById('h-montant'),
    duree: document.getElementById('h-duree'),
    taux: document.getElementById('h-taux'),
    mv: document.getElementById('h-montant-v'),
    dv: document.getElementById('h-duree-v'),
    tv: document.getElementById('h-taux-v'),
    out: document.getElementById('h-mens'),
  };
  if (!hEls.montant) return;   // ce simulateur n'existe que sur l'accueil
  function heroRecompute() {
    const P = +hEls.montant.value;
    const n = +hEls.duree.value * 12;
    const r = (+hEls.taux.value / 100) / 12;
    const mens = r === 0 ? P / n : P * (r / (1 - Math.pow(1 + r, -n)));
    hEls.mv.textContent = hFmt.format(P) + ' €';
    hEls.dv.textContent = hEls.duree.value + ' ans';
    hEls.tv.textContent = (+hEls.taux.value).toFixed(2).replace('.', ',') + ' %';
    hEls.out.textContent = hFmt.format(Math.round(mens));
  }
  ['montant', 'duree', 'taux'].forEach(k => hEls[k].addEventListener('input', heroRecompute));
  heroRecompute();
  })();

  /* ---------- L’ONGLET REGROUPEMENT DU HERO (25/11/2026) ----------
     Mickael : « je voudrais mettre le simulateur du regroupement de
     crédits » dans le hero.

     ⚠ LES MÊMES RÈGLES QUE LE VRAI SIMULATEUR, À LA LETTRE, sans quoi les
     deux écrans se contrediraient — un reproche déjà fait, et justifié :
       • fourchette de taux, jamais un chiffre unique ;
       • les DEUX bornes à la même durée, la plus longue praticable, pour
         que la fourchette ne parle que du taux ;
       • hors frais : le barème de frais de l’agence n’est pas connu, et
         l’inventer gonflerait la mensualité d’un chiffre qui n’est pas le
         sien. La note sous la carte le dit.

     ⚠ LES QUATRE NOMBRES CI-DESSOUS SONT COPIÉS DE `BAREME.FOURCHETTE` DU
     MOTEUR (`simulateur-regroupement/moteur.js`). Le hero est servi par
     `index.html`, le simulateur par ses propres modules : ils ne peuvent
     pas partager le fichier. Si Mickael donne ses vrais taux, ils sont à
     changer AUX DEUX ENDROITS. C’est le seul endroit du site où un même
     chiffre vit en double, et c’est assumé — mais écrit.
     ⚠ ET C’EST LA FOURCHETTE « SANS GARANTIE » : le hero ne sait pas si le
     visiteur est propriétaire ni s’il rachète un prêt immobilier, les deux
     conditions qui font basculer l’opération en hypothécaire. On prend
     donc la fourchette la plus chère des deux : le simulateur complet
     pourra annoncer mieux, jamais pire. */
  (() => {
  /* ⚠ CES TROIS NOMBRES SONT CEUX DE `BAREME` DANS
     `simulateur-regroupement/moteur.js`. `generer-site.py` LES RELIT
     LÀ-BAS ET REFUSE DE CONSTRUIRE LE SITE S’ILS DIVERGENT : le
     commentaire écrit ici le 25/11 n’avait rien empêché — le barème a
     changé le lendemain (un seul taux au lieu d’une fourchette, 10 ans au
     lieu de 15, des frais) et le hero a annoncé toute une nuit ce que la
     page d’à côté démentait. Un commentaire informe, il ne bloque pas. */
  const TAUX = 0.0630, DUREE_ANS = 10, FRAIS = 0.03;
  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const eur = (v) => fmt.format(Math.round(v)) + ' €';
  const els = {
    dette: document.getElementById('h-dette'),
    mensu: document.getElementById('h-mensu'),
    dv: document.getElementById('h-dette-v'),
    mv: document.getElementById('h-mensu-v'),
    out: document.getElementById('h-regr-mens'),
    gain: document.getElementById('h-regr-gain'),
  };
  if (!els.dette) return;   // cet onglet n’existe que sur l’accueil

  /* La même formule que `mensualite()` du moteur, cas à taux zéro compris. */
  const mensualite = (capital, taux, mois) => {
    if (!(capital > 0) || !(mois > 0)) return 0;
    const i = taux / 12;
    return i === 0 ? capital / mois : (capital * i) / (1 - Math.pow(1 + i, -mois));
  };

  function recalcule() {
    const capital = +els.dette.value;
    const actuelle = +els.mensu.value;
    const mois = DUREE_ANS * 12;
    /* ⚠ LES FRAIS S’AJOUTENT AU CAPITAL, comme le fait `montantFinance()`
       du moteur : ils sont financés, pas payés à part. Les oublier
       annoncerait une mensualité plus basse qu’elle ne sera. */
    const nouvelle = Math.round(mensualite(capital * (1 + FRAIS), TAUX, mois));

    els.dv.textContent = eur(capital);
    els.mv.textContent = eur(actuelle);
    els.out.textContent = eur(nouvelle);

    /* ⚠ ON N’ANNONCE UN GAIN QUE S’IL EN EST UN. Avec un petit capital et
       une mensualité actuelle faible, le regroupement coûte plus cher par
       mois qu’aujourd’hui : afficher « soit -62 € de moins » serait
       absurde, et prétendre à un allègement serait faux. On le dit. */
    const gain = actuelle - nouvelle;
    if (gain > 0) {
      els.gain.textContent = 'soit ' + eur(gain) + ' de moins par mois, −'
        + Math.round(gain / actuelle * 100) + ' %';
    } else {
      els.gain.textContent = 'sur cette durée, l’opération n’allège pas votre mensualité';
    }
  }
  ['dette', 'mensu'].forEach((k) => els[k].addEventListener('input', recalcule));
  recalcule();

  /* ---- la bascule entre les deux onglets ---- */
  const onglets = [
    [document.getElementById('h-ong-achat'), document.getElementById('h-vol-achat')],
    [document.getElementById('h-ong-regr'),  document.getElementById('h-vol-regr')],
  ];
  function montrer(choisi) {
    onglets.forEach(([bouton, volet]) => {
      const actif = bouton === choisi;
      bouton.setAttribute('aria-selected', String(actif));
      /* Un seul onglet dans le parcours au clavier : les flèches servent à
         passer de l’un à l’autre, comme l’attend un jeu d’onglets. */
      bouton.tabIndex = actif ? 0 : -1;
      volet.hidden = !actif;
    });
  }
  onglets.forEach(([bouton]) => bouton.addEventListener('click', () => montrer(bouton)));
  onglets.forEach(([bouton], n) => bouton.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const suivant = onglets[(n + (e.key === 'ArrowRight' ? 1 : onglets.length - 1)) % onglets.length][0];
    montrer(suivant);
    suivant.focus();
  }));
  })();

  /* ---------- LES TROIS CAS CONCRETS (26/11/2026) ----------
     Mickael : « des exemples de regroupements de crédits avec des cas
     concrets […] des personnages fictifs et des situations pour que les
     personnes se retrouvent dans ces cas ».

     ⚠ AUCUN DE CES MONTANTS N'EST INVENTÉ. Chacun sort de `fourchette()`
     du moteur du simulateur, lancé sur le dossier décrit : mensualité
     d'après, durée retenue, montant financé frais compris, coût total et
     surcoût. Un exemple écrit à la main aurait été démenti par l'outil
     lui-même dès le premier visiteur qui aurait saisi les mêmes chiffres.
     Le détail du calcul est dans `simulateur-regroupement/moteur.js` ;
     `generer-site.py` refuse de publier si le hero et le moteur divergent,
     et ces cas suivent la même table.

     ⚠ UNE SEULE TABLE POUR LES DEUX PAGES. L'accueil et la page
     regroupement affichent exactement les mêmes cas : recopier le markup
     deux fois aurait garanti qu'une des deux copies dérive un jour.

     ⚠ LES PRÉNOMS ET LES SITUATIONS SONT FICTIFS, ET LA PAGE LE DIT.
     Présenter un dossier reconstitué comme un vrai client serait un
     témoignage inventé. */
  (() => {
  const CAS = [
    {
      ini: 'JM', portrait: '<svg viewBox=\'0 0 64 64\' role=\'img\' aria-label=\'Portrait dessin\u00e9 de Julie et Marc\'><rect width=\'64\' height=\'64\' fill=\'#D8F1F8\'/><circle cx=\'54\' cy=\'10\' r=\'7\' fill=\'#FFD84E\'/><path d=\'M-2 66c0-12 8-19 18-19s18 7 18 19z\' fill=\'#0FA3C4\' stroke=\'#0A6F86\' stroke-width=\'1.6\'/><circle cx=\'16\' cy=\'35\' r=\'10.5\' fill=\'#F2C8A0\' stroke=\'#C08B52\' stroke-width=\'1.6\'/><circle cx=\'12.4\' cy=\'34.5\' r=\'1.25\' fill=\'#15384E\'/><circle cx=\'19.6\' cy=\'34.5\' r=\'1.25\' fill=\'#15384E\'/><path d=\'M12.8 38.6 q3.1 4.0 6.3 0\' fill=\'none\' stroke=\'#15384E\' stroke-width=\'1.3\' stroke-linecap=\'round\'/><path d=\'M5.6 34c-0.6-7 3.8-12 10.4-12s11 5 10.4 12c-0.7-3.4-2.2-5.4-4-6.4-2.6 2.2-9.2 2.6-12.6 0.6-1.8 1-3.4 2.8-4.2 5.8z\' fill=\'#4A3A2E\'/><path d=\'M28 66c0-13 9-20 19-20s19 7 19 20z\' fill=\'#F4801C\' stroke=\'#BD6212\' stroke-width=\'1.6\'/><circle cx=\'47\' cy=\'32\' r=\'11.5\' fill=\'#F7D5B0\' stroke=\'#C08B52\' stroke-width=\'1.6\'/><circle cx=\'43.1\' cy=\'31.5\' r=\'1.25\' fill=\'#15384E\'/><circle cx=\'50.9\' cy=\'31.5\' r=\'1.25\' fill=\'#15384E\'/><path d=\'M43.5 35.9 q3.4 4.8 6.9 0\' fill=\'none\' stroke=\'#15384E\' stroke-width=\'1.3\' stroke-linecap=\'round\'/><path d=\'M35.2 31.5c-0.8-9 4.6-14.5 11.8-14.5s12.6 5.5 11.8 14.5c-1-5-3.4-8-7-9.2-3 1.4-8.6 1.6-12-0.2-2.6 1.6-4.6 4.4-4.6 9.4z\' fill=\'#8B5E3C\'/><path d=\'M35.4 30c-2.2 7.6-1.2 13.6 0.2 16.8l4.2-2.4c-1.4-4.4-2-9.6-1-14.4z\' fill=\'#8B5E3C\'/><path d=\'M58.6 30c2.2 7.6 1.2 13.6-0.2 16.8l-4.2-2.4c1.4-4.4 2-9.6 1-14.4z\' fill=\'#8B5E3C\'/></svg>', couleur: '#0FA3C4', fond: '#D8F1F8', encre: '#0A6F86',
      nom: 'Julie & Marc',
      situation: '34 et 37 ans · locataires à Nice',
      mot: 'Trois crédits pris à trois moments différents, et plus rien à mettre de côté à la fin du mois.',
      avant: [
        ['Prêt auto', 318, '48 mois'],
        ['Crédit travaux', 215, '46 mois'],
        ['Renouvelable', 190, '40 mois'],
      ],
      mensuAvant: 723, mensuApres: 348, baisse: 52,
      annees: 10, finance: 30900, cout: 41760, surcout: 9006,
      garantie: false,
    },
    {
      ini: 'S', portrait: '<svg viewBox=\'0 0 64 64\' role=\'img\' aria-label=\'Portrait dessin\u00e9 de Sandrine, devant sa maison\'><rect width=\'64\' height=\'64\' fill=\'#E3F1E6\'/><path d=\'M4 31 18 19.5 32 31z\' fill=\'#B85236\'/><rect x=\'9\' y=\'30\' width=\'18\' height=\'15\' fill=\'#F5C173\' stroke=\'#C08B52\' stroke-width=\'1.4\'/><rect x=\'15\' y=\'35\' width=\'6\' height=\'10\' fill=\'#FFF9EC\' stroke=\'#15384E\' stroke-width=\'1.2\'/><path d=\'M20 66c0-13 9.5-20 20-20s20 7 20 20z\' fill=\'#3E7A4E\' stroke=\'#2E5B3B\' stroke-width=\'1.6\'/><circle cx=\'40\' cy=\'32\' r=\'11.5\' fill=\'#F2C8A0\' stroke=\'#C08B52\' stroke-width=\'1.6\'/><circle cx=\'36.1\' cy=\'31.5\' r=\'1.25\' fill=\'#15384E\'/><circle cx=\'43.9\' cy=\'31.5\' r=\'1.25\' fill=\'#15384E\'/><path d=\'M36.5 35.9 q3.4 4.8 6.9 0\' fill=\'none\' stroke=\'#15384E\' stroke-width=\'1.3\' stroke-linecap=\'round\'/><path d=\'M28.2 31.5c-0.8-9 4.6-14.5 11.8-14.5s12.6 5.5 11.8 14.5c-1.2-5.6-4-8.6-8.2-9.6-3.2 1.6-8.4 1.6-11.4-0.4-2.2 1.8-3.8 4.6-4 10z\' fill=\'#5C4033\'/><path d=\'M28.4 30.5c-1.4 5.4-0.8 9.6 0.2 12l3.8-2.2c-1-3-1.4-6.4-0.8-9.6z\' fill=\'#5C4033\'/><path d=\'M51.6 30.5c1.4 5.4 0.8 9.6-0.2 12l-3.8-2.2c1-3 1.4-6.4 0.8-9.6z\' fill=\'#5C4033\'/></svg>', couleur: '#3E7A4E', fond: '#E3F1E6', encre: '#2E5B3B',
      nom: 'Sandrine',
      situation: '46 ans · propriétaire à Cagnes-sur-Mer',
      mot: 'Le prêt de la maison, une voiture et un crédit conso : les mensualités tiennent, mais plus rien ne passe.',
      avant: [
        ['Prêt immobilier', 835, '192 mois'],
        ['Prêt auto', 268, '48 mois'],
        ['Crédit conso', 205, '40 mois'],
      ],
      mensuAvant: 1308, mensuApres: 1012, baisse: 23,
      annees: 20, finance: 154560, cout: 242880, surcout: 61496,
      garantie: true,
    },
    {
      ini: 'T', portrait: '<svg viewBox=\'0 0 64 64\' role=\'img\' aria-label=\'Portrait dessin\u00e9 de Thierry, artisan\'><rect width=\'64\' height=\'64\' fill=\'#FFEAD1\'/><circle cx=\'11\' cy=\'12\' r=\'6.5\' fill=\'#FFD84E\'/><path d=\'M12 66c0-13 9-20 20-20s20 7 20 20z\' fill=\'#F4801C\' stroke=\'#BD6212\' stroke-width=\'1.6\'/><path d=\'M26 46.5 32 56.5 38 46.5l-3-1.6-3 4.2-3-4.2z\' fill=\'#FFF9EC\' stroke=\'#BD6212\' stroke-width=\'1.2\'/><circle cx=\'32\' cy=\'33\' r=\'11.5\' fill=\'#E8B183\' stroke=\'#B87A4B\' stroke-width=\'1.6\'/><circle cx=\'28.1\' cy=\'32.5\' r=\'1.25\' fill=\'#15384E\'/><circle cx=\'35.9\' cy=\'32.5\' r=\'1.25\' fill=\'#15384E\'/><path d=\'M28.6 36.9 q3.4 4.1 6.9 0\' fill=\'none\' stroke=\'#15384E\' stroke-width=\'1.3\' stroke-linecap=\'round\'/><path d=\'M20.8 28.2c0-6.6 5-11 11.2-11s11.2 4.4 11.2 11z\' fill=\'#2F4F3A\'/><path d=\'M20 28.2h25.6c0 2.2-1.8 3.4-4 3.4H20z\' fill=\'#3B6244\'/></svg>', couleur: '#F4801C', fond: '#FFEAD1', encre: '#A85510',
      nom: 'Thierry',
      situation: '52 ans · artisan à Antibes, locataire',
      mot: 'Deux réserves d’argent qui ne baissent jamais, un découvert qui revient, et un outillage à remplacer.',
      avant: [
        ['Renouvelable', 265, '48 mois'],
        ['Renouvelable', 198, '42 mois'],
        ['Crédit conso', 289, '52 mois'],
      ],
      mensuAvant: 752, mensuApres: 416, baisse: 45,
      annees: 10, finance: 36977, cout: 49920, surcout: 13856,
      garantie: false,
      extra: '2 200 € de découvert soldés et 5 000 € de trésorerie pour l’outillage, compris dans l’opération.',
    },
  ];

  const nb = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const eur = (v) => nb.format(v) + '\u00a0\u20ac';
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function carte(c) {
    const lignes = c.avant.map(([quoi, combien, duree]) =>
      '<li><span>' + esc(quoi) + '</span><b>' + eur(combien) + '</b><em>' + esc(duree) + '</em></li>'
    ).join('');
    /* La barre est \u00e0 l'\u00e9chelle de la mensualit\u00e9 d'aujourd'hui : c'est ce
       rapport qui fait voir la baisse, et non la valeur seule. */
    const part = Math.round(c.mensuApres / c.mensuAvant * 100);
    return '<article class="cas" style="--c:' + c.couleur + ';--c-soft:' + c.fond
      +   ';--c-ink:' + c.encre + '">'
      /* \u26a0 LE PORTRAIT N'EST PAS \u00c9CHAPP\u00c9 : c'est du SVG \u00e9crit dans CAS,
         pas une saisie. Les initiales restent le repli, pour le jour o\u00f9 un
         cas serait ajout\u00e9 sans dessin. */
      + '<div class="cas-bandeau">'
      +   '<span class="cas-ini"' + (c.portrait ? '' : ' aria-hidden="true"') + '>'
      +     (c.portrait || esc(c.ini)) + '</span>'
      +   '<div class="cas-qui"><h3>' + esc(c.nom) + '</h3><p>' + esc(c.situation) + '</p></div>'
      +   '<span class="cas-chute"><span class="n">\u2212' + c.baisse + '\u00a0%</span>'
      +     '<span class="l">de mensualité</span></span>'
      + '</div>'
      + '<div class="cas-corps">'
      +   '<p class="cas-mot">\u00ab\u00a0' + esc(c.mot) + '\u00a0\u00bb</p>'
      +   '<div class="cas-duo">'
      +     '<div class="cas-hier"><div class="lab">Aujourd\u2019hui</div>'
      +       '<div class="gros">' + eur(c.mensuAvant) + '</div></div>'
      +     '<div class="cas-demain"><div class="lab">Apr\u00e8s</div>'
      +       '<div class="gros">' + eur(c.mensuApres) + '</div></div>'
      +   '</div>'
      +   '<div class="cas-barre"><i style="--w:' + part + '%"></i></div>'
      +   '<ul class="cas-lignes">' + lignes + '</ul>'
      +   '<p class="cas-sur">Une seule mensualit\u00e9 sur ' + c.annees + ' ans \u00b7 '
      +     eur(c.finance) + ' financ\u00e9s, frais compris \u00b7 rachat '
      +     (c.garantie ? 'hypoth\u00e9caire' : 'sans garantie')
      +     (c.extra ? '<br>' + esc(c.extra) : '') + '</p>'
      /* \u26a0 LE CO\u00dbT TOTAL RESTE SUR LA CARTE. Mickael, 26/11 : « enl\u00e8ve
         soit xxxx \u20ac de plus que ces cr\u00e9dits men\u00e9s \u00e0 leur terme, ce n'est pas
         vendeur du tout ». La comparaison est retir\u00e9e — elle sonnait comme un
         reproche au visiteur au moment o\u00f9 il commence \u00e0 y croire. Le montant
         total, lui, ne bouge pas : c'est ce qu'un co\u00fbt de cr\u00e9dit affich\u00e9 doit
         comporter, et ce qui prot\u00e8ge l'agence si quelqu'un soutient plus tard
         qu'on ne le lui avait pas dit.
         `c.surcout` reste dans CAS bien qu'il ne s'affiche plus : il sort du
         moteur, et le contr\u00f4le qui compare les cartes au calcul le relit. */
      +   '<p class="cas-cout">Co\u00fbt total du cr\u00e9dit <b>' + eur(c.cout) + '</b></p>'
      + '</div>'
      + '</article>';
  }

  const NOTE = 'Dossiers reconstitu\u00e9s pour l\u2019exemple : les pr\u00e9noms, les \u00e2ges et les '
    + 'situations sont fictifs. Les montants sont calcul\u00e9s avec le m\u00eame moteur que notre '
    + 'simulateur, au taux indicatif de 6,30\u00a0% sans garantie et 4,90\u00a0% avec garantie '
    + 'hypoth\u00e9caire, frais de dossier compris, hors assurance emprunteur. Votre situation '
    + 'donnera d\u2019autres chiffres : seule une \u00e9tude de votre dossier permet de les \u00e9tablir. '
    + 'Un regroupement allonge la dur\u00e9e de remboursement, donc augmente le co\u00fbt total du '
    + 'cr\u00e9dit, indiqué sur chaque exemple.';

  function poserLesCas() {
    const html = CAS.map(carte).join('');
    ['accueil', 'regroupement'].forEach((ou) => {
      const grille = document.getElementById('cas-' + ou);
      if (grille) {
        grille.innerHTML = html;
        anime(grille);
      }
      const note = document.getElementById('cas-note-' + ou);
      if (note) note.textContent = NOTE;
    });
  }

  /* \u26a0 L'ANIMATION EST UN SUPPL\u00c9MENT, PAS UNE CONDITION. La classe `vu`
     ne fait que la d\u00e9clencher : sans elle, sans IntersectionObserver, ou
     avec les animations coup\u00e9es, les cartes sont d\u00e9j\u00e0 compl\u00e8tes et
     lisibles. C'est l'inverse qui serait un d\u00e9faut \u2014 une section laiss\u00e9e
     invisible en attendant un script. */
  function anime(grille) {
    const partir = () => grille.classList.add('vu');
    if (!('IntersectionObserver' in window)) { partir(); return; }
    const guetteur = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => {
        if (!e.isIntersecting) return;
        partir();
        guetteur.disconnect();
      });
    }, { threshold: 0.18 });
    guetteur.observe(grille);
    /* ⚠ LE MÊME FILET QUE LA RÉVÉLATION DU SITE, deux lignes plus haut
       dans ce fichier. Un onglet ouvert en arrière-plan suspend les
       `IntersectionObserver` : l'animation ne se jouerait jamais pour qui
       ouvre la page dans un onglet et y revient plus tard. Constaté en
       essayant de la vérifier dans un volet masqué, où ni mon observateur
       ni celui du site ne répondaient. */
    setTimeout(partir, 2500);
  }

  poserLesCas();
  })();



  // ---------- Simulateur complet ----------
  (() => {
  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  const fmtEur = (v) => fmt.format(Math.round(v)) + ' €';
  const els = {
    montant: document.getElementById('montant'),
    duree: document.getElementById('duree'),
    taux: document.getElementById('taux'),
    assur: document.getElementById('assur'),
    apport: document.getElementById('apport'),
    mv: document.getElementById('montant-v'),
    dv: document.getElementById('duree-v'),
    tv: document.getElementById('taux-v'),
    av: document.getElementById('assur-v'),
    apv: document.getElementById('apport-v'),
    rMens: document.getElementById('r-mens'),
    rCred: document.getElementById('r-cred'),
    rAss: document.getElementById('r-ass'),
    rCout: document.getElementById('r-cout'),
    rInt: document.getElementById('r-int'),
    rCassur: document.getElementById('r-cassur'),
    rBien: document.getElementById('r-bien'),
  };
  if (!els.montant) return;   // ce simulateur n'existe que sur sa page
  function recompute() {
    const P = +els.montant.value;
    const years = +els.duree.value;
    const annualRate = +els.taux.value / 100;
    const insurRate = +els.assur.value / 100;
    const apport = +els.apport.value;
    const n = years * 12;
    const r = annualRate / 12;
    let mensCredit;
    if (r === 0) mensCredit = P / n;
    else mensCredit = P * (r / (1 - Math.pow(1 + r, -n)));
    const mensAssur = (P * insurRate) / 12;
    const mensTotal = mensCredit + mensAssur;
    const coutInt = mensCredit * n - P;
    const coutAssur = mensAssur * n;
    const coutTotal = coutInt + coutAssur;

    els.mv.textContent = fmtEur(P);
    els.dv.textContent = years + ' an' + (years > 1 ? 's' : '');
    els.tv.textContent = (+els.taux.value).toFixed(2).replace('.', ',') + ' %';
    els.av.textContent = (+els.assur.value).toFixed(2).replace('.', ',') + ' %';
    els.apv.textContent = fmtEur(apport);

    els.rMens.textContent = fmt.format(Math.round(mensTotal));
    els.rCred.textContent = fmtEur(mensCredit);
    els.rAss.textContent = fmtEur(mensAssur);
    els.rCout.textContent = fmtEur(coutTotal);
    els.rInt.textContent = fmtEur(coutInt);
    els.rCassur.textContent = fmtEur(coutAssur);
    els.rBien.textContent = fmtEur(P + apport);
  }
  ['montant', 'duree', 'taux', 'assur', 'apport'].forEach(k => {
    els[k].addEventListener('input', recompute);
  });
  recompute();
  })();

