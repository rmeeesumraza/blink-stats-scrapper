// api/tiktok-stats.js
const chromium  = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  const username = (req.query.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'no username provided' });
  }

  let browser;
  try {
    // 1) Get the actual path to the bundled Chromium binary
    const execPath = await chromium.executablePath();
    if (!execPath) {
      throw new Error('Chrome executable not found');
    }

    // 2) Launch Chrome via puppeteer-core
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: execPath,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    const page = await browser.newPage();
    // 3) Spoof a desktop UA so TikTok serves the full page
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/113.0.0.0 Safari/537.36'
    );

    // 4) Navigate and wait for TikTok’s JS to hydrate the page
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // 5) Extract the client-side JSON and pull out stats
    const result = await page.evaluate(() => {
      const state = window['SIGI_STATE'] || window.__NEXT_DATA__;
      if (!state) return null;

      function findItemModule(obj) {
        if (obj && typeof obj === 'object') {
          if (obj.ItemModule) return obj.ItemModule;
          for (const k in obj) {
            const found = findItemModule(obj[k]);
            if (found) return found;
          }
        }
        return null;
      }

      const items = findItemModule(state);
      if (!items) return null;

      const vidId = Object.keys(items)[0];
      const stats = items[vidId].stats || {};
      return {
        views:    stats.playCount   || stats.play_count   || 0,
        comments: stats.commentCount|| stats.comment_count || 0,
      };
    });

    if (!result) {
      throw new Error('no stats found on page');
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (err) {
    console.error('Scrape error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
};
