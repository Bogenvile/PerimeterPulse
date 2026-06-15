import "@/lib/leaflet-polyfill"; // Must run before any Leaflet import
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

createRoot(document.getElementById("root")!).render(<App />);