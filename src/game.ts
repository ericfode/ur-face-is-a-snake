import 'phaser';
import * as faceapi from '@vladmandic/face-api/dist/face-api.esm.js';
import tinyFaceDetectorModel from '../public/models/tiny_face_detector_model-weights_manifest.json';
import faceLandmarkModel from '../public/models/face_landmark_68_model-weights_manifest.json';
import faceRecognitionModel from '../public/models/face_recognition_model-weights_manifest.json';
import faceExpressionModel from '../public/models/face_expression_model-weights_manifest.json';


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
    private moveInterval: number = 1000; // Move every 200ms
    private food: { x: number, y: number } | null = null;
    private foodGraphics!: Phaser.GameObjects.Graphics;
    private webcamVideo!: HTMLVideoElement;
    private emotionHistory: string[] = [];
    private emotionHistoryMaxLength = 30; // Adjust this value to change sensitivity
    private lastTurnTime = 0;
    private gameState: 'instructions' | 'playing' = 'instructions';
    private instructionText!: Phaser.GameObjects.Text;
    private biasBar!: Phaser.GameObjects.Graphics;
    private biasValue: number = 0;
    private maxBiasValue: number = 100;
    private minBias: number = 40;

    constructor() {
        super('demo');
    }

    async create() {
        // Initialize the grid
        this.initializeGrid();

        // Draw the grid
        this.drawGrid();

        // Add instruction text
        this.instructionText = this.add.text(
            this.cameras.main.width / 2,
            this.cameras.main.height / 2,
            'UR-FACE-IS-A-SNAKE Instructions:\n\n' +
            '1. Look surprised to start the game\n' +
            '2. Smile to turn right\n' +
            '3. Frown to turn left\n\n' +
            'Look surprised to begin!',
            { color: '#ffffff', fontSize: '24px', align: 'center' }
        ).setOrigin(0.5);

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

        this.input.keyboard!.on('keydown', this.handleKeydown, this);

        // Create the bias bar
        this.biasBar = this.add.graphics();
        this.updateBiasBar();

        // Setup webcam and face detection
        await this.setupWebcam();
        await this.loadFaceApiModels();
        this.startFaceDetection();

        // Don't initialize the game elements yet
        // We'll do this when the game starts
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
        this.snakeGraphics.fillRect(headPos.x - this.cellSize / 2, headPos.y - this.cellSize / 2, this.cellSize, this.cellSize);

        // Draw body
        this.snakeGraphics.fillStyle(0x00cc00); // Darker green for body
        this.snake.body.forEach(segment => {
            const segmentPos = this.gridToScreenPosition(segment.x, segment.y);
            this.snakeGraphics.fillRect(segmentPos.x - this.cellSize / 2, segmentPos.y - this.cellSize / 2, this.cellSize, this.cellSize);
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

        // Reset bias after each movement
        this.biasValue = 0;
        this.updateBiasBar();
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
        if (this.snake) {
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
        this.updateScore();

    }

    private checkCollision(): boolean {
        return this.snake.body.some(segment =>
            segment.x === this.snake.head.x && segment.y === this.snake.head.y
        );
    }

    private async setupWebcam() {
        this.webcamVideo = document.createElement('video');
        this.webcamVideo.style.position = 'absolute';
        this.webcamVideo.style.top = `${this.cameras.main.height}px`;
        this.webcamVideo.style.left = '0px';
        document.body.appendChild(this.webcamVideo);

        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        this.webcamVideo.srcObject = stream;
        await new Promise<void>((resolve) => this.webcamVideo.onloadedmetadata = () => {
            this.webcamVideo.play();
            resolve();
        });
    }

    private async loadFaceApiModels() {
        const modelBaseUrl = '/models';
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelBaseUrl);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelBaseUrl);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelBaseUrl)
        await faceapi.nets.faceExpressionNet.loadFromUri(modelBaseUrl);
    }
    private async startFaceDetection() {
        const canvas = faceapi.createCanvasFromMedia(this.webcamVideo);
        canvas.style.position = 'absolute';
        canvas.style.top = `${this.cameras.main.height}px`;
        canvas.style.left = '0px';
        document.body.appendChild(canvas);

        const displaySize = { width: this.cameras.main.width, height: this.cameras.main.height };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            const detections = await faceapi.detectAllFaces(this.webcamVideo, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceExpressions();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
            faceapi.draw.drawDetections(canvas, resizedDetections);
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

            if (detections.length > 0) {
                const topEmotions = this.getTopKEmotions(detections[0].expressions, 3); // Get top 3 emotions

                if (this.gameState === 'instructions') {
                    if (topEmotions[0] === 'surprised') {
                        this.startGame();
                    }
                } else {
                    // Add the current top emotion to the history
                    for (let i = 0; i < topEmotions.length; i++) {
                        for (let j = 0; j < topEmotions.length - i; j++) {
                            this.emotionHistory.push(topEmotions[i]);
                        }
                    }
                    this.emotionHistory = this.emotionHistory.slice(0, this.emotionHistoryMaxLength);
                    // Start Generation Here
                    const emotionSummary = this.emotionHistory.reduce((acc, emotion) => {
                        acc[emotion] = (acc[emotion] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>);
                    const emotionSummaryText = Object.entries(emotionSummary)
                        .map(([emotion, count]) => `${emotion}: ${count}`)
                        .join(', ');

                    // Update bias based on emotions using emotionSummary with exponential impact
                    if (emotionSummary['happy']) {
                        this.biasValue = Math.min(this.biasValue + Math.pow(1.4, emotionSummary["happy"]) - 1, this.maxBiasValue);
                    }
                    if (emotionSummary['sad']) {
                        this.biasValue = Math.max(this.biasValue - (Math.pow(1.4, emotionSummary["sad"]) - 1), -this.maxBiasValue);
                    }
                    if (emotionSummary['neutral']) {
                        this.biasValue *= 0.9; // Decay the bias value by 10% when neutral
                    }

                    this.updateBiasBar();

                    // Check if it's time for a potential turn
                    const currentTime = Date.now();
                    if (currentTime - this.lastTurnTime >= this.moveInterval) {
                        this.checkEmotionAndTurn();
                        this.lastTurnTime = currentTime;
                        this.emotionHistory = [];
                    }
                }
            }


        }, 100);
    }

    private getTopKEmotions(expressions: faceapi.FaceExpressions, k: number): string[] {
        return Object.entries(expressions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, k)
            .map(entry => entry[0]);
    }

    private checkEmotionAndTurn() {
        if (this.biasValue > this.minBias) {
            this.turnSnake('right');
        } else if (this.biasValue < -this.minBias) {
            this.turnSnake('left');
        }
        // Reset bias after turning
        this.biasValue = 0;
        this.updateBiasBar();
    }

    private startGame() {
        this.gameState = 'playing';
        this.instructionText.destroy();
        this.resetGame();
        this.spawnFood();
    }

    private updateBiasBar() {
        const barWidth = this.cameras.main.width - 40; // 20px padding on each side
        const barHeight = 20;
        const barY = this.cameras.main.height - barHeight - 10; // 10px from bottom

        this.biasBar.clear();

        // Draw background
        this.biasBar.fillStyle(0x666666);
        this.biasBar.fillRect(20, barY, barWidth, barHeight);

        // Draw bias
        const biasWidth = Math.abs(this.biasValue) / this.maxBiasValue * (barWidth / 2);
        if (this.biasValue < 0) {
            // Left bias (frowning)
            this.biasBar.fillStyle(0xff0000);
            this.biasBar.fillRect(20 + barWidth / 2 - biasWidth, barY, biasWidth, barHeight);
        } else {
            // Right bias (smiling)
            this.biasBar.fillStyle(0x00ff00);
            this.biasBar.fillRect(20 + barWidth / 2, barY, biasWidth, barHeight);
        }

        // Draw center line
        this.biasBar.fillStyle(0xffffff);
        this.biasBar.fillRect(20 + barWidth / 2 - 1, barY, 2, barHeight);

        // Draw minimum active bias lines
        const minActiveBiasWidth = this.minBias / this.maxBiasValue * (barWidth / 2); // Assuming 10 as the minimum active bias
        this.biasBar.fillStyle(0xffffff);
        this.biasBar.fillRect(20 + barWidth / 2 - minActiveBiasWidth, barY, 1, barHeight); // Left side
        this.biasBar.fillRect(20 + barWidth / 2 + minActiveBiasWidth, barY, 1, barHeight); // Right side
    }
    update(time: number) {
        if (this.gameState === 'playing') {
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
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 20 * 32,  // gridSize.width * cellSize
    height: 15 * 32, // gridSize.height * cellSize
    scene: Demo
};

const game = new Phaser.Game(config);
