import type { TrackMiddleware } from "../types/public";
import { setupOnEndedCallback } from "../utils/track";

export type MiddlewareMedia = {
  stream: MediaStream;
  track: MediaStreamTrack;
};

export class MiddlewareManager {
  private middleware: TrackMiddleware | null = null;
  private clearMiddlewareFn: (() => void) | null = null;

  public updateMedia(track: MediaStreamTrack | null): MiddlewareMedia | null {
    return this.applyMiddleware(track, this.middleware);
  }

  public setTrackMiddleware(
    middleware: TrackMiddleware | null,
    rawTrack: MediaStreamTrack | null,
  ): MiddlewareMedia | null {
    this.middleware = middleware;
    return this.applyMiddleware(rawTrack, middleware);
  }

  public getMiddleware(): TrackMiddleware | null {
    return this.middleware;
  }

  public clearMiddleware() {
    this.clearMiddlewareFn?.();
    this.clearMiddlewareFn = null;
  }

  private applyMiddleware(
    rawTrack: MediaStreamTrack | null,
    middleware: TrackMiddleware | null,
  ): MiddlewareMedia | null {
    this.clearMiddleware();
    if (!rawTrack || !middleware) return null;
    const { onClear, track } = middleware(rawTrack);

    if (onClear) this.clearMiddlewareFn = onClear;

    setupOnEndedCallback(
      track,
      () => track.id,
      async () => {
        this.clearMiddleware();
        track.stop();
      },
    );

    return {
      stream: new MediaStream([track]),
      track,
    };
  }
}
