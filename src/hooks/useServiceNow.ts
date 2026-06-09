import axios, { AxiosError } from 'axios';
import type { Connection, SysDbObject, SysDictField, ApiResponse } from '../types/servicenow';

function apiUrl(conn: Connection, path: string): string {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `/snow-proxy${path}`
  }
  return `${conn.instanceUrl}${path}`
}

function authHeader(conn: Connection): Record<string, string> {
  if (conn.authMode === 'bearer') {
    return { Authorization: `Bearer ${conn.token}` }
  }
  const encoded = btoa(`${conn.username}:${conn.password}`)
  return { Authorization: `Basic ${encoded}` }
}

function proxyHeaders(conn: Connection): Record<string, string> {
  return {
    ...authHeader(conn),
    Accept: 'application/json',
    'X-Snow-Instance': conn.instanceUrl,
  }
}

export async function testConnection(conn: Connection): Promise<void> {
  const url = apiUrl(conn, '/api/now/table/sys_user')
  await axios.get(url, {
    headers: proxyHeaders(conn),
    params: { sysparm_limit: '1', sysparm_fields: 'sys_id' },
  })
}

export async function fetchTables(conn: Connection): Promise<SysDbObject[]> {
  const url = apiUrl(conn, '/api/now/table/sys_db_object')
  const response = await axios.get<ApiResponse<SysDbObject>>(url, {
    headers: proxyHeaders(conn),
    params: {
      sysparm_fields: 'name,label',
      sysparm_limit: '5000',
      sysparm_display_value: 'true',
    },
  })
  return response.data.result
    .filter((t) => t.name)
    .map((t) => ({ name: t.name, label: t.label || t.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export async function fetchFields(conn: Connection, tableName: string): Promise<SysDictField[]> {
  const url = apiUrl(conn, '/api/now/table/sys_dictionary')
  const response = await axios.get<ApiResponse<SysDictField>>(url, {
    headers: proxyHeaders(conn),
    params: {
      sysparm_query: `name=${tableName}^active=true^elementISNOTEMPTY`,
      sysparm_fields: 'element,column_label,internal_type',
      sysparm_display_value: 'true',
      sysparm_limit: '500',
    },
  })
  return response.data.result
    .filter((f) => f.element && f.column_label)
    .sort((a, b) => a.column_label.localeCompare(b.column_label))
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status
    if (status === 401) return 'Invalid credentials. For Bearer token: make sure the token hasn\'t expired.'
    if (status === 403) return 'Access denied. Your account may lack REST API permissions.'
    if (status === 404) return '404 — REST API not accessible. Ask your admin to grant you the "rest_service" role in ServiceNow.'
    if (err.code === 'ERR_NETWORK') return 'Network error — could not reach the ServiceNow instance.'
    return err.response?.data?.error?.message ?? err.message
  }
  return String(err)
}

export function cleanInstanceUrl(raw: string): string {
  const trimmed = raw.trim()
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return trimmed
  }
}
