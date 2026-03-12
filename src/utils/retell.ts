import { RetellWebClient } from "retell-client-js-sdk";

export const retellClient = new RetellWebClient();

// In a real application, you should fetch this from your backend securely.
export const getWebCallToken = async (agentId: string): Promise<string> => {
    try {
        const response = await fetch("https://api.retellai.com/v2/create-web-call", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${import.meta.env.VITE_RETELL_API_KEY}`,
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
