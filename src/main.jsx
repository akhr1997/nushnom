import React from "react";
import { createRoot } from "react-dom/client";
import NushNom from "../NushNom.jsx";

const STORAGE_PREFIX = "nushnom:";

if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return value == null ? null : { value };
    },
    async set(key, value) {
      window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, value);
      return { value };
    },
    async delete(key) {
      window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return null;
    },
  };
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <NushNom />
  </React.StrictMode>
);
