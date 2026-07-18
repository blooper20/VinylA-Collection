import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { isWebCodecsSupported, trimVideoWebCodecs, WebCodecsEncodeError } from './webcodecsTrim';

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

export const isVideoTrimSupported = (): boolean =>
  typeof document !== 'undefined';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

const loadFFmpeg = () => {
  if (ffmpegInstance) return Promise.resolve(ffmpegInstance);
  // 동시에 여러 번 불려도(트림 화면 mount 시 미리 로드 + 실제 자르기 클릭)
  // fetch가 중복 시작되지 않도록 진행 중인 로딩 프라미스를 공유한다.
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();
  }
  return ffmpegLoadPromise;
};

// 트림 화면이 뜨는 즉시 호출해 ffmpeg.wasm 코어(수십MB) 다운로드/컴파일을
// 사용자가 구간을 고르는 동안 백그라운드에서 끝내둔다 — "자르기" 클릭 후
// 대기 시간의 상당 부분이 이 최초 로딩이었다.
export const preloadFFmpeg = (): void => {
  loadFFmpeg().catch(() => {
    // 실패해도 여기서는 무시 — 실제 트리밍 시점에 다시 시도되고 그때 에러 처리된다.
  });
};

export const trimVideo = async (
  file: Blob,
  start: number,
  end: number,
  maxBytes: number,
  onProgress?: (ratio: number) => void
): Promise<Blob> => {
  // 1순위: WebCodecs(하드웨어 가속) — ffmpeg.wasm(소프트웨어 단일 스레드)
  // 대비 수십 배 빠르고, 결과물도 항상 용량 한도 안으로 나온다.
  if (isWebCodecsSupported()) {
    try {
      return await trimVideoWebCodecs(file, start, end, maxBytes, onProgress);
    } catch (e) {
      // 캔버스 변환은 인코더에 들어가는 프레임만 바꾸므로, 재시도가 의미 있는
      // 건 인코드 실패(10비트 HDR 프레임을 8비트 H.264 인코더에 직접 넣은
      // 경우)뿐이다. 디코드/파싱 실패는 캔버스 경로도 같은 지점에서 똑같이
      // 죽으므로 재시도 없이 바로 ffmpeg.wasm으로 폴백한다.
      if (e instanceof WebCodecsEncodeError) {
        console.warn('[videoTrim] WebCodecs 인코딩 실패 — 캔버스 변환으로 재시도', e);
        onProgress?.(0);
        try {
          return await trimVideoWebCodecs(file, start, end, maxBytes, onProgress, true);
        } catch (e2) {
          console.warn('[videoTrim] WebCodecs 캔버스 경로도 실패 — ffmpeg.wasm으로 폴백', e2);
        }
      } else {
        console.warn('[videoTrim] WebCodecs 실패(디코드/파싱) — ffmpeg.wasm으로 폴백', e);
      }
      onProgress?.(0);
    }
  }
  return trimVideoFFmpeg(file, start, end, maxBytes, onProgress);
};

