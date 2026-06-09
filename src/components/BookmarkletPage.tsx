import { useState, useEffect } from 'react';

interface Props {
  onBack: () => void;
}

export default function BookmarkletPage({ onBack }: Props) {
  const [bookmarkletUrl, setBookmarkletUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/bookmarklet.min.js')
      .then((r) => r.text())
      .then((code) => {
        const start = code.indexOf('(()=>{');
        const clean = start >= 0 ? code.slice(start).trim() : code.trim();
        setBookmarkletUrl('javascript:void ' + clean);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function copyUrl() {
    if (!bookmarkletUrl) return;
    await navigator.clipboard.writeText(bookmarkletUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-xl font-semibold text-slate-800 mb-1">ServiceNow Bookmarklet</h1>
      <p className="text-sm text-slate-500 mb-6">
        Injects the REST API Explorer directly into ServiceNow using your existing SSO session.
        All code is self-contained — no external server needed once installed.
      </p>

      <div className="space-y-4">

        {/* Step 1 — Copy the URL */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-[#1d3c4b] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <span className="font-medium text-slate-700">Copy the bookmarklet code</span>
          </div>
          <div className="ml-8 space-y-2">
            {loading ? (
              <div className="text-sm text-slate-400 animate-pulse">Loading…</div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-900 text-slate-300 text-xs px-3 py-2 rounded font-mono overflow-hidden text-ellipsis whitespace-nowrap block">
                    {bookmarkletUrl.slice(0, 80)}…
                  </code>
                  <button
                    type="button"
                    onClick={copyUrl}
                    className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded border transition-colors ${
                      copied
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-[#1d3c4b] hover:text-[#1d3c4b]'
                    }`}
                  >
                    {copied ? '✓ Copied!' : '⎘ Copy'}
                  </button>
                </div>
                <p className="text-xs text-slate-400">This is the full self-contained app — no localhost required when clicking the bookmark.</p>
              </>
            )}
          </div>
        </div>

        {/* Step 2 — Create bookmark manually */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-[#1d3c4b] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <span className="font-medium text-slate-700">Create a new bookmark manually</span>
          </div>
          <ol className="ml-8 space-y-1.5 text-sm text-slate-600 list-decimal list-inside">
            <li>Press <kbd className="bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono">Ctrl+Shift+B</kbd> to show your bookmarks bar</li>
            <li>Right-click the bookmarks bar → <strong>Add page…</strong> (or <strong>Add bookmark</strong>)</li>
            <li>Set <strong>Name</strong> to <code className="bg-slate-100 px-1 rounded text-xs">API Explorer Plus</code></li>
            <li>Paste the copied code into the <strong>URL</strong> field</li>
            <li>Click <strong>Save</strong></li>
          </ol>
        </div>

        {/* Step 3 — Use it */}
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-[#1d3c4b] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <span className="font-medium text-slate-700">Click it while on ServiceNow</span>
          </div>
          <p className="text-sm text-slate-500 ml-8">
            Go to <strong>rsmnet.service-now.com</strong> (already logged in) and click
            <strong> API Explorer Plus</strong> in your bookmarks bar. A panel slides in on the
            right. Click it again to toggle. Your SSO session is used automatically.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <strong>Why self-contained?</strong> ServiceNow's security policy blocks loading scripts
          from external servers (like localhost). This version embeds all the code directly in the
          bookmark so nothing external is loaded — it runs entirely within ServiceNow's own page.
        </div>
      </div>
    </div>
  );
}
