// Game State
let userId = null;
let gameState = null;
let currentCombatAnimal = null; // Track active combat encounter

// Generate or retrieve userId
function getOrCreateUserId() {
  let id = localStorage.getItem("gameUserId");
  if (!id) {
    // Generate a unique user ID
    id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("gameUserId", id);
  }
  return id;
}

// API Base URL
const API_BASE = "";

// DOM Elements
const startScreen = document.getElementById("start-screen");
const loadScreen = document.getElementById("load-screen");
const gameScreen = document.getElementById("game-screen");
const npcModal = document.getElementById("npc-modal");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Mark app as initialized to allow screens to show
  document.getElementById("app").classList.add("initialized");

  setupEventListeners();
  // Hide all screens initially to prevent flashing
  startScreen.classList.remove("active");
  loadScreen.classList.remove("active");
  gameScreen.classList.remove("active");
  // Check for saved session and show appropriate screen
  checkForSavedSession();

  // Initialize userId
  userId = getOrCreateUserId();

  // Note: Backend already saves to active_games table after every action
  // No need to auto-save on page unload - game state is already persisted
  // The active_games table is the primary persistence mechanism
});

function setupEventListeners() {
  // Start screen
  document
    .getElementById("start-new-game")
    .addEventListener("click", startNewGame);
  document
    .getElementById("load-game-btn")
    .addEventListener("click", showLoadScreen);
  document
    .getElementById("back-to-start")
    .addEventListener("click", showStartScreen);

  // Game actions - use event delegation to handle dynamically created buttons
  document.addEventListener("click", (e) => {
    const actionBtn = e.target.closest(".action-btn-compact, .action-btn");
    if (actionBtn && actionBtn.dataset.action) {
      // Don't allow actions if there's an active encounter
      if (typeof currentCombatAnimal !== "undefined" && currentCombatAnimal) {
        addMessage("⚠️ You must decide: Fight or Flee!", "error");
        return;
      }

      // Don't allow actions if player is resting
      if (gameState?.isResting && gameState?.restDaysRemaining > 0) {
        addMessage(
          `💤 You are too injured to perform actions. Rest for ${
            gameState.restDaysRemaining
          } more day${gameState.restDaysRemaining > 1 ? "s" : ""} to recover.`,
          "error"
        );
        return;
      }

      const action = actionBtn.dataset.action;
      if (action === "visit") {
        showNPCModal();
      } else {
        executeAction(action);
      }
    }
  });

  document.getElementById("end-day-btn").addEventListener("click", endDay);

  // Refresh map button removed to save space - map auto-refreshes on actions

  // NPC modal
  document.getElementById("close-npc-modal").addEventListener("click", () => {
    npcModal.classList.remove("active");
  });

  // Combat window
  const fightBtn = document.getElementById("fight-btn");
  const fleeBtn = document.getElementById("flee-btn");
  const combatWindow = document.getElementById("combat-window");

  if (fightBtn) {
    fightBtn.addEventListener("click", async () => {
      if (currentCombatAnimal) {
        document.getElementById("combat-message").textContent =
          "⚔️ Engaging in combat...";
        await executeAction("explore", undefined, "fight");
        setTimeout(() => {
          if (combatWindow) combatWindow.classList.remove("active");
        }, 2000);
        currentCombatAnimal = null;
      }
    });
  }

  if (fleeBtn) {
    fleeBtn.addEventListener("click", async () => {
      if (currentCombatAnimal) {
        document.getElementById("combat-message").textContent =
          "🏃 Attempting to flee...";
        await executeAction("explore", undefined, "flee");
        setTimeout(() => {
          if (combatWindow) combatWindow.classList.remove("active");
        }, 2000);
        currentCombatAnimal = null;
      }
    });
  }
}

function checkForSavedSession() {
  userId = getOrCreateUserId();
  // Initialize save manager (for manual saves to slots)
  // Note: Backend auto-saves to active_games table, so interval auto-save is optional
  if (typeof saveManager !== "undefined") {
    saveManager.initialize(userId, {
      userId: userId,
      gameState: gameState,
      addMessage: addMessage,
      updateUI: updateUI,
      showGameScreen: showGameScreen,
      getPermanentConfig: getPermanentConfig,
      getPermanentNPCs: getPermanentNPCs,
    });
    // Optional: Start interval-based backup saves (reduced frequency)
    // saveManager.startAutoSave();
  }
  loadGameState();
}

