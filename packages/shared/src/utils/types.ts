export interface ATProtoSession {
  did: string;
  handle: string;
  pdsUrl: string;
  accessToken: string;
  tokenEndpoint: string;
  refreshToken?: string;
}
