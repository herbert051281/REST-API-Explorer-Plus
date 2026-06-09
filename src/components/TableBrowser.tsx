import { useState, useMemo } from 'react';
import type { SysDbObject } from '../types/servicenow';

interface Props {
  tables: SysDbObject[];
  selectedTable: SysDbObject | null;
  onSelect: (table: SysDbObject) => void;
}

export default function TableBrowser({ tables, selectedTable, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return tables;
    return tables.filter(
      (t) => t.label.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
    );
  }, [tables, search]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search */}
      <div className="p-3 border-b border-slate-200">
        <div className="relative">
          <svg className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search tables…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1d3c4b] focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          {filtered.length.toLocaleString()} of {tables.length.toLocaleString()} tables
        </p>
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-400">No tables match "{search}"</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((table) => {
              const isSelected = selectedTable?.name === table.name;
              return (
                <li key={table.name}>
                  <button
                    onClick={() => onSelect(table)}
                    className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-slate-50 ${
                      isSelected ? 'bg-[#1d3c4b]/5 border-l-2 border-[#1d3c4b]' : ''
                    }`}
                  >
                    <div className={`text-sm font-medium ${isSelected ? 'text-[#1d3c4b]' : 'text-slate-800'}`}>
                      {table.label}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{table.name}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