async function startNewGame() {
  const name = document.getElementById("player-name").value.trim() || "Aro";
  const tribe = document.getElementById("tribe-select").value;

  // Ensure userId exists
  userId = getOrCreateUserId();

  // NPCs and config are now loaded from database on server side
  try {
    const response = await fetch(`${API_BASE}/api/game/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tribe, userId }),
    });

    if (!response.ok) throw new Error("Failed to create game");

    const data = await response.json();
    userId = data.userId || getOrCreateUserId();
    localStorage.setItem("gameUserId", userId);
    gameState = data;

    // Initialize save manager with user ID (for manual saves to slots)
    // Note: Backend auto-saves to active_games table, so interval auto-save is optional
    if (typeof saveManager !== "undefined") {
      saveManager.initialize(userId);
      // Optional: Start interval-based backup saves (reduced frequency)
      // saveManager.startAutoSave();
    }

    showGameScreen();
    updateUI();
    updateInventory();
    addMessage("✅ New game started!", "success");

    // Update health in status bar
    if (data.health !== undefined) {
      document.getElementById("health").textContent = data.health;
      document.getElementById("max-health").textContent = data.maxHealth || 100;
    }
  } catch (error) {
    addMessage("Error starting game: " + error.message, "error");
  }
}

async function loadGameState() {
  if (!userId) {
    userId = getOrCreateUserId();
  }

  try {
    const response = await fetch(`${API_BASE}/api/game/${userId}`);
    if (!response.ok) {
      if (response.status === 404) {
        // Game not found, show start screen
        showStartScreen();
        return;
      }
      throw new Error("Failed to load game");
    }

    gameState = await response.json();
    showGameScreen();
    updateUI();
  } catch (error) {
    console.error("Error loading game:", error);
    // On error, show start screen
    showStartScreen();
  }
}

async function executeAction(action, npcId = null, combatDecision = null) {
  if (!userId) {
    userId = getOrCreateUserId();
  }

  const actionBtn = document.querySelector(`[data-action="${action}"]`);
  if (actionBtn) actionBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/api/game/${userId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, npcId, combatDecision }),
    });

    if (!response.ok) throw new Error("Failed to execute action");

    const data = await response.json();
    gameState = data;

    // Update resting state
    if (data.isResting !== undefined) {
      gameState.isResting = data.isResting;
      gameState.restDaysRemaining = data.restDaysRemaining || 0;
    }

    // Update inventory
    if (data.bag !== undefined) {
      gameState.bag = data.bag;
    }
    if (data.equipment !== undefined) {
      gameState.equipment = data.equipment;
    }

    // Show result message
    addMessage(data.result.message, data.result.success ? "success" : "error");

    // Show resting warning if player is now resting
    if (data.isResting && data.restDaysRemaining > 0) {
      addMessage(
        `💤 You are too injured to continue. You must rest for ${
          data.restDaysRemaining
        } day${data.restDaysRemaining > 1 ? "s" : ""} to recover.`,
        "error"
      );
    }

    // Update health in status bar
    if (data.health !== undefined) {
      document.getElementById("health").textContent = data.health;
      document.getElementById("max-health").textContent = data.maxHealth || 100;
    }

    // Show event if any
    if (data.result.event) {
      addMessage("⚡ EVENT: " + data.result.event.text, "event");
    }

    if (data.result.npcEvent) {
      addMessage("⚡ NPC EVENT: " + data.result.npcEvent.text, "event");
    }

    // Show encounter if any
    if (data.result.encounter) {
      addMessage("🎯 ENCOUNTER: " + data.result.encounter.message, "event");
      if (data.result.encounter.rewards) {
        const encounterRewards = [];
        if (data.result.encounter.rewards.xp)
          encounterRewards.push(`+${data.result.encounter.rewards.xp} XP`);
        if (data.result.encounter.rewards.statBonus) {
          Object.entries(data.result.encounter.rewards.statBonus).forEach(
            ([stat, value]) => {
              encounterRewards.push(`+${value} ${stat.toUpperCase()}`);
            }
          );
        }
        if (data.result.encounter.rewards.wealth)
          encounterRewards.push(
            `+${data.result.encounter.rewards.wealth} Wealth`
          );
        if (data.result.encounter.rewards.materials)
          encounterRewards.push(
            `+${data.result.encounter.rewards.materials} Materials`
          );
        if (encounterRewards.length > 0) {
          addMessage(
            "🎁 Encounter Rewards: " + encounterRewards.join(", "),
            "success"
          );
        }
      }
    }

    // Show explore encounter (wild animal) - requires player decision
    if (
      data.result.exploreEncounter &&
      data.result.exploreEncounter.requiresDecision
    ) {
      showEncounterWindow(
        data.result.exploreEncounter.animal,
        gameState.player
      );
      // Disable all action buttons until player decides
      disableAllActionButtons();
      // Don't update UI yet - wait for player decision
      return;
    } else {
      // Hide encounter window if no encounter
      hideEncounterWindow();
      // Re-enable action buttons
      enableAllActionButtons();
    }

    // Show combat result if any
    if (data.result.combatResult) {
      const combat = data.result.combatResult;
      updateEncounterWindowWithResult(combat);
      // Re-enable action buttons after combat is resolved
      enableAllActionButtons();
      const combatMessage = document.getElementById("combat-message");

      // Update player health bar in combat window
      if (data.health !== undefined && data.maxHealth !== undefined) {
        const playerHealthBar = document.getElementById("player-health-bar");
        const playerHealthText = document.getElementById("player-health-text");
        if (playerHealthBar) {
          const healthPercent = (data.health / data.maxHealth) * 100;
          playerHealthBar.style.width = `${healthPercent}%`;
          // Change color based on health level
          if (healthPercent < 25) {
            playerHealthBar.style.background =
              "linear-gradient(90deg, #ef4444, #dc2626)";
          } else if (healthPercent < 50) {
            playerHealthBar.style.background =
              "linear-gradient(90deg, #f59e0b, #d97706)";
          } else {
            playerHealthBar.style.background =
              "linear-gradient(90deg, #10b981, #059669)";
          }
        }
        if (playerHealthText) {
          playerHealthText.textContent = `${data.health}/${data.maxHealth}`;
        }
      }

      if (combat.victory) {
        if (combatMessage) {
          combatMessage.textContent = `✅ ${combat.message}`;
          combatMessage.style.borderLeftColor = "#10b981";
        }
        addMessage(`✅ ${combat.message}`, "success");
        if (combat.rewards) {
          const rewards = [];
          if (combat.rewards.xp) rewards.push(`+${combat.rewards.xp} XP`);
          if (combat.rewards.food) rewards.push(`+${combat.rewards.food} Food`);
          if (combat.rewards.materials)
            rewards.push(`+${combat.rewards.materials} Materials`);
          if (combat.rewards.wealth)
            rewards.push(`+${combat.rewards.wealth} Wealth`);
          if (rewards.length > 0) {
            const rewardText = "🎁 Combat Rewards: " + rewards.join(", ");
            if (combatMessage) {
              combatMessage.textContent += "\n" + rewardText;
            }
            addMessage(rewardText, "success");
          }
        }
      } else {
        if (combatMessage) {
          combatMessage.textContent = `❌ ${combat.message}`;
          combatMessage.style.borderLeftColor = "#ef4444";
        }
        addMessage(`❌ ${combat.message}`, "error");
      }
      if (combat.damageTaken > 0) {
        const damageText = `💔 You took ${combat.damageTaken} damage! Health: ${data.health}/${data.maxHealth}`;
        if (combatMessage) {
          combatMessage.textContent += "\n" + damageText;
        }
        addMessage(damageText, "error");
      }
    }

    // Show rewards
    if (data.result.rewards) {
      const rewards = [];
      if (data.result.rewards.xp) rewards.push(`+${data.result.rewards.xp} XP`);
      if (data.result.rewards.food)
        rewards.push(`+${data.result.rewards.food} Food`);
      if (data.result.rewards.materials)
        rewards.push(`+${data.result.rewards.materials} Materials`);
      if (data.result.rewards.wealth) {
        const wealth = data.result.rewards.wealth;
        rewards.push(`${wealth > 0 ? "+" : ""}${wealth} Wealth`);
      }
      if (data.result.rewards.spirit_energy)
        rewards.push(`+${data.result.rewards.spirit_energy} Spirit Energy`);

      if (rewards.length > 0) {
        addMessage("📦 Rewards: " + rewards.join(", "), "success");
      }
    }

    updateUI();
    updateInventory();

    // Note: Backend automatically saves to active_games table after every action
    // No need for frontend auto-save here - it's redundant
  } catch (error) {
    addMessage("Error: " + error.message, "error");
    // Re-enable buttons on error (unless there's an active encounter)
    if (typeof currentCombatAnimal === "undefined" || !currentCombatAnimal) {
      enableAllActionButtons();
    }
  } finally {
    // Don't re-enable if there's an active encounter waiting for decision
    if (
      (typeof currentCombatAnimal === "undefined" || !currentCombatAnimal) &&
      actionBtn
    ) {
      enableAllActionButtons();
    }
  }
}

async function endDay() {
  if (!userId) {
    userId = getOrCreateUserId();
  }

  // Note: Backend automatically saves to active_games table after end-day
  // No need for frontend auto-save here - it's redundant

  try {
    const response = await fetch(`${API_BASE}/api/game/${userId}/end-day`, {
      method: "POST",
    });

    if (!response.ok) throw new Error("Failed to end day");

    const data = await response.json();
    gameState = data;

    // Update resting state
    if (data.isResting !== undefined) {
      gameState.isResting = data.isResting;
      gameState.restDaysRemaining = data.restDaysRemaining || 0;
    }

    // Update inventory
    if (data.bag !== undefined) {
      gameState.bag = data.bag;
    }
    if (data.equipment !== undefined) {
      gameState.equipment = data.equipment;
    }

    if (data.isResting && data.restDaysRemaining > 0) {
      addMessage(
        `💤 You are resting to recover. ${data.restDaysRemaining} day${
          data.restDaysRemaining > 1 ? "s" : ""
        } remaining. Health: ${data.health}/${data.maxHealth}`,
        "error"
      );
    } else {
      addMessage(
        "✨ A new day begins! Your stamina has been restored.",
        "success"
      );
    }

    if (data.growthMessages && data.growthMessages.length > 0) {
      data.growthMessages.forEach((msg) => {
        addMessage("👥 " + msg, "success");
      });
    }

    updateUI();
  } catch (error) {
    addMessage("Error: " + error.message, "error");
  }
}

// Auto-save system:
// - Backend automatically saves to active_games table after every action/end-day/equip/etc.
// - This is the primary persistence mechanism (no frontend auto-save needed)
// - Manual saves to save slots are still available for named saves

async function showLoadScreen() {
  try {
    const response = await fetch(`${API_BASE}/api/game/saves`);
    if (!response.ok) throw new Error("Failed to load saves");

    const data = await response.json();
    const savesList = document.getElementById("saves-list");
    savesList.innerHTML = "";

    if (data.saves.length === 0) {
      savesList.innerHTML = "<p>No saved games found.</p>";
      return;
    }

    data.saves.forEach((savePath) => {
      const saveItem = document.createElement("div");
      saveItem.className = "save-item";
      saveItem.textContent = savePath.split("/").pop();
      saveItem.addEventListener("click", () => loadGame(savePath));
      savesList.appendChild(saveItem);
    });

    startScreen.classList.remove("active");
    loadScreen.classList.add("active");
  } catch (error) {
    addMessage("Error loading saves: " + error.message, "error");
  }
}

async function loadGame(filepath) {
  try {
    // NPCs and config are now loaded from database on server side
    const response = await fetch(`${API_BASE}/api/game/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filepath }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error || "Failed to load game";
      throw new Error(errorMsg);
    }

    userId = data.userId || getOrCreateUserId();
    localStorage.setItem("gameUserId", userId);
    gameState = data;

    // Initialize save manager with user ID (for manual saves to slots)
    // Note: Backend auto-saves to active_games table, so interval auto-save is optional
    if (typeof saveManager !== "undefined") {
      saveManager.initialize(userId);
      // Optional: Start interval-based backup saves (reduced frequency)
      // saveManager.startAutoSave();
    }

    showGameScreen();
    updateUI();
    addMessage("✅ Game loaded successfully!", "success");
  } catch (error) {
    addMessage("Error loading game: " + error.message, "error");
    console.error("Load game error:", error);
  }
}

