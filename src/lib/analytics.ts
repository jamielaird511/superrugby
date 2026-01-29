/**
 * Client-side analytics tracking helper.
 * Fire-and-forget: errors are silently ignored to avoid blocking UX.
 */

export async function track(
  eventName: string,
  options?: { participantId?: string; metadata?: unknown }
): Promise<void> {
  try {
    // Fire-and-forget: don't await, just start the request
    fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventName,
        participantId: options?.participantId || null,
        metadata: options?.metadata || null,
      }),
    }).catch(() => {
      // Silently ignore errors
    });
  } catch {
    // Silently ignore errors
  }
}
