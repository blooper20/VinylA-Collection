'use client';

import React from 'react';
import styles from './MediaAttachPicker.module.css';
import { useLocale } from '@vinyla/i18n';
import { getVideoDuration, isVideoTrimSupported, trimVideo } from '../../utils/videoTrim';

// 미디어 첨부 + iOS 스타일 영상 트리밍 — DetailModal의 스피닝 다이어리 작성
// 시트와 /log 페이지의 인라인 수정 폼 양쪽에서 재사용된다(중복 구현 방지).
// 상태는 컨트롤드 컴포넌트로 부모가 들고 있어, 수정 화면에서 "기존 미디어를
// 유지" 상태를 표현할 수 있다(생성 화면은 항상 'none'에서 시작).
export type EditMediaState =
  | { kind: 'none' }
  | { kind: 'existing'; url: string; type: 'image' | 'video' }
  | { kind: 'new'; file: Blob; type: 'image' | 'video'; previewUrl: string };

export const SPIN_MEDIA_MAX_SECONDS = 15;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 25 * 1024 * 1024;

// 앱(iOS AVPlayer)에서 재생 가능한 형식만 허용 — webm은 웹에서만 재생돼
// 모바일 다이어리에서 깨지므로 업로드 자체를 막는다(서버 화이트리스트와 일치).
const APP_PLAYABLE_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const isAppPlayableVideo = (mimeType: string): boolean =>
  APP_PLAYABLE_VIDEO_TYPES.includes(mimeType.split(';')[0].trim().toLowerCase());

const formatClockTime = (seconds: number): string => {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

// iOS 사진 앱 스타일 영상 트리머: 가로 바 위 좌/우 핸들을 드래그해 최대
// SPIN_MEDIA_MAX_SECONDS초짜리 구간을 고른다. 실제 자르기는 captureStream+
// MediaRecorder 재생-재녹화 방식이라 (end-start)초만큼 실시간이 걸린다.
const VideoTrimStep: React.FC<{
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
  t: ReturnType<typeof useLocale>['t'];
}> = ({ file, onCancel, onDone, t }) => {
  const BAR_WIDTH = 320;
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<'start' | 'end' | null>(null);

  const [duration, setDuration] = React.useState(0);
  const [start, setStart] = React.useState(0);
  const [end, setEnd] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  // objectUrl은 이펙트 안에서 새로 만든다 — 개발 모드 Strict Mode의 마운트 시
  // 정리→재실행 double-invoke가 렌더 단계에서 만든 URL을 조기 폐기해 <video>가
  // "지원하지 않는 소스"로 실패하던 버그의 수정(CoverCropModal과 동일 이유).
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onLoadedMetadata = () => {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    setEnd(Math.min(d, SPIN_MEDIA_MAX_SECONDS));
    setCurrentTime(0);
  };

  // 미리듣기가 트림 구간 끝에 닿으면 시작점으로 되감아 구간만 반복 재생.
  // 재생 위치는 currentTime에 반영해 트림 바 위 재생 헤드로 보여준다.
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime >= end || v.currentTime < start) {
      v.currentTime = start;
      setCurrentTime(start);
      return;
    }
    setCurrentTime(v.currentTime);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      v.pause();
      setIsPlaying(false);
    } else {
      if (v.currentTime < start || v.currentTime >= end) {
        v.currentTime = start;
        setCurrentTime(start);
      }
      v.play();
      setIsPlaying(true);
    }
  };

  const timeToPx = (time: number) => (duration ? (time / duration) * BAR_WIDTH : 0);
  const pxToTime = (px: number) => (duration ? Math.min(duration, Math.max(0, (px / BAR_WIDTH) * duration)) : 0);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const raw = pxToTime(e.clientX - rect.left);
    if (dragRef.current === 'start') {
      const minStart = Math.max(0, end - SPIN_MEDIA_MAX_SECONDS);
      const next = Math.min(Math.max(raw, minStart), Math.max(0, end - 0.3));
      setStart(next);
      setCurrentTime(next);
      if (videoRef.current) videoRef.current.currentTime = next;
    } else {
      const maxEnd = Math.min(duration, start + SPIN_MEDIA_MAX_SECONDS);
      const next = Math.max(Math.min(raw, maxEnd), Math.min(duration, start + 0.3));
      setEnd(next);
      setCurrentTime(next);
      if (videoRef.current) videoRef.current.currentTime = next;
    }
  };

  const handlePointerDown = (handle: 'start' | 'end') => (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = handle;
    videoRef.current?.pause();
    setIsPlaying(false);
  };

  const handleConfirmTrim = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const blob = await trimVideo(file, start, end);
      onDone(blob);
    } catch {
      setError(t('detail.spinLogTrimFailed'));
      setIsProcessing(false);
    }
  };

  return (
    <>
      <h3 className={styles.stepTitle}>{t('detail.spinLogTrimTitle')}</h3>
      <p className={styles.stepHint}>{t('detail.spinLogTrimHint', { seconds: SPIN_MEDIA_MAX_SECONDS })}</p>
      <div className={styles.trimVideoWrap}>
        {objectUrl && (
          <video
            ref={videoRef}
            src={objectUrl}
            className={styles.trimPreviewVideo}
            onLoadedMetadata={onLoadedMetadata}
            onError={() => setError(t('detail.spinLogMediaInvalid'))}
            onTimeUpdate={onTimeUpdate}
            playsInline
          />
        )}
        <button type="button" className={styles.trimPlayBtn} onClick={togglePlay} disabled={isProcessing}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
        </button>
      </div>
      <div
        ref={barRef}
        className={styles.trimBar}
        style={{ width: BAR_WIDTH }}
        onPointerMove={handlePointerMove}
        onPointerUp={() => { dragRef.current = null; }}
      >
        <div className={styles.trimBarDim} style={{ left: 0, width: timeToPx(start) }} />
        <div className={styles.trimBarSelection} style={{ left: timeToPx(start), width: Math.max(0, timeToPx(end) - timeToPx(start)) }} />
        <div className={styles.trimBarDim} style={{ left: timeToPx(end), width: Math.max(0, BAR_WIDTH - timeToPx(end)) }} />
        <div className={styles.trimHandle} style={{ left: timeToPx(start) - 6 }} onPointerDown={handlePointerDown('start')} />
        <div className={styles.trimHandle} style={{ left: timeToPx(end) - 6 }} onPointerDown={handlePointerDown('end')} />
        <div className={styles.trimPlayhead} style={{ left: timeToPx(currentTime) }} />
      </div>
      <p className={styles.trimTimeLabel}>
        {formatClockTime(start)} – {formatClockTime(end)} · {(end - start).toFixed(1)}{t('detail.spinLogTrimSecondsUnit')}
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.stepActions}>
        <button type="button" className={styles.stepCancelBtn} onClick={onCancel} disabled={isProcessing}>
          {t('common.cancel')}
        </button>
        <button type="button" className={styles.stepConfirmBtn} onClick={handleConfirmTrim} disabled={isProcessing}>
          {isProcessing ? t('detail.spinLogTrimProcessing') : t('detail.spinLogTrimApply')}
        </button>
      </div>
    </>
  );
};

