type MessageQueueDeps = {
  checkIsReconnecting: () => boolean;
  sendMessage: (message: Uint8Array) => void;
};

export class MessageQueue {
  private queuedMessages: Uint8Array[] = [];
  private checkIsReconnecting: MessageQueueDeps['checkIsReconnecting'];
  private sendMessage: MessageQueueDeps['sendMessage'];

  constructor(deps: MessageQueueDeps) {
    this.checkIsReconnecting = deps.checkIsReconnecting;
    this.sendMessage = deps.sendMessage;
  }

  public enqueueMessage(mediaEvent: Uint8Array) {
    this.queuedMessages.push(mediaEvent);
    this.attemptToSendAll();
  }

  public attemptToSendAll() {
    const isReconnecting = this.checkIsReconnecting();
    if (isReconnecting) return;

    const oldestMessage = this.queuedMessages.shift();
    if (!oldestMessage) return;

    this.sendMessage(oldestMessage);

    if (this.queuedMessages.length === 0) return;

    this.attemptToSendAll();
  }
}
