import { useState } from 'react';
import type { Connection, SysDbObject, SysDictField } from '../types/servicenow';
import { buildApiUrl, buildMCode } from '../utils/urlBuilder';

interface Props {
  connection: Connection;
  table: SysDbObject;
  selectedFields: SysDictField[];
  onClose: () => void;
}

type Tab = 'url' | 'mcode';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border transition-colors ${
        copied
          ? 'bg-green-50 border-green-300 text-green-700'
          : 'bg-white border-slate-300 text-slate-600 hover:border-[#1d3c4b] hover:text-[#1d3c4b]'
      }`}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

export default function PowerBIUrlBuilder({ connection, table, selectedFields, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('url');
  const [limitValue, setLimitValue] = useState('10000');
  const [sysparmQuery, setSysparmQuery] = useState('');

  const options = { sysparmLimit: limitValue, sysparmQuery: sysparmQuery || undefined };
  const apiUrl = buildApiUrl(connection.instanceUrl, table.name, selectedFields, options);
  const mCode = buildMCode(connection.instanceUrl, table.name, table.label, selectedFields, options);

  const referenceFields = selectedFields.filter((f) => f.internal_type === 'reference');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#f2c811] rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-[#3d3d3d]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Power BI URL Builder</h2>
            <p className="text-xs text-slate-500">
              {table.label} · {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Close">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Options row */}
      <div className="flex items-center gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Row limit</label>
          <select
            value={limitValue}
            onChange={(e) => setLimitValue(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1d3c4b]"
          >
            <option value="100">100</option>
            <option value="1000">1,000</option>
            <option value="10000">10,000</option>
            <option value="100000">100,000</option>
            <option value="1000000">1,000,000</option>
          </select>
        </div>
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Filter (sysparm_query)</label>
          <input
            type="text"
            placeholder="e.g. active=true^category=software"
            value={sysparmQuery}
            onChange={(e) => setSysparmQuery(e.target.value)}
            className="flex-1 text-xs border border-slate-300 rounded px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-[#1d3c4b] font-mono"
          />
        </div>
      </div>

      {/* Reference field info */}
      {referenceFields.length > 0 && (
        <div className="mx-5 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
          <strong>Reference fields detected:</strong>{' '}
          {referenceFields.map((f) => f.column_label).join(', ')}.{' '}
          The M code uses <code className="bg-blue-100 px-1 rounded">sysparm_display_value=true</code> so
          these columns return flat display names (e.g. "Help Desk") — no extra expansion needed in Power BI.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-5 mt-3">
        {(['url', 'mcode'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-[#1d3c4b] text-[#1d3c4b]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'url' ? 'REST API URL' : 'Power Query M Code'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0 p-5">
        {activeTab === 'url' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">
                Paste this URL into Power BI Desktop:{' '}
                <strong>Get Data → Web → Advanced</strong>
              </p>
              <CopyButton text={apiUrl} label="Copy URL" />
            </div>
            <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-auto scrollbar-thin">
              <pre className="code-block text-green-400 whitespace-pre-wrap break-all text-xs leading-relaxed">
                {apiUrl}
              </pre>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { label: 'sysparm_display_value=all', desc: 'Returns both raw value and display name for every field' },
                { label: 'sysparm_exclude_reference_link=true', desc: 'Removes noisy link objects from the response' },
                { label: `sysparm_limit=${Number(limitValue).toLocaleString()}`, desc: 'Maximum rows returned per request' },
              ].map((p) => (
                <div key={p.label} className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                  <code className="text-xs text-[#1d3c4b] font-mono font-medium break-all">{p.label}</code>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'mcode' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">
                In Power BI Desktop: <strong>Home → Transform Data → New Source → Blank Query → Advanced Editor</strong>
              </p>
              <CopyButton text={mCode} label="Copy M Code" />
            </div>
            <div className="flex-1 bg-slate-900 rounded-lg p-4 overflow-auto scrollbar-thin">
              <pre className="code-block text-slate-200 text-xs leading-relaxed">{mCode}</pre>
            </div>
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              <strong>Authentication note:</strong> Power BI will prompt for credentials when you first run this query.
              Choose <strong>Basic</strong> and enter your ServiceNow username and password.
              The M code does not hard-code credentials.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
