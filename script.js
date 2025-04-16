  // Configuration
const configuracoesAcesso = (function() {
    const partes = [
        "AIzaSyAk", 
        "-Hn7Ew2G2", 
        "fF8wxZOG0",
        "ryCPs_CV2",
        "14Fk"
    ];
    return partes.join('');
})();

const MODEL_NAME = "gemini-2.0-flash";

// DOM Elements
const chatOutput = document.getElementById('chat-output');
const textInput = document.getElementById('text-input');
const sendButton = document.getElementById('send-button');
const clearButton = document.getElementById('clear-button');
const saveButton = document.getElementById('save-button');
const quickRepliesContainer = document.getElementById('quick-replies');

// Chat state
let chatHistory = JSON.parse(localStorage.getItem('gdchat_history')) || [];
let lastMessageTime = 0;

// Scroll control variables
let userScrolledUp = false;
let lastScrollPosition = 0;

// Quick replies
const quickReplies = [
    "Corrigir textos ortograficamente:", 
    "Em que você pode me ajudar?", 
    
    
];

// Smart scroll function
function smartScroll(forceScroll = false) {
    const chat = chatOutput;
    const isNearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 100;
    
    if (forceScroll || !userScrolledUp || isNearBottom) {
        chat.scrollTop = chat.scrollHeight;
        userScrolledUp = false;
    }
}

// Initialize the chat with welcome message or history
function initChat() {
    // Clear the chat output
    chatOutput.innerHTML = '';
    
    // Add welcome messages only if chat is empty
    if (chatHistory.length === 1) {
        addSystemMessage("=== Bem-vindo ao GDCHAT ===");
        addSystemMessage("Comandos especiais:");
        addSystemMessage("- 'sair', 'fim' ou 'exit' para encerrar");
        addSystemMessage("- Use 'Limpar' para reiniciar a conversa");
        addSystemMessage("- 'Salvar' guarda o histórico no arquivo");
        addSystemMessage("- Digite /ajuda para ver comandos extras");
    } else {
        // Rebuild chat from history
        chatHistory.forEach(msg => {
            if (msg.role === 'system') {
                addSystemMessage(msg.content);
            } else {
                addMessage(msg.role, msg.content);
            }
        });
    }
    
    // Add quick replies
    quickReplies.forEach(reply => {
        const btn = document.createElement('button');
        btn.textContent = reply;
        btn.addEventListener('click', () => {
            textInput.value = reply;
            textInput.focus();
        });
        quickRepliesContainer.appendChild(btn);
    });

    // Scroll event listener
    chatOutput.addEventListener('scroll', () => {
        const currentScroll = chatOutput.scrollTop;
        
        if (currentScroll < lastScrollPosition && 
            currentScroll < chatOutput.scrollHeight - chatOutput.clientHeight - 200) {
            userScrolledUp = true;
        }
        
        lastScrollPosition = currentScroll;
    });
}

// Add a message to the chat output
function addMessage(role, content, isTyping = false) {
    const messageDiv = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    
    if (isTyping) {
        messageDiv.className = 'typing-indicator';
        messageDiv.id = 'typing-indicator';
    } else if (role === 'system') {
        messageDiv.className = 'system-message';
    } else {
        messageDiv.className = role === 'user' ? 'user-message' : 'bot-message';
    }
    
    const rolePrefix = role === 'user' ? '👤 Você' : '🤖 GDCHAT';
    const displayContent = role === 'system' ? content : `${rolePrefix}: ${content}`;
    
    messageDiv.innerHTML = displayContent;
    
    if (!isTyping && role !== 'system') {
        const timeSpan = document.createElement('div');
        timeSpan.className = 'timestamp';
        timeSpan.textContent = timestamp;
        messageDiv.appendChild(timeSpan);
    }
    
    if (isTyping) {
        const existingTyping = document.getElementById('typing-indicator');
        if (existingTyping) {
            chatOutput.replaceChild(messageDiv, existingTyping);
        } else {
            chatOutput.appendChild(messageDiv);
        }
    } else {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            chatOutput.removeChild(typingIndicator);
        }
        chatOutput.appendChild(messageDiv);
    }
    
    // Scroll behavior - force for bot messages, normal for others
    if (role === 'bot' && !isTyping) {
        smartScroll(true);
    } else {
        smartScroll();
    }
    
    // Save to history (except typing indicators)
    if (!isTyping) {
        if (role === 'system') {
            chatHistory.push({ role: 'system', content: content });
        } else {
            chatHistory.push({ role: role, content: content });
        }
        saveChatToCache();
    }
}

