import React from "react";
import ReactDOM from "react-dom/client";
import MainControls from "./MainControls";
import "./index.css";
import AdditionalControls from "./AdditionalControls";
import {
  FishjamClient,
  FishjamProvider,
  type PeerMetadata,
  type TrackMetadata,
} from "@fishjam-cloud/react-client";

export const fishjamClient = new FishjamClient<PeerMetadata, TrackMetadata>();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FishjamProvider client={fishjamClient}>
      <MainControls />
      <AdditionalControls />
    </FishjamProvider>
  </React.StrictMode>,
);
