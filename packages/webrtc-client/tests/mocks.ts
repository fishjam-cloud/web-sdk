import { vi } from 'vitest';
import { undefined } from 'zod';

export const mockMediaStream = () => {
  (global as any).MediaStream = vi.fn().mockImplementation(() => {
    return {
      addTrack: () => {},
    };
  });
};

export const mockRTCPeerConnection = (): {
  addTransceiverCallback: any;
  runOnTrack: (ev: RTCTrackEvent) => void;
} => {
  const addTransceiverCallback = vi.fn((_trackOrKind, _init) => null);

  (global as any).RTCPeerConnection = vi.fn().mockImplementation(() => {
    const transceivers: RTCRtpTransceiver[] = [];
    const senders: RTCRtpSender[] = [];

    const newVar: RTCPeerConnection = {
      getTransceivers: () => {
        return transceivers;
      },
      addTransceiver: (trackOrKind: MediaStreamTrack | string, init?: RTCRtpTransceiverInit): RTCRtpTransceiver => {
        addTransceiverCallback(trackOrKind, init);

        const sender: any = {};
        sender.getParameters = () => {
          // @ts-ignore
          const encodings: RTCRtpEncodingParameters[] = [{}];
          return { encodings: encodings } as RTCRtpSendParameters;
        };

        if (init?.direction === 'sendonly') {
          sender.track = typeof trackOrKind !== 'string' ? trackOrKind : { id: 'someTrackId' };
        }

        senders.push(sender);

        // maybe move to callback declaration
        const transceiver: RTCRtpTransceiver = {
          currentDirection: null,
          direction: init?.direction ?? 'inactive',
          mid: 'someTransceiverMid',
          receiver: {} as RTCRtpReceiver,
          sender: sender,
          setCodecPreferences: (_codecs) => {},
          stop: () => {},
        };
        transceivers.push(transceiver);

        return transceiver;
      },
      // @ts-ignore
      createOffer: (_options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> => {
        // const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        return new Promise<RTCSessionDescriptionInit>((resolve, _reject) => {
          resolve({ sdp: '', type: 'offer' });
        });
      },
      setLocalDescription: async (_description?: RTCLocalSessionDescriptionInit): Promise<void> => {},
      setRemoteDescription: async (_description: RTCSessionDescriptionInit): Promise<void> => {},
      getSenders: (): RTCRtpSender[] => {
        return senders;
      },
      close: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    return newVar;
  });

  (global as any).RTCRtpTransceiver = vi.fn().mockImplementation(() => {
    const newVar: RTCRtpTransceiver = {
      currentDirection: null,
      direction: 'stopped',
      mid: '0',
      // @ts-ignore
      receiver: undefined,
      // @ts-ignore
      sender: undefined,
      setCodecPreferences(_codecs): void {},
      stop(): void {},
    };

    return newVar;
  });

  const runOnTrack = (ev: RTCTrackEvent) => {
    (global as any).RTCPeerConnection.ontrack(ev);
  };

  return { addTransceiverCallback, runOnTrack };
};
