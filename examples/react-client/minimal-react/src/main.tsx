import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./components/App";
import {
  FishjamClient,
  FishjamProvider,
  type PeerMetadata,
  type TrackMetadata,
} from "@fishjam-cloud/react-client";

export const fishjamClient = new FishjamClient<PeerMetadata, TrackMetadata>();

// for e2e test
window.client = fishjamClient;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <FishjamProvider client={fishjamClient}>
      <App />
    </FishjamProvider>
  </React.StrictMode>,
);
