/* @refresh reload */
import { render } from "solid-js/web";

import "./index.css";
import App from "./App";
import { SettingsProvider } from "./settings";

const root = document.getElementById("root");

render(
  () => (
    <SettingsProvider>
      <App />
    </SettingsProvider>
  ),
  root!
);
