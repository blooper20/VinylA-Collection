import { describe, it, expect, vi } from 'vitest';
import { getHighQualityArtwork } from '../externalApi';
import axios from 'axios';

vi.mock('axios');

describe('externalApi', () => {
  describe('getHighQualityArtwork', () => {
    it('returns the high quality artwork url if iTunes match is found', async () => {
      const mockResult = {
        data: {
          results: [{ artworkUrl100: 'http://example.com/image100x100bb.jpg' }]
        }
      };
      (axios.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const url = await getHighQualityArtwork('Album Title', 'Artist', 'fallback.jpg');
      expect(url).toBe('http://example.com/image600x600bb.jpg');
    });

    it('returns the fallback url if no match is found', async () => {
      const mockResult = { data: { results: [] } };
      (axios.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockResult);

      const url = await getHighQualityArtwork('Unknown', 'Unknown', 'fallback.jpg');
      expect(url).toBe('fallback.jpg');
    });

    it('returns the fallback url on API error', async () => {
      (axios.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network Error'));

      const url = await getHighQualityArtwork('Album', 'Artist', 'fallback.jpg');
      expect(url).toBe('fallback.jpg');
    });
  });
});
