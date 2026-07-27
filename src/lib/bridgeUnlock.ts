export const MY_APP_ID = 'negotiate' as const

// Prod + temporary branch-deploy. Remove the branch entry at Phase-2 close (spec §9/L).
export const TRUSTED_PARENTS: readonly string[] = [
  'https://bridge-mph.netlify.app',
  'https://cockpit-shell--bridge-mph.netlify.app',
]

export function resolveTrustedParent(embedderOrigin: string | null): string | null {
  return embedderOrigin && TRUSTED_PARENTS.includes(embedderOrigin) ? embedderOrigin : null
}

export function currentEmbedderOrigin(): string | null {
  try {
    const ao = (window.location as unknown as { ancestorOrigins?: DOMStringList }).ancestorOrigins
    if (ao && ao.length) return ao[0]
    return document.referrer ? new URL(document.referrer).origin : null
  } catch {
    return null
  }
}

export function pickTrustedParent(): string | null {
  return resolveTrustedParent(currentEmbedderOrigin())
}

export interface UnlockVerdict {
  ok: boolean
  credential?: string
  reqId?: string
}

export function validateUnlock(
  ev: { origin: string; source: unknown; data: unknown },
  cfg: { parentOrigin: string; parentWindow: unknown },
): UnlockVerdict {
  if (ev.origin !== cfg.parentOrigin) return { ok: false }
  if (ev.source !== cfg.parentWindow) return { ok: false }
  const d = ev.data as Record<string, unknown> | null
  if (!d || typeof d !== 'object') return { ok: false }
  if (d.type !== 'bridge.unlock' || d.v !== 1 || d.app !== MY_APP_ID) return { ok: false }
  if (typeof d.reqId !== 'string' || d.reqId.length === 0) return { ok: false }
  const cred = d.credential
  if (typeof cred !== 'string' || cred.length === 0 || cred.length > 256) return { ok: false }
  return { ok: true, credential: cred, reqId: d.reqId }
}

// Shell recording badge (spec §6.10 / App. B). Only meaningful when framed.
export function emitRecording(active: boolean): void {
  if (window.parent === window) return
  const parentOrigin = pickTrustedParent()
  if (!parentOrigin) return
  window.parent.postMessage({ type: 'bridge.recording', v: 1, app: MY_APP_ID, active }, parentOrigin)
}
