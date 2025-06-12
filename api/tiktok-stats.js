// api/tiktok-stats.js
const chromium  = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  const user = (req.query.username || '').trim();
  if (!user) {
    return res.status(400).json({ error: 'no username provided' });
  }

  let browser;
  try {
    // Sparticuz gives you a valid execPath on Vercel
    const execPath = chromium.executablePath;
    if (!execPath) throw new Error('no chromium binary');

    browser = await puppeteer.launch({
      executablePath: execPath,
      args:           chromium.args,
      headless:       chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/113.0.0.0 Safari/537.36'
    );
    await page.goto(`https://www.tiktok.com/@${user}`, {
      waitUntil: 'networkidle2',
      timeout:    30000,
    });

    const result = await page.evaluate(() => {
      const state = window['SIGI_STATE'] || window.__NEXT_DATA__;
      if (!state) return null;
      function findIM(o) {
        if (o && typeof o === 'object') {
          if (o.ItemModule) return o.ItemModule;
          for (const k in o) {
            const f = findIM(o[k]);
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

    if (!result) throw new Error('no stats found');

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (e) {
    console.error('Scrape error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    if (browser) await browser.close();
  }
};
