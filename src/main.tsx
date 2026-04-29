import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";

// ─── Sentry Error Tracking ────────────────────────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: import.meta.env.MODE,
        // Production'da %10, dev'de %100
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        // Sadece error olduğunda session replay
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: true,
                blockAllMedia: true,
            }),
        ],
    });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <Sentry.ErrorBoundary fallback={<div style={{ padding: 40 }}>Bir şeyler ters gitti. Sayfayı yenileyin.</div>}>
            <App />
        </Sentry.ErrorBoundary>
    </React.StrictMode>
);
