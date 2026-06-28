import axios from 'axios';

// Discogs API Search Function
export const searchDiscogs = async (query: string) => {
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN || process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
  if (!token) {
    console.warn('Discogs token is missing! Returning mock data for demonstration.');
    // Return mock data for UI demo purposes when keys aren't set
    return [
      { id: 1, title: `${query} - Mock Result 1`, thumb: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=200&q=80', format: ['Vinyl', 'LP'] },
      { id: 2, title: `${query} - Mock Result 2`, thumb: 'https://images.unsplash.com/photo-1518655048521-f130df041f66?w=200&q=80', format: ['Vinyl', '12"'] },
    ];
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

