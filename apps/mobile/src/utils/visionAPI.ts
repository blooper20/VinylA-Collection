export const detectVinylCover = async (base64Image: string) => {
  const apiKey = process.env.EXPO_PUBLIC_VISION_API_KEY;
  if (!apiKey) {
    throw new Error('Vision API key is missing');
  }

  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  const requestBody = {
    requests: [
      {
        image: {
          content: base64Image,
        },
        features: [
          { type: 'WEB_DETECTION' },
          { type: 'TEXT_DETECTION' }
        ],
      },
    ],
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.responses[0];
  } catch (error) {
    console.error('Error calling Vision API:', error);
    throw error;
  }
};
