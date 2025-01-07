import { beforeEach, describe, expect, test, vi } from 'vitest';
import { EventQueue } from '../eventQueue';

describe('Event queue tests', () => {
  let isReconnecting = false;

  beforeEach(() => {
    isReconnecting = false;
  });

  const getQueueWithUtils = () => {
    const sendMediaEvent = vi.fn();

    const queue = new EventQueue({ sendMediaEvent, checkIsReconnecting: () => isReconnecting });

    const event1 = new Uint8Array([1, 2, 3]);
    const event2 = new Uint8Array([4, 5, 6]);

    return { sendMediaEvent, queue, event1, event2 };
  };

  test('Queue dispatches events while not reconnecting', () => {
    const { queue, sendMediaEvent, event1, event2 } = getQueueWithUtils();

    queue.enqueueEvent(event1);
    queue.enqueueEvent(event2);

    expect(sendMediaEvent).toHaveBeenCalledWith(event1);
    expect(sendMediaEvent).toHaveBeenCalledWith(event2);
  });

  test('Queue holds events while reconnecting', () => {
    const { queue, sendMediaEvent, event1, event2 } = getQueueWithUtils();

    isReconnecting = true;
    queue.enqueueEvent(event1);
    queue.enqueueEvent(event2);

    expect(sendMediaEvent).not.toHaveBeenCalled();
  });

  test('Queue dispatches all events upon calling attemptToSendOut', async () => {
    const { queue, sendMediaEvent, event1, event2 } = getQueueWithUtils();
    isReconnecting = true;

    queue.enqueueEvent(event1);
    queue.enqueueEvent(event2);

    isReconnecting = false;

    // attemptToSendOut not called yet
    expect(sendMediaEvent).not.toHaveBeenCalled();

    queue.attemptSendOut();

    // all events dispatched
    expect(sendMediaEvent).toHaveBeenCalledTimes(2);
  });

  test('Queue dispatches all events upon enqueuing another event', async () => {
    const { queue, sendMediaEvent, event1, event2 } = getQueueWithUtils();
    isReconnecting = true;

    queue.enqueueEvent(event1);
    queue.enqueueEvent(event2);

    isReconnecting = false;

    // no trigger to send out yet
    expect(sendMediaEvent).not.toHaveBeenCalled();

    const anotherEvent = new Uint8Array([7, 8, 9]);
    queue.enqueueEvent(anotherEvent);

    // all events dispatched
    expect(sendMediaEvent).toHaveBeenCalledTimes(3);
  });
});
