import type { Deferred } from './deferred';

export type Command = {
  commandType: 'COMMAND-WITH-HANDLER';
  handler: () => void;
  validate?: () => string | null;
  resolutionNotifier: Deferred<void>;
  resolve: "after-renegotiation" | "immediately";
}

