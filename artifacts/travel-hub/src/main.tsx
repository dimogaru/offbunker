import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./modern-design.css";

// Self-hosted Inter font — no Google Fonts CDN dependency, fully offline-ready.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

// Set to false to instantly revert all visual improvements
// and go back to the original design.
const USE_MODERN_DESIGN = true;

const root = document.getElementById("root")!;
if (USE_MODERN_DESIGN) root.classList.add("modern-theme");

createRoot(root).render(<App />);