function showStartScreen() {
  startScreen.classList.add("active");
  loadScreen.classList.remove("active");
  gameScreen.classList.remove("active");
}

function showGameScreen() {
  startScreen.classList.remove("active");
  loadScreen.classList.remove("active");
  gameScreen.classList.add("active");
}

function updateUI() {
  if (!gameState) return;

  // Update day, stamina, and health in status bar
  document.getElementById("current-day").textContent = gameState.day || 1;
  document.getElementById("stamina").textContent = gameState.stamina || 0;
  document.getElementById("max-stamina").textContent =
    gameState.maxStamina || 5;

  // Update health display
  const healthEl = document.getElementById("health");
  const maxHealthEl = document.getElementById("max-health");
  if (healthEl) healthEl.textContent = gameState.health || 100;
  if (maxHealthEl) maxHealthEl.textContent = gameState.maxHealth || 100;

  // Show resting indicator if applicable
  if (gameState.isResting && gameState.restDaysRemaining > 0) {
    const healthContainer = healthEl?.parentElement;
    if (healthContainer) {
      healthContainer.title = `Resting: ${gameState.restDaysRemaining} day${
        gameState.restDaysRemaining > 1 ? "s" : ""
      } remaining`;
    }
  }

  // Update inventory
  updateInventory();

  // Update player status
  if (gameState.player) {
    const playerStatus = document.getElementById("player-status");
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
                <span>${gameState.player.xp}/${
      gameState.player.level * 10
    }</span>
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
    document.getElementById("tribe-name").textContent = gameState.tribe.name;
    const tribeStatus = document.getElementById("tribe-status");
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

  // Update world state
  if (gameState.worldState) {
    const worldStatus = document.getElementById("world-status");
    const ws = gameState.worldState;
    worldStatus.innerHTML = `
            <div class="status-item">
                <span>Season:</span>
                <span>${ws.season}</span>
            </div>
            <div class="status-item">
                <span>World Age:</span>
                <span>${ws.age} days</span>
            </div>
            <div class="status-item" style="margin-top: 6px;">
                <span>World:</span>
            </div>
            <div class="stat-bar">
                <span>Pros:${ws.worldResources.prosperity}</span>
                <span>Stab:${ws.worldResources.stability}</span>
                <span>Ten:${ws.worldResources.tension}</span>
            </div>
        `;
  }

  // Update NPCs (only show encountered NPCs)
  if (gameState.npcs) {
    const npcsList = document.getElementById("npcs-list");
    npcsList.innerHTML = "";

    // Filter to only show NPCs that have been encountered
    const encounteredNPCs = gameState.npcs.filter(
      (npc) => npc.encountered || npc.flags?.met
    );

    if (encounteredNPCs.length === 0) {
      npcsList.innerHTML =
        '<p style="color: var(--text-secondary); font-style: italic;">No tribal members encountered yet. Visit NPCs to meet them!</p>';
    } else {
      encounteredNPCs.forEach((npc) => {
        const relationship = gameState.player.relationships[npc.id] || 50;
        let relationshipClass = "relationship-neutral";
        let relationshipText = "Neutral";

        if (relationship < 20) {
          relationshipClass = "relationship-hostile";
          relationshipText = "Hostile";
        } else if (relationship < 50) {
          relationshipClass = "relationship-neutral";
          relationshipText = "Neutral";
        } else if (relationship < 80) {
          relationshipClass = "relationship-friendly";
          relationshipText = "Friendly";
        } else {
          relationshipClass = "relationship-ally";
          relationshipText = "Ally";
        }

        const npcItem = document.createElement("div");
        npcItem.className = "npc-item";
        npcItem.innerHTML = `
                  <h3>${npc.name} (${npc.role})</h3>
                  <div class="npc-stats">
                      <span>Level ${npc.level || 1}</span>
                      ${
                        npc.stats
                          ? `
                          <span>STR:${npc.stats.str}</span>
                          <span>DEX:${npc.stats.dex}</span>
                          <span>WIS:${npc.stats.wis}</span>
                          <span>CHA:${npc.stats.cha}</span>
                      `
                          : ""
                      }
                  </div>
                  <span class="relationship-badge ${relationshipClass}">
                      ${relationshipText} (${relationship})
                  </span>
              `;
        npcsList.appendChild(npcItem);
      });
    }
  }

  // Render map
  renderMap();

  // Update action buttons based on stamina (respects encounter state)
  enableAllActionButtons();
}

function showNPCModal() {
  if (!gameState || !gameState.npcs || gameState.npcs.length === 0) {
    addMessage("No NPCs available to visit.", "error");
    return;
  }

  const npcSelection = document.getElementById("npc-selection");
  npcSelection.innerHTML = "";

  // Filter to only show NPCs that have been encountered
  const encounteredNPCs = gameState.npcs.filter(
    (npc) => npc.encountered || npc.flags?.met
  );

  if (encounteredNPCs.length === 0) {
    npcSelection.innerHTML =
      '<p style="color: var(--text-secondary); padding: 20px; text-align: center;">No NPCs encountered yet. Explore the world to meet tribal members!</p>';
    npcModal.classList.add("active");
    return;
  }

  encounteredNPCs.forEach((npc) => {
    const btn = document.createElement("button");
    btn.className = "npc-select-btn";
    const relationship = gameState.player.relationships[npc.id] || 50;
    btn.textContent = `${npc.name} (${npc.role}) - Relationship: ${relationship}`;
    btn.addEventListener("click", () => {
      executeAction("visit", npc.id);
      npcModal.classList.remove("active");
    });
    npcSelection.appendChild(btn);
  });

  npcModal.classList.add("active");
}

function addMessage(text, type = "info") {
  const messages = document.getElementById("messages");
  const message = document.createElement("div");
  message.className = `message ${type}`;
  message.textContent = text;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;

  // Auto-remove old messages (keep last 20)
  const messageElements = messages.querySelectorAll(".message");
  if (messageElements.length > 20) {
    messageElements[0].remove();
  }
}

// Map rendering functions
let mapRenderer = null;

function renderMap() {
  const mapCanvas = document.getElementById("map-canvas");
  if (!mapCanvas || !gameState) return;

  // Initialize map renderer if needed
  if (!mapRenderer) {
    mapRenderer = new MapRenderer();
  }

  // Use enhanced map renderer
  mapRenderer.renderMap(mapCanvas, gameState);
}

function getRoleEmoji(role) {
  const roleEmojis = {
    Merchant: "💰",
    Warrior: "⚔️",
    Elder: "👴",
    Hunter: "🏹",
    Farmer: "🌾",
    Mystic: "🔮",
  };
  return roleEmojis[role] || "👤";
}

async function interactWithNPCFromMap(npcId) {
  if (!userId) {
    userId = getOrCreateUserId();
  }

  try {
    const response = await fetch(`/api/game/${userId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "visit",
        npcId: npcId,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to interact with NPC");
    }

    const data = await response.json();

    // Show result message
    addMessage(data.result.message, data.result.success ? "success" : "error");

    // Show encounter if any
    if (data.result.encounter) {
      addMessage("🎯 ENCOUNTER: " + data.result.encounter.message, "event");
      if (data.result.encounter.rewards) {
        const encounterRewards = [];
        if (data.result.encounter.rewards.xp)
          encounterRewards.push(`+${data.result.encounter.rewards.xp} XP`);
        if (data.result.encounter.rewards.statBonus) {
          Object.entries(data.result.encounter.rewards.statBonus).forEach(
            ([stat, value]) => {
              encounterRewards.push(`+${value} ${stat.toUpperCase()}`);
            }
          );
        }
        if (data.result.encounter.rewards.wealth)
          encounterRewards.push(
            `+${data.result.encounter.rewards.wealth} Wealth`
          );
        if (data.result.encounter.rewards.materials)
          encounterRewards.push(
            `+${data.result.encounter.rewards.materials} Materials`
          );
        if (encounterRewards.length > 0) {
          addMessage(
            "🎁 Encounter Rewards: " + encounterRewards.join(", "),
            "success"
          );
        }
      }
    }

    // Update game state and UI
    await loadGameState();
  } catch (error) {
    addMessage("Error interacting with NPC: " + error.message, "error");
  }
}

function showEncounterWindow(animal, player) {
  const encounterWindow = document.getElementById("encounter-window");
  if (!encounterWindow) return;

  currentCombatAnimal = animal;

  // Create encounter content if it doesn't exist
  let encounterContent = encounterWindow.querySelector(".encounter-content");
  if (!encounterContent) {
    encounterContent = document.createElement("div");
    encounterContent.className = "encounter-content";
    encounterContent.innerHTML = `
      <div class="encounter-header">
        <div class="encounter-title">
          <span id="encounter-animal-icon">🐺</span>
          <span id="encounter-animal-name">Wild Animal</span>
          <span class="encounter-level" id="encounter-animal-level">Lv. 1</span>
        </div>
      </div>
      <div class="encounter-stats">
        <div class="encounter-stat">
          <div class="encounter-stat-label">STR</div>
          <div class="encounter-stat-value" id="encounter-str">0</div>
        </div>
        <div class="encounter-stat">
          <div class="encounter-stat-label">DEX</div>
          <div class="encounter-stat-value" id="encounter-dex">0</div>
        </div>
        <div class="encounter-stat">
          <div class="encounter-stat-label">DMG</div>
          <div class="encounter-stat-value" id="encounter-damage">0</div>
        </div>
      </div>
      <div class="encounter-actions">
        <button class="encounter-btn encounter-btn-fight" id="encounter-fight-btn">
          ⚔️ Fight
        </button>
        <button class="encounter-btn encounter-btn-flee" id="encounter-flee-btn">
          🏃 Flee
        </button>
      </div>
    `;
    encounterWindow.appendChild(encounterContent);

    // Add event listeners
    document
      .getElementById("encounter-fight-btn")
      .addEventListener("click", async () => {
        if (currentCombatAnimal) {
          await executeAction("explore", undefined, "fight");
        }
      });

    document
      .getElementById("encounter-flee-btn")
      .addEventListener("click", async () => {
        if (currentCombatAnimal) {
          await executeAction("explore", undefined, "flee");
        }
      });
  }

  // Update encounter info
  const animalIcons = {
    boar: "🐗",
    wolf: "🐺",
    bear: "🐻",
    panther: "🐆",
    stag: "🦌",
  };

  document.getElementById("encounter-animal-icon").textContent =
    animalIcons[animal.id] || "🐺";
  document.getElementById("encounter-animal-name").textContent = animal.name;
  document.getElementById(
    "encounter-animal-level"
  ).textContent = `Lv. ${animal.level}`;
  document.getElementById("encounter-str").textContent = animal.stats.str;
  document.getElementById("encounter-dex").textContent = animal.stats.dex;
  document.getElementById("encounter-damage").textContent = animal.damage;

  // Show encounter window
  encounterWindow.classList.add("active");
}

function hideEncounterWindow() {
  const encounterWindow = document.getElementById("encounter-window");
  if (encounterWindow) {
    encounterWindow.classList.remove("active");
  }
  currentCombatAnimal = null;
  // Re-enable action buttons when encounter is cleared
  enableAllActionButtons();
}

function disableAllActionButtons() {
  document
    .querySelectorAll(".action-btn-compact, .action-btn")
    .forEach((btn) => {
      btn.disabled = true;
    });
}

function enableAllActionButtons() {
  // Only enable if there's no active encounter
  if (!currentCombatAnimal) {
    const stamina = gameState?.stamina || 0;
    const isResting = gameState?.isResting || false;
    const restDays = gameState?.restDaysRemaining || 0;

    document
      .querySelectorAll(".action-btn-compact, .action-btn")
      .forEach((btn) => {
        const actionBtn = btn;
        const staminaCost = parseInt(actionBtn.dataset.stamina || "1");

        // Disable if resting or not enough stamina
        actionBtn.disabled = isResting || stamina < staminaCost;

        // Update stamina cost display to show if affordable
        const staminaCostEl = actionBtn.querySelector(".stamina-cost");
        if (staminaCostEl) {
          if (isResting) {
            staminaCostEl.style.color = "var(--danger-color)";
            staminaCostEl.style.opacity = "0.7";
            staminaCostEl.textContent = `💤${restDays}`;
            staminaCostEl.title = `Resting: ${restDays} day${
              restDays > 1 ? "s" : ""
            } remaining`;
          } else if (stamina < staminaCost) {
            staminaCostEl.style.color = "var(--danger-color)";
            staminaCostEl.style.opacity = "0.6";
            staminaCostEl.title = "";
            // Restore original stamina cost text
            const originalCost = actionBtn.dataset.stamina || "1";
            staminaCostEl.textContent = `⚡${originalCost}`;
          } else {
            staminaCostEl.style.color = "#fbbf24";
            staminaCostEl.style.opacity = "1";
            // Restore original stamina cost text
            const originalCost = actionBtn.dataset.stamina || "1";
            staminaCostEl.textContent = `⚡${originalCost}`;
            staminaCostEl.title = "";
          }
        }
      });
  }
}

function updateEncounterWindowWithResult(combatResult) {
  // After combat, show result briefly then hide
  const encounterWindow = document.getElementById("encounter-window");
  if (encounterWindow && encounterWindow.classList.contains("active")) {
    const encounterContent =
      encounterWindow.querySelector(".encounter-content");
    if (encounterContent) {
      const statsDiv = encounterContent.querySelector(".encounter-stats");
      if (statsDiv) {
        statsDiv.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 8px; color: ${
            combatResult.victory ? "#10b981" : "#ef4444"
          }; font-weight: 600;">
            ${combatResult.victory ? "✅ Victory!" : "❌ Defeated"}
          </div>
          <div style="grid-column: 1 / -1; text-align: center; padding: 4px; font-size: 0.7rem; color: var(--text-secondary);">
            ${combatResult.message.split("\n")[0]}
          </div>
        `;
      }
    }

    // Hide after 3 seconds
    setTimeout(() => {
      hideEncounterWindow();
    }, 3000);
  }
}

