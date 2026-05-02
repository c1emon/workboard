type BoardEventStreamEvent = "close" | "error";

export interface BoardEventStream {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  write(chunk: string): void;
  on?(event: BoardEventStreamEvent, handler: () => void): void;
  off?(event: BoardEventStreamEvent, handler: () => void): void;
}

export interface BoardEventBroadcaster {
  getVersion(): number;
  publish(): number;
  register(stream: BoardEventStream, headers?: Record<string, string>): () => void;
}

export interface BoardEventBroadcasterOptions {
  heartbeatIntervalMs?: number;
}

export function createBoardEventBroadcaster(initialVersion = 1, options: BoardEventBroadcasterOptions = {}): BoardEventBroadcaster {
  let version = initialVersion;
  const streams = new Set<BoardEventStream>();
  const cleanups = new Map<BoardEventStream, () => void>();
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30_000;

  function writeUpdate(stream: BoardEventStream): boolean {
    return safeWrite(stream, `event: board:update\ndata: {"version":${version}}\n\n`);
  }

  function safeWrite(stream: BoardEventStream, chunk: string): boolean {
    try {
      stream.write(chunk);
      return true;
    } catch {
      return false;
    }
  }

  return {
    getVersion: () => version,
    publish: () => {
      version += 1;
      for (const stream of streams) {
        if (!writeUpdate(stream)) cleanups.get(stream)?.();
      }
      return version;
    },
    register: (stream, headers = {}) => {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        streams.delete(stream);
        cleanups.delete(stream);
        stream.off?.("close", cleanup);
        stream.off?.("error", cleanup);
      };

      stream.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...headers
      });
      streams.add(stream);
      cleanups.set(stream, cleanup);
      stream.on?.("close", cleanup);
      stream.on?.("error", cleanup);
      if (!writeUpdate(stream)) {
        cleanup();
        return cleanup;
      }
      heartbeat = setInterval(() => {
        if (!safeWrite(stream, ": heartbeat\n\n")) cleanup();
      }, heartbeatIntervalMs);

      return cleanup;
    }
  };
}
