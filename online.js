const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const GROUND_Y = 460;
const GRAVITY = 0.6;
const MOVE_SPEED = 3.5;
const JUMP_FORCE = -12;
const ATTACK_RANGE = 70;
const ATTACK_DAMAGE = 10;
const DEFENSE_REDUCTION = 0.3;
const ATTACK_COOLDOWN = 25;
const HURT_DURATION = 12;
const KNOCKBACK = 6;

const GamePhase = {
    MENU: 'menu',
    WAITING: 'waiting',
    READY: 'ready',
    FIGHTING: 'fighting',
    GAMEOVER: 'gameover'
};

let ws = null;
let mySide = null;
let roomCode = null;
let serverAddress = 'localhost:8765';
let lastPingTime = 0;
let ping = 0;
let syncInterval = null;

const keys = {};

const game = {
    phase: GamePhase.MENU,
    p1: null,
    p2: null,
    winner: null,
    time: 99,
    timeCounter: 0,
    effects: [],
    particles: [],
    screenShake: 0,
    frameCount: 0,
    isOnline: true
};

class Mech {
    constructor(id, x, color, secondaryColor) {
        this.id = id;
        this.x = x;
        this.y = GROUND_Y;
        this.velocityX = 0;
        this.velocityY = 0;
        this.width = 40;
        this.height = 60;
        this.facingRight = id === 'p1';
        this.health = 100;
        this.maxHealth = 100;
        this.isJumping = false;
        this.isAttacking = false;
        this.isDefending = false;
        this.isHurt = false;
        this.attackCooldown = 0;
        this.hurtTimer = 0;
        this.attackFrame = 0;
        this.animTimer = 0;
        this.animFrame = 0;
        this.animState = 'idle';
        this.color = color;
        this.secondaryColor = secondaryColor;
        this.walkBob = 0;
    }

    update(leftKey, rightKey, jumpKey, attackKey, defendKey, opponent) {
        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.hurtTimer > 0) {
            this.hurtTimer--;
            if (this.hurtTimer === 0) {
                this.isHurt = false;
            }
        }

        let moving = false;
        this.velocityX = 0;

        if (!this.isHurt && !this.isAttacking) {
            if (keys[leftKey]) {
                this.velocityX = -MOVE_SPEED;
                this.facingRight = false;
                moving = true;
            }
            if (keys[rightKey]) {
                this.velocityX = MOVE_SPEED;
                this.facingRight = true;
                moving = true;
            }
        }

        this.isDefending = keys[defendKey] && !this.isHurt && !this.isAttacking && !this.isJumping;

        if (keys[jumpKey] && !this.isJumping && !this.isHurt && !this.isAttacking) {
            this.velocityY = JUMP_FORCE;
            this.isJumping = true;
            createDustParticles(this.x, this.y + this.height, this.color);
        }

        if (keys[attackKey] && this.attackCooldown === 0 && !this.isHurt && !this.isDefending) {
            this.isAttacking = true;
            this.attackFrame = 0;
            this.attackCooldown = ATTACK_COOLDOWN;
        }

        if (this.isAttacking) {
            this.attackFrame++;
            if (this.attackFrame === 8) {
                this.performAttack(opponent);
            }
            if (this.attackFrame >= 18) {
                this.isAttacking = false;
            }
        }

        if (this.isJumping) {
            this.animState = 'jump';
        } else if (this.isAttacking) {
            this.animState = 'attack';
        } else if (this.isDefending) {
            this.animState = 'defend';
        } else if (this.isHurt) {
            this.animState = 'hurt';
        } else if (moving) {
            this.animState = 'walk';
        } else {
            this.animState = 'idle';
        }

        this.animTimer++;
        if (this.animTimer >= 6) {
            this.animTimer = 0;
            this.animFrame = (this.animFrame + 1) % 4;
        }

        if (moving && !this.isJumping) {
            this.walkBob = Math.sin(this.animFrame * Math.PI / 2) * 2;
        } else {
            this.walkBob = 0;
        }

        this.velocityY += GRAVITY;
        this.x += this.velocityX;
        this.y += this.velocityY;

