import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
    console.log("[VAPI WEBHOOK RECEIVED]:", JSON.stringify(body, null, 2));

    const message = body?.message || body;

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

    // 2. Handle Post-Call Event for WhatsApp Trigger
    if (message?.type === "end-of-call-report") {
      const customerPhone =
        message.call?.customer?.number ||
        message.customer?.number ||
        process.env.DEMO_WHATSAPP_RECIPIENT;
      console.log("📞 Call ended for customer:", customerPhone || "(Browser Call)");
      console.log("📝 Call Summary:", message.summary || "No summary");

      if (customerPhone) {
        await sendWhatsAppCheckoutLink(customerPhone);
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

async function sendWhatsAppCheckoutLink(phone: string) {
  const whatsappToken = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!whatsappToken || !phoneNumberId) {
    console.log("⚠️ WhatsApp credentials missing. Skipping WhatsApp trigger.");
    return;
  }

  const formattedPhone = phone.replace("+", "").trim();
  const checkoutUrl = `https://checkout.nexvolabs.site/pay?booking_id=demo_${Date.now()}`;

  const payload = {
    messaging_product: "whatsapp",
    to: formattedPhone,
    type: "text",
    text: {
      body: `Thank you for calling Grand Hotel Galle! 🌴\n\nTo lock in your reservation for the Deluxe Ocean Suite ($180/night), please tap the secure deposit link below:\n\n👉 ${checkoutUrl}\n\nNeed assistance? Reply directly to this message.`,
    },
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (res.ok) {
      console.log("✅ WhatsApp post-call deposit link sent successfully!");
    } else {
      console.error("❌ Failed to send WhatsApp message:", data);
    }
  } catch (err: any) {
    console.error("❌ WhatsApp network error:", err.message);
  }
}
