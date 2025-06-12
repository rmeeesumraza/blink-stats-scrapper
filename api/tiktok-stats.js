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
    // 1) Get the executable path (string) directly
    const execPath = chromium.executablePath;
    if (!execPath) {
      throw new Error('Chrome executable path not found');
    }

    // 2) Launch Puppeteer with that binary
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: execPath,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    const page = await browser.newPage();
    // Spoof a desktop UA
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/113.0.0.0 Safari/537.36'
    );

    // 3) Navigate and wait for TikTok’s JS to render
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'networkidle2',
      timeout:    30000,
    });

    // 4) Extract the hydrated JSON and pull stats
    const result = await page.evaluate(() => {
      const state = window['SIGI_STATE'] || window.__NEXT_DATA__;
      if (!state) return null;

      function findIM(obj) {
        if (obj && typeof obj === 'object') {
          if (obj.ItemModule) return obj.ItemModule;
          for (const k in obj) {
            const f = findIM(obj[k]);
            if (f) return f;
          }
        }
        return null;
      }

      const items = findIM(state);
      if (!items) return null;

      const vidId = Object.keys(items)[0];
      const stats = items[vidId].stats || {};
      return {
        views:    stats.playCount   || stats.play_count   || 0,
        comments: stats.commentCount|| stats.comment_count || 0,
      };
    });

    if (!result) {
      throw new Error('no stats found');
    }

    // 5) Return JSON
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (err) {
    console.error('Scrape error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
};