function showCombatModal(animal) {
  currentCombatAnimal = animal;
  const combatWindow = document.getElementById("combat-window");

  if (!combatWindow) return;

  // Get player data
  const player = gameState.player;

  // Update enemy info
  document.getElementById("enemy-name").textContent = animal.name;
  document.getElementById("enemy-level").textContent = `Lv. ${animal.level}`;
  document.getElementById(
    "enemy-health-text"
  ).textContent = `${animal.stats.health}/${animal.stats.maxHealth}`;
  document.getElementById("enemy-health-bar").style.width = `${
    (animal.stats.health / animal.stats.maxHealth) * 100
  }%`;
  document.getElementById("enemy-str").textContent = animal.stats.str;
  document.getElementById("enemy-dex").textContent = animal.stats.dex;
  document.getElementById("enemy-damage").textContent = animal.damage;

  // Set enemy emoji based on name
  const enemyEmojis = {
    "Wild Boar": "🐗",
    "Dire Wolf": "🐺",
    "Mountain Bear": "🐻",
    "Shadow Panther": "🐆",
    "Ancient Stag": "🦌",
  };
  const enemyEmoji = enemyEmojis[animal.name] || "🐺";
  document.getElementById("enemy-emoji").textContent = enemyEmoji;

  // Update player info
  document.getElementById("player-combat-name").textContent = player.name;
  document.getElementById(
    "player-combat-level"
  ).textContent = `Lv. ${player.level}`;
  const playerHealth = gameState.health || player.health || 100;
  const playerMaxHealth = gameState.maxHealth || player.maxHealth || 100;
  document.getElementById(
    "player-health-text"
  ).textContent = `${playerHealth}/${playerMaxHealth}`;
  document.getElementById("player-health-bar").style.width = `${
    (playerHealth / playerMaxHealth) * 100
  }%`;
  document.getElementById("player-str").textContent = player.stats.str;
  document.getElementById("player-dex").textContent = player.stats.dex;
  document.getElementById("player-luck").textContent = player.stats.luck;

  // Clear combat message
  document.getElementById(
    "combat-message"
  ).textContent = `You encounter a ${animal.name}! Choose your action...`;

  // Show combat window
  combatWindow.classList.add("active");
}

