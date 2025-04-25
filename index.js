const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();

// Enable CORS for all origins explicitly
app.use(cors({
  origin: '*',
  methods: ['GET']
}));

// Rate-limiting middleware: limit 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Apply rate-limiting to all routes
app.use(limiter);

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

  try {
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
  } catch (err) {
    console.error('❌ Error fetching multiple subreddits:', err);
    res.status(500).json({ error: 'Failed to fetch data from multiple subreddits' });
  }
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Reddit OAuth proxy live on port ${port}`));

