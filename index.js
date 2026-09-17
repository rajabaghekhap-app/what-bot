const { default: makeWASocket, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');

// Render/Cloud पर बोट को एक्टिव रखने के लिए Web Server
const app = express();
const PORT = process.env.PORT || 8080;
app.get('/', (req, res) => res.send('WhatsApp Bot is Online!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function startBot() {
    // क्रेडेंशियल्स स्टोर करने के लिए फोल्डर
    const { state, saveCreds } = await useMultiFileAuthState('auth_session');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: Browsers.macOS('Chrome'),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'close') {
            console.log('🔌 कनेक्शन बंद हुआ। दोबारा प्रयास कर रहे हैं...');
            startBot();
        } else if (connection === 'open') {
            console.log('✅ बोट सफलतापूर्वक लाइव हो चुका है!');
        }
    });

    // 🚀 मैसेज रिसीव और ऑटो-रिप्लाई लॉजिक
    sock.ev.on('messages.upsert', async (m) => {
        for (const msg of m.messages) {
            
            // 🛡️ लूप-प्रूफ फिल्टर्स
            if (!msg.message) continue; 
            if (msg.key.fromMe) continue; 
            if (msg.key.id.startsWith('BAE5') || msg.key.id.startsWith('3EB0')) continue; 

            const fromNumber = msg.key.remoteJid; 
            
            // मैसेजेस से टेक्स्ट निकालना
            const incomingText = 
                msg.message.conversation || 
                msg.message.extendedTextMessage?.text || 
                "";

            if (incomingText) {
                // टेक्स्ट को साफ़ करें (लोअरकेस और बिना फालतू स्पेस के)
                const cleanText = incomingText.trim().toLowerCase();

                // 👑 1. आपका ओरिजिनल "-raja" लॉजिक (यह किसी भी मैसेज के अंत में काम करेगा)
                if (cleanText.endsWith('-raja')) {
                    const replyMessage = "जी राजा जी! बताइए मैं आपकी क्या सेवा कर सकता हूँ? 👑";
                    await sock.sendMessage(fromNumber, { text: replyMessage }, { quoted: msg });
                    continue; // अगले मैसेज पर जाएँ
                }

                // ℹ️ 2. हेल्प कमांड (सारे कीवर्ड्स की लिस्ट भेजने के लिए)
                if (cleanText === 'help' || cleanText === 'बोट' || cleanText === 'menu') {
                    const helpMenu = `🤖 *नमस्ते! मैं आपका ऑटो-रिप्लाई बोट हूँ।* \n\n` +
                                     `यहाँ मेरे सभी एक्टिव *कीवर्ड्स (Keywords)* की लिस्ट है, जिन्हें आप चैट में भेज सकते हैं:\n\n` +
                                     `🔹 *[कोई भी मैसेज] -raja* - राजा जी वाला स्पेशल रिप्लाई\n` +
                                     `🔹 *hi* / *hello* - बोट से ग्रीटिंग्स पाएँ\n` +
                                     `🔹 *ping* - बोट की एक्टिविटी और स्पीड चेक करें\n` +
                                     `🔹 *gm* / *good morning* - सुबह की विश\n` +
                                     `🔹 *gn* / *good night* - रात की विश\n` +
                                     `🔹 *kaise ho* - बोट का हाल-चाल पूछें\n` +
                                     `🔹 *shayari* - एक शानदार मोटिवेशनल शायरी सुनें\n` +
                                     `🔹 *owner* - बोट के असली मालिक की जानकारी\n` +
                                     `🔹 *bye* - बोट को अलविदा कहें\n\n` +
                                     `💡 _नोट: बोट को कमांड्स भेजने के लिए ऊपर दिए गए शब्दों को ठीक वैसे ही टाइप करें!_`;
                    
                    await sock.sendMessage(fromNumber, { text: helpMenu }, { quoted: msg });
                }

                // 🤖 3. सामान्य कीवर्ड्स (Hi/Hello)
                else if (cleanText === 'hi' || cleanText === 'hello') {
                    await sock.sendMessage(fromNumber, { text: "नमस्ते! स्वागत है आपका। मुझे आपकी सेवा में तैनात किया गया है! 🤖✨" }, { quoted: msg });
                }

                // 🏓 4. पिंग टेस्ट
                else if (cleanText === 'ping') {
                    await sock.sendMessage(fromNumber, { text: "🏓 Pong! बोट सुपर फ़ास्ट स्पीड से एक्टिव है।" }, { quoted: msg });
                }

                // 🌅 5. गुड मॉर्निंग
                else if (cleanText === 'gm' || cleanText === 'good morning') {
                    await sock.sendMessage(fromNumber, { text: "सुप्रभात! आपका आज का दिन मंगलमय और खुशियों से भरा हो। ☀️🌸" }, { quoted: msg });
                }

                // 🌃 6. गुड नाइट
                else if (cleanText === 'gn' || cleanText === 'good night') {
                    await sock.sendMessage(fromNumber, { text: "शुभ रात्रि! मीठे सपनों के साथ आराम कीजिए। 🌙😴" }, { quoted: msg });
                }

                // 💬 7. कैसे हो?
                else if (cleanText === 'kaise ho' || cleanText === 'how are you') {
                    await sock.sendMessage(fromNumber, { text: "मैं तो एक डिजिटल बोट हूँ, हमेशा एकदम फर्स्ट क्लास! आप बताइए, आप कैसे हैं? 😇" }, { quoted: msg });
                }

                // 📜 8. शायरी कमांड
                else if (cleanText === 'shayari' || cleanText === 'शायरी') {
                    const shayariList = [
                        "सफ़र में धूप तो होगी जो चल सको तो चलो,\nसभी हैं भीड़ में तुम भी निकल सको तो चलो! 💫",
                        "मंजिलें उन्हीं को मिलती हैं जिनके सपनों में जान होती है,\nपंखों से कुछ नहीं होता हौसलों से उड़ान होती है! 🚀",
                        "खोकर पाने का मज़ा ही कुछ और है,\nरोकर मुस्कुराने का मज़ा ही कुछ और है! ✨"
                    ];
                    // रैंडम शायरी चुनना
                    const randomShayari = shayariList[Math.floor(Math.random() * shayariList.length)];
                    await sock.sendMessage(fromNumber, { text: randomShayari }, { quoted: msg });
                }

                // 👑 9. ओनर इन्फो
                else if (cleanText === 'owner' || cleanText === 'मालिक') {
                    await sock.sendMessage(fromNumber, { text: "😎 इस बोट के सम्मानीय ओनर (Owner) आप खुद हैं, राजा जी!" }, { quoted: msg });
                }

                // 👋 10. बाय (Bye)
                else if (cleanText === 'bye' || cleanText === 'अल्विदा') {
                    await sock.sendMessage(fromNumber, { text: "बाय-बाय! अपना ख्याल रखिएगा। फिर मिलेंगे! 👋😊" }, { quoted: msg });
                }
            }
        }
    });
}

// बोट चालू करें
startBot();
