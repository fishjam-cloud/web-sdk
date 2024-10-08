import type { TrackMiddleware } from "../types/public";
import { setupOnEndedCallback } from "../utils/track";

export class MiddlewareManager {
  private middleware: TrackMiddleware | null = null;
  private rawTrack: MediaStreamTrack | null = null;
  private clearMiddlewareFn: (() => void) | null = null;

  public processTrack(track: MediaStreamTrack | null): MediaStreamTrack | null {
    this.rawTrack = track;
    return this.applyMiddleware(track, this.middleware);
  }

  public processMiddleware(middleware: TrackMiddleware | null): MediaStreamTrack | null {
    this.middleware = middleware;
    return this.applyMiddleware(this.rawTrack, middleware);
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
  ): MediaStreamTrack | null {
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

    return track;
  }
}
