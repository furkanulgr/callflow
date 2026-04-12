import { Conversation } from '@elevenlabs/client';

export const ELEVENLABS_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID as string;

export interface ConversationCallbacks {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: string) => void;
    onModeChange?: (info: { mode: "speaking" | "listening" }) => void;
    onMessage?: (info: { message: string; source: "ai" | "user" }) => void;
}

export const startElevenLabsConversation = async (callbacks: ConversationCallbacks, agentId?: string) => {
    try {
        // Gerekli mikrofon iznini al
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const targetAgentId = agentId || ELEVENLABS_AGENT_ID;

        const conversation = await Conversation.startSession({
            agentId: targetAgentId as string,
            connectionType: "webrtc" as any, // type workaround
            onConnect: () => {
                if (callbacks.onConnect) callbacks.onConnect();
            },
            onDisconnect: () => {
                if (callbacks.onDisconnect) callbacks.onDisconnect();
            },
            onError: (error: string | Error) => {
                console.error("ElevenLabs Session Error:", error);
                if (callbacks.onError) callbacks.onError(typeof error === "string" ? error : error.message);
            },
            onModeChange: (info: { mode: string }) => {
                if (callbacks.onModeChange) {
                    callbacks.onModeChange({ mode: info.mode as "speaking" | "listening" });
                }
            },
            onMessage: (info: { message: string; source: string }) => {
                if (callbacks.onMessage) {
                    callbacks.onMessage({ message: info.message, source: info.source as "ai" | "user" });
                }
            }
        });

        return conversation;
    } catch (error: any) {
        console.error("Failed to start ElevenLabs session:", error);
        if (callbacks.onError) {
            callbacks.onError(error?.message || "Mikrofon izni reddedildi veya bağlantı hatası.");
        }
        throw error;
    }
};
