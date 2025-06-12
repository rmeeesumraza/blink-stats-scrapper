// api/tiktok-stats.js
export default async function handler(req, res) {
  try {
    // 1) Fetch example.com
    const resp = await fetch('https://example.com');
    const html = await resp.text();

    // 2) Pull out the first <h1>…</h1>
    const match = html.match(/<h1>([^<]+)<\/h1>/);
    const h1 = match ? match[1] : 'no <h1> found';

    // 3) Return it as JSON
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({ h1 });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: err.message });
  }
}
