class ChatGPTGoAI {
    constructor(apiKey) {
        this.apiKey = apiKey && apiKey.trim() ? apiKey : '';
        this.model = "gpt-4.1";
    }

    async listModels() {
        try {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });

            if (res.status === 200) {
                const data = await res.json();
                const models = data.data.map(model => model.id);
                console.log('[ChatGPTGoAI] Available models:', models);
                return models;
            } else {
                const err = await res.text();
                console.error('[ChatGPTGoAI] Model list fetch failed:', err);
                return [];
            }
        } catch (e) {
            console.error('[ChatGPTGoAI] Error fetching model list:', e);
            return [];
        }
    }

    async testConnection(modelId = this.model) {
        try {
            const res = await fetch('https://api.openai.com/v1/models/${modelId}', {
                headers: { 'Authorization': `Bearer ${this.apiKey}` }
            });
            if (res.status === 200) {
                console.log('[ChatGPTGoAI] API connection test: SUCCESS');
                return true;
            } else {
                const err = await res.text();
                console.error('[ChatGPTGoAI] API connection test: FAIL', err);
                return false;
            }
        } catch (e) {
            console.error('[ChatGPTGoAI] API connection test: ERROR', e);
            return false;
        }
    }

    async getMove(board, currentPlayer, difficulty) {
        try {
            // Convert board state to text representation
            const boardText = this.convertBoardToText(board);
            
            // Create prompt for ChatGPT
            const prompt = this.createPrompt(boardText, currentPlayer, difficulty);
            
            // Log before calling API
            console.log('[ChatGPTGoAI] Sending request to ChatGPT API...');
            
            // Call ChatGPT API
            const response = await this.callChatGPT(prompt);
            
            // Log after receiving response
            console.log('[ChatGPTGoAI] Received response from ChatGPT API:', response);
            
            // Parse response to get move coordinates
            const move = this.parseResponse(response);
            
            return move;
        } catch (error) {
            console.error("Error getting move from ChatGPT:", error);
            return null;
        }
    }

    convertBoardToText(board) {
        let text = "";
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board[i].length; j++) {
                if (board[i][j] === 1) text += "B"; // Black
                else if (board[i][j] === 2) text += "W"; // White
                else text += "."; // Empty
            }
            text += "\n";
        }
        return text;
    }

    createPrompt(boardText, currentPlayer, difficulty) {
        const playerColor = currentPlayer === 1 ? "Black" : "White";
        const difficultyLevel = this.getDifficultyDescription(difficulty);
        
        return `You are a ${difficultyLevel} Go player. The current board state is:

${boardText}

It is ${playerColor}'s turn. Please analyze the board and suggest the best move in the format "x,y" where x and y are the coordinates (0-based) of the intersection where the stone should be placed. Only respond with the coordinates, nothing else.`;
    }

    getDifficultyDescription(difficulty) {
        switch(difficulty) {
            case 'easy': return 'beginner';
            case 'medium': return 'intermediate';
            case 'hard': return 'expert';
            default: return 'intermediate';
        }
    }

    async callChatGPT(prompt) {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: "You are a Go (Baduk) game AI. You will receive the current board state and must respond with the best move coordinates in the format 'x,y'."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 10
            })
        });

        if (res.status === 200) {
            console.log('[ChatGPTGoAI] Connected to ChatGPT API successfully!');
            const data = await res.json();
            return data.choices[0].message.content.trim();
        } else {
            const errorText = await res.text();
            console.error(`[ChatGPTGoAI] Failed to connect to ChatGPT API. Status: ${res.status}. Response:`, errorText);
            throw new Error('ChatGPT API connection failed');
        }
    }

    parseResponse(response) {
        try {
            const [x, y] = response.split(',').map(Number);
            if (isNaN(x) || isNaN(y)) {
                throw new Error("Invalid response format");
            }
            return { x, y };
        } catch (error) {
            console.error("Error parsing ChatGPT response:", error);
            return null;
        }
    }
} 