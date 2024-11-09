// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Add willReadFrequently option

// Set initial canvas size
function resizeCanvas() {
  // Get device pixel ratio for sharp rendering on mobile
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size based on screen dimensions
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // Use 16:9 aspect ratio if possible, otherwise adapt to screen
  const gameWidth = Math.min(screenWidth, screenHeight * (16 / 9));
  const gameHeight = gameWidth * (9 / 16);

  // Set display size
  canvas.style.width = `${gameWidth}px`;
  canvas.style.height = `${gameHeight}px`;

  // Set actual size accounting for device pixel ratio
  canvas.width = gameWidth * dpr;
  canvas.height = gameHeight * dpr;

  // Scale context to account for pixel ratio
  ctx.scale(dpr, dpr);

  // Reset transform to prevent accumulation
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Camera/viewport properties
const camera = {
  x: 0,
  y: 0
};

// Mouse position tracking
const mouse = {
  x: 0,
  y: 0,
  isHeld: false
};

// Score tracking
let score = 0;
let killCount = 0;
let comboTextVisible = false;
let comboTextTimer = null;
let gameOver = false;

// Particle system for fire trail
const particles = [];

// Enemy system
const enemies = [];
const enemyBullets = [];
const playerBullets = [];

class Enemy {
  constructor(x, y, isBoss = false) {
    this.x = x;
    this.y = y;
    this.isBoss = isBoss;
    this.radius = isBoss ? 45 : 15;
    this.health = isBoss ? 500 : 100;
    this.maxHealth = isBoss ? 500 : 100;
    this.speed = isBoss ? 1 : 2;
    this.shootCooldown = 0;
    this.shootDelay = isBoss ? 30 : 60; // Boss shoots faster
  }

  update() {
    // Move toward player
    const dx = (player.x + camera.x) - this.x;
    const dy = (player.y + camera.y) - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }

    // Shoot at player
    if (this.shootCooldown <= 0) {
      const angle = Math.atan2(dy, dx);
      enemyBullets.push(new Bullet(this.x, this.y, angle));
      this.shootCooldown = this.shootDelay;
    }
    this.shootCooldown--;
  }

  draw() {
    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    // Draw enemy circle
    ctx.beginPath();
    ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.isBoss ? '#ff0000' : '#ff4444';
    ctx.fill();

    // Draw health bar
    const healthBarWidth = this.radius * 2;
    const healthBarHeight = this.isBoss ? 8 : 4;
    const healthBarY = screenY - this.radius - 8;

    ctx.fillStyle = '#333';
    ctx.fillRect(screenX - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight);

    ctx.fillStyle = this.isBoss ? '#ff0000' : '#ff4444';
    const currentHealthWidth = (this.health / this.maxHealth) * healthBarWidth;
    ctx.fillRect(screenX - healthBarWidth / 2, healthBarY, currentHealthWidth, healthBarHeight);
  }
}

class FireParticle {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = Math.random() * 2 + 3;
    this.size = Math.random() * 10 + 5;
    this.life = 1.0;
    this.decay = Math.random() * 0.03 + 0.02;
    this.hue = Math.random() * 60 + 0; // Random hue between 0-60 (red to yellow)
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.size *= 0.97;
    this.life -= this.decay;

    // Check for collisions with enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i]) continue; // Skip if enemy is undefined

      const dx = this.x - enemies[i].x;
      const dy = this.y - enemies[i].y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < enemies[i].radius + this.size) {
        enemies[i].health -= 25;
        this.life = 0;

        if (enemies[i].health <= 0) {
          const wasABoss = enemies[i].isBoss;
          enemies.splice(i, 1);
          score += wasABoss ? 50 : 10;
          killCount++;

          if (killCount === 3) {
            // Spawn boss enemy when kill count reaches 3
            const angle = Math.random() * Math.PI * 2;
            const distance = 300;
            const bossX = camera.x + canvas.width / 2 + Math.cos(angle) * distance;
            const bossY = camera.y + canvas.height / 2 + Math.sin(angle) * distance;
            enemies.push(new Enemy(bossX, bossY, true));

            // Reset kill count after spawning boss
            killCount = 0;

            // Show combo text
            comboTextVisible = true;
            if (comboTextTimer) clearTimeout(comboTextTimer);
            comboTextTimer = setTimeout(() => {
              comboTextVisible = false;
            }, 2000);
          }
        }
        break;
      }
    }
  }

  draw() {
    if (!ctx) return; // Guard against null context

    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    try {
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, this.size);
      gradient.addColorStop(0, `hsla(${this.hue}, 100%, 50%, ${this.life})`);
      gradient.addColorStop(0.5, `hsla(${this.hue - 20}, 100%, 50%, ${this.life * 0.5})`);
      gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fill();
    } catch (error) {
      console.error('Error drawing fire particle:', error);
    }
  }
}

