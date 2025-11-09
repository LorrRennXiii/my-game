// Game State
let sessionId = null;
let gameState = null;

// API Base URL
const API_BASE = '';

// DOM Elements
const startScreen = document.getElementById('start-screen');
const loadScreen = document.getElementById('load-screen');
const gameScreen = document.getElementById('game-screen');
const npcModal = document.getElementById('npc-modal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkForSavedSession();
});

function setupEventListeners() {
    // Start screen
    document.getElementById('start-new-game').addEventListener('click', startNewGame);
    document.getElementById('load-game-btn').addEventListener('click', showLoadScreen);
    document.getElementById('back-to-start').addEventListener('click', showStartScreen);
    
    // Game actions
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action === 'visit') {
                showNPCModal();
            } else {
                executeAction(action);
            }
        });
    });
    
    document.getElementById('end-day-btn').addEventListener('click', endDay);
    document.getElementById('save-game-btn').addEventListener('click', saveGame);
    
    // NPC modal
    document.getElementById('close-npc-modal').addEventListener('click', () => {
        npcModal.classList.remove('active');
    });
}

function checkForSavedSession() {
    const saved = localStorage.getItem('gameSessionId');
    if (saved) {
        sessionId = saved;
        loadGameState();
    }
}

async function startNewGame() {
    const name = document.getElementById('player-name').value.trim() || 'Aro';
    const tribe = document.getElementById('tribe-select').value;
    
    try {
        const response = await fetch(`${API_BASE}/api/game/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, tribe })
        });
        
        if (!response.ok) throw new Error('Failed to create game');
        
        const data = await response.json();
        sessionId = data.sessionId;
        localStorage.setItem('gameSessionId', sessionId);
        gameState = data;
        
        showGameScreen();
        updateUI();
    } catch (error) {
        addMessage('Error starting game: ' + error.message, 'error');
    }
}

async function loadGameState() {
    if (!sessionId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/game/${sessionId}`);
        if (!response.ok) {
            if (response.status === 404) {
                localStorage.removeItem('gameSessionId');
                sessionId = null;
                return;
            }
            throw new Error('Failed to load game');
        }
        
        gameState = await response.json();
        showGameScreen();
        updateUI();
    } catch (error) {
        console.error('Error loading game:', error);
    }
}

async function executeAction(action, npcId = null) {
    if (!sessionId) return;
    
    const actionBtn = document.querySelector(`[data-action="${action}"]`);
    if (actionBtn) actionBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/game/${sessionId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, npcId })
        });
        
        if (!response.ok) throw new Error('Failed to execute action');
        
        const data = await response.json();
        gameState = data;
        
        // Show result message
        addMessage(data.result.message, data.result.success ? 'success' : 'error');
        
        // Show event if any
        if (data.result.event) {
            addMessage('⚡ EVENT: ' + data.result.event.text, 'event');
        }
        
        if (data.result.npcEvent) {
            addMessage('⚡ NPC EVENT: ' + data.result.npcEvent.text, 'event');
        }
        
        // Show rewards
        if (data.result.rewards) {
            const rewards = [];
            if (data.result.rewards.xp) rewards.push(`+${data.result.rewards.xp} XP`);
            if (data.result.rewards.food) rewards.push(`+${data.result.rewards.food} Food`);
            if (data.result.rewards.materials) rewards.push(`+${data.result.rewards.materials} Materials`);
            if (data.result.rewards.wealth) {
                const wealth = data.result.rewards.wealth;
                rewards.push(`${wealth > 0 ? '+' : ''}${wealth} Wealth`);
            }
            if (data.result.rewards.spirit_energy) rewards.push(`+${data.result.rewards.spirit_energy} Spirit Energy`);
            
            if (rewards.length > 0) {
                addMessage('📦 Rewards: ' + rewards.join(', '), 'success');
            }
        }
        
        updateUI();
    } catch (error) {
        addMessage('Error: ' + error.message, 'error');
    } finally {
        if (actionBtn) actionBtn.disabled = false;
    }
}