const trimVideoFFmpeg = async (
  file: Blob,
  start: number,
  end: number,
  maxBytes: number,
  onProgress?: (ratio: number) => void
): Promise<Blob> => {
  const ffmpeg = await loadFFmpeg();
  const inputName = 'input.webm'; // Could be mp4, webm doesn't matter for input name much, ffmpeg auto-detects
  const outputName = 'output.mp4';

  // 진행률은 재인코딩 단계에서만 보고한다. 1차 스트림 카피 단계까지 보고하면
  // 카피가 100%를 찍은 뒤 용량 초과로 버려지고 재인코딩이 다시 0%부터 올라가
  // "다 됐다가 다시 시작하는" 것처럼 보인다.
  let reportProgress = false;
  const handleProgress = ({ progress }: { progress: number }) => {
    // progress는 0~1이지만 ffmpeg가 첫 seek 단계에서 1을 넘기거나
    // 음수를 보내는 경우가 있어 방어적으로 clamp한다.
    if (reportProgress) onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  ffmpeg.on('progress', handleProgress);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const duration = end - start;
    const baseArgs = ['-ss', start.toString(), '-i', inputName, '-t', duration.toString()];
    // -ss를 -i보다 앞에 두는 빠른 seek와 스트림 카피를 같이 쓰면 프레젠테이션
    // 타임스탬프가 0부터 시작하지 않거나 moov가 파일 끝에 남아, 일부 브라우저
    // <video>가 초반 몇 초만 재생하고 멈추는 문제가 있었다 — 항상 붙여준다.
    const muxArgs = ['-avoid_negative_ts', 'make_zero', '-movflags', '+faststart'];

    // 1차: 스트림 카피(-c copy) — 디코드/인코드 없이 패킷을 그대로 잘라내므로
    // 원본이 이미 mp4 호환 코덱(h264/aac 등)이면 재인코딩보다 훨씬 빠르다.
    // 다만 원본 비트레이트를 그대로 유지하므로, 결과물이 용량 한도를 넘으면
    // 버리고 아래에서 비트레이트를 제한한 재인코딩으로 다시 만든다.
    //
    // 용량 한도만으로는 부족하다 — 4K 120fps 슬로모(25Mbps)가 15초 46MB로
    // 50MB 한도를 통과해 그대로 업로드됐고, 대부분 기기의 하드웨어 디코더
    // 한계(H.264 4K는 보통 60fps까지)를 넘어 재생이 끊기며 처음으로
    // 되돌아갔다(2026-07-18 실측). 재생 가능한 수준의 비트레이트일 때만
    // 카피를 쓰고, 넘으면 해상도·fps를 줄이는 재인코딩으로 보낸다.
    const MAX_COPY_KBPS = 8000;
    let data: Uint8Array | null = null;
    try {
      const copyExit = await ffmpeg.exec([...baseArgs, '-c', 'copy', ...muxArgs, outputName]);
      const copyResult = await ffmpeg.readFile(outputName);
      const bytes = copyResult as Uint8Array;
      const copyKbps = (bytes.byteLength * 8) / 1000 / duration;
      if (copyExit === 0 && bytes.byteLength > 0 && bytes.byteLength <= maxBytes && copyKbps <= MAX_COPY_KBPS) {
        data = bytes;
      }
    } catch {
      // 스트림 카피 실패 — 아래에서 재인코딩으로 재시도한다.
    }

    if (!data) {
      await ffmpeg.deleteFile(outputName).catch(() => {});
      reportProgress = true;
      // 결과물이 maxBytes 안에 들어오도록 목표 비트레이트를 역산하되
      // (컨테이너 오버헤드 감안해 10% 여유), 한도를 꽉 채우는 초고비트레이트
      // (50MB/15초 ≈ 26Mbps)는 인코딩·업로드를 모두 느리게 만들 뿐이라
      // 다이어리 재생 용도로 충분한 4Mbps로 상한을 둔다.
      const audioKbps = 96;
      const totalKbps = Math.floor((maxBytes * 8) / 1000 / duration * 0.9);
      const videoKbps = Math.min(4000, Math.max(200, totalKbps - audioKbps));
      await ffmpeg.exec([
        ...baseArgs,
        // 4K 원본을 그대로 인코딩하면 wasm 단일 스레드로 매우 느리다 —
        // 1280 박스 안으로만 줄인다(min()이라 작은 영상은 확대하지 않는다).
        '-vf', 'scale=min(1280\\,iw):min(1280\\,ih):force_original_aspect_ratio=decrease:force_divisible_by=2',
        // 슬로모(120fps+) 원본을 그대로 인코딩하면 재생이 무겁고 프레임당
        // 화질도 떨어진다 — 60fps로 고정(-fpsmax는 이 wasm 코어의 ffmpeg
        // 버전에서 지원이 불확실해, 어디서나 동작하는 -r을 쓴다).
        '-r', '60',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        // 10비트 HDR(돌비비전 아이폰 영상 등) 원본이 그대로 high10 프로파일로
        // 인코딩되면 일부 기기에서 재생이 안 된다 — 8비트로 고정.
        '-pix_fmt', 'yuv420p',
        '-b:v', `${videoKbps}k`,
        '-maxrate', `${Math.round(videoKbps * 1.3)}k`,
        '-bufsize', `${videoKbps * 2}k`,
        '-c:a', 'aac',
        '-b:a', `${audioKbps}k`,
        ...muxArgs,
        outputName,
      ]);
      data = (await ffmpeg.readFile(outputName)) as Uint8Array;
    }

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    const bytes = data;
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    return new Blob([arrayBuffer], { type: 'video/mp4' });
  } finally {
    // 인스턴스는 모듈 전역에 캐시되어 재사용되므로, 리스너를 지우지 않으면
    // 다음 트리밍 때 이전 호출의 onProgress까지 같이 불려 진행률이 뒤엉킨다.
    ffmpeg.off('progress', handleProgress);
  }
};
