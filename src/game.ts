import 'phaser';

export default class Demo extends Phaser.Scene {
    private scoreText!: Phaser.GameObjects.Text;
    private highScoreText!: Phaser.GameObjects.Text;
    private deathsText!: Phaser.GameObjects.Text;
    private highScore: number = 0;
    private deaths: number = 0;
    private playerScore: number = 0;
    private grid: boolean[][] = [];
    private gridSize = { width: 20, height: 15 }; // Adjust as needed
    private cellSize = 32; // Size of each grid cell in pixels
    private snake!: {
        head: { x: number, y: number },
        body: { x: number, y: number }[]
    };
    private snakeGraphics!: Phaser.GameObjects.Graphics;
    private direction: 'up' | 'down' | 'left' | 'right' = 'right';
    private moveTimer: number = 0;
    private moveInterval: number = 200; // Move every 200ms
    private food: { x: number, y: number } | null = null;
    private foodGraphics!: Phaser.GameObjects.Graphics;

    constructor() {
        super('demo');
    }

    create() {
        // Initialize the grid
        this.initializeGrid();

        // Draw the grid
        this.drawGrid();

        // Add score and high score text
        this.scoreText = this.add.text(
            this.cameras.main.width - 20, 
            20, 
            'Score: 3', 
            { color: '#ffffff', fontSize: '24px' }
        ).setOrigin(1, 0);

        this.highScoreText = this.add.text(
            this.cameras.main.width - 20, 
            50, 
            `High Score: ${this.highScore}`, 
            { color: '#ffffff', fontSize: '24px' }
        ).setOrigin(1, 0);

        this.deathsText = this.add.text(
            this.cameras.main.width - 20, 
            80, 
            `Deaths: ${this.deaths}`, 
            { color: '#ffffff', fontSize: '24px' }
        ).setOrigin(1, 0);

        this.resetGame();

        this.input.keyboard!.on('keydown', this.handleKeydown, this);
    }