async function endDay() {
    if (!sessionId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/game/${sessionId}/end-day`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to end day');
        
        const data = await response.json();
        gameState = data;
        
        addMessage('✨ A new day begins! Your stamina has been restored.', 'success');
        
        if (data.growthMessages && data.growthMessages.length > 0) {
            data.growthMessages.forEach(msg => {
                addMessage('👥 ' + msg, 'success');
            });
        }
        
        updateUI();
    } catch (error) {
        addMessage('Error: ' + error.message, 'error');
    }
}

async function saveGame() {
    if (!sessionId) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/game/${sessionId}/save`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to save game');
        
        const data = await response.json();
        addMessage('✅ Game saved successfully!', 'success');
    } catch (error) {
        addMessage('Error saving: ' + error.message, 'error');
    }
}

async function showLoadScreen() {
    try {
        const response = await fetch(`${API_BASE}/api/game/saves`);
        if (!response.ok) throw new Error('Failed to load saves');
        
        const data = await response.json();
        const savesList = document.getElementById('saves-list');
        savesList.innerHTML = '';
        
        if (data.saves.length === 0) {
            savesList.innerHTML = '<p>No saved games found.</p>';
            return;
        }
        
        data.saves.forEach(savePath => {
            const saveItem = document.createElement('div');
            saveItem.className = 'save-item';
            saveItem.textContent = savePath.split('/').pop();
            saveItem.addEventListener('click', () => loadGame(savePath));
            savesList.appendChild(saveItem);
        });
        
        startScreen.classList.remove('active');
        loadScreen.classList.add('active');
    } catch (error) {
        addMessage('Error loading saves: ' + error.message, 'error');
    }
}

