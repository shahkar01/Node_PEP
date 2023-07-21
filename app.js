const express = require('express');
const { MongoClient } = require('mongodb');
const shortid = require('shortid');

const app = express();
const port = process.env.PORT || 3000;

const mongoURL = 'mongodb://localhost:27017'; // Replace with your MongoDB connection string
const dbName = 'url_shortener';
const collectionName = 'urls';
const baseUrl = 'www.ppa.in/'; // Change this to your desired base URL

// Middleware to parse incoming request body as JSON
app.use(express.json());

// Function to generate a unique short URL
const generateShortUrl = () => baseUrl + nanoid(7);

// Helper function to establish a connection to the MongoDB
const connectToMongoDB = async () => {
  const client = new MongoClient(mongoURL);

  try {
    await client.connect();
    console.log('Connected to MongoDB successfully');
    return client.db(dbName).collection(collectionName);
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  }
};

// Route to shorten a URL
app.post('/shorten', async (req, res) => {
  const { destinationUrl } = req.body;
  if (!destinationUrl) {
    return res.status(400).json({ error: 'Destination URL is required.' });
  }

  const collection = await connectToMongoDB();
  const existingUrl = await collection.findOne({ destinationUrl });

  if (existingUrl) {
    return res.json({ shortUrl: existingUrl.shortUrl });
  }

  const shortUrl = generateShortUrl();
  const newUrl = { destinationUrl, shortUrl, createdAt: new Date(), expiresAt: null };
  await collection.insertOne(newUrl);
  return res.json({ shortUrl });
});

// Route to get the destination URL from the short URL
app.get('/:shortUrl', async (req, res) => {
  const { shortUrl } = req.params;
  const collection = await connectToMongoDB();
  const url = await collection.findOne({ shortUrl });

  if (!url) {
    return res.status(404).json({ error: 'Short URL not found.' });
  }

  if (url.expiresAt && url.expiresAt < new Date()) {
    return res.status(410).json({ error: 'Short URL has expired.' });
  }

  return res.redirect(url.destinationUrl);
});

// Route to update the destination URL of an existing short URL
app.post('/update', async (req, res) => {
  const { shortUrl, destinationUrl } = req.body;
  if (!shortUrl || !destinationUrl) {
    return res.status(400).json({ error: 'Short URL and Destination URL are required.' });
  }

  const collection = await connectToMongoDB();
  const result = await collection.updateOne({ shortUrl }, { $set: { destinationUrl } });

  if (result.modifiedCount === 0) {
    return res.status(404).json({ error: 'Short URL not found.' });
  }

  return res.json({ success: true });
});

// Route to update the expiry of a short URL
app.post('/update-expiry', async (req, res) => {
  const { shortUrl, daysToAdd } = req.body;
  if (!shortUrl || !daysToAdd) {
    return res.status(400).json({ error: 'Short URL and number of days are required.' });
  }

  const collection = await connectToMongoDB();
  const url = await collection.findOne({ shortUrl });

  if (!url) {
    return res.status(404).json({ error: 'Short URL not found.' });
  }

  const newExpiryDate = new Date();
  newExpiryDate.setDate(newExpiryDate.getDate() + daysToAdd);

  await collection.updateOne({ shortUrl }, { $set: { expiresAt: newExpiryDate } });
  return res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
