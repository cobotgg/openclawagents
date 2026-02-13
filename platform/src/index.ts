/**
 * Cobot AI - Platform Worker
 *
 * Serves the landing page, provisioning API, and admin endpoints.
 * All tenant management happens here. Per-tenant Workers are deployed
 * via the Cloudflare Workers API.
 */

import type { PlatformEnv, TenantInfo } from './types'
import { provisionTenant, getTenantById, deleteTenant } from './provision'
import { LANDING_PAGE } from './landing'

// Simple in-memory rate limiter (resets on Worker restart, which is fine)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string, maxRequests = 5, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }

  entry.count++
  return entry.count > maxRequests
}

function requireAdmin(request: Request, env: PlatformEnv): Response | null {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token || token !== env.ADMIN_TOKEN) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export default {
  async fetch(
    request: Request,
    env: PlatformEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() })
    }

    // Landing page
    if (path === '/' && request.method === 'GET') {
      return new Response(LANDING_PAGE, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Health check
    if (path === '/health') {
      return Response.json({ status: 'ok', service: 'cobot-platform' })
    }

    // Provisioning API
    if (path === '/api/provision' && request.method === 'POST') {
      // Rate limit by IP
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
      if (isRateLimited(ip, 3, 300_000)) {
        return Response.json(
          { success: false, message: 'Too many requests. Try again in 5 minutes.' },
          { status: 429, headers: corsHeaders() }
        )
      }

      try {
        const body = (await request.json()) as Record<string, unknown>
        const telegramUserId = typeof body.telegramUserId === 'string' ? body.telegramUserId : ''
        const telegramBotToken = typeof body.telegramBotToken === 'string' ? body.telegramBotToken : ''

        if (!telegramUserId || !telegramBotToken) {
          return Response.json(
            { success: false, message: 'telegramUserId and telegramBotToken are required.' },
            { status: 400, headers: corsHeaders() }
          )
        }

        const result = await provisionTenant({ telegramUserId, telegramBotToken }, env)
        return Response.json(result, {
          status: result.success ? 200 : 400,
          headers: corsHeaders(),
        })
      } catch (error) {
        console.error('[PROVISION] Error:', error)
        return Response.json(
          { success: false, message: 'Server error. Please try again.' },
          { status: 500, headers: corsHeaders() }
        )
      }
    }

    // --- Admin Endpoints (require ADMIN_TOKEN) ---

    // Get tenant by ID
    if (path.match(/^\/api\/tenant\/[\w-]+$/) && request.method === 'GET') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      const tenantId = path.split('/').pop()!
      const tenant = await getTenantById(tenantId, env)
      if (!tenant) {
        return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders() })
      }

      // Sanitize - never expose secrets
      return Response.json(
        {
          id: tenant.id,
          status: tenant.status,
          createdAt: tenant.createdAt,
          botUsername: tenant.telegramBotUsername,
          workerUrl: tenant.workerUrl,
          workerName: tenant.workerName,
        },
        { headers: corsHeaders() }
      )
    }

    // Delete tenant
    if (path.match(/^\/api\/tenant\/[\w-]+$/) && request.method === 'DELETE') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      const tenantId = path.split('/').pop()!
      const result = await deleteTenant(tenantId, env)
      return Response.json(result, {
        status: result.success ? 200 : 400,
        headers: corsHeaders(),
      })
    }

    // List all tenants
    if (path === '/api/tenants' && request.method === 'GET') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      const tenants: Array<Partial<TenantInfo>> = []
      const list = await env.TENANT_REGISTRY.list()

      for (const key of list.keys) {
        const tenant = await env.TENANT_REGISTRY.get<TenantInfo>(key.name, { type: 'json' })
        if (tenant) {
          tenants.push({
            id: tenant.id,
            telegramUserId: tenant.telegramUserId,
            telegramBotUsername: tenant.telegramBotUsername,
            status: tenant.status,
            createdAt: tenant.createdAt,
            workerName: tenant.workerName,
          })
        }
      }

      return Response.json(
        { tenants, count: tenants.length },
        { headers: corsHeaders() }
      )
    }

    // Usage stats
    if (path === '/api/stats' && request.method === 'GET') {
      const authError = requireAdmin(request, env)
      if (authError) return authError

      try {
        const tenantCount = await env.TENANT_REGISTRY.list()
        const recentEvents = await env.USAGE_DB.prepare(
          'SELECT event_type, COUNT(*) as count FROM events GROUP BY event_type'
        ).all()

        return Response.json(
          {
            totalTenants: tenantCount.keys.length,
            events: recentEvents.results,
          },
          { headers: corsHeaders() }
        )
      } catch {
        return Response.json(
          { totalTenants: 0, events: [] },
          { headers: corsHeaders() }
        )
      }
    }

    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<PlatformEnv>
