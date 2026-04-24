const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const NEXT_BLOCK_SIZE = 25;

const COLORS = [
    null,
    '#00f5ff',
    '#0066ff',
    '#ffa500',
    '#ffff00',
    '#00ff00',
    '#8b00ff',
    '#ff0000'
];

const SHAPES = [
    null,
    [[1, 1, 1, 1]],
    [[2, 0, 0], [2, 2, 2]],
    [[0, 0, 3], [3, 3, 3]],
    [[4, 4], [4, 4]],
    [[0, 5, 5], [5, 5, 0]],
    [[0, 6, 0], [6, 6, 6]],
    [[7, 7, 0], [0, 7, 7]]
];

let gameCanvas, gameCtx;
let nextCanvas, nextCtx;
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let level = 1;
let gameLoop = null;
let isGameOver = false;
let isClearMode = false;
let isMouseDown = false;
let lastMousePos = { row: -1, col: -1 };

function init() {
    gameCanvas = document.getElementById('gameCanvas');
    gameCtx = gameCanvas.getContext('2d');
    nextCanvas = document.getElementById('nextCanvas');
    nextCtx = nextCanvas.getContext('2d');
    
    resetGame();
    setupEventListeners();
    updateUI();
}

function resetGame() {
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    score = 0;
    level = 1;
    isGameOver = false;
    isClearMode = false;
    
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
        gameLoop = null;
    }
    
    hideOverlay();
    updateStatus('准备开始游戏...');
    updateModeDisplay();
    nextPiece = createPiece();
    spawnPiece();
}

function createPiece() {
    const type = Math.floor(Math.random() * 7) + 1;
    return {
        type: type,
        shape: SHAPES[type].map(row => [...row]),
        x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
        y: 0,
        color: COLORS[type]
    };
}

function spawnPiece() {
    currentPiece = nextPiece;
    nextPiece = createPiece();
    currentPiece.x = Math.floor(COLS / 2) - Math.ceil(currentPiece.shape[0].length / 2);
    currentPiece.y = 0;
    
    drawNextPiece();
    
    if (checkCollision(currentPiece)) {
        enterClearMode();
    } else {
        startGameLoop();
    }
}

function startGameLoop() {
    if (gameLoop) return;
    
    let dropCounter = 0;
    let lastTime = 0;
    const dropInterval = Math.max(100, 1000 - (level - 1) * 100);
    
    function update(time) {
        if (isGameOver || isClearMode) return;
        
        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;
        
        if (dropCounter > dropInterval) {
            moveDown();
            dropCounter = 0;
        }
        
        draw();
        gameLoop = requestAnimationFrame(update);
    }
    
    gameLoop = requestAnimationFrame(update);
}

function moveDown() {
    if (isClearMode) return;
    
    currentPiece.y++;
    
    if (checkCollision(currentPiece)) {
        currentPiece.y--;
        lockPiece();
        clearLines();
        spawnPiece();
    }
}

function checkCollision(piece, offsetX = 0, offsetY = 0) {
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                const newX = piece.x + col + offsetX;
                const newY = piece.y + row + offsetY;
                
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                if (newY >= 0 && board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

function moveLeft() {
    if (isClearMode) return;
    if (!checkCollision(currentPiece, -1, 0)) {
        currentPiece.x--;
    }
}

function moveRight() {
    if (isClearMode) return;
    if (!checkCollision(currentPiece, 1, 0)) {
        currentPiece.x++;
    }
}

function rotate() {
    if (isClearMode) return;
    
    const rotated = currentPiece.shape[0].map((_, i) =>
        currentPiece.shape.map(row => row[i]).reverse()
    );
    
    const originalShape = currentPiece.shape;
    currentPiece.shape = rotated;
    
    const kicks = [0, -1, 1, -2, 2];
    let valid = false;
    
    for (const kick of kicks) {
        if (!checkCollision(currentPiece, kick, 0)) {
            currentPiece.x += kick;
            valid = true;
            break;
        }
    }
    
    if (!valid) {
        currentPiece.shape = originalShape;
    }
}

function hardDrop() {
    if (isClearMode) return;
    
    while (!checkCollision(currentPiece, 0, 1)) {
        currentPiece.y++;
        score += 2;
    }
    
    lockPiece();
    clearLines();
    updateUI();
    spawnPiece();
}

function lockPiece() {
    for (let row = 0; row < currentPiece.shape.length; row++) {
        for (let col = 0; col < currentPiece.shape[row].length; col++) {
            if (currentPiece.shape[row][col]) {
                const boardY = currentPiece.y + row;
                const boardX = currentPiece.x + col;
                
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.type;
                }
            }
        }
    }
}

function clearLines() {
    let linesCleared = 0;
    
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row].every(cell => cell !== 0)) {
            board.splice(row, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            row++;
        }
    }
    
    if (linesCleared > 0) {
        const points = [0, 100, 300, 500, 800];
        score += points[linesCleared] * level;
        level = Math.floor(score / 1000) + 1;
        updateUI();
    }
}

