import axios from 'axios';

export const detectVinylCover = async (base64Image: string) => {
  try {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API Key missing, cannot process image');
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `너는 LP 레코드 전문가이자 시각 예술 분석가야.
첨부된 앨범 커버 이미지를 보고 다음을 분석해줘.

수행할 작업:
1. 주 앨범 식별: 이미지에 적힌 텍스트와 디자인을 종합하여 정확한 아티스트(Artist)와 앨범명(Album)을 분리해서 추출해라. 한국 가수의 앨범이라면 아티스트 이름과 앨범명, 트랙 이름을 한글로 정확하게 유추해서 적어라. (오타나 잘린 글자도 문맥에 맞게 완벽히 교정할 것)
2. 트랙리스트 식별: 앨범 표지에 곡 제목(Track)들이 적혀 있다면 식별 가능한 곡 제목들을 추출해라.
3. 시각적 키워드: 이미지의 분위기, 색감, 피사체 등을 묘사하는 키워드 3개를 영어로 추출해라.

출력 형식은 무조건 아래와 같은 순수 JSON 형식이어야 해. (마크다운 백틱 없이):
{
  "artist": "가수 이름",
  "album": "앨범 이름",
  "tracks": ["트랙1", "트랙2"],
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    console.log('[VisionAPI] Sending image to Gemini 2.5 Flash for OCR & Analysis...');
    const llmResponse = await axios.post(geminiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    const responseText = llmResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in response");
      const parsed = JSON.parse(jsonMatch[0]);
      
      console.log('[VisionAPI] Gemini Result:', parsed);

      return parsed;
    } catch (e) {
      console.log('JSON parsing failed, raw LLM answer:', responseText);
      return { textAnnotations: [], webDetection: { webEntities: [] } };
    }

  } catch (error) {
    console.error('Error calling Gemini Vision:', error);
    throw error;
  }
};
