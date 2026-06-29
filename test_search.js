require('dotenv').config({ path: '/Users/jaewoo/dev/personal/VinylA-Collection/apps/web/.env' });
const axios = require('axios');

async function test() {
  const query = "검정치마";
  const iRes = await axios.get('https://itunes.apple.com/search', {
    params: { term: query, entity: 'album', limit: 15 }
  });
  
  const itunesResults = iRes.data.results;
  console.log(`Found ${itunesResults.length} iTunes results.`);
  
  const authParams = {
    key: process.env.EXPO_PUBLIC_DISCOGS_KEY,
    secret: process.env.EXPO_PUBLIC_DISCOGS_SECRET
  };
  
  for (const album of itunesResults.slice(0, 5)) {
    const cleanTitle = album.collectionName.replace(/ - EP| - Single/g, '').replace(/\([^)]*\)/g, '').trim();
    let dRes = await axios.get('https://api.discogs.com/database/search', {
      params: { q: `${album.artistName} ${cleanTitle}`, ...authParams, type: 'release', format: 'vinyl' }
    });
    
    let bestMatch = dRes.data.results?.find((r) => {
      const t = (r.title || '').toLowerCase();
      return t.includes(album.artistName.toLowerCase()) || t.includes(query.toLowerCase());
    });
    
    if (!bestMatch) {
      dRes = await axios.get('https://api.discogs.com/database/search', {
        params: { q: `${query} ${cleanTitle}`, ...authParams, type: 'release', format: 'vinyl' }
      });
      bestMatch = dRes.data.results?.find((r) => {
        const t = (r.title || '').toLowerCase();
        return t.includes(album.artistName.toLowerCase()) || t.includes(query.toLowerCase());
      });
    }
    
    if (bestMatch) {
      console.log(`[PASS] iTunes: ${album.collectionName} -> Discogs: ${bestMatch.title}`);
    } else {
      console.log(`[FAIL] iTunes: ${album.collectionName} -> No valid Discogs match`);
    }
  }
}

test();
