const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');
const app = express();

// Enable CORS for all origins explicitly
app.use(cors({
  origin: '*',
  methods: ['GET']
}));

const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = 0;

// 🔐 Get OAuth2 Token
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) return accessToken;

  const creds = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiry = now + (data.expires_in * 1000) - 60000; // refresh 1 min early
  return accessToken;
}

const REDDIT_SUBS = [
  'pennystocks', 'RobinHoodPennyStocks', 'Shortsqueeze',
  'smallstreetbets', 'SPACs', 'Spacstocks',
  'SqueezePlays', 'WebullPennyStocks'
];

// 🧠 Multi-subreddit fetch
app.get('/reddit', async (req, res) => {
  const token = await getAccessToken();
  const results = [];

  await Promise.all(REDDIT_SUBS.map(async sr => {
    try {
      const url = `https://oauth.reddit.com/r/${sr}/top?t=day&limit=25`;
      const r = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'kona-dashboard/1.0'
        }
      });
      const json = await r.json();
      results.push(...(json.data?.children || []));
    } catch (err) {
      console.error(`⚠️ Failed to fetch /r/${sr}: ${err.message}`);
    }
  }));

  res.json({ data: { children: results } });
});

// 🧪 Single subreddit support
app.get('/reddit/:sub', async (req, res) => {
  const token = await getAccessToken();
  const { sub } = req.params;
  try {
    const url = `https://oauth.reddit.com/r/${sub}/top?t=day&limit=25`;
    const r = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'kona-dashboard/1.0'
      }
    });
    const json = await r.json();
    res.json(json);
  } catch (err) {
    console.error(`❌ Error fetching /r/${sub}: ${err.message}`);
    res.status(500).json({ error: `Failed to fetch /r/${sub}` });
  }
});

// 🔍 Custom Ticker Search
app.get('/reddit/search', async (req, res) => {
  const token = await getAccessToken();
  const { q } = req.query;

  if (!q || q.length > 6) {
    return res.status(400).json({ error: 'Invalid ticker query' });
  }

  const url = `https://oauth.reddit.com/search.json?q=%24${q}&sort=top&limit=25&restrict_sr=false`;

  try {
    const r = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'kona-dashboard/1.0'
      }
    });
    const json = await r.json();
    res.json(json);
  } catch (err) {
    console.error(`❌ Reddit search failed:`, err);
    res.status(500).json({ error: 'Reddit search failed' });
  }
});

// 📈 Insider Trades - Pull Form 4 filings from SEC
app.get('/api/insider-trades', async (req, res) => {
  try {
    const { data } = await axios.get('https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent', {
      headers: {
        'User-Agent': 'OnlyScans SEC Monitor/1.0 (nightra8er@gmail.com)' // ✅ NEW User-Agent!
      }
    });

    const parsed = await xml2js.parseStringPromise(data);
    const entries = parsed.rss.channel[0].item || [];

    const form4s = entries.filter(entry => entry.category?.[0]._ === '4');

    const insiderTrades = form4s.map(filing => ({
      title: filing.title?.[0] || '',
      link: filing.link?.[0] || '',
      pubDate: filing.pubDate?.[0] || ''
    }));

    res.json(insiderTrades);
  } catch (err) {
    console.error('❌ Failed to fetch SEC insider trades:', err.message);
    res.status(500).json({ error: 'Failed to fetch insider trades' });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 OnlyScans Server Live — Reddit & Insider API running on port ${port}`));
