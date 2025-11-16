/**
 * Save Manager - Industrial Standard Save System
 * Handles save slots, auto-save, and persistent game state
 * 
 * Features:
 * - Multiple save slots (1-10)
 * - Auto-save functionality
 * - Save metadata (character info, playtime, timestamps)
 * - Database-backed persistent storage
 * - Save validation and versioning
 */

// Save slot management
let saveSlots = []
let currentUserId = null

// Reference to global functions from app.js
let addMessageFn = null
let updateUIFn = null
let showGameScreenFn = null
let getPermanentConfigFn = null
let getPermanentNPCsFn = null
let sessionIdRef = null
let gameStateRef = null

/**
 * Initialize save manager with user ID and references to app.js functions
 */
function initializeSaveManager(userId, refs = {}) {
  currentUserId = userId
  sessionIdRef = refs.sessionId || null
  gameStateRef = refs.gameState || null
  addMessageFn = refs.addMessage || ((msg, type) => console.log(`[${type}] ${msg}`))
  updateUIFn = refs.updateUI || (() => {})
  showGameScreenFn = refs.showGameScreen || (() => {})
  getPermanentConfigFn = refs.getPermanentConfig || (() => null)
  getPermanentNPCsFn = refs.getPermanentNPCs || (() => null)
  loadSaveSlots()
}

/**
 * Load all save slots for the current user
 */
async function loadSaveSlots() {
  if (!currentUserId) return

  try {
    const response = await fetch(`/api/saves/${currentUserId}`)
    if (!response.ok) throw new Error('Failed to load save slots')
    
    const data = await response.json()
    saveSlots = data.slots || []
    updateSaveSlotsUI()
  } catch (error) {
    console.error('Error loading save slots:', error)
    if (addMessageFn) addMessageFn('Failed to load save slots', 'error')
  }
}

/**
 * Save game to a specific slot
 */
async function saveToSlot(slotNumber, saveName = null, isAutoSave = false) {
  const activeSessionId = sessionIdRef || (typeof sessionId !== 'undefined' ? sessionId : null)
  if (!currentUserId || !activeSessionId) {
    if (addMessageFn) addMessageFn('No active game session', 'error')
    return false
  }

  try {
    const response = await fetch(`/api/saves/${currentUserId}/slot/${slotNumber}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saveName: saveName || `Save Slot ${slotNumber}`,
        isAutoSave
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save game')
    }

    const data = await response.json()
    await loadSaveSlots() // Refresh slots
    
    // Only show message for manual saves, not auto-saves (silent auto-save)
    if (addMessageFn && !isAutoSave) {
      addMessageFn(`💾 Saved to Slot ${slotNumber}`, 'success')
    }
    
    return true
  } catch (error) {
    if (addMessageFn) addMessageFn(`Save failed: ${error.message}`, 'error')
    return false
  }
}

/**
 * Load game from a specific slot
 */
async function loadFromSlot(slotNumber) {
  if (!currentUserId) {
    if (addMessageFn) addMessageFn('No user session', 'error')
    return false
  }

  try {
    // NPCs and config are now loaded from database on server side
    const response = await fetch(`/api/saves/${currentUserId}/slot/${slotNumber}/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to load game')
    }

    const data = await response.json()
    
    // Update session (update both local and global if available)
    if (sessionIdRef !== null) {
      sessionIdRef = data.sessionId
    }
    if (typeof sessionId !== 'undefined') {
      sessionId = data.sessionId
    }
    localStorage.setItem('gameSessionId', data.sessionId)
    
    // Update game state (update both local and global if available)
    const newGameState = {
      player: data.player,
      tribe: data.tribe,
      npcs: data.npcs,
      worldState: data.worldState,
      day: data.day,
      stamina: data.stamina,
      maxStamina: data.maxStamina,
      health: data.health,
      maxHealth: data.maxHealth
    }
    if (gameStateRef !== null) {
      Object.assign(gameStateRef, newGameState)
    }
    if (typeof gameState !== 'undefined') {
      gameState = newGameState
    }

    // Update UI
    if (updateUIFn) updateUIFn()
    if (showGameScreenFn) showGameScreenFn()
    if (addMessageFn) addMessageFn(`✅ Loaded from Slot ${slotNumber}`, 'success')
    
    // Re-initialize save manager with new session
    initializeSaveManager(data.sessionId, {
      sessionId: sessionIdRef || sessionId,
      gameState: gameStateRef || gameState,
      addMessage: addMessageFn,
      updateUI: updateUIFn,
      showGameScreen: showGameScreenFn,
      getPermanentConfig: getPermanentConfigFn,
      getPermanentNPCs: getPermanentNPCsFn
    })
    
    return true
  } catch (error) {
    if (addMessageFn) addMessageFn(`Load failed: ${error.message}`, 'error')
    return false
  }
}

/**
 * Delete a save slot
 */
