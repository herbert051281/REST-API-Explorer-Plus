import { useState } from 'react';
import type { AuthMode, Connection, ConnectionStatus } from '../types/servicenow';
import { testConnection, fetchTables, getErrorMessage, cleanInstanceUrl } from '../hooks/useServiceNow';
import type { SysDbObject } from '../types/servicenow';

interface Props {
  onConnected: (conn: Connection, tables: SysDbObject[], manualMode: boolean) => void;
  status: ConnectionStatus;
  onConnecting: () => void;
}

export default function ConnectionPanel({ onConnected, status, onConnecting }: Props) {
  const [authMode, setAuthMode] = useState<AuthMode>('bearer');
  const [instanceUrl, setInstanceUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [localError, setLocalError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const connecting = status === 'connecting';

  function handleUrlChange(val: string) {
    const hasPath = val.includes('/nav_to') || val.includes('/sp') || val.includes('?');
    setInstanceUrl(hasPath ? cleanInstanceUrl(val) : val);
  }

  function handleUrlBlur() {
    if (instanceUrl) setInstanceUrl(cleanInstanceUrl(instanceUrl));
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setLocalError('');
    setStatusMsg('');
    onConnecting();

    const cleanedUrl = cleanInstanceUrl(instanceUrl);
    setInstanceUrl(cleanedUrl);

    const conn: Connection =
      authMode === 'bearer'
        ? { instanceUrl: cleanedUrl, authMode: 'bearer', token }
        : { instanceUrl: cleanedUrl, authMode: 'basic', username, password };

    try {
      setStatusMsg('Verifying credentials…');
      await testConnection(conn);
    } catch (err) {
      setLocalError(getErrorMessage(err));
      setStatusMsg('');
      return;
    }

    try {
      setStatusMsg('Loading table list…');
      const tables = await fetchTables(conn);
      setStatusMsg('');
      onConnected(conn, tables, false);
    } catch {
      setStatusMsg('');
      onConnected(conn, [], true);
    }
  }

  const statusBadge = {
    disconnected: { label: 'Not connected', cls: 'bg-slate-200 text-slate-600' },
    connecting: { label: 'Connecting…', cls: 'bg-yellow-100 text-yellow-700' },
    connected: { label: 'Connected', cls: 'bg-green-100 text-green-700' },
    error: { label: 'Error', cls: 'bg-red-100 text-red-700' },
  }[status];

  return (
    <div className="bg-white border-b border-slate-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#1d3c4b] rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1" />
            </svg>
          </div>
          <span className="font-semibold text-slate-800 text-sm">Connection</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      <form onSubmit={handleConnect} className="space-y-3">
        {/* Instance URL */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Instance URL</label>
          <input
            type="text"
            placeholder="https://yourinstance.service-now.com"
            value={instanceUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            onBlur={handleUrlBlur}
            required
            disabled={connecting}
            className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1d3c4b] disabled:opacity-50"
          />
        </div>

        {/* Auth mode tabs */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Auth method</label>
          <div className="flex rounded border border-slate-300 overflow-hidden text-xs font-medium">
            {(['bearer', 'basic'] as AuthMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setAuthMode(mode); setLocalError(''); }}
                disabled={connecting}
                className={`flex-1 py-1.5 transition-colors ${
                  authMode === mode
                    ? 'bg-[#1d3c4b] text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {mode === 'bearer' ? '🔑 Bearer Token (SSO)' : '🔒 Basic Auth'}
              </button>
            ))}
          </div>
        </div>

        {/* Bearer token fields */}
        {authMode === 'bearer' && (
          <div className="space-y-2">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 space-y-1">
              <p className="font-semibold">How to get your token:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                <li>Log into ServiceNow via SSO in your browser</li>
                <li>Click your avatar → <strong>Profile</strong></li>
                <li>Click <strong>Manage Tokens</strong> (or go to <code className="bg-blue-100 px-1 rounded">oauth_token.do</code>)</li>
                <li>Click <strong>Create Token</strong> and copy it</li>
              </ol>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Access Token</label>
              <textarea
                placeholder="Paste your Bearer token here…"
                value={token}
                onChange={(e) => setToken(e.target.value.trim())}
                required
                disabled={connecting}
                rows={3}
                className="w-full text-xs font-mono border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1d3c4b] resize-none disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {/* Basic auth fields */}
        {authMode === 'basic' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
              <input
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={connecting}
                className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1d3c4b] disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={connecting}
                className="w-full text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1d3c4b] disabled:opacity-50"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={connecting}
          className="w-full bg-[#1d3c4b] hover:bg-[#2a5568] text-white text-sm font-medium py-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {connecting && (
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {connecting ? (statusMsg || 'Connecting…') : 'Connect'}
        </button>
      </form>

      {localError && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {localError}
        </div>
      )}
    </div>
  );
}
