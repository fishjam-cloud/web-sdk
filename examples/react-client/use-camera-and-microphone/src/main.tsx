import React from "react";
import ReactDOM from "react-dom/client";
import MainControls from "./MainControls";
import "./index.css";
import AdditionalControls from "./AdditionalControls";
import { FishjamProvider } from "@fishjam-cloud/react-client";
import { peerMetadataParser } from "./fishjamSetup";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FishjamProvider
      config={{
        peerMetadataParser,
      }}
    >
      <MainControls />
      <AdditionalControls />
    </FishjamProvider>
  </React.StrictMode>,
);
