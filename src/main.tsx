import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App, { type LabPage } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("The Kolam Lab root element is missing.");
}

const page = root.dataset.page as LabPage | undefined;

if (!page) {
  throw new Error("The Kolam Lab page identifier is missing.");
}

createRoot(root).render(
  <StrictMode>
    <App page={page} />
  </StrictMode>,
);
