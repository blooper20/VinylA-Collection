import { analyzeImageWithVisionAPI } from '@vinyla/core-api';

export const detectVinylCover = async (base64Image: string) => {
  try {
    const description = await analyzeImageWithVisionAPI(base64Image);
    return {
      textAnnotations: [
        { description }
      ]
    };
  } catch (error) {
    console.error('Error calling Vision API:', error);
    throw error;
  }
};
