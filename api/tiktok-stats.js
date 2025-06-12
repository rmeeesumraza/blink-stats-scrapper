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
    // 1) Resolve execPath whether it's a function or string
    let execPath;
    if (typeof chromium.executablePath === 'function') {
      execPath = await chromium.executablePath();
    } else {
      execPath = chromium.executablePath;
    }
    if (!execPath || typeof execPath !== 'string') {
      throw new Error('Chrome executable path not found or invalid');
    }

    // 2) Launch headless Chrome
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: execPath,
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/113.0.0.0 Safari/537.36'
    );
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: 'networkidle2',
      timeout:    30000,
    });

    // 3) Extract the hydrated JSON and stats
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

    if (!result) {
      throw new Error('no stats found');
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