        if (this.x < this.width / 2) this.x = this.width / 2;
        if (this.x > CANVAS_WIDTH - this.width / 2) this.x = CANVAS_WIDTH - this.width / 2;

        if (this.y >= GROUND_Y) {
            if (this.isJumping && this.velocityY > 5) {
                createDustParticles(this.x, GROUND_Y + this.height / 2, this.color);
            }
            this.y = GROUND_Y;
            this.velocityY = 0;
            this.isJumping = false;
        }
    }

    performAttack(opponent) {
        const attackX = this.facingRight ? this.x + this.width / 2 : this.x - this.width / 2;
        const dist = Math.abs(attackX - opponent.x);
        
        const facingOpponent = (this.facingRight && opponent.x > this.x) || 
                               (!this.facingRight && opponent.x < this.x);

        if (dist < ATTACK_RANGE && facingOpponent && !opponent.isHurt) {
            let damage = ATTACK_DAMAGE;
            if (opponent.isDefending) {
                damage = Math.floor(damage * DEFENSE_REDUCTION);
                createDefenseSpark(opponent.x, opponent.y - 20, opponent.color);
            } else {
                createHitSpark(opponent.x, opponent.y - 20);
            }
            opponent.takeDamage(damage, this.facingRight ? 1 : -1);
            game.screenShake = opponent.isDefending ? 3 : 6;
        }

        createAttackEffect(attackX, this.y - 20, this.facingRight, this.color);
    }

    takeDamage(damage, knockbackDir) {
        this.health = Math.max(0, this.health - damage);
        this.isHurt = true;
        this.hurtTimer = HURT_DURATION;
        this.velocityX = knockbackDir * KNOCKBACK;
        if (!this.isJumping) {
            this.velocityY = -3;
        }
    }

    setState(state) {
        this.x = state.x || this.x;
        this.y = state.y || this.y;
        this.velocityX = state.velocityX || 0;
        this.velocityY = state.velocityY || 0;
        this.facingRight = state.facingRight || this.facingRight;
        this.health = state.health || this.health;
        this.isJumping = state.isJumping || false;
        this.isAttacking = state.isAttacking || false;
        this.isDefending = state.isDefending || false;
        this.isHurt = state.isHurt || false;
        this.attackCooldown = state.attackCooldown || 0;
        this.hurtTimer = state.hurtTimer || 0;
        this.attackFrame = state.attackFrame || 0;
        this.animState = state.animState || 'idle';
    }

    getState() {
        return {
            x: this.x,
            y: this.y,
            velocityX: this.velocityX,
            velocityY: this.velocityY,
            facingRight: this.facingRight,
            health: this.health,
            isJumping: this.isJumping,
            isAttacking: this.isAttacking,
            isDefending: this.isDefending,
            isHurt: this.isHurt,
            attackCooldown: this.attackCooldown,
            hurtTimer: this.hurtTimer,
            attackFrame: this.attackFrame,
            animState: this.animState
        };
    }

    draw(ctx) {
        ctx.save();
        const drawX = Math.floor(this.x);
        const drawY = Math.floor(this.y - this.walkBob);

        if (this.isHurt && Math.floor(this.hurtTimer / 2) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        ctx.translate(drawX, drawY - this.height / 2);
        if (!this.facingRight) {
            ctx.scale(-1, 1);
        }

        this.drawMechBody(ctx);
        
        if (this.isDefending) {
            this.drawShield(ctx);
        }

        ctx.restore();
    }

    drawMechBody(ctx) {
        const col = this.color;
        const colDark = this.secondaryColor;
        const colLight = this.lightenColor(col, 30);
        const eyeColor = '#ffd93d';
        
        let armOffsetX = 0;
        let armOffsetY = 0;
        let legOffset = 0;

        if (this.animState === 'walk') {
            legOffset = Math.sin(this.animFrame * Math.PI / 2) * 4;
        }
        if (this.animState === 'attack') {
            armOffsetX = this.attackFrame < 8 ? this.attackFrame * 2 : (18 - this.attackFrame) * 1.5;
            armOffsetY = this.attackFrame < 8 ? -this.attackFrame * 0.5 : -(18 - this.attackFrame) * 0.3;
        }
        if (this.animState === 'jump') {
            legOffset = -3;
        }

        ctx.fillStyle = colDark;
        ctx.fillRect(-18, 25 - legOffset, 12, 15);
        ctx.fillRect(6, 25 + legOffset, 12, 15);

        ctx.fillStyle = col;
        ctx.fillRect(-16, 23 - legOffset, 8, 12);
        ctx.fillRect(8, 23 + legOffset, 8, 12);

        ctx.fillStyle = '#333';
        ctx.fillRect(-18, 36 - legOffset, 12, 6);
        ctx.fillRect(6, 36 + legOffset, 12, 6);

        ctx.fillStyle = colDark;
        ctx.fillRect(-20, -10, 40, 38);
        
        ctx.fillStyle = col;
        ctx.fillRect(-16, -6, 32, 30);
        
        ctx.fillStyle = colLight;
        ctx.fillRect(-14, -4, 28, 8);
        
        ctx.fillStyle = colDark;
        ctx.fillRect(-8, 6, 16, 12);
        ctx.fillStyle = col;
        ctx.fillRect(-6, 8, 12, 8);

        ctx.fillStyle = colDark;
        ctx.fillRect(-14, -28, 28, 22);
        
        ctx.fillStyle = col;
        ctx.fillRect(-12, -26, 24, 18);

        ctx.fillStyle = '#222';
        ctx.fillRect(-8, -22, 16, 8);
        
        ctx.fillStyle = eyeColor;
        ctx.fillRect(2, -20, 6, 4);
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(4, -20, 2, 2);

        ctx.fillStyle = colDark;
        ctx.fillRect(-4, -34, 8, 8);
        ctx.fillStyle = '#ff4757';
        ctx.fillRect(-2, -32, 4, 4);

        const armX = 16 + armOffsetX;
        const armY = -2 + armOffsetY;

        if (this.animState === 'attack' && this.attackFrame >= 5 && this.attackFrame <= 14) {
            ctx.fillStyle = colDark;
            ctx.fillRect(16, -8 + armOffsetY, 10 + armOffsetX, 12);
            ctx.fillStyle = col;
            ctx.fillRect(18, -6 + armOffsetY, 6 + armOffsetX, 8);
            
            ctx.fillStyle = '#555';
            ctx.fillRect(26 + armOffsetX, -10 + armOffsetY, 16, 16);
            ctx.fillStyle = '#777';
            ctx.fillRect(28 + armOffsetX, -8 + armOffsetY, 12, 12);
            ctx.fillStyle = '#ffd93d';
            ctx.fillRect(32 + armOffsetX, -4 + armOffsetY, 8, 4);
            
            if (this.attackFrame >= 7 && this.attackFrame <= 10) {
                ctx.fillStyle = 'rgba(255, 217, 61, 0.6)';
                ctx.beginPath();
                ctx.arc(42 + armOffsetX, -2 + armOffsetY, 12 + this.attackFrame, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            ctx.fillStyle = colDark;
            ctx.fillRect(16, -2, 10, 16);
            ctx.fillStyle = col;
            ctx.fillRect(18, 0, 6, 12);
            ctx.fillStyle = '#555';
            ctx.fillRect(16, 12, 10, 8);
        }

        if (this.animState !== 'attack') {
            ctx.fillStyle = colDark;
            ctx.fillRect(-26, -2, 10, 16);
            ctx.fillStyle = col;
            ctx.fillRect(-24, 0, 6, 12);
            ctx.fillStyle = '#555';
            ctx.fillRect(-26, 12, 10, 8);
        }

        if (this.isDefending) {
            ctx.fillStyle = colDark;
            ctx.fillRect(-30, -15, 8, 30);
            ctx.fillStyle = col;
            ctx.fillRect(-28, -13, 4, 26);
            ctx.fillStyle = colLight;
            ctx.fillRect(-27, -10, 2, 20);
        }
    }

    drawShield(ctx) {
        const shieldGlow = 0.4 + Math.sin(game.frameCount * 0.2) * 0.2;
        ctx.globalAlpha = shieldGlow;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 35, 40, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.globalAlpha = shieldGlow * 0.3;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    lightenColor(hex, percent) {
        const num = parseInt(hex.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return `rgb(${R}, ${G}, ${B})`;
    }
}

// 粒子特效函数
function createHitSpark(x, y) {
    for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 / 12) * i;
        game.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * (3 + Math.random() * 3),
            vy: Math.sin(angle) * (3 + Math.random() * 3),
            life: 20,
            maxLife: 20,
            color: Math.random() > 0.5 ? '#ffd93d' : '#ff4757',
            size: 4 + Math.random() * 3,
            type: 'spark'
        });
    }
}

