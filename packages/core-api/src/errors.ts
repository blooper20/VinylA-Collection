import { ko, type TranslationKey } from '@vinyla/i18n';
import { logEvent } from './events';

export type ErrorCode =
  | 'AUTH-001' | 'AUTH-002'
  | 'DB-001' | 'DB-002' | 'DB-003' | 'DB-004'
  | 'EXT-001' | 'EXT-002' | 'EXT-003' | 'EXT-004'
  | 'NET-001'
  | 'SYS-001';

export class AppError extends Error {
  code: ErrorCode;
  originalError?: any;

  constructor(code: ErrorCode, message: string, originalError?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.originalError = originalError;
  }
}

type Translate = (key: TranslationKey) => string;

// Fire-and-forget: every time a user is shown a coded error, record what
// actually broke behind it — a user quoting "(DB-001)" in a support inquiry
// is otherwise untraceable, since the code alone only says "something in
// the DB-001 family" and the specific message/cause never reached us.
// Same no-throw contract as logEvent itself; never blocks the UI.
const recordErrorOccurrence = (error: unknown, code: ErrorCode) => {
  const appError = error instanceof AppError ? error : undefined;
  const rawDetail = appError?.originalError;
  const detailMessage = typeof rawDetail?.message === 'string' ? rawDetail.message : undefined;
  const message = appError?.message || (error instanceof Error ? error.message : String(error));
  void logEvent('ERROR', {
    code,
    message: message?.slice(0, 300),
    detail: detailMessage?.slice(0, 300),
  });
};

// `t` is optional so existing (mobile) call sites that don't pass a
// translator keep compiling and behaving exactly as before — they get the
// Korean fallback baked into @vinyla/i18n's canonical dictionary. Callers
// that have a useLocale() in scope should pass its `t`.
export const getErrorMessage = (error: unknown, t?: Translate): string => {
  const code: ErrorCode = error instanceof AppError ? error.code : 'SYS-001';
  recordErrorOccurrence(error, code);
  const message = t ? t(`error.${code}`) : ko.error[code];
  return `${message} (${code})`;
};
