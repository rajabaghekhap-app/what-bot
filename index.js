import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    delay
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Advanced WhatsApp Bot is active!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

const phoneNumber = process.env.PHONE_NUMBER || "YOUR_BOT_PHONE_NUMBER_HERE"; 

// ================= ADVANCED AUTO-REPLY CONFIGURATION =================
const ADVANCED_REPLIES = [
    {
        keywords: ['hi', 'hello', 'hey', 'hello raja'],
        reply: "Hello! Welcome to Raja's automation service. How can I help you today?"
    },
    {
        keywords: ['price', 'cost', 'rate', 'fees'],
        reply: "Our premium services start from just ₹499. Let me know your requirement!"
    },
    {
        keywords: ['help', 'support', 'contact'],
        reply: "You can raise a support ticket or drop your query right here. I'll pass it to my boss!"
    },
    {
        keywords: ['owner', 'raja', 'admin'],
        reply: "Raja is currently busy managing things. I am his official automated assistant."
    }
];
// ======================================================================

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version: version,
        printQRInTerminal: false,
        logger: undefined
    });

    if (!sock.authState.creds.registered) {
        if (!phoneNumber || phoneNumber === "YOUR_BOT_PHONE_NUMBER_HERE") {
            console.error("❌ ERROR: Please provide a valid phone number!");
            process.exit(1);
        }

        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n======================================`);
                console.log(`🔑 WHATSAPP PAIRING CODE: ${code}`);
                console.log(`======================================\n`);
            } catch (error) {
                console.error("Failed to request pairing code:", error);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('✅ Advanced WhatsApp connection opened successfully!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        
        // Advanced Layer 1: Ignore Group Chats (Optional, remove this if you want it in groups)
        if (remoteJid.endsWith('@g.us')) return; 

        // Extract Text Cleanly
        const incomingText = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim().toLowerCase();
        if (!incomingText) return;

        // Advanced Layer 2: Auto Read & Send Blue Tick
        await sock.readMessages([msg.key]);

        // Advanced Layer 3: Intent matching system
        let finalResponse = "";
        let matched = false;

        for (const rule of ADVANCED_REPLIES) {
            if (rule.keywords.some(keyword => incomingText.includes(keyword))) {
                finalResponse = rule.reply;
                matched = true;
                break;
            }
        }

        // Smart Catch-All: User ne kuch alag message bheja toh standard reply code
        if (!matched) {
            finalResponse = `I received your message: "${incomingText}"`;
        }

        // Always append the user signature as requested
        finalResponse = `${finalResponse} -raja`;

        // Advanced Layer 4: Simulate human behavior (Show "typing..." status for 2 seconds)
        await sock.sendPresenceUpdate('composing', remoteJid);
        await delay(2000); // 2-second realistic delay
        await sock.sendPresenceUpdate('paused', remoteJid);

        // Send Finalized Smart Reply
        await sock.sendMessage(remoteJid, { text: finalResponse }, { quoted: msg });
    });
}

connectToWhatsApp();
