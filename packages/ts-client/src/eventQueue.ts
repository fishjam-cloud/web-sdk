type EventQueueDeps = {
  checkIsReconnecting: () => boolean;
  sendMediaEvent: (mediaEvent: Uint8Array) => void;
};

export class EventQueue {
  private queuedEvents: Uint8Array[] = [];
  private checkIsReconnecting: EventQueueDeps['checkIsReconnecting'];
  private sendMediaEvent: EventQueueDeps['sendMediaEvent'];
  private currentTimeout: NodeJS.Timeout | null = null;

  private static baseDelay = 200;

  constructor(deps: EventQueueDeps) {
    this.checkIsReconnecting = deps.checkIsReconnecting;
    this.sendMediaEvent = deps.sendMediaEvent;
  }

  public enqueueEvent(mediaEvent: Uint8Array) {
    this.queuedEvents.push(mediaEvent);
    if (this.currentTimeout) return;
    this.attemptToSendEvent();
  }

  private setupTimeout(currentAttempt = 1) {
    const delay = Math.pow(EventQueue.baseDelay, currentAttempt * 2);

    this.currentTimeout = setTimeout(() => {
      this.currentTimeout = null;
      const isReconnecting = this.checkIsReconnecting();

      if (isReconnecting) {
        this.setupTimeout(currentAttempt + 1);
      } else {
        this.attemptToSendEvent();
      }
    }, delay);
  }

  private attemptToSendEvent() {
    const isReconnecting = this.checkIsReconnecting();
    if (isReconnecting) return this.setupTimeout();

    const oldestEvent = this.queuedEvents.shift();
    if (!oldestEvent) return;
    this.sendMediaEvent(oldestEvent);

    if (this.queuedEvents.length === 0) return;
    this.attemptToSendEvent();
  }
}