function createDefenseSpark(x, y, color) {
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i;
        game.particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * 2,
            vy: Math.sin(angle) * 2,
            life: 15,
            maxLife: 15,
            color: color,
            size: 3,
            type: 'spark'
        });
    }
}

function createAttackEffect(x, y, facingRight, color) {
    game.effects.push({
        type: 'attack',
        x: x,
        y: y,
        facingRight: facingRight,
        color: color,
        life: 10,
        maxLife: 10
    });
}

function createDustParticles(x, y, color) {
    for (let i = 0; i < 6; i++) {
        game.particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y,
            vx: (Math.random() - 0.5) * 3,
            vy: -Math.random() * 2 - 1,
            life: 25,
            maxLife: 25,
            color: '#888',
            size: 3 + Math.random() * 3,
            type: 'dust'
        });
    }
}

function updateParticles() {
    for (let i = game.particles.length - 1; i >= 0; i--) {
        const p = game.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.type === 'dust') {
            p.vy += 0.1;
        }
        p.life--;
        if (p.life <= 0) {
            game.particles.splice(i, 1);
        }
    }
}

function drawParticles(ctx) {
    for (const p of game.particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        const size = Math.floor(p.size * alpha);
        ctx.fillRect(Math.floor(p.x - size / 2), Math.floor(p.y - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
}

function updateEffects() {
    for (let i = game.effects.length - 1; i >= 0; i--) {
        game.effects[i].life--;
        if (game.effects[i].life <= 0) {
            game.effects.splice(i, 1);
        }
    }
}

function drawEffects(ctx) {
    for (const e of game.effects) {
        const progress = 1 - e.life / e.maxLife;
        if (e.type === 'attack') {
            ctx.globalAlpha = 1 - progress;
            const length = 30 + progress * 40;
            const dir = e.facingRight ? 1 : -1;
            
            ctx.fillStyle = e.color;
            for (let i = 0; i < 5; i++) {
                const offset = i * 8 * dir;
                const size = 8 - i;
                ctx.fillRect(
                    Math.floor(e.x + offset - size / 2),
                    Math.floor(e.y - size / 2 + (i % 2 === 0 ? 0 : 4)),
                    size,
                    size
                );
            }
            
            ctx.fillStyle = '#ffd93d';
            ctx.fillRect(
                Math.floor(e.x + 15 * dir - 4),
                Math.floor(e.y - 4),
                8,
                8
            );
        }
    }
    ctx.globalAlpha = 1;
}

function drawBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0a0a1f');
    gradient.addColorStop(0.5, '#1a1a3e');
    gradient.addColorStop(1, '#2a1a2e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#ffd93d';
    for (let i = 0; i < 50; i++) {
        const x = (i * 73 + game.frameCount * 0.1) % CANVAS_WIDTH;
        const y = (i * 37) % 200;
        const size = (i % 3) + 1;
        const twinkle = Math.sin(game.frameCount * 0.05 + i) * 0.5 + 0.5;
        ctx.globalAlpha = twinkle * 0.8;
        ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
    }
    ctx.globalAlpha = 1;

    drawMoon(ctx, 780, 80, 35);

    ctx.fillStyle = '#15152a';
    drawBuilding(ctx, 50, 200, 60, 260);
    drawBuilding(ctx, 130, 170, 50, 290);
    drawBuilding(ctx, 200, 220, 70, 240);
    drawBuilding(ctx, 300, 150, 45, 310);
    drawBuilding(ctx, 370, 190, 55, 270);
    drawBuilding(ctx, 450, 160, 65, 300);
    drawBuilding(ctx, 550, 210, 50, 250);
    drawBuilding(ctx, 630, 180, 60, 280);
    drawBuilding(ctx, 720, 140, 55, 320);
    drawBuilding(ctx, 810, 195, 50, 265);
    drawBuilding(ctx, 880, 170, 60, 290);

    ctx.fillStyle = '#1e1e3a';
    drawBuilding(ctx, 0, 250, 80, 210);
    drawBuilding(ctx, 100, 280, 70, 180);
    drawBuilding(ctx, 250, 260, 90, 200);
    drawBuilding(ctx, 400, 240, 75, 220);
    drawBuilding(ctx, 520, 270, 85, 190);
    drawBuilding(ctx, 680, 255, 70, 205);
    drawBuilding(ctx, 800, 265, 80, 195);
    drawBuilding(ctx, 900, 250, 60, 210);

    ctx.fillStyle = '#2d2d4d';
    ctx.fillRect(0, GROUND_Y + 30, CANVAS_WIDTH, 50);
    
    ctx.fillStyle = '#3d3d5d';
    for (let i = 0; i < CANVAS_WIDTH; i += 16) {
        ctx.fillRect(i, GROUND_Y + 30, 8, 4);
    }

    ctx.fillStyle = '#4d4d6d';
    ctx.fillRect(0, GROUND_Y + 28, CANVAS_WIDTH, 4);

    ctx.fillStyle = '#555';
    for (let i = 0; i < 20; i++) {
        const x = (i * 53 + 20) % CANVAS_WIDTH;
        ctx.fillRect(x, GROUND_Y + 40, 6, 4);
        ctx.fillRect(x + 3, GROUND_Y + 45, 8, 3);
    }
}

function drawBuilding(ctx, x, y, width, height) {
    ctx.fillRect(x, y, width, height);
    
    ctx.fillStyle = '#ffd93d';
    ctx.globalAlpha = 0.3 + Math.sin(game.frameCount * 0.02 + x) * 0.2;
    
    const windowRows = Math.floor(height / 30);
    const windowCols = Math.floor(width / 15);
    
    for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
            if ((row + col + Math.floor(x / 10)) % 3 !== 0) {
                const wx = x + 4 + col * 15;
                const wy = y + 10 + row * 30;
                if ((row * windowCols + col + Math.floor(game.frameCount / 60) + x) % 7 !== 0) {
                    ctx.fillRect(wx, wy, 6, 8);
                }
            }
        }
    }
    ctx.globalAlpha = 1;
    
    ctx.fillStyle = '#0a0a1f';
    ctx.fillRect(x, y, 3, height);
    ctx.fillRect(x + width - 3, y, 3, height);
    ctx.fillRect(x, y, width, 5);
}

function drawMoon(ctx, x, y, radius) {
    ctx.fillStyle = '#e8e8d0';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#0a0a1f';
    ctx.beginPath();
    ctx.arc(x + radius * 0.3, y - radius * 0.2, radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function initGame() {
    game.p1 = new Mech('p1', 200, '#00d4ff', '#0066aa');
    game.p2 = new Mech('p2', 760, '#ff4757', '#aa2233');
    game.p2.facingRight = false;
    game.winner = null;
    game.time = 99;
    game.timeCounter = 0;
    game.effects = [];
    game.particles = [];
    game.screenShake = 0;
    game.frameCount = 0;
}

function update() {
    if (game.phase !== GamePhase.FIGHTING) return;

    game.frameCount++;

    const myMech = mySide === 'p1' ? game.p1 : game.p2;
    const opponentMech = mySide === 'p1' ? game.p2 : game.p1;

    // 只有玩家控制自己的机甲
    myMech.update('KeyA', 'KeyD', 'KeyW', 'KeyJ', 'KeyK', opponentMech);

    handleBodyCollision();

    updateEffects();
    updateParticles();

    if (game.screenShake > 0) {
        game.screenShake *= 0.9;
        if (game.screenShake < 0.5) game.screenShake = 0;
    }

    game.timeCounter++;
    if (game.timeCounter >= 60) {
        game.timeCounter = 0;
        game.time--;
        document.getElementById('timer').textContent = game.time;
        if (game.time <= 0) {
            endGame(game.p1.health > game.p2.health ? 'p1' : 'p2');
        }
    }

    updateHealthBars();

    if (game.p1.health <= 0) {
        endGame('p2');
    } else if (game.p2.health <= 0) {
        endGame('p1');
    }
}

function handleBodyCollision() {
    const p1Left = game.p1.x - game.p1.width / 2;
    const p1Right = game.p1.x + game.p1.width / 2;
    const p2Left = game.p2.x - game.p2.width / 2;
    const p2Right = game.p2.x + game.p2.width / 2;

    const overlap = Math.min(p1Right, p2Right) - Math.max(p1Left, p2Left);
    if (overlap > 0) {
        const pushBack = overlap / 2;
        if (game.p1.x < game.p2.x) {
            game.p1.x -= pushBack;
            game.p2.x += pushBack;
        } else {
            game.p1.x += pushBack;
            game.p2.x -= pushBack;
        }
    }
}

function updateHealthBars() {
    const p1Bar = document.getElementById('p1Health');
    const p2Bar = document.getElementById('p2Health');
    p1Bar.style.width = (game.p1.health / game.p1.maxHealth * 100) + '%';
    p2Bar.style.width = (game.p2.health / game.p2.maxHealth * 100) + '%';
}

function endGame(winner) {
    game.phase = GamePhase.GAMEOVER;
    game.winner = winner;
    
    const winnerText = document.getElementById('winnerText');
    winnerText.textContent = winner === mySide ? '你赢了!' : '你输了!';
    winnerText.style.color = winner === mySide ? '#ffd93d' : '#ff4757';
    
    document.getElementById('gameOver').classList.remove('hidden');
    
    // 发送游戏结束消息
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'game_over',
            winner: winner
        }));
    }
}

