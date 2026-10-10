/**
 * ACT 4: Interactive Blueprint Floor Plan Simulation Engine
 * Dual-Mode: Static (2019 Blueprint) vs Dynamic Adaptive AI Flow Field
 */
import { audioEngine } from './audio.js';

export class EvacuationSandbox {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 1100;
    this.height = 700;

    // Simulation State
    this.mode = 'dynamic'; // 'static' | 'dynamic'
    this.occupantTargetCount = 70;
    this.occupants = [];
    this.hazards = [];
    this.evacuatedCount = 0;
    this.simTime = 0;
    this.isRunning = true;
    this.showVectors = true;
    this.mousePos = { x: -100, y: -100, isHovering: false };

    // Telemetry stats
    this.bottleneckIndex = 1.0;
    this.throughputRate = 0;
    this.evacHistory = [];

    // Navigation Grid for Vector Fields
    this.gridCols = 55;
    this.gridRows = 35;
    this.cellW = this.width / this.gridCols;
    this.cellH = this.height / this.gridRows;
    this.flowFieldStatic = [];
    this.flowFieldDynamic = [];
    this.wallGrid = [];

    // Blueprint Architectural Layout
    this.setupBlueprintLayout();
    this.initWallGrid();

    // Default starting hazards (e.g. fire at the central choke corridor)
    this.addDefaultHazard();

    // Spawn occupants
    this.resetSimulation();

    // Canvas sizing & interaction listeners
    this.initCanvasDPR();
    this.bindEvents();

    // Start Simulation Loop
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setupBlueprintLayout() {
    // Rooms definition
    this.rooms = [
      { id: 'west', name: 'WEST AUDITORIUM', x: 60, y: 130, w: 270, h: 440 },
      { id: 'north', name: 'NORTH LABS & SERVER CORE', x: 380, y: 60, w: 340, h: 210 },
      { id: 'atrium', name: 'CENTRAL ATRIUM (CHOKE ZONE)', x: 380, y: 310, w: 340, h: 260 },
      { id: 'east', name: 'EAST OPERATIONS WING', x: 770, y: 130, w: 270, h: 440 }
    ];

    // Doorways / Corridors connecting rooms
    this.doorways = [
      // West to Atrium
      { x: 330, y: 390, w: 50, h: 60 },
      // North to Atrium
      { x: 520, y: 270, w: 60, h: 40 },
      // East to Atrium
      { x: 720, y: 390, w: 50, h: 60 },
      // North Lab to Service Exit C corridor
      { x: 520, y: 60, w: 60, h: 30 },
      // West Room to Exit B escape corridor
      { x: 60, y: 310, w: 30, h: 60 },
      // East to North bypass corridor
      { x: 880, y: 100, w: 50, h: 30 }
    ];

    // Corridors / Open Hallways
    this.corridors = [
      // Main Horizontal Concourse
      { x: 330, y: 370, w: 440, h: 100 },
      // North to Exit C hallway
      { x: 500, y: 30, w: 100, h: 80 },
      // East-North bypass hallway
      { x: 720, y: 70, w: 250, h: 60 },
      // South Concourse to Exit A
      { x: 500, y: 570, w: 100, h: 100 }
    ];

    // Emergency Exits
    this.exits = [
      {
        id: 'A',
        name: 'EXIT A [MAIN LOBBY // 2019 PLAN]',
        type: 'primary',
        x: 550,
        y: 650,
        radius: 40,
        color: '#f59e0b',
        accent: '#ef4444',
        status: 'active'
      },
      {
        id: 'B',
        name: 'EXIT B [WEST FIRE ESCAPE]',
        type: 'emergency',
        x: 60,
        y: 340,
        radius: 36,
        color: '#06b6d4',
        accent: '#10b981',
        status: 'active'
      },
      {
        id: 'C',
        name: 'EXIT C [NORTH SERVICE DOCK]',
        type: 'emergency',
        x: 550,
        y: 50,
        radius: 36,
        color: '#10b981',
        accent: '#06b6d4',
        status: 'active'
      }
    ];

    // Walls for collision (rectangles)
    this.walls = [
      // Outer border walls
      { x: 30, y: 20, w: 1040, h: 10 },
      { x: 30, y: 670, w: 1040, h: 10 },
      { x: 30, y: 20, w: 10, h: 660 },
      { x: 1060, y: 20, w: 10, h: 660 },

      // West room walls (with doors)
      { x: 60, y: 130, w: 270, h: 8 }, // top
      { x: 60, y: 562, w: 270, h: 8 }, // bottom
      { x: 60, y: 130, w: 8, h: 180 }, // left upper
      { x: 60, y: 370, w: 8, h: 200 }, // left lower (door at 310-370)
      { x: 322, y: 130, w: 8, h: 260 }, // right upper
      { x: 322, y: 450, w: 8, h: 120 }, // right lower (door at 390-450)

      // North room walls
      { x: 380, y: 60, w: 140, h: 8 }, // top left
      { x: 580, y: 60, w: 140, h: 8 }, // top right (door at 520-580)
      { x: 380, y: 60, w: 8, h: 210 }, // left
      { x: 712, y: 60, w: 8, h: 210 }, // right
      { x: 380, y: 262, w: 140, h: 8 }, // bottom left
      { x: 580, y: 262, w: 140, h: 8 }, // bottom right (door at 520-580)

      // Central Atrium walls
      { x: 380, y: 310, w: 140, h: 8 }, // top left
      { x: 580, y: 310, w: 140, h: 8 }, // top right
      { x: 380, y: 310, w: 8, h: 80 },  // left upper
      { x: 380, y: 450, w: 8, h: 120 }, // left lower
      { x: 712, y: 310, w: 8, h: 80 },  // right upper
      { x: 712, y: 450, w: 8, h: 120 }, // right lower
      { x: 380, y: 562, w: 120, h: 8 }, // bottom left
      { x: 600, y: 562, w: 120, h: 8 }, // bottom right (choke door at 500-600 to Exit A)

      // East room walls
      { x: 770, y: 130, w: 270, h: 8 }, // top
      { x: 770, y: 562, w: 270, h: 8 }, // bottom
      { x: 770, y: 130, w: 8, h: 260 }, // left upper
      { x: 770, y: 450, w: 8, h: 120 }, // left lower
      { x: 1032, y: 130, w: 8, h: 440 }, // right

      // Architectural columns in Atrium
      { x: 440, y: 370, w: 24, h: 24 },
      { x: 640, y: 370, w: 24, h: 24 },
      { x: 440, y: 490, w: 24, h: 24 },
      { x: 640, y: 490, w: 24, h: 24 }
    ];
  }

