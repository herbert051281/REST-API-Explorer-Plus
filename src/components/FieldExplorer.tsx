import { useEffect, useState } from 'react';
import type { Connection, SysDbObject, SysDictField } from '../types/servicenow';
import { fetchFields, getErrorMessage } from '../hooks/useServiceNow';

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-blue-50 text-blue-700',
  integer: 'bg-purple-50 text-purple-700',
  boolean: 'bg-orange-50 text-orange-700',
  reference: 'bg-green-50 text-green-700',
  glide_date_time: 'bg-pink-50 text-pink-700',
  glide_date: 'bg-pink-50 text-pink-700',
  choice: 'bg-yellow-50 text-yellow-700',
};

function typeColor(type: string) {
  return TYPE_COLORS[type] ?? 'bg-slate-100 text-slate-600';
}

interface Props {
  connection: Connection;
  table: SysDbObject;
  selectedFields: SysDictField[];
  onSelectionChange: (fields: SysDictField[]) => void;
  onBuildUrl: () => void;
}

interface FieldState {
  tableName: string;
  fields: SysDictField[];
  error: string;
}

export default function FieldExplorer({
  connection,
  table,
  selectedFields,
  onSelectionChange,
  onBuildUrl,
}: Props) {
  const [fieldState, setFieldState] = useState<FieldState>({
    tableName: '',
    fields: [],
    error: '',
  });
  const [searchState, setSearchState] = useState({ tableName: '', value: '' });

  useEffect(() => {
    let cancelled = false;

    fetchFields(connection, table.name)
      .then((fields) => {
        if (!cancelled) setFieldState({ tableName: table.name, fields, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setFieldState({ tableName: table.name, fields: [], error: getErrorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [connection, table.name]);

  const isCurrentTable = fieldState.tableName === table.name;
  const fields = isCurrentTable ? fieldState.fields : [];
  const error = isCurrentTable ? fieldState.error : '';
  const loading = !isCurrentTable;
  const search = searchState.tableName === table.name ? searchState.value : '';

  const filtered = search
    ? fields.filter(
        (f) =>
          f.column_label.toLowerCase().includes(search.toLowerCase()) ||
          f.element.toLowerCase().includes(search.toLowerCase())
      )
    : fields;

  const selectedSet = new Set(selectedFields.map((f) => f.element));

  function toggleField(field: SysDictField) {
    if (selectedSet.has(field.element)) {
      onSelectionChange(selectedFields.filter((f) => f.element !== field.element));
    } else {
      onSelectionChange([...selectedFields, field]);
    }
  }

  function selectAll() {
    onSelectionChange([...filtered]);
  }

  function clearAll() {
    onSelectionChange([]);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{table.label}</h2>
            <span className="text-xs font-mono text-slate-400">{table.name}</span>
          </div>
          <button
            onClick={onBuildUrl}
            disabled={selectedFields.length === 0}
            className="flex items-center gap-1.5 bg-[#1d3c4b] hover:bg-[#2a5568] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-3 py-1.5 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Build Power BI URL
            {selectedFields.length > 0 && (
              <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                {selectedFields.length}
              </span>
            )}
          </button>
        </div>

        {/* Search + select controls */}
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Filter fields…"
              value={search}
              onChange={(e) => setSearchState({ tableName: table.name, value: e.target.value })}
              className="w-full text-sm border border-slate-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1d3c4b]"
            />
          </div>
          <button onClick={selectAll} className="text-xs font-medium text-[#1d3c4b] hover:bg-[#1d3c4b]/5 px-2 py-1.5 rounded transition-colors whitespace-nowrap">
            Select all
          </button>
          <span className="text-slate-200 select-none">|</span>
          <button onClick={clearAll} className="text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 px-2 py-1.5 rounded transition-colors whitespace-nowrap">
            Clear
          </button>
        </div>

        {!loading && fields.length > 0 && (
          <p className="text-xs text-slate-400 mt-1.5">
            {filtered.length} field{filtered.length !== 1 ? 's' : ''}
            {selectedFields.length > 0 && ` · ${selectedFields.length} selected`}
          </p>
        )}
      </div>

      {/* Field table */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading fields…
          </div>
        )}

        {error && (
          <div className="m-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr>
                <th className="w-10 px-4 py-2.5 text-left"></th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                  Column Label
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                  Technical Name
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                  Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((field) => {
                const checked = selectedSet.has(field.element);
                return (
                  <tr
                    key={field.element}
                    onClick={() => toggleField(field)}
                    className={`cursor-pointer transition-colors hover:bg-slate-50 ${checked ? 'bg-[#1d3c4b]/5' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleField(field)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-slate-300 text-[#1d3c4b] focus:ring-[#1d3c4b]"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{field.column_label}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500 text-xs">{field.element}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor(field.internal_type)}`}>
                        {field.internal_type}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