// NPCs and game config are now loaded from database on the server side
// These helper functions are no longer needed but kept for backward compatibility
function getPermanentConfig() {
  return null; // Config is loaded from database on server
}

function getPermanentNPCs() {
  return null; // NPCs are loaded from database on server
}

// Inventory Management
function updateInventory() {
  if (!gameState) return;

  const bag = gameState.bag || [];
  const equipment = gameState.equipment || {
    weapon: null,
    armor: null,
    accessory1: null,
    accessory2: null,
    accessory3: null,
  };

  // Update bag count
  const bagCountEl = document.getElementById("bag-count");
  if (bagCountEl) {
    bagCountEl.textContent = `(${bag.length}/50)`;
  }

  // Update equipment slots
  updateEquipmentSlot("weapon", equipment.weapon);
  updateEquipmentSlot("armor", equipment.armor);
  updateEquipmentSlot("accessory1", equipment.accessory1);
  updateEquipmentSlot("accessory2", equipment.accessory2);
  updateEquipmentSlot("accessory3", equipment.accessory3);

  // Update bag grid
  updateBagGrid(bag);
}

function updateEquipmentSlot(slotName, item) {
  const slotEl = document.querySelector(
    `.equipment-slot[data-slot="${slotName}"]`
  );
  const itemEl = document.getElementById(`equipped-${slotName}`);

  if (!slotEl || !itemEl) return;

  if (item) {
    slotEl.classList.add("has-item");
    slotEl.classList.add(`item-${item.rarity}`);
    itemEl.innerHTML = createItemDisplay(item, true);
    slotEl.title = item.name;
    slotEl.draggable = true;

    // Setup drag handlers for equipped items
    setupEquipmentDragHandlers(slotEl, item, slotName);
  } else {
    slotEl.classList.remove("has-item");
    slotEl.classList.remove(
      "item-common",
      "item-uncommon",
      "item-rare",
      "item-epic",
      "item-legendary"
    );
    itemEl.innerHTML = "";
    slotEl.title = getSlotLabel(slotName);
    slotEl.draggable = false;
  }
}

