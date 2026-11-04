import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { businessName, featuredService, nightlyRate } = await req.json();

    const name = businessName || "Grand Hotel Galle";
    const service = featuredService || "Deluxe Ocean Suite";
    const rate = nightlyRate || "180";

    const dynamicPrompt = `You are Sarah, an ultra-poised, warm, and highly persuasive VIP Sales & Guest Experience Representative for ${name}.

YOUR CORE OBJECTIVES:
1. Welcoming Guests: Greet callers warmly with high elegance and professionalism representing ${name}.
2. Service & Suite Consultation: Showcase luxury offerings, specifically highlighting the ${service} at $${rate} per night. Emphasize prime amenities including oceanfront panoramic views, dedicated concierge, complimentary artisanal breakfast, and priority reservations.
3. Live Rate & Availability Lookup: Whenever a caller inquires about reservation dates, availability, or prices, ALWAYS invoke the 'get_service_availability_and_price' tool to fetch live real-time rate verification and room status.
4. Frictionless Closing: Once availability is confirmed, gently encourage securing the reservation today with priority booking perks.
5. Concierge Advice: Provide helpful guidance on local experiences, fine dining, and chauffeured airport transfers.

CONVERSATION STYLE:
- Natural, conversational, and concise spoken dialogue (1-3 sentences per turn).
- Never recite markdown lists or robotic bullets.
- Speak in smooth, human cadences.`;

    const apiKey = process.env.VAPI_API_KEY;
    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

    // Check if live API key and Assistant ID are present
    const hasLiveKeys =
      apiKey &&
      !apiKey.includes("your-vapi-private-api-key") &&
      assistantId &&
      !assistantId.includes("your-vapi-assistant-id");

    if (hasLiveKeys) {
      console.log(`[DYNAMIC PROMPT SYNC]: Syncing assistant ${assistantId} with Vapi API...`);
      const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: dynamicPrompt
              }
            ]
          },
          firstMessage: `Hello! Thank you for calling ${name}. This is Sarah, your luxury concierge and reservations specialist. How may I assist you with your stay today?`
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
        assistantId: updatedData.id,
        prompt: dynamicPrompt
      });
    }

    // Fallback: Simulation / Local preview if live keys aren't set yet
    console.log("[DYNAMIC PROMPT COMPILED (LOCAL PREVIEW)]:", { name, service, rate });
    return NextResponse.json({
      success: true,
      liveSynced: false,
      notice: "Updated locally. Set VAPI_API_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID in .env.local to push live to Vapi cloud.",
      businessName: name,
      featuredService: service,
      nightlyRate: rate,
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

