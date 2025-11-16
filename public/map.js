// Map View
let currentUserId = null;
let gameState = null;
let npcMarkers = [];

// Get session ID from localStorage
window.addEventListener('DOMContentLoaded', () => {
    currentUserId = localStorage.getItem('gameUserId');
    if (currentUserId) {
        loadMapData();
    } else {
        showMessage('No active game session. Please start a game first.', 'error');
    }
});

async function loadMapData() {
    if (!currentUserId) return;

    try {
        const response = await fetch(`/api/game/${currentUserId}`);
        if (!response.ok) {
            throw new Error('Failed to load game data');
        }

        gameState = await response.json();
        renderMap();
    } catch (error) {
        showMessage('Error loading map: ' + error.message, 'error');
    }
}

function renderMap() {
    const mapCanvas = document.getElementById('map-canvas');
    mapCanvas.innerHTML = '';
    npcMarkers = [];

    if (!gameState || !gameState.npcs) return;

    // Filter NPCs that have been encountered
    const encounteredNPCs = gameState.npcs.filter(npc => npc.encountered || npc.flags?.met);

    encounteredNPCs.forEach(npc => {
        if (!npc.location) return;

        const marker = document.createElement('div');
        marker.className = `npc-marker ${npc.disposition.toLowerCase()}`;
        marker.style.left = `${npc.location.x}px`;
        marker.style.top = `${npc.location.y}px`;
        marker.title = `${npc.name} (${npc.role})`;
        
        // Use emoji based on role
        const roleEmoji = getRoleEmoji(npc.role);
        marker.textContent = roleEmoji;

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'npc-tooltip';
        tooltip.innerHTML = `
            <h3>${npc.name}</h3>
            <p><strong>Role:</strong> ${npc.role}</p>
            <p><strong>Level:</strong> ${npc.level || 1}</p>
            <p><strong>Relationship:</strong> ${gameState.player.relationships[npc.id] || 50}</p>
            <p><strong>Disposition:</strong> ${npc.disposition}</p>
        `;

        marker.addEventListener('mouseenter', (e) => {
            const rect = marker.getBoundingClientRect();
            const mapRect = mapCanvas.getBoundingClientRect();
            tooltip.style.left = `${rect.left - mapRect.left + 50}px`;
            tooltip.style.top = `${rect.top - mapRect.top - 10}px`;
            tooltip.classList.add('visible');
        });

        marker.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });

        marker.addEventListener('click', () => {
            interactWithNPC(npc.id);
        });

        mapCanvas.appendChild(marker);
        mapCanvas.appendChild(tooltip);
        npcMarkers.push({ marker, npc, tooltip });
    });
}

function getRoleEmoji(role) {
    const roleEmojis = {
        'Merchant': '💰',
        'Warrior': '⚔️',
        'Elder': '👴',
        'Hunter': '🏹',
        'Farmer': '🌾',
        'Mystic': '🔮'
    };
    return roleEmojis[role] || '👤';
}

async function interactWithNPC(npcId) {
    if (!currentUserId) return;

    try {
        const response = await fetch(`/api/game/${currentUserId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'visit',
                npcId: npcId
            })
        });

        if (!response.ok) {
            throw new Error('Failed to interact with NPC');
        }

        const data = await response.json();
        
        // Show result message
        showMessage(data.result.message, data.result.success ? 'success' : 'error');
        
        // Show encounter if any
        if (data.result.encounter) {
            showMessage('🎯 ENCOUNTER: ' + data.result.encounter.message, 'event');
        }

        // Reload map data to update NPC states
        setTimeout(() => {
            loadMapData();
        }, 1000);
    } catch (error) {
        showMessage('Error interacting with NPC: ' + error.message, 'error');
    }
}

function showMessage(text, type = 'info') {
    // Create a temporary message element
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#8b5cf6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 1000;
        max-width: 300px;
    `;
    message.textContent = text;
    document.body.appendChild(message);

    setTimeout(() => {
        message.remove();
    }, 3000);
}