function setupEquipmentDragHandlers(slot, item, slotName) {
  // Remove existing handlers
  const newSlot = slot.cloneNode(true);
  slot.parentNode.replaceChild(newSlot, slot);

  const equipmentSlot = document.querySelector(
    `.equipment-slot[data-slot="${slotName}"]`
  );
  const itemEl = document.getElementById(`equipped-${slotName}`);

  // Drag start for equipped items (to unequip by dragging to bag)
  if (equipmentSlot && itemEl) {
    equipmentSlot.addEventListener("dragstart", (e) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          itemId: item.id,
          slotName: slotName,
          source: "equipment",
        })
      );
      equipmentSlot.classList.add("dragging");
    });

    equipmentSlot.addEventListener("dragend", (e) => {
      equipmentSlot.classList.remove("dragging");
      document.querySelectorAll(".bag-slot").forEach((s) => {
        s.classList.remove("drag-over");
      });
    });
  }
}

function updateBagGrid(bag) {
  const bagGrid = document.getElementById("bag-grid");
  if (!bagGrid) return;

  // Clear existing slots
  bagGrid.innerHTML = "";

  // Create 50 slots
  for (let i = 0; i < 50; i++) {
    const slot = document.createElement("div");
    slot.className = "bag-slot empty";
    slot.dataset.slotIndex = i;

    if (i < bag.length) {
      const item = bag[i];
      slot.classList.remove("empty");
      slot.classList.add(`item-${item.rarity}`);
      slot.innerHTML = createItemDisplay(item, false);
      slot.dataset.itemId = item.id;
      slot.dataset.itemType = item.type;
      slot.draggable = true;

      // Add drag handlers
      setupBagDragHandlers(slot, item, i);
    }

    bagGrid.appendChild(slot);
  }
}

