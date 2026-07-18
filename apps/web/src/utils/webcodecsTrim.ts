import { createFile, DataStream, Log, MP4BoxBuffer, type Sample, type Track } from 'mp4box';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

// mp4box가 무해한 파싱 잡음(아이폰 MOV의 패딩 박스 등)도 console.error로
// 찍어 Next.js 개발 오버레이를 띄운다 — warn으로 낮춘다.
Log.error = (module: string, msg?: string) => console.warn('[mp4box]', module, msg);

// WebCodecs(하드웨어 가속) 기반 영상 트리밍.
// ffmpeg.wasm은 소프트웨어 단일 스레드라 4K 15초 재인코딩에 수십 초가
// 걸리지만, 이 경로는 OS 하드웨어 디코더/인코더를 쓰므로 2~3초면 끝난다.
// 실패하면 호출부(videoTrim.ts)가 ffmpeg.wasm으로 폴백한다.

const OUTPUT_BOX = 1280; // 긴 변 기준 최대 해상도(ffmpeg 폴백 경로와 동일)
const MAX_VIDEO_KBPS = 4000;
// 슬로모 원본(120fps 등)의 전 프레임을 인코딩하면 재생이 무겁고(기기 디코더
// 한계 초과로 끊김·되감김) 고정 비트레이트에서 프레임당 화질도 나빠진다 —
// 60fps를 넘는 프레임은 솎아낸다. 실측: 120fps 결과물이 재생 중 끊기며
// 처음으로 되돌아가는 문제(2026-07-18).
const MAX_OUTPUT_FPS = 60;
// 타임스탬프 지터로 정상 60fps 프레임이 솎이지 않도록 약간의 여유를 둔다
const MIN_FRAME_GAP_US = 1e6 / MAX_OUTPUT_FPS - 1000;
const AUDIO_ES_DESCRIPTOR_TAG = 0x04;
const AUDIO_DEC_SPECIFIC_TAG = 0x05;

export const isWebCodecsSupported = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.VideoDecoder !== 'undefined' &&
  typeof window.VideoEncoder !== 'undefined';

// 인코더 단계에서 난 실패 표시. 캔버스 변환 재시도는 인코더에 들어가는
// 프레임만 바꾸므로 이 타입일 때만 재시도가 의미 있다 — 호출부(videoTrim.ts)가
// 이걸 보고 디코드/파싱 실패면 재시도 없이 바로 ffmpeg로 폴백한다.
export class WebCodecsEncodeError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'WebCodecsEncodeError';
  }
}

// stsd 엔트리에서 코덱 초기화 데이터(avcC/hvcC 등)를 뽑아 VideoDecoder의
// description으로 넘긴다 — 이게 없으면 H.264/HEVC 디코더가 설정되지 않는다.
const getVideoDescription = (mp4: ReturnType<typeof createFile>, trackId: number): Uint8Array | undefined => {
  // 박스 트리 구조는 mp4box 타입에 노출되지 않아 any로 내려간다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trak = mp4.getTrackById(trackId) as any;
  const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
  const box = entry?.avcC || entry?.hvcC || entry?.vpcC || entry?.av1C;
  if (!box) return undefined;
  const stream = new DataStream(); // 기본 엔디안이 BIG_ENDIAN

  box.write(stream);
  return new Uint8Array(stream.buffer, 8); // 8바이트 박스 헤더(size+fourcc) 제거
};

// AAC 패스스루 먹싱에 필요한 AudioSpecificConfig를 esds에서 추출한다.
// 실패하면 샘플레이트/채널 수로 2바이트 ASC(AAC-LC)를 직접 만든다.
const getAudioSpecificConfig = (
  mp4: ReturnType<typeof createFile>,
  track: Track
): Uint8Array => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trak = mp4.getTrackById(track.id) as any;
    const esds = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0]?.esds?.esd;
    const decoderConfig = esds?.descs?.find((d: { tag: number }) => d.tag === AUDIO_ES_DESCRIPTOR_TAG);
    const specific = decoderConfig?.descs?.find((d: { tag: number }) => d.tag === AUDIO_DEC_SPECIFIC_TAG);
    if (specific?.data?.length) return new Uint8Array(specific.data);
  } catch {
    // 아래 수동 생성으로 폴백
  }
  const sampleRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
  const freqIndex = Math.max(0, sampleRates.indexOf(track.audio?.sample_rate ?? 44100));
  const channels = track.audio?.channel_count ?? 2;
  const asc = (2 << 11) | (freqIndex << 7) | (channels << 3); // AAC-LC 프로파일
  return new Uint8Array([asc >> 8, asc & 0xff]);
};

