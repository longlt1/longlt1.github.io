class GoAI {
    constructor(difficulty = 'beginner') {
        this.difficulty = difficulty;
        this.learningMode = false;
        this.currentLesson = null;
        this.externalAI = null;
        this.useExternalAI = false;
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

    // Chế độ chơi cờ
    async makeMove(board, player, invalidMoves = new Set()) {
        // Ignore all stored moves in invalidMoves
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

        // Fallback to basic AI if external AI is not available
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
} 