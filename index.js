const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

let qrCodeGlobal = '';
let isConnected = false;

// Servidor Web para exibir o QR Code no Render
app.get('/', (req, res) => {
    if (isConnected) {
        return res.send('<h1>Bot conectado com sucesso no WhatsApp! 🎉</h1>');
    }
    if (!qrCodeGlobal) {
        return res.send('<h1>A gerar o QR Code, aguarda alguns segundos e atualiza a página...</h1>');
    }
    
    qrcode.toDataURL(qrCodeGlobal, (err, src) => {
        if (err) return res.send('Erro ao gerar o QR Code.');
        res.send(`
            <div style="text-align: center; margin-top: 50px; font-family: Arial;">
                <h2>Escaneia este QR Code com o teu WhatsApp:</h2>
                <img src="${src}" alt="QR Code WhatsApp" style="width: 300px; height: 300px;" />
                <p>Atualiza a página se o código expirar.</p>
            </div>
        `);
    });
});

app.listen(port, () => {
    console.log(`Servidor web rodando na porta ${port}`);
});

// Conexão com o WhatsApp e Gestão de Comandos
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeGlobal = qr;
            isConnected = false;
            console.log('Novo QR Code gerado! Consulta o link do Render.');
        }

        if (connection === 'open') {
            isConnected = true;
            qrCodeGlobal = '';
            console.log('Bot conectado com sucesso!');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Ouvinte de mensagens e comandos
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const messageContent = msg.message.conversation || 
                               msg.message.extendedTextMessage?.text || 
                               msg.message.imageMessage?.caption || 
                               msg.message.videoMessage?.caption;
        
        const remoteJid = msg.key.remoteJid;
        if (!messageContent) return;
        
        const text = messageContent.trim().toLowerCase();

        if (text === '!comandos') {
            await sock.sendMessage(remoteJid, { 
                text: '🤖 *Menu de Comandos do Bot*:\n\n' +
                      '🖼️ `!fnormal` - Transforma imagem em figurinha normal\n' +
                      '🎬 `!fanimada` - Transforma vídeo/GIF em figurinha animada\n' +
                      '🎵 `!faudio` - Cria uma figurinha com áudio\n' +
                      '📋 `!comandos` - Mostra esta lista de comandos' 
            });
        } 
        else if (text.startsWith('!fnormal')) {
            await sock.sendMessage(remoteJid, { text: '🖼️ Para usar o !fnormal, envia uma imagem com a legenda !fnormal!' });
        } 
        else if (text.startsWith('!fanimada')) {
            await sock.sendMessage(remoteJid, { text: '🎬 Para usar o !fanimada, envia um vídeo curto ou GIF com a legenda !fanimada!' });
        } 
        else if (text.startsWith('!faudio')) {
            await sock.sendMessage(remoteJid, { text: '🎵 Para usar o !faudio, responde a um áudio com o comando !faudio!' });
        }
    });
}

connectToWhatsApp();
