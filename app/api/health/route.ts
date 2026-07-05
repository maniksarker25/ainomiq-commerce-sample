import { initDb } from '@/lib/db'

export async function GET() {
  try {
    await initDb()
    return Response.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    return Response.json({ status: 'error', error: message, stack }, { status: 500 })
  }
}
