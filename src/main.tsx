import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { InstallApp } from "./components/InstallApp";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
    <InstallApp />
  </BrowserRouter>,
);
