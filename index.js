sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption;
    const remoteJid = msg.key.remoteJid;

    if (!messageContent) return;
    const text = messageContent.trim().toLowerCase();

    if (text === '!comandos') {
        await sock.sendMessage(remoteJid, { 
            text: '🤖 *Menu de Comandos do Bot*:\n\n' +
                  '🖼️ `!fnormal` - Transforma uma imagem em figurinha normal\n' +
                  '🎬 `!fanimada` - Transforma um vídeo/GIF em figurinha animada\n' +
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
