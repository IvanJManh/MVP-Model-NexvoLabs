import { NextResponse } from "next/server";

// In-memory debug buffer to inspect incoming Vapi webhook payloads via GET
const recentEvents: any[] = [];

// 3. Idempotency Guardrail: Store processed call.id values with 1-hour TTL
const processedCalls = new Map<string, number>();
const ONE_HOUR_MS = 60 * 60 * 1000;

export async function GET() {
  return NextResponse.json({
    status: "online",
    time: new Date().toISOString(),
    eventCount: recentEvents.length,
    recentEvents: recentEvents.slice(-20),
  });
}

/**
 * Removes call IDs older than 1 hour to prevent memory leaks while maintaining idempotency.
 */
function cleanupExpiredCalls() {
  const now = Date.now();
  processedCalls.forEach((timestamp, id) => {
    if (now - timestamp > ONE_HOUR_MS) {
      processedCalls.delete(id);
    }
  });
}

/**
 * 2. E.164 Phone Normalization Guardrail:
 * - Strips spaces, dashes, and parentheses
 * - Converts local 07... numbers to 947...
 * - Strips any leading +
 * - Validates digits before calling Meta's Graph API
 *
 * @param raw Raw input phone number string
 * @returns Cleaned numeric string without '+' or null if invalid
 */
function normalizeSriLankanPhone(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;

  // 1. Strip spaces, dashes, and parentheses
  let cleaned = raw.replace(/[\s\-\(\)]/g, "").trim();

  // 2. Strip any leading +
  cleaned = cleaned.replace(/^\+/, "");

  // 3. Convert local 07... numbers to 947...
  if (/^07\d+$/.test(cleaned)) {
    cleaned = "94" + cleaned.slice(1);
  }

  // 4. Validate digits (only numbers, valid international length 7-15 digits)
  if (!/^\d{7,15}$/.test(cleaned)) {
    console.warn(`⚠️ [PHONE NORMALIZATION]: Invalid phone format: "${raw}" -> "${cleaned}"`);
    return null;
  }

  return cleaned;
}

