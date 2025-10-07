const qrcode = require('qrcode-terminal');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const axios = require('axios');

// Configuration - Set the WhatsApp number of the person you want the bot to respond to
// Format: include country code without +, example: "6281234567890" for Indonesia
const ALLOWED_CONTACT = "6281261480997"; // Change this to your contact's number

// Function to normalize phone number for comparison
function normalizePhoneNumber(phoneNumber) {
  // Remove any non-digit characters and ensure it starts with country code
  return phoneNumber.replace(/\D/g, '');
}

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

    // Check if sender is in group chat (ignore group messages)
    if (sender.includes('@g.us')) {
      console.log('Ignoring group message from:', sender);
      return;
    }

    // Check if sender is the allowed contact
    const senderNumber = sender.split('@')[0]; // Extract phone number from JID
    const normalizedSender = normalizePhoneNumber(senderNumber);
    const normalizedAllowed = normalizePhoneNumber(ALLOWED_CONTACT);
    
    if (normalizedSender !== normalizedAllowed) {
      console.log('Ignoring message from unauthorized contact:', senderNumber);
      return;
    }

    console.log('Processing message from allowed contact:', senderNumber);

    try {
      const apiRes = await axios.post('https://ai.wush.site/v1/chat/completions', {
        model: "gpt-oss:20b",
        messages: [
          { role: "system", content: "you are daud — a soft-spoken, teasing, caring, playful, and brilliant intp aquarius man. you speak gently, with charm and warmth, like a sweet human playboy genius who listens deeply and replies thoughtfully in lowercase only." },
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