class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.speed = 5;
    this.angle = angle;
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Check for collision with player for enemy bullets
    if (this instanceof Bullet && enemyBullets.includes(this)) {
      const dx = this.x - (player.x + camera.x);
      const dy = this.y - (player.y + camera.y);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < player.radius) {
        // Bullet hit player
        player.health -= 5;

        // Remove the bullet
        const bulletIndex = enemyBullets.indexOf(this);
        if (bulletIndex > -1) {
          enemyBullets.splice(bulletIndex, 1);
        }

        // Check if player is dead
        if (player.health <= 0) {
          gameOver = true;
        }
      }
    }
  }

  draw() {
    if (!ctx) return; // Guard against null context

    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    try {
      ctx.beginPath();
      ctx.arc(screenX, screenY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ff0000';
      ctx.fill();
    } catch (error) {
      console.error('Error drawing bullet:', error);
    }
  }
}

class Particle {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 10 + 5;
    this.speedX = Math.cos(angle) * (Math.random() * 2 + 1);
    this.speedY = Math.sin(angle) * (Math.random() * 2 + 1);
    this.life = 1.0;
    this.decay = Math.random() * 0.02 + 0.02;
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.size *= 0.95;
    this.life -= this.decay;
  }

  draw() {
    if (!ctx) return; // Guard against null context

    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    try {
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
      const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, this.size);
      gradient.addColorStop(0, `rgba(255, 200, 0, ${this.life})`);
      gradient.addColorStop(0.4, `rgba(255, 100, 0, ${this.life * 0.6})`);
      gradient.addColorStop(1, `rgba(255, 0, 0, 0)`);
      ctx.fillStyle = gradient;
      ctx.fill();
    } catch (error) {
      console.error('Error drawing particle:', error);
    }
  }
}

// Player properties
const player = {
  x: 0, // Will be set after canvas is sized
  y: 0, // Will be set after canvas is sized
  radius: 20,
  color: '#fff', // Not used anymore since we're using gradient
  speed: 5,
  rotation: 0, // Angle of weapon rotation
  health: 100, // Added health property
  weapon: {
    length: 40,
    width: 8
  },
  movement: {
    up: false,
    down: false,
    left: false,
    right: false
  }
};

// Grid properties
const grid = {
  spacing: 30,
  dotSize: 2,
  color: '#333'
};

// Spawn enemy every 5 seconds
setInterval(() => {
  // Randomly choose spawn edge (0: top, 1: right, 2: bottom, 3: left)
  const edge = Math.floor(Math.random() * 4);
  let x, y;

  switch (edge) {
    case 0: // top
      x = camera.x + Math.random() * canvas.width;
      y = camera.y - 50;
      break;
    case 1: // right
      x = camera.x + canvas.width + 50;
      y = camera.y + Math.random() * canvas.height;
      break;
    case 2: // bottom
      x = camera.x + Math.random() * canvas.width;
      y = camera.y + canvas.height + 50;
      break;
    case 3: // left
      x = camera.x - 50;
      y = camera.y + Math.random() * canvas.height;
      break;
  }

  enemies.push(new Enemy(x, y));
}, 1000);

