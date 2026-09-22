
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

        if (!prenom || !tel) {
          statut.textContent = MSG_TEL_CANDIDAT;
          return;
        }
        if (!estEmail(email)) {
          statut.textContent = MSG_EMAIL_CANDIDAT;
          return;
        }

        const bouton = form.querySelector('button[type="submit"]');
        if (RDV_API) {
          statut.textContent = 'Envoi…';
          bouton.disabled = true;
          try {
            await fetch(RDV_API + '/candidature', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ prenom, nom, telephone: tel, email, profil, message: mot, piege }),
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
        b.className = 'rdv-day';
        b.disabled = d.getDay() === 0 || d.getDay() === 6;
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
      panel.style.display = 'none';
      done.classList.add('is-on');
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

