import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";

import express from "express";
import pino from "pino";
import cron from "node-cron";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const WA_NUMBER = process.env.WA_NUMBER;

let sock;
let settings = {
  autoReply: false,
  target: "",
  reply: ""
};

async function startWhatsApp() {
  const { state, saveCreds } =
    await useMultiFileAuthState("./auth");

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (
      connection === "connecting" &&
      !state.creds.registered &&
      WA_NUMBER
    ) {
      try {
        const code = await sock.requestPairingCode(WA_NUMBER);
        console.log("================================");
        console.log("PAIRING CODE:", code);
        console.log("================================");
      } catch (err) {
        console.error("Pairing error:", err);
      }
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected");
    }

    if (connection === "close") {
      console.log("❌ WhatsApp disconnected");

      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode !== DisconnectReason.loggedOut) {
        setTimeout(startWhatsApp, 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg?.message) return;
    if (msg.key.fromMe) return;

    const jid = msg.key.remoteJid;

    if (
      settings.autoReply &&
      settings.target &&
      jid === settings.target &&
      settings.reply
    ) {
      await sock.sendMessage(jid, {
        text: settings.reply
      });
    }
  });
}

/* Dashboard API */

app.get("/api/status", (req, res) => {
  res.json({
    connected: !!sock,
    settings
  });
});

app.post("/api/auto-reply", (req, res) => {
  settings.autoReply = Boolean(req.body.enabled);
  settings.target = req.body.target || "";
  settings.reply = req.body.reply || "";

  res.json({
    ok: true,
    settings
  });
});

/* Manual individual message */

app.post("/api/send", async (req, res) => {
  try {
    const { number, message } = req.body;

    if (!number || !message) {
      return res.status(400).json({
        error: "number and message required"
      });
    }

    await sock.sendMessage(`${number}@s.whatsapp.net`, {
      text: message
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "send failed" });
  }
});

/* Scheduled message */

app.post("/api/schedule", async (req, res) => {
  const { number, message, time } = req.body;

  if (!number || !message || !time) {
    return res.status(400).json({
      error: "number, message and time required"
    });
  }

  const [hour, minute] = time.split(":");

  cron.schedule(`${minute} ${hour} * * *`, async () => {
    try {
      await sock.sendMessage(`${number}@s.whatsapp.net`, {
        text: message
      });

      console.log(
        `Scheduled message sent to ${number} at ${time}`
      );
    } catch (err) {
      console.error("Scheduled message failed:", err);
    }
  }, {
    timezone: "Asia/Kolkata"
  });

  res.json({
    ok: true,
    message: `Scheduled for ${time}`
  });
});

app.get("/", (req, res) => {
  res.send("WhatsApp Bot Server Running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

startWhatsApp();