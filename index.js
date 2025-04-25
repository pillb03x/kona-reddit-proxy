const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const rateLimit = require('express-rate-limit'); // Import rate-limiting
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

// 🧠 Fetch Data from Reddit for Multiple Subreddits with Delay Between Requests
async function fetchRedditData(subreddit) {
  const token = await getAccessToken();
  const url = `https://oauth.reddit.com/r/${subreddit}/top?t=day&limit=25`;

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'kona-dashboard/1.0'
      }
    });

    const data = await response.json();
    return data.data?.children || [];
  } catch (err) {
    console.error(`Error fetching ${subreddit}:`, err);
    return [];
  }
}

// 🧠 Multi-subreddit fetch with delays between requests
async function fetchSubredditsData() {
  const results = [];

  for (let i = 0; i < REDDIT_SUBS.length; i++) {
    const subreddit = REDDIT_SUBS[i];
    const data = await fetchRedditData(subreddit);
    results.push(...data);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between requests
  }

  return results;
}

// 🧠 Endpoint to fetch data from multiple subreddits
app.get('/reddit', async (req, res) => {
  try {
    const results = await fetchSubredditsData();
    res.json({ data: { children: results } });
  } catch (err) {
    console.error("Error fetching Reddit data:", err);
    res.status(500).json({ error: 'Failed to fetch Reddit data' });
  }
});

// 🧪 Endpoint for a single subreddit
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

// 🔍 Custom Ticker Search Endpoint
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
