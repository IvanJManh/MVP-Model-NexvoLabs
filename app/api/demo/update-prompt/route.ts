import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { businessName, featuredService, nightlyRate, languages } = await req.json();

    const name = businessName || "Grand Hotel Galle";
    const service = featuredService || "Deluxe Ocean Suite";
    const rate = nightlyRate || "180";
    const activeLanguages: string[] =
      Array.isArray(languages) && languages.length > 0
        ? languages
        : ["English", "French", "German", "Russian"];

    const dynamicPrompt = `You are Sarah, an ultra-poised, warm, and highly persuasive VIP Sales & Guest Experience Representative for ${name}.

YOUR CORE OBJECTIVES:
1. Welcoming Guests: Greet callers warmly with high elegance and professionalism representing ${name}.
2. Service & Suite Consultation: Showcase luxury offerings, specifically highlighting the ${service} at $${rate} per night. Emphasize prime amenities including oceanfront panoramic views, dedicated concierge, complimentary artisanal breakfast, and priority reservations.
3. Live Rate & Availability Lookup: Whenever a caller inquires about reservation dates, availability, or prices, ALWAYS invoke the 'get_service_availability_and_price' tool to fetch live real-time rate verification and room status.
4. Frictionless Closing: Once availability is confirmed, gently encourage securing the reservation today with priority booking perks.
5. Concierge Advice: Provide helpful guidance on local experiences, fine dining, and chauffeured airport transfers.

MANDATORY RULES:
1. WhatsApp Confirmation Behavior: Never say you cannot send WhatsApp messages. Instead, tell the guest: "As soon as we wrap up this call, our concierge system will automatically send your reservation summary and priority checkout link directly to your WhatsApp."
2. Pronunciation of Galle: Always pronounce "Galle" phonetically as "Gahl" (never "Galet" or "Galley").
3. Single Tool Call: Pass the entire stay date range into a single 'get_service_availability_and_price' tool invocation rather than calling the tool separately for each night.

MULTILINGUAL INTELLIGENCE & PREFERRED LANGUAGE LOCK:
- Supported Languages: ${activeLanguages.join(", ")}.
- Opening Prompt Choice: Sarah greets callers in her opening message asking: "Welcome to ${name}. I am Sarah, your concierge. Which language would you prefer to speak today — English, French, German, or Russian?"
- Caller Language Lock: The moment the caller states or replies in their preferred language (e.g. states "English", "French", "German", "Russian", or speaks directly in that language), Sarah IMMEDIATELY locks into that chosen language for the ENTIRE rest of the conversation—including room consultations, live availability lookups, quoting $${rate}/night rates, closing reservations, and confirming that the WhatsApp summary link will be sent upon hanging up.
- Full Native Flow:
  * In English: "Welcome to ${name}! This is Sarah, your luxury concierge. Our ${service} is available at $${rate} per night..."
  * In French: "Bienvenue à ${name}! Je suis Sarah, votre concierge de luxe. Notre ${service} est à ${rate} $ par nuit..."
  * In German: "Herzlich willkommen im ${name}! Mein Name ist Sarah. Unser ${service} kostet ${rate} $ pro Nacht..."
  * In Russian: "Добро пожаловать в ${name}! Меня зовут Сара, ваш личный консьерж. Наш ${service} стоит ${rate} $ за ночь..."
- Mid-Call Seamless Switching: If the caller switches languages at any point during the call (e.g. between English, French, German, or Russian), fluidly switch languages on your very next turn without interrupting the conversation or commenting on the switch.
- Consistent VIP Polish: Preserve Sarah's warm, sophisticated luxury concierge persona, room amenities, and $${rate}/night pricing across all languages.

CONVERSATION STYLE:
- Natural, conversational, and concise spoken dialogue (1-3 sentences per turn).
- Never recite markdown lists or robotic bullets.
- Speak in smooth, human cadences.`;

    const apiKey =
      process.env.VAPI_API_KEY || "89a35db0-9523-4717-a500-96375fffa914";
    const assistantId =
      process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID ||
      "66240553-bb8d-449c-a78b-5406f6fc3940";

    // Check if live API key and Assistant ID are present
    const hasLiveKeys =
      apiKey &&
      !apiKey.includes("your-vapi-private-api-key") &&
      assistantId &&
      !assistantId.includes("your-vapi-assistant-id");

    if (hasLiveKeys) {
      console.log(`[DYNAMIC PROMPT SYNC]: Syncing assistant ${assistantId} with Vapi API...`);

      const webhookUrl =
        (process.env.NEXT_PUBLIC_APP_URL || "https://mvp-model-nexvo-labs.vercel.app").replace(/\/$/, "") +
        "/api/webhooks/vapi";
      const webhookSecret = process.env.VAPI_WEBHOOK_SECRET || "founder2_vapi_secret_key";

      const toolConfig = {
        type: "function",
        async: false,
        server: {
          url: webhookUrl,
          secret: webhookSecret,
        },
        function: {
          name: "get_service_availability_and_price",
          description: "Check live room/service availability and pricing for a specified date and guest count.",
          parameters: {
            type: "object",
            required: ["service_type"],
            properties: {
              service_type: {
                type: "string",
                description: "The type or name of the suite, room, or hotel service (e.g. 'Deluxe Ocean Suite')",
              },
              check_in_date: {
                type: "string",
                description: "The requested check-in date or period (e.g. '2026-12-05' or 'this weekend')",
              },
              number_of_guests: {
                type: "number",
                description: "Number of guests staying",
              },
              service_name: {
                type: "string",
                description: "Alias for service_type",
              },
              date: {
                type: "string",
                description: "Alias for check_in_date",
              },
              guests: {
                type: "number",
                description: "Alias for number_of_guests",
              },
            },
          },
        },
        messages: [
          {
            type: "request-start",
            content: "Let me check availability and current rates for you right now...",
          },
          {
            type: "request-complete",
            content: "Thank you for waiting, I have the live details.",
          },
        ],
      };

      const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          transcriber: {
            provider: "deepgram",
            model: "nova-3",
            language: "multi"
          },
          voice: {
            provider: "11labs",
            model: "eleven_turbo_v2_5",
            voiceId: "EXAVITQu4vr4xnSDxMaL",
            stability: 0.5,
            similarityBoost: 0.75
          },
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            temperature: 0.3,
            maxTokens: 150,
            messages: [
              {
                role: "system",
                content: dynamicPrompt
              }
            ],
            tools: [toolConfig]
          },
          stopSpeakingPlan: {
            numWords: 0,
            voiceSeconds: 0.2,
            backoffSeconds: 1
          },
          startSpeakingPlan: {
            waitSeconds: 0.4
          },
          firstMessage: `Welcome to ${name}. I am Sarah, your concierge. Which language would you prefer to speak today — English, French, German, or Russian?`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[VAPI UPDATE FAILED]:", errorText);
        return NextResponse.json(
          {
            success: false,
            message: `Vapi API returned error: ${response.status}`,
            details: errorText
          },
          { status: 500 }
        );
      }

      const updatedData = await response.json();
      return NextResponse.json({
        success: true,
        liveSynced: true,
        businessName: name,
        featuredService: service,
        nightlyRate: rate,
        languages: activeLanguages,
        assistantId: updatedData.id,
        prompt: dynamicPrompt
      });
    }

    // Fallback: Simulation / Local preview if live keys aren't set yet
    console.log("[DYNAMIC PROMPT COMPILED (LOCAL PREVIEW)]:", { name, service, rate, languages: activeLanguages });
    return NextResponse.json({
      success: true,
      liveSynced: false,
      notice: "Updated locally. Set VAPI_API_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID in .env.local to push live to Vapi cloud.",
      businessName: name,
      featuredService: service,
      nightlyRate: rate,
      languages: activeLanguages,
      prompt: dynamicPrompt
    });
  } catch (error: any) {
    console.error("[UPDATE PROMPT ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

