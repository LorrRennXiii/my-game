// NPC Manager - Permanent Settings
let currentSessionId = null;
let currentNPCs = [];
let permanentNPCs = null;

// DOM Elements
const sessionIdInput = document.getElementById('session-id-input');
const loadSessionBtn = document.getElementById('load-session-btn');
const loadBaseBtn = document.getElementById('load-base-btn');
const savePermanentBtn = document.getElementById('save-permanent-btn');
const loadPermanentBtn = document.getElementById('load-permanent-btn');
const npcsGrid = document.getElementById('npcs-grid');
const messagesDiv = document.getElementById('messages');

// Load permanent NPCs on page load
window.addEventListener('DOMContentLoaded', () => {
    loadPermanentNPCs();
    
    // Auto-fill session ID if available
    const savedSession = localStorage.getItem('gameSessionId');
    if (savedSession) {
        sessionIdInput.value = savedSession;
    }
});

loadSessionBtn.addEventListener('click', () => {
    const sessionId = sessionIdInput.value.trim();
    if (!sessionId) {
        showMessage('Please enter a session ID', 'error');
        return;
    }
    currentSessionId = sessionId;
    loadSessionNPCs();
});

loadBaseBtn.addEventListener('click', () => {
    currentSessionId = null;
    loadBaseNPCs();
});

savePermanentBtn.addEventListener('click', () => {
    savePermanentNPCs();
});

loadPermanentBtn.addEventListener('click', () => {
    loadPermanentNPCs();
});

