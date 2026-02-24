const axios = require("axios");

function fallbackReply(message = "", route = "", userType = "") {
  const q = (message || "").toLowerCase();
  const routeText = route || "current page";
  const roleText = userType || "portal user";

  if (q.includes("profile")) {
    return "Go to Profile from the left sidebar to complete or update your details.";
  }
  if (q.includes("media")) {
    return "Use Media Management from the sidebar to configure rates, terms, and WhatsApp promotion details.";
  }
  if (q.includes("report")) {
    return "Open the Report section in the sidebar to access payment, performance, payout and log reports.";
  }
  if (q.includes("wallet") || q.includes("payment")) {
    return "Use Wallet for balance/history and Payments for transaction flows based on your role.";
  }
  if (q.includes("navigation") || q.includes("not found") || q.includes("where")) {
    return `You are currently on ${routeText}. If navigation looks broken, refresh once and verify your menu permissions for ${roleText}.`;
  }
  return "I can help with navigation, profile, media management, campaigns, reports, wallet and payments. Please ask your question in one sentence.";
}

exports.chatbotQuery = async (req, res) => {
  try {
    const message = (req.body?.message || "").toString().trim();
    const context = req.body?.context || {};
    const route = (context?.route || "").toString();
    const userType = (context?.user_type || "").toString();

    if (!message) {
      return res.status(400).json({
        status: 400,
        message: "message is required",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
    const phaseEnabled = (process.env.CHATBOT_PHASE1_ENABLED || "true")
      .toString()
      .toLowerCase();

    if (phaseEnabled !== "true" || !apiKey) {
      return res.status(200).json({
        status: 200,
        source: "fallback",
        reply: fallbackReply(message, route, userType),
      });
    }

    const systemPrompt = [
      "You are Adz10x portal support assistant.",
      "Answer only about portal navigation, profile completion, media management, campaigns, reports, users, wallet, and payments.",
      "Keep answers concise, practical, and action-oriented.",
      "If asked something outside portal help, politely redirect to support contact.",
      "Do not invent routes. Use route context when useful.",
    ].join(" ");

    const userPrompt = [
      `User type: ${userType || "unknown"}`,
      `Current route: ${route || "unknown"}`,
      `User question: ${message}`,
    ].join("\n");

    const llmResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 12000,
      }
    );

    const reply =
      llmResponse?.data?.choices?.[0]?.message?.content?.toString().trim() ||
      fallbackReply(message, route, userType);

    return res.status(200).json({
      status: 200,
      source: "llm",
      reply,
    });
  } catch (error) {
    return res.status(200).json({
      status: 200,
      source: "fallback",
      reply: fallbackReply(
        req.body?.message,
        req.body?.context?.route,
        req.body?.context?.user_type
      ),
      info: "LLM unavailable, returned fallback response",
    });
  }
};

