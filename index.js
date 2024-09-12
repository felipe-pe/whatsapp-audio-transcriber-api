const { create } = require('@wppconnect-team/wppconnect');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const sqlite3 = require('better-sqlite3');

// Configurações de servidor e pastas
const SERVER_UPLOAD_URL = 'http://127.0.0.1:5502/upload';
const SERVER_TRANSCRIPTION_URL = 'http://127.0.0.1:5502/transcriptions';
const UPLOAD_DIR = path.join(__dirname, 'audios');

// Banco de dados SQLite para fila de transcrições
const db = new sqlite3('transcriptions.db');

// Criar tabela para a fila de processamento de áudios
db.prepare(`
    CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT,
        user_id TEXT,
        message_id TEXT,
        request_id TEXT,
        status TEXT DEFAULT 'pending'
    )
`).run();

// Inicializando pasta de uploads
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Variável para controlar a trava de processamento
let isProcessing = false;

// Função para enviar o áudio ao servidor Flask para transcrição
async function sendAudioToServer(filePath, userId, requestId, model = 'large-v2', beamSize = 5, chunkLength = 30) {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('user_id', userId);
    formData.append('request_id', requestId);
    formData.append('model', model);
    formData.append('beam_size', beamSize);
    formData.append('chunk_length', chunkLength);

    try {
        const response = await axios.post(SERVER_UPLOAD_URL, formData, {
            headers: formData.getHeaders(),
        });
        return response.data;
    } catch (error) {
        console.error('Erro na transcrição:', error.message);
        throw error;
    }
}

// Função para buscar e extrair o conteúdo do HTML gerado pelo servidor Flask
async function fetchAndExtractHTML(userId, requestId) {
    const htmlUrl = `${SERVER_TRANSCRIPTION_URL}/${userId}/${requestId}/${requestId}.html`;

    try {
        const response = await axios.get(htmlUrl);
        const htmlContent = response.data;

        // Extrai o conteúdo do <body> do HTML
        const matches = htmlContent.match(/<body[^>]*>((.|[\n\r])*)<\/body>/im);
        const bodyContent = matches ? matches[1] : '';
        
        // Remove todas as tags HTML e formata como um parágrafo único
        const paragraph = bodyContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        return paragraph;
    } catch (error) {
        console.error('Erro ao buscar ou extrair texto do HTML:', error.message);
        return null;
    }
}

// Função para adicionar áudios à fila de processamento
function addAudioToQueue(filePath, userId, messageId, requestId) {
    const insert = db.prepare(`
        INSERT INTO queue (file_path, user_id, message_id, request_id, status)
        VALUES (?, ?, ?, ?, 'pending')
    `);
    insert.run(filePath, userId, messageId, requestId);
}

// Função para processar a fila de áudios
async function processQueue(client) {
    if (isProcessing) return; // Se já estiver processando, sai da função
    isProcessing = true;

    try {
        // Verificar se há áudios pendentes
        const row = db.prepare(`SELECT * FROM queue WHERE status = 'pending' ORDER BY id LIMIT 1`).get();
        if (!row) {
            isProcessing = false;
            return; // Não há áudios na fila
        }

        // Atualizar status para "processing"
        db.prepare(`UPDATE queue SET status = 'processing' WHERE id = ?`).run(row.id);

        try {
            // Envia o áudio para o servidor Flask
            const response = await sendAudioToServer(row.file_path, row.user_id, row.request_id);
            console.log('Transcrição enviada:', response);

            // Busca o HTML gerado e extrai o texto
            const extractedText = await fetchAndExtractHTML(row.user_id, row.request_id);
            if (extractedText) {
                // Enviar a transcrição como resposta à mensagem original
                await client.reply(row.user_id + '@c.us', `Segue a transcrição do áudio:\n\n${extractedText}`, row.message_id);
                console.log(`Transcrição enviada para ${row.user_id}`);
            } else {
                console.error('Não foi possível extrair o texto do HTML.');
            }
        } catch (error) {
            console.error('Erro ao processar o áudio:', error.message);
            await client.reply(row.user_id + '@c.us', `Ocorreu um erro ao processar o áudio: ${error.message}`, row.message_id);
        } finally {
            // Atualizar status para "completed"
            db.prepare(`UPDATE queue SET status = 'completed' WHERE id = ?`).run(row.id);
            fs.unlinkSync(row.file_path);  // Remove o arquivo de áudio
            isProcessing = false;
            processQueue(client);  // Processar o próximo da fila
        }
    } catch (error) {
        console.error('Erro ao processar a fila:', error.message);
        isProcessing = false;
    }
}

// Inicializa o cliente WPPConnect
create({
    session: 'audioTranscriptionSession',
    puppeteerOptions: {
        headless: true,
        executablePath: path.resolve(__dirname, 'node_modules/@puppeteer/browsers/chrome/win64-116.0.5793.0/chrome-win64/chrome.exe'),
        args: ['--no-sandbox'],
        protocolTimeout: 3600000
    },
    autoClose: 3600000,
}).then(client => {
    client.onMessage(async message => {
        if (message.type === 'audio' || message.type === 'ptt') {
            const number = message.from;
            const userId = number.split('@')[0];
            const requestId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const messageId = message.id;

            const audioData = await client.decryptFile(message);
            const audioPath = path.join(UPLOAD_DIR, `${requestId}.wav`);

            fs.writeFileSync(audioPath, audioData);
            console.log(`Áudio salvo no caminho: ${audioPath}`);

            // Adiciona o áudio à fila
            addAudioToQueue(audioPath, userId, messageId, requestId);

            // Processa a fila
            processQueue(client);
        } else {
            console.log('Mensagem recebida não é de áudio.');
        }
    });
}).catch(error => {
    console.error('Erro ao iniciar WPPConnect:', error.message);
});