async function loadSessionNPCs() {
    if (!currentSessionId) {
        showMessage('No session ID provided', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/npcs/${currentSessionId}`);
        if (!response.ok) {
            if (response.status === 404) {
                showMessage('Game session not found. Loading base NPCs instead.', 'error');
                loadBaseNPCs();
                return;
            }
            throw new Error('Failed to load NPCs');
        }

        const data = await response.json();
        currentNPCs = data.npcs;
        renderNPCs();
        showMessage(`Loaded ${currentNPCs.length} NPCs from game session`, 'success');
    } catch (error) {
        showMessage('Error loading NPCs: ' + error.message, 'error');
    }
}

async function loadBaseNPCs() {
    try {
        const response = await fetch('/api/npcs');
        if (!response.ok) throw new Error('Failed to load base NPCs');

        const data = await response.json();
        currentNPCs = data.npcs;
        renderNPCs();
        showMessage(`Loaded ${currentNPCs.length} base NPCs`, 'success');
    } catch (error) {
        showMessage('Error loading base NPCs: ' + error.message, 'error');
    }
}

function loadPermanentNPCs() {
    try {
        const savedNPCs = localStorage.getItem('permanentNPCs');
        if (savedNPCs) {
            permanentNPCs = JSON.parse(savedNPCs);
            currentNPCs = JSON.parse(JSON.stringify(permanentNPCs)); // Deep copy
            renderNPCs();
            showMessage(`✅ Loaded ${currentNPCs.length} permanent NPCs`, 'success');
        } else {
            loadBaseNPCs();
            showMessage('ℹ️ No permanent NPCs saved. Loaded base NPCs. Edit and save to make permanent.', 'info');
        }
    } catch (error) {
        showMessage('Error loading permanent NPCs: ' + error.message, 'error');
        loadBaseNPCs();
    }
}

function savePermanentNPCs() {
    try {
        if (currentNPCs.length === 0) {
            showMessage('No NPCs to save', 'error');
            return;
        }
        
        permanentNPCs = JSON.parse(JSON.stringify(currentNPCs)); // Deep copy
        localStorage.setItem('permanentNPCs', JSON.stringify(permanentNPCs));
        showMessage(`✅ Saved ${currentNPCs.length} NPCs permanently! This will apply to all new games.`, 'success');
    } catch (error) {
        showMessage('Error saving permanent NPCs: ' + error.message, 'error');
    }
}

function renderNPCs() {
    npcsGrid.innerHTML = '';

    if (currentNPCs.length === 0) {
        npcsGrid.innerHTML = '<p>No NPCs found.</p>';
        return;
    }

    currentNPCs.forEach(npc => {
        const npcCard = createNPCCard(npc);
        npcsGrid.appendChild(npcCard);
    });
}

function createNPCCard(npc) {
    const card = document.createElement('div');
    card.className = 'npc-card';
    card.innerHTML = `
        <h3>${npc.name}</h3>
        
        <div class="form-group">
            <label>ID</label>
            <input type="text" value="${npc.id}" disabled>
        </div>

        <div class="form-group">
            <label>Name</label>
            <input type="text" id="name-${npc.id}" value="${npc.name}">
        </div>

        <div class="form-group">
            <label>Tribe</label>
            <input type="text" id="tribe-${npc.id}" value="${npc.tribe}" disabled>
        </div>

        <div class="form-group">
            <label>Role</label>
            <input type="text" id="role-${npc.id}" value="${npc.role}">
        </div>

        <div class="form-group">
            <label>Disposition</label>
            <select id="disposition-${npc.id}">
                <option value="Friendly" ${npc.disposition === 'Friendly' ? 'selected' : ''}>Friendly</option>
                <option value="Neutral" ${npc.disposition === 'Neutral' ? 'selected' : ''}>Neutral</option>
                <option value="Hostile" ${npc.disposition === 'Hostile' ? 'selected' : ''}>Hostile</option>
            </select>
        </div>

        <div class="form-group">
            <label>Relationship (0-100)</label>
            <input type="number" id="relationship-${npc.id}" value="${npc.relationship}" min="0" max="100">
        </div>

        <div class="form-group">
            <label>Growth Path</label>
            <input type="text" id="growth_path-${npc.id}" value="${npc.growth_path}">
        </div>

        <div class="form-group">
            <label>Level</label>
            <input type="number" id="level-${npc.id}" value="${npc.level || 1}" min="1">
        </div>

        <div class="form-group">
            <label>XP</label>
            <input type="number" id="xp-${npc.id}" value="${npc.xp || 0}" min="0">
        </div>

        <div class="form-group">
            <label>Stats</label>
            <div class="stats-grid">
                <div class="stat-input">
                    <label>STR</label>
                    <input type="number" id="stat-str-${npc.id}" value="${npc.stats?.str || 3}" min="1">
                </div>
                <div class="stat-input">
                    <label>DEX</label>
                    <input type="number" id="stat-dex-${npc.id}" value="${npc.stats?.dex || 3}" min="1">
                </div>
                <div class="stat-input">
                    <label>WIS</label>
                    <input type="number" id="stat-wis-${npc.id}" value="${npc.stats?.wis || 3}" min="1">
                </div>
                <div class="stat-input">
                    <label>CHA</label>
                    <input type="number" id="stat-cha-${npc.id}" value="${npc.stats?.cha || 3}" min="1">
                </div>
                <div class="stat-input">
                    <label>LCK</label>
                    <input type="number" id="stat-luck-${npc.id}" value="${npc.stats?.luck || 3}" min="1">
                </div>
            </div>
        </div>

        <div class="button-group">
            <button class="btn btn-primary btn-small" onclick="updateNPC('${npc.id}')">
                💾 Save Changes
            </button>
            ${currentSessionId ? `
                <button class="btn btn-secondary btn-small" onclick="growNPC('${npc.id}', 5)">
                    ⬆️ +5 XP
                </button>
                <button class="btn btn-secondary btn-small" onclick="growNPC('${npc.id}', 15)">
                    ⬆️ +15 XP
                </button>
            ` : ''}
        </div>
    `;

    return card;
}

async function updateNPC(npcId) {
    // Update local NPC data first
    const npc = currentNPCs.find(n => n.id === npcId);
    if (!npc) {
        showMessage('NPC not found', 'error');
        return;
    }

    const updates = {
        name: document.getElementById(`name-${npcId}`).value,
        role: document.getElementById(`role-${npcId}`).value,
        disposition: document.getElementById(`disposition-${npcId}`).value,
        relationship: parseInt(document.getElementById(`relationship-${npcId}`).value),
        growth_path: document.getElementById(`growth_path-${npcId}`).value,
        level: parseInt(document.getElementById(`level-${npcId}`).value),
        xp: parseInt(document.getElementById(`xp-${npcId}`).value),
        stats: {
            str: parseInt(document.getElementById(`stat-str-${npcId}`).value),
            dex: parseInt(document.getElementById(`stat-dex-${npcId}`).value),
            wis: parseInt(document.getElementById(`stat-wis-${npcId}`).value),
            cha: parseInt(document.getElementById(`stat-cha-${npcId}`).value),
            luck: parseInt(document.getElementById(`stat-luck-${npcId}`).value)
        }
    };

    // Update local NPC
    Object.assign(npc, updates);
    
    // If we have a session, also update it
    if (currentSessionId) {
        try {
            const response = await fetch(`/api/npcs/${currentSessionId}/${npcId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!response.ok) throw new Error('Failed to update NPC in session');
            
            showMessage(`✅ ${npc.name} updated in session!`, 'success');
        } catch (error) {
            showMessage('Error updating NPC in session: ' + error.message, 'error');
        }
    }
    
    showMessage(`✅ ${npc.name} updated! (Save Permanent to make it permanent)`, 'success');
    renderNPCs();
}

async function growNPC(npcId, xpAmount) {
    if (!currentSessionId) {
        showMessage('Cannot grow NPC: No active game session.', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/npcs/${currentSessionId}/${npcId}/grow`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xpAmount })
        });

        if (!response.ok) throw new Error('Failed to grow NPC');

        const data = await response.json();
        const npc = currentNPCs.find(n => n.id === npcId);
        
        if (data.leveledUp) {
            showMessage(`🌟 ${npc.name} leveled up! Now level ${data.npc.level}`, 'success');
        } else {
            showMessage(`✅ ${npc.name} gained ${xpAmount} XP`, 'success');
        }
        
        // Reload to show updated data
        loadSessionNPCs();
    } catch (error) {
        showMessage('Error growing NPC: ' + error.message, 'error');
    }
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

// Make functions globally available
window.updateNPC = updateNPC;
window.growNPC = growNPC;

