class GoGame {
    constructor() {
        this.boardSize = 9;
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.currentPlayer = 'black';
        this.history = [];
        this.ai = new GoAI();
        this.gameMode = document.getElementById('gameMode').value;
        this.isAIThinking = false;
        this.autoPlay = false;
        this.capturedStones = { black: 0, white: 0 };
        this.isGameOver = false;
        this.boardWidth = Math.min(window.innerWidth - 40, 400); // Giới hạn kích thước tối đa
        this.state = 'init'; // Các state: init, playing, ended
        this.currentPlayerType = 'human'; // Variable to show if current player is AI or human
        this.initializeBoard();
        this.setupEventListeners();
        this.setupMenu();
        this.setupGameMode();
        this.setupBoardSize();
        this.setupResizeHandler();
    }

    setupResizeHandler() {
        window.addEventListener('resize', () => {
            this.boardWidth = Math.min(window.innerWidth - 40, 400);
            this.initializeBoard();
            this.updateBoard();
        });
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
        const board = document.getElementById('board');
        board.innerHTML = '';
        board.style.width = `${this.boardWidth}px`;
        board.style.height = `${this.boardWidth}px`;
        board.style.position = 'relative';
        board.style.backgroundColor = '#DEB887';
        board.style.border = '2px solid #000';
        board.style.margin = '10px auto';

        // Vẽ các đường kẻ
        for (let i = 0; i < this.boardSize; i++) {
            // Vẽ đường ngang
            const hLine = document.createElement('div');
            hLine.className = 'grid-line horizontal';
            hLine.style.position = 'absolute';
            hLine.style.left = '0';
            hLine.style.width = '100%';
            hLine.style.height = '1px';
            hLine.style.backgroundColor = '#000';
            hLine.style.top = `${(i * 100) / (this.boardSize - 1)}%`;
            board.appendChild(hLine);

            // Vẽ đường dọc
            const vLine = document.createElement('div');
            vLine.className = 'grid-line vertical';
            vLine.style.position = 'absolute';
            vLine.style.top = '0';
            vLine.style.height = '100%';
            vLine.style.width = '1px';
            vLine.style.backgroundColor = '#000';
            vLine.style.left = `${(i * 100) / (this.boardSize - 1)}%`;
            board.appendChild(vLine);
        }

        // Vẽ sao điểm
        const starPoints = this.getStarPoints();
        starPoints.forEach(([row, col]) => {
            const star = document.createElement('div');
            star.className = 'star-point';
            star.style.position = 'absolute';
            star.style.width = `${this.boardWidth / 75}px`;
            star.style.height = `${this.boardWidth / 75}px`;
            star.style.backgroundColor = '#000';
            star.style.borderRadius = '50%';
            star.style.transform = 'translate(-50%, -50%)';
            star.style.left = `${(col * 100) / (this.boardSize - 1)}%`;
            star.style.top = `${(row * 100) / (this.boardSize - 1)}%`;
            board.appendChild(star);
        });

        // Thêm sự kiện click cho bàn cờ
        board.addEventListener('click', (e) => {
            if (this.isAIThinking || this.isGameOver) return;
            
            const rect = board.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const col = Math.round((x / rect.width) * (this.boardSize - 1));
            const row = Math.round((y / rect.height) * (this.boardSize - 1));
            
            if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
                this.makeMove(row, col);
            }
        });
    }

    setupEventListeners() {
        const board = document.getElementById('board');
        board.addEventListener('click', (e) => {
            if (
                this.state !== 'playing' ||
                (this.gameMode === 'pve' && this.currentPlayer === document.getElementById('aiColor').value) ||
                this.isAIThinking
            ) {
                return;
            }
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
        document.getElementById('endGame').addEventListener('click', () => {
            if (!this.isGameOver) {
                this.endGame();
            }
        });
    }

    setupGameMode() {
        const gameModeSelect = document.getElementById('gameMode');
        const aiSettings = document.querySelector('.ai-settings');
        const aiHint = document.querySelector('.ai-hint');
        const apiKeyInput = document.getElementById('apiKey');

        gameModeSelect.addEventListener('change', (e) => {
            this.gameMode = e.target.value;
            if (this.gameMode === 'pve') {
                console.log('pve');
                aiSettings.style.display = 'block';
                aiHint.style.display = 'block';
                if (apiKeyInput) apiKeyInput.style.display = 'block';
                this.randomizeColors();
            } else {
                console.log('pvp');
                aiSettings.style.display = 'none';
                aiHint.style.display = 'none';
                if (apiKeyInput) apiKeyInput.style.display = 'none';
                document.getElementById('blackPlayerName').textContent = 'Người chơi Đen';
                document.getElementById('whitePlayerName').textContent = 'Người chơi Trắng';
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
                this.updatePlayerNames();
                this.newGame();
            }
        });
    }

    randomizeColors() {
        const aiColor = Math.random() < 0.5 ? 'black' : 'white';
        document.getElementById('aiColor').value = aiColor;
        
        const playerColor = aiColor === 'black' ? 'white' : 'black';
        this.currentPlayer = 'black';
        this.updatePlayerNames();
    }

    updatePlayerNames() {
        const aiColor = document.getElementById('aiColor').value;
        if (this.gameMode === 'pve') {
            if (aiColor === 'black') {
                document.getElementById('blackPlayerName').textContent = 'AI (Đen)';
                document.getElementById('whitePlayerName').textContent = 'Người chơi (Trắng)';
            } else {
                document.getElementById('blackPlayerName').textContent = 'Người chơi (Đen)';
                document.getElementById('whitePlayerName').textContent = 'AI (Trắng)';
            }
        } else {
            document.getElementById('blackPlayerName').textContent = 'Người chơi Đen';
            document.getElementById('whitePlayerName').textContent = 'Người chơi Trắng';
        }
    }

    makeMove(row, col) {
        console.log('makeMove - Player turn: ' + this.currentPlayer + ' - Type: ' + this.currentPlayerType);
        if (this.currentPlayerType === 'human' && this.isAIThinking) return; // Return if human clicks while AI is thinking
        if (this.board[row][col] !== null) return;

        // Kiểm tra luật ko
        const tempBoard = this.board.map(row => [...row]);
        tempBoard[row][col] = this.currentPlayer;
        
        if (!this.isValidMove(row, col, tempBoard)) {
            alert('Nước đi không hợp lệ!');
            return;
        }

        // Kiểm tra và bắt quân đối phương
        const opponent = this.currentPlayer === 'black' ? 'white' : 'black';
        const adjacentOpponentGroups = this.getAdjacentGroups(row, col, opponent, this.board);
        let capturedCount = 0;
        
        for (const group of adjacentOpponentGroups) {
            if (!this.hasLiberties(group, this.board)) {
                // Bắt quân
                for (const pos of group) {
                    const [r, c] = pos.split(',').map(Number);
                    this.board[r][c] = null;
                    capturedCount++;
                }
            }
        }

        // Cập nhật số quân bắt được
        this.capturedStones[this.currentPlayer] += capturedCount;

        this.board[row][col] = this.currentPlayer;
        this.history.push({
            row,
            col,
            player: this.currentPlayer
        });

        this.updateBoard();
        this.currentPlayer = this.currentPlayer === 'black' ? 'white' : 'black';
        this.currentPlayerType = this.currentPlayer === document.getElementById('aiColor').value ? 'AI' : 'human';
        this.updateCurrentPlayer();
        this.updateScore();

        // Xử lý nước đi của AI
        if (this.gameMode === 'pve') {
            const aiColor = document.getElementById('aiColor').value;
            if (this.currentPlayer === aiColor) {
                this.isAIThinking = true;
                document.getElementById('board').style.cursor = 'wait';
                setTimeout(() => this.makeAIMove(), 500);
            }
        }
    }

    async makeAIMove() {
        console.log('makeAIMove - AI turn');
        let move;
        let attempts = 0;
        const maxAttempts = this.boardSize * this.boardSize; // Check all possible positions

        do {
            move = await this.ai.makeMove(this.board, this.currentPlayer);
            attempts++;
        } while (move && !this.isValidMove(move[0], move[1], this.board) && attempts < maxAttempts);

        if (move) {
            console.log('makeAIMove - AI move: ' + move);
            const [row, col] = move;
            this.makeMove(row, col);
        } else {
            console.log('makeAIMove - No valid move found after ' + attempts + ' attempts');
            this.endGame(); // End the game if no valid move is found
        }
        this.isAIThinking = false;
        document.getElementById('board').style.cursor = 'default';
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
        const board = document.getElementById('board');
        
        // Xóa tất cả quân cờ cũ
        const stones = board.getElementsByClassName('stone');
        while (stones.length > 0) {
            stones[0].remove();
        }

        // Vẽ lại quân cờ
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (this.board[i][j]) {
                    const stone = document.createElement('div');
                    stone.className = `stone ${this.board[i][j]}`;
                    stone.style.position = 'absolute';
                    stone.style.width = `${this.boardWidth / 10}px`;
                    stone.style.height = `${this.boardWidth / 10}px`;
                    stone.style.borderRadius = '50%';
                    stone.style.backgroundColor = this.board[i][j] === 'black' ? '#000' : '#fff';
                    stone.style.border = '1px solid #000';
                    stone.style.transform = 'translate(-50%, -50%)';
                    stone.style.left = `${(j * 100) / (this.boardSize - 1)}%`;
                    stone.style.top = `${(i * 100) / (this.boardSize - 1)}%`;
                    stone.style.zIndex = '1';
                    board.appendChild(stone);
                }
            }
        }
    }

    updateCurrentPlayer() {
        console.log('updateCurrentPlayer - Player turn: ' + this.currentPlayer + ' - Type: ' + this.currentPlayerType);
        document.getElementById('currentPlayer').textContent = 
            this.currentPlayer === 'black' ? 'Đen' : 'Trắng';
        // Nếu đang playing thì cập nhật lại thông tin lượt
        if (this.state === 'playing') {
            const stateEl = document.getElementById('gameState');
            if (stateEl) {
                stateEl.textContent = 'playing - Đến lượt: ' + (this.currentPlayer === 'black' ? 'Đen' : 'Trắng') + ' (' + this.currentPlayerType + ')';
            }
        }
    }

    newGame() {
        console.log('newGame - Player turn: ' + this.currentPlayer + ' - Type: ' + this.currentPlayerType);
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.currentPlayer = 'black';
        this.history = [];
        this.isAIThinking = false;
        this.capturedStones = { black: 0, white: 0 };
        this.isGameOver = false;
        document.getElementById('board').style.cursor = 'default';
        document.getElementById('board').style.pointerEvents = 'auto';
        this.initializeBoard();
        this.updateCurrentPlayer();
        this.updateScore();
        this.setState('playing');

        // Chọn AI phù hợp dựa vào apiKey
        const apiKeyInput = document.getElementById('apiKey');
        const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';
        if (apiKey) {
            this.ai = new ChatGPTGoAI(apiKey);
            // this.ai.listModels();
            // Gửi 1 message test tới ChatGPT và log kết quả
            this.ai.callChatGPT('Hello AI').then(res => {
                console.log('[ChatGPTGoAI Test]', res);
            }).catch(err => {
                console.error('[ChatGPTGoAI Test Error]', err);
            });
        } else {
            this.ai = new GoAI(); // AI local
            console.log('Hello World!');
        }

        // Xác định aiColor và currentPlayer
        if (this.gameMode === 'pve') {
            console.log('newGame - Player turn: PVE');
            const aiColor = document.getElementById('aiColor').value;
            this.currentPlayer = 'black';
            this.currentPlayerType = aiColor === 'black' ? 'AI' : 'human';
            // Nếu AI là đen, AI đi trước
            if (aiColor === 'black') {
                console.log('newGame - Player turn: PVE - AI is black');
                this.isAIThinking = true;
                // Đợi 500ms trước khi AI đi nước đầu tiên để tạo hiệu ứng "suy nghĩ"
                setTimeout(() => this.makeAIMove(), 500);
            }
        } else {
            console.log('newGame - ' + this.gameMode);
            this.currentPlayer = 'black';
            this.currentPlayerType = 'human';
        }
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

    calculateTerritory() {
        const territory = { black: 0, white: 0 };
        const visited = new Set();

        // Duyệt qua tất cả các điểm trên bàn cờ
        for (let i = 0; i < this.boardSize; i++) {
            for (let j = 0; j < this.boardSize; j++) {
                if (visited.has(`${i},${j}`)) continue;

                if (this.board[i][j] === null) {
                    // Tìm vùng trống và xác định chủ sở hữu
                    const { owner, size } = this.findTerritoryOwner(i, j, visited);
                    if (owner) {
                        territory[owner] += size;
                    }
                } else {
                    // Điểm có quân
                    territory[this.board[i][j]]++;
                }
            }
        }

        return territory;
    }

    findTerritoryOwner(row, col, visited) {
        const queue = [[row, col]];
        const territory = new Set();
        const borders = new Set();
        let size = 0;

        while (queue.length > 0) {
            const [r, c] = queue.shift();
            const key = `${r},${c}`;
            
            if (visited.has(key)) continue;
            visited.add(key);

            if (this.board[r][c] === null) {
                size++;
                territory.add(key);

                // Kiểm tra các ô xung quanh
                const directions = [[1,0], [-1,0], [0,1], [0,-1]];
                for (const [dr, dc] of directions) {
                    const newRow = r + dr;
                    const newCol = c + dc;
                    
                    if (newRow >= 0 && newRow < this.boardSize && 
                        newCol >= 0 && newCol < this.boardSize) {
                        if (this.board[newRow][newCol] === null) {
                            queue.push([newRow, newCol]);
                        } else {
                            borders.add(this.board[newRow][newCol]);
                        }
                    }
                }
            }
        }

        // Nếu vùng trống chỉ giáp với một màu, thuộc về màu đó
        if (borders.size === 1) {
            return { owner: Array.from(borders)[0], size };
        }
        return { owner: null, size: 0 };
    }

    updateScore() {
        const territory = this.calculateTerritory();
        const komi = 6.5; // Điểm komi cho quân trắng

        // Tính tổng điểm = lãnh thổ + số quân bắt được
        const blackScore = territory.black + this.capturedStones.black;
        const whiteScore = territory.white + this.capturedStones.white + komi;

        // Cập nhật hiển thị điểm
        document.getElementById('blackScore').textContent = blackScore.toFixed(1);
        document.getElementById('whiteScore').textContent = whiteScore.toFixed(1);
    }

    endGame() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.setState('ended');
        // Hiển thị popup kết quả
        const modal = document.getElementById('gameResultModal');
        const title = document.getElementById('resultTitle');
        const score = document.getElementById('resultScore');
        if (modal && title && score) {
            // Tính điểm
            const blackScore = parseFloat(document.getElementById('blackScore').textContent);
            const whiteScore = parseFloat(document.getElementById('whiteScore').textContent);
            if (blackScore > whiteScore) {
                title.textContent = 'Đen thắng!';
            } else if (whiteScore > blackScore) {
                title.textContent = 'Trắng thắng!';
            } else {
                title.textContent = 'Hòa!';
            }
            score.textContent = `Điểm - Đen: ${blackScore} | Trắng: ${whiteScore}`;
            modal.style.display = 'flex';
        }
        // Gán sự kiện cho nút OK chỉ 1 lần
        const closeBtn = document.getElementById('closeResult');
        if (closeBtn) {
            closeBtn.onclick = null;
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                this.setState('init');
                this.isGameOver = false;
            }, { once: true });
        }
    }

    getStarPoints() {
        const starPoints = [];
        if (this.boardSize === 19) {
            // 9 sao điểm cho bàn 19x19
            const positions = [3, 9, 15];
            for (const i of positions) {
                for (const j of positions) {
                    starPoints.push([i, j]);
                }
            }
        } else if (this.boardSize === 13) {
            // 5 sao điểm cho bàn 13x13
            const positions = [3, 6, 9];
            for (const i of positions) {
                for (const j of positions) {
                    if ((i === 6 && j === 6) || (i !== 6 && j !== 6)) {
                        starPoints.push([i, j]);
                    }
                }
            }
        } else if (this.boardSize === 9) {
            // 5 sao điểm cho bàn 9x9
            const positions = [2, 4, 6];
            for (const i of positions) {
                for (const j of positions) {
                    if ((i === 4 && j === 4) || (i !== 4 && j !== 4)) {
                        starPoints.push([i, j]);
                    }
                }
            }
        }
        return starPoints;
    }

    setState(newState) {
        this.state = newState;
        const stateEl = document.getElementById('gameState');
        if (stateEl) {
            let text = newState;
            if (newState === 'playing') {
                text += ' - Đến lượt: ' + (this.currentPlayer === 'black' ? 'Đen' : 'Trắng') + ' (' + this.currentPlayerType + ')';
            }
            stateEl.textContent = text;
        }
        // Luôn hiển thị các phần setting
        const gameModeDiv = document.querySelector('.game-mode');
        const boardSizeDiv = document.querySelector('.board-size');
        const aiSettingsDiv = document.querySelector('.ai-settings');
        if (gameModeDiv) gameModeDiv.style.display = '';
        if (boardSizeDiv) boardSizeDiv.style.display = '';
        if (aiSettingsDiv) aiSettingsDiv.style.display = (this.gameMode === 'pve') ? 'block' : 'none';
        this.updatePlayerNames();
    }
}

// Khởi tạo trò chơi khi trang được tải
window.addEventListener('load', () => {
    new GoGame();
}); 