class GoAI {
    constructor(difficulty = 'beginner') {
        this.difficulty = difficulty;
        this.learningMode = false;
        this.currentLesson = null;
        this.externalAI = null;
        this.useExternalAI = false;
        this.serverUrl = 'https://igo.tnpglobal.vn/pachi'; // Proxy Node kết nối tới Pachi
    }

    // Chế độ dạy học
    startLearningMode(lesson) {
        this.learningMode = true;
        this.currentLesson = lesson;
        return this.getLessonHint();
    }

    async getLessonHint() {
        if (!this.learningMode) return null;

        if (this.useExternalAI) {
            const context = this.getLessonContext();
            const suggestion = await this.externalAI.getMoveSuggestion(this.board, this.currentPlayer, context);
            if (suggestion) {
                return {
                    message: suggestion.explanation,
                    validMoves: [suggestion.move]
                };
            }
        }

        // Fallback to basic hints if external AI is not available
        switch(this.currentLesson) {
            case 'basic_rules':
                return {
                    message: "Hãy thử đặt quân vào một điểm giao trống trên bàn cờ.",
                    validMoves: this.getAllEmptyIntersections()
                };
            case 'capture':
                return {
                    message: "Hãy thử bắt quân đối phương bằng cách bao vây nó.",
                    validMoves: this.findCaptureOpportunities()
                };
            case 'territory':
                return {
                    message: "Hãy thử tạo lãnh thổ bằng cách đặt quân tạo thành ranh giới.",
                    validMoves: this.findTerritoryMoves()
                };
            default:
                return null;
        }
    }

    getLessonContext() {
        switch(this.currentLesson) {
            case 'basic_rules':
                return "Đang học luật cơ bản của Cờ Vây. Hãy hướng dẫn người chơi cách đặt quân đúng cách.";
            case 'capture':
                return "Đang học cách bắt quân. Hãy hướng dẫn người chơi cách bao vây và bắt quân đối phương.";
            case 'territory':
                return "Đang học cách tạo lãnh thổ. Hãy hướng dẫn người chơi cách xây dựng và bảo vệ lãnh thổ.";
            default:
                return "Đang trong chế độ học tập.";
        }
    }

    // Hàm chuyển nước đi kiểu Go ("D4") sang row/col
    pachiMoveToCoords(move, boardSize) {
        if (!move || typeof move !== 'string') return null;
        move = move.trim().toUpperCase();
        if (move === 'PASS' || move === 'RESIGN') return null;
        const colChar = move[0];
        if (!colChar || colChar < 'A' || colChar > 'T') return null; // kiểm tra ký tự hợp lệ
        
        const rowNum = parseInt(move.slice(1), 10);
        if (isNaN(rowNum)) return null;
        
        let col = colChar.charCodeAt(0) - 65; // 'A' = 0
        if (colChar >= 'I') col -= 1; // Bỏ qua 'I' trong Go
        const row = boardSize - rowNum;
        return [row, col];
    }

    async callGenMove(board, player, rank = 'intermediate', gameId = null, historyCommands = []) {
        console.log('Calling Pachi for move generation, rank:', rank, 'gameId:', gameId, 'player:', player);
        try {
            console.log('Using Pachi server:', this.serverUrl);

            // Prepare all commands
            const commands = ['komi 6.5', 'clear_board'];
            
            // Add board size command
            commands.push(`boardsize ${board.length}`);

            // Add history commands if provided
            if (historyCommands && historyCommands.length > 0) {
                commands.push(...historyCommands);
            } else {
                // Add all moves from current board state
                for (let i = 0; i < board.length; i++) {
                    for (let j = 0; j < board.length; j++) {
                        if (board[i][j] === 'black') {
                            commands.push(`play b ${String.fromCharCode(97 + j)}${board.length - i}`);
                        } else if (board[i][j] === 'white') {
                            commands.push(`play w ${String.fromCharCode(97 + j)}${board.length - i}`);
                        }
                    }
                }
            }

            // push genmove command
            commands.push(`genmove ${player === 'black' ? 'b' : 'w'}`);
            commands.push('showboard');

            // Send all commands in one request
            const response = await fetch(`${this.serverUrl}/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    commands: commands,
                    gameId: gameId,
                    rank: rank
                })
            });

            if (!response.ok) {
                console.log('Failed to get move from Pachi');
                throw new Error('Failed to get move from Pachi');
            }

            const data = await response.json();
            console.log('Response from Pachi:', data);

            // Get the genmove response
            const genmoveResponse = data.responses[`genmove ${player === 'black' ? 'b' : 'w'}`];
            if (!genmoveResponse) {
                console.warn('No genmove response found');
                return null;
            }

            let moveStr = null;
            const match = genmoveResponse.match(/([A-T][0-9]+|PASS|RESIGN)/i);
            if (match && match[1]) {
                moveStr = match[1].toUpperCase();
            } else {
                console.warn('Could not parse move from response:', genmoveResponse);
                return null;
            }

            const coords = this.pachiMoveToCoords(moveStr, board.length);
            console.log('Move from Pachi:', moveStr, 'to coords:', coords);
            const boardResult = data.responses['showboard'];
            console.log('Board result from Pachi:', boardResult);
            if (!coords || !boardResult) return null;
            return [coords, boardResult];
        } catch (error) {
            console.log('Failed to get move from Pachi');
            console.error('Error calling Pachi:', error);
            return null;
        }
    }

    // Các hàm hỗ trợ
    getAllEmptyIntersections(board) {
        const emptySpaces = [];
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board[i].length; j++) {
                if (board[i][j] === null) {
                    emptySpaces.push([i, j]);
                }
            }
        }
        return emptySpaces;
    }

    findCaptureOpportunities(board, player) {
        const opportunities = [];
        const opponent = player === 'black' ? 'white' : 'black';
        
        // Tìm các nhóm quân đối phương có ít khí
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board[i].length; j++) {
                if (board[i][j] === opponent) {
                    const liberties = this.countLiberties(board, i, j);
                    if (liberties <= 2) {
                        opportunities.push([i, j]);
                    }
                }
            }
        }
        return opportunities;
    }

    findTerritoryMoves(board, player) {
        const territoryMoves = [];
        // Logic đơn giản: ưu tiên các nước đi gần quân đã có
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board[i].length; j++) {
                if (board[i][j] === null && this.hasAdjacentStones(board, i, j, player)) {
                    territoryMoves.push([i, j]);
                }
            }
        }
        return territoryMoves;
    }

    countLiberties(board, row, col) {
        const color = board[row][col];
        const visited = new Set();
        const queue = [[row, col]];
        let liberties = 0;

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            const key = `${r},${c}`;
            
            if (visited.has(key)) continue;
            visited.add(key);

            const directions = [[1,0], [-1,0], [0,1], [0,-1]];
            for (const [dr, dc] of directions) {
                const newRow = r + dr;
                const newCol = c + dc;
                
                if (newRow >= 0 && newRow < board.length && 
                    newCol >= 0 && newCol < board[0].length) {
                    if (board[newRow][newCol] === null) {
                        liberties++;
                    } else if (board[newRow][newCol] === color) {
                        queue.push([newRow, newCol]);
                    }
                }
            }
        }
        return liberties;
    }

    hasAdjacentStones(board, row, col, color) {
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < board.length && 
                newCol >= 0 && newCol < board[0].length && 
                board[newRow][newCol] === color) {
                return true;
            }
        }
        return false;
    }

    // Các hàm tạo nước đi theo độ khó
    makeBeginnerMove(board, player, validMoves) {
        if (validMoves.length === 0) return null;
        
        // Ưu tiên các nước đi gần quân đã có
        const territoryMoves = this.findTerritoryMoves(board, player);
        if (territoryMoves.length > 0) {
            return territoryMoves[Math.floor(Math.random() * territoryMoves.length)];
        }
        
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    makeIntermediateMove(board, player, validMoves) {
        if (validMoves.length === 0) return null;

        // Ưu tiên bắt quân nếu có cơ hội
        const captureMoves = this.findCaptureOpportunities(board, player);
        if (captureMoves.length > 0) {
            return captureMoves[Math.floor(Math.random() * captureMoves.length)];
        }

        // Nếu không có cơ hội bắt quân, tìm nước đi tạo lãnh thổ
        const territoryMoves = this.findTerritoryMoves(board, player);
        if (territoryMoves.length > 0) {
            return territoryMoves[Math.floor(Math.random() * territoryMoves.length)];
        }

        // Nếu không có nước đi tốt, chọn ngẫu nhiên
        return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    makeAdvancedMove(board, player, validMoves) {
        if (validMoves.length === 0) return null;

        // TODO: Implement more sophisticated move generation
        return this.makeIntermediateMove(board, player, validMoves);
    }

    makeLearningMove(board, player) {
        // Trong chế độ học, AI sẽ đưa ra các nước đi phù hợp với bài học
        switch(this.currentLesson) {
            case 'basic_rules':
                return this.makeBeginnerMove(board, player);
            case 'capture':
                const captureMoves = this.findCaptureOpportunities(board, player);
                if (captureMoves.length > 0) {
                    return captureMoves[Math.floor(Math.random() * captureMoves.length)];
                }
                return this.makeBeginnerMove(board, player);
            case 'territory':
                const territoryMoves = this.findTerritoryMoves(board, player);
                if (territoryMoves.length > 0) {
                    return territoryMoves[Math.floor(Math.random() * territoryMoves.length)];
                }
                return this.makeBeginnerMove(board, player);
            default:
                return this.makeBeginnerMove(board, player);
        }
    }

    async makeMove(board, player, invalidMoves = new Set(), gameId = null, historyCommands = []) {
        const validMoves = [];
        for (let i = 0; i < board.length; i++) {
            for (let j = 0; j < board.length; j++) {
                const moveKey = `${i},${j}`;
                if (!invalidMoves.has(moveKey) && board[i][j] === null) {
                    validMoves.push([i, j]);
                }
            }
        }
        if (validMoves.length === 0) return null;

        let rank = 'intermediate';
        if (this.difficulty === 'beginner') rank = 'beginner';
        else if (this.difficulty === 'intermediate') rank = 'intermediate';
        else if (this.difficulty === 'advanced' || this.difficulty === 'pro') rank = 'pro';

        // Sử dụng Pachi để sinh nước đi với lịch sử nước đi
        const result = await this.callGenMove(board, player, rank, gameId, historyCommands);
        if (result) return result;

        // Fallback nếu Pachi không trả về nước đi
        switch(this.difficulty) {
            case 'beginner':
                return this.makeBeginnerMove(board, player, validMoves);
            case 'intermediate':
                return this.makeIntermediateMove(board, player, validMoves);
            case 'advanced':
                return this.makeAdvancedMove(board, player, validMoves);
            default:
                return this.makeBeginnerMove(board, player, validMoves);
        }
    }

    async sendPlayMove(board, gameId = null, historyCommands = []) {
        console.log('Getting board state from Pachi');
        try {
            console.log('Using Pachi server:', this.serverUrl);

            // Prepare commands
            const commands = ['komi 6.5', 'clear_board'];
            commands.push(`boardsize ${board.length}`);

            if (historyCommands && historyCommands.length > 0) {
                commands.push(...historyCommands);
            } else {
                // Add all moves from current board state
                for (let i = 0; i < board.length; i++) {
                    for (let j = 0; j < board.length; j++) {
                        if (board[i][j] === 'black') {
                            commands.push(`play b ${String.fromCharCode(97 + j)}${board.length - i}`);
                        } else if (board[i][j] === 'white') {
                            commands.push(`play w ${String.fromCharCode(97 + j)}${board.length - i}`);
                        }
                    }
                }
            }

            // Add showboard command
            commands.push('showboard');

            // Send commands
            const response = await fetch(`${this.serverUrl}/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    commands: commands,
                    gameId: gameId
                })
            });

            if (!response.ok) {
                console.log('Failed to get board state from Pachi');
                throw new Error('Failed to get board state from Pachi');
            }

            const data = await response.json();
            console.log('Showboard response from Pachi:', data);

            // Get the showboard response
            const showboardResponse = data.responses['showboard'];
            if (!showboardResponse) {
                console.warn('No showboard response found');
                return null;
            }

            return showboardResponse;
        } catch (error) {
            console.log('Failed to get board state from Pachi');
            console.error('Error calling Pachi showboard:', error);
            return null;
        }
    }
} 