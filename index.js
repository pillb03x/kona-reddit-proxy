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

app.get('/reddit', async (req, res) => {
  const { subreddit } = req.query;

  // Fetch specific subreddit
  if (subreddit) {
    try {
      const response = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?t=hour&limit=100`);
      const data = await response.json();
      return res.json(data);
    } catch (err) {
      console.error('❌ Error fetching from:', subreddit, err);
      return res.status(500).json({ error: `Failed to fetch subreddit ${subreddit}` });
    }
  }

  // Fetch all subreddits in parallel with error tolerance
  try {
    const results = [];

    await Promise.all(REDDIT_SUBS.map(async (sr) => {
      try {
        const resSR = await fetch(`https://www.reddit.com/r/${sr}/top.json?t=hour&limit=50`);
        const json = await resSR.json();
        results.push(...(json.data?.children || []));
      } catch (err) {
        console.warn(`⚠️ Failed to fetch /r/${sr}:`, err.message);
      }
    }));

    res.json({ data: { children: results } });
  } catch (err) {
    console.error('❌ Unexpected error fetching multiple subreddits:', err);
    res.status(500).json({ error: 'Failed to fetch multiple subreddits' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Reddit proxy running on port ${port}`));