function setupBagDragHandlers(slot, item, bagIndex) {
  // Drag start
  slot.addEventListener("dragstart", (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        itemId: item.id,
        itemType: item.type,
        bagIndex: bagIndex,
        source: "bag",
      })
    );
    slot.classList.add("dragging");
  });

  // Drag end
  slot.addEventListener("dragend", (e) => {
    slot.classList.remove("dragging");
    // Remove drag-over class from all slots
    document.querySelectorAll(".equipment-slot, .bag-slot").forEach((s) => {
      s.classList.remove("drag-over");
    });
  });
}

function setupBagDropHandlers(slot, slotIndex) {
  // Allow drop on empty bag slots
  slot.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    slot.classList.add("drag-over");
  });

  slot.addEventListener("dragleave", (e) => {
    slot.classList.remove("drag-over");
  });

  slot.addEventListener("drop", async (e) => {
    e.preventDefault();
    slot.classList.remove("drag-over");

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));

      if (data.source === "equipment" && data.slotName) {
        // Unequip item (it will go back to bag automatically)
        await unequipItem(data.slotName);
      }
    } catch (error) {
      console.error("Error handling bag drop:", error);
    }
  });
}

function createItemDisplay(item, isEquipment) {
  const quantity = item.quantity || 1;
  const quantityDisplay =
    item.stackable && quantity > 1
      ? `<div class="item-quantity">${quantity}</div>`
      : "";

  return `
    <div class="item-display">
      <div class="item-icon">${item.icon || "📦"}</div>
      ${quantityDisplay}
      <div class="item-tooltip">
        <div class="tooltip-name" style="color: ${getRarityColor(
          item.rarity
        )}">${item.name}</div>
        <div class="tooltip-type">${item.type} • ${item.rarity}</div>
        <div class="tooltip-description">${item.description}</div>
        ${createStatDisplay(item)}
        ${
          item.level
            ? `<div class="tooltip-level">Requires Level ${item.level}</div>`
            : ""
        }
        <div class="tooltip-actions">
          ${
            item.type === "consumable"
              ? `<button class="tooltip-action-btn" onclick="event.stopPropagation(); consumeItem('${item.id}')">Use</button>`
              : ""
          }
          ${
            !isEquipment &&
            (item.type === "weapon" ||
              item.type === "armor" ||
              item.type === "accessory")
              ? `<button class="tooltip-action-btn" onclick="event.stopPropagation(); equipItem('${item.id}')">Equip</button>`
              : ""
          }
          ${
            isEquipment
              ? `<button class="tooltip-action-btn" onclick="event.stopPropagation(); unequipItem('${getSlotFromItem(
                  item
                )}')">Unequip</button>`
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function createStatDisplay(item) {
  if (!item.stats) return "";

  const stats = [];
  if (item.stats.str) stats.push({ label: "STR", value: `+${item.stats.str}` });
  if (item.stats.dex) stats.push({ label: "DEX", value: `+${item.stats.dex}` });
  if (item.stats.wis) stats.push({ label: "WIS", value: `+${item.stats.wis}` });
  if (item.stats.cha) stats.push({ label: "CHA", value: `+${item.stats.cha}` });
  if (item.stats.luck)
    stats.push({ label: "LCK", value: `+${item.stats.luck}` });
  if (item.stats.health)
    stats.push({ label: "HP", value: `+${item.stats.health}` });
  if (item.stats.stamina)
    stats.push({ label: "STA", value: `+${item.stats.stamina}` });
  if (item.stats.damage)
    stats.push({ label: "DMG", value: `+${item.stats.damage}` });
  if (item.stats.defense)
    stats.push({ label: "DEF", value: `+${item.stats.defense}` });

  if (stats.length === 0) return "";

  return `
    <div class="tooltip-stats">
      ${stats
        .map(
          (stat) => `
        <div class="tooltip-stat">
          <span class="tooltip-stat-label">${stat.label}</span>
          <span class="tooltip-stat-value">${stat.value}</span>
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

function getRarityColor(rarity) {
  const colors = {
    common: "#9ca3af",
    uncommon: "#10b981",
    rare: "#3b82f6",
    epic: "#a855f7",
    legendary: "#f59e0b",
  };
  return colors[rarity] || colors.common;
}

function getSlotLabel(slotName) {
  const labels = {
    weapon: "Weapon",
    armor: "Armor",
    accessory1: "Accessory 1",
    accessory2: "Accessory 2",
    accessory3: "Accessory 3",
  };
  return labels[slotName] || slotName;
}

function getSlotFromItem(item) {
  if (item.type === "weapon") return "weapon";
  if (item.type === "armor") return "armor";
  if (item.type === "accessory") {
    // Find which accessory slot it's in
    const equipment = gameState?.equipment || {};
    if (equipment.accessory1?.id === item.id) return "accessory1";
    if (equipment.accessory2?.id === item.id) return "accessory2";
    if (equipment.accessory3?.id === item.id) return "accessory3";
    return "accessory1"; // Default
  }
  return "";
}

function handleItemClick(item, bagIndex) {
  // For consumables, allow click to use
  // For equipment, drag and drop is the primary method, but click can still work
  if (item.type === "consumable") {
    consumeItem(item.id);
  }
  // Equipment items are handled via drag and drop
}

async function equipItem(itemId) {
  if (!userId || !gameState) {
    if (!userId) userId = getOrCreateUserId();
    if (!gameState) return;
  }

  // Determine slot based on item type
  let slot = "";
  const bag = gameState.bag || [];
  const item = bag.find((i) => i.id === itemId);

  if (!item) {
    addMessage("Item not found in bag.", "error");
    return;
  }

  if (item.type === "weapon") slot = "weapon";
  else if (item.type === "armor") slot = "armor";
  else if (item.type === "accessory") {
    // Find first empty accessory slot
    const equipment = gameState.equipment || {};
    if (!equipment.accessory1) slot = "accessory1";
    else if (!equipment.accessory2) slot = "accessory2";
    else if (!equipment.accessory3) slot = "accessory3";
    else slot = "accessory1"; // Replace first one
  } else {
    addMessage("This item cannot be equipped.", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/game/${userId}/equip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, slot }),
    });

    const data = await response.json();

    if (data.result.success) {
      gameState = {
        ...gameState,
        bag: data.bag || [],
        equipment: data.equipment || gameState.equipment,
      };
      updateInventory();
      updateUI();
      addMessage(data.result.message, "success");
    } else {
      addMessage(data.result.message, "error");
    }
  } catch (error) {
    console.error("Error equipping item:", error);
    addMessage("Failed to equip item.", "error");
  }
}

