import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
// Tema retrô: só vale com a classe "tema-retro" no <html> (index.html).
import "./styles/retro/retro.css";
import "./styles/retro/cena";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