    private initializeGrid() {
        for (let y = 0; y < this.gridSize.height; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridSize.width; x++) {
                this.grid[y][x] = false; // false means empty cell
            }
        }
    }

    private drawGrid() {
        const graphics = this.add.graphics();
        const lineColor = 0x333333; // Dark gray color
        const lineThickness = 2;
        const fadeWidth = 1; // Width of the fade effect on each side of the line

        // Function to draw a single line with fade effect
        const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
            // Draw main line
            graphics.lineStyle(lineThickness, lineColor, 1);
            graphics.beginPath();
            graphics.moveTo(x1, y1);
            graphics.lineTo(x2, y2);
            graphics.strokePath();

            // Draw fade effect
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const dx = Math.cos(angle) * fadeWidth;
            const dy = Math.sin(angle) * fadeWidth;

            for (let i = 1; i <= fadeWidth; i++) {
                const alpha = 1 - (i / (fadeWidth + 1));
                graphics.lineStyle(1, lineColor, alpha);
                
                graphics.beginPath();
                graphics.moveTo(x1 + dx * i, y1 + dy * i);
                graphics.lineTo(x2 + dx * i, y2 + dy * i);
                graphics.strokePath();

                graphics.beginPath();
                graphics.moveTo(x1 - dx * i, y1 - dy * i);
                graphics.lineTo(x2 - dx * i, y2 - dy * i);
                graphics.strokePath();
            }
        };

        // Draw vertical lines
        for (let x = 0; x <= this.gridSize.width; x++) {
            const xPos = x * this.cellSize;
            drawLine(xPos, 0, xPos, this.gridSize.height * this.cellSize);
        }

        // Draw horizontal lines
        for (let y = 0; y <= this.gridSize.height; y++) {
            const yPos = y * this.cellSize;
            drawLine(0, yPos, this.gridSize.width * this.cellSize, yPos);
        }
    }

    // Helper method to convert grid coordinates to screen coordinates
    private gridToScreenPosition(gridX: number, gridY: number): { x: number, y: number } {
        return {
            x: gridX * this.cellSize + this.cellSize / 2,
            y: gridY * this.cellSize + this.cellSize / 2
        };
    }

    private initializeSnake() {
        const middleX = Math.floor(this.gridSize.width / 2);
        const middleY = Math.floor(this.gridSize.height / 2);
        this.snakeGraphics = this.add.graphics();
        
        this.snake = {
            head: { x: middleX, y: middleY },
            body: [
                { x: middleX - 1, y: middleY },
                { x: middleX - 2, y: middleY }
            ]
        };
    }

    private drawSnake() {
        this.snakeGraphics.clear();

        // Draw head
        this.snakeGraphics.fillStyle(0x00ff00); // Green for head
        const headPos = this.gridToScreenPosition(this.snake.head.x, this.snake.head.y);
        this.snakeGraphics.fillRect(headPos.x - this.cellSize/2, headPos.y - this.cellSize/2, this.cellSize, this.cellSize);

        // Draw body
        this.snakeGraphics.fillStyle(0x00cc00); // Darker green for body
        this.snake.body.forEach(segment => {
            const segmentPos = this.gridToScreenPosition(segment.x, segment.y);
            this.snakeGraphics.fillRect(segmentPos.x - this.cellSize/2, segmentPos.y - this.cellSize/2, this.cellSize, this.cellSize);
        });
    }

    private handleKeydown(event: KeyboardEvent) {
        switch (event.code) {
            case 'ArrowUp':
                this.turnSnake('forward');
                break;
            case 'ArrowLeft':
                this.turnSnake('left');
                break;
            case 'ArrowRight':
                this.turnSnake('right');
                break;
        }
    }

    private turnSnake(turn: 'forward' | 'left' | 'right') {
        const directions: ('up' | 'down' | 'left' | 'right')[] = ['up', 'right', 'down', 'left'];
        let index = directions.indexOf(this.direction);
        
        if (turn === 'left') {
            index = (index - 1 + 4) % 4;
        } else if (turn === 'right') {
            index = (index + 1) % 4;
        }
        
        this.direction = directions[index];
    }

    private moveSnake() {
        // Move body
        for (let i = this.snake.body.length - 1; i > 0; i--) {
            this.snake.body[i].x = this.snake.body[i - 1].x;
            this.snake.body[i].y = this.snake.body[i - 1].y;
        }
        // Move first body segment to current head position
        this.snake.body[0].x = this.snake.head.x;
        this.snake.body[0].y = this.snake.head.y;
        // Move head
        switch (this.direction) {
            case 'up':
                this.snake.head.y--;
                break;
            case 'down':
                this.snake.head.y++;
                break;
            case 'left':
                this.snake.head.x--;
                break;
            case 'right':
                this.snake.head.x++;
                break;
        }

        // Wrap around screen edges
        this.snake.head.x = (this.snake.head.x + this.gridSize.width) % this.gridSize.width;
        this.snake.head.y = (this.snake.head.y + this.gridSize.height) % this.gridSize.height;

        // Check for food consumption
        if (this.food && this.snake.head.x === this.food.x && this.snake.head.y === this.food.y) {
            // Grow the snake
            const tail = this.getSnakeEnd();
            this.snake.body.push({ ...tail });
            // Spawn new food
            this.spawnFood();
            // Update score
            this.updateScore();
        }

        // Check for collision with self
        if (this.checkCollision()) {
            this.deaths++;
            this.deathsText.setText(`Deaths: ${this.deaths}`);
            this.resetGame();
            return;
        }
    }

    private getSnakeEnd(): { x: number, y: number } {
        return this.snake.body[this.snake.body.length - 1];
    }

    private spawnFood() {
        do {
            this.food = {
                x: Math.floor(Math.random() * this.gridSize.width),
                y: Math.floor(Math.random() * this.gridSize.height)
            };
        } while (this.isSnakeOccupying(this.food.x, this.food.y));
        if (!this.foodGraphics) {
            this.foodGraphics = this.add.graphics();
        }
        this.drawFood();
    }

    private isSnakeOccupying(x: number, y: number): boolean {
        if (this.snake.head.x === x && this.snake.head.y === y) return true;
        return this.snake.body.some(segment => segment.x === x && segment.y === y);
    }

    private drawFood() {
        if (!this.food) return;
        this.foodGraphics.clear();
        this.foodGraphics.fillStyle(0xff0000); // Red color for food
        const foodPos = this.gridToScreenPosition(this.food.x, this.food.y);
        this.foodGraphics.fillCircle(foodPos.x, foodPos.y, this.cellSize / 2);
    }

    private updateScore() {
        const score = this.snake.body.length + 1;
        this.scoreText.setText(`Score: ${score}`);
    }

    private updateHighScore() {
        if (this.snake){
        const currentScore = this.snake.body.length + 1;
        if (currentScore > this.highScore) {
            this.highScore = currentScore;
            this.highScoreText.setText(`High Score: ${this.highScore}`);
            }
        }
    }

    private resetGame() {
        if (this.snakeGraphics) {
            this.snakeGraphics.clear();
        }
        if (this.foodGraphics) {
            this.foodGraphics.clear();
        }


        this.updateHighScore();
        this.initializeSnake();
        this.direction = 'right';
        this.spawnFood();
        this.updateScore();

    }

    private checkCollision(): boolean {
        return this.snake.body.some(segment => 
            segment.x === this.snake.head.x && segment.y === this.snake.head.y
        );
    }

    update(time: number) {
        // Game loop
        if (time > this.moveTimer) {
            this.moveSnake();
            this.moveTimer = time + this.moveInterval;
            this.updateScore();
        }
        this.drawSnake(); // Redraw snake every frame
        this.drawFood();
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 20 * 32,  // gridSize.width * cellSize
    height: 15 * 32, // gridSize.height * cellSize
    scene: Demo
};

const game = new Phaser.Game(config);