// Draw grid dots with infinite scrolling
function drawGrid() {
  if (!ctx) return; // Guard against null context

  try {
    ctx.fillStyle = grid.color;

    // Calculate grid boundaries based on camera position
    const startX = Math.floor(camera.x / grid.spacing) * grid.spacing;
    const startY = Math.floor(camera.y / grid.spacing) * grid.spacing;
    const endX = startX + canvas.width / ctx.getTransform().a + grid.spacing;
    const endY = startY + canvas.height / ctx.getTransform().d + grid.spacing;

    // Draw grid with camera offset
    for (let x = startX; x < endX; x += grid.spacing) {
      for (let y = startY; y < endY; y += grid.spacing) {
        const screenX = x - camera.x;
        const screenY = y - camera.y;
        ctx.beginPath();
        ctx.arc(screenX, screenY, grid.dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } catch (error) {
    console.error('Error drawing grid:', error);
  }
}

// Draw player centered on screen
function drawPlayer() {
  if (!ctx) return; // Guard against null context

  try {
    const centerX = canvas.width / (2 * ctx.getTransform().a);
    const centerY = canvas.height / (2 * ctx.getTransform().d);

    // Draw fire effect when mouse is held
    if (mouse.isHeld) {
      const dx = mouse.x - centerX;
      const dy = mouse.y - centerY;
      const angle = Math.atan2(dy, dx);

      // Create multiple fire particles along the line
      for (let i = 0; i < 5; i++) {
        const distance = player.radius + Math.random() * canvas.width;
        const spreadAngle = angle + (Math.random() * 0.2 - 0.1);
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        particles.push(new FireParticle(x + camera.x, y + camera.y, spreadAngle));
      }
    }

    // Draw player circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, player.radius, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, player.radius
    );
    gradient.addColorStop(0, '#00ffff');
    gradient.addColorStop(0.5, '#0088ff');
    gradient.addColorStop(1, '#0044ff');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw health bar
    const healthBarWidth = player.radius * 2;
    const healthBarHeight = 6;
    const healthBarY = centerY - player.radius - 10;

    // Draw background bar
    ctx.fillStyle = '#333';
    ctx.fillRect(centerX - healthBarWidth / 2, healthBarY, healthBarWidth, healthBarHeight);

    // Draw health bar
    ctx.fillStyle = '#00ff00';
    const currentHealthWidth = (player.health / 100) * healthBarWidth;
    ctx.fillRect(centerX - healthBarWidth / 2, healthBarY, currentHealthWidth, healthBarHeight);

    // Draw weapon
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(player.rotation);
    ctx.fillStyle = '#888';
    ctx.fillRect(0, -player.weapon.width / 2, player.weapon.length, player.weapon.width);
    ctx.restore();
  } catch (error) {
    console.error('Error drawing player:', error);
  }
}

// Update player and camera position
function updatePlayer() {
  if (!ctx) return; // Guard against null context

  try {
    const centerX = canvas.width / (2 * ctx.getTransform().a);
    const centerY = canvas.height / (2 * ctx.getTransform().d);

    // Update weapon rotation based on mouse position
    const dx = mouse.x - centerX;
    const dy = mouse.y - centerY;
    player.rotation = Math.atan2(dy, dx);

    // Calculate movement angle for fire trail
    let angle = 0;
    let isMoving = false;

    if (player.movement.up) {
      camera.y -= player.speed;
      angle = Math.PI / 2;
      isMoving = true;
    }
    if (player.movement.down) {
      camera.y += player.speed;
      angle = -Math.PI / 2;
      isMoving = true;
    }
    if (player.movement.left) {
      camera.x -= player.speed;
      angle = 0;
      isMoving = true;
    }
    if (player.movement.right) {
      camera.x += player.speed;
      angle = Math.PI;
      isMoving = true;
    }

    // Create fire particles if moving
    if (isMoving) {
      for (let i = 0; i < 3; i++) {
        particles.push(new Particle(
          centerX + camera.x,
          centerY + camera.y,
          angle + (Math.random() * 0.5 - 0.25)
        ));
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      if (!particles[i]) continue; // Skip if particle is undefined
      particles[i].update();
      if (particles[i].life <= 0) {
        particles.splice(i, 1);
      }
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i]) continue; // Skip if enemy is undefined
      enemies[i].update();
    }

    // Update enemy bullets and player bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      if (!enemyBullets[i]) continue; // Skip if bullet is undefined
      enemyBullets[i].update();

      // Remove bullets that are too far from player
      const dx = enemyBullets[i].x - (player.x + camera.x);
      const dy = enemyBullets[i].y - (player.y + camera.y);
      if (Math.sqrt(dx * dx + dy * dy) > 1000) {
        enemyBullets.splice(i, 1);
      }
    }

    for (let i = playerBullets.length - 1; i >= 0; i--) {
      if (!playerBullets[i]) continue; // Skip if bullet is undefined
      playerBullets[i].update();

      // Check for collisions with enemies
      for (let j = enemies.length - 1; j >= 0; j--) {
        if (!enemies[j]) continue; // Skip if enemy is undefined

        const dx = playerBullets[i].x - enemies[j].x;
        const dy = playerBullets[i].y - enemies[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < enemies[j].radius) {
          // Bullet hit enemy
          enemies[j].health -= 10;
          playerBullets.splice(i, 1);

          // Remove enemy if health reaches 0
          if (enemies[j].health <= 0) {
            const wasABoss = enemies[j].isBoss;
            enemies.splice(j, 1);
            score += wasABoss ? 50 : 10;
            killCount++;

            if (killCount === 3) {
              // Spawn boss enemy when kill count reaches 3
              const angle = Math.random() * Math.PI * 2;
              const distance = 300;
              const bossX = camera.x + canvas.width / 2 + Math.cos(angle) * distance;
              const bossY = camera.y + canvas.height / 2 + Math.sin(angle) * distance;
              enemies.push(new Enemy(bossX, bossY, true));

              // Reset kill count after spawning boss
              killCount = 0;

              // Show combo text
              comboTextVisible = true;
              if (comboTextTimer) clearTimeout(comboTextTimer);
              comboTextTimer = setTimeout(() => {
                comboTextVisible = false;
              }, 2000);
            }
          }
          break;
        }
      }

      // Remove bullets that are too far from player
      if (playerBullets[i]) { // Check if bullet still exists after collision checks
        const dx = playerBullets[i].x - (player.x + camera.x);
        const dy = playerBullets[i].y - (player.y + camera.y);
        if (Math.sqrt(dx * dx + dy * dy) > 1000) {
          playerBullets.splice(i, 1);
        }
      }
    }
  } catch (error) {
    console.error('Error updating player:', error);
  }
}

