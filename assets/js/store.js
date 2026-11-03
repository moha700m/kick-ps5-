/* Local persistence: favorites, recently watched, preferences. */
(function () {
  'use strict';

  var CFG = window.KICKTV_CONFIG;
  var KEYS = CFG.storageKeys;
  var SLUG_RE = /^[a-zA-Z0-9_]{1,25}$/;

  function safeParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      var value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (err) {
      return fallback;
    }
  }

  function read(key, fallback) {
    try {
      return safeParse(window.localStorage.getItem(key), fallback);
    } catch (err) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      return false;
    }
  }

  function normalizeSlug(value) {
    var slug = String(value || '').trim().replace(/^@+/, '');
    return SLUG_RE.test(slug) ? slug : '';
  }

  function normalizeEntry(entry, timeKey) {
    if (typeof entry === 'string') {
      var slug = normalizeSlug(entry);
      return slug ? { slug: slug, name: slug, avatar: '', at: 0 } : null;
    }
    if (!entry || typeof entry !== 'object') return null;
    var cleanSlug = normalizeSlug(entry.slug);
    if (!cleanSlug) return null;
    var item = {
      slug: cleanSlug,
      name: String(entry.name || cleanSlug).slice(0, 80),
      avatar: typeof entry.avatar === 'string' ? entry.avatar : '',
      at: Number(entry[timeKey] || entry.at || 0) || 0
    };
    return item;
  }

  function normalizeList(list, timeKey) {
    if (!Array.isArray(list)) return [];
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var item = normalizeEntry(list[i], timeKey);
      if (!item || seen[item.slug.toLowerCase()]) continue;
      seen[item.slug.toLowerCase()] = true;
      out.push(item);
    }
    return out;
  }

  function migrateLegacy() {
    var favKey = KEYS.favorites;
    var recentKey = KEYS.recent;
    var legacyFavorites = read(KEYS.legacyFavorites, []);
    var legacyRecent = read(KEYS.legacyRecent, []);
    var currentFavorites = read(favKey, []);
    var currentRecent = read(recentKey, []);

    if ((!Array.isArray(currentFavorites) || currentFavorites.length === 0) && Array.isArray(legacyFavorites) && legacyFavorites.length) {
      write(favKey, normalizeList(legacyFavorites.map(function (slug) {
        return { slug: slug, name: slug, at: Date.now() };
      }), 'at'));
    }
    if ((!Array.isArray(currentRecent) || currentRecent.length === 0) && Array.isArray(legacyRecent) && legacyRecent.length) {
      write(recentKey, normalizeList(legacyRecent.map(function (slug) {
        return { slug: slug, name: slug, at: Date.now() };
      }), 'at').slice(0, 12));
    }
  }

  function loadFavorites() {
    return normalizeList(read(KEYS.favorites, []), 'at');
  }

  function loadRecent() {
    return normalizeList(read(KEYS.recent, []), 'at').slice(0, 12);
  }

  function loadSettings() {
    var raw = read(KEYS.settings, {});
    return {
      reduceMotion: !!(raw && raw.reduceMotion),
      autoplay: !raw || raw.autoplay !== false
    };
  }

  var favorites = loadFavorites();
  var recent = loadRecent();
  var settings = loadSettings();

  function emit() {
    try {
      window.dispatchEvent(new CustomEvent('kicktv:store', {
        detail: {
          favorites: favorites.slice(),
          recent: recent.slice(),
          settings: Object.assign({}, settings)
        }
      }));
    } catch (err) {
      /* CustomEvent is unavailable in very old engines — state still works. */
    }
  }

  function persistFavorites() {
    write(KEYS.favorites, favorites);
    emit();
  }

  function persistRecent() {
    write(KEYS.recent, recent);
    emit();
  }

  var Store = {
    normalizeSlug: normalizeSlug,

    getFavorites: function () {
      return favorites.slice();
    },

    isFavorite: function (slug) {
      var clean = normalizeSlug(slug).toLowerCase();
      return favorites.some(function (item) {
        return item.slug.toLowerCase() === clean;
      });
    },

    addFavorite: function (channel) {
      var item = normalizeEntry(channel, 'at');
      if (!item) return false;
      var exists = Store.isFavorite(item.slug);
      if (exists) {
        favorites = favorites.map(function (fav) {
          return fav.slug.toLowerCase() === item.slug.toLowerCase()
            ? Object.assign({}, fav, { name: item.name || fav.name, avatar: item.avatar || fav.avatar })
            : fav;
        });
      } else {
        item.at = Date.now();
        favorites = [item].concat(favorites).slice(0, 100);
      }
      persistFavorites();
      return true;
    },

    removeFavorite: function (slug) {
      var clean = normalizeSlug(slug).toLowerCase();
      var before = favorites.length;
      favorites = favorites.filter(function (item) {
        return item.slug.toLowerCase() !== clean;
      });
      if (favorites.length !== before) persistFavorites();
      return favorites.length !== before;
    },

    toggleFavorite: function (channel) {
      var item = normalizeEntry(channel, 'at');
      if (!item) return false;
      if (Store.isFavorite(item.slug)) {
        Store.removeFavorite(item.slug);
        return false;
      }
      Store.addFavorite(item);
      return true;
    },

    getRecent: function () {
      return recent.slice();
    },

    pushRecent: function (channel) {
      var item = normalizeEntry(channel, 'at');
      if (!item) return;
      item.at = Date.now();
      recent = [item].concat(recent.filter(function (entry) {
        return entry.slug.toLowerCase() !== item.slug.toLowerCase();
      })).slice(0, 12);
      persistRecent();
    },

    clearRecent: function () {
      recent = [];
      persistRecent();
    },

    getSettings: function () {
      return Object.assign({}, settings);
    },

    setSetting: function (key, value) {
      if (key !== 'reduceMotion' && key !== 'autoplay') return;
      settings[key] = !!value;
      write(KEYS.settings, settings);
      emit();
    },

    clearAll: function () {
      favorites = [];
      recent = [];
      settings = { reduceMotion: false, autoplay: true };
      try {
        window.localStorage.removeItem(KEYS.favorites);
        window.localStorage.removeItem(KEYS.recent);
        window.localStorage.removeItem(KEYS.settings);
        window.localStorage.removeItem(KEYS.legacyFavorites);
        window.localStorage.removeItem(KEYS.legacyRecent);
      } catch (err) {
        /* ignore */
      }
      emit();
    }
  };

  migrateLegacy();
  window.KickTVStore = Store;
})();