function returnToMenu() {
    game.phase = GamePhase.MENU;
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('opponentLeft').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('onlineMenu').classList.remove('hidden');
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'leave_room'
        }));
    }
}

function render() {
    ctx.save();
    
    if (game.screenShake > 0) {
        ctx.translate(
            (Math.random() - 0.5) * game.screenShake * 2,
            (Math.random() - 0.5) * game.screenShake * 2
        );
    }

    drawBackground(ctx);

    if (game.phase === GamePhase.FIGHTING || game.phase === GamePhase.GAMEOVER) {
        if (game.p1 && game.p2) {
            game.p1.draw(ctx);
            game.p2.draw(ctx);
        }
        drawEffects(ctx);
        drawParticles(ctx);
    }

    ctx.restore();
}

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// WebSocket 连接
function connectToServer(address) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    
    updateServerStatus('connecting');
    
    try {
        ws = new WebSocket(`ws://${address}/ws`);
        
        let connectTimeout = setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                ws.close();
                showConnectionError(address, 'timeout');
            }
        }, 5000);
        
        ws.onopen = () => {
            clearTimeout(connectTimeout);
            updateServerStatus('connected');
            console.log('已连接到服务器');
        };
        
        ws.onclose = () => {
            clearTimeout(connectTimeout);
            updateServerStatus('disconnected');
            console.log('服务器连接断开');
            if (syncInterval) {
                clearInterval(syncInterval);
            }
        };
        
        ws.onerror = (error) => {
            clearTimeout(connectTimeout);
            updateServerStatus('disconnected');
            console.error('WebSocket 错误:', error);
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };
    } catch (e) {
        updateServerStatus('disconnected');
        showConnectionError(address, 'error', e.message);
    }
}

