import type {
  FishjamClient,
  PeerMetadata,
  TrackMetadata,
} from "@fishjam-cloud/react-client/";

declare global {
  interface Window {
    client: FishjamClient<PeerMetadata, TrackMetadata>;
  }
}
