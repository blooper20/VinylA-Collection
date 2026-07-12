import { ko, type TranslationKey } from '@vinyla/i18n';

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

// `t` is optional so existing (mobile) call sites that don't pass a
// translator keep compiling and behaving exactly as before — they get the
// Korean fallback baked into @vinyla/i18n's canonical dictionary. Callers
// that have a useLocale() in scope should pass its `t`.
export const getErrorMessage = (error: unknown, t?: Translate): string => {
  const code: ErrorCode = error instanceof AppError ? error.code : 'SYS-001';
  const message = t ? t(`error.${code}`) : ko.error[code];
  return `${message} (${code})`;
};
