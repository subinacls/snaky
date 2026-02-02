// ==UserScript==
// @name         Slither.io Ultimate Bot - Risk/Reward Edition
// @namespace    https://github.com/subinacls/snaky
// @version      7.3.0
// @description  HIGH PERFORMANCE v7.3.0 - Tiered sensor processing, object pooling, squared distance optimization, adaptive frame timing
// @author       Snaky
// @match        *://slither.io/*
// @match        *://slither.com/io*
// @grant        none
// @run-at       document-end
// @noframes

(function() {
    'use strict';

    // ==================== CANVAS OPTIMIZATION PATCH ====================
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, options) {
        if (type === '2d') {
            options = options || {};
            options.willReadFrequently = true;
        }
        return originalGetContext.call(this, type, options);
    };

    // ==================== SLITHER.IO KNOWN GAME VARIABLES ====================
    // These are the actual variable names used by slither.io
    // snake - your snake object
    // snake.xx, snake.yy - interpolated position
    // snake.ang - current angle
    // snake.sp - speed
    // snake.sc - scale (size)
    // snake.pts - body segments array
    // snakes - array of all snakes
    // foods - array of all food particles
    // xm, ym - mouse offset from center (controls direction)
    // gsc - global scale (zoom)
    // playing - boolean if in game
    // setAcceleration(1/0) - boost on/off
    // grd - game radius
    // view_xx, view_yy - viewport center
    // bso - best score object

    // ==================== LOGGER (reduces verbose output) ====================
    const DEBUG = false;  // Set to true for verbose console output
    const LOG_LEVEL = { NONE: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4 };
    let currentLogLevel = DEBUG ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR;
    const log = {
        error: (msg, style = '') => currentLogLevel >= LOG_LEVEL.ERROR && console.log(`%c❌ ${msg}`, style || 'color:#ff4444'),
        warn: (msg, style = '') => currentLogLevel >= LOG_LEVEL.WARN && console.log(`%c⚠️ ${msg}`, style || 'color:#ffaa00'),
        info: (msg, style = '') => currentLogLevel >= LOG_LEVEL.INFO && console.log(`%c${msg}`, style || 'color:#00aaff'),
        debug: (msg, style = '') => currentLogLevel >= LOG_LEVEL.DEBUG && console.log(`%c${msg}`, style || 'color:#888888'),
        setLevel: (level) => { currentLogLevel = level; }
    };
    const _log = (msg, style) => DEBUG && console.log(msg, style);

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        // Bot Settings
        bot: {
            enabled: true,
            autoRespawn: true,
            respawnDelay: 2500,
            mode: 'auto',  // 'auto', 'assist', 'manual'
            playStyle: 'balanced',  // 'aggressive', 'defensive', 'balanced', 'farming'
            circleMode: false,  // Circle around target when attacking
            foodMagnet: true,   // Prioritize nearby food clusters
        },

        // Visual Settings
        visual: {
            zoom: {
                enabled: true,
                defaultLevel: 0.9,
                minLevel: 0.1,
                maxLevel: 2.5,
                step: 0.1
            },
            minimap: {
                enabled: true,
                size: 180,
                opacity: 0.9
            },
            fps: {
                show: true,
                boostMode: false  // Reduce graphics for better FPS
            },
            skins: {
                enabled: true,
                customSkin: 0  // 0-39 for different skins
            },
            overlay: {
                enabled: true,
                showDangerArrows: true,  // Show arrows pointing to threats
                showFoodHighlight: true, // Highlight best food targets
                showSpeed: true,         // Show current speed
                showZoom: true,          // Show current zoom level
                showLeaderboard: true,   // Show leaderboard position
            },
            darkMode: false,
            showGrid: true,
            graphicsQuality: 'high'  // 'low', 'medium', 'high'
        },

        // Lag Detection and Control
        lagControl: {
            enabled: true,
            fpsThreshold: 20,           // FPS below this = lag
            frameTimeThreshold: 80,     // Frame time above 80ms = lag
            pingThreshold: 200,         // Ping above 200ms = lag
            lagSmoothingFactor: 0.8,    // How much to smooth movements during lag (0-1)
            reduceTurningInLag: true,   // Reduce turn speed during lag
            lagTurnSpeedMultiplier: 0.4, // Turn at 40% speed during lag
            stopCirclingInLag: true,    // Prevent circling behavior during lag
            straightLineInLag: true,    // Prefer straight movement during lag
            boostDisabledInLag: true,   // Disable boost during lag (saves length)
            historySize: 10             // How many frames to track for lag detection
        },

        // Statistics
        stats: {
            enabled: true,
            trackKills: true,
            trackDeaths: true,
            showSessionTime: true
        },

        // Movement Settings - ALWAYS BE EATING!
        movement: {
            foodSeekRadius: 200,      // 200px from mouth - tight eating radius
            deadSnakeFoodRadius: 600, // Go further for dead snake remains (high value!)
            clusterScanRadius: 500,   // How far to look for food clusters
            stringScanRadius: 400,    // How far to look for food strings/trails
            predictionFrames: 15,
            turnSpeed: 0.18,          // Fast turns for food collection
            boostThreshold: 100,      // Low threshold - boost to dead snake food early
            boostToDeadSnakeFood: true, // ALWAYS boost to dead snake food
            emergencyTurn: false,     // Quick 180 turn
            safetyFirst: true,        // Safety still protects us
            prioritizeFood: true,     // FOOD IS PRIORITY when safe
            alwaysBeEating: true      // MOTTO: Always Be Eating!
        },

        // Collision Avoidance (INSTANT TRAP DETECTION) - EXTRA CAUTIOUS
        collision: {
            enabled: true,
            detectionRadius: 900,        // MASSIVELY INCREASED for trap detection!
            dangerZoneRadius: 500,       // WIDER danger zone - detect squeeze earlier
            criticalZoneRadius: 250,     // LARGER instant react zone
            escapeBoostEnabled: true,    // Boost when escaping traps
            headOnDetection: true,       // Detect head-on collisions
            encirclementDetection: true, // Detect when being surrounded
            squeezeDetection: true,      // NEW: Detect squeeze/wrap attacks
            predictionDepth: 80,         // Predict FURTHER ahead
            safetyMargin: 100,           // LARGER safety margin
            trapDetectionSensitivity: 0.15, // EVEN MORE sensitive
            cautionThreshold: 0.03,      // Start evading at 3% danger (VERY EARLY!)
            squeezeEscapeThreshold: 2,   // Escape if snake in 2+ quadrants (was 3)
            earlyEscapeEnabled: true,    // Escape at first sign of encirclement
            edgeDetectionRadius: 1200,   // Start turning away from edge at 1200px
            edgeCriticalRadius: 600,     // CRITICAL edge danger - instant turn
            edgeEmergencyRadius: 350,    // EMERGENCY - boost away NOW!
            edgePredictionFrames: 30,    // Look ahead this many frames for edge collision
            wallDetectionEnabled: true,  // Detect snake bodies as walls
            trapRadarRange: 600          // NEW: How far radar scans for circling snakes
        },

        // ACTIVE DEFENSE Settings - Counter-attack when being attacked
        defense: {
            enabled: true,               // Enable active defense
            detectionRange: 350,         // INCREASED - detect attackers further
            threatThreshold: 1.2,        // LOWER - trigger defense easier
            counterAttack: true,         // Target attacker's head
            boostInDefense: true,        // Boost when defending
            priorityOverFood: true       // Defense takes priority over food seeking
        },

        // Attack Settings - AGGRESSIVE GROWTH MODE
        attack: {
            enabled: true,               // ENABLED for maximum growth!
            circleSmallSnakes: true,
            cutOffEnabled: true,
            killStrategy: true,          // Position body in front of enemy heads
            minSizeAdvantage: 1.2,       // Attack if we're only 1.2x bigger
            aggressiveChase: true,       // Chase targets aggressively
            boostForKill: true,          // Boost when going for a kill
            killBoostThreshold: 150,     // Boost when target is within 150px
            preyDetectionRange: 500,     // Look for prey within this range
            deadSnakePriority: true      // Prioritize dead snake food over hunting
        },

        // Safety Override - Bot takes control in danger
        safetyOverride: {
            enabled: true,               // Override user when in danger
            triggerDanger: 0.25,         // Danger level to trigger override (LOWER - 25%)
            releaseDanger: 0.15,         // Danger level to release control back
            edgeOverride: true,          // Override near map edge
            edgeOverrideDistance: 800,   // Override when this close to edge (increased from 500)
            boostAwayFromDanger: true    // Boost when overriding for safety
        },

        // === v7.3: PERFORMANCE SETTINGS ===
        // Controls processing efficiency vs responsiveness tradeoff
        performance: {
            enabled: true,                  // Enable performance optimizations
            tieredProcessing: true,         // Use tiered sensor processing
            objectPooling: true,            // Use object pooling to reduce GC
            batchSnakeProcessing: true,     // Batch process nearby snakes
            snakeCacheMs: 30,               // Cache nearby snakes for this many ms
            visualThrottleMs: 50,           // Throttle visual updates when lagging
            frameTimeTarget: 12,            // Target ms per frame (83fps)
            frameTimeCritical: 25,          // Skip non-essential work above this
            frameTimeEmergency: 40,         // Minimal processing only above this
            maxNearbySnakes: 50,            // Max snakes to process per frame
            maxFoodItems: 100,              // Max food items to consider
            dangerModeThreshold: 300,       // Distance (px) to enable danger mode
            logPerformance: false           // Log frame timing info
        },

        // Debug
        debug: {
            enabled: true,
            showVectors: false,
            showDangerZones: false,
            logInterval: 3000
        },

        // === RISK VS REWARD SYSTEM (v7.0) ===
        // Controls how conservative the bot is when seeking food near enemies
        riskReward: {
            enabled: true,                  // Enable risk vs reward evaluation
            riskBias: 0.7,                  // 0.0 = pure reward, 1.0 = pure risk avoidance (0.7 = SAFETY FIRST)

            // Distance thresholds for snake danger scoring
            criticalSnakeDist: 150,         // Snake head this close = MAX danger (INCREASED)
            dangerSnakeDist: 280,           // Snake head in danger zone (INCREASED)
            cautionSnakeDist: 450,          // Snake head in caution zone (INCREASED)
            bodyDangerDist: 80,             // Enemy body this close = dangerous

            // Speed factors - fast snakes are more dangerous
            speedDangerMultiplier: 0.15,    // How much speed increases danger (0.15 = +15% per speed unit above 11)
            boostingDangerMultiplier: 2.5,  // Boosting snakes are 2.5x more dangerous

            // Heading factors - snakes heading toward food are more dangerous
            headingTowardDanger: 1.8,       // Snake heading toward food = 80% more danger
            headingAwayBonus: 0.4,          // Snake heading away = 60% LESS danger

            // Food value thresholds
            minFoodValueToRisk: 50,         // Minimum food value to consider taking any risk
            hugeFoodThreshold: 200,         // Food value above this = consider moderate risk
            massiveFoodThreshold: 500,      // Food value above this = consider higher risk

            // Risk thresholds - when to SKIP food
            skipFoodRiskThreshold: 0.35,    // Skip food if risk score > 35% (SAFETY FIRST)
            noBoostRiskThreshold: 0.20,     // Don't boost if risk score > 20%
            slowApproachThreshold: 0.25,    // Slow approach (no aggressive moves) if risk > 25%

            // Dead snake food special rules (high value but often contested)
            deadSnakeRiskMultiplier: 1.5,   // Dead snake food risks are 1.5x weighted (more dangerous)
            deadSnakeMinDistance: 150,      // Minimum safe distance to dead snake when enemies near
            deadSnakeContestPenalty: 0.4,   // Penalty when multiple snakes are after dead snake food

            // Crowd multipliers - more snakes = exponentially more dangerous
            twoSnakeDangerMultiplier: 1.8,  // 2 snakes near food = 80% more danger
            threeSnakeDangerMultiplier: 3.0, // 3+ snakes near food = 3x danger

            // Escape priority - when to abandon food and escape
            abandonFoodDanger: 0.40,        // Abandon current food target if danger > 40% (EARLIER)

            // Logging
            logDecisions: true              // Log risk vs reward decisions
        }
    };

    // ==================== GLOBAL STATE ====================
    const STATE = {
        gameLoaded: false,
        botRunning: false,
        currentAngle: 0,
        targetAngle: 0,
        threats: [],
        nearbyFood: [],
        isBoosting: false,
        isTrapped: false,
        isEvading: false,       // Active instant evasion
        errorCount: 0,          // Track errors per second
        isDefending: false,     // Active defense mode
        evasionDanger: 0,       // Current evasion danger level
        escapeAngle: null,
        // v7.1: Danger lockout state - blocks food/attack when danger detected
        dangerLockout: false,
        currentDangerLevel: 0,
        currentDangerSource: '',
        // v7.1: Snake prediction intents
        snakeIntents: [],
        // v7.1: Evasion rings state
        evasionRings: [],
        blockedAngles: [],
        safeGaps: [],
        blockedPercentage: 0,
        bestEscapeAngle: 0,
        // v7.1.2: Aggressive snake tracking
        aggressiveSnakes: new Map(),  // Map of snake ID -> aggression data
        boostingSnakes: new Map(),    // Map of snake ID -> boost tracking
        interceptAttempts: [],        // Recent intercept attempts against us
        // v7.1.3: Retreat mode
        retreatMode: false,
        lastEscapeSafetyScore: 1.0,
        // v7.2: Vision-based detection
        trackedSnakeCount: 0,         // Total snakes being tracked
        visionDangerLevel: 0,         // Danger level from vision system
        viewportInfo: null,           // Current viewport/visible area info
        fps: 0,
        frameCount: 0,
        lastFpsTime: Date.now(),
        lastDebugTime: Date.now(),
        lastVarScan: 0,
        // Lag detection state
        lagDetected: false,
        lagLevel: 0,              // 0 = no lag, 1 = mild, 2 = moderate, 3 = severe
        frameTimeHistory: [],
        lastFrameTime: Date.now(),
        avgFrameTime: 16,
        currentPing: 0,
        lastAngleChange: 0,
        consecutiveTurns: 0,
        lastTurnDirection: 0,
        canvas: null,
        ctx: null,
        minimapCanvas: null,
        minimapCtx: null,
        dangerCanvas: null,
        dangerCtx: null,
        gameCanvas: null,
        mousePos: { x: 0, y: 0 },
        overlay: null,
        statusBar: null,
        helpPopup: null,
        playing: false,
        connectionStatus: 'disconnected',
        invertColors: false,  // Color inversion state
        // Statistics
        stats: {
            kills: 0,
            deaths: 0,
            maxLength: 0,
            gamesPlayed: 0,
            sessionStart: Date.now(),
            lastLength: 0
        },
        // Manual control override
        manualOverride: false,
        manualBoost: false,
        boostLocked: false,
        lastClickTime: 0,
        // Safety override system
        safetyOverrideActive: false,    // Bot has taken control for safety
        safetyOverrideReason: null,     // Why override was triggered
        lastUserControlTime: 0,          // When user last had control
        userWantsControl: false          // User pressed key for instant control
    };

    // ==================== GAME VARIABLE FINDER ====================
    const GameVars = {
        // Slither.io uses these exact variable names
        lastScanTime: 0,
        scanInterval: 200,

        // Check if game is ready - use multiple detection methods
        isGameReady: () => {
            // Method 1: Standard window.snake
            if (typeof window.snake !== 'undefined' &&
                window.snake !== null &&
                typeof window.snake.xx === 'number' &&
                !window.snake.dead) {
                return true;
            }

            // Method 2: Use GameScanner to find snake
            const scannedSnake = GameScanner.getSnake();
            if (scannedSnake && typeof scannedSnake.xx === 'number' && !scannedSnake.dead) {
                return true;
            }

            // Method 3: Check if playing flag is set AND we have view coordinates
            // The camera follows the player, so if we have view coords, we're playing!
            if (window.playing === true && typeof window.view_xx === 'number') {
                return true;
            }

            return false;
        },

        // Check if we're playing
        isPlaying: () => {
            return window.playing === true || GameVars.isGameReady();
        },

        // Check if we're dead
        isDead: () => {
            const snake = GameScanner.getSnake() || window.snake;
            if (snake && snake.dead) return true;
            return window.dead === true || (window.playing === false && !GameVars.isGameReady());
        },

        // Get your snake - check multiple sources
        getSnake: () => {
            // First try standard
            if (typeof window.snake !== 'undefined' && window.snake !== null) {
                return window.snake;
            }
            // Then try scanner
            return GameScanner.getSnake();
        },

        // Get all snakes array
        getSnakes: () => {
            if (typeof window.snakes !== 'undefined' && Array.isArray(window.snakes)) {
                return window.snakes;
            }
            return [];
        },

        // Get all foods array
        getFoods: () => {
            if (typeof window.foods !== 'undefined' && Array.isArray(window.foods)) {
                return window.foods;
            }
            return [];
        },

        // Get game canvas
        getCanvas: () => {
            // Slither.io uses mc (main canvas) or just the first canvas
            if (typeof window.mc !== 'undefined' && window.mc) {
                return window.mc;
            }
            return document.querySelector('canvas');
        },

        // Get viewport center
        getViewport: () => {
            return {
                x: typeof window.view_xx !== 'undefined' ? window.view_xx : 0,
                y: typeof window.view_yy !== 'undefined' ? window.view_yy : 0
            };
        },

        // Get map radius
        getMapRadius: () => {
            return typeof window.grd !== 'undefined' ? window.grd : 21600;
        },

        // Diagnostic info
        getDiagnostics: () => {
            const snake = GameVars.getSnake();
            return {
                // Game state
                playing: window.playing,
                dead: window.dead,
                connecting: window.connecting,

                // Snake data
                hasSnake: snake !== null,
                snakeX: snake ? snake.xx : null,
                snakeY: snake ? snake.yy : null,
                snakeAng: snake ? snake.ang : null,

                // Arrays
                snakesCount: GameVars.getSnakes().filter(s => s !== null).length,
                foodsCount: GameVars.getFoods().filter(f => f !== null).length,

                // Controls
                xm: window.xm,
                ym: window.ym,
                gsc: window.gsc,

                // Functions
                hasSetAccel: typeof window.setAcceleration === 'function',
                hasConnect: typeof window.connect === 'function',

                // Canvas
                hasCanvas: GameVars.getCanvas() !== null
            };
        }
    };

    // ==================== UTILITY FUNCTIONS ====================
    // ==================== HIGH PERFORMANCE OBJECT POOL ====================
    // Reuse objects to avoid GC pressure - critical for 60fps processing
    const ObjectPool = {
        // Pre-allocated vectors
        _vectors: [],
        _vectorIndex: 0,
        _maxVectors: 100,

        // Pre-allocated threat objects
        _threats: [],
        _threatIndex: 0,
        _maxThreats: 50,

        // Initialize pools
        init: () => {
            for (let i = 0; i < ObjectPool._maxVectors; i++) {
                ObjectPool._vectors.push({ x: 0, y: 0, dist: 0, angle: 0 });
            }
            for (let i = 0; i < ObjectPool._maxThreats; i++) {
                ObjectPool._threats.push({ danger: 0, dist: 0, angle: 0, type: '', snake: null });
            }
        },

        // Get a vector from pool (resets each frame)
        getVector: () => {
            if (ObjectPool._vectorIndex >= ObjectPool._maxVectors) ObjectPool._vectorIndex = 0;
            return ObjectPool._vectors[ObjectPool._vectorIndex++];
        },

        // Get a threat object from pool
        getThreat: () => {
            if (ObjectPool._threatIndex >= ObjectPool._maxThreats) ObjectPool._threatIndex = 0;
            const t = ObjectPool._threats[ObjectPool._threatIndex++];
            t.danger = 0; t.dist = 0; t.angle = 0; t.type = ''; t.snake = null;
            return t;
        },

        // Reset pools at frame start
        resetFrame: () => {
            ObjectPool._vectorIndex = 0;
            ObjectPool._threatIndex = 0;
        }
    };
    ObjectPool.init();

    // ==================== FAST MATH UTILITIES ====================
    // Optimized math functions for hot paths
    const FastMath = {
        // Squared distance - avoid sqrt when only comparing distances
        distSq: (x1, y1, x2, y2) => {
            const dx = x2 - x1, dy = y2 - y1;
            return dx * dx + dy * dy;
        },

        // Fast distance with squared fallback
        dist: (x1, y1, x2, y2) => {
            const dx = x2 - x1, dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        },

        // Check if within radius (uses squared distance)
        withinRadius: (x1, y1, x2, y2, radius) => {
            const dx = x2 - x1, dy = y2 - y1;
            return (dx * dx + dy * dy) <= radius * radius;
        },

        // Check if within radius and return squared distance (avoid double calc)
        withinRadiusGetDistSq: (x1, y1, x2, y2, radius) => {
            const dx = x2 - x1, dy = y2 - y1;
            const distSq = dx * dx + dy * dy;
            return distSq <= radius * radius ? distSq : -1;
        },

        // Fast angle normalization (branchless-ish)
        normalizeAngle: (angle) => {
            angle = angle % (2 * Math.PI);
            if (angle > Math.PI) return angle - 2 * Math.PI;
            if (angle < -Math.PI) return angle + 2 * Math.PI;
            return angle;
        },

        // Pre-computed values
        PI: Math.PI,
        TWO_PI: Math.PI * 2,
        HALF_PI: Math.PI / 2,
        DEG_TO_RAD: Math.PI / 180,
        RAD_TO_DEG: 180 / Math.PI,

        // Fast atan2 approximation (within ~0.01 radians) for non-critical uses
        fastAtan2: (y, x) => {
            // Use native atan2 - modern browsers optimize this well
            return Math.atan2(y, x);
        },

        // Clamp value between min and max
        clamp: (val, min, max) => val < min ? min : (val > max ? max : val),

        // Linear interpolation
        lerp: (a, b, t) => a + (b - a) * t
    };

    // ==================== BATCH PROCESSING UTILITIES ====================
    // Process multiple items efficiently
    const BatchProcessor = {
        // Pre-allocated result arrays
        _nearbySnakes: new Array(50),
        _nearbySnakesCount: 0,
        _nearbyFood: new Array(100),
        _nearbyFoodCount: 0,

        // Fast snake filtering - returns count, fills pre-allocated array
        filterNearbySnakes: (headX, headY, maxDistSq, snakesArr, mySnake) => {
            BatchProcessor._nearbySnakesCount = 0;
            if (!snakesArr) return 0;

            const results = BatchProcessor._nearbySnakes;
            let count = 0;
            const len = snakesArr.length;

            for (let i = 0; i < len && count < 50; i++) {
                const s = snakesArr[i];
                if (!s || s === mySnake || s.dead) continue;

                const sx = s.xx || s.x || 0;
                const sy = s.yy || s.y || 0;
                const dx = sx - headX, dy = sy - headY;
                const distSq = dx * dx + dy * dy;

                if (distSq <= maxDistSq) {
                    results[count++] = { snake: s, x: sx, y: sy, distSq: distSq, dist: Math.sqrt(distSq) };
                }
            }

            BatchProcessor._nearbySnakesCount = count;
            return count;
        },

        // Get sorted nearby snakes (sorts in-place)
        getSortedNearbySnakes: () => {
            const arr = BatchProcessor._nearbySnakes;
            const count = BatchProcessor._nearbySnakesCount;

            // Simple insertion sort for small arrays (faster than native sort)
            for (let i = 1; i < count; i++) {
                const item = arr[i];
                let j = i - 1;
                while (j >= 0 && arr[j].distSq > item.distSq) {
                    arr[j + 1] = arr[j];
                    j--;
                }
                arr[j + 1] = item;
            }

            return { array: arr, count: count };
        }
    };

    const Utils = {
        distance: (x1, y1, x2, y2) => FastMath.dist(x1, y1, x2, y2),

        // FAST: Squared distance for comparisons
        distanceSq: (x1, y1, x2, y2) => FastMath.distSq(x1, y1, x2, y2),

        angle: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),

        normalizeAngle: (angle) => FastMath.normalizeAngle(angle),

        angleDiff: (a1, a2) => {
            let diff = Utils.normalizeAngle(a2 - a1);
            return diff;
        },

        // Check if an angle is within a range (handles wrap-around)
        isAngleInRange: (angle, rangeStart, rangeEnd) => {
            // Normalize all angles to -PI to PI
            angle = Utils.normalizeAngle(angle);
            rangeStart = Utils.normalizeAngle(rangeStart);
            rangeEnd = Utils.normalizeAngle(rangeEnd);

            // Handle wrap-around case
            if (rangeStart <= rangeEnd) {
                return angle >= rangeStart && angle <= rangeEnd;
            } else {
                // Range wraps around (e.g., from 170° to -170°)
                return angle >= rangeStart || angle <= rangeEnd;
            }
        },

        pointInCircle: (px, py, cx, cy, r) => Utils.distance(px, py, cx, cy) <= r,

        lineCircleIntersect: (x1, y1, x2, y2, cx, cy, r) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const fx = x1 - cx;
            const fy = y1 - cy;

            const a = dx * dx + dy * dy;
            const b = 2 * (fx * dx + fy * dy);
            const c = fx * fx + fy * fy - r * r;

            let discriminant = b * b - 4 * a * c;
            if (discriminant < 0) return false;

            discriminant = Math.sqrt(discriminant);
            const t1 = (-b - discriminant) / (2 * a);
            const t2 = (-b + discriminant) / (2 * a);

            return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
        },

        predictPosition: (x, y, angle, speed, frames) => ({
            x: x + Math.cos(angle) * speed * frames,
            y: y + Math.sin(angle) * speed * frames
        }),

        randomInRange: (min, max) => Math.random() * (max - min) + min
    };

    // ==================== GAME VARIABLE SCANNER ====================
    // Slither.io obfuscates their code - we need to find the real variables
    const GameScanner = {
        _scanned: false,
        _snakeVar: null,
        _snakesVar: null,
        _foodsVar: null,
        _allGameVars: {},  // Store all discovered game variables

        // COMPREHENSIVE SCAN - Find ALL interesting game variables
        deepScan: () => {
            DEBUG && console.log('%c🔬 DEEP SCANNING ALL GAME VARIABLES...', 'color: #ff00ff; font-size: 16px;');

            const discovered = {
                // Core game objects
                playerSnake: null,
                snakesArray: null,
                foodsArray: null,

                // Numeric values (potential settings)
                numbers: {},

                // Boolean flags
                booleans: {},

                // Functions (potential hacks)
                functions: {},

                // Arrays (game data)
                arrays: {},

                // Objects (complex data)
                objects: {},

                // Known slither.io variables
                knownVars: {}
            };

            // Known slither.io variable names to look for
            const knownNames = [
                // Movement & Physics
                'sp', 'spang', 'msp', 'lsp', 'asp', 'nsp',  // speed vars
                'fsp', 'fspang',  // food speed
                'mamu', 'cst', 'csw',  // mouse acceleration unit, constants
                'rfr', 'rfc',  // render frame rate

                // Zoom & View
                'gsc', 'wgsc', 'lgsc', 'sgsc', 'tgsc',  // scale/zoom
                'view_xx', 'view_yy', 'view_ang',  // viewport
                'bpx', 'bpy', 'fpx', 'fpy', 'vpx', 'vpy',  // positions

                // Map & World
                'grd', 'mscps',  // map radius, sector size
                'sector_size', 'sectors',
                'map_min', 'map_max',

                // Game State
                'playing', 'dead', 'dying', 'connecting',
                'rank', 'lastscore', 'bso',  // best score

                // Rendering
                'ggbg', 'gbgmc', 'gla', 'glb',  // graphics
                'high_quality', 'render_mode',
                'eiu', 'eia', 'eoa', 'ehl',  // effects

                // Network
                'ws', 'wss', 'bso', 'lrd',
                'lag', 'lastPing', 'etm',

                // Input
                'xm', 'ym', 'xma', 'yma',  // mouse
                'setAcceleration', 'setSkin',

                // Snake properties
                'sc', 'scang', 'sct', 'fam',  // scale, score
                'ang', 'eang', 'wang',  // angles

                // Food
                'fc', 'fv', 'fpos',

                // Misc
                'onkey', 'fmlts', 'fmls', 'rfnk',
                'la', 'lb', 'lc', 'ld',  // leaderboard
            ];

            // Scan window for all properties
            for (const key in window) {
                try {
                    const val = window[key];
                    if (val === undefined) continue;

                    // Check known names
                    if (knownNames.includes(key)) {
                        discovered.knownVars[key] = {
                            value: val,
                            type: typeof val
                        };
                    }

                    // Categorize by type
                    if (typeof val === 'number' && !isNaN(val)) {
                        // Skip very large numbers (likely memory addresses) and common built-ins
                        if (Math.abs(val) < 100000 && !key.startsWith('webkit') && !key.startsWith('on')) {
                            discovered.numbers[key] = val;
                        }
                    }
                    else if (typeof val === 'boolean') {
                        if (!key.startsWith('webkit') && !key.startsWith('on')) {
                            discovered.booleans[key] = val;
                        }
                    }
                    else if (typeof val === 'function') {
                        // Look for interesting function names
                        const interestingNames = ['set', 'get', 'add', 'remove', 'spawn', 'kill', 'die', 'speed', 'boost', 'skin', 'play', 'connect'];
                        if (interestingNames.some(n => key.toLowerCase().includes(n))) {
                            discovered.functions[key] = val.toString().substring(0, 100);
                        }
                    }
                    else if (Array.isArray(val) && val.length > 0 && val.length < 10000) {
                        // Check if it's a game array
                        const firstItem = val.find(v => v !== null && v !== undefined);
                        if (firstItem && typeof firstItem === 'object') {
                            discovered.arrays[key] = {
                                length: val.length,
                                sampleKeys: firstItem ? Object.keys(firstItem).slice(0, 10) : []
                            };
                        }
                    }
                    else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                        // Look for game-like objects
                        const keys = Object.keys(val);
                        if (keys.includes('xx') || keys.includes('yy') || keys.includes('pts') || keys.includes('ang')) {
                            discovered.objects[key] = {
                                keys: keys.slice(0, 15),
                                hasPosition: keys.includes('xx') || keys.includes('x'),
                                hasAngle: keys.includes('ang'),
                                hasSegments: keys.includes('pts')
                            };
                        }
                    }
                } catch (e) {
                    // Ignore access errors
                }
            }

            // Store for later use (logging only in DEBUG mode)
            GameScanner._allGameVars = discovered;
            log.debug('Game variables discovered', 'color: #00ff00;');

            return discovered;
        },

        // Scan window for snake-like objects
        scan: () => {
            // Always re-scan if we don't have a valid snake
            const currentSnake = GameScanner._snakeVar ? window[GameScanner._snakeVar] : null;
            if (currentSnake && typeof currentSnake.xx === 'number') {
                return; // We have a valid snake, no need to rescan
            }

            // Reset and scan again
            GameScanner._snakeVar = null;
            GameScanner._snakesVar = null;

            const found = {
                possibleSnake: [],
                possibleSnakes: [],
                possibleFoods: []
            };

            // Look through all window properties
            for (const key in window) {
                try {
                    const val = window[key];
                    if (!val) continue;

                    // Look for YOUR snake - object with position and angle
                    // Different games use different property names
                    if (typeof val === 'object' && !Array.isArray(val)) {
                        // Check for various snake property patterns
                        const hasPosition = (typeof val.xx === 'number' && typeof val.yy === 'number') ||
                                           (typeof val.x === 'number' && typeof val.y === 'number');
                        const hasAngle = typeof val.ang === 'number' || typeof val.angle === 'number';
                        const hasBody = val.pts || val.body || val.segments;
                        const isNotNull = val !== null;

                        if (hasPosition && (hasAngle || hasBody) && isNotNull) {
                            found.possibleSnake.push(key);
                            if (!GameScanner._snakeVar && !val.dead) {
                                GameScanner._snakeVar = key;
                                log.debug(`Found snake: window.${key}`);
                            }
                        }
                    }

                    // Look for SNAKES array
                    if (Array.isArray(val) && val.length > 0) {
                        for (let i = 0; i < Math.min(val.length, 50); i++) {
                            const item = val[i];
                            if (item && typeof item === 'object') {
                                const hasPos = typeof item.xx === 'number' || typeof item.x === 'number';
                                const hasBody = item.pts || item.body;

                                if (hasPos && hasBody) {
                                    found.possibleSnakes.push(key);
                                    if (!GameScanner._snakesVar) {
                                        GameScanner._snakesVar = key;
                                    }
                                    break;
                                }
                            }
                        }

                        // Look for FOODS array
                        for (let i = 0; i < Math.min(val.length, 100); i++) {
                            const item = val[i];
                            if (item && typeof item === 'object') {
                                const hasPos = typeof item.xx === 'number' || typeof item.x === 'number';
                                const noBody = !item.pts && !item.body && !item.ang;
                                const hasSize = typeof item.sz === 'number' || typeof item.size === 'number';

                                if (hasPos && noBody) {
                                    found.possibleFoods.push(key);
                                    if (!GameScanner._foodsVar) {
                                        GameScanner._foodsVar = key;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    // Ignore access errors
                }
            }

            // FALLBACK: Try common slither.io variable names directly
            // NOTE: slither.io uses 'slither' and 'slithers' as variable names!
            if (!GameScanner._snakeVar) {
                const commonSnakeNames = ['slither', 'snake', 'mySnake', 'player', 'me', 'playerSnake'];
                for (const name of commonSnakeNames) {
                    if (window[name] && typeof window[name] === 'object') {
                        const s = window[name];
                        if ((typeof s.xx === 'number' || typeof s.x === 'number') && !s.dead) {
                            GameScanner._snakeVar = name;
                            break;
                        }
                    }
                }
            }

            if (!GameScanner._snakesVar) {
                const commonArrayNames = ['slithers', 'snakes', 'snks', 'players', 'enemies'];
                for (const name of commonArrayNames) {
                    if (window[name] && Array.isArray(window[name])) {
                        GameScanner._snakesVar = name;
                        break;
                    }
                }
            }

            GameScanner._scanned = true;
            return found;
        },

        getSnake: () => {
            // Try slither.io specific variable FIRST (the game uses 'slither' not 'snake')
            if (window.slither && typeof window.slither.xx === 'number') return window.slither;

            // Fallback to 'snake' variable
            if (window.snake && typeof window.snake.xx === 'number') return window.snake;

            // Try scanned variable (but not 'window' itself)
            if (GameScanner._snakeVar && GameScanner._snakeVar !== 'window' &&
                GameScanner._snakeVar !== 'self' && GameScanner._snakeVar !== 'top' &&
                window[GameScanner._snakeVar]) {
                return window[GameScanner._snakeVar];
            }

            // Rescan if not found
            GameScanner.scan();
            if (GameScanner._snakeVar && window[GameScanner._snakeVar]) {
                return window[GameScanner._snakeVar];
            }

            return null;
        },

        getSnakes: () => {
            // Try slither.io specific variable FIRST (the game uses 'slithers' not 'snakes')
            if (window.slithers && Array.isArray(window.slithers) && window.slithers.length > 0) {
                return window.slithers;
            }

            // Fallback to 'snakes' variable
            if (window.snakes && Array.isArray(window.snakes) && window.snakes.length > 0) {
                return window.snakes;
            }

            // Try scanned variable
            if (GameScanner._snakesVar && window[GameScanner._snakesVar]) {
                return window[GameScanner._snakesVar];
            }

            // Rescan if not found
            GameScanner.scan();
            if (GameScanner._snakesVar && window[GameScanner._snakesVar]) {
                return window[GameScanner._snakesVar];
            }

            return [];
        },

        getFoods: () => {
            if (window.foods && Array.isArray(window.foods)) return window.foods;
            if (GameScanner._foodsVar && window[GameScanner._foodsVar]) {
                return window[GameScanner._foodsVar];
            }
            return [];
        }
    };

    // Run initial scan after a delay to let game initialize
    setTimeout(() => {
        console.log('🔍 Running initial game variable scan...');
        GameScanner.scan();
    }, 3000);

    // ==================== SNAKE DETECTION ====================
    const SnakeDetector = {
        // Cache for performance
        _lastUpdate: 0,
        _cachedSnakes: [],
        _nearbyCache: [],
        _debugLastLog: 0,

        // Check if we're actually in the game
        isInGame: () => {
            // Multiple checks to ensure we're actually playing
            if (window.playing === true) return true;
            if (window.snake && !window.snake.dead && typeof window.snake.xx === 'number') return true;
            return false;
        },

        getMySnake: () => {
            // Direct access to window.snake
            const s = window.snake;
            if (!s) return null;

            // Check if snake is valid (not dead, has position)
            if (s.dead) return null;

            // Valid snake has xx/yy coordinates
            if (typeof s.xx === 'number' && typeof s.yy === 'number') {
                return s;
            }

            return null;
        },

        getMyHead: () => {
            const snake = window.snake;

            // FALLBACK: If no snake found, use view coordinates (camera follows player)
            if (!snake && window.playing === true && typeof window.view_xx === 'number') {
                return {
                    x: window.view_xx,
                    y: window.view_yy,
                    ang: window.view_ang || 0,
                    sp: window.sp || 11,
                    sc: window.gsc || 1,
                    sct: 10  // Unknown length
                };
            }

            if (!snake || snake.dead) return null;

            // Use xx/yy (interpolated) if available, fallback to x/y
            const x = typeof snake.xx === 'number' ? snake.xx : (snake.x || 0);
            const y = typeof snake.yy === 'number' ? snake.yy : (snake.y || 0);

            return {
                x: x,
                y: y,
                ang: snake.ang || snake.eang || 0,
                sp: snake.sp || 11,
                sc: snake.sc || 1,
                sct: snake.sct || (snake.pts ? snake.pts.length : 0)
            };
        },

        // Get all other snakes - DIRECT ACCESS
        getAllSnakes: () => {
            const now = Date.now();

            // Debug logging every 2 seconds
            if (now - SnakeDetector._debugLastLog > 2000) {
                SnakeDetector._debugLastLog = now;
                const snakesArr = window.snakes;
                const mySnake = GameScanner.getSnake();
                console.log(`🐍 [DETECTION]`, {
                    'snakesVar': GameScanner._snakesVar || 'window.snakes',
                    'snakeVar': GameScanner._snakeVar || 'window.snake',
                    'snakesLength': snakesArr ? snakesArr.length : 0,
                    'validSnakes': snakesArr ? snakesArr.filter(s => s && typeof s.xx === 'number').length : 0,
                    'mySnake': mySnake ? { xx: mySnake.xx, yy: mySnake.yy } : null,
                    'playing': window.playing
                });
            }

            // v7.2: NO CACHING - process every frame for real-time threat detection
            // Removed 50ms cache to ensure every frame is processed

            // Get snakes directly from window.slithers (slither.io uses 'slithers' not 'snakes')
            const snakesArr = window.slithers || window.snakes;
            if (!snakesArr || !Array.isArray(snakesArr) || !snakesArr.length) {
                SnakeDetector._cachedSnakes = [];
                return [];
            }

            // Handle both array and object with numeric keys
            const result = [];
            const mySnake = window.slither || window.snake;
            const myId = mySnake ? mySnake.id : null;

            // Iterate through snakes array
            for (let i = 0; i < snakesArr.length; i++) {
                const s = snakesArr[i];
                if (!s) continue;

                // Skip our own snake by reference OR by id
                if (s === mySnake) continue;
                if (myId !== null && s.id === myId) continue;

                // Skip dead/dying snakes
                if (s.dead === true || s.dying === true) continue;

                // Must have position data
                if (typeof s.xx !== 'number') continue;

                result.push(s);
            }

            SnakeDetector._cachedSnakes = result;
            SnakeDetector._lastUpdate = now;
            return result;
        },

        // Get snakes near my head with distance info
        getNearbySnakes: (maxDist = 700) => {
            const head = SnakeDetector.getMyHead();
            if (!head) return [];

            const snakes = SnakeDetector.getAllSnakes();
            const nearby = [];

            for (const s of snakes) {
                // Get position with fallbacks
                const sx = typeof s.xx === 'number' ? s.xx : (s.x || 0);
                const sy = typeof s.yy === 'number' ? s.yy : (s.y || 0);
                const dist = Math.sqrt((sx - head.x) ** 2 + (sy - head.y) ** 2);

                if (dist < maxDist) {
                    nearby.push({
                        snake: s,
                        x: sx,
                        y: sy,
                        ang: s.ang || s.eang || 0,
                        sp: s.sp || 5.78,
                        dist: dist,
                        length: s.sct || (s.pts ? s.pts.length : 10),
                        name: s.nk || 'unknown',
                        // Danger assessment
                        danger: dist < 100 ? 'CRITICAL' : dist < 200 ? 'HIGH' : dist < 350 ? 'MEDIUM' : 'LOW'
                    });
                }
            }

            // Sort by distance
            nearby.sort((a, b) => a.dist - b.dist);
            SnakeDetector._nearbyCache = nearby;
            return nearby;
        },

        getSnakeLength: (snake) => {
            if (!snake) return 0;
            // sct is the "score" which correlates to length
            if (typeof snake.sct === 'number') return snake.sct;
            // Fallback to pts array length
            if (snake.pts && snake.pts.length) return snake.pts.length;
            return 0;
        },

        getSnakeSegments: (snake, excludeHead = false) => {
            if (!snake || !snake.pts) return [];
            const segments = [];
            const pts = snake.pts;
            const startIdx = excludeHead ? Math.min(5, pts.length) : 0;  // Skip head segments if requested
            for (let i = startIdx; i < pts.length; i++) {
                const p = pts[i];
                if (p && !p.dying) {
                    segments.push({
                        x: p.xx || p.x || 0,
                        y: p.yy || p.y || 0,
                        radius: (snake.sc || 1) * 14.5,
                        index: i
                    });
                }
            }
            return segments;
        },

        // Check if a snake is our own snake
        isOwnSnake: (snake) => {
            const mySnake = window.slither || window.snake;
            return snake === mySnake;
        }
    };

    // Helper to check if we can cross our own body (always safe!)
    const canCrossOwnBody = (targetX, targetY) => {
        // We can ALWAYS cross our own body - it's safe!
        return true;
    };

    // ==================== INSTANT TRAP AVOIDANCE SYSTEM ====================
    const TrapAvoidance = {
        threats: [],
        trapScore: 0,
        escapeRoutes: [],
        lastEvadeTime: 0,
        evadeDirection: 0,

        // === v7.0: INSTANT BODY COLLISION DETECTION ===
        // Checks if there are any snake body segments directly in our path
        checkBodyCollisionAhead: () => {
            try {
                const head = SnakeDetector.getMyHead();
                if (!head) return null;

                const mySnake = window.slither || window.snake;
                const snakesArr = window.slithers || window.snakes || [];

            let nearestBody = null;
            let nearestDist = Infinity;
            let collisionAngle = null;

            // Check in the direction we're heading - v7.0: More aggressive distances
            const checkDistances = [20, 35, 50, 70, 100, 140, 180];  // Closer checks for earlier detection
            const checkAngles = [-0.5, -0.3, -0.15, 0, 0.15, 0.3, 0.5];  // Wider cone (~60 degrees)

            for (const s of snakesArr) {
                if (!s || s === mySnake || s.dead || s.dying) continue;

                const segments = SnakeDetector.getSnakeSegments(s);
                const segmentRadius = (s.sc || 1) * 16;  // Slightly larger radius for safety

                for (const seg of segments) {
                    // Check each point ahead of us
                    for (const angleDelta of checkAngles) {
                        const checkAngle = head.ang + angleDelta;

                        for (const dist of checkDistances) {
                            const checkX = head.x + Math.cos(checkAngle) * dist;
                            const checkY = head.y + Math.sin(checkAngle) * dist;

                            const segDist = Utils.distance(checkX, checkY, seg.x, seg.y);

                            // If we would collide with this segment
                            if (segDist < segmentRadius + 20) {  // 20 = our head radius
                                const actualDist = Utils.distance(head.x, head.y, seg.x, seg.y);
                                if (actualDist < nearestDist) {
                                    nearestDist = actualDist;
                                    nearestBody = seg;
                                    collisionAngle = checkAngle;
                                }
                            }
                        }
                    }
                }
            }

            if (!nearestBody) return null;

            // Calculate escape angle - turn AWAY from the body segment
            const angleToBody = Math.atan2(nearestBody.y - head.y, nearestBody.x - head.x);

            // Determine which way to turn to avoid
            const angleDiff = Utils.angleDiff(head.ang, angleToBody);
            let escapeAngle;

            if (Math.abs(angleDiff) < Math.PI / 2) {
                // Body is in front - turn perpendicular
                escapeAngle = angleDiff > 0 ? head.ang - Math.PI / 2 : head.ang + Math.PI / 2;
            } else {
                // Body is to the side - turn away
                escapeAngle = angleToBody + Math.PI;
            }

            // Calculate danger based on distance
            let danger = 0;
            if (nearestDist < 50) {
                danger = 1.0;  // CRITICAL
            } else if (nearestDist < 100) {
                danger = 0.8;
            } else if (nearestDist < 150) {
                danger = 0.6;
            } else {
                danger = 0.4;
            }

            return {
                segment: nearestBody,
                dist: nearestDist,
                escapeAngle: escapeAngle,
                danger: danger,
                type: 'body_ahead'
            };
            } catch (bodyCheckError) {
                console.error('%c❌ Body check error:', 'color: #ff6600;', bodyCheckError.message);
                return null;  // Safe fallback
            }
        },

        // IMMEDIATE EVASION - Uses nearby snakes directly for instant response
        // === v7.2: Enhanced with vision-based detection for snakes beyond visible range ===
        getInstantEvasion: (visionThreats = []) => {
            try {
                const head = SnakeDetector.getMyHead();
                if (!head) return null;

                // === v7.0: FIRST check for body segments directly ahead ===
                let bodyAhead = null;
                try {
                    bodyAhead = TrapAvoidance.checkBodyCollisionAhead();
                } catch (e) {
                    // Body check failed, continue with other checks
                }

                if (bodyAhead && bodyAhead.danger > 0.3) {  // v7.1: LOWERED from 0.5 - react earlier!
                    DEBUG && console.log(`%c🚧 BODY AHEAD! Dist: ${bodyAhead.dist.toFixed(0)}px - TURNING!`,
                        'color: #ff4444; font-size: 12px; font-weight: bold;');
                    return {
                        angle: bodyAhead.escapeAngle,
                        danger: bodyAhead.danger,
                        immediateThreats: 1,
                        shouldBoost: bodyAhead.dist < 80,  // Boost only if very close
                        type: 'body_collision'
                    };
                }

            const nearby = SnakeDetector.getNearbySnakes(CONFIG.collision.detectionRadius);

            // === v7.0: Also check body segments of ALL nearby snakes ===
            const mySnake = window.slither || window.snake;
            const snakesArr = window.slithers || window.snakes || [];

            let totalDangerX = 0;
            let totalDangerY = 0;
            let maxDanger = 0;
            let immediateThreats = 0;

            // v7.2: 35% threat threshold and 35-degree angle check
            const THREAT_THRESHOLD = 0.35;
            const THREAT_ANGLE = 35 * (Math.PI / 180);  // 35 degrees in radians

            // v7.1.4: Minimum safe distance from ANY snake part
            const MIN_SAFE_DISTANCE = 200;

            // === v7.2: Process vision threats - ONLY those that require evasion ===
            // Only consider snakes that: 1) Are facing us (within 35°) AND 2) Crossed 35% threat threshold
            for (const threat of visionThreats) {
                // v7.2: Skip threats that don't require evasion
                if (!threat.requiresEvasion && !threat.isFacingUs) continue;

                // Only process if threat level >= 35% OR very close
                if (threat.threat < THREAT_THRESHOLD && threat.dist > MIN_SAFE_DISTANCE) continue;

                const angleToThreat = Math.atan2(threat.y - head.y, threat.x - head.x);
                const awayAngle = angleToThreat + Math.PI;

                // Weight based on threat level and prediction confidence
                let weight = threat.threat * (threat.predictionConfidence || 1.0);

                // Extra weight for snakes facing us directly
                if (threat.isFacingUs) weight *= 1.5;

                // Extra weight for fast approaching snakes
                if (threat.isBoosting) weight *= 1.5;

                totalDangerX += Math.cos(awayAngle) * weight;
                totalDangerY += Math.sin(awayAngle) * weight;

                if (threat.requiresEvasion || threat.dist < MIN_SAFE_DISTANCE) {
                    maxDanger = Math.max(maxDanger, weight);
                    immediateThreats++;
                }
            }

            // === v7.1.4: Check body segments with LARGER ranges ===
            for (const s of snakesArr) {
                if (!s || s === mySnake || s.dead || s.dying) continue;

                const segments = SnakeDetector.getSnakeSegments(s);
                const segmentRadius = (s.sc || 1) * 18;  // Increased from 15

                // Check first 60 segments (increased from 50)
                for (let i = 0; i < Math.min(segments.length, 60); i++) {
                    const seg = segments[i];
                    const dist = Utils.distance(head.x, head.y, seg.x, seg.y);

                    // v7.1.4: INCREASED range to 450 - detect much earlier!
                    if (dist < 450) {
                        // Check if segment is IN FRONT of us
                        const angleToSeg = Math.atan2(seg.y - head.y, seg.x - head.x);
                        const angleDiff = Math.abs(Utils.angleDiff(head.ang, angleToSeg));

                        // Segment in front (within 90 degrees of heading)
                        const inFront = angleDiff < Math.PI / 2;

                        // v7.1.4: MUCH higher danger at longer ranges - stay away!
                        let dangerWeight = 0;
                        if (dist < MIN_SAFE_DISTANCE) {
                            dangerWeight = inFront ? 6.0 : 4.0;  // CRITICAL - too close!
                            immediateThreats++;
                        } else if (dist < 250) {
                            dangerWeight = inFront ? 4.5 : 2.5;  // HIGH - still too close
                            if (inFront) immediateThreats++;
                        } else if (dist < 320) {
                            dangerWeight = inFront ? 3.0 : 1.5;  // MEDIUM
                        } else if (dist < 400) {
                            dangerWeight = inFront ? 2.0 : 0.8;  // LOW
                        } else {
                            dangerWeight = 0.5;  // AWARENESS
                        }

                        if (dangerWeight > 0.1) {
                            // Calculate direction AWAY from this segment
                            const awayAngle = Math.atan2(head.y - seg.y, head.x - seg.x);
                            totalDangerX += Math.cos(awayAngle) * dangerWeight;
                            totalDangerY += Math.sin(awayAngle) * dangerWeight;
                            maxDanger = Math.max(maxDanger, dangerWeight);
                        }
                    }
                }
            }

            // v7.2: Check snake heads - ONLY threats facing us (within 35 degrees)
            for (const info of nearby) {
                const { x, y, ang, sp, dist, danger } = info;

                // === v7.2: 35-DEGREE ANGLE CHECK ===
                // Is this snake pointing at us?
                const angleToUs = Math.atan2(head.y - y, head.x - x);
                const angleDiff = Math.abs(Utils.angleDiff(ang, angleToUs));
                const isFacingUs = angleDiff < THREAT_ANGLE;  // 35 degrees

                let dangerWeight = 0;

                if (!isFacingUs) {
                    // Snake is NOT facing us - much lower priority
                    // Only react if extremely close
                    if (dist < MIN_SAFE_DISTANCE * 0.75) {
                        dangerWeight = 1.5;  // Still need to avoid very close snakes
                    } else {
                        dangerWeight = 0.1;  // Minimal awareness
                    }
                } else {
                    // === SNAKE IS FACING US - Apply full threat calculation ===
                    if (dist < MIN_SAFE_DISTANCE) {
                        dangerWeight = 5.0;  // CRITICAL - too close!
                        immediateThreats++;
                    } else if (dist < 280) {
                        dangerWeight = 3.5;  // HIGH
                        immediateThreats++;
                    } else if (dist < 380) {
                        dangerWeight = 2.5;  // MEDIUM
                    } else if (dist < 500) {
                        dangerWeight = 1.5;  // LOW
                    } else if (dist < 600) {
                        dangerWeight = 0.7;  // AWARENESS
                    } else {
                        dangerWeight = 0.3;
                    }

                    // How directly is it pointing at us?
                    const facingDirectness = 1 - (angleDiff / THREAT_ANGLE);
                    dangerWeight *= (1 + facingDirectness * 0.5);  // Up to 50% bonus for dead-on

                    // Predict if this snake is heading toward us
                    const predictedX = x + Math.cos(ang) * sp * 25;
                    const predictedY = y + Math.sin(ang) * sp * 25;
                    const predictedDist = Math.sqrt((predictedX - head.x) ** 2 + (predictedY - head.y) ** 2);

                    // If snake is moving toward us, increase danger significantly
                    if (predictedDist < dist) {
                        dangerWeight *= 2.0;
                    }

                    // Extra danger for boosting snakes facing us
                    if (sp > 13) {
                        dangerWeight *= 1.5;
                    }
                }

                // === v7.2: Only count as threat if danger weight >= 35% threshold ===
                if (dangerWeight >= THREAT_THRESHOLD) {
                    // Calculate direction AWAY from this threat
                    const awayAngle = Math.atan2(head.y - y, head.x - x);
                    totalDangerX += Math.cos(awayAngle) * dangerWeight;
                    totalDangerY += Math.sin(awayAngle) * dangerWeight;
                    maxDanger = Math.max(maxDanger, dangerWeight);
                }
            }

            if (maxDanger < THREAT_THRESHOLD) return null;  // v7.2: Only evade if threat >= 35%

            // === v7.1.3: IMPROVED ESCAPE - Verify escape path is TRULY safe ===
            let escapeAngle = Math.atan2(totalDangerY, totalDangerX);

            // Always use the smart escape direction finder when multiple snakes nearby
            const rings = EvasionRings.rings || [];
            if (rings.length > 1 || EvasionRings.isAngleBlocked(escapeAngle)) {
                // Multiple threats or escape is blocked - find truly safe direction
                const safeAngle = EvasionRings.getBestEscapeDirection(head, escapeAngle);

                // Verify the safe angle doesn't lead into another snake
                const safetyScore = EvasionRings.scoreEscapeDirection(head, safeAngle, rings);
                const originalScore = EvasionRings.scoreEscapeDirection(head, escapeAngle, rings);

                if (safetyScore > originalScore) {
                    DEBUG && console.log(`%c🔄 ESCAPE REDIRECTED: Original score ${(originalScore*100).toFixed(0)}% → Safe path ${(safetyScore*100).toFixed(0)}%`,
                        'color: #00ffff; font-size: 11px;');
                    escapeAngle = safeAngle;
                } else if (originalScore < 0.3) {
                    // Original path is dangerous, use safe path anyway
                    DEBUG && console.log(`%c⚠️ ALL PATHS RISKY! Using best available: ${(safetyScore*100).toFixed(0)}%`,
                        'color: #ff6600; font-size: 11px;');
                    escapeAngle = safeAngle;
                }
            }

            // v7.0: Log body collision detection
            if (immediateThreats > 0 && Date.now() % 1000 < 100) {
                DEBUG && console.log(`%c🛡️ BODY DETECT: ${immediateThreats} segments nearby, danger: ${maxDanger.toFixed(2)}`,
                    'color: #ffaa00; font-size: 11px;');
            }

            // Get blocked percentage for extra danger assessment
            const blockedPct = STATE.blockedPercentage || 0;
            const surroundedBonus = blockedPct > 50 ? 0.3 : blockedPct > 30 ? 0.15 : 0;

            return {
                angle: escapeAngle,
                danger: Math.min(maxDanger + surroundedBonus, 1),
                immediateThreats: immediateThreats,
                shouldBoost: maxDanger > 1.5 || immediateThreats >= 2 || blockedPct > 60,
                type: immediateThreats > 0 ? 'body_evasion' : 'head_evasion',
                blockedPercentage: blockedPct,
                safetyScore: EvasionRings.scoreEscapeDirection ?
                    EvasionRings.scoreEscapeDirection(head, escapeAngle, rings) : 1
            };
            } catch (evasionError) {
                console.error('%c❌ Evasion error:', 'color: #ff6600;', evasionError.message);
                return null;  // Safe fallback - no evasion
            }
        },

        analyze: () => {
            const head = SnakeDetector.getMyHead();
            if (!head) return { danger: 0, threats: [], escapeAngle: null };

            TrapAvoidance.threats = [];
            TrapAvoidance.escapeRoutes = [];

            // FIRST: Check for immediate evasion needed
            // === v7.0: Lower threshold for faster response ===
            const instantEvasion = TrapAvoidance.getInstantEvasion();
            if (instantEvasion && instantEvasion.danger > 0.20) {  // v7.1: LOWERED to 20% - react MUCH earlier!
                TrapAvoidance.trapScore = instantEvasion.danger;
                return {
                    danger: instantEvasion.danger,
                    threats: TrapAvoidance.threats,
                    escapeAngle: instantEvasion.angle,
                    isTrapped: instantEvasion.immediateThreats >= 2,  // Lowered from 3
                    shouldBoost: instantEvasion.shouldBoost,
                    type: instantEvasion.type || 'instant'
                };
            }

            const snakes = SnakeDetector.getAllSnakes();
            let totalDanger = 0;
            let dangerVectorX = 0;
            let dangerVectorY = 0;

            // Analyze each enemy snake
            for (const snake of snakes) {
                if (!snake || snake.dying) continue;

                const enemyHead = {
                    x: snake.xx || snake.x,
                    y: snake.yy || snake.y,
                    ang: snake.ang || 0,
                    sp: snake.sp || 5.78
                };

                // Check head-on collision threat
                const headDist = Utils.distance(head.x, head.y, enemyHead.x, enemyHead.y);
                if (headDist < CONFIG.collision.detectionRadius) {
                    // Predict enemy movement
                    for (let frame = 1; frame <= CONFIG.collision.predictionDepth; frame++) {
                        const predictedEnemy = Utils.predictPosition(
                            enemyHead.x, enemyHead.y, enemyHead.ang, enemyHead.sp, frame
                        );
                        const predictedMe = Utils.predictPosition(
                            head.x, head.y, head.ang, head.sp, frame
                        );

                        const predictedDist = Utils.distance(
                            predictedMe.x, predictedMe.y,
                            predictedEnemy.x, predictedEnemy.y
                        );

                        if (predictedDist < CONFIG.collision.criticalZoneRadius) {
                            const danger = (CONFIG.collision.criticalZoneRadius - predictedDist) /
                                CONFIG.collision.criticalZoneRadius;
                            TrapAvoidance.threats.push({
                                type: 'head_collision',
                                x: predictedEnemy.x,
                                y: predictedEnemy.y,
                                danger: danger * 2,  // Head collisions are extra dangerous
                                frame: frame
                            });

                            totalDanger += danger * 2;
                            const awayAngle = Utils.angle(predictedEnemy.x, predictedEnemy.y, head.x, head.y);
                            dangerVectorX += Math.cos(awayAngle) * danger * 2;
                            dangerVectorY += Math.sin(awayAngle) * danger * 2;
                        }
                    }
                }

                // Check body segments - TREAT ENEMY BODIES AS SOLID WALLS
                // But SKIP our own body - we can always cross it!
                const isOwnSnake = SnakeDetector.isOwnSnake(snake);
                if (isOwnSnake) continue;  // Skip our own body entirely - we can cross it!

                const segments = SnakeDetector.getSnakeSegments(snake);
                for (const seg of segments) {
                    const dist = Utils.distance(head.x, head.y, seg.x, seg.y);
                    // Larger effective radius - treat snake bodies as BIGGER walls
                    const effectiveRadius = seg.radius + CONFIG.collision.safetyMargin + 10;

                    if (dist < CONFIG.collision.detectionRadius) {
                        let danger = 0;

                        // INCREASED DANGER for enemy body segments - they are WALLS!
                        if (dist < CONFIG.collision.criticalZoneRadius + effectiveRadius) {
                            danger = 1.0;  // INSTANT MAXIMUM DANGER - WALL!
                        } else if (dist < CONFIG.collision.dangerZoneRadius + effectiveRadius) {
                            danger = 0.8;  // High danger - approaching wall
                        } else if (dist < CONFIG.collision.detectionRadius * 0.5) {
                            danger = 0.5;  // Medium danger - wall in range
                        } else {
                            danger = 0.3 * (1 - dist / CONFIG.collision.detectionRadius);
                        }

                        if (danger > 0.1) {
                            TrapAvoidance.threats.push({
                                type: 'body_segment',
                                x: seg.x,
                                y: seg.y,
                                radius: effectiveRadius,
                                danger: danger
                            });

                            totalDanger += danger;
                            const awayAngle = Utils.angle(seg.x, seg.y, head.x, head.y);
                            dangerVectorX += Math.cos(awayAngle) * danger;
                            dangerVectorY += Math.sin(awayAngle) * danger;
                        }
                    }
                }
            }

            // Check map boundaries - ENHANCED EDGE DETECTION
            const mapRadius = typeof window.grd !== 'undefined' ? window.grd : 21600;
            const mapCenterX = mapRadius;  // Map center
            const mapCenterY = mapRadius;
            const centerDist = Utils.distance(head.x, head.y, mapCenterX, mapCenterY);
            const distFromEdge = mapRadius - centerDist;

            const edgeDetectRadius = CONFIG.collision.edgeDetectionRadius || 800;
            const edgeCriticalRadius = CONFIG.collision.edgeCriticalRadius || 400;
            const edgeEmergencyRadius = CONFIG.collision.edgeEmergencyRadius || 200;

            if (distFromEdge < edgeDetectRadius) {
                // Calculate danger based on distance (closer = more danger)
                let danger;
                if (distFromEdge < edgeEmergencyRadius) {
                    danger = 1.0;  // MAXIMUM DANGER - about to die!
                } else if (distFromEdge < edgeCriticalRadius) {
                    danger = 0.7 + (1 - distFromEdge / edgeCriticalRadius) * 0.3;
                } else {
                    danger = (1 - distFromEdge / edgeDetectRadius) * 0.7;
                }

                totalDanger += danger;
                const toCenter = Utils.angle(head.x, head.y, mapCenterX, mapCenterY);

                // Stronger push toward center when close to edge
                const pushStrength = danger * (distFromEdge < edgeCriticalRadius ? 2.0 : 1.0);
                dangerVectorX += Math.cos(toCenter) * pushStrength;
                dangerVectorY += Math.sin(toCenter) * pushStrength;

                TrapAvoidance.threats.push({
                    type: 'boundary',
                    danger: danger,
                    distFromEdge: distFromEdge,
                    escapeAngle: toCenter,
                    isCritical: distFromEdge < edgeCriticalRadius,
                    isEmergency: distFromEdge < edgeEmergencyRadius
                });

                // Log edge warning
                if (distFromEdge < edgeCriticalRadius) {
                    DEBUG && console.log(`%c🚨 EDGE WARNING! ${distFromEdge.toFixed(0)}px from death!`,
                        'color: #ff0000; font-size: 14px; font-weight: bold;');
                }
            }

            // Calculate encirclement (TRAP DETECTION)
            const trapScore = TrapAvoidance.detectEncirclement(head, snakes);
            if (trapScore > CONFIG.collision.trapDetectionSensitivity) {
                totalDanger += trapScore * 2;
                STATE.isTrapped = true;
            } else {
                STATE.isTrapped = false;
            }

            // Calculate escape angle
            let escapeAngle = null;
            if (totalDanger > 0.3 || STATE.isTrapped) {
                escapeAngle = Math.atan2(dangerVectorY, dangerVectorX);

                // Find best escape route
                const bestEscape = TrapAvoidance.findBestEscapeRoute(head, escapeAngle);
                if (bestEscape !== null) {
                    escapeAngle = bestEscape;
                }
            }

            TrapAvoidance.trapScore = totalDanger;

            return {
                danger: Math.min(totalDanger, 1),
                threats: TrapAvoidance.threats,
                escapeAngle: escapeAngle,
                isTrapped: STATE.isTrapped
            };
        },

        detectEncirclement: (head, snakes) => {
            // RADAR-STYLE TRAP DETECTION
            // Cast rays in 36 directions (every 10 degrees) to detect surrounding threats
            const rayCount = 36;
            let blockedRays = 0;
            let blockedAngles = [];
            let trapperSnake = null;  // Track which snake is trapping us
            let trapperSegments = 0;

            for (let i = 0; i < rayCount; i++) {
                const angle = (i / rayCount) * Math.PI * 2;
                const rayLength = CONFIG.collision.detectionRadius;
                const endX = head.x + Math.cos(angle) * rayLength;
                const endY = head.y + Math.sin(angle) * rayLength;

                for (const snake of snakes) {
                    if (!snake || snake.dying) continue;

                    const segments = SnakeDetector.getSnakeSegments(snake);
                    let hitThisRay = false;

                    for (const seg of segments) {
                        if (Utils.lineCircleIntersect(head.x, head.y, endX, endY,
                            seg.x, seg.y, seg.radius + 15)) {
                            if (!hitThisRay) {
                                blockedRays++;
                                blockedAngles.push(angle);
                                hitThisRay = true;

                                // Track which snake is blocking most rays
                                if (!trapperSnake || snake === trapperSnake) {
                                    trapperSnake = snake;
                                    trapperSegments++;
                                }
                            }
                            break;
                        }
                    }
                }
            }

            const encirclementPercent = blockedRays / rayCount;

            // Store trapper info for escape calculation
            TrapAvoidance.trapperSnake = trapperSnake;
            TrapAvoidance.encirclementPercent = encirclementPercent;
            TrapAvoidance.blockedAngles = blockedAngles;

            return encirclementPercent;
        },

        // Track encirclement history for rate detection
        encirclementHistory: [],
        lastEncirclementCheck: 0,

        // ANTI-TRAP RADAR: Monitor EXIT SPACE and escape EARLY
        // Escape when exit space drops below 55% (45% blocked) OR closing fast
        // EXPANDED RADAR for better trap detection!
        checkAntiTrap: () => {
            const snake = window.slither || window.snake;
            if (!snake) return null;

            const head = {
                x: snake.xx || snake.x || 0,
                y: snake.yy || snake.y || 0,
                ang: snake.ang || 0
            };

            const snakesArr = window.slithers || window.snakes || [];
            const snakes = [];

            // EXPANDED DETECTION RANGE - detect circling snakes much further out!
            const trapRadarRange = CONFIG.collision.trapRadarRange || 500;
            for (let i = 0; i < snakesArr.length; i++) {
                const s = snakesArr[i];
                if (!s || s === snake || s.dead || s.dying) continue;
                if (typeof s.xx !== 'number') continue;

                const dist = Math.sqrt((s.xx - head.x) ** 2 + (s.yy - head.y) ** 2);
                // MUCH WIDER detection - 3x the radar range!
                if (dist < trapRadarRange * 3) {
                    snakes.push({ snake: s, dist: dist });
                }
            }

            if (snakes.length === 0) {
                TrapAvoidance.encirclementPercent = 0;
                TrapAvoidance.encirclementHistory = [];
                return { isTrapped: false, encirclementPercent: 0, exitSpacePercent: 100 };
            }

            // EXPANDED RADAR SCAN: Cast 90 rays (every 4 degrees) for better precision!
            const rayCount = 90;
            let blockedRays = 0;
            let openAngles = [];
            let blockedAngles = [];
            let blockedBySnake = new Map();

            // Track exit gaps (consecutive open angles)
            let exitGaps = [];
            let currentGapStart = null;
            let currentGapSize = 0;

            for (let i = 0; i < rayCount; i++) {
                const angle = (i / rayCount) * Math.PI * 2;
                let rayBlocked = false;
                let blockDistance = Infinity;

                // EXPANDED check distances - look MUCH further for circling snakes!
                const checkDistances = [30, 60, 100, 150, 220, 300, 400, 500];

                for (const checkDist of checkDistances) {
                    const checkX = head.x + Math.cos(angle) * checkDist;
                    const checkY = head.y + Math.sin(angle) * checkDist;

                    for (const { snake: s, dist: snakeDist } of snakes) {
                        // Check snake head - LARGER detection radius
                        const headDist = Math.sqrt((checkX - (s.xx || s.x)) ** 2 + (checkY - (s.yy || s.y)) ** 2);
                        if (headDist < 50) {  // Increased from 40
                            rayBlocked = true;
                            blockDistance = Math.min(blockDistance, checkDist);
                            blockedBySnake.set(s, (blockedBySnake.get(s) || 0) + 1);
                            break;
                        }

                        // Check snake body segments - LARGER detection radius
                        const segments = SnakeDetector.getSnakeSegments(s);
                        for (const seg of segments) {
                            const segDist = Math.sqrt((checkX - seg.x) ** 2 + (checkY - seg.y) ** 2);
                            if (segDist < seg.radius + 35) {  // Increased from 25
                                rayBlocked = true;
                                blockDistance = Math.min(blockDistance, checkDist);
                                blockedBySnake.set(s, (blockedBySnake.get(s) || 0) + 1);
                                break;
                            }
                        }
                        if (rayBlocked) break;
                    }
                    if (rayBlocked) break;
                }

                if (rayBlocked) {
                    blockedRays++;
                    blockedAngles.push({ angle, distance: blockDistance });

                    // End current gap if we had one
                    if (currentGapStart !== null) {
                        exitGaps.push({
                            startAngle: currentGapStart,
                            size: currentGapSize,
                            midAngle: currentGapStart + (currentGapSize * (Math.PI * 2 / rayCount)) / 2
                        });
                        currentGapStart = null;
                        currentGapSize = 0;
                    }
                } else {
                    openAngles.push(angle);

                    // Track gap
                    if (currentGapStart === null) {
                        currentGapStart = angle;
                    }
                    currentGapSize++;
                }
            }

            // Close final gap if it wraps around
            if (currentGapStart !== null) {
                // Check if it connects to first gap
                if (exitGaps.length > 0 && openAngles[0] === 0) {
                    exitGaps[0].size += currentGapSize;
                    exitGaps[0].startAngle = currentGapStart;
                } else {
                    exitGaps.push({
                        startAngle: currentGapStart,
                        size: currentGapSize,
                        midAngle: currentGapStart + (currentGapSize * (Math.PI * 2 / rayCount)) / 2
                    });
                }
            }

            const encirclementPercent = blockedRays / rayCount;
            const exitSpacePercent = (1 - encirclementPercent) * 100;

            // Find LARGEST exit gap
            let largestGap = exitGaps.length > 0 ? exitGaps.reduce((a, b) => a.size > b.size ? a : b) : null;
            let largestGapDegrees = largestGap ? (largestGap.size / rayCount) * 360 : 360;

            TrapAvoidance.encirclementPercent = encirclementPercent;
            TrapAvoidance.exitSpacePercent = exitSpacePercent;
            TrapAvoidance.largestGapDegrees = largestGapDegrees;

            // Track history for rate-of-closure detection
            const now = Date.now();
            if (now - TrapAvoidance.lastEncirclementCheck > 100) {
                TrapAvoidance.encirclementHistory.push({
                    time: now,
                    percent: encirclementPercent
                });
                // Keep last 2 seconds of history
                TrapAvoidance.encirclementHistory = TrapAvoidance.encirclementHistory.filter(h => now - h.time < 2000);
                TrapAvoidance.lastEncirclementCheck = now;
            }

            // Calculate rate of closure
            let closingRate = 0;
            if (TrapAvoidance.encirclementHistory.length >= 3) {
                const oldest = TrapAvoidance.encirclementHistory[0];
                const newest = TrapAvoidance.encirclementHistory[TrapAvoidance.encirclementHistory.length - 1];
                const timeDiff = (newest.time - oldest.time) / 1000;  // seconds
                if (timeDiff > 0) {
                    closingRate = (newest.percent - oldest.percent) / timeDiff;  // % per second
                }
            }
            TrapAvoidance.closingRate = closingRate;

            // Find the snake that's trapping us most
            let mainTrapper = null;
            let maxBlocks = 0;
            for (const [s, count] of blockedBySnake) {
                if (count > maxBlocks) {
                    maxBlocks = count;
                    mainTrapper = s;
                }
            }
            TrapAvoidance.trapperSnake = mainTrapper;

            // Check for SQUEEZE ATTACK (single snake wrapping around us)
            // MORE SENSITIVE: Trigger at 0.2 severity instead of 0.3
            const squeezeAttack = TrapAvoidance.detectSqueezeAttack();
            const isBeingQueezed = squeezeAttack && squeezeAttack.severity > 0.2;  // LOWERED from 0.3!

            // === ESCAPE TRIGGERS - EVEN FASTER RESPONSE! ===
            // EXPANDED THRESHOLDS - trigger escape earlier!
            // 1. Exit space below 75% (25% blocked) - VERY EARLY WARNING!
            // 2. Largest gap shrinking below 160 degrees - GETTING BOXED IN
            // 3. Closing rate > 3% per second - SNAKE IS CIRCLING US
            // 4. Any encirclement > 15% AND a snake is close - CAUTION MODE
            // 5. SQUEEZE ATTACK detected - snake body in 2+ quadrants
            // 6. Any single snake blocking > 25% of rays
            // 7. NEW: Any snake within 200px AND blocking ANY rays

            const singleSnakeBlockingTooMuch = maxBlocks > rayCount * 0.25;  // Lowered from 0.30
            const anyCloseSnakeBlocking = snakes.some(s => s.dist < 200) && blockedRays > 5;

            const shouldEscape =
                encirclementPercent >= 0.25 ||                    // 25% blocked = 75% exit = ESCAPE NOW!
                largestGapDegrees < 160 ||                        // Largest exit < 160 degrees
                (closingRate > 0.03 && encirclementPercent > 0.08) || // Closing fast - very sensitive!
                (encirclementPercent > 0.15 && snakes.some(s => s.dist < 300)) || // Close snake + any encirclement
                isBeingQueezed ||                                 // Squeeze attack detected!
                singleSnakeBlockingTooMuch ||                     // One snake blocking too much
                anyCloseSnakeBlocking;                            // NEW: Close snake blocking any rays

            if (shouldEscape) {
                // Find best escape angle - through the LARGEST gap
                let escapeAngle = head.ang;

                if (largestGap && openAngles.length > 0) {
                    // Use the middle of the largest gap
                    escapeAngle = largestGap.midAngle;

                    // But bias AWAY from the main trapper if known
                    if (mainTrapper) {
                        const trapperX = mainTrapper.xx || mainTrapper.x;
                        const trapperY = mainTrapper.yy || mainTrapper.y;
                        const awayFromTrapper = Math.atan2(head.y - trapperY, head.x - trapperX);

                        // Find the open angle in a gap that's closest to "away from trapper"
                        let bestAngle = escapeAngle;
                        let bestScore = -Infinity;

                        for (const gap of exitGaps) {
                            if (gap.size < 3) continue;  // Skip tiny gaps

                            const gapMid = gap.midAngle;
                            const awayDiff = Math.abs(Utils.angleDiff(gapMid, awayFromTrapper));
                            const gapSizeBonus = gap.size / rayCount;  // Bigger gaps are better
                            const score = gapSizeBonus * 2 - (awayDiff / Math.PI);  // Prioritize size, then direction

                            if (score > bestScore) {
                                bestScore = score;
                                bestAngle = gapMid;
                            }
                        }
                        escapeAngle = bestAngle;
                    }
                } else if (openAngles.length > 0) {
                    escapeAngle = openAngles[Math.floor(openAngles.length / 2)];
                }

                // If being squeezed, use squeeze escape angle
                if (isBeingQueezed && squeezeAttack.escapeAngle !== undefined) {
                    // Blend squeeze escape with gap escape
                    const squeezeEscape = squeezeAttack.escapeAngle;
                    // Prefer the direction that's both away from squeeze AND through a gap
                    if (openAngles.length > 0) {
                        let bestSqueezeEscape = escapeAngle;
                        let bestDiff = Math.PI * 2;
                        for (const angle of openAngles) {
                            const diff = Math.abs(Utils.angleDiff(angle, squeezeEscape));
                            if (diff < bestDiff) {
                                bestDiff = diff;
                                bestSqueezeEscape = angle;
                            }
                        }
                        escapeAngle = bestSqueezeEscape;
                    }
                }

                // Use emergency escape finder for best path
                const emergencyEscape = TrapAvoidance.findEmergencyEscape(head);
                if (emergencyEscape && emergencyEscape.clearDistance > 200) {
                    // If emergency escape finds a much clearer path, use it
                    escapeAngle = emergencyEscape.angle;
                }

                const urgency = encirclementPercent >= 0.35 ? 'CRITICAL' :
                               encirclementPercent >= 0.20 ? 'HIGH' :
                               anyCloseSnakeBlocking ? 'CLOSE_THREAT' :
                               isBeingQueezed ? 'SQUEEZE' : 'MODERATE';

                DEBUG && console.log(`%c🚨 TRAP ALERT [${urgency}]! Exit: ${exitSpacePercent.toFixed(0)}% | Gap: ${largestGapDegrees.toFixed(0)}° | Rate: ${(closingRate*100).toFixed(1)}%/s${isBeingQueezed ? ' | SQUEEZE DETECTED!' : ''}`,
                    urgency === 'CRITICAL' ? 'color: #ff0000; font-size: 14px; font-weight: bold;' :
                    urgency === 'HIGH' || urgency === 'SQUEEZE' ? 'color: #ff6600; font-size: 12px; font-weight: bold;' :
                    'color: #ffaa00; font-size: 11px;');

                return {
                    isTrapped: true,
                    encirclementPercent: encirclementPercent,
                    exitSpacePercent: exitSpacePercent,
                    largestGapDegrees: largestGapDegrees,
                    closingRate: closingRate,
                    escapeAngle: escapeAngle,
                    shouldBoost: true,  // ALWAYS BOOST WHEN ESCAPING - changed!
                    trapperSnake: mainTrapper,
                    trapperCount: blockedBySnake.size,  // Number of snakes involved in trap
                    openAngles: openAngles,
                    exitGaps: exitGaps,
                    urgency: urgency,
                    isBeingQueezed: isBeingQueezed,
                    squeezeAttack: squeezeAttack
                };
            }

            return {
                isTrapped: false,
                encirclementPercent: encirclementPercent,
                exitSpacePercent: exitSpacePercent,
                largestGapDegrees: largestGapDegrees,
                closingRate: closingRate,
                escapeAngle: null,
                shouldBoost: false,
                openAngles: openAngles,
                exitGaps: exitGaps
            };
        },

        // SQUEEZE ATTACK DETECTION - Detects when a single snake is wrapping around us
        detectSqueezeAttack: () => {
            const snake = window.slither || window.snake;
            if (!snake) return null;

            const head = {
                x: snake.xx || snake.x || 0,
                y: snake.yy || snake.y || 0,
                ang: snake.ang || 0
            };

            const snakesArr = window.slithers || window.snakes || [];
            const squeezeThreats = [];

            for (const s of snakesArr) {
                if (!s || s === snake || s.dead || s.dying) continue;
                if (typeof s.xx !== 'number') continue;

                const segments = SnakeDetector.getSnakeSegments(s);
                if (segments.length < 5) continue;

                // Check how many QUADRANTS this snake's body occupies around us
                // If it's in 3+ quadrants, it's trying to squeeze us
                const quadrants = { NE: 0, NW: 0, SE: 0, SW: 0 };
                let closeSegments = 0;
                let totalDist = 0;
                let minDist = Infinity;

                for (const seg of segments) {
                    const dx = seg.x - head.x;
                    const dy = seg.y - head.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Only count segments within squeeze range
                    if (dist < 400) {
                        closeSegments++;
                        totalDist += dist;
                        minDist = Math.min(minDist, dist);

                        // Determine quadrant
                        if (dx >= 0 && dy < 0) quadrants.NE++;
                        else if (dx < 0 && dy < 0) quadrants.NW++;
                        else if (dx >= 0 && dy >= 0) quadrants.SE++;
                        else quadrants.SW++;
                    }
                }

                // Count how many quadrants have segments
                const occupiedQuadrants = Object.values(quadrants).filter(v => v > 0).length;
                const avgDist = closeSegments > 0 ? totalDist / closeSegments : Infinity;

                // SQUEEZE DETECTION - MORE SENSITIVE!
                // Snake body in 2+ quadrants with enough segments = potential wrap
                // Snake body in 3+ quadrants = DEFINITE wrap
                if ((occupiedQuadrants >= 3 && closeSegments >= 6) ||   // Lowered from 8 segments
                    (occupiedQuadrants >= 2 && closeSegments >= 10)) {  // 2 quadrants but many segments
                    // This snake is trying to squeeze us!

                    // Find the gap - the quadrant with fewest/no segments
                    let escapeQuadrant = null;
                    let minSegments = Infinity;
                    for (const [q, count] of Object.entries(quadrants)) {
                        if (count < minSegments) {
                            minSegments = count;
                            escapeQuadrant = q;
                        }
                    }

                    // Calculate escape angle toward the gap
                    let escapeAngle = 0;
                    switch (escapeQuadrant) {
                        case 'NE': escapeAngle = -Math.PI / 4; break;      // Up-right
                        case 'NW': escapeAngle = -3 * Math.PI / 4; break;  // Up-left
                        case 'SE': escapeAngle = Math.PI / 4; break;       // Down-right
                        case 'SW': escapeAngle = 3 * Math.PI / 4; break;   // Down-left
                    }

                    squeezeThreats.push({
                        snake: s,
                        quadrants: quadrants,
                        occupiedQuadrants: occupiedQuadrants,
                        closeSegments: closeSegments,
                        avgDist: avgDist,
                        minDist: minDist,
                        escapeQuadrant: escapeQuadrant,
                        escapeAngle: escapeAngle,
                        severity: (occupiedQuadrants / 4) * (1 - avgDist / 400)  // 0-1 severity
                    });
                }
            }

            // Sort by severity
            squeezeThreats.sort((a, b) => b.severity - a.severity);

            if (squeezeThreats.length > 0) {
                TrapAvoidance.squeezeAttack = squeezeThreats[0];
                return squeezeThreats[0];
            }

            TrapAvoidance.squeezeAttack = null;
            return null;
        },

        // Enhanced escape route finder with squeeze awareness
        findEmergencyEscape: (head) => {
            const snake = window.slither || window.snake;
            if (!snake) return null;

            const snakesArr = window.slithers || window.snakes || [];

            // Cast many rays to find the clearest escape path
            const rayCount = 72;
            const escapeRoutes = [];

            for (let i = 0; i < rayCount; i++) {
                const angle = (i / rayCount) * Math.PI * 2;
                let pathClearDistance = 0;
                let blocked = false;

                // Check how far we can go in this direction
                for (let dist = 30; dist <= 500; dist += 20) {
                    const checkX = head.x + Math.cos(angle) * dist;
                    const checkY = head.y + Math.sin(angle) * dist;

                    let hitObstacle = false;

                    for (const s of snakesArr) {
                        if (!s || s === snake || s.dead || s.dying) continue;

                        // Check head
                        const hx = s.xx || s.x;
                        const hy = s.yy || s.y;
                        if (Math.sqrt((checkX - hx) ** 2 + (checkY - hy) ** 2) < 35) {
                            hitObstacle = true;
                            break;
                        }

                        // Check body
                        const segments = SnakeDetector.getSnakeSegments(s);
                        for (const seg of segments) {
                            const segDist = Math.sqrt((checkX - seg.x) ** 2 + (checkY - seg.y) ** 2);
                            if (segDist < seg.radius + 30) {
                                hitObstacle = true;
                                break;
                            }
                        }
                        if (hitObstacle) break;
                    }

                    if (hitObstacle) {
                        blocked = true;
                        break;
                    }
                    pathClearDistance = dist;
                }

                escapeRoutes.push({
                    angle: angle,
                    clearDistance: pathClearDistance,
                    blocked: blocked
                });
            }

            // Find the route with the longest clear path
            escapeRoutes.sort((a, b) => b.clearDistance - a.clearDistance);

            // Get top 3 escape routes and pick one that's somewhat toward current direction
            const topRoutes = escapeRoutes.slice(0, 5);
            let bestRoute = topRoutes[0];

            // Slight preference for routes closer to current heading (less turning)
            for (const route of topRoutes) {
                const turnRequired = Math.abs(Utils.angleDiff(head.ang, route.angle));
                if (route.clearDistance > bestRoute.clearDistance * 0.8 && turnRequired < Math.PI / 3) {
                    bestRoute = route;
                    break;
                }
            }

            return {
                angle: bestRoute.angle,
                clearDistance: bestRoute.clearDistance,
                allRoutes: escapeRoutes
            };
        },

        findBestEscapeRoute: (head, initialEscape) => {
            const candidates = [];
            const checkAngles = 36;

            for (let i = 0; i < checkAngles; i++) {
                const angle = (i / checkAngles) * Math.PI * 2;
                let safety = 1.0;
                let pathClear = true;

                // Check path safety
                for (let dist = 20; dist <= CONFIG.collision.detectionRadius; dist += 20) {
                    const checkX = head.x + Math.cos(angle) * dist;
                    const checkY = head.y + Math.sin(angle) * dist;

                    for (const threat of TrapAvoidance.threats) {
                        if (threat.type === 'boundary') continue;

                        const threatDist = Utils.distance(checkX, checkY, threat.x, threat.y);
                        const minDist = (threat.radius || 30) + CONFIG.collision.safetyMargin;

                        if (threatDist < minDist) {
                            pathClear = false;
                            safety *= 0.5;
                        }
                    }
                }

                // Prefer angles closer to initial escape direction
                const angleDiff = Math.abs(Utils.angleDiff(angle, initialEscape));
                const directionBonus = 1 - (angleDiff / Math.PI) * 0.3;

                candidates.push({
                    angle: angle,
                    safety: safety * directionBonus,
                    clear: pathClear
                });
            }

            // Sort by safety and find best clear path
            candidates.sort((a, b) => b.safety - a.safety);

            const clearPath = candidates.find(c => c.clear);
            if (clearPath) return clearPath.angle;

            return candidates[0].angle;
        },

        shouldBoost: () => {
            return STATE.isTrapped ||
                TrapAvoidance.trapScore > 0.7 ||
                TrapAvoidance.threats.some(t => t.danger > 0.8) ||
                TrapAvoidance.threats.some(t => t.type === 'boundary' && t.isEmergency);
        },

        // WALL DETECTION - Detect snake bodies blocking escape routes
        // Returns array of "walls" (contiguous snake body segments blocking paths)
        // NOTE: Our own body is NOT a wall - we can always cross it!
        detectWalls: () => {
            const snake = window.slither || window.snake;
            if (!snake) return [];

            const head = {
                x: snake.xx || snake.x || 0,
                y: snake.yy || snake.y || 0,
                ang: snake.ang || 0
            };

            const snakesArr = window.slithers || window.snakes || [];
            const walls = [];

            // For each ENEMY snake, check if their body forms a "wall" blocking our path
            // Skip our own snake - we can cross our own body!
            for (const s of snakesArr) {
                if (!s || s === snake || s.dead || s.dying) continue;  // Skip self!
                if (typeof s.xx !== 'number') continue;

                const segments = SnakeDetector.getSnakeSegments(s);
                if (segments.length < 2) continue;  // Lowered from 3 - detect smaller walls

                // Find contiguous segments that block our potential paths
                let wallStart = null;
                let wallEnd = null;
                let wallSegments = [];
                let minDist = Infinity;
                let blockedAngleStart = null;
                let blockedAngleEnd = null;

                for (const seg of segments) {
                    const dist = Utils.distance(head.x, head.y, seg.x, seg.y);

                    // Expanded wall detection range - see walls further out
                    if (dist < CONFIG.collision.detectionRadius * 1.2) {
                        const angleToSeg = Utils.angle(head.x, head.y, seg.x, seg.y);

                        if (wallSegments.length === 0) {
                            wallStart = { x: seg.x, y: seg.y, angle: angleToSeg };
                            blockedAngleStart = angleToSeg;
                        }

                        wallSegments.push(seg);
                        wallEnd = { x: seg.x, y: seg.y, angle: angleToSeg };
                        blockedAngleEnd = angleToSeg;
                        minDist = Math.min(minDist, dist);
                    } else if (wallSegments.length > 0) {
                        // Gap in wall - save current wall if significant
                        if (wallSegments.length >= 2) {  // Lowered from 3 - detect smaller walls
                            const angularSpan = Math.abs(Utils.angleDiff(blockedAngleStart, blockedAngleEnd));
                            walls.push({
                                snake: s,
                                segments: [...wallSegments],
                                startAngle: blockedAngleStart,
                                endAngle: blockedAngleEnd,
                                angularSpan: angularSpan,
                                minDistance: minDist,
                                segmentCount: wallSegments.length,
                                isSolid: angularSpan > Math.PI / 8  // Lowered from PI/6 - 22.5 degrees
                            });
                        }
                        wallSegments = [];
                        wallStart = null;
                        minDist = Infinity;
                    }
                }

                // Don't forget the last wall segment
                if (wallSegments.length >= 2) {  // Lowered from 3
                    const angularSpan = Math.abs(Utils.angleDiff(blockedAngleStart, blockedAngleEnd));
                    walls.push({
                        snake: s,
                        segments: [...wallSegments],
                        startAngle: blockedAngleStart,
                        endAngle: blockedAngleEnd,
                        angularSpan: angularSpan,
                        minDistance: minDist,
                        segmentCount: wallSegments.length,
                        isSolid: angularSpan > Math.PI / 8  // Lowered threshold
                    });
                }
            }

            // Sort walls by how much they block (largest angular span first)
            walls.sort((a, b) => b.angularSpan - a.angularSpan);

            return walls;
        },

        // Find escape route considering BOTH map edge AND snake walls
        // NOTE: Our own body is NOT a wall - we can always cross it to escape!
        // Only ENEMY snake bodies are treated as walls
        findSafeEscape: () => {
            const snake = window.slither || window.snake;
            if (!snake) return null;

            const head = {
                x: snake.xx || snake.x || 0,
                y: snake.yy || snake.y || 0,
                ang: snake.ang || 0
            };

            // Get map info
            const mapRadius = typeof window.grd !== 'undefined' ? window.grd : 21600;
            const mapCenterX = mapRadius;
            const mapCenterY = mapRadius;
            const distFromCenter = Utils.distance(head.x, head.y, mapCenterX, mapCenterY);
            const distFromEdge = mapRadius - distFromCenter;

            // Detect walls (ENEMY snakes only - own body is ignored)
            const walls = TrapAvoidance.detectWalls();
            const solidWalls = walls.filter(w => w.isSolid);

            // Create blocked angle ranges
            const blockedRanges = [];

            // Add wall blocked ranges
            for (const wall of solidWalls) {
                blockedRanges.push({
                    start: wall.startAngle - 0.1,  // Small buffer
                    end: wall.endAngle + 0.1,
                    type: 'wall',
                    distance: wall.minDistance
                });
            }

            // Add edge blocked range (direction away from center is blocked)
            if (distFromEdge < CONFIG.collision.edgeDetectionRadius) {
                const awayFromCenter = Utils.angle(mapCenterX, mapCenterY, head.x, head.y);
                const edgeDanger = distFromEdge < 400 ? Math.PI / 2 : Math.PI / 4;  // Block larger angle when closer
                blockedRanges.push({
                    start: awayFromCenter - edgeDanger,
                    end: awayFromCenter + edgeDanger,
                    type: 'edge',
                    distance: distFromEdge
                });
            }

            // Check all directions and find safest
            const candidates = [];
            const rayCount = 36;

            for (let i = 0; i < rayCount; i++) {
                const angle = (i / rayCount) * Math.PI * 2;
                let blocked = false;
                let blockReason = null;

                // Check if angle is in any blocked range
                for (const range of blockedRanges) {
                    // Normalize angle comparison
                    let checkAngle = angle;
                    let rangeStart = range.start;
                    let rangeEnd = range.end;

                    // Handle wrap-around
                    const inRange = Utils.isAngleInRange(checkAngle, rangeStart, rangeEnd);
                    if (inRange) {
                        blocked = true;
                        blockReason = range.type;
                        break;
                    }
                }

                // Also check if this direction leads out of map
                const testDist = 500;
                const testX = head.x + Math.cos(angle) * testDist;
                const testY = head.y + Math.sin(angle) * testDist;
                const testDistFromCenter = Utils.distance(testX, testY, mapCenterX, mapCenterY);
                if (testDistFromCenter > mapRadius - 100) {
                    blocked = true;
                    blockReason = 'edge';
                }

                candidates.push({
                    angle: angle,
                    blocked: blocked,
                    blockReason: blockReason,
                    // Prefer directions toward center when near edge
                    edgeBonus: distFromEdge < 600 ?
                        (1 - Math.abs(Utils.angleDiff(angle, Utils.angle(head.x, head.y, mapCenterX, mapCenterY))) / Math.PI) : 0
                });
            }

            // Find unblocked candidates
            const safeCandidates = candidates.filter(c => !c.blocked);

            if (safeCandidates.length === 0) {
                // ALL directions blocked - find least dangerous
                DEBUG && console.log('%c⚠️ ALL ESCAPE ROUTES BLOCKED!', 'color: #ff0000; font-size: 14px;');
                // Go toward center as last resort
                return {
                    angle: Utils.angle(head.x, head.y, mapCenterX, mapCenterY),
                    confidence: 0.1,
                    walls: solidWalls,
                    blocked: blockedRanges
                };
            }

            // Sort by edge bonus (prefer center when near edge)
            safeCandidates.sort((a, b) => b.edgeBonus - a.edgeBonus);

            // Prefer direction closest to current heading (less turning)
            let bestCandidate = safeCandidates[0];
            for (const c of safeCandidates.slice(0, 5)) {
                const turnRequired = Math.abs(Utils.angleDiff(head.ang, c.angle));
                if (turnRequired < Math.PI / 4 && c.edgeBonus >= bestCandidate.edgeBonus * 0.7) {
                    bestCandidate = c;
                    break;
                }
            }

            return {
                angle: bestCandidate.angle,
                confidence: safeCandidates.length / rayCount,
                walls: solidWalls,
                blocked: blockedRanges,
                openDirections: safeCandidates.length
            };
        }
    };

    // ==================== RISK VS REWARD CALCULATOR (v7.0) ====================
    // Core system to evaluate whether food is worth the risk
    // Philosophy: SAFETY FIRST - don't die for a snack!
    const RiskRewardCalculator = {
        // Cache for performance
        lastCalculation: 0,
        cachedRiskMap: new Map(),
        snakeSpeedCache: new Map(),

        // Get snake speed with boosting detection
        getSnakeSpeed: (snake) => {
            if (!snake) return 11; // Default speed

            const id = snake.id || snake;
            const now = Date.now();

            // Use cached speed if recent
            const cached = RiskRewardCalculator.snakeSpeedCache.get(id);
            if (cached && now - cached.time < 200) {
                return cached.speed;
            }

            const baseSpeed = snake.sp || 11;
            const isBoosting = snake.sp > 12 || snake.boost || snake.fam === 1;
            const effectiveSpeed = isBoosting ? baseSpeed * 1.5 : baseSpeed;

            RiskRewardCalculator.snakeSpeedCache.set(id, {
                speed: effectiveSpeed,
                isBoosting: isBoosting,
                time: now
            });

            return effectiveSpeed;
        },

        // Check if a snake is heading toward a location
        isSnakeHeadingToward: (snake, targetX, targetY) => {
            if (!snake) return { heading: false, factor: 0 };

            const sx = snake.xx || snake.x || 0;
            const sy = snake.yy || snake.y || 0;
            const sAng = snake.ang || 0;

            const angleToTarget = Math.atan2(targetY - sy, targetX - sx);
            const angleDiff = Math.abs(Utils.angleDiff(sAng, angleToTarget));

            // Heading directly toward (within 30 degrees) = high danger
            if (angleDiff < Math.PI / 6) {
                return { heading: true, factor: CONFIG.riskReward.headingTowardDanger };
            }
            // Heading somewhat toward (within 60 degrees) = medium danger
            else if (angleDiff < Math.PI / 3) {
                return { heading: true, factor: 1.3 };
            }
            // Heading perpendicular = normal
            else if (angleDiff < Math.PI * 0.6) {
                return { heading: false, factor: 1.0 };
            }
            // Heading away = less dangerous
            else {
                return { heading: false, factor: CONFIG.riskReward.headingAwayBonus };
            }
        },

        // Calculate distance-based danger from a single snake
        getSnakeDanger: (snake, foodX, foodY, mySnake) => {
            if (!snake || snake === mySnake || snake.dead || snake.dying) return 0;

            const config = CONFIG.riskReward;

            // Get snake head position
            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const headDist = Utils.distance(foodX, foodY, headX, headY);

            // Base danger from head distance
            let danger = 0;

            if (headDist < config.criticalSnakeDist) {
                // CRITICAL: Snake head very close to food
                danger = 1.0;
            } else if (headDist < config.dangerSnakeDist) {
                // DANGER zone
                danger = 0.8 - ((headDist - config.criticalSnakeDist) / (config.dangerSnakeDist - config.criticalSnakeDist)) * 0.3;
            } else if (headDist < config.cautionSnakeDist) {
                // CAUTION zone
                danger = 0.5 - ((headDist - config.dangerSnakeDist) / (config.cautionSnakeDist - config.dangerSnakeDist)) * 0.3;
            } else {
                // Far away - minimal danger
                danger = Math.max(0, 0.2 - (headDist - config.cautionSnakeDist) / 500);
            }

            // Speed modifier - fast snakes are more dangerous
            const speed = RiskRewardCalculator.getSnakeSpeed(snake);
            const speedFactor = 1 + (Math.max(0, speed - 11) * config.speedDangerMultiplier);

            // Boosting modifier
            const speedData = RiskRewardCalculator.snakeSpeedCache.get(snake.id || snake);
            const boostFactor = speedData?.isBoosting ? config.boostingDangerMultiplier : 1.0;

            // Heading modifier
            const headingData = RiskRewardCalculator.isSnakeHeadingToward(snake, foodX, foodY);
            const headingFactor = headingData.factor;

            // Check for body segments near food
            let bodyDanger = 0;
            const segments = SnakeDetector.getSnakeSegments ? SnakeDetector.getSnakeSegments(snake) : [];
            for (const seg of segments.slice(0, 30)) { // Check first 30 segments
                const segDist = Utils.distance(foodX, foodY, seg.x, seg.y);
                if (segDist < config.bodyDangerDist) {
                    bodyDanger = Math.max(bodyDanger, 0.6 * (1 - segDist / config.bodyDangerDist));
                }
            }

            // Combine all factors
            const totalDanger = Math.min(1.0,
                (danger * speedFactor * boostFactor * headingFactor) + bodyDanger
            );

            return {
                danger: totalDanger,
                headDist: headDist,
                speed: speed,
                isBoosting: speedData?.isBoosting || false,
                isHeadingToward: headingData.heading,
                bodyNear: bodyDanger > 0.1
            };
        },

        // Calculate comprehensive risk score for a food location
        // Returns { risk: 0-1, factors: {...}, decision: 'safe'|'risky'|'avoid' }
        calculateFoodRisk: (foodX, foodY, foodValue = 10) => {
            const config = CONFIG.riskReward;
            if (!config.enabled) {
                return { risk: 0, factors: {}, decision: 'safe', skipReason: null };
            }

            const mySnake = window.slither || window.snake;
            if (!mySnake) return { risk: 0, factors: {}, decision: 'safe', skipReason: null };

            const snakesArr = window.slithers || window.snakes || [];

            // Collect danger from all nearby snakes
            const snakeDangers = [];
            let maxDanger = 0;
            let totalDanger = 0;
            let nearbySnakeCount = 0;
            let boostingSnakeCount = 0;
            let headingTowardCount = 0;

            for (const snake of snakesArr) {
                if (!snake || snake === mySnake || snake.dead || snake.dying) continue;

                const dangerData = RiskRewardCalculator.getSnakeDanger(snake, foodX, foodY, mySnake);

                if (dangerData.danger > 0.1) {
                    snakeDangers.push(dangerData);
                    maxDanger = Math.max(maxDanger, dangerData.danger);
                    totalDanger += dangerData.danger;
                    nearbySnakeCount++;

                    if (dangerData.isBoosting) boostingSnakeCount++;
                    if (dangerData.isHeadingToward) headingTowardCount++;
                }
            }

            // Apply crowd multipliers
            let crowdMultiplier = 1.0;
            if (nearbySnakeCount >= 3) {
                crowdMultiplier = config.threeSnakeDangerMultiplier;
            } else if (nearbySnakeCount >= 2) {
                crowdMultiplier = config.twoSnakeDangerMultiplier;
            }

            // Calculate final risk score
            // Use max danger as base, add crowd penalty
            let riskScore = maxDanger * crowdMultiplier;

            // Cap at 1.0
            riskScore = Math.min(1.0, riskScore);

            // === REWARD CALCULATION ===
            // Higher food value can offset some risk
            let rewardScore = 0;
            if (foodValue >= config.massiveFoodThreshold) {
                rewardScore = 0.4; // Can offset up to 40% risk
            } else if (foodValue >= config.hugeFoodThreshold) {
                rewardScore = 0.25; // Can offset up to 25% risk
            } else if (foodValue >= config.minFoodValueToRisk) {
                rewardScore = 0.1; // Can offset up to 10% risk
            }

            // === FINAL DECISION ===
            // Risk bias determines how much we weigh risk vs reward
            const adjustedRisk = riskScore * config.riskBias - rewardScore * (1 - config.riskBias);
            const finalRisk = Math.max(0, Math.min(1, adjustedRisk));

            // Determine decision
            let decision = 'safe';
            let skipReason = null;
            let shouldBoost = true;
            let shouldSlowApproach = false;

            if (finalRisk >= config.skipFoodRiskThreshold) {
                decision = 'avoid';
                skipReason = nearbySnakeCount >= 2 ?
                    `${nearbySnakeCount} snakes competing` :
                    boostingSnakeCount > 0 ?
                    'Boosting snake nearby' :
                    'Snake too close';
            } else if (finalRisk >= config.slowApproachThreshold) {
                decision = 'risky';
                shouldSlowApproach = true;
                shouldBoost = false;
            } else if (finalRisk >= config.noBoostRiskThreshold) {
                decision = 'caution';
                shouldBoost = false;
            }

            return {
                risk: finalRisk,
                rawRisk: riskScore,
                reward: rewardScore,
                factors: {
                    maxDanger: maxDanger,
                    nearbySnakes: nearbySnakeCount,
                    boostingSnakes: boostingSnakeCount,
                    headingToward: headingTowardCount,
                    crowdMultiplier: crowdMultiplier,
                    snakeDangers: snakeDangers
                },
                decision: decision,
                skipReason: skipReason,
                shouldBoost: shouldBoost,
                shouldSlowApproach: shouldSlowApproach
            };
        },

        // Calculate risk for dead snake food (higher stakes!)
        calculateDeadSnakeFoodRisk: (foodX, foodY, totalValue, foodCount) => {
            const config = CONFIG.riskReward;

            // Get base risk
            const baseRisk = RiskRewardCalculator.calculateFoodRisk(foodX, foodY, totalValue);

            // Apply dead snake multiplier - these are HIGHLY contested
            const adjustedRisk = baseRisk.rawRisk * config.deadSnakeRiskMultiplier;

            // Check for contest scenario (multiple snakes going for same dead snake)
            const mySnake = window.slither || window.snake;
            const snakesArr = window.slithers || window.snakes || [];

            let contestingSnakes = 0;
            for (const snake of snakesArr) {
                if (!snake || snake === mySnake || snake.dead || snake.dying) continue;

                const sx = snake.xx || snake.x || 0;
                const sy = snake.yy || snake.y || 0;
                const dist = Utils.distance(foodX, foodY, sx, sy);

                // Check if snake is heading toward the dead snake food
                const heading = RiskRewardCalculator.isSnakeHeadingToward(snake, foodX, foodY);

                if (dist < 400 && heading.heading) {
                    contestingSnakes++;
                }
            }

            // Apply contest penalty
            const contestPenalty = contestingSnakes > 0 ?
                config.deadSnakeContestPenalty * contestingSnakes : 0;

            const finalRisk = Math.min(1.0, adjustedRisk + contestPenalty);

            // For dead snake, we need VERY high value to justify high risk
            const valuePerRisk = totalValue / Math.max(0.1, finalRisk);
            const isWorthRisk = valuePerRisk > 150 && finalRisk < 0.8;

            // Determine safe approach distance
            const safeDistance = config.deadSnakeMinDistance + (contestingSnakes * 50);

            let decision = baseRisk.decision;
            let skipReason = baseRisk.skipReason;

            if (contestingSnakes >= 2) {
                decision = 'avoid';
                skipReason = `${contestingSnakes + 1} snakes contesting dead snake!`;
            } else if (finalRisk > 0.7 && !isWorthRisk) {
                decision = 'avoid';
                skipReason = 'Dead snake too contested for value';
            } else if (finalRisk > 0.5) {
                decision = 'risky';
            }

            return {
                ...baseRisk,
                risk: finalRisk,
                isDeadSnake: true,
                contestingSnakes: contestingSnakes,
                safeDistance: safeDistance,
                isWorthRisk: isWorthRisk,
                valuePerRisk: valuePerRisk,
                decision: decision,
                skipReason: skipReason,
                shouldBoost: isWorthRisk && finalRisk < 0.4 && contestingSnakes === 0
            };
        },

        // Quick check - should we even consider this food?
        shouldConsiderFood: (foodX, foodY, foodValue = 10) => {
            const risk = RiskRewardCalculator.calculateFoodRisk(foodX, foodY, foodValue);
            return risk.decision !== 'avoid';
        },

        // Log risk decision (throttled)
        logDecision: (target, riskData) => {
            if (!CONFIG.riskReward.logDecisions) return;
            if (Date.now() % 2000 > 50) return; // Throttle logs

            const emoji = riskData.decision === 'avoid' ? '🚫' :
                          riskData.decision === 'risky' ? '⚠️' :
                          riskData.decision === 'caution' ? '⚡' : '✅';

            const msg = `${emoji} RISK/REWARD: ${target.type || 'food'} | Risk: ${(riskData.risk * 100).toFixed(0)}% | ` +
                       `Snakes: ${riskData.factors.nearbySnakes} | Decision: ${riskData.decision.toUpperCase()}` +
                       (riskData.skipReason ? ` | Reason: ${riskData.skipReason}` : '');

            const color = riskData.decision === 'avoid' ? '#ff4444' :
                          riskData.decision === 'risky' ? '#ffaa00' :
                          riskData.decision === 'caution' ? '#ffff00' : '#44ff44';

            console.log(`%c${msg}`, `color: ${color}; font-size: 11px;`);
        }
    };

    // ==================== VISION-BASED DETECTION SYSTEM (v7.2) ====================
    // Detects snakes relative to player's visible screen and beyond
    const VisionDetection = {
        // Screen/viewport info
        lastViewportUpdate: 0,
        viewportInfo: null,

        // Snake tracking across zones
        trackedSnakes: new Map(),  // Track all snakes we've seen recently
        trackingTimeout: 5000,      // Keep tracking snakes for 5 seconds after leaving view

        // Zone definitions (multipliers of visible radius)
        zones: {
            immediate: 0.3,    // Immediate danger zone (30% of visible)
            visible: 1.0,      // What player can see
            peripheral: 1.5,   // Just outside visible (150% of visible)
            extended: 2.5,     // Extended tracking (250% of visible)
            maximum: 4.0       // Maximum tracking range (400% of visible)
        },

        // Get current viewport/vision info
        getViewportInfo: () => {
            // v7.2: NO CACHING - calculate viewport every frame for accuracy
            const now = Date.now();

            // Get screen dimensions
            const screenWidth = window.innerWidth || 1920;
            const screenHeight = window.innerHeight || 1080;

            // Get zoom level (gsc = global scale)
            const zoom = window.gsc || 0.9;

            // Calculate visible game area
            // At zoom 1.0, the visible radius is approximately half the screen diagonal in game units
            const screenDiagonal = Math.sqrt(screenWidth * screenWidth + screenHeight * screenHeight);
            const baseVisibleRadius = screenDiagonal / 2;

            // Zoom affects how much we can see: lower zoom = see more, higher zoom = see less
            // gsc of 0.5 means we see 2x more, gsc of 2.0 means we see 0.5x less
            const visibleRadius = baseVisibleRadius / zoom;

            // Get head position
            const head = SnakeDetector.getMyHead();
            const centerX = head ? head.x : (window.view_xx || 0);
            const centerY = head ? head.y : (window.view_yy || 0);

            VisionDetection.viewportInfo = {
                centerX,
                centerY,
                screenWidth,
                screenHeight,
                zoom,
                visibleRadius,
                // Zone radii
                immediateRadius: visibleRadius * VisionDetection.zones.immediate,
                peripheralRadius: visibleRadius * VisionDetection.zones.peripheral,
                extendedRadius: visibleRadius * VisionDetection.zones.extended,
                maximumRadius: visibleRadius * VisionDetection.zones.maximum
            };

            VisionDetection.lastViewportUpdate = now;
            return VisionDetection.viewportInfo;
        },

        // Categorize a snake by which zone it's in
        categorizeSnake: (snake, viewport) => {
            if (!snake || !viewport) return null;

            const sx = snake.xx || snake.x || 0;
            const sy = snake.yy || snake.y || 0;
            const dist = Utils.distance(sx, sy, viewport.centerX, viewport.centerY);

            let zone = 'outside';
            let priority = 0;

            if (dist < viewport.immediateRadius) {
                zone = 'immediate';
                priority = 100;  // Highest priority
            } else if (dist < viewport.visibleRadius) {
                zone = 'visible';
                priority = 80;
            } else if (dist < viewport.peripheralRadius) {
                zone = 'peripheral';
                priority = 60;
            } else if (dist < viewport.extendedRadius) {
                zone = 'extended';
                priority = 40;
            } else if (dist < viewport.maximumRadius) {
                zone = 'maximum';
                priority = 20;
            }

            return { zone, dist, priority };
        },

        // Update tracking for a snake
        trackSnake: (snake, zoneInfo) => {
            if (!snake || !snake.id) return;

            const now = Date.now();
            const existing = VisionDetection.trackedSnakes.get(snake.id);

            const record = {
                id: snake.id,
                name: snake.nk || 'unknown',
                x: snake.xx || snake.x || 0,
                y: snake.yy || snake.y || 0,
                ang: snake.ang || 0,
                sp: snake.sp || 11,
                length: snake.sct || (snake.pts ? snake.pts.length : 10),
                zone: zoneInfo.zone,
                dist: zoneInfo.dist,
                priority: zoneInfo.priority,
                lastSeen: now,
                firstSeen: existing ? existing.firstSeen : now,
                // Velocity tracking
                velocityX: 0,
                velocityY: 0,
                // History for prediction
                history: existing ? existing.history : [],
                // Threat assessment
                threat: 0,
                intent: 'unknown',
                isBoosting: (snake.sp || 11) > 13,
                isAggressive: false
            };

            // Calculate velocity from history
            if (existing && existing.history.length > 0) {
                const lastPos = existing.history[existing.history.length - 1];
                const dt = (now - lastPos.time) / 1000;
                if (dt > 0 && dt < 1) {
                    record.velocityX = (record.x - lastPos.x) / dt;
                    record.velocityY = (record.y - lastPos.y) / dt;
                }
            }

            // Add to history (keep last 30 frames)
            record.history.push({
                x: record.x,
                y: record.y,
                ang: record.ang,
                sp: record.sp,
                time: now
            });
            while (record.history.length > 30) {
                record.history.shift();
            }

            VisionDetection.trackedSnakes.set(snake.id, record);
        },

        // Get all tracked snakes with enhanced prediction
        getTrackedSnakes: () => {
            const viewport = VisionDetection.getViewportInfo();
            const head = SnakeDetector.getMyHead();
            if (!head || !viewport) return [];

            const now = Date.now();
            const allSnakes = SnakeDetector.getAllSnakes();

            // Update tracking for all visible snakes
            for (const snake of allSnakes) {
                const zoneInfo = VisionDetection.categorizeSnake(snake, viewport);
                if (zoneInfo && zoneInfo.zone !== 'outside') {
                    VisionDetection.trackSnake(snake, zoneInfo);
                }
            }

            // Predict positions for recently-tracked snakes that are now out of view
            const results = [];

            for (const [id, record] of VisionDetection.trackedSnakes.entries()) {
                const timeSinceSeen = now - record.lastSeen;

                // Remove old tracking data
                if (timeSinceSeen > VisionDetection.trackingTimeout) {
                    VisionDetection.trackedSnakes.delete(id);
                    continue;
                }

                // If recently seen, use actual position
                if (timeSinceSeen < 100) {
                    results.push({
                        ...record,
                        isPredicted: false,
                        predictionConfidence: 1.0
                    });
                } else {
                    // Predict position based on last known velocity
                    const dt = timeSinceSeen / 1000;
                    const predictedX = record.x + record.velocityX * dt;
                    const predictedY = record.y + record.velocityY * dt;
                    const predictedDist = Utils.distance(predictedX, predictedY, head.x, head.y);

                    // Confidence decreases with time
                    const confidence = Math.max(0.1, 1 - (timeSinceSeen / VisionDetection.trackingTimeout));

                    results.push({
                        ...record,
                        x: predictedX,
                        y: predictedY,
                        dist: predictedDist,
                        isPredicted: true,
                        predictionConfidence: confidence,
                        predictionAge: timeSinceSeen
                    });
                }
            }

            // Sort by priority (immediate threats first) then by distance
            results.sort((a, b) => {
                if (a.priority !== b.priority) return b.priority - a.priority;
                return a.dist - b.dist;
            });

            return results;
        },

        // Enhanced prediction for a specific snake
        predictSnakePosition: (snakeId, framesAhead = 30) => {
            const record = VisionDetection.trackedSnakes.get(snakeId);
            if (!record || record.history.length < 3) return null;

            // Calculate average velocity from history
            const recentHistory = record.history.slice(-10);
            let avgVelocityX = 0;
            let avgVelocityY = 0;
            let avgTurnRate = 0;
            let samples = 0;

            for (let i = 1; i < recentHistory.length; i++) {
                const prev = recentHistory[i - 1];
                const curr = recentHistory[i];
                const dt = (curr.time - prev.time) / 1000;

                if (dt > 0 && dt < 0.5) {
                    avgVelocityX += (curr.x - prev.x) / dt;
                    avgVelocityY += (curr.y - prev.y) / dt;
                    avgTurnRate += Utils.angleDiff(prev.ang, curr.ang) / dt;
                    samples++;
                }
            }

            if (samples === 0) return null;

            avgVelocityX /= samples;
            avgVelocityY /= samples;
            avgTurnRate /= samples;

            // Predict future positions
            const predictions = [];
            let x = record.x;
            let y = record.y;
            let ang = record.ang;
            const sp = record.sp || 11;
            const dt = 0.033;  // ~30fps

            for (let f = 0; f < framesAhead; f++) {
                ang += avgTurnRate * dt;
                x += Math.cos(ang) * sp * dt * 30;
                y += Math.sin(ang) * sp * dt * 30;

                predictions.push({
                    frame: f,
                    x, y, ang,
                    confidence: Math.max(0.2, 1 - (f / framesAhead) * 0.8)
                });
            }

            return predictions;
        },

        // Analyze threat level based on vision zones
        // v7.2: DYNAMIC SCORING - processes every frame with 35-degree angle threshold
        analyzeThreats: () => {
            const trackedSnakes = VisionDetection.getTrackedSnakes();
            const head = SnakeDetector.getMyHead();
            if (!head) return { threats: [], dangerLevel: 0, immediateThreats: [] };

            const threats = [];
            const immediateThreats = [];  // Snakes that need immediate evasion
            let maxDanger = 0;

            // 35 degrees in radians = 0.611 radians
            const THREAT_ANGLE_THRESHOLD = 35 * (Math.PI / 180);  // 35 degrees
            const THREAT_LEVEL_THRESHOLD = 0.35;  // 35% threat threshold to trigger avoidance

            for (const snake of trackedSnakes) {
                // === v7.2: ANGLE-BASED THREAT DETECTION ===
                // Only consider snake a threat if it's FACING us (within 35 degrees)
                const angleToUs = Math.atan2(head.y - snake.y, head.x - snake.x);
                const angleDiff = Math.abs(Utils.angleDiff(snake.ang, angleToUs));

                // Snake is NOT facing us - minimal threat
                const isFacingUs = angleDiff < THREAT_ANGLE_THRESHOLD;

                let threat = 0;
                snake.isFacingUs = isFacingUs;
                snake.facingAngleDiff = angleDiff * (180 / Math.PI);  // Store in degrees for debugging

                if (!isFacingUs) {
                    // Snake not pointing at us - much lower threat
                    // Only consider if very close AND approaching
                    if (snake.zone === 'immediate' && snake.dist < 150) {
                        threat = 0.15;  // Minimal threat - just awareness
                    } else {
                        threat = 0.05;  // Almost no threat
                    }
                    snake.intent = 'not_facing';
                } else {
                    // === SNAKE IS FACING US (within 35 degrees) - Calculate real threat ===

                    // Base threat from distance/zone
                    switch (snake.zone) {
                        case 'immediate': threat += 0.5; break;
                        case 'visible': threat += 0.25; break;
                        case 'peripheral': threat += 0.1; break;
                        case 'extended': threat += 0.05; break;
                    }

                    // How directly is it pointing at us? (0 = dead on, 35deg = threshold)
                    const facingDirectness = 1 - (angleDiff / THREAT_ANGLE_THRESHOLD);
                    threat += facingDirectness * 0.3;  // Up to +0.3 for dead-on approach

                    // Boosting snakes are much more dangerous when facing us
                    if (snake.isBoosting) {
                        threat += 0.25;
                        snake.intent = 'attacking';
                    } else {
                        snake.intent = 'approaching';
                    }

                    // Check if actually getting closer (velocity-based)
                    const closingSpeed = -(snake.velocityX * (head.x - snake.x) +
                                           snake.velocityY * (head.y - snake.y)) / Math.max(snake.dist, 1);
                    if (closingSpeed > 50) {
                        threat += 0.15;
                        snake.isApproaching = true;
                        snake.closingSpeed = closingSpeed;
                    } else if (closingSpeed < -50) {
                        // Moving away - reduce threat
                        threat *= 0.5;
                        snake.isApproaching = false;
                    }
                }

                // Predicted snakes have reduced threat confidence
                if (snake.isPredicted) {
                    threat *= snake.predictionConfidence;
                }

                snake.threat = Math.min(1.0, threat);

                // === v7.2: 35% THRESHOLD CHECK ===
                // Only add to immediate threats if above threshold AND facing us
                if (snake.threat >= THREAT_LEVEL_THRESHOLD && isFacingUs) {
                    immediateThreats.push(snake);
                    snake.requiresEvasion = true;
                } else {
                    snake.requiresEvasion = false;
                }

                if (snake.threat > 0.1) {
                    threats.push(snake);
                }

                maxDanger = Math.max(maxDanger, snake.threat);
            }

            // Sort threats by threat level
            threats.sort((a, b) => b.threat - a.threat);
            immediateThreats.sort((a, b) => b.threat - a.threat);

            return {
                threats,
                immediateThreats,  // v7.2: Snakes that crossed 35% threshold AND facing us
                dangerLevel: maxDanger,
                immediateCount: immediateThreats.length,
                facingCount: threats.filter(t => t.isFacingUs).length,
                visibleCount: threats.filter(t => t.zone === 'visible').length,
                totalTracked: trackedSnakes.length,
                requiresEvasion: immediateThreats.length > 0  // True if ANY snake requires evasion
            };
        },

        // Get snakes approaching from specific direction
        getApproachingFrom: (direction, angleRange = Math.PI / 4) => {
            const trackedSnakes = VisionDetection.getTrackedSnakes();
            const head = SnakeDetector.getMyHead();
            if (!head) return [];

            return trackedSnakes.filter(snake => {
                const angleFromHead = Math.atan2(snake.y - head.y, snake.x - head.x);
                const diff = Math.abs(Utils.angleDiff(direction, angleFromHead));
                return diff < angleRange && snake.isApproaching;
            });
        },

        // Clear old tracking data
        cleanup: () => {
            const now = Date.now();
            for (const [id, record] of VisionDetection.trackedSnakes.entries()) {
                if (now - record.lastSeen > VisionDetection.trackingTimeout * 2) {
                    VisionDetection.trackedSnakes.delete(id);
                }
            }
        }
    };

    // ==================== SNAKE PREDICTION SYSTEM (v7.1) ====================
    // Advanced prediction of other snakes' movements and intentions
    const SnakePrediction = {
        // History of snake positions for trajectory analysis
        snakeHistory: new Map(),
        historyLength: 20,  // Keep last 20 frames of data

        // Prediction cache
        predictionCache: new Map(),
        lastPredictionTime: 0,

        // v7.1.2: Aggressive snake tracking
        aggressiveTimeout: 8000,      // How long to remember aggressive snakes (8 seconds)
        boostTrackingTimeout: 3000,   // How long to track boost history
        interceptCooldown: 5000,      // Cooldown for intercept detection

        // Record snake position for trajectory tracking
        recordSnakePosition: (snake) => {
            if (!snake || !snake.id) return;

            const id = snake.id;
            const now = Date.now();

            if (!SnakePrediction.snakeHistory.has(id)) {
                SnakePrediction.snakeHistory.set(id, []);
            }

            const history = SnakePrediction.snakeHistory.get(id);
            history.push({
                x: snake.xx || snake.x || 0,
                y: snake.yy || snake.y || 0,
                ang: snake.ang || 0,
                sp: snake.sp || 11,
                time: now
            });

            // Keep only recent history
            while (history.length > SnakePrediction.historyLength) {
                history.shift();
            }
        },

        // Calculate turn rate (how fast the snake is turning)
        getTurnRate: (snake) => {
            if (!snake || !snake.id) return 0;

            const history = SnakePrediction.snakeHistory.get(snake.id);
            if (!history || history.length < 3) return 0;

            // Get last few positions
            const recent = history.slice(-5);
            let totalTurn = 0;
            let count = 0;

            for (let i = 1; i < recent.length; i++) {
                const angleDiff = Utils.angleDiff(recent[i-1].ang, recent[i].ang);
                const timeDiff = recent[i].time - recent[i-1].time;
                if (timeDiff > 0) {
                    totalTurn += angleDiff / (timeDiff / 1000);  // Radians per second
                    count++;
                }
            }

            return count > 0 ? totalTurn / count : 0;
        },

        // Predict snake position at future time
        predictPosition: (snake, framesAhead = 15) => {
            if (!snake) return null;

            const x = snake.xx || snake.x || 0;
            const y = snake.yy || snake.y || 0;
            const ang = snake.ang || 0;
            const sp = snake.sp || 11;
            const turnRate = SnakePrediction.getTurnRate(snake);

            // Time per frame in seconds
            const dt = 0.03;  // ~30fps

            // Simulate forward
            let predX = x;
            let predY = y;
            let predAng = ang;

            for (let f = 0; f < framesAhead; f++) {
                predAng += turnRate * dt;  // Apply turn rate
                predX += Math.cos(predAng) * sp * dt * 30;  // Speed is per-frame
                predY += Math.sin(predAng) * sp * dt * 30;
            }

            return {
                x: predX,
                y: predY,
                ang: predAng,
                confidence: Math.max(0.3, 1 - framesAhead * 0.03)  // Confidence decreases over time
            };
        },

        // Determine snake intent (what the snake is likely trying to do)
        analyzeIntent: (snake, myHead) => {
            if (!snake || !myHead) return { intent: 'unknown', threat: 0 };

            const sx = snake.xx || snake.x || 0;
            const sy = snake.yy || snake.y || 0;
            const sAng = snake.ang || 0;
            const sp = snake.sp || 11;

            const dist = Utils.distance(sx, sy, myHead.x, myHead.y);
            const angleToMe = Math.atan2(myHead.y - sy, myHead.x - sx);
            const angleDiff = Math.abs(Utils.angleDiff(sAng, angleToMe));

            // Check if boosting
            const isBoosting = sp > 13;

            // Get turn rate
            const turnRate = SnakePrediction.getTurnRate(snake);
            const isTurning = Math.abs(turnRate) > 0.5;

            // Predict where snake will be
            const pred10 = SnakePrediction.predictPosition(snake, 10);
            const pred20 = SnakePrediction.predictPosition(snake, 20);

            // Check if prediction gets closer to us
            const distNow = dist;
            const dist10 = pred10 ? Utils.distance(pred10.x, pred10.y, myHead.x, myHead.y) : dist;
            const dist20 = pred20 ? Utils.distance(pred20.x, pred20.y, myHead.x, myHead.y) : dist;

            const approachingFast = dist10 < distNow - 50 && dist20 < dist10 - 50;
            const approaching = dist10 < distNow && dist20 < dist10;
            const departing = dist10 > distNow && dist20 > dist10;

            // Determine intent
            let intent = 'wandering';
            let threat = 0;
            let isAttacker = false;

            if (angleDiff < Math.PI / 6 && dist < 400) {
                // Heading directly at us
                if (isBoosting) {
                    intent = 'attacking';
                    threat = 1.0;
                    isAttacker = true;
                } else if (approaching) {
                    intent = 'intercepting';
                    threat = 0.8;
                    isAttacker = true;
                } else {
                    intent = 'heading_toward';
                    threat = 0.5;
                }
            } else if (angleDiff < Math.PI / 3 && dist < 300) {
                // Heading somewhat toward us
                if (isBoosting) {
                    intent = 'chasing';
                    threat = 0.7;
                    isAttacker = true;
                } else if (approachingFast) {
                    intent = 'intercepting';
                    threat = 0.6;
                    isAttacker = true;
                } else {
                    intent = 'converging';
                    threat = 0.4;
                }
            } else if (isTurning && dist < 250) {
                // Snake is turning near us - might be trying to trap
                const turnTowardUs = turnRate * (angleToMe - sAng) > 0;
                if (turnTowardUs) {
                    intent = 'circling';
                    threat = 0.6;
                    isAttacker = true;
                }
            } else if (departing) {
                intent = 'fleeing';
                threat = 0.1;
            } else {
                intent = 'wandering';
                threat = 0.2;
            }

            // Distance modifier
            if (dist < 100) threat = Math.min(1.0, threat + 0.3);
            else if (dist < 200) threat = Math.min(1.0, threat + 0.15);

            // Boosting modifier
            if (isBoosting && dist < 300) threat = Math.min(1.0, threat + 0.2);

            return {
                intent,
                threat,
                isAttacker,
                isBoosting,
                isTurning,
                approaching,
                turnRate,
                dist,
                angleDiff,
                prediction10: pred10,
                prediction20: pred20
            };
        },

        // Get all snakes with their predicted intent
        getSnakeIntents: (myHead) => {
            const snakesArr = window.slithers || window.snakes || [];
            const mySnake = window.slither || window.snake;
            const intents = [];

            for (const s of snakesArr) {
                if (!s || s === mySnake || s.dead || s.dying) continue;

                // Record position for history
                SnakePrediction.recordSnakePosition(s);

                // v7.1.2: Use enhanced analysis with aggression tracking
                const intent = SnakePrediction.analyzeWithAggression(s, myHead);
                if (intent.threat > 0.1 || intent.dist < 500 || intent.wasAggressive) {
                    intents.push({
                        snake: s,
                        id: s.id,
                        x: s.xx || s.x || 0,
                        y: s.yy || s.y || 0,
                        ang: s.ang || 0,
                        sp: s.sp || 11,
                        ...intent
                    });
                }
            }

            // Sort by threat level (aggressive snakes get priority)
            intents.sort((a, b) => {
                // Prioritize currently aggressive
                if (a.wasAggressive && !b.wasAggressive) return -1;
                if (b.wasAggressive && !a.wasAggressive) return 1;
                // Then by threat level
                return b.threat - a.threat;
            });

            // Store for visualization
            STATE.snakeIntents = intents;

            return intents;
        },

        // Clean up old history entries
        cleanup: () => {
            const now = Date.now();
            for (const [id, history] of SnakePrediction.snakeHistory.entries()) {
                // Remove entries older than 2 seconds
                while (history.length > 0 && now - history[0].time > 2000) {
                    history.shift();
                }
                // Remove empty entries
                if (history.length === 0) {
                    SnakePrediction.snakeHistory.delete(id);
                }
            }

            // v7.1.2: Clean up expired aggressive snake entries
            SnakePrediction.cleanupAggressiveSnakes();
        },

        // ==================== v7.1.2: AGGRESSIVE SNAKE DETECTION ====================

        // Mark a snake as aggressive
        markAggressive: (snake, reason, threat = 1.0) => {
            if (!snake || !snake.id) return;

            const now = Date.now();
            const id = snake.id;

            // Get or create aggression record
            let record = STATE.aggressiveSnakes.get(id);
            if (!record) {
                record = {
                    firstSeen: now,
                    lastSeen: now,
                    reasons: [],
                    maxThreat: threat,
                    interceptCount: 0,
                    boostCount: 0,
                    snake: snake
                };
                STATE.aggressiveSnakes.set(id, record);
                DEBUG && console.log(`%c🎯 AGGRESSIVE SNAKE DETECTED [${id}]: ${reason}`,
                    'color: #ff0000; font-size: 12px; font-weight: bold;');
            }

            record.lastSeen = now;
            record.maxThreat = Math.max(record.maxThreat, threat);
            if (!record.reasons.includes(reason)) {
                record.reasons.push(reason);
            }
            record.snake = snake;  // Update snake reference
        },

        // Track boosting snakes
        trackBoosting: (snake, myHead) => {
            if (!snake || !snake.id) return false;

            const now = Date.now();
            const id = snake.id;
            const sp = snake.sp || 11;
            const isBoosting = sp > 13;

            // Get or create boost record
            let record = STATE.boostingSnakes.get(id);
            if (!record) {
                record = {
                    startTime: null,
                    totalBoostTime: 0,
                    boostStartX: 0,
                    boostStartY: 0,
                    wasHeadingToUs: false
                };
                STATE.boostingSnakes.set(id, record);
            }

            if (isBoosting) {
                const sx = snake.xx || snake.x || 0;
                const sy = snake.yy || snake.y || 0;
                const sAng = snake.ang || 0;
                const dist = Utils.distance(sx, sy, myHead.x, myHead.y);
                const angleToUs = Math.atan2(myHead.y - sy, myHead.x - sx);
                const angleDiff = Math.abs(Utils.angleDiff(sAng, angleToUs));

                // Check if boosting toward us
                const headingToUs = angleDiff < Math.PI / 4 && dist < 500;

                if (!record.startTime) {
                    // Just started boosting
                    record.startTime = now;
                    record.boostStartX = sx;
                    record.boostStartY = sy;
                    record.wasHeadingToUs = headingToUs;
                } else {
                    // Still boosting - track duration
                    record.totalBoostTime = now - record.startTime;

                    // If boosting toward us for more than 500ms, mark aggressive
                    if (headingToUs && record.totalBoostTime > 500) {
                        SnakePrediction.markAggressive(snake, 'BOOST_ATTACK', 0.9);
                        record.wasHeadingToUs = true;
                    }
                }

                return headingToUs;
            } else {
                // Not boosting - reset if was boosting
                if (record.startTime) {
                    record.startTime = null;
                    record.totalBoostTime = 0;
                }
                return false;
            }
        },

        // Detect intercept attempts (snake trying to cut us off)
        detectIntercept: (snake, myHead) => {
            if (!snake || !snake.id || !myHead) return false;

            const sx = snake.xx || snake.x || 0;
            const sy = snake.yy || snake.y || 0;
            const sAng = snake.ang || 0;
            const sp = snake.sp || 11;
            const myAng = myHead.ang || 0;
            const mySpeed = myHead.sp || 11;

            const dist = Utils.distance(sx, sy, myHead.x, myHead.y);
            if (dist > 600) return false;  // Too far

            // Predict where WE will be in 20 frames
            const myFutureX = myHead.x + Math.cos(myAng) * mySpeed * 20;
            const myFutureY = myHead.y + Math.sin(myAng) * mySpeed * 20;

            // Predict where THEY will be in 20 frames
            const theirFutureX = sx + Math.cos(sAng) * sp * 20;
            const theirFutureY = sy + Math.sin(sAng) * sp * 20;

            // Check if their predicted position is in front of our predicted position
            const distNow = dist;
            const distToOurPath = Utils.distance(theirFutureX, theirFutureY, myFutureX, myFutureY);
            const distToOurPosition = Utils.distance(theirFutureX, theirFutureY, myHead.x, myHead.y);

            // Check if they're aiming to cross our path
            const angleFromThem = Math.atan2(myFutureY - theirFutureY, myFutureX - theirFutureX);
            const theirHeadingDiff = Math.abs(Utils.angleDiff(sAng, angleFromThem));

            // Intercept detected if:
            // 1. They will be closer to our future position than they are now
            // 2. They're heading toward where we'll be
            // 3. They're boosting OR they're already close
            const isBoosting = sp > 13;
            const intercepting = distToOurPath < distNow * 0.5 &&
                                theirHeadingDiff < Math.PI / 3 &&
                                (isBoosting || dist < 300);

            if (intercepting) {
                SnakePrediction.markAggressive(snake, 'INTERCEPT', 0.85);

                // Record intercept attempt
                const now = Date.now();
                STATE.interceptAttempts = STATE.interceptAttempts.filter(a => now - a.time < 5000);
                STATE.interceptAttempts.push({
                    snakeId: snake.id,
                    time: now,
                    theirPos: { x: sx, y: sy },
                    theirTarget: { x: theirFutureX, y: theirFutureY },
                    ourTarget: { x: myFutureX, y: myFutureY }
                });

                DEBUG && console.log(`%c⚠️ INTERCEPT ATTEMPT! Snake ${snake.id} trying to cut us off!`,
                    'color: #ff6600; font-size: 11px; font-weight: bold;');
                return true;
            }

            return false;
        },

        // Check if a snake is marked as aggressive
        isAggressive: (snake) => {
            if (!snake || !snake.id) return false;

            const record = STATE.aggressiveSnakes.get(snake.id);
            if (!record) return false;

            // Check if record is still valid (within timeout)
            const now = Date.now();
            if (now - record.lastSeen > SnakePrediction.aggressiveTimeout) {
                return false;  // Expired
            }

            return true;
        },

        // Get aggression level for a snake (0-1)
        getAggressionLevel: (snake) => {
            if (!snake || !snake.id) return 0;

            const record = STATE.aggressiveSnakes.get(snake.id);
            if (!record) return 0;

            const now = Date.now();
            const timeSinceSeen = now - record.lastSeen;

            // Decay aggression over time
            const decay = Math.max(0, 1 - (timeSinceSeen / SnakePrediction.aggressiveTimeout));

            return record.maxThreat * decay;
        },

        // Clean up expired aggressive snake records
        cleanupAggressiveSnakes: () => {
            const now = Date.now();

            // Clean aggressive snakes
            for (const [id, record] of STATE.aggressiveSnakes.entries()) {
                if (now - record.lastSeen > SnakePrediction.aggressiveTimeout) {
                    STATE.aggressiveSnakes.delete(id);
                    DEBUG && console.log(`%c✓ Aggressive snake ${id} cleared (timeout)`, 'color: #888888;');
                }
            }

            // Clean boost tracking (keep for shorter time)
            for (const [id, record] of STATE.boostingSnakes.entries()) {
                if (record.startTime && now - record.startTime > SnakePrediction.boostTrackingTimeout) {
                    STATE.boostingSnakes.delete(id);
                }
            }

            // Clean old intercept attempts
            STATE.interceptAttempts = STATE.interceptAttempts.filter(a => now - a.time < 5000);
        },

        // Get all currently aggressive snakes
        getAggressiveSnakes: () => {
            const aggressive = [];
            const now = Date.now();

            for (const [id, record] of STATE.aggressiveSnakes.entries()) {
                if (now - record.lastSeen < SnakePrediction.aggressiveTimeout) {
                    aggressive.push({
                        id: id,
                        snake: record.snake,
                        threat: SnakePrediction.getAggressionLevel(record.snake),
                        reasons: record.reasons,
                        duration: now - record.firstSeen
                    });
                }
            }

            return aggressive.sort((a, b) => b.threat - a.threat);
        },

        // Full analysis including aggression detection
        analyzeWithAggression: (snake, myHead) => {
            const baseIntent = SnakePrediction.analyzeIntent(snake, myHead);

            // Track boosting
            const boostingTowardUs = SnakePrediction.trackBoosting(snake, myHead);

            // Detect intercept attempts
            const intercepting = SnakePrediction.detectIntercept(snake, myHead);

            // Check historical aggression
            const wasAggressive = SnakePrediction.isAggressive(snake);
            const aggressionLevel = SnakePrediction.getAggressionLevel(snake);

            // If showing aggressive behavior now, mark them
            if (baseIntent.isAttacker || boostingTowardUs || intercepting) {
                const reason = baseIntent.isBoosting && baseIntent.isAttacker ? 'BOOST_ATTACK' :
                              intercepting ? 'INTERCEPT' :
                              baseIntent.isAttacker ? 'DIRECT_ATTACK' : 'AGGRESSIVE';
                SnakePrediction.markAggressive(snake, reason, baseIntent.threat);
            }

            // Enhance threat if historically aggressive
            let enhancedThreat = baseIntent.threat;
            if (wasAggressive) {
                enhancedThreat = Math.max(enhancedThreat, aggressionLevel * 0.7);  // At least 70% of recorded aggression
                enhancedThreat = Math.min(1.0, enhancedThreat + 0.2);  // Boost threat by 20%
            }

            return {
                ...baseIntent,
                threat: enhancedThreat,
                wasAggressive: wasAggressive,
                aggressionLevel: aggressionLevel,
                isCurrentlyBoosting: baseIntent.isBoosting,
                boostingTowardUs: boostingTowardUs,
                intercepting: intercepting,
                // Mark as attacker if ANY aggressive indicator
                isAttacker: baseIntent.isAttacker || wasAggressive || boostingTowardUs || intercepting
            };
        }
    };

    // ==================== EVASION RING SYSTEM (v7.1) ====================
    // Multi-ring danger visualization and blocked path detection
    const EvasionRings = {
        // Store calculated rings
        rings: [],
        blockedAngles: [],
        safeGaps: [],
        lastUpdate: 0,

        // Configuration - v7.1.4: INCREASED safety margins
        config: {
            baseRingRadius: 150,     // Base ring size - INCREASED from 80
            maxRingRadius: 350,      // Max ring size for close threats - INCREASED from 200
            ringExpansionFactor: 2.5,// How much ring expands when close
            overlapThreshold: 45,    // Minimum gap to consider "open" - INCREASED
            updateInterval: 40,      // ms between updates - faster
            minSafeDistance: 200,    // NEVER get closer than this to any snake
        },

        // Calculate ring radius based on distance to threat - v7.1.4: MUCH LARGER
        calculateRingRadius: (distanceToSnake, snakeSpeed, isBoosting, isAttacker) => {
            const cfg = EvasionRings.config;

            // v7.1.4: ALL snakes get LARGE danger zones - we want to stay far away!
            let radius = cfg.baseRingRadius;

            // Inverse relationship - closer snake = MUCH bigger danger ring
            if (distanceToSnake < 150) {
                radius = cfg.maxRingRadius;  // Maximum danger zone
            } else if (distanceToSnake < 250) {
                radius = cfg.maxRingRadius * 0.85;
            } else if (distanceToSnake < 350) {
                radius = cfg.maxRingRadius * 0.7;
            } else if (distanceToSnake < 450) {
                radius = cfg.maxRingRadius * 0.55;
            } else if (distanceToSnake < 550) {
                radius = cfg.baseRingRadius * 1.3;
            }

            // Boosting snakes get MUCH larger rings (they're fast!)
            if (isBoosting) {
                radius *= 1.5;  // Increased from 1.3
            }

            // Attackers get even larger rings
            if (isAttacker) {
                radius *= 1.6;  // Increased from 1.4
            }

            // Speed factor - faster snakes are more dangerous
            const speedFactor = Math.max(1, (snakeSpeed || 11) / 11);
            radius *= speedFactor;

            return Math.min(radius, cfg.maxRingRadius * 1.5);  // Allow larger max
        },

        // Calculate threat value (0-1) based on distance - v7.1.4: Extended range
        calculateThreatValue: (distance, maxRange = 700) => {
            // v7.1.4: Higher base threat, slower dropoff
            // At 0 distance = 1.0, at maxRange = 0.0
            // But we want more threat at longer distances too
            const baseThreat = Math.max(0, 1 - (distance / maxRange));
            // Add minimum threat for any snake in range
            const minThreat = distance < 400 ? 0.3 : distance < 550 ? 0.15 : 0;
            return Math.max(baseThreat, minThreat);
        },

        // Update rings for all nearby snakes
        updateRings: (head, snakes) => {
            const now = Date.now();
            if (now - EvasionRings.lastUpdate < EvasionRings.config.updateInterval) {
                return EvasionRings.rings;
            }
            EvasionRings.lastUpdate = now;

            if (!head || !snakes || snakes.length === 0) {
                EvasionRings.rings = [];
                EvasionRings.blockedAngles = [];
                EvasionRings.safeGaps = [];
                return [];
            }

            const mySnake = window.slither || window.snake;
            const rings = [];

            for (const snake of snakes) {
                if (!snake || snake === mySnake || snake.dead || snake.dying) continue;

                const sx = snake.xx || snake.x || 0;
                const sy = snake.yy || snake.y || 0;
                const dist = Utils.distance(head.x, head.y, sx, sy);

                // Only create rings for snakes within detection range
                if (dist > 600) continue;

                // v7.1.2: Get full prediction data including aggression
                const intent = SnakePrediction.analyzeWithAggression(snake, head);
                const isBoosting = (snake.sp || 11) > 13;
                const isAttacker = intent.isAttacker;
                const wasAggressive = intent.wasAggressive;
                const aggressionLevel = intent.aggressionLevel || 0;

                // v7.1.2: Calculate ring properties with aggression bonus
                let ringRadius = EvasionRings.calculateRingRadius(dist, snake.sp, isBoosting, isAttacker);

                // Aggressive snakes get even larger rings (they're known threats)
                if (wasAggressive) {
                    ringRadius *= (1 + aggressionLevel * 0.5);  // Up to 50% larger
                }

                // Calculate threat value with aggression boost
                let threatValue = EvasionRings.calculateThreatValue(dist);
                if (wasAggressive) {
                    threatValue = Math.min(1, threatValue + aggressionLevel * 0.3);  // Boost threat
                }

                const angleToSnake = Math.atan2(sy - head.y, sx - head.x);

                // Calculate angular span this ring blocks (from player's perspective)
                const angularSpan = Math.atan2(ringRadius, dist) * 2;
                const startAngle = angleToSnake - angularSpan / 2;
                const endAngle = angleToSnake + angularSpan / 2;

                rings.push({
                    snake: snake,
                    x: sx,
                    y: sy,
                    distance: dist,
                    radius: ringRadius,
                    threat: threatValue,
                    angleToSnake: angleToSnake,
                    angularSpan: angularSpan,
                    startAngle: startAngle,
                    endAngle: endAngle,
                    isBoosting: isBoosting,
                    isAttacker: isAttacker,
                    wasAggressive: wasAggressive,
                    aggressionLevel: aggressionLevel,
                    intent: intent.intent,
                    // Color based on aggression/distance/threat
                    color: wasAggressive ? '#ff0000' :
                           threatValue > 0.7 ? '#ff0000' :
                           isBoosting ? '#ff6600' :
                           threatValue > 0.5 ? '#ff6600' :
                           threatValue > 0.3 ? '#ffff00' : '#00ff00'
                });
            }

            // Sort by threat (aggressive snakes first, then closest/most dangerous)
            rings.sort((a, b) => {
                if (a.wasAggressive && !b.wasAggressive) return -1;
                if (b.wasAggressive && !a.wasAggressive) return 1;
                return b.threat - a.threat;
            });

            EvasionRings.rings = rings;

            // Calculate blocked angles and safe gaps
            EvasionRings.calculateBlockedPaths(rings);

            return rings;
        },

        // Calculate which angular paths are blocked by overlapping rings
        calculateBlockedPaths: (rings) => {
            if (!rings || rings.length === 0) {
                EvasionRings.blockedAngles = [];
                EvasionRings.safeGaps = [{ start: -Math.PI, end: Math.PI, size: Math.PI * 2 }];
                return;
            }

            // Collect all blocked angular segments
            const blocked = [];
            for (const ring of rings) {
                blocked.push({
                    start: Utils.normalizeAngle(ring.startAngle),
                    end: Utils.normalizeAngle(ring.endAngle),
                    ring: ring
                });
            }

            // Sort by start angle
            blocked.sort((a, b) => a.start - b.start);

            // Merge overlapping segments
            const merged = [];
            for (const seg of blocked) {
                if (merged.length === 0) {
                    merged.push({ ...seg });
                } else {
                    const last = merged[merged.length - 1];
                    // Check for overlap (accounting for angle wrapping)
                    if (EvasionRings.anglesOverlap(last.start, last.end, seg.start, seg.end)) {
                        // Merge - extend end angle
                        last.end = EvasionRings.maxAngle(last.end, seg.end);
                        if (!last.rings) last.rings = [last.ring];
                        last.rings.push(seg.ring);
                    } else {
                        merged.push({ ...seg });
                    }
                }
            }

            EvasionRings.blockedAngles = merged;

            // Calculate safe gaps between blocked segments
            const gaps = [];
            const fullCircle = Math.PI * 2;

            if (merged.length === 0) {
                // No threats - all directions are safe
                gaps.push({ start: -Math.PI, end: Math.PI, size: fullCircle, direction: 0 });
            } else if (merged.length === 1) {
                // One blocked segment - gap is the remainder
                const gapStart = merged[0].end;
                const gapEnd = merged[0].start;
                const gapSize = Utils.normalizeAngle(gapEnd - gapStart + fullCircle);
                gaps.push({
                    start: gapStart,
                    end: gapEnd,
                    size: gapSize,
                    direction: Utils.normalizeAngle(gapStart + gapSize / 2)
                });
            } else {
                // Multiple blocked segments - find gaps between them
                for (let i = 0; i < merged.length; i++) {
                    const current = merged[i];
                    const next = merged[(i + 1) % merged.length];

                    const gapStart = current.end;
                    const gapEnd = next.start;
                    let gapSize = gapEnd - gapStart;
                    if (gapSize < 0) gapSize += fullCircle;

                    // Only consider gaps large enough to escape through
                    if (gapSize > EvasionRings.config.overlapThreshold * Math.PI / 180) {
                        gaps.push({
                            start: gapStart,
                            end: gapEnd,
                            size: gapSize,
                            direction: Utils.normalizeAngle(gapStart + gapSize / 2)
                        });
                    }
                }
            }

            // Sort gaps by size (largest first - best escape route)
            gaps.sort((a, b) => b.size - a.size);

            EvasionRings.safeGaps = gaps;
        },

        // Check if two angular ranges overlap
        anglesOverlap: (start1, end1, start2, end2) => {
            // Normalize angles
            const diff1 = Utils.normalizeAngle(end1 - start1);
            const diff2 = Utils.normalizeAngle(start2 - start1);
            const diff3 = Utils.normalizeAngle(end2 - start1);

            // Check if segment 2 starts within segment 1
            if (diff2 <= diff1) return true;
            // Check if segment 1 ends within segment 2
            if (diff3 <= diff1) return true;

            return false;
        },

        // Get the greater of two angles
        maxAngle: (a1, a2) => {
            const diff = Utils.normalizeAngle(a2 - a1);
            return diff > 0 && diff < Math.PI ? a2 : a1;
        },

        // Get best escape direction based on safe gaps
        getBestEscapeDirection: (head, preferredAngle = null) => {
            const gaps = EvasionRings.safeGaps;
            const rings = EvasionRings.rings;

            if (!head) return preferredAngle || 0;

            // v7.1.3: IMPROVED ESCAPE - Score ALL directions for true safety
            // Check 16 directions around the snake
            const directions = [];
            for (let i = 0; i < 16; i++) {
                const angle = (i / 16) * Math.PI * 2 - Math.PI;
                directions.push({
                    angle: angle,
                    safetyScore: EvasionRings.scoreEscapeDirection(head, angle, rings)
                });
            }

            // Sort by safety score (highest = safest)
            directions.sort((a, b) => b.safetyScore - a.safetyScore);

            // Get the safest direction
            const safestDirection = directions[0];

            // If we have safe gaps, verify the best gap leads to actual safety
            if (gaps && gaps.length > 0) {
                // Score each gap by the safety of its center direction
                const scoredGaps = gaps.map(gap => ({
                    ...gap,
                    safetyScore: EvasionRings.scoreEscapeDirection(head, gap.direction, rings)
                }));

                // Sort by combined score: gap size + safety
                scoredGaps.sort((a, b) => {
                    const scoreA = a.size * 0.3 + a.safetyScore * 0.7;  // Weight safety more
                    const scoreB = b.size * 0.3 + b.safetyScore * 0.7;
                    return scoreB - scoreA;
                });

                const bestGap = scoredGaps[0];

                // Use best gap if it's reasonably safe, otherwise use safest direction
                if (bestGap.safetyScore > 0.3) {
                    return bestGap.direction;
                }
            }

            // If preferred angle is safe enough, allow it
            if (preferredAngle !== null) {
                const preferredScore = EvasionRings.scoreEscapeDirection(head, preferredAngle, rings);
                if (preferredScore > safestDirection.safetyScore * 0.8) {
                    return preferredAngle;
                }
            }

            // Return the safest direction we found
            if (safestDirection.safetyScore > 0.2) {
                return safestDirection.angle;
            }

            // Fallback: opposite of the center of mass of all threats
            if (rings && rings.length > 0) {
                let threatCenterX = 0, threatCenterY = 0, totalWeight = 0;
                for (const ring of rings) {
                    const weight = ring.threat * (1 / Math.max(ring.distance, 50));
                    threatCenterX += (ring.x - head.x) * weight;
                    threatCenterY += (ring.y - head.y) * weight;
                    totalWeight += weight;
                }
                if (totalWeight > 0) {
                    const threatAngle = Math.atan2(threatCenterY / totalWeight, threatCenterX / totalWeight);
                    return Utils.normalizeAngle(threatAngle + Math.PI);  // Opposite direction
                }
            }

            return safestDirection.angle;
        },

        // v7.1.4: Score an escape direction for safety (0 = dangerous, 1 = safe)
        // MUCH MORE CONSERVATIVE - heavy penalties for ANY snake proximity
        scoreEscapeDirection: (head, angle, rings) => {
            if (!head || !rings) return 1;
            if (rings.length === 0) return 1;

            let score = 1.0;
            const minSafeDist = EvasionRings.config.minSafeDistance || 200;

            // Check MORE points along the path, further out
            const checkDistances = [30, 60, 100, 150, 200, 280, 360, 450, 550];

            for (const checkDist of checkDistances) {
                // Position along this escape path
                const checkX = head.x + Math.cos(angle) * checkDist;
                const checkY = head.y + Math.sin(angle) * checkDist;

                for (const ring of rings) {
                    const distToRing = Utils.distance(checkX, checkY, ring.x, ring.y);
                    const dangerZone = ring.radius + minSafeDist;  // Extended danger zone

                    // v7.1.4: CRITICAL - Any path within minSafeDistance is BAD
                    if (distToRing < minSafeDist) {
                        // EXTREME penalty - this path goes WAY too close
                        score -= 0.8 * ring.threat;
                    } else if (distToRing < ring.radius * 1.5) {
                        // Heavy penalty - inside the ring danger zone
                        const penalty = (1 - distToRing / (ring.radius * 1.5)) * 0.6;
                        score -= penalty * ring.threat;
                    } else if (distToRing < ring.radius * 2.5) {
                        // Medium penalty - too close for comfort
                        const penalty = (1 - distToRing / (ring.radius * 2.5)) * 0.35;
                        score -= penalty * ring.threat;
                    } else if (distToRing < ring.radius * 4) {
                        // Light penalty - in awareness zone
                        const penalty = (1 - distToRing / (ring.radius * 4)) * 0.15;
                        score -= penalty * ring.threat;
                    }

                    // Extra penalty for aggressive snakes - STAY FAR AWAY
                    if (ring.wasAggressive && distToRing < 500) {
                        score -= 0.3 * (ring.aggressionLevel || 0.5);
                    }

                    // Extra penalty for boosting snakes - they can close distance fast
                    if (ring.isBoosting && distToRing < 400) {
                        score -= 0.25;
                    }

                    // Extra penalty if snake is heading toward this escape path
                    const snakeAng = ring.snake ? ring.snake.ang : 0;
                    const angleToEscapePath = Math.atan2(checkY - ring.y, checkX - ring.x);
                    const angleDiff = Math.abs(Utils.angleDiff(snakeAng, angleToEscapePath));
                    if (angleDiff < Math.PI / 3 && distToRing < 400) {
                        // Snake is heading toward where we'd escape to!
                        score -= 0.35 * ring.threat;
                    }

                    // v7.1.4: Predict where snake will be when we reach this point
                    const timeToReach = checkDist / 12;  // Approximate frames
                    const sp = ring.snake ? (ring.snake.sp || 11) : 11;
                    const predictedSnakeX = ring.x + Math.cos(snakeAng) * sp * timeToReach;
                    const predictedSnakeY = ring.y + Math.sin(snakeAng) * sp * timeToReach;
                    const predictedDist = Utils.distance(checkX, checkY, predictedSnakeX, predictedSnakeY);

                    if (predictedDist < minSafeDist) {
                        // We would collide with where the snake will be!
                        score -= 0.5 * ring.threat;
                    }
                }
            }

            // Bonus for directions that lead to more open space
            // (Away from the center of mass of all threats)
            if (rings.length > 0) {
                let avgThreatX = 0, avgThreatY = 0;
                for (const ring of rings) {
                    avgThreatX += ring.x;
                    avgThreatY += ring.y;
                }
                avgThreatX /= rings.length;
                avgThreatY /= rings.length;

                const awayAngle = Math.atan2(head.y - avgThreatY, head.x - avgThreatX);
                const angleDiffFromAway = Math.abs(Utils.angleDiff(angle, awayAngle));

                // Bonus for heading away from threat center
                if (angleDiffFromAway < Math.PI / 2) {
                    score += 0.2 * (1 - angleDiffFromAway / (Math.PI / 2));
                }
            }

            return Math.max(0, Math.min(1, score));
        },

        // Check if a specific angle is blocked
        isAngleBlocked: (angle) => {
            const blocked = EvasionRings.blockedAngles;
            const normalizedAngle = Utils.normalizeAngle(angle);

            for (const seg of blocked) {
                const diff = Utils.normalizeAngle(normalizedAngle - seg.start);
                const segSize = Utils.normalizeAngle(seg.end - seg.start);
                if (diff >= 0 && diff <= segSize) {
                    return true;
                }
            }
            return false;
        },

        // Get total blocked percentage of directions
        getBlockedPercentage: () => {
            let totalBlocked = 0;
            for (const seg of EvasionRings.blockedAngles) {
                totalBlocked += Utils.normalizeAngle(seg.end - seg.start);
            }
            return (totalBlocked / (Math.PI * 2)) * 100;
        },

        // Check if any rings overlap (indicating blocked path between them)
        getRingOverlaps: () => {
            const rings = EvasionRings.rings;
            const overlaps = [];

            for (let i = 0; i < rings.length; i++) {
                for (let j = i + 1; j < rings.length; j++) {
                    const r1 = rings[i];
                    const r2 = rings[j];

                    // Check if angular spans overlap
                    if (EvasionRings.anglesOverlap(r1.startAngle, r1.endAngle, r2.startAngle, r2.endAngle)) {
                        overlaps.push({
                            ring1: r1,
                            ring2: r2,
                            overlapStart: Math.max(r1.startAngle, r2.startAngle),
                            overlapEnd: Math.min(r1.endAngle, r2.endAngle)
                        });
                    }
                }
            }

            return overlaps;
        }
    };

    // ==================== FOOD SEEKING (PRIORITY SYSTEM) ====================
    // MOTTO: ALWAYS BE EATING!
    const FoodSeeker = {
        // Cache for performance
        lastClusterScan: 0,
        cachedClusters: [],
        cachedStrings: [],
        cachedDeadSnakeFood: null,

        // Get food in the EATING RADIUS (200px from mouth)
        getNearbyFood: () => {
            const foods = window.foods;
            if (!foods || !Array.isArray(foods)) return [];

            const snake = window.slither || window.snake;
            if (!snake) return [];

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const currentAngle = snake.ang || 0;

            const nearby = [];
            const eatingRadius = CONFIG.movement.foodSeekRadius; // 200px - tight eating zone

            for (const food of foods) {
                if (!food || food.eaten) continue;

                const fx = food.xx ?? food.x ?? 0;
                const fy = food.yy ?? food.y ?? 0;
                const dist = Utils.distance(headX, headY, fx, fy);
                const size = food.sz ?? food.size ?? 1;

                if (dist < eatingRadius) {
                    // Calculate angle to food
                    const foodAngle = Utils.angle(headX, headY, fx, fy);
                    const angleDiff = Math.abs(Utils.angleDiff(currentAngle, foodAngle));
                    const isInFront = angleDiff < Math.PI / 2; // Within 90 degrees of heading

                    nearby.push({
                        x: fx,
                        y: fy,
                        size: size,
                        dist: dist,
                        angle: foodAngle,
                        isInFront: isInFront,
                        isDeadSnakeFood: size > 8  // Large food = dead snake remains
                    });
                }
            }

            return nearby;
        },

        // DEAD SNAKE FOOD DETECTION - Highest priority!
        // Dead snakes drop LOTS of big food in a cluster/line
        detectDeadSnakeFood: () => {
            const foods = window.foods;
            if (!foods || !Array.isArray(foods)) return null;

            const snake = window.slither || window.snake;
            if (!snake) return null;

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const currentAngle = snake.ang || 0;

            // Scan in wider radius for dead snake food
            const scanRadius = CONFIG.movement.deadSnakeFoodRadius; // 600px

            // Find clusters of BIG food (size > 8 = dead snake remains)
            const bigFoods = [];
            for (const food of foods) {
                if (!food || food.eaten) continue;
                const fx = food.xx ?? food.x ?? 0;
                const fy = food.yy ?? food.y ?? 0;
                const size = food.sz ?? food.size ?? 1;
                const dist = Utils.distance(headX, headY, fx, fy);

                // Big food within scan range
                if (size > 8 && dist < scanRadius) {
                    bigFoods.push({ x: fx, y: fy, size: size, dist: dist });
                }
            }

            if (bigFoods.length < 3) {
                FoodSeeker.cachedDeadSnakeFood = null;
                return null; // Not enough big food to be a dead snake
            }

            // Cluster the big foods to find dead snake remains
            const clusters = [];
            const processed = new Set();
            const clusterRadius = 100; // Big food cluster radius

            for (let i = 0; i < bigFoods.length; i++) {
                if (processed.has(i)) continue;

                const cluster = {
                    foods: [bigFoods[i]],
                    totalSize: bigFoods[i].size,
                    centerX: bigFoods[i].x,
                    centerY: bigFoods[i].y,
                    count: 1
                };
                processed.add(i);

                // Expand cluster
                for (let j = 0; j < bigFoods.length; j++) {
                    if (processed.has(j)) continue;

                    for (const cf of cluster.foods) {
                        if (Utils.distance(bigFoods[j].x, bigFoods[j].y, cf.x, cf.y) < clusterRadius) {
                            cluster.foods.push(bigFoods[j]);
                            cluster.totalSize += bigFoods[j].size;
                            cluster.count++;
                            processed.add(j);
                            break;
                        }
                    }
                }

                // Only count as dead snake if 5+ big foods together
                if (cluster.count >= 5) {
                    // Calculate center
                    let sumX = 0, sumY = 0;
                    for (const f of cluster.foods) {
                        sumX += f.x;
                        sumY += f.y;
                    }
                    cluster.centerX = sumX / cluster.count;
                    cluster.centerY = sumY / cluster.count;
                    cluster.dist = Utils.distance(headX, headY, cluster.centerX, cluster.centerY);

                    // Calculate angle and alignment bonus
                    cluster.angle = Utils.angle(headX, headY, cluster.centerX, cluster.centerY);
                    const alignDiff = Math.abs(Utils.angleDiff(currentAngle, cluster.angle));
                    cluster.alignmentBonus = alignDiff < Math.PI / 3 ? 1.5 : 1.0;

                    // Value = total size * count / distance (with alignment bonus)
                    cluster.value = (cluster.totalSize * Math.sqrt(cluster.count) * cluster.alignmentBonus) / Math.max(cluster.dist, 50);
                    cluster.isDeadSnake = true;

                    clusters.push(cluster);
                }
            }

            if (clusters.length === 0) {
                FoodSeeker.cachedDeadSnakeFood = null;
                return null;
            }

            // Return BEST dead snake food cluster
            clusters.sort((a, b) => b.value - a.value);
            const best = clusters[0];

            FoodSeeker.cachedDeadSnakeFood = {
                x: best.centerX,
                y: best.centerY,
                totalSize: best.totalSize,
                count: best.count,
                dist: best.dist,
                value: best.value,
                angle: best.angle,
                isDeadSnake: true
            };

            return FoodSeeker.cachedDeadSnakeFood;
        },

        // Find ALL food clusters (groups of food close together)
        findFoodClusters: () => {
            const foods = window.foods;
            if (!foods || !Array.isArray(foods)) return [];

            const snake = window.slither || window.snake;
            if (!snake) return [];

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;

            // Scan radius for clusters
            const scanRadius = 800;  // Look far for best clusters

            // Get all food in range
            const foodInRange = [];
            for (const food of foods) {
                if (!food || food.eaten) continue;
                const fx = food.xx ?? food.x ?? 0;
                const fy = food.yy ?? food.y ?? 0;
                const dist = Utils.distance(headX, headY, fx, fy);
                if (dist < scanRadius) {
                    foodInRange.push({
                        x: fx,
                        y: fy,
                        size: food.sz ?? food.size ?? 1,
                        dist: dist,
                        food: food
                    });
                }
            }

            if (foodInRange.length === 0) return [];

            // Cluster food using spatial grouping
            const clusters = [];
            const processed = new Set();
            const clusterRadius = 80;  // Food within 80px = same cluster

            for (const f of foodInRange) {
                if (processed.has(f.food)) continue;

                // Start new cluster
                const cluster = {
                    foods: [f],
                    centerX: f.x,
                    centerY: f.y,
                    totalSize: f.size,
                    count: 1
                };
                processed.add(f.food);

                // Find all food connected to this cluster
                let foundMore = true;
                while (foundMore) {
                    foundMore = false;
                    for (const other of foodInRange) {
                        if (processed.has(other.food)) continue;

                        // Check if close to any food in cluster
                        for (const cf of cluster.foods) {
                            if (Utils.distance(other.x, other.y, cf.x, cf.y) < clusterRadius) {
                                cluster.foods.push(other);
                                cluster.totalSize += other.size;
                                cluster.count++;
                                processed.add(other.food);
                                foundMore = true;
                                break;
                            }
                        }
                    }
                }

                // Calculate cluster center
                let sumX = 0, sumY = 0;
                for (const cf of cluster.foods) {
                    sumX += cf.x;
                    sumY += cf.y;
                }
                cluster.centerX = sumX / cluster.count;
                cluster.centerY = sumY / cluster.count;
                cluster.dist = Utils.distance(headX, headY, cluster.centerX, cluster.centerY);

                // Value score - bigger clusters closer to us are better
                cluster.value = (cluster.totalSize * Math.sqrt(cluster.count)) / Math.max(cluster.dist, 50);
                cluster.density = cluster.totalSize / cluster.count;  // Average food size

                clusters.push(cluster);
            }

            // Sort by VALUE (best clusters first)
            clusters.sort((a, b) => b.value - a.value);

            FoodSeeker.cachedClusters = clusters;
            return clusters;
        },

        // === OPTIMAL FOOD PATH - Don't leave any food behind! ===
        // Find individual food items between clusters and create an optimal collection path
        cachedFoodPath: null,
        lastPathUpdate: 0,

        buildOptimalFoodPath: () => {
            const now = Date.now();
            // Update path every 500ms for performance
            if (now - FoodSeeker.lastPathUpdate < 500 && FoodSeeker.cachedFoodPath) {
                return FoodSeeker.cachedFoodPath;
            }
            FoodSeeker.lastPathUpdate = now;

            const foods = window.foods;
            if (!foods || !Array.isArray(foods)) return null;

            const snake = window.slither || window.snake;
            if (!snake) return null;

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const currentAngle = snake.ang || 0;

            // Get clusters and strings
            const clusters = FoodSeeker.cachedClusters || [];
            const strings = FoodSeeker.cachedStrings || [];

            // Collect all food in path-building radius
            const pathRadius = 400; // Look for food within 400px for path building
            const allFoodInRange = [];

            for (const food of foods) {
                if (!food || food.eaten) continue;
                const fx = food.xx ?? food.x ?? 0;
                const fy = food.yy ?? food.y ?? 0;
                const size = food.sz ?? food.size ?? 1;
                const dist = Utils.distance(headX, headY, fx, fy);

                if (dist < pathRadius) {
                    allFoodInRange.push({
                        x: fx,
                        y: fy,
                        size: size,
                        dist: dist,
                        angle: Math.atan2(fy - headY, fx - headX),
                        inCluster: false,
                        inString: false,
                        pathIncluded: false
                    });
                }
            }

            if (allFoodInRange.length === 0) {
                FoodSeeker.cachedFoodPath = null;
                return null;
            }

            // Mark food that's already in clusters
            for (const cluster of clusters) {
                if (!cluster.foods) continue;
                for (const cf of cluster.foods) {
                    const match = allFoodInRange.find(f =>
                        Math.abs(f.x - cf.x) < 5 && Math.abs(f.y - cf.y) < 5);
                    if (match) match.inCluster = true;
                }
            }

            // Mark food that's already in strings
            for (const string of strings) {
                if (!string.foods) continue;
                for (const sf of string.foods) {
                    const match = allFoodInRange.find(f =>
                        Math.abs(f.x - sf.x) < 5 && Math.abs(f.y - sf.y) < 5);
                    if (match) match.inString = true;
                }
            }

            // Find INDIVIDUAL food (not in clusters or strings)
            const individualFood = allFoodInRange.filter(f => !f.inCluster && !f.inString);

            // Build optimal path using greedy nearest-neighbor with angle consideration
            const pathPoints = [];
            let currentX = headX;
            let currentY = headY;
            let currentAng = currentAngle;

            // Start with closest food in front of us
            const inFrontFood = individualFood.filter(f => {
                const angleDiff = Math.abs(Utils.angleDiff(currentAngle, f.angle));
                return angleDiff < Math.PI / 2 && f.dist < 150;
            });

            // If we have a target cluster/string, find food ALONG THE WAY to it
            const currentTarget = FoodSeeker.currentTarget;
            let targetX = currentX + Math.cos(currentAngle) * 200;
            let targetY = currentY + Math.sin(currentAngle) * 200;

            if (currentTarget) {
                targetX = currentTarget.x;
                targetY = currentTarget.y;
            }

            // Find food along the path to target
            const pathDirection = Math.atan2(targetY - headY, targetX - headX);
            const pathLength = Utils.distance(headX, headY, targetX, targetY);

            // Score food by how well they fit into our path
            const scoredFood = individualFood.map(f => {
                // Distance from the direct path line
                const toFoodAngle = Math.atan2(f.y - headY, f.x - headX);
                const angleFromPath = Math.abs(Utils.angleDiff(pathDirection, toFoodAngle));

                // How far along the path is this food?
                const projectedDist = f.dist * Math.cos(angleFromPath);

                // Perpendicular distance from path
                const perpDist = Math.abs(f.dist * Math.sin(angleFromPath));

                // Score: prefer food close to path, not too far ahead, good size
                const pathScore = f.size / Math.max(perpDist, 10) * (projectedDist > 0 ? 1.5 : 0.5);

                return {
                    ...f,
                    perpDist: perpDist,
                    projectedDist: projectedDist,
                    pathScore: pathScore,
                    reachable: perpDist < 60 && projectedDist > 0 && projectedDist < pathLength
                };
            });

            // Sort by path score
            scoredFood.sort((a, b) => b.pathScore - a.pathScore);

            // Build path: nearest food that doesn't deviate too much from direction
            const maxDeviation = 50; // Max pixels to deviate from path
            const remainingFood = [...scoredFood];
            let totalPathValue = 0;
            let pathTotalDist = 0;

            // Greedy path building
            while (remainingFood.length > 0 && pathPoints.length < 20) {
                // Find best next food considering distance and deviation
                let bestIdx = -1;
                let bestScore = -Infinity;

                for (let i = 0; i < remainingFood.length; i++) {
                    const f = remainingFood[i];
                    const distFromCurrent = Utils.distance(currentX, currentY, f.x, f.y);

                    // Skip if too far or too much deviation
                    if (distFromCurrent > 150) continue;
                    if (f.perpDist > maxDeviation && !f.reachable) continue;

                    // Score based on: close to us + on our path + food value
                    const score = f.size / Math.max(distFromCurrent, 20) +
                                  (f.reachable ? 2 : 0) +
                                  (f.perpDist < 30 ? 1 : 0);

                    if (score > bestScore) {
                        bestScore = score;
                        bestIdx = i;
                    }
                }

                if (bestIdx === -1) break;

                const nextFood = remainingFood.splice(bestIdx, 1)[0];
                pathPoints.push({
                    x: nextFood.x,
                    y: nextFood.y,
                    size: nextFood.size,
                    dist: Utils.distance(currentX, currentY, nextFood.x, nextFood.y),
                    reachable: nextFood.reachable,
                    perpDist: nextFood.perpDist
                });

                totalPathValue += nextFood.size;
                pathTotalDist += Utils.distance(currentX, currentY, nextFood.x, nextFood.y);

                currentX = nextFood.x;
                currentY = nextFood.y;
            }

            // Calculate path efficiency
            const pathEfficiency = pathPoints.length > 0 ?
                totalPathValue / Math.max(pathTotalDist, 1) : 0;

            const foodPath = {
                points: pathPoints,
                totalValue: totalPathValue,
                totalDistance: pathTotalDist,
                efficiency: pathEfficiency,
                individualCount: individualFood.length,
                includedCount: pathPoints.length,
                targetX: targetX,
                targetY: targetY
            };

            FoodSeeker.cachedFoodPath = foodPath;

            // Log path info (throttled)
            if (pathPoints.length > 0 && Date.now() % 3000 < 50) {
                DEBUG && console.log(`%c🛤️ FOOD PATH: ${pathPoints.length}/${individualFood.length} food, value: ${totalPathValue.toFixed(0)}, efficiency: ${pathEfficiency.toFixed(2)}`,
                    'color: #00aaff; font-size: 11px;');
            }

            return foodPath;
        },

        // Get angle to next food on optimal path
        getPathFoodAngle: () => {
            const path = FoodSeeker.buildOptimalFoodPath();
            if (!path || path.points.length === 0) return null;

            const snake = window.slither || window.snake;
            if (!snake) return null;

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;

            // Find closest food on path that we haven't passed yet
            for (const point of path.points) {
                const dist = Utils.distance(headX, headY, point.x, point.y);
                if (dist > 15) { // Not eaten yet
                    return Math.atan2(point.y - headY, point.x - headX);
                }
            }

            return null;
        },

        // Find FOOD STRINGS/LINES (most efficient way to eat!)
        // These are lines of food - follow them to eat MANY at once!
        // ENHANCED: Better detection, value calculation, and multi-line monitoring
        findFoodStrings: () => {
            const foods = window.foods;
            if (!foods || !Array.isArray(foods)) return [];

            const snake = window.slither || window.snake;
            if (!snake) return [];

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const currentAngle = snake.ang || 0;
            const snakeSpeed = snake.sp || 11;

            // Get all food in range - INCREASED scan radius for better detection
            const scanRadius = 600; // Increased from 400 for better string detection
            const foodInRange = [];
            for (const food of foods) {
                if (!food || food.eaten) continue;
                const fx = food.xx ?? food.x ?? 0;
                const fy = food.yy ?? food.y ?? 0;
                const dist = Utils.distance(headX, headY, fx, fy);
                if (dist < scanRadius) {
                    const sz = food.sz ?? food.size ?? 1;
                    foodInRange.push({
                        x: fx,
                        y: fy,
                        size: sz,
                        dist: dist,
                        angle: Math.atan2(fy - headY, fx - headX)
                    });
                }
            }

            if (foodInRange.length < 3) return [];

            // Find strings by looking for food that forms LINES
            // ENHANCED: Use multiple algorithms for better detection
            const strings = [];
            const processed = new Set();
            const stringMaxGap = 60;  // Increased from 50 for better chain detection

            // Sort food by distance for better string detection
            foodInRange.sort((a, b) => a.dist - b.dist);

            // === ALGORITHM 1: Direction-based string building ===
            for (let i = 0; i < foodInRange.length; i++) {
                const start = foodInRange[i];
                if (processed.has(i)) continue;

                // Try building strings in 16 directions (more granular)
                let bestString = null;

                for (let dirIdx = 0; dirIdx < 16; dirIdx++) {
                    const testAngle = (dirIdx * Math.PI / 8);

                    const string = {
                        foods: [start],
                        totalSize: start.size,
                        startX: start.x,
                        startY: start.y,
                        endX: start.x,
                        endY: start.y,
                        id: `str_${i}_${dirIdx}`
                    };
                    const localProcessed = new Set([i]);

                    let lastFood = start;
                    let stringDirection = testAngle;
                    let totalAngleChange = 0;

                    // Extend in this direction - allow longer chains
                    for (let iter = 0; iter < 40; iter++) {
                        let bestNext = null;
                        let bestDist = stringMaxGap;
                        let bestIdx = -1;
                        let bestAngleChange = Math.PI;

                        for (let j = 0; j < foodInRange.length; j++) {
                            if (localProcessed.has(j)) continue;
                            const candidate = foodInRange[j];
                            const d = Utils.distance(lastFood.x, lastFood.y, candidate.x, candidate.y);

                            if (d < bestDist && d > 5) { // Min distance to avoid duplicates
                                // Check if direction is consistent
                                const newDir = Math.atan2(candidate.y - lastFood.y, candidate.x - lastFood.x);
                                const dirDiff = Math.abs(Utils.angleDiff(stringDirection, newDir));

                                // Allow slight bends (increased from PI/4 to PI/3 for curved strings)
                                if (dirDiff < Math.PI / 3) {
                                    // Prefer food that maintains direction better
                                    if (dirDiff < bestAngleChange) {
                                        bestNext = candidate;
                                        bestDist = d;
                                        bestIdx = j;
                                        bestAngleChange = dirDiff;
                                    }
                                }
                            }
                        }

                        if (bestNext) {
                            const newDir = Math.atan2(bestNext.y - lastFood.y, bestNext.x - lastFood.x);
                            totalAngleChange += bestAngleChange;
                            stringDirection = newDir; // Update direction as we go
                            string.foods.push(bestNext);
                            string.totalSize += bestNext.size;
                            string.endX = bestNext.x;
                            string.endY = bestNext.y;
                            localProcessed.add(bestIdx);
                            lastFood = bestNext;
                        } else {
                            break;
                        }
                    }

                    // Calculate string straightness (penalize very curvy strings)
                    const straightness = string.foods.length > 1 ?
                        1 - (totalAngleChange / (string.foods.length * Math.PI)) : 1;
                    string.straightness = Math.max(0.3, straightness);

                    // Keep the best string (longest with good straightness)
                    if (!bestString ||
                        (string.foods.length * string.straightness) >
                        (bestString.foods.length * bestString.straightness)) {
                        bestString = string;
                    }
                }

                // Only keep strings with 3+ food items (lowered from 4)
                if (bestString && bestString.foods.length >= 3) {
                    // Mark all foods in this string as processed
                    for (const f of bestString.foods) {
                        const idx = foodInRange.findIndex(fr =>
                            Math.abs(fr.x - f.x) < 1 && Math.abs(fr.y - f.y) < 1);
                        if (idx >= 0) processed.add(idx);
                    }

                    bestString.length = bestString.foods.length;
                    bestString.direction = Math.atan2(
                        bestString.endY - bestString.startY,
                        bestString.endX - bestString.startX
                    );

                    // Calculate actual line length in pixels
                    bestString.lineLength = Utils.distance(
                        bestString.startX, bestString.startY,
                        bestString.endX, bestString.endY
                    );

                    // Calculate food density (food per pixel of line)
                    bestString.density = bestString.length / Math.max(bestString.lineLength, 1);

                    // Calculate which end is closer to us
                    const distToStart = Utils.distance(headX, headY, bestString.startX, bestString.startY);
                    const distToEnd = Utils.distance(headX, headY, bestString.endX, bestString.endY);

                    if (distToEnd < distToStart) {
                        // Reverse so we approach from the close end
                        [bestString.startX, bestString.endX] = [bestString.endX, bestString.startX];
                        [bestString.startY, bestString.endY] = [bestString.endY, bestString.startY];
                        bestString.foods.reverse();
                        bestString.direction = Math.atan2(
                            bestString.endY - bestString.startY,
                            bestString.endX - bestString.startX
                        );
                    }

                    bestString.dist = Math.min(distToStart, distToEnd);

                    // === OPTIMIZED PATH VALUE CALCULATION ===
                    // GOAL: Most food in shortest path and time!
                    //
                    // Key metrics:
                    // 1. FOOD PER SECOND (FPS) - How fast can we eat this string?
                    // 2. FOOD PER PIXEL (FPP) - How dense is the food along the path?
                    // 3. PATH EFFICIENCY - Total food / total distance traveled (including reach)
                    // 4. ALIGNMENT COST - How much time lost turning to reach?
                    // 5. OPPORTUNITY COST - Could we eat more food going elsewhere?

                    // Calculate alignment and turning cost
                    const angleToStart = Math.atan2(bestString.startY - headY, bestString.startX - headX);
                    const turnAngleToReach = Math.abs(Utils.angleDiff(currentAngle, angleToStart));
                    const turnAngleToFollow = Math.abs(Utils.angleDiff(angleToStart, bestString.direction));
                    const totalTurnAngle = turnAngleToReach + turnAngleToFollow;

                    // Turn time estimate (snake turns at roughly 3 rad/sec at full speed)
                    const turnRate = 3.0; // radians per second
                    const turnTime = totalTurnAngle / turnRate;

                    // Distance metrics
                    const reachDistance = bestString.dist;
                    const eatDistance = bestString.lineLength;
                    const totalPathDistance = reachDistance + eatDistance;

                    // Time calculations (snake speed is typically ~11 units, scaled by 5 for pixels/sec)
                    const pixelsPerSecond = snakeSpeed * 5;
                    const reachTime = reachDistance / pixelsPerSecond;
                    const eatTime = eatDistance / pixelsPerSecond;
                    const totalTime = reachTime + eatTime + turnTime;

                    bestString.reachTime = reachTime;
                    bestString.eatTime = eatTime;
                    bestString.turnTime = turnTime;
                    bestString.totalTime = totalTime;
                    bestString.totalPathDistance = totalPathDistance;

                    // === PRIMARY METRIC: Food Per Second (FPS) ===
                    // This is the KEY metric - how much food do we get per second of time invested?
                    bestString.foodPerSecond = bestString.totalSize / Math.max(totalTime, 0.1);

                    // === SECONDARY METRIC: Food Per Pixel (FPP) ===
                    // How much food per pixel of total travel (including reaching the string)?
                    bestString.foodPerPixel = bestString.totalSize / Math.max(totalPathDistance, 1);

                    // === TERTIARY METRIC: Item Efficiency ===
                    // More items = more efficient (each food picked up instantly)
                    bestString.itemsPerSecond = bestString.length / Math.max(totalTime, 0.1);

                    // Alignment bonus (prefer strings we can reach and follow without turning much)
                    const alignmentScore =
                        turnAngleToReach < Math.PI / 8 ? 2.0 :    // Almost no turn to reach
                        turnAngleToReach < Math.PI / 4 ? 1.6 :    // Small turn
                        turnAngleToReach < Math.PI / 2 ? 1.2 :    // Moderate turn
                        turnAngleToReach < Math.PI * 0.75 ? 0.8 : // Large turn
                        0.5;                                       // Behind us

                    // Direction alignment (does string go the way we're heading?)
                    const directionScore =
                        turnAngleToFollow < Math.PI / 6 ? 1.5 :   // String goes our way
                        turnAngleToFollow < Math.PI / 3 ? 1.2 :   // Mostly our way
                        turnAngleToFollow < Math.PI / 2 ? 1.0 :   // Perpendicular-ish
                        0.7;                                       // Opposite direction

                    bestString.alignmentBonus = alignmentScore * directionScore;

                    // === FINAL VALUE SCORE ===
                    // Optimized for: MOST FOOD in SHORTEST PATH and TIME
                    //
                    // Formula prioritizes:
                    // 1. High food per second (time efficiency)
                    // 2. High food per pixel (path efficiency)
                    // 3. Good alignment (less turning = faster)
                    // 4. Shorter reach distance (closer strings preferred)
                    // 5. Straightness (easier to follow)

                    const distancePenalty = Math.max(1, reachDistance / 50); // Penalty for far strings

                    bestString.value = (
                        bestString.foodPerSecond * 10 +      // Time efficiency (primary)
                        bestString.foodPerPixel * 500 +      // Path efficiency (secondary)
                        bestString.itemsPerSecond * 5 +      // Item collection rate
                        bestString.density * 50              // Density bonus
                    ) * bestString.alignmentBonus            // Alignment multiplier
                      * bestString.straightness              // Straightness multiplier
                      / distancePenalty;                     // Distance penalty

                    // Bonus for being in front of us (can start eating immediately)
                    bestString.isInFront = turnAngleToReach < Math.PI / 2;
                    if (bestString.isInFront) {
                        bestString.value *= 1.3;
                    }

                    // Bonus for strings that align with our current trajectory
                    if (turnAngleToReach < Math.PI / 6 && turnAngleToFollow < Math.PI / 6) {
                        // Perfect alignment - almost no turning needed!
                        bestString.value *= 1.5;
                        bestString.perfectAlign = true;
                    }

                    // === RISK/REWARD CALCULATION FOR STRING ===
                    // This will be shown in the string list window
                    const riskScore = bestString.threatLevel || 0;
                    const riskMultiplier = 1 - riskScore * 0.7;
                    const rewardScore = bestString.totalSize * Math.sqrt(bestString.length);
                    const adjustedScore = rewardScore * riskMultiplier / Math.max(distancePenalty, 1);

                    bestString.riskReward = {
                        reward: rewardScore,
                        risk: riskScore,
                        adjusted: adjustedScore,
                        ratio: riskScore > 0.1 ? rewardScore / (riskScore * 100) : rewardScore,
                        riskLevel: riskScore < 0.2 ? 'LOW' : riskScore < 0.5 ? 'MED' : riskScore < 0.7 ? 'HIGH' : 'CRIT',
                        display: `R:${rewardScore.toFixed(0)} | Risk:${(riskScore * 100).toFixed(0)}%`
                    };

                    strings.push(bestString);
                }
            }

            // Sort by value (best = most food in shortest path/time)
            strings.sort((a, b) => b.value - a.value);

            // === PARALLEL VIGILANCE: Check threats for each string path ===
            // Mark strings that have threats along their path
            for (const string of strings) {
                string.threatLevel = FoodSeeker.assessPathThreat(string.startX, string.startY, string.endX, string.endY);
                string.isSafe = string.threatLevel < 0.3;

                // Penalize unsafe strings heavily
                if (!string.isSafe) {
                    string.value *= (1 - string.threatLevel * 0.8); // Reduce value based on threat
                }
            }

            // Re-sort after threat assessment
            strings.sort((a, b) => b.value - a.value);

            // Assign ranks for visualization
            strings.forEach((s, idx) => {
                s.rank = idx + 1;
                s.isActive = idx === 0; // Best string is active
            });

            // Store all strings for multi-line monitoring
            FoodSeeker.cachedStrings = strings;
            FoodSeeker.allMonitoredStrings = strings.slice(0, 8); // Monitor top 8 strings

            // Log string detection (throttled)
            if (strings.length > 0 && Date.now() % 2000 < 50) {
                const best = strings[0];
                const safeIcon = best.isSafe ? '✓' : '⚠️';
                DEBUG && console.log(`%c🔗 FOOD STRINGS: ${strings.length} detected | Best: ${best.length} food, ${best.foodPerSecond?.toFixed(1) || '?'}f/s ${safeIcon}`,
                    'color: #00ff88; font-size: 11px;');
            }

            return strings;
        },

        // Track all monitored strings for visualization
        allMonitoredStrings: [],

        // === CONNECTED FOOD NETWORKS ===
        // Find strings and clusters that are connected (forming larger food networks)
        connectedNetworks: [],
        activeNetwork: null,

        buildFoodNetworks: () => {
            const strings = FoodSeeker.cachedStrings || [];
            const clusters = FoodSeeker.cachedClusters || [];

            if (strings.length === 0 && clusters.length === 0) {
                FoodSeeker.connectedNetworks = [];
                return [];
            }

            const snake = window.slither || window.snake;
            if (!snake) return [];

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const snakeSpeed = snake.sp || 11;

            // Connection radius - how close strings/clusters need to be to connect
            const connectionRadius = 120;

            // Build nodes from strings and clusters
            const nodes = [];

            // Add strings as nodes
            for (const string of strings) {
                nodes.push({
                    type: 'string',
                    id: string.id || `str_${nodes.length}`,
                    x: string.startX,
                    y: string.startY,
                    endX: string.endX,
                    endY: string.endY,
                    value: string.totalSize,
                    count: string.length,
                    data: string,
                    connected: []
                });
            }

            // Add clusters as nodes
            for (let i = 0; i < clusters.length; i++) {
                const cluster = clusters[i];
                nodes.push({
                    type: 'cluster',
                    id: `cluster_${i}`,
                    x: cluster.centerX,
                    y: cluster.centerY,
                    value: cluster.totalSize,
                    count: cluster.count,
                    data: cluster,
                    connected: []
                });
            }

            // Find connections between nodes
            for (let i = 0; i < nodes.length; i++) {
                const nodeA = nodes[i];
                for (let j = i + 1; j < nodes.length; j++) {
                    const nodeB = nodes[j];

                    // Check if nodes are connected (close enough)
                    let minDist = Infinity;

                    // For strings, check both ends
                    const pointsA = nodeA.type === 'string' ?
                        [{x: nodeA.x, y: nodeA.y}, {x: nodeA.endX, y: nodeA.endY}] :
                        [{x: nodeA.x, y: nodeA.y}];
                    const pointsB = nodeB.type === 'string' ?
                        [{x: nodeB.x, y: nodeB.y}, {x: nodeB.endX, y: nodeB.endY}] :
                        [{x: nodeB.x, y: nodeB.y}];

                    for (const pA of pointsA) {
                        for (const pB of pointsB) {
                            const dist = Utils.distance(pA.x, pA.y, pB.x, pB.y);
                            minDist = Math.min(minDist, dist);
                        }
                    }

                    if (minDist < connectionRadius) {
                        nodeA.connected.push(nodeB.id);
                        nodeB.connected.push(nodeA.id);
                    }
                }
            }

            // Build networks using connected component algorithm
            const visited = new Set();
            const networks = [];

            for (const startNode of nodes) {
                if (visited.has(startNode.id)) continue;

                // BFS to find all connected nodes
                const network = {
                    nodes: [],
                    strings: [],
                    clusters: [],
                    totalValue: 0,
                    totalCount: 0,
                    centerX: 0,
                    centerY: 0,
                    entryPoint: null,
                    exitPoint: null,
                    path: [],
                    riskReward: null
                };

                const queue = [startNode];
                while (queue.length > 0) {
                    const node = queue.shift();
                    if (visited.has(node.id)) continue;
                    visited.add(node.id);

                    network.nodes.push(node);
                    network.totalValue += node.value;
                    network.totalCount += node.count;

                    if (node.type === 'string') {
                        network.strings.push(node.data);
                    } else {
                        network.clusters.push(node.data);
                    }

                    // Add connected nodes to queue
                    for (const connId of node.connected) {
                        const connNode = nodes.find(n => n.id === connId);
                        if (connNode && !visited.has(connNode.id)) {
                            queue.push(connNode);
                        }
                    }
                }

                // Calculate network center
                let sumX = 0, sumY = 0;
                for (const node of network.nodes) {
                    sumX += node.x;
                    sumY += node.y;
                }
                network.centerX = sumX / network.nodes.length;
                network.centerY = sumY / network.nodes.length;

                // Find entry point (closest node to snake head)
                let closestDist = Infinity;
                for (const node of network.nodes) {
                    const dist = Utils.distance(headX, headY, node.x, node.y);
                    if (dist < closestDist) {
                        closestDist = dist;
                        network.entryPoint = node;
                    }
                }
                network.dist = closestDist;

                // Calculate RISK/REWARD for the network
                network.riskReward = FoodSeeker.calculateRiskReward(network, headX, headY, snakeSpeed);

                // Build optimal path through the network
                network.path = FoodSeeker.buildNetworkPath(network, headX, headY);

                networks.push(network);
            }

            // Sort by risk-adjusted value (best networks first)
            networks.sort((a, b) => (b.riskReward?.adjustedValue || 0) - (a.riskReward?.adjustedValue || 0));

            // Mark the best network as active
            if (networks.length > 0) {
                networks[0].isActive = true;
                FoodSeeker.activeNetwork = networks[0];
            }

            FoodSeeker.connectedNetworks = networks;
            return networks;
        },

        // === RISK/REWARD CALCULATION ===
        calculateRiskReward: (network, headX, headY, snakeSpeed) => {
            // REWARD factors
            const totalFood = network.totalValue;
            const foodCount = network.totalCount;
            const density = foodCount > 0 ? totalFood / Math.max(network.nodes.length, 1) : 0;

            // Time to consume (estimated)
            const distToEntry = network.dist || Utils.distance(headX, headY, network.centerX, network.centerY);
            const networkSpread = 0; // Will calculate from path
            let pathLength = distToEntry;

            // Estimate path length through network
            for (let i = 0; i < network.nodes.length - 1; i++) {
                const nodeA = network.nodes[i];
                const nodeB = network.nodes[i + 1];
                pathLength += Utils.distance(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
            }

            const pixelsPerSecond = snakeSpeed * 5;
            const timeToConsume = pathLength / pixelsPerSecond;

            // RISK factors
            const pathThreat = FoodSeeker.assessPathThreat(headX, headY, network.centerX, network.centerY);
            let networkThreat = pathThreat;

            // Check threats at network location
            for (const node of network.nodes) {
                const nodeThreat = FoodSeeker.assessPathThreat(node.x, node.y, node.endX || node.x, node.endY || node.y);
                networkThreat = Math.max(networkThreat, nodeThreat);
            }

            // Risk score (0 = safe, 1 = very dangerous)
            const riskScore = Math.min(1, networkThreat * 1.2);

            // Food per second (raw efficiency)
            const foodPerSecond = totalFood / Math.max(timeToConsume, 0.1);

            // Risk-adjusted value
            const riskMultiplier = 1 - riskScore * 0.7; // Reduce value by up to 70% for risky networks
            const adjustedValue = foodPerSecond * riskMultiplier * Math.sqrt(foodCount);

            // Calculate reward/risk ratio
            const rewardRiskRatio = riskScore > 0.1 ? totalFood / (riskScore * 100) : totalFood;

            return {
                // Reward metrics
                totalFood: totalFood,
                foodCount: foodCount,
                density: density,
                foodPerSecond: foodPerSecond,
                timeToConsume: timeToConsume,
                pathLength: pathLength,

                // Risk metrics
                pathThreat: pathThreat,
                networkThreat: networkThreat,
                riskScore: riskScore,
                riskLevel: riskScore < 0.2 ? 'LOW' : riskScore < 0.5 ? 'MEDIUM' : riskScore < 0.7 ? 'HIGH' : 'CRITICAL',

                // Combined metrics
                adjustedValue: adjustedValue,
                rewardRiskRatio: rewardRiskRatio,
                efficiency: totalFood / Math.max(pathLength, 1),

                // Display string
                display: `${totalFood.toFixed(0)}🍕 | ${foodPerSecond.toFixed(1)}f/s | Risk: ${(riskScore * 100).toFixed(0)}%`
            };
        },

        // Build optimal path through a food network
        buildNetworkPath: (network, headX, headY) => {
            const path = [];
            if (!network.entryPoint) return path;

            // Start from entry point
            const visited = new Set();
            let current = network.entryPoint;
            path.push({
                x: current.x,
                y: current.y,
                type: current.type,
                node: current
            });
            visited.add(current.id);

            // For strings, add end point
            if (current.type === 'string' && current.endX && current.endY) {
                path.push({
                    x: current.endX,
                    y: current.endY,
                    type: 'string-end',
                    node: current
                });
            }

            // Greedy nearest neighbor through remaining nodes
            let lastX = current.endX || current.x;
            let lastY = current.endY || current.y;

            while (visited.size < network.nodes.length) {
                let nearestNode = null;
                let nearestDist = Infinity;

                for (const node of network.nodes) {
                    if (visited.has(node.id)) continue;

                    const dist = Utils.distance(lastX, lastY, node.x, node.y);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestNode = node;
                    }
                }

                if (nearestNode) {
                    visited.add(nearestNode.id);
                    path.push({
                        x: nearestNode.x,
                        y: nearestNode.y,
                        type: nearestNode.type,
                        node: nearestNode
                    });

                    if (nearestNode.type === 'string' && nearestNode.endX && nearestNode.endY) {
                        path.push({
                            x: nearestNode.endX,
                            y: nearestNode.endY,
                            type: 'string-end',
                            node: nearestNode
                        });
                        lastX = nearestNode.endX;
                        lastY = nearestNode.endY;
                    } else {
                        lastX = nearestNode.x;
                        lastY = nearestNode.y;
                    }
                } else {
                    break;
                }
            }

            return path;
        },

        // === PARALLEL VIGILANCE: Assess threat level along a path ===
        assessPathThreat: (startX, startY, endX, endY) => {
            const snake = window.slither || window.snake;
            if (!snake) return 0;

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const snakesArr = window.slithers || window.snakes || [];

            let maxThreat = 0;

            // Check points along the path
            const pathLength = Utils.distance(startX, startY, endX, endY);
            const checkPoints = Math.max(3, Math.floor(pathLength / 50));

            for (let i = 0; i <= checkPoints; i++) {
                const t = i / checkPoints;
                const checkX = startX + (endX - startX) * t;
                const checkY = startY + (endY - startY) * t;

                // Also check the path TO the start point
                if (i === 0) {
                    const reachPath = FoodSeeker.checkPathForThreats(headX, headY, startX, startY, snakesArr, snake);
                    maxThreat = Math.max(maxThreat, reachPath);
                }

                // Check this point for nearby threats
                for (const s of snakesArr) {
                    if (!s || s === snake || s.dead || s.dying) continue;

                    const sx = s.xx || s.x;
                    const sy = s.yy || s.y;
                    const dist = Utils.distance(checkX, checkY, sx, sy);

                    // Head threat
                    if (dist < 150) {
                        const threat = 1 - (dist / 150);
                        maxThreat = Math.max(maxThreat, threat * 0.8);
                    }

                    // Body segments threat
                    const segments = SnakeDetector.getSnakeSegments ? SnakeDetector.getSnakeSegments(s) : [];
                    for (const seg of segments.slice(0, 20)) { // Check first 20 segments
                        const segDist = Utils.distance(checkX, checkY, seg.x, seg.y);
                        if (segDist < 80) {
                            const threat = 1 - (segDist / 80);
                            maxThreat = Math.max(maxThreat, threat * 0.5);
                        }
                    }
                }
            }

            return Math.min(1, maxThreat);
        },

        // Check a straight path for threats
        checkPathForThreats: (x1, y1, x2, y2, snakesArr, mySnake) => {
            const pathLength = Utils.distance(x1, y1, x2, y2);
            const steps = Math.max(2, Math.floor(pathLength / 40));
            let maxThreat = 0;

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const px = x1 + (x2 - x1) * t;
                const py = y1 + (y2 - y1) * t;

                for (const s of snakesArr) {
                    if (!s || s === mySnake || s.dead || s.dying) continue;

                    const hx = s.xx || s.x;
                    const hy = s.yy || s.y;
                    const headDist = Utils.distance(px, py, hx, hy);

                    if (headDist < 120) {
                        maxThreat = Math.max(maxThreat, 1 - headDist / 120);
                    }
                }
            }

            return maxThreat;
        },

        // === PARALLEL VIGILANCE: Get current immediate threat level ===
        // This runs constantly to keep us aware while eating
        getCurrentThreatLevel: () => {
            const snake = window.slither || window.snake;
            if (!snake) return 0;

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const currentAngle = snake.ang || 0;
            const snakesArr = window.slithers || window.snakes || [];

            let maxThreat = 0;
            let threatCount = 0;

            for (const s of snakesArr) {
                if (!s || s === snake || s.dead || s.dying) continue;

                const sx = s.xx || s.x;
                const sy = s.yy || s.y;
                const sang = s.ang || 0;
                const dist = Utils.distance(headX, headY, sx, sy);

                // Close heads are dangerous
                if (dist < 200) {
                    // Check if they're heading toward us
                    const angleToUs = Math.atan2(headY - sy, headX - sx);
                    const theirAngleDiff = Math.abs(Utils.angleDiff(sang, angleToUs));

                    // Threat is higher if they're heading toward us
                    const headingThreat = theirAngleDiff < Math.PI / 3 ? 1.0 :
                                          theirAngleDiff < Math.PI / 2 ? 0.6 : 0.3;

                    const distThreat = 1 - (dist / 200);
                    const threat = distThreat * headingThreat;

                    if (threat > 0.2) {
                        threatCount++;
                        maxThreat = Math.max(maxThreat, threat);
                    }
                }

                // Check if they're trying to cut us off (body in front)
                const segments = SnakeDetector.getSnakeSegments ? SnakeDetector.getSnakeSegments(s) : [];
                for (const seg of segments.slice(0, 15)) {
                    const segDist = Utils.distance(headX, headY, seg.x, seg.y);
                    if (segDist < 100) {
                        // Check if segment is in front of us
                        const angleToSeg = Math.atan2(seg.y - headY, seg.x - headX);
                        const inFrontDiff = Math.abs(Utils.angleDiff(currentAngle, angleToSeg));

                        if (inFrontDiff < Math.PI / 3) { // In front of us
                            const threat = (1 - segDist / 100) * 0.7;
                            maxThreat = Math.max(maxThreat, threat);
                            threatCount++;
                            break;
                        }
                    }
                }
            }

            // Multiple threats compound the danger
            if (threatCount >= 2) {
                maxThreat = Math.min(1, maxThreat * 1.3);
            }
            if (threatCount >= 3) {
                maxThreat = Math.min(1, maxThreat * 1.2);
            }

            // Store for visualization
            FoodSeeker.lastThreatLevel = maxThreat;
            FoodSeeker.lastThreatCount = threatCount;

            return maxThreat;
        },

        // Last threat level for visualization
        lastThreatLevel: 0,
        lastThreatCount: 0,

        // Check how dangerous a food location is based on nearby enemy snake bodies
        // Returns danger score 0-1 (0 = safe, 1 = very dangerous)
        getFoodDanger: (foodX, foodY) => {
            const snake = window.slither || window.snake;
            if (!snake) return 0;

            const snakesArr = window.slithers || window.snakes || [];
            let maxDanger = 0;
            let nearbyBodies = 0;

            const dangerRadius = 150;  // Check for snake bodies within this radius of food
            const criticalRadius = 80;  // Very close = high danger

            for (const s of snakesArr) {
                if (!s || s === snake || s.dead || s.dying) continue;

                // Check enemy head distance to food
                const headX = s.xx || s.x || 0;
                const headY = s.yy || s.y || 0;
                const headDist = Utils.distance(foodX, foodY, headX, headY);

                if (headDist < criticalRadius) {
                    maxDanger = Math.max(maxDanger, 1.0);  // Head very close = MAX danger!
                    nearbyBodies++;
                } else if (headDist < dangerRadius) {
                    maxDanger = Math.max(maxDanger, 0.7);
                    nearbyBodies++;
                }

                // Check enemy body segments near the food
                const segments = SnakeDetector.getSnakeSegments(s);
                for (const seg of segments) {
                    const segDist = Utils.distance(foodX, foodY, seg.x, seg.y);

                    if (segDist < criticalRadius) {
                        maxDanger = Math.max(maxDanger, 0.9);  // Body very close
                        nearbyBodies++;
                        break;  // One segment is enough to mark this food as dangerous
                    } else if (segDist < dangerRadius) {
                        maxDanger = Math.max(maxDanger, 0.5);
                        nearbyBodies++;
                        break;
                    }
                }
            }

            // Multiple snake bodies nearby = extra dangerous
            if (nearbyBodies >= 2) maxDanger = Math.min(1.0, maxDanger + 0.2);
            if (nearbyBodies >= 3) maxDanger = 1.0;  // 3+ bodies = definitely avoid!

            return maxDanger;
        },

        // Check if food location is safe enough to pursue
        isFoodSafe: (foodX, foodY, minSafetyThreshold = 0.6) => {
            const danger = FoodSeeker.getFoodDanger(foodX, foodY);
            return danger < minSafetyThreshold;
        },

        // Get the BEST food target (PRIORITY: Dead Snake > Strings > Clusters > Single)
        // "ALWAYS BE EATING" with PARALLEL VIGILANCE!
        // NOW with snake body proximity check - choose less dangerous food!
        getBestFoodTarget: () => {
            // === v7.1: DANGER LOCKOUT - Return null immediately if danger detected ===
            if (STATE.dangerLockout) {
                if (Date.now() % 2000 < 50) {
                    DEBUG && console.log(`%c🔒 FoodSeeker: LOCKOUT - Not seeking food (${STATE.currentDangerSource})`,
                        'color: #ff6600; font-size: 11px;');
                }
                return null;  // No food seeking during danger
            }

            const snake = window.slither || window.snake;
            if (!snake) return null;

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const currentAngle = snake.ang || 0;

            // === EDGE SAFETY CHECK ===
            // Don't seek food that's near the map edge!
            const mapRadius = typeof window.grd !== 'undefined' ? window.grd : 21600;
            const mapCenterX = mapRadius;
            const mapCenterY = mapRadius;
            const headDistFromEdge = mapRadius - Utils.distance(headX, headY, mapCenterX, mapCenterY);

            // Helper to check if target is safe from edge
            const isTargetSafeFromEdge = (targetX, targetY) => {
                const targetDistFromCenter = Utils.distance(targetX, targetY, mapCenterX, mapCenterY);
                const targetDistFromEdge = mapRadius - targetDistFromCenter;
                return targetDistFromEdge > 800; // Target must be at least 800px from edge
            };

            // If WE are close to edge, don't seek ANY food - let edge avoidance take over
            if (headDistFromEdge < 600) {
                return null; // Let BotController handle edge avoidance
            }

            // === PARALLEL VIGILANCE: Get current threat level ===
            const currentThreat = FoodSeeker.getCurrentThreatLevel();
            STATE.vigilanceLevel = currentThreat;

            // If high threat, be more selective about food targets
            const threatMultiplier = currentThreat > 0.5 ? 0.3 : currentThreat > 0.3 ? 0.6 : 1.0;

            // FIRST: Check for DEAD SNAKE FOOD! (Highest priority - BOOST to it!)
            // But only if path is safe enough AND not near edge AND not near enemy bodies
            // === v7.0: Use RiskRewardCalculator for comprehensive risk assessment ===
            const deadSnakeFood = FoodSeeker.detectDeadSnakeFood();
            if (deadSnakeFood && CONFIG.movement.boostToDeadSnakeFood) {
                // Check if dead snake food is near edge
                if (!isTargetSafeFromEdge(deadSnakeFood.x, deadSnakeFood.y)) {
                    // Skip - too close to edge
                    DEBUG && console.log('%c⚠️ Skipping dead snake food - too close to edge!', 'color: #ff6600;');
                } else {
                    // === v7.0: Comprehensive risk/reward analysis ===
                    const riskData = RiskRewardCalculator.calculateDeadSnakeFoodRisk(
                        deadSnakeFood.x,
                        deadSnakeFood.y,
                        deadSnakeFood.totalSize,
                        deadSnakeFood.count
                    );

                    deadSnakeFood.riskData = riskData;
                    deadSnakeFood.pathThreat = riskData.risk;
                    deadSnakeFood.foodDanger = riskData.factors.maxDanger;

                    // Log the risk decision
                    RiskRewardCalculator.logDecision({ type: 'deadsnake', value: deadSnakeFood.totalSize }, riskData);

                    // === v7.0: Decision based on risk/reward ===
                    if (riskData.decision === 'avoid') {
                        DEBUG && console.log(`%c🚫 SKIPPING dead snake food - ${riskData.skipReason}`, 'color: #ff4444; font-size: 12px;');
                    } else if (riskData.decision === 'risky' && !riskData.isWorthRisk) {
                        DEBUG && console.log(`%c⚠️ SKIPPING risky dead snake - not worth ${riskData.risk.toFixed(0)}% risk`, 'color: #ffaa00;');
                    } else {
                        // Accept the target
                        return {
                            type: 'deadsnake',
                            x: deadSnakeFood.x,
                            y: deadSnakeFood.y,
                            value: deadSnakeFood.value * 10 * (1 - riskData.risk * 0.7),
                            totalSize: deadSnakeFood.totalSize,
                            count: deadSnakeFood.count,
                            dist: deadSnakeFood.dist,
                            angle: deadSnakeFood.angle,
                            pathThreat: riskData.risk,
                            foodDanger: riskData.factors.maxDanger,
                            riskData: riskData,
                            contestingSnakes: riskData.contestingSnakes,
                            // === v7.0: Smart boosting ===
                            shouldBoost: riskData.shouldBoost,
                            shouldSlowApproach: riskData.shouldSlowApproach
                        };
                    }
                }
            }

            // Find strings and clusters
            const strings = FoodSeeker.findFoodStrings();
            const clusters = FoodSeeker.findFoodClusters();
            const nearbyFood = FoodSeeker.getNearbyFood();

            let bestTarget = null;
            let bestScore = 0;

            // SECOND: Check for FOOD STRINGS (Very efficient eating!)
            // === STRING CONSUMPTION GOAL: When we find a string, CONSUME THE WHOLE THING! ===
            // === Also check connected networks for maximum food gathering ===
            // === v7.0: Use RiskRewardCalculator for all strings ===
            if (strings.length > 0) {
                // Find the OPTIMAL string: best food/time ratio with safety consideration
                let optimalString = null;
                let optimalScore = 0;
                let optimalRiskData = null;

                for (const string of strings) {
                    // Skip unsafe strings when threat is high
                    if (currentThreat > 0.4 && string.threatLevel > 0.4) continue;

                    // === EDGE CHECK: Skip strings that go toward the edge ===
                    if (!isTargetSafeFromEdge(string.startX, string.startY) ||
                        !isTargetSafeFromEdge(string.endX, string.endY)) {
                        continue; // Skip strings near edge
                    }

                    // === v7.0: Comprehensive risk/reward evaluation ===
                    const riskData = RiskRewardCalculator.calculateFoodRisk(
                        string.startX,
                        string.startY,
                        string.totalSize
                    );

                    // Skip if risk is too high
                    if (riskData.decision === 'avoid') {
                        continue; // Too risky - skip this string
                    }

                    // Calculate efficiency score: food per second, adjusted for risk
                    const safetyMultiplier = riskData.risk < 0.2 ? 1.2 : (1 - riskData.risk * 0.6);
                    const fps = string.foodPerSecond || (string.totalSize / Math.max(string.totalTime, 0.5));

                    // SHORTEST PATH SCORE: Prioritize high FPS (most food in shortest time)
                    const pathScore = fps * safetyMultiplier * (string.isInFront ? 1.3 : 1.0);

                    // BONUS for strings with good risk/reward ratio
                    const rrBonus = riskData.risk < 0.3 ? 1.5 : 1.0;

                    if (pathScore * rrBonus > optimalScore) {
                        optimalScore = pathScore * rrBonus;
                        optimalString = string;
                        optimalString.foodDanger = riskData.risk;
                        optimalRiskData = riskData;
                    }
                }

                // Fall back to best string if no optimal found
                const bestString = optimalString || strings[0];
                const bestStringRisk = optimalRiskData || (bestString ? RiskRewardCalculator.calculateFoodRisk(bestString.startX, bestString.startY, bestString.totalSize) : null);

                if (!bestString || (bestStringRisk && bestStringRisk.decision === 'avoid')) {
                    // All strings were too dangerous - skip strings entirely
                } else {

                // === CHECK FOR HIGH-VALUE CLUSTERS THAT CONNECT TO THIS STRING ===
                // If a cluster is connected (via food network), include it in the target
                const activeNetwork = FoodSeeker.activeNetwork;
                let networkBonus = 1.0;
                let connectedStrings = [];
                let connectedClusters = [];

                if (activeNetwork && activeNetwork.strings.includes(bestString)) {
                    // This string is part of a larger network - consume it all!
                    networkBonus = 1 + (activeNetwork.nodes.length * 0.1); // 10% bonus per connected node
                    connectedStrings = activeNetwork.strings.filter(s => s !== bestString);
                    connectedClusters = activeNetwork.clusters;

                    // Log network detection
                    if (Date.now() % 3000 < 50) {
                        DEBUG && console.log(`%c🌐 FOOD NETWORK: ${activeNetwork.strings.length} strings + ${activeNetwork.clusters.length} clusters = ${activeNetwork.totalValue.toFixed(0)} total food!`,
                            'color: #00ff88; font-size: 12px; font-weight: bold;');
                    }
                }

                // Strings are VERY valuable - follow them to eat many foods!
                // GOAL: Consume the ENTIRE string from start to end
                // === v7.0: Apply risk-based scoring ===
                const riskPenalty = bestStringRisk ? (1 - bestStringRisk.risk * 0.7) : 1.0;
                const stringScore = (bestString.value * 3.0 * networkBonus) * threatMultiplier * riskPenalty;

                if (stringScore > bestScore) {
                    bestScore = stringScore;
                    bestTarget = {
                        type: 'string',
                        x: bestString.startX,  // Start of string (closer end)
                        y: bestString.startY,
                        endX: bestString.endX,
                        endY: bestString.endY,
                        direction: bestString.direction,
                        value: bestString.value,
                        totalSize: bestString.totalSize,
                        length: bestString.length,
                        dist: bestString.dist,
                        foodPerSecond: bestString.foodPerSecond,
                        totalTime: bestString.totalTime,
                        isSafe: bestStringRisk ? bestStringRisk.risk < 0.3 : bestString.isSafe,
                        threatLevel: bestStringRisk ? bestStringRisk.risk : bestString.threatLevel,
                        riskReward: bestString.riskReward,
                        riskData: bestStringRisk,  // v7.0: Include full risk data
                        foodDanger: bestString.foodDanger || (bestStringRisk ? bestStringRisk.risk : 0),
                        // === v7.0: Smart boosting based on risk ===
                        shouldBoost: bestStringRisk ? bestStringRisk.shouldBoost && bestString.length >= 6 :
                                    (bestString.length >= 8 && bestString.isSafe && (bestString.foodDanger || 0) < 0.3),
                        shouldSlowApproach: bestStringRisk ? bestStringRisk.shouldSlowApproach : false,
                        // === STRING CONSUMPTION GOAL ===
                        consumeEntireString: true, // Flag to follow string to the end
                        stringFoods: bestString.foods, // All food items in the string
                        // === CONNECTED NETWORK INFO ===
                        hasNetwork: connectedStrings.length > 0 || connectedClusters.length > 0,
                        connectedStrings: connectedStrings,
                        connectedClusters: connectedClusters,
                        networkValue: activeNetwork ? activeNetwork.totalValue : bestString.totalSize,
                        networkPath: activeNetwork ? activeNetwork.path : null
                    };
                }
                } // End of bestString check
            }

            // THIRD: Check for HIGH-VALUE CLUSTERS (that may connect to strings)
            // === v7.0: Use RiskRewardCalculator for clusters ===
            if (clusters.length > 0) {
                // Find the safest cluster using risk/reward
                let bestCluster = null;
                let bestClusterRisk = null;
                let bestClusterScore = 0;

                for (const cluster of clusters) {
                    const riskData = RiskRewardCalculator.calculateFoodRisk(
                        cluster.centerX,
                        cluster.centerY,
                        cluster.totalSize
                    );

                    // Skip if too risky
                    if (riskData.decision === 'avoid') continue;

                    const activeNetwork = FoodSeeker.activeNetwork;
                    const isPartOfNetwork = activeNetwork && activeNetwork.clusters.includes(cluster);

                    // Calculate score with risk penalty
                    const riskPenalty = 1 - riskData.risk * 0.7;
                    const clusterScore = cluster.value * (cluster.count >= 5 ? 2.0 : 1.0) *
                                        (isPartOfNetwork ? 1.3 : 1.0) * riskPenalty;

                    if (clusterScore > bestClusterScore) {
                        bestClusterScore = clusterScore;
                        bestCluster = cluster;
                        bestClusterRisk = riskData;
                    }
                }

                if (bestCluster && bestClusterScore > bestScore) {
                    const activeNetwork = FoodSeeker.activeNetwork;
                    const isPartOfNetwork = activeNetwork && activeNetwork.clusters.includes(bestCluster);

                    bestScore = bestClusterScore;
                    bestTarget = {
                        type: 'cluster',
                        x: bestCluster.centerX,
                        y: bestCluster.centerY,
                        value: bestCluster.value,
                        totalSize: bestCluster.totalSize,
                        count: bestCluster.count,
                        dist: bestCluster.dist,
                        foodDanger: bestClusterRisk ? bestClusterRisk.risk : 0,
                        riskData: bestClusterRisk,
                        // === v7.0: Smart boosting ===
                        shouldBoost: bestClusterRisk ? bestClusterRisk.shouldBoost && bestCluster.count >= 8 : false,
                        shouldSlowApproach: bestClusterRisk ? bestClusterRisk.shouldSlowApproach : false,
                        hasNetwork: isPartOfNetwork,
                        networkPath: activeNetwork ? activeNetwork.path : null
                    };
                }
            }

            // FOURTH: Single big food in eating radius - with danger check!
            // === v7.0: Use RiskRewardCalculator for individual food ===
            const bigFood = nearbyFood.filter(f => {
                if (f.size <= 6 || !f.isInFront) return false;
                // Use quick risk check
                return RiskRewardCalculator.shouldConsiderFood(f.x, f.y, f.size);
            });
            if (bigFood.length > 0) {
                const best = bigFood.reduce((a, b) => (b.size / b.dist) > (a.size / a.dist) ? b : a);
                const riskData = RiskRewardCalculator.calculateFoodRisk(best.x, best.y, best.size);

                if (riskData.decision !== 'avoid') {
                    const riskPenalty = 1 - riskData.risk * 0.6;
                    const singleScore = (best.size * 4) / Math.max(best.dist, 20) * riskPenalty;

                    if (singleScore > bestScore) {
                        bestScore = singleScore;
                        bestTarget = {
                            type: 'bigfood',
                            x: best.x,
                            y: best.y,
                            size: best.size,
                            dist: best.dist,
                            value: singleScore,
                            foodDanger: riskData.risk,
                            riskData: riskData,
                            shouldBoost: false, // Don't waste boost on single food
                            shouldSlowApproach: riskData.shouldSlowApproach
                        };
                    }
                }
            }

            // FOURTH-B: Check FOOD PATH for individual food along the way to target
            // Don't leave food behind if we can reach it!
            const foodPath = FoodSeeker.buildOptimalFoodPath();
            if (foodPath && foodPath.points.length > 0) {
                // If we have a path with reachable food, consider picking it up
                const reachableOnPath = foodPath.points.filter(p => p.dist < 100);

                if (reachableOnPath.length > 0 && bestTarget) {
                    // We have individual food along the way - include in target info
                    bestTarget.foodPath = foodPath;
                    bestTarget.pathFoodCount = reachableOnPath.length;

                    // If the closest path food is VERY close, adjust target to pick it up
                    const closest = reachableOnPath[0];
                    if (closest && closest.dist < 60) {
                        // Pick up this food first, then continue to main target
                        bestTarget.immediateFood = closest;
                    }
                }

                // If no other target but we have path food, use path food as target
                if (!bestTarget && reachableOnPath.length > 0) {
                    const pathFood = reachableOnPath[0];
                    bestTarget = {
                        type: 'pathfood',
                        x: pathFood.x,
                        y: pathFood.y,
                        size: pathFood.size,
                        dist: pathFood.dist,
                        value: pathFood.size / Math.max(pathFood.dist, 10),
                        shouldBoost: false,
                        foodPath: foodPath
                    };
                }
            }

            // FIFTH: ANY food in eating radius - we ALWAYS want to be eating!
            // But avoid food near enemy snake bodies!
            // === v7.0: Use RiskRewardCalculator for all nearby food ===
            if (!bestTarget && nearbyFood.length > 0) {
                // Prefer food in front of us AND with low risk
                let bestFood = null;
                let bestFoodScore = 0;
                let bestFoodRisk = null;

                for (const food of nearbyFood) {
                    // Use quick risk check
                    const riskData = RiskRewardCalculator.calculateFoodRisk(food.x, food.y, food.size);

                    // Skip if too risky
                    if (riskData.decision === 'avoid') continue;

                    const dirBonus = food.isInFront ? 2.0 : 0.5;
                    const riskPenalty = 1 - riskData.risk * 0.7;
                    const score = (food.size / Math.max(food.dist, 15)) * dirBonus * riskPenalty;

                    if (score > bestFoodScore) {
                        bestFoodScore = score;
                        bestFood = food;
                        bestFood.foodDanger = riskData.risk;
                        bestFoodRisk = riskData;
                    }
                }

                if (bestFood) {
                    bestTarget = {
                        type: 'food',
                        x: bestFood.x,
                        y: bestFood.y,
                        size: bestFood.size,
                        dist: bestFood.dist,
                        value: bestFoodScore,
                        foodDanger: bestFood.foodDanger || 0,
                        riskData: bestFoodRisk,
                        shouldBoost: false,
                        shouldSlowApproach: bestFoodRisk ? bestFoodRisk.shouldSlowApproach : false
                    };
                }
            }

            // === v7.0: Log final target decision ===
            if (bestTarget && bestTarget.riskData) {
                RiskRewardCalculator.logDecision(bestTarget, bestTarget.riskData);
            }

            return bestTarget;
        },

        // Store current food target for following strings
        currentTarget: null,
        targetType: null,

        // Get angle to best food (uses cluster/string priority system)
        // "ALWAYS BE EATING!"
        getBestFoodAngle: () => {
            const snake = window.slither || window.snake;
            if (!snake) return null;

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;

            // Get the best food target
            const target = FoodSeeker.getBestFoodTarget();

            if (!target) return null;

            // Store for display/debugging
            FoodSeeker.currentTarget = target;
            FoodSeeker.targetType = target.type;

            // Log what we're going for
            if (Date.now() % 2000 < 50) {
                if (target.type === 'deadsnake') {
                    DEBUG && console.log(`%c💀 DEAD SNAKE FOOD! ${target.count} big pieces, total size ${target.totalSize.toFixed(0)}, dist ${target.dist.toFixed(0)} - BOOSTING!`,
                        'color: #ff00ff; font-size: 14px; font-weight: bold;');
                } else if (target.type === 'string') {
                    const networkInfo = target.hasNetwork ? ` (NETWORK: ${target.networkValue?.toFixed(0) || '?'}🍕)` : '';
                    const rrInfo = target.riskReward ? ` [R:${target.riskReward.reward.toFixed(0)} Risk:${target.riskReward.riskLevel}]` : '';
                    DEBUG && console.log(`%c🔗 CONSUMING STRING: ${target.length} food, total ${target.totalSize.toFixed(0)}🍕${networkInfo}${rrInfo}`,
                        'color: #00ff88; font-size: 12px; font-weight: bold;');
                } else if (target.type === 'cluster') {
                    console.log(`🍎 Targeting CLUSTER: ${target.count} food, total size ${target.totalSize.toFixed(0)}, dist ${target.dist.toFixed(0)}`);
                } else if (target.type === 'bigfood') {
                    console.log(`💎 Going for BIG FOOD: size ${target.size}, dist ${target.dist.toFixed(0)}`);
                } else if (target.type === 'pathfood') {
                    console.log(`🛤️ Picking up PATH FOOD: size ${target.size}, dist ${target.dist.toFixed(0)}`);
                }
            }

            // Calculate base angle to target
            let targetAngle = Utils.angle(headX, headY, target.x, target.y);

            // === STRING CONSUMPTION: Follow the string to its end! ===
            // When we're close to the string start, aim for the END to consume the whole thing
            if (target.type === 'string' && target.consumeEntireString) {
                const distToStart = Utils.distance(headX, headY, target.x, target.y);
                const distToEnd = Utils.distance(headX, headY, target.endX, target.endY);

                // If we're close to the start, switch to following the string direction
                if (distToStart < 80) {
                    // We're ON the string - follow its direction to consume it all
                    targetAngle = target.direction;

                    // If there's food in the string, aim for the nearest uneaten one
                    if (target.stringFoods && target.stringFoods.length > 0) {
                        let nearestFood = null;
                        let nearestDist = Infinity;

                        for (const food of target.stringFoods) {
                            const dist = Utils.distance(headX, headY, food.x, food.y);
                            // Only consider food in front of us (along the string direction)
                            const foodAngle = Utils.angle(headX, headY, food.x, food.y);
                            const angleDiff = Math.abs(Utils.angleDiff(target.direction, foodAngle));

                            if (dist < nearestDist && dist > 10 && angleDiff < Math.PI / 2) {
                                nearestDist = dist;
                                nearestFood = food;
                            }
                        }

                        if (nearestFood) {
                            targetAngle = Utils.angle(headX, headY, nearestFood.x, nearestFood.y);
                        }
                    }
                } else if (distToEnd < distToStart * 0.7) {
                    // We're closer to the end - still aim for end to finish consuming
                    targetAngle = Utils.angle(headX, headY, target.endX, target.endY);
                }

                // If we have a network path, consider the next node after this string
                if (target.networkPath && target.networkPath.length > 1 && distToEnd < 100) {
                    // We're near the end of current string - prepare for next network node
                    const nextNode = target.networkPath.find(p => {
                        const nodeDist = Utils.distance(target.endX, target.endY, p.x, p.y);
                        return nodeDist > 30 && nodeDist < 200; // Next node in network
                    });

                    if (nextNode) {
                        // Blend angle toward next node (30% next, 70% current)
                        const nextAngle = Utils.angle(headX, headY, nextNode.x, nextNode.y);
                        const blendDiff = Utils.angleDiff(targetAngle, nextAngle);
                        targetAngle = targetAngle + blendDiff * 0.3;
                    }
                }
            }

            // === FOOD PATH ADJUSTMENT ===
            // If there's immediate food on the path, adjust angle to pick it up
            if (target.immediateFood && target.immediateFood.dist < 60) {
                const immediateAngle = Utils.angle(headX, headY, target.immediateFood.x, target.immediateFood.y);
                // Blend toward immediate food (60% immediate, 40% main target)
                const angleDiff = Utils.angleDiff(targetAngle, immediateAngle);
                targetAngle = targetAngle + angleDiff * 0.6;
            }

            return targetAngle;
        },

        // Fallback: GO STRAIGHT FORWARD - no circling!
        // ENHANCED: Better edge avoidance with predictive checking
        getWanderAngle: () => {
            const snake = window.slither || window.snake;
            if (!snake) return 0;

            // Get current angle - KEEP GOING STRAIGHT
            const currentAngle = snake.ang || 0;

            // Stay away from map edges - ENHANCED
            const mapRadius = typeof window.grd !== 'undefined' ? window.grd : 21600;
            const headX = snake.xx || 0;
            const headY = snake.yy || 0;
            const mapCenterX = mapRadius;
            const mapCenterY = mapRadius;
            const toCenter = Utils.angle(headX, headY, mapCenterX, mapCenterY);
            const distFromCenter = Utils.distance(headX, headY, mapCenterX, mapCenterY);
            const distFromEdge = mapRadius - distFromCenter;

            // CRITICAL: Very close to edge - MUST turn toward center
            if (distFromEdge < 600) {
                DEBUG && console.log(`%c🚨 WANDER: Too close to edge! ${distFromEdge.toFixed(0)}px - turning to center`,
                    'color: #ff6600; font-size: 12px;');
                return toCenter;
            }

            // CAUTION: Getting close to edge - start turning
            if (distFromEdge < 1200) {
                // Blend current angle with toward-center angle
                const urgency = 1 - (distFromEdge / 1200);  // 0 at 1200px, 1 at 0px
                const blendedAngle = currentAngle + Utils.angleDiff(currentAngle, toCenter) * urgency * 0.7;
                return blendedAngle;
            }

            // Safe zone - check if current direction leads to edge (predictive)
            const lookAhead = 800;
            const futureX = headX + Math.cos(currentAngle) * lookAhead;
            const futureY = headY + Math.sin(currentAngle) * lookAhead;
            const futureDist = Utils.distance(futureX, futureY, mapCenterX, mapCenterY);

            if (futureDist > mapRadius - 600) {
                // Current direction leads to edge - turn toward center
                DEBUG && console.log(`%c🔶 WANDER: Direction leads to edge - correcting`,
                    'color: #ffaa00; font-size: 11px;');
                return currentAngle + Utils.angleDiff(currentAngle, toCenter) * 0.5;
            }

            // Otherwise KEEP GOING STRAIGHT in current direction
            return currentAngle;
        },

        // Check if path to food is safe
        isPathSafe: (targetX, targetY) => {
            const snake = window.slither || window.snake;
            if (!snake) return false;

            const headX = snake.xx || snake.x || 0;
            const headY = snake.yy || snake.y || 0;
            const snakesArr = window.slithers || window.snakes || [];

            // Check points along path
            const steps = 5;
            for (let i = 1; i <= steps; i++) {
                const checkX = headX + (targetX - headX) * (i / steps);
                const checkY = headY + (targetY - headY) * (i / steps);

                for (const s of snakesArr) {
                    if (!s || s === snake || s.dead || s.dying) continue;

                    // Check against snake body
                    const segments = SnakeDetector.getSnakeSegments(s);
                    for (const seg of segments) {
                        const dist = Utils.distance(checkX, checkY, seg.x, seg.y);
                        if (dist < seg.radius + CONFIG.collision.safetyMargin) {
                            return false;  // Path blocked!
                        }
                    }
                }
            }
            return true;
        }
    };

    // ==================== ACTIVE DEFENSE SYSTEM ====================
    // Detects attackers heading toward us and targets their head to make them turn or die
    const DefenseSystem = {
        currentAttacker: null,
        defenseMode: false,
        lastDefenseTime: 0,

        // Detect if any snake is actively attacking us (heading toward our head)
        detectAttackers: () => {
            const mySnake = window.slither || window.snake;
            if (!mySnake) return [];

            const myHead = {
                x: mySnake.xx || mySnake.x || 0,
                y: mySnake.yy || mySnake.y || 0,
                ang: mySnake.ang || 0
            };

            const myLength = SnakeDetector.getSnakeLength(mySnake);
            const snakesArr = window.slithers || window.snakes || [];
            const attackers = [];

            for (const snake of snakesArr) {
                if (!snake || snake === mySnake || snake.dead || snake.dying) continue;
                if (typeof snake.xx !== 'number') continue;

                const enemyHead = {
                    x: snake.xx || snake.x,
                    y: snake.yy || snake.y,
                    ang: snake.ang || 0,
                    sp: snake.sp || 11
                };

                const dist = Utils.distance(myHead.x, myHead.y, enemyHead.x, enemyHead.y);

                // Only consider snakes within defense range
                if (dist > CONFIG.defense.detectionRange) continue;

                // Calculate if this snake is heading TOWARD us
                const angleToUs = Math.atan2(myHead.y - enemyHead.y, myHead.x - enemyHead.x);
                const headingDiff = Math.abs(Utils.angleDiff(enemyHead.ang, angleToUs));

                // If they're heading roughly toward us (within 45 degrees)
                const isHeadingTowardUs = headingDiff < Math.PI / 4;

                // Check if they're on a collision course
                // Predict where they'll be in a few frames
                const predictFrames = 20;
                const predictedX = enemyHead.x + Math.cos(enemyHead.ang) * enemyHead.sp * predictFrames;
                const predictedY = enemyHead.y + Math.sin(enemyHead.ang) * enemyHead.sp * predictFrames;
                const predictedDist = Utils.distance(myHead.x, myHead.y, predictedX, predictedY);

                // They're attacking if heading toward us AND getting closer
                const isAttacking = isHeadingTowardUs && predictedDist < dist;

                // Also check if they're trying to cut us off (heading to intercept our path)
                const myPredictedX = myHead.x + Math.cos(myHead.ang) * (mySnake.sp || 11) * predictFrames;
                const myPredictedY = myHead.y + Math.sin(myHead.ang) * (mySnake.sp || 11) * predictFrames;
                const interceptDist = Utils.distance(predictedX, predictedY, myPredictedX, myPredictedY);
                const isCuttingOff = interceptDist < 100;

                if (isAttacking || isCuttingOff) {
                    const enemyLength = SnakeDetector.getSnakeLength(snake);

                    // Calculate threat level
                    let threatLevel = 1.0;
                    if (dist < 150) threatLevel *= 2.0;  // Very close
                    if (dist < 100) threatLevel *= 2.0;  // Critical distance
                    if (enemyLength > myLength) threatLevel *= 1.5;  // Bigger than us
                    if (enemyHead.sp > 11) threatLevel *= 1.3;  // They're boosting
                    if (isCuttingOff) threatLevel *= 1.5;  // Cutting us off

                    attackers.push({
                        snake: snake,
                        head: enemyHead,
                        dist: dist,
                        length: enemyLength,
                        isHeadingTowardUs: isHeadingTowardUs,
                        isCuttingOff: isCuttingOff,
                        threatLevel: threatLevel,
                        predictedX: predictedX,
                        predictedY: predictedY,
                        angleToUs: angleToUs
                    });
                }
            }

            // Sort by threat level (highest first)
            attackers.sort((a, b) => b.threatLevel - a.threatLevel);

            return attackers;
        },

        // Get the defensive counter-attack angle to target attacker's head
        getDefenseAngle: (attacker) => {
            const mySnake = window.slither || window.snake;
            if (!mySnake || !attacker) return null;

            const myHead = {
                x: mySnake.xx || mySnake.x || 0,
                y: mySnake.yy || mySnake.y || 0,
                ang: mySnake.ang || 0,
                sp: mySnake.sp || 11
            };

            const enemyHead = attacker.head;

            // Strategy: Target the FRONT of the attacker
            // Predict where their head will be and intercept

            // Calculate intercept point - where their head will be
            const interceptFrames = Math.min(attacker.dist / 15, 15);  // Frames to intercept
            const interceptX = enemyHead.x + Math.cos(enemyHead.ang) * enemyHead.sp * interceptFrames;
            const interceptY = enemyHead.y + Math.sin(enemyHead.ang) * enemyHead.sp * interceptFrames;

            // Angle to intercept point
            const interceptAngle = Utils.angle(myHead.x, myHead.y, interceptX, interceptY);

            // Alternative: Head directly at their current head position
            const directAngle = Utils.angle(myHead.x, myHead.y, enemyHead.x, enemyHead.y);

            // If very close, go directly at their head
            // If farther, try to intercept their path
            if (attacker.dist < 120) {
                // CLOSE COMBAT: Target their head directly
                return directAngle;
            } else {
                // INTERCEPT: Cut off their path
                return interceptAngle;
            }
        },

        // Check if we should enter defense mode
        shouldDefend: () => {
            // === v7.1: DANGER LOCKOUT - No defense during danger, only escape ===
            if (STATE.dangerLockout) {
                DefenseSystem.defenseMode = false;
                DefenseSystem.currentAttacker = null;
                return null;  // No counter-attack during danger
            }

            const attackers = DefenseSystem.detectAttackers();

            if (attackers.length === 0) {
                DefenseSystem.defenseMode = false;
                DefenseSystem.currentAttacker = null;
                return null;
            }

            // Get the most threatening attacker
            const mainAttacker = attackers[0];

            // Only defend if threat level is high enough
            if (mainAttacker.threatLevel >= CONFIG.defense.threatThreshold) {
                DefenseSystem.defenseMode = true;
                DefenseSystem.currentAttacker = mainAttacker;
                DefenseSystem.lastDefenseTime = Date.now();

                return {
                    attacker: mainAttacker,
                    defenseAngle: DefenseSystem.getDefenseAngle(mainAttacker),
                    shouldBoost: mainAttacker.dist < 150 || mainAttacker.head.sp > 11,
                    threatLevel: mainAttacker.threatLevel
                };
            }

            return null;
        },

        // Get counter-attack position to threaten attacker's front
        getCounterPosition: (attacker) => {
            if (!attacker) return null;

            const mySnake = window.slither || window.snake;
            if (!mySnake) return null;

            const myHead = {
                x: mySnake.xx || mySnake.x || 0,
                y: mySnake.yy || mySnake.y || 0
            };

            // Calculate position that threatens attacker's front
            // We want to be in front of them, forcing them to turn
            const threatDistance = 80;  // How close to position ourselves
            const threatX = attacker.head.x + Math.cos(attacker.head.ang) * threatDistance;
            const threatY = attacker.head.y + Math.sin(attacker.head.ang) * threatDistance;

            return {
                x: threatX,
                y: threatY,
                angle: Utils.angle(myHead.x, myHead.y, threatX, threatY)
            };
        }
    };

    // ==================== ATTACK SYSTEM - AGGRESSIVE KILL MODE ====================
    const AttackSystem = {
        currentTarget: null,
        lastKillAttempt: 0,
        killStreak: 0,

        findTarget: () => {
            if (!CONFIG.attack.enabled) return null;

            const mySnake = SnakeDetector.getMySnake();
            const head = SnakeDetector.getMyHead();
            if (!mySnake || !head) return null;

            const myLength = SnakeDetector.getSnakeLength(mySnake);
            const snakes = SnakeDetector.getAllSnakes();
            const preyRange = CONFIG.attack.preyDetectionRange || 500;

            let bestTarget = null;
            let bestScore = -Infinity;

            for (const snake of snakes) {
                if (!snake || snake.dying) continue;

                const enemyLength = SnakeDetector.getSnakeLength(snake);
                const enemyHead = {
                    x: snake.xx || snake.x,
                    y: snake.yy || snake.y,
                    ang: snake.ang || 0,
                    sp: snake.sp || 11
                };

                const dist = Utils.distance(head.x, head.y, enemyHead.x, enemyHead.y);
                if (dist > preyRange) continue;

                // Calculate size advantage
                const sizeRatio = myLength / enemyLength;

                // Attack criteria: we're bigger OR they're boosting (vulnerable)
                const canAttack = sizeRatio > CONFIG.attack.minSizeAdvantage ||
                                 (enemyHead.sp > 11 && sizeRatio > 0.8); // They're boosting = risky for them

                if (canAttack) {
                    // Score based on: size advantage, distance, and vulnerability
                    let score = sizeRatio * 10;  // Base score from size
                    score -= dist / 50;  // Closer is better

                    // Bonus for boosting enemies (vulnerable!)
                    if (enemyHead.sp > 11) score += 5;

                    // Bonus for enemies heading toward us (easier kill)
                    const theirAngleToUs = Utils.angle(enemyHead.x, enemyHead.y, head.x, head.y);
                    const headingTowardUs = Math.abs(Utils.angleDiff(enemyHead.ang, theirAngleToUs)) < Math.PI / 3;
                    if (headingTowardUs) score += 3;

                    // Bonus for smaller snakes (easier to kill)
                    if (enemyLength < 100) score += 5;
                    else if (enemyLength < 200) score += 2;

                    if (score > bestScore) {
                        bestScore = score;
                        bestTarget = {
                            snake: snake,
                            head: enemyHead,
                            length: enemyLength,
                            dist: dist,
                            sizeRatio: sizeRatio,
                            isBoosting: enemyHead.sp > 11,
                            score: score
                        };
                    }
                }
            }

            AttackSystem.currentTarget = bestTarget;
            return bestTarget;
        },

        // KILL STRATEGY: Position our body in front of enemy head!
        getKillAngle: (target) => {
            const mySnake = SnakeDetector.getMySnake();
            const head = SnakeDetector.getMyHead();
            if (!head || !target || !mySnake) return null;

            const enemyHead = target.head;

            // Predict where enemy will be
            const predictFrames = Math.min(target.dist / 12, 20);
            const predictedX = enemyHead.x + Math.cos(enemyHead.ang) * enemyHead.sp * predictFrames;
            const predictedY = enemyHead.y + Math.sin(enemyHead.ang) * enemyHead.sp * predictFrames;

            // KILL STRATEGY: Cut across their path!
            // We want to put our BODY in front of their HEAD
            // So we aim PAST their predicted position, then they hit our side

            if (CONFIG.attack.killStrategy) {
                // Calculate intercept point - where to cross their path
                const interceptDist = 80;  // How far past their head to aim

                // Get perpendicular angle to their heading
                const perpAngle1 = enemyHead.ang + Math.PI / 2;
                const perpAngle2 = enemyHead.ang - Math.PI / 2;

                // Choose the perpendicular that's on our side
                const toUs = Utils.angle(predictedX, predictedY, head.x, head.y);
                const diff1 = Math.abs(Utils.angleDiff(perpAngle1, toUs));
                const diff2 = Math.abs(Utils.angleDiff(perpAngle2, toUs));

                // We want to cross in FRONT of them, so aim past their predicted position
                const crossAngle = diff1 < diff2 ? perpAngle1 : perpAngle2;
                const interceptX = predictedX + Math.cos(crossAngle) * interceptDist;
                const interceptY = predictedY + Math.sin(crossAngle) * interceptDist;

                // Aim at intercept point
                return Utils.angle(head.x, head.y, interceptX, interceptY);
            }

            // Fallback: simple cut-off
            return Utils.angle(head.x, head.y, predictedX, predictedY);
        },

        getCutOffAngle: (target) => {
            return AttackSystem.getKillAngle(target);
        },

        // Should we boost for this kill?
        shouldBoostForKill: (target) => {
            if (!CONFIG.attack.boostForKill) return false;
            if (!target) return false;

            // Boost if target is close and we have size advantage
            return target.dist < (CONFIG.attack.killBoostThreshold || 150) &&
                   target.sizeRatio > 1.3;
        }
    };

    // ==================== LAG DETECTION SYSTEM ====================
    const LagDetector = {
        // Detect and measure lag from multiple sources
        update: () => {
            const now = Date.now();
            const config = CONFIG.lagControl;
            if (!config || !config.enabled) {
                STATE.lagDetected = false;
                STATE.lagLevel = 0;
                return;
            }

            // Calculate frame time
            const frameTime = now - STATE.lastFrameTime;
            STATE.lastFrameTime = now;

            // Track frame time history
            STATE.frameTimeHistory.push(frameTime);
            if (STATE.frameTimeHistory.length > (config.historySize || 10)) {
                STATE.frameTimeHistory.shift();
            }

            // Calculate average frame time
            if (STATE.frameTimeHistory.length > 0) {
                STATE.avgFrameTime = STATE.frameTimeHistory.reduce((a, b) => a + b, 0) / STATE.frameTimeHistory.length;
            }

            // Get ping from game if available
            STATE.currentPing = window.ping || window.lastPing || 0;

            // Detect lag from multiple indicators
            let lagScore = 0;

            // 1. FPS-based lag detection
            if (STATE.fps > 0 && STATE.fps < config.fpsThreshold) {
                lagScore += (config.fpsThreshold - STATE.fps) / config.fpsThreshold;
            }

            // 2. Frame time based lag detection
            if (STATE.avgFrameTime > config.frameTimeThreshold) {
                lagScore += (STATE.avgFrameTime - config.frameTimeThreshold) / 100;
            }

            // 3. Ping based lag detection
            if (STATE.currentPing > config.pingThreshold) {
                lagScore += (STATE.currentPing - config.pingThreshold) / 200;
            }

            // 4. Frame time spike detection (sudden lag)
            if (frameTime > config.frameTimeThreshold * 2) {
                lagScore += 0.5; // Spike penalty
            }

            // Determine lag level
            STATE.lagLevel = lagScore > 1.5 ? 3 :  // Severe
                            lagScore > 0.8 ? 2 :   // Moderate
                            lagScore > 0.3 ? 1 :   // Mild
                            0;                      // No lag

            STATE.lagDetected = STATE.lagLevel > 0;

            // Log lag status changes (throttled)
            if (STATE.lagDetected && Date.now() % 3000 < 50) {
                const levelName = ['NONE', 'MILD', 'MODERATE', 'SEVERE'][STATE.lagLevel];
                DEBUG && console.log(`%c⏱️ LAG DETECTED [${levelName}]: FPS=${STATE.fps}, FrameTime=${STATE.avgFrameTime.toFixed(0)}ms, Ping=${STATE.currentPing}ms`,
                    STATE.lagLevel >= 2 ? 'color: #ff6600; font-weight: bold;' : 'color: #ffaa00;');
            }
        },

        // Get turn speed multiplier based on lag
        getTurnSpeedMultiplier: () => {
            if (!CONFIG.lagControl.enabled || !STATE.lagDetected) return 1.0;
            if (!CONFIG.lagControl.reduceTurningInLag) return 1.0;

            // Reduce turn speed based on lag level
            const baseMultiplier = CONFIG.lagControl.lagTurnSpeedMultiplier || 0.4;
            switch (STATE.lagLevel) {
                case 3: return baseMultiplier * 0.5;  // Severe: 20% turn speed
                case 2: return baseMultiplier * 0.75; // Moderate: 30% turn speed
                case 1: return baseMultiplier;        // Mild: 40% turn speed
                default: return 1.0;
            }
        },

        // Check if we should allow a turn (prevent circling)
        shouldAllowTurn: (currentAngle, targetAngle) => {
            if (!CONFIG.lagControl.enabled || !STATE.lagDetected) return true;
            if (!CONFIG.lagControl.stopCirclingInLag) return true;

            const angleDiff = Utils.angleDiff(currentAngle, targetAngle);
            const turnDirection = angleDiff > 0 ? 1 : -1;

            // Track consecutive turns in same direction
            if (turnDirection === STATE.lastTurnDirection) {
                STATE.consecutiveTurns++;
            } else {
                STATE.consecutiveTurns = 0;
                STATE.lastTurnDirection = turnDirection;
            }

            // If circling detected (many turns in same direction), force straight
            if (STATE.consecutiveTurns > 15 && STATE.lagLevel >= 2) {
                return false; // Block the turn - go straight
            }

            return true;
        },

        // Get smoothed angle change to reduce erratic movement
        getSmoothAngleChange: (currentAngle, targetAngle) => {
            if (!CONFIG.lagControl.enabled || !STATE.lagDetected) {
                return targetAngle;
            }

            const smoothFactor = CONFIG.lagControl.lagSmoothingFactor || 0.8;
            const lagMultiplier = 1 - (STATE.lagLevel * 0.2); // 0.8, 0.6, 0.4 for levels 1,2,3
            const effectiveFactor = smoothFactor * lagMultiplier;

            // During lag, make smaller angle changes
            const angleDiff = Utils.angleDiff(currentAngle, targetAngle);
            const maxChange = (Math.PI / 8) * LagDetector.getTurnSpeedMultiplier();
            const clampedDiff = Math.max(-maxChange, Math.min(maxChange, angleDiff));

            return currentAngle + clampedDiff * effectiveFactor;
        },

        // Should we allow boost during lag?
        shouldAllowBoost: () => {
            if (!CONFIG.lagControl.enabled) return true;
            if (!CONFIG.lagControl.boostDisabledInLag) return true;

            // Disable boost during moderate/severe lag
            if (STATE.lagLevel >= 2) return false;

            // During mild lag, only allow boost for emergencies
            if (STATE.lagLevel === 1) {
                const isEmergency = STATE.evasionDanger > 0.4 || STATE.isTrapped;  // v7.1: Lower from 0.6
                return isEmergency;
            }

            return true;
        },

        // Get movement strategy during lag
        getMovementStrategy: () => {
            if (!CONFIG.lagControl.enabled || !STATE.lagDetected) {
                return 'normal';
            }

            if (STATE.lagLevel >= 3) return 'minimal';     // Barely move
            if (STATE.lagLevel >= 2) return 'straight';    // Straight lines only
            if (STATE.lagLevel >= 1) return 'cautious';    // Reduced turning
            return 'normal';
        }
    };

    // ==================== PARALLEL SENSOR SYSTEM ====================
    // v7.3: TIERED PROCESSING for optimal performance
    // Critical sensors run every frame, others based on danger level
    const ParallelSensors = {
        // Frame counter for alternating updates
        frameCount: 0,
        lastAction: null,

        // v7.3: Tiered processing state
        _lastCriticalScan: 0,
        _lastFullScan: 0,
        _dangerMode: false,  // True = run all sensors every frame
        _cachedNearbySnakes: null,
        _cachedNearbySnakesTime: 0,

        // Adaptive performance settings
        adaptiveSettings: {
            currentSkipFrames: 0,
            minSkipFrames: 0,
            maxSkipFrames: 0,
            lastAdjustTime: 0,
            adjustInterval: 2000,
            performanceHistory: [],
            targetFps: 30,
            criticalFps: 15
        },

        // v7.3: TIERED PROCESSING INTERVALS
        // Tier 1 (CRITICAL): Every frame - body collision, edge emergency
        // Tier 2 (HIGH): Every 2 frames when safe, every frame in danger
        // Tier 3 (MEDIUM): Every 4 frames when safe
        // Tier 4 (LOW): Every 8 frames (food clusters, networks)
        TIERS: {
            CRITICAL: { interval: 1, sensors: ['bodyCollision', 'edge'] },
            HIGH: { interval: 2, sensors: ['evasion', 'antiTrap', 'squeeze', 'crowd'] },
            MEDIUM: { interval: 4, sensors: ['defense', 'vigilance', 'trap'] },
            LOW: { interval: 8, sensors: ['food', 'walls'] }
        },

        // Get optimal frame skip based on current performance
        getOptimalFrameSkip: () => 0,  // v7.2 compatibility

        // v7.3: Smart sensor scheduling
        shouldRunSensor: (sensorName) => {
            const frame = ParallelSensors.frameCount;

            // In danger mode, run everything every frame
            if (ParallelSensors._dangerMode) return true;

            // Check which tier this sensor belongs to
            for (const [tierName, tierData] of Object.entries(ParallelSensors.TIERS)) {
                if (tierData.sensors.includes(sensorName)) {
                    return (frame % tierData.interval) === 0;
                }
            }
            return true; // Default to running
        },

        // Check if we should run sensors this frame
        shouldRunSensors: () => true,  // v7.2 compatibility - always true

        // v7.3: Fast nearby snake cache (refreshed every 30ms)
        getNearbySnakesFast: (headX, headY, maxDist = 700) => {
            const now = Date.now();

            // Use cache if fresh (within 30ms)
            if (ParallelSensors._cachedNearbySnakes &&
                now - ParallelSensors._cachedNearbySnakesTime < 30) {
                return ParallelSensors._cachedNearbySnakes;
            }

            // Build new cache using batch processor
            const snakesArr = window.slithers || window.snakes || [];
            const mySnake = window.slither || window.snake;
            const maxDistSq = maxDist * maxDist;

            BatchProcessor.filterNearbySnakes(headX, headY, maxDistSq, snakesArr, mySnake);
            const { array, count } = BatchProcessor.getSortedNearbySnakes();

            // Slice to just what we need
            ParallelSensors._cachedNearbySnakes = [];
            for (let i = 0; i < count; i++) {
                ParallelSensors._cachedNearbySnakes.push(array[i]);
            }
            ParallelSensors._cachedNearbySnakesTime = now;

            // Set danger mode if snakes are close
            ParallelSensors._dangerMode = count > 0 && array[0].dist < 300;

            return ParallelSensors._cachedNearbySnakes;
        },

        // Sensor results cache (updated based on adaptive rate)
        results: {
            bodyCollision: null,
            edge: null,
            trap: null,
            antiTrap: null,
            evasion: null,
            defense: null,
            vigilance: null,
            food: null,
            crowd: null,
            walls: null,
            squeeze: null
        },

        // Priority levels for different threats
        PRIORITY: {
            BODY_COLLISION: 1100,
            EDGE_EMERGENCY: 1000,
            EDGE_CRITICAL: 900,
            TRAP_CRITICAL: 850,
            SQUEEZE_ATTACK: 800,
            ANTI_TRAP: 750,
            INSTANT_EVASION_HIGH: 700,
            DEFENSE: 600,
            CROWD_CRITICAL: 550,        // >3 snakes = MUST avoid, higher than food!
            INSTANT_EVASION_MEDIUM: 500,
            CROWD_AVOIDANCE: 450,       // Crowd avoidance above all food!
            VIGILANCE_HIGH: 350,
            EDGE_WARNING: 300,
            FOOD_DEADSNAKE: 200,
            FOOD_STRING: 150,
            FOOD_CLUSTER: 100,
            FOOD_SINGLE: 50,
            WANDER: 10
        },

        // === v7.3: OPTIMIZED BODY COLLISION SENSOR ===
        // Uses squared distances and early exits for maximum performance
        runBodyCollisionSensor: (head) => {
            try {
                if (!head) return null;

                const mySnake = window.slither || window.snake;
                const snakesArr = window.slithers || window.snakes || [];
                if (!snakesArr || !snakesArr.length) return null;

                let nearestCollision = null;
                let nearestDistSq = 250000; // 500^2 - max check distance squared
                let escapeX = 0, escapeY = 0;
                let totalDanger = 0;
                let attackerWarning = false;

                // Pre-compute head direction vector
                const headCosAng = Math.cos(head.ang);
                const headSinAng = Math.sin(head.ang);

                // Check distances in front (squared for fast comparison)
                const checkDistances = [25, 45, 70, 100, 140];
                const checkDistancesSq = [625, 2025, 4900, 10000, 19600];
                const checkAngles = [-0.4, -0.2, 0, 0.2, 0.4];

                // Pre-compute cos/sin for check angles
                const cosAngles = checkAngles.map(a => Math.cos(head.ang + a));
                const sinAngles = checkAngles.map(a => Math.sin(head.ang + a));

                const len = snakesArr.length;
                for (let i = 0; i < len; i++) {
                    const s = snakesArr[i];
                    if (!s || s === mySnake || s.dead || s.dying) continue;

                    // Quick distance check to snake head
                    const sx = s.xx || s.x || 0;
                    const sy = s.yy || s.y || 0;
                    const dx = sx - head.x;
                    const dy = sy - head.y;
                    const headDistSq = dx * dx + dy * dy;

                    // Skip if snake head is too far (> 400px)
                    if (headDistSq > 160000) {
                        // But still check body segments if within range
                        const pts = s.pts;
                        if (!pts || pts.length === 0) continue;

                        // Quick check first body segment
                        const firstPt = pts[0];
                        if (!firstPt) continue;
                        const firstDx = (firstPt.xx || firstPt.x || 0) - head.x;
                        const firstDy = (firstPt.yy || firstPt.y || 0) - head.y;
                        if (firstDx * firstDx + firstDy * firstDy > 250000) continue;
                    }

                    // === v7.1: Check predicted enemy head positions (only for close snakes) ===
                    if (headDistSq < 90000) { // Within 300px
                        const intent = SnakePrediction.analyzeIntent(s, head);
                        if (intent && intent.isAttacker) {
                            attackerWarning = true;

                            // Check where the attacker's HEAD will be in 5, 10, 15 frames
                            for (const frames of [5, 10, 15, 20]) {
                                const pred = SnakePrediction.predictPosition(s, frames);
                                if (pred) {
                                    const predDist = Utils.distance(head.x, head.y, pred.x, pred.y);
                                    const headRadius = (s.sc || 1) * 20;

                                    if (predDist < headRadius + 40) {
                                        // Predicted head-on collision!
                                        const danger = predDist < 30 ? 1.0 :
                                                      predDist < 50 ? 0.95 :
                                                      predDist < 80 ? 0.85 : 0.7;

                                        totalDanger = Math.max(totalDanger, danger);

                                        const awayAngle = Math.atan2(head.y - pred.y, head.x - pred.x);
                                        escapeX += Math.cos(awayAngle) * danger * 1.5;
                                        escapeY += Math.sin(awayAngle) * danger * 1.5;
                                    }
                                }
                            }
                        }
                    }

                    // Check body segments
                    const segments = SnakeDetector.getSnakeSegments(s);
                    const segmentRadius = (s.sc || 1) * 16;

                    for (const seg of segments) {
                        const baseDist = Utils.distance(head.x, head.y, seg.x, seg.y);

                        // Skip segments too far away
                        if (baseDist > 200) continue;

                        // Check if any future position would hit this segment
                        for (const angleDelta of checkAngles) {
                            const checkAngle = head.ang + angleDelta;

                            for (const checkDist of checkDistances) {
                                const futureX = head.x + Math.cos(checkAngle) * checkDist;
                                const futureY = head.y + Math.sin(checkAngle) * checkDist;

                                const collisionDist = Utils.distance(futureX, futureY, seg.x, seg.y);
                                const safetyBuffer = 25;

                                // Would we collide?
                                if (collisionDist < segmentRadius + safetyBuffer) {
                                    const danger = baseDist < 50 ? 1.0 :
                                                  baseDist < 80 ? 0.9 :
                                                  baseDist < 120 ? 0.7 : 0.5;

                                    totalDanger = Math.max(totalDanger, danger);

                                    const awayAngle = Math.atan2(head.y - seg.y, head.x - seg.x);
                                    escapeX += Math.cos(awayAngle) * danger;
                                    escapeY += Math.sin(awayAngle) * danger;

                                    if (baseDist * baseDist < nearestDistSq) {
                                        nearestDistSq = baseDist * baseDist;
                                        nearestCollision = { x: seg.x, y: seg.y, dist: baseDist };
                                    }
                                }
                            }
                        }
                    }
                }

                // v7.1: Lower threshold if attackers detected
                const dangerThreshold = attackerWarning ? 0.2 : 0.3;
                if (totalDanger < dangerThreshold) return null;

                const escapeAngle = Math.atan2(escapeY, escapeX);

                return {
                    escapeAngle: escapeAngle,
                danger: totalDanger,
                nearestDist: Math.sqrt(nearestDistSq),
                collision: nearestCollision,
                attackerWarning: attackerWarning,
                priority: totalDanger > 0.8 ? ParallelSensors.PRIORITY.BODY_COLLISION :
                         ParallelSensors.PRIORITY.INSTANT_EVASION_HIGH
            };
            } catch (sensorError) {
                // Silent fail - don't crash the main loop
                return null;
            }
        },

        // v7.3: Run sensors with TIERED PROCESSING for better performance
        // Critical sensors run every frame, others based on danger level and frame count
        runAllSensors: (head, mapRadius, mapCenterX, mapCenterY) => {
            const results = ParallelSensors.results;
            const frame = ParallelSensors.frameCount;
            const now = Date.now();
            const inDanger = ParallelSensors._dangerMode;

            // Get cached nearby snakes (refreshed every 30ms)
            const nearbySnakes = ParallelSensors.getNearbySnakesFast(head.x, head.y, 700);

            try {
                // === TIER 1: CRITICAL SENSORS - EVERY FRAME ===
                // Body collision and edge detection are life-or-death

                // v7.0: BODY COLLISION SENSOR - ALWAYS RUNS
                try {
                    results.bodyCollision = ParallelSensors.runBodyCollisionSensor(head);
                    // If body collision detected, force danger mode
                    if (results.bodyCollision && results.bodyCollision.danger > 0.3) {
                        ParallelSensors._dangerMode = true;
                    }
                } catch (e) { results.bodyCollision = null; }

                // EDGE DETECTION SENSOR - ALWAYS RUNS
                try {
                    results.edge = ParallelSensors.runEdgeSensor(head, mapRadius, mapCenterX, mapCenterY);
                    if (results.edge && results.edge.priority > 800) {
                        ParallelSensors._dangerMode = true;
                    }
                } catch (e) { results.edge = { priority: 0 }; }

                // === TIER 2: HIGH PRIORITY - Every frame in danger, every 2 frames when safe ===
                if (inDanger || (frame % 2) === 0) {
                    // INSTANT EVASION SENSOR
                    try {
                        const visionThreats = results.vision ? results.vision.threats : [];
                        results.evasion = CONFIG.collision.enabled ?
                            TrapAvoidance.getInstantEvasion(visionThreats) : null;
                    } catch (e) { results.evasion = null; }

                    // ANTI-TRAP RADAR SENSOR
                    try {
                        results.antiTrap = CONFIG.collision.enabled ? TrapAvoidance.checkAntiTrap() : null;
                    } catch (e) { results.antiTrap = null; }

                    // SQUEEZE DETECTION
                    results.squeeze = TrapAvoidance.squeezeAttack || null;

                    // CROWD DETECTION (uses cached snakes)
                    try {
                        results.crowd = ParallelSensors.runCrowdSensorFast(head, nearbySnakes);
                    } catch (e) { results.crowd = { snakeCount: 0, isCrowded: false }; }
                }

                // === TIER 3: MEDIUM PRIORITY - Every 4 frames when safe ===
                if (inDanger || (frame % 4) === 0) {
                    // VISION-BASED DETECTION
                    try {
                        const threatAnalysis = VisionDetection.analyzeThreats();
                        results.vision = threatAnalysis;
                        STATE.trackedSnakeCount = threatAnalysis.totalTracked;
                        STATE.visionDangerLevel = threatAnalysis.dangerLevel;
                    } catch (e) {
                        results.vision = { threats: [], dangerLevel: 0, totalTracked: 0 };
                    }

                    // TRAP DETECTION SENSOR
                    try {
                        results.trap = CONFIG.collision.enabled ? TrapAvoidance.analyze() : { danger: 0, isTrapped: false };
                    } catch (e) { results.trap = { danger: 0, isTrapped: false }; }

                    // DEFENSE SENSOR
                    try {
                        results.defense = CONFIG.defense.enabled ? DefenseSystem.shouldDefend() : null;
                    } catch (e) { results.defense = null; }

                    // VIGILANCE SENSOR
                    try {
                        results.vigilance = {
                            level: FoodSeeker.getCurrentThreatLevel(),
                            count: FoodSeeker.lastThreatCount || 0
                        };
                    } catch (e) { results.vigilance = { level: 0, count: 0 }; }
                }

                // === TIER 4: LOW PRIORITY - Every 8 frames (expensive operations) ===
                if ((frame % 8) === 0) {
                    // FOOD SENSOR (cluster detection is expensive)
                    try {
                        results.food = {
                            angle: FoodSeeker.getBestFoodAngle(),
                            target: FoodSeeker.currentTarget
                        };
                    } catch (e) { results.food = { angle: null, target: null }; }

                    // WALL DETECTION SENSOR
                    try {
                        results.walls = CONFIG.collision.wallDetectionEnabled ? TrapAvoidance.detectWalls() : [];
                    } catch (e) { results.walls = []; }

                    // SNAKE PREDICTION RECORDING (less frequent is fine)
                    try {
                        if (nearbySnakes && nearbySnakes.length > 0) {
                            for (const snakeData of nearbySnakes) {
                                SnakePrediction.recordSnakePosition(snakeData.snake);
                                SnakePrediction.trackBoosting(snakeData.snake, head);
                            }
                            STATE.snakeIntents = SnakePrediction.getSnakeIntents(head);

                            // Update evasion rings
                            const snakesArr = window.slithers || window.snakes || [];
                            EvasionRings.updateRings(head, snakesArr);
                            STATE.evasionRings = EvasionRings.rings;
                            STATE.blockedAngles = EvasionRings.blockedAngles;
                            STATE.safeGaps = EvasionRings.safeGaps;
                            STATE.blockedPercentage = EvasionRings.getBlockedPercentage();
                            STATE.bestEscapeAngle = EvasionRings.getBestEscapeDirection(head);
                        }
                    } catch (e) { /* Non-critical */ }

                    // Periodic cleanup
                    VisionDetection.cleanup();
                    SnakePrediction.cleanupAggressiveSnakes();
                }

                // Store in STATE for visualization
                STATE.vigilanceLevel = results.vigilance ? results.vigilance.level : 0;
                STATE.vigilanceThreatCount = results.vigilance ? results.vigilance.count : 0;
                STATE.crowdLevel = results.crowd ? results.crowd.snakeCount : 0;

            } catch (sensorError) {
                console.error('%c❌ Sensor error:', 'color: #ff6600;', sensorError.message);
            }

            return results;
        },

        // v7.3: Fast crowd sensor using cached nearby snakes
        runCrowdSensorFast: (head, nearbySnakes) => {
            if (!nearbySnakes || nearbySnakes.length === 0) {
                return { snakeCount: 0, isCrowded: false, closeCount: 0 };
            }

            const crowdRadius = 600;
            const crowdRadiusSq = crowdRadius * crowdRadius;
            let snakeCount = 0;
            let closeSnakeCount = 0;
            let escapeX = 0, escapeY = 0;

            for (const snakeData of nearbySnakes) {
                if (snakeData.distSq <= crowdRadiusSq) {
                    snakeCount++;
                    if (snakeData.dist < 400) closeSnakeCount++;

                    // Accumulate escape direction
                    const awayAngle = Math.atan2(head.y - snakeData.y, head.x - snakeData.x);
                    const weight = 1.0 / Math.max(snakeData.dist, 50);
                    escapeX += Math.cos(awayAngle) * weight;
                    escapeY += Math.sin(awayAngle) * weight;
                }
            }

            const isCrowded = snakeCount >= 1;
            const escapeAngle = snakeCount > 0 ? Math.atan2(escapeY, escapeX) : head.ang;

            return {
                snakeCount,
                closeCount: closeSnakeCount,
                isCrowded,
                escapeAngle,
                priority: snakeCount >= 3 ? ParallelSensors.PRIORITY.CROWD_CRITICAL :
                         snakeCount >= 2 ? ParallelSensors.PRIORITY.CROWD_AVOIDANCE : 0
            };
        },

        // Crowd sensor - detect number of nearby snakes and find less crowded direction
        // v7.1: TRIGGERS VERY EARLY - keep safe distance from ALL snakes!
        runCrowdSensor: (head) => {
            const slithers = window.slithers || window.snakes || [];
            const snake = window.slither || window.snake;
            if (!snake || !slithers.length) return { snakeCount: 0, isCrowded: false };

            const crowdRadius = 600;   // v7.1: INCREASED from 500 - detect earlier
            const warningCount = 1;    // Start moving away at 1 nearby snake (when arrows appear)
            const criticalCount = 2;   // 2+ snakes = more urgent
            const emergencyCount = 3;  // 3+ snakes = MUST escape

            // Count nearby snakes and track their positions
            const nearbySnakes = [];
            let snakeCount = 0;
            let closeSnakeCount = 0;   // Snakes within 400px (v7.1: INCREASED)

            for (const s of slithers) {
                if (!s || s === snake || s.dead) continue;

                // Check head distance
                const headX = s.xx || s.x || 0;
                const headY = s.yy || s.y || 0;
                const dist = Utils.distance(head.x, head.y, headX, headY);

                if (dist < crowdRadius) {
                    snakeCount++;
                    if (dist < 400) closeSnakeCount++;  // v7.1: INCREASED from 300
                    nearbySnakes.push({
                        x: headX,
                        y: headY,
                        dist: dist,
                        angle: Utils.angle(head.x, head.y, headX, headY)
                    });
                }
            }

            // Start moving away as soon as ANY snake is nearby (arrows visible)
            // This is SAFE DISTANCE behavior - don't wait until surrounded!
            if (snakeCount === 0) {
                return { snakeCount: 0, isCrowded: false };
            }

            // Find the least crowded direction
            // Divide space into 8 sectors and count snakes in each
            const sectors = new Array(8).fill(0);
            for (const s of nearbySnakes) {
                const sectorIndex = Math.floor(((s.angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
                sectors[sectorIndex]++;
            }

            // Find sector with fewest snakes
            let minSnakes = Infinity;
            let bestSector = 0;
            for (let i = 0; i < 8; i++) {
                if (sectors[i] < minSnakes) {
                    minSnakes = sectors[i];
                    bestSector = i;
                }
            }

            // Convert sector to angle (center of sector)
            const escapeAngle = (bestSector / 8) * Math.PI * 2 - Math.PI + (Math.PI / 8);

            // Determine urgency level based on snake count
            // 1 snake = warning (move away gently)
            // 2 snakes = crowded (move away)
            // 3+ snakes = critical (escape!)
            const isWarning = snakeCount >= warningCount;
            const isCrowded = snakeCount >= criticalCount;
            const isCritical = snakeCount >= emergencyCount;
            const isEmergency = snakeCount >= 4 || closeSnakeCount >= 2;

            return {
                snakeCount: snakeCount,
                closeSnakeCount: closeSnakeCount,
                isCrowded: isWarning,  // Trigger at 1+ snakes (when arrows appear)
                isCritical: isCritical,
                isEmergency: isEmergency,
                escapeAngle: escapeAngle,
                sectors: sectors,
                leastCrowdedSector: bestSector
            };
        },

        // Edge sensor with predictive detection
        runEdgeSensor: (head, mapRadius, mapCenterX, mapCenterY) => {
            const distFromCenter = Utils.distance(head.x, head.y, mapCenterX, mapCenterY);
            const currentDistFromEdge = mapRadius - distFromCenter;

            // Predictive check
            const predictionFrames = CONFIG.collision.edgePredictionFrames || 30;
            const snakeSpeed = head.sp || 11;
            const predictedX = head.x + Math.cos(head.ang) * snakeSpeed * predictionFrames * 0.15;
            const predictedY = head.y + Math.sin(head.ang) * snakeSpeed * predictionFrames * 0.15;
            const predictedDistFromCenter = Utils.distance(predictedX, predictedY, mapCenterX, mapCenterY);
            const predictedDistFromEdge = mapRadius - predictedDistFromCenter;

            const headingTowardEdge = predictedDistFromEdge < currentDistFromEdge;
            const willHitEdge = predictedDistFromEdge < 100;
            const toCenter = Utils.angle(head.x, head.y, mapCenterX, mapCenterY);

            // Determine threat level
            let threatLevel = 'none';
            let priority = 0;
            const effectiveEmergency = Math.min(currentDistFromEdge, predictedDistFromEdge + 150);
            const effectiveCritical = headingTowardEdge ?
                Math.min(currentDistFromEdge, predictedDistFromEdge + 300) : currentDistFromEdge;

            if (effectiveEmergency < (CONFIG.collision.edgeEmergencyRadius || 350)) {
                threatLevel = 'emergency';
                priority = ParallelSensors.PRIORITY.EDGE_EMERGENCY;
            } else if (effectiveCritical < (CONFIG.collision.edgeCriticalRadius || 600) || willHitEdge) {
                threatLevel = 'critical';
                priority = ParallelSensors.PRIORITY.EDGE_CRITICAL;
            } else if (currentDistFromEdge < (CONFIG.collision.edgeDetectionRadius || 1200) && headingTowardEdge) {
                threatLevel = 'warning';
                priority = ParallelSensors.PRIORITY.EDGE_WARNING;
            }

            return {
                currentDist: currentDistFromEdge,
                predictedDist: predictedDistFromEdge,
                headingToward: headingTowardEdge,
                willHit: willHitEdge,
                escapeAngle: toCenter,
                threatLevel: threatLevel,
                priority: priority,
                shouldBoost: threatLevel === 'emergency' || (threatLevel === 'critical' && currentDistFromEdge < 450)
            };
        },

        // Evaluate all sensor results and determine best action
        evaluateAndDecide: (head) => {
            try {
                const results = ParallelSensors.results;
                if (!results || !head) {
                    // Safe fallback - wander
                    return {
                        type: 'wander',
                        priority: ParallelSensors.PRIORITY.WANDER,
                        angle: head ? head.ang : 0,
                        boost: false,
                        reason: 'No sensor data - wandering'
                    };
                }
                const actions = [];

            // ========================================================
            // === v7.1: EVASION LOCKOUT - WHEN DANGER, NO FOOD/ATTACK ===
            // ========================================================
            // Check ALL danger sources and set a flag to BLOCK food/attack
            let dangerDetected = false;
            let dangerLevel = 0;
            let dangerSource = '';

            // Check body collision danger
            if (results.bodyCollision && results.bodyCollision.danger > 0.2) {
                dangerDetected = true;
                dangerLevel = Math.max(dangerLevel, results.bodyCollision.danger);
                dangerSource = 'body_collision';
            }

            // Check trap danger
            if (results.trap && results.trap.danger > 0.15) {
                dangerDetected = true;
                dangerLevel = Math.max(dangerLevel, results.trap.danger);
                dangerSource = 'trap';
            }

            // Check if being surrounded
            if (results.antiTrap && results.antiTrap.isTrapped) {
                dangerDetected = true;
                dangerLevel = Math.max(dangerLevel, 0.6);
                dangerSource = 'surrounded';
            }

            // Check evasion danger
            if (results.evasion && results.evasion.danger > 0.15) {
                dangerDetected = true;
                dangerLevel = Math.max(dangerLevel, results.evasion.danger);
                dangerSource = 'evasion';
            }

            // Check crowd danger (snakes nearby)
            if (results.crowd && results.crowd.snakeCount >= 1 && results.crowd.closeSnakeCount >= 1) {
                dangerDetected = true;
                dangerLevel = Math.max(dangerLevel, 0.3 + results.crowd.closeSnakeCount * 0.15);
                dangerSource = 'crowd';
            }

            // Check vigilance (threat while eating)
            if (results.vigilance && results.vigilance.level > 0.25) {
                dangerDetected = true;
                dangerLevel = Math.max(dangerLevel, results.vigilance.level);
                dangerSource = 'vigilance';
            }

            // Check edge danger
            if (results.edge && results.edge.threatLevel !== 'none') {
                dangerDetected = true;
                if (results.edge.threatLevel === 'emergency') dangerLevel = Math.max(dangerLevel, 0.9);
                else if (results.edge.threatLevel === 'critical') dangerLevel = Math.max(dangerLevel, 0.6);
                else dangerLevel = Math.max(dangerLevel, 0.3);
                dangerSource = 'edge';
            }

            // Store danger state for other systems
            STATE.dangerLockout = dangerDetected;
            STATE.currentDangerLevel = dangerLevel;
            STATE.currentDangerSource = dangerSource;

            // Log when danger lockout is active
            if (dangerDetected && Date.now() % 500 < 50) {
                DEBUG && console.log(`%c🔒 EVASION LOCKOUT: ${dangerSource} (${(dangerLevel * 100).toFixed(0)}%) - NO FOOD/ATTACK!`,
                    'color: #ff6600; font-size: 12px; font-weight: bold;');
            }

            // === Collect all potential actions with priorities ===

            // === v7.0: BODY COLLISION - HIGHEST PRIORITY ===
            if (results.bodyCollision && results.bodyCollision.danger > 0.3) {
                const bc = results.bodyCollision;
                actions.push({
                    type: 'bodyCollision',
                    priority: bc.priority,
                    angle: bc.escapeAngle,
                    boost: bc.danger > 0.9 && bc.nearestDist < 60,  // Only boost if critical
                    reason: `BODY ${bc.nearestDist.toFixed(0)}px! Danger: ${(bc.danger * 100).toFixed(0)}%`
                });

                // Log critical body collisions
                if (bc.danger > 0.7) {
                    DEBUG && console.log(`%c🚨 BODY COLLISION IMMINENT! Dist: ${bc.nearestDist.toFixed(0)}px - TURNING!`,
                        'color: #ff0000; font-size: 14px; font-weight: bold;');
                }
            }

            // 1. Edge threats
            if (results.edge && results.edge.priority > 0) {
                actions.push({
                    type: 'edge',
                    priority: results.edge.priority,
                    angle: results.edge.escapeAngle,
                    boost: results.edge.shouldBoost,
                    reason: `Edge ${results.edge.threatLevel}: ${results.edge.currentDist.toFixed(0)}px`
                });
            }

            // 2. Anti-trap (being surrounded) - HIGHEST PRIORITY AFTER EDGE!
            if (results.antiTrap && results.antiTrap.isTrapped) {
                const urgency = results.antiTrap.urgency || 'MODERATE';
                let priority = ParallelSensors.PRIORITY.ANTI_TRAP;

                // Increase priority based on urgency - traps are VERY dangerous!
                if (urgency === 'CRITICAL') priority = ParallelSensors.PRIORITY.TRAP_CRITICAL;
                else if (urgency === 'HIGH') priority = ParallelSensors.PRIORITY.ANTI_TRAP + 50;
                else if (urgency === 'CLOSE_THREAT') priority = ParallelSensors.PRIORITY.ANTI_TRAP + 25;

                // Calculate trapper count
                const trapperCount = results.antiTrap.trapperCount || 1;

                // ESCAPE STRATEGY:
                // - Single snake: Can boost to outrun
                // - Multiple snakes: Slower but more controlled escape
                const useBoost = trapperCount === 1 || urgency === 'CRITICAL';

                // Log trap detection clearly
                DEBUG && console.log(`%c🚨 TRAP DETECTED [${urgency}]! Exit: ${results.antiTrap.exitSpacePercent.toFixed(0)}% | ${trapperCount} snakes | Escaping!`,
                    urgency === 'CRITICAL' ? 'color: #ff0000; font-size: 14px; font-weight: bold;' :
                    'color: #ff6600; font-size: 12px; font-weight: bold;');

                // Project escape path and store for visualization
                STATE.escapePathProjection = {
                    active: true,
                    angle: results.antiTrap.escapeAngle,
                    trapperCount: trapperCount,
                    exitGaps: results.antiTrap.exitGaps,
                    slowMode: trapperCount > 1 && urgency !== 'CRITICAL'
                };

                actions.push({
                    type: 'antiTrap',
                    priority: priority,
                    angle: results.antiTrap.escapeAngle,
                    boost: useBoost,
                    erratic: results.antiTrap.exitSpacePercent < 35 && trapperCount <= 1,
                    trapperCount: trapperCount,
                    reason: `Trap ${urgency}: ${results.antiTrap.exitSpacePercent.toFixed(0)}% exit (${trapperCount} snakes)`
                });
            } else {
                // Clear escape projection when not trapped
                if (STATE.escapePathProjection) STATE.escapePathProjection.active = false;
            }

            // 3. Squeeze attack
            if (results.squeeze && results.squeeze.severity > 0.3) {
                // Squeeze is always single snake, but project path
                STATE.escapePathProjection = {
                    active: true,
                    angle: results.squeeze.escapeAngle,
                    trapperCount: 1,
                    slowMode: false
                };

                actions.push({
                    type: 'squeeze',
                    priority: ParallelSensors.PRIORITY.SQUEEZE_ATTACK,
                    angle: results.squeeze.escapeAngle,
                    boost: true,  // Squeeze = single snake, boost OK
                    reason: `Squeeze: ${(results.squeeze.severity * 100).toFixed(0)}%`
                });
            }

            // 4. Instant evasion (close threats) - v7.1: MUCH MORE AGGRESSIVE
            if (results.evasion && results.evasion.danger > 0) {
                const cautionThreshold = CONFIG.collision.cautionThreshold || 0.03;
                if (results.evasion.danger > cautionThreshold) {
                    // v7.1: Trigger HIGH priority evasion at 35% instead of 50%
                    let priority = results.evasion.danger > 0.35 ?
                        ParallelSensors.PRIORITY.INSTANT_EVASION_HIGH :
                        ParallelSensors.PRIORITY.INSTANT_EVASION_MEDIUM;

                    // MULTI-SNAKE EVASION: Slow down when more than 1 immediate threat
                    const threatCount = results.evasion.immediateThreats || 1;
                    const useBoost = threatCount <= 1 && results.evasion.shouldBoost;

                    if (threatCount > 1) {
                        DEBUG && console.log(`%c🐢 SLOW EVASION: ${threatCount} threats - controlled escape`,
                            'color: #00ccff; font-size: 11px;');

                        // Project escape path for multi-threat
                        STATE.escapePathProjection = {
                            active: true,
                            angle: results.evasion.angle,
                            trapperCount: threatCount,
                            slowMode: true
                        };
                    }

                    actions.push({
                        type: 'evasion',
                        priority: priority,
                        angle: results.evasion.angle,
                        boost: useBoost,
                        threatCount: threatCount,
                        reason: `Evasion: ${(results.evasion.danger * 100).toFixed(0)}% danger (${threatCount} threats)`
                    });
                }
            }

            // === v7.1.3: RETREAT MODE - When multiple snakes nearby, focus on survival ===
            const rings = STATE.evasionRings || [];
            const aggressiveSnakes = SnakePrediction.getAggressiveSnakes();
            const blockedPct = STATE.blockedPercentage || 0;

            // Trigger RETREAT when:
            // - 2+ snakes within 400px
            // - OR any aggressive snakes nearby
            // - OR more than 40% of directions blocked
            const closeRings = rings.filter(r => r.distance < 400);
            const needsRetreat = closeRings.length >= 2 ||
                                 aggressiveSnakes.length > 0 ||
                                 blockedPct > 40;

            if (needsRetreat && !STATE.retreatMode) {
                DEBUG && console.log(`%c🏃 RETREAT MODE ACTIVATED: ${closeRings.length} close snakes, ${aggressiveSnakes.length} aggressive, ${blockedPct.toFixed(0)}% blocked`,
                    'color: #ff00ff; font-size: 12px; font-weight: bold;');
            }

            STATE.retreatMode = needsRetreat;

            if (needsRetreat) {
                // Find the SAFEST escape direction considering ALL threats
                const safeAngle = EvasionRings.getBestEscapeDirection(head);
                const safetyScore = EvasionRings.scoreEscapeDirection ?
                    EvasionRings.scoreEscapeDirection(head, safeAngle, rings) : 0.5;

                // Calculate retreat urgency
                let retreatPriority = ParallelSensors.PRIORITY.INSTANT_EVASION_MEDIUM;
                if (aggressiveSnakes.length > 0) retreatPriority = ParallelSensors.PRIORITY.INSTANT_EVASION_HIGH;
                if (blockedPct > 60) retreatPriority = ParallelSensors.PRIORITY.TRAP_CRITICAL;
                if (closeRings.length >= 3) retreatPriority = ParallelSensors.PRIORITY.ANTI_TRAP;

                // DON'T BOOST when multiple threats - it can make us overshoot into another snake
                const useBoost = closeRings.length === 1 && !aggressiveSnakes.length && safetyScore > 0.7;

                actions.push({
                    type: 'retreat',
                    priority: retreatPriority,
                    angle: safeAngle,
                    boost: useBoost,
                    safetyScore: safetyScore,
                    reason: `RETREAT: ${closeRings.length} snakes, ${aggressiveSnakes.length} hostile, safety: ${(safetyScore*100).toFixed(0)}%`
                });

                // Log retreat decisions
                if (Date.now() % 300 < 50) {
                    DEBUG && console.log(`%c🏃 RETREAT: Heading ${(safeAngle * 180 / Math.PI).toFixed(0)}° | Safety: ${(safetyScore*100).toFixed(0)}% | Boost: ${useBoost}`,
                        'color: #ff00ff; font-size: 11px;');
                }
            }

            // 5. Defense (counter-attack) - v7.1: DISABLED WHEN DANGER LOCKOUT ACTIVE
            // When danger is detected, no counter-attacks - ONLY ESCAPE
            if (!dangerDetected && results.defense && results.defense.attacker && results.trap.danger < 0.3) {
                actions.push({
                    type: 'defense',
                    priority: ParallelSensors.PRIORITY.DEFENSE,
                    angle: results.defense.defenseAngle,
                    boost: results.defense.shouldBoost,
                    reason: `Defense: attacker ${results.defense.attacker.dist.toFixed(0)}px`
                });
            } else if (dangerDetected && results.defense && results.defense.attacker) {
                // Log that defense is skipped
                if (Date.now() % 2000 < 50) {
                    DEBUG && console.log(`%c🚫 v7.1: SKIPPING DEFENSE - Escaping instead (${dangerSource})`,
                        'color: #ffaa00; font-size: 11px;');
                }
            }

            // 6. High vigilance threat - v7.1: LOWER THRESHOLD
            if (results.vigilance.level > 0.35) {  // v7.1: Lowered from 0.6
                const trapAngle = results.trap.escapeAngle || head.ang;
                actions.push({
                    type: 'vigilance',
                    priority: ParallelSensors.PRIORITY.VIGILANCE_HIGH,
                    angle: trapAngle,
                    boost: results.vigilance.level > 0.5,  // v7.1: Lowered from 0.7
                    reason: `High vigilance: ${(results.vigilance.level * 100).toFixed(0)}%`
                });
            }

            // 6.5. CROWD AVOIDANCE - SAFE DISTANCE! Move away when arrows appear!
            // Triggers as soon as ANY snake is nearby (1+), not just 3+
            if (results.crowd && results.crowd.isCrowded) {
                const crowdCount = results.crowd.snakeCount;
                const closeCount = results.crowd.closeSnakeCount || 0;
                let priority, shouldBoost = false;

                if (results.crowd.isEmergency) {
                    // 4+ snakes OR 2+ very close = EMERGENCY
                    priority = ParallelSensors.PRIORITY.CROWD_CRITICAL + 50;  // Higher than normal critical
                    shouldBoost = true;
                    DEBUG && console.log(`%c🚨 CROWD EMERGENCY! ${crowdCount} snakes (${closeCount} close) - ESCAPE NOW!`,
                        'color: #ff0000; font-size: 14px; font-weight: bold;');
                } else if (results.crowd.isCritical) {
                    // 3 snakes = CRITICAL
                    priority = ParallelSensors.PRIORITY.CROWD_CRITICAL;
                    shouldBoost = closeCount > 0;
                    DEBUG && console.log(`%c🚨 CROWD CRITICAL! ${crowdCount} snakes nearby - escaping!`,
                        'color: #ff4400; font-size: 12px; font-weight: bold;');
                } else if (crowdCount >= 2) {
                    // 2 snakes = crowded, move away
                    priority = ParallelSensors.PRIORITY.CROWD_AVOIDANCE;
                } else {
                    // 1 snake = arrows visible, gently move to safer area
                    // Lower priority but still triggers movement
                    priority = ParallelSensors.PRIORITY.EDGE_WARNING;  // Same as edge warning
                    if (Date.now() % 3000 < 50) {
                        DEBUG && console.log(`%c⚠️ SAFE DISTANCE: Snake nearby - moving to less crowded area`,
                            'color: #ffaa00; font-size: 11px;');
                    }
                }

                actions.push({
                    type: 'crowd',
                    priority: priority,
                    angle: results.crowd.escapeAngle,
                    boost: shouldBoost,
                    snakeCount: crowdCount,
                    reason: `Crowd: ${crowdCount} snake${crowdCount > 1 ? 's' : ''} nearby`
                });
            }

            // 7. Food seeking
            // === v7.1: COMPLETELY SKIP FOOD WHEN DANGER LOCKOUT IS ACTIVE ===
            // When ANY danger is detected, food is NOT an option - survival first!
            if (!dangerDetected && results.food.angle !== null && results.food.target) {
                const target = results.food.target;
                let priority, boost = false;

                // Calculate overall danger from trap analysis
                const overallDanger = results.trap ? results.trap.danger : 0;

                // === v7.0: Get risk data from target ===
                const riskData = target.riskData;
                const targetRisk = riskData ? riskData.risk : (target.foodDanger || 0);

                // === v7.0: Check if we should abandon this target due to high risk ===
                if (riskData && riskData.decision === 'avoid') {
                    // Don't add this food target - it's too risky
                    if (Date.now() % 2000 < 50) {
                        DEBUG && console.log(`%c🚫 v7.0: SKIPPING ${target.type} - Risk too high (${(targetRisk * 100).toFixed(0)}%)`,
                            'color: #ff4444; font-size: 11px;');
                    }
                } else {
                    if (target.type === 'deadsnake') {
                        priority = ParallelSensors.PRIORITY.FOOD_DEADSNAKE;
                        // === v7.0: Smart boosting from RiskRewardCalculator ===
                        boost = target.shouldBoost && results.vigilance.level < 0.4 && overallDanger < 0.5;

                        // If contested by other snakes, reduce priority
                        if (target.contestingSnakes > 0) {
                            priority *= 0.6; // Reduce priority when contested
                            boost = false;   // Never boost to contested food
                        }
                    } else if (target.type === 'string') {
                        priority = ParallelSensors.PRIORITY.FOOD_STRING;
                        boost = target.shouldBoost && targetRisk < 0.25;
                    } else if (target.type === 'cluster') {
                        priority = ParallelSensors.PRIORITY.FOOD_CLUSTER;
                        boost = target.shouldBoost && targetRisk < 0.2;
                    } else {
                        priority = ParallelSensors.PRIORITY.FOOD_SINGLE;
                    }

                    // === v7.0: Apply risk-based priority reduction ===
                    // Higher risk = lower priority for food
                    if (targetRisk > 0.3) {
                        priority *= (1 - targetRisk * 0.6);
                    }

                    // Reduce food priority if vigilance is high
                    if (results.vigilance.level > 0.3) {
                        priority *= (1 - results.vigilance.level * 0.5);
                    }

                    // === v7.0: Never boost if risk is above threshold ===
                    if (targetRisk > CONFIG.riskReward.noBoostRiskThreshold) {
                        boost = false;
                    }

                    actions.push({
                        type: 'food',
                        priority: priority,
                        angle: results.food.angle,
                        boost: boost,
                        target: target,
                        riskLevel: targetRisk,
                        slowApproach: target.shouldSlowApproach || false,
                        reason: `Food: ${target.type} (Risk: ${(targetRisk * 100).toFixed(0)}%)`
                    });
                }
            } else if (dangerDetected && results.food.angle !== null) {
                // Log that food is being ignored due to danger
                if (Date.now() % 1000 < 50) {
                    DEBUG && console.log(`%c🚫 v7.1: IGNORING ALL FOOD - Danger active (${dangerSource}: ${(dangerLevel * 100).toFixed(0)}%)`,
                        'color: #ff0000; font-size: 12px; font-weight: bold;');
                }
            }

            // 8. Wander (fallback) - But NOT toward danger!
            actions.push({
                type: 'wander',
                priority: ParallelSensors.PRIORITY.WANDER,
                angle: FoodSeeker.getWanderAngle(),
                boost: false,
                reason: 'Wandering'
            });

            // === Sort by priority (highest first) ===
            actions.sort((a, b) => b.priority - a.priority);

            // === Return the highest priority action ===
            const bestAction = actions[0];

            // Store all actions for debugging/visualization
            STATE.parallelActions = actions.slice(0, 5); // Top 5 actions
            STATE.currentAction = bestAction;

            return bestAction;
            } catch (decideError) {
                console.error('%c❌ Decision error:', 'color: #ff0000;', decideError.message);
                // Safe fallback - just go forward
                return {
                    type: 'error_recovery',
                    priority: ParallelSensors.PRIORITY.WANDER,
                    angle: head ? head.ang : 0,
                    boost: false,
                    reason: 'Error recovery - maintaining course'
                };
            }
        },

        // Apply erratic movement to an angle (for trap escape)
        applyErraticMovement: (angle) => {
            const erraticJitter = (Math.random() - 0.5) * (Math.PI / 3);
            const oscillation = Math.sin(Date.now() / 100) * (Math.PI / 6);
            return angle + erraticJitter * 0.3 + oscillation * 0.5;
        }
    };

    // ==================== MAIN BOT CONTROLLER ====================
    const BotController = {
        targetAngle: 0,
        smoothAngle: 0,
        lastEvasionTime: 0,

        update: () => {
            // === LAG DETECTION - Run first every frame ===
            LagDetector.update();

            // Track stats
            const mySnake = SnakeDetector.getMySnake();
            if (mySnake) {
                const currentLength = SnakeDetector.getSnakeLength(mySnake);
                if (currentLength > STATE.stats.maxLength) {
                    STATE.stats.maxLength = currentLength;
                }
                STATE.stats.lastLength = currentLength;
            }

            // Check if player died
            if (STATE.stats.lastLength > 10 && !GameVars.isGameReady()) {
                STATE.stats.deaths++;
                STATE.stats.lastLength = 0;

                // CLEAR ALL OVERLAYS on death to prevent artifacts
                VisualEnhancements.clearAllOverlays();
                DEBUG && console.log('%c☠️ DEATH DETECTED - Overlays cleared', 'color: #ff0000; font-size: 14px;');
            }

            // Get snake reference FIRST (before any code that uses it)
            // NOTE: slither.io uses 'slither' not 'snake'
            const snake = window.slither || window.snake;

            // Manual override handling with SAFETY OVERRIDE system
            // Safety override can OVERRIDE user control when in danger
            const dangerLevel = TrapAvoidance.trapScore || 0;
            const mapRadius = typeof window.grd !== 'undefined' ? window.grd : 21600;
            const headX = snake ? (snake.xx || snake.x || 0) : 0;
            const headY = snake ? (snake.yy || snake.y || 0) : 0;
            const distFromEdge = mapRadius - Utils.distance(headX, headY, mapRadius, mapRadius);

            // Check if we need to OVERRIDE user for safety
            if (CONFIG.safetyOverride && CONFIG.safetyOverride.enabled) {
                const edgeDanger = distFromEdge < (CONFIG.safetyOverride.edgeOverrideDistance || 500);
                const highDanger = dangerLevel > (CONFIG.safetyOverride.triggerDanger || 0.25);  // v7.1: LOWERED

                if ((highDanger || edgeDanger) && !STATE.userWantsControl) {
                    // SAFETY OVERRIDE - Bot takes control!
                    if (!STATE.safetyOverrideActive) {
                        STATE.safetyOverrideActive = true;
                        STATE.safetyOverrideReason = edgeDanger ? 'EDGE' : 'DANGER';
                        DEBUG && console.log(`%c🚨 SAFETY OVERRIDE! Reason: ${STATE.safetyOverrideReason}`,
                            'color: #ff0000; font-size: 14px; font-weight: bold;');
                    }
                    // Don't return - continue with bot control for safety
                } else if (STATE.safetyOverrideActive) {
                    // Check if safe to release control
                    const safeNow = dangerLevel < (CONFIG.safetyOverride.releaseDanger || 0.15) &&
                                   distFromEdge > (CONFIG.safetyOverride.edgeOverrideDistance || 500) + 200;
                    if (safeNow) {
                        STATE.safetyOverrideActive = false;
                        STATE.safetyOverrideReason = null;
                        DEBUG && console.log('%c✅ Safe now - releasing control', 'color: #00ff00; font-size: 12px;');
                    }
                }
            }

            // User has instant control when they want it (but only if safe OR they insist)
            if (STATE.userWantsControl && !STATE.safetyOverrideActive) {
                STATE.lastUserControlTime = Date.now();
                return; // Let user control
            }

            // Manual override - let player control (unless safety override active)
            if (STATE.manualOverride && !STATE.safetyOverrideActive) {
                STATE.lastUserControlTime = Date.now();
                return;
            }

            // Manual boost override OR boost lock
            if ((STATE.manualBoost || STATE.boostLocked) && GameVars.isGameReady()) {
                BotController.setBoost(true);
            }

            // Only control snake if bot is enabled AND we're actually in game
            if (!CONFIG.bot.enabled && !STATE.safetyOverrideActive) return;

            // Check if we can control - snake was already retrieved above
            if (!snake || !window.playing) {
                if (CONFIG.bot.autoRespawn) {
                    BotController.tryRespawn();
                }
                return;
            }

            // Get head position - DIRECT from window.snake
            const head = {
                x: snake.xx || snake.x || 0,
                y: snake.yy || snake.y || 0,
                ang: snake.ang || 0,
                sp: snake.sp || 11
            };

            if (!head.x && !head.y) {
                console.log('⚠️ Snake has no position!');
                return;
            }

            // Reset evasion state
            STATE.isEvading = false;
            STATE.evasionDanger = 0;
            STATE.isDefending = false;

            // =====================================================
            // === PARALLEL SENSOR SYSTEM - ADAPTIVE FRAME RATE ===
            // =====================================================
            // Increment frame counter
            ParallelSensors.frameCount++;

            // === v7.0: BODY COLLISION CHECK - ALWAYS RUNS EVERY FRAME ===
            // This is critical safety - never skip body collision detection
            const bodyCollisionCheck = ParallelSensors.runBodyCollisionSensor(head);
            if (bodyCollisionCheck && bodyCollisionCheck.danger > 0.35) {  // v7.1: LOWERED to 35%
                // IMMEDIATE body collision response - override everything!
                const targetAngle = bodyCollisionCheck.escapeAngle;
                const shouldBoost = bodyCollisionCheck.danger > 0.7 && bodyCollisionCheck.nearestDist < 80;  // v7.1: Boost earlier

                STATE.isEvading = true;
                STATE.evasionDanger = bodyCollisionCheck.danger;

                DEBUG && console.log(`%c🚨 v7.0 BODY COLLISION! Dist: ${bodyCollisionCheck.nearestDist.toFixed(0)}px - IMMEDIATE TURN!`,
                    'color: #ff0000; font-size: 13px; font-weight: bold;');

                // Apply the angle immediately
                BotController.smoothAngle = targetAngle;
                BotController.targetAngle = targetAngle;
                BotController.setAngle(targetAngle);
                if (shouldBoost) BotController.setBoost(true);
                return;  // Exit early - body collision takes absolute priority
            }

            // Run sensors based on adaptive performance settings
            let bestAction;
            if (ParallelSensors.shouldRunSensors()) {
                // Run ALL sensors and evaluate
                const sensorResults = ParallelSensors.runAllSensors(head, mapRadius, mapRadius, mapRadius);
                bestAction = ParallelSensors.evaluateAndDecide(head);
                ParallelSensors.lastAction = bestAction;
            } else {
                // Use cached action from previous evaluation
                bestAction = ParallelSensors.lastAction;
            }

            // SAFETY: Ensure we always have a valid action
            if (!bestAction || typeof bestAction.angle === 'undefined') {
                bestAction = {
                    type: 'fallback',
                    priority: 10,
                    angle: head.ang,  // Keep current direction
                    boost: false,
                    reason: 'Fallback - no valid action'
                };
                DEBUG && console.log('%c⚠️ No valid action - maintaining course', 'color: #ffaa00;');
            }

            // Apply the decided action
            let targetAngle = bestAction.angle;
            let shouldBoost = bestAction.boost;

            // Update state based on action type
            if (bestAction.type === 'edge' || bestAction.type === 'evasion' ||
                bestAction.type === 'antiTrap' || bestAction.type === 'squeeze' ||
                bestAction.type === 'bodyCollision') {
                STATE.isEvading = true;
                STATE.evasionDanger = bestAction.priority / 1000;
            }
            if (bestAction.type === 'defense') {
                STATE.isDefending = true;
            }
            if (bestAction.type === 'antiTrap' && bestAction.erratic) {
                targetAngle = ParallelSensors.applyErraticMovement(targetAngle);
            }

            // Log action (throttled)
            if (Date.now() % 2000 < 50) {
                DEBUG && console.log(`%c🎯 ACTION: ${bestAction.type} (P:${bestAction.priority.toFixed(0)}) - ${bestAction.reason}`,
                    'color: #00ff88; font-size: 11px;');
            }

            // 4. Smooth angle transition with LAG CONTROL
            // === LAG CONTROL: Reduce movement during lag ===
            const movementStrategy = LagDetector.getMovementStrategy();

            if (movementStrategy === 'minimal') {
                // SEVERE LAG: Barely move, keep current direction
                const minimalDiff = Utils.angleDiff(BotController.smoothAngle, targetAngle);
                // Only allow tiny corrections
                if (Math.abs(minimalDiff) > Math.PI / 2) {
                    // Big turn needed - do it very slowly
                    BotController.smoothAngle += minimalDiff * 0.03;
                }
                // Otherwise keep going straight
                shouldBoost = false; // Never boost in severe lag

            } else if (movementStrategy === 'straight') {
                // MODERATE LAG: Prefer straight lines, minimal turning
                if (!LagDetector.shouldAllowTurn(BotController.smoothAngle, targetAngle)) {
                    // Circling detected - force straight
                    // Keep current angle, don't turn
                } else {
                    // Apply heavily smoothed angle change
                    const smoothedTarget = LagDetector.getSmoothAngleChange(BotController.smoothAngle, targetAngle);
                    const diff = Utils.angleDiff(BotController.smoothAngle, smoothedTarget);
                    const turnMultiplier = LagDetector.getTurnSpeedMultiplier();
                    BotController.smoothAngle += diff * 0.08 * turnMultiplier;
                }
                // Only boost in emergencies
                if (!LagDetector.shouldAllowBoost()) {
                    shouldBoost = false;
                }

            } else if (movementStrategy === 'cautious') {
                // MILD LAG: Reduced turning speed
                const turnMultiplier = LagDetector.getTurnSpeedMultiplier();
                // v7.1: Lower threshold - instant turn for evasion actions
                if (bestAction.priority < 500) {  // v7.1: LOWERED from 700
                    const diff = Utils.angleDiff(BotController.smoothAngle, targetAngle);
                    BotController.smoothAngle += diff * 0.18 * turnMultiplier;  // v7.1: FASTER from 0.12
                } else {
                    BotController.smoothAngle = targetAngle;
                }
                // Be careful with boost
                if (!LagDetector.shouldAllowBoost() && !STATE.isTrapped) {
                    shouldBoost = false;
                }

            } else {
                // NORMAL: Standard movement - v7.1: FASTER TURNS FOR EVASION
                // Use priority to determine urgency (high priority = need instant turn)
                if (bestAction.priority < 500) {  // v7.1: LOWERED from 700
                    const diff = Utils.angleDiff(BotController.smoothAngle, targetAngle);
                    // v7.1: FASTER turn speed - was 0.15, now 0.25
                    BotController.smoothAngle += diff * 0.25;
                } else {
                    // Instant turn for high priority evasion
                    BotController.smoothAngle = targetAngle;
                }
            }

            // 5. Apply movement - ALWAYS
            BotController.setAngle(BotController.smoothAngle);
            BotController.setBoost(shouldBoost);

            // Debug: Log that we're actually controlling (every 3 seconds)
            if (Date.now() % 3000 < 50) {
                const lagInfo = STATE.lagDetected ? ` [LAG:${['NONE','MILD','MOD','SEVERE'][STATE.lagLevel]}]` : '';
                console.log(`🤖 Bot moving to angle: ${(BotController.smoothAngle * 180 / Math.PI).toFixed(1)}°${lagInfo}`,
                    'xm:', window.xm?.toFixed(0), 'ym:', window.ym?.toFixed(0));
            }
        },

        setAngle: (angle) => {
            // Check if we can control (slither.io uses 'slither' not 'snake')
            if (!window.playing || (!window.slither && !window.snake)) return;

            // Slither.io movement: set xm/ym which are mouse offsets from screen center
            const distance = 100;

            // Set xm and ym - this is how slither.io reads mouse direction
            window.xm = Math.cos(angle) * distance;
            window.ym = Math.sin(angle) * distance;
        },

        setBoost: (boost) => {
            // ONLY set boost if we're actually playing! (slither.io uses 'slither')
            if (!window.playing || (!window.slither && !window.snake)) return;

            STATE.isBoosting = boost;

            // Method 1: setAcceleration function (slither.io standard)
            if (typeof window.setAcceleration === 'function') {
                try {
                    window.setAcceleration(boost ? 1 : 0);
                } catch(e) {}
            }
        },

        tryRespawn: () => {
            // Only try to respawn if we were previously playing and died
            // Don't interfere with initial game connection
            if (window.connecting === true) return;
            if (!STATE.stats.gamesPlayed > 0 && STATE.stats.deaths === 0) return;

            const isPlaying = window.playing === true;

            if (!isPlaying && STATE.stats.deaths > 0) {
                // Clear overlays before respawn attempt
                if (typeof VisualEnhancements !== 'undefined' && VisualEnhancements.clearAllOverlays) {
                    VisualEnhancements.clearAllOverlays();
                }

                setTimeout(() => {
                    // Try clicking the play button
                    const playBtn = document.querySelector('.nsi');
                    if (playBtn) {
                        playBtn.click();
                        return;
                    }

                    // Try pressing Enter
                    const enterEvent = new KeyboardEvent('keydown', {
                        key: 'Enter',
                        keyCode: 13,
                        bubbles: true
                    });
                    document.dispatchEvent(enterEvent);

                }, CONFIG.bot.respawnDelay);
            }
        }
    };

    // ==================== VISUAL ENHANCEMENTS ====================
    const VisualEnhancements = {
        zoomLevel: 0.9,
        zoomEnabled: true,

        init: () => {
            VisualEnhancements.setupZoom();
            VisualEnhancements.setupMinimap();
            VisualEnhancements.setupOverlay();

            if (CONFIG.visual.darkMode) {
                VisualEnhancements.applyDarkMode();
            }

            if (CONFIG.visual.skins.enabled) {
                VisualEnhancements.enableAllSkins();
            }
        },

        // Clear all overlay artifacts on death/respawn
        clearAllOverlays: () => {
            DEBUG && console.log('%c🧹 Clearing all overlay artifacts...', 'color: #ffff00;');

            // Clear danger canvas (arrows, threat indicators)
            if (STATE.dangerCanvas && STATE.dangerCtx) {
                STATE.dangerCtx.clearRect(0, 0, STATE.dangerCanvas.width, STATE.dangerCanvas.height);
            }

            // Clear minimap
            if (STATE.minimapCanvas && STATE.minimapCtx) {
                STATE.minimapCtx.clearRect(0, 0, STATE.minimapCanvas.width, STATE.minimapCanvas.height);
                // Fill with background color
                STATE.minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                STATE.minimapCtx.fillRect(0, 0, STATE.minimapCanvas.width, STATE.minimapCanvas.height);
            }

            // Clear overlay HTML content
            if (STATE.overlay) {
                STATE.overlay.innerHTML = `
                    <div style="color: #ffff00; text-align: center;">
                        ⏳ Waiting for game...
                    </div>
                `;
            }

            // Clear status bar
            if (STATE.statusBar) {
                STATE.statusBar.innerHTML = `
                    <span style="color: #ffff00;">⏳ Respawning...</span>
                `;
            }

            // Reset visual state trackers
            STATE.lastFrameTime = 0;
            STATE.lastDecision = null;
            STATE.pendingActions = {};

            // Clear any cached threat data
            if (STATE.sensorResults) {
                STATE.sensorResults = {};
            }

            // Reset RiskRewardCalculator caches
            if (typeof RiskRewardCalculator !== 'undefined' && RiskRewardCalculator.snakeSpeedCache) {
                RiskRewardCalculator.snakeSpeedCache = {};
            }

            DEBUG && console.log('%c✅ Overlays cleared', 'color: #00ff00;');
        },

        setupZoom: () => {
            if (!CONFIG.visual.zoom.enabled) return;

            // ULTRA AGGRESSIVE ZOOM - Override gsc constantly and intercept game changes
            let lastGsc = window.gsc;

            // Override every frame
            setInterval(() => {
                if (VisualEnhancements.zoomEnabled && typeof window.gsc !== 'undefined') {
                    window.gsc = VisualEnhancements.zoomLevel;
                }
            }, 10);

            // Also use requestAnimationFrame for smoother override
            const frameLoop = () => {
                if (VisualEnhancements.zoomEnabled && typeof window.gsc !== 'undefined') {
                    window.gsc = VisualEnhancements.zoomLevel;
                }
                requestAnimationFrame(frameLoop);
            };
            requestAnimationFrame(frameLoop);

            DEBUG && console.log('%c🔍 ZOOM READY: [Z]=in [X]=out [V]=toggle [Q]=reset [I]=max in [K]=max out [Mouse Wheel]=zoom', 'color: #00ff00; font-size: 14px;');

            // Global wheel handler - will be reused
            VisualEnhancements.wheelHandler = (e) => {
                if (!VisualEnhancements.zoomEnabled) return;

                // Try to prevent default but don't crash if we can't
                try {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                } catch(err) {}

                const oldZoom = VisualEnhancements.zoomLevel;
                if (e.deltaY < 0) {
                    // Scroll up = zoom in (SMALLER gsc = things look BIGGER)
                    VisualEnhancements.zoomLevel = Math.max(0.1, VisualEnhancements.zoomLevel - 0.05);
                } else {
                    // Scroll down = zoom out (LARGER gsc = see more area)
                    VisualEnhancements.zoomLevel = Math.min(2.5, VisualEnhancements.zoomLevel + 0.05);
                }

                window.gsc = VisualEnhancements.zoomLevel;
                console.log(`🔍 Zoom: ${oldZoom.toFixed(2)} → ${VisualEnhancements.zoomLevel.toFixed(2)}`);

                return false;
            };

            // Add wheel listener to EVERYTHING that might capture it
            const wheelOptions = { passive: false, capture: true };
            window.addEventListener('wheel', VisualEnhancements.wheelHandler, wheelOptions);
            document.addEventListener('wheel', VisualEnhancements.wheelHandler, wheelOptions);
            document.body.addEventListener('wheel', VisualEnhancements.wheelHandler, wheelOptions);

            // Keep trying to add to canvas and any new elements
            const addWheelToElements = () => {
                // Canvas
                const canvas = document.querySelector('canvas');
                if (canvas && !canvas._snakyWheelAdded) {
                    canvas.addEventListener('wheel', VisualEnhancements.wheelHandler, { passive: false });
                    canvas._snakyWheelAdded = true;
                    console.log('🔍 Wheel added to canvas');
                }

                // Game containers
                ['#gameAreaWrapper', '#game-area', '.game-area', '#canvas-container'].forEach(sel => {
                    const el = document.querySelector(sel);
                    if (el && !el._snakyWheelAdded) {
                        el.addEventListener('wheel', VisualEnhancements.wheelHandler, { passive: false });
                        el._snakyWheelAdded = true;
                    }
                });
            };

            // Add listeners repeatedly
            addWheelToElements();
            setInterval(addWheelToElements, 500);

            // Also listen for DOMMouseScroll (Firefox)
            document.addEventListener('DOMMouseScroll', (e) => {
                if (!VisualEnhancements.zoomEnabled) return;
                e.preventDefault();

                const oldZoom = VisualEnhancements.zoomLevel;
                if (e.detail < 0) {
                    VisualEnhancements.zoomLevel = Math.max(0.1, VisualEnhancements.zoomLevel - 0.05);
                } else {
                    VisualEnhancements.zoomLevel = Math.min(2.5, VisualEnhancements.zoomLevel + 0.05);
                }
                window.gsc = VisualEnhancements.zoomLevel;
                console.log(`🔍 Zoom: ${oldZoom.toFixed(2)} → ${VisualEnhancements.zoomLevel.toFixed(2)}`);
            }, { passive: false });

            // mousewheel event for older browsers
            document.addEventListener('mousewheel', (e) => {
                if (!VisualEnhancements.zoomEnabled) return;
                e.preventDefault();

                const oldZoom = VisualEnhancements.zoomLevel;
                if (e.wheelDelta > 0) {
                    VisualEnhancements.zoomLevel = Math.max(0.1, VisualEnhancements.zoomLevel - 0.05);
                } else {
                    VisualEnhancements.zoomLevel = Math.min(2.5, VisualEnhancements.zoomLevel + 0.05);
                }
                window.gsc = VisualEnhancements.zoomLevel;
                console.log(`🔍 Zoom: ${oldZoom.toFixed(2)} → ${VisualEnhancements.zoomLevel.toFixed(2)}`);
            }, { passive: false });
        },

        setupMinimap: () => {
            if (!CONFIG.visual.minimap.enabled) return;

            const canvas = document.createElement('canvas');
            canvas.id = 'snaky-minimap';
            canvas.width = CONFIG.visual.minimap.size;
            canvas.height = CONFIG.visual.minimap.size;
            canvas.style.cssText = `
                position: fixed;
                bottom: 50px;
                right: 10px;
                border: 2px solid #00ff00;
                border-radius: 5px;
                opacity: ${CONFIG.visual.minimap.opacity};
                background: rgba(0, 0, 0, 0.8);
                z-index: 2147483647;
                pointer-events: none;
            `;

            document.body.appendChild(canvas);
            STATE.minimapCanvas = canvas;
            STATE.minimapCtx = canvas.getContext('2d', { willReadFrequently: true });
        },

        updateMinimap: () => {
            if (!STATE.minimapCtx) return;

            const ctx = STATE.minimapCtx;
            const size = CONFIG.visual.minimap.size;
            const mapSize = window.grd ? window.grd * 2 : 43200;

            ctx.clearRect(0, 0, size, size);

            // Draw background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, size, size);

            // Draw boundary circle
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - 5, 0, Math.PI * 2);
            ctx.stroke();

            const scale = size / mapSize;

            // Draw food clusters
            const foods = GameVars.getFoods() || window.foods || [];
            if (foods && foods.length > 0) {
                ctx.fillStyle = '#ffff00';
                for (const food of foods) {
                    if (!food) continue;
                    const x = ((food.xx ?? food.x ?? 0) * scale);
                    const y = ((food.yy ?? food.y ?? 0) * scale);
                    ctx.fillRect(x - 1, y - 1, 2, 2);
                }
            }

            // Draw other snakes
            const snakes = SnakeDetector.getAllSnakes();
            if (snakes && snakes.length > 0) {
                for (const snake of snakes) {
                    if (!snake) continue;

                    ctx.fillStyle = '#ff0000';
                    const x = ((snake.xx ?? snake.x ?? 0) * scale);
                    const y = ((snake.yy ?? snake.y ?? 0) * scale);
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Draw my snake
            const mySnake = SnakeDetector.getMySnake();
            if (mySnake) {
                ctx.fillStyle = '#00ff00';
                const x = ((mySnake.xx ?? mySnake.x ?? 0) * scale);
                const y = ((mySnake.yy ?? mySnake.y ?? 0) * scale);
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();

                // Direction indicator
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(
                    x + Math.cos(mySnake.ang ?? 0) * 15,
                    y + Math.sin(mySnake.ang ?? 0) * 15
                );
                ctx.stroke();
            }
        },

        setupOverlay: () => {
            // Create container - DO NOT block clicks on the game
            const container = document.createElement('div');
            container.id = 'snaky-container';
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                pointer-events: none;
                z-index: 2147483647;
            `;
            document.body.appendChild(container);

            // Top-left detailed overlay - FULLY INFORMATIVE
            const overlay = document.createElement('div');
            overlay.id = 'snaky-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                color: #00ff00;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                background: rgba(0, 0, 0, 0.85);
                padding: 10px;
                border-radius: 8px;
                border: 2px solid #00ff00;
                z-index: 2147483647;
                min-width: 200px;
                max-width: 220px;
                pointer-events: none;
                box-shadow: 0 0 20px rgba(0, 255, 0, 0.4);
            `;
            container.appendChild(overlay);
            STATE.overlay = overlay;

            // HELP POPUP - hidden by default
            const helpPopup = document.createElement('div');
            helpPopup.id = 'snaky-help';
            helpPopup.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #00ff00;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                background: rgba(0, 0, 0, 0.9);
                padding: 15px 20px;
                border-radius: 10px;
                border: 2px solid #00ff00;
                z-index: 2147483647;
                pointer-events: none;
                display: none;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
            `;
            document.body.appendChild(helpPopup);
            STATE.helpPopup = helpPopup;

            // BOTTOM STATUS BAR - Compact and semi-transparent
            const statusBar = document.createElement('div');
            statusBar.id = 'snaky-status-bar';
            statusBar.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 28px;
                background: rgba(0, 0, 0, 0.5);
                border-top: 1px solid rgba(0, 255, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 15px;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                z-index: 2147483647;
                pointer-events: none;
            `;
            container.appendChild(statusBar);
            STATE.statusBar = statusBar;

            // DANGER ARROWS CANVAS - Shows threats around screen edges
            const dangerCanvas = document.createElement('canvas');
            dangerCanvas.id = 'snaky-danger-canvas';
            dangerCanvas.width = window.innerWidth;
            dangerCanvas.height = window.innerHeight;
            dangerCanvas.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 2147483646;
            `;
            document.body.appendChild(dangerCanvas);
            STATE.dangerCanvas = dangerCanvas;
            STATE.dangerCtx = dangerCanvas.getContext('2d', { willReadFrequently: true });

            // Handle resize
            window.addEventListener('resize', () => {
                if (STATE.dangerCanvas) {
                    STATE.dangerCanvas.width = window.innerWidth;
                    STATE.dangerCanvas.height = window.innerHeight;
                }
            });

            // Add persistent styles
            const style = document.createElement('style');
            style.textContent = `
                #snaky-container, #snaky-overlay, #snaky-status-bar, #snaky-minimap {
                    z-index: 2147483647 !important;
                }
                @keyframes snaky-pulse {
                    0%, 100% { opacity: 1; box-shadow: 0 0 10px #00ff00; }
                    50% { opacity: 0.7; box-shadow: 0 0 20px #00ff00; }
                }
                @keyframes snaky-blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                .snaky-pulse {
                    animation: snaky-pulse 1s infinite !important;
                }
                .snaky-blink {
                    animation: snaky-blink 0.5s infinite !important;
                }
            `;
            document.head.appendChild(style);
        },

        // Draw danger arrows and snake predictions - COMPLETELY REWRITTEN
        updateDangerArrows: () => {
            if (!STATE.dangerCtx) return;
            if (!CONFIG.visual.overlay.showDangerArrows) return;

            const ctx = STATE.dangerCtx;
            const w = STATE.dangerCanvas.width;
            const h = STATE.dangerCanvas.height;
            const centerX = w / 2;
            const centerY = h / 2;

            // Clear canvas
            ctx.clearRect(0, 0, w, h);

            // Check if playing - use multiple methods
            if (!window.playing) {
                return;
            }

            // Get head position - try slither first, then snake, then view coords
            let head;
            if (window.slither && typeof window.slither.xx === 'number') {
                head = {
                    x: window.slither.xx,
                    y: window.slither.yy
                };
            } else if (window.snake && typeof window.snake.xx === 'number') {
                head = {
                    x: window.snake.xx,
                    y: window.snake.yy
                };
            } else if (typeof window.view_xx === 'number') {
                // Use camera/view position as fallback
                head = {
                    x: window.view_xx,
                    y: window.view_yy
                };
            } else {
                // Can't determine position
                return;
            }

            // Get nearby snakes directly from window.slithers (slither.io uses 'slithers' not 'snakes')
            const snakesArr = window.slithers || window.snakes || [];
            const mySnake = window.slither || window.snake;
            const nearbySnakes = [];
            const maxDist = CONFIG.collision.detectionRadius * 2;

            for (let i = 0; i < snakesArr.length; i++) {
                const s = snakesArr[i];
                if (!s || s === mySnake || s.dead) continue;
                if (typeof s.xx !== 'number') continue;

                const dist = Math.sqrt((s.xx - head.x) ** 2 + (s.yy - head.y) ** 2);
                if (dist < maxDist) {
                    nearbySnakes.push({
                        snake: s,
                        x: s.xx,
                        y: s.yy,
                        ang: s.ang || 0,
                        sp: s.sp || 11,
                        dist: dist,
                        length: s.sct || (s.pts ? s.pts.length : 10),
                        danger: dist < 100 ? 'CRITICAL' : dist < 200 ? 'HIGH' : dist < 400 ? 'MEDIUM' : 'LOW'
                    });
                }
            }

            // Sort by distance
            nearbySnakes.sort((a, b) => a.dist - b.dist);
            const totalSnakes = snakesArr.filter(s => s && !s.dead).length;

            // Draw info box in top-right (SNAKE RADAR) - v7.1.2: Expanded for aggression data
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(w - 195, 5, 190, 145);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(w - 195, 5, 190, 145);

            ctx.fillStyle = '#00ffff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText('🐍 SNAKE RADAR', w - 190, 22);

            ctx.font = '11px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`Total snakes: ${totalSnakes}`, w - 190, 38);
            ctx.fillText(`Nearby: ${nearbySnakes.length}`, w - 190, 52);

            // Danger level
            const dangerLevel = nearbySnakes.length > 3 ? 'DANGER!' : nearbySnakes.length > 1 ? 'Caution' : 'Safe';
            const dangerColor = nearbySnakes.length > 3 ? '#ff0000' : nearbySnakes.length > 1 ? '#ffff00' : '#00ff00';
            ctx.fillStyle = dangerColor;
            ctx.fillText(`Status: ${dangerLevel}`, w - 190, 66);

            // v7.1.2: Aggressive snakes count
            const aggressiveSnakes = SnakePrediction.getAggressiveSnakes();
            const aggressiveCount = aggressiveSnakes.length;
            ctx.fillStyle = aggressiveCount > 0 ? '#ff0000' : '#888888';
            ctx.fillText(`Aggressive: ${aggressiveCount}`, w - 190, 80);

            // v7.1: Blocked percentage from evasion rings
            const blockedPct = STATE.blockedPercentage || 0;
            const blockedColor = blockedPct > 70 ? '#ff0000' : blockedPct > 40 ? '#ff6600' : blockedPct > 20 ? '#ffff00' : '#00ff00';
            ctx.fillStyle = blockedColor;
            ctx.fillText(`Blocked: ${Math.round(blockedPct)}%`, w - 190, 94);

            // v7.1: Safe gaps available
            const radarSafeGaps = STATE.safeGaps || [];
            const gapCount = radarSafeGaps.filter(g => g.size > 0.3).length;
            ctx.fillStyle = gapCount > 2 ? '#00ff00' : gapCount > 0 ? '#ffff00' : '#ff0000';
            ctx.fillText(`Safe gaps: ${gapCount}`, w - 190, 108);

            ctx.fillStyle = '#888888';
            ctx.fillText(`Zoom: ${(window.gsc || 0.9).toFixed(2)}`, w - 190, 122);

            // v7.1.2: Warning for aggressive snakes
            if (aggressiveCount > 0) {
                const pulse = Math.sin(Date.now() / 120) * 0.3 + 0.7;
                ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
                ctx.font = 'bold 10px monospace';
                const aggrReasons = aggressiveSnakes.slice(0, 2).map(a => a.reasons[0] || 'AGGRESSIVE').join(', ');
                ctx.fillText(`⚠️ ${aggrReasons}`, w - 190, 136);
            }

            // If no nearby snakes, we're done
            if (nearbySnakes.length === 0) {
                // Draw safe indicator
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
                ctx.stroke();
                return;
            }

            // Get game's view coordinates for proper screen positioning
            const gsc = window.gsc || 0.9;
            const viewX = window.view_xx || head.x;
            const viewY = window.view_yy || head.y;

            // Convert world coords to screen coords
            const worldToScreen = (wx, wy) => {
                return {
                    x: centerX + (wx - viewX) * gsc,
                    y: centerY + (wy - viewY) * gsc
                };
            };

            // Draw each nearby snake - CENTERED ON SNAKE HEAD
            nearbySnakes.forEach((info, idx) => {
                const { x, y, ang, sp, dist, length, danger, snake } = info;
                const screenPos = worldToScreen(x, y);

                // Check if on screen or off screen (with margin)
                const margin = 50;
                const onScreen = screenPos.x > -margin && screenPos.x < w + margin &&
                                 screenPos.y > -margin && screenPos.y < h + margin;

                // Set color based on danger level
                let color, glowColor;
                switch(danger) {
                    case 'CRITICAL': color = '#ff0000'; glowColor = 'rgba(255,0,0,0.5)'; break;
                    case 'HIGH': color = '#ff6600'; glowColor = 'rgba(255,102,0,0.4)'; break;
                    case 'MEDIUM': color = '#ffff00'; glowColor = 'rgba(255,255,0,0.3)'; break;
                    default: color = '#00ff00'; glowColor = 'rgba(0,255,0,0.2)';
                }

                // === v7.1.2: Get snake prediction/intent with aggression tracking ===
                const intent = SnakePrediction.analyzeWithAggression(snake, head);
                const isAttacker = intent.isAttacker;
                const wasAggressive = intent.wasAggressive;
                const isBoosting = intent.isCurrentlyBoosting;
                const isIntercepting = intent.intercepting;
                const intentText = intent.intent.toUpperCase();
                const aggressionLevel = intent.aggressionLevel || 0;

                // Override color for attackers and aggressive snakes
                if (isAttacker || wasAggressive) {
                    color = '#ff0000';
                    glowColor = 'rgba(255,0,0,0.6)';
                }
                // Boosting snakes get orange warning
                if (isBoosting && !isAttacker) {
                    color = '#ff6600';
                    glowColor = 'rgba(255,102,0,0.5)';
                }

                if (onScreen) {
                    // === DRAW EXACTLY AT SNAKE HEAD POSITION ===

                    // Outer glow ring - LARGER for attackers/aggressive/boosting
                    const glowSize = (isAttacker || wasAggressive) ? 35 : isBoosting ? 28 : 20;
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y, glowSize, 0, Math.PI * 2);
                    ctx.fillStyle = glowColor;
                    ctx.fill();

                    // v7.1.2: Pulsing ring for aggressive snakes
                    if (wasAggressive || isAttacker) {
                        const pulseSize = glowSize + Math.sin(Date.now() / 100) * 8;
                        ctx.beginPath();
                        ctx.arc(screenPos.x, screenPos.y, pulseSize, 0, Math.PI * 2);
                        ctx.strokeStyle = '#ff0000';
                        ctx.lineWidth = 3;
                        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 80) * 0.3;
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }

                    // v7.1.2: Boost indicator ring
                    if (isBoosting) {
                        ctx.beginPath();
                        ctx.arc(screenPos.x, screenPos.y, glowSize + 10, 0, Math.PI * 2);
                        ctx.strokeStyle = '#ffaa00';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([5, 5]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                    // Main crosshair/target on snake head
                    ctx.strokeStyle = color;
                    ctx.lineWidth = (isAttacker || wasAggressive) ? 4 : 3;

                    // Crosshair lines
                    const crossSize = (isAttacker || wasAggressive) ? 22 : isBoosting ? 18 : 15;
                    ctx.beginPath();
                    ctx.moveTo(screenPos.x - crossSize, screenPos.y);
                    ctx.lineTo(screenPos.x + crossSize, screenPos.y);
                    ctx.moveTo(screenPos.x, screenPos.y - crossSize);
                    ctx.lineTo(screenPos.x, screenPos.y + crossSize);
                    ctx.stroke();

                    // Center dot exactly on snake head
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y, (isAttacker || wasAggressive) ? 8 : 5, 0, Math.PI * 2);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();

                    // Direction arrow showing where snake is heading
                    const arrowLen = (isAttacker || wasAggressive) ? 55 : isBoosting ? 50 : 40;
                    const arrowX = screenPos.x + Math.cos(ang) * arrowLen;
                    const arrowY = screenPos.y + Math.sin(ang) * arrowLen;

                    // Arrow shaft
                    ctx.beginPath();
                    ctx.moveTo(screenPos.x + Math.cos(ang) * 8, screenPos.y + Math.sin(ang) * 8);
                    ctx.lineTo(arrowX, arrowY);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = (isAttacker || wasAggressive) ? 4 : 3;
                    ctx.stroke();

                    // Arrow head
                    ctx.save();
                    ctx.translate(arrowX, arrowY);
                    ctx.rotate(ang);
                    ctx.beginPath();
                    ctx.moveTo(12, 0);
                    ctx.lineTo(-8, -8);
                    ctx.lineTo(-8, 8);
                    ctx.closePath();
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.restore();

                    // === v7.1: ATTACKER ARROW - Draw arrow from snake TO player ===
                    if (isAttacker) {
                        const angleToPlayer = Math.atan2(centerY - screenPos.y, centerX - screenPos.x);

                        // Draw pulsing attack line from snake circle to player center
                        const pulseAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
                        ctx.strokeStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
                        ctx.lineWidth = 4;
                        ctx.setLineDash([10, 5]);

                        ctx.beginPath();
                        const startDist = glowSize + 5;
                        const endDist = Utils.distance(screenPos.x, screenPos.y, centerX, centerY) - 60;
                        ctx.moveTo(
                            screenPos.x + Math.cos(angleToPlayer) * startDist,
                            screenPos.y + Math.sin(angleToPlayer) * startDist
                        );
                        ctx.lineTo(
                            screenPos.x + Math.cos(angleToPlayer) * endDist,
                            screenPos.y + Math.sin(angleToPlayer) * endDist
                        );
                        ctx.stroke();
                        ctx.setLineDash([]);

                        // Draw arrowhead pointing at player
                        const arrowEndX = screenPos.x + Math.cos(angleToPlayer) * endDist;
                        const arrowEndY = screenPos.y + Math.sin(angleToPlayer) * endDist;

                        ctx.save();
                        ctx.translate(arrowEndX, arrowEndY);
                        ctx.rotate(angleToPlayer);
                        ctx.beginPath();
                        ctx.moveTo(15, 0);
                        ctx.lineTo(-10, -10);
                        ctx.lineTo(-5, 0);
                        ctx.lineTo(-10, 10);
                        ctx.closePath();
                        ctx.fillStyle = '#ff0000';
                        ctx.fill();
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        ctx.restore();

                        // v7.1.2: Enhanced ATTACKER/AGGRESSIVE label with status
                        const labelWidth = wasAggressive ? 100 : 80;
                        const labelText = wasAggressive ?
                            (isBoosting ? '🚀 BOOST ATK!' : isIntercepting ? '⚡ INTERCEPT!' : '⚔️ AGGRESSIVE') :
                            (isBoosting ? '🚀 BOOSTING!' : `⚔️ ${intentText}`);

                        ctx.fillStyle = wasAggressive ? 'rgba(200,0,0,0.95)' : 'rgba(255,0,0,0.9)';
                        ctx.fillRect(screenPos.x - labelWidth/2, screenPos.y - 58, labelWidth, 20);
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = wasAggressive ? 2 : 1;
                        ctx.strokeRect(screenPos.x - labelWidth/2, screenPos.y - 58, labelWidth, 20);
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 11px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(labelText, screenPos.x, screenPos.y - 44);

                        // Show aggression duration if historically aggressive
                        if (wasAggressive && aggressionLevel > 0) {
                            ctx.fillStyle = '#ffaaaa';
                            ctx.font = '9px monospace';
                            ctx.fillText(`threat: ${Math.round(aggressionLevel * 100)}%`, screenPos.x, screenPos.y - 68);
                        }
                        ctx.textAlign = 'left';
                    }

                    // Draw advanced prediction path (where snake will be)
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(arrowX, arrowY);

                    // Use SnakePrediction for more accurate path
                    for (let f = 5; f <= 25; f += 5) {
                        const pred = SnakePrediction.predictPosition(snake, f);
                        if (pred) {
                            const predScreen = worldToScreen(pred.x, pred.y);
                            ctx.lineTo(predScreen.x, predScreen.y);
                        }
                    }
                    ctx.strokeStyle = color + '88';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw predicted position marker (where they'll be in ~0.5 sec)
                    const pred15 = SnakePrediction.predictPosition(snake, 15);
                    if (pred15) {
                        const predScreen = worldToScreen(pred15.x, pred15.y);
                        ctx.beginPath();
                        ctx.arc(predScreen.x, predScreen.y, 8, 0, Math.PI * 2);
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 2;
                        ctx.setLineDash([3, 3]);
                        ctx.stroke();
                        ctx.setLineDash([]);

                        // Draw 'X' at predicted position
                        ctx.beginPath();
                        ctx.moveTo(predScreen.x - 5, predScreen.y - 5);
                        ctx.lineTo(predScreen.x + 5, predScreen.y + 5);
                        ctx.moveTo(predScreen.x + 5, predScreen.y - 5);
                        ctx.lineTo(predScreen.x - 5, predScreen.y + 5);
                        ctx.strokeStyle = color + 'AA';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }

                    // Info label - positioned above the marker (skip for attackers - already labeled)
                    if (!isAttacker) {
                        ctx.fillStyle = 'rgba(0,0,0,0.7)';
                        ctx.fillRect(screenPos.x - 25, screenPos.y - 38, 50, 18);
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 10px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${Math.round(dist)}px`, screenPos.x, screenPos.y - 25);
                        ctx.textAlign = 'left';
                    } else {
                        // Show distance for attackers below the attacker label
                        ctx.fillStyle = '#ffaaaa';
                        ctx.font = 'bold 10px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${Math.round(dist)}px`, screenPos.x, screenPos.y - 28);
                        ctx.textAlign = 'left';
                    }

                    // Size comparison and intent below
                    const myLen = SnakeDetector.getSnakeLength(GameScanner.getSnake()) || 10;
                    const sizeText = length > myLen ? `▲${length}` : `▼${length}`;
                    ctx.fillStyle = length > myLen ? '#ff6666' : '#66ff66';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(sizeText, screenPos.x, screenPos.y + 35);

                    // Show intent for non-attackers
                    if (!isAttacker && intent.intent !== 'wandering') {
                        ctx.fillStyle = '#aaaaff';
                        ctx.font = '9px monospace';
                        ctx.fillText(intentText, screenPos.x, screenPos.y + 45);
                    }
                    ctx.textAlign = 'left';

                } else {
                    // Off-screen: draw arrow at edge pointing toward the snake
                    const angleToSnake = Math.atan2(y - head.y, x - head.x);
                    const edgeDist = Math.min(w, h) / 2 - 50;
                    const edgeX = centerX + Math.cos(angleToSnake) * edgeDist;
                    const edgeY = centerY + Math.sin(angleToSnake) * edgeDist;

                    // Draw arrow pointing toward off-screen snake
                    ctx.save();
                    ctx.translate(edgeX, edgeY);
                    ctx.rotate(angleToSnake);

                    // Arrow body
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.moveTo(25, 0);
                    ctx.lineTo(-10, -15);
                    ctx.lineTo(-5, 0);
                    ctx.lineTo(-10, 12);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    ctx.restore();

                    // Distance label near arrow
                    ctx.fillStyle = color;
                    ctx.font = 'bold 10px monospace';
                    ctx.fillText(`${Math.round(dist)}`, edgeX - 10, edgeY + 25);
                }
            });

            // === v7.1: MULTI-RING EVASION SYSTEM ===
            // Draw individual evasion rings for each threat
            const rings = STATE.evasionRings || [];
            const safeGaps = STATE.safeGaps || [];
            const blockedPercentage = STATE.blockedPercentage || 0;

            // First pass: Draw all evasion rings around each snake
            rings.forEach((ring, idx) => {
                const screenPos = worldToScreen(ring.x, ring.y);

                // Only draw if snake is on screen (or close to it)
                const margin = 100;
                const onScreen = screenPos.x > -margin && screenPos.x < w + margin &&
                                 screenPos.y > -margin && screenPos.y < h + margin;

                if (onScreen) {
                    // Calculate screen-space ring radius
                    const screenRadius = ring.radius * gsc;
                    const pulseOffset = Math.sin(Date.now() / 200 + idx) * 3;

                    // Draw outer danger zone ring
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y, screenRadius + pulseOffset, 0, Math.PI * 2);
                    ctx.strokeStyle = ring.color;
                    ctx.lineWidth = ring.isAttacker ? 4 : 2;
                    ctx.globalAlpha = 0.4 + ring.threat * 0.4;
                    ctx.stroke();
                    ctx.globalAlpha = 1;

                    // Draw filled danger zone (semi-transparent)
                    ctx.beginPath();
                    ctx.arc(screenPos.x, screenPos.y, screenRadius + pulseOffset, 0, Math.PI * 2);
                    const threatAlpha = ring.threat * 0.15;
                    ctx.fillStyle = ring.color.replace(')', `, ${threatAlpha})`).replace('rgb', 'rgba');
                    if (ring.color.startsWith('#')) {
                        const r = parseInt(ring.color.slice(1, 3), 16);
                        const g = parseInt(ring.color.slice(3, 5), 16);
                        const b = parseInt(ring.color.slice(5, 7), 16);
                        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${threatAlpha})`;
                    }
                    ctx.fill();

                    // Draw threat value arrow from ring edge toward player
                    const angleToPlayer = Math.atan2(centerY - screenPos.y, centerX - screenPos.x);
                    const arrowStartDist = screenRadius + 5;

                    // Arrow length based on threat (closer = longer arrow reaching toward player)
                    const distToPlayer = Utils.distance(screenPos.x, screenPos.y, centerX, centerY);
                    const arrowLength = Math.min(distToPlayer - 40, ring.threat * 100);

                    if (arrowLength > 20) {
                        const arrowStartX = screenPos.x + Math.cos(angleToPlayer) * arrowStartDist;
                        const arrowStartY = screenPos.y + Math.sin(angleToPlayer) * arrowStartDist;
                        const arrowEndX = screenPos.x + Math.cos(angleToPlayer) * (arrowStartDist + arrowLength);
                        const arrowEndY = screenPos.y + Math.sin(angleToPlayer) * (arrowStartDist + arrowLength);

                        // Draw threat arrow
                        ctx.beginPath();
                        ctx.moveTo(arrowStartX, arrowStartY);
                        ctx.lineTo(arrowEndX, arrowEndY);
                        ctx.strokeStyle = ring.color;
                        ctx.lineWidth = 2 + ring.threat * 2;
                        ctx.globalAlpha = 0.6 + ring.threat * 0.3;
                        ctx.stroke();
                        ctx.globalAlpha = 1;

                        // Arrowhead
                        ctx.save();
                        ctx.translate(arrowEndX, arrowEndY);
                        ctx.rotate(angleToPlayer);
                        ctx.beginPath();
                        ctx.moveTo(10, 0);
                        ctx.lineTo(-6, -5);
                        ctx.lineTo(-6, 5);
                        ctx.closePath();
                        ctx.fillStyle = ring.color;
                        ctx.fill();
                        ctx.restore();

                        // Threat value label
                        const threatPercent = Math.round(ring.threat * 100);
                        ctx.fillStyle = ring.color;
                        ctx.font = 'bold 10px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${threatPercent}%`, arrowEndX, arrowEndY - 8);
                        ctx.textAlign = 'left';
                    }
                }
            });

            // Second pass: Draw ring overlaps (where paths are blocked)
            const overlaps = EvasionRings.getRingOverlaps();
            overlaps.forEach(overlap => {
                const pos1 = worldToScreen(overlap.ring1.x, overlap.ring1.y);
                const pos2 = worldToScreen(overlap.ring2.x, overlap.ring2.y);

                // Draw blocked path between overlapping rings
                ctx.beginPath();
                ctx.moveTo(pos1.x, pos1.y);
                ctx.lineTo(pos2.x, pos2.y);
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.globalAlpha = 0.7;
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1;

                // Draw X at midpoint indicating blocked
                const midX = (pos1.x + pos2.x) / 2;
                const midY = (pos1.y + pos2.y) / 2;
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(midX - 10, midY - 10);
                ctx.lineTo(midX + 10, midY + 10);
                ctx.moveTo(midX + 10, midY - 10);
                ctx.lineTo(midX - 10, midY + 10);
                ctx.stroke();
            });

            // Third pass: Draw blocked angular sectors from player's view
            const blockedAngles = STATE.blockedAngles || [];
            const playerRingRadius = 70;  // Our inner ring showing blocked directions

            // Draw blocked sectors in red
            blockedAngles.forEach(seg => {
                const startAngle = seg.start;
                const endAngle = seg.end;

                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, playerRingRadius, startAngle, endAngle);
                ctx.closePath();
                ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.fill();
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2;
                ctx.stroke();
            });

            // Draw safe gaps in green
            safeGaps.forEach((gap, idx) => {
                if (gap.size > 0.1) {  // Only show significant gaps
                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    ctx.arc(centerX, centerY, playerRingRadius, gap.start, gap.start + gap.size);
                    ctx.closePath();
                    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
                    ctx.fill();
                    ctx.strokeStyle = '#00ff00';
                    ctx.lineWidth = idx === 0 ? 3 : 1;  // Highlight best gap
                    ctx.stroke();

                    // Draw escape arrow for best gap
                    if (idx === 0 && gap.size > 0.3) {
                        const escapeArrowLen = 100;
                        const escapeX = centerX + Math.cos(gap.direction) * escapeArrowLen;
                        const escapeY = centerY + Math.sin(gap.direction) * escapeArrowLen;

                        // Pulsing escape arrow
                        const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;
                        ctx.strokeStyle = `rgba(0, 255, 0, ${pulse})`;
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.moveTo(centerX + Math.cos(gap.direction) * 30, centerY + Math.sin(gap.direction) * 30);
                        ctx.lineTo(escapeX, escapeY);
                        ctx.stroke();

                        // Arrowhead
                        ctx.save();
                        ctx.translate(escapeX, escapeY);
                        ctx.rotate(gap.direction);
                        ctx.beginPath();
                        ctx.moveTo(15, 0);
                        ctx.lineTo(-10, -10);
                        ctx.lineTo(-10, 10);
                        ctx.closePath();
                        ctx.fillStyle = `rgba(0, 255, 0, ${pulse})`;
                        ctx.fill();
                        ctx.restore();

                        // "ESCAPE" label
                        ctx.fillStyle = '#00ff00';
                        ctx.font = 'bold 11px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('ESCAPE', escapeX, escapeY - 15);
                        ctx.textAlign = 'left';
                    }
                }
            });

            // Draw player's center ring (colored by danger)
            const closestDist = nearbySnakes.length > 0 ? nearbySnakes[0].dist : 999;
            const ringColor = blockedPercentage > 70 ? '#ff0000' :
                              blockedPercentage > 40 ? '#ff6600' :
                              blockedPercentage > 20 ? '#ffff00' : '#00ff00';

            ctx.beginPath();
            ctx.arc(centerX, centerY, playerRingRadius, 0, Math.PI * 2);
            ctx.strokeStyle = ringColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Blocked percentage indicator
            if (blockedPercentage > 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(centerX - 50, centerY - playerRingRadius - 25, 100, 20);
                ctx.fillStyle = ringColor;
                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`${Math.round(blockedPercentage)}% BLOCKED`, centerX, centerY - playerRingRadius - 10);
                ctx.textAlign = 'left';

                // Warning for high blockage
                if (blockedPercentage > 60) {
                    const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
                    ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
                    ctx.font = 'bold 14px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText('⚠️ SURROUNDED! ⚠️', centerX, centerY - playerRingRadius - 45);
                    ctx.textAlign = 'left';
                }
            }

            // Boost lock indicator
            if (STATE.boostLocked) {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.9)';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('🚀 BOOST LOCKED', centerX, h - 40);
                ctx.textAlign = 'left';
            }

            // === USER CONTROL / SAFETY OVERRIDE INDICATOR ===
            if (STATE.userWantsControl) {
                // User has control
                ctx.fillStyle = 'rgba(0, 200, 255, 0.9)';
                ctx.fillRect(centerX - 120, h - 70, 240, 25);
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(centerX - 120, h - 70, 240, 25);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('🎮 USER CONTROL (G to release)', centerX, h - 53);
                ctx.textAlign = 'left';
            } else if (STATE.safetyOverrideActive) {
                // Safety override active
                const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;
                ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
                ctx.fillRect(centerX - 140, h - 70, 280, 25);
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                ctx.strokeRect(centerX - 140, h - 70, 280, 25);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`🚨 SAFETY OVERRIDE: ${STATE.safetyOverrideReason}`, centerX, h - 53);
                ctx.textAlign = 'left';
            }

            // === ATTACK MODE / HUNTING INDICATOR ===
            const attackTarget = AttackSystem.currentTarget;
            if (CONFIG.attack.enabled && attackTarget) {
                const targetScreen = worldToScreen(attackTarget.head.x, attackTarget.head.y);

                // Draw hunting target reticle
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.arc(targetScreen.x, targetScreen.y, 40, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Crosshairs
                ctx.beginPath();
                ctx.moveTo(targetScreen.x - 55, targetScreen.y);
                ctx.lineTo(targetScreen.x - 25, targetScreen.y);
                ctx.moveTo(targetScreen.x + 25, targetScreen.y);
                ctx.lineTo(targetScreen.x + 55, targetScreen.y);
                ctx.moveTo(targetScreen.x, targetScreen.y - 55);
                ctx.lineTo(targetScreen.x, targetScreen.y - 25);
                ctx.moveTo(targetScreen.x, targetScreen.y + 25);
                ctx.lineTo(targetScreen.x, targetScreen.y + 55);
                ctx.stroke();

                // Target info
                ctx.fillStyle = '#ff00ff';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`⚔️ ${attackTarget.dist.toFixed(0)}px`, targetScreen.x, targetScreen.y + 55);
                ctx.fillText(`${attackTarget.sizeRatio.toFixed(1)}x`, targetScreen.x, targetScreen.y + 67);

                // Attack mode banner
                ctx.fillStyle = 'rgba(150, 0, 150, 0.8)';
                ctx.fillRect(5, h - 110, 130, 25);
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 2;
                ctx.strokeRect(5, h - 110, 130, 25);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'left';
                ctx.fillText('⚔️ HUNTING MODE', 12, h - 93);
            }

            // === DEAD SNAKE FOOD INDICATOR - "ALWAYS BE EATING!" ===
            const foodTarget = FoodSeeker.currentTarget;
            if (foodTarget && foodTarget.type === 'deadsnake') {
                // Draw HUGE indicator that we found dead snake food!
                const targetScreen = worldToScreen(foodTarget.x, foodTarget.y);

                // Pulsing glow around dead snake food
                const pulse = Math.sin(Date.now() / 100) * 0.3 + 0.7;
                ctx.strokeStyle = `rgba(255, 0, 255, ${pulse})`;
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 5]);
                ctx.beginPath();
                ctx.arc(targetScreen.x, targetScreen.y, 50, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Inner target circle
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(targetScreen.x, targetScreen.y, 25, 0, Math.PI * 2);
                ctx.stroke();

                // Skull marker at center
                ctx.fillStyle = '#ff00ff';
                ctx.font = 'bold 20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('💀', targetScreen.x, targetScreen.y + 7);

                // Draw line from our head to the food
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 3;
                ctx.setLineDash([15, 10]);
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(targetScreen.x, targetScreen.y);
                ctx.stroke();
                ctx.setLineDash([]);

                // DEAD SNAKE FOOD banner at top
                ctx.fillStyle = 'rgba(150, 0, 150, 0.9)';
                ctx.fillRect(centerX - 180, 5, 360, 45);
                ctx.strokeStyle = '#ff00ff';
                ctx.lineWidth = 2;
                ctx.strokeRect(centerX - 180, 5, 360, 45);

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 16px monospace';
                ctx.fillText('💀 DEAD SNAKE FOOD - BOOSTING! 💀', centerX, 25);
                ctx.font = 'bold 12px monospace';
                ctx.fillStyle = '#ffaaff';
                ctx.fillText(`${foodTarget.count} pieces | Size: ${foodTarget.totalSize?.toFixed(0) || '?'} | Dist: ${foodTarget.dist?.toFixed(0) || '?'}px`, centerX, 42);
                ctx.textAlign = 'left';
            }
            // === ENHANCED FOOD STRING VISUALIZATION ===
            // Show ALL monitored food strings with color-coded values
            const allStrings = FoodSeeker.allMonitoredStrings || [];
            if (allStrings.length > 0) {
                // Draw ALL monitored strings (not just the active one)
                for (let i = allStrings.length - 1; i >= 0; i--) {
                    const string = allStrings[i];
                    const startScreen = worldToScreen(string.startX, string.startY);
                    const endScreen = worldToScreen(string.endX, string.endY);

                    // Color based on rank (best = bright green, others fade to yellow/orange)
                    let lineColor, fillColor, alpha;
                    if (i === 0) {
                        // BEST string - bright green, thick line
                        lineColor = '#00ff88';
                        fillColor = '#00ff88';
                        alpha = 1.0;
                    } else if (i === 1) {
                        // Second best - cyan
                        lineColor = '#00ffff';
                        fillColor = '#00ffff';
                        alpha = 0.8;
                    } else if (i === 2) {
                        // Third - yellow
                        lineColor = '#ffff00';
                        fillColor = '#ffff00';
                        alpha = 0.7;
                    } else {
                        // Others - orange to red based on rank
                        const redShift = Math.min((i - 2) * 30, 100);
                        lineColor = `rgb(255, ${180 - redShift}, ${80 - redShift * 0.5})`;
                        fillColor = lineColor;
                        alpha = Math.max(0.3, 0.6 - i * 0.08);
                    }

                    // Draw the food string line
                    ctx.strokeStyle = lineColor;
                    ctx.globalAlpha = alpha;
                    ctx.lineWidth = i === 0 ? 4 : (i < 3 ? 3 : 2);
                    ctx.setLineDash(i === 0 ? [] : [6, 3]);
                    ctx.beginPath();
                    ctx.moveTo(startScreen.x, startScreen.y);
                    ctx.lineTo(endScreen.x, endScreen.y);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw individual food dots along the string
                    if (string.foods && i < 4) { // Only show dots for top 4 strings
                        ctx.fillStyle = fillColor;
                        for (const food of string.foods) {
                            const foodScreen = worldToScreen(food.x, food.y);
                            ctx.beginPath();
                            ctx.arc(foodScreen.x, foodScreen.y, i === 0 ? 4 : 3, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }

                    // Start marker (entry point)
                    ctx.fillStyle = fillColor;
                    ctx.beginPath();
                    ctx.arc(startScreen.x, startScreen.y, i === 0 ? 8 : 6, 0, Math.PI * 2);
                    ctx.fill();

                    // Arrow showing direction of string
                    if (i < 5) {
                        const arrowLen = 12;
                        const arrowAngle = string.direction;
                        const arrowX = startScreen.x + Math.cos(arrowAngle) * 20;
                        const arrowY = startScreen.y + Math.sin(arrowAngle) * 20;

                        ctx.beginPath();
                        ctx.moveTo(arrowX, arrowY);
                        ctx.lineTo(
                            arrowX - Math.cos(arrowAngle - 0.5) * arrowLen,
                            arrowY - Math.sin(arrowAngle - 0.5) * arrowLen
                        );
                        ctx.moveTo(arrowX, arrowY);
                        ctx.lineTo(
                            arrowX - Math.cos(arrowAngle + 0.5) * arrowLen,
                            arrowY - Math.sin(arrowAngle + 0.5) * arrowLen
                        );
                        ctx.strokeStyle = fillColor;
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }

                    // Value label for top strings
                    if (i < 5) {
                        ctx.font = 'bold 9px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillStyle = fillColor;
                        const labelX = (startScreen.x + endScreen.x) / 2;
                        const labelY = (startScreen.y + endScreen.y) / 2 - 10;

                        // Background for readability
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.fillRect(labelX - 35, labelY - 8, 70, 12);

                        // Show food count and food per second (path efficiency)
                        const fps = string.foodPerSecond ? string.foodPerSecond.toFixed(1) : '?';
                        const perfectMark = string.perfectAlign ? '★' : '';
                        ctx.fillStyle = fillColor;
                        ctx.fillText(`#${i + 1}: ${string.length}🍕 ${fps}f/s${perfectMark}`, labelX, labelY);
                    }

                    ctx.globalAlpha = 1.0;
                }

                // === FOOD PATH VISUALIZATION ===
                // Show optimal path for picking up individual food between clusters
                const foodPath = FoodSeeker.cachedFoodPath;
                if (foodPath && foodPath.points && foodPath.points.length > 0) {
                    // Draw path line from head through all food points
                    ctx.strokeStyle = '#00aaff';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 4]);
                    ctx.globalAlpha = 0.8;

                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);

                    let prevScreen = { x: centerX, y: centerY };
                    for (let i = 0; i < foodPath.points.length; i++) {
                        const point = foodPath.points[i];
                        const pointScreen = worldToScreen(point.x, point.y);
                        ctx.lineTo(pointScreen.x, pointScreen.y);
                        prevScreen = pointScreen;
                    }

                    // If there's a main target, draw line to it
                    if (foodPath.targetX && foodPath.targetY) {
                        const targetScreen = worldToScreen(foodPath.targetX, foodPath.targetY);
                        ctx.lineTo(targetScreen.x, targetScreen.y);
                    }

                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Draw food points on path
                    for (let i = 0; i < foodPath.points.length; i++) {
                        const point = foodPath.points[i];
                        const pointScreen = worldToScreen(point.x, point.y);

                        // Color based on reachability
                        ctx.fillStyle = point.reachable ? '#00ffff' : '#00aaff';
                        ctx.globalAlpha = point.reachable ? 1.0 : 0.7;

                        // Draw food marker
                        ctx.beginPath();
                        ctx.arc(pointScreen.x, pointScreen.y, 5 + point.size * 0.3, 0, Math.PI * 2);
                        ctx.fill();

                        // Draw number
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 8px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(`${i + 1}`, pointScreen.x, pointScreen.y + 3);
                    }

                    ctx.globalAlpha = 1.0;
                    ctx.textAlign = 'left';

                    // Path info indicator
                    if (foodPath.includedCount > 0) {
                        const pathInfoX = w - 160;
                        const pathInfoY = STATE.lagDetected ? (STATE.vigilanceLevel > 0.1 ? 230 : 180) :
                                          (STATE.vigilanceLevel > 0.1 ? 180 : 130);

                        ctx.fillStyle = 'rgba(0, 50, 80, 0.85)';
                        ctx.fillRect(pathInfoX - 5, pathInfoY - 3, 160, 45);
                        ctx.strokeStyle = '#00aaff';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(pathInfoX - 5, pathInfoY - 3, 160, 45);

                        ctx.fillStyle = '#00aaff';
                        ctx.font = 'bold 10px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText(`🛤️ FOOD PATH`, pathInfoX + 75, pathInfoY + 10);
                        ctx.fillStyle = '#ffffff';
                        ctx.font = '9px monospace';
                        ctx.fillText(`${foodPath.includedCount}/${foodPath.individualCount} food on path`, pathInfoX + 75, pathInfoY + 24);
                        ctx.fillText(`Value: ${foodPath.totalValue.toFixed(0)} | Eff: ${foodPath.efficiency.toFixed(2)}`, pathInfoX + 75, pathInfoY + 36);
                        ctx.textAlign = 'left';
                    }
                }

                // === CONNECTED FOOD NETWORKS VISUALIZATION ===
                // Build and display connected strings/clusters networks
                const networks = FoodSeeker.buildFoodNetworks();
                if (networks && networks.length > 0) {
                    // Draw connections between network nodes (strings + clusters)
                    for (let ni = 0; ni < Math.min(networks.length, 3); ni++) {
                        const network = networks[ni];
                        const isActive = network.isActive;

                        // Network color based on rank and risk
                        let netColor;
                        const rr = network.riskReward;
                        if (rr && rr.riskLevel === 'CRITICAL') netColor = 'rgba(255, 0, 0, 0.5)';
                        else if (rr && rr.riskLevel === 'HIGH') netColor = 'rgba(255, 100, 0, 0.5)';
                        else if (isActive) netColor = 'rgba(0, 255, 136, 0.7)';
                        else if (ni === 1) netColor = 'rgba(0, 255, 255, 0.5)';
                        else netColor = 'rgba(255, 255, 0, 0.4)';

                        // Draw connections between nodes in this network
                        for (const node of network.nodes) {
                            for (const connId of node.connected) {
                                const connNode = network.nodes.find(n => n.id === connId);
                                if (connNode) {
                                    const startScreen = worldToScreen(node.x, node.y);
                                    const endScreen = worldToScreen(connNode.x, connNode.y);

                                    ctx.strokeStyle = netColor;
                                    ctx.lineWidth = isActive ? 3 : 2;
                                    ctx.setLineDash([10, 5]);
                                    ctx.beginPath();
                                    ctx.moveTo(startScreen.x, startScreen.y);
                                    ctx.lineTo(endScreen.x, endScreen.y);
                                    ctx.stroke();
                                    ctx.setLineDash([]);
                                }
                            }
                        }

                        // Draw network boundary/hull (simplified - just center marker)
                        if (network.nodes.length > 1) {
                            const centerScreen = worldToScreen(network.centerX, network.centerY);

                            // Network center marker
                            ctx.fillStyle = netColor;
                            ctx.globalAlpha = 0.5;
                            ctx.beginPath();
                            ctx.arc(centerScreen.x, centerScreen.y, 15, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.globalAlpha = 1.0;

                            // Network label
                            ctx.fillStyle = isActive ? '#00ff88' : '#aaaaaa';
                            ctx.font = 'bold 9px monospace';
                            ctx.textAlign = 'center';
                            ctx.fillText(`NET${ni + 1}`, centerScreen.x, centerScreen.y + 3);

                            // Risk/Reward info for active network
                            if (isActive && rr) {
                                ctx.fillStyle = rr.riskLevel === 'LOW' ? '#00ff00' :
                                               rr.riskLevel === 'MED' ? '#ffff00' : '#ff6600';
                                ctx.font = '8px monospace';
                                ctx.fillText(`${rr.totalFood.toFixed(0)}🍕 ${rr.riskLevel}`, centerScreen.x, centerScreen.y + 15);
                            }
                        }

                        // === PROJECTED PATH VISUALIZATION (for active network) ===
                        if (isActive && network.path && network.path.length > 1) {
                            // Draw the ACTUAL PROJECTED PATH through the network
                            ctx.strokeStyle = '#00ff00';
                            ctx.lineWidth = 4;
                            ctx.setLineDash([]);
                            ctx.globalAlpha = 0.9;

                            // Draw path from snake head through all network nodes
                            ctx.beginPath();
                            ctx.moveTo(centerX, centerY);

                            for (let pi = 0; pi < network.path.length; pi++) {
                                const pathPoint = network.path[pi];
                                const pointScreen = worldToScreen(pathPoint.x, pathPoint.y);
                                ctx.lineTo(pointScreen.x, pointScreen.y);
                            }
                            ctx.stroke();

                            // Draw waypoint markers along path
                            for (let pi = 0; pi < network.path.length; pi++) {
                                const pathPoint = network.path[pi];
                                const pointScreen = worldToScreen(pathPoint.x, pathPoint.y);

                                // Waypoint marker
                                const wpColor = pathPoint.type === 'string' ? '#00ff88' :
                                               pathPoint.type === 'cluster' ? '#ffff00' : '#00ffff';
                                ctx.fillStyle = wpColor;
                                ctx.beginPath();
                                ctx.arc(pointScreen.x, pointScreen.y, 7, 0, Math.PI * 2);
                                ctx.fill();

                                // Waypoint number
                                ctx.fillStyle = '#000000';
                                ctx.font = 'bold 8px monospace';
                                ctx.textAlign = 'center';
                                ctx.fillText(`${pi + 1}`, pointScreen.x, pointScreen.y + 3);
                            }

                            ctx.globalAlpha = 1.0;
                            ctx.textAlign = 'left';

                            // === PROJECTED PATH INFO PANEL ===
                            const pathPanelX = w - 220;
                            const pathPanelY = 60;
                            const pathPanelW = 210;
                            const pathPanelH = 75;

                            ctx.fillStyle = 'rgba(0, 50, 0, 0.9)';
                            ctx.fillRect(pathPanelX, pathPanelY, pathPanelW, pathPanelH);
                            ctx.strokeStyle = '#00ff00';
                            ctx.lineWidth = 2;
                            ctx.strokeRect(pathPanelX, pathPanelY, pathPanelW, pathPanelH);

                            ctx.fillStyle = '#00ff00';
                            ctx.font = 'bold 11px monospace';
                            ctx.textAlign = 'center';
                            ctx.fillText('📍 PROJECTED PATH', pathPanelX + pathPanelW/2, pathPanelY + 15);

                            ctx.fillStyle = '#ffffff';
                            ctx.font = '10px monospace';
                            const strCount = network.strings.length;
                            const clsCount = network.clusters.length;
                            ctx.fillText(`${strCount} strings + ${clsCount} clusters`, pathPanelX + pathPanelW/2, pathPanelY + 32);
                            ctx.fillText(`Total: ${rr ? rr.totalFood.toFixed(0) : '?'}🍕 | ${rr ? rr.foodPerSecond.toFixed(1) : '?'}f/s`, pathPanelX + pathPanelW/2, pathPanelY + 47);

                            // Risk indicator
                            const riskColor = rr ? (rr.riskLevel === 'LOW' ? '#00ff00' :
                                                   rr.riskLevel === 'MEDIUM' ? '#ffff00' : '#ff6600') : '#888888';
                            ctx.fillStyle = riskColor;
                            ctx.fillText(`Risk: ${rr ? rr.riskLevel : '?'} (${rr ? (rr.riskScore * 100).toFixed(0) : '?'}%)`, pathPanelX + pathPanelW/2, pathPanelY + 62);
                            ctx.textAlign = 'left';
                        }
                    }
                }

                // Food String Monitor Panel (bottom-left) - ENHANCED with Risk/Reward
                const panelX = 5;
                const panelY = h - 220;  // Increased height for risk/reward info
                const panelWidth = 140;  // Wider for risk/reward
                const panelHeight = Math.min(30 + allStrings.length * 22, 210);  // More space per string

                // Panel background
                ctx.fillStyle = 'rgba(0, 30, 0, 0.85)';
                ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 2;
                ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

                // Panel title
                ctx.fillStyle = '#00ff88';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'left';
                ctx.fillText(`🔗 FOOD STRINGS (${allStrings.length})`, panelX + 8, panelY + 15);

                // List top strings with their values AND RISK/REWARD
                const maxShow = Math.min(allStrings.length, 7);
                for (let i = 0; i < maxShow; i++) {
                    const string = allStrings[i];
                    const y = panelY + 32 + i * 20; // Slightly more space for risk/reward

                    // Color indicator based on risk level
                    let indicatorColor;
                    const rr = string.riskReward;
                    if (rr && rr.riskLevel === 'CRIT') indicatorColor = '#ff0000';
                    else if (rr && rr.riskLevel === 'HIGH') indicatorColor = '#ff6600';
                    else if (i === 0) indicatorColor = '#00ff88';
                    else if (i === 1) indicatorColor = '#00ffff';
                    else if (i === 2) indicatorColor = '#ffff00';
                    else indicatorColor = '#ff8800';

                    ctx.fillStyle = indicatorColor;
                    ctx.fillRect(panelX + 8, y - 8, 10, 10);

                    // Perfect alignment indicator
                    if (string.perfectAlign) {
                        ctx.fillStyle = '#00ff00';
                        ctx.fillText('★', panelX + 20, y);
                    }

                    // String info with FPS (Food Per Second) AND RISK/REWARD
                    ctx.fillStyle = i === 0 ? '#ffffff' : '#aaaaaa';
                    ctx.font = i === 0 ? 'bold 9px monospace' : '9px monospace';

                    const alignIcon = string.isInFront ? '→' : '↩';
                    const fps = string.foodPerSecond ? string.foodPerSecond.toFixed(1) : '?';

                    // RISK/REWARD display
                    const riskText = rr ? rr.riskLevel : '?';
                    const rewardText = rr ? rr.reward.toFixed(0) : '?';
                    const riskColor = rr ? (rr.riskLevel === 'LOW' ? '#00ff00' : rr.riskLevel === 'MED' ? '#ffff00' : '#ff6600') : '#888888';

                    // Main info line
                    const info = `#${i + 1} ${string.length}🍕 ${fps}f/s ${alignIcon}`;
                    ctx.fillText(info, panelX + (string.perfectAlign ? 30 : 22), y - 3);

                    // Risk/Reward line
                    ctx.font = '8px monospace';
                    ctx.fillStyle = riskColor;
                    ctx.fillText(`R:${rewardText}`, panelX + 22, y + 8);
                    ctx.fillStyle = riskColor;
                    ctx.fillText(`Risk:${riskText}`, panelX + 70, y + 8);

                    // Safety indicator
                    if (string.isSafe) {
                        ctx.fillStyle = '#00ff00';
                        ctx.fillText('✓', panelX + 120, y + 8);
                    } else {
                        ctx.fillStyle = '#ff0000';
                        ctx.fillText('⚠', panelX + 120, y + 8);
                    }
                }

                // Best string highlight with path efficiency info
                if (allStrings.length > 0) {
                    const best = allStrings[0];
                    ctx.fillStyle = '#00ff88';
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';

                    // Show key metrics: food count, FPS, total time
                    const fps = best.foodPerSecond ? best.foodPerSecond.toFixed(1) : '?';
                    const time = best.totalTime ? best.totalTime.toFixed(1) : '?';
                    const perfectIcon = best.perfectAlign ? ' ★' : '';
                    ctx.fillText(`🎯 BEST: ${best.length}🍕 ${fps}f/s ${time}s${perfectIcon}`, centerX, h - 55);
                    ctx.textAlign = 'left';
                }
            }
            // Fallback for single string display (when using currentTarget)
            else if (foodTarget && foodTarget.type === 'string') {
                const targetScreen = worldToScreen(foodTarget.x, foodTarget.y);
                const endScreen = worldToScreen(foodTarget.endX || foodTarget.x, foodTarget.endY || foodTarget.y);

                // Draw line showing the food string
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 3;
                ctx.setLineDash([8, 4]);
                ctx.beginPath();
                ctx.moveTo(targetScreen.x, targetScreen.y);
                ctx.lineTo(endScreen.x, endScreen.y);
                ctx.stroke();
                ctx.setLineDash([]);

                // Start marker
                ctx.fillStyle = '#00ff88';
                ctx.beginPath();
                ctx.arc(targetScreen.x, targetScreen.y, 8, 0, Math.PI * 2);
                ctx.fill();

                // Food string info
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillStyle = '#00ff88';
                ctx.fillText(`🔗 STRING: ${foodTarget.length} food`, centerX, h - 60);
                ctx.textAlign = 'left';
            }

            // === LAG INDICATOR ===
            // Show lag status when detected
            if (STATE.lagDetected && CONFIG.lagControl && CONFIG.lagControl.enabled) {
                const lagX = w - 160;
                const lagY = 10;
                const lagWidth = 150;
                const lagHeight = 18;

                // Background with color based on lag level
                const lagColors = ['#00ff00', '#ffff00', '#ff8800', '#ff0000'];
                const lagNames = ['OK', 'MILD', 'MODERATE', 'SEVERE'];
                const lagColor = lagColors[STATE.lagLevel] || '#00ff00';

                ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                ctx.fillRect(lagX - 5, lagY - 3, lagWidth + 10, lagHeight + 36);
                ctx.strokeStyle = lagColor;
                ctx.lineWidth = 2;
                ctx.strokeRect(lagX - 5, lagY - 3, lagWidth + 10, lagHeight + 36);

                // Lag level indicator
                ctx.fillStyle = lagColor;
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`⏱️ LAG: ${lagNames[STATE.lagLevel]}`, lagX + lagWidth/2, lagY + 12);

                // Stats
                ctx.fillStyle = '#aaaaaa';
                ctx.font = '9px monospace';
                ctx.fillText(`FPS: ${STATE.fps} | Frame: ${STATE.avgFrameTime.toFixed(0)}ms`, lagX + lagWidth/2, lagY + 26);

                // Movement mode indicator
                const strategy = LagDetector.getMovementStrategy();
                const strategyText = strategy === 'minimal' ? '🐢 MINIMAL MOVE' :
                                    strategy === 'straight' ? '➡️ STRAIGHT ONLY' :
                                    strategy === 'cautious' ? '⚠️ CAUTIOUS' : '✓ NORMAL';
                ctx.fillStyle = lagColor;
                ctx.fillText(strategyText, lagX + lagWidth/2, lagY + 40);
                ctx.textAlign = 'left';

                // Flash effect for severe lag
                if (STATE.lagLevel >= 2 && Date.now() % 600 < 300) {
                    ctx.fillStyle = `rgba(${STATE.lagLevel >= 3 ? '255,0,0' : '255,136,0'}, 0.2)`;
                    ctx.fillRect(lagX - 5, lagY - 3, lagWidth + 10, lagHeight + 36);
                }
            }

            // === PARALLEL VIGILANCE INDICATOR ===
            // Show vigilance level while eating
            const vigilanceLevel = STATE.vigilanceLevel || 0;
            const threatCount = STATE.vigilanceThreatCount || 0;
            if (vigilanceLevel > 0.1) {
                // Vigilance bar (top right) - move down if lag indicator is showing
                const barX = w - 160;
                const barY = STATE.lagDetected ? 130 : 80;
                const barWidth = 150;
                const barHeight = 20;

                // Background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 30);
                ctx.strokeStyle = vigilanceLevel > 0.5 ? '#ff0000' : vigilanceLevel > 0.3 ? '#ffaa00' : '#00ff00';
                ctx.lineWidth = 2;
                ctx.strokeRect(barX - 5, barY - 5, barWidth + 10, barHeight + 30);

                // Bar fill
                const fillWidth = barWidth * vigilanceLevel;
                const barColor = vigilanceLevel > 0.6 ? '#ff0000' :
                                 vigilanceLevel > 0.4 ? '#ff6600' :
                                 vigilanceLevel > 0.2 ? '#ffaa00' : '#00ff00';
                ctx.fillStyle = barColor;
                ctx.fillRect(barX, barY, fillWidth, barHeight);

                // Bar outline
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(barX, barY, barWidth, barHeight);

                // Text
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(`👁️ VIGILANCE: ${(vigilanceLevel * 100).toFixed(0)}%`, barX + barWidth/2, barY + 14);
                ctx.font = '9px monospace';
                ctx.fillText(`${threatCount} threat${threatCount !== 1 ? 's' : ''} detected`, barX + barWidth/2, barY + 35);
                ctx.textAlign = 'left';

                // Flash warning if high threat
                if (vigilanceLevel > 0.5 && Date.now() % 500 < 250) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 30);
                }
            }

            // === DEFENSE MODE INDICATOR ===
            if (STATE.isDefending && DefenseSystem.currentAttacker) {
                const attacker = DefenseSystem.currentAttacker;
                const attackerScreen = worldToScreen(attacker.head.x, attacker.head.y);

                // Draw targeting reticle on attacker
                ctx.strokeStyle = '#ff6600';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(attackerScreen.x, attackerScreen.y, 35, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                // Draw targeting lines
                ctx.beginPath();
                ctx.moveTo(attackerScreen.x - 50, attackerScreen.y);
                ctx.lineTo(attackerScreen.x - 20, attackerScreen.y);
                ctx.moveTo(attackerScreen.x + 20, attackerScreen.y);
                ctx.lineTo(attackerScreen.x + 50, attackerScreen.y);
                ctx.moveTo(attackerScreen.x, attackerScreen.y - 50);
                ctx.lineTo(attackerScreen.x, attackerScreen.y - 20);
                ctx.moveTo(attackerScreen.x, attackerScreen.y + 20);
                ctx.lineTo(attackerScreen.x, attackerScreen.y + 50);
                ctx.stroke();

                // Draw line from us to attacker's predicted position
                const interceptX = attacker.head.x + Math.cos(attacker.head.ang) * attacker.head.sp * 15;
                const interceptY = attacker.head.y + Math.sin(attacker.head.ang) * attacker.head.sp * 15;
                const interceptScreen = worldToScreen(interceptX, interceptY);

                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 4]);
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(interceptScreen.x, interceptScreen.y);
                ctx.stroke();
                ctx.setLineDash([]);

                // Target marker at intercept point
                ctx.fillStyle = '#ffaa00';
                ctx.beginPath();
                ctx.arc(interceptScreen.x, interceptScreen.y, 8, 0, Math.PI * 2);
                ctx.fill();

                // Defense mode banner
                ctx.fillStyle = 'rgba(255, 102, 0, 0.9)';
                ctx.font = 'bold 16px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('🛡️ DEFENSE MODE - TARGETING ATTACKER 🛡️', centerX, 30);
                ctx.font = 'bold 12px monospace';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`Distance: ${attacker.dist.toFixed(0)}px | Threat: ${attacker.threatLevel.toFixed(1)}`, centerX, 50);
                ctx.textAlign = 'left';
            }

            // === SQUEEZE ATTACK WARNING ===
            const squeezeAttack = TrapAvoidance.squeezeAttack;
            if (squeezeAttack && squeezeAttack.severity > 0.3) {
                // Draw pulsing warning border
                const pulseAlpha = 0.5 + Math.sin(Date.now() / 100) * 0.3;
                ctx.strokeStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
                ctx.lineWidth = 8;
                ctx.strokeRect(10, 10, w - 20, h - 20);

                // Draw quadrant indicators showing where the squeeze is
                const quadColors = {
                    NE: squeezeAttack.quadrants.NE > 0 ? '#ff0000' : '#00ff00',
                    NW: squeezeAttack.quadrants.NW > 0 ? '#ff0000' : '#00ff00',
                    SE: squeezeAttack.quadrants.SE > 0 ? '#ff0000' : '#00ff00',
                    SW: squeezeAttack.quadrants.SW > 0 ? '#ff0000' : '#00ff00'
                };

                // Draw quadrant indicators around center
                const qRadius = 130;
                ctx.font = 'bold 14px monospace';
                ctx.textAlign = 'center';

                // NE
                ctx.fillStyle = quadColors.NE;
                ctx.fillText(squeezeAttack.quadrants.NE > 0 ? '🔴' : '🟢', centerX + qRadius * 0.7, centerY - qRadius * 0.7);
                // NW
                ctx.fillStyle = quadColors.NW;
                ctx.fillText(squeezeAttack.quadrants.NW > 0 ? '🔴' : '🟢', centerX - qRadius * 0.7, centerY - qRadius * 0.7);
                // SE
                ctx.fillStyle = quadColors.SE;
                ctx.fillText(squeezeAttack.quadrants.SE > 0 ? '🔴' : '🟢', centerX + qRadius * 0.7, centerY + qRadius * 0.7);
                // SW
                ctx.fillStyle = quadColors.SW;
                ctx.fillText(squeezeAttack.quadrants.SW > 0 ? '🔴' : '🟢', centerX - qRadius * 0.7, centerY + qRadius * 0.7);

                // Squeeze warning text
                ctx.fillStyle = '#ff0000';
                ctx.font = 'bold 18px monospace';
                ctx.fillText('⚠️ SQUEEZE ATTACK! ⚠️', centerX, 70);
                ctx.font = 'bold 12px monospace';
                ctx.fillStyle = '#ffaa00';
                ctx.fillText(`Severity: ${(squeezeAttack.severity * 100).toFixed(0)}% | Escape: ${squeezeAttack.escapeQuadrant}`, centerX, 90);

                // Draw escape arrow
                const escapeLen = 150;
                const escapeX = centerX + Math.cos(squeezeAttack.escapeAngle) * escapeLen;
                const escapeY = centerY + Math.sin(squeezeAttack.escapeAngle) * escapeLen;

                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(escapeX, escapeY);
                ctx.stroke();

                // Escape arrow head
                ctx.save();
                ctx.translate(escapeX, escapeY);
                ctx.rotate(squeezeAttack.escapeAngle);
                ctx.beginPath();
                ctx.moveTo(20, 0);
                ctx.lineTo(-10, -12);
                ctx.lineTo(-10, 12);
                ctx.closePath();
                ctx.fillStyle = '#00ff00';
                ctx.fill();
                ctx.restore();

                ctx.textAlign = 'left';
            }

            // === EDGE WARNING INDICATOR ===
            if (head) {
                const mapRadius = typeof window.grd !== 'undefined' ? window.grd : 21600;
                const mapCenterX = mapRadius;
                const mapCenterY = mapRadius;
                const distFromCenter = Utils.distance(head.x, head.y, mapCenterX, mapCenterY);
                const distFromEdge = mapRadius - distFromCenter;

                if (distFromEdge < 800) {
                    // Calculate direction to edge
                    const awayFromCenter = Utils.angle(mapCenterX, mapCenterY, head.x, head.y);

                    // Draw edge warning indicator on the side we're close to
                    const edgeIndicatorDist = Math.min(w, h) / 2 - 30;
                    const edgeX = centerX + Math.cos(awayFromCenter) * edgeIndicatorDist;
                    const edgeY = centerY + Math.sin(awayFromCenter) * edgeIndicatorDist;

                    // Color based on danger
                    let edgeColor, edgeText;
                    if (distFromEdge < 200) {
                        edgeColor = '#ff0000';
                        edgeText = '☠️ EDGE!';
                    } else if (distFromEdge < 400) {
                        edgeColor = '#ff6600';
                        edgeText = '⚠️ EDGE';
                    } else {
                        edgeColor = '#ffff00';
                        edgeText = '🔶 EDGE';
                    }

                    // Pulsing effect for critical
                    const pulse = distFromEdge < 400 ? 0.5 + Math.sin(Date.now() / 100) * 0.5 : 1;

                    // Draw edge warning bar
                    ctx.fillStyle = `rgba(${distFromEdge < 400 ? '255, 0, 0' : '255, 100, 0'}, ${0.3 * pulse})`;
                    ctx.fillRect(edgeX - 60, edgeY - 20, 120, 40);
                    ctx.strokeStyle = edgeColor;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(edgeX - 60, edgeY - 20, 120, 40);

                    ctx.fillStyle = edgeColor;
                    ctx.font = 'bold 14px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(edgeText, edgeX, edgeY - 3);
                    ctx.font = 'bold 12px monospace';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(`${distFromEdge.toFixed(0)}px`, edgeX, edgeY + 12);
                    ctx.textAlign = 'left';

                    // Draw arrow pointing toward center (escape direction)
                    const toCenter = Utils.angle(head.x, head.y, mapCenterX, mapCenterY);
                    const arrowStartX = centerX + Math.cos(awayFromCenter) * 80;
                    const arrowStartY = centerY + Math.sin(awayFromCenter) * 80;
                    const arrowEndX = centerX + Math.cos(toCenter) * 60;
                    const arrowEndY = centerY + Math.sin(toCenter) * 60;

                    if (distFromEdge < 400) {
                        ctx.strokeStyle = '#00ff00';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(arrowStartX, arrowStartY);
                        ctx.lineTo(arrowEndX, arrowEndY);
                        ctx.stroke();

                        // Arrow head
                        ctx.save();
                        ctx.translate(arrowEndX, arrowEndY);
                        ctx.rotate(toCenter);
                        ctx.beginPath();
                        ctx.moveTo(12, 0);
                        ctx.lineTo(-6, -8);
                        ctx.lineTo(-6, 8);
                        ctx.closePath();
                        ctx.fillStyle = '#00ff00';
                        ctx.fill();
                        ctx.restore();
                    }
                }
            }

            // === WALL DETECTION INDICATOR ===
            if (CONFIG.collision.wallDetectionEnabled) {
                const walls = TrapAvoidance.detectWalls();
                const solidWalls = walls.filter(w => w.isSolid);

                if (solidWalls.length > 0) {
                    // Draw wall indicators
                    for (const wall of solidWalls.slice(0, 3)) {  // Show max 3 walls
                        const wallCenterAngle = (wall.startAngle + wall.endAngle) / 2;
                        const indicatorDist = 90;
                        const wallX = centerX + Math.cos(wallCenterAngle) * indicatorDist;
                        const wallY = centerY + Math.sin(wallCenterAngle) * indicatorDist;

                        // Draw wall arc
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, indicatorDist, wall.startAngle, wall.endAngle);
                        ctx.strokeStyle = wall.minDistance < 200 ? '#ff0000' : '#ff6600';
                        ctx.lineWidth = 8;
                        ctx.stroke();

                        // Wall label
                        ctx.fillStyle = '#ff6600';
                        ctx.font = 'bold 10px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillText('WALL', wallX, wallY);
                        ctx.textAlign = 'left';
                    }

                    // Wall count indicator
                    if (solidWalls.length > 0) {
                        ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
                        ctx.fillRect(5, h - 80, 100, 25);
                        ctx.strokeStyle = '#ff6600';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(5, h - 80, 100, 25);
                        ctx.fillStyle = '#ffffff';
                        ctx.font = 'bold 11px monospace';
                        ctx.fillText(`🧱 WALLS: ${solidWalls.length}`, 12, h - 63);
                    }
                }
            }

            // === ANTI-TRAP RADAR VISUAL ===
            // Draw encirclement percentage indicator with EXIT SPACE monitoring
            const antiTrap = TrapAvoidance.checkAntiTrap();
            if (antiTrap) {
                const encirclePercent = antiTrap.encirclementPercent || 0;
                const exitSpace = antiTrap.exitSpacePercent || 100;
                const largestGap = antiTrap.largestGapDegrees || 360;
                const closingRate = antiTrap.closingRate || 0;
                const radarRadius = 100;

                // Draw radar circle background
                ctx.beginPath();
                ctx.arc(centerX, centerY, radarRadius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw exit gaps (open areas) in GREEN
                if (antiTrap.exitGaps && antiTrap.exitGaps.length > 0) {
                    for (const gap of antiTrap.exitGaps) {
                        const startAngle = gap.startAngle - Math.PI/2;  // Offset to start at top
                        const endAngle = startAngle + (gap.size / 72) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, radarRadius - 5, startAngle, endAngle);
                        ctx.strokeStyle = gap.size > 10 ? '#00ff00' : '#88ff88';
                        ctx.lineWidth = 6;
                        ctx.stroke();
                    }
                }

                // Draw encirclement arc (red portion showing blocked areas)
                if (encirclePercent > 0) {
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radarRadius + 5, -Math.PI/2, -Math.PI/2 + (encirclePercent * Math.PI * 2));
                    const dangerColor = encirclePercent >= 0.45 ? '#ff0000' :
                                       encirclePercent >= 0.25 ? '#ff6600' :
                                       encirclePercent >= 0.15 ? '#ffaa00' : '#ffff00';
                    ctx.strokeStyle = dangerColor;
                    ctx.lineWidth = 8;
                    ctx.stroke();
                }

                // Draw info box for EXIT SPACE
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(centerX - 70, centerY + radarRadius + 25, 140, 60);
                ctx.strokeStyle = exitSpace < 55 ? '#ff0000' : exitSpace < 75 ? '#ffaa00' : '#00ff00';
                ctx.lineWidth = 2;
                ctx.strokeRect(centerX - 70, centerY + radarRadius + 25, 140, 60);

                ctx.textAlign = 'center';
                ctx.font = 'bold 12px monospace';

                // Exit space percentage
                ctx.fillStyle = exitSpace < 55 ? '#ff0000' : exitSpace < 75 ? '#ffaa00' : '#00ff00';
                ctx.fillText(`EXIT: ${exitSpace.toFixed(0)}%`, centerX, centerY + radarRadius + 42);

                // Largest gap
                ctx.fillStyle = largestGap < 90 ? '#ff0000' : largestGap < 120 ? '#ffaa00' : '#ffffff';
                ctx.fillText(`GAP: ${largestGap.toFixed(0)}°`, centerX, centerY + radarRadius + 57);

                // Closing rate (if closing)
                if (closingRate > 0.05) {
                    ctx.fillStyle = closingRate > 0.15 ? '#ff0000' : '#ffaa00';
                    ctx.fillText(`⚡ ${(closingRate*100).toFixed(0)}%/s`, centerX, centerY + radarRadius + 72);
                } else {
                    ctx.fillStyle = '#888888';
                    ctx.fillText(`RATE: STABLE`, centerX, centerY + radarRadius + 72);
                }

                // If trapped, show escape direction and urgency
                if (antiTrap.isTrapped && antiTrap.escapeAngle !== undefined) {
                    const escapeX = centerX + Math.cos(antiTrap.escapeAngle) * (radarRadius + 30);
                    const escapeY = centerY + Math.sin(antiTrap.escapeAngle) * (radarRadius + 30);

                    // Draw escape arrow
                    ctx.save();
                    ctx.translate(escapeX, escapeY);
                    ctx.rotate(antiTrap.escapeAngle);
                    ctx.beginPath();
                    ctx.moveTo(25, 0);
                    ctx.lineTo(-12, -15);
                    ctx.lineTo(-12, 15);
                    ctx.closePath();
                    ctx.fillStyle = '#00ff00';
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();

                    // ESCAPE text with urgency
                    const urgencyText = antiTrap.urgency === 'CRITICAL' ? '🚨 ESCAPE NOW! 🚨' :
                                       antiTrap.urgency === 'HIGH' ? '⚠️ ESCAPE! ⚠️' :
                                       '↪ EVADING';
                    const urgencyColor = antiTrap.urgency === 'CRITICAL' ? '#ff0000' :
                                        antiTrap.urgency === 'HIGH' ? '#ff6600' : '#ffaa00';
                    ctx.fillStyle = urgencyColor;
                    ctx.font = antiTrap.urgency === 'CRITICAL' ? 'bold 18px monospace' : 'bold 14px monospace';
                    ctx.fillText(urgencyText, centerX, centerY - radarRadius - 15);
                }

                ctx.textAlign = 'left';
            }

            // DRAW BOT TARGET DIRECTION ARROW (shows where bot wants to go)
            if (CONFIG.bot.enabled && head) {
                const targetAngle = BotController.smoothAngle;
                const arrowLen = 80;
                const arrowX = centerX + Math.cos(targetAngle) * arrowLen;
                const arrowY = centerY + Math.sin(targetAngle) * arrowLen;

                // Draw line from center to target
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(arrowX, arrowY);
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Draw arrowhead
                ctx.save();
                ctx.translate(arrowX, arrowY);
                ctx.rotate(targetAngle);
                ctx.beginPath();
                ctx.moveTo(15, 0);
                ctx.lineTo(-8, -8);
                ctx.lineTo(-8, 8);
                ctx.closePath();
                ctx.fillStyle = '#00ffff';
                ctx.fill();
                ctx.restore();

                // Label
                ctx.fillStyle = '#00ffff';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('BOT', arrowX, arrowY - 15);
                ctx.textAlign = 'left';
            }
        },

        updateOverlay: () => {
            if (!STATE.overlay) return;

            // More robust game state detection
            const inGame = SnakeDetector.isInGame();
            const head = SnakeDetector.getMyHead();
            const mySnake = SnakeDetector.getMySnake();
            const nearbySnakes = SnakeDetector.getNearbySnakes(500);
            const totalSnakes = SnakeDetector.getAllSnakes().length;
            const foods = window.foods ? window.foods.filter(f => f).length : 0;

            // Calculate FPS color
            const fpsColor = STATE.fps >= 50 ? '#00ff00' : STATE.fps >= 30 ? '#ffff00' : '#ff0000';

            // Game state indicators for debugging
            const gameStateInfo = {
                playing: window.playing,
                hasSnake: !!window.snake,
                snakeDead: window.snake ? window.snake.dead : 'N/A',
                connecting: window.connecting,
                inGame: inGame
            };

            let html = '';

            // HEADER
            html += `<div style="background: linear-gradient(90deg, #006666, #004444); margin: -10px -10px 8px -10px; padding: 8px 10px; border-radius: 6px 6px 0 0;">
                <span style="color: #00ffff; font-weight: bold; font-size: 13px;">🐍 SNAKY BOT</span>
                <span style="float: right; color: ${fpsColor}; font-size: 11px;">${STATE.fps} FPS</span>
            </div>`;

            // BOT STATUS
            html += `<div style="margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Bot:</span>
                    <span style="color: ${CONFIG.bot.enabled ? '#00ff00' : '#ff0000'}; font-weight: bold;">
                        ${CONFIG.bot.enabled ? '● ACTIVE' : '○ OFF'}
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Mode:</span>
                    <span style="color: #ffff00;">${CONFIG.bot.playStyle.toUpperCase()}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Controlling:</span>
                    <span style="color: ${(inGame && CONFIG.bot.enabled) ? '#00ff00' : '#ff6600'};">
                        ${(inGame && CONFIG.bot.enabled) ? '✓ YES' : 'NO - ' + (inGame ? 'Bot off' : 'No game')}
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Boost Lock:</span>
                    <span style="color: ${STATE.boostLocked ? '#00ffff' : '#666666'};">${STATE.boostLocked ? '⚡ ON' : 'OFF'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>xm/ym:</span>
                    <span style="color: #ff88ff; font-size: 9px;">${(window.xm || 0).toFixed(0)}, ${(window.ym || 0).toFixed(0)}</span>
                </div>
            </div>`;

            // Check if we're in game using multiple conditions
            const isPlaying = inGame && head && mySnake;

            if (isPlaying) {
                const myLength = SnakeDetector.getSnakeLength(mySnake);
                const rank = window.rank || '?';
                const danger = (TrapAvoidance.trapScore * 100).toFixed(0);
                const dangerColor = TrapAvoidance.trapScore > 0.5 ? '#ff0000' : TrapAvoidance.trapScore > 0.3 ? '#ffff00' : '#00ff00';

                // === v7.0: Get body collision status ===
                const bodyCollision = ParallelSensors.results.bodyCollision;
                const bodyDanger = bodyCollision ? (bodyCollision.danger * 100).toFixed(0) : 0;
                const bodyDist = bodyCollision ? bodyCollision.nearestDist : null;

                // MY SNAKE STATS
                html += `<div style="border-top: 1px solid #333; padding-top: 8px; margin-bottom: 8px;">
                    <div style="color: #888; font-size: 9px; margin-bottom: 4px;">══ MY SNAKE ══</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2px;">
                        <div>Length: <span style="color: #00ff00; font-weight: bold;">${myLength}</span></div>
                        <div>Rank: <span style="color: #ffff00;">#${rank}</span></div>
                        <div>Speed: <span style="color: #00ffff;">${(head.sp || 11).toFixed(1)}</span></div>
                        <div>Scale: <span style="color: #ff88ff;">${(head.sc || 1).toFixed(2)}</span></div>
                    </div>
                    <div style="margin-top: 3px; color: #666; font-size: 9px;">Pos: ${Math.round(head.x)}, ${Math.round(head.y)}</div>
                </div>`;

                // === v7.0: BODY COLLISION STATUS ===
                if (bodyDanger > 0) {
                    const bodyColor = bodyDanger > 70 ? '#ff0000' : bodyDanger > 40 ? '#ff8800' : '#ffff00';
                    html += `<div style="border-top: 1px solid #ff0000; padding-top: 8px; margin-bottom: 8px; background: rgba(255,0,0,0.1);">
                        <div style="color: #ff4444; font-size: 10px; font-weight: bold;">⚠️ BODY COLLISION WARNING</div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Danger:</span>
                            <span style="color: ${bodyColor}; font-weight: bold;">${bodyDanger}%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Distance:</span>
                            <span style="color: ${bodyColor};">${bodyDist ? bodyDist.toFixed(0) + 'px' : 'N/A'}</span>
                        </div>
                    </div>`;
                }

                // THREAT ASSESSMENT
                html += `<div style="border-top: 1px solid #333; padding-top: 8px; margin-bottom: 8px;">
                    <div style="color: #888; font-size: 9px; margin-bottom: 4px;">══ THREATS ══</div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Danger Level:</span>
                        <span style="color: ${dangerColor}; font-weight: bold;">${danger}%</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Trapped:</span>
                        <span style="color: ${STATE.isTrapped ? '#ff0000' : '#00ff00'};">${STATE.isTrapped ? '⚠️ YES!' : 'No'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span>Active Threats:</span>
                        <span style="color: #ff8800;">${TrapAvoidance.threats.length}</span>
                    </div>
                </div>`;

                // === v7.1: EVASION LOCKOUT STATUS ===
                if (STATE.dangerLockout) {
                    const lockoutColor = STATE.currentDangerLevel > 0.5 ? '#ff0000' : '#ff8800';
                    html += `<div style="border-top: 2px solid ${lockoutColor}; padding-top: 8px; margin-bottom: 8px; background: rgba(255,100,0,0.2); animation: snaky-blink 0.5s ease-in-out infinite;">
                        <div style="color: ${lockoutColor}; font-size: 11px; font-weight: bold; text-align: center;">🔒 EVASION MODE</div>
                        <div style="color: #ffaa00; font-size: 10px; text-align: center;">Food/Attack DISABLED</div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                            <span>Source:</span>
                            <span style="color: #ffff00;">${STATE.currentDangerSource || 'unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Danger:</span>
                            <span style="color: ${lockoutColor}; font-weight: bold;">${(STATE.currentDangerLevel * 100).toFixed(0)}%</span>
                        </div>
                    </div>`;
                }

                // === v7.1.3: RETREAT MODE STATUS ===
                if (STATE.retreatMode) {
                    const safetyScore = STATE.lastEscapeSafetyScore || 0;
                    const safetyColor = safetyScore > 0.6 ? '#00ff00' : safetyScore > 0.3 ? '#ffff00' : '#ff0000';
                    html += `<div style="border-top: 2px solid #ff00ff; padding-top: 8px; margin-bottom: 8px; background: rgba(255,0,255,0.15); animation: snaky-blink 0.3s ease-in-out infinite;">
                        <div style="color: #ff00ff; font-size: 12px; font-weight: bold; text-align: center;">🏃 RETREAT MODE</div>
                        <div style="color: #ffaaff; font-size: 10px; text-align: center;">Finding safe area...</div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                            <span>Escape Safety:</span>
                            <span style="color: ${safetyColor}; font-weight: bold;">${(safetyScore * 100).toFixed(0)}%</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Blocked:</span>
                            <span style="color: #ffaa00;">${(STATE.blockedPercentage || 0).toFixed(0)}%</span>
                        </div>
                    </div>`;
                }

                // NEARBY SNAKES LIST - with scanner debug
                const snakesArr = GameScanner.getSnakes();
                const rawSnakesLen = snakesArr ? snakesArr.length : 0;
                const nonNullSnakes = snakesArr ? snakesArr.filter(s => s !== null).length : 0;
                const validSnakes = snakesArr ? snakesArr.filter(s => s && typeof s.xx === 'number').length : 0;

                html += `<div style="border-top: 1px solid #333; padding-top: 8px; margin-bottom: 8px;">
                    <div style="color: #888; font-size: 9px; margin-bottom: 4px;">══ SCANNER ══</div>
                    <div style="font-size: 9px;">
                        <div>Snake var: <span style="color: #ff88ff;">${GameScanner._snakeVar || 'searching...'}</span></div>
                        <div>Snakes var: <span style="color: #ff88ff;">${GameScanner._snakesVar || 'searching...'}</span></div>
                        <div>Array len: <span style="color: #00ffff;">${rawSnakesLen}</span></div>
                        <div>Valid (has xx): <span style="color: #ffff00;">${validSnakes}</span></div>
                        <div>Detected: <span style="color: #00ff00;">${totalSnakes}</span></div>
                        <div>Nearby: <span style="color: #ff8800;">${nearbySnakes.length}</span></div>
                    </div>
                </div>`;

                html += `<div style="border-top: 1px solid #333; padding-top: 8px; margin-bottom: 8px;">
                    <div style="color: #888; font-size: 9px; margin-bottom: 4px;">══ NEARBY (${nearbySnakes.length}) ══</div>`;

                if (nearbySnakes.length === 0) {
                    html += `<div style="color: #00ff00; font-size: 10px;">✓ Area clear!</div>`;
                } else {
                    // Show closest 5 snakes
                    nearbySnakes.slice(0, 5).forEach((info, i) => {
                        const distColor = info.danger === 'CRITICAL' ? '#ff0000' :
                                         info.danger === 'HIGH' ? '#ff6600' :
                                         info.danger === 'MEDIUM' ? '#ffff00' : '#00ff00';
                        const sizeIcon = info.length > myLength ? '↑' : '↓';
                        const sizeColor = info.length > myLength ? '#ff6666' : '#66ff66';

                        html += `<div style="display: flex; justify-content: space-between; font-size: 10px; padding: 1px 0;">
                            <span style="color: ${distColor};">● ${Math.round(info.dist)}px</span>
                            <span style="color: ${sizeColor};">${sizeIcon}${info.length}</span>
                            <span style="color: #888;">${info.danger}</span>
                        </div>`;
                    });

                    if (nearbySnakes.length > 5) {
                        html += `<div style="color: #666; font-size: 9px;">+${nearbySnakes.length - 5} more...</div>`;
                    }
                }
                html += `</div>`;

                // ACTIVE OPTIONS
                html += `<div style="border-top: 1px solid #333; padding-top: 8px; margin-bottom: 5px;">
                    <div style="color: #888; font-size: 9px; margin-bottom: 4px;">══ OPTIONS ══</div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: 10px;">
                        <span style="color: ${CONFIG.attack.enabled ? '#00ff00' : '#444444'};">⚔️Atk</span>
                        <span style="color: ${CONFIG.collision.enabled ? '#00ff00' : '#444444'};">🛡️Avd</span>
                        <span style="color: ${CONFIG.bot.autoRespawn ? '#00ff00' : '#444444'};">🔄Rsp</span>
                        <span style="color: ${STATE.isBoosting ? '#00ffff' : '#444444'};">🚀Bst</span>
                    </div>
                    <div style="margin-top: 4px;">Zoom: <span style="color: #00ffff;">${VisualEnhancements.zoomLevel.toFixed(2)}</span></div>
                </div>`;

            } else {
                // NOT IN GAME - Show detailed diagnostic
                html += `<div style="border-top: 1px solid #333; padding: 15px 0; text-align: center;">
                    <div style="color: #ff6600; font-size: 12px;">⏳ ${window.connecting ? 'Connecting...' : 'Waiting for game...'}</div>
                    <div style="color: #666; font-size: 10px; margin-top: 5px;">${window.connecting ? 'Please wait' : 'Click Play to start'}</div>
                </div>`;

                // Show detailed detection status for debugging
                html += `<div style="border-top: 1px solid #333; padding-top: 8px;">
                    <div style="color: #888; font-size: 9px; margin-bottom: 4px;">══ GAME STATE ══</div>
                    <div>window.playing: <span style="color: ${window.playing ? '#00ff00' : '#ff0000'};">${window.playing}</span></div>
                    <div>window.snake: <span style="color: ${window.snake ? '#00ff00' : '#ff0000'};">${window.snake ? 'exists' : 'null'}</span></div>
                    ${window.snake ? `<div>snake.dead: <span style="color: ${window.snake.dead ? '#ff0000' : '#00ff00'};">${window.snake.dead}</span></div>` : ''}
                    ${window.snake ? `<div>snake.xx: <span style="color: #00ffff;">${typeof window.snake.xx === 'number' ? window.snake.xx.toFixed(0) : 'undefined'}</span></div>` : ''}
                    <div>isInGame(): <span style="color: ${inGame ? '#00ff00' : '#ff0000'};">${inGame}</span></div>
                </div>`;

                // Show world info
                html += `<div style="border-top: 1px solid #333; padding-top: 8px; margin-top: 5px;">
                    <div style="color: #888; font-size: 9px; margin-bottom: 4px;">══ WORLD ══</div>
                    <div>Snakes in world: <span style="color: #00ffff;">${totalSnakes}</span></div>
                    <div>Foods: <span style="color: #ffff00;">${foods}</span></div>
                    <div>gsc (zoom): <span style="color: #ff88ff;">${window.gsc ? window.gsc.toFixed(2) : 'N/A'}</span></div>
                </div>`;
            }

            // FOOTER
            html += `<div style="border-top: 1px solid #222; margin-top: 8px; padding-top: 5px; color: #444; font-size: 9px; text-align: center;">
                [H] Help | [O] Toggle | [J] Boost Lock
            </div>`;

            STATE.overlay.innerHTML = html;

            // Update bottom status bar
            VisualEnhancements.updateStatusBar();
        },

        updateStatusBar: () => {
            if (!STATE.statusBar) return;

            const head = SnakeDetector.getMyHead();
            const mySnake = SnakeDetector.getMySnake();
            const isAlive = head !== null && mySnake !== null;
            const botEnabled = CONFIG.bot.enabled;

            // === v7.0: Get current risk level from target ===
            const currentTarget = FoodSeeker.currentTarget;
            const currentRisk = currentTarget && currentTarget.riskData ?
                currentTarget.riskData.risk :
                (currentTarget ? currentTarget.foodDanger || 0 : 0);
            const riskColor = currentRisk > 0.6 ? '#ff4444' :
                              currentRisk > 0.3 ? '#ffaa00' :
                              currentRisk > 0.1 ? '#ffff00' : '#44ff44';
            const riskDecision = currentTarget && currentTarget.riskData ?
                currentTarget.riskData.decision : 'N/A';

            // Determine current action - priority order
            let action = '⏳';
            let actionColor = '#888';

            if (STATE.isTrapped) { action = '⚠️ESCAPE'; actionColor = '#f00'; }
            else if (STATE.isEvading && STATE.evasionDanger > 0.7) { action = '🏃EVADE!'; actionColor = '#ff4400'; }
            else if (STATE.isEvading) { action = '↩️EVADE'; actionColor = '#ffaa00'; }
            else if (TrapAvoidance.trapScore > 0.5) { action = '🛡️AVOID'; actionColor = '#ff0'; }
            else if (STATE.boostLocked) { action = '⚡LOCKED'; actionColor = '#0ff'; }
            else if (STATE.isBoosting) { action = '🚀BOOST'; actionColor = '#0ff'; }
            else if (isAlive) { action = '🍎SEEK'; actionColor = '#0f0'; }

            // === v7.0: Add risk indicator ===
            const riskIndicator = currentRisk > 0 ?
                `<span style="color:${riskColor};">⚖️${(currentRisk * 100).toFixed(0)}%</span>` : '';

            const statusHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: ${botEnabled ? '#0f0' : '#f00'}; font-weight: bold;">
                        ${botEnabled ? '●BOT' : '○OFF'}
                    </span>
                    <span style="color: ${actionColor};">${action}</span>
                    ${riskIndicator}
                    ${isAlive ? `<span style="color:#0f0;">${SnakeDetector.getSnakeLength(mySnake)}pts</span>` : ''}
                </div>
                <div style="color: #666;">
                    <span style="color:#ff0;">${CONFIG.bot.playStyle}</span>
                    ${CONFIG.riskReward.enabled ? '<span style="color:#00aaff;">v7.0</span>' : ''}
                    ${CONFIG.attack.enabled ? '⚔️' : ''}${CONFIG.collision.enabled ? '🛡️' : ''}
                    <span style="color:#555;">[H]help</span>
                </div>
            `;

            STATE.statusBar.innerHTML = statusHTML;
        },

        applyDarkMode: () => {
            const style = document.createElement('style');
            style.id = 'snaky-dark-mode';
            style.textContent = `
                body { background: #111 !important; }
                #login, .login { background: rgba(0,0,0,0.8) !important; }
            `;
            document.head.appendChild(style);
        },

        toggleInvertColors: () => {
            // Toggle color inversion state
            STATE.invertColors = !STATE.invertColors;

            // Check if invert style already exists
            let invertStyle = document.getElementById('snaky-invert-colors');

            if (STATE.invertColors) {
                // Create invert style if not exists
                if (!invertStyle) {
                    invertStyle = document.createElement('style');
                    invertStyle.id = 'snaky-invert-colors';
                    document.head.appendChild(invertStyle);
                }
                // Apply inversion to game canvas and body
                invertStyle.textContent = `
                    canvas {
                        filter: invert(1) hue-rotate(180deg) !important;
                    }
                    body {
                        background-color: #000 !important;
                    }
                    /* Keep our overlay normal */
                    #snaky-container, #snaky-overlay, #snaky-status-bar, #snaky-minimap, #snaky-help-popup {
                        filter: none !important;
                    }
                    #snaky-danger-canvas {
                        filter: none !important;
                    }
                `;
                DEBUG && console.log(`%c🌈 Colors INVERTED`, 'color: #ff00ff; font-size: 14px;');
            } else {
                // Remove inversion
                if (invertStyle) {
                    invertStyle.textContent = '';
                }
                DEBUG && console.log(`%c🌈 Colors NORMAL`, 'color: #00ffff; font-size: 14px;');
            }
        },

        enableAllSkins: () => {
            // Unlock all skins
            if (typeof window.localStorage !== 'undefined') {
                window.localStorage.setItem('edttsg', '1');
            }

            // Set custom skin
            setTimeout(() => {
                if (typeof window.setSkin === 'function') {
                    window.setSkin(CONFIG.visual.skins.customSkin);
                }
            }, 1000);
        }
    };

    // ==================== INPUT HANDLING ====================
    const InputHandler = {
        init: () => {
            document.addEventListener('keydown', InputHandler.onKeyDown);
            document.addEventListener('keyup', InputHandler.onKeyUp);
            document.addEventListener('mousedown', InputHandler.onMouseDown);
            document.addEventListener('mouseup', InputHandler.onMouseUp);
        },

        onKeyDown: (e) => {
            // Don't capture if typing in input
            if (e.target.tagName === 'INPUT') return;

            switch (e.key.toLowerCase()) {
                case 'b':
                    // Toggle bot on/off
                    CONFIG.bot.enabled = !CONFIG.bot.enabled;
                    console.log(`🤖 Bot: ${CONFIG.bot.enabled ? 'ENABLED' : 'DISABLED'}`);
                    break;

                case 'z':
                    // Zoom in (smaller value = more zoomed in, things look BIGGER)
                    VisualEnhancements.zoomLevel = Math.max(0.1, VisualEnhancements.zoomLevel - 0.1);
                    window.gsc = VisualEnhancements.zoomLevel; // Force immediate
                    DEBUG && console.log(`%c🔍 ZOOM IN: ${VisualEnhancements.zoomLevel.toFixed(2)} (gsc=${window.gsc})`, 'color: #00ff00; font-size: 14px;');
                    break;

                case 'x':
                    // Zoom out (larger value = more zoomed out, see MORE area)
                    VisualEnhancements.zoomLevel = Math.min(2.5, VisualEnhancements.zoomLevel + 0.1);
                    window.gsc = VisualEnhancements.zoomLevel; // Force immediate
                    DEBUG && console.log(`%c🔍 ZOOM OUT: ${VisualEnhancements.zoomLevel.toFixed(2)} (gsc=${window.gsc})`, 'color: #00ff00; font-size: 14px;');
                    break;

                case '0':
                    // Toggle zoom on/off (changed from V to 0)
                    VisualEnhancements.zoomEnabled = !VisualEnhancements.zoomEnabled;
                    DEBUG && console.log(`%c🔍 Zoom: ${VisualEnhancements.zoomEnabled ? 'ENABLED' : 'DISABLED (game default)'}`, 'color: #ffff00; font-size: 14px;');
                    break;

                case 'm':
                    // Toggle minimap
                    CONFIG.visual.minimap.enabled = !CONFIG.visual.minimap.enabled;
                    if (STATE.minimapCanvas) {
                        STATE.minimapCanvas.style.display = CONFIG.visual.minimap.enabled ? 'block' : 'none';
                    }
                    console.log(`🗺️ Minimap: ${CONFIG.visual.minimap.enabled ? 'ON' : 'OFF'}`);
                    break;

                case 'o':
                    // Toggle overlay
                    CONFIG.visual.overlay.enabled = !CONFIG.visual.overlay.enabled;
                    if (STATE.overlay) {
                        STATE.overlay.style.display = CONFIG.visual.overlay.enabled ? 'block' : 'none';
                    }
                    console.log(`📊 Overlay: ${CONFIG.visual.overlay.enabled ? 'ON' : 'OFF'}`);
                    break;

                case 'a':
                    // Toggle attack mode
                    CONFIG.attack.enabled = !CONFIG.attack.enabled;
                    console.log(`⚔️ Attack Mode: ${CONFIG.attack.enabled ? 'ON' : 'OFF'}`);
                    break;

                case 'r':
                    // Toggle auto-respawn
                    CONFIG.bot.autoRespawn = !CONFIG.bot.autoRespawn;
                    console.log(`🔄 Auto-Respawn: ${CONFIG.bot.autoRespawn ? 'ON' : 'OFF'}`);
                    break;

                case 'p':
                    // Cycle play style
                    const styles = ['balanced', 'aggressive', 'defensive', 'farming'];
                    const currentIndex = styles.indexOf(CONFIG.bot.playStyle);
                    CONFIG.bot.playStyle = styles[(currentIndex + 1) % styles.length];
                    InputHandler.applyPlayStyle();
                    console.log(`🎮 Play Style: ${CONFIG.bot.playStyle.toUpperCase()}`);
                    break;

                case 'c':
                    // Toggle collision avoidance
                    CONFIG.collision.enabled = !CONFIG.collision.enabled;
                    console.log(`🛡️ Collision Avoidance: ${CONFIG.collision.enabled ? 'ON' : 'OFF'}`);
                    break;

                case 'q':
                    // Quick zoom reset to default
                    VisualEnhancements.zoomLevel = 0.9;
                    window.gsc = 0.9;
                    DEBUG && console.log(`%c🔍 Zoom RESET to 0.9`, 'color: #00ffff; font-size: 14px;');
                    break;

                case 'f':
                    // Toggle FPS boost mode (low graphics)
                    CONFIG.visual.fps.boostMode = !CONFIG.visual.fps.boostMode;
                    if (CONFIG.visual.fps.boostMode) {
                        window.want_quality = 0;
                        window.high_quality = false;
                        if (window.render_mode !== undefined) window.render_mode = 1;
                        DEBUG && console.log(`%c⚡ FPS BOOST MODE ON - Graphics reduced`, 'color: #ffff00; font-size: 14px;');
                    } else {
                        window.want_quality = 2;
                        window.high_quality = true;
                        DEBUG && console.log(`%c🖼️ FPS BOOST MODE OFF - Graphics restored`, 'color: #00ff00; font-size: 14px;');
                    }
                    break;

                case 'u':
                    // Emergency U-turn (180 degree turn)
                    if (GameVars.isGameReady()) {
                        const head = SnakeDetector.getMyHead();
                        if (head) {
                            BotController.smoothAngle = head.ang + Math.PI;
                            DEBUG && console.log(`%c↩️ EMERGENCY U-TURN!`, 'color: #ff0000; font-size: 16px;');
                        }
                    }
                    break;

                case 'l':
                    // Toggle circle/loop mode for trapping
                    CONFIG.bot.circleMode = !CONFIG.bot.circleMode;
                    console.log(`🔄 Circle Mode: ${CONFIG.bot.circleMode ? 'ON - Will try to encircle targets' : 'OFF'}`);
                    break;

                case 'd':
                    // Toggle color inversion on the game canvas
                    VisualEnhancements.toggleInvertColors();
                    break;

                case 'g':
                    // Cycle graphics quality
                    const qualities = ['low', 'medium', 'high'];
                    const qIndex = qualities.indexOf(CONFIG.visual.graphicsQuality);
                    CONFIG.visual.graphicsQuality = qualities[(qIndex + 1) % qualities.length];
                    InputHandler.applyGraphicsQuality();
                    console.log(`🖼️ Graphics: ${CONFIG.visual.graphicsQuality.toUpperCase()}`);
                    break;

                case 'i':
                    // Instant max zoom in
                    VisualEnhancements.zoomLevel = 0.2;
                    window.gsc = 0.2;
                    DEBUG && console.log(`%c🔍 MAX ZOOM IN: 0.2`, 'color: #00ff00; font-size: 14px;');
                    break;

                case 'k':
                    // Instant max zoom out
                    VisualEnhancements.zoomLevel = 2.0;
                    window.gsc = 2.0;
                    DEBUG && console.log(`%c🔍 MAX ZOOM OUT: 2.0`, 'color: #00ff00; font-size: 14px;');
                    break;

                case 's':
                    // Show stats
                    InputHandler.showStats();
                    break;

                case 'h':
                    // Toggle help popup on screen
                    e.preventDefault();
                    e.stopPropagation();
                    InputHandler.toggleHelp();
                    break;

                case 'n':
                    // Next skin
                    CONFIG.visual.skins.customSkin = (CONFIG.visual.skins.customSkin + 1) % 40;
                    if (typeof window.setSkin === 'function') {
                        window.setSkin(CONFIG.visual.skins.customSkin);
                    }
                    console.log(`🎨 Skin: ${CONFIG.visual.skins.customSkin}`);
                    break;

                case 'escape':
                    // Manual override - take control from bot temporarily
                    STATE.manualOverride = true;
                    console.log('🎮 Manual control active (release to resume bot)');
                    break;

                case 't':
                    // Debug info
                    console.log('=== SNAKY BOT DEBUG ===');
                    console.log('Config:', CONFIG);
                    console.log('Stats:', STATE.stats);
                    console.log('Trap Analysis:', TrapAvoidance.analyze());
                    console.log('Game Diagnostics:', GameVars.getDiagnostics());
                    console.log('========================');
                    break;

                case 'e':
                    // Toggle danger arrows
                    CONFIG.visual.overlay.showDangerArrows = !CONFIG.visual.overlay.showDangerArrows;
                    if (!CONFIG.visual.overlay.showDangerArrows && STATE.dangerCtx) {
                        STATE.dangerCtx.clearRect(0, 0, STATE.dangerCanvas.width, STATE.dangerCanvas.height);
                    }
                    DEBUG && console.log(`%c⚠️ Danger Arrows: ${CONFIG.visual.overlay.showDangerArrows ? 'ON' : 'OFF'}`,
                        `color: ${CONFIG.visual.overlay.showDangerArrows ? '#00ff00' : '#ff0000'}; font-size: 14px;`);
                    console.log('Debug - dangerCtx exists:', !!STATE.dangerCtx);
                    console.log('Debug - playing:', window.playing, 'snake:', !!window.snake);
                    break;

                case 'w':
                    // Toggle food highlight on minimap
                    CONFIG.visual.overlay.showFoodHighlight = !CONFIG.visual.overlay.showFoodHighlight;
                    console.log(`🍎 Food Highlight: ${CONFIG.visual.overlay.showFoodHighlight ? 'ON' : 'OFF'}`);
                    break;

                case 'v':
                    // DEEP SCAN - Find all game variables (debug feature)
                    if (DEBUG) {
                        DEBUG && console.log('%c🔬 Running deep variable scan...', 'color: #ff00ff; font-size: 14px;');
                        GameScanner.deepScan();
                    }
                    break;

                case 'j':
                    // Toggle boost lock
                    STATE.boostLocked = !STATE.boostLocked;
                    DEBUG && console.log(`%c🚀 BOOST LOCK: ${STATE.boostLocked ? 'ON - Moving faster!' : 'OFF'}`,
                        `color: ${STATE.boostLocked ? '#00ffff' : '#888'}; font-size: 14px;`);
                    break;

                case 'g':
                    // INSTANT USER CONTROL TOGGLE - Press G to take control, press again to release
                    STATE.userWantsControl = !STATE.userWantsControl;
                    if (STATE.userWantsControl) {
                        STATE.safetyOverrideActive = false;  // User insists on control
                        DEBUG && console.log(`%c🎮 USER CONTROL - You have the wheel! (Press G to release)`,
                            'color: #00ffff; font-size: 16px; font-weight: bold;');
                    } else {
                        DEBUG && console.log(`%c🤖 BOT CONTROL RESUMED`,
                            'color: #ffff00; font-size: 14px;');
                    }
                    break;

                case 'f':
                    // FORCE override safety (risky!) - press to temporarily ignore safety
                    STATE.userWantsControl = true;
                    STATE.safetyOverrideActive = false;
                    DEBUG && console.log(`%c⚠️ FORCE CONTROL - Safety override disabled! (Release G to re-enable)`,
                        'color: #ff6600; font-size: 14px;');
                    break;

                case ' ':
                    // Manual boost while held
                    if (GameVars.isGameReady()) {
                        STATE.manualBoost = true;
                    }
                    break;
            }
        },

        onKeyUp: (e) => {
            switch (e.key.toLowerCase()) {
                case 'escape':
                    STATE.manualOverride = false;
                    console.log('🤖 Bot control resumed');
                    break;
                case ' ':
                    STATE.manualBoost = false;
                    break;
                case 'f':
                    // Release force control
                    if (STATE.userWantsControl && e.key.toLowerCase() === 'f') {
                        // Only release if F was used, not G toggle
                    }
                    break;
            }
        },

        onMouseDown: (e) => {
            const now = Date.now();

            // Left double-click to toggle boost lock
            if (e.button === 0) {
                if (now - STATE.lastClickTime < 300) {
                    // Double-click detected!
                    STATE.boostLocked = !STATE.boostLocked;
                    DEBUG && console.log(`%c🚀 BOOST LOCK: ${STATE.boostLocked ? 'ON - Moving faster!' : 'OFF'}`,
                        `color: ${STATE.boostLocked ? '#00ffff' : '#888'}; font-size: 14px;`);
                }
                STATE.lastClickTime = now;
            }

            // Right-click for manual boost
            if (e.button === 2 && GameVars.isGameReady()) {
                STATE.manualBoost = true;
            }
        },

        onMouseUp: (e) => {
            if (e.button === 2) {
                STATE.manualBoost = false;
            }
        },

        applyPlayStyle: () => {
            switch (CONFIG.bot.playStyle) {
                case 'aggressive':
                    CONFIG.attack.enabled = true;
                    CONFIG.attack.minSizeAdvantage = 1.2;
                    CONFIG.collision.detectionRadius = 250;
                    CONFIG.movement.foodSeekRadius = 400;
                    break;
                case 'defensive':
                    CONFIG.attack.enabled = false;
                    CONFIG.collision.detectionRadius = 450;
                    CONFIG.collision.criticalZoneRadius = 150;
                    CONFIG.movement.foodSeekRadius = 300;
                    break;
                case 'farming':
                    CONFIG.attack.enabled = false;
                    CONFIG.collision.detectionRadius = 350;
                    CONFIG.movement.foodSeekRadius = 700;
                    CONFIG.movement.boostThreshold = 9999; // Never boost
                    break;
                case 'balanced':
                default:
                    CONFIG.attack.enabled = true;
                    CONFIG.attack.minSizeAdvantage = 1.5;
                    CONFIG.collision.detectionRadius = 350;
                    CONFIG.movement.foodSeekRadius = 500;
                    CONFIG.movement.boostThreshold = 1500;
                    break;
            }
        },

        applyGraphicsQuality: () => {
            switch (CONFIG.visual.graphicsQuality) {
                case 'low':
                    if (window.want_quality !== undefined) window.want_quality = 0;
                    if (window.high_quality !== undefined) window.high_quality = false;
                    break;
                case 'medium':
                    if (window.want_quality !== undefined) window.want_quality = 1;
                    break;
                case 'high':
                    if (window.want_quality !== undefined) window.want_quality = 2;
                    if (window.high_quality !== undefined) window.high_quality = true;
                    break;
            }
        },

        showStats: () => {
            const sessionTime = Math.floor((Date.now() - STATE.stats.sessionStart) / 1000);
            const mins = Math.floor(sessionTime / 60);
            const secs = sessionTime % 60;

            DEBUG && console.log('%c=== SESSION STATS ===', 'color: #00ffff; font-size: 14px;');
            console.log(`🎮 Games Played: ${STATE.stats.gamesPlayed}`);
            console.log(`💀 Deaths: ${STATE.stats.deaths}`);
            console.log(`🏆 Max Length: ${STATE.stats.maxLength}`);
            console.log(`⏱️ Session Time: ${mins}m ${secs}s`);
            DEBUG && console.log('%c=====================', 'color: #00ffff;');
        },

        toggleHelp: () => {
            if (!STATE.helpPopup) return;
            const isVisible = STATE.helpPopup.style.display !== 'none';
            STATE.helpPopup.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                STATE.helpPopup.innerHTML = `
                    <div style="text-align: center; margin-bottom: 10px; font-size: 14px; color: #00ffff; font-weight: bold;">
                        🐍 SNAKY BOT v7.0 - AGGRESSIVE 🐍
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <div style="color: #ff00ff; margin-bottom: 5px;">⚔️ CONTROL</div>
                            <div>[G] User control toggle</div>
                            <div>[F] Force control (hold)</div>
                            <div>[ESC] Temp override</div>
                            <div style="color: #ffff00; margin-top: 5px;">BOT</div>
                            <div>[B] Bot ON/OFF</div>
                            <div>[P] Play style</div>
                            <div>[A] Attack mode</div>
                            <div>[C] Collision avoid</div>
                            <div>[R] Auto-respawn</div>
                        </div>
                        <div>
                            <div style="color: #ffff00; margin-bottom: 5px;">🚀 MOVEMENT</div>
                            <div>[SPACE] Boost (hold)</div>
                            <div>[J] Boost lock</div>
                            <div>[U] U-turn 180°</div>
                            <div>[DblClick] Boost lock</div>
                            <div style="color: #ffff00; margin-top: 5px;">ZOOM</div>
                            <div>[Z/X] Zoom in/out</div>
                            <div>[Q] Reset zoom</div>
                            <div>[I/K] Max in/out</div>
                        </div>
                        <div>
                            <div style="color: #ffff00; margin-bottom: 5px;">👁️ VISUAL</div>
                            <div>[M] Minimap</div>
                            <div>[O] Overlay</div>
                            <div>[E] Danger arrows</div>
                            <div>[W] Food highlight</div>
                            <div>[D] Invert colors</div>
                            <div>[N] Next skin</div>
                        </div>
                        <div>
                            <div style="color: #ffff00; margin-bottom: 5px;">🔧 DEBUG</div>
                            <div>[V] Scan variables</div>
                            <div>[S] Stats</div>
                            <div>[T] Debug info</div>
                            <div>[H] This help</div>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 8px; padding: 5px; background: rgba(255,0,255,0.2); border-radius: 4px;">
                        <div style="color: #ff00ff; font-weight: bold;">🎮 QUICK REFERENCE</div>
                        <div style="color: #00ff00; font-size: 10px;">[G] = Toggle your control | Safety auto-overrides in danger</div>
                        <div style="color: #ffaa00; font-size: 10px;">Bot hunts smaller snakes & eats dead snake food!</div>
                    </div>
                    <div style="text-align: center; margin-top: 5px; color: #888; font-size: 9px;">
                        Press [H] to close
                    </div>
                `;
            }
            console.log(`📖 Help: ${isVisible ? 'HIDDEN' : 'SHOWN'}`);
        },

        showHelp: () => {
            InputHandler.toggleHelp();
        }
    };

    // ==================== MAIN LOOP ====================
    const MainLoop = {
        frameId: null,
        // Performance tracking
        _frameStart: 0,
        _frameTimes: new Float32Array(60),  // Rolling 60-frame timing
        _frameTimeIndex: 0,
        _avgFrameTime: 16,
        _lastVisualUpdate: 0,
        _visualUpdateInterval: 50,  // Update visuals every 50ms (20fps) when lagging

        // Adaptive processing thresholds
        FRAME_TIME_TARGET: 12,      // Target 12ms per frame (leaves headroom for 60fps)
        FRAME_TIME_CRITICAL: 25,    // Above this = skip non-essential work
        FRAME_TIME_EMERGENCY: 40,   // Above this = minimal processing only

        start: () => {
            console.log('🚀 Main loop starting with HIGH PERFORMANCE mode...');
            MainLoop.update();
        },

        update: () => {
            // CRITICAL: Always schedule next frame FIRST to prevent freeze
            MainLoop.frameId = requestAnimationFrame(MainLoop.update);

            // Track frame timing for adaptive processing
            const frameStart = performance.now();
            const now = Date.now();

            // Reset object pools at frame start
            ObjectPool.resetFrame();

            try {
                // Fast FPS counter
                STATE.frameCount++;
                if (now - STATE.lastFpsTime >= 1000) {
                    STATE.fps = STATE.frameCount;
                    STATE.frameCount = 0;
                    STATE.lastFpsTime = now;
                    STATE.errorCount = 0;

                    // Calculate average frame time
                    let sum = 0;
                    for (let i = 0; i < 60; i++) sum += MainLoop._frameTimes[i];
                    MainLoop._avgFrameTime = sum / 60;
                }

                // Update game state (fast check)
                STATE.playing = window.playing === true;

                // AGGRESSIVE SCANNING: If playing but no snake, keep scanning!
                if (STATE.playing && !GameVars.isGameReady()) {
                    if (now - STATE.lastVarScan > 500) {
                        STATE.lastVarScan = now;
                        GameScanner.scan();
                    }
                }

                // Debug logging (throttled heavily)
                if (CONFIG.debug.enabled && now - STATE.lastDebugTime >= CONFIG.debug.logInterval) {
                    STATE.lastDebugTime = now;
                    const diag = GameVars.getDiagnostics();
                    console.log('🐍 Bot Status:', diag);
                }

                // === CRITICAL PATH: Bot Logic ===
                // This is time-sensitive - run with minimal overhead
                try {
                    BotController.update();
                } catch (botError) {
                    STATE.errorCount = (STATE.errorCount || 0) + 1;
                    if (STATE.errorCount < 5) {
                        console.error('%c❌ BOT ERROR:', 'color: #ff0000;', botError.message);
                    }
                    STATE.lastDecision = null;
                    ParallelSensors.results = {};
                }

                // === NON-CRITICAL: Visual Updates ===
                // Throttle visuals when frame time is high
                const frameTimeNow = performance.now() - frameStart;
                const shouldUpdateVisuals = frameTimeNow < MainLoop.FRAME_TIME_CRITICAL ||
                    (now - MainLoop._lastVisualUpdate > MainLoop._visualUpdateInterval);

                if (shouldUpdateVisuals) {
                    MainLoop._lastVisualUpdate = now;
                    try {
                        VisualEnhancements.updateMinimap();
                        VisualEnhancements.updateOverlay();
                        // Danger arrows are expensive - only update when not lagging
                        if (frameTimeNow < MainLoop.FRAME_TIME_TARGET) {
                            VisualEnhancements.updateDangerArrows();
                        }
                    } catch (visualError) {
                        if ((STATE.errorCount || 0) < 3) {
                            console.error('%c❌ VISUAL ERROR:', 'color: #ff6600;', visualError.message);
                        }
                    }
                }

            } catch (criticalError) {
                console.error('%c💀 CRITICAL LOOP ERROR:', 'color: #ff0000;', criticalError);
            }

            // Record frame time
            const frameTime = performance.now() - frameStart;
            MainLoop._frameTimes[MainLoop._frameTimeIndex] = frameTime;
            MainLoop._frameTimeIndex = (MainLoop._frameTimeIndex + 1) % 60;

            // Store for lag detection
            STATE.avgFrameTime = MainLoop._avgFrameTime;
            STATE.lastFrameTimeMs = frameTime;
        },

        stop: () => {
            if (MainLoop.frameId) {
                cancelAnimationFrame(MainLoop.frameId);
            }
        },

        // Get performance metrics
        getMetrics: () => ({
            fps: STATE.fps,
            avgFrameTime: MainLoop._avgFrameTime.toFixed(2) + 'ms',
            lastFrameTime: (STATE.lastFrameTimeMs || 0).toFixed(2) + 'ms',
            isLagging: MainLoop._avgFrameTime > MainLoop.FRAME_TIME_CRITICAL
        })
    };

    // ==================== INITIALIZATION ====================
    // Show UI immediately, but don't control snake until game is ready

    let botControlsActive = false;

    const init = () => {
        DEBUG && console.log('%c🐍 SNAKY BOT v6.0 - Loading...', 'color: #00ff00; font-size: 16px;');

        STATE.gameCanvas = document.querySelector('canvas');

        // Initialize everything EXCEPT bot control
        InputHandler.init();
        VisualEnhancements.init();

        // Start the display loop (but bot won't control snake yet)
        MainLoop.start();

        DEBUG && console.log('%c✅ UI Ready! Waiting for game to start...', 'color: #00ff00;');
        DEBUG && console.log('%c🎮 Controls: [B] Toggle | [Z/X] Zoom | [T] Debug', 'color: #ffff00;');

        // Check periodically if player is in game to enable bot control
        const checkForGame = setInterval(() => {
            if (GameVars.isGameReady() && !botControlsActive) {
                botControlsActive = true;
                STATE.gameLoaded = true;
                STATE.stats.gamesPlayed++;
                DEBUG && console.log('%c🎮 Snake detected! Bot control activated!', 'color: #00ff00; font-weight: bold;');
            } else if (!GameVars.isGameReady() && botControlsActive) {
                // Player died, disable controls until respawn
                botControlsActive = false;
                STATE.gameLoaded = false;

                // CLEAR all visual overlays to prevent artifacts in next game
                if (typeof VisualEnhancements !== 'undefined' && VisualEnhancements.clearAllOverlays) {
                    VisualEnhancements.clearAllOverlays();
                    DEBUG && console.log('%c🧹 Game ended - cleared overlays', 'color: #ffff00;');
                }
            }
        }, 500);
    };

    // Start after a short delay to let page initialize
    if (document.readyState === 'complete') {
        setTimeout(init, 2000);
    } else {
        window.addEventListener('load', () => setTimeout(init, 2000));
    }

})();
