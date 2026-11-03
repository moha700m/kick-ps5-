import { test, expect } from '@playwright/test';
import { mockKick } from './mock-kick.js';

test.describe('Kick TV', () => {
  test.beforeEach(async ({ page }) => {
    await mockKick(page);
  });

  test('home loads live channels, hero and stats', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await expect(page.locator('#liveRail .card').first()).toBeVisible();
    await expect(page.locator('#statLive')).toHaveText('4');
    await expect(page.locator('#liveRail .card.is-live')).toHaveCount(4);
    await expect(page.locator('#heroStage .hero-card')).toBeVisible();
    await expect(page.locator('#heroStage .hero-card')).toHaveAttribute('data-channel', 'westcol');
    await expect(page.locator('#categoryGrid .cat-card')).toHaveCount(6);
    await expect(page.locator('#categoryGrid .cat-card').first()).toHaveAttribute('href', /kick\.com\/category\/irl$/);
    await expect(page.locator('#liveMeta')).toContainText('آخر تحديث');
    expect(pageErrors).toEqual([]);
  });

  test('opens the official Kick player from the hero', async ({ page }) => {
    await page.goto('/');
    await page.locator('#heroStage .hero-card').click();

    await expect(page).toHaveURL(/#\/watch\/westcol$/);
    await expect(page.locator('#watchName')).toHaveText('Westcol');
    await expect(page.locator('#watchSub .pill-live')).toBeVisible();
    await expect(page.locator('#kickPlayer')).toHaveAttribute('src', 'https://player.kick.com/westcol?autoplay=true');
    await expect(page.locator('#playerLoading')).toHaveClass(/is-hidden/);
    await expect(page.locator('#infoCategory')).toHaveText('Just Chatting');
    await expect(page.locator('#kickLink')).toHaveAttribute('href', 'https://kick.com/westcol');
  });

  test('favorites survive a reload and appear in the favorites view', async ({ page }) => {
    await page.goto('/#/watch/xqc');
    await expect(page.locator('#watchName')).toHaveText('xQc');
    await expect(page.locator('#watchFav')).toContainText('أضف للمفضلة');

    await page.locator('#watchFav').click();
    await expect(page.locator('#watchFav')).toContainText('في المفضلة');
    await expect(page.locator('#favCount')).toHaveText('1');

    await page.reload();
    await expect(page.locator('#watchFav')).toContainText('في المفضلة');

    await page.goto('/#/favorites');
    await expect(page.locator('#favGrid .card[data-channel="xqc"]')).toBeVisible();
    await expect(page.locator('#favSummary')).toContainText('1 قناة');
  });

  test('removes a favorite and clears the favorites list', async ({ page }) => {
    await page.goto('/#/watch/xqc');
    await expect(page.locator('#watchName')).toHaveText('xQc');

    await page.locator('#watchFav').click();
    await expect(page.locator('#watchFav')).toContainText('في المفضلة');

    await page.locator('#watchFav').click();
    await expect(page.locator('#watchFav')).toContainText('أضف للمفضلة');
    await expect(page.locator('#favCount')).toHaveText('0');

    await page.locator('#watchFav').click();
    await page.goto('/#/favorites');
    await expect(page.locator('#favGrid .card[data-channel="xqc"]')).toBeVisible();

    await page.locator('[data-action="clear-favorites"]').click();
    await expect(page.locator('.modal')).toBeVisible();
    await page.locator('[data-action="confirm-clear-favorites"]').click();

    await expect(page.locator('#favGrid .empty')).toBeVisible();
    await expect(page.locator('#favCount')).toHaveText('0');
  });

  test('search finds a channel and starts playback', async ({ page }) => {
    await page.goto('/#/browse');
    await page.fill('#browseSearchInput', 'adin');
    await page.press('#browseSearchInput', 'Enter');

    await expect(page).toHaveURL(/#\/search\/adin$/);
    await expect(page.locator('#searchArea .card[data-channel="adinross"]')).toBeVisible();
    await page.locator('#searchArea .card[data-channel="adinross"]').click();

    await expect(page).toHaveURL(/#\/watch\/adinross$/);
    await expect(page.locator('#kickPlayer')).toHaveAttribute('src', 'https://player.kick.com/adinross?autoplay=true');
  });

  test('spatial keyboard navigation activates the focused link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#liveRail .card').first()).toBeVisible();

    await page.keyboard.press('ArrowDown');
    const focused = await page.evaluate(() => {
      const node = document.activeElement;
      return {
        tag: node ? node.tagName : '',
        href: node ? node.getAttribute('href') : ''
      };
    });
    expect(['A', 'BUTTON']).toContain(focused.tag);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/browse$/);
  });

  test('layout does not overflow at 1920x1080 and 390x844', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#liveRail .card').first()).toBeVisible();

    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desktopOverflow).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator('#liveRail .card').first()).toBeVisible();
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(mobileOverflow).toBeLessThanOrEqual(1);
  });

  test.describe('PS5 browser mode', () => {
    test.use({ userAgent: 'Mozilla/5.0 (PlayStation 5 3.00) AppleWebKit/605.1.15 (KHTML, like Gecko)' });

    test('defers the embed and offers a direct player link', async ({ page }) => {
      await page.goto('/#/watch/xqc');
      await expect(page.locator('#ps5Notice')).toBeVisible();
      await expect(page.locator('#playerPoster')).toBeVisible();
      await expect(page.locator('#kickPlayer')).toHaveAttribute('src', 'about:blank');
      await expect(page.locator('#posterDirectLink')).toHaveAttribute('href', 'https://playstation.kick.com/xqc');

      await page.locator('[data-action="start-player"]').click();
      await expect(page.locator('#playerPoster')).toBeHidden();
      await expect(page.locator('#kickPlayer')).toHaveAttribute('src', 'https://playstation.kick.com/xqc');
    });
  });

  test('keeps working when Kick API requests are blocked', async ({ page }) => {
    await page.route('https://kick.com/**', (route) => route.abort());

    await page.goto('/');
    await expect(page.locator('#homeNotice')).toBeVisible();
    await expect(page.locator('#homeNotice')).toContainText('تعذر الاتصال');
    await expect(page.locator('#liveRail .card').first()).toBeVisible();

    await page.fill('#headerSearchInput', 'xqc');
    await page.press('#headerSearchInput', 'Enter');
    await expect(page).toHaveURL(/#\/search\/xqc$/);
    await expect(page.locator('#searchArea .callout')).toContainText('تعذر البحث');

    await page.locator('#searchArea [data-action="watch-anyway"]').click();
    await expect(page).toHaveURL(/#\/watch\/xqc$/);
    await expect(page.locator('#kickPlayer')).toHaveAttribute('src', 'https://player.kick.com/xqc?autoplay=true');
    await expect(page.locator('#offlineNotice')).toContainText('تعذر جلب بيانات القناة');
  });
});
