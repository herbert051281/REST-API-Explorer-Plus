import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'node:https'
import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

function snowProxyMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (!req.url?.startsWith('/snow-proxy/')) return next()

  const instanceUrl = req.headers['x-snow-instance'] as string | undefined
  if (!instanceUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing X-Snow-Instance header' }))
    return
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(instanceUrl.replace(/\/$/, ''))
  } catch {
    res.writeHead(400)
    res.end('Invalid X-Snow-Instance header')
    return
  }

  const forwardPath = req.url.replace('/snow-proxy', '')

  const forwardHeaders: Record<string, string | string[]> = {}
  for (const [k, v] of Object.entries(req.headers)) {
    if (k === 'x-snow-instance' || k === 'host') continue
    if (v !== undefined) forwardHeaders[k] = v as string | string[]
  }
  forwardHeaders['host'] = targetUrl.hostname

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: forwardPath,
    method: req.method,
    headers: forwardHeaders,
    rejectUnauthorized: false,
  }

  const protocol = targetUrl.protocol === 'https:' ? https : http
  const proxyReq = protocol.request(options, (proxyRes) => {
    const headers: Record<string, string | string[]> = { 'access-control-allow-origin': '*' }
    for (const [k, v] of Object.entries(proxyRes.headers)) {
      // Strip WWW-Authenticate so the browser doesn't show its native login dialog.
      // The app handles auth errors itself via Axios interceptors.
      if (k.toLowerCase() === 'www-authenticate') continue
      if (v !== undefined) headers[k] = v as string | string[]
    }
    res.writeHead(proxyRes.statusCode ?? 200, headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  })

  req.pipe(proxyReq)
}

export default defineConfig({
  plugins: [
    react(),
    // Inline plugin — configureServer MUST be a plugin hook, not a server option
    {
      name: 'snow-proxy',
      configureServer(server) {
        server.middlewares.use(snowProxyMiddleware)
      },
    },
  ],
})
