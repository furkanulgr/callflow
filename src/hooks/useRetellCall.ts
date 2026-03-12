import { useState, useEffect } from "react";
import { retellClient, getWebCallToken } from "../utils/retell";

export type TranscriptMessage = {
    role: "agent" | "user";
    content: string;
};

export const useRetellCall = () => {
    const [isCalling, setIsCalling] = useState(false);
    const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
    const [latency, setLatency] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const agentId = import.meta.env.VITE_RETELL_AGENT_ID;

    useEffect(() => {
        // Event Listeners for Retell Client
        retellClient.on("call_started", () => {
            console.log("Call started event received");
            setIsCalling(true);
            setTranscript([]);
            setError(null);
        });

        retellClient.on("call_ended", () => {
            console.log("Call ended event received");
            setIsCalling(false);
        });

        retellClient.on("update", (update) => {
             console.log("Update event received:", update);
             if (update && update.transcript) {
                 const formattedTranscript = update.transcript.map((item: any) => ({
                     role: item.role === "agent" ? "agent" : "user",
                     content: item.content
                 }));
                 // avoid rendering duplicates if same length
                 setTranscript(formattedTranscript);
             }
         });

         retellClient.on("error", (err) => {
             console.error("Retell Client Error:", err);
             setError((err as any)?.message || "An error occurred during the call");
             setIsCalling(false);
         });
         
         // Extra listener for audio activity to debug
         retellClient.on("audio", (audioData: Uint8Array) => {
             // In a real scenario this logs too much, but good to know it's firing
             // console.log("Receiving audio packet length:", audioData.length);
         });

        return () => {
            retellClient.off("call_started");
            retellClient.off("call_ended");
            retellClient.off("update");
            retellClient.off("error");
            retellClient.off("audio");
        };
    }, []);

    const startCall = async () => {
        if (!agentId) {
            setError("Agent ID is not set in environment variables");
            return;
        }
        
        try {
            setError(null);
            setIsCalling(true); // Optimistic Update
            console.log("Fetching Web Call Token for Agent:", agentId);
            const accessToken = await getWebCallToken(agentId);
            
            console.log("Token received, starting Retell call...");
            await retellClient.startCall({
                accessToken,
                sampleRate: 24000
            });
            console.log("Call started successfully from client side.");
        } catch (err: any) {
            console.error("Failed to start call catch block:", err);
            setError(err.message || "Failed to start call");
            setIsCalling(false);
        }
    };

    const endCall = () => {
        try {
            console.log("Stopping call manually...");
            retellClient.stopCall();
            setIsCalling(false);
        } catch(e) {
            console.error("Error stopping call", e);
        }
    };

    return {
        isCalling,
        transcript,
        latency,
        error,
        startCall,
        endCall
    };
};
