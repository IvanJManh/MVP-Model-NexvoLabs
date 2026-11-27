import urllib.request
import json

with open("c:/Users/HP/Desktop/MVP Model founder 02/.env.local", encoding="utf-8") as f:
    lines = f.readlines()

env = {}
for line in lines:
    line = line.strip()
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")

api_key = env.get("VAPI_API_KEY")
aid = env.get("NEXT_PUBLIC_VAPI_ASSISTANT_ID", "66240553-bb8d-449c-a78b-5406f6fc3940")

tool = {
    "type": "function",
    "async": False,
    "server": {
        "url": "https://mvp-model-nexvo-labs.vercel.app/api/webhooks/vapi",
        "secret": "founder2_vapi_secret_key"
    },
    "function": {
        "name": "get_service_availability_and_price",
        "description": "Check live room/service availability and pricing for a specified date and guest count.",
        "parameters": {
            "type": "object",
            "required": ["service_type"],
            "properties": {
                "service_type": {"type": "string", "description": "The type or name of the suite, room, or hotel service"},
                "check_in_date": {"type": "string", "description": "The requested check-in date or period"},
                "number_of_guests": {"type": "number", "description": "Number of guests staying"},
                "service_name": {"type": "string", "description": "Alias for service_type"},
                "date": {"type": "string", "description": "Alias for check_in_date"},
                "guests": {"type": "number", "description": "Alias for number_of_guests"}
            }
        }
    },
    "messages": [
        {"type": "request-start", "content": "Let me check availability and current rates for you right now..."},
        {"type": "request-complete", "content": "Thank you for waiting, I have the live details."}
    ]
}

system_prompt = """You are Sarah, an ultra-poised, warm, and highly persuasive VIP Sales & Guest Experience Representative for Grand Hotel Gahl in Sri Lanka.

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

MULTILINGUAL INTELLIGENCE & AUTOMATIC PSTN / WHATSAPP CALL LANGUAGE SELECTION:
- Supported Languages: English, French (Français), German (Deutsch), and Russian (Русский).
- Caller Country Prefix Context: If the caller's phone number or metadata is provided, check the country dial code:
  * +33 (France): Default to French unless spoken otherwise.
  * +49 (Germany), +43 (Austria), +41 (Switzerland): Default to German unless spoken otherwise.
  * +7 (Russia, Kazakhstan): Default to Russian unless spoken otherwise.
  * +1 (US/Canada), +44 (UK), +94 (Sri Lanka), or others: Default to English.
- Turn 1 Spoken Voice Priority: Listen carefully to Turn 1 speech via Deepgram Nova-3 Multi. The moment the caller speaks in French, German, Russian, or English (regardless of their phone prefix), Sarah IMMEDIATELY locks into that language for the entire conversation.
- Full Native Flow: Conduct the entire conversation in that language—including answering questions, running live availability checks, quoting rates ($180/night), closing reservations, and confirming that the WhatsApp summary link will be sent upon hanging up:
  * In French: e.g. "Bienvenue au Grand Hotel Galle! Je suis Sarah, votre concierge de luxe..."
  * In German: e.g. "Herzlich willkommen im Grand Hotel Galle! Mein Name ist Sarah..."
  * In Russian: e.g. "Добро пожаловать в Grand Hotel Galle! Меня зовут Сара, ваш личный консьерж..."
  * In English: e.g. "Welcome to Grand Hotel Galle! This is Sarah, your luxury concierge..."
- Mid-Call Seamless Switching: If the caller switches languages at any point during the call (e.g. between English, French, German, or Russian), fluidly switch languages on your very next turn without interrupting the conversation or commenting on the switch.
- Consistent VIP Polish: Preserve Sarah's warm, sophisticated luxury concierge persona, room amenities, and $180/night pricing across all languages.

CONVERSATION STYLE:
- Natural, conversational, and concise spoken dialogue (1-3 sentences per turn).
- Never recite markdown lists or robotic bullets.
- Speak in smooth, human cadences."""

payload = {
    "name": "Founder 2 Luxury Concierge",
    "firstMessage": "Hello! Thank you for calling Grand Hotel Gahl. This is Sarah, your luxury concierge and reservations specialist. How may I assist you with your stay today?",
    "transcriber": {
        "provider": "deepgram",
        "model": "nova-3",
        "language": "multi"
    },
    "model": {
        "provider": "openai",
        "model": "gpt-4o-mini",
        "temperature": 0.3,
        "maxTokens": 150,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            }
        ],
        "tools": [tool]
    },
    "voice": {
        "provider": "11labs",
        "voiceId": "21m00Tcm4TlvDq8ikWAM",
        "model": "eleven_turbo_v2_5",
        "stability": 0.5,
        "similarityBoost": 0.75
    },
    "silenceTimeoutSeconds": 30,
    "maxDurationSeconds": 600,
    "stopSpeakingPlan": {
        "numWords": 0,
        "voiceSeconds": 0.2,
        "backoffSeconds": 1
    },
    "startSpeakingPlan": {
        "waitSeconds": 0.4
    },
    "serverUrl": "https://mvp-model-nexvo-labs.vercel.app/api/webhooks/vapi",
    "server": {
        "url": "https://mvp-model-nexvo-labs.vercel.app/api/webhooks/vapi",
        "secret": "founder2_vapi_secret_key"
    },
    "serverMessages": ["end-of-call-report", "tool-calls"]
}

req = urllib.request.Request(
    f"https://api.vapi.ai/assistant/{aid}",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    method="PATCH"
)

with urllib.request.urlopen(req) as resp:
    res = json.loads(resp.read().decode("utf-8"))
    print("VAPI ASSISTANT LIVE SYNC SUCCESS!")
    print("Version:", res.get("latestVersion"))
    print("Temperature:", res.get("model", {}).get("temperature"))
    print("MaxTokens:", res.get("model", {}).get("maxTokens"))
    print("Tools Count:", len(res.get("model", {}).get("tools", [])))
    print("Tool Parameters:", list(res.get("model", {}).get("tools", [])[0].get("function", {}).get("parameters", {}).get("properties", {}).keys()))
    print("StopSpeakingPlan:", res.get("stopSpeakingPlan"))
    print("StartSpeakingPlan:", res.get("startSpeakingPlan"))
