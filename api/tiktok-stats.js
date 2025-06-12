// api/tiktok-stats.js
const chromium = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  const username = (req.query.username || '').trim();
  if (!username) {
    return res.status(400).json({ error: 'no username provided' });
  }

  let browser;
  try {
    // 1) Launch headless Chrome using the chrome-aws-lambda binary
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    const page = await browser.newPage();
    // 2) Spoof a normal desktop UA
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/113.0.0.0 Safari/537.36'
    );

    // 3) Navigate and wait for network‐idle (so TikTok's JS runs)
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 4) Pull the hydrated JSON out of the page
    const result = await page.evaluate(() => {
      // TikTok injects window.SIGI_STATE or __NEXT_DATA__
      const state = window['SIGI_STATE'] || window.__NEXT_DATA__;
      if (!state) return null;

      function findItems(obj) {
        if (obj && typeof obj === 'object') {
          if (obj.ItemModule) return obj.ItemModule;
          for (const k in obj) {
            const found = findItems(obj[k]);
            if (found) return found;
          }
        }
        return null;
      }

      const items = findItems(state);
      if (!items) return null;

      const vidId = Object.keys(items)[0];
      const stats = items[vidId].stats || {};
      return {
        views:    stats.playCount   || stats.play_count   || 0,
        comments: stats.commentCount|| stats.comment_count || 0,
      };
    });

    if (!result) {
      throw new Error('no stats found in page');
    }

    // 5) Return JSON
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);
  } catch (err) {
    console.error('Scrape error:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
