const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());

const REDDIT_SUBS = [
  'pennystocks',
  'RobinHoodPennyStocks',
  'Shortsqueeze',
  'smallstreetbets',
  'SPACs',
  'Spacstocks',
  'SqueezePlays',
  'WebullPennyStocks'
];

// Helper to simulate browser headers
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

app.get('/reddit', async (req, res) => {
  const { subreddit } = req.query;

  // 🧪 If a specific subreddit is requested
  if (subreddit) {
    try {
      const response = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=100`, { headers });
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      console.error(`❌ Error fetching /r/${subreddit}:`, err.message);
      return res.status(500).json({ error: `Failed to fetch subreddit /r/${subreddit}` });
    }
  }

  // 🌊 If no subreddit specified, fetch all from your list
  try {
    const results = [];

    await Promise.all(REDDIT_SUBS.map(async (sr) => {
      try {
        const response = await fetch(`https://www.reddit.com/r/${sr}/top.json?t=day&limit=50`, { headers });
        const json = await response.json();
        results.push(...(json.data?.children || []));
        console.log(`✅ Fetched /r/${sr} (${(json.data?.children || []).length} posts)`);
      } catch (err) {
        console.warn(`⚠️ Failed to fetch /r/${sr}:`, err.message);
      }
    }));

    res.json({ data: { children: results } });
  } catch (err) {
    console.error('❌ Unexpected error fetching multiple subreddits:', err.message);
    res.status(500).json({ error: 'Failed to fetch multiple subreddits' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Reddit proxy running on port ${port}`));
