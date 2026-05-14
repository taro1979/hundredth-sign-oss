export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
/** Session duration: 24 hours. Used for JWT expiration and cookie maxAge. */
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
/** 1ユーザーが owner ロールで持てる FREE 組織の上限（スパム防止ソフトリミット） */
export const MAX_FREE_ORGS_PER_USER = 2;
