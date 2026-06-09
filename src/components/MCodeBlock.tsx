import { tokenize, colorForToken } from '../utils/mCodeTokenizer';
import CopyButton from './CopyButton';

export default function MCodeBlock({ code }: { code: string }) {
  const tokens = tokenize(code);

  return (
    <div className="h-full flex flex-col rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <span className="text-xs text-slate-400 font-mono">Power Query M</span>
        <CopyButton text={code} label="Copy M Code" />
      </div>
      <div className="flex-1 bg-slate-900 overflow-auto p-4">
        <pre className="text-xs leading-relaxed font-mono whitespace-pre">
          {tokens.map((token, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={i} style={{ color: colorForToken(token) }}>
              {token.text}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
