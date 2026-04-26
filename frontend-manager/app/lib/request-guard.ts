const requestTimestamps = new Map<string, number>()

export function assertRequestCooldown(key: string, cooldownMs: number): void {
    const now = Date.now()
    const last = requestTimestamps.get(key) ?? 0
    const elapsed = now - last

    if (elapsed < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - elapsed) / 1000)
        throw new Error(`Слишком много запросов. Повторите через ${waitSeconds} сек.`)
    }

    requestTimestamps.set(key, now)
}
