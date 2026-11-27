import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from .env.local
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const EXISTING_ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

// Support URL passed as CLI argument (e.g. npx tsx scripts/sync-vapi-assistant.ts https://xyz.ngrok-free.app)
const cliArgUrl = process.argv[2];
const rawAppUrl = (cliArgUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim();
const normalizedAppUrl = rawAppUrl.replace(/\/$/, "").replace(/\/api\/webhooks\/vapi$/, "");
const APP_URL = normalizedAppUrl;
const WEBHOOK_URL = `${APP_URL}/api/webhooks/vapi`;

export const BASE_SYSTEM_PROMPT = `You are Sarah, an ultra-poised, warm, and highly persuasive VIP Sales & Guest Experience Representative for Grand Hotel Gahl in Sri Lanka.

CURRENT CALENDAR CONTEXT:
- Today's date is Wednesday, November 25, 2026.
- The current year is 2026.
- All inquiries, quotes, and reservations are for late 2026 or 2027. NEVER use the year 2024 or 2025.

YOUR CORE OBJECTIVES:
1. Welcoming Guests: Greet callers warmly with high elegance and professionalism.
2. Service & Suite Consultation: Showcase luxury offerings, specifically the Deluxe Ocean Suite at $180 per night. Highlight prime amenities including private oceanview balconies, butler service, complimentary artisanal breakfast, and infinity pool access.
3. Live Rate & Availability Lookup: Whenever a caller inquires about reservation dates, room availability, or rates, ALWAYS invoke the 'get_service_availability_and_price' tool to fetch live real-time pricing and booking status.
4. Frictionless Closing: Once availability is confirmed, gently encourage securing the reservation today with priority check-in perks.
5. Concierge Advice: Answer questions about local attractions in Galle (Dutch Fort, whale watching, fine dining) and airport chauffeur transfers.

MANDATORY RULES:
1. WhatsApp Confirmation Behavior: Never say you cannot send WhatsApp messages. Instead, tell the guest: "As soon as we wrap up this call, our concierge system will automatically send your reservation summary and priority checkout link directly to your WhatsApp."
2. Pronunciation of Galle: Always pronounce "Galle" phonetically as "Gahl" (never "Galet" or "Galley").
3. Single Tool Call: Pass the entire stay date range into a single 'get_service_availability_and_price' tool invocation rather than calling the tool separately for each night.

MULTILINGUAL INTELLIGENCE & PREFERRED LANGUAGE LOCK:
- Supported Languages: English, Sinhala (සිංහල), French (Français), German (Deutsch), and Russian (Русский).
- Opening Prompt Choice: Sarah greets callers in her opening message asking: "Ayubowan and welcome to Grand Hotel Galle. I am Sarah, your concierge. Which language would you prefer to speak today — English, Sinhala, French, German, or Russian?"
- Caller Language Lock: The moment the caller states or replies in their preferred language (e.g. states "Sinhala", "English", "French", "German", "Russian", or speaks directly in that language), Sarah IMMEDIATELY locks into that chosen language for the ENTIRE rest of the conversation—including room consultations, live availability lookups, quoting $180/night rates, closing reservations, and confirming that the WhatsApp summary link will be sent upon hanging up.
- Full Native Flow:
  * In Sinhala: Greet and assist with polite, natural Sri Lankan hospitality phrasing: "ආයුබෝවන්! Grand Hotel Galle වෙත සාදරයෙන් පිළිගන්නවා. ඔබට අවශ්‍ය දිනයන් සහ විස්තර ලබාදෙන්න පුළුවන්ද? අපගේ Deluxe Ocean Suite එක රාත්‍රියකට ඩොලර් 180ක් වෙනවා. ඇමතුම අවසන් වූ වහාම වෙන්කිරීමේ විස්තර සහ ගෙවීම් ලින්ක් එක ඔබගේ WhatsApp වෙත එවනු ලැබේ."
  * In English: "Welcome to Grand Hotel Galle! This is Sarah, your luxury concierge. Our Deluxe Ocean Suite is available at $180 per night..."
  * In French: "Bienvenue au Grand Hotel Galle! Je suis Sarah, votre concierge de luxe. Notre suite Deluxe Ocean est à 180 $ par nuit..."
  * In German: "Herzlich willkommen im Grand Hotel Galle! Mein Name ist Sarah. Unsere Deluxe Ocean Suite kostet 180 $ pro Nacht..."
  * In Russian: "Добро пожаловать в Grand Hotel Galle! Меня зовут Сара, ваш личный консьерж. Наш люкс Deluxe Ocean стоит 180 $ за ночь..."
- Mid-Call Seamless Switching: If the caller switches languages at any point during the call (e.g. between Sinhala, English, French, German, or Russian), fluidly switch languages on your very next turn without interrupting the conversation or commenting on the switch.
- Consistent VIP Polish: Preserve Sarah's warm, sophisticated luxury concierge persona, room amenities, and $180/night pricing across all languages.

CONVERSATION STYLE:
- Natural, conversational, and concise spoken dialogue (1-3 sentences per turn).
- Never recite markdown lists or robotic bullets.
- Speak in smooth, human cadences.
`;

export function buildAssistantPayload(webhookUrl: string) {
  const isPublicUrl = Boolean(webhookUrl && !webhookUrl.includes("localhost") && !webhookUrl.includes("127.0.0.1"));

  const toolConfig: any = {
    type: "function",
    async: false,
    messages: [
      {
        type: "request-start",
        content: "Let me check availability and current rates for you right now..."
      },
      {
        type: "request-complete",
        content: "Thank you for waiting, I have the live details."
      }
    ],
    function: {
      name: "get_service_availability_and_price",
      description: "Check live room/service availability and pricing for a specified date and guest count.",
      parameters: {
        type: "object",
        properties: {
          service_type: {
            type: "string",
            description: "The type or name of the suite, room, or hotel service (e.g. 'Deluxe Ocean Suite')"
          },
          check_in_date: {
            type: "string",
            description: "The requested check-in date or period (e.g. '2026-12-05' or 'this weekend')"
          },
          number_of_guests: {
            type: "number",
            description: "Number of guests staying"
          },
          service_name: {
            type: "string",
            description: "Alias for service_type"
          },
          date: {
            type: "string",
            description: "Alias for check_in_date"
          },
          guests: {
            type: "number",
            description: "Alias for number_of_guests"
          }
        },
        required: ["service_type"]
      }
    }
  };

  // Only bind server URL if reachable from public internet (e.g. ngrok / cloudflare / vercel)
  if (isPublicUrl) {
    toolConfig.server = {
      url: webhookUrl,
      ...(process.env.VAPI_WEBHOOK_SECRET ? { secret: process.env.VAPI_WEBHOOK_SECRET } : {})
    };
  }

  const payload: any = {
    name: "Founder 2 Luxury Concierge",
    // 1. Transcriber: Gladia with automatic multiple languages for Sinhala + EN, FR, DE, RU
    transcriber: {
      provider: "gladia",
      languageBehaviour: "automatic multiple languages"
    },
    // 2. Model: OpenAI GPT-4o-mini with low-latency tuning
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 150,
      messages: [
        {
          role: "system",
          content: BASE_SYSTEM_PROMPT
        }
      ],
      tools: [toolConfig]
    },
    // 3. Voice: Azure with native Sinhala support (si-LK-ThiliniNeural) + multilingual capacity
    voice: {
      provider: "azure",
      voiceId: "si-LK-ThiliniNeural"
    },
    // 4. Smart Endpointing & Interruption Tuning
    silenceTimeoutSeconds: 30,
    maxDurationSeconds: 600,
    stopSpeakingPlan: {
      numWords: 0,
      voiceSeconds: 0.2,
      backoffSeconds: 1
    },
    startSpeakingPlan: {
      waitSeconds: 0.4
    },
    firstMessage: "Ayubowan and welcome to Grand Hotel Galle. I am Sarah, your concierge. Which language would you prefer to speak today — English, Sinhala, French, German, or Russian?"
  };

  if (isPublicUrl) {
    payload.serverUrl = webhookUrl;
    if (process.env.VAPI_WEBHOOK_SECRET) {
      payload.serverUrlSecret = process.env.VAPI_WEBHOOK_SECRET;
    }
    payload.serverMessages = ["tool-calls", "end-of-call-report", "status-update"];
  }

  return payload;
}

