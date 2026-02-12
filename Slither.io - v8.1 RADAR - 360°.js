// ==UserScript==
// @name         Slither.io Bot v8.1 RADAR
// @namespace    https://github.com/snaky
// @version      8.1.0
// @description  v8.1 RADAR - 360° sensors (1° each) with 5000px range!
// @author       Snaky
// @match        *://slither.io/*
// @match        *://slither.com/io*
// @grant        none
// @run-at       document-end
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // ==================== MATH CONSTANTS ====================
    const PI = Math.PI;
    const TWO_PI = PI * 2;
    const HALF_PI = PI / 2;
    const DEG_TO_RAD = PI / 180;

    // ==================== SENSOR CONFIGURATION ====================
    const SECTORS = 360;               // 1 ray per degree (360° coverage)
    const SECTOR_SIZE = TWO_PI / SECTORS;  // Radians per sector
    const RADAR_MAX_RANGE = 5000;      // Maximum sensor range in pixels

    // ==================== INLINE MATH ====================
    const distSq = (x1, y1, x2, y2) => {
        const dx = x2 - x1, dy = y2 - y1;
        return dx * dx + dy * dy;
    };
    const dist = (x1, y1, x2, y2) => Math.sqrt(distSq(x1, y1, x2, y2));
    const normAngle = (a) => {
        a = a % TWO_PI;
        return a > PI ? a - TWO_PI : (a < -PI ? a + TWO_PI : a);
    };
    const angleDiff = (a1, a2) => normAngle(a2 - a1);

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        bot: { enabled: true, autoRespawn: true, respawnDelay: 1000 },
        safety: {
            edgeBuffer: 3000,       // Start turning from edge (increased)
            edgeHardLimit: 1200,    // Emergency turn distance (increased)
            bodyBuffer: 60,         // Min distance from body walls (INCREASED!)
            headThreatRadius: 600,  // Scan for enemy HEADS (increased range)
            bodyAvoidRadius: 500,   // Scan for body walls (MUCH larger)
            escapeBoost: false      // DON'T boost when escaping - causes crashes!
        },
        food: {
            searchRadius: 600,      // Food search distance (reduced - safety first)
            minSafety: 0.6,         // Safety needed to eat (HIGHER)
            bigFoodSize: 8          // Size considered "big"
        },
        attack: {
            enabled: true,          // Enable attack mode
            minLength: 80,          // Min length before attacking (higher)
            cutoffDistance: 250,    // How far ahead to cut off
            sizeAdvantage: 1.5,     // Attack only if we're 50% bigger
            boostToKill: false,     // DON'T boost during attack near bodies
            safetyThreshold: 0.2    // Max danger during attack (LOWER = safer)
        },
        visual: {
            debug: true,
            minimap: true,
            minimapSize: 150
        },
        render: {
            quality: 'low',         // high, medium, low, minimal
            hideBackground: true,
            hideShadows: true
        }
    };

    // ==================== GLOBAL STATE ====================
    const STATE = {
        playing: false,
        danger: 0,
        escapeAngle: 0,
        blocked: new Array(SECTORS).fill(false),     // 360 directions (1° each) for precision
        ownBody: new Array(SECTORS).fill(Infinity),  // Distance to own body in each sector
        radar: new Array(SECTORS).fill(Infinity),    // RADAR: Exact distance to nearest wall (5000px range)
        radarType: new Array(SECTORS).fill('none'),  // Type of obstacle: 'enemy', 'self', 'edge', 'none'
        snakeMap: new Map(),                         // Global snake tracking: id -> SnakeData
        reason: 'IDLE',
        fps: 60,
        frameCount: 0,
        lastFpsTime: 0
    };

    // ==================== GAME LOGGING & LEARNING SYSTEM ====================
    const GameLog = {
        // Current game session data
        session: {
            startTime: 0,
            endTime: 0,
            maxScore: 0,
            maxLength: 0,
            kills: 0,
            deathCause: null,     // 'head_collision', 'encircled', 'edge', 'unknown'
            deathPosition: null,
            killerInfo: null,     // Info about who killed us
            attacksMade: [],      // Our attack attempts
            attacksReceived: [],  // Attacks on us
            escapes: 0,           // Successful escapes
            trapsEscaped: 0,
            foodEaten: 0,
            preyEaten: 0,
            boostUsed: 0,         // Seconds of boost
            distanceTraveled: 0,
            lastPosition: null
        },

        // Persistent data (saved to localStorage)
        history: {
            totalGames: 0,
            totalKills: 0,
            totalDeaths: 0,
            bestScore: 0,
            bestLength: 0,
            avgScore: 0,
            avgLifespan: 0,
            deathCauses: {},      // { 'head_collision': 15, 'encircled': 8, ... }
            killerPatterns: [],   // Patterns that led to death
            successPatterns: [],  // Patterns that led to kills
            dangerZones: [],      // Map areas where we die often
            hotspots: [],         // Areas with lots of food/kills
            recentGames: []       // Last 50 games for analysis
        },

        // Learning weights (adjusted based on history)
        weights: {
            headThreatMultiplier: 1.0,   // Increase if dying to heads often
            trapSensitivity: 1.0,        // Increase if dying to encirclement
            edgeCaution: 1.0,            // Increase if dying at edges
            attackAggression: 1.0,       // Decrease if attacks fail often
            boostConservation: 1.0       // Increase if running out of length
        },

        // DYNAMIC CONFIG - Auto-calculated from game stats (replaces user config!)
        dynamic: {
            // Safety - calculated from death patterns
            headThreatRadius: 400,       // Base: 400, adjusted by survival rate
            bodyAvoidRadius: 200,        // Base: 200, adjusted by wall deaths
            edgeBuffer: 2000,            // Base: 2000, adjusted by edge deaths
            bodyBuffer: 25,              // Base: 25, adjusted by collision rate

            // Attack - calculated from kill success
            attackMinLength: 50,         // When to start attacking
            sizeAdvantage: 1.3,          // Required size advantage
            attackRadius: 500,           // How far to look for prey

            // Food - calculated from growth patterns
            foodSearchRadius: 800,       // How far to look for food
            minSafetyToEat: 0.4,         // Safety threshold for eating
            preyPriority: 2.0,           // How much to prioritize prey vs food

            // Trap - calculated from encirclement deaths
            trapDetectRadius: 300,       // How far to check for encirclement
            trapUrgencyThreshold: 0.5,   // When to react to traps
            circleDefenseThreshold: 0.25, // Gap size to trigger defensive circle

            // Boost - calculated from length efficiency
            escapeBoostThreshold: 0.6,   // Danger level to boost escape
            attackBoostEnabled: true,    // Whether to boost during attacks

            // Timing
            reactionSpeed: 1.0           // Overall reaction multiplier
        },

        // Statistics for dynamic calculation
        stats: {
            // Survival stats
            avgLifespan: 60,             // seconds
            avgDeathsPerMinute: 1,
            survivalRate: 0.5,           // % of time alive vs dead

            // Death breakdown (updated each death)
            headCollisionRate: 0.33,
            trapDeathRate: 0.33,
            edgeDeathRate: 0.15,
            unknownDeathRate: 0.19,

            // Combat stats
            killsPerGame: 1,
            killsPerMinute: 0.5,
            attackSuccessRate: 0.3,      // kills / attack attempts
            counterAttackSuccessRate: 0.2,

            // Growth stats
            avgScorePerMinute: 100,
            avgLengthGrowth: 5,          // segments per minute
            preyEfficiency: 0.7,         // prey eaten / prey seen
            foodEfficiency: 0.8,

            // Escape stats
            escapeSuccessRate: 0.7,
            trapEscapeRate: 0.5,
            boostEfficiencyRatio: 1.0,   // score gained / boost used

            // Position stats
            avgDistanceFromCenter: 0.5,  // 0=center, 1=edge
            preferredZone: 'middle'      // 'center', 'middle', 'edge'
        },

        // Initialize - load from localStorage
        init: () => {
            try {
                const saved = localStorage.getItem('snaky_history');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    GameLog.history = { ...GameLog.history, ...parsed };
                    console.log('%c📊 Loaded game history:', 'color:#0ff', GameLog.history);
                }

                const weights = localStorage.getItem('snaky_weights');
                if (weights) {
                    GameLog.weights = { ...GameLog.weights, ...JSON.parse(weights) };
                    console.log('%c🧠 Loaded learning weights:', 'color:#0ff', GameLog.weights);
                }

                const stats = localStorage.getItem('snaky_stats');
                if (stats) {
                    GameLog.stats = { ...GameLog.stats, ...JSON.parse(stats) };
                    console.log('%c📈 Loaded game stats:', 'color:#0ff', GameLog.stats);
                }

                const dynamic = localStorage.getItem('snaky_dynamic');
                if (dynamic) {
                    GameLog.dynamic = { ...GameLog.dynamic, ...JSON.parse(dynamic) };
                    console.log('%c⚡ Loaded dynamic config:', 'color:#0ff', GameLog.dynamic);
                }

                // Recalculate dynamic values from history
                if (GameLog.history.totalGames > 0) {
                    GameLog.recalculateDynamicConfig();
                }
            } catch (e) {
                console.warn('Failed to load game history:', e);
            }

            GameLog.resetSession();
        },

        // Save to localStorage
        save: () => {
            try {
                localStorage.setItem('snaky_history', JSON.stringify(GameLog.history));
                localStorage.setItem('snaky_weights', JSON.stringify(GameLog.weights));
                localStorage.setItem('snaky_stats', JSON.stringify(GameLog.stats));
                localStorage.setItem('snaky_dynamic', JSON.stringify(GameLog.dynamic));
            } catch (e) {
                console.warn('Failed to save game history:', e);
            }
        },

        // Reset current session
        resetSession: () => {
            GameLog.session = {
                startTime: performance.now(),
                endTime: 0,
                maxScore: 0,
                maxLength: 0,
                kills: 0,
                deathCause: null,
                deathPosition: null,
                killerInfo: null,
                attacksMade: [],
                attacksReceived: [],
                escapes: 0,
                trapsEscaped: 0,
                foodEaten: 0,
                preyEaten: 0,
                boostUsed: 0,
                distanceTraveled: 0,
                lastPosition: null
            };
        },

        // Called each frame to track stats
        update: (head) => {
            if (!head) return;

            const s = GameLog.session;

            // Track max values
            s.maxScore = Math.max(s.maxScore, head.pts || 0);
            s.maxLength = Math.max(s.maxLength, head.sct || 0);

            // Track kills (compare to previous)
            const currentKills = head.kills || 0;
            if (currentKills > s.kills) {
                const newKills = currentKills - s.kills;
                s.kills = currentKills;
                GameLog.logKill(head, newKills);
            }

            // Track distance traveled
            if (s.lastPosition) {
                s.distanceTraveled += dist(s.lastPosition.x, s.lastPosition.y, head.x, head.y);
            }
            s.lastPosition = { x: head.x, y: head.y };

            // Track boost usage
            if (Decision.boost) {
                s.boostUsed += 1/60;  // Approximate seconds
            }

            // Track escapes
            if (Threat.headDanger > 0.6 && Decision.reason.includes('ESCAPE')) {
                s.escapes++;
            }

            // Track trap escapes
            if (Trap.detected && Trap.urgency > 0.5) {
                // If we were trapped but now aren't
                if (!GameLog._wasTapped) {
                    GameLog._wasTapped = true;
                }
            } else if (GameLog._wasTapped) {
                s.trapsEscaped++;
                GameLog._wasTapped = false;
            }

            // Log attacks received
            if (Threat.headDanger > 0.7) {
                GameLog.logAttackReceived(head);
            }
        },
        _wasTapped: false,
        _lastAttackLog: 0,

        // Log a kill we made
        logKill: (head, count) => {
            const killInfo = {
                timestamp: performance.now(),
                position: { x: head.x, y: head.y },
                ourLength: head.sct,
                ourScore: head.pts,
                attackMode: Attack.mode,
                wasCounter: Trap.canCounterAttack,
                reason: Decision.reason
            };

            GameLog.session.attacksMade.push({
                ...killInfo,
                success: true
            });

            // Track successful patterns
            GameLog.history.successPatterns.push({
                mode: Attack.mode,
                ourLength: head.sct,
                reason: Decision.reason,
                wasTrapped: Trap.detected
            });

            // Keep only last 100 patterns
            if (GameLog.history.successPatterns.length > 100) {
                GameLog.history.successPatterns.shift();
            }

            console.log(`%c🎯 KILL! (${count}x) - ${Attack.mode || Decision.reason}`, 'color:#f00;font-weight:bold');
        },

        // Log attack attempt (failed or ongoing)
        logAttackAttempt: (head, target) => {
            GameLog.session.attacksMade.push({
                timestamp: performance.now(),
                position: { x: head.x, y: head.y },
                targetDist: target?.dist,
                mode: Attack.mode,
                success: false  // Updated if kill happens
            });
        },

        // Log when we're being attacked
        logAttackReceived: (head) => {
            const now = performance.now();
            if (now - GameLog._lastAttackLog < 1000) return;  // Debounce 1s
            GameLog._lastAttackLog = now;

            GameLog.session.attacksReceived.push({
                timestamp: now,
                position: { x: head.x, y: head.y },
                danger: Threat.headDanger,
                trapped: Trap.detected,
                coverage: Trap.coverage,
                ourLength: head.sct
            });
        },

        // Log food eaten
        logFoodEaten: (isPrey) => {
            if (isPrey) {
                GameLog.session.preyEaten++;
            } else {
                GameLog.session.foodEaten++;
            }
        },

        // Called when game ends (death)
        logDeath: (head, cause) => {
            const s = GameLog.session;
            s.endTime = performance.now();
            s.deathCause = cause;

            if (head) {
                s.deathPosition = { x: head.x, y: head.y };
            }

            // Determine death cause if not provided
            if (!cause) {
                if (Trap.detected && Trap.urgency > 0.7) {
                    cause = 'encircled';
                } else if (Threat.edgeDanger > 0.8) {
                    cause = 'edge';
                } else if (Threat.headDanger > 0.5) {
                    cause = 'head_collision';
                } else {
                    cause = 'unknown';
                }
                s.deathCause = cause;
            }

            // Record killer info if available
            if (Trap.encirclerHead) {
                s.killerInfo = {
                    wasEncircler: true,
                    length: Trap.encirclerHead.sct,
                    coverage: Trap.coverage
                };
            }

            // Update history
            GameLog.history.totalGames++;
            GameLog.history.totalDeaths++;
            GameLog.history.totalKills += s.kills;
            GameLog.history.bestScore = Math.max(GameLog.history.bestScore, s.maxScore);
            GameLog.history.bestLength = Math.max(GameLog.history.bestLength, s.maxLength);

            // Track death causes
            GameLog.history.deathCauses[cause] = (GameLog.history.deathCauses[cause] || 0) + 1;

            // Calculate averages
            const lifespan = (s.endTime - s.startTime) / 1000;  // seconds
            const totalGames = GameLog.history.totalGames;
            GameLog.history.avgScore = ((GameLog.history.avgScore * (totalGames - 1)) + s.maxScore) / totalGames;
            GameLog.history.avgLifespan = ((GameLog.history.avgLifespan * (totalGames - 1)) + lifespan) / totalGames;

            // Track danger zones
            if (s.deathPosition) {
                GameLog.history.dangerZones.push({
                    x: s.deathPosition.x,
                    y: s.deathPosition.y,
                    cause: cause,
                    timestamp: Date.now()
                });
                // Keep last 200
                if (GameLog.history.dangerZones.length > 200) {
                    GameLog.history.dangerZones.shift();
                }
            }

            // Track killer patterns
            if (s.attacksReceived.length > 0) {
                const lastAttack = s.attacksReceived[s.attacksReceived.length - 1];
                GameLog.history.killerPatterns.push({
                    cause: cause,
                    danger: lastAttack.danger,
                    trapped: lastAttack.trapped,
                    coverage: lastAttack.coverage,
                    ourLength: s.maxLength
                });
                if (GameLog.history.killerPatterns.length > 100) {
                    GameLog.history.killerPatterns.shift();
                }
            }

            // Store recent game
            GameLog.history.recentGames.push({
                date: Date.now(),
                score: s.maxScore,
                length: s.maxLength,
                kills: s.kills,
                lifespan: lifespan,
                deathCause: cause,
                escapes: s.escapes,
                trapsEscaped: s.trapsEscaped,
                foodEaten: s.foodEaten,
                preyEaten: s.preyEaten,
                boostUsed: s.boostUsed,
                distanceTraveled: s.distanceTraveled
            });
            if (GameLog.history.recentGames.length > 50) {
                GameLog.history.recentGames.shift();
            }

            // LEARN FROM DEATH - Adjust weights
            GameLog.learn();

            // Save to localStorage
            GameLog.save();

            // Log summary
            console.log('%c💀 GAME OVER', 'color:#f00;font-size:16px;font-weight:bold');
            console.log(`   Cause: ${cause}`);
            console.log(`   Score: ${s.maxScore} | Length: ${s.maxLength} | Kills: ${s.kills}`);
            console.log(`   Lifespan: ${lifespan.toFixed(1)}s | Escapes: ${s.escapes}`);
            console.log(`   Total Games: ${GameLog.history.totalGames} | Best: ${GameLog.history.bestScore}`);
        },

        // LEARNING ALGORITHM - Adjust weights based on death patterns
        learn: () => {
            const h = GameLog.history;
            const w = GameLog.weights;
            const totalDeaths = h.totalDeaths || 1;

            // Analyze death causes
            const headDeaths = (h.deathCauses['head_collision'] || 0) / totalDeaths;
            const trapDeaths = (h.deathCauses['encircled'] || 0) / totalDeaths;
            const edgeDeaths = (h.deathCauses['edge'] || 0) / totalDeaths;

            // Adjust weights based on death patterns
            // If dying to heads often (>30%), increase caution
            if (headDeaths > 0.3) {
                w.headThreatMultiplier = Math.min(2.0, w.headThreatMultiplier + 0.05);
            } else if (headDeaths < 0.15) {
                w.headThreatMultiplier = Math.max(0.7, w.headThreatMultiplier - 0.02);
            }

            // If dying to traps often (>25%), increase sensitivity
            if (trapDeaths > 0.25) {
                w.trapSensitivity = Math.min(2.0, w.trapSensitivity + 0.05);
            } else if (trapDeaths < 0.1) {
                w.trapSensitivity = Math.max(0.7, w.trapSensitivity - 0.02);
            }

            // If dying at edges often (>20%), increase caution
            if (edgeDeaths > 0.2) {
                w.edgeCaution = Math.min(2.0, w.edgeCaution + 0.05);
            } else if (edgeDeaths < 0.1) {
                w.edgeCaution = Math.max(0.7, w.edgeCaution - 0.02);
            }

            // Analyze attack success rate
            const recentGames = h.recentGames.slice(-20);
            if (recentGames.length >= 5) {
                const avgKills = recentGames.reduce((sum, g) => sum + g.kills, 0) / recentGames.length;
                const avgScore = recentGames.reduce((sum, g) => sum + g.score, 0) / recentGames.length;

                // If getting lots of kills, can be more aggressive
                if (avgKills > 3) {
                    w.attackAggression = Math.min(1.5, w.attackAggression + 0.03);
                } else if (avgKills < 1) {
                    w.attackAggression = Math.max(0.5, w.attackAggression - 0.02);
                }

                // If scores are low, might be using too much boost
                if (avgScore < 500 && recentGames.reduce((sum, g) => sum + g.boostUsed, 0) / recentGames.length > 30) {
                    w.boostConservation = Math.min(2.0, w.boostConservation + 0.05);
                }
            }

            // Now recalculate all dynamic config values
            GameLog.recalculateDynamicConfig();

            console.log('%c🧠 Learning weights updated:', 'color:#0ff', w);
        },

        // RECALCULATE ALL DYNAMIC CONFIG FROM STATS
        recalculateDynamicConfig: () => {
            const h = GameLog.history;
            const s = GameLog.stats;
            const d = GameLog.dynamic;
            const w = GameLog.weights;

            if (h.totalGames < 3) return;  // Need minimum data

            const recentGames = h.recentGames.slice(-20);
            if (recentGames.length < 3) return;

            // ========== CALCULATE STATS FROM HISTORY ==========

            // Death rates
            const totalDeaths = h.totalDeaths || 1;
            s.headCollisionRate = (h.deathCauses['head_collision'] || 0) / totalDeaths;
            s.trapDeathRate = (h.deathCauses['encircled'] || 0) / totalDeaths;
            s.edgeDeathRate = (h.deathCauses['edge'] || 0) / totalDeaths;
            s.unknownDeathRate = (h.deathCauses['unknown'] || 0) / totalDeaths;

            // Average stats from recent games
            s.avgLifespan = recentGames.reduce((sum, g) => sum + g.lifespan, 0) / recentGames.length;
            s.killsPerGame = recentGames.reduce((sum, g) => sum + g.kills, 0) / recentGames.length;
            s.avgScorePerMinute = recentGames.reduce((sum, g) => sum + (g.score / Math.max(1, g.lifespan / 60)), 0) / recentGames.length;

            // Calculate kills per minute
            const totalPlaytime = recentGames.reduce((sum, g) => sum + g.lifespan, 0);
            const totalKillsRecent = recentGames.reduce((sum, g) => sum + g.kills, 0);
            s.killsPerMinute = totalPlaytime > 0 ? (totalKillsRecent / totalPlaytime) * 60 : 0;

            // Escape success rate (escapes / attacks received)
            const totalEscapes = recentGames.reduce((sum, g) => sum + g.escapes, 0);
            s.escapeSuccessRate = Math.min(1, totalEscapes / Math.max(1, recentGames.length * 10));

            // Trap escape rate
            const totalTrapEscapes = recentGames.reduce((sum, g) => sum + g.trapsEscaped, 0);
            const trapsSurvived = totalTrapEscapes;
            const trapsTotal = trapsSurvived + (h.deathCauses['encircled'] || 0);
            s.trapEscapeRate = trapsTotal > 0 ? trapsSurvived / trapsTotal : 0.5;

            // Boost efficiency
            const totalBoost = recentGames.reduce((sum, g) => sum + g.boostUsed, 0);
            const totalScore = recentGames.reduce((sum, g) => sum + g.score, 0);
            s.boostEfficiencyRatio = totalBoost > 0 ? totalScore / totalBoost : 100;

            // ========== CALCULATE DYNAMIC CONFIG FROM STATS ==========

            // HEAD THREAT RADIUS: Increase if dying to heads often
            // Base: 400, Range: 250-600
            d.headThreatRadius = Math.round(
                400 * (1 + (s.headCollisionRate - 0.33) * 1.5) * w.headThreatMultiplier
            );
            d.headThreatRadius = Math.max(250, Math.min(600, d.headThreatRadius));

            // BODY AVOID RADIUS: Increase if survival rate is low
            // Base: 200, Range: 150-350
            const survivalFactor = s.avgLifespan > 120 ? 0.9 : s.avgLifespan > 60 ? 1.0 : 1.2;
            d.bodyAvoidRadius = Math.round(200 * survivalFactor);
            d.bodyAvoidRadius = Math.max(150, Math.min(350, d.bodyAvoidRadius));

            // EDGE BUFFER: Increase if dying at edges often
            // Base: 2000, Range: 1200-3500
            d.edgeBuffer = Math.round(
                2000 * (1 + (s.edgeDeathRate - 0.15) * 3) * w.edgeCaution
            );
            d.edgeBuffer = Math.max(1200, Math.min(3500, d.edgeBuffer));

            // BODY BUFFER: Decrease if we're good at close navigation
            // Base: 25, Range: 15-50
            const navigationSkill = s.escapeSuccessRate > 0.7 ? 0.8 : s.escapeSuccessRate > 0.5 ? 1.0 : 1.3;
            d.bodyBuffer = Math.round(25 * navigationSkill);
            d.bodyBuffer = Math.max(15, Math.min(50, d.bodyBuffer));

            // ATTACK MIN LENGTH: Lower if we're good at killing
            // Base: 50, Range: 30-100
            if (s.killsPerGame > 3) {
                d.attackMinLength = 30;
            } else if (s.killsPerGame > 1) {
                d.attackMinLength = 50;
            } else {
                d.attackMinLength = 80;
            }

            // SIZE ADVANTAGE: Lower if we're skilled (more aggressive)
            // Base: 1.3, Range: 1.1-2.0
            d.sizeAdvantage = s.killsPerGame > 2 ? 1.15 : s.killsPerGame > 0.5 ? 1.3 : 1.6;
            d.sizeAdvantage *= (2 - w.attackAggression);  // Aggression lowers requirement
            d.sizeAdvantage = Math.max(1.1, Math.min(2.0, d.sizeAdvantage));

            // ATTACK RADIUS: Increase if we're aggressive and successful
            // Base: 500, Range: 300-700
            d.attackRadius = Math.round(500 * w.attackAggression);
            d.attackRadius = Math.max(300, Math.min(700, d.attackRadius));

            // FOOD SEARCH RADIUS: Adjust based on growth rate
            // Base: 800, Range: 500-1200
            if (s.avgScorePerMinute > 150) {
                d.foodSearchRadius = 600;  // Already growing fast, focus on safety
            } else if (s.avgScorePerMinute < 50) {
                d.foodSearchRadius = 1200;  // Need more food, search wider
            } else {
                d.foodSearchRadius = 800;
            }

            // MIN SAFETY TO EAT: Lower if we're good at escaping
            // Base: 0.4, Range: 0.2-0.7
            d.minSafetyToEat = s.escapeSuccessRate > 0.7 ? 0.25 : s.escapeSuccessRate > 0.5 ? 0.4 : 0.6;

            // PREY PRIORITY: Higher if we're good at catching them
            // Base: 2.0, Range: 1.2-3.5
            const recentPreyEaten = recentGames.reduce((sum, g) => sum + g.preyEaten, 0);
            if (recentPreyEaten > recentGames.length * 3) {
                d.preyPriority = 3.0;  // We catch lots of prey
            } else if (recentPreyEaten > recentGames.length) {
                d.preyPriority = 2.0;
            } else {
                d.preyPriority = 1.5;  // Focus on regular food
            }

            // TRAP DETECT RADIUS: Increase if we die to traps often
            // Base: 300, Range: 200-450
            d.trapDetectRadius = Math.round(
                300 * (1 + (s.trapDeathRate - 0.25) * 2) * w.trapSensitivity
            );
            d.trapDetectRadius = Math.max(200, Math.min(450, d.trapDetectRadius));

            // TRAP URGENCY THRESHOLD: Lower if we escape traps poorly
            // Base: 0.5, Range: 0.3-0.7
            d.trapUrgencyThreshold = s.trapEscapeRate > 0.6 ? 0.6 : s.trapEscapeRate > 0.4 ? 0.5 : 0.35;

            // CIRCLE DEFENSE THRESHOLD: How small gap before circling
            // Base: PI/4, Range: PI/6 to PI/3
            d.circleDefenseThreshold = s.trapEscapeRate > 0.6 ? Math.PI / 6 : Math.PI / 4;

            // ESCAPE BOOST THRESHOLD: When to boost for escape
            // Base: 0.6, Range: 0.4-0.8
            d.escapeBoostThreshold = s.boostEfficiencyRatio > 50 ? 0.5 : 0.7;

            // ATTACK BOOST: Disable if wasting too much length
            d.attackBoostEnabled = s.boostEfficiencyRatio > 30 && w.boostConservation < 1.5;

            // REACTION SPEED: Overall multiplier based on survival
            d.reactionSpeed = s.avgLifespan > 120 ? 0.9 : s.avgLifespan > 60 ? 1.0 : 1.2;

            console.log('%c⚡ Dynamic config recalculated:', 'color:#ff0', d);
            console.log('%c📈 Current stats:', 'color:#0f0', s);
        },

        // Get learning-adjusted values (now uses dynamic config!)
        getHeadThreatRadius: () => {
            return GameLog.dynamic.headThreatRadius;
        },

        getBodyAvoidRadius: () => {
            return GameLog.dynamic.bodyAvoidRadius;
        },

        getEdgeBuffer: () => {
            return GameLog.dynamic.edgeBuffer;
        },

        getBodyBuffer: () => {
            return GameLog.dynamic.bodyBuffer;
        },

        getFoodSearchRadius: () => {
            return GameLog.dynamic.foodSearchRadius;
        },

        getMinSafetyToEat: () => {
            return GameLog.dynamic.minSafetyToEat;
        },

        getPreyPriority: () => {
            return GameLog.dynamic.preyPriority;
        },

        getTrapDetectRadius: () => {
            return GameLog.dynamic.trapDetectRadius;
        },

        getTrapUrgencyThreshold: () => {
            return GameLog.dynamic.trapUrgencyThreshold;
        },

        getAttackMinLength: () => {
            return GameLog.dynamic.attackMinLength;
        },

        getSizeAdvantage: () => {
            return GameLog.dynamic.sizeAdvantage;
        },

        getAttackRadius: () => {
            return GameLog.dynamic.attackRadius;
        },

        getEscapeBoostThreshold: () => {
            return GameLog.dynamic.escapeBoostThreshold;
        },

        shouldAttackBoost: () => {
            return GameLog.dynamic.attackBoostEnabled;
        },

        getAdjustedThreatRadius: () => {
            return GameLog.dynamic.headThreatRadius;
        },

        getAdjustedTrapUrgency: (baseUrgency) => {
            return Math.min(1.0, baseUrgency * GameLog.weights.trapSensitivity);
        },

        getAdjustedEdgeBuffer: () => {
            return GameLog.dynamic.edgeBuffer;
        },

        shouldAttack: () => {
            // Less likely to attack if aggression weight is low
            return Math.random() < GameLog.weights.attackAggression;
        },

        shouldBoost: () => {
            // Less likely to boost if conservation weight is high
            return Math.random() > (GameLog.weights.boostConservation - 1);
        },

        // Check if position is in a danger zone
        isDangerZone: (x, y, radius = 500) => {
            let dangerCount = 0;
            for (const zone of GameLog.history.dangerZones) {
                if (dist(x, y, zone.x, zone.y) < radius) {
                    dangerCount++;
                }
            }
            return dangerCount >= 3;  // 3+ deaths nearby = danger zone
        },

        // Get stats for display
        getStats: () => {
            const h = GameLog.history;
            const s = GameLog.session;
            return {
                totalGames: h.totalGames,
                totalKills: h.totalKills,
                bestScore: h.bestScore,
                bestLength: h.bestLength,
                avgScore: Math.round(h.avgScore),
                avgLifespan: h.avgLifespan.toFixed(1),
                kd: h.totalDeaths > 0 ? (h.totalKills / h.totalDeaths).toFixed(2) : '0',
                currentScore: s.maxScore,
                currentKills: s.kills,
                sessionTime: ((performance.now() - s.startTime) / 1000).toFixed(0)
            };
        },

        // Print full report to console
        printReport: () => {
            const h = GameLog.history;
            const w = GameLog.weights;
            const s = GameLog.stats;
            const d = GameLog.dynamic;

            console.log('%c📊 SNAKY GAME REPORT', 'color:#0ff;font-size:18px;font-weight:bold');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Total Games: ${h.totalGames}`);
            console.log(`Total Kills: ${h.totalKills} | Total Deaths: ${h.totalDeaths}`);
            console.log(`K/D Ratio: ${h.totalDeaths > 0 ? (h.totalKills / h.totalDeaths).toFixed(2) : 'N/A'}`);
            console.log(`Best Score: ${h.bestScore} | Best Length: ${h.bestLength}`);
            console.log(`Avg Score: ${Math.round(h.avgScore)} | Avg Lifespan: ${h.avgLifespan.toFixed(1)}s`);
            console.log('');
            console.log('%cDeath Causes:', 'color:#f00');
            for (const [cause, count] of Object.entries(h.deathCauses)) {
                const pct = ((count / h.totalDeaths) * 100).toFixed(1);
                console.log(`   ${cause}: ${count} (${pct}%)`);
            }
            console.log('');
            console.log('%cLearning Weights:', 'color:#0f0');
            console.log(`   Head Threat: ${w.headThreatMultiplier.toFixed(2)}x`);
            console.log(`   Trap Sensitivity: ${w.trapSensitivity.toFixed(2)}x`);
            console.log(`   Edge Caution: ${w.edgeCaution.toFixed(2)}x`);
            console.log(`   Attack Aggression: ${w.attackAggression.toFixed(2)}x`);
            console.log(`   Boost Conservation: ${w.boostConservation.toFixed(2)}x`);
            console.log('');
            console.log('%cCalculated Stats:', 'color:#ff0');
            console.log(`   Kills/Game: ${s.killsPerGame.toFixed(1)} | Kills/Min: ${s.killsPerMinute.toFixed(2)}`);
            console.log(`   Head Deaths: ${(s.headCollisionRate*100).toFixed(0)}% | Trap Deaths: ${(s.trapDeathRate*100).toFixed(0)}%`);
            console.log(`   Escape Rate: ${(s.escapeSuccessRate*100).toFixed(0)}% | Trap Escape: ${(s.trapEscapeRate*100).toFixed(0)}%`);
            console.log(`   Score/Min: ${s.avgScorePerMinute.toFixed(0)} | Boost Efficiency: ${s.boostEfficiencyRatio.toFixed(1)}`);
            console.log('');
            console.log('%c⚡ DYNAMIC CONFIG (Auto-calculated):', 'color:#f0f;font-weight:bold');
            console.log('   ─── Safety ───');
            console.log(`   Head Threat Radius: ${d.headThreatRadius}px (base 400)`);
            console.log(`   Body Avoid Radius: ${d.bodyAvoidRadius}px (base 200)`);
            console.log(`   Edge Buffer: ${d.edgeBuffer}px (base 2000)`);
            console.log(`   Body Buffer: ${d.bodyBuffer}px (base 25)`);
            console.log('   ─── Attack ───');
            console.log(`   Min Length to Attack: ${d.attackMinLength} (base 50)`);
            console.log(`   Size Advantage: ${d.sizeAdvantage.toFixed(2)}x (base 1.3)`);
            console.log(`   Attack Radius: ${d.attackRadius}px (base 500)`);
            console.log(`   Attack Boost: ${d.attackBoostEnabled ? 'ON' : 'OFF'}`);
            console.log('   ─── Food ───');
            console.log(`   Search Radius: ${d.foodSearchRadius}px (base 800)`);
            console.log(`   Min Safety: ${(d.minSafetyToEat*100).toFixed(0)}% (base 40%)`);
            console.log(`   Prey Priority: ${d.preyPriority.toFixed(1)}x (base 2.0)`);
            console.log('   ─── Trap ───');
            console.log(`   Detect Radius: ${d.trapDetectRadius}px (base 300)`);
            console.log(`   Urgency Threshold: ${(d.trapUrgencyThreshold*100).toFixed(0)}% (base 50%)`);
            console.log(`   Circle Defense: ${(d.circleDefenseThreshold/Math.PI*180).toFixed(0)}° (base 45°)`);
            console.log('   ─── Boost ───');
            console.log(`   Escape Threshold: ${(d.escapeBoostThreshold*100).toFixed(0)}% danger`);
            console.log(`   Reaction Speed: ${d.reactionSpeed.toFixed(2)}x`);
            console.log('');
            console.log('%cRecent Games:', 'color:#ff0');
            h.recentGames.slice(-10).forEach((g, i) => {
                console.log(`   ${i+1}. Score: ${g.score} | Kills: ${g.kills} | ${g.deathCause} | ${g.lifespan.toFixed(0)}s`);
            });
        },

        // Clear all history
        clearHistory: () => {
            GameLog.history = {
                totalGames: 0, totalKills: 0, totalDeaths: 0,
                bestScore: 0, bestLength: 0, avgScore: 0, avgLifespan: 0,
                deathCauses: {}, killerPatterns: [], successPatterns: [],
                dangerZones: [], hotspots: [], recentGames: []
            };
            GameLog.weights = {
                headThreatMultiplier: 1.0, trapSensitivity: 1.0,
                edgeCaution: 1.0, attackAggression: 1.0, boostConservation: 1.0
            };
            GameLog.stats = {
                avgLifespan: 60, avgDeathsPerMinute: 1, survivalRate: 0.5,
                headCollisionRate: 0.33, trapDeathRate: 0.33,
                edgeDeathRate: 0.15, unknownDeathRate: 0.19,
                killsPerGame: 1, killsPerMinute: 0.5, attackSuccessRate: 0.3,
                counterAttackSuccessRate: 0.2, avgScorePerMinute: 100,
                avgLengthGrowth: 5, preyEfficiency: 0.7, foodEfficiency: 0.8,
                escapeSuccessRate: 0.7, trapEscapeRate: 0.5, boostEfficiencyRatio: 1.0,
                avgDistanceFromCenter: 0.5, preferredZone: 'middle'
            };
            GameLog.dynamic = {
                headThreatRadius: 400, bodyAvoidRadius: 200, edgeBuffer: 2000,
                bodyBuffer: 25, attackMinLength: 50, sizeAdvantage: 1.3,
                attackRadius: 500, foodSearchRadius: 800, minSafetyToEat: 0.4,
                preyPriority: 2.0, trapDetectRadius: 300, trapUrgencyThreshold: 0.5,
                circleDefenseThreshold: 0.25, escapeBoostThreshold: 0.6,
                attackBoostEnabled: true, reactionSpeed: 1.0
            };
            GameLog.save();
            console.log('%c🗑️ History cleared! Bot reset to defaults.', 'color:#f00');
        },

        // Quick print dynamic config for debugging
        printDynamic: () => {
            const d = GameLog.dynamic;
            console.log('%c⚡ CURRENT DYNAMIC CONFIG', 'color:#f0f;font-size:14px;font-weight:bold');
            console.log('Safety:', `head=${d.headThreatRadius} body=${d.bodyAvoidRadius} edge=${d.edgeBuffer} buffer=${d.bodyBuffer}`);
            console.log('Attack:', `minLen=${d.attackMinLength} size=${d.sizeAdvantage.toFixed(2)}x rad=${d.attackRadius} boost=${d.attackBoostEnabled}`);
            console.log('Food:', `search=${d.foodSearchRadius} safety=${(d.minSafetyToEat*100).toFixed(0)}% prey=${d.preyPriority.toFixed(1)}x`);
            console.log('Trap:', `detect=${d.trapDetectRadius} urgency=${(d.trapUrgencyThreshold*100).toFixed(0)}%`);
            console.log('Boost:', `escape@${(d.escapeBoostThreshold*100).toFixed(0)}% react=${d.reactionSpeed.toFixed(2)}x`);
        }
    };

    // ==================== TRAP/ENCIRCLEMENT DETECTION ====================
    // Detect when an enemy is coiling around us and find the escape gap
    const Trap = {
        detected: false,
        encircler: null,      // The snake trying to trap us
        encirclerHead: null,  // Enemy head position for counter-attack
        coverage: 0,          // How much they surround us (0-1)
        gapAngle: 0,          // Direction of the gap in their coil
        gapSize: 0,           // Size of gap in radians
        closingSpeed: 0,      // How fast the gap is closing
        urgency: 0,           // 0-1 how urgent to escape
        canCounterAttack: false,  // Can we cut off the encircler?
        counterAttackAngle: 0,    // Angle to cut them off
        circleRadius: 1.0,    // How tight to circle (1.0 = big, 0.1 = tight)
        snakeProfiles: {},    // Track each snake's encirclement
        allSegments: [],      // All nearby enemy segments for wall avoidance

        // Analyze all nearby snakes for encirclement behavior
        detect: (head) => {
            if (!head) return;

            Trap.detected = false;
            Trap.encircler = null;
            Trap.encirclerHead = null;
            Trap.coverage = 0;
            Trap.gapAngle = 0;
            Trap.gapSize = TWO_PI;
            Trap.urgency = 0;
            Trap.canCounterAttack = false;
            Trap.counterAttackAngle = 0;
            Trap.circleRadius = 1.0;
            Trap.allSegments = [];

            const snakes = window.slithers || [];
            const mySnake = Snake.getMy();
            const myId = mySnake?.id;
            const myLength = mySnake?.sct || 10;
            const checkRadius = GameLog.getTrapDetectRadius();  // Dynamic!

            // First pass: collect ALL nearby segments from ALL snakes (they're all walls!)
            for (const s of snakes) {
                if (!s || s.id === myId || s.dead) continue;
                const segments = s.gptz || s.pts;
                if (!segments) continue;

                const bodyRadius = s.rcv || 18;
                for (let j = 0; j < segments.length; j++) {
                    const pt = segments[j];
                    if (!pt || pt.dying) continue;
                    const px = pt.xx ?? pt.x ?? 0;
                    const py = pt.yy ?? pt.y ?? 0;
                    const segDist = dist(head.x, head.y, px, py);
                    if (segDist < checkRadius) {
                        Trap.allSegments.push({ x: px, y: py, dist: segDist, radius: bodyRadius, snakeId: s.id });
                    }
                }
            }

            // Analyze each snake individually for encirclement
            for (const s of snakes) {
                if (!s || s.id === myId || s.dead) continue;

                const segments = s.gptz || s.pts;
                if (!segments || segments.length < 10) continue;

                // Get enemy head position and stats
                const enemyHead = {
                    x: s.xx || 0, y: s.yy || 0, ang: s.ang || 0,
                    sp: s.sp || 11, sct: s.sct || 10
                };
                const headDist = dist(head.x, head.y, enemyHead.x, enemyHead.y);

                // Skip if enemy head is too far
                if (headDist > 500) continue;

                // Map which directions this snake's body occupies around us
                // Using 360 sectors (1° each) for finer resolution
                const sectors = new Array(SECTORS).fill(false);
                const sectorDist = new Array(SECTORS).fill(Infinity);  // Track closest in each sector
                let segmentsNearUs = 0;
                let closestSegDist = Infinity;

                for (let j = 0; j < segments.length; j++) {
                    const pt = segments[j];
                    if (!pt || pt.dying) continue;

                    const px = pt.xx ?? pt.x ?? 0;
                    const py = pt.yy ?? pt.y ?? 0;
                    const segDist = dist(head.x, head.y, px, py);

                    if (segDist < checkRadius) {
                        segmentsNearUs++;
                        closestSegDist = Math.min(closestSegDist, segDist);

                        // Mark which sector this segment occupies (360 sectors)
                        const angleToSeg = Math.atan2(py - head.y, px - head.x);
                        const sectorIdx = Math.floor(((normAngle(angleToSeg) + PI) / TWO_PI) * SECTORS) % SECTORS;

                        // Track closest segment in each sector
                        sectorDist[sectorIdx] = Math.min(sectorDist[sectorIdx], segDist);

                        // Mark adjacent sectors too based on distance
                        const spread = segDist < 100 ? 20 : 10;  // 20 or 10 degrees
                        for (let k = -spread; k <= spread; k++) {
                            const idx = (sectorIdx + k + SECTORS) % SECTORS;
                            sectors[idx] = true;
                            sectorDist[idx] = Math.min(sectorDist[idx], segDist);
                        }
                    }
                }

                // Calculate coverage for this snake
                const filledSectors = sectors.filter(s => s).length;
                const coverage = filledSectors / SECTORS;

                // Find the largest gap in their encirclement (360 sectors)
                let maxGap = 0;
                let gapStart = -1;
                let currentGap = 0;
                let currentStart = -1;

                // Wrap-around gap detection (check 144 to handle wrap)
                for (let i = 0; i < 144; i++) {
                    const idx = i % SECTORS;
                    if (!sectors[idx]) {
                        if (currentStart === -1) currentStart = idx;
                        currentGap++;
                    } else {
                        if (currentGap > maxGap) {
                            maxGap = currentGap;
                            gapStart = currentStart;
                        }
                        currentGap = 0;
                        currentStart = -1;
                    }
                }
                if (currentGap > maxGap) {
                    maxGap = Math.min(currentGap, SECTORS);
                    gapStart = currentStart;
                }

                // Is this snake encircling us?
                if (coverage > 0.4 && segmentsNearUs > 10 && closestSegDist < 180) {
                    const gapCenterIdx = (gapStart + Math.floor(maxGap / 2)) % SECTORS;
                    const gapAngle = ((gapCenterIdx / SECTORS) * TWO_PI) - PI;

                    // Check if enemy head is near the gap (trying to close it)
                    const angleToEnemyHead = Math.atan2(enemyHead.y - head.y, enemyHead.x - head.x);
                    const headNearGap = Math.abs(angleDiff(gapAngle, angleToEnemyHead)) < PI/3;

                    const gapSizeRad = (maxGap / SECTORS) * TWO_PI;
                    let urgency = coverage;

                    if (headNearGap) urgency += 0.25;
                    if (gapSizeRad < PI/2) urgency += 0.15;
                    if (closestSegDist < 80) urgency += 0.2;

                    urgency = Math.min(1.0, urgency);

                    // CAN WE COUNTER-ATTACK? Check if we can cut off their head!
                    let canCounter = false;
                    let counterAngle = 0;

                    // If we're bigger and their head is accessible through the gap
                    if (myLength > enemyHead.sct * 0.8) {  // We're at least 80% their size
                        // Check if gap leads toward their head
                        const gapToHead = Math.abs(angleDiff(gapAngle, angleToEnemyHead));
                        if (gapToHead < PI/2 && headDist < 200) {
                            // We can potentially cut them off!
                            // Aim slightly ahead of their head
                            const leadAngle = enemyHead.ang;
                            const interceptX = enemyHead.x + Math.cos(leadAngle) * enemyHead.sp * 5;
                            const interceptY = enemyHead.y + Math.sin(leadAngle) * enemyHead.sp * 5;
                            counterAngle = Math.atan2(interceptY - head.y, interceptX - head.x);

                            // Verify counter path is somewhat clear (360 sectors)
                            const counterIdx = Math.floor(((normAngle(counterAngle) + PI) / TWO_PI) * SECTORS) % SECTORS;
                            if (!sectors[counterIdx] || sectorDist[counterIdx] > 80) {
                                canCounter = true;
                            }
                        }
                    }

                    if (urgency > Trap.urgency) {
                        Trap.detected = true;
                        Trap.encircler = s;
                        Trap.encirclerHead = enemyHead;
                        Trap.coverage = coverage;
                        Trap.gapAngle = gapAngle;
                        Trap.gapSize = gapSizeRad;
                        Trap.urgency = urgency;
                        Trap.canCounterAttack = canCounter;
                        Trap.counterAttackAngle = counterAngle;

                        // Calculate circle radius based on gap size
                        // Big gap = big circle, small gap = tight circle
                        Trap.circleRadius = Math.max(0.2, gapSizeRad / PI);

                        Trap.snakeProfiles[s.id] = {
                            coverage, gapAngle, gapSize: gapSizeRad,
                            headNearGap, closestDist: closestSegDist,
                            enemyLength: enemyHead.sct,
                            timestamp: performance.now()
                        };
                    }
                }
            }

            // Clean old profiles
            const now = performance.now();
            for (const id in Trap.snakeProfiles) {
                if (now - Trap.snakeProfiles[id].timestamp > 2000) {
                    delete Trap.snakeProfiles[id];
                }
            }
        },

        // Get best escape direction considering the trap
        // ALWAYS finds a way out - even along our own body!
        getEscapeAngle: (head) => {
            if (!Trap.detected) return null;

            // The gap is our escape route!
            const gapAngle = Trap.gapAngle;

            // Check if gap direction is blocked (using 360 sectors now)
            const gapIdx = Math.floor(((normAngle(gapAngle) + PI) / TWO_PI) * SECTORS) % SECTORS;

            // If gap is clear, GO NOW!
            if (!Threat.blocked[gapIdx]) {
                return gapAngle;
            }

            // Try angles near the gap (wider search with 360 sectors)
            for (let offset = 1; offset <= 90; offset++) {
                const leftIdx = (gapIdx + offset) % SECTORS;
                const rightIdx = (gapIdx - offset + SECTORS) % SECTORS;

                if (!Threat.blocked[leftIdx]) {
                    return ((leftIdx / SECTORS) * TWO_PI) - PI;
                }
                if (!Threat.blocked[rightIdx]) {
                    return ((rightIdx / SECTORS) * TWO_PI) - PI;
                }
            }

            // EMERGENCY: Gap is blocked - use findAnyEscape
            return Threat.findAnyEscape(head);
        }
    };

    // ==================== GLOBAL SNAKE TRACKER ====================
    // Tracks EVERY snake on the map with position history and behavior analysis
    const SnakeTracker = {
        // Configuration
        HISTORY_LENGTH: 30,      // Frames of position history (~0.5 second at 60fps)
        STALE_TIMEOUT: 180,      // Frames before considering data stale (~3 seconds)
        PREDICTION_FRAMES: 15,   // How many frames ahead to predict

        // The global snake map
        snakes: STATE.snakeMap,

        // Stats
        totalTracked: 0,
        activeCount: 0,
        lastUpdateFrame: 0,

        // Snake data structure template
        createSnakeData: (snake) => ({
            id: snake.id,
            firstSeen: STATE.frameCount,
            lastSeen: STATE.frameCount,

            // Current state
            x: snake.xx || snake.x || 0,
            y: snake.yy || snake.y || 0,
            ang: snake.ang || 0,
            speed: snake.sp || 11,
            maxSpeed: snake.msp || 14,
            radius: snake.rcv || 18,
            length: snake.sct || 10,
            score: snake.sc || 1,
            boosting: snake.sp > 11,

            // Position history for prediction (ring buffer)
            history: [],
            historyIndex: 0,

            // Velocity (calculated)
            vx: 0,
            vy: 0,
            avgSpeed: 11,

            // Behavior analysis
            behavior: {
                aggression: 0,        // 0-100: How aggressive (chases, cuts off)
                predictability: 100,  // 0-100: How predictable movement is
                boostFrequency: 0,    // 0-100: How often they boost
                turnRate: 0,          // Average turn rate
                huntingUs: false,     // Are they specifically targeting us?
                lastNearUs: 0,        // Frame when last near us
                approachCount: 0,     // Times they've approached us
                kills: 0,             // Observed kills
                deaths: 0             // If we see them die and respawn
            },

            // Predicted future position
            predicted: {
                x: 0,
                y: 0,
                confidence: 0  // 0-100: How confident in prediction
            },

            // Threat assessment
            threat: {
                level: 0,          // 0-100 overall threat
                distance: Infinity,
                approaching: false,
                angleToUs: 0,
                timeToReach: Infinity,  // Estimated frames to reach us
                dangerZone: false       // Within immediate danger range
            }
        }),

        // Update tracking for all snakes - called every frame
        update: () => {
            const snakes = window.slithers || [];
            const mySnake = window.slither || window.snake;
            if (!mySnake) return;

            const myX = mySnake.xx || mySnake.x || 0;
            const myY = mySnake.yy || mySnake.y || 0;
            const myId = mySnake.id;
            const frame = STATE.frameCount;

            // Track which snakes we see this frame
            const seenThisFrame = new Set();

            for (let i = 0; i < snakes.length; i++) {
                const s = snakes[i];
                if (!s || s.id === myId || s.dead) continue;

                seenThisFrame.add(s.id);

                let data = SnakeTracker.snakes.get(s.id);

                if (!data) {
                    // New snake - create tracking entry
                    data = SnakeTracker.createSnakeData(s);
                    SnakeTracker.snakes.set(s.id, data);
                    SnakeTracker.totalTracked++;
                }

                // Store previous position for velocity calc
                const prevX = data.x;
                const prevY = data.y;
                const prevAng = data.ang;

                // Update current state
                data.x = s.xx || s.x || 0;
                data.y = s.yy || s.y || 0;
                data.ang = s.ang || 0;
                data.speed = s.sp || 11;
                data.maxSpeed = s.msp || 14;
                data.radius = s.rcv || 18;
                data.length = s.sct || 10;
                data.score = s.sc || 1;
                data.boosting = data.speed > 11;
                data.lastSeen = frame;

                // Calculate velocity
                const dx = data.x - prevX;
                const dy = data.y - prevY;
                data.vx = dx;
                data.vy = dy;

                // Update history (ring buffer)
                if (data.history.length < SnakeTracker.HISTORY_LENGTH) {
                    data.history.push({ x: data.x, y: data.y, ang: data.ang, frame, boosting: data.boosting });
                } else {
                    data.history[data.historyIndex] = { x: data.x, y: data.y, ang: data.ang, frame, boosting: data.boosting };
                }
                data.historyIndex = (data.historyIndex + 1) % SnakeTracker.HISTORY_LENGTH;

                // Calculate average speed from history
                if (data.history.length >= 2) {
                    const oldest = data.history[(data.historyIndex + 1) % data.history.length] || data.history[0];
                    const totalDist = Math.sqrt(distSq(data.x, data.y, oldest.x, oldest.y));
                    const framesDiff = frame - oldest.frame || 1;
                    data.avgSpeed = totalDist / framesDiff;
                }

                // Update behavior analysis
                SnakeTracker.analyzeBehavior(data, prevAng, myX, myY);

                // Calculate threat level
                SnakeTracker.calculateThreat(data, myX, myY, mySnake);

                // Predict future position
                SnakeTracker.predictPosition(data);
            }

            // Check for stale/dead snakes
            for (const [id, data] of SnakeTracker.snakes) {
                if (!seenThisFrame.has(id)) {
                    if (frame - data.lastSeen > SnakeTracker.STALE_TIMEOUT) {
                        // Snake hasn't been seen for a while - likely dead or left view
                        SnakeTracker.snakes.delete(id);
                    }
                }
            }

            SnakeTracker.activeCount = seenThisFrame.size;
            SnakeTracker.lastUpdateFrame = frame;
        },

        // Analyze snake behavior patterns
        analyzeBehavior: (data, prevAng, myX, myY) => {
            const b = data.behavior;

            // Turn rate (smoothed)
            let angleDiff = data.ang - prevAng;
            if (angleDiff > Math.PI) angleDiff -= TWO_PI;
            if (angleDiff < -Math.PI) angleDiff += TWO_PI;
            b.turnRate = b.turnRate * 0.9 + Math.abs(angleDiff) * 0.1;

            // Boost frequency
            if (data.boosting) {
                b.boostFrequency = Math.min(100, b.boostFrequency + 2);
            } else {
                b.boostFrequency = Math.max(0, b.boostFrequency - 0.5);
            }

            // Distance and approach detection
            const distToUs = Math.sqrt(distSq(data.x, data.y, myX, myY));

            // Is this snake approaching us?
            const angleToUs = Math.atan2(myY - data.y, myX - data.x);
            let angleDiffToUs = Math.abs(data.ang - angleToUs);
            if (angleDiffToUs > Math.PI) angleDiffToUs = TWO_PI - angleDiffToUs;

            // If pointing at us and moving toward us
            const pointingAtUs = angleDiffToUs < 0.5; // Within ~30 degrees
            const wasCloser = data.threat.distance > distToUs;

            if (distToUs < 500 && pointingAtUs && wasCloser) {
                b.approachCount++;
                b.lastNearUs = STATE.frameCount;
                b.aggression = Math.min(100, b.aggression + 5);

                // Hunting us if repeatedly approaching
                if (b.approachCount > 10) {
                    b.huntingUs = true;
                }
            } else if (distToUs > 600) {
                // Far away - reduce aggression over time
                b.aggression = Math.max(0, b.aggression - 0.2);
                if (STATE.frameCount - b.lastNearUs > 300) {
                    b.huntingUs = false;
                    b.approachCount = Math.max(0, b.approachCount - 1);
                }
            }

            // Predictability based on turn rate variance
            if (b.turnRate < 0.05) {
                b.predictability = Math.min(100, b.predictability + 1);
            } else {
                b.predictability = Math.max(0, b.predictability - b.turnRate * 10);
            }
        },

        // Calculate threat level for a snake
        calculateThreat: (data, myX, myY, mySnake) => {
            const t = data.threat;

            // Distance
            t.distance = Math.sqrt(distSq(data.x, data.y, myX, myY));

            // Angle to us
            t.angleToUs = Math.atan2(myY - data.y, myX - data.x);

            // Is approaching?
            let angleDiff = Math.abs(data.ang - t.angleToUs);
            if (angleDiff > Math.PI) angleDiff = TWO_PI - angleDiff;
            t.approaching = angleDiff < 0.8 && data.speed > 5;  // Pointing roughly at us and moving

            // Time to reach us
            const closingSpeed = data.avgSpeed * Math.cos(angleDiff);
            t.timeToReach = closingSpeed > 0 ? t.distance / closingSpeed : Infinity;

            // Danger zone (immediate threat)
            t.dangerZone = t.distance < 300;

            // Overall threat level (0-100)
            let threat = 0;

            // Distance factor (closer = more threat)
            if (t.distance < 100) threat += 50;
            else if (t.distance < 200) threat += 35;
            else if (t.distance < 400) threat += 20;
            else if (t.distance < 600) threat += 10;
            else if (t.distance < 1000) threat += 5;

            // Approaching factor
            if (t.approaching) threat += 20;

            // Time to reach factor
            if (t.timeToReach < 30) threat += 20;  // Less than 0.5 seconds
            else if (t.timeToReach < 60) threat += 10;

            // Size comparison (bigger = more threat)
            const myLength = mySnake.sct || 10;
            if (data.length > myLength * 1.5) threat += 15;
            else if (data.length > myLength) threat += 5;

            // Behavior factors
            threat += data.behavior.aggression * 0.2;
            if (data.behavior.huntingUs) threat += 25;
            if (data.boosting && t.approaching) threat += 10;

            t.level = Math.min(100, Math.max(0, threat));
        },

        // Predict where snake will be in PREDICTION_FRAMES
        predictPosition: (data) => {
            const p = data.predicted;
            const frames = SnakeTracker.PREDICTION_FRAMES;

            // Simple linear prediction based on current velocity
            p.x = data.x + data.vx * frames;
            p.y = data.y + data.vy * frames;

            // Confidence based on predictability
            p.confidence = data.behavior.predictability;

            // Reduce confidence if boosting (unpredictable)
            if (data.boosting) p.confidence *= 0.7;

            // Reduce confidence if high turn rate
            if (data.behavior.turnRate > 0.1) {
                p.confidence *= 0.5;
            }
        },

        // Get the N most threatening snakes
        getMostThreatening: (count = 5) => {
            const threats = [];
            for (const data of SnakeTracker.snakes.values()) {
                if (data.threat.level > 0) {
                    threats.push(data);
                }
            }
            threats.sort((a, b) => b.threat.level - a.threat.level);
            return threats.slice(0, count);
        },

        // Get snakes actively hunting us
        getHunters: () => {
            const hunters = [];
            for (const data of SnakeTracker.snakes.values()) {
                if (data.behavior.huntingUs) {
                    hunters.push(data);
                }
            }
            return hunters;
        },

        // Get snakes within a radius
        getInRadius: (x, y, radius) => {
            const result = [];
            const radiusSq = radius * radius;
            for (const data of SnakeTracker.snakes.values()) {
                const d = distSq(data.x, data.y, x, y);
                if (d <= radiusSq) {
                    result.push(data);
                }
            }
            return result;
        },

        // Get snake by ID
        get: (id) => SnakeTracker.snakes.get(id),

        // Get all tracked snakes
        getAll: () => Array.from(SnakeTracker.snakes.values()),

        // Get snakes sorted by distance
        getByDistance: (x, y) => {
            const sorted = [];
            for (const data of SnakeTracker.snakes.values()) {
                data._sortDist = distSq(data.x, data.y, x, y);
                sorted.push(data);
            }
            sorted.sort((a, b) => a._sortDist - b._sortDist);
            return sorted;
        },

        // Get statistics
        getStats: () => ({
            total: SnakeTracker.totalTracked,
            active: SnakeTracker.activeCount,
            tracking: SnakeTracker.snakes.size,
            hunters: SnakeTracker.getHunters().length,
            topThreats: SnakeTracker.getMostThreatening(3).map(s => ({
                id: s.id, threat: s.threat.level, dist: Math.round(s.threat.distance)
            }))
        }),

        // Clear all tracking (on death/respawn)
        clear: () => {
            SnakeTracker.snakes.clear();
            SnakeTracker.totalTracked = 0;
            SnakeTracker.activeCount = 0;
        }
    };

    // ==================== SNAKE ACCESS ====================
    const Snake = {
        getMy: () => window.slither || window.snake,

        getHead: () => {
            const s = Snake.getMy();
            if (!s || s.dead) return null;
            return {
                x: s.xx || s.x || 0,
                y: s.yy || s.y || 0,
                ang: s.ang || 0,
                sp: s.sp || 11,
                msp: s.msp || 14,           // Max speed
                sc: s.sc || 1,
                sct: s.sct || 10,           // Segment count
                pts: s.pts || 0,            // Score
                rcv: s.rcv || 18,           // Body radius
                kills: s.kill_count || 0    // Kill count
            };
        },

        // Get all nearby bodies - FRESH EVERY FRAME, no caching
        scan: (headX, headY, radius) => {
            const radiusSq = radius * radius;
            const snakes = window.slithers || [];  // Direct access each frame
            const mySnake = Snake.getMy();
            const myId = mySnake?.id;
            const result = { bodies: [], heads: [] };

            for (let i = 0; i < snakes.length; i++) {
                const s = snakes[i];
                if (!s || s.id === myId || s.dead) continue;

                // Enemy head position (xx, yy are the live coords)
                const hx = s.xx || 0;
                const hy = s.yy || 0;
                const hd = distSq(headX, headY, hx, hy);

                // Body radius from rcv (actual game value!)
                const bodyRadius = s.rcv || 18;

                if (hd <= radiusSq) {
                    result.heads.push({
                        x: hx, y: hy, ang: s.ang || 0, sp: s.sp || 11,
                        msp: s.msp || 14, distSq: hd, dist: Math.sqrt(hd),
                        id: s.id, radius: bodyRadius,
                        sct: s.sct || 10,           // Segment count (length)
                        sc: s.sc || 1,              // Score/size
                        snake: s                     // Reference to full snake for body tracking
                    });
                }

                // Body segments - prefer gptz (exact positions) over pts
                const segments = s.gptz || s.pts;
                if (!segments) continue;

                // Check EVERY segment - no sampling! Bodies are walls we must avoid
                for (let j = 0; j < segments.length; j++) {
                    const pt = segments[j];
                    if (!pt || pt.dying) continue;
                    const px = pt.xx ?? pt.x ?? 0;
                    const py = pt.yy ?? pt.y ?? 0;
                    const pd = distSq(headX, headY, px, py);
                    if (pd <= radiusSq) {
                        result.bodies.push({
                            x: px, y: py, distSq: pd, dist: Math.sqrt(pd),
                            radius: bodyRadius,  // Use actual rcv value!
                            snakeId: s.id        // Track which snake this belongs to
                        });
                    }
                }
            }

            // Sort by distance - closest first
            result.bodies.sort((a, b) => a.distSq - b.distSq);
            result.heads.sort((a, b) => a.distSq - b.distSq);
            return result;
        }
    };

    // ==================== THREAT & OBSTACLE DETECTION ====================
    // REWORKED FOR MULTI-SNAKE SCENARIOS
    // Key principle: In crowded areas, EVERY snake is a compound threat
    // SURVIVAL FIRST - don't enter areas you can't escape from
    const Threat = {
        danger: 0,        // Combined danger level
        edgeDanger: 0,
        headDanger: 0,    // Enemy heads threat
        wallDanger: 0,    // Bodies as walls
        escapeAngle: 0,
        blocked: STATE.blocked,
        ownBody: STATE.ownBody,
        radar: STATE.radar,
        radarType: STATE.radarType,
        mapRadius: 21600,
        mapCenter: { x: 0, y: 0 },
        nearestWall: null,
        mySegments: [],

        // MULTI-SNAKE AWARENESS - NEW!
        snakeCount: 0,           // How many snakes nearby
        snakeDensity: 0,         // 0-1 density rating
        crowdedArea: false,      // True if too many snakes
        convergingSnakes: 0,     // Snakes heading toward us
        escapeRoutes: 0,         // Number of viable escape directions
        nearbyHeads: [],         // All enemy heads for compound analysis
        nearbyBodies: [],        // All body segments for density analysis

        // HARDCODED OPTIMAL SURVIVAL SETTINGS
        WALL_CLEARANCE: 80,      // INCREASED - more buffer
        SAFE_CLEARANCE: 150,     // INCREASED - comfortable distance
        DANGER_CLEARANCE: 300,   // INCREASED - start avoiding earlier
        RADAR_RANGE: RADAR_MAX_RANGE,

        // Multi-snake thresholds
        MAX_SAFE_SNAKES: 2,      // More than this = crowded
        DENSITY_DANGER: 0.4,     // Density above this = evacuate
        MIN_ESCAPE_ROUTES: 3,    // Need at least this many exits

        // Speed-based safety
        STOPPING_FRAMES: 8,      // INCREASED - more reaction time
        FORWARD_SCAN_FRAMES: 20, // INCREASED - look further ahead
        BOOST_SAFETY_MULT: 2.5,  // Extra margin when boosting

        // Main detection - runs once per frame
        // MONITORS ALL SNAKES EVERY FRAME for continuous awareness
        detect: (head) => {
            if (!head) return;

            // Reset all state
            Threat.blocked.fill(false);
            Threat.ownBody.fill(Infinity);
            Threat.radar.fill(Infinity);
            Threat.radarType.fill('none');
            Threat.mySegments = [];
            Threat.nearestWall = null;

            // MULTI-SNAKE RESET - critical for proper tracking
            Threat.snakeCount = 0;
            Threat.snakeDensity = 0;
            Threat.crowdedArea = false;
            Threat.convergingSnakes = 0;
            Threat.nearbyHeads = [];
            Threat.nearbyBodies = [];

            let escX = 0, escY = 0;
            let escapeWeight = 0;  // Track total escape vector weight

            const myRadius = head.rcv || 18;
            const mySpeed = head.sp || 11;
            const myHeading = head.ang;

            // FIRST: Map our OWN body - transparent to rays
            const mySnake = Snake.getMy();
            if (mySnake && mySnake.pts) {
                const pts = mySnake.pts;
                for (let i = 5; i < pts.length; i++) {
                    const pt = pts[i];
                    if (!pt || pt.dying) continue;
                    const px = pt.xx ?? pt.x ?? 0;
                    const py = pt.yy ?? pt.y ?? 0;
                    const segDist = dist(head.x, head.y, px, py);

                    // Track own body position for wall-following escape (NOT as obstacle)
                    if (segDist < Threat.RADAR_RANGE) {
                        const angleToSeg = Math.atan2(py - head.y, px - head.x);
                        const sectorIdx = Math.floor(((normAngle(angleToSeg) + PI) / TWO_PI) * SECTORS) % SECTORS;

                        // Only track distance - DO NOT block radar or mark as obstacle!
                        // Our own body is TRANSPARENT to sensors
                        Threat.ownBody[sectorIdx] = Math.min(Threat.ownBody[sectorIdx], segDist);
                        Threat.mySegments.push({ x: px, y: py, dist: segDist, idx: i });

                        // DO NOT block our own body - we can turn alongside it
                        // DO NOT update radar - rays pass through our body
                    }
                }
            }

            // 1. EDGE DETECTION - grd is the ACTUAL map radius from game!
            const mapRadius = window.grd || 32550;
            Threat.mapRadius = mapRadius;
            const cx = mapRadius, cy = mapRadius;
            Threat.mapCenter = { x: cx, y: cy };
            Threat.myRadius = myRadius;

            const distFromCenter = dist(head.x, head.y, cx, cy);
            const distFromEdge = mapRadius - distFromCenter;

            // RADAR: Calculate edge distance in all directions
            // The edge is a circle, so distance varies by direction
            const angleFromCenter = Math.atan2(head.y - cy, head.x - cx);
            for (let i = 0; i < SECTORS; i++) {
                const sectorAngle = ((i / SECTORS) * TWO_PI) - PI;
                // How far to edge in this direction? Approximate with ray casting
                const angleDelta = Math.abs(angleDiff(sectorAngle, angleFromCenter));
                // If pointing toward edge (within 90°), edge is closer
                if (angleDelta < HALF_PI) {
                    const edgeDist = distFromEdge / Math.cos(angleDelta);
                    if (edgeDist < Threat.radar[i]) {
                        Threat.radar[i] = Math.max(0, edgeDist - myRadius);
                        Threat.radarType[i] = 'edge';
                    }
                }
            }

            // Use learned edge buffer
            const adjustedEdgeBuffer = GameLog.getAdjustedEdgeBuffer();

            if (distFromEdge < CONFIG.safety.edgeHardLimit) {
                Threat.edgeDanger = 1.0;
            } else if (distFromEdge < adjustedEdgeBuffer) {
                Threat.edgeDanger = 1 - (distFromEdge - CONFIG.safety.edgeHardLimit) /
                    (adjustedEdgeBuffer - CONFIG.safety.edgeHardLimit);
            } else {
                Threat.edgeDanger = 0;
            }

            if (Threat.edgeDanger > 0.1) {
                const angleToCenter = Math.atan2(cy - head.y, cx - head.x);
                const edgeEscapeWeight = Threat.edgeDanger * 2;
                escX += Math.cos(angleToCenter) * edgeEscapeWeight;
                escY += Math.sin(angleToCenter) * edgeEscapeWeight;
                escapeWeight += edgeEscapeWeight;

                const angleToEdge = angleToCenter + PI;
                const blockIdx = Math.floor(((normAngle(angleToEdge) + PI) / TWO_PI) * SECTORS) % SECTORS;
                for (let i = -30; i <= 30; i++) {
                    const idx = (blockIdx + i + SECTORS) % SECTORS;
                    Threat.blocked[idx] = true;
                }
            }

            // 2. BODY WALLS - Track ALL body segments for multi-snake awareness
            const radarScanRange = Math.max(Threat.RADAR_RANGE, GameLog.getBodyAvoidRadius());
            const bodyScan = Snake.scan(head.x, head.y, radarScanRange);
            Threat.wallDanger = 0;

            // MULTI-SNAKE: Track unique snakes and their segments
            const uniqueSnakes = new Set();
            const snakeSegmentCount = new Map();  // snakeId -> segment count nearby

            // Stopping/scanning distances
            const stoppingDistance = mySpeed * Threat.STOPPING_FRAMES;
            const forwardCheckDist = mySpeed * Threat.FORWARD_SCAN_FRAMES;
            let forwardBodyDanger = 0;

            // Store all bodies for density analysis
            Threat.nearbyBodies = bodyScan.bodies.filter(b => b.dist < 600);

            for (const body of bodyScan.bodies) {
                // Track unique snakes
                if (body.snakeId) {
                    uniqueSnakes.add(body.snakeId);
                    snakeSegmentCount.set(body.snakeId, (snakeSegmentCount.get(body.snakeId) || 0) + 1);
                }

                const toBody = Math.atan2(body.y - head.y, body.x - head.x);
                const sectorIdx = Math.floor(((normAngle(toBody) + PI) / TWO_PI) * SECTORS) % SECTORS;

                const bodyRadius = body.radius || 18;
                const clearance = body.dist - myRadius - bodyRadius;

                // Check if body is in our forward path
                let angleFromHeading = Math.abs(angleDiff(myHeading, toBody));
                const inForwardCone = angleFromHeading < 0.5;
                const inWideCone = angleFromHeading < 1.0;

                if (clearance < Threat.radar[sectorIdx]) {
                    Threat.radar[sectorIdx] = clearance;
                    Threat.radarType[sectorIdx] = 'enemy';
                }

                // Body angular width
                const angularWidth = Math.atan2(bodyRadius, Math.max(1, body.dist));
                const bodyWidthSectors = Math.max(2, Math.ceil(angularWidth / (TWO_PI / SECTORS)) + 1);
                for (let k = -bodyWidthSectors; k <= bodyWidthSectors; k++) {
                    const adjIdx = (sectorIdx + k + SECTORS) % SECTORS;
                    // Slightly reduce clearance for adjacent sectors
                    const adjClearance = clearance + Math.abs(k) * 5;
                    if (adjClearance < Threat.radar[adjIdx]) {
                        Threat.radar[adjIdx] = adjClearance;
                        Threat.radarType[adjIdx] = 'enemy';
                    }
                }

                // Track nearest wall for reference
                if (!Threat.nearestWall || body.dist < Threat.nearestWall.dist) {
                    Threat.nearestWall = body;
                }

                // CRITICAL: Bodies in forward path need EXTRA attention!
                if (inForwardCone && body.dist < forwardCheckDist) {
                    // This body is directly ahead - DANGER!
                    const forwardDanger = 1 - (clearance / forwardCheckDist);
                    if (forwardDanger > forwardBodyDanger) {
                        forwardBodyDanger = forwardDanger;
                    }

                    // Add escape vector AWAY from bodies in our path
                    if (clearance < stoppingDistance * 2) {
                        const awayAngle = toBody + PI;  // Opposite direction
                        const escapeStrength = 1 - (clearance / (stoppingDistance * 2));
                        escX += Math.cos(awayAngle) * escapeStrength * 0.8;
                        escY += Math.sin(awayAngle) * escapeStrength * 0.8;
                    }
                }

                // SAFE BLOCKING: Block directions where we could collide
                // AGGRESSIVE blocking - better safe than dead!
                const safeBlockingDist = Threat.WALL_CLEARANCE + stoppingDistance;
                const forwardBlockingDist = inWideCone ? safeBlockingDist * 2.0 : safeBlockingDist * 1.5;

                if (clearance < forwardBlockingDist) {
                    const proximityFactor = 1 - (clearance / forwardBlockingDist);
                    let spread = Math.ceil(25 + proximityFactor * 50);  // 25-75 sectors (WIDER)

                    // Bodies directly ahead get MAXIMUM blocking
                    if (inForwardCone && clearance < stoppingDistance) {
                        spread = Math.max(spread, 90);  // Block 90 degrees when close ahead
                    }

                    for (let i = -spread; i <= spread; i++) {
                        Threat.blocked[(sectorIdx + i + SECTORS) % SECTORS] = true;
                    }

                    // Add escape vector away from close bodies
                    if (clearance < stoppingDistance * 2) {
                        const awayAngle = toBody + PI;
                        const escapeStrength = (1 - clearance / (stoppingDistance * 2)) * 1.5;
                        escX += Math.cos(awayAngle) * escapeStrength;
                        escY += Math.sin(awayAngle) * escapeStrength;
                        escapeWeight += escapeStrength;
                    }

                    if (clearance < Threat.WALL_CLEARANCE) {
                        Threat.wallDanger = 1.0;
                    } else {
                        Threat.wallDanger = Math.max(Threat.wallDanger, proximityFactor);
                    }
                } else if (clearance < Threat.DANGER_CLEARANCE) {
                    const dangerFactor = 1 - (clearance / Threat.DANGER_CLEARANCE);
                    const spread = Math.ceil(20 + dangerFactor * 30);  // 20-50 sectors
                    for (let i = -spread; i <= spread; i++) {
                        Threat.blocked[(sectorIdx + i + SECTORS) % SECTORS] = true;
                    }
                    Threat.wallDanger = Math.max(Threat.wallDanger, 0.6 * dangerFactor);
                }
            }

            // MULTI-SNAKE DENSITY ANALYSIS
            Threat.snakeCount = uniqueSnakes.size;
            Threat.crowdedArea = Threat.snakeCount > Threat.MAX_SAFE_SNAKES;

            // Calculate density: body segments per unit area
            const nearbyBodyCount = Threat.nearbyBodies.length;
            Threat.snakeDensity = Math.min(1.0, nearbyBodyCount / 50);  // 50+ segments = max density

            // Count escape routes (unblocked sectors with good clearance)
            Threat.escapeRoutes = 0;
            for (let i = 0; i < SECTORS; i += 10) {  // Check every 10 degrees
                if (!Threat.blocked[i] && Threat.radar[i] > Threat.SAFE_CLEARANCE) {
                    Threat.escapeRoutes++;
                }
            }

            // CRITICAL: If crowded area, increase danger significantly!
            if (Threat.crowdedArea || Threat.snakeDensity > Threat.DENSITY_DANGER) {
                Threat.wallDanger = Math.max(Threat.wallDanger, 0.5 + Threat.snakeDensity * 0.5);
            }

            // If few escape routes, PANIC!
            if (Threat.escapeRoutes < Threat.MIN_ESCAPE_ROUTES) {
                Threat.wallDanger = Math.max(Threat.wallDanger, 0.8);
            }

            // Forward body danger
            if (forwardBodyDanger > 0.1) {
                Threat.wallDanger = Math.max(Threat.wallDanger, forwardBodyDanger * 1.5);
            }

            // 3. ENEMY HEADS - Track ALL for multi-snake analysis
            const adjustedHeadRadius = GameLog.getAdjustedThreatRadius();
            const headScan = Snake.scan(head.x, head.y, adjustedHeadRadius);
            Threat.headDanger = 0;
            Threat.nearbyHeads = headScan.heads;  // Store for compound analysis
            Threat.convergingSnakes = 0;

            for (const enemy of headScan.heads) {
                const angleToUs = Math.atan2(head.y - enemy.y, head.x - enemy.x);
                const headingDiff = Math.abs(angleDiff(enemy.ang, angleToUs));

                // Check if enemy is converging on us
                if (headingDiff < HALF_PI && enemy.dist < 400) {
                    Threat.convergingSnakes++;
                }

                const inFrontCone = headingDiff < HALF_PI;

                let danger = 0;

                // Very close = always dangerous
                if (enemy.dist < 60) {
                    danger = 1.0;
                }
                // In their attack cone and close
                else if (inFrontCone && enemy.dist < 100) {
                    danger = 0.95;
                }
                else if (inFrontCone && enemy.dist < 180) {
                    danger = 0.7;
                }
                else if (inFrontCone && enemy.dist < 280) {
                    danger = 0.5;
                }
                else if (headingDiff < 1.0 && enemy.dist < 350) {
                    danger = 0.3;
                }

                // Boosting enemy = extra dangerous!
                if (enemy.sp > 13 && danger > 0) danger = Math.min(1.0, danger * 1.4);

                // Check if this snake is HUNTING US (from SnakeTracker)
                const trackedSnake = SnakeTracker.get(enemy.id);
                if (trackedSnake) {
                    // Hunters are extra dangerous!
                    if (trackedSnake.behavior.huntingUs) {
                        danger = Math.min(1.0, danger * 1.5);
                    }
                    // High aggression = more dangerous
                    if (trackedSnake.behavior.aggression > 50) {
                        danger = Math.min(1.0, danger * 1.2);
                    }
                    // Use predicted position to block future threat
                    if (trackedSnake.predicted.confidence > 50) {
                        const predAngle = Math.atan2(
                            trackedSnake.predicted.y - head.y,
                            trackedSnake.predicted.x - head.x
                        );
                        const predIdx = Math.floor(((normAngle(predAngle) + PI) / TWO_PI) * SECTORS) % SECTORS;
                        // Block predicted position sectors if close enough
                        const predDist = dist(trackedSnake.predicted.x, trackedSnake.predicted.y, head.x, head.y);
                        if (predDist < 200 && danger > 0.3) {
                            for (let i = -15; i <= 15; i++) {
                                Threat.blocked[(predIdx + i + SECTORS) % SECTORS] = true;
                            }
                        }
                    }
                }

                if (danger > 0.15) {
                    // Escape AWAY from their front
                    const awayAngle = Math.atan2(head.y - enemy.y, head.x - enemy.x);
                    escX += Math.cos(awayAngle) * danger * 1.5;
                    escY += Math.sin(awayAngle) * danger * 1.5;
                    Threat.headDanger = Math.max(Threat.headDanger, danger);

                    // Block direction toward enemy head (360 sectors)
                    const blockIdx = Math.floor(((normAngle(awayAngle + PI) + PI) / TWO_PI) * SECTORS) % SECTORS;
                    for (let i = -40; i <= 40; i++) {  // ~40° block zone
                        Threat.blocked[(blockIdx + i + SECTORS) % SECTORS] = true;
                    }
                }
            }

            // COMPOUND DANGER CALCULATION - Considers EVERYTHING
            // Multiple snakes converging is more dangerous than one
            let compoundDanger = 0;

            // Base dangers
            compoundDanger = Math.max(compoundDanger, Threat.headDanger);
            compoundDanger = Math.max(compoundDanger, Threat.edgeDanger);

            // Body danger - treated more seriously now
            if (Threat.wallDanger > 0.3) {
                compoundDanger = Math.max(compoundDanger, Threat.wallDanger);
            }

            // MULTI-SNAKE COMPOUND - converging snakes multiply danger!
            if (Threat.convergingSnakes >= 2) {
                compoundDanger = Math.min(1.0, compoundDanger * (1 + Threat.convergingSnakes * 0.3));
            }

            // Crowded area = elevated base danger
            if (Threat.crowdedArea) {
                compoundDanger = Math.max(compoundDanger, 0.4 + Threat.snakeCount * 0.1);
            }

            // Few escape routes = critical
            if (Threat.escapeRoutes < Threat.MIN_ESCAPE_ROUTES) {
                compoundDanger = Math.max(compoundDanger, 0.7);
            }

            Threat.danger = Math.min(1.0, compoundDanger);

            // ESCAPE ANGLE - Normalize by weight to prevent vector cancellation
            if (escapeWeight > 0) {
                escX /= escapeWeight;
                escY /= escapeWeight;
            }

            Threat.escapeAngle = (escX !== 0 || escY !== 0)
                ? Math.atan2(escY, escX)
                : head.ang + PI;

            // TRAP DETECTION
            Trap.detect(head);

            if (Trap.detected && Trap.urgency > 0.5) {
                const trapEscape = Trap.getEscapeAngle(head);
                if (trapEscape !== null) {
                    Threat.escapeAngle = trapEscape;
                    const adjustedUrgency = GameLog.getAdjustedTrapUrgency(Trap.urgency);
                    Threat.danger = Math.max(Threat.danger, adjustedUrgency);
                }
            }
        },

        // Find best unblocked direction - Uses 360 sectors for precision
        findClearAngle: (head, preferredAngle) => {
            const prefIdx = Math.floor(((normAngle(preferredAngle) + PI) / TWO_PI) * SECTORS) % SECTORS;

            if (!Threat.blocked[prefIdx]) return preferredAngle;

            // Spiral outward from preferred angle
            for (let offset = 1; offset <= 180; offset++) {
                const leftIdx = (prefIdx + offset) % SECTORS;
                const rightIdx = (prefIdx - offset + SECTORS) % SECTORS;

                if (!Threat.blocked[leftIdx]) {
                    return ((leftIdx / SECTORS) * TWO_PI) - PI;
                }
                if (!Threat.blocked[rightIdx]) {
                    return ((rightIdx / SECTORS) * TWO_PI) - PI;
                }
            }

            // ALL sectors blocked? Find sector with most distant wall
            let bestIdx = prefIdx;
            let bestWallDist = 0;

            for (let i = 0; i < SECTORS; i++) {
                // Check own body distance in this sector
                const ownDist = Threat.ownBody[i];
                if (ownDist > bestWallDist && ownDist !== Infinity) {
                    bestWallDist = ownDist;
                    bestIdx = i;
                }
            }

            // If we found a sector along our body with some distance, use it
            if (bestWallDist > 50) {
                return ((bestIdx / SECTORS) * TWO_PI) - PI;
            }

            // PASS 3: Still stuck? Just go for escape angle - it's our best guess
            return Threat.escapeAngle;
        },

        // Find ANY open angle - even if it requires a full 180° turn
        // Called when in emergency situations (trapped, about to die)
        findAnyEscape: (head) => {
            // FIRST: Use radar to find sector with MOST clearance
            let bestIdx = 0;
            let bestClearance = -Infinity;

            for (let i = 0; i < SECTORS; i++) {
                const clearance = Threat.radar[i];
                if (clearance > bestClearance && !Threat.blocked[i]) {
                    bestClearance = clearance;
                    bestIdx = i;
                }
            }

            // If we found any unblocked sector with clearance, use it
            if (bestClearance > Threat.WALL_CLEARANCE) {
                return ((bestIdx / SECTORS) * TWO_PI) - PI;
            }

            // Check all 72 sectors for ANY opening (even tight ones)
            for (let i = 0; i < SECTORS; i++) {
                if (!Threat.blocked[i]) {
                    return ((i / SECTORS) * TWO_PI) - PI;
                }
            }

            // Truly all blocked - find sector with most RADAR clearance regardless of blocked
            bestClearance = -Infinity;
            for (let i = 0; i < SECTORS; i++) {
                if (Threat.radar[i] > bestClearance) {
                    bestClearance = Threat.radar[i];
                    bestIdx = i;
                }
            }

            // If any sector has clearance, squeeze through!
            if (bestClearance > 0) {
                return ((bestIdx / SECTORS) * TWO_PI) - PI;
            }

            // Check own body for wall-following escape
            let bestOwnDist = 0;
            for (let i = 0; i < SECTORS; i++) {
                if (Threat.ownBody[i] > bestOwnDist && Threat.ownBody[i] !== Infinity) {
                    bestOwnDist = Threat.ownBody[i];
                    bestIdx = i;
                }
            }

            if (bestOwnDist > 40) {
                return ((bestIdx / SECTORS) * TWO_PI) - PI;
            }

            // Last resort: go opposite of most dangerous direction
            return Threat.escapeAngle;
        },

        // RADAR-BASED PATH FINDING: Find path through tight spaces using exact clearances
        // Returns angle with most clearance, preferring direction near preferred angle
        // SAFETY FIRST: Heavily weight clearance over angle preference
        findBestPath: (head, preferredAngle) => {
            const prefIdx = Math.floor(((normAngle(preferredAngle) + PI) / TWO_PI) * SECTORS) % SECTORS;
            const speed = head.sp || 11;
            const minSafeClearance = Threat.WALL_CLEARANCE + speed * 2;  // Need room to react

            // If preferred direction has good clearance and isn't blocked, use it
            if (!Threat.blocked[prefIdx] && Threat.radar[prefIdx] >= Threat.SAFE_CLEARANCE) {
                return preferredAngle;
            }

            // Score all directions by: clearance (primary) + proximity to preferred angle (secondary)
            let bestIdx = prefIdx;
            let bestScore = -Infinity;

            for (let i = 0; i < SECTORS; i++) {
                if (Threat.blocked[i]) continue;

                const clearance = Threat.radar[i];
                if (clearance < minSafeClearance) continue;  // Need safe clearance

                // Score: clearance is HEAVILY weighted (0-200) + angle bonus (0-30)
                const angleDelta = Math.abs(i - prefIdx);
                const angleProx = Math.min(angleDelta, SECTORS/2 - angleDelta);  // 0-36
                const angleBonus = 30 - (angleProx * 0.8);  // 30 for same, 0 for opposite

                // Clearance is primary - cap at 200 but weight it more
                const clearanceScore = Math.min(200, clearance * 2);

                const score = clearanceScore + angleBonus;

                if (score > bestScore) {
                    bestScore = score;
                    bestIdx = i;
                }
            }

            if (bestScore > -Infinity) {
                return ((bestIdx / SECTORS) * TWO_PI) - PI;
            }

            // No safe path - try with lower threshold
            for (let i = 0; i < SECTORS; i++) {
                if (Threat.blocked[i]) continue;
                const clearance = Threat.radar[i];
                if (clearance > bestScore) {
                    bestScore = clearance;
                    bestIdx = i;
                }
            }

            if (bestScore > 0) {
                return ((bestIdx / SECTORS) * TWO_PI) - PI;
            }

            // No good path - use emergency escape
            return Threat.findAnyEscape(head);
        },

        // Get closest wall distance in a direction (for display)
        getRadarDist: (sectorIdx) => {
            return Threat.radar[sectorIdx];
        },

        // Get minimum clearance in forward arc (for decision making)
        // Checks wider arc to catch walls we might turn into
        getForwardClearance: (head) => {
            const fwdIdx = Math.floor(((normAngle(head.ang) + PI) / TWO_PI) * SECTORS) % SECTORS;
            let minClearance = Infinity;

            // Check forward 50° arc (10 sectors) - wider to catch side walls
            for (let i = -25; i <= 25; i++) {
                const idx = (fwdIdx + i + SECTORS) % SECTORS;
                minClearance = Math.min(minClearance, Threat.radar[idx]);
            }

            return minClearance;
        },

        // Check if path to target is clear
        isPathClear: (head, angle, distance) => {
            const scan = Snake.scan(head.x, head.y, distance + 50);
            const checkPoints = [0.25, 0.5, 0.75, 1.0];
            const myRadius = head.rcv || 18;

            for (const frac of checkPoints) {
                const cx = head.x + Math.cos(angle) * distance * frac;
                const cy = head.y + Math.sin(angle) * distance * frac;

                for (const body of scan.bodies) {
                    const safeDist = myRadius + (body.radius || 18) + GameLog.getBodyBuffer();
                    if (dist(cx, cy, body.x, body.y) < safeDist) return false;
                }
            }
            return true;
        }
    };

    // ==================== FOOD FINDING ====================
    const Food = {
        target: null,
        targetAngle: 0,
        isPrey: false,  // Track if target is moving prey
        targetTime: 0,  // When we started chasing this target
        lastTargetPos: null,  // Last target position to detect stuck

        find: (head) => {
            if (!head || Threat.danger > (1 - GameLog.getMinSafetyToEat())) {
                Food.target = null;
                Food.lastTargetPos = null;
                return;
            }

            const searchRadius = GameLog.getFoodSearchRadius();
            const radiusSq = searchRadius * searchRadius;
            let best = null;
            let bestScore = 0;

            // Minimum distance - don't chase food we're about to eat anyway
            const minChaseDistance = 30;

            // Timeout - if chasing same area for too long, give up
            const now = performance.now();
            if (Food.lastTargetPos && Food.target) {
                const sameFoodArea = dist(Food.lastTargetPos.x, Food.lastTargetPos.y,
                    Food.target.x, Food.target.y) < 50;
                if (sameFoodArea && now - Food.targetTime > 3000) {
                    // Been chasing same food for 3+ seconds - skip it
                    Food.target = null;
                    Food.lastTargetPos = null;
                    Food.targetTime = now;
                    return;
                }
            }

            // Helper to score a food/prey item
            const scoreItem = (x, y, size, isPrey, speed, angle) => {
                const fDistSq = distSq(head.x, head.y, x, y);
                if (fDistSq > radiusSq) return null;

                const fDist = Math.sqrt(fDistSq);

                // Skip food that's too close
                if (fDist < minChaseDistance) return null;

                const itemAngle = Math.atan2(y - head.y, x - head.x);
                const dirIdx = Math.floor(((normAngle(itemAngle) + PI) / TWO_PI) * SECTORS) % SECTORS;

                // ========== MULTI-SNAKE SAFETY CHECKS ==========
                // REJECT food if we're in a crowded area
                if (Threat.crowdedArea || Threat.snakeCount > 2) {
                    // Only accept VERY close food or prey when crowded
                    if (!isPrey && fDist > 100) return null;
                }

                // REJECT if few escape routes
                if (Threat.escapeRoutes < 3) return null;

                // REJECT if direction is blocked
                if (Threat.blocked[dirIdx]) return null;

                // REJECT if adjacent sectors are blocked (narrow gap)
                const leftIdx = (dirIdx - 8 + SECTORS) % SECTORS;
                const rightIdx = (dirIdx + 8) % SECTORS;
                if (Threat.blocked[leftIdx] && Threat.blocked[rightIdx]) return null;

                // REJECT if wall between us and food
                const radarClearance = Threat.radar[dirIdx];
                if (radarClearance < fDist + Threat.SAFE_CLEARANCE) return null;

                // REJECT if food location is dangerous
                const bodyScan = Snake.scan(x, y, Threat.DANGER_CLEARANCE);

                // Count snakes near food
                const snakesNearFood = new Set();
                for (const body of bodyScan.bodies) {
                    if (body.snakeId) snakesNearFood.add(body.snakeId);
                }

                // REJECT if too many snakes near food location
                if (snakesNearFood.size >= 2) return null;  // 2+ snakes = trap!

                if (bodyScan.bodies.length > 0) {
                    const closestBody = bodyScan.bodies[0];
                    const bodyDist = dist(x, y, closestBody.x, closestBody.y);
                    if (bodyDist < Threat.SAFE_CLEARANCE) return null;
                    if (bodyDist < Threat.DANGER_CLEARANCE && !isPrey && size < CONFIG.food.bigFoodSize) {
                        return null;
                    }
                }

                // REJECT if enemy head near food
                if (bodyScan.heads.length > 0) {
                    const closestHead = bodyScan.heads[0];
                    const headDist = dist(x, y, closestHead.x, closestHead.y);
                    if (headDist < 200) return null;  // Increased radius!
                }

                // REJECT if path not clear
                if (!Threat.isPathClear(head, itemAngle, fDist)) return null;

                // ========== SCORING (Safety-weighted) ==========
                let score = (size * 10) / (fDist + 50);

                // Prey bonus
                if (isPrey) score *= GameLog.getPreyPriority();

                // Forward direction preferred
                const anglePenalty = Math.abs(angleDiff(head.ang, itemAngle)) / PI;

                if (size < 5 && anglePenalty > 0.3) {
                    score *= 0.3;
                } else {
                    score *= (1 - anglePenalty * 0.4);
                }

                // SAFETY BONUS: Prefer food with more clearance around it
                const safetyClearance = radarClearance - fDist;
                if (safetyClearance > Threat.DANGER_CLEARANCE) {
                    score *= 1.3;  // 30% bonus for very safe food
                } else if (safetyClearance > Threat.SAFE_CLEARANCE) {
                    score *= 1.1;  // 10% bonus for safe food
                }

                // OPEN PATH BONUS: Check how many adjacent sectors are open
                let openAdjacent = 0;
                for (let i = -10; i <= 10; i++) {
                    if (!Threat.blocked[(dirIdx + i + SECTORS) % SECTORS]) openAdjacent++;
                }
                if (openAdjacent >= 18) {
                    score *= 1.2;  // Wide open path to food
                } else if (openAdjacent < 10) {
                    score *= 0.7;  // Narrow approach - risky
                }

                return { x, y, size, dist: fDist, angle: itemAngle, score, isPrey, speed };
            };

            // 1. SCAN PREY FIRST (moving orbs from dead snakes - high value!)
            const preys = window.preys || [];
            for (let i = 0; i < preys.length; i++) {
                const p = preys[i];
                if (!p || p.eaten) continue;

                const px = p.xx ?? p.x ?? 0;
                const py = p.yy ?? p.y ?? 0;
                const pSize = p.sz || 5;
                const pSpeed = p.sp || 0;
                const pAngle = p.ang || 0;

                const result = scoreItem(px, py, pSize, true, pSpeed, pAngle);
                if (result && result.score > bestScore) {
                    bestScore = result.score;
                    best = result;
                }
            }

            // 2. SCAN REGULAR FOOD (static pellets)
            const foods = window.foods || [];
            for (let i = 0; i < foods.length; i++) {
                const f = foods[i];
                if (!f || f.eaten_fr > 0) continue;  // eaten_fr > 0 means eaten

                const fx = f.xx ?? f.x ?? 0;
                const fy = f.yy ?? f.y ?? 0;
                const fSize = f.sz || f.size || 1;

                const result = scoreItem(fx, fy, fSize, false, 0, 0);
                if (result && result.score > bestScore) {
                    bestScore = result.score;
                    best = result;
                }
            }

            Food.target = best;
            Food.targetAngle = best ? best.angle : 0;
            Food.isPrey = best ? best.isPrey : false;

            // Track when we started chasing this target
            if (best) {
                if (!Food.lastTargetPos || dist(Food.lastTargetPos.x, Food.lastTargetPos.y, best.x, best.y) > 100) {
                    // New target area
                    Food.targetTime = performance.now();
                }
                Food.lastTargetPos = { x: best.x, y: best.y };
            } else {
                Food.lastTargetPos = null;
            }
        }
    };

    // ==================== ATTACK SYSTEM ====================
    const Attack = {
        target: null,
        mode: null,      // 'cutoff', 'encircle', 'chase'
        targetAngle: 0,

        find: (head) => {
            Attack.target = null;
            Attack.mode = null;

            if (!CONFIG.attack.enabled) return;
            if (!head || head.sct < GameLog.getAttackMinLength()) return;

            // MULTI-SNAKE SAFETY: Don't attack in dangerous situations!
            if (Threat.danger > 0.15) return;  // Very low threshold
            if (Threat.crowdedArea) return;    // Never attack in crowds
            if (Threat.convergingSnakes >= 1) return;  // Never attack if anyone converging
            if (Threat.escapeRoutes < 5) return;  // Need clear escape routes
            if (Threat.snakeCount > 1) return;  // Only attack if just one other snake

            const attackRadius = GameLog.getAttackRadius();
            const scan = Snake.scan(head.x, head.y, attackRadius);
            let bestTarget = null;
            let bestScore = 0;

            // Check if any OTHER snakes are near the potential target
            for (const enemy of scan.heads) {
                if (enemy.dist < 100) continue;

                // CRITICAL: Check if attacking this enemy would put us near OTHER snakes
                const otherSnakesNearTarget = scan.heads.filter(h =>
                    h.id !== enemy.id &&
                    dist(h.x, h.y, enemy.x, enemy.y) < 400
                );
                if (otherSnakesNearTarget.length > 0) continue;  // Other snakes too close!

                const mySize = head.sct;
                const enemySizeEstimate = (enemy.radius / 18) * 50;

                // Require LARGER size advantage
                if (mySize < enemySizeEstimate * 2.0) continue;  // Need 2x advantage!

                const enemySpeed = enemy.sp || 11;
                const mySpeed = head.msp || 14;

                const futureX = enemy.x + Math.cos(enemy.ang) * enemySpeed * 8;
                const futureY = enemy.y + Math.sin(enemy.ang) * enemySpeed * 8;

                // Check if intercept point is safe (no other snakes)
                const interceptScan = Snake.scan(futureX, futureY, 300);
                const otherSnakesAtIntercept = interceptScan.heads.filter(h => h.id !== enemy.id);
                if (otherSnakesAtIntercept.length > 0) continue;

                const interceptDist = dist(head.x, head.y, futureX, futureY);
                const interceptTime = interceptDist / mySpeed;
                const enemyTime = (enemySpeed * 8) / enemySpeed;

                let score = 0;

                const angleToFuture = Math.atan2(futureY - head.y, futureX - head.x);
                const headingToUs = Math.abs(angleDiff(enemy.ang,
                    Math.atan2(head.y - enemy.y, head.x - enemy.x)));

                if (interceptTime < enemyTime * 1.5 && interceptDist < 400) {
                    score = 100 - interceptDist * 0.2;
                    if (headingToUs < 1.5) score += 30;

                    if (Threat.isPathClear(head, angleToFuture, interceptDist)) {
                        if (score > bestScore) {
                            bestScore = score;
                            bestTarget = {
                                enemy,
                                mode: 'cutoff',
                                x: futureX,
                                y: futureY,
                                angle: angleToFuture,
                                dist: interceptDist
                            };
                        }
                    }
                }

                // CHASE: Enemy is fleeing, we're faster
                if (!bestTarget && enemy.sp < mySpeed - 2 && enemy.dist < 300) {
                    const chaseAngle = Math.atan2(enemy.y - head.y, enemy.x - head.x);
                    if (Threat.isPathClear(head, chaseAngle, enemy.dist)) {
                        score = 50 - enemy.dist * 0.1;
                        if (score > bestScore) {
                            bestScore = score;
                            bestTarget = {
                                enemy,
                                mode: 'chase',
                                x: enemy.x,
                                y: enemy.y,
                                angle: chaseAngle,
                                dist: enemy.dist
                            };
                        }
                    }
                }
            }

            Attack.target = bestTarget;
            Attack.mode = bestTarget?.mode;
            Attack.targetAngle = bestTarget?.angle || 0;
        }
    };

    // ==================== UNIFIED DECISION ENGINE ====================
    // ALL features contribute to a SINGLE decision through unified scoring
    // Each direction gets: SAFETY + FOOD + OPPORTUNITY score
    // Best direction wins - no priority cascade, everything works together
    const Decision = {
        angle: 0,
        boost: false,
        reason: 'IDLE',
        defensiveCircle: false,
        circleDir: 1,

        // Direction scores for all 360 degrees
        scores: new Array(SECTORS).fill(0),

        // Score weights - SURVIVAL is most important, then GROWTH
        WEIGHTS: {
            SAFETY: 100,      // Safety is paramount
            CLEARANCE: 50,    // Prefer open space
            FOOD: 20,         // Food is nice but not worth dying
            ATTACK: 15,       // Attack only when very safe
            MOMENTUM: 10,     // Slight preference for current direction
            CENTER: 5         // Slight pull toward map center
        },

        decide: (head) => {
            if (!head) return;

            Decision.boost = false;
            Decision.scores.fill(0);

            const myRadius = head.rcv || 18;
            const mySpeed = head.sp || 11;
            const myHeading = head.ang;
            const headIdx = Math.floor(((normAngle(myHeading) + PI) / TWO_PI) * SECTORS) % SECTORS;

            // ========== GATHER ALL CONTEXT ==========
            const blockedCount = Threat.blocked.filter(b => b).length;
            const forwardClearance = Threat.getForwardClearance(head);

            // Situation assessment
            const emergency = blockedCount > 280 || forwardClearance < Threat.WALL_CLEARANCE;
            const critical = Threat.danger > 0.7 || Threat.escapeRoutes < 2;
            const dangerous = Threat.danger > 0.4 || Threat.crowdedArea;
            const cautious = Threat.danger > 0.2 || Threat.snakeCount > 1;
            const safe = Threat.danger < 0.15 && Threat.escapeRoutes >= 5;

            // Exit defensive circle if trap clears
            if (Decision.defensiveCircle && (!Trap.detected || Trap.urgency < 0.3)) {
                Decision.defensiveCircle = false;
            }

            // ========== SPECIAL CASE: DEFENSIVE CIRCLE ==========
            if (Trap.detected && Trap.urgency > 0.7 && Trap.gapSize < PI/4) {
                Decision.defensiveCircle = true;
                Decision.boost = false;

                const bodyWidth = (myRadius) * 2;
                const snakeLength = head.sct * bodyWidth;
                const perfectTurnRate = (mySpeed * TWO_PI) / snakeLength;
                const turnRate = Math.max(0.05, Math.min(0.5, perfectTurnRate));

                if (!Decision.circleDir) Decision.circleDir = 1;
                if (Trap.encirclerHead) {
                    const toEnemy = Math.atan2(Trap.encirclerHead.y - head.y, Trap.encirclerHead.x - head.x);
                    const turnLeft = angleDiff(myHeading, toEnemy);
                    if (Math.abs(turnLeft) > 0.5) Decision.circleDir = turnLeft > 0 ? -1 : 1;
                }

                Decision.angle = myHeading + (Decision.circleDir * turnRate);
                Decision.reason = '🔄CIRCLE';
                return;
            }

            Decision.defensiveCircle = false;

            // ========== SCORE ALL 360 DIRECTIONS ==========
            for (let i = 0; i < SECTORS; i++) {
                const angle = ((i / SECTORS) * TWO_PI) - PI;
                let score = 0;

                // ----- SAFETY SCORE (most important) -----
                // Blocked directions get massive penalty
                if (Threat.blocked[i]) {
                    score -= Decision.WEIGHTS.SAFETY * 2;
                }

                // Radar clearance - more clearance = better
                const clearance = Threat.radar[i];
                if (clearance === Infinity) {
                    score += Decision.WEIGHTS.CLEARANCE;
                } else if (clearance > Threat.DANGER_CLEARANCE) {
                    score += Decision.WEIGHTS.CLEARANCE * 0.8;
                } else if (clearance > Threat.SAFE_CLEARANCE) {
                    score += Decision.WEIGHTS.CLEARANCE * (clearance / Threat.DANGER_CLEARANCE);
                } else if (clearance > Threat.WALL_CLEARANCE) {
                    score += Decision.WEIGHTS.CLEARANCE * 0.2 * (clearance / Threat.SAFE_CLEARANCE);
                } else {
                    // Very close to wall - big penalty
                    score -= Decision.WEIGHTS.SAFETY * (1 - clearance / Threat.WALL_CLEARANCE);
                }

                // Check for enemy heads in this direction
                for (const enemy of Threat.nearbyHeads) {
                    const toEnemy = Math.atan2(enemy.y - head.y, enemy.x - head.x);
                    const enemyIdx = Math.floor(((normAngle(toEnemy) + PI) / TWO_PI) * SECTORS) % SECTORS;
                    const idxDiff = Math.min(Math.abs(i - enemyIdx), SECTORS - Math.abs(i - enemyIdx));

                    // Penalty for directions toward enemy heads
                    if (idxDiff < 45) {  // Within 45 degrees
                        const proximity = 1 - (enemy.dist / 500);
                        const angleFactor = 1 - (idxDiff / 45);
                        score -= Decision.WEIGHTS.SAFETY * proximity * angleFactor * 1.5;
                    }
                }

                // ----- MOMENTUM SCORE (slight preference for current direction) -----
                const headingDiff = Math.min(Math.abs(i - headIdx), SECTORS - Math.abs(i - headIdx));
                score += Decision.WEIGHTS.MOMENTUM * (1 - headingDiff / 180);

                // ----- CENTER PULL (avoid edges) -----
                if (Threat.edgeDanger > 0.1) {
                    const toCenter = Math.atan2(Threat.mapCenter.y - head.y, Threat.mapCenter.x - head.x);
                    const centerIdx = Math.floor(((normAngle(toCenter) + PI) / TWO_PI) * SECTORS) % SECTORS;
                    const centerDiff = Math.min(Math.abs(i - centerIdx), SECTORS - Math.abs(i - centerIdx));
                    score += Decision.WEIGHTS.CENTER * Threat.edgeDanger * (1 - centerDiff / 180);
                }

                // ----- FOOD SCORE (only when safe enough) -----
                if (!dangerous && Food.target) {
                    const toFood = Food.targetAngle;
                    const foodIdx = Math.floor(((normAngle(toFood) + PI) / TWO_PI) * SECTORS) % SECTORS;
                    const foodDiff = Math.min(Math.abs(i - foodIdx), SECTORS - Math.abs(i - foodIdx));

                    if (foodDiff < 30) {  // Within 30 degrees of food
                        let foodScore = Decision.WEIGHTS.FOOD * (1 - foodDiff / 30);

                        // Bigger/closer food = higher score
                        foodScore *= Math.min(2, Food.target.size / 5);
                        foodScore *= Math.min(1.5, 300 / (Food.target.dist + 50));

                        // Prey bonus
                        if (Food.isPrey) foodScore *= 2;

                        // Only add if direction is safe
                        if (!Threat.blocked[i] && clearance > Threat.SAFE_CLEARANCE) {
                            score += foodScore;
                        }
                    }
                }

                // ----- ATTACK SCORE (only when very safe) -----
                if (safe && Attack.target && !Threat.crowdedArea) {
                    const toTarget = Attack.targetAngle;
                    const attackIdx = Math.floor(((normAngle(toTarget) + PI) / TWO_PI) * SECTORS) % SECTORS;
                    const attackDiff = Math.min(Math.abs(i - attackIdx), SECTORS - Math.abs(i - attackIdx));

                    if (attackDiff < 20) {
                        let attackScore = Decision.WEIGHTS.ATTACK * (1 - attackDiff / 20);

                        // Only if path is very clear
                        if (!Threat.blocked[i] && clearance > Threat.DANGER_CLEARANCE) {
                            score += attackScore;
                        }
                    }
                }

                // ----- ESCAPE BONUS (in dangerous situations) -----
                if (dangerous && Threat.escapeAngle) {
                    const escapeIdx = Math.floor(((normAngle(Threat.escapeAngle) + PI) / TWO_PI) * SECTORS) % SECTORS;
                    const escapeDiff = Math.min(Math.abs(i - escapeIdx), SECTORS - Math.abs(i - escapeIdx));

                    if (escapeDiff < 60) {
                        score += Decision.WEIGHTS.SAFETY * 0.5 * (1 - escapeDiff / 60) * Threat.danger;
                    }
                }

                Decision.scores[i] = score;
            }

            // ========== FIND BEST DIRECTION ==========
            let bestIdx = headIdx;  // Default to current heading
            let bestScore = Decision.scores[headIdx];

            for (let i = 0; i < SECTORS; i++) {
                if (Decision.scores[i] > bestScore) {
                    bestScore = Decision.scores[i];
                    bestIdx = i;
                }
            }

            // Convert index to angle
            Decision.angle = ((bestIdx / SECTORS) * TWO_PI) - PI;

            // ========== DETERMINE REASON ==========
            if (emergency) {
                Decision.reason = '🆘PANIC!';
            } else if (critical) {
                Decision.reason = '💀ESCAPE!';
            } else if (Threat.crowdedArea) {
                Decision.reason = `⚠️${Threat.snakeCount}snk`;
            } else if (Threat.edgeDanger > 0.5) {
                Decision.reason = '🚫EDGE';
            } else if (Threat.wallDanger > 0.4) {
                Decision.reason = '🧱DODGE';
            } else if (Attack.target && safe) {
                Decision.reason = Attack.mode === 'cutoff' ? '🎯CUT!' : '🎯hunt';
            } else if (Food.target && !dangerous) {
                Decision.reason = Food.isPrey ? '💰PREY!' : 'eat';
            } else {
                const clearPct = Math.round((SECTORS - blockedCount) / SECTORS * 100);
                Decision.reason = `👀${clearPct}%`;
            }

            // ========== BOOST DECISION (very conservative) ==========
            // Only boost if: very safe, good clearance ahead, chasing valuable target
            const boostClearance = Threat.radar[bestIdx];
            const canBoost = safe &&
                boostClearance > Threat.DANGER_CLEARANCE * 2 &&
                Threat.escapeRoutes >= 6 &&
                !Threat.crowdedArea &&
                Threat.convergingSnakes === 0;

            if (canBoost && Food.isPrey && Food.target && Food.target.dist < 200) {
                Decision.boost = true;
                Decision.reason = '🚀PREY!';
            }
        }
    };

    // ==================== CONTROL ====================
    const Control = {
        canvas: null,

        init: () => {
            Control.canvas = document.querySelector('canvas');
        },

        apply: (head) => {
            if (!head || !Control.canvas || !CONFIG.bot.enabled) return;

            const rect = Control.canvas.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;

            // Convert angle to mouse position
            const targetX = cx + Math.cos(Decision.angle) * 200;
            const targetY = cy + Math.sin(Decision.angle) * 200;

            // Set mouse position
            if (typeof window.xm !== 'undefined') window.xm = targetX;
            if (typeof window.ym !== 'undefined') window.ym = targetY;

            // Boost control - use actual msp from game data
            const msp = head.msp || 14;  // Max speed from game
            const normalSpeed = msp - 3;  // Normal speed is ~3 below max
            if (typeof window.setAcceleration === 'function') {
                window.setAcceleration(Decision.boost ? 1 : 0);
            } else if (typeof window.snake !== 'undefined') {
                window.snake.sp = Decision.boost ? msp : normalSpeed;
            }

            STATE.reason = Decision.reason;
        }
    };

    // ==================== SIMPLE VISUALS ====================
    const Visuals = {
        overlay: null,
        canvas: null,
        ctx: null,

        init: () => {
            // Status overlay
            Visuals.overlay = document.createElement('div');
            Visuals.overlay.id = 'snaky-overlay';
            Visuals.overlay.style.cssText = `
                position:fixed;top:10px;left:10px;z-index:99999;
                background:rgba(0,0,0,0.8);color:#fff;padding:8px 12px;
                font:11px monospace;border-radius:4px;pointer-events:none;
            `;
            document.body.appendChild(Visuals.overlay);

            // Debug canvas
            if (CONFIG.visual.debug) {
                Visuals.canvas = document.createElement('canvas');
                Visuals.canvas.id = 'snaky-debug';
                Visuals.canvas.style.cssText = `
                    position:fixed;top:0;left:0;width:100%;height:100%;
                    z-index:99998;pointer-events:none;
                `;
                document.body.appendChild(Visuals.canvas);
                Visuals.ctx = Visuals.canvas.getContext('2d');
                Visuals.resize();
                window.addEventListener('resize', Visuals.resize);
            }

            // Minimap
            if (CONFIG.visual.minimap) {
                const mm = document.createElement('canvas');
                mm.id = 'snaky-minimap';
                mm.width = CONFIG.visual.minimapSize;
                mm.height = CONFIG.visual.minimapSize;
                mm.style.cssText = `
                    position:fixed;bottom:10px;right:10px;z-index:99997;
                    border-radius:50%;opacity:0.8;pointer-events:none;
                    border:2px solid #0ff;
                `;
                document.body.appendChild(mm);
                Visuals.minimap = mm;
                Visuals.minimapCtx = mm.getContext('2d');
            }
        },

        resize: () => {
            if (Visuals.canvas) {
                Visuals.canvas.width = window.innerWidth;
                Visuals.canvas.height = window.innerHeight;
            }
        },

        update: (head) => {
            // Update overlay
            if (Visuals.overlay) {
                const bot = CONFIG.bot.enabled ? '🟢' : '🔴';
                // HEAD danger = real threat (enemy front face)
                const headDanger = (Threat.headDanger * 100).toFixed(0);
                const headColor = Threat.headDanger > 0.6 ? '#f00' : Threat.headDanger > 0.3 ? '#ff0' : '#0f0';
                // WALL proximity = just obstacles
                const wallDanger = (Threat.wallDanger * 100).toFixed(0);
                const wallColor = Threat.wallDanger > 0.8 ? '#f80' : '#888';
                // TRAP status with counter-attack indicator
                const trapIcon = Trap.detected ?
                    (Trap.canCounterAttack ? '⚔️' : Trap.urgency > 0.7 ? '🚨' : '⚠️') : '';
                const trapInfo = Trap.detected ?
                    `<span style="color:#f0f">${Math.round(Trap.coverage*100)}%</span>` : '';
                const circleIcon = Decision.defensiveCircle ? '🔄' : '';
                const boostIcon = Decision.boost ? '🚀' : '';
                // Stats from head
                const score = head ? Math.floor(head.pts) : 0;
                const length = head ? head.sct : 0;
                const kills = head ? head.kills : 0;
                const blocked = Threat.blocked.filter(b => b).length;
                const openPct = Math.round((1 - blocked/SECTORS) * 100);
                const blockedColor = blocked > 300 ? '#f00' : blocked > 200 ? '#f80' : '#888';

                // RADAR: Get forward clearance for display
                const fwdClearance = head ? Threat.getForwardClearance(head) : Infinity;
                const clearanceText = fwdClearance < 1000 ? `${Math.round(fwdClearance)}px` : '∞';
                const clearanceColor = fwdClearance < Threat.WALL_CLEARANCE ? '#f00' :
                    fwdClearance < Threat.SAFE_CLEARANCE ? '#f80' :
                    fwdClearance < Threat.DANGER_CLEARANCE ? '#ff0' : '#0f0';

                // Snake tracker stats
                const trackerStats = SnakeTracker.getStats();
                const hunters = trackerStats.hunters;
                const hunterColor = hunters > 0 ? '#f00' : '#0f0';
                const topThreat = trackerStats.topThreats[0];
                const threatText = topThreat ? `T${topThreat.threat}@${topThreat.dist}` : 'Safe';
                const threatColor = topThreat && topThreat.threat > 50 ? '#f00' : topThreat && topThreat.threat > 25 ? '#f80' : '#0f0';

                Visuals.overlay.innerHTML = `
                    ${bot} <span style="color:#0ff">SNAKY v8.1</span> |
                    FPS: ${STATE.fps} |
                    <span style="color:${headColor}">💀${headDanger}%</span>
                    <span style="color:${wallColor}">🧱${wallDanger}%</span>
                    <span style="color:${clearanceColor}">📡${clearanceText}</span> ${trapIcon}${trapInfo} ${circleIcon}${boostIcon} |
                    ${STATE.reason} |
                    <span style="color:#ff0">🏆${score}</span> |
                    <span style="color:#0f0">📏${length}</span> |
                    <span style="color:#f0f">💀${kills}</span> |
                    <span style="color:${blockedColor}">🚫${blocked}/${SECTORS}(${openPct}%)</span> |
                    <span style="color:#08f">🐍${trackerStats.active}</span>
                    <span style="color:${hunterColor}">🎯${hunters}</span>
                    <span style="color:${threatColor}">⚠️${threatText}</span> |
                    <span style="color:#0ff">📊G${GameLog.history.totalGames}</span>
                    <span style="color:#0f0">K/D:${GameLog.history.totalDeaths > 0 ? (GameLog.history.totalKills / GameLog.history.totalDeaths).toFixed(1) : '0'}</span>
                `;
            }

            // Draw debug
            if (CONFIG.visual.debug && head) {
                // Create debug canvas if it doesn't exist
                if (!Visuals.canvas) {
                    Visuals.canvas = document.createElement('canvas');
                    Visuals.canvas.id = 'snaky-debug';
                    Visuals.canvas.style.cssText = `
                        position:fixed;top:0;left:0;width:100%;height:100%;
                        z-index:99998;pointer-events:none;
                    `;
                    document.body.appendChild(Visuals.canvas);
                    Visuals.ctx = Visuals.canvas.getContext('2d');
                    Visuals.resize();
                }
                if (Visuals.ctx) {
                    Visuals.drawDebug(head);
                }
            } else if (Visuals.canvas) {
                // Clear debug canvas when debug is off
                Visuals.ctx?.clearRect(0, 0, Visuals.canvas.width, Visuals.canvas.height);
            }

            // Draw minimap
            if (CONFIG.visual.minimap && Visuals.minimapCtx && head) {
                Visuals.drawMinimap(head);
            }
        },

        drawDebug: (head) => {
            const ctx = Visuals.ctx;
            if (!ctx) return;

            const gsc = window.gsc || 1;

            // Use viewport center since our debug canvas covers the whole screen
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;

            ctx.clearRect(0, 0, Visuals.canvas.width, Visuals.canvas.height);

            // RADAR CONFIG - zoom aware!
            // gsc is the game scale - higher = more zoomed in
            // At gsc=1, we want ~400px display for 5000 game units
            // radarScale converts game units to screen pixels
            const baseRadarScale = 0.08;  // Base scale at gsc=1
            const radarScale = baseRadarScale * gsc;  // Scale with zoom!
            const maxRadarDisplay = Math.min(500, 5000 * radarScale);  // Cap at 500px or full range

            // Draw RADAR - 360 sensors at 1° each, sample every 3° for display (120 rays)
            const radarStep = 3;  // Draw every 3rd ray to keep display clean
            for (let i = 0; i < SECTORS; i += radarStep) {
                const angle = ((i / SECTORS) * TWO_PI) - PI;
                const radarDist = Threat.radar[i];
                const radarType = Threat.radarType[i];

                // RAYS EXTEND TO MAX RANGE unless hitting an obstacle!
                // Only enemy bodies and edges shorten the ray
                let displayDist;
                if (radarDist !== Infinity && radarType !== 'none') {
                    // Hit something - ray ends at contact point
                    displayDist = Math.min(maxRadarDisplay, radarDist * radarScale);
                } else {
                    // Clear path - ray extends to full range
                    displayDist = maxRadarDisplay;
                }

                const endX = cx + Math.cos(angle) * displayDist;
                const endY = cy + Math.sin(angle) * displayDist;

                // Color based on clearance and type
                // Own body is TRANSPARENT - rays pass through, only enemies/edges block
                let color;
                if (Threat.blocked[i]) {
                    color = 'rgba(255,0,0,0.7)';  // Blocked = red
                } else if (radarDist < Threat.WALL_CLEARANCE) {
                    color = 'rgba(255,100,0,0.8)';  // Danger zone = orange
                } else if (radarDist < Threat.SAFE_CLEARANCE) {
                    color = 'rgba(255,255,0,0.6)';  // Caution = yellow
                } else if (radarType === 'enemy') {
                    color = 'rgba(255,0,255,0.5)';  // Enemy body = magenta
                } else if (radarType === 'edge') {
                    color = 'rgba(128,128,128,0.4)';  // Edge = gray
                } else {
                    color = 'rgba(0,255,0,0.3)';  // Clear = green (full length ray)
                }

                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;  // Thinner lines for more rays
                ctx.stroke();

                // Draw dot at radar contact point for close obstacles
                if (radarDist !== Infinity && radarDist < 1000) {
                    const dotSize = radarDist < 50 ? 4 : radarDist < 200 ? 3 : 2;
                    ctx.beginPath();
                    ctx.arc(endX, endY, dotSize, 0, TWO_PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                }
            }

            // Draw escape direction
            if (Threat.danger > 0.2) {
                const escapeDisplayDist = 120 * gsc;  // Zoom aware
                const escX = cx + Math.cos(Threat.escapeAngle) * escapeDisplayDist;
                const escY = cy + Math.sin(Threat.escapeAngle) * escapeDisplayDist;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(escX, escY);
                ctx.strokeStyle = '#0ff';
                ctx.lineWidth = 3;
                ctx.stroke();

                // Arrow head
                ctx.beginPath();
                ctx.arc(escX, escY, 8, 0, TWO_PI);
                ctx.fillStyle = '#0ff';
                ctx.fill();
            }

            // Draw decision direction
            const decisionDisplayDist = 100 * gsc;  // Zoom aware
            const decX = cx + Math.cos(Decision.angle) * decisionDisplayDist;
            const decY = cy + Math.sin(Decision.angle) * decisionDisplayDist;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(decX, decY);
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Draw food target
            if (Food.target) {
                const fx = cx + (Food.target.x - head.x) * gsc;
                const fy = cy + (Food.target.y - head.y) * gsc;

                // Different colors: Prey = magenta, Big food = yellow, Regular = green
                const targetColor = Food.isPrey ? '#f0f' :
                    (Food.target.size >= CONFIG.food.bigFoodSize ? '#ff0' : '#0f0');

                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(fx, fy);
                ctx.strokeStyle = Food.isPrey ? 'rgba(255,0,255,0.8)' : 'rgba(255,255,0,0.6)';
                ctx.lineWidth = Food.isPrey ? 3 : 2;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.beginPath();
                ctx.arc(fx, fy, Food.isPrey ? 14 : 10, 0, TWO_PI);
                ctx.fillStyle = targetColor;
                ctx.fill();

                // Prey label
                if (Food.isPrey) {
                    ctx.font = 'bold 10px monospace';
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.fillText('PREY', fx, fy - 18);
                }
            }

            // Draw TRAP escape direction
            if (Trap.detected) {
                // Draw gap direction (escape route) - zoom aware
                const gapDisplayDist = 150 * gsc;
                const gapX = cx + Math.cos(Trap.gapAngle) * gapDisplayDist;
                const gapY = cy + Math.sin(Trap.gapAngle) * gapDisplayDist;

                // Pulsing escape arrow
                const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 100);
                ctx.strokeStyle = `rgba(255, 0, 255, ${0.5 + pulse * 0.5})`;
                ctx.lineWidth = 4;
                ctx.setLineDash([10, 5]);
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(gapX, gapY);
                ctx.stroke();
                ctx.setLineDash([]);

                // Escape arrow head
                const arrowSize = 15;
                const arrowAngle = Trap.gapAngle;
                ctx.beginPath();
                ctx.moveTo(gapX, gapY);
                ctx.lineTo(
                    gapX - arrowSize * Math.cos(arrowAngle - 0.4),
                    gapY - arrowSize * Math.sin(arrowAngle - 0.4)
                );
                ctx.moveTo(gapX, gapY);
                ctx.lineTo(
                    gapX - arrowSize * Math.cos(arrowAngle + 0.4),
                    gapY - arrowSize * Math.sin(arrowAngle + 0.4)
                );
                ctx.stroke();

                // Label
                ctx.font = 'bold 14px monospace';
                ctx.fillStyle = '#f0f';
                ctx.textAlign = 'center';
                const urgencyText = Trap.urgency > 0.7 ? 'ESCAPE NOW!' :
                    `GAP ${Math.round((Trap.gapSize / TWO_PI) * 360)}°`;
                ctx.fillText(urgencyText, gapX, gapY - 20);

                // Draw coverage arc to show how surrounded we are - zoom aware
                const coverageRadius = 100 * gsc;
                ctx.beginPath();
                ctx.arc(cx, cy, coverageRadius, 0, TWO_PI * Trap.coverage);
                ctx.strokeStyle = 'rgba(255, 100, 0, 0.6)';
                ctx.lineWidth = 8;
                ctx.stroke();

                // Draw counter-attack direction if available - zoom aware
                if (Trap.canCounterAttack) {
                    const caDisplayDist = 140 * gsc;
                    const caX = cx + Math.cos(Trap.counterAttackAngle) * caDisplayDist;
                    const caY = cy + Math.sin(Trap.counterAttackAngle) * caDisplayDist;

                    ctx.strokeStyle = '#f00';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(caX, caY);
                    ctx.stroke();

                    // Sword icon
                    ctx.font = 'bold 16px monospace';
                    ctx.fillStyle = '#f00';
                    ctx.textAlign = 'center';
                    ctx.fillText('⚔️ KILL!', caX, caY - 20);
                }

                // Draw circle radius indicator when defending
                if (Decision.defensiveCircle) {
                    // Calculate the actual perfect circle radius
                    const bodyWidth = (head.rcv || 18) * 2;
                    const snakeLength = head.sct * bodyWidth;
                    const perfectRadius = snakeLength / TWO_PI;
                    const displayRadius = perfectRadius * (window.gsc || 1);

                    // Draw the perfect circle we're trying to make
                    ctx.beginPath();
                    ctx.arc(cx, cy, Math.min(displayRadius, 200), 0, TWO_PI);
                    ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    // Show radius info
                    ctx.font = 'bold 12px monospace';
                    ctx.fillStyle = '#0ff';
                    ctx.textAlign = 'center';
                    ctx.fillText(`R=${Math.round(perfectRadius)}`, cx, cy - Math.min(displayRadius, 200) - 10);
                }
            }

            // Draw attack target
            if (Attack.target) {
                const ax = cx + (Attack.target.x - head.x) * gsc;
                const ay = cy + (Attack.target.y - head.y) * gsc;

                // Red crosshair for attack
                ctx.strokeStyle = '#f00';
                ctx.lineWidth = 3;

                // Line to target
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(ax, ay);
                ctx.stroke();

                // Crosshair
                ctx.beginPath();
                ctx.moveTo(ax - 15, ay);
                ctx.lineTo(ax + 15, ay);
                ctx.moveTo(ax, ay - 15);
                ctx.lineTo(ax, ay + 15);
                ctx.stroke();

                // Circle
                ctx.beginPath();
                ctx.arc(ax, ay, 20, 0, TWO_PI);
                ctx.stroke();

                // Label
                ctx.font = 'bold 12px monospace';
                ctx.fillStyle = '#f00';
                ctx.textAlign = 'center';
                ctx.fillText(Attack.mode?.toUpperCase() || 'ATK', ax, ay - 25);
            }

            // Draw tracked snakes visualization
            Visuals.drawTrackedSnakes(head, cx, cy, gsc);
        },

        drawTrackedSnakes: (head, cx, cy, gsc) => {
            const ctx = Visuals.ctx;
            if (!ctx) return;

            // Get top threats and hunters
            const threats = SnakeTracker.getMostThreatening(10);
            const hunters = SnakeTracker.getHunters();
            const hunterIds = new Set(hunters.map(h => h.id));

            for (const snake of threats) {
                const sx = cx + (snake.x - head.x) * gsc;
                const sy = cy + (snake.y - head.y) * gsc;

                // Skip if way off screen
                if (Math.abs(sx - cx) > 600 || Math.abs(sy - cy) > 600) continue;

                const isHunter = hunterIds.has(snake.id);
                const threat = snake.threat.level;

                // Threat color gradient
                let color;
                if (isHunter) {
                    color = '#f0f';  // Magenta for hunters
                } else if (threat >= 70) {
                    color = '#f00';  // Red = high threat
                } else if (threat >= 50) {
                    color = '#f80';  // Orange = medium-high
                } else if (threat >= 30) {
                    color = '#ff0';  // Yellow = medium
                } else {
                    color = '#8f8';  // Light green = low threat
                }

                // Draw snake head marker
                ctx.beginPath();
                ctx.arc(sx, sy, 8 + threat / 10, 0, TWO_PI);
                ctx.fillStyle = color + '60';  // Semi-transparent
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw direction
                const dirX = sx + Math.cos(snake.ang) * 25;
                const dirY = sy + Math.sin(snake.ang) * 25;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(dirX, dirY);
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw predicted position
                if (snake.predicted.confidence > 30) {
                    const px = cx + (snake.predicted.x - head.x) * gsc;
                    const py = cy + (snake.predicted.y - head.y) * gsc;

                    // Dotted line to prediction
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(px, py);
                    ctx.strokeStyle = color + '80';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.setLineDash([]);

                    // Small X at predicted position
                    ctx.beginPath();
                    ctx.moveTo(px - 4, py - 4);
                    ctx.lineTo(px + 4, py + 4);
                    ctx.moveTo(px + 4, py - 4);
                    ctx.lineTo(px - 4, py + 4);
                    ctx.strokeStyle = color + '80';
                    ctx.stroke();
                }

                // Label with threat level
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.fillStyle = color;
                const label = isHunter ? `🎯${threat}` : `${threat}`;
                ctx.fillText(label, sx, sy - 14);

                // Show if approaching
                if (snake.threat.approaching) {
                    ctx.fillText('→', sx, sy + 20);
                }
            }
        },

        drawMinimap: (head) => {
            const ctx = Visuals.minimapCtx;
            const size = CONFIG.visual.minimapSize;
            const mapRadius = Threat.mapRadius;
            const scale = size / (mapRadius * 2.5);

            ctx.fillStyle = 'rgba(0,20,40,0.9)';
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2, 0, TWO_PI);
            ctx.fill();

            // Map boundary
            ctx.beginPath();
            ctx.arc(size/2, size/2, mapRadius * scale, 0, TWO_PI);
            ctx.strokeStyle = '#f00';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Our position
            const myX = size/2 + (head.x - Threat.mapCenter.x) * scale;
            const myY = size/2 + (head.y - Threat.mapCenter.y) * scale;
            ctx.beginPath();
            ctx.arc(myX, myY, 4, 0, TWO_PI);
            ctx.fillStyle = '#0f0';
            ctx.fill();

            // Direction indicator
            ctx.beginPath();
            ctx.moveTo(myX, myY);
            ctx.lineTo(myX + Math.cos(head.ang) * 15, myY + Math.sin(head.ang) * 15);
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw all tracked snakes on minimap
            for (const snake of SnakeTracker.snakes.values()) {
                const sx = size/2 + (snake.x - Threat.mapCenter.x) * scale;
                const sy = size/2 + (snake.y - Threat.mapCenter.y) * scale;

                // Skip if outside minimap
                if (sx < 0 || sx > size || sy < 0 || sy > size) continue;

                // Color based on threat
                const threat = snake.threat.level;
                let color;
                if (snake.behavior.huntingUs) {
                    color = '#f0f';  // Magenta = hunting us
                } else if (threat >= 50) {
                    color = '#f00';  // Red = high threat
                } else if (threat >= 25) {
                    color = '#f80';  // Orange = medium threat
                } else {
                    color = '#888';  // Gray = low threat
                }

                // Size based on snake length
                const dotSize = Math.max(2, Math.min(5, snake.length / 100));

                ctx.beginPath();
                ctx.arc(sx, sy, dotSize, 0, TWO_PI);
                ctx.fillStyle = color;
                ctx.fill();

                // Draw tiny direction line for threatening snakes
                if (threat > 30) {
                    ctx.beginPath();
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(sx + Math.cos(snake.ang) * 8, sy + Math.sin(snake.ang) * 8);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    };

    // ==================== SETTINGS MENU ====================
    const Menu = {
        container: null,
        visible: false,

        init: () => {
            // Add slider styling
            const style = document.createElement('style');
            style.textContent = `
                #snaky-menu input[type="range"] {
                    -webkit-appearance: none;
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: #333;
                    outline: none;
                    cursor: pointer;
                }
                #snaky-menu input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #0ff;
                    cursor: pointer;
                    border: 2px solid #fff;
                }
                #snaky-menu input[type="range"]::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #0ff;
                    cursor: pointer;
                    border: 2px solid #fff;
                }
                #snaky-menu input[type="checkbox"] {
                    accent-color: #0ff;
                }
            `;
            document.head.appendChild(style);

            Menu.container = document.createElement('div');
            Menu.container.id = 'snaky-menu';
            Menu.container.style.cssText = `
                position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
                background:rgba(0,0,0,0.95);color:#fff;padding:20px;
                font:12px monospace;border-radius:10px;z-index:999999;
                border:2px solid #0ff;display:none;min-width:380px;max-height:80vh;
                overflow-y:auto;box-shadow:0 0 30px rgba(0,255,255,0.3);
            `;
            document.body.appendChild(Menu.container);

            // Close on ESC key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && Menu.visible) {
                    Menu.hide();
                }
            });

            Menu.render();
        },

        show: () => {
            Menu.visible = true;
            Menu.container.style.display = 'block';
            Menu.render();
        },

        hide: () => {
            Menu.visible = false;
            Menu.container.style.display = 'none';
        },

        toggle: () => {
            Menu.visible ? Menu.hide() : Menu.show();
        },

        render: () => {
            Menu.container.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;border-bottom:1px solid #0ff;padding-bottom:10px;">
                    <span style="color:#0ff;font-size:16px;font-weight:bold;">🐍 SNAKY v8.1 LEAN</span>
                    <button id="snaky-menu-close" style="background:#f00;color:#fff;border:none;padding:5px 12px;cursor:pointer;border-radius:3px;font-weight:bold;">✕</button>
                </div>

                <div style="margin-bottom:15px;">
                    <div style="color:#0ff;font-weight:bold;margin-bottom:8px;">🤖 Bot</div>
                    ${Menu.checkbox('bot.enabled', 'Bot Enabled', CONFIG.bot.enabled)}
                    ${Menu.checkbox('bot.autoRespawn', 'Auto Respawn', CONFIG.bot.autoRespawn)}
                    ${Menu.slider('bot.respawnDelay', 'Respawn Delay', CONFIG.bot.respawnDelay, 500, 5000, 100, 'ms')}
                </div>

                <div style="margin-bottom:15px;">
                    <div style="color:#0ff;font-weight:bold;margin-bottom:8px;">🛡️ Safety</div>
                    ${Menu.slider('safety.edgeBuffer', 'Edge Buffer', CONFIG.safety.edgeBuffer, 1000, 4000, 200, 'px')}
                    ${Menu.slider('safety.edgeHardLimit', 'Edge Hard Limit', CONFIG.safety.edgeHardLimit, 400, 1500, 100, 'px')}
                    ${Menu.slider('safety.bodyBuffer', 'Body Wall Buffer', CONFIG.safety.bodyBuffer, 10, 60, 5, 'px')}
                    ${Menu.slider('safety.headThreatRadius', 'Head Threat Radius', CONFIG.safety.headThreatRadius, 200, 600, 50, 'px')}
                    ${Menu.slider('safety.bodyAvoidRadius', 'Body Avoid Radius', CONFIG.safety.bodyAvoidRadius, 100, 400, 25, 'px')}
                    ${Menu.checkbox('safety.escapeBoost', 'Escape Boost', CONFIG.safety.escapeBoost)}
                </div>

                <div style="margin-bottom:15px;">
                    <div style="color:#0ff;font-weight:bold;margin-bottom:8px;">🍎 Food</div>
                    ${Menu.slider('food.searchRadius', 'Search Radius', CONFIG.food.searchRadius, 400, 1500, 100, 'px')}
                    ${Menu.slider('food.minSafety', 'Min Safety', CONFIG.food.minSafety, 0.2, 0.8, 0.1, '')}
                    ${Menu.slider('food.bigFoodSize', 'Big Food Size', CONFIG.food.bigFoodSize, 4, 15, 1, '')}
                </div>

                <div style="margin-bottom:15px;">
                    <div style="color:#f00;font-weight:bold;margin-bottom:8px;">🎯 Attack</div>
                    ${Menu.checkbox('attack.enabled', 'Attack Mode', CONFIG.attack.enabled)}
                    ${Menu.slider('attack.minLength', 'Min Length to Attack', CONFIG.attack.minLength, 20, 150, 10, '')}
                    ${Menu.slider('attack.sizeAdvantage', 'Size Advantage', CONFIG.attack.sizeAdvantage, 1.1, 2.0, 0.1, 'x')}
                    ${Menu.checkbox('attack.boostToKill', 'Boost During Attack', CONFIG.attack.boostToKill)}
                </div>

                <div style="margin-bottom:15px;">
                    <div style="color:#0ff;font-weight:bold;margin-bottom:8px;">👁️ Visual</div>
                    ${Menu.checkbox('visual.debug', 'Debug Overlay', CONFIG.visual.debug)}
                    ${Menu.checkbox('visual.minimap', 'Minimap', CONFIG.visual.minimap)}
                </div>

                <div style="color:#888;font-size:10px;text-align:center;margin-top:15px;border-top:1px solid #333;padding-top:10px;">
                    [B] Toggle Bot | [M] Menu | [V] Debug | [Z/X] Zoom | [A] Attack | [ESC] Close
                </div>
            `;

            // Attach close button handler after render
            const closeBtn = document.getElementById('snaky-menu-close');
            if (closeBtn) {
                closeBtn.onclick = () => Menu.hide();
            }
        },

        checkbox: (path, label, value) => `
            <div style="display:flex;justify-content:space-between;align-items:center;margin:5px 0;">
                <label>${label}</label>
                <input type="checkbox" ${value ? 'checked' : ''}
                       onchange="window.snakyConfig('${path}', this.checked)"
                       style="width:18px;height:18px;cursor:pointer;">
            </div>
        `,

        slider: (path, label, value, min, max, step, unit) => `
            <div style="margin:8px 0;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <label>${label}</label>
                    <span id="${path.replace(/\./g,'-')}-val" style="color:#0ff;min-width:60px;text-align:right;">${value}${unit}</span>
                </div>
                <input type="range" min="${min}" max="${max}" step="${step}" value="${value}"
                       oninput="window.snakyConfig('${path}', parseFloat(this.value)); document.getElementById('${path.replace(/\./g,'-')}-val').textContent = this.value + '${unit}';"
                       style="width:100%;cursor:pointer;height:6px;-webkit-appearance:none;background:#333;border-radius:3px;outline:none;">
            </div>
        `
    };

    // Config update function
    window.snakyConfig = (path, value) => {
        const parts = path.split('.');
        let obj = CONFIG;
        for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
        obj[parts[parts.length - 1]] = typeof obj[parts[parts.length - 1]] === 'boolean' ? Boolean(value) : parseFloat(value);
        console.log(`%c⚙️ ${path}: ${value}`, 'color:#0f0');
    };

    // ==================== INPUT ====================
    const Input = {
        zoom: 0.9,

        init: () => {
            document.addEventListener('keydown', Input.onKey, true);
            document.addEventListener('keyup', (e) => {
                if (e.key === ' ') STATE.manualBoost = false;
            }, true);
        },

        onKey: (e) => {
            const key = e.key.toLowerCase();
            let handled = true;

            switch (key) {
                case 'b':
                    CONFIG.bot.enabled = !CONFIG.bot.enabled;
                    Input.notify(`🤖 Bot: ${CONFIG.bot.enabled ? 'ON' : 'OFF'}`, CONFIG.bot.enabled ? '#0f0' : '#f00');
                    break;
                case 'a':
                    CONFIG.attack.enabled = !CONFIG.attack.enabled;
                    Input.notify(`🎯 Attack: ${CONFIG.attack.enabled ? 'ON' : 'OFF'}`, CONFIG.attack.enabled ? '#f00' : '#888');
                    break;
                case 'm':
                    Menu.toggle();
                    break;
                case 'v':
                    CONFIG.visual.debug = !CONFIG.visual.debug;
                    // Create debug canvas if it doesn't exist
                    if (CONFIG.visual.debug && !Visuals.canvas) {
                        Visuals.canvas = document.createElement('canvas');
                        Visuals.canvas.id = 'snaky-debug';
                        Visuals.canvas.style.cssText = `
                            position:fixed;top:0;left:0;width:100%;height:100%;
                            z-index:99998;pointer-events:none;
                        `;
                        document.body.appendChild(Visuals.canvas);
                        Visuals.ctx = Visuals.canvas.getContext('2d');
                        Visuals.resize();
                    }
                    // Hide/show canvas
                    if (Visuals.canvas) {
                        Visuals.canvas.style.display = CONFIG.visual.debug ? 'block' : 'none';
                    }
                    Input.notify(`👁️ Debug: ${CONFIG.visual.debug ? 'ON' : 'OFF'}`, '#0ff');
                    break;
                case 'z':
                    Input.zoom = Math.max(0.2, Input.zoom - 0.1);
                    // Force update through the locked property
                    try {
                        Object.defineProperty(window, 'gsc', { value: Input.zoom, writable: true, configurable: true });
                    } catch(e) {}
                    window.gsc = Input.zoom;
                    Input.notify(`🔍 Zoom: ${Input.zoom.toFixed(1)}`, '#0ff');
                    break;
                case 'x':
                    Input.zoom = Math.min(2.0, Input.zoom + 0.1);
                    // Force update through the locked property
                    try {
                        Object.defineProperty(window, 'gsc', { value: Input.zoom, writable: true, configurable: true });
                    } catch(e) {}
                    window.gsc = Input.zoom;
                    Input.notify(`🔍 Zoom: ${Input.zoom.toFixed(1)}`, '#0ff');
                    break;
                case ' ':
                    STATE.manualBoost = true;
                    break;
                case 'h':
                    console.log(`
%c🐍 SNAKY v8.1 LEAN - ADAPTIVE AI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[B] Toggle Bot
[A] Toggle Attack Mode
[M] Settings Menu
[V] Toggle Debug Visuals
[Z] Zoom Out
[X] Zoom In
[L] Show Game Stats
[R] Print Full Report
[D] Show Dynamic Config
[C] Clear All History
[SPACE] Manual Boost
[H] This Help
                    `, 'color:#0ff');
                    break;
                case 'l':
                    const stats = GameLog.getStats();
                    console.log('%c📊 GAME STATS', 'color:#0ff;font-size:14px');
                    console.log(`Games: ${stats.totalGames} | K/D: ${stats.kd}`);
                    console.log(`Best: ${stats.bestScore} | Avg: ${stats.avgScore}`);
                    console.log(`Current: ${stats.currentScore} | Kills: ${stats.currentKills}`);
                    break;
                case 'r':
                    GameLog.printReport();
                    break;
                case 'd':
                    GameLog.printDynamic();
                    break;
                case 'c':
                    if (confirm('Clear all game history and reset learning? This cannot be undone.')) {
                        GameLog.clearHistory();
                    }
                    break;
                default:
                    handled = false;
            }

            if (handled) {
                e.preventDefault();
                e.stopPropagation();
            }
        },

        notify: (msg, color) => {
            console.log(`%c${msg}`, `color:${color};font-size:14px;font-weight:bold`);
            let n = document.getElementById('snaky-notif');
            if (!n) {
                n = document.createElement('div');
                n.id = 'snaky-notif';
                n.style.cssText = `
                    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
                    background:rgba(0,0,0,0.9);padding:15px 25px;font:18px monospace;
                    border-radius:8px;z-index:999999;pointer-events:none;
                    transition:opacity 0.3s;border:2px solid ${color};color:${color};
                `;
                document.body.appendChild(n);
            }
            n.textContent = msg;
            n.style.borderColor = color;
            n.style.color = color;
            n.style.opacity = '1';
            clearTimeout(Input._notifTimer);
            Input._notifTimer = setTimeout(() => n.style.opacity = '0', 1000);
        },
        _notifTimer: null
    };

    // ==================== RENDER OPTIMIZATION ====================
    const Render = {
        init: () => {
            // Patch canvas context for performance
            const origGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, opts) {
                if (type === '2d') {
                    opts = opts || {};
                    opts.willReadFrequently = true;
                }
                return origGetContext.call(this, type, opts);
            };

            // Hook fillRect to simplify background
            const origFillRect = CanvasRenderingContext2D.prototype.fillRect;
            CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
                if (CONFIG.render.hideBackground && w > 1000 && h > 1000) {
                    this.fillStyle = '#0a0a12';
                }
                return origFillRect.call(this, x, y, w, h);
            };

            // Disable shadows
            if (CONFIG.render.hideShadows) {
                Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', {
                    set: function(val) { this._shadowBlur = 0; },
                    get: function() { return 0; }
                });
            }
        }
    };

    // ==================== MAIN LOOP ====================
    const MainLoop = {
        frameId: null,
        wasPlaying: false,  // Track game state changes

        start: () => {
            console.log('%c🐍 SNAKY v8.1 LEAN Started!', 'color:#0f0;font-size:16px');
            MainLoop.update();
        },

        update: () => {
            MainLoop.frameId = requestAnimationFrame(MainLoop.update);

            // ENFORCE ZOOM - game tries to reset gsc every frame, we override it
            if (window.gsc !== undefined && window.gsc !== Input.zoom) {
                window.gsc = Input.zoom;
            }

            // FPS counter
            STATE.frameCount++;
            const now = performance.now();
            if (now - STATE.lastFpsTime >= 1000) {
                STATE.fps = STATE.frameCount;
                STATE.frameCount = 0;
                STATE.lastFpsTime = now;
            }

            STATE.playing = window.playing === true;
            const head = Snake.getHead();

            // Detect game start
            if (STATE.playing && !MainLoop.wasPlaying) {
                GameLog.resetSession();
                SnakeTracker.clear();  // Fresh tracking on new game
                console.log('%c🎮 Game Started!', 'color:#0f0;font-weight:bold');
            }

            // Detect game end (death)
            if (!STATE.playing && MainLoop.wasPlaying) {
                const lastHead = GameLog.session.lastPosition;
                GameLog.logDeath(lastHead ? { x: lastHead.x, y: lastHead.y, sct: GameLog.session.maxLength, pts: GameLog.session.maxScore } : null);
            }

            MainLoop.wasPlaying = STATE.playing;

            if (head && CONFIG.bot.enabled) {
                // Update game log
                GameLog.update(head);

                // Update global snake tracking - EVERY FRAME
                SnakeTracker.update();

                // Single unified detection pass
                Threat.detect(head);
                Food.find(head);
                Attack.find(head);  // Hunt for prey!

                // Make decision
                Decision.decide(head);

                // Apply control
                Control.apply(head);
            }

            // Auto-respawn
            if (!STATE.playing && CONFIG.bot.enabled && CONFIG.bot.autoRespawn) {
                setTimeout(() => {
                    if (!window.playing) {
                        const btn = document.querySelector('.nsi');
                        if (btn) btn.click();
                    }
                }, CONFIG.bot.respawnDelay);
            }

            // Update visuals (every 2 frames)
            if (STATE.frameCount % 2 === 0) {
                Visuals.update(head);
            }
        }
    };

    // ==================== INIT ====================
    const init = () => {
        console.log('%c🐍 SNAKY v8.1 LEAN Loading...', 'color:#0ff;font-size:14px');

        const waitForGame = setInterval(() => {
            if (document.querySelector('canvas')) {
                clearInterval(waitForGame);

                GameLog.init();  // Load history and learning weights
                Render.init();
                Control.init();
                Visuals.init();
                Menu.init();
                Input.init();

                // ZOOM LOCK: Override game's zoom reset mechanism
                // The game uses want_quality/wfpr to control zoom - we intercept
                if (typeof window.redraw === 'function') {
                    const originalRedraw = window.redraw;
                    window.redraw = function() {
                        const result = originalRedraw.apply(this, arguments);
                        // Force our zoom after every redraw
                        if (window.gsc !== Input.zoom) {
                            window.gsc = Input.zoom;
                        }
                        return result;
                    };
                }

                // Also try to lock gsc with a property setter
                try {
                    let _gsc = Input.zoom;
                    Object.defineProperty(window, 'gsc', {
                        get: () => _gsc,
                        set: (val) => {
                            // Only allow our zoom changes, ignore game's attempts to reset
                            if (val === Input.zoom) {
                                _gsc = val;
                            }
                            // Otherwise keep our value
                        },
                        configurable: true
                    });
                    window.gsc = Input.zoom;
                } catch (e) {
                    // Property already defined or not configurable
                    console.log('Zoom lock via property failed, using polling');
                }

                MainLoop.start();

                console.log('%c✅ SNAKY v8.1 Ready! Press [H] for help, [L] for stats', 'color:#0f0;font-size:12px');
            }
        }, 500);
    };

    if (document.readyState === 'complete') {
        setTimeout(init, 1000);
    } else {
        window.addEventListener('load', () => setTimeout(init, 1000));
    }

})();
