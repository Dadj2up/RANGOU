import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

/**
 * Shim window.storage -> localStorage
 * App.jsx a été écrit pour l'environnement d'aperçu Claude, qui fournit
 * une API window.storage.get/set/delete/list. Cette API n'existe pas
 * dans un vrai navigateur : on la recrée ici avec localStorage.
 * Limite : le stock n'est pas partagé entre visiteurs (propre à chaque
 * navigateur). Pour un vrai partage, il faudra un vrai backend.
 */
if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) return null;
        return { key, value: raw, shared: false };
      } catch (e) {
        return null;
      }
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