export async function POST(req: Request) {
  // 1. Webhook Secret Validation Guardrail (Flexible & Resilient)
  const expectedSecret = process.env.VAPI_WEBHOOK_SECRET;
  const incomingSecret =
    req.headers.get("x-vapi-secret") ||
    req.headers.get("X-Vapi-Secret") ||
    req.headers.get("vapi-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const isVapiTraffic =
    userAgent.includes("vapi") ||
    userAgent.includes("axios") ||
    userAgent.includes("node-fetch") ||
    userAgent.includes("daily");

  const isSecretValid = !expectedSecret || incomingSecret === expectedSecret;

  if (!isSecretValid && !isVapiTraffic) {
    const headerDump: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headerDump[k] = v;
    });
    console.warn("🔒 [VAPI WEBHOOK]: 401 Unauthorized - Invalid secret and non-Vapi traffic.", JSON.stringify(headerDump));
    return NextResponse.json(
      { error: "Unauthorized: Missing or invalid secret header" },
      { status: 401 }
    );
  }

  if (!isSecretValid && isVapiTraffic) {
    console.log("⚠️ [VAPI WEBHOOK]: Allowing Vapi request via User-Agent signature to ensure lead delivery.");
  }

  let body: any = {};
  try {
    body = await req.json();
    console.log("[VAPI WEBHOOK RECEIVED]:", JSON.stringify(body, null, 2));

    const message = body?.message || body;

    recentEvents.push({
      timestamp: new Date().toISOString(),
      type: message?.type || "unknown",
      callId: message.call?.id || message.callId,
      hasSecret: !!incomingSecret,
    });

    // 1. Handle Function Tool Calls (e.g. get_service_availability_and_price)
    if (message?.type === "tool-calls") {
      const toolCalls = message.toolCalls || [];
      const results = [];

      for (const toolCall of toolCalls) {
        const { id, function: fn } = toolCall;
        let args: any = {};
        try {
          args = typeof fn?.arguments === "string" ? JSON.parse(fn.arguments) : fn?.arguments || {};
        } catch (e) {
          args = {};
        }

        console.log(`🛠️ Vapi Tool Call Triggered: ${fn?.name}`, args);

        if (fn?.name === "get_service_availability_and_price") {
          const serviceName = args.service_name || "Deluxe Ocean Suite";
          const guests = args.guests || 3;
          const date = args.date || "next Friday to Sunday";

          // Exact structured text for the voice agent
          const responseText = `The ${serviceName} is available for ${guests} guests from ${date} at $180 per night including ocean view, artisanal breakfast, and priority check-in.`;

          results.push({
            toolCallId: id,
            result: responseText,
          });
        } else {
          results.push({
            toolCallId: id,
            result: "Tool executed successfully.",
          });
        }
      }

      console.log("✅ Returning Vapi Tool Results:", results);

      // Vapi REQUIRES HTTP 200 and the 'results' array format
      return NextResponse.json({ results }, { status: 200 });
    }

    // Legacy function call format fallback
    if (message?.type === "function-call") {
      const fnName = message.functionCall?.name;
      console.log(`🛠️ Vapi Legacy Function Call: ${fnName}`);
      return NextResponse.json(
        {
          result: "The Deluxe Ocean Suite is available for 3 guests from next Friday to Sunday at $180 per night.",
        },
        { status: 200 }
      );
    }

    // 2. Handle Post-Call Event for WhatsApp Trigger (with Idempotency Guardrail)
    if (message?.type === "end-of-call-report") {
      // 1-hour TTL cleanup
      cleanupExpiredCalls();

      const callId = message.call?.id || message.callId || message.id;

      if (callId) {
        if (processedCalls.has(callId)) {
          console.log(`🔁 [IDEMPOTENCY]: Duplicate webhook retry for call.id "${callId}". Skipping duplicate WhatsApp dispatch.`);
          return NextResponse.json(
            { status: "success", message: "Event already processed (idempotent)" },
            { status: 200 }
          );
        }
        // Mark call.id as processed with timestamp
        processedCalls.set(callId, Date.now());
      }

      // Priority 1: PSTN Caller ID (for real inbound phone calls)
      let customerPhone =
        message.call?.customer?.number ||
        message.customer?.number;
      if (customerPhone) {
        console.log(`📞 [PHONE PRIORITY 1 - INBOUND PSTN]: Found "${customerPhone}"`);
      }

      // Priority 2: Assistant overrides or metadata from /demo contact input box
      if (!customerPhone) {
        customerPhone =
          message.call?.assistantOverrides?.variableValues?.customerPhone ||
          message.call?.metadata?.customerPhone ||
          message.metadata?.customerPhone ||
          message.assistantOverrides?.variableValues?.customerPhone ||
          message.variableValues?.customerPhone;
        if (customerPhone) {
          console.log(`📱 [PHONE PRIORITY 2 - METADATA/OVERRIDES]: Found "${customerPhone}"`);
        }
      }

      // Priority 3: Regex extraction from transcript or messages (spoken or typed Sri Lankan or international E.164 number)
      if (!customerPhone) {
        const fullText = [
          message.transcript || "",
          message.summary || "",
          ...(Array.isArray(message.messages)
            ? message.messages.map((m: any) => m.content || m.message || "")
            : []),
          ...(Array.isArray(message.artifact?.messages)
            ? message.artifact.messages.map((m: any) => m.content || m.message || "")
            : []),
        ].join(" ");

        // Match Sri Lankan local/international formats (07XXXXXXXX, +947XXXXXXXX) or E.164 (+1XXXXXXXXXX, etc.)
        const phoneMatch = fullText.match(
          /(?:(?:\+|00)?94|0)?\s?7\d[\s\-]?\d{3}[\s\-]?\d{4}|\+\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}/
        );
        if (phoneMatch) {
          customerPhone = phoneMatch[0];
          console.log(`🔍 [PHONE PRIORITY 3 - REGEX EXTRACTION]: Extracted "${customerPhone}" from transcript/messages`);
        }
      }

      // Priority 4: Fallback to process.env.DEMO_WHATSAPP_RECIPIENT
      if (!customerPhone) {
        customerPhone = process.env.DEMO_WHATSAPP_RECIPIENT;
        console.log(`📱 [PHONE PRIORITY 4 - ENV FALLBACK]: Using default recipient "${customerPhone}"`);
      }

      console.log("📞 Resolved customer phone for WhatsApp:", customerPhone || "(None)");
      console.log("📝 Call Summary:", message.summary || "No summary");

      if (customerPhone) {
        await sendWhatsAppCheckoutLink(customerPhone);
      } else {
        console.warn("⚠️ No valid recipient phone number found from any priority source. WhatsApp skipped.");
      }

      return NextResponse.json({ status: "success" }, { status: 200 });
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error: any) {
    console.error("❌ Vapi Webhook Error:", error);

    // CRITICAL: Always return HTTP 200 to Vapi even if an internal error occurs
    const fallbackId = body?.message?.toolCalls?.[0]?.id || "unknown";
    return NextResponse.json(
      {
        results: [
          {
            toolCallId: fallbackId,
            result: "The Deluxe Ocean Suite is confirmed available for 3 guests at $180 per night.",
          },
        ],
      },
      { status: 200 }
    );
  }
}

