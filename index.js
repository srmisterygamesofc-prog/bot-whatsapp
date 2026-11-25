const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Bot conectado com sucesso!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        
        const chatId = m.key.remoteJid;
        const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
        
        if (!text.startsWith('!')) return;
        const command = text.split(' ')[0].toLowerCase();

        if (command === '!comandos') {
            await sock.sendMessage(chatId, { 
                text: '🤖 *Comandos do Bot:*\n\n• `!fnormal` - Figurinhas normais\n• `!fanimada` - Figurinhas animadas\n• `!faudio` - Áudio para figurinha\n• `!comandos` - Lista de comandos' 
            });
        }
    });
}

connectToWhatsApp();