async function unequipItem(slot) {
  if (!userId || !gameState) {
    if (!userId) userId = getOrCreateUserId();
    if (!gameState) return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/game/${userId}/unequip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot }),
    });

    const data = await response.json();

    if (data.result.success) {
      gameState = {
        ...gameState,
        bag: data.bag || [],
        equipment: data.equipment || gameState.equipment,
      };
      updateInventory();
      updateUI();
      addMessage(data.result.message, "success");
    } else {
      addMessage(data.result.message, "error");
    }
  } catch (error) {
    console.error("Error unequipping item:", error);
    addMessage("Failed to unequip item.", "error");
  }
}

async function consumeItem(itemId) {
  if (!userId || !gameState) {
    if (!userId) userId = getOrCreateUserId();
    if (!gameState) return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/game/${userId}/consume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });

    const data = await response.json();

    if (data.result.success) {
      gameState = {
        ...gameState,
        bag: data.bag || [],
        health: data.health || gameState.health,
        maxHealth: data.maxHealth || gameState.maxHealth,
        stamina: data.stamina || gameState.stamina,
        maxStamina: data.maxStamina || gameState.maxStamina,
      };
      updateInventory();
      updateUI();
      addMessage(data.result.message, "success");
    } else {
      addMessage(data.result.message, "error");
    }
  } catch (error) {
    console.error("Error consuming item:", error);
    addMessage("Failed to consume item.", "error");
  }
}

// Add click handlers for equipment slots
document.addEventListener("DOMContentLoaded", () => {
  // Equipment slot handlers will be set up after DOM is ready
  setTimeout(() => {
    document.querySelectorAll(".equipment-slot").forEach((slot) => {
      slot.addEventListener("click", (e) => {
        const slotName = slot.dataset.slot;
        const equipment = gameState?.equipment || {};
        const item = equipment[slotName];

        if (item) {
          unequipItem(slotName);
        }
      });
    });
  }, 100);
});
