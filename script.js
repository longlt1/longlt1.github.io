class GoGame {
    constructor() {
        this.boardSize = 19;
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.currentPlayer = 'black';
        this.history = [];
        this.ai = new GoAI();
        this.gameMode = 'pvp';
        this.initializeBoard();
        this.setupEventListeners();
        this.setupMenu();
        this.setupGameMode();
        this.setupBoardSize();
    }

    setupBoardSize() {
        const boardSizeSelect = document.getElementById('boardSize');
        const board = document.getElementById('board');

        boardSizeSelect.addEventListener('change', (e) => {
            const newSize = parseInt(e.target.value);
            this.boardSize = newSize;
            board.setAttribute('data-size', newSize);
            this.newGame();
        });

        // Set initial board size
        board.setAttribute('data-size', this.boardSize);
    }

    initializeBoard() {
        const boardElement = document.getElementById('board');
        boardElement.innerHTML = '';

        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                const intersection = document.createElement('div');
                intersection.className = 'intersection';
                intersection.dataset.row = i;
                intersection.dataset.col = j;

                // Thêm điểm sao cho bàn cờ 19x19
                if (this.boardSize === 19) {
                    if ((i === 3 || i === 9 || i === 15) && (j === 3 || j === 9 || j === 15)) {
                        intersection.classList.add('star-point');
                    }
                }
                // Thêm điểm sao cho bàn cờ 13x13
                else if (this.boardSize === 13) {
                    if ((i === 3 || i === 6 || i === 9) && (j === 3 || j === 6 || j === 9)) {
                        intersection.classList.add('star-point');
                    }
                }
                // Thêm điểm sao cho bàn cờ 9x9
                else if (this.boardSize === 9) {
                    if ((i === 2 || i === 4 || i === 6) && (j === 2 || j === 4 || j === 6)) {
                        intersection.classList.add('star-point');
                    }
                }

                boardElement.appendChild(intersection);
            }
        }
    }

    setupEventListeners() {
        const board = document.getElementById('board');
        board.addEventListener('click', (e) => {
            const intersection = e.target.closest('.intersection');
            if (intersection) {
                const row = parseInt(intersection.dataset.row);
                const col = parseInt(intersection.dataset.col);
                this.makeMove(row, col);
            }
        });

        document.getElementById('newGame').addEventListener('click', () => this.newGame());
        document.getElementById('undo').addEventListener('click', () => this.undo());
        document.getElementById('hint').addEventListener('click', () => this.showHint());
    }

    setupGameMode() {
        const gameModeSelect = document.getElementById('gameMode');
        const aiSettings = document.querySelector('.ai-settings');
        const aiHint = document.querySelector('.ai-hint');
        const externalAI = document.getElementById('externalAI');
        const apiKeyInput = document.getElementById('apiKey');

        gameModeSelect.addEventListener('change', (e) => {
            this.gameMode = e.target.value;
            if (this.gameMode === 'pve' || this.gameMode === 'learning') {
                aiSettings.style.display = 'block';
                aiHint.style.display = 'block';
            } else {
                aiSettings.style.display = 'none';
                aiHint.style.display = 'none';
            }
            this.newGame();
        });

        // Xử lý thay đổi độ khó AI
        document.getElementById('aiDifficulty').addEventListener('change', (e) => {
            this.ai.difficulty = e.target.value;
        });

        // Xử lý thay đổi màu quân AI
        document.getElementById('aiColor').addEventListener('change', (e) => {
            if (this.gameMode === 'pve') {
                this.newGame();
            }
        });

        // Xử lý thay đổi AI bên ngoài
        externalAI.addEventListener('change', (e) => {
            const selectedAI = e.target.value;
            if (selectedAI === 'none') {
                apiKeyInput.style.display = 'none';
                this.ai.setExternalAI(null);
            } else {
                apiKeyInput.style.display = 'block';
                apiKeyInput.placeholder = selectedAI === 'chatgpt' ? 'OpenAI API Key' : 'Google API Key';
            }
        });

        // Xử lý nhập API Key
        apiKeyInput.addEventListener('change', (e) => {
            const apiKey = e.target.value.trim();
            if (apiKey) {
                const selectedAI = externalAI.value;
                this.ai.setExternalAI(selectedAI, apiKey);
            }
        });
    }

    makeMove(row, col) {
        if (this.board[row][col] !== null) return;

        // Kiểm tra luật ko
        const tempBoard = this.board.map(row => [...row]);
        tempBoard[row][col] = this.currentPlayer;
        
        if (!this.isValidMove(row, col, tempBoard)) {
            alert('Nước đi không hợp lệ!');
            return;
        }

        this.board[row][col] = this.currentPlayer;
        this.history.push({
            row,
            col,
            player: this.currentPlayer
        });

        this.updateBoard();
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.updateCurrentPlayer();

        // Xử lý nước đi của AI
        if (this.gameMode === 'pve' || this.gameMode === 'learning') {
            const aiColor = document.getElementById('aiColor').value;
            if (this.currentPlayer === aiColor) {
                setTimeout(() => this.makeAIMove(), 500);
            }
        }
    }

    async makeAIMove() {
        if (this.gameMode === 'learning') {
            const hint = await this.ai.getLessonHint();
            if (hint) {
                document.getElementById('aiMessage').textContent = hint.message;
            }
        }

        const move = await this.ai.makeMove(this.board, this.currentPlayer);
        if (move) {
            const [row, col] = move;
            this.makeMove(row, col);
        }
    }

    isValidMove(row, col, board) {
        // Kiểm tra xem nước đi có tạo ra nhóm quân có khí hay không
        const group = this.getGroup(row, col, board);
        if (this.hasLiberties(group, board)) return true;

        // Kiểm tra xem nước đi có bắt được quân đối phương không
        const opponent = this.currentPlayer === 'black' ? 'white' : 'black';
        const adjacentOpponentGroups = this.getAdjacentGroups(row, col, opponent, board);
        
        for (const group of adjacentOpponentGroups) {
            if (!this.hasLiberties(group, board)) return true;
        }

        return false;
    }

    getGroup(row, col, board) {
        const color = board[row][col];
        const group = new Set();
        const queue = [[row, col]];

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            const key = `${r},${c}`;
            
            if (group.has(key)) continue;
            if (r < 0 || r >= this.boardSize || c < 0 || c >= this.boardSize) continue;
            if (board[r][c] !== color) continue;

            group.add(key);
            queue.push([r+1, c], [r-1, c], [r, c+1], [r, c-1]);
        }

        return group;
    }

    hasLiberties(group, board) {
        for (const pos of group) {
            const [row, col] = pos.split(',').map(Number);
            if (this.hasAdjacentLiberty(row, col, board)) return true;
        }
        return false;
    }

    hasAdjacentLiberty(row, col, board) {
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < this.boardSize && 
                newCol >= 0 && newCol < this.boardSize && 
                board[newRow][newCol] === null) {
                return true;
            }
        }
        return false;
    }

    getAdjacentGroups(row, col, color, board) {
        const groups = new Set();
        const directions = [[1,0], [-1,0], [0,1], [0,-1]];
        
        for (const [dr, dc] of directions) {
            const newRow = row + dr;
            const newCol = col + dc;
            if (newRow >= 0 && newRow < this.boardSize && 
                newCol >= 0 && newCol < this.boardSize && 
                board[newRow][newCol] === color) {
                const group = this.getGroup(newRow, newCol, board);
                groups.add(group);
            }
        }
        
        return groups;
    }

    updateBoard() {
        const intersections = document.querySelectorAll('.intersection');
        intersections.forEach(intersection => {
            const row = parseInt(intersection.dataset.row);
            const col = parseInt(intersection.dataset.col);
            const stone = this.board[row][col];
            
            intersection.innerHTML = '';
            if (stone) {
                const stoneElement = document.createElement('div');
                stoneElement.className = `stone ${stone}`;
                intersection.appendChild(stoneElement);
            }
        });
    }

    updateCurrentPlayer() {
        document.getElementById('currentPlayer').textContent = 
            this.currentPlayer === 'black' ? 'Đen' : 'Trắng';
    }

    newGame() {
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.currentPlayer = 'black';
        this.history = [];
        this.initializeBoard();
        this.updateCurrentPlayer();
    }

    undo() {
        if (this.history.length === 0) return;
        
        const lastMove = this.history.pop();
        this.board[lastMove.row][lastMove.col] = null;
        this.currentPlayer = lastMove.player;
        this.updateBoard();
        this.updateCurrentPlayer();
    }

    async showHint() {
        if (this.gameMode === 'learning') {
            const hint = await this.ai.getLessonHint();
            if (hint) {
                document.getElementById('aiMessage').textContent = hint.message;
                // Highlight các nước đi hợp lệ
                hint.validMoves.forEach(([row, col]) => {
                    const intersection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    intersection.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                    setTimeout(() => {
                        intersection.style.backgroundColor = '';
                    }, 1000);
                });
            }
        } else {
            // Gợi ý nước đi ngẫu nhiên cho chế độ thường
            const emptySpaces = [];
            for (let i = 0; i < this.boardSize; i++) {
                for (let j = 0; j < this.boardSize; j++) {
                    if (this.board[i][j] === null) {
                        emptySpaces.push([i, j]);
                    }
                }
            }
            
            if (emptySpaces.length > 0) {
                const [row, col] = emptySpaces[Math.floor(Math.random() * emptySpaces.length)];
                const intersection = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                intersection.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                setTimeout(() => {
                    intersection.style.backgroundColor = '';
                }, 1000);
            }
        }
    }

    setupMenu() {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                menuItems.forEach(mi => mi.classList.remove('active'));
                document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
                
                item.classList.add('active');
                const sectionId = item.dataset.section;
                document.getElementById(sectionId).classList.add('active');
            });
        });

        // Xử lý các nút trong phần bài học
        document.querySelectorAll('.start-lesson').forEach(button => {
            button.addEventListener('click', (e) => {
                const lessonCard = e.target.closest('.lesson-card');
                const lesson = lessonCard.dataset.lesson;
                
                // Chuyển sang chế độ học
                document.getElementById('gameMode').value = 'learning';
                document.querySelector('.ai-settings').style.display = 'block';
                document.querySelector('.ai-hint').style.display = 'block';
                
                // Kích hoạt chế độ học
                this.ai.startLearningMode(lesson);
                this.newGame();
                
                // Chuyển sang tab chơi cờ
                document.querySelector('[data-section="game"]').click();
            });
        });

        // Xử lý các nút trong phần thử thách
        document.querySelectorAll('.start-challenge').forEach(button => {
            button.addEventListener('click', (e) => {
                const challengeTitle = e.target.parentElement.querySelector('h3').textContent;
                alert(`Bắt đầu thử thách: ${challengeTitle}`);
                // TODO: Implement challenge logic
            });
        });
    }
}

// Khởi tạo trò chơi khi trang được tải
window.addEventListener('load', () => {
    new GoGame();
}); 