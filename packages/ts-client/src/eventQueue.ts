type EventQueueDeps = {
  checkIsReconnecting: () => boolean;
  sendMediaEvent: (mediaEvent: Uint8Array) => void;
};

export class EventQueue {
  private queuedEvents: Uint8Array[] = [];
  private checkIsReconnecting: EventQueueDeps['checkIsReconnecting'];
  private sendMediaEvent: EventQueueDeps['sendMediaEvent'];

  constructor(deps: EventQueueDeps) {
    this.checkIsReconnecting = deps.checkIsReconnecting;
    this.sendMediaEvent = deps.sendMediaEvent;
  }

  public enqueueEvent(mediaEvent: Uint8Array) {
    this.queuedEvents.push(mediaEvent);
    this.attemptToSendEvent();
  }

  public attemptSendOut() {
    this.attemptToSendEvent();
  }

  private attemptToSendEvent() {
    const isReconnecting = this.checkIsReconnecting();
    if (isReconnecting) return;

    const oldestEvent = this.queuedEvents.shift();
    if (!oldestEvent) return;

    this.sendMediaEvent(oldestEvent);

    if (this.queuedEvents.length === 0) return;

    this.attemptToSendEvent();
  }
}
