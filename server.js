const express = require('express');
const cors = require('cors');
const { TwitterApi } = require('twitter-api-v2');
const OpenAI = require('openai');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS for the frontend
app.use(cors({
  origin: ['https://dzongy.github.io', 'http://localhost:3000', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Bridge auth middleware
const bridgeAuth = (req, res, next) => {
  const authHeader = req.headers['x-auth'];
  if (authHeader !== 'amos-bridge-2026') {
    return res.status(401).json({ error: 'Unauthorized - Invalid bridge auth' });
  }
  next();
};

// Initialize Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize email transporter
const emailTransporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'TCC SOVEREIGNTY BACKEND ONLINE',
    version: 'v1.0.0',
    timestamp: new Date().toISOString()
  });
});

// POST /api/tweet - Send tweet via X/Twitter
app.post('/api/tweet', bridgeAuth, async (req, res) => {
  try {
    const { text, mediaIds } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Tweet text required' });
    }

    let tweet;
    if (mediaIds && mediaIds.length > 0) {
      tweet = await twitterClient.v2.tweet(text, { media: { media_ids: mediaIds } });
    } else {
      tweet = await twitterClient.v2.tweet(text);
    }

    res.json({ 
      success: true, 
      tweetId: tweet.data.id,
      text: tweet.data.text
    });
  } catch (error) {
    console.error('Tweet error:', error);
    res.status(500).json({ 
      error: 'Failed to send tweet', 
      details: error.message 
    });
  }
});

// GET /api/stripe/status - Check Stripe subscription status
app.get('/api/stripe/status', bridgeAuth, async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { customerId } = req.query;
    
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID required' });
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 5
    });

    const charges = await stripe.charges.list({
      customer: customerId,
      limit: 10
    });

    res.json({
      success: true,
      subscriptions: subscriptions.data,
      charges: charges.data,
      status: subscriptions.data.length > 0 ? subscriptions.data[0].status : 'none'
    });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Stripe status', 
      details: error.message 
    });
  }
});

// POST /api/github/push - Push file to GitHub
app.post('/api/github/push', bridgeAuth, async (req, res) => {
  try {
    const { owner, repo, path, content, message, sha } = req.body;
    
    if (!owner || !repo || !path || !content || !message) {
      return res.status(400).json({ error: 'Missing required fields: owner, repo, path, content, message' });
    }

    const axios = require('axios');
    
    const payload = {
      message,
      content: Buffer.from(content).toString('base64'),
      sha: sha || undefined
    };

    const response = await axios.put(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      payload,
      {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'TCC-Sovereignty-Backend'
        }
      }
    );

    res.json({
      success: true,
      commit: response.data.commit,
      content: response.data.content
    });
  } catch (error) {
    console.error('GitHub push error:', error);
    res.status(500).json({ 
      error: 'Failed to push to GitHub', 
      details: error.response?.data?.message || error.message 
    });
  }
});

// POST /api/email/send - Send email
app.post('/api/email/send', bridgeAuth, async (req, res) => {
  try {
    const { to, subject, body, html } = req.body;
    
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: body,
      html: html || body
    };

    const result = await emailTransporter.sendMail(mailOptions);

    res.json({
      success: true,
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected
    });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ 
      error: 'Failed to send email', 
      details: error.message 
    });
  }
});

// POST /api/image/generate - Generate image via OpenAI
app.post('/api/image/generate', bridgeAuth, async (req, res) => {
  try {
    const { prompt, size = '1024x1024', quality = 'standard', style = 'vivid' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size,
      quality,
      style,
      n: 1
    });

    res.json({
      success: true,
      url: response.data[0].url,
      revised_prompt: response.data[0].revised_prompt
    });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate image', 
      details: error.message 
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`TCC SOVEREIGNTY BACKEND v1.0.0 running on port ${PORT}`);
});
