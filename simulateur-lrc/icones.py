# -*- coding: utf-8 -*-
"""Les icônes du simulateur — des tracés au trait, à la place des émojis.

Le modèle illustre chaque réponse par un émoji. Ils ne s'alignent pas
(chaque police les dessine à sa façon, avec sa propre hauteur de ligne),
ils changent d'aspect d'un téléphone à l'autre, et ils donnent à la page
un air de message texte.

Ici : un jeu d'icônes dessinées au trait, toutes sur la même grille de
24 unités, de la même épaisseur, qui prennent la couleur du texte. Elles
se centrent d'elles-mêmes et se tiennent entre elles.

⚠ GUILLEMETS DOUBLES OBLIGATOIRES dans les tracés : ils sont injectés
dans `ic:'…'`, une chaîne JavaScript délimitée par des apostrophes.
"""

_DEBUT = ('<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
          'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">')


def _svg(trace):
    return _DEBUT + trace + '</svg>'


# émoji du modèle → tracé de remplacement
ICONES = {
    # --- lieux et biens ---------------------------------------------
    '📍': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    '🏠': '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.2 9.6V21h13.6V9.6"/><path d="M9.6 21v-6.2h4.8V21"/>',
    '🏡': '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.2 9.6V21h13.6V9.6"/><path d="M9.6 21v-6.2h4.8V21"/>',
    '🏘️': '<path d="M2.5 11.5 7.5 7l5 4.5"/><path d="M4 10.6V20h7v-9.4"/>'
           '<path d="M11 20h9v-7.6L16.5 9.5 13 12.4"/>',
    '🏢': '<path d="M4 21V6l7-3v18"/><path d="M11 10h6a2 2 0 0 1 2 2v9"/>'
           '<path d="M7 8h.01M7 12h.01M7 16h.01M15 14h.01M15 18h.01"/>',
    '🏙️': '<path d="M3 21V9l5-3v15"/><path d="M8 21V12h5v9"/><path d="M13 21V7l8 4.5V21"/>',
    '🏛️': '<path d="M3 20.5h18"/><path d="M5.5 20.5V10M9.8 20.5V10M14.2 20.5V10M18.5 20.5V10"/>'
           '<path d="m3 9 9-5 9 5Z"/>',
    '🏗️': '<path d="M4 16.5h16"/><path d="M5.8 16.5v-2.2a6.2 6.2 0 0 1 12.4 0v2.2"/>'
           '<path d="M10 4.8h4"/>',
    '🧱': '<rect x="3" y="5.2" width="18" height="5.2" rx="1"/>'
           '<rect x="3" y="13.6" width="18" height="5.2" rx="1"/><path d="M9.5 5.2v5.2M14.5 13.6v5.2"/>',
    '🌴': '<path d="M12 21v-10.6"/>'
           '<path d="M12 10.4C9.2 7.8 6 8.2 4.4 10.4 6.3 6.6 10 5.5 12 8.2c2-2.7 5.7-1.6 7.6 2.2'
           '-1.6-2.2-4.8-2.6-7.6 0Z"/>',
    '🌅': '<path d="M12 3.2v3.6"/><path d="m5.8 8.6 2.4 2.4M18.2 8.6 15.8 11"/>'
           '<path d="M3 17.6h18"/><path d="M7.2 17.6a4.8 4.8 0 0 1 9.6 0"/><path d="M2 21h20"/>',

    # --- argent et dossier ------------------------------------------
    '💳': '<rect x="2.8" y="5.6" width="18.4" height="12.8" rx="2.4"/><path d="M2.8 10h18.4"/>',
    '💰': '<path d="M4 8V7a2 2 0 0 1 2-2h11.5a1 1 0 0 1 1 1v2"/>'
           '<rect x="3.4" y="8" width="17.2" height="10.8" rx="2.2"/><path d="M16.6 13.4h.01"/>',
    '💼': '<rect x="3" y="7.4" width="18" height="12" rx="2"/>'
           '<path d="M9 7.4V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.4"/><path d="M3 12.4h18"/>',
    '📄': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/>'
           '<path d="M14 3v5h5"/><path d="M9 13.2h6M9 16.8h4"/>',
    '📈': '<path d="m3.2 17 5.8-5.8 3.8 3.8L20.6 7"/><path d="M15 7h5.6v5.6"/>',
    '📆': '<rect x="3.4" y="5" width="17.2" height="15.4" rx="2.2"/><path d="M3.4 10h17.2"/>'
           '<path d="M8.2 3v4M15.8 3v4"/>',
    '🕐': '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
    '⏳': '<path d="M7 3.2h10M7 20.8h10"/>'
           '<path d="M8.2 3.2v3.4c0 1.6 3.8 3.7 3.8 5.4s-3.8 3.8-3.8 5.4v3.4"/>'
           '<path d="M15.8 3.2v3.4c0 1.6-3.8 3.7-3.8 5.4s3.8 3.8 3.8 5.4v3.4"/>',

    # --- personnes ---------------------------------------------------
    '👤': '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.2c0-3.7 3.1-6.3 7-6.3s7 2.6 7 6.3"/>',
    '👥': '<circle cx="9.2" cy="8.2" r="3.4"/><path d="M3.4 20c0-3.3 2.6-5.6 5.8-5.6s5.8 2.3 5.8 5.6"/>'
           '<path d="M16.4 11.4a3 3 0 0 0 0-5.8"/><path d="M17.8 20c0-2.2-.7-3.9-1.9-5"/>',
    '🤝': '<circle cx="9.2" cy="8.2" r="3.4"/><path d="M3.4 20c0-3.3 2.6-5.6 5.8-5.6s5.8 2.3 5.8 5.6"/>'
           '<path d="M16.4 11.4a3 3 0 0 0 0-5.8"/><path d="M17.8 20c0-2.2-.7-3.9-1.9-5"/>',
    '👨‍👧': '<circle cx="8.4" cy="7.6" r="3.2"/>'
                  '<path d="M3 20c0-3.2 2.4-5.4 5.4-5.4s5.4 2.2 5.4 5.4"/>'
                  '<circle cx="17.4" cy="12.4" r="2.2"/><path d="M14 20c0-2 1.5-3.4 3.4-3.4S20.8 18 20.8 20"/>',
    '🧑‍💻': '<rect x="4" y="5.4" width="16" height="10.2" rx="1.8"/><path d="M2.4 19.2h19.2"/>',
    '⚕️': '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.6v8.8M7.6 12h8.8"/>',

    # --- actions et états --------------------------------------------
    '🔑': '<circle cx="8.2" cy="15.2" r="4"/><path d="m11 12.4 8.2-8.2"/>'
           '<path d="m17.2 6.2 2 2"/><path d="m14.6 8.8 2 2"/>',
    '🔁': '<path d="M3.4 12a8.6 8.6 0 0 1 14.4-6.3L20.6 8"/><path d="M20.6 3.4V8h-4.6"/>'
           '<path d="M20.6 12a8.6 8.6 0 0 1-14.4 6.3L3.4 16"/><path d="M3.4 20.6V16H8"/>',
    '🔍': '<circle cx="11" cy="11" r="6.4"/><path d="m15.8 15.8 4.6 4.6"/>',
    '✅': '<circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.4 2.6 2.6 4.6-5.2"/>',
    '👌': '<path d="M7 10.8v8.4H4.6a1 1 0 0 1-1-1v-6.4a1 1 0 0 1 1-1Z"/>'
           '<path d="m7 10.8 3.6-7a2 2 0 0 1 3.8 1.2l-.9 4h4.9a2 2 0 0 1 2 2.4l-1.3 6a2 2 0 0 1-2 1.6H7"/>',
    '👍': '<path d="M7 10.8v8.4H4.6a1 1 0 0 1-1-1v-6.4a1 1 0 0 1 1-1Z"/>'
           '<path d="m7 10.8 3.6-7a2 2 0 0 1 3.8 1.2l-.9 4h4.9a2 2 0 0 1 2 2.4l-1.3 6a2 2 0 0 1-2 1.6H7"/>',
    '➕': '<circle cx="12" cy="12" r="8.6"/><path d="M12 8.2v7.6M8.2 12h7.6"/>',
    '🚫': '<circle cx="12" cy="12" r="8.6"/><path d="m5.9 5.9 12.2 12.2"/>',
    '🤷': '<circle cx="12" cy="12" r="8.6"/>'
           '<path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.2-2.4 3.8"/><path d="M12 17.4h.01"/>',
    '🤔': '<circle cx="12" cy="12" r="8.6"/>'
           '<path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.2-2.4 3.8"/><path d="M12 17.4h.01"/>',
    '💡': '<path d="M9.4 18.2h5.2"/><path d="M10.4 21h3.2"/>'
           '<path d="M12 3a6 6 0 0 0-3.4 10.9c.6.5.9 1.3.9 2.1h5c0-.8.3-1.6.9-2.1A6 6 0 0 0 12 3Z"/>',
    '🌟': '<path d="m12 3.6 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6-4.3-4.2 6-.9Z"/>',
    '🏷️': '<path d="M11.6 3.6H5.2a1.6 1.6 0 0 0-1.6 1.6v6.4c0 .4.2.8.5 1.1l7.8 7.8a1.6 1.6 0 0 0 2.2 0'
           'l6.4-6.4a1.6 1.6 0 0 0 0-2.2l-7.8-7.8c-.3-.3-.7-.5-1.1-.5Z"/><circle cx="8" cy="8" r="1.4"/>',
    '📝': '<path d="M16.4 3.4a2.1 2.1 0 0 1 3 3L7 18.8l-4 1.2 1.2-4Z"/><path d="m14.4 5.4 3 3"/>',
    '✏️': '<path d="M16.4 3.4a2.1 2.1 0 0 1 3 3L7 18.8l-4 1.2 1.2-4Z"/><path d="m14.4 5.4 3 3"/>',
    '🚗': '<path d="M4.6 16.8h14.8"/>'
           '<path d="M4.2 16.8v-3.1l1.8-4.2A2 2 0 0 1 7.9 8.2h8.2a2 2 0 0 1 1.9 1.3l1.8 4.2v3.1"/>'
           '<circle cx="7.6" cy="17.4" r="1.6"/><circle cx="16.4" cy="17.4" r="1.6"/>',
    '•': '<circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/>',
}


def table():
    """{émoji: balise SVG} — prête pour le remplacement dans la page."""
    return {emoji: _svg(trace) for emoji, trace in ICONES.items()}
