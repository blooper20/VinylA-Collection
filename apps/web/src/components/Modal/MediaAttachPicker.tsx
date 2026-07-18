'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import styles from './MediaAttachPicker.module.css';
import { useLocale } from '@vinyla/i18n';
import { getVideoDuration, isVideoTrimSupported, preloadFFmpeg, trimVideo } from '../../utils/videoTrim';

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
const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 서버(/api/spin-log/upload)·버킷 한도와 일치

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
// SPIN_MEDIA_MAX_SECONDS초짜리 구간을 고른다. 실제 자르기는 ffmpeg.wasm으로
// 처리한다(videoTrim.ts) — 코덱이 맞으면 스트림 카피라 거의 즉시 끝난다.
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
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = React.useState<string | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  // objectUrl은 이펙트 안에서 새로 만든다 — 개발 모드 Strict Mode의 마운트 시
  // 정리→재실행 double-invoke가 렌더 단계에서 만든 URL을 조기 폐기해 <video>가
  // "지원하지 않는 소스"로 실패하던 버그의 수정(CoverCropModal과 동일 이유).
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  // 미리보기 <video>가 재생 중 디코딩 에러를 내는 경우가 있다 — macOS Chrome의
  // 하드웨어 디코더(VideoToolbox)가 특정 지점에서 오작동하는 문제로(콘솔에
  // "VTDecompressionOutputCallback ... -12909" 형태로 뜬다), 파일 자체가
  // 잘못된 게 아니다. 무한 재시도로 빠지지 않도록 자동 복구 횟수를 제한하되,
  // 문제 지점을 무사히 지나가면 예산을 되돌려준다(onTimeUpdate 참고).
  const MAX_PREVIEW_RECOVERIES = 4;
  const previewRetryRef = React.useRef(0);
  // 직전 디코드 에러가 난 재생 위치 — 같은 지점에서 연속으로 죽는지 판별용
  const lastErrorTimeRef = React.useRef<number | null>(null);
  // 손상된 디코드 세션은 같은 <video> 엘리먼트에 load()만 다시 불러서는
  // 잘 안 풀린다 — key를 바꿔 엘리먼트를 통째로 새로 마운트해야 브라우저가
  // 새 디코드 세션을 만든다. 복구 중엔 재생 위치/재생 여부를 여기 담아뒀다가
  // 새 엘리먼트가 준비되면 그대로 이어본다.
  const [videoKey, setVideoKey] = React.useState(0);
  const pendingResumeRef = React.useRef<{ time: number; play: boolean } | null>(null);
  // 최초 로드 때만 duration 기반 기본 트림 구간을 세팅한다 — 복구용 재마운트
  // 때도 onLoadedMetadata가 다시 불리는데, 그때 start/end를 리셋해버리면
  // 사용자가 이미 고른 트림 구간이 날아간다.
  const hasLoadedOnceRef = React.useRef(false);

  React.useEffect(() => {
    previewRetryRef.current = 0;
    lastErrorTimeRef.current = null;
    hasLoadedOnceRef.current = false;
    pendingResumeRef.current = null;
    setPreviewNotice(null);
    setVideoKey(0);
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 사용자가 트림 구간을 고르는 동안 ffmpeg.wasm 코어를 미리 받아둔다 —
  // "자르기" 클릭 후 대기 시간의 상당 부분이 이 최초 로딩이었다.
  React.useEffect(() => {
    preloadFFmpeg();
  }, []);

  const onLoadedMetadata = () => {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    if (!hasLoadedOnceRef.current) {
      hasLoadedOnceRef.current = true;
      setEnd(Math.min(d, SPIN_MEDIA_MAX_SECONDS));
      setCurrentTime(0);
    }
  };

  // 복구 재마운트로 새로 만들어진 <video>가 재생 준비되면, 에러 나기 전
  // 위치/재생 상태를 그대로 이어준다.
  const onVideoCanPlay = () => {
    const v = videoRef.current;
    const pending = pendingResumeRef.current;
    if (!v || !pending) return;
    pendingResumeRef.current = null;
    v.currentTime = pending.time;
    if (pending.play) {
      v.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  // 미리듣기가 트림 구간 끝에 닿으면 시작점으로 되감아 구간만 반복 재생.
  // 재생 위치는 currentTime에 반영해 트림 바 위 재생 헤드로 보여준다.
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    // 직전 에러 지점을 3초 이상 무사히 지나쳤으면 결함 구간을 벗어난 것 —
    // 복구 예산을 되돌려 이후 다른 지점의 결함도 다시 자동 복구되게 한다.
    if (lastErrorTimeRef.current !== null && v.currentTime > lastErrorTimeRef.current + 3) {
      previewRetryRef.current = 0;
      lastErrorTimeRef.current = null;
    }
    if (v.currentTime >= end || v.currentTime < start) {
      v.currentTime = start;
      setCurrentTime(start);
      return;
    }
    setCurrentTime(v.currentTime);
  };

  // 미리보기 재생이 특정 지점에서 디코딩 에러로 멈추면, 실제 파일 문제가
  // 아니라 브라우저 디코더 쪽 문제인 경우가 많아 바로 실패로 표시하지 않고
  // 같은 위치에서 이어보기를 몇 번 시도한다. 트리밍 결과(ffmpeg 처리)는 이
  // 미리보기 재생과 무관하게 별도로 동작하므로 여기서 실패해도 자르기는 된다.
  const onVideoError = () => {
    const v = videoRef.current;
    // warn으로 남긴다 — error로 남기면 Next.js 개발 오버레이가 이 진단
    // 로그를 앱 에러처럼 화면에 띄운다.
    console.warn('[SpinLogTrim] preview playback error', v?.error?.code, v?.error?.message);
    setIsPlaying(false);
    if (v && previewRetryRef.current < MAX_PREVIEW_RECOVERIES) {
      previewRetryRef.current += 1;
      // 죽은 지점 직전에서 이어 재생한다 — 시작점으로 되돌리면 사용자가
      // "그 지점에서 멈추고 처음부터 다시"를 반복해서 겪게 된다(실사용 보고).
      // 같은 지점(±0.75초)에서 연속으로 또 죽으면 이어보기로는 못 지나가는
      // 결함 구간으로 보고, 1초 건너뛰어 뒷부분이라도 이어서 보여준다.
      const errTime = Number.isFinite(v.currentTime) ? v.currentTime : start;
      const diedAtSameSpot =
        lastErrorTimeRef.current !== null && Math.abs(errTime - lastErrorTimeRef.current) < 0.75;
      lastErrorTimeRef.current = errTime;
      const resumeAt = diedAtSameSpot ? errTime + 1 : Math.max(start, errTime - 0.3);
      if (resumeAt < end - 0.2) {
        // 재생 진입 전 로드 실패(errTime≈start)면 자리만 복구하고 자동 재생은 않는다
        pendingResumeRef.current = { time: resumeAt, play: errTime > start + 0.05 };
      } else {
        // 구간 끝자락 결함 — 시작점으로 되감고 수동 재생에 맡긴다
        pendingResumeRef.current = { time: start, play: false };
      }
      // key를 바꿔 엘리먼트를 통째로 새로 마운트해 새 디코드 세션을 받는다.
      setVideoKey((k) => k + 1);
      return;
    }
    setPreviewNotice(t('detail.spinLogTrimPreviewGlitch'));
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
      // play()는 프라미스를 반환하는데, 핸들 드래그 등으로 곧바로 pause()가
      // 뒤따르면 "interrupted by a call to pause()" AbortError가 콘솔에
      // 뜬다 — 정상적인 경쟁 상태라 조용히 무시한다.
      v.play().catch(() => {});
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
    setProgress(0);
    setError(null);
    try {
      const blob = await trimVideo(file, start, end, VIDEO_MAX_BYTES, setProgress);
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
            key={videoKey}
            ref={videoRef}
            src={objectUrl}
            className={styles.trimPreviewVideo}
            onLoadedMetadata={onLoadedMetadata}
            onCanPlay={onVideoCanPlay}
            onError={onVideoError}
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
      {previewNotice && <p className={styles.stepHint}>{previewNotice}</p>}
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.stepActions}>
        <button type="button" className={styles.stepCancelBtn} onClick={onCancel} disabled={isProcessing}>
          {t('common.cancel')}
        </button>
        <button type="button" className={styles.stepConfirmBtn} onClick={handleConfirmTrim} disabled={isProcessing}>
          {t('detail.spinLogTrimApply')}
        </button>
      </div>
      {isProcessing && (
        <div className={styles.trimLoadingBackdrop}>
          <div className={styles.trimLoadingCard}>
            <span className={styles.trimSpinner} />
            <p className={styles.trimLoadingText}>
              {t('detail.spinLogTrimProcessing', { percent: Math.round(progress * 100) })}
            </p>
          </div>
        </div>
      )}
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
    if (isImage) {
      if (file.size > IMAGE_MAX_BYTES) {
        setError(t('detail.spinLogMediaTooLarge'));
        return;
      }
    }
    if (isVideo) {
      // 용량 검사는 트리밍 이후 실제 결과물 기준으로 한다 — 원본이 커도
      // 트림하면 줄어들기 때문에, 여기서 먼저 걸러내면 트리밍 단계 자체에
      // 진입하지 못하는 문제가 있었다.
      if (isVideoTrimSupported()) {
        setTrimmingFile(file);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      // 트림 없이 원본이 그대로 올라가는 경로 — 줄일 수 없으므로 원본 기준 검사
      if (!isAppPlayableVideo(file.type)) {
        setError(t('detail.spinLogVideoFormatUnsupported'));
        return;
      }
      if (file.size > VIDEO_MAX_BYTES) {
        setError(t('detail.spinLogMediaTooLarge'));
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

  // 트리밍 UI는 인라인이 아니라 화면 전체를 덮는 모달로 띄운다 — 좁은
  // 시트(DetailModal의 스피닝 다이어리 등) 안에서는 인라인 교체 방식이
  // 레이아웃에 눌려 안 보이거나 어색했다. 부모의 transform 애니메이션에
  // position:fixed가 깨지지 않도록 portal로 body에 붙인다.
  const trimModal = trimmingFile
    ? createPortal(
        <div className={styles.trimModalBackdrop}>
          <div className={styles.trimModalCard}>
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
                // 트림된 실제 결과물 기준으로 용량을 검사한다(원본이 아니라).
                if (blob.size > VIDEO_MAX_BYTES) {
                  setError(t('detail.spinLogMediaTooLarge'));
                  return;
                }
                if (value.kind === 'new') URL.revokeObjectURL(value.previewUrl);
                onChange({ kind: 'new', file: blob, type: 'video', previewUrl: URL.createObjectURL(blob) });
              }}
              t={t}
            />
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={styles.wrap}>
      {trimModal}
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