function showConnectionError(address, type, detail) {
    let msg = '无法连接到服务器\n\n';
    msg += '服务器地址: ' + address + '\n\n';
    
    if (type === 'timeout') {
        msg += '连接超时！可能原因：\n\n';
    } else {
        msg += '连接失败！可能原因：\n\n';
    }
    
    const isLocal = address.includes('localhost') || address.includes('127.0.0.1');
    const isLan = address.startsWith('192.168.') || address.startsWith('10.') || address.startsWith('172.');
    
    if (isLocal) {
        msg += '📍 本地连接问题：\n';
        msg += '1. 服务器是否启动？\n';
        msg += '2. 端口8765是否被占用？\n';
        msg += '3. 运行 启动服务器.bat\n\n';
    } else if (isLan) {
        msg += '📍 局域网连接问题：\n';
        msg += '1. 两台电脑是否在同一WiFi？\n';
        msg += '2. 主机IP地址是否正确？\n';
        msg += '3. 主机防火墙是否放行8765端口？\n';
        msg += '4. 主机是否运行了 启动服务器.bat？\n\n';
    } else {
        msg += '📍 互联网连接问题：\n';
        msg += '1. 服务器是否部署在云服务器上？\n';
        msg += '2. 云服务器安全组是否开放8765端口？\n';
        msg += '3. 服务器防火墙是否配置？\n';
        msg += '4. 服务器IP地址是否正确？\n\n';
        msg += '💡 提示：家里电脑直接开服，外地朋友是连不上的！\n';
        msg += '需要云服务器或内网穿透工具。\n';
    }
    
    if (detail) {
        msg += '\n错误详情: ' + detail;
    }
    
    alert(msg);
}

