import type { SysDictField } from '../types/servicenow';

export interface UrlOptions {
  sysparmLimit?: string;
  sysparmQuery?: string;
}

export function buildApiUrl(
  instanceUrl: string,
  tableName: string,
  fields: SysDictField[],
  options: UrlOptions = {}
): string {
  const base = `${instanceUrl}/api/now/table/${tableName}`;
  const params = new URLSearchParams({
    sysparm_display_value: 'all',
    sysparm_exclude_reference_link: 'true',
    sysparm_limit: options.sysparmLimit ?? '10000',
  });

  if (fields.length > 0) {
    params.set('sysparm_fields', fields.map((f) => f.element).join(','));
  }

  if (options.sysparmQuery) {
    params.set('sysparm_query', options.sysparmQuery);
  }

  return `${base}?${params.toString()}`;
}

export function buildMCode(
  instanceUrl: string,
  tableName: string,
  _tableLabel: string,
  fields: SysDictField[],
  options: UrlOptions = {}
): string {
  const fieldList = fields.map((f) => f.element).join(',');
  const limit = options.sysparmLimit ?? '10000';

  // sysparm_display_value=true returns flat strings — no nested {value,display_value} objects
  const params = new URLSearchParams({
    sysparm_display_value: 'true',
    sysparm_exclude_reference_link: 'true',
    sysparm_fields: fieldList,
    sysparm_limit: limit,
  });
  if (options.sysparmQuery) params.set('sysparm_query', options.sysparmQuery);

  const fullUrl = `${instanceUrl}/api/now/table/${tableName}?${params.toString()}`;
  const srcNames   = fields.map((f) => `"${f.element}"`).join(', ');
  const prefixed   = fields.map((f) => `"result.${f.element}"`).join(', ');
  const renamePairs = fields.map((f) => `{"result.${f.element}", "${f.column_label}"}`).join(', ');

  const lines = [
    'let',
    `    Source = Json.Document(Web.Contents("${fullUrl}")),`,
    `    #"Converted to Table" = Table.FromRecords({Source}),`,
    `    #"Expanded result" = Table.ExpandListColumn(#"Converted to Table", "result"),`,
    `    #"Expanded result1" = Table.ExpandRecordColumn(#"Expanded result", "result", {${srcNames}}, {${prefixed}}),`,
    `    #"Renamed Columns" = Table.RenameColumns(#"Expanded result1", {${renamePairs}})`,
    'in',
    '    #"Renamed Columns"',
  ];

  return lines.join('\r\n');
}