  initWallGrid() {
    this.wallGrid = new Array(this.gridCols * this.gridRows).fill(false);
    for (let gy = 0; gy < this.gridRows; gy++) {
      for (let gx = 0; gx < this.gridCols; gx++) {
        const cx = (gx + 0.5) * this.cellW;
        const cy = (gy + 0.5) * this.cellH;
        let isBlocked = false;

        // Check if inside any wall
        for (const wall of this.walls) {
          if (
            cx >= wall.x - 4 &&
            cx <= wall.x + wall.w + 4 &&
            cy >= wall.y - 4 &&
            cy <= wall.y + wall.h + 4
          ) {
            isBlocked = true;
            break;
          }
        }
        this.wallGrid[gy * this.gridCols + gx] = isBlocked;
      }
    }
  }

  addDefaultHazard() {
    // Dropped right at Stairwell A choke corridor leading to Exit A
    this.hazards = [
      {
        x: 550,
        y: 535,
        radius: 48,
        pulsePhase: 0,
        id: Date.now()
      }
    ];
    this.recomputeFlowFields();
  }

  initCanvasDPR() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || this.width;
    const h = (w * (this.height / this.width)) || this.height;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.dpr = dpr;
    this.scaleX = this.canvas.width / this.width;
    this.scaleY = this.canvas.height / this.height;
  }

  bindEvents() {
    window.addEventListener('resize', () => {
      this.initCanvasDPR();
    });

    const getCanvasPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = ((clientX - rect.left) / rect.width) * this.width;
      const y = ((clientY - rect.top) / rect.height) * this.height;
      return { x, y };
    };

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = getCanvasPos(e);
      this.mousePos.x = x;
      this.mousePos.y = y;
      this.mousePos.isHovering = true;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.mousePos.isHovering = false;
    });

    let lastActionTime = 0;
    const handleHazardToggle = (x, y) => {
      const now = Date.now();
      if (now - lastActionTime < 280) return; // Prevent double-trigger from touch + click simulation
      lastActionTime = now;

      // Check if clicking near an existing hazard to remove it
      const clickedIdx = this.hazards.findIndex(h => {
        const dx = h.x - x;
        const dy = h.y - y;
        return Math.sqrt(dx * dx + dy * dy) < h.radius + 12;
      });

      if (clickedIdx >= 0) {
        this.hazards.splice(clickedIdx, 1);
        audioEngine.playChime(320, 0.1, 'triangle');
      } else {
        // Add new fire hazard
        this.hazards.push({
          x: Math.round(x),
          y: Math.round(y),
          radius: 46,
          pulsePhase: Math.random() * Math.PI,
          id: Date.now()
        });
        audioEngine.playHazardAlert();
      }

      this.recomputeFlowFields();
      if (this.mode === 'dynamic') {
        audioEngine.playRerouteSuccess();
      }
    };

    let lastTouchEnd = 0;

    // Desktop Mouse Click
    this.canvas.addEventListener('click', (e) => {
      // Discard simulated mouse events dispatched right after touchend
      if (Date.now() - lastTouchEnd < 450) return;
      const { x, y } = getCanvasPos(e);
      handleHazardToggle(x, y);
    });

    // Mobile Touch Gesture Handler: Differentiate intentional tap from scroll gesture
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchMoved = false;

    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        touchMoved = false;
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length === 1) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 8 || dy > 8) {
          touchMoved = true;
        }
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      lastTouchEnd = Date.now();
      const touchDuration = lastTouchEnd - touchStartTime;

      // Only toggle hazard if finger tapped intentionally without scrolling
      if (!touchMoved && touchDuration < 320) {
        const rect = this.canvas.getBoundingClientRect();
        const x = ((touchStartX - rect.left) / rect.width) * this.width;
        const y = ((touchStartY - rect.top) / rect.height) * this.height;
        handleHazardToggle(x, y);
      }
    }, { passive: true });
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.recomputeFlowFields();
    if (mode === 'dynamic') {
      audioEngine.playRerouteSuccess();
    } else {
      audioEngine.playChime(280, 0.2, 'sawtooth');
    }
  }

  resetSimulation() {
    this.occupants = [];
    this.evacuatedCount = 0;
    this.simTime = 0;
    this.bottleneckIndex = 1.0;
    this.evacHistory = [];

    // Distribute occupants across the 4 rooms
    const perRoom = Math.floor(this.occupantTargetCount / 4);
    const remainder = this.occupantTargetCount % 4;

    this.rooms.forEach((room, rIdx) => {
      const count = perRoom + (rIdx === 0 ? remainder : 0);
      for (let i = 0; i < count; i++) {
        // Safe spawn within room bounds avoiding walls
        const margin = 28;
        const x = room.x + margin + Math.random() * (room.w - margin * 2);
        const y = room.y + margin + Math.random() * (room.h - margin * 2);

        this.occupants.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: 4.5,
          speed: 1.8 + Math.random() * 0.8,
          stress: 0.0,
          evacuated: false,
          trail: [],
          targetExit: null,
          isTrapped: false,
          colorHue: 165 // calm emerald
        });
      }
    });

    this.recomputeFlowFields();
  }

  clearHazards() {
    this.hazards = [];
    this.recomputeFlowFields();
    audioEngine.playChime(440, 0.15, 'sine');
  }

  spawnRandomHazard() {
    // Pick an impactful spot (near corridors or Atrium)
    const hotSpots = [
      { x: 550, y: 490 }, // Atrium bottleneck
      { x: 400, y: 410 }, // West Corridor entrance
      { x: 700, y: 410 }, // East Corridor entrance
      { x: 550, y: 220 }, // North Lab entrance
      { x: 550, y: 600 }  // Right above Exit A
    ];
    const spot = hotSpots[Math.floor(Math.random() * hotSpots.length)];
    const jitterX = spot.x + (Math.random() - 0.5) * 60;
    const jitterY = spot.y + (Math.random() - 0.5) * 40;

    this.hazards.push({
      x: Math.round(jitterX),
      y: Math.round(jitterY),
      radius: 46,
      pulsePhase: Math.random() * Math.PI,
      id: Date.now()
    });

    audioEngine.playHazardAlert();
    this.recomputeFlowFields();
    if (this.mode === 'dynamic') {
      audioEngine.playRerouteSuccess();
    }
  }

  setOccupantCount(count) {
    this.occupantTargetCount = count;
    this.resetSimulation();
  }

  toggleVectors() {
    this.showVectors = !this.showVectors;
  }

  /**
   * Recompute Navigation Flow Fields using Multi-Source BFS / Dijkstra
   */
  recomputeFlowFields() {
    const totalCells = this.gridCols * this.gridRows;
    const INF = 999999;

    // Helper: Build distance field to a set of target exits
    const buildField = (targetExits, considerHazards) => {
      const dist = new Float32Array(totalCells).fill(INF);
      const queue = [];

      // Check exit statuses
      this.exits.forEach(ex => {
        ex.status = 'active';
        if (considerHazards) {
          // Check if exit is blocked by fire
          for (const h of this.hazards) {
            const dx = ex.x - h.x;
            const dy = ex.y - h.y;
            if (Math.sqrt(dx * dx + dy * dy) < h.radius + 15) {
              ex.status = 'blocked';
              break;
            }
          }
        }
      });

      // Seed queue with cells intersecting active target exits
      targetExits.forEach(ex => {
        if (considerHazards && ex.status === 'blocked') return;

        const gx = Math.floor(ex.x / this.cellW);
        const gy = Math.floor(ex.y / this.cellH);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx >= 0 && nx < this.gridCols && ny >= 0 && ny < this.gridRows) {
              const idx = ny * this.gridCols + nx;
              if (!this.wallGrid[idx]) {
                dist[idx] = 0;
                queue.push(idx);
              }
            }
          }
        }
      });

      // Mark hazard cells with high cost or impassable
      const hazardCost = new Float32Array(totalCells).fill(0);
      if (considerHazards) {
        for (let gy = 0; gy < this.gridRows; gy++) {
          for (let gx = 0; gx < this.gridCols; gx++) {
            const cx = (gx + 0.5) * this.cellW;
            const cy = (gy + 0.5) * this.cellH;
            for (const h of this.hazards) {
              const d = Math.sqrt((cx - h.x) ** 2 + (cy - h.y) ** 2);
              if (d < h.radius) {
                hazardCost[gy * this.gridCols + gx] = INF; // impassable
              } else if (d < h.radius + 35) {
                hazardCost[gy * this.gridCols + gx] += (1 - (d - h.radius) / 35) * 50; // repulsive cost
              }
            }
          }
        }
      }

      // BFS Dijkstra wavefront expansion
      let head = 0;
      const neighbors = [
        { dx: 1, dy: 0, cost: 1 },
        { dx: -1, dy: 0, cost: 1 },
        { dx: 0, dy: 1, cost: 1 },
        { dx: 0, dy: -1, cost: 1 },
        { dx: 1, dy: 1, cost: 1.414 },
        { dx: -1, dy: 1, cost: 1.414 },
        { dx: 1, dy: -1, cost: 1.414 },
        { dx: -1, dy: -1, cost: 1.414 }
      ];

      while (head < queue.length) {
        const u = queue[head++];
        const ux = u % this.gridCols;
        const uy = Math.floor(u / this.gridCols);
        const currentDist = dist[u];

        for (const n of neighbors) {
          const vx = ux + n.dx;
          const vy = uy + n.dy;
          if (vx >= 0 && vx < this.gridCols && vy >= 0 && vy < this.gridRows) {
            const vIdx = vy * this.gridCols + vx;
            if (this.wallGrid[vIdx] || hazardCost[vIdx] >= INF) continue;

            const extraCost = hazardCost[vIdx];
            const newDist = currentDist + n.cost + extraCost;
            if (newDist < dist[vIdx]) {
              dist[vIdx] = newDist;
              queue.push(vIdx);
            }
          }
        }
      }

      // Compute vector gradients (vx, vy) pointing to lowest distance neighbor
      const field = new Array(totalCells);
      for (let gy = 0; gy < this.gridRows; gy++) {
        for (let gx = 0; gx < this.gridCols; gx++) {
          const idx = gy * this.gridCols + gx;
          if (this.wallGrid[idx] || dist[idx] >= INF) {
            field[idx] = { vx: 0, vy: 0, dist: INF };
            continue;
          }

          let minD = dist[idx];
          let bestVx = 0;
          let bestVy = 0;

          for (const n of neighbors) {
            const nx = gx + n.dx;
            const ny = gy + n.dy;
            if (nx >= 0 && nx < this.gridCols && ny >= 0 && ny < this.gridRows) {
              const nIdx = ny * this.gridCols + nx;
              if (dist[nIdx] < minD) {
                minD = dist[nIdx];
                bestVx = n.dx;
                bestVy = n.dy;
              }
            }
          }

          const len = Math.sqrt(bestVx * bestVx + bestVy * bestVy);
          field[idx] = {
            vx: len > 0 ? bestVx / len : 0,
            vy: len > 0 ? bestVy / len : 0,
            dist: dist[idx]
          };
        }
      }

      return field;
    };

    // Static Field: only targets Exit A (Old 2019 plan), ignores fire hazards
    const exitA = this.exits.filter(e => e.id === 'A');
    this.flowFieldStatic = buildField(exitA, false);

    // Dynamic Field: targets ALL exits (A, B, C) and avoids fire hazards dynamically!
    this.flowFieldDynamic = buildField(this.exits, true);
  }

  getFlowVector(x, y, isDynamic) {
    const gx = Math.floor(x / this.cellW);
    const gy = Math.floor(y / this.cellH);
    if (gx < 0 || gx >= this.gridCols || gy < 0 || gy >= this.gridRows) {
      return { vx: 0, vy: 0 };
    }
    const idx = gy * this.gridCols + gx;
    const field = isDynamic ? this.flowFieldDynamic : this.flowFieldStatic;
    return field[idx] || { vx: 0, vy: 0 };
  }

  updateSimulation(dt) {
    if (!this.isRunning) return;

    this.simTime += dt;
    const isDynamic = this.mode === 'dynamic';

    let totalStress = 0;
    let trappedCount = 0;
    let activeOccupants = 0;

    for (const p of this.occupants) {
      if (p.evacuated) continue;
      activeOccupants++;

      // 1. Query Navigation Flow Vector
      const flow = this.getFlowVector(p.x, p.y, isDynamic);

      // Desired velocity from pathfinding
      let desiredVx = flow.vx * p.speed;
      let desiredVy = flow.vy * p.speed;

      // 2. Fire avoidance & Stressed State
      let nearFire = false;
      let minFireDist = 9999;

      for (const h of this.hazards) {
        const dx = p.x - h.x;
        const dy = p.y - h.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minFireDist) minFireDist = dist;

        if (dist < h.radius + 12) {
          // Inside or right at perimeter
          nearFire = true;
          // Strong repulsion
          const push = ((h.radius + 12) - dist) * 0.12;
          const nx = dist > 0 ? dx / dist : Math.random() - 0.5;
          const ny = dist > 0 ? dy / dist : Math.random() - 0.5;
          p.vx += nx * push;
          p.vy += ny * push;
        }
      }

      if (!isDynamic) {
        // STATIC 2019 PLAN BEHAVIOR:
        // Blind tunnel vision toward Exit A.
        // If fire is in the way, they push forward anyway, turn red, stampede, and bottleneck!
        if (nearFire || minFireDist < 75) {
          p.stress = Math.min(1.0, p.stress + dt * 0.9);
          p.isTrapped = true;
          trappedCount++;
          // High jitter in panic
          p.vx += (Math.random() - 0.5) * 1.4;
          p.vy += (Math.random() - 0.5) * 1.4;
        } else {
          p.stress = Math.max(0.0, p.stress - dt * 0.2);
          p.isTrapped = false;
        }
      } else {
        // DYNAMIC ADAPTIVE ENGINE BEHAVIOR:
        // Bends seamlessly around hazards, stress remains near zero, moves cleanly
        if (nearFire) {
          p.stress = Math.min(0.35, p.stress + dt * 0.2);
        } else {
          p.stress = Math.max(0.0, p.stress - dt * 0.4);
        }
        p.isTrapped = false;
      }

      totalStress += p.stress;

      // 3. Flocking Separation from neighbor occupants
      for (const other of this.occupants) {
        if (other === p || other.evacuated) continue;
        const ox = p.x - other.x;
        const oy = p.y - other.y;
        const d = Math.sqrt(ox * ox + oy * oy);
        const minDist = p.radius + other.radius + 3;

        if (d < minDist && d > 0) {
          const sepForce = ((minDist - d) / minDist) * 0.35;
          p.vx += (ox / d) * sepForce;
          p.vy += (oy / d) * sepForce;

          // In Static mode, clustering creates extreme stampede delay
          if (!isDynamic && p.stress > 0.4 && other.stress > 0.4) {
            p.stress = Math.min(1.0, p.stress + 0.02);
          }
        }
      }

      // Blend steering toward desired vector
      p.vx += (desiredVx - p.vx) * 0.16;
      p.vy += (desiredVy - p.vy) * 0.16;

      // Cap max speed
      const curSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const effectiveMaxSpeed = p.isTrapped ? p.speed * 0.45 : p.speed;
      if (curSpeed > effectiveMaxSpeed) {
        p.vx = (p.vx / curSpeed) * effectiveMaxSpeed;
        p.vy = (p.vy / curSpeed) * effectiveMaxSpeed;
      }

      // 4. Update Position & Wall Collisions
      p.x += p.vx;
      p.y += p.vy;

      // Simple wall slide
      for (const wall of this.walls) {
        if (
          p.x + p.radius > wall.x &&
          p.x - p.radius < wall.x + wall.w &&
          p.y + p.radius > wall.y &&
          p.y - p.radius < wall.y + wall.h
        ) {
          // Push back out
          const overlapL = (p.x + p.radius) - wall.x;
          const overlapR = (wall.x + wall.w) - (p.x - p.radius);
          const overlapT = (p.y + p.radius) - wall.y;
          const overlapB = (wall.y + wall.h) - (p.y - p.radius);

          const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);
          if (minOverlap === overlapL) { p.x = wall.x - p.radius; p.vx *= -0.2; }
          else if (minOverlap === overlapR) { p.x = wall.x + wall.w + p.radius; p.vx *= -0.2; }
          else if (minOverlap === overlapT) { p.y = wall.y - p.radius; p.vy *= -0.2; }
          else { p.y = wall.y + wall.h + p.radius; p.vy *= -0.2; }
        }
      }

      // 5. Check Exit Reached
      for (const ex of this.exits) {
        // Can only exit if exit is active and not blocked
        if (ex.status === 'blocked') continue;
        const dx = p.x - ex.x;
        const dy = p.y - ex.y;
        if (Math.sqrt(dx * dx + dy * dy) < ex.radius) {
          p.evacuated = true;
          this.evacuatedCount++;
          audioEngine.playEvacuateBlip();
          break;
        }
      }

      // Update trail
      if (isDynamic) {
        p.trail.unshift({ x: p.x, y: p.y });
        if (p.trail.length > 8) p.trail.pop();
      } else {
        p.trail = [];
      }
    }

    // Update Telemetry Metrics
    if (activeOccupants > 0) {
      const avgStress = totalStress / activeOccupants;
      if (!isDynamic) {
        // Bottleneck skyrockets in Static mode
        this.bottleneckIndex = Math.min(9.8, 1.0 + (trappedCount / activeOccupants) * 7.5 + avgStress * 2.2);
      } else {
        // Stays smooth in Dynamic
        this.bottleneckIndex = Math.max(1.0, 1.05 + avgStress * 0.4);
      }
    }

    this.updateHUDTelemetry();
  }

  updateHUDTelemetry() {
    const total = this.occupantTargetCount;
    const evacPct = Math.round((this.evacuatedCount / total) * 100);

    const evacCountEl = document.getElementById('sb-evac-count');
    const evacPctEl = document.getElementById('sb-evac-pct');
    const evacBarEl = document.getElementById('sb-evac-bar');
    const bottleneckEl = document.getElementById('sb-bottleneck-idx');
    const timerEl = document.getElementById('sb-timer');
    const statusExitA = document.getElementById('sb-exit-a-status');
    const statusExitB = document.getElementById('sb-exit-b-status');
    const statusExitC = document.getElementById('sb-exit-c-status');

    if (evacCountEl) evacCountEl.textContent = `${this.evacuatedCount} / ${total}`;
    if (evacPctEl) evacPctEl.textContent = `${evacPct}%`;
    if (evacBarEl) evacBarEl.style.width = `${evacPct}%`;

    if (bottleneckEl) {
      bottleneckEl.textContent = `${this.bottleneckIndex.toFixed(1)}x`;
      bottleneckEl.className = 'metric-val ' + (this.bottleneckIndex > 3.0 ? 'danger' : 'nominal');
    }

    if (timerEl) {
      const mins = String(Math.floor(this.simTime / 60)).padStart(2, '0');
      const secs = String(Math.floor(this.simTime % 60)).padStart(2, '0');
      const ms = String(Math.floor((this.simTime * 10) % 10));
      timerEl.textContent = `${mins}:${secs}.${ms}`;
    }

    // Exit status badges
    const exitA = this.exits.find(e => e.id === 'A');
    const exitB = this.exits.find(e => e.id === 'B');
    const exitC = this.exits.find(e => e.id === 'C');

    if (statusExitA) {
      const isBlocked = exitA?.status === 'blocked';
      statusExitA.textContent = isBlocked ? 'COMPROMISED' : 'ACTIVE';
      statusExitA.className = 'badge ' + (isBlocked ? 'badge-danger' : 'badge-amber');
    }
    if (statusExitB) {
      statusExitB.textContent = this.mode === 'dynamic' ? 'PRIMARY REROUTE' : 'STANDBY (IGNORED)';
      statusExitB.className = 'badge ' + (this.mode === 'dynamic' ? 'badge-cyan' : 'badge-dim');
    }
    if (statusExitC) {
      statusExitC.textContent = this.mode === 'dynamic' ? 'AUXILIARY REROUTE' : 'STANDBY (IGNORED)';
      statusExitC.className = 'badge ' + (this.mode === 'dynamic' ? 'badge-emerald' : 'badge-dim');
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.scaleX, this.scaleY);

    // Dark cyber blueprint background
    ctx.fillStyle = '#070b12';
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw Blueprint Grid lines
    this.drawBlueprintGrid(ctx);

    // Draw Vector Flow Fields (if enabled)
    if (this.showVectors) {
      this.drawVectorFlowField(ctx);
    }

    // Draw Architectural Layout (Rooms, Walls, Corridors)
    this.drawArchitecturalBlueprint(ctx);

    // Draw Exits
    this.drawExits(ctx);

    // Draw Occupant Particles & Dynamic Streams
    this.drawOccupants(ctx);

    // Draw Fire / Hazard Nodes
    this.drawHazards(ctx);

    // Draw Mouse Cursor Targeting Reticle
    if (this.mousePos.isHovering) {
      this.drawTargetingReticle(ctx);
    }

    ctx.restore();
  }

  drawBlueprintGrid(ctx) {
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 1;

    // Major grid 50px
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    // Blueprint grid coordinate labels
    ctx.fillStyle = 'rgba(71, 85, 105, 0.5)';
    ctx.font = '8px "JetBrains Mono", monospace';
    for (let x = 80; x < this.width; x += 160) {
      ctx.fillText(`SEC-${Math.floor(x / 10)}X`, x + 4, 14);
    }
  }

  drawVectorFlowField(ctx) {
    const isDynamic = this.mode === 'dynamic';
    const field = isDynamic ? this.flowFieldDynamic : this.flowFieldStatic;
    const arrowColor = isDynamic ? 'rgba(6, 182, 212, 0.22)' : 'rgba(245, 158, 11, 0.16)';

    ctx.strokeStyle = arrowColor;
    ctx.fillStyle = arrowColor;
    ctx.lineWidth = 1.2;

    for (let gy = 1; gy < this.gridRows - 1; gy += 2) {
      for (let gx = 1; gx < this.gridCols - 1; gx += 2) {
        const idx = gy * this.gridCols + gx;
        if (this.wallGrid[idx]) continue;
        const cell = field[idx];
        if (!cell || (cell.vx === 0 && cell.vy === 0)) continue;

        const cx = (gx + 0.5) * this.cellW;
        const cy = (gy + 0.5) * this.cellH;
        const len = 9;

        const ex = cx + cell.vx * len;
        const ey = cy + cell.vy * len;

        // Draw sleek arrow line
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Arrow head dot
        ctx.beginPath();
        ctx.arc(ex, ey, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawArchitecturalBlueprint(ctx) {
    // Room filled backgrounds
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    this.rooms.forEach(r => {
      ctx.fillRect(r.x, r.y, r.w, r.h);

      // Room border accent
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);

      // Room name labels
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillText(r.name, r.x + 12, r.y + 20);
    });

    // Hallways & corridors shading
    ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
    this.corridors.forEach(c => {
      ctx.fillRect(c.x, c.y, c.w, c.h);
    });

    // Draw Walls with blueprint glow
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;

    for (const w of this.walls) {
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeRect(w.x, w.y, w.w, w.h);
    }
  }

  drawExits(ctx) {
    for (const ex of this.exits) {
      const isBlocked = ex.status === 'blocked';
      const color = isBlocked ? '#ef4444' : ex.color;

      // Outer pulsing ring
      const pulse = Math.sin(this.simTime * 4 + (ex.id.charCodeAt(0))) * 4;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = isBlocked ? 'rgba(239, 68, 68, 0.4)' : `${color}44`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Exit portal glow
      const grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.radius);
      grad.addColorStop(0, `${color}88`);
      grad.addColorStop(0.7, `${color}22`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.radius, 0, Math.PI * 2);
      ctx.fill();

      // Exit core icon
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = isBlocked ? '#ef4444' : '#f8fafc';
      ctx.font = '700 10px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ex.name, ex.x, ex.y + (ex.y > 350 ? 28 : -18));
      ctx.textAlign = 'left';
    }
  }

  drawOccupants(ctx) {
    const isDynamic = this.mode === 'dynamic';

    for (const p of this.occupants) {
      if (p.evacuated) continue;

      // Draw dynamic trail ribbons
      if (isDynamic && p.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) {
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
        }
        ctx.strokeStyle = `rgba(16, 185, 129, ${0.45 - p.stress * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Occupant Color & Stress
      let bodyColor;
      if (p.isTrapped || p.stress > 0.6) {
        // High stress panic: flashing crimson
        const flash = Math.sin(this.simTime * 14 + p.x) > 0;
        bodyColor = flash ? '#ef4444' : '#f97316';

        // Panic stress halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (p.stress > 0.25) {
        bodyColor = '#f59e0b'; // amber warning
      } else {
        bodyColor = isDynamic ? '#10b981' : '#38bdf8'; // emerald / cyan
      }

      // Draw occupant dot
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle direction pointer
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 3.5, p.y + p.vy * 3.5);
      ctx.stroke();
    }
  }

  drawHazards(ctx) {
    for (const h of this.hazards) {
      h.pulsePhase += 0.05;
      const pulse = Math.sin(h.pulsePhase) * 4;

      // Outer smoke aura
      const auraGrad = ctx.createRadialGradient(h.x, h.y, h.radius * 0.4, h.x, h.y, h.radius + 18 + pulse);
      auraGrad.addColorStop(0, 'rgba(239, 68, 68, 0.4)');
      auraGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.2)');
      auraGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius + 18 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Impassable hazard border
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fire Core Gradient
      const coreGrad = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.radius);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.25, '#fbbf24');
      coreGrad.addColorStop(0.65, '#ef4444');
      coreGrad.addColorStop(1, '#991b1b');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Hazard Warning Symbol
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 12px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚠ FIRE', h.x, h.y);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    }
  }

  drawTargetingReticle(ctx) {
    const { x, y } = this.mousePos;

    // Crosshair lines
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 24, y);
    ctx.lineTo(x + 24, y);
    ctx.moveTo(x, y - 24);
    ctx.lineTo(x, y + 24);
    ctx.stroke();

    // Projected Hazard Radius circle
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.stroke();
    ctx.setLineDash([]);

    // Hover instruction tag
    ctx.fillStyle = '#f87171';
    ctx.font = '600 9px "JetBrains Mono", monospace';
    ctx.fillText('CLICK: DROP HAZARD NODE', x + 15, y - 15);
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    this.updateSimulation(dt);
    this.render();

    requestAnimationFrame(this.loop);
  }
}
