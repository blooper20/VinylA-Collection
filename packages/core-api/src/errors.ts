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

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  'AUTH-001': '로그인이 필요한 서비스입니다.',
  'AUTH-002': '사용자 정보를 불러올 수 없습니다.',
  'DB-001': '데이터 저장 중 오류가 발생했습니다.',
  'DB-002': '데이터를 불러오는 중 오류가 발생했습니다.',
  'DB-003': '데이터 삭제 중 오류가 발생했습니다.',
  'DB-004': '상세 정보 업데이트 중 오류가 발생했습니다.',
  'EXT-001': 'Discogs 서버 연결이 지연되고 있습니다.',
  'EXT-002': 'Apple Music 서버 연결이 지연되고 있습니다.',
  'EXT-003': 'YouTube 검색 한도를 초과했습니다.',
  'EXT-004': '외부 서버 요청 시간이 초과되었습니다.',
  'NET-001': '네트워크 연결 상태를 확인해주세요.',
  'SYS-001': '알 수 없는 시스템 오류가 발생했습니다.'
};

export const getErrorMessage = (error: any): string => {
  if (error instanceof AppError) {
    return `${ERROR_MESSAGES[error.code]} (${error.code})`;
  }
  return `${ERROR_MESSAGES['SYS-001']} (SYS-001)`;
};
