const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

let qrCodeGlobal = '';
let isConnected = false;

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

// 1. Converter imagem em Sticker Normal (Estático)
function convertImageToSticker(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', inputPath,
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
            '-vcodec', 'libwebp',
            '-lossless', '1',
            '-q:v', '60',
            '-preset', 'default',
            '-an',
            '-vsync', '0',
            outputPath
        ]);

        ffmpeg.on('close', (code) => {
            if (code === 0) resolve(outputPath);
            else reject(new Error(`FFmpeg encerrou com código ${code}`));
        });
    });
}

// 2. Converter vídeo em Sticker Animado (SEM SOM)
function convertVideoToSticker(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', inputPath,
            '-t', '6',
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=15',
            '-vcodec', 'libwebp',
            '-loop', '0',
            '-preset', 'default',
            '-an',
            '-vsync', '0',
            outputPath
        ]);

        ffmpeg.on('close', (code) => {
            if (code === 0) resolve(outputPath);
            else reject(new Error(`FFmpeg animado encerrou com código ${code}`));
        });
    });
}

// 3. Converter vídeo em Figurinha Animada COM SOM (!faudio)
function convertVideoWithAudioToSticker(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', inputPath,
            '-t', '7',
            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000,fps=15',
            '-vcodec', 'libwebp',
            '-loop', '0',
            '-preset', 'default',
            '-c:a', 'aac',    // Mantém o áudio do vídeo
            '-b:a', '128k',   // Qualidade do som
            '-vsync', '0',
            outputPath
        ]);

        ffmpeg.on('close', (code) => {
            if (code === 0) resolve(outputPath);
            else reject(new Error(`FFmpeg com som encerrou com código ${code}`));
        });
    });
}

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
            console.log('Novo QR Code gerado!');
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

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const quotedMessage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        const hasQuoted = !!quotedMessage;

        const messageType = Object.keys(msg.message)[0];
        const caption = msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const text = caption.trim().toLowerCase();

        // Menu de Comandos
        if (text === '!comandos') {
            await sock.sendMessage(remoteJid, { 
                text: '🤖 *Menu de Comandos*:\n\n' +
                      '🖼️ `!fnormal` - Imagem para figurinha normal\n' +
                      '🎬 `!fanimada` - Vídeo para figurinha animada (sem som)\n' +
                      '🎵 `!faudio` - Vídeo para figurinha animada *com som*\n' +
                      '📋 `!comandos` - Mostra esta lista' 
            });
            return;
        }

        // !fnormal (Imagem)
        if ((messageType === 'imageMessage' && text.includes('!fnormal')) || (hasQuoted && quotedMessage.imageMessage && text.includes('!fnormal'))) {
            try {
                await sock.sendMessage(remoteJid, { text: '🔄 A criar figurinha normal...' });
                const targetMsg = (messageType === 'imageMessage') ? msg : { message: quotedMessage };
                const stream = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: console });
                const inputPath = path.join(__dirname, `input_${Date.now()}.jpg`);
                const outputPath = path.join(__dirname, `output_${Date.now()}.webp`);

                fs.writeFileSync(inputPath, stream);
                await convertImageToSticker(inputPath, outputPath);

                await sock.sendMessage(remoteJid, { sticker: fs.readFileSync(outputPath) });

                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (error) {
                console.error('Erro:', error);
                await sock.sendMessage(remoteJid, { text: '❌ Erro ao criar figurinha.' });
            }
        }

        // !fanimada (Vídeo animado sem som)
        else if ((messageType === 'videoMessage' && text.includes('!fanimada')) || (hasQuoted && quotedMessage.videoMessage && text.includes('!fanimada'))) {
            try {
                await sock.sendMessage(remoteJid, { text: '🔄 A criar figurinha animada...' });
                const targetMsg = (messageType === 'videoMessage') ? msg : { message: quotedMessage };
                const stream = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: console });
                const inputPath = path.join(__dirname, `input_${Date.now()}.mp4`);
                const outputPath = path.join(__dirname, `output_${Date.now()}.webp`);

                fs.writeFileSync(inputPath, stream);
                await convertVideoToSticker(inputPath, outputPath);

                await sock.sendMessage(remoteJid, { sticker: fs.readFileSync(outputPath) });

                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (error) {
                console.error('Erro:', error);
                await sock.sendMessage(remoteJid, { text: '❌ Erro ao criar figurinha animada.' });
            }
        }

        // !faudio (Vídeo animado COM SOM)
        else if ((messageType === 'videoMessage' && text.includes('!faudio')) || (hasQuoted && quotedMessage.videoMessage && text.includes('!faudio'))) {
            try {
                await sock.sendMessage(remoteJid, { text: '🔄 A criar figurinha com som...' });
                const targetMsg = (messageType === 'videoMessage') ? msg : { message: quotedMessage };
                const stream = await downloadMediaMessage(targetMsg, 'buffer', {}, { logger: console });
                const inputPath = path.join(__dirname, `input_${Date.now()}.mp4`);
                const outputPath = path.join(__dirname, `output_${Date.now()}.webp`);

                fs.writeFileSync(inputPath, stream);
                await convertVideoWithAudioToSticker(inputPath, outputPath);

                await sock.sendMessage(remoteJid, { sticker: fs.readFileSync(outputPath) });

                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            } catch (error) {
                console.error('Erro:', error);
                await sock.sendMessage(remoteJid, { text: '❌ Erro ao criar figurinha com som.' });
            }
        }
    });
}

connectToWhatsApp();
