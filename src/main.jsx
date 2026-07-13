import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/* Lagringsshim: appen anropar window.storage (get/set/delete/list).
   På webben backas den av localStorage. Byts enkelt mot ett API
   (t.ex. Supabase) den dag riktiga konton införs. */
window.storage = {
  async get(key) {
    const raw = localStorage.getItem("imsafe:" + key);
    return raw === null ? null : { key, value: raw };
  },
  async set(key, value) {
    localStorage.setItem("imsafe:" + key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem("imsafe:" + key);
    return { key, deleted: true };
  },
  async list(prefix = "") {
    const keys = Object.keys(localStorage)
      .filter((k) => k.startsWith("imsafe:" + prefix))
      .map((k) => k.replace("imsafe:", ""));
    return { keys, prefix };
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
