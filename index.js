const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');
const pino = require('pino');

const TARGET_NUMBER = '919931005943';

async function connectToWhatsApp() {

    const { state, saveCreds } =
        await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    // Bot ke apne bheje messages ke IDs
    const sentByBot = new Set();

    sock.ev.on('connection.update', (update) => {

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('Scan QR:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {

            console.log('✅ WhatsApp connected');
            console.log('🤖 Auto reply ON');
            console.log('🎯 Target:', TARGET_NUMBER);

            if (sock.user) {
                console.log('👤 My WhatsApp ID:', sock.user.id);
            }
        }

        if (connection === 'close') {

            const code =
                lastDisconnect?.error?.output?.statusCode;

            if (code !== DisconnectReason.loggedOut) {

                console.log('🔄 Reconnecting...');

                setTimeout(() => {
                    connectToWhatsApp();
                }, 3000);

            } else {

                console.log('❌ WhatsApp logged out');
            }
        }
    });


    // =========================================
    // INCOMING MESSAGES
    // =========================================

    sock.ev.on('messages.upsert', async ({ messages }) => {

        try {

            for (const msg of messages) {

                if (!msg?.message) continue;

                const jid = msg.key.remoteJid;

                if (!jid) continue;

                // Status ignore
                if (jid === 'status@broadcast') continue;

                // Group ignore
                if (jid.endsWith('@g.us')) continue;


                // =========================================
                // BOT KE APNE SENT MESSAGE KO IGNORE
                // =========================================

                if (sentByBot.has(msg.key.id)) {

                    sentByBot.delete(msg.key.id);

                    console.log('🤖 Own reply ignored');

                    continue;
                }


                // =========================================
                // NUMBER RESOLVE
                // =========================================

                let phoneNumber = null;

                if (jid.endsWith('@s.whatsapp.net')) {

                    phoneNumber =
                        jid
                            .split('@')[0]
                            .split(':')[0];

                } else if (jid.endsWith('@lid')) {

                    try {

                        const lid =
                            jidNormalizedUser(jid);

                        const resolved =
                            await sock.signalRepository
                                ?.lidMapping
                                ?.getPNForLID(lid);

                        console.log(
                            '🔎 LID mapping:',
                            resolved
                        );

                        if (resolved) {

                            phoneNumber =
                                resolved
                                    .split('@')[0]
                                    .split(':')[0];
                        }

                    } catch (error) {

                        console.log(
                            '❌ LID error:',
                            error.message
                        );

                        continue;
                    }
                }


                console.log('\n📩 JID:', jid);
                console.log(
                    '📱 Number:',
                    phoneNumber
                );


                // =========================================
                // TARGET NUMBER OR SELF NUMBER
                // =========================================

                let isTarget = false;
                let isSelf = false;

                // Target
                if (phoneNumber === TARGET_NUMBER) {
                    isTarget = true;
                }


                // My own WhatsApp number
                if (sock.user?.id) {

                    const myNumber =
                        sock.user.id
                            .split(':')[0]
                            .split('@')[0];

                    if (phoneNumber === myNumber) {
                        isSelf = true;
                    }
                }


                // Self-chat mein fromMe true ho sakta hai,
                // isliye usko allow karna hai.
                if (isTarget || isSelf || msg.key.fromMe) {

                    console.log(
                        isSelf
                            ? '👤 Self-chat allowed'
                            : '🎯 Target allowed'
                    );

                } else {

                    console.log('⛔ Not allowed');

                    continue;
                }


                // =========================================
                // TEXT
                // =========================================

                const text =
                    msg.message.conversation ||
                    msg.message.extendedTextMessage?.text ||
                    '';

                if (!text.trim()) continue;

                console.log('💬 Message:', text);


                const command =
                    text.trim().toLowerCase();


                // =========================================
                // REPLY
                // =========================================

                let reply;

                if (
                    command === 'hi' ||
                    command === 'hii' ||
                    command === 'hello'
                ) {

                    reply = 'Hello bro 👋';

                } else if (command === 'help') {

                    reply =
`🤖 Available commands:

hi
hello
help
result`;

                } else if (command === 'result') {

                    reply =
                        '📚 Apna Student ID bhejo.';

                } else {

                    reply =
                        'Message received 👍';
                }


                // =========================================
                // SEND
                // =========================================

                const sent = await sock.sendMessage(jid, {
                    text: reply
                });

                // Bot ke sent message ko remember karo
                if (sent?.key?.id) {

                    sentByBot.add(sent.key.id);

                    // Memory ko unnecessarily bada na hone do
                    setTimeout(() => {
                        sentByBot.delete(sent.key.id);
                    }, 30000);
                }

                console.log('✅ Reply sent');
            }

        } catch (error) {

            console.log(
                '❌ Auto reply error:',
                error
            );
        }
    });
}

console.log('🚀 Starting bot...');

connectToWhatsApp();