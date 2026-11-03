/* Kick TV — static configuration
 * Everything here is public and safe to ship to the browser.
 * No secrets, no backend, no third-party proxy.
 */
(function () {
  'use strict';

  window.KICKTV_CONFIG = {
    version: '2.0.0',

    /* Kick public web endpoints used by kick.com itself. */
    api: {
      base: 'https://kick.com',
      channel: '/api/v2/channels/{slug}',
      search: '/api/search?searched_word={query}',
      topCategories: '/api/v1/categories/top',
      timeoutMs: 9000,
      cacheTtlMs: 45000,
      maxParallel: 6
    },

    player: {
      base: 'https://player.kick.com/{slug}',
      params: '?autoplay=true',
      loadHintMs: 12000
    },

    links: {
      site: 'https://kick.com',
      browse: 'https://kick.com/browse',
      category: 'https://kick.com/category/{slug}',
      channel: 'https://kick.com/{slug}'
    },

    storageKeys: {
      favorites: 'kickps5:v2:favorites',
      recent: 'kickps5:v2:recent',
      settings: 'kickps5:v2:settings',
      legacyFavorites: 'kicktv-favorites',
      legacyRecent: 'kicktv-recent'
    },

    /* Channels are used only as a discovery roster. Live state, viewer counts,
     * thumbnails and titles always come from Kick's API at runtime. */
    featuredChannels: [
      { slug: 'xqc', name: 'xQc' },
      { slug: 'davooxeneize', name: 'Davooxeneize' },
      { slug: 'westcol', name: 'Westcol' },
      { slug: 'spreen', name: 'Spreen' },
      { slug: 'adinross', name: 'Adin Ross' },
      { slug: 'n3on', name: 'N3on' },
      { slug: 'roshtein', name: 'Roshtein' },
      { slug: 'amouranth', name: 'Amouranth' },
      { slug: 'sxb', name: 'SXB' },
      { slug: 'atro', name: 'Atro' },
      { slug: 'coringa', name: 'Coringa' },
      { slug: '3mr', name: '3MR' },
      { slug: 'coker', name: 'Coker' },
      { slug: 'deenthegreat', name: 'DeenTheGreat' },
      { slug: 'lospollostv', name: 'LosPollosTV' },
      { slug: 'adrianozendejas32', name: 'Adriano Zendejas' },
      { slug: 'willito', name: 'Willito' },
      { slug: 'clavicular', name: 'Clavicular' },
      { slug: 'aquino', name: 'Aquino' },
      { slug: 'zeko', name: 'Zeko' },
      { slug: 'buddha', name: 'Buddha' },
      { slug: 'thegrefg', name: 'TheGrefg' },
      { slug: 'yourrage', name: 'YourRage' },
      { slug: 'brucedropemoff', name: 'BruceDropEmOff' },
      { slug: 'iceposeidon', name: 'Ice Poseidon' },
      { slug: 'destiny', name: 'Destiny' },
      { slug: 'mizkif', name: 'Mizkif' },
      { slug: 'juansguarnizo', name: 'JuanSGuarnizo' },
      { slug: 'trainwreckstv', name: 'Trainwreck' },
      { slug: 'elzeein', name: 'ElZeein' },
      { slug: 'alondrissa', name: 'Alondrissa' },
      { slug: 'asmongold', name: 'Asmongold' }
    ],

    /* Shown when /api/v1/categories/top is unreachable. Slugs are official. */
    fallbackCategories: [
      { slug: 'irl', name: 'IRL', tag: 'حياة واقعية' },
      { slug: 'just-chatting', name: 'Just Chatting', tag: 'دردشة' },
      { slug: 'grand-theft-auto-v', name: 'Grand Theft Auto V', tag: 'ألعاب' },
      { slug: 'slots', name: 'Slots & Casino', tag: 'كازينو' },
      { slug: 'counter-strike-2', name: 'Counter-Strike 2', tag: 'تصويب' },
      { slug: 'fortnite', name: 'Fortnite', tag: 'باتل رويال' },
      { slug: 'league-of-legends', name: 'League of Legends', tag: 'MOBA' },
      { slug: 'valorant', name: 'VALORANT', tag: 'تصويب' },
      { slug: 'ea-sports-fc-27', name: 'EA Sports FC 27', tag: 'رياضة' },
      { slug: 'ark-survival-ascended', name: 'ARK: Survival Ascended', tag: 'بقاء' },
      { slug: 'witchs-doll', name: 'Witch\u2019s Doll', tag: 'رعب' },
      { slug: 'call-of-duty-modern-warfare-4', name: 'Call of Duty: Modern Warfare 4', tag: 'تصويب' }
    ]
  };
})();
