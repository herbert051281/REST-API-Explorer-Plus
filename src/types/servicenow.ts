export type AuthMode = 'basic' | 'bearer'

export interface Connection {
  instanceUrl: string;
  authMode: AuthMode;
  // Basic auth
  username?: string;
  password?: string;
  // Bearer token
  token?: string;
}

export interface SysDbObject {
  name: string;
  label: string;
}

export interface SysDictField {
  element: string;
  column_label: string;
  internal_type: string;
}

export interface ApiResponse<T> {
  result: T[];
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