// Main game loop
function gameLoop() {
  if (!ctx || !canvas) {
    console.error('Canvas or context is null');
    return;
  }

  try {
    // Clear canvas and reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameOver) {
      // Show game over screen
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '48px Arial';
      const text = 'Game Over';
      const textWidth = ctx.measureText(text).width;
      ctx.fillText(text, (canvas.width - textWidth) / 2, canvas.height / 2);
      return;
    }

    // Restore the DPR scale
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Update player position
    updatePlayer();

    // Draw game elements
    drawGrid();
    // Draw particles behind player
    particles.forEach(particle => {
      if (particle) particle.draw();
    });
    // Draw enemy bullets and player bullets
    enemyBullets.forEach(bullet => {
      if (bullet) bullet.draw();
    });
    playerBullets.forEach(bullet => {
      if (bullet) bullet.draw();
    });
    // Draw enemies
    enemies.forEach(enemy => {
      if (enemy) enemy.draw();
    });
    drawPlayer();

    // Draw score
    ctx.save();
    ctx.resetTransform();
    ctx.fillStyle = '#fff';
    ctx.font = '20px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);

    // Draw combo text if visible
    if (comboTextVisible) {
      ctx.font = '40px Arial';
      ctx.fillStyle = '#ff0000';
      const text = 'BOSS INCOMING!';
      const textWidth = ctx.measureText(text).width;
      ctx.fillText(text, (canvas.width - textWidth) / 2, canvas.height - 50);
    }

    ctx.restore();

    requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error('Error in game loop:', error);
    requestAnimationFrame(gameLoop); // Continue the loop even if there's an error
  }
}

// Handle keyboard input
window.addEventListener('keydown', (e) => {
  switch (e.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      player.movement.up = true;
      break;
    case 's':
    case 'arrowdown':
      player.movement.down = true;
      break;
    case 'a':
    case 'arrowleft':
      player.movement.left = true;
      break;
    case 'd':
    case 'arrowright':
      player.movement.right = true;
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.key.toLowerCase()) {
    case 'w':
    case 'arrowup':
      player.movement.up = false;
      break;
    case 's':
    case 'arrowdown':
      player.movement.down = false;
      break;
    case 'a':
    case 'arrowleft':
      player.movement.left = false;
      break;
    case 'd':
    case 'arrowright':
      player.movement.right = false;
      break;
  }
});

// Track mouse movement
window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Handle mouse clicks for shooting
window.addEventListener('mousedown', () => {
  mouse.isHeld = true;
});

window.addEventListener('mouseup', () => {
  mouse.isHeld = false;
});

// Initial resize and player positioning
resizeCanvas();
player.x = canvas.width / (2 * ctx.getTransform().a);
player.y = canvas.height / (2 * ctx.getTransform().d);

// Resize canvas when window size changes
window.addEventListener('resize', () => {
  resizeCanvas();
  // Keep player centered after resize
  player.x = canvas.width / (2 * ctx.getTransform().a);
  player.y = canvas.height / (2 * ctx.getTransform().d);
});

// Start game loop
gameLoop();