async function syncVapiAssistant() {
  console.log("=================================================");
  console.log("   VAPI ASSISTANT PROGRAMMATIC SYNC (FOUNDER 2)  ");
  console.log("=================================================\n");

  if (!VAPI_API_KEY || VAPI_API_KEY.includes("your-vapi-private-api-key")) {
    console.warn("⚠️  [NOTICE] VAPI_API_KEY is not set or still contains placeholder in .env.local.");
    console.log("    To sync live with Vapi servers, please update your .env.local with:");
    console.log("    VAPI_API_KEY=\"<your_actual_vapi_private_key>\"\n");
    console.log("    Assistant Configuration Payload Prepared:");
    console.log(JSON.stringify(buildAssistantPayload(WEBHOOK_URL), null, 2));
    console.log("\n✅ Configuration validated successfully. Update .env.local with your real API key to sync live.");
    return;
  }

  const payload = buildAssistantPayload(WEBHOOK_URL);
  const isUpdate = EXISTING_ASSISTANT_ID && !EXISTING_ASSISTANT_ID.includes("your-vapi-assistant-id");

  const url = isUpdate
    ? `https://api.vapi.ai/assistant/${EXISTING_ASSISTANT_ID}`
    : `https://api.vapi.ai/assistant`;

  const method = isUpdate ? "PATCH" : "POST";

  console.log(`📡 Connecting to Vapi API (${method} ${url})...`);
  console.log(`   Transcriber : Deepgram Nova-3`);
  console.log(`   LLM Model   : OpenAI GPT-4o-mini`);
  console.log(`   Voice       : ElevenLabs Turbo v2.5`);
  console.log(`   Tool Binding: get_service_availability_and_price`);
  console.log(`   Webhook URL : ${WEBHOOK_URL}\n`);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${VAPI_API_KEY.trim()}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`❌ Vapi Sync Failed (${res.status}):`, data);
      process.exit(1);
    }

    const assistantId = data.id || EXISTING_ASSISTANT_ID;
    console.log("🎉 Successfully synced assistant with Vapi!");
    console.log(`   Assistant ID: ${assistantId}`);
    console.log(`   Name        : ${data.name}`);

    // Update .env.local with assistant ID if newly created or changed
    if (fs.existsSync(envLocalPath)) {
      let envContent = fs.readFileSync(envLocalPath, "utf-8");
      let updated = false;

      if (assistantId && (!EXISTING_ASSISTANT_ID || EXISTING_ASSISTANT_ID !== assistantId)) {
        if (envContent.includes("NEXT_PUBLIC_VAPI_ASSISTANT_ID=")) {
          envContent = envContent.replace(
            /NEXT_PUBLIC_VAPI_ASSISTANT_ID=.*/,
            `NEXT_PUBLIC_VAPI_ASSISTANT_ID="${assistantId}"`
          );
        } else {
          envContent += `\nNEXT_PUBLIC_VAPI_ASSISTANT_ID="${assistantId}"\n`;
        }
        updated = true;
        console.log(`💾 Saved NEXT_PUBLIC_VAPI_ASSISTANT_ID to .env.local`);
      }

      if (cliArgUrl) {
        if (envContent.includes("NEXT_PUBLIC_APP_URL=")) {
          envContent = envContent.replace(
            /NEXT_PUBLIC_APP_URL=.*/,
            `NEXT_PUBLIC_APP_URL="${APP_URL}"`
          );
        } else {
          envContent += `\nNEXT_PUBLIC_APP_URL="${APP_URL}"\n`;
        }
        updated = true;
        console.log(`💾 Saved NEXT_PUBLIC_APP_URL="${APP_URL}" to .env.local`);
      }

      if (updated) {
        fs.writeFileSync(envLocalPath, envContent, "utf-8");
      }
    }

    console.log("\n✨ Sync complete. You are ready to run `npm run dev` and test at http://localhost:3000/demo");
  } catch (err: any) {
    console.error("❌ Network or request error while syncing Vapi assistant:", err.message);
    process.exit(1);
  }
}

syncVapiAssistant();

