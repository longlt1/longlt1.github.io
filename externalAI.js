class ExternalAI {
    constructor(apiKey, model = 'gpt-3.5-turbo') {
        this.apiKey = apiKey;
        this.model = model;
        this.baseUrl = 'https://api.openai.com/v1/chat/completions';
    }

    async getMoveSuggestion(board, player, context) {
        try {
            const boardState = this.convertBoardToString(board);
            const prompt = this.createPrompt(boardState, player, context);
            
            const response = await fetch(this.baseUrl, {
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
                            content: "Bạn là một chuyên gia Cờ Vây. Hãy phân tích bàn cờ và đưa ra gợi ý nước đi tốt nhất."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                })
            });

            const data = await response.json();
            return this.parseAIResponse(data.choices[0].message.content);
        } catch (error) {
            console.error('Error getting AI suggestion:', error);
            return null;
        }
    }

    convertBoardToString(board) {
        let result = '';
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board[i].length; j++) {
                if (board[i][j] === null) result += '.';
                else if (board[i][j] === 'black') result += 'B';
                else result += 'W';
            }
            result += '\n';
        }
        return result;
    }

    createPrompt(boardState, player, context) {
        return `
Bàn cờ hiện tại:
${boardState}

Người chơi hiện tại: ${player === 'black' ? 'Đen' : 'Trắng'}
Ngữ cảnh: ${context}

Hãy phân tích tình hình và đưa ra:
1. Nước đi tốt nhất (tọa độ x,y)
2. Lý do cho nước đi này
3. Các nước đi thay thế (nếu có)
`;
    }

    parseAIResponse(response) {
        try {
            // Tìm tọa độ trong câu trả lời
            const coordMatch = response.match(/\((\d+),\s*(\d+)\)/);
            if (coordMatch) {
                return {
                    move: [parseInt(coordMatch[1]), parseInt(coordMatch[2])],
                    explanation: response
                };
            }
            return null;
        } catch (error) {
            console.error('Error parsing AI response:', error);
            return null;
        }
    }
}

// Lớp để xử lý Google Gemini
class GeminiAI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    }

    async getMoveSuggestion(board, player, context) {
        try {
            const boardState = this.convertBoardToString(board);
            const prompt = this.createPrompt(boardState, player, context);
            
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            const data = await response.json();
            return this.parseAIResponse(data.candidates[0].content.parts[0].text);
        } catch (error) {
            console.error('Error getting Gemini suggestion:', error);
            return null;
        }
    }

    // Các phương thức khác tương tự như ExternalAI
    convertBoardToString(board) {
        let result = '';
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board[i].length; j++) {
                if (board[i][j] === null) result += '.';
                else if (board[i][j] === 'black') result += 'B';
                else result += 'W';
            }
            result += '\n';
        }
        return result;
    }

    createPrompt(boardState, player, context) {
        return `
Bàn cờ hiện tại:
${boardState}

Người chơi hiện tại: ${player === 'black' ? 'Đen' : 'Trắng'}
Ngữ cảnh: ${context}

Hãy phân tích tình hình và đưa ra:
1. Nước đi tốt nhất (tọa độ x,y)
2. Lý do cho nước đi này
3. Các nước đi thay thế (nếu có)
`;
    }

    parseAIResponse(response) {
        try {
            const coordMatch = response.match(/\((\d+),\s*(\d+)\)/);
            if (coordMatch) {
                return {
                    move: [parseInt(coordMatch[1]), parseInt(coordMatch[2])],
                    explanation: response
                };
            }
            return null;
        } catch (error) {
            console.error('Error parsing Gemini response:', error);
            return null;
        }
    }
} 