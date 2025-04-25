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

// 🔐 Get OAuth2 Token for Reddit
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
  'smallstreetbets', 'SPACs', 'Spacstocks', 'SqueezePlays', 'WebullPennyStocks'
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
          'User-Agent': 'OnlyScans SEC Monitor (nightra8er@gmail.com)'
        }
      });

      if (!r.ok) {
        console.error(`⚠️ Failed subreddit fetch /r/${sr}: HTTP ${r.status}`);
        return; // Skip this subreddit but continue
      }

      const json = await r.json();
      results.push(...(json.data?.children || []));
    } catch (err) {
      console.error(`⚠️ Error fetching /r/${sr}: ${err.message}`);
    }
  }));

  res.json({ data: { children: results } });
});

// 🧪 Single subreddit fetch (Safe version!)
app.get('/reddit/:sub', async (req, res) => {
  const token = await getAccessToken();
  const { sub } = req.params;

  try {
    const url = `https://oauth.reddit.com/r/${sub}/top?t=day&limit=25`;
    const r = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'OnlyScans SEC Monitor (nightra8er@gmail.com)'
      }
    });

    if (!r.ok) {
      console.error(`❌ Reddit API error for /r/${sub}: ${r.status}`);
      return res.status(r.status).json({ error: `Reddit API error: ${r.status}` });
    }

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
        'User-Agent': 'OnlyScans SEC Monitor (nightra8er@gmail.com)'
      }
    });

    if (!r.ok) {
      console.error(`❌ Reddit search API error: ${r.status}`);
      return res.status(r.status).json({ error: `Reddit API error: ${r.status}` });
    }

    const json = await r.json();
    res.json(json);
  } catch (err) {
    console.error(`❌ Reddit search failed:`, err);
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
      },
      {
        symbol: 'AMZN',
        insiderName: 'Andy Jassy',
        transactionType: 'Buy',
        shares: 4200,
        sharePrice: 3200.00,
        filingDate: '2025-04-21',
        link: 'https://www.sec.gov/Archives/edgar/data/0001018724/000089924325034567/xslF345X03/primary_doc.xml'
      },
      {
        symbol: 'MSFT',
        insiderName: 'Satya Nadella',
        transactionType: 'Sell',
        shares: 6000,
        sharePrice: 295.40,
        filingDate: '2025-04-20',
        link: 'https://www.sec.gov/Archives/edgar/data/0000789019/000089924325034567/xslF345X03/primary_doc.xml'
      },
      {
        symbol: 'META',
        insiderName: 'Mark Zuckerberg',
        transactionType: 'Buy',
        shares: 8000,
        sharePrice: 270.15,
        filingDate: '2025-04-19',
        link: 'https://www.sec.gov/Archives/edgar/data/0001326801/000089924325034567/xslF345X03/primary_doc.xml'
      },
      {
        symbol: 'GOOGL',
        insiderName: 'Sundar Pichai',
        transactionType: 'Sell',
        shares: 4500,
        sharePrice: 2800.00,
        filingDate: '2025-04-18',
        link: 'https://www.sec.gov/Archives/edgar/data/0001652044/000089924325034567/xslF345X03/primary_doc.xml'
      }
    ];
    res.json(mockTrades);
  } catch (err) {
    console.error('❌ Failed to fetch mock insider trades:', err.message);
    res.status(500).json({ error: 'Failed to fetch mock insider trades' });
  }
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`🚀 OnlyScans Server Live — Reddit & Insider MOCK API running on port ${port}`));
