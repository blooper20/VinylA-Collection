import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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

const loadFFmpeg = async () => {
  if (ffmpegInstance) return ffmpegInstance;
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
};

export const trimVideo = async (
  file: Blob,
  start: number,
  end: number,
  onProgress?: (currentTime: number) => void
): Promise<Blob> => {
  const ffmpeg = await loadFFmpeg();
  const inputName = 'input.webm'; // Could be mp4, webm doesn't matter for input name much, ffmpeg auto-detects
  const outputName = 'output.mp4';
  
  ffmpeg.on('progress', ({ progress }) => {
    // progress is 0 to 1
    // currentTime = start + (end - start) * progress
    onProgress?.(start + (end - start) * progress);
  });

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  // -ss start -i input -t duration -c:v libx264 -preset ultrafast -c:a aac output.mp4
  const duration = end - start;
  await ffmpeg.exec([
    '-ss', start.toString(),
    '-i', inputName,
    '-t', duration.toString(),
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-c:a', 'aac',
    outputName
  ]);

  const data = await ffmpeg.readFile(outputName);
  
  // Cleanup
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  ffmpeg.off('progress', () => {});

  const bytes = data as Uint8Array;
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new Blob([arrayBuffer], { type: 'video/mp4' });
};
