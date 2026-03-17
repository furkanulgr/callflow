import { RetellWebClient } from "retell-client-js-sdk";

// ── Centralized Retell Credentials ──
// Reads from env if available, otherwise falls back to hardcoded values.
export const RETELL_API_KEY = (import.meta.env && import.meta.env.VITE_RETELL_API_KEY) || "key_8fff0f4fd2d7cf2df9b578f4987f";
export const RETELL_AGENT_ID = (import.meta.env && import.meta.env.VITE_RETELL_AGENT_ID) || "agent_e4f44ec1b0125596c91072269e";

export const retellClient = new RetellWebClient();

// In a real application, you should fetch this from your backend securely.
export const getWebCallToken = async (agentId: string): Promise<string> => {
    try {
        const response = await fetch("https://api.retellai.com/v2/create-web-call", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RETELL_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                agent_id: agentId,
            })
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();
        return data.access_token;

    } catch (error) {
        console.error("Failed to get web call token:", error);
        throw error;
    }
};