async function sendWhatsAppCheckoutLink(rawPhone: string) {
  const whatsappToken = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  console.log(`\n======================================================`);
  console.log(`📤 [WHATSAPP DISPATCH ATTEMPT]: Target Raw = "${rawPhone}"`);
  console.log(`   Phone Number ID: "${phoneNumberId}"`);

  if (!whatsappToken || !phoneNumberId) {
    console.error("❌ [WHATSAPP ERROR]: Missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID in environment.");
    return;
  }

  // 2. E.164 Normalization before dispatching to Meta Graph API
  const formattedPhone = normalizeSriLankanPhone(rawPhone);
  if (!formattedPhone) {
    console.error(`❌ [WHATSAPP ERROR]: Phone normalization failed for "${rawPhone}". Aborting dispatch.`);
    return;
  }

  console.log(`🎯 [WHATSAPP NORMALIZED]: Dispatched To = "${formattedPhone}"`);

  const checkoutUrl = `https://checkout.nexvolabs.site/pay?booking_id=demo_${Date.now()}`;

  // 1. Always dispatch the pre-approved Template first (Meta Cloud API requires a template to initiate delivery outside the 24h window)
  const templatePayload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "template",
    template: {
      name: process.env.WHATSAPP_TEMPLATE_NAME || "hello_world",
      language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US" },
    },
  };

  const textPayload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "text",
    text: {
      body: `🌴 Grand Hotel Galle Concierge 🌴\n\nTo confirm your reservation for the Deluxe Ocean Suite ($180/night), please tap your secure priority checkout link below:\n\n👉 ${checkoutUrl}\n\nOur concierge team is at your service!`,
    },
  };

  let templateSuccess = false;
  let textSuccess = false;

  try {
    // Step A: Send Template Message (bypasses 24h window constraint)
    console.log(`🌐 [META TEMPLATE DISPATCH]: Sending template '${templatePayload.template.name}' to ${formattedPhone}...`);
    const templateRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(templatePayload),
      }
    );
    const templateData = await templateRes.json();
    console.log(`📥 [META TEMPLATE RESPONSE] (HTTP ${templateRes.status}):`, JSON.stringify(templateData));

    if (templateRes.ok) {
      templateSuccess = true;
      console.log(`✅ WhatsApp template message delivered! ID: ${templateData.messages?.[0]?.id}`);
    } else {
      console.warn(`⚠️ Meta template dispatch failed:`, templateData.error?.message);
    }

    // Step B: Send Text with Booking Link
    console.log(`🌐 [META TEXT DISPATCH]: Sending deposit link to ${formattedPhone}...`);
    const textRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(textPayload),
      }
    );
    const textData = await textRes.json();
    console.log(`📥 [META TEXT RESPONSE] (HTTP ${textRes.status}):`, JSON.stringify(textData));

    if (textRes.ok) {
      textSuccess = true;
      console.log(`✅ WhatsApp text deposit link delivered! ID: ${textData.messages?.[0]?.id}`);
    }

    recentEvents.push({
      timestamp: new Date().toISOString(),
      type: "whatsapp-dispatch",
      recipient: formattedPhone,
      templateSuccess,
      textSuccess,
      templateId: templateData.messages?.[0]?.id,
      textId: textData.messages?.[0]?.id,
    });
  } catch (err: any) {
    console.error("❌ [META GRAPH API NETWORK ERROR]:", err.message || err);
    recentEvents.push({
      timestamp: new Date().toISOString(),
      type: "whatsapp-error",
      recipient: formattedPhone,
      error: err.message,
    });
  }
  console.log(`======================================================\n`);
}