export const MediaAttachPicker: React.FC<{
  value: EditMediaState;
  onChange: (next: EditMediaState) => void;
  disabled?: boolean;
  t: ReturnType<typeof useLocale>['t'];
}> = ({ value, onChange, disabled, t }) => {
  const [error, setError] = React.useState<string | null>(null);
  const [trimmingFile, setTrimmingFile] = React.useState<File | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // 언마운트 시 'new' 상태의 blob URL을 정리한다. ref로 최신 value를 추적해야
  // 마운트 시 한 번만 등록되는 cleanup 클로저가 오래된 값이 아니라 실제 마지막
  // 값을 정리한다.
  const valueRef = React.useRef(value);
  valueRef.current = value;
  React.useEffect(() => {
    return () => {
      const v = valueRef.current;
      if (v.kind === 'new') URL.revokeObjectURL(v.previewUrl);
    };
  }, []);

  const handlePick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setError(t('detail.spinLogMediaInvalid'));
      return;
    }
    if (file.size > (isImage ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES)) {
      setError(t('detail.spinLogMediaTooLarge'));
      return;
    }
    if (isVideo) {
      if (isVideoTrimSupported()) {
        setTrimmingFile(file);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      // 트림 없이 원본이 그대로 올라가는 경로 — 앱 재생 가능 형식만 통과
      if (!isAppPlayableVideo(file.type)) {
        setError(t('detail.spinLogVideoFormatUnsupported'));
        return;
      }
      try {
        const duration = await getVideoDuration(file);
        if (duration > SPIN_MEDIA_MAX_SECONDS + 0.5) {
          setError(t('detail.spinLogMediaTooLong'));
          return;
        }
      } catch {
        setError(t('detail.spinLogMediaInvalid'));
        return;
      }
    }
    if (value.kind === 'new') URL.revokeObjectURL(value.previewUrl);
    onChange({ kind: 'new', file, type: isImage ? 'image' : 'video', previewUrl: URL.createObjectURL(file) });
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = () => {
    if (value.kind === 'new') URL.revokeObjectURL(value.previewUrl);
    onChange({ kind: 'none' });
    setError(null);
  };

  if (trimmingFile) {
    return (
      <VideoTrimStep
        file={trimmingFile}
        onCancel={() => setTrimmingFile(null)}
        onDone={(blob) => {
          setTrimmingFile(null);
          // 이 브라우저의 MediaRecorder가 webm만 지원하면 트림 결과물이 앱에서
          // 재생 불가 — 업로드 대신 안내하고 버린다.
          if (!isAppPlayableVideo(blob.type)) {
            setError(t('detail.spinLogVideoFormatUnsupported'));
            return;
          }
          if (value.kind === 'new') URL.revokeObjectURL(value.previewUrl);
          onChange({ kind: 'new', file: blob, type: 'video', previewUrl: URL.createObjectURL(blob) });
        }}
        t={t}
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        hidden
        onChange={(e) => handlePick(e.target.files?.[0] || null)}
      />
      {value.kind === 'none' ? (
        <>
          <button type="button" className={styles.addBtn} onClick={() => inputRef.current?.click()} disabled={disabled}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_a_photo</span>
            {t('detail.spinLogMediaAdd')}
          </button>
          <p className={styles.hint}>{t('detail.spinLogMediaLimits')}</p>
        </>
      ) : (
        <div className={styles.previewWrap}>
          {value.type === 'video' ? (
            <video className={styles.preview} src={value.kind === 'existing' ? value.url : value.previewUrl} muted loop autoPlay playsInline />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className={styles.preview} src={value.kind === 'existing' ? value.url : value.previewUrl} alt="" />
          )}
          <button type="button" className={styles.removeBtn} onClick={handleRemove} disabled={disabled} aria-label={t('detail.spinLogMediaRemove')}>
            ×
          </button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};
