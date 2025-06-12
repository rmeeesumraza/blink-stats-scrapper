// api/tiktok-stats.js
const chromium = require('chrome-aws-lambda');
const { chromium: playwright } = require('playwright-core');

module.exports = async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'no username' });
  }

  let browser;
  try {
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/113.0.0.0 Safari/537.36'
    );
    await page.goto(`https://www.tiktok.com/@${username}`, { waitUntil: 'networkidle' });

    // Grab the client-hydrated JSON from the page
    const result = await page.evaluate(() => {
      const state = window['SIGI_STATE'] || window.__NEXT_DATA__;
      if (!state) return null;
      // find ItemModule
      function findIM(obj) {
        if (obj && typeof obj === 'object') {
          if (obj.ItemModule) return obj.ItemModule;
          for (const k in obj) {
            const found = findIM(obj[k]);
            if (found) return found;
          }
        }
        return null;
      }
      const items = findIM(state);
      if (!items) return null;
      const vidId = Object.keys(items)[0];
      const stats = items[vidId].stats;
      return {
        views:    stats.playCount   || stats.play_count   || 0,
        comments: stats.commentCount|| stats.comment_count || 0,
      };
    });

    if (!result) {
      return res.status(500).json({ error: 'no stats found' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
};
