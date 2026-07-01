import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { searchDiscogsLazy, AlbumItem } from '@vinyla/core-api';

dotenv.config();

const app = express();
app.use(cors());
// 50mb limit for large base64 camera images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url || url.includes('spacer.gif')) return null;
  try {
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'VinylA-Server/1.0' }
    });
    return Buffer.from(response.data, 'binary').toString('base64');
  } catch (error) {
    console.warn(`Failed to fetch image ${url}`);
    return null;
  }
}

app.post('/api/scan', async (req, res) => {
  try {
    const { base64Image, queries } = req.body;
    
    if (!base64Image || !queries || !Array.isArray(queries) || queries.length === 0) {
      return res.status(400).json({ error: 'Missing base64Image or queries' });
    }

    // 1. Gather candidate albums from Discogs using the queries sequentially
    const results: any[] = [];
    
    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      console.log(`[API] Trying Discogs search with query: "${q}"`);
      let foundMain = false;
      await searchDiscogsLazy(q, (album: AlbumItem) => {
          if (results.some((a) => a.ALBUM_ID === Number(album.id))) return;
          const combinedGenres = Array.from(new Set([
            ...(album.country ? [album.country] : []),
            ...(album.genre || []),
            ...(album.style || [])
          ]));

          results.push({
            ALBUM_ID: Number(album.id) || Date.now() + Math.random(),
            TITLE: album.title || 'Unknown Title',
            ARTIST: album.artist || 'Unknown Artist',
            RELEASE_YEAR: parseInt(album.year) || 2024,
            IMAGE_URL: album.thumb || '',
            VINYL_IMAGE_URL: '',
            CUSTOM_COLOR_HEX: '#111',
            CUSTOM_STYLE_TYPE: 'SOLID',
            GENRES: combinedGenres
          });
          foundMain = true;
      });

      if (foundMain) {
        console.log(`[API] Success! Found main album results using query: "${q}"`);
        break;
      }
      
      if (i < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    if (results.length === 0) {
      return res.json({ matchedIndex: -1, candidates: [] });
    }

    // Limit candidates to 5 max to prevent payload from becoming too massive
    const candidates = results.slice(0, 5);

    // 2. Fetch candidate images as base64 for VLM comparison
    console.log(`[API] Fetching ${candidates.length} candidate images for VLM...`);
    const candidateBase64s = await Promise.all(
      candidates.map(c => fetchImageAsBase64(c.IMAGE_URL))
    );

    // 3. Construct VLM Prompt with Interleaved Images
    const contentPayload: any[] = [
      { 
        text: 'You are an expert vinyl record identifier. I will provide an Original Photo of an album cover, followed by several Candidate Albums (each with its artist, title, and cover image).\n\nYour task: Carefully compare the Original Photo with the Candidate Album images. Find the exact visual match.\n\nReturn ONLY a JSON object: {"matchedIndex": <index>}. If none match, return {"matchedIndex": -1}.\n\n--- ORIGINAL PHOTO ---' 
      },
      {
        inlineData: { mimeType: 'image/jpeg', data: base64Image }
      }
    ];

    candidates.forEach((c, index) => {
      contentPayload.push({
        text: `\n--- CANDIDATE [${index}] ---\nArtist: ${c.ARTIST}\nTitle: ${c.TITLE}\nCover Image:`
      });
      if (candidateBase64s[index]) {
        contentPayload.push({
          inlineData: { mimeType: 'image/jpeg', data: candidateBase64s[index] }
        });
      } else {
        contentPayload.push({
          text: `(No image available)`
        });
      }
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing in backend .env");
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ parts: contentPayload }],
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } }
    };

    console.log(`[API] Sending prompt to VLM...`);
    
    const vlmRes = await axios.post(geminiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    const vlmText = vlmRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    console.log('[API] VLM response:', vlmText);
    
    // Parse response
    let matchedIndex = -1;
    try {
      const parsed = JSON.parse(vlmText);
      if (typeof parsed.matchedIndex === 'number') {
        matchedIndex = parsed.matchedIndex;
      }
    } catch (e) {
      console.error('[API] Failed to parse VLM JSON response', e);
    }
    
    res.json({
      matchedIndex,
      candidates,
      bestMatch: matchedIndex >= 0 && matchedIndex < candidates.length ? candidates[matchedIndex] : null
    });

  } catch (error: any) {
    console.error('[API] Scan endpoint error:', error?.response?.data || error?.message || error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`VinylA API Server running on port ${PORT}`);
});
