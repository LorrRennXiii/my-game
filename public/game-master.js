// Game Master Control Panel - Permanent Settings
let currentConfig = null;

// DOM Elements
const sessionIdInput = document.getElementById('session-id-input');
const loadConfigBtn = document.getElementById('load-config-btn');
const saveConfigBtn = document.getElementById('save-config-btn');
const resetConfigBtn = document.getElementById('reset-config-btn');
const applyToSessionBtn = document.getElementById('apply-to-session-btn');
const messagesDiv = document.getElementById('messages');

// Load permanent config on page load
window.addEventListener('DOMContentLoaded', () => {
    loadPermanentConfig();
    
    // Auto-fill session ID if available
    const savedSession = localStorage.getItem('gameSessionId');
    if (savedSession) {
        sessionIdInput.value = savedSession;
    }
});

loadConfigBtn.addEventListener('click', () => {
    const sessionId = sessionIdInput.value.trim();
    if (!sessionId) {
        showMessage('Please enter a session ID to load from session', 'error');
        return;
    }
    loadConfigFromSession(sessionId);
});

saveConfigBtn.addEventListener('click', () => {
    savePermanentConfig();
});

resetConfigBtn.addEventListener('click', () => {
    if (confirm('Reset configuration to defaults? This will affect all future games.')) {
        resetPermanentConfig();
    }
});

applyToSessionBtn.addEventListener('click', () => {
    const sessionId = sessionIdInput.value.trim();
    if (!sessionId) {
        showMessage('Please enter a session ID', 'error');
        return;
    }
    applyConfigToSession(sessionId);
});

// Difficulty preset buttons
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const difficulty = btn.dataset.difficulty;
        if (difficulty === 'Custom') {
            // Just highlight custom, don't change values
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            return;
        }
        setDifficulty(difficulty);
    });
});

function loadPermanentConfig() {
    try {
        const savedConfig = localStorage.getItem('gameMasterConfig');
        if (savedConfig) {
            currentConfig = JSON.parse(savedConfig);
            populateForm(currentConfig);
            updateDifficultyButton(currentConfig.difficulty || 'Custom');
            showMessage('✅ Permanent configuration loaded!', 'success');
        } else {
            // Load default config
            const defaultConfig = getDefaultConfig();
            currentConfig = defaultConfig;
            populateForm(defaultConfig);
            updateDifficultyButton('Normal');
            showMessage('ℹ️ Using default configuration. Settings will be saved permanently when you click "Save Permanent Config".', 'info');
        }
    } catch (error) {
        showMessage('Error loading permanent config: ' + error.message, 'error');
        const defaultConfig = getDefaultConfig();
        currentConfig = defaultConfig;
        populateForm(defaultConfig);
    }
}

function getDefaultConfig() {
    return {
        encounterChance: 40,
        encounterCooldown: 5,
        xpMultiplier: 1.0,
        levelUpXpMultiplier: 1.0,
        statPointsPerLevel: 2,
        skillImprovementChance: 30,
        npcXpMultiplier: 1.0,
        npcLevelUpXpMultiplier: 1.0,
        npcGrowthRate: 50,
        worldEventChance: 20,
        worldEventInterval: 10,
        seasonLength: 30,
        actionSuccessBonus: 0,
        actionRewardMultiplier: 1.0,
        baseStamina: 5,
        staminaRegenBonus: 1,
        relationshipGainMultiplier: 1.0,
        relationshipDecayRate: 0,
        difficulty: 'Normal'
    };
}

async function loadConfigFromSession(sessionId) {
    try {
        const response = await fetch(`/api/game/${sessionId}/config`);
        if (!response.ok) {
            if (response.status === 404) {
                showMessage('Game session not found. Make sure you have an active game.', 'error');
                return;
            }
            throw new Error('Failed to load config');
        }

        const data = await response.json();
        currentConfig = data.config;
        populateForm(currentConfig);
        updateDifficultyButton(currentConfig.difficulty || 'Custom');
        showMessage('✅ Configuration loaded from session! (Not saved permanently yet)', 'success');
    } catch (error) {
        showMessage('Error loading config: ' + error.message, 'error');
    }
}

function populateForm(config) {
    // Encounter settings
    document.getElementById('encounter-chance').value = config.encounterChance || 40;
    document.getElementById('encounter-cooldown').value = config.encounterCooldown || 5;

    // Progression settings
    document.getElementById('xp-multiplier').value = config.xpMultiplier || 1.0;
    document.getElementById('levelup-xp-multiplier').value = config.levelUpXpMultiplier || 1.0;
    document.getElementById('stat-points-per-level').value = config.statPointsPerLevel || 2;
    document.getElementById('skill-improvement-chance').value = config.skillImprovementChance || 30;

    // NPC progression
    document.getElementById('npc-xp-multiplier').value = config.npcXpMultiplier || 1.0;
    document.getElementById('npc-levelup-xp-multiplier').value = config.npcLevelUpXpMultiplier || 1.0;
    document.getElementById('npc-growth-rate').value = config.npcGrowthRate || 50;

    // World progression
    document.getElementById('world-event-chance').value = config.worldEventChance || 20;
    document.getElementById('world-event-interval').value = config.worldEventInterval || 10;
    document.getElementById('season-length').value = config.seasonLength || 30;

    // Action settings
    document.getElementById('action-success-bonus').value = config.actionSuccessBonus || 0;
    document.getElementById('action-reward-multiplier').value = config.actionRewardMultiplier || 1.0;

    // Stamina settings
    document.getElementById('base-stamina').value = config.baseStamina || 5;
    document.getElementById('stamina-regen-bonus').value = config.staminaRegenBonus || 1;

    // Relationship settings
    document.getElementById('relationship-gain-multiplier').value = config.relationshipGainMultiplier || 1.0;
    document.getElementById('relationship-decay-rate').value = config.relationshipDecayRate || 0;
}

