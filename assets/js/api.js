/* Kick public web API client.
 * Uses the same JSON endpoints that kick.com serves to its own website.
 * No key, no proxy, no scraping. If the console browser blocks the request,
 * callers receive a typed error and the UI degrades to manual channel entry.
 */
(function () {
  'use strict';

  var CFG = window.KICKTV_CONFIG;
  var API = CFG.api;
  var cache = Object.create(null);

  function ApiError(kind, message, status) {
    this.name = 'ApiError';
    this.kind = kind;
    this.message = message || kind;
    this.status = status || 0;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function now() {
    return Date.now();
  }

  function readCache(key) {
    var hit = cache[key];
    if (!hit) return null;
    if (now() - hit.time > API.cacheTtlMs) {
      delete cache[key];
      return null;
    }
    return hit.value;
  }

  function writeCache(key, value) {
    cache[key] = { time: now(), value: value };
    return value;
  }

  function buildUrl(template, values) {
    return API.base + template.replace(/\{(\w+)\}/g, function (match, name) {
      return encodeURIComponent(values[name] || '');
    });
  }

  function fetchJson(url) {
    if (typeof window.fetch !== 'function') {
      return Promise.reject(new ApiError('unsupported', 'fetch is unavailable'));
    }

    var controller = null;
    var timer = null;
    var options = {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    };

    if (typeof window.AbortController === 'function') {
      controller = new window.AbortController();
      options.signal = controller.signal;
      timer = window.setTimeout(function () {
        controller.abort();
      }, API.timeoutMs);
    }

    return window.fetch(url, options).then(function (response) {
      if (timer) window.clearTimeout(timer);
      if (!response.ok) {
        throw new ApiError(
          response.status === 403 || response.status === 429 ? 'blocked' : 'http',
          'Kick API responded with ' + response.status,
          response.status
        );
      }
      return response.json().catch(function () {
        throw new ApiError('parse', 'Kick API returned invalid JSON');
      });
    }).catch(function (err) {
      if (timer) window.clearTimeout(timer);
      if (err instanceof ApiError) throw err;
      if (err && err.name === 'AbortError') {
        throw new ApiError('timeout', 'Kick API request timed out');
      }
      throw new ApiError('network', 'Kick API is unreachable from this browser');
    });
  }

  function absoluteImage(url) {
    if (!url || typeof url !== 'string') return '';
    if (url.indexOf('https://') === 0) return url;
    if (url.indexOf('//') === 0) return 'https:' + url;
    return '';
  }

  function pickCategory(livestream) {
    if (!livestream || !Array.isArray(livestream.categories) || !livestream.categories.length) {
      return null;
    }
    var category = livestream.categories[0];
    if (!category || typeof category !== 'object') return null;
    return {
      name: String(category.name || ''),
      slug: String(category.slug || '')
    };
  }

  function normalizeChannel(payload, seed) {
    var source = payload && typeof payload === 'object' ? payload : {};
    var user = source.user && typeof source.user === 'object' ? source.user : {};
    var live = source.livestream && typeof source.livestream === 'object' ? source.livestream : null;
    var slug = String(source.slug || (seed && seed.slug) || '').toLowerCase();
    var avatar = absoluteImage(user.profilePic || user.profile_pic || (seed && seed.avatar));
    var thumbnail = live && live.thumbnail && typeof live.thumbnail === 'object'
      ? absoluteImage(live.thumbnail.url)
      : '';
    var banner = source.banner_image && typeof source.banner_image === 'object'
      ? absoluteImage(source.banner_image.url)
      : '';

    return {
      slug: slug,
      name: String(user.username || source.name || (seed && seed.name) || slug),
      avatar: avatar,
      verified: !!source.verified,
      followers: Number(source.followers_count || source.followersCount || 0) || 0,
      isBanned: !!source.is_banned,
      liveKnown: true,
      isLive: !!(live && live.is_live),
      viewers: live ? (Number(live.viewer_count) || 0) : 0,
      title: live ? String(live.session_title || '') : '',
      thumbnail: thumbnail,
      banner: banner,
      category: pickCategory(live),
      startedAt: live ? String(live.start_time || '') : '',
      language: live ? String(live.language || '') : '',
      playbackUrl: String(source.playback_url || ''),
      mature: !!(live && live.is_mature)
    };
  }

  function normalizeSearchChannel(payload) {
    var source = payload && typeof payload === 'object' ? payload : {};
    var user = source.user && typeof source.user === 'object' ? source.user : {};
    var slug = String(source.slug || '').toLowerCase();
    return {
      slug: slug,
      name: String(user.username || source.slug || slug),
      avatar: absoluteImage(user.profilePic || user.profile_pic),
      verified: !!source.verified,
      followers: Number(source.followersCount || source.followers_count || 0) || 0,
      liveKnown: true,
      isLive: !!source.isLive,
      viewers: 0,
      title: '',
      thumbnail: '',
      banner: '',
      category: null,
      startedAt: '',
      language: '',
      mature: false
    };
  }

  function normalizeCategory(payload) {
    var source = payload && typeof payload === 'object' ? payload : {};
    var banner = source.banner && typeof source.banner === 'object' ? source.banner.src : '';
    return {
      slug: String(source.slug || ''),
      name: String(source.name || ''),
      viewers: Number(source.viewers) || 0,
      banner: absoluteImage(banner)
    };
  }

  function mapLimit(items, limit, worker) {
    return new Promise(function (resolve) {
      var results = new Array(items.length);
      var index = 0;
      var active = 0;
      var done = 0;

      if (!items.length) {
        resolve(results);
        return;
      }

      function launch() {
        while (active < limit && index < items.length) {
          (function (current) {
            active += 1;
            index += 1;
            Promise.resolve()
              .then(function () { return worker(items[current], current); })
              .then(function (value) { results[current] = value; })
              .catch(function (error) { results[current] = { error: error }; })
              .then(function () {
                active -= 1;
                done += 1;
                if (done === items.length) resolve(results);
                else launch();
              });
          })(index);
        }
      }

      launch();
    });
  }

  var KickApi = {
    ApiError: ApiError,

    getChannel: function (slug) {
      var clean = String(slug || '').toLowerCase();
      if (!/^[a-z0-9_]{1,25}$/.test(clean)) {
        return Promise.reject(new ApiError('invalid', 'Invalid channel name'));
      }
      var key = 'channel:' + clean;
      var cached = readCache(key);
      if (cached) return Promise.resolve(Object.assign({}, cached));

      return fetchJson(buildUrl(API.channel, { slug: clean })).then(function (payload) {
        var channel = normalizeChannel(payload, { slug: clean, name: clean });
        if (!channel.name) channel.name = clean;
        return writeCache(key, channel);
      });
    },

    getChannels: function (slugs) {
      var list = (slugs || []).slice(0, 60);
      return mapLimit(list, API.maxParallel, function (slug) {
        return KickApi.getChannel(slug).catch(function (error) {
          return { slug: slug, error: error };
        });
      }).then(function (results) {
        return results.map(function (result, i) {
          if (result && result.error) {
            return {
              slug: list[i],
              name: String(list[i]),
              error: result.error,
              liveKnown: false,
              isLive: false
            };
          }
          return result;
        });
      });
    },

    searchChannels: function (query) {
      var term = String(query || '').trim().replace(/^@+/, '').slice(0, 40);
      if (term.length < 2) {
        return Promise.resolve({ channels: [], error: null });
      }
      var key = 'search:' + term.toLowerCase();
      var cached = readCache(key);
      if (cached) return Promise.resolve(cached);

      return fetchJson(buildUrl(API.search, { query: term })).then(function (payload) {
        var raw = payload && Array.isArray(payload.channels) ? payload.channels : [];
        var channels = raw.map(normalizeSearchChannel).filter(function (channel) {
          return channel.slug && channel.liveKnown;
        });
        return writeCache(key, { channels: channels, error: null });
      });
    },

    getTopCategories: function () {
      var key = 'categories:top';
      var cached = readCache(key);
      if (cached) return Promise.resolve(cached);

      return fetchJson(API.base + API.topCategories).then(function (payload) {
        var list = Array.isArray(payload) ? payload : [];
        return writeCache(key, list.map(normalizeCategory).filter(function (category) {
          return category.slug;
        }));
      });
    },

    clearCache: function () {
      cache = Object.create(null);
    }
  };

  window.KickApi = KickApi;
})();
