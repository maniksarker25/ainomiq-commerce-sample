import { ContentPublishError } from '@/lib/content-publish';
import { ErrorCode, type ErrorCodeValue } from '@/lib/api-response';

export function mapContentPublishErrorCode(code: string): ErrorCodeValue {
  switch (code) {
    case 'INSTAGRAM_NOT_CONNECTED':
      return ErrorCode.INSTAGRAM_NOT_CONNECTED;
    case 'INSTAGRAM_PUBLISH_DENIED':
      return ErrorCode.INSTAGRAM_PUBLISH_DENIED;
    case 'PUBLISH_FAILED':
      return ErrorCode.PUBLISH_FAILED;
    case 'MISSING_FIELD':
      return ErrorCode.MISSING_FIELD;
    case 'VALIDATION_ERROR':
      return ErrorCode.VALIDATION_ERROR;
    default:
      return ErrorCode.PUBLISH_FAILED;
  }
}

export function isContentPublishError(err: unknown): err is ContentPublishError {
  return err instanceof ContentPublishError;
}