// tkhd 변환 행렬(16.16 고정소수점)에서 회전 각도를 복원한다 — 아이폰 세로
// 영상은 픽셀은 가로로 저장하고 행렬로 90° 회전을 표시하므로, 이걸 무시하면
// 결과물이 눕는다.
const getRotation = (matrix: Track['matrix']): 0 | 90 | 180 | 270 => {
  const m = Array.from(matrix as ArrayLike<number>);
  const a = m[0] / 65536;
  const b = m[1] / 65536;
  const deg = ((Math.round((Math.atan2(b, a) * 180) / Math.PI) % 360) + 360) % 360;
  if (deg === 90 || deg === 180 || deg === 270) return deg;
  return 0;
};

interface DemuxResult {
  info: { videoTrack: Track; audioTrack: Track | null };
  videoSamples: Sample[];
  audioSamples: Sample[];
  videoDescription: Uint8Array | undefined;
  audioSpecificConfig: Uint8Array | null;
}

const demux = async (file: Blob): Promise<DemuxResult> => {
  const buffer = await file.arrayBuffer();
  const mp4 = createFile();
  const videoSamples: Sample[] = [];
  const audioSamples: Sample[] = [];
  let videoTrack: Track | null = null;
  let audioTrack: Track | null = null;
  let parseError: Error | null = null;

  // 추출 옵션은 onReady 콜백 "안에서"(파싱 진행 중에) 걸어야 한다 — 파싱이
  // 끝난 뒤에 걸면 이미 지나간 mdat 구간의 샘플은 배달되지 않는다.
  mp4.onError = (module: string, msg: string) => {
    parseError = new Error(`mp4box: ${module} ${msg}`);
  };
  mp4.onSamples = (id: number, _user: unknown, samples: Sample[]) => {
    if (videoTrack && id === videoTrack.id) videoSamples.push(...samples);
    else audioSamples.push(...samples);
  };
  mp4.onReady = (movie) => {
    videoTrack = movie.videoTracks[0] ?? null;
    audioTrack = movie.audioTracks[0] ?? null;
    if (!videoTrack) return;
    mp4.setExtractionOptions(videoTrack.id, null, { nbSamples: videoTrack.nb_samples });
    if (audioTrack) mp4.setExtractionOptions(audioTrack.id, null, { nbSamples: audioTrack.nb_samples });
    mp4.start();
  };
  mp4.appendBuffer(MP4BoxBuffer.fromArrayBuffer(buffer, 0));
  mp4.flush();

  if (parseError) throw parseError;
  if (!videoTrack) throw new Error('no video track');
  if (videoSamples.length === 0) throw new Error('no video samples extracted');

  return {
    info: { videoTrack, audioTrack },
    videoSamples,
    audioSamples,
    videoDescription: getVideoDescription(mp4, (videoTrack as Track).id),
    audioSpecificConfig: audioTrack ? getAudioSpecificConfig(mp4, audioTrack) : null,
  };
};

const sampleTimeUs = (s: Sample) => (s.cts / s.timescale) * 1e6;
const sampleDtsUs = (s: Sample) => (s.dts / s.timescale) * 1e6;
const sampleDurationUs = (s: Sample) => (s.duration / s.timescale) * 1e6;

// 디코더 코덱 문자열. 아이폰 HDR(돌비비전, dvh1/dvhe)은 브라우저가 그 이름
// 그대로는 못 받지만 밑바탕은 HEVC라 hvc1 일반 문자열로 바꿔 시도한다.
const decoderCodecString = (codec: string): string => {
  if (codec.startsWith('dvh1') || codec.startsWith('dvhe')) return 'hvc1.2.4.L153.B0';
  return codec;
};

