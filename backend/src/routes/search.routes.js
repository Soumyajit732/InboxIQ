import { Router } from 'express';
import axios from 'axios';
import { SPACY_SERVICE_URL } from '../config.js';

const router = Router();

router.get('/search', async (req, res) => {
  const { q, top_k = 5 } = req.query;
  if (!q?.trim()) {
    return res.status(400).json({ detail: 'Query cannot be empty' });
  }

  try {
    const response = await axios.get(`${SPACY_SERVICE_URL}/vector/search`, {
      params: { q: q.trim(), top_k },
    });
    res.json({ query: q, results: response.data.results });
  } catch (err) {
    console.error('SEARCH ERROR:', err.message);
    res.status(500).json({ detail: err.message });
  }
});

export default router;