function updateServerStatus(status) {
    const statusEl = document.getElementById('serverStatus');
    if (status === 'connected') {
        statusEl.textContent = '服务器: 已连接';
        statusEl.classList.remove('disconnected', 'connecting');
        statusEl.classList.add('connected');
    } else if (status === 'connecting') {
        statusEl.textContent = '服务器: 连接中...';
        statusEl.classList.remove('connected', 'disconnected');
        statusEl.classList.add('connecting');
    } else {
        statusEl.textContent = '服务器: 未连接';
        statusEl.classList.remove('connected', 'connecting');
        statusEl.classList.add('disconnected');
    }
}

function handleServerMessage(data) {
    console.log('收到消息:', data);
    
    switch (data.action) {
        case 'room_created':
            roomCode = data.room_code;
            mySide = 'p1';
            showRoomWaiting(roomCode);
            break;
            
        case 'joined_room':
            roomCode = data.room_code;
            mySide = 'p2';
            showGameReady();
            break;
            
        case 'matched':
            roomCode = data.room_code;
            mySide = data.side;
            showGameReady();
            break;
            
        case 'waiting_for_match':
            roomCode = data.room_code;
            mySide = data.side;
            showWaitingMatch(roomCode);
            break;
            
        case 'player_joined':
            showGameReady();
            break;
            
        case 'player_ready':
            const opponentSide = mySide === 'p1' ? 'p2' : 'p1';
            if (data.side === opponentSide) {
                document.getElementById('p2StatusBox').querySelector('.ready-badge')
                    .classList.replace('waiting', 'ready');
                document.getElementById('p2StatusBox').querySelector('.ready-badge')
                    .textContent = '就绪';
            }
            break;
            
        case 'game_start':
            startOnlineGame();
            break;
            
        case 'sync_state':
            // 接收对手状态
            const opponent = data.side === 'p1' ? game.p1 : game.p2;
            if (data.side !== mySide && opponent) {
                opponent.setState(data.state);
            }
            break;
            
        case 'game_over':
            endGame(data.winner);
            break;
            
        case 'restart_request':
            if (game.phase === GamePhase.GAMEOVER) {
                showGameReady();
            }
            break;
            
        case 'player_left':
            showOpponentLeft();
            break;
            
        case 'error':
            alert('错误: ' + data.message);
            hideAllOverlays();
            document.getElementById('onlineMenu').classList.remove('hidden');
            break;
    }
}

