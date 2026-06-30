import { analyzeImageWithVisionAPI } from '@vinyla/core-api';
import axios from 'axios';

export const detectVinylCover = async (base64Image: string) => {
  try {
    // 1단계: 구글 비전으로 원시 텍스트(OCR)만 추출 (안정성 100%)
    const visionResult = await analyzeImageWithVisionAPI(base64Image);
    const rawText = visionResult?.textAnnotations?.[0]?.description || '';
    
    if (!rawText) {
      return visionResult || {};
    }

    // 2단계: VibeProxy(LLM)에 텍스트와 시각적 키워드를 보내서 분석 및 시각적 유사 앨범 추천받기
    // (Base64 이미지를 직접 보내면 용량 초과로 502 에러가 나므로, 구글 비전이 추출한 시각적 키워드를 활용합니다.)
    const proxyUrl = 'http://192.168.0.24:8317/v1/chat/completions';
    
    // 구글 비전이 인식한 시각적 요소(색상, 사물, 분위기 등) 추출
    const visualKeywords = visionResult.webDetection?.webEntities
      ?.map((e: any) => e.description)
      ?.filter(Boolean)
      ?.slice(0, 15)
      ?.join(', ') || '알 수 없음';

    const prompt = `너는 LP 레코드 전문가이자 시각 예술 분석가야.
아래의 엉망진창인 OCR 텍스트와 앨범 커버의 시각적 요소(키워드)를 분석해줘.
OCR 텍스트: "${rawText}"
커버 이미지의 시각적 특징: "${visualKeywords}"

수행할 작업:
1. 주 앨범 식별: 이 앨범의 가장 유력한 "아티스트 - 앨범명"을 텍스트로 유추해라.
2. 유사 앨범 추천: 제공된 시각적 특징(예: ${visualKeywords})의 분위기, 색감, 테마와 "시각적으로 매우 유사한 디자인 감성을 가진 다른 앨범들" 5개를 추천해라. 반드시 실존하는 명반들이어야 해.

출력 형식은 무조건 아래와 같은 순수 JSON 형식이어야 해. (마크다운 백틱 없이):
{
  "mainAlbum": "아티스트 - 앨범명",
  "similarAlbums": [
    "아티스트 - 앨범명",
    "아티스트 - 앨범명"
  ]
}`;

    try {
      const llmResponse = await axios.post(proxyUrl, {
        model: 'gemini-3-pro', 
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7 
      }, {
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': 'Bearer sk-antigravity-local' 
        }
      });

      const responseText = llmResponse.data?.choices?.[0]?.message?.content?.trim() || '';
      
      try {
        // JSON 파싱 (마크다운 코드블럭이 섞여있을 경우 대비)
        const cleanJson = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.mainAlbum) {
          visionResult.textAnnotations.unshift({ description: parsed.mainAlbum });
        }
        if (parsed.similarAlbums && Array.isArray(parsed.similarAlbums)) {
          visionResult.similarAlbums = parsed.similarAlbums; // 추천 앨범 배열 저장
        }
      } catch (e) {
        console.log('JSON parsing failed, raw LLM answer:', responseText);
      }

    } catch (llmError) {
      console.log('LLM Parsing failed, falling back to raw Vision data', llmError);
    }

    return visionResult || {};
  } catch (error) {
    console.error('Error calling Vision API:', error);
    throw error;
  }
};
