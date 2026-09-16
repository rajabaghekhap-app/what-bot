const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');

const pino = require('pino');

// ⚠️ APNA WOH PHONE NUMBER DALEIN JISSE BOT CHALANA HAI (Bina '+' ya spaces ke)
const MY_BOT_NUMBER = '919931655821'; 
const TARGET_NUMBER = '919931005943';

async function connectToWhatsApp() {

    // Railway Volume memory path setup
    const { state, saveCreds } = await useMultiFileAuthState('/app/auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome') // Server par mandatory line
    });

    // Credentials automatically save honge jab code link ho jayega
    sock.ev.on('creds.update', saveCreds);

    // =========================================
    // 🔑 OTP / PAIRING CODE LOGIC (SIRF 1 BAAR CHALEGA)
    // =========================================
    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                // Number verification ke liye check krein
                let cleanNumber = MY_BOT_NUMBER.replace(/[^0-9]/g, '');
                let code = await sock.requestPairingCode(cleanNumber);
                
                console.log('\n==================================================');
                console.log(`🔑 APNA LINKING CODE (OTP) YAHAN HAI: ${code}`);
                console.log('==================================================\n');
            } catch (err) {
                console.log('❌ Pairing code generation error:', err.message);
            }
        }, 5000); // WebSocket loading ke liye 5 seconds ka safe delay
    }

    const sentByBot = new Set();

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('✅ WhatsApp successfully connected!');
            console.log('🤖 Auto reply active ho chuka hai.');
            console.log('🎯 Target Phone Number:', TARGET_NUMBER);
        }

        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                console.log('🔄 Server disconnected. Reconnecting...');
                setTimeout(() => { connectToWhatsApp(); }, 3000);
            } else {
                console.log('❌ WhatsApp session logged out. GitHub par jake code fir se restart krein.');
            }
        }
    });

    // =========================================
    // INCOMING MESSAGES LOGIC
    // =========================================
    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            for (const msg of messages) {
                if (!msg?.message) continue;
                const jid = msg.key.remoteJid;
                if (!jid || jid === 'status@broadcast' || jid.endsWith('@g.us')) continue;

                if (sentByBot.has(msg.key.id)) {
                    sentByBot.delete(msg.key.id);
                    continue;
                }

                let phoneNumber = null;
                if (jid.endsWith('@s.whatsapp.net')) {
                    phoneNumber = jid.split('@')[0];
                } else if (jid.endsWith('@lid')) {
                    try {
                        const lid = jidNormalizedUser(jid);
                        const resolved = await sock.signalRepository?.lidMapping?.getPNForLID(lid);
                        if (resolved) phoneNumber = resolved.split('@')[0];
                    } catch (e) { continue; }
                }

                let isTarget = (phoneNumber === TARGET_NUMBER);
                let isSelf = false;

                if (sock.user?.id) {
                    const myNumber = sock.user.id.split(':')[0];
                    if (phoneNumber === myNumber) isSelf = true;
                }

                if (!(isTarget || isSelf || msg.key.fromMe)) continue;

                const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                if (!text.trim()) continue;

                const command = text.trim().toLowerCase();
                let reply = 'Message received 👍';

                if (command === 'hi' || command === 'hii' || command === 'hello') {
                    reply = 'Hello bro 👋';
                } else if (command === 'help') {
                    reply = `🤖 Available commands:\n\nhi\nhello\nhelp\nresult`;
                } else if (command === 'result') {
                    reply = '📚 Apna Student ID bhejo.';
                }

                const sent = await sock.sendMessage(jid, { text: reply });
                if (sent?.key?.id) {
                    sentByBot.add(sent.key.id);
                    setTimeout(() => { sentByBot.delete(sent.key.id); }, 30000);
                }
            }
        } catch (error) {
            console.log('❌ Auto reply handling error:', error);
        }
    });
}

console.log('🚀 Starting bot with Pairing Code mode...');
connectToWhatsApp();