// UI 控制函数
function hideAllOverlays() {
    document.getElementById('onlineMenu').classList.add('hidden');
    document.getElementById('waitingMatch').classList.add('hidden');
    document.getElementById('roomWaiting').classList.add('hidden');
    document.getElementById('gameReady').classList.add('hidden');
    document.getElementById('gameOver').classList.add('hidden');
    document.getElementById('opponentLeft').classList.add('hidden');
}

function showWaitingMatch(code) {
    hideAllOverlays();
    game.phase = GamePhase.WAITING;
    document.getElementById('waitingMatch').classList.remove('hidden');
    document.getElementById('waitingRoomCode').textContent = code;
}

function showRoomWaiting(code) {
    hideAllOverlays();
    game.phase = GamePhase.WAITING;
    document.getElementById('roomWaiting').classList.remove('hidden');
    document.getElementById('hostRoomCode').textContent = code;
}

function showGameReady() {
    hideAllOverlays();
    game.phase = GamePhase.READY;
    document.getElementById('gameReady').classList.remove('hidden');
    
    document.getElementById('mySideLabel').textContent = `你 (${mySide.toUpperCase()})`;
    document.getElementById('opponentSideLabel').textContent = `对手 (${mySide === 'p1' ? 'P2' : 'P1'})`;
}

