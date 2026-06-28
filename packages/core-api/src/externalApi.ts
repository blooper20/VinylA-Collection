import axios from 'axios';

// Discogs API Search Function
export const searchDiscogs = async (query: string) => {
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN || process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  if (!token) {
    console.warn('Discogs token is missing! Falling back to iTunes Search API for demo.');
    try {
      const response = await axios.get('https://itunes.apple.com/search', {
        params: {
          term: query,
          entity: 'album',
          limit: 10
        }
      });
      return response.data.results.map((item: any) => ({
        id: item.collectionId,
        title: item.collectionName,
        artist: item.artistName,
        thumb: item.artworkUrl100?.replace('100x100bb', '600x600bb'),
        format: ['Album'],
        year: item.releaseDate ? item.releaseDate.substring(0, 4) : ''
      }));
    } catch (e) {
      console.error('iTunes fallback failed:', e);
      return [];
    }
  }
  
  try {
    const response = await axios.get('https://api.discogs.com/database/search', {
      params: {
        q: query,
        token: token,
        type: 'release',
        format: 'vinyl'
      },
    });
    return response.data.results;
  } catch (error) {
    console.error('Discogs search failed:', error);
    return [];
  }
};

// YouTube Data API Bridge Function
export const searchYouTube = async (query: string) => {
  const apiKey = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('YouTube API key is missing!');
    return [];
  }

  try {
    const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type: 'video',
        key: apiKey,
        maxResults: 5,
      },
    });
    return response.data.items;
  } catch (error) {
    console.error('YouTube search failed:', error);
    return [];
  }
};

// Google Cloud Vision API Function
export const analyzeImageWithVisionAPI = async (base64Image: string) => {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_VISION_API_KEY;
  
  if (!apiKey) {
    console.warn('Google Vision API key is missing! Returning mock text.');
    // Mock result for E2E testing
    return 'The Dark Side of the Moon Pink Floyd LP';
  }

  try {
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 10,
              },
            ],
          },
        ],
      }
    );
    const textAnnotations = response.data.responses[0]?.textAnnotations;
    if (textAnnotations && textAnnotations.length > 0) {
      return textAnnotations[0].description;
    }
    return '';
  } catch (error) {
    console.error('Vision API failed:', error);
    return '';
  }
};