function enterClearMode() {
    isClearMode = true;
    updateModeDisplay();
    updateStatus('进入消除模式！按住鼠标左键拖动消除方块');
    showOverlay('消除模式', '按住鼠标左键拖动消除方块');
    draw();
}

function clearBlockAt(row, col) {
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
        if (board[row][col] !== 0) {
            board[row][col] = 0;
            return true;
        }
    }
    return false;
}

function dropBlocksAfterClear() {
    let somethingDropped = true;
    let totalDropped = false;
    
    while (somethingDropped) {
        somethingDropped = false;
        
        for (let row = ROWS - 2; row >= 0; row--) {
            for (let col = 0; col < COLS; col++) {
                if (board[row][col] !== 0 && board[row + 1][col] === 0) {
                    let dropRow = row;
                    while (dropRow + 1 < ROWS && board[dropRow + 1][col] === 0) {
                        dropRow++;
                    }
                    
                    board[dropRow][col] = board[row][col];
                    board[row][col] = 0;
                    somethingDropped = true;
                    totalDropped = true;
                }
            }
        }
    }
    
    return totalDropped;
}

function checkAndClearFullLines() {
    let linesCleared = 0;
    
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row].every(cell => cell !== 0)) {
            board.splice(row, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            row++;
        }
    }
    
    if (linesCleared > 0) {
        const points = [0, 50, 150, 250, 400];
        score += points[linesCleared] * level;
        updateUI();
        updateStatus(`消除了 ${linesCleared} 行！`);
    }
    
    return linesCleared > 0;
}

function checkGameResumable() {
    let hasSpace = false;
    
    for (let col = 0; col < COLS; col++) {
        if (board[0][col] === 0 && board[1][col] === 0) {
            hasSpace = true;
            break;
        }
    }
    
    if (hasSpace) {
        isClearMode = false;
        hideOverlay();
        updateModeDisplay();
        updateStatus('消除成功！继续游戏...');
        spawnPiece();
    }
}

function draw() {
    gameCtx.fillStyle = '#1a1a2e';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    drawGrid();
    drawBoard();
    
    if (!isClearMode && currentPiece) {
        drawPiece(currentPiece);
        drawGhostPiece();
    }
}

function drawGrid() {
    gameCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    gameCtx.lineWidth = 1;
    
    for (let row = 0; row <= ROWS; row++) {
        gameCtx.beginPath();
        gameCtx.moveTo(0, row * BLOCK_SIZE);
        gameCtx.lineTo(gameCanvas.width, row * BLOCK_SIZE);
        gameCtx.stroke();
    }
    
    for (let col = 0; col <= COLS; col++) {
        gameCtx.beginPath();
        gameCtx.moveTo(col * BLOCK_SIZE, 0);
        gameCtx.lineTo(col * BLOCK_SIZE, gameCanvas.height);
        gameCtx.stroke();
    }
}

function drawBoard() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) {
                drawBlock(gameCtx, col, row, COLORS[board[row][col]], BLOCK_SIZE);
            }
        }
    }
}

function drawPiece(piece) {
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                const x = piece.x + col;
                const y = piece.y + row;
                
                if (y >= 0) {
                    drawBlock(gameCtx, x, y, piece.color, BLOCK_SIZE);
                }
            }
        }
    }
}

function drawGhostPiece() {
    const ghostPiece = {
        x: currentPiece.x,
        y: currentPiece.y,
        shape: currentPiece.shape
    };
    
    while (!checkCollision(ghostPiece, 0, 1)) {
        ghostPiece.y++;
    }
    
    gameCtx.globalAlpha = 0.3;
    for (let row = 0; row < ghostPiece.shape.length; row++) {
        for (let col = 0; col < ghostPiece.shape[row].length; col++) {
            if (ghostPiece.shape[row][col]) {
                const x = ghostPiece.x + col;
                const y = ghostPiece.y + row;
                
                if (y >= 0) {
                    drawBlock(gameCtx, x, y, currentPiece.color, BLOCK_SIZE);
                }
            }
        }
    }
    gameCtx.globalAlpha = 1;
}