function showOpponentLeft() {
    if (game.phase === GamePhase.FIGHTING || game.phase === GamePhase.READY) {
        hideAllOverlays();
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('opponentLeft').classList.remove('hidden');
        
        if (syncInterval) {
            clearInterval(syncInterval);
        }
    }
}

function startOnlineGame() {
    hideAllOverlays();
    initGame();
    game.phase = GamePhase.FIGHTING;
    
    // 根据玩家身份调整初始位置
    if (mySide === 'p2') {
        // P2 在右侧
    }
    
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('timer').textContent = game.time;
    
    // 标签显示
    document.getElementById('p1Label').textContent = mySide === 'p1' ? '你' : '对手';
    document.getElementById('p2Label').textContent = mySide === 'p2' ? '你' : '对手';
    
    updateHealthBars();
    
    // 开始状态同步
    startStateSync();
}

function startStateSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    // 每16ms(约60fps)同步状态
    syncInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN && game.phase === GamePhase.FIGHTING) {
            const myMech = mySide === 'p1' ? game.p1 : game.p2;
            ws.send(JSON.stringify({
                action: 'sync_state',
                state: myMech.getState()
            }));
        }
    }, 16);
    
    // Ping检测
    setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            lastPingTime = Date.now();
        }
    }, 1000);
}

// 按钮事件
document.getElementById('connectServerBtn').addEventListener('click', () => {
    const address = document.getElementById('serverAddressInput').value.trim();
    if (address) {
        serverAddress = address;
        connectToServer(address);
    } else {
        alert('请输入服务器地址');
    }
});

document.getElementById('quickMatchBtn').addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('请先连接服务器');
        return;
    }
    ws.send(JSON.stringify({ action: 'quick_match' }));
});

document.getElementById('createRoomBtn').addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('请先连接服务器');
        return;
    }
    ws.send(JSON.stringify({ action: 'create_room' }));
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('请先连接服务器');
        return;
    }
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!code || code.length !== 4) {
        alert('请输入4位房间码');
        return;
    }
    ws.send(JSON.stringify({
        action: 'join_room',
        room_code: code
    }));
});

document.getElementById('cancelWaitBtn').addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'leave_room' }));
    }
    hideAllOverlays();
    document.getElementById('onlineMenu').classList.remove('hidden');
});

document.getElementById('cancelRoomBtn').addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'leave_room' }));
    }
    hideAllOverlays();
    document.getElementById('onlineMenu').classList.remove('hidden');
});

document.getElementById('backToMenuBtn').addEventListener('click', () => {
    returnToMenu();
});

document.getElementById('showHelpBtn').addEventListener('click', () => {
    document.getElementById('helpModal').classList.remove('hidden');
});

document.getElementById('closeHelpBtn').addEventListener('click', () => {
    document.getElementById('helpModal').classList.add('hidden');
});

document.getElementById('helpModal').addEventListener('click', (e) => {
    if (e.target.id === 'helpModal') {
        document.getElementById('helpModal').classList.add('hidden');
    }
});

// 键盘事件
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    
    if (e.code === 'Space') {
        e.preventDefault();
        
        if (game.phase === GamePhase.READY) {
            // 发送就绪消息
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'ready' }));
            }
        } else if (game.phase === GamePhase.GAMEOVER) {
            // 发送重新开始请求
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: 'restart' }));
            }
            showGameReady();
        }
    }
    
    if (e.code === 'Escape') {
        if (game.phase === GamePhase.GAMEOVER || game.phase === GamePhase.FIGHTING) {
            returnToMenu();
        }
    }
    
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// 初始化
initGame();
gameLoop();

// 自动连接本地服务器
document.getElementById('serverAddressInput').value = 'localhost:8765';
connectToServer('localhost:8765');