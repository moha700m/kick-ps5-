/* Deterministic Kick API fixtures for browser tests. */
const NAMES = {
  xqc: 'xQc',
  adinross: 'Adin Ross',
  westcol: 'Westcol',
  spreen: 'Spreen',
  n3on: 'N3on',
  roshtein: 'Roshtein',
  amouranth: 'Amouranth',
  sxb: 'SXB',
  atro: 'Atro',
  coringa: 'Coringa',
  '3mr': '3MR',
  coker: 'Coker',
  clavicular: 'Clavicular',
  buddha: 'Buddha'
};

const LIVE_VIEWERS = {
  westcol: 45000,
  xqc: 10500,
  adinross: 8200,
  amouranth: 2400
};

function channelPayload(slug) {
  const name = NAMES[slug] || slug;
  const viewers = LIVE_VIEWERS[slug];
  const live = Boolean(viewers);
  return {
    slug,
    playback_url: live ? 'https://example.com/live.m3u8' : null,
    is_banned: false,
    verified: slug === 'xqc',
    followers_count: 100000 + slug.length * 111,
    user: { username: name, profilePic: '' },
    livestream: live
      ? {
        is_live: true,
        viewer_count: viewers,
        session_title: `${name} — اختبار البث المباشر`,
        thumbnail: { url: '' },
        categories: [{ id: 1, name: 'Just Chatting', slug: 'just-chatting' }],
        start_time: '2026-11-03 08:15:00',
        language: 'English',
        is_mature: false
      }
      : null
  };
}

export async function mockKick(page) {
  await page.route('https://kick.com/api/**', async (route) => {
    const url = new URL(route.request().url());
    const headers = {
      'access-control-allow-origin': '*',
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    };

    if (url.pathname.startsWith('/api/v2/channels/')) {
      const slug = decodeURIComponent(url.pathname.split('/').pop() || '');
      if (!NAMES[slug] && !LIVE_VIEWERS[slug]) {
        await route.fulfill({ status: 404, headers, body: JSON.stringify({ message: 'Channel not found' }) });
        return;
      }
      await route.fulfill({ status: 200, headers, body: JSON.stringify(channelPayload(slug)) });
      return;
    }

    if (url.pathname === '/api/v1/categories/top') {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify([
          { slug: 'irl', name: 'IRL', viewers: 150000, banner: { src: '' } },
          { slug: 'just-chatting', name: 'Just Chatting', viewers: 110000, banner: { src: '' } },
          { slug: 'grand-theft-auto-v', name: 'Grand Theft Auto V', viewers: 90000, banner: { src: '' } },
          { slug: 'counter-strike-2', name: 'Counter-Strike 2', viewers: 18000, banner: { src: '' } },
          { slug: 'fortnite', name: 'Fortnite', viewers: 9000, banner: { src: '' } },
          { slug: 'valorant', name: 'VALORANT', viewers: 7000, banner: { src: '' } }
        ])
      });
      return;
    }

    if (url.pathname === '/api/search') {
      const term = (url.searchParams.get('searched_word') || '').toLowerCase();
      const matches = Object.keys(NAMES).filter((slug) => slug.includes(term) || NAMES[slug].toLowerCase().includes(term));
      const channels = (matches.length ? matches : ['xqc']).slice(0, 12).map((slug) => ({
        slug,
        isLive: Boolean(LIVE_VIEWERS[slug]),
        followersCount: 100000,
        verified: slug === 'xqc',
        user: { username: NAMES[slug] || slug, profilePic: '' }
      }));
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ channels, categories: [], livestreams: { tags: [] } }) });
      return;
    }

    await route.fulfill({ status: 404, headers, body: JSON.stringify({ message: 'Not found' }) });
  });

  await page.route('https://playstation.kick.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><body style="margin:0;background:#000;color:#53fc18;font:16px sans-serif;display:grid;place-items:center;height:100vh">PLAYSTATION PLAYER MOCK</body></html>'
    });
  });

  await page.route('https://player.kick.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><body style="margin:0;background:#000;color:#53fc18;font:16px sans-serif;display:grid;place-items:center;height:100vh">PLAYER MOCK</body></html>'
    });
  });

  await page.route('https://stream.kick.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('https://files.kick.com/**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
}