function getFormData() {
    return {
        encounterChance: parseFloat(document.getElementById('encounter-chance').value),
        encounterCooldown: parseInt(document.getElementById('encounter-cooldown').value),
        xpMultiplier: parseFloat(document.getElementById('xp-multiplier').value),
        levelUpXpMultiplier: parseFloat(document.getElementById('levelup-xp-multiplier').value),
        statPointsPerLevel: parseInt(document.getElementById('stat-points-per-level').value),
        skillImprovementChance: parseInt(document.getElementById('skill-improvement-chance').value),
        npcXpMultiplier: parseFloat(document.getElementById('npc-xp-multiplier').value),
        npcLevelUpXpMultiplier: parseFloat(document.getElementById('npc-levelup-xp-multiplier').value),
        npcGrowthRate: parseInt(document.getElementById('npc-growth-rate').value),
        worldEventChance: parseInt(document.getElementById('world-event-chance').value),
        worldEventInterval: parseInt(document.getElementById('world-event-interval').value),
        seasonLength: parseInt(document.getElementById('season-length').value),
        actionSuccessBonus: parseInt(document.getElementById('action-success-bonus').value),
        actionRewardMultiplier: parseFloat(document.getElementById('action-reward-multiplier').value),
        baseStamina: parseInt(document.getElementById('base-stamina').value),
        staminaRegenBonus: parseInt(document.getElementById('stamina-regen-bonus').value),
        relationshipGainMultiplier: parseFloat(document.getElementById('relationship-gain-multiplier').value),
        relationshipDecayRate: parseInt(document.getElementById('relationship-decay-rate').value),
        difficulty: 'Custom'
    };
}

function savePermanentConfig() {
    try {
        const config = getFormData();
        currentConfig = config;
        localStorage.setItem('gameMasterConfig', JSON.stringify(config));
        updateDifficultyButton('Custom');
        showMessage('✅ Configuration saved permanently! This will apply to all new games.', 'success');
    } catch (error) {
        showMessage('Error saving config: ' + error.message, 'error');
    }
}

async function applyConfigToSession(sessionId) {
    if (!currentConfig) {
        showMessage('Please load or configure settings first', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/game/${sessionId}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentConfig)
        });

        if (!response.ok) throw new Error('Failed to apply config to session');

        showMessage('✅ Configuration applied to game session!', 'success');
    } catch (error) {
        showMessage('Error applying config: ' + error.message, 'error');
    }
}

async function setDifficulty(difficulty) {
    try {
        // Get difficulty preset from server or use defaults
        const difficultyPresets = {
            'Easy': {
                encounterChance: 30,
                xpMultiplier: 1.5,
                levelUpXpMultiplier: 0.8,
                actionRewardMultiplier: 1.3,
                baseStamina: 7,
                relationshipGainMultiplier: 1.2
            },
            'Normal': {
                encounterChance: 40,
                xpMultiplier: 1.0,
                levelUpXpMultiplier: 1.0,
                actionRewardMultiplier: 1.0,
                baseStamina: 5,
                relationshipGainMultiplier: 1.0
            },
            'Hard': {
                encounterChance: 50,
                xpMultiplier: 0.7,
                levelUpXpMultiplier: 1.2,
                actionRewardMultiplier: 0.7,
                baseStamina: 4,
                relationshipGainMultiplier: 0.8
            }
        };

        const preset = difficultyPresets[difficulty] || difficultyPresets['Normal'];
        const baseConfig = getDefaultConfig();
        currentConfig = { ...baseConfig, ...preset, difficulty };
        
        populateForm(currentConfig);
        updateDifficultyButton(difficulty);
        showMessage(`✅ Difficulty set to ${difficulty}! (Not saved permanently yet)`, 'success');
    } catch (error) {
        showMessage('Error setting difficulty: ' + error.message, 'error');
    }
}

function resetPermanentConfig() {
    const defaultConfig = getDefaultConfig();
    currentConfig = defaultConfig;
    populateForm(defaultConfig);
    updateDifficultyButton('Normal');
    localStorage.removeItem('gameMasterConfig');
    showMessage('✅ Configuration reset to defaults!', 'success');
}

function updateDifficultyButton(difficulty) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.difficulty === difficulty) {
            btn.classList.add('active');
        }
    });
}

function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    messagesDiv.appendChild(message);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Auto-remove after 5 seconds
    setTimeout(() => {
        message.remove();
    }, 5000);
}

