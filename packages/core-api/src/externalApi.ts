import axios from 'axios';

// Discogs API Search Function
export const searchDiscogs = async (query: string) => {
  const token = process.env.EXPO_PUBLIC_DISCOGS_TOKEN;
  if (!token) {
    console.warn('Discogs token is missing!');
    return [];
  }
  
  try {
    const response = await axios.get('https://api.discogs.com/database/search', {
      params: {
        q: query,
        token: token,
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
  const apiKey = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;
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