// 10비트 원본 감지 — HEVC Main10(프로파일 2)과 돌비비전. 10비트 프레임은
// 8비트 H.264 인코더에 직접 넣으면 인코딩이 끝 무렵 실패해 재시도로 시간을
// 낭비하므로, 처음부터 캔버스 변환 경로로 보낸다.
const isTenBitCodec = (codec: string): boolean =>
  codec.startsWith('hvc1.2') ||
  codec.startsWith('hev1.2') ||
  codec.startsWith('dvh1') ||
  codec.startsWith('dvhe');

export const trimVideoWebCodecs = async (
  file: Blob,
  start: number,
  end: number,
  maxBytes: number,
  onProgress?: (ratio: number) => void,
  // 10비트 HDR(아이폰 HDR/돌비비전) 프레임은 8비트 H.264 인코더에 직접
  // 먹이면 "Encoding error"가 난다 — 캔버스를 거치면 GPU가 8비트 SDR로
  // 톤매핑 변환해 준다. 직접 인코딩이 실패했을 때 재시도용으로 켠다.
  convertViaCanvas = false
): Promise<Blob> => {
  const { info, videoSamples, audioSamples, videoDescription, audioSpecificConfig } = await demux(file);
  const { videoTrack, audioTrack } = info;

  const useCanvas = convertViaCanvas || isTenBitCodec(videoTrack.codec);

  const startUs = start * 1e6;
  const endUs = end * 1e6;
  const durationSec = end - start;

  const srcW = videoTrack.video?.width || videoTrack.track_width;
  const srcH = videoTrack.video?.height || videoTrack.track_height;
  // 실패 에러 메시지에 원본 코덱·해상도를 남긴다 — 어떤 파일 조합이
  // WebCodecs에서 실패해 ffmpeg 폴백을 타는지 추적하는 용도.
  const sourceInfo = `${videoTrack.codec} ${srcW}x${srcH}`;

  const decoderConfig: VideoDecoderConfig = {
    codec: decoderCodecString(videoTrack.codec),
    description: videoDescription as BufferSource | undefined,
  };
  const decoderSupport = await window.VideoDecoder.isConfigSupported(decoderConfig);
  if (!decoderSupport.supported) throw new Error(`decoder unsupported (${sourceInfo})`);

  // 출력 해상도: 코딩 해상도 기준 1280 박스로 축소(작으면 그대로), 짝수 보정
  const scale = Math.min(1, OUTPUT_BOX / Math.max(srcW, srcH));
  const outW = Math.round((srcW * scale) / 2) * 2;
  const outH = Math.round((srcH * scale) / 2) * 2;

  const totalKbps = Math.floor(((maxBytes * 8) / 1000 / durationSec) * 0.9);
  const videoKbps = Math.min(MAX_VIDEO_KBPS, Math.max(200, totalKbps - 128));

  const encoderConfig: VideoEncoderConfig = {
    codec: 'avc1.640028', // H.264 High@L4.0 — 1280px·60fps까지 무난
    width: outW,
    height: outH,
    bitrate: videoKbps * 1000,
  };
  const encoderSupport = await window.VideoEncoder.isConfigSupported(encoderConfig);
  if (!encoderSupport.supported) throw new Error('avc encoder unsupported');

  const rotation = getRotation(videoTrack.matrix);
  const includeAudio = !!audioTrack && audioTrack.codec.startsWith('mp4a');

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: outW, height: outH, rotation },
    audio: includeAudio
      ? {
          codec: 'aac',
          numberOfChannels: audioTrack!.audio?.channel_count ?? 2,
          sampleRate: audioTrack!.audio?.sample_rate ?? 44100,
        }
      : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'cross-track-offset',
  });

  // ── 비디오: 디코드 → 캔버스 축소 → 인코드 ─────────────────────
  // 트림 시작점 직전의 키프레임부터 디코딩해야 그 이후 프레임들이 깨지지
  // 않는다. dts가 끝 시각을 넘는 샘플부터는 디코딩할 필요가 없다.
  let keyIndex = 0;
  for (let i = 0; i < videoSamples.length; i++) {
    const s = videoSamples[i];
    if (s.is_sync && sampleTimeUs(s) <= startUs) keyIndex = i;
    if (sampleTimeUs(s) > startUs) break;
  }
  const decodeSamples = [];
  for (let i = keyIndex; i < videoSamples.length; i++) {
    if (sampleDtsUs(videoSamples[i]) > endUs) break;
    decodeSamples.push(videoSamples[i]);
  }
  if (decodeSamples.length === 0) throw new Error('no samples in trim range');

  // 진행률/손실률 판정 기준도 아래 handleFrame과 같은 60fps 솎기를 시뮬레이션
  // 해서 계산한다 — 전체 프레임 수로 나누면 120fps 원본에서 진행률이 50%에서
  // 멈추고 "프레임 손실" 오검출로 ffmpeg 폴백을 타게 된다.
  const inRangeTs = decodeSamples
    .map(sampleTimeUs)
    .filter((t) => t >= startUs && t < endUs)
    .sort((a, b) => a - b);
  let expectedFrames = 0;
  let simLastTs = -Infinity;
  for (const t of inRangeTs) {
    if (t - simLastTs >= MIN_FRAME_GAP_US) {
      expectedFrames += 1;
      simLastTs = t;
    }
  }

  let encodedCount = 0;
  let encodeError: Error | null = null;
  const KEYFRAME_INTERVAL_US = 2e6;
  let lastKeyframeTs = -Infinity;

  let canvasCtx: OffscreenCanvasRenderingContext2D | null = null;
  let canvas: OffscreenCanvas | null = null;
  if (useCanvas) {
    canvas = new OffscreenCanvas(outW, outH);
    canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) throw new Error('canvas 2d unavailable');
  }

  const encoder = new window.VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
      encodedCount += 1;
      if (expectedFrames > 0) onProgress?.(Math.min(1, encodedCount / expectedFrames));
    },
    error: (e) => {
      encodeError = e instanceof Error ? e : new Error(String(e));
    },
  });
  encoder.configure(encoderConfig);

  let decodeError: Error | null = null;
  let lastKeptTs = -Infinity;
  const handleFrame = (frame: VideoFrame) => {
    const ts = frame.timestamp;
    if (ts < startUs || ts >= endUs) {
      frame.close();
      return;
    }
    // 60fps 초과분 솎기 (위 MAX_OUTPUT_FPS 주석 참고)
    if (ts - lastKeptTs < MIN_FRAME_GAP_US) {
      frame.close();
      return;
    }
    lastKeptTs = ts;
    const needKey = ts - lastKeyframeTs >= KEYFRAME_INTERVAL_US;
    if (needKey) lastKeyframeTs = ts;
    if (useCanvas && canvasCtx && canvas) {
      // 10비트 HDR → 8비트 SDR 변환 경로(위 convertViaCanvas 주석 참고)
      canvasCtx.drawImage(frame, 0, 0, outW, outH);
      const converted = new VideoFrame(canvas, { timestamp: ts, duration: frame.duration ?? undefined });
      frame.close();
      encoder.encode(converted, { keyFrame: needKey });
      converted.close();
    } else {
      // 기본: 프레임을 인코더에 그대로 넘긴다 — Chrome이 내부(GPU)에서
      // 설정 해상도로 스케일링해 준다.
      encoder.encode(frame, { keyFrame: needKey });
      frame.close();
    }
  };

  const makeDecoder = () => {
    const d = new window.VideoDecoder({
      output: handleFrame,
      error: (e) => {
        decodeError = e instanceof Error ? e : new Error(String(e));
      },
    });
    d.configure(decoderConfig);
    return d;
  };
  let decoder = makeDecoder();

  // 디코더/인코더 큐가 밀리면 잠시 쉬어 프레임이 메모리에 쌓이는 것을 막는다.
  // 대기는 setTimeout이 아니라 dequeue 이벤트로 한다 — 타이머는 탭이
  // 백그라운드면 1초로 스로틀돼 전체 처리가 수십 초로 늘어난다.
  const waitForQueueDrain = () =>
    new Promise<void>((resolve) => {
      let settled = false;
      const d = decoder;
      const finish = () => {
        if (settled) return;
        settled = true;
        d.removeEventListener('dequeue', finish);
        encoder.removeEventListener('dequeue', finish);
        clearTimeout(timer);
        resolve();
      };
      d.addEventListener('dequeue', finish);
      encoder.addEventListener('dequeue', finish);
      // 이벤트가 유실되는 드문 경우를 위한 안전망
      const timer = setTimeout(finish, 250);
    });

  // 이 Mac의 VideoToolbox가 특정 구간에서 디코딩에 실패하는 파일이 있다
  // (미리보기 <video>의 -12909 에러와 같은 원인). 그때 전체를 포기하고 느린
  // ffmpeg로 떨어지는 대신, 실제 플레이어들처럼 죽은 디코더를 새로 만들어
  // 문제 GOP(다음 키프레임 전까지)만 건너뛰고 이어서 처리한다.
  const MAX_DECODER_RESETS = 5;
  let decoderResets = 0;
  let sampleIdx = 0;
  while (sampleIdx < decodeSamples.length) {
    if (decodeError) {
      if (decoderResets >= MAX_DECODER_RESETS) break;
      decoderResets += 1;
      if (decoder.state !== 'closed') decoder.close();
      let next = sampleIdx + 1;
      while (next < decodeSamples.length && !decodeSamples[next].is_sync) next += 1;
      console.warn(
        `[webcodecsTrim] 디코더 오류 — 다음 키프레임으로 건너뛰고 재시작 (reset ${decoderResets}, sample ${sampleIdx}→${next})`
      );
      if (next >= decodeSamples.length) break;
      sampleIdx = next;
      decodeError = null;
      decoder = makeDecoder();
      continue;
    }
    if (encodeError) break;
    if (decoder.decodeQueueSize > 12 || encoder.encodeQueueSize > 12) {
      await waitForQueueDrain();
      continue;
    }
    const s = decodeSamples[sampleIdx];
    sampleIdx += 1;
    if (!s.data) continue;
    decoder.decode(
      new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: sampleTimeUs(s),
        duration: sampleDurationUs(s),
        data: s.data,
      })
    );
  }
  try {
    if (!decodeError && !encodeError && decoder.state !== 'closed') {
      await decoder.flush();
    }
  } catch {
    // 마지막 GOP 도중 디코더가 죽은 경우 — 여기까지 인코딩된 프레임으로 진행
  }
  try {
    if (!encodeError) await encoder.flush();
  } catch (e) {
    // flush 도중에 도착한 인코더 에러도 인코드 실패로 분류한다
    encodeError = e instanceof Error ? e : new Error(String(e));
  } finally {
    // 에러로 이미 'closed' 상태가 된 코덱에 close()를 또 부르면 예외가 난다
    if (decoder.state !== 'closed') decoder.close();
    if (encoder.state !== 'closed') encoder.close();
  }
  if (encodeError) throw new WebCodecsEncodeError(`${encodeError.message} (${sourceInfo})`, encodeError);
  if (encodedCount === 0) {
    const cause = decodeError ?? new Error('no frames encoded');
    throw new Error(`webcodecs decode failed (${sourceInfo}): ${cause.message}`, { cause });
  }
  // 건너뛴 구간이 전체의 20%를 넘으면 결과물이 너무 훼손된 것 — 느리더라도
  // 소프트웨어 디코딩(ffmpeg)으로 온전한 결과를 만드는 편이 낫다.
  if (encodedCount < expectedFrames * 0.8) {
    throw new Error(`too many frames lost to decoder errors: ${encodedCount}/${expectedFrames} (${sourceInfo})`);
  }
  onProgress?.(1);

  // ── 오디오: AAC 샘플을 재인코딩 없이 그대로 잘라 붙인다 ─────────
  if (includeAudio && audioSpecificConfig) {
    const meta: EncodedAudioChunkMetadata = {
      decoderConfig: {
        codec: audioTrack!.codec,
        numberOfChannels: audioTrack!.audio?.channel_count ?? 2,
        sampleRate: audioTrack!.audio?.sample_rate ?? 44100,
        description: audioSpecificConfig,
      },
    };
    let first = true;
    for (const s of audioSamples) {
      const t = sampleTimeUs(s);
      if (t < startUs || t >= endUs || !s.data) continue;
      muxer.addAudioChunkRaw(s.data, 'key', t, sampleDurationUs(s), first ? meta : undefined);
      first = false;
    }
  }

  muxer.finalize();
  const blob = new Blob([target.buffer], { type: 'video/mp4' });
  if (blob.size > maxBytes) throw new Error(`webcodecs output too large: ${blob.size}`);
  return blob;
};
