// 클라이언트 사이드 영상 트리밍 — 새 의존성(ffmpeg.wasm 등) 없이 브라우저
// 내장 HTMLVideoElement.captureStream() + MediaRecorder만으로 실제 재인코딩을
// 수행한다. 원리: 원본 영상을 트림 시작 지점부터 실제로 재생하면서, 그 스트림을
// MediaRecorder로 그대로 녹화하다가 트림 끝 지점에서 멈춘다 — 결과물은 진짜로
// 잘린 새 영상 파일이다. 트리밍 소요 시간은 대략 (end-start)초와 같다(실시간
// 재생 기반이라 원리상 그렇다).

export const getVideoDuration = (file: Blob): Promise<number> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('video load failed'));
    };
    video.src = objectUrl;
  });

// 이 브라우저가 트리밍에 필요한 API(스트림 캡처 + 녹화)를 지원하는지 — 구형
// Safari 등 미지원 환경에서는 트림 UI 자체를 건너뛰고 길이 제한만 안내한다.
export const isVideoTrimSupported = (): boolean =>
  typeof document !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  typeof (HTMLVideoElement.prototype as any).captureStream === 'function';

const RECORDER_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

const pickSupportedRecorderMimeType = (): string => {
  for (const mime of RECORDER_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return ''; // 브라우저 기본값에 맡긴다
};

// [start, end] 구간(초)만 실제로 재생 → 녹화해 잘라낸 새 Blob을 만든다.
// onProgress(currentTime)는 진행 표시용(재생 위치를 콜백으로 흘려줌).
export const trimVideo = (
  file: Blob,
  start: number,
  end: number,
  onProgress?: (currentTime: number) => void
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = false;
    video.volume = 0; // 오디오 트랙은 캡처하되 스피커로는 들리지 않게
    video.playsInline = true;

    let settled = false;
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error('video trim failed'));
    };

    video.onerror = () => fail(new Error('video load failed'));
    video.onloadedmetadata = () => {
      video.currentTime = start;
    };
    video.onseeked = () => {
      if (settled) return;
      try {
        const stream = (video as any).captureStream();
        const recorder = new MediaRecorder(stream, { mimeType: pickSupportedRecorderMimeType() || undefined });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onerror = (e) => fail((e as any).error || new Error('recorder error'));
        recorder.onstop = () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
        };

        recorder.start();
        video.play().catch(fail);

        const tick = () => {
          if (settled) return;
          onProgress?.(video.currentTime);
          if (video.currentTime >= end || video.ended) {
            video.pause();
            recorder.stop();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch (err) {
        fail(err);
      }
    };
  });
