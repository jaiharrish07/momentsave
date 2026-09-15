"use client";

import { useState } from "react";

export default function Home() {
  const [health, setHealth] = useState<string>("");
  const [error, setError] = useState<string>("");

  const checkBackend = async () => {
    setError("");
    setHealth("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
      const data = await res.json();
      setHealth(JSON.stringify(data));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <main style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>MomentSave</h1>
      <p>Photo sharing platform — coming soon.</p>
      <button onClick={checkBackend} style={{ padding: 10, marginTop: 20 }}>
        Check backend
      </button>
      {health && <pre style={{ marginTop: 20 }}>Health: {health}</pre>}
      {error && <pre style={{ color: "red" }}>Error: {error}</pre>}
    </main>
  );
}
