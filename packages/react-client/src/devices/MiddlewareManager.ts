import type { Media } from "../types/internal";

import type { TrackMiddleware } from "../types/public";
import { setupOnEndedCallback } from "../utils/track";

type StreamTrack = Pick<Media, "track" | "stream" | "enabled">;

export class MiddlewareManager {
  private media: StreamTrack | null = null;

  private middleware: TrackMiddleware | null = null;
  private clearMiddlewareFn: (() => void) | null = null;

  public getMedia = (): StreamTrack | null => this.media;

  public updateMedia(media: StreamTrack | null) {
    this.media = !media ? null : this.applyMiddleware(media.track, this.middleware);
  }

  public setTrackMiddleware(middleware: TrackMiddleware | null, rawTrack: MediaStreamTrack | null) {
    this.middleware = middleware;
    this.clearMiddleware();

    if (!rawTrack) return;

    this.media = this.applyMiddleware(rawTrack, middleware);
  }

  public getMiddleware(): TrackMiddleware | null {
    return this.middleware;
  }

  public stop() {
    this.clearMiddleware();
    this.media?.track?.stop();
  }

  public disable() {
    if (!this.media?.track) return;

    this.media.track.enabled = false;
    this.media.enabled = false;
  }

  public enable() {
    if (!this.media?.track) return;

    this.media!.track!.enabled = true;
    this.media!.enabled = true;
  }

  private clearMiddleware() {
    this.clearMiddlewareFn?.();
    this.clearMiddlewareFn = null;
  }

  private applyMiddleware(rawTrack: MediaStreamTrack | null, middleware: TrackMiddleware | null): StreamTrack {
    this.clearMiddleware();
    const { onClear, track } = middleware?.(rawTrack) ?? { track: rawTrack };

    setupOnEndedCallback(
      track,
      () => track?.id,
      async () => this.stop(),
    );

    if (onClear) this.clearMiddlewareFn = onClear;
    const finalTrack = track ?? rawTrack;
    const stream = finalTrack ? new MediaStream([finalTrack]) : null;

    return {
      stream,
      track: finalTrack,
      enabled: Boolean(finalTrack?.enabled),
    };
  }
}