function drawNextPiece() {
    nextCtx.fillStyle = '#1a1a2e';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    const shape = nextPiece.shape;
    const offsetX = (nextCanvas.width - shape[0].length * NEXT_BLOCK_SIZE) / 2;
    const offsetY = (nextCanvas.height - shape.length * NEXT_BLOCK_SIZE) / 2;
    
    for (let row = 0; row < shape.length; row++) {
        for (let col = 0; col < shape[row].length; col++) {
            if (shape[row][col]) {
                const x = offsetX + col * NEXT_BLOCK_SIZE;
                const y = offsetY + row * NEXT_BLOCK_SIZE;
                drawBlockAtPosition(nextCtx, x, y, nextPiece.color, NEXT_BLOCK_SIZE);
            }
        }
    }
}

function drawBlock(ctx, col, row, color, size) {
    const x = col * size;
    const y = row * size;
    drawBlockAtPosition(ctx, x, y, color, size);
}

function drawBlockAtPosition(ctx, x, y, color, size) {
    const padding = 1;
    
    ctx.fillStyle = color;
    ctx.fillRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x + padding, y + padding, size - padding * 2, (size - padding * 2) / 3);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + padding, y + padding, size - padding * 2, size - padding * 2);
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
}

function updateModeDisplay() {
    const modeDisplay = document.getElementById('modeDisplay');
    if (isClearMode) {
        modeDisplay.textContent = '消除模式';
        modeDisplay.className = 'mode-display clear';
    } else {
        modeDisplay.textContent = '游戏中';
        modeDisplay.className = 'mode-display normal';
    }
}

function updateStatus(text) {
    const statusText = document.getElementById('statusText');
    statusText.textContent = text;
    statusText.style.animation = 'none';
    statusText.offsetHeight;
    statusText.style.animation = 'fadeIn 0.5s ease-in';
}

function showOverlay(title, text) {
    const overlay = document.getElementById('gameOverlay');
    const overlayTitle = document.getElementById('overlayTitle');
    const overlayText = document.getElementById('overlayText');
    
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlay.classList.add('active');
}

function hideOverlay() {
    const overlay = document.getElementById('gameOverlay');
    overlay.classList.remove('active');
}

function setupEventListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            if (isGameOver) {
                resetGame();
            } else if (!isClearMode) {
                hardDrop();
            }
            return;
        }
        
        if (isClearMode) return;
        
        switch (e.code) {
            case 'ArrowLeft':
                moveLeft();
                break;
            case 'ArrowRight':
                moveRight();
                break;
            case 'ArrowUp':
                rotate();
                break;
            case 'ArrowDown':
                moveDown();
                score += 1;
                updateUI();
                break;
        }
    });
    
    gameCanvas.addEventListener('mousedown', handleMouseDown);
    gameCanvas.addEventListener('mousemove', handleMouseMove);
    gameCanvas.addEventListener('mouseup', handleMouseUp);
    gameCanvas.addEventListener('mouseleave', handleMouseUp);
    
    gameCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = gameCanvas.getBoundingClientRect();
        handleMouseDown({
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: gameCanvas
        });
    });
    
    gameCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        handleMouseMove({
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: gameCanvas
        });
    });
    
    gameCanvas.addEventListener('touchend', handleMouseUp);
}

function getBoardPosition(e) {
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = gameCanvas.width / rect.width;
    const scaleY = gameCanvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const col = Math.floor(x / BLOCK_SIZE);
    const row = Math.floor(y / BLOCK_SIZE);
    
    return { row, col };
}

function handleMouseDown(e) {
    if (!isClearMode) return;
    
    isMouseDown = true;
    const pos = getBoardPosition(e);
    lastMousePos = pos;
    
    if (clearBlockAt(pos.row, pos.col)) {
        score += 10;
        updateUI();
    }
    draw();
}

function handleMouseMove(e) {
    if (!isClearMode || !isMouseDown) return;
    
    const pos = getBoardPosition(e);
    
    if (pos.row !== lastMousePos.row || pos.col !== lastMousePos.col) {
        lastMousePos = pos;
        
        if (clearBlockAt(pos.row, pos.col)) {
            score += 10;
            updateUI();
        }
        draw();
    }
}

function handleMouseUp(e) {
    if (!isClearMode) return;
    
    isMouseDown = false;
    
    let blocksDropped = true;
    while (blocksDropped) {
        blocksDropped = dropBlocksAfterClear();
        draw();
        
        while (checkAndClearFullLines()) {
            draw();
            blocksDropped = true;
        }
    }
    
    checkGameResumable();
}

window.onload = init;
