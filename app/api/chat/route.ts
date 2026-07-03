import {NextResponse, type NextRequest } from "next/server";

//interface for the messages that will be sent
interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

//interface for the request we will send to the modal
interface ChatRequest {
    message: string;
    history: ChatMessage[];
}

async function generateAIResponse(messages: ChatMessage[]): Promise<string> {
    const systemPrompt = `
        You are a helpful AI coding assistant. You help developers with:
        - Code explanations and debugging
        - Best practices and architecture advice
        - Writing clean, efficient code
        - Troubleshooting errors
        - Code reviews and optimizations

        Always provide clear, practical answers. Use proper code formatting when showing examples 
    `

    const fullMessages = [
        {role: "system", content: systemPrompt},
        ...messages //these are the messages sent by the user
    ]

    //we need the prompt variable below as the fullMessages is an array of objects but the model 
    //does not consume that array directly, It needs a single prompt so we turn each object into
    //a line like "user: Hello" and then join them with \n\n to seperate messages clearly
    const prompt = fullMessages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join("\n\n");

    try {
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                model: "codellama:latest",
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.7,    //this will control randomness
                    max_tokens: 1000,
                    top_p: 0.9  //controls diversity
                }
            })
        })

        const data = await response.json(); //here we are fetching the response we get from the model
        if(!data.response) {
            throw new Error("No response from AI model");
        }

        return data.response.trim();
    } catch (error) {
        console.error("AI generation error", error);
        throw new Error("Failed to generate AI response");  
    }
} 

export async function POST(request: NextRequest) {
    try {
        const body: ChatRequest = await request.json();
        const {message, history} = body;
        
        //validate message
        if(!message || typeof message !== "string") {
            return NextResponse.json(
                {error: "Message is required and must be a string"},
                {status: 400}
            );
        }

        //validate history
        const validHistory = Array.isArray(history) 
        ? history.filter(msg => 
            msg &&
            typeof msg === "object" &&
            typeof msg.role === "string" &&
            typeof msg.content === "string" &&
            ["user", "assistant"].includes(msg.role)
        )
        : [];

        //now keep only the RECENT history as we dont want the full history
        const recentHistory = validHistory.slice(-10);

        //create the message to send to the model
        const messages:ChatMessage[] = [
            ...recentHistory,
            {role: "user", content: message}
        ]

        //generate ai response
        const aiResponse = await generateAIResponse(messages);

        return NextResponse.json({
            response: aiResponse,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error("Chat API error", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({
            error: "Failed to generate AI response",
            details: errorMessage,
            timestamp: new Date().toISOString()
        }, {status: 500});
    }
}