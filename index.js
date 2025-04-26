// server.js - OnlyScans Reddit Proxy (Upgraded Version)

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET']
}));

// 🔐 Reddit API credentials
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = 0;

// 🔐 Get OAuth2 Token for Reddit
async function getAccessToken() {
  const now = Date.now();
  if (accessToken && now < tokenExpiry) return accessToken;

  try {
    const creds = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!res.ok) {
      console.error('❌ Failed to refresh Reddit token:', res.status);
      return null;
    }

    const data = await res.json();
    accessToken = data.access_token;
    tokenExpiry = now + (data.expires_in * 1000) - 120000; // refresh 2 min early
    console.log('✅ Reddit token refreshed');
    return accessToken;
  } catch (err) {
    console.error('❌ Error refreshing Reddit token:', err.message);
    return null;
  }
}

// Subreddits to monitor (updated)
const REDDIT_SUBS = [
  'pennystocks', 'Shortsqueeze', 'RobinHoodPennyStocks', 'SqueezePlays'
];

// 🧠 Multi-subreddit fetch
app.get('/reddit/trending', async (req, res) => {
  const token = await getAccessToken();
  if (!token) return res.status(500).json({ error: 'Reddit token unavailable' });

  const results = [];

  await Promise.all(
    REDDIT_SUBS.map(async (sr) => {
      try {
        const url = `https://oauth.reddit.com/r/${sr}/top?t=day&limit=25`;
        const r = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'OnlyScans SEC Monitor (support@onlyscans.com)'
          }
        });

        if (!r.ok) {
          console.error(`⚠️ Failed subreddit fetch /r/${sr}: HTTP ${r.status}`);
          return;
        }

        const json = await r.json();
        results.push(...(json.data?.children || []));
      } catch (err) {
        console.error(`⚠️ Error fetching /r/${sr}:`, err.message);
      }
    })
  );

  res.json({ data: { children: results } });
});

// 🔍 Single subreddit fetch
app.get('/reddit/:sub', async (req, res) => {
  const token = await getAccessToken();
  if (!token) return res.status(500).json({ error: 'Reddit token unavailable' });

  const { sub } = req.params;

  try {
    const url = `https://oauth.reddit.com/r/${sub}/top?t=day&limit=25`;
    const r = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'OnlyScans SEC Monitor (support@onlyscans.com)'
      }
    });

    if (!r.ok) {
      console.error(`❌ Reddit API error for /r/${sub}: ${r.status}`);
      return res.status(r.status).json({ error: `Reddit API error: ${r.status}` });
    }

    const json = await r.json();
    res.json(json);
  } catch (err) {
    console.error(`❌ Error fetching /r/${sub}:`, err.message);
    res.status(500).json({ error: `Failed to fetch /r/${sub}` });
  }
});

// 🔍 Custom Ticker Search
app.get('/reddit/search', async (req, res) => {
  const token = await getAccessToken();
  if (!token) return res.status(500).json({ error: 'Reddit token unavailable' });

  const { q } = req.query;
  if (!q || q.length > 6) {
    return res.status(400).json({ error: 'Invalid ticker query' });
  }

  try {
    const url = `https://oauth.reddit.com/search.json?q=%24${encodeURIComponent(q)}&sort=top&limit=25&restrict_sr=false`;
    const r = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'OnlyScans SEC Monitor (support@onlyscans.com)'
      }
    });

    if (!r.ok) {
      console.error(`❌ Reddit search API error: ${r.status}`);
      return res.status(r.status).json({ error: `Reddit API error: ${r.status}` });
    }

    const json = await r.json();
    res.json(json);
  } catch (err) {
    console.error('❌ Reddit search failed:', err.message);
    res.status(500).json({ error: 'Reddit search failed' });
  }
});

// 📈 Insider Trades - MOCK DATA
app.get('/api/insider-trades', async (req, res) => {
  try {
    const mockTrades = [
      {
        symbol: 'TSLA',
        insiderName: 'Elon Musk',
        transactionType: 'Buy',
        shares: 10000,
        sharePrice: 720.50,
        filingDate: '2025-04-24',
        link: 'https://www.sec.gov/Archives/edgar/data/0001318605/000089924325034567/xslF345X03/primary_doc.xml'
      },
      {
        symbol: 'AAPL',
        insiderName: 'Tim Cook',
        transactionType: 'Sell',
        shares: 5000,
        sharePrice: 165.20,
        filingDate: '2025-04-23',
        link: 'https://www.sec.gov/Archives/edgar/data/0000320193/000119312525034567/xslF345X03/primary_doc.xml'
      },
      {
        symbol: 'NVDA',
        insiderName: 'Jensen Huang',
        transactionType: 'Buy',
        shares: 3000,
        sharePrice: 650.75,
        filingDate: '2025-04-22',
        link: 'https://www.sec.gov/Archives/edgar/data/0001045810/000089924325034567/xslF345X03/primary_doc.xml'
      }
    ];
    res.json(mockTrades);
  } catch (err) {
    console.error('❌ Failed to fetch mock insider trades:', err.message);
    res.status(500).json({ error: 'Failed to fetch mock insider trades' });
  }
});

// Start server
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`🚀 OnlyScans Server Live — Reddit Proxy + Insider API running on port ${port}`);
});