// Helper for system messages
function addSystemMessage(content) {
    addMessage('system', content);
}

// Save chat to localStorage
function saveChatToCache() {
    localStorage.setItem('gdchat_history', JSON.stringify(chatHistory));
}

// Send message to Gemini API
async function sendMessage(message) {
    // Flood protection
    if (Date.now() - lastMessageTime < 15000) {
        addSystemMessage("⚠️ Aguarde 15 segundos entre mensagens");
        return;
    }
    lastMessageTime = Date.now();
    
    // Check for commands
    if (message.startsWith('/')) {
        switch(message.toLowerCase()) {
            case '/ajuda':
                addSystemMessage("📋 Comandos disponíveis:");
                addSystemMessage("/limpar - Reinicia a conversa");
                addSystemMessage("/exportar - Salva o histórico");
                addSystemMessage("/ajuda - Mostra esta mensagem");
                return;
            case '/limpar':
                clearChat();
                return;
            case '/exportar':
                saveChatHistory();
                return;
        }
    }
    
    // Add user message to chat
    addMessage('user', message);
    
    // Show typing indicator
    addMessage('bot', 'GDCHAT está digitando...', true);
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${configuracoesAcesso}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: chatHistory.filter(msg => msg.role !== 'system').map(msg => ({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                })),
                generationConfig: {
                    temperature: 0.9,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 2048,
                    stopSequences: []
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content.parts) {
            const botResponse = data.candidates[0].content.parts[0].text;
            addMessage('bot', botResponse);
        } else {
            throw new Error('Unexpected response format from API');
        }
    } catch (error) {
        addSystemMessage(`❌ Erro: ${error.message}`);
        console.error('Error:', error);
    }
}

// Save chat history to a file
function saveChatHistory() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `chat_history_${timestamp}.txt`;
        let content = '';
        
        chatHistory.forEach(message => {
            const role = message.role === 'user' ? 'Você' : (message.role === 'system' ? 'Sistema' : 'GDCHAT');
            content += `${role}: ${message.content}\n\n`;
        });
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        addSystemMessage(`✅ Conversa salva como ${filename}`);
        return filename;
    } catch (error) {
        addSystemMessage(`❌ Erro ao salvar: ${error.message}`);
        return null;
    }
}

// Clear the chat history
function clearChat() {
    if (!confirm("Tem certeza que deseja limpar todo o histórico?")) return;
    
    chatHistory = [];
    localStorage.removeItem('gdchat_history');
    chatOutput.innerHTML = '';
    addSystemMessage("> Histórico limpo. Conversa reiniciada.");
}

// Event listeners
sendButton.addEventListener('click', () => {
    const message = textInput.value.trim();
    textInput.value = '';
    
    if (!message) return;
    
    if (message.toLowerCase() === 'sair' || 
        message.toLowerCase() === 'exit' || 
        message.toLowerCase() === 'fim') {
        addSystemMessage("> Chat encerrado. Até mais!");
        return;
    }
    
    sendMessage(message);
});

textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendButton.click();
    }
});

clearButton.addEventListener('click', clearChat);
saveButton.addEventListener('click', saveChatHistory);

// Protection against inspection
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    addSystemMessage('🔒 use cntrl + C para copiar');
});

document.addEventListener('keydown', function(e) {
    if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && e.key === 'I') || // Ctrl+Shift+I
        (e.ctrlKey && e.shiftKey && e.key === 'J') || // Ctrl+Shift+J
        (e.ctrlKey && e.key === 'u')                  // Ctrl+U
    ) {
        e.preventDefault();
        addSystemMessage('🔒 Todos os direitos reservados, Yuri Antoniazzi');
    }
});

// Initialize the chat
initChat();