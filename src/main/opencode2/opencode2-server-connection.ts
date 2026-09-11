import { spawnProcess, type ChildProcessHandle } from '../../shared/child-process/run-process'
import {
  forceTerminateProcessTree,
  signalProcessTree
} from '../../shared/child-process/process-tree-termination'
import { createOpenCode2HttpClient, type OpenCode2HttpClient } from './opencode2-http-client'

export type OpenCode2ServerConnection = {
  readonly pid: number | undefined
  readonly client: OpenCode2HttpClient
  readonly closed: boolean
  close(): Promise<boolean>
}

export type OpenCode2ServerLaunch = {
  command: string
  args?: readonly string[]
  cwd: string
  env?: NodeJS.ProcessEnv
}

const START_TIMEOUT_MS = 15_000
const STOP_TIMEOUT_MS = 1_500
const OUTPUT_LIMIT = 64 * 1024

export async function openOpenCode2ServerConnection(
  launch: OpenCode2ServerLaunch,
  onExit?: (error: Error) => void
): Promise<OpenCode2ServerConnection> {
  const child = spawnProcess({
    program: launch.command,
    args: [...(launch.args ?? []), 'serve', '--hostname', '127.0.0.1', '--port', '0'],
    cwd: launch.cwd,
    env: launch.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  for (const stream of [child.stdin, child.stdout, child.stderr]) {
    stream?.on('error', () => {})
  }

  let closing = false
  let exited = false
  let output = ''
  let resolveExit = (): void => {}
  const exit = new Promise<void>((resolve) => {
    resolveExit = resolve
  })
  const observeExit = (): void => {
    if (exited) {
      return
    }
    exited = true
    resolveExit()
    if (!closing) {
      onExit?.(new Error('OpenCode 2 server exited unexpectedly.'))
    }
  }
  child.once('exit', observeExit)
  child.once('close', observeExit)
  child.once('error', observeExit)

  const ready = new Promise<{ url: string; password: string }>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('OpenCode 2 server did not become ready.')),
      START_TIMEOUT_MS
    )
    const inspect = (chunk: Buffer | string): void => {
      output = (output + chunk.toString()).slice(-OUTPUT_LIMIT)
      const url = output.match(/server listening on (https?:\/\/\S+)/)?.[1]
      const password = output.match(/server password (\S+)/)?.[1]
      if (url && password) {
        clearTimeout(timer)
        resolve({ url, password })
      }
    }
    child.stdout.on('data', inspect)
    child.stderr.on('data', inspect)
    exit.then(() => {
      clearTimeout(timer)
      reject(new Error('OpenCode 2 server exited before becoming ready.'))
    })
  })

  try {
    const endpoint = await ready
    output = ''
    const client = createOpenCode2HttpClient(endpoint.url, endpoint.password)
    await client.get('/api/health')
    return {
      get pid() {
        return child.pid
      },
      get client() {
        return client
      },
      get closed() {
        return closing || exited
      },
      close: () =>
        closeOpenCode2Server(child, exit, () => {
          closing = true
        })
    }
  } catch (error) {
    closing = true
    await forceTerminateProcessTree(child)
    throw error
  }
}

async function closeOpenCode2Server(
  child: ChildProcessHandle,
  exit: Promise<void>,
  markClosing: () => void
): Promise<boolean> {
  markClosing()
  await signalProcessTree(child, 'SIGTERM')
  if (await settlesWithin(exit, STOP_TIMEOUT_MS)) {
    return true
  }
  if (!(await forceTerminateProcessTree(child))) {
    return false
  }
  return settlesWithin(exit, STOP_TIMEOUT_MS)
}

async function settlesWithin(promise: Promise<void>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise.then(() => true),
    new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs)
      timer.unref?.()
    })
  ]).finally(() => timer && clearTimeout(timer))
}
