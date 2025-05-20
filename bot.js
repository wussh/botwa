const qrcode = require('qrcode-terminal');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const axios = require('axios');

async function startBot() {
  // Load or create auth state in the "auth" folder
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false   // we’ll handle QR printing ourselves
  });

  // Save credentials whenever they refresh
  sock.ev.on('creds.update', saveCreds);

  // Single connection.update handler
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Show QR code if provided
    if (qr) {
      console.log('Please scan the QR code below with your WhatsApp mobile app:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      // Attempt reconnect unless logged out
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('Connection closed, reconnecting...');
        startBot();
      } else {
        console.log('You are logged out. Delete auth folder to re-login.');
      }
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
    }
  });

  // Message listener
  sock.ev.on('messages.upsert', async (msgUpsert) => {
    const msg = msgUpsert.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    try {
      const apiRes = await axios.post('https://ai.wush.site/v1/chat/completions', {
        model: "unsloth/Llama-3.2-3B-Instruct-unsloth-bnb-4bit",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: text }
        ],
        temperature: 0.7,
        max_tokens: 256,
        stream: false
      }, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer dummy"
        }
      });

      const reply = apiRes.data.choices[0].message.content;
      await sock.sendMessage(sender, { text: reply });
    } catch (err) {
      console.error('❌ API error:', err.message);
      await sock.sendMessage(sender, { text: "⚠️ Sorry, something went wrong with the AI API." });
    }
  });
}

startBot();
