import { useState } from 'react';
import type { Connection, ConnectionStatus, SysDbObject, SysDictField } from './types/servicenow';
import ConnectionPanel from './components/ConnectionPanel';
import TableBrowser from './components/TableBrowser';
import FieldExplorer from './components/FieldExplorer';
import PowerBIUrlBuilder from './components/PowerBIUrlBuilder';
import BookmarkletPage from './components/BookmarkletPage';

export default function App() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('disconnected');
  const [tables, setTables] = useState<SysDbObject[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualTableName, setManualTableName] = useState('');
  const [selectedTable, setSelectedTable] = useState<SysDbObject | null>(null);
  const [selectedFields, setSelectedFields] = useState<SysDictField[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBookmarklet, setShowBookmarklet] = useState(false);

  function handleConnecting() {
    setConnStatus('connecting');
  }

  function handleConnected(conn: Connection, loadedTables: SysDbObject[], isManual: boolean) {
    setConnection(conn);
    setTables(loadedTables);
    setManualMode(isManual);
    setConnStatus('connected');
    setSelectedTable(null);
    setSelectedFields([]);
    setShowBuilder(false);
    setManualTableName('');
  }

  function handleSelectTable(table: SysDbObject) {
    setSelectedTable(table);
    setSelectedFields([]);
    setShowBuilder(false);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = manualTableName.trim();
    if (!name) return;
    handleSelectTable({ name, label: name });
  }

  function handleBuildUrl() {
    setShowBuilder(true);
  }

  const isConnected = connStatus === 'connected';

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      {/* Top nav */}
      <header className="bg-[#1d3c4b] text-white px-5 py-3 flex items-center justify-between shadow-md z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-[#81b5a1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-bold text-base tracking-tight">REST API Explorer</span>
            <span className="text-[#81b5a1] font-semibold text-base">Plus</span>
          </div>
          <span className="hidden sm:inline text-slate-400 text-xs border-l border-slate-600 pl-3">
            Power BI-ready URLs with display names
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isConnected && (
            <div className="flex items-center gap-1.5 text-xs text-green-300">
              <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
              {connection?.instanceUrl.replace('https://', '')}
              {manualMode && <span className="ml-1 text-yellow-300">(manual mode)</span>}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowBookmarklet(true)}
            className="text-xs text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 px-2.5 py-1 rounded transition-colors"
          >
            🔖 Bookmarklet
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
          <ConnectionPanel
            onConnected={handleConnected}
            onConnecting={handleConnecting}
            status={connStatus}
          />

          {/* Table browser — full list when sys_db_object is accessible */}
          {isConnected && !manualMode && tables.length > 0 && (
            <TableBrowser
              tables={tables}
              selectedTable={selectedTable}
              onSelect={handleSelectTable}
            />
          )}

          {/* Manual mode — type the table name directly */}
          {isConnected && manualMode && (
            <div className="p-4 flex flex-col gap-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                <strong>Limited access:</strong> Your account cannot browse the full table list
                (<code>sys_db_object</code> returned 404). You can still enter a table name manually below.
              </div>
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
                <label className="text-xs font-medium text-slate-600">Table technical name</label>
                <input
                  type="text"
                  placeholder="e.g. incident, cmn_department"
                  value={manualTableName}
                  onChange={(e) => setManualTableName(e.target.value)}
                  className="text-sm border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1d3c4b]"
                />
                <button
                  type="submit"
                  disabled={!manualTableName.trim()}
                  className="bg-[#1d3c4b] hover:bg-[#2a5568] disabled:opacity-40 text-white text-sm font-medium py-1.5 rounded transition-colors"
                >
                  Explore fields
                </button>
              </form>
              <div className="text-xs text-slate-400 space-y-0.5">
                <p className="font-medium text-slate-500">Common tables:</p>
                {['incident', 'change_request', 'sc_request', 'cmn_department', 'sys_user', 'problem'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSelectTable({ name: t, label: t })}
                    className="block w-full text-left font-mono hover:text-[#1d3c4b] hover:underline"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isConnected && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <svg className="w-12 h-12 text-slate-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm4 0h8M8 12h8M8 17h5" />
              </svg>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect to your ServiceNow instance to browse tables and build Power BI URLs.
              </p>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {showBookmarklet && (
            <BookmarkletPage onBack={() => setShowBookmarklet(false)} />
          )}
          {!showBookmarklet && !selectedTable && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
              <div className="max-w-md">
                <div className="w-16 h-16 bg-[#1d3c4b]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[#1d3c4b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h1 className="text-xl font-semibold text-slate-700 mb-2">
                  {isConnected ? 'Select a table' : 'Welcome to REST API Explorer Plus'}
                </h1>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {isConnected
                    ? manualMode
                      ? 'Type a table name in the sidebar to explore its fields and build a Power BI URL.'
                      : 'Choose a table from the sidebar to explore its fields and generate a Power BI-ready URL.'
                    : 'Connect to your ServiceNow instance, select a table, choose the fields you need, and generate a REST API URL or Power Query M code ready to paste into Power BI Desktop.'}
                </p>
                {!isConnected && (
                  <div className="mt-6 grid grid-cols-3 gap-3 text-left">
                    {[
                      { icon: '🔌', title: 'Connect', desc: 'Enter your instance URL and credentials' },
                      { icon: '🔍', title: 'Browse', desc: 'Find tables by display name (e.g. "Department")' },
                      { icon: '📊', title: 'Export', desc: 'Get Power BI-ready URL with sysparm_display_value=all' },
                    ].map((step) => (
                      <div key={step.title} className="bg-white rounded-lg p-3 border border-slate-200">
                        <div className="text-2xl mb-1">{step.icon}</div>
                        <div className="text-sm font-medium text-slate-700">{step.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{step.desc}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!showBookmarklet && selectedTable && !showBuilder && connection && (
            <div className="flex-1 bg-white min-h-0 overflow-hidden flex flex-col">
              <FieldExplorer
                connection={connection}
                table={selectedTable}
                selectedFields={selectedFields}
                onSelectionChange={setSelectedFields}
                onBuildUrl={handleBuildUrl}
              />
            </div>
          )}

          {!showBookmarklet && selectedTable && showBuilder && connection && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <PowerBIUrlBuilder
                connection={connection}
                table={selectedTable}
                selectedFields={selectedFields}
                onClose={() => setShowBuilder(false)}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
