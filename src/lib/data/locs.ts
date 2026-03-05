// =============================================================================
// GMTW Trail Map — Vorinstallierte Event-Marker (LOCS)
// Exakt übernommen aus index.html — alle 17 Einträge mit i18n
// =============================================================================

import type { LocMarker } from '$lib/types';

/** Rückweg-Polyline-Koordinaten (weg-camp) */
export const WEG_CAMP_POLYLINE: [number, number][] = [
  [51.418146, 7.478490],
  [51.417422, 7.490686]
];

/** Alle vordefinierten GMTW Event-Marker */
export const LOCS: LocMarker[] = [
  // ── BEGINNER ────────────────────────────────────────────────────────────────
  {
    id: 'muni',
    name: 'Muni Start Beginner/Mittel',
    lat: 51.421812,
    lng: 7.492612,
    color: '#22c55e',
    emoji: '🚩',
    cat: 'beginner',
    desc: 'Startpunkt für Muni-Fahrer aller Levels',
    nameI18n: {
      en: 'Muni Start Beginner/Medium',
      fr: 'Départ Muni Débutant/Intermédiaire',
      es: 'Salida Muni Principiante/Medio',
      it: 'Partenza Muni Principiante/Medio'
    },
    descI18n: {
      en: 'Starting point for Muni riders of all levels',
      fr: 'Point de départ pour les cyclistes de tous niveaux',
      es: 'Punto de salida para ciclistas de todos los niveles',
      it: 'Punto di partenza per ciclisti di tutti i livelli'
    }
  },
  // ── MITTEL ──────────────────────────────────────────────────────────────────
  {
    id: 'ein-mit',
    name: 'Einstieg Mittel',
    lat: 51.423421,
    lng: 7.480829,
    color: '#f59e0b',
    emoji: '🟡',
    cat: 'mittel',
    desc: 'Einstieg in die mittlere Strecke',
    nameI18n: {
      en: 'Medium Entry',
      fr: 'Entrée Intermédiaire',
      es: 'Entrada Medio',
      it: 'Ingresso Medio'
    },
    descI18n: {
      en: 'Entry point for the medium route',
      fr: 'Entrée dans le parcours intermédiaire',
      es: 'Entrada a la ruta de nivel medio',
      it: 'Punto di ingresso al percorso intermedio'
    }
  },
  {
    id: 'ziel-mit',
    name: 'Ziel Mittel',
    lat: 51.419329,
    lng: 7.511120,
    color: '#f59e0b',
    emoji: '🏆',
    cat: 'mittel',
    desc: 'Ziel der mittleren Strecke — an der Ruhr',
    nameI18n: {
      en: 'Medium Finish',
      fr: 'Arrivée Intermédiaire',
      es: 'Meta Medio',
      it: 'Arrivo Medio'
    },
    descI18n: {
      en: 'Finish of the medium route — by the Ruhr river',
      fr: 'Arrivée du parcours intermédiaire — au bord de la Ruhr',
      es: 'Meta de la ruta media — junto al río Ruhr',
      it: 'Arrivo del percorso intermedio — lungo il fiume Ruhr'
    }
  },
  // ── EXPERT ──────────────────────────────────────────────────────────────────
  {
    id: 'exp-zone',
    name: 'Expert Zone',
    lat: 51.418692,
    lng: 7.475410,
    color: '#ef4444',
    emoji: '⚠️',
    cat: 'expert',
    desc: 'Hochanspruchsvolles Gelände',
    nameI18n: {
      en: 'Expert Zone',
      fr: 'Zone Expert',
      es: 'Zona Expert',
      it: 'Zona Expert'
    },
    descI18n: {
      en: 'Highly demanding terrain',
      fr: 'Terrain très exigeant',
      es: 'Terreno muy exigente',
      it: 'Terreno molto impegnativo'
    }
  },
  {
    id: 'exp-kurs',
    name: 'Zerstörer',
    lat: 51.416403,
    lng: 7.453939,
    color: '#ef4444',
    emoji: '🎇',
    cat: 'expert',
    desc: 'Links sehr schwer, rechts schwer',
    nameI18n: {
      en: 'Destroyer',
      fr: 'Destructeur',
      es: 'Destructor',
      it: 'Distruttore'
    },
    descI18n: {
      en: 'Left: very hard, right: hard',
      fr: 'Gauche : très difficile, droite : difficile',
      es: 'Izquierda: muy difícil, derecha: difícil',
      it: 'Sinistra: molto difficile, destra: difficile'
    }
  },
  // ── LOGISTIK ────────────────────────────────────────────────────────────────
  {
    id: 'camp',
    name: 'GMTW Camp',
    lat: 51.417704,
    lng: 7.494867,
    color: '#38bdf8',
    emoji: '⛺',
    cat: 'optional-logistik',
    desc: 'Hauptcamp des Events — Basisstation',
    nameI18n: {
      en: 'GMTW Camp',
      fr: 'Camp GMTW',
      es: 'Campamento GMTW',
      it: 'Campo GMTW'
    },
    descI18n: {
      en: 'Main event camp — base station',
      fr: "Camp principal de l'événement — base",
      es: 'Campamento principal del evento — base',
      it: "Campo principale dell'evento — base"
    }
  },
  {
    id: 'camp-tor',
    name: 'Camp Tor',
    lat: 51.417482,
    lng: 7.490904,
    color: '#38bdf8',
    emoji: '🚧',
    cat: 'optional-logistik',
    desc: 'Haupteingang zum GMTW Camp',
    nameI18n: {
      en: 'Camp Gate',
      fr: 'Portail du Camp',
      es: 'Entrada del Campamento',
      it: 'Ingresso Campo'
    },
    descI18n: {
      en: 'Main entrance to the GMTW Camp',
      fr: 'Entrée principale du camp GMTW',
      es: 'Entrada principal al campamento GMTW',
      it: 'Ingresso principale al campo GMTW'
    }
  },
  {
    id: 'zeltplatz',
    name: 'Zeltplatz Eingang',
    lat: 51.420130,
    lng: 7.495086,
    color: '#38bdf8',
    emoji: '🏕️',
    cat: 'optional-logistik',
    desc: 'Eingang Campingplatz Hohensyburg · Syburger Dorfstr. 69',
    nameI18n: {
      en: 'Campsite Entrance',
      fr: 'Entrée du Camping',
      es: 'Entrada al Camping',
      it: 'Ingresso Campeggio'
    },
    descI18n: {
      en: 'Campsite entrance Hohensyburg · Syburger Dorfstr. 69',
      fr: 'Entrée du camping Hohensyburg · Syburger Dorfstr. 69',
      es: 'Entrada al camping Hohensyburg · Syburger Dorfstr. 69',
      it: 'Ingresso campeggio Hohensyburg · Syburger Dorfstr. 69'
    }
  },
  {
    id: 'sam-beg',
    name: 'Sammelpunkt Beginner',
    lat: 51.419799,
    lng: 7.484685,
    color: '#38bdf8',
    emoji: '👥',
    cat: 'optional-logistik',
    desc: 'Treffpunkt nach dem Aufstieg vom Camp',
    nameI18n: {
      en: 'Beginner Meeting Point',
      fr: 'Point de Rencontre Débutants',
      es: 'Punto de Encuentro Principiantes',
      it: "Punto d'Incontro Principianti"
    },
    descI18n: {
      en: 'Meeting point after the climb from camp',
      fr: 'Point de rencontre après la montée depuis le camp',
      es: 'Punto de encuentro tras la subida desde el campamento',
      it: "Punto d'incontro dopo la salita dal campo"
    }
  },
  {
    id: 'sam-mit',
    name: 'Sammelpunkt Mittel',
    lat: 51.423371,
    lng: 7.513606,
    color: '#f59e0b',
    emoji: '👥',
    cat: 'optional-logistik',
    desc: 'Sammelpunkt — Auf dem Spielplatz',
    nameI18n: {
      en: 'Medium Meeting Point',
      fr: 'Point de Rencontre Intermédiaire',
      es: 'Punto de Encuentro Medio',
      it: "Punto d'Incontro Medio"
    },
    descI18n: {
      en: 'Meeting point — at the playground',
      fr: 'Point de rencontre — au terrain de jeux',
      es: 'Punto de encuentro — en el parque infantil',
      it: "Punto d'incontro — al parco giochi"
    }
  },
  {
    id: 'sam-camp',
    name: 'Sammelpunkt → Camp',
    lat: 51.418164,
    lng: 7.478552,
    color: '#38bdf8',
    emoji: '🔁',
    cat: 'optional-logistik',
    desc: 'Treffpunkt für den Rückweg ins Camp',
    nameI18n: {
      en: 'Meeting Point → Camp',
      fr: 'Point de Rencontre → Camp',
      es: 'Punto de Encuentro → Campamento',
      it: "Punto d'Incontro → Campo"
    },
    descI18n: {
      en: 'Meeting point for the return to camp',
      fr: 'Point de rencontre pour le retour au camp',
      es: 'Punto de encuentro para el regreso al campamento',
      it: "Punto d'incontro per il ritorno al campo"
    }
  },
  {
    id: 'wc',
    name: 'Dusche / WC',
    lat: 51.418808,
    lng: 7.493754,
    color: '#a78bfa',
    emoji: '🚿',
    cat: 'optional-logistik',
    desc: 'Sanitäreinrichtungen am Camp',
    nameI18n: {
      en: 'Shower / WC',
      fr: 'Douche / WC',
      es: 'Ducha / WC',
      it: 'Doccia / WC'
    },
    descI18n: {
      en: 'Sanitary facilities at the camp',
      fr: 'Installations sanitaires au camp',
      es: 'Instalaciones sanitarias en el campamento',
      it: 'Servizi igienici al campo'
    }
  },
  // ── RÜCKWEG (Polyline + Marker, standardmäßig ausgeblendet) ─────────────────
  {
    id: 'weg-camp',
    name: 'Weg zurück ins Camp',
    lat: 51.417784,
    lng: 7.484588,
    color: '#f59e0b',
    emoji: '↩️',
    cat: 'optional-logistik',
    desc: 'Rückweg vom Kurs zum Camp — ca. 1 km',
    nameI18n: {
      en: 'Way back to Camp',
      fr: 'Retour au Camp',
      es: 'Camino de Vuelta al Campamento',
      it: 'Strada di Ritorno al Campo'
    },
    descI18n: {
      en: 'Return route from the course to camp — approx. 1 km',
      fr: 'Chemin de retour du parcours au camp — env. 1 km',
      es: 'Ruta de regreso del recorrido al campamento — aprox. 1 km',
      it: 'Percorso di ritorno dal corso al campo — circa 1 km'
    }
  }
];

/** Standard-Karte-Position: Hohensyburg */
export const DEFAULT_CENTER: [number, number] = [51.4192, 7.4855];
export const DEFAULT_ZOOM = 16;

/** IDs die standardmäßig ausgeblendet sind (nur über Marker-Einstellungen einblendbar) */
export const DEFAULT_HIDDEN_LOCS: string[] = ['weg-camp'];
