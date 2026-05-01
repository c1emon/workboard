export interface BoardEventStream {
  writeHead(statusCode: number, headers: Record<string, string>): void;
  write(chunk: string): void;
}

export interface BoardEventBroadcaster {
  getVersion(): number;
  publish(): number;
  register(stream: BoardEventStream, headers?: Record<string, string>): () => void;
}

export function createBoardEventBroadcaster(initialVersion = 1): BoardEventBroadcaster {
  let version = initialVersion;
  const streams = new Set<BoardEventStream>();

  function writeUpdate(stream: BoardEventStream): void {
    stream.write(`event: board:update\ndata: {"version":${version}}\n\n`);
  }

  return {
    getVersion: () => version,
    publish: () => {
      version += 1;
      for (const stream of streams) {
        try {
          writeUpdate(stream);
        } catch {
          streams.delete(stream);
        }
      }
      return version;
    },
    register: (stream, headers = {}) => {
      stream.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...headers
      });
      streams.add(stream);
      writeUpdate(stream);

      return () => {
        streams.delete(stream);
      };
    }
  };
}
