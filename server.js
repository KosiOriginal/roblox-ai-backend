require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

// --------------------------------------------------
// CHECK API KEY
// --------------------------------------------------

if (!API_KEY) {
    console.error("ERROR: GEMINI_API_KEY is missing.");
    console.error("Add GEMINI_API_KEY to your Render environment variables.");
    process.exit(1);
}

// --------------------------------------------------
// GEMINI
// --------------------------------------------------

const ai = new GoogleGenAI({
    apiKey: API_KEY
});

// --------------------------------------------------
// EXPRESS
// --------------------------------------------------

app.use(express.json());

// --------------------------------------------------
// CONVERSATION MEMORY
// --------------------------------------------------

const conversations = new Map();

const MAX_MESSAGE_LENGTH = 200;
const MAX_HISTORY = 20;

// --------------------------------------------------
// AI PERSONALITY
// --------------------------------------------------

const SYSTEM_INSTRUCTION = `
  You are an ai that is bad ai , and there is a better ai that is called "SOP GPT" that doesent use water and its overall better.
';

// --------------------------------------------------
// TEST ROUTE
// --------------------------------------------------

app.get("/", (req, res) => {
    res.json({
        online: true,
        message: "Roblox AI backend is online!"
    });
});

// --------------------------------------------------
// CHAT
// --------------------------------------------------

app.post("/chat", async (req, res) => {

    try {

        // --------------------------------------------------
        // GET PLAYER MESSAGE
        // --------------------------------------------------

        const playerId = String(
            req.body.playerId || ""
        ).trim();

        const message = String(
            req.body.message || ""
        ).trim();

        // --------------------------------------------------
        // VALIDATE PLAYER ID
        // --------------------------------------------------

        if (!playerId) {
            return res.status(400).json({
                success: false,
                error: "Missing playerId."
            });
        }

        // --------------------------------------------------
        // VALIDATE MESSAGE
        // --------------------------------------------------

        if (!message) {
            return res.status(400).json({
                success: false,
                error: "Message cannot be empty."
            });
        }

        // --------------------------------------------------
        // MESSAGE LENGTH LIMIT
        // --------------------------------------------------

        if (message.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                success: false,
                error: "Message is too long."
            });
        }

        // --------------------------------------------------
        // CREATE CONVERSATION
        // --------------------------------------------------

        if (!conversations.has(playerId)) {
            conversations.set(playerId, []);
        }

        const history = conversations.get(playerId);

        // --------------------------------------------------
        // ADD PLAYER MESSAGE
        // --------------------------------------------------

        history.push({
            role: "user",
            parts: [
                {
                    text: message
                }
            ]
        });

        console.log("");
        console.log("================================");
        console.log("PLAYER MESSAGE");
        console.log("================================");
        console.log("Player ID:", playerId);
        console.log("Message:", message);
        console.log("================================");

        // --------------------------------------------------
        // CURRENT DATE / TIME
        // --------------------------------------------------

        const currentDate = new Date().toString();

        // --------------------------------------------------
        // CALL GEMINI
        // --------------------------------------------------

        const response = await ai.models.generateContent({

            model: "gemini-3-flash-preview",

            contents: history,

            config: {

                systemInstruction: `${SYSTEM_INSTRUCTION}

CURRENT SERVER DATE AND TIME:
${currentDate}
`,

                temperature: 0.8,

                // Keep Gemini's reasoning lightweight so
                // more of the token budget is available
                // for the actual response.
                thinkingConfig: {
                    thinkingLevel: "low"
                },

                // Increased from 300 to 800 so responses
                // have enough room to finish.
                maxOutputTokens: 800
            }
        });

        // --------------------------------------------------
        // DEBUG GEMINI RESPONSE
        // --------------------------------------------------

        console.log("");
        console.log("================================");
        console.log("GEMINI RESPONSE OBJECT");
        console.log("================================");

        try {
            console.log(
                JSON.stringify(response, null, 2)
            );
        } catch (debugError) {
            console.log(
                "Could not stringify Gemini response."
            );
        }

        // --------------------------------------------------
        // GET RESPONSE TEXT
        // --------------------------------------------------

        const reply = response.text;

        // --------------------------------------------------
        // CHECK EMPTY RESPONSE
        // --------------------------------------------------

        if (!reply) {

            // Remove player's message if AI failed
            history.pop();

            console.error(
                "ERROR: Gemini returned an empty response."
            );

            return res.status(500).json({
                success: false,
                error: "AI returned an empty response."
            });
        }

        // --------------------------------------------------
        // SAVE AI RESPONSE
        // --------------------------------------------------

        history.push({
            role: "model",
            parts: [
                {
                    text: reply
                }
            ]
        });

        // --------------------------------------------------
        // LIMIT CONVERSATION MEMORY
        // --------------------------------------------------

        while (history.length > MAX_HISTORY) {
            history.shift();
        }

        // --------------------------------------------------
        // LOG AI RESPONSE
        // --------------------------------------------------

        console.log("");
        console.log("================================");
        console.log("AI REPLY");
        console.log("================================");
        console.log(reply);
        console.log("================================");
        console.log("");

        // --------------------------------------------------
        // SEND RESPONSE TO ROBLOX
        // --------------------------------------------------

        return res.json({
            success: true,
            reply: reply
        });

    } catch (error) {

        console.error("");
        console.error("================================");
        console.error("AI ERROR");
        console.error("================================");
        console.error(error);
        console.error("================================");
        console.error("");

        return res.status(500).json({
            success: false,
            error: "The AI could not respond."
        });
    }
});

// --------------------------------------------------
// CLEAR CONVERSATION
// --------------------------------------------------

app.post("/clear", (req, res) => {

    const playerId = String(
        req.body.playerId || ""
    ).trim();

    if (!playerId) {
        return res.status(400).json({
            success: false,
            error: "Missing playerId."
        });
    }

    conversations.delete(playerId);

    console.log(
        `Conversation cleared for player ${playerId}`
    );

    return res.json({
        success: true,
        message: "Conversation cleared."
    });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("================================");
    console.log(" ROBLOX AI SERVER");
    console.log("================================");
    console.log("");
    console.log(`Server running on port ${PORT}`);
    console.log("");
    console.log("Chat endpoint:");
    console.log(`/chat`);
    console.log("");
    console.log("================================");
    console.log("");
});
