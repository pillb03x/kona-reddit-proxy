const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/reddit', async (req, res) => {
  const { subreddit = 'pennystocks' } = req.query;
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=hour&limit=100`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reddit fetch failed' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Reddit proxy running on port ${port}`));
