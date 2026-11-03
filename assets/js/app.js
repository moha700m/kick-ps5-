/* Kick TV — TV-first Kick viewer.
 * Vanilla ES2017. No build step, no backend, no external proxy.
 */
(function () {
  'use strict';

  var CFG = window.KICKTV_CONFIG;
  var Store = window.KickTVStore;
  var Api = window.KickApi;

  var doc = document;
  var viewRoot = doc.getElementById('viewRoot');
  var SLUG_RE = /^[a-zA-Z0-9_]{1,25}$/;

  /* ------------------------------------------------------------------ */
  /* Utilities                                                          */
  /* ------------------------------------------------------------------ */

  function $(selector, root) {
    return (root || doc).querySelector(selector);
  }

  function $all(selector, root) {
    return Array.prototype.slice.call((root || doc).querySelectorAll(selector));
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function safeSlug(value) {
    var slug = String(value || '').toLowerCase();
    return SLUG_RE.test(slug) ? slug : '';
  }

  function safeCategorySlug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9+-]/g, '').slice(0, 60);
  }

  function initial(value) {
    var text = String(value || '').trim();
    return text ? text.charAt(0).toUpperCase() : 'K';
  }

  function isPS5() {
    return /PlayStation/i.test(window.navigator.userAgent || '');
  }

  function formatCount(value) {
    var number = Number(value) || 0;
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (number >= 1000) {
      return (number / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return String(number);
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function formatClock(timestamp) {
    var date = new Date(timestamp || Date.now());
    return pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  function parseKickDate(value) {
    var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;
    return new Date(Date.UTC(
      Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      Number(match[4]), Number(match[5]), Number(match[6])
    ));
  }

  function timeAgo(timestamp) {
    var diff = Math.max(0, Date.now() - Number(timestamp || 0));
    var minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return 'منذ ' + minutes + ' دقيقة';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return 'منذ ' + hours + ' ساعة';
    var days = Math.floor(hours / 24);
    return 'منذ ' + days + ' يوم';
  }

  function channelSeed(slug) {
    var clean = String(slug || '').toLowerCase();
    for (var i = 0; i < CFG.featuredChannels.length; i += 1) {
      if (CFG.featuredChannels[i].slug === clean) return CFG.featuredChannels[i];
    }
    return { slug: clean, name: clean };
  }

  function setText(id, text) {
    var node = doc.getElementById(id);
    if (node) node.textContent = text;
  }

  function setHTML(id, html) {
    var node = doc.getElementById(id);
    if (node) node.innerHTML = html;
  }

  var ICONS = {
    play: '<path d="M8 5.4v13.2L19 12z" fill="currentColor" stroke="none"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    back: '<path d="M9 6l6 6-6 6"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z"/>',
    starFill: '<path d="M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z" fill="currentColor"/>',
    expand: '<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1.2 1-1.2 1.9"/><path d="M12 17h.01"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
    tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M12 18v3"/>',
    gamepad: '<path d="M7 8h10a5 5 0 0 1 4.6 7l-1 2.2a2.4 2.4 0 0 1-4 .6L15 16H9l-1.6 1.8a2.4 2.4 0 0 1-4-.6L2.4 15A5 5 0 0 1 7 8z"/><path d="M7.5 11v3M6 12.5h3M16.5 11.5h.01M18 13.5h.01"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    arrowLeft: '<path d="M15 6l-6 6 6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>'
  };

  function icon(name, extraClass) {
    var body = ICONS[name] || '';
    return '<svg class="icon ' + (extraClass || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* State                                                              */
  /* ------------------------------------------------------------------ */

  var state = {
    route: { name: 'home', params: {} },
    previousHash: '',
    featured: [],
    featuredBySlug: {},
    featuredLoading: false,
    featuredError: null,
    lastSync: 0,
    categories: [],
    categoriesLoading: false,
    categoriesError: null,
    search: { query: '', loading: false, error: null, results: null, requestId: 0 },
    player: { slug: '', channel: null, loaded: false, error: null, poll: null, hintTimer: null },
    modalOpen: false,
    lastFocus: null
  };

  /* ------------------------------------------------------------------ */
  /* Data loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadFeatured(force) {
    if (state.featuredLoading) return state.featuredPromise;
    if (state.featured.length && !force && state.featuredError === null) {
      return Promise.resolve(state.featured);
    }

    state.featuredLoading = true;
    state.featuredError = null;
    updateHeaderStatus();

    var seeds = CFG.featuredChannels;
    var slugs = seeds.map(function (seed) { return seed.slug; });

    state.featuredPromise = Api.getChannels(slugs).then(function (results) {
      var bySeed = {};
      seeds.forEach(function (seed) { bySeed[seed.slug] = seed; });

      var mapped = results.map(function (item) {
        var seed = bySeed[item.slug] || { slug: item.slug, name: item.slug };
        if (item && !item.error) {
          return Object.assign({}, item, { name: item.name || seed.name });
        }
        return {
          slug: item.slug || seed.slug,
          name: seed.name,
          avatar: '',
          verified: false,
          followers: 0,
          liveKnown: false,
          isLive: false,
          viewers: 0,
          title: '',
          thumbnail: '',
          banner: '',
          category: null,
          startedAt: '',
          language: '',
          mature: false,
          error: item.error || null
        };
      });

      var failures = mapped.filter(function (channel) { return !!channel.error; }).length;
      if (failures === mapped.length) {
        state.featuredError = (mapped[0] && mapped[0].error) || new Error('Kick API unavailable');
      }

      state.featured = mapped.sort(function (a, b) {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        return (b.viewers || 0) - (a.viewers || 0);
      });

      state.featuredBySlug = {};
      state.featured.forEach(function (channel) {
        state.featuredBySlug[channel.slug] = channel;
      });
      state.lastSync = Date.now();
      return state.featured;
    }).catch(function (error) {
      state.featuredError = error;
      state.featured = CFG.featuredChannels.map(function (seed) {
        return {
          slug: seed.slug,
          name: seed.name,
          avatar: '',
          verified: false,
          followers: 0,
          liveKnown: false,
          isLive: false,
          viewers: 0,
          title: '',
          thumbnail: '',
          banner: '',
          category: null,
          error: error
        };
      });
      state.featuredBySlug = {};
      state.featured.forEach(function (channel) { state.featuredBySlug[channel.slug] = channel; });
      return state.featured;
    }).then(function (list) {
      state.featuredLoading = false;
      hydrateCurrentView();
      return list;
    });

    return state.featuredPromise;
  }

  function loadCategories(force) {
    if (state.categoriesLoading) return state.categoriesPromise;
    if (state.categories.length && !force) return Promise.resolve(state.categories);

    state.categoriesLoading = true;
    state.categoriesPromise = Api.getTopCategories().then(function (list) {
      state.categories = list;
      state.categoriesError = null;
      return list;
    }).catch(function (error) {
      state.categoriesError = error;
      state.categories = CFG.fallbackCategories.map(function (category) {
        return { slug: category.slug, name: category.name, viewers: 0, banner: '' };
      });
      return state.categories;
    }).then(function (list) {
      state.categoriesLoading = false;
      hydrateCurrentView();
      return list;
    });

    return state.categoriesPromise;
  }

  function hydrateCurrentView() {
    if (state.route.name === 'home') hydrateHome();
    if (state.route.name === 'browse') hydrateRoster();
    if (state.route.name === 'watch') hydrateRelated();
    updateHeaderStatus();
  }

  function liveChannels() {
    return state.featured.filter(function (channel) { return channel.isLive; });
  }

  function totalViewers() {
    return liveChannels().reduce(function (sum, channel) { return sum + (channel.viewers || 0); }, 0);
  }

  /* ------------------------------------------------------------------ */
  /* Card templates                                                     */
  /* ------------------------------------------------------------------ */

  function skeletonCards(count, className) {
    var html = '';
    for (var i = 0; i < count; i += 1) {
      html += '<div class="card card-skeleton ' + (className || '') + '" aria-hidden="true">' +
        '<div class="sk sk-media"></div>' +
        '<div class="card-body"><div class="sk sk-line"></div><div class="sk sk-line short"></div></div>' +
        '</div>';
    }
    return html;
  }

  function channelBadges(channel) {
    if (channel.isLive) {
      return '<span class="pill pill-live"><span class="pulse" aria-hidden="true"></span>مباشر</span>' +
        (channel.viewers ? '<span class="pill pill-views">' + icon('eye') + '<span dir="ltr">' + formatCount(channel.viewers) + '</span></span>' : '');
    }
    if (channel.liveKnown) {
      return '<span class="pill pill-off">غير متصل</span>';
    }
    return '<span class="pill pill-unknown">—</span>';
  }

  function avatarMarkup(channel, sizeClass) {
    var klass = 'avatar ' + (sizeClass || '');
    if (channel.avatar) {
      return '<span class="' + klass + '"><img class="avatar-img" src="' + esc(channel.avatar) + '" alt="" loading="lazy" decoding="async"><span class="avatar-letter" aria-hidden="true">' + esc(initial(channel.name)) + '</span></span>';
    }
    return '<span class="' + klass + '"><span class="avatar-letter" aria-hidden="true">' + esc(initial(channel.name)) + '</span></span>';
  }

  function cardHTML(channel, options) {
    var opts = options || {};
    var slug = safeSlug(channel.slug);
    if (!slug) return '';
    var name = esc(channel.name || channel.slug);
    var title = esc(channel.title || channel.name || channel.slug);
    var liveClass = channel.isLive ? ' is-live' : '';
    var mediaSrc = channel.thumbnail || channel.banner || '';
    var fallback = channel.thumbnail && channel.banner ? ' data-fallback="' + esc(channel.banner) + '"' : '';
    var thumb = mediaSrc
      ? '<img class="card-img" src="' + esc(mediaSrc) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"' + fallback + '>'
      : '';
    var category = channel.category && channel.category.name
      ? '<span class="dot" aria-hidden="true">·</span><span class="card-cat">' + esc(channel.category.name) + '</span>'
      : '';
    var verified = channel.verified ? '<span class="verified" title="حساب موثّق">' + icon('check') + '</span>' : '';

    return '<a class="card' + liveClass + (opts.compact ? ' card-compact' : '') + '" href="#/watch/' + encodeURIComponent(slug) + '" data-channel="' + esc(slug) + '">' +
      '<span class="card-media">' +
        '<span class="card-monogram" aria-hidden="true">' + esc(initial(channel.name)) + '</span>' +
        thumb +
        '<span class="card-badges">' + channelBadges(channel) + '</span>' +
        '<span class="card-play" aria-hidden="true">' + icon('play') + '</span>' +
      '</span>' +
      '<span class="card-body">' +
        '<span class="card-title" dir="auto">' + title + '</span>' +
        '<span class="card-meta">' + avatarMarkup(channel, 'avatar-xs') +
          '<span class="card-name">' + name + '</span>' + verified + category +
        '</span>' +
      '</span>' +
    '</a>';
  }

  function heroCardHTML(channel) {
    if (!channel || !channel.isLive) return '';
    var slug = safeSlug(channel.slug);
    if (!slug) return '';
    return '<a class="hero-card" href="#/watch/' + encodeURIComponent(slug) + '" data-channel="' + esc(slug) + '" aria-label="شاهد ' + esc(channel.name) + ' الآن">' +
      '<span class="hero-card-media">' +
        '<span class="hero-card-mono" aria-hidden="true">' + esc(initial(channel.name)) + '</span>' +
        (channel.thumbnail || channel.banner
          ? '<img class="hero-card-img" src="' + esc(channel.thumbnail || channel.banner) + '" alt="" decoding="async" referrerpolicy="no-referrer"' +
            (channel.thumbnail && channel.banner ? ' data-fallback="' + esc(channel.banner) + '"' : '') + '>'
          : '') +
      '</span>' +
      '<span class="hero-card-shade" aria-hidden="true"></span>' +
      '<span class="hero-card-top">' +
        '<span class="pill pill-live"><span class="pulse" aria-hidden="true"></span>مباشر الآن</span>' +
        '<span class="pill pill-views">' + icon('eye') + '<span dir="ltr">' + formatCount(channel.viewers) + '</span></span>' +
      '</span>' +
      '<span class="hero-card-body">' +
        '<span class="hero-card-kicker">الأكثر مشاهدة الآن</span>' +
        '<strong class="hero-card-title" dir="auto">' + esc(channel.title || channel.name) + '</strong>' +
        '<span class="hero-card-meta">' + avatarMarkup(channel, 'avatar-sm') + '<span>' + esc(channel.name) + '</span>' +
          (channel.category && channel.category.name ? '<span class="dot" aria-hidden="true">·</span><span>' + esc(channel.category.name) + '</span>' : '') +
        '</span>' +
        '<span class="hero-card-cta">' + icon('play') + 'شاهد الآن</span>' +
      '</span>' +
    '</a>';
  }

  function heroArtHTML() {
    return '<div class="hero-art" aria-hidden="true">' +
      '<span class="hero-art-ring ring-1"></span>' +
      '<span class="hero-art-ring ring-2"></span>' +
      '<span class="hero-art-grid"></span>' +
      '<span class="hero-art-badge">K</span>' +
      '<span class="hero-art-word">KICK<span>TV</span></span>' +
      '<span class="hero-art-note">PS5 · BIG SCREEN</span>' +
    '</div>';
  }

  function categoryCardHTML(category) {
    var slug = safeCategorySlug(category.slug);
    if (!slug) return '';
    var views = category.viewers
      ? '<span dir="ltr">' + formatCount(category.viewers) + '</span> مشاهد'
      : 'تصنيف على Kick';
    return '<a class="cat-card" href="https://kick.com/category/' + encodeURIComponent(slug) + '" target="_blank" rel="noopener noreferrer">' +
      '<span class="cat-media">' +
        '<span class="cat-mono" aria-hidden="true">' + esc(initial(category.name)) + '</span>' +
        (category.banner ? '<img class="cat-img" src="' + esc(category.banner) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
      '</span>' +
      '<span class="cat-shade" aria-hidden="true"></span>' +
      '<span class="cat-body"><strong>' + esc(category.name) + '</strong><small>' + views + '</small></span>' +
      '<span class="cat-ext" aria-hidden="true">' + icon('external') + '</span>' +
    '</a>';
  }

  function emptyState(title, text, actionHTML, iconName) {
    return '<div class="empty">' +
      '<span class="empty-icon">' + icon(iconName || 'tv') + '</span>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(text) + '</p>' +
      (actionHTML || '') +
    '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Views                                                             */
  /* ------------------------------------------------------------------ */

  function homeHTML() {
    return '<div class="view view-home">' +
      '<section class="hero">' +
        '<div class="hero-copy">' +
          '<p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>بث مباشر على شاشتك</p>' +
          '<h1 class="hero-title" id="pageTitle" tabindex="-1">شاهد <span class="text-green">Kick</span><br>على الشاشة الكبيرة.</h1>' +
          '<p class="hero-text">واجهة تلفزيونية سريعة لقنوات Kick، تعمل داخل متصفح PS5 بدون تطبيق إضافي وبدون تسجيل دخول.</p>' +
          '<div class="hero-actions">' +
            '<a class="btn btn-primary" href="#/browse">' + icon('grid') + 'استكشف القنوات</a>' +
            '<button class="btn btn-ghost" type="button" data-action="focus-search">' + icon('search') + 'ابحث عن قناة</button>' +
          '</div>' +
          '<dl class="hero-stats" id="heroStats">' +
            '<div><dt>قنوات مباشرة</dt><dd id="statLive">—</dd></div>' +
            '<div><dt>مشاهد الآن</dt><dd id="statViewers">—</dd></div>' +
            '<div><dt>آخر تحديث</dt><dd id="statSync">—</dd></div>' +
          '</dl>' +
        '</div>' +
        '<div class="hero-stage" id="heroStage">' + heroArtHTML() + '</div>' +
      '</section>' +

      '<section class="section" aria-labelledby="liveTitle">' +
        '<div class="section-head">' +
          '<div><p class="section-kicker">LIVE ON KICK</p><h2 id="liveTitle"><span id="liveTitleText">مباشر الآن</span> <span class="count" id="liveCount"></span></h2>' +
            '<p class="section-note">قنوات مختارة نتحقق من حالة بثها مباشرة من Kick.</p></div>' +
          '<div class="section-tools"><span class="sync" id="liveMeta">جارٍ تحميل بيانات Kick…</span><a class="link-more" href="#/browse">عرض الكل' + icon('back') + '</a></div>' +
        '</div>' +
        '<div class="rail" id="liveRail">' + skeletonCards(6) + '</div>' +
      '</section>' +

      '<div class="split">' +
        '<section class="section" aria-labelledby="recentTitle">' +
          '<div class="section-head"><div><h2 id="recentTitle">تابع المشاهدة</h2></div><a class="link-more" href="#/favorites">المفضلة' + icon('back') + '</a></div>' +
          '<div class="rail rail-sm" id="recentRail"></div>' +
        '</section>' +
        '<section class="section" aria-labelledby="favTitle">' +
          '<div class="section-head"><div><h2 id="favTitle">قنواتك المفضلة</h2></div><a class="link-more" href="#/favorites">الكل' + icon('back') + '</a></div>' +
          '<div class="rail rail-sm" id="favRail"></div>' +
        '</section>' +
      '</div>' +

      '<section class="section" aria-labelledby="catTitle">' +
        '<div class="section-head">' +
          '<div><p class="section-kicker">BROWSE KICK</p><h2 id="catTitle">تصنيفات رائجة</h2></div>' +
          '<a class="link-more" href="https://kick.com/browse" target="_blank" rel="noopener noreferrer">دليل Kick الكامل' + icon('external') + '</a>' +
        '</div>' +
        '<div class="grid grid-cats" id="categoryGrid">' + skeletonCards(8, 'cat-skeleton') + '</div>' +
      '</section>' +

      '<div class="callout callout-soft" id="homeNotice" hidden></div>' +
    '</div>';
  }

  function browseHTML(query) {
    return '<div class="view view-browse">' +
      '<header class="page-head">' +
        '<p class="eyebrow">DISCOVER</p>' +
        '<h1 id="pageTitle" tabindex="-1">استكشاف القنوات</h1>' +
        '<p class="page-text">ابحث باسم القناة على Kick، أو ابدأ من قناة مقترحة. حالة البث والمشاهدون تُجلب مباشرة من واجهة Kick العامة.</p>' +
        '<form class="search-box" id="browseSearchForm" role="search">' +
          '<span class="search-icon" aria-hidden="true">' + icon('search') + '</span>' +
          '<input id="browseSearchInput" name="q" type="search" autocomplete="off" spellcheck="false" ' +
            'placeholder="ابحث عن قناة على Kick…" aria-label="ابحث عن قناة على Kick" value="' + esc(query || '') + '">' +
          '<button class="btn btn-primary" type="submit">بحث</button>' +
        '</form>' +
        '<div class="quick-links" aria-label="اقتراحات بحث">' +
          '<span>جرّب:</span>' +
          ['xqc', 'adinross', 'westcol', '3mr'].map(function (name) {
            return '<a class="chip" href="#/search/' + encodeURIComponent(name) + '">' + esc(name) + '</a>';
          }).join('') +
        '</div>' +
      '</header>' +

      '<div id="searchArea"></div>' +

      '<section class="section" aria-labelledby="catTitleBrowse">' +
        '<div class="section-head"><div><p class="section-kicker">CATEGORIES</p><h2 id="catTitleBrowse">تصنيفات Kick</h2></div>' +
          '<span class="sync" id="catMeta"></span></div>' +
        '<div class="grid grid-cats" id="categoryGrid">' + skeletonCards(8, 'cat-skeleton') + '</div>' +
      '</section>' +

      '<section class="section" aria-labelledby="rosterTitle">' +
        '<div class="section-head"><div><p class="section-kicker">SUGGESTED</p><h2 id="rosterTitle">قنوات مقترحة</h2></div>' +
          '<span class="sync" id="rosterMeta">جارٍ التحميل…</span></div>' +
        '<div class="grid grid-channels" id="rosterGrid">' + skeletonCards(8) + '</div>' +
      '</section>' +

      '<div class="callout callout-soft" id="browseNotice" hidden></div>' +
    '</div>';
  }

  function favoritesHTML() {
    return '<div class="view view-favorites">' +
      '<header class="page-head page-head-row">' +
        '<div><p class="eyebrow">YOUR LIST</p><h1 id="pageTitle" tabindex="-1">المفضلة</h1>' +
        '<p class="page-text" id="favSummary">قنواتك المحفوظة على هذا الجهاز.</p></div>' +
        '<button class="btn btn-ghost btn-danger" type="button" data-action="clear-favorites">' + icon('trash') + 'مسح القائمة</button>' +
      '</header>' +
      '<div class="grid grid-channels" id="favGrid"></div>' +
    '</div>';
  }

  function watchHTML(slug) {
    var seed = channelSeed(slug);
    var directUrl = playerUrl(slug, false);
    return '<div class="view view-watch" data-slug="' + esc(slug) + '">' +
      '<div class="watch-top">' +
        '<button class="btn btn-icon" type="button" data-action="back" aria-label="رجوع">' + icon('back') + '</button>' +
        '<div class="watch-id">' +
          '<span id="watchAvatar">' + avatarMarkup(seed, 'avatar-lg') + '</span>' +
          '<div class="watch-id-text">' +
            '<h1 id="watchName" tabindex="-1" dir="auto">' + esc(seed.name) + '</h1>' +
            '<p class="watch-sub" id="watchSub"><span class="pill pill-unknown">جارٍ التحقق…</span></p>' +
          '</div>' +
        '</div>' +
        '<div class="watch-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="toggle-favorite" id="watchFav" aria-pressed="false">' + icon('star') + '<span>أضف للمفضلة</span></button>' +
          '<button class="btn btn-ghost" type="button" data-action="fullscreen">' + icon('expand') + '<span>ملء الشاشة</span></button>' +
        '</div>' +
      '</div>' +

      '<div id="offlineNotice" class="callout callout-warn" hidden></div>' +

      '<div id="ps5Notice" class="callout callout-warn ps5-notice" hidden>' +
        '<span class="callout-icon">' + icon('info') + '</span>' +
        '<span class="callout-text"><strong>ملاحظة PS5:</strong> إذا ظهرت رسالة <span dir="ltr">Oops something went wrong</span> في مشغل Kick، جرّب «تشغيل HLS مباشر» — يشغّل نفس البث من مصدر Kick عبر مشغل الفيديو المدمج في PS5.</span>' +
      '</div>' +

      '<div class="player-shell" id="playerShell">' +
        '<div class="player-frame" id="playerFrame">' +
          '<div class="player-poster" id="playerPoster" hidden>' +
            '<span class="poster-kicker">KICK PLAYER</span>' +
            '<strong class="poster-title" dir="auto">' + esc(seed.name) + '</strong>' +
            '<span class="poster-text">جرّب «تشغيل HLS مباشر» أولاً — يشغّل البث عبر مشغل الفيديو المدمج في PS5 بدون واجهة Kick. وإذا لم يعمل، استخدم مشغل PlayStation الرسمي.</span>' +
            '<div class="poster-actions">' +
              '<button class="btn btn-primary" type="button" data-action="start-native-player">' + icon('play') + 'تشغيل HLS مباشر</button>' +
              '<button class="btn btn-ghost" type="button" data-action="start-player">' + icon('tv') + 'مشغل PlayStation الرسمي</button>' +
              '<a class="btn btn-ghost" id="posterDirectLink" data-action="open-direct-player" href="' + esc(directUrl) + '" target="_blank" rel="noopener noreferrer">' + icon('external') + 'فتح المشغل مباشرة</a>' +
            '</div>' +
          '</div>' +
          '<iframe id="kickPlayer" class="player-iframe" src="about:blank" title="مشغل Kick لقناة ' + esc(seed.name) + '" ' +
            'allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen ' +
            'referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
          '<video id="nativePlayer" class="native-player" controls playsinline preload="metadata" hidden></video>' +
          '<div class="player-loading" id="playerLoading"><span class="spinner" aria-hidden="true"></span><span>جاري تحميل مشغل Kick…</span></div>' +
        '</div>' +
        '<div class="player-hint" id="playerHint" hidden>' +
          '<span class="player-hint-icon">' + icon('info') + '</span>' +
          '<span class="player-hint-text" id="playerHintText">إذا كانت الشاشة سوداء، فقد يمنع متصفح التلفزيون تشغيل الفيديو تلقائياً.</span>' +
          '<button class="btn btn-small" type="button" data-action="reload-player">' + icon('refresh') + 'إعادة المحاولة</button>' +
        '</div>' +
      '</div>' +

      '<div class="player-bar">' +
        '<span class="player-state" id="playerState">جارٍ تجهيز المشغل…</span>' +
        '<div class="player-bar-actions">' +
          '<a class="btn btn-ghost btn-small" id="directPlayerLink" data-action="open-direct-player" href="' + esc(directUrl) + '" target="_blank" rel="noopener noreferrer">' + icon('play') + 'فتح المشغل مباشرة</a>' +
          '<a class="btn btn-ghost btn-small" id="kickLink" href="https://kick.com/' + encodeURIComponent(slug) + '" target="_blank" rel="noopener noreferrer">' + icon('external') + 'فتح على Kick</a>' +
          '<button class="btn btn-ghost btn-small" type="button" data-action="start-player">' + icon('tv') + 'مشغل PlayStation</button>' +
          '<button class="btn btn-ghost btn-small" type="button" data-action="start-native-player">' + icon('play') + 'HLS مباشر</button>' +
          '<button class="btn btn-ghost btn-small" type="button" data-action="reload-player">' + icon('refresh') + 'إعادة تحميل</button>' +
        '</div>' +
      '</div>' +

      '<div class="watch-grid" id="watchInfo">' +
        '<div class="info-card"><span class="info-label">المتابعون</span><strong class="info-value" id="infoFollowers">—</strong></div>' +
        '<div class="info-card"><span class="info-label">التصنيف</span><strong class="info-value" id="infoCategory">—</strong></div>' +
        '<div class="info-card"><span class="info-label">اللغة</span><strong class="info-value" id="infoLanguage">—</strong></div>' +
        '<div class="info-card"><span class="info-label">بدأ البث</span><strong class="info-value" id="infoStarted">—</strong></div>' +
        '<div class="info-card info-card-wide"><span class="info-label">عنوان البث</span><strong class="info-value" id="infoTitle" dir="auto">—</strong></div>' +
      '</div>' +

      '<section class="section" aria-labelledby="relatedTitle">' +
        '<div class="section-head"><div><h2 id="relatedTitle">قنوات مباشرة أخرى</h2></div><a class="link-more" href="#/browse">استكشاف' + icon('back') + '</a></div>' +
        '<div class="rail" id="relatedRail">' + skeletonCards(4) + '</div>' +
      '</section>' +
    '</div>';
  }

  function notFoundHTML() {
    return '<div class="view view-empty">' + emptyState(
      'الصفحة غير موجودة',
      'الرابط الذي فتحته غير معروف. يمكنك العودة إلى الرئيسية أو استكشاف القنوات.',
      '<div class="empty-actions"><a class="btn btn-primary" href="#/">الرئيسية</a><a class="btn btn-ghost" href="#/browse">استكشاف</a></div>',
      'info'
    ) + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* Hydration                                                          */
  /* ------------------------------------------------------------------ */

  function mergedStored(entry) {
    var live = state.featuredBySlug[entry.slug];
    if (live) {
      return Object.assign({}, live, {
        name: live.name || entry.name,
        avatar: live.avatar || entry.avatar
      });
    }
    return {
      slug: entry.slug,
      name: entry.name,
      avatar: entry.avatar,
      verified: false,
      liveKnown: false,
      isLive: false,
      viewers: 0,
      title: '',
      thumbnail: '',
      banner: '',
      category: null
    };
  }

  function renderStoredRail(id, entries, emptyText) {
    var rail = doc.getElementById(id);
    if (!rail) return;
    if (!entries.length) {
      rail.innerHTML = '<div class="rail-empty">' + icon('star') + '<span>' + esc(emptyText) + '</span></div>';
      return;
    }
    rail.innerHTML = entries.map(function (entry) {
      return cardHTML(mergedStored(entry), { compact: true });
    }).join('');
  }

  function hydrateCategories(gridId) {
    var grid = doc.getElementById(gridId);
    if (!grid) return;
    if (!state.categories.length && !state.categoriesError) {
      grid.innerHTML = skeletonCards(8, 'cat-skeleton');
      return;
    }
    var list = state.categories.length ? state.categories : CFG.fallbackCategories;
    grid.innerHTML = list.map(categoryCardHTML).join('');

    var meta = doc.getElementById('catMeta');
    if (meta) {
      meta.textContent = state.categoriesError
        ? 'تعذر تحديث الأرقام — الروابط رسمية'
        : 'بيانات مباشرة من Kick';
    }
  }

  function hydrateHome() {
    var heroStage = doc.getElementById('heroStage');
    if (!heroStage) return;

    var live = liveChannels();
    heroStage.innerHTML = live.length ? heroCardHTML(live[0]) : heroArtHTML();

    setText('statLive', String(live.length));
    setText('statViewers', formatCount(totalViewers()));
    setText('statSync', state.lastSync ? formatClock(state.lastSync) : '—');

    var rail = doc.getElementById('liveRail');
    if (rail) {
      if (!state.featured.length && !state.featuredError) {
        rail.innerHTML = skeletonCards(6);
      } else if (live.length) {
        rail.innerHTML = live.slice(0, 14).map(function (channel) {
          return cardHTML(channel);
        }).join('');
      } else if (state.featured.length) {
        rail.innerHTML = state.featured.slice(0, 12).map(function (channel) {
          return cardHTML(channel);
        }).join('');
      } else {
        rail.innerHTML = '<div class="rail-empty">' + icon('tv') + '<span>لا توجد بيانات قنوات متاحة الآن.</span></div>';
      }
    }

    setText('liveTitleText', live.length ? 'مباشر الآن' : 'قنوات مقترحة');
    setText('liveCount', live.length ? String(live.length) : '');
    setText('liveMeta', state.featuredError
      ? 'تعذر جلب البيانات المباشرة'
      : (state.lastSync ? 'آخر تحديث ' + formatClock(state.lastSync) : 'جارٍ التحديث…'));

    renderStoredRail('recentRail', Store.getRecent().slice(0, 8), 'لم تشاهد أي قناة بعد.');
    renderStoredRail('favRail', Store.getFavorites().slice(0, 8), 'أضف قنواتك من صفحة المشاهدة.');
    hydrateCategories('categoryGrid');

    var notice = doc.getElementById('homeNotice');
    if (notice) {
      if (state.featuredError) {
        notice.hidden = false;
        notice.innerHTML = '<span class="callout-icon">' + icon('info') + '</span>' +
          '<span class="callout-text"><strong>تعذر الاتصال بواجهة Kick من هذا المتصفح.</strong> ' +
          'قد يمنع المتصفح الطلبات الخارجية أو تكون الشبكة محجوبة. يمكنك تشغيل أي قناة بكتابة اسمها؛ المشغل يُحمّل مباشرة من player.kick.com.</span>' +
          '<button class="btn btn-small" type="button" data-action="retry-data">' + icon('refresh') + 'إعادة المحاولة</button>';
      } else {
        notice.hidden = true;
        notice.innerHTML = '';
      }
    }
  }

  function hydrateRoster() {
    var grid = doc.getElementById('rosterGrid');
    if (!grid) return;
    if (!state.featured.length && !state.featuredError) {
      grid.innerHTML = skeletonCards(8);
    } else {
      var list = state.featured.length ? state.featured : CFG.featuredChannels;
      grid.innerHTML = list.map(function (channel) {
        if (!channel.liveKnown && !channel.isLive && !channel.error) {
          return cardHTML({
            slug: channel.slug,
            name: channel.name,
            liveKnown: false,
            isLive: false,
            viewers: 0
          });
        }
        return cardHTML(channel);
      }).join('');
    }

    setText('rosterMeta', state.featuredError
      ? 'حالة البث غير متاحة من هذا المتصفح'
      : (state.lastSync ? liveChannels().length + ' قناة مباشرة · ' + formatClock(state.lastSync) : 'جارٍ التحميل…'));

    hydrateCategories('categoryGrid');

    var notice = doc.getElementById('browseNotice');
    if (notice) {
      if (state.featuredError) {
        notice.hidden = false;
        notice.innerHTML = '<span class="callout-icon">' + icon('info') + '</span>' +
          '<span class="callout-text"><strong>بيانات Kick غير متاحة الآن.</strong> يمكنك البحث بالاسم أو تشغيل القناة مباشرة. المشغل يعمل من نطاق Kick الرسمي.</span>' +
          '<button class="btn btn-small" type="button" data-action="retry-data">' + icon('refresh') + 'إعادة المحاولة</button>';
      } else {
        notice.hidden = true;
      }
    }
  }

  function hydrateRelated() {
    var rail = doc.getElementById('relatedRail');
    if (!rail) return;
    var current = state.route.params.slug;
    var list = state.featured.filter(function (channel) {
      return channel.slug !== current && channel.isLive;
    });
    if (!list.length) {
      list = state.featured.filter(function (channel) { return channel.slug !== current; }).slice(0, 8);
    }
    if (!list.length) {
      rail.innerHTML = '<div class="rail-empty">' + icon('tv') + '<span>لا توجد قنوات أخرى متاحة الآن.</span></div>';
      return;
    }
    rail.innerHTML = list.slice(0, 10).map(function (channel) {
      return cardHTML(channel);
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Search                                                             */
  /* ------------------------------------------------------------------ */

  function manualPlayHTML(query) {
    var slug = safeSlug(query);
    if (!slug) return '';
    return '<button class="btn btn-ghost" type="button" data-action="watch-anyway" data-slug="' + esc(slug) + '">' +
      icon('play') + 'شغّل «' + esc(slug) + '» مباشرة</button>';
  }

  function searchAreaHTML() {
    var search = state.search;
    if (!search.query) return '';

    var body = '';
    if (search.loading) {
      body = '<div class="grid grid-channels" aria-busy="true">' + skeletonCards(8) + '</div>';
    } else if (search.error) {
      body = '<div class="callout callout-warn"><span class="callout-icon">' + icon('info') + '</span>' +
        '<span class="callout-text">تعذر البحث في Kick من هذا المتصفح. جرّب مرة أخرى أو شغّل القناة مباشرة بالاسم.</span>' +
        '<button class="btn btn-small" type="button" data-action="retry-search">' + icon('refresh') + 'إعادة المحاولة</button></div>' +
        '<div class="search-fallback">' + manualPlayHTML(search.query) + '</div>';
    } else if (search.results && search.results.length) {
      body = '<div class="grid grid-channels">' + search.results.map(function (channel) {
        return cardHTML(channel);
      }).join('') + '</div>' +
        '<div class="search-fallback">' + manualPlayHTML(search.query) + '</div>';
    } else {
      body = emptyState(
        'لا توجد نتائج',
        'لم نجد قناة بهذا الاسم في بحث Kick. تأكد من الاسم أو شغّلها مباشرة إذا كنت تعرفه.',
        manualPlayHTML(search.query),
        'search'
      );
    }

    return '<section class="section search-section" id="searchSection" aria-labelledby="searchTitle">' +
      '<div class="section-head"><div><p class="section-kicker">SEARCH</p>' +
      '<h2 id="searchTitle">نتائج البحث عن «' + esc(search.query) + '»</h2></div>' +
      (search.results && !search.loading ? '<span class="sync">' + search.results.length + ' نتيجة</span>' : '') +
      '</div>' + body + '</section>';
  }

  function renderSearchArea() {
    var area = doc.getElementById('searchArea');
    if (!area) return;
    area.innerHTML = searchAreaHTML();
  }

  function runSearch(query, force) {
    var term = String(query || '').trim();
    if (!term) return;
    if (!force && state.search.query === term && (state.search.loading || state.search.results)) {
      renderSearchArea();
      return;
    }

    state.search.query = term;
    state.search.loading = true;
    state.search.error = null;
    state.search.results = null;
    state.search.requestId += 1;
    var requestId = state.search.requestId;

    renderSearchArea();

    Api.searchChannels(term).then(function (payload) {
      if (requestId !== state.search.requestId) return;
      var results = (payload.channels || []).slice().sort(function (a, b) {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        return (b.followers || 0) - (a.followers || 0);
      });
      state.search.results = results;
      state.search.loading = false;
      state.search.error = null;
      renderSearchArea();
    }).catch(function (error) {
      if (requestId !== state.search.requestId) return;
      state.search.results = null;
      state.search.loading = false;
      state.search.error = error;
      renderSearchArea();
    });
  }

  function mountBrowse(query) {
    var form = doc.getElementById('browseSearchForm');
    var input = doc.getElementById('browseSearchInput');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var value = input ? input.value.trim() : '';
        if (value) navigate('#/search/' + encodeURIComponent(value));
        else navigate('#/browse');
      });
    }
    if (query) {
      if (input) input.value = query;
      runSearch(query);
    }
    hydrateRoster();
  }

  /* ------------------------------------------------------------------ */
  /* Watch / player                                                     */
  /* ------------------------------------------------------------------ */

  function playerUrl(slug, autoplay) {
    if (isPS5()) {
      return CFG.player.ps5Base.replace('{slug}', encodeURIComponent(slug));
    }
    return CFG.player.base.replace('{slug}', encodeURIComponent(slug)) + (autoplay ? CFG.player.params : '');
  }

  function onPlayerFrameLoad() {
    if (state.route.name !== 'watch') return;
    if (state.player.mode === 'native') return;
    var iframe = doc.getElementById('kickPlayer');
    var source = String((iframe && iframe.src) || '');
    if (!iframe || (source.indexOf('https://player.kick.com/') !== 0 && source.indexOf('https://playstation.kick.com/') !== 0)) return;
    state.player.loaded = true;
    var loading = doc.getElementById('playerLoading');
    if (loading) loading.classList.add('is-hidden');
    setText('playerState', 'تم تحميل إطار مشغل Kick. إذا لم يبدأ الفيديو فاستخدم «إعادة التحميل» أو افتح القناة على Kick.');
    iframe.classList.add('is-ready');
  }

  function showPlayerHint(force) {
    var hint = doc.getElementById('playerHint');
    if (!hint) return;
    hint.hidden = false;
    var text = doc.getElementById('playerHintText');
    if (text && force) {
      text.textContent = 'إذا ظهرت شاشة سوداء أو رسالة خطأ: قد يمنع متصفح PS5 تشغيل الفيديو التلقائي أو ملفات تعريف الارتباط. جرّب إعادة التحميل أو افتح القناة على Kick.';
    }
  }

  function resetPlayerFrame(slug) {
    var iframe = doc.getElementById('kickPlayer');
    var loading = doc.getElementById('playerLoading');
    var hint = doc.getElementById('playerHint');
    if (!iframe) return;
    if (loading) loading.classList.remove('is-hidden');
    if (hint) hint.hidden = true;
    state.player.loaded = false;
    clearTimeout(state.player.hintTimer);
    iframe.classList.remove('is-ready');
    iframe.src = 'about:blank';
    window.setTimeout(function () {
      if (state.route.name !== 'watch' || state.route.params.slug !== slug) return;
      iframe.src = playerUrl(slug, state.player.autoplay);
    }, 60);
    state.player.hintTimer = window.setTimeout(function () {
      if (!state.player.loaded) showPlayerHint(false);
    }, CFG.player.loadHintMs);
  }

  function startPlayer() {
    if (state.route.name !== 'watch') return;
    var poster = doc.getElementById('playerPoster');
    if (poster) poster.hidden = true;
    var native = doc.getElementById('nativePlayer');
    if (native) {
      native.pause();
      native.removeAttribute('src');
      native.load();
      native.hidden = true;
    }
    var iframe = doc.getElementById('kickPlayer');
    if (iframe) iframe.classList.remove('is-hidden');
    var loading = doc.getElementById('playerLoading');
    if (loading) loading.classList.remove('is-hidden');
    state.player.mode = 'official';
    state.player.deferred = false;
    resetPlayerFrame(state.route.params.slug);
    setText('playerState', 'جارٍ تحميل مشغل PlayStation…');
  }

  function startNativePlayer() {
    if (state.route.name !== 'watch') return;
    var slug = state.route.params.slug;
    var video = doc.getElementById('nativePlayer');
    if (!video) return;

    function play(channel) {
      if (!channel || !channel.playbackUrl) {
        setText('playerState', 'رابط HLS غير متاح — استخدم مشغل PlayStation الرسمي.');
        showToast('لا يوجد رابط HLS مباشر لهذه القناة');
        return;
      }
      state.player.mode = 'native';
      state.player.deferred = false;
      var poster = doc.getElementById('playerPoster');
      if (poster) poster.hidden = true;
      var iframe = doc.getElementById('kickPlayer');
      if (iframe) {
        iframe.src = 'about:blank';
        iframe.classList.add('is-hidden');
      }
      var loading = doc.getElementById('playerLoading');
      if (loading) loading.classList.add('is-hidden');
      video.hidden = false;
      video.src = channel.playbackUrl;
      setText('playerState', 'مشغل HLS مباشر — جارٍ التحميل…');
      var attempt = video.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(function () {
          setText('playerState', 'اضغط زر التشغيل داخل الفيديو لبدء البث.');
        });
      }
    }

    if (state.player.channel && state.player.channel.playbackUrl) {
      play(state.player.channel);
      return;
    }
    setText('playerState', 'جارٍ جلب رابط البث من Kick…');
    Api.getChannel(slug).then(function (channel) {
      if (state.route.name !== 'watch' || state.route.params.slug !== slug) return;
      state.player.channel = channel;
      play(channel);
    }).catch(function (error) {
      if (state.route.name !== 'watch') return;
      showWatchApiError(error);
      setText('playerState', 'تعذر جلب رابط البث — استخدم مشغل PlayStation الرسمي.');
    });
  }

  function reloadPlayer() {
    if (state.route.name !== 'watch') return;
    if (state.player.mode === 'native') {
      startNativePlayer();
      return;
    }
    if (state.player.deferred) {
      startPlayer();
      return;
    }
    resetPlayerFrame(state.route.params.slug);
    setText('playerState', 'جارٍ إعادة تحميل المشغل…');
    showToast('تمت إعادة تحميل المشغل');
  }

  function toggleFullscreen() {
    var frame = doc.getElementById('playerFrame');
    if (!frame) return;
    var fullscreenElement = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (fullscreenElement) {
      var exit = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (exit) {
        try { exit.call(doc); } catch (err) { /* ignore */ }
      }
      return;
    }
    var request = frame.requestFullscreen || frame.webkitRequestFullscreen || frame.msRequestFullscreen;
    if (!request) {
      showToast('ملء الشاشة غير مدعوم في هذا المتصفح');
      return;
    }
    try {
      var result = request.call(frame);
      if (result && typeof result.catch === 'function') {
        result.catch(function () {
          showToast('المتصفح منع ملء الشاشة — استخدم زر ملء الشاشة داخل المشغل');
        });
      }
    } catch (err) {
      showToast('المتصفح منع ملء الشاشة — استخدم زر ملء الشاشة داخل المشغل');
    }
  }

  function applyWatchChannel(channel) {
    var slug = channel.slug;
    var nameNode = doc.getElementById('watchName');
    if (nameNode) {
      nameNode.innerHTML = esc(channel.name) + (channel.verified ? ' <span class="verified verified-lg" title="حساب موثّق">' + icon('check') + '</span>' : '');
    }

    var avatar = doc.getElementById('watchAvatar');
    if (avatar) avatar.innerHTML = avatarMarkup(channel, 'avatar-lg');

    var sub = doc.getElementById('watchSub');
    if (sub) {
      var status = channel.isLive
        ? '<span class="pill pill-live"><span class="pulse" aria-hidden="true"></span>مباشر</span>'
        : (channel.liveKnown ? '<span class="pill pill-off">غير متصل</span>' : '<span class="pill pill-unknown">حالة غير معروفة</span>');
      var viewers = channel.isLive && channel.viewers
        ? '<span class="watch-viewers">' + icon('eye') + '<span dir="ltr">' + formatCount(channel.viewers) + '</span> مشاهد</span>'
        : '';
      var category = channel.category && channel.category.name
        ? '<span class="dot" aria-hidden="true">·</span><span>' + esc(channel.category.name) + '</span>'
        : '';
      sub.innerHTML = status + viewers + category;
    }

    setText('infoFollowers', channel.followers ? formatCount(channel.followers) : '—');
    setText('infoCategory', channel.category && channel.category.name ? channel.category.name : '—');
    setText('infoLanguage', channel.language || '—');
    var started = parseKickDate(channel.startedAt);
    setText('infoStarted', started ? timeAgo(started.getTime()) : '—');
    setText('infoTitle', channel.title || '—');

    var kickLink = doc.getElementById('kickLink');
    if (kickLink) kickLink.href = CFG.links.channel.replace('{slug}', encodeURIComponent(slug));

    var offline = doc.getElementById('offlineNotice');
    if (offline) {
      if (channel.liveKnown && !channel.isLive) {
        offline.hidden = false;
        offline.innerHTML = '<span class="callout-icon">' + icon('info') + '</span><span class="callout-text"><strong>القناة غير متصلة الآن.</strong> قد يعرض المشغل شاشة انتظار حتى يبدأ البث.</span>' +
          '<a class="btn btn-small" href="https://kick.com/' + encodeURIComponent(slug) + '" target="_blank" rel="noopener noreferrer">' + icon('external') + 'صفحة القناة</a>';
      } else {
        offline.hidden = true;
        offline.innerHTML = '';
      }
    }

    if (state.player.deferred) {
      setText('playerState', 'مباشر الآن — اختر «تشغيل HLS مباشر» أو «مشغل PlayStation الرسمي».');
    } else if (channel.isLive) {
      setText('playerState', 'مباشر الآن' + (channel.viewers ? ' · ' + formatCount(channel.viewers) + ' مشاهد' : ''));
    } else if (channel.liveKnown) {
      setText('playerState', 'القناة غير متصلة الآن');
    }

    document.title = channel.name + ' — Kick TV';
    updateFavButton();
  }

  function showWatchApiError(error) {
    var offline = doc.getElementById('offlineNotice');
    if (offline) {
      offline.hidden = false;
      offline.innerHTML = '<span class="callout-icon">' + icon('info') + '</span>' +
        '<span class="callout-text">تعذر جلب بيانات القناة من Kick في هذا المتصفح' +
        (error && error.kind ? ' (' + esc(error.kind) + ')' : '') +
        '. المشغل يُحمّل مباشرة من player.kick.com وقد يعمل بشكل مستقل.</span>';
    }
    setText('playerState', 'بيانات القناة غير متاحة — المشغل مستقل');
  }

  function loadWatchChannel(slug, silent) {
    Api.getChannel(slug).then(function (channel) {
      if (state.route.name !== 'watch' || state.route.params.slug !== slug) return;
      state.player.channel = channel;
      state.player.error = null;
      applyWatchChannel(channel);
    }).catch(function (error) {
      if (state.route.name !== 'watch' || state.route.params.slug !== slug) return;
      if (silent) return;
      state.player.error = error;
      showWatchApiError(error);
    });
  }

  function updateFavButton() {
    var button = doc.getElementById('watchFav');
    if (!button || state.route.name !== 'watch') return;
    var slug = state.route.params.slug;
    var isFavorite = Store.isFavorite(slug);
    button.classList.toggle('is-active', isFavorite);
    button.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
    button.innerHTML = (isFavorite ? icon('starFill') : icon('star')) + '<span>' + (isFavorite ? 'في المفضلة' : 'أضف للمفضلة') + '</span>';
  }

  function toggleWatchFavorite() {
    if (state.route.name !== 'watch') return;
    var slug = state.route.params.slug;
    var channel = state.player.channel || channelSeed(slug);
    var added = Store.toggleFavorite({
      slug: slug,
      name: channel.name || slug,
      avatar: channel.avatar || ''
    });
    updateFavButton();
    updateHeader();
    showToast(added ? 'أُضيفت القناة إلى المفضلة' : 'أُزيلت القناة من المفضلة');
    if (state.route.name === 'favorites') renderRoute();
  }

  function mountWatch(slug) {
    var iframe = doc.getElementById('kickPlayer');
    var loading = doc.getElementById('playerLoading');
    var backTo = state.player.backTo || '#/';
    var ps5 = isPS5();

    state.player = {
      slug: slug,
      channel: null,
      loaded: false,
      error: null,
      poll: null,
      hintTimer: null,
      backTo: backTo,
      autoplay: ps5 ? false : Store.getSettings().autoplay,
      deferred: ps5,
      mode: ps5 ? 'deferred' : 'official'
    };

    var ps5Notice = doc.getElementById('ps5Notice');
    if (ps5 && ps5Notice) ps5Notice.hidden = false;

    if (iframe) iframe.addEventListener('load', onPlayerFrameLoad);

    var native = doc.getElementById('nativePlayer');
    if (native) {
      native.addEventListener('playing', function () {
        if (state.player.mode === 'native') setText('playerState', 'مباشر الآن · HLS');
      });
      native.addEventListener('error', function () {
        if (state.player.mode !== 'native') return;
        var code = native.error ? native.error.code : 0;
        setText('playerState', 'تعذر تشغيل HLS (رمز ' + code + ') — استخدم مشغل PlayStation الرسمي.');
        showToast('مشغل HLS لم يعمل على هذا المتصفح');
      });
    }

    if (ps5) {
      var poster = doc.getElementById('playerPoster');
      if (poster) poster.hidden = false;
      if (loading) loading.classList.add('is-hidden');
      setText('playerState', 'أنت على PS5 — اختر «تشغيل HLS مباشر» أو «مشغل PlayStation الرسمي».');
    } else if (iframe) {
      iframe.src = 'about:blank';
      window.setTimeout(function () {
        if (state.route.name !== 'watch' || state.route.params.slug !== slug) return;
        iframe.src = playerUrl(slug, state.player.autoplay);
      }, 80);
    }

    if (!ps5) {
      state.player.hintTimer = window.setTimeout(function () {
        if (!state.player.loaded) showPlayerHint(false);
      }, CFG.player.loadHintMs);
    }

    Store.pushRecent({ slug: slug, name: channelSeed(slug).name });
    updateFavButton();
    updateHeader();
    hydrateRelated();
    loadWatchChannel(slug, false);

    state.player.poll = window.setInterval(function () {
      if (state.route.name !== 'watch') return;
      loadWatchChannel(slug, true);
      hydrateRelated();
    }, 60000);

    if (loading) loading.classList.remove('is-hidden');
  }

  /* ------------------------------------------------------------------ */
  /* Routing                                                            */
  /* ------------------------------------------------------------------ */

  function parseHash() {
    var raw = window.location.hash || '#/';
    var path = raw.replace(/^#\/?/, '');
    var parts = path.split('/').filter(Boolean).map(function (part) {
      try { return decodeURIComponent(part); } catch (err) { return part; }
    });

    if (!parts.length) return { name: 'home', params: {} };
    if (parts[0] === 'watch') {
      var slug = safeSlug(parts[1]);
      return slug ? { name: 'watch', params: { slug: slug } } : { name: 'notfound', params: {} };
    }
    if (parts[0] === 'browse') return { name: 'browse', params: {} };
    if (parts[0] === 'search') {
      return { name: 'browse', params: { query: parts.slice(1).join('/') } };
    }
    if (parts[0] === 'favorites') return { name: 'favorites', params: {} };
    return { name: 'notfound', params: {} };
  }

  function navigate(hash) {
    if ((window.location.hash || '#/') === hash) {
      renderRoute();
      return;
    }
    window.location.hash = hash;
  }

  function goBack() {
    if (state.modalOpen) {
      closeModal();
      return;
    }
    if (state.route.name === 'watch' && state.player.backTo) {
      navigate(state.player.backTo);
      return;
    }
    navigate('#/');
  }

  function cycleTab(step) {
    var tabs = ['#/', '#/browse', '#/favorites'];
    var current = state.route.name === 'home' ? 0 : (state.route.name === 'browse' ? 1 : (state.route.name === 'favorites' ? 2 : 0));
    var next = (current + step + tabs.length) % tabs.length;
    navigate(tabs[next]);
  }

  function updateNav() {
    var name = state.route.name === 'browse' ? 'browse' : state.route.name;
    $all('.nav-link').forEach(function (link) {
      var target = link.getAttribute('data-view');
      var active = target === name;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function updateHeader() {
    var count = Store.getFavorites().length;
    var badge = doc.getElementById('favCount');
    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle('is-empty', count === 0);
    }
  }

  function updateHeaderStatus() {
    var dot = doc.getElementById('statusDot');
    var label = doc.getElementById('statusLabel');
    if (!dot || !label) return;
    if (state.featuredLoading) {
      dot.className = 'status-dot is-loading';
      label.textContent = 'جارٍ التحديث';
      return;
    }
    if (state.featuredError) {
      dot.className = 'status-dot is-error';
      label.textContent = 'بيانات غير متاحة';
      return;
    }
    dot.className = 'status-dot is-live';
    label.textContent = state.lastSync ? 'بيانات مباشرة · ' + formatClock(state.lastSync) : 'بيانات مباشرة';
  }

  function renderRoute() {
    clearInterval(state.player.poll);
    clearTimeout(state.player.hintTimer);

    var route = parseHash();
    state.route = route;
    updateNav();
    updateHeader();

    var html = '';
    if (route.name === 'home') html = homeHTML();
    else if (route.name === 'browse') html = browseHTML(route.params.query || '');
    else if (route.name === 'favorites') html = favoritesHTML();
    else if (route.name === 'watch') {
      state.player.backTo = (state.previousHash && state.previousHash.indexOf('#/watch') !== 0) ? state.previousHash : '#/';
      html = watchHTML(route.params.slug);
    } else html = notFoundHTML();

    viewRoot.innerHTML = html;

    if (route.name === 'home') {
      hydrateHome();
      document.title = 'Kick TV — مشاهدة Kick على شاشة PS5';
    } else if (route.name === 'browse') {
      mountBrowse(route.params.query || '');
      document.title = route.params.query ? 'بحث: ' + route.params.query + ' — Kick TV' : 'استكشاف القنوات — Kick TV';
    } else if (route.name === 'favorites') {
      renderFavoritesPage();
      document.title = 'المفضلة — Kick TV';
    } else if (route.name === 'watch') {
      mountWatch(route.params.slug);
      document.title = channelSeed(route.params.slug).name + ' — Kick TV';
    } else {
      document.title = 'الصفحة غير موجودة — Kick TV';
    }

    window.scrollTo(0, 0);
    var titleNode = doc.getElementById('pageTitle') || doc.getElementById('watchName');
    if (titleNode) {
      try { titleNode.focus({ preventScroll: true }); } catch (err) { titleNode.focus(); }
    }
  }

  function renderFavoritesPage() {
    var favorites = Store.getFavorites();
    var grid = doc.getElementById('favGrid');
    var summary = doc.getElementById('favSummary');
    var clear = doc.querySelector('[data-action="clear-favorites"]');
    if (summary) {
      summary.textContent = favorites.length
        ? favorites.length + ' قناة محفوظة على هذا الجهاز. تظهر حالة البث عند توفرها.'
        : 'قنواتك المحفوظة على هذا الجهاز.';
    }
    if (clear) clear.hidden = !favorites.length;
    if (!grid) return;
    if (!favorites.length) {
      grid.innerHTML = emptyState(
        'لا توجد قنوات في المفضلة',
        'افتح أي قناة ثم اضغط «أضف للمفضلة» لتظهر هنا على هذا الجهاز.',
        '<a class="btn btn-primary" href="#/browse">' + icon('grid') + 'استكشف القنوات</a>',
        'star'
      );
      return;
    }
    grid.innerHTML = favorites.map(function (entry) {
      return cardHTML(mergedStored(entry));
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Focus navigation                                                   */
  /* ------------------------------------------------------------------ */

  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';

  function isVisible(node) {
    if (!node || node.hidden) return false;
    if (node.closest('[hidden]')) return false;
    var style = window.getComputedStyle(node);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    var rect = node.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }

  function focusableNodes() {
    return $all(FOCUSABLE).filter(function (node) {
      if (node.getAttribute('tabindex') === '-1') return false;
      if (node.closest('#modalRoot')) return false;
      return isVisible(node);
    });
  }

  function focusFirst() {
    var nodes = focusableNodes();
    var main = doc.getElementById('main');
    var inMain = nodes.filter(function (node) { return main && main.contains(node); });
    var target = inMain[0] || nodes[0];
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function moveFocus(direction) {
    var current = doc.activeElement;
    if (!current || current === doc.body || !current.getBoundingClientRect || !isVisible(current)) {
      focusFirst();
      return;
    }

    var currentRect = current.getBoundingClientRect();
    var cx = currentRect.left + currentRect.width / 2;
    var cy = currentRect.top + currentRect.height / 2;
    var best = null;
    var bestScore = Infinity;

    focusableNodes().forEach(function (node) {
      if (node === current) return;
      var rect = node.getBoundingClientRect();
      var nx = rect.left + rect.width / 2;
      var ny = rect.top + rect.height / 2;
      var dx = nx - cx;
      var dy = ny - cy;
      var primary = 0;
      var secondary = 0;

      if (direction === 'right') {
        if (dx < 12) return;
        primary = dx;
        secondary = Math.abs(dy);
      } else if (direction === 'left') {
        if (dx > -12) return;
        primary = -dx;
        secondary = Math.abs(dy);
      } else if (direction === 'down') {
        if (dy < 12) return;
        primary = dy;
        secondary = Math.abs(dx);
      } else if (direction === 'up') {
        if (dy > -12) return;
        primary = -dy;
        secondary = Math.abs(dx);
      } else {
        return;
      }

      var overlap = 0;
      if (direction === 'right' || direction === 'left') {
        overlap = Math.max(0, Math.min(currentRect.bottom, rect.bottom) - Math.max(currentRect.top, rect.top));
      } else {
        overlap = Math.max(0, Math.min(currentRect.right, rect.right) - Math.max(currentRect.left, rect.left));
      }

      var score = primary + secondary * 2.4 - overlap * 0.85;
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    });

    if (!best) return;
    try { best.focus({ preventScroll: true }); } catch (err) { best.focus(); }
    best.scrollIntoView({ block: 'nearest', inline: 'center' });
    markKeyboardMode();
  }

  function activateFocused() {
    var active = doc.activeElement;
    if (!active || active === doc.body) {
      focusFirst();
      return;
    }
    if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') {
      active.blur();
      return;
    }
    active.click();
  }

  var keyboardModeTimer = null;
  function markKeyboardMode() {
    doc.body.classList.add('kb-mode');
    clearTimeout(keyboardModeTimer);
    keyboardModeTimer = window.setTimeout(function () {
      doc.body.classList.remove('kb-mode');
    }, 6000);
  }

  /* ------------------------------------------------------------------ */
  /* Gamepad                                                            */
  /* ------------------------------------------------------------------ */

  var padPrev = {};
  var padHeldDir = '';
  var padLastMove = 0;

  function readDirection(pad) {
    var buttons = pad.buttons || [];
    if (buttons[12] && buttons[12].pressed) return 'up';
    if (buttons[13] && buttons[13].pressed) return 'down';
    if (buttons[14] && buttons[14].pressed) return 'left';
    if (buttons[15] && buttons[15].pressed) return 'right';
    var ax = pad.axes && pad.axes.length ? pad.axes[0] : 0;
    var ay = pad.axes && pad.axes.length > 1 ? pad.axes[1] : 0;
    if (Math.abs(ax) > 0.55) return ax > 0 ? 'right' : 'left';
    if (Math.abs(ay) > 0.55) return ay > 0 ? 'down' : 'up';
    return '';
  }

  function pollGamepad() {
    if (typeof navigator.getGamepads !== 'function') return;
    var pads = navigator.getGamepads();
    var pad = null;
    for (var i = 0; i < pads.length; i += 1) {
      if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
    }

    if (pad) {
      if (!state.gamepadId) {
        state.gamepadId = pad.id;
        showToast('تم اكتشاف يد تحكم: ' + pad.id);
      }
      if (!state.modalOpen) {
        var direction = readDirection(pad);
        var now = performance.now();
        if (direction) {
          if (direction !== padHeldDir || now - padLastMove > 150) {
            if (now - padLastMove > 320 || direction !== padHeldDir) {
              moveFocus(direction);
              padLastMove = now;
              padHeldDir = direction;
            }
          }
        } else {
          padHeldDir = '';
        }

        var buttons = pad.buttons || [];
        function pressed(index) {
          return !!(buttons[index] && buttons[index].pressed);
        }
        function edge(index, action) {
          var key = 'b' + index;
          var isDown = pressed(index);
          if (isDown && !padPrev[key]) action();
          padPrev[key] = isDown;
        }
        edge(0, activateFocused);
        edge(1, goBack);
        edge(4, function () { cycleTab(-1); });
        edge(5, function () { cycleTab(1); });
        edge(9, openHelp);
      }
    } else if (state.gamepadId) {
      state.gamepadId = null;
    }

    window.requestAnimationFrame(pollGamepad);
  }

  /* ------------------------------------------------------------------ */
  /* Modal, toast, actions                                              */
  /* ------------------------------------------------------------------ */

  var toastTimer = null;

  function showToast(message, kind) {
    var toast = doc.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast is-visible' + (kind ? ' toast-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.className = 'toast';
    }, 3400);
  }

  function closeModal() {
    var root = doc.getElementById('modalRoot');
    if (root) root.innerHTML = '';
    state.modalOpen = false;
    doc.removeEventListener('keydown', modalKeydown);
    doc.body.classList.remove('modal-open');
    if (state.lastFocus && typeof state.lastFocus.focus === 'function') {
      try { state.lastFocus.focus({ preventScroll: true }); } catch (err) { state.lastFocus.focus(); }
    }
  }

  function openModal(html) {
    closeModal();
    state.lastFocus = doc.activeElement;
    var root = doc.getElementById('modalRoot');
    root.innerHTML = '<div class="modal-backdrop" data-modal-close="1"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">' + html + '</div></div>';
    state.modalOpen = true;
    doc.body.classList.add('modal-open');

    root.onclick = function (event) {
      if (event.target && event.target.getAttribute && event.target.getAttribute('data-modal-close')) {
        closeModal();
      }
    };

    var focusTarget = $('.modal-close', root) || $('button, a, input', modal);
    if (focusTarget) focusTarget.focus();
    doc.addEventListener('keydown', modalKeydown);
  }

  function modalKeydown(event) {
    if (!state.modalOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    var modal = $('.modal', doc.getElementById('modalRoot'));
    if (!modal) return;
    var nodes = $all(FOCUSABLE, modal).filter(isVisible);
    if (!nodes.length) return;
    var first = nodes[0];
    var last = nodes[nodes.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openHelp() {
    var autoplay = Store.getSettings().autoplay;
    var gamepad = state.gamepadId ? 'متصلة: ' + esc(state.gamepadId) : 'لم تُكتشف يد تحكم في هذا المتصفح — استخدم الأسهم وEnter.';
    openModal(
      '<button class="modal-close" type="button" data-action="close-modal" aria-label="إغلاق">' + icon('close') + '</button>' +
      '<p class="eyebrow">HELP &amp; CONTROLS</p>' +
      '<h2 id="modalTitle">التحكم والمساعدة</h2>' +
      '<div class="help-grid">' +
        '<div><h3>' + icon('gamepad') + 'يد PS5</h3><ul class="help-list">' +
          '<li><kbd>↑ ↓ ← →</kbd> التنقل بين العناصر</li>' +
          '<li><kbd>×</kbd> اختيار · <kbd>○</kbd> رجوع</li>' +
          '<li><kbd>L1</kbd> / <kbd>R1</kbd> بين الأقسام</li>' +
          '<li><kbd>Options</kbd> فتح هذه النافذة</li>' +
        '</ul></div>' +
        '<div><h3>' + icon('tv') + 'لوحة المفاتيح</h3><ul class="help-list">' +
          '<li><kbd>Tab</kbd> / الأسهم للتنقل</li>' +
          '<li><kbd>Enter</kbd> أو <kbd>مسافة</kbd> للاختيار</li>' +
          '<li><kbd>Esc</kbd> أو <kbd>Backspace</kbd> للرجوع</li>' +
          '<li><kbd>[</kbd> / <kbd>]</kbd> بين الأقسام</li>' +
          '<li><kbd>F</kbd> ملء الشاشة · <kbd>R</kbd> إعادة تحميل</li>' +
        '</ul></div>' +
      '</div>' +
      '<div class="help-status">' + icon('gamepad') + '<span>' + gamepad + '</span></div>' +
      '<div class="help-options">' +
        '<label class="switch"><input type="checkbox" id="autoplayToggle"' + (autoplay ? ' checked' : '') + '><span class="switch-track" aria-hidden="true"></span><span>تشغيل الفيديو تلقائياً عند فتح القناة</span></label>' +
      '</div>' +
      '<div class="help-note">' + icon('info') +
        '<p>يعرض التطبيق بيانات Kick من واجهتها العامة داخل المتصفح، ويعرض الفيديو من مشغل Kick الرسمي <span dir="ltr">player.kick.com</span>. لا يوجد سيرفر وسيط ولا تسجيل دخول. قد يمنع متصفح PS5 بعض الطلبات أو التشغيل التلقائي؛ في هذه الحالة استخدم زر «فتح على Kick».</p>' +
      '</div>' +
      '<div class="help-actions">' +
        '<button class="btn btn-ghost btn-danger" type="button" data-action="clear-data">' + icon('trash') + 'مسح البيانات المحلية</button>' +
        '<button class="btn btn-primary" type="button" data-action="close-modal">تم</button>' +
      '</div>' +
      '<p class="help-version">Kick TV v' + esc(CFG.version) + ' · واجهة غير رسمية</p>'
    );

    var toggle = doc.getElementById('autoplayToggle');
    if (toggle) {
      toggle.addEventListener('change', function () {
        Store.setSetting('autoplay', toggle.checked);
        showToast(toggle.checked ? 'سيُشغّل الفيديو تلقائياً' : 'سيُفتح المشغل بدون تشغيل تلقائي');
      });
    }
  }

  function confirmClearData() {
    openModal(
      '<button class="modal-close" type="button" data-action="close-modal" aria-label="إغلاق">' + icon('close') + '</button>' +
      '<p class="eyebrow">RESET</p>' +
      '<h2 id="modalTitle">مسح البيانات المحلية؟</h2>' +
      '<p class="modal-text">سيتم حذف المفضلة وآخر القنوات المشاهدة والإعدادات من هذا المتصفح. لا يمكن التراجع.</p>' +
      '<div class="help-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="close-modal">إلغاء</button>' +
        '<button class="btn btn-danger-solid" type="button" data-action="confirm-clear">نعم، امسح الكل</button>' +
      '</div>'
    );
  }

  function confirmClearFavorites() {
    openModal(
      '<button class="modal-close" type="button" data-action="close-modal" aria-label="إغلاق">' + icon('close') + '</button>' +
      '<p class="eyebrow">FAVORITES</p>' +
      '<h2 id="modalTitle">مسح المفضلة؟</h2>' +
      '<p class="modal-text">سيتم حذف جميع القنوات المحفوظة في المفضلة. يبقى سجل المشاهدة كما هو.</p>' +
      '<div class="help-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="close-modal">إلغاء</button>' +
        '<button class="btn btn-danger-solid" type="button" data-action="confirm-clear-favorites">نعم، امسح المفضلة</button>' +
      '</div>'
    );
  }

  function handleAction(action, element) {
    if (action === 'back') { goBack(); return; }
    if (action === 'close-modal') { closeModal(); return; }
    if (action === 'help') { openHelp(); return; }
    if (action === 'focus-search') {
      navigate('#/browse');
      window.setTimeout(function () {
        var input = doc.getElementById('browseSearchInput');
        if (input) input.focus();
      }, 120);
      return;
    }
    if (action === 'toggle-favorite') { toggleWatchFavorite(); return; }
    if (action === 'start-player') { startPlayer(); return; }
    if (action === 'start-native-player') { startNativePlayer(); return; }
    if (action === 'open-direct-player') {
      var href = element.getAttribute('href');
      if (!href) return;
      var popup = null;
      try { popup = window.open(href, '_blank'); } catch (err) { popup = null; }
      if (!popup) window.location.href = href;
      return;
    }
    if (action === 'fullscreen') { toggleFullscreen(); return; }
    if (action === 'reload-player') { reloadPlayer(); return; }
    if (action === 'player-help') { showPlayerHint(true); return; }
    if (action === 'retry-data') {
      Api.clearCache();
      showToast('جارٍ إعادة الاتصال بـ Kick…');
      loadFeatured(true);
      loadCategories(true);
      return;
    }
    if (action === 'retry-search') { runSearch(state.search.query, true); return; }
    if (action === 'watch-anyway') {
      var slug = safeSlug(element.getAttribute('data-slug'));
      if (slug) navigate('#/watch/' + encodeURIComponent(slug));
      return;
    }
    if (action === 'clear-favorites') { confirmClearFavorites(); return; }
    if (action === 'confirm-clear-favorites') {
      Store.getFavorites().forEach(function (entry) { Store.removeFavorite(entry.slug); });
      closeModal();
      updateHeader();
      renderRoute();
      showToast('تم مسح المفضلة');
      return;
    }
    if (action === 'clear-data') { confirmClearData(); return; }
    if (action === 'confirm-clear') {
      Store.clearAll();
      Api.clearCache();
      closeModal();
      updateHeader();
      navigate('#/');
      showToast('تم مسح البيانات المحلية');
      loadFeatured(true);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Input bindings                                                     */
  /* ------------------------------------------------------------------ */

  function onKeyDown(event) {
    if (state.modalOpen) return;

    var target = event.target;
    var tag = target && target.tagName ? target.tagName : '';
    var isField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (event.key === 'Escape') {
      if (isField) {
        target.blur();
      } else {
        goBack();
      }
      return;
    }

    if (isField) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        target.blur();
        moveFocus('down');
      }
      return;
    }

    var directionMap = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down' };
    if (directionMap[event.key]) {
      event.preventDefault();
      markKeyboardMode();
      moveFocus(directionMap[event.key]);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      goBack();
      return;
    }

    if (event.key === ' ' && doc.activeElement && doc.activeElement.tagName === 'A') {
      event.preventDefault();
      doc.activeElement.click();
      return;
    }

    if (event.key === '?' || event.key === 'h' || event.key === 'H') {
      event.preventDefault();
      openHelp();
      return;
    }

    if ((event.key === 'f' || event.key === 'F') && state.route.name === 'watch') {
      event.preventDefault();
      toggleFullscreen();
      return;
    }

    if ((event.key === 'r' || event.key === 'R') && state.route.name === 'watch') {
      event.preventDefault();
      reloadPlayer();
      return;
    }

    if (event.key === '[') { event.preventDefault(); cycleTab(-1); return; }
    if (event.key === ']') { event.preventDefault(); cycleTab(1); }
  }

  function bindStaticEvents() {
    doc.addEventListener('click', function (event) {
      var actionEl = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
      if (actionEl) {
        var action = actionEl.getAttribute('data-action');
        if (action) {
          event.preventDefault();
          handleAction(action, actionEl);
          return;
        }
      }
      var channelEl = event.target && event.target.closest ? event.target.closest('[data-channel]') : null;
      if (channelEl) {
        var slug = safeSlug(channelEl.getAttribute('data-channel'));
        if (slug) event.preventDefault();
        navigate('#/watch/' + encodeURIComponent(slug));
      }
    });

    doc.addEventListener('keydown', onKeyDown);
    doc.addEventListener('mousemove', function () { doc.body.classList.remove('kb-mode'); });
    doc.addEventListener('touchstart', function () { doc.body.classList.remove('kb-mode'); });

    var headerForm = doc.getElementById('headerSearchForm');
    var headerInput = doc.getElementById('headerSearchInput');
    if (headerForm) {
      headerForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var value = headerInput ? headerInput.value.trim() : '';
        if (!value) {
          navigate('#/browse');
          return;
        }
        navigate('#/search/' + encodeURIComponent(value));
        if (headerInput) headerInput.blur();
      });
    }

    var helpButton = doc.getElementById('helpBtn');
    if (helpButton) helpButton.addEventListener('click', openHelp);

    window.addEventListener('hashchange', function () {
      var current = window.location.hash || '#/';
      if (current !== state.currentHash) {
        state.previousHash = state.currentHash;
        state.currentHash = current;
      }
      renderRoute();
    });

    window.addEventListener('kicktv:store', function () {
      updateHeader();
      if (state.route.name === 'favorites') renderFavoritesPage();
      if (state.route.name === 'home') {
        renderStoredRail('recentRail', Store.getRecent().slice(0, 8), 'لم تشاهد أي قناة بعد.');
        renderStoredRail('favRail', Store.getFavorites().slice(0, 8), 'أضف قنواتك من صفحة المشاهدة.');
      }
    });

    doc.addEventListener('error', function (event) {
      var target = event.target;
      if (!target || target.tagName !== 'IMG') return;
      var fallback = target.getAttribute('data-fallback');
      if (fallback) {
        target.removeAttribute('data-fallback');
        target.src = fallback;
        return;
      }
      target.classList.add('img-broken');
    }, true);

    window.addEventListener('gamepadconnected', function (event) {
      state.gamepadId = event.gamepad ? event.gamepad.id : 'gamepad';
      showToast('تم توصيل يد التحكم');
      if (state.modalOpen) closeModal();
    });

    window.addEventListener('gamepaddisconnected', function () {
      state.gamepadId = null;
      showToast('تم فصل يد التحكم');
    });

    window.addEventListener('pagehide', function () {
      clearInterval(state.player.poll);
      clearTimeout(state.player.hintTimer);
    });
  }

  function loadBuildInfo() {
    if (typeof window.fetch !== 'function') return;
    if (window.location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return;
    window.fetch('./build.json', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) return null;
      return response.json();
    }).then(function (info) {
      if (!info) return;
      var node = doc.getElementById('buildInfo');
      if (node && info.commit) node.textContent = 'build ' + String(info.commit).slice(0, 7);
    }).catch(function () { /* build info is optional */ });
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                               */
  /* ------------------------------------------------------------------ */

  function boot() {
    state.currentHash = window.location.hash || '#/';
    state.gamepadId = null;
    bindStaticEvents();
    renderRoute();
    updateHeader();
    loadFeatured(false);
    loadCategories(false);
    loadBuildInfo();
    window.requestAnimationFrame(pollGamepad);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.KickTV = {
    navigate: navigate,
    reload: renderRoute,
    state: state
  };
})();
