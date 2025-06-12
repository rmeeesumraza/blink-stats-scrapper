// api/tiktok-stats.js
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'no username' });
  }

  let browser;
  try {
    // Launch the Chrome binary that chrome-aws-lambda provides
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    // set a desktop UA so you get the same HTML you saw in your browser
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/113.0.0.0 Safari/537.36'
    );
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'networkidle2',
    });

    // Inside the page, TikTok’s JS has hydrated window.SIGI_STATE or window.__NEXT_DATA__
    const result = await page.evaluate(() => {
      const state = window['SIGI_STATE'] || window.__NEXT_DATA__;
      if (!state) return null;

      // drill down recursively to find ItemModule
      function findIM(o) {
        if (!o || typeof o !== 'object') return null;
        if (o.ItemModule) return o.ItemModule;
        for (const k in o) {
          const found = findIM(o[k]);
          if (found) return found;
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
      return res.status(500).json({ error: 'no stats found' });
    }
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