async function loadGame(filepath) {
    try {
        const response = await fetch(`${API_BASE}/api/game/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath })
        });
        
        if (!response.ok) throw new Error('Failed to load game');
        
        const data = await response.json();
        sessionId = data.sessionId;
        localStorage.setItem('gameSessionId', sessionId);
        gameState = data;
        
        showGameScreen();
        updateUI();
        addMessage('✅ Game loaded successfully!', 'success');
    } catch (error) {
        addMessage('Error loading game: ' + error.message, 'error');
    }
}

function showStartScreen() {
    startScreen.classList.add('active');
    loadScreen.classList.remove('active');
    gameScreen.classList.remove('active');
}

function showGameScreen() {
    startScreen.classList.remove('active');
    loadScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

function updateUI() {
    if (!gameState) return;
    
    // Update day and stamina
    document.getElementById('current-day').textContent = gameState.day || 1;
    document.getElementById('stamina').textContent = gameState.stamina || 0;
    document.getElementById('max-stamina').textContent = gameState.maxStamina || 5;
    
    // Update player status
    if (gameState.player) {
        const playerStatus = document.getElementById('player-status');
        playerStatus.innerHTML = `
            <div class="status-item">
                <span><strong>${gameState.player.name}</strong></span>
                <span>Level ${gameState.player.level}</span>
            </div>
            <div class="status-item">
                <span>Job:</span>
                <span>${gameState.player.job}</span>
            </div>
            <div class="status-item">
                <span>XP:</span>
                <span>${gameState.player.xp}/${gameState.player.level * 10}</span>
            </div>
            <div class="status-item">
                <span>Stats:</span>
            </div>
            <div class="stat-bar">
                <span>STR: ${gameState.player.stats.str}</span>
                <span>DEX: ${gameState.player.stats.dex}</span>
                <span>WIS: ${gameState.player.stats.wis}</span>
            </div>
            <div class="stat-bar">
                <span>CHA: ${gameState.player.stats.cha}</span>
                <span>LCK: ${gameState.player.stats.luck}</span>
            </div>
            <div class="status-item" style="margin-top: 10px;">
                <span>Inventory:</span>
            </div>
            <div class="status-item">
                <span>Food:</span>
                <span>${gameState.player.inventory.food}</span>
            </div>
            <div class="status-item">
                <span>Materials:</span>
                <span>${gameState.player.inventory.materials}</span>
            </div>
            <div class="status-item">
                <span>Wealth:</span>
                <span>${gameState.player.inventory.wealth}</span>
            </div>
        `;
    }
    
    // Update tribe status
    if (gameState.tribe) {
        document.getElementById('tribe-name').textContent = gameState.tribe.name;
        const tribeStatus = document.getElementById('tribe-status');
        tribeStatus.innerHTML = `
            <div class="status-item">
                <span>Prosperity:</span>
                <span>${gameState.tribe.attributes.prosperity}</span>
            </div>
            <div class="status-item">
                <span>Defense:</span>
                <span>${gameState.tribe.attributes.defense}</span>
            </div>
            <div class="status-item">
                <span>Knowledge:</span>
                <span>${gameState.tribe.attributes.knowledge}</span>
            </div>
            <div class="status-item">
                <span>Spirit:</span>
                <span>${gameState.tribe.attributes.spirit}</span>
            </div>
            <div class="status-item">
                <span>Morale:</span>
                <span>${gameState.tribe.attributes.morale}</span>
            </div>
            <div class="status-item" style="margin-top: 10px;">
                <span>Resources:</span>
            </div>
            <div class="status-item">
                <span>Food:</span>
                <span>${gameState.tribe.resources.food}</span>
            </div>
            <div class="status-item">
                <span>Materials:</span>
                <span>${gameState.tribe.resources.materials}</span>
            </div>
            <div class="status-item">
                <span>Wealth:</span>
                <span>${gameState.tribe.resources.wealth}</span>
            </div>
        `;
    }
    
    // Update NPCs
    if (gameState.npcs) {
        const npcsList = document.getElementById('npcs-list');
        npcsList.innerHTML = '';
        
        gameState.npcs.forEach(npc => {
            const relationship = gameState.player.relationships[npc.id] || 50;
            let relationshipClass = 'relationship-neutral';
            let relationshipText = 'Neutral';
            
            if (relationship < 20) {
                relationshipClass = 'relationship-hostile';
                relationshipText = 'Hostile';
            } else if (relationship < 50) {
                relationshipClass = 'relationship-neutral';
                relationshipText = 'Neutral';
            } else if (relationship < 80) {
                relationshipClass = 'relationship-friendly';
                relationshipText = 'Friendly';
            } else {
                relationshipClass = 'relationship-ally';
                relationshipText = 'Ally';
            }
            
            const npcItem = document.createElement('div');
            npcItem.className = 'npc-item';
            npcItem.innerHTML = `
                <h3>${npc.name} (${npc.role})</h3>
                <div class="npc-stats">
                    <span>Level ${npc.level || 1}</span>
                    ${npc.stats ? `
                        <span>STR:${npc.stats.str}</span>
                        <span>DEX:${npc.stats.dex}</span>
                        <span>WIS:${npc.stats.wis}</span>
                        <span>CHA:${npc.stats.cha}</span>
                    ` : ''}
                </div>
                <span class="relationship-badge ${relationshipClass}">
                    ${relationshipText} (${relationship})
                </span>
            `;
            npcsList.appendChild(npcItem);
        });
    }
    
    // Update action buttons based on stamina
    const stamina = gameState.stamina || 0;
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.disabled = stamina <= 0;
    });
}

function showNPCModal() {
    if (!gameState || !gameState.npcs || gameState.npcs.length === 0) {
        addMessage('No NPCs available to visit.', 'error');
        return;
    }
    
    const npcSelection = document.getElementById('npc-selection');
    npcSelection.innerHTML = '';
    
    gameState.npcs.forEach(npc => {
        const btn = document.createElement('button');
        btn.className = 'npc-select-btn';
        const relationship = gameState.player.relationships[npc.id] || 50;
        btn.textContent = `${npc.name} (${npc.role}) - Relationship: ${relationship}`;
        btn.addEventListener('click', () => {
            executeAction('visit', npc.id);
            npcModal.classList.remove('active');
        });
        npcSelection.appendChild(btn);
    });
    
    npcModal.classList.add('active');
}

function addMessage(text, type = 'info') {
    const messages = document.getElementById('messages');
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    
    // Auto-remove old messages (keep last 20)
    const messageElements = messages.querySelectorAll('.message');
    if (messageElements.length > 20) {
        messageElements[0].remove();
    }
}

