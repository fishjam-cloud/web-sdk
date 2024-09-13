import { Deferred } from './webrtc/deferred';
import type { FishjamClient } from './FishjamClient';

export function connectPromiseFn<P, T>(fishjamClient: FishjamClient<P, T>) {
  const result = new Deferred<void>();
  let clearCallbacks: (() => void) | null = () => {
    console.log("Bad clear")
  }

  const onSuccess = () => {
    clearCallbacks?.();
    result.resolve();
  };
  const onError = () => {
    clearCallbacks?.();
    result.reject('joinError');
  };

  fishjamClient.on('joined', onSuccess);
  fishjamClient.on('joinError', onError);
  fishjamClient.on('authError', onError);
  fishjamClient.on('socketError', onError);

  clearCallbacks = () => {
    console.log("Real clear")
    fishjamClient.removeListener('joined', onSuccess);
    fishjamClient.removeListener('joinError', onError);
    fishjamClient.removeListener('authError', onError);
    fishjamClient.removeListener('socketError', onError);
  };

  return result.promise
}
