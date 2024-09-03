import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import {
  FishjamClient,
  FishjamProvider,
  PeerMetadata,
  TrackMetadata,
} from "@fishjam-cloud/react-client";

const fishjamClient = new FishjamClient<PeerMetadata, TrackMetadata>();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FishjamProvider client={fishjamClient}>
      <App />
    </FishjamProvider>
  </React.StrictMode>,
);
