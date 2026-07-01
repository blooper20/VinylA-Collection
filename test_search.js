const axios = require('axios');

async function test() {
  const query = "양수경";
  const itRes = await axios.get('https://itunes.apple.com/search', {
    params: { term: query, entity: 'musicArtist', limit: 3 }
  });
  console.log('Alias for "양수경":', itRes.data.results?.[0]?.artistName);

  const query2 = "양수경 1집";
  const itRes2 = await axios.get('https://itunes.apple.com/search', {
    params: { term: query2, entity: 'musicArtist', limit: 3 }
  });
  console.log('Alias for "양수경 1집":', itRes2.data.results?.[0]?.artistName);
}
test();