async function deleteSaveSlot(slotNumber) {
  if (!currentUserId) return false

  if (!confirm(`Delete save slot ${slotNumber}? This cannot be undone.`)) {
    return false
  }

  try {
    const response = await fetch(`/api/saves/${currentUserId}/slot/${slotNumber}`, {
      method: 'DELETE'
    })

    if (!response.ok) throw new Error('Failed to delete save')

    await loadSaveSlots()
    if (addMessageFn) addMessageFn(`🗑️ Deleted Slot ${slotNumber}`, 'success')
    return true
  } catch (error) {
    if (addMessageFn) addMessageFn(`Delete failed: ${error.message}`, 'error')
    return false
  }
}

/**
 * Auto-save (saves to slot 1 by default, or next available)
 * Silent save - no user notification
 */
async function autoSave() {
  const activeSessionId = sessionIdRef || (typeof sessionId !== 'undefined' ? sessionId : null)
  if (!currentUserId || !activeSessionId) return

  try {
    // Find first empty slot or use slot 1
    let autoSaveSlot = 1
    const emptySlot = saveSlots.find(slot => slot.isEmpty)
    if (emptySlot) {
      autoSaveSlot = emptySlot.slotNumber
    }

    await saveToSlot(autoSaveSlot, 'Auto-Save', true)
  } catch (error) {
    // Silent fail - don't interrupt gameplay
    console.error('Auto-save failed:', error)
  }
}

/**
 * Format playtime for display
 */
function formatPlaytime(seconds) {
  if (!seconds) return '0m'
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown'
  
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return date.toLocaleDateString()
}

/**
 * Update save slots UI (called from main app.js)
 */
function updateSaveSlotsUI() {
  // This will be called from the save slots modal
  // Implementation depends on where you want to show save slots
}

/**
 * Show save slots modal
 */
function showSaveSlotsModal() {
  const modal = document.getElementById('save-slots-modal')
  if (modal) {
    modal.classList.add('active')
    renderSaveSlots()
  }
}

/**
 * Hide save slots modal
 */
function hideSaveSlotsModal() {
  const modal = document.getElementById('save-slots-modal')
  if (modal) {
    modal.classList.remove('active')
  }
}

/**
 * Render save slots in the modal
 */
function renderSaveSlots() {
  const container = document.getElementById('save-slots-container')
  if (!container) return

  container.innerHTML = ''

  saveSlots.forEach(slot => {
    const slotElement = document.createElement('div')
    slotElement.className = `save-slot ${slot.isEmpty ? 'empty' : 'filled'}`
    
    if (slot.isEmpty) {
      slotElement.innerHTML = `
        <div class="save-slot-content">
          <div class="save-slot-number">Slot ${slot.slotNumber}</div>
          <div class="save-slot-status">Empty</div>
          <button class="btn btn-primary btn-compact" onclick="saveToSlot(${slot.slotNumber})">
            Save Here
          </button>
        </div>
      `
    } else {
      const meta = slot.metadata
      slotElement.innerHTML = `
        <div class="save-slot-content">
          <div class="save-slot-header">
            <div class="save-slot-number">Slot ${slot.slotNumber}</div>
            ${meta.isAutoSave ? '<span class="save-slot-autosave">AUTO</span>' : ''}
          </div>
          <div class="save-slot-name">${meta.saveName}</div>
          <div class="save-slot-info">
            <div class="save-slot-character">
              <strong>${meta.characterName}</strong> - ${meta.characterTribe}
            </div>
            <div class="save-slot-stats">
              Level ${meta.characterLevel} | Day ${meta.day}
            </div>
            <div class="save-slot-meta">
              <span>⏱️ ${formatPlaytime(meta.playtime)}</span>
              <span>🕐 ${formatTimestamp(meta.timestamp)}</span>
            </div>
          </div>
          <div class="save-slot-actions">
            <button class="btn btn-primary btn-compact" onclick="loadFromSlot(${slot.slotNumber})">
              Load
            </button>
            <button class="btn btn-secondary btn-compact" onclick="saveToSlot(${slot.slotNumber}, '${meta.saveName}')">
              Overwrite
            </button>
            <button class="btn btn-danger btn-compact" onclick="deleteSaveSlot(${slot.slotNumber})">
              Delete
            </button>
          </div>
        </div>
      `
    }

    container.appendChild(slotElement)
  })
}

// Auto-save on key events (every 5 minutes or on end day)
let autoSaveInterval = null

function startAutoSave() {
  // Auto-save every 5 minutes
  if (autoSaveInterval) clearInterval(autoSaveInterval)
  
  autoSaveInterval = setInterval(() => {
    if (sessionId && currentUserId) {
      autoSave()
    }
  }, 5 * 60 * 1000) // 5 minutes
}

function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval)
    autoSaveInterval = null
  }
}

// Export functions for use in app.js
if (typeof window !== 'undefined') {
  window.saveManager = {
    initialize: initializeSaveManager,
    loadSlots: loadSaveSlots,
    saveToSlot,
    loadFromSlot,
    deleteSlot: deleteSaveSlot,
    autoSave,
    showModal: showSaveSlotsModal,
    hideModal: hideSaveSlotsModal,
    startAutoSave,
    stopAutoSave
  }
}

