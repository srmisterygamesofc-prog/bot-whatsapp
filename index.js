const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

let qrCodeGlobal = '';
let isConnected = false;

// Página web para mostrar o QR Code de forma limpa no navegador
app.get('/', (req, res) => {
    if (isConnected) {
        return res.send('<h1>Bot conectado com sucesso no WhatsApp! 🎉</h1>');
    }
    if (!qrCodeGlobal) {
        return res.send('<h1>A gerar o QR Code, aguarda alguns segundos e atualiza a página...</h1>');
    }
    
    // Gera a imagem do QR Code direto na página web
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

// Conexão com o WhatsApp
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeGlobal = qr;
            console.log('Novo QR Code gerado! Abre o link do teu site no Render para o ver.');
        }

        if (connection === 'open') {
            isConnected = true;
            console.log('Bot conectado com sucesso!');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

connectToWhatsApp();
