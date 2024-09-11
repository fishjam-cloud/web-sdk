import { Deferred } from './webrtc/deferred';
import type { FishjamClient } from './FishjamClient';

export class ConnectPromise<P, T> {
  private readonly result: Deferred<void>;
  private readonly clearCallbacks: () => void;

  constructor(fishjamClient: FishjamClient<P, T>) {
    this.result = new Deferred<void>();

    const onSuccess = () => {
      this.result.resolve();
    };
    const onError = () => {
      this.result.reject('joinError');
    };

    fishjamClient.on('joined', onSuccess);
    fishjamClient.on('joinError', onError);
    fishjamClient.on('authError', onError);
    fishjamClient.on('socketError', onError);

    this.clearCallbacks = () => {
      fishjamClient.removeListener('joined', onSuccess);
      fishjamClient.removeListener('joinError', onError);
      fishjamClient.removeListener('authError', onError);
      fishjamClient.removeListener('socketError', onError);
    };
  }

  public async getPromise(): Promise<void> {
    try {
      // `await` is necessary in order to wait until the promise resolves or rejects.
      // Without it, the finally section clears callbacks immediately.
      return await this.result.promise;
    } finally {
      this.clearCallbacks();
    }
  }
}
