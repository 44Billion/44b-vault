import idb from 'idb'
import nostrRelays from 'nostr-relays'
import { isOnline } from 'helpers/network.js'

const jobs = new Map()
let serviceStarted = false

function scheduleJob (job, delay = job.intervalMs) {
  const nextDelay = Math.max(delay ?? job.intervalMs, 0)
  if (job.timerId != null) return

  job.timerId = setTimeout(async () => {
    job.timerId = null

    if (job.isRunning) {
      scheduleJob(job)
      return
    }

    job.isRunning = true
    try {
      if (job.requiresOnline) {
        const online = await isOnline()
        if (!online) {
          scheduleJob(job)
          return
        }
      }
      await job.handler(job)
    } catch (err) {
      console.error(`[worker-service] job "${job.name}" failed`, err)
    } finally {
      job.isRunning = false
      job.lastRunAt = Date.now()
    }

    scheduleJob(job)
  }, nextDelay)
}

function registerJob ({ name, handler, intervalMs, requiresOnline = false, maxRetries = 5 }) {
  if (!name || typeof handler !== 'function' || !Number.isFinite(intervalMs)) {
    throw new Error('name, handler and intervalMs are required')
  }
  if (!Number.isFinite(maxRetries) || maxRetries < 0) throw new Error('maxRetries must be a non-negative number')

  const job = {
    name,
    handler,
    intervalMs,
    requiresOnline,
    maxRetries,
    timerId: null,
    isRunning: false,
    lastRunAt: 0
  }

  jobs.set(name, job)

  if (serviceStarted) scheduleJob(job)

  return {
    trigger: (delay = 0) => triggerJob(name, { delay })
  }
}

function initWorkerService () {
  if (serviceStarted) return
  serviceStarted = true

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', () => {
      jobs.forEach(job => {
        if (job.requiresOnline) triggerJob(job.name, { delay: 1000 })
      })
    })
  }

  jobs.forEach(job => scheduleJob(job))
  jobs.forEach(job => triggerJob(job.name, { delay: 0 }))
}

function triggerJob (name, { delay = 0 } = {}) {
  const job = jobs.get(name)
  if (!job) return

  if (job.isRunning) return

  if (job.timerId != null) {
    clearTimeout(job.timerId)
    job.timerId = null
  }

  scheduleJob(job, Math.max(delay, 0))
}

const publisherJobName = 'nostr-event-publisher'

registerJob({
  name: publisherJobName,
  intervalMs: 30000,
  requiresOnline: true,
  maxRetries: 5,
  handler: async jobContext => {
    for await (const entry of idb.iterateQueueEntries({ type: 'nostr:event' })) {
      const { id, event, relays } = entry || {}
      if (!event || !Array.isArray(relays) || relays.length === 0) continue

      try {
        const { success, errors } = await nostrRelays.sendEvent(event, relays)
        if (success) {
          await idb.deleteQueueEntryById(id)
        } else if (errors?.length) {
          const reason = errors.map(({ relay, reason }) => `${relay}: ${reason}`).join('\n') || 'relay error without details'
          console.error('[worker-service] nostr event send error', reason)
          await handleQueueRetry({ entry, reason, job: jobContext })
        } else {
          console.error('[worker-service] nostr event send error without details')
          await handleQueueRetry({ entry, reason: 'relay rejected event without details', job: jobContext })
        }
      } catch (err) {
        console.error('[worker-service] nostr event send failure', err)
        await handleQueueRetry({ entry, reason: err?.message || err?.toString() || 'unknown error', job: jobContext })
      }
    }
  }
})

async function handleQueueRetry ({ entry, reason, job }) {
  const id = entry?.id
  if (id == null) return

  const readableReason = typeof reason === 'string' ? reason : JSON.stringify(reason)
  const maxRetries = job?.maxRetries ?? 0

  let nextRetryCount = (entry?.retryCount ?? 0) + 1
  if (nextRetryCount >= maxRetries) {
    await removeEntryAfterMaxRetries(id, nextRetryCount)
    return
  }

  try {
    const updated = await idb.updateQueueEntryById(id, existing => {
      const current = existing?.retryCount ?? 0
      nextRetryCount = current + 1
      return {
        ...existing,
        retryCount: nextRetryCount,
        lastAttemptAt: Date.now(),
        lastError: readableReason
      }
    })
    if (!updated) return
  } catch (updateErr) {
    console.error('[worker-service] failed to update queue entry after error', updateErr)
    return
  }

  if (nextRetryCount >= maxRetries) {
    await removeEntryAfterMaxRetries(id, nextRetryCount)
  }
}

async function removeEntryAfterMaxRetries (id, retryCount) {
  try {
    await idb.deleteQueueEntryById(id)
    console.warn(`[worker-service] removed queue entry ${id} after ${retryCount} failed attempts`)
  } catch (deleteErr) {
    console.error('[worker-service] failed to delete queue entry after reaching retry limit', deleteErr)
  }
}

export {
  initWorkerService,
  registerJob,
  triggerJob,
  publisherJobName as nostrEventPublisherJobName
}
