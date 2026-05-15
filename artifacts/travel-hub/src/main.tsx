import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./modern-design.css";

// Set to false to instantly revert all visual improvements
// and go back to the original design.
const USE_MODERN_DESIGN = true;

const root = document.getElementById("root")!;
if (USE_MODERN_DESIGN) root.classList.add("modern-theme");

createRoot(root).render(<App />);
