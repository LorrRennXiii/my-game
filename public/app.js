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

  // Setup tribe info panel toggle
  setupTribeInfoPanel();

  // Setup inventory filters and sorting
  setupInventoryControls();

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
                <span>CHA: ${gameState.player.stats.cha}${
      gameState.effectiveStats
        ? ` (+${gameState.effectiveStats.cha - gameState.player.stats.cha})`
        : ""
    }</span>
                <span>LCK: ${gameState.player.stats.luck}${
      gameState.effectiveStats
        ? ` (+${gameState.effectiveStats.luck - gameState.player.stats.luck})`
        : ""
    }</span>
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

  // Update bag count (main section only)
  const bagCountMainEl = document.getElementById("bag-count-main");
  if (bagCountMainEl) {
    bagCountMainEl.textContent = `(${bag.length}/50)`;
  }

  // Update main section equipment only (left panel removed)
  updateEquipmentSlotMain("weapon", equipment.weapon);
  updateEquipmentSlotMain("armor", equipment.armor);
  updateEquipmentSlotMain("accessory1", equipment.accessory1);
  updateEquipmentSlotMain("accessory2", equipment.accessory2);
  updateEquipmentSlotMain("accessory3", equipment.accessory3);

  // Update bag grid (main section only)
  updateBagGridMain(bag);
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

    // Add right-click context menu handler for equipment
    slotEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showEquipmentContextMenu(e, item, slotName);
    });
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

    // Remove context menu handler for empty slots
    const newSlot = slotEl.cloneNode(true);
    slotEl.parentNode.replaceChild(newSlot, slotEl);
  }
}

function setupEquipmentDragHandlers(slot, item, slotName) {
  // Check if this is main section or left panel
  const isMain = slot.classList.contains("equipment-slot-main");
  const selector = isMain
    ? `.equipment-slot-main[data-slot="${slotName}"]`
    : `.equipment-slot[data-slot="${slotName}"]`;
  const itemId = isMain ? `equipped-${slotName}-main` : `equipped-${slotName}`;

  // Drag start for equipped items (to unequip by dragging to bag)
  slot.addEventListener("dragstart", (e) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        itemId: item.id,
        slotName: slotName,
        source: "equipment",
      })
    );
    slot.classList.add("dragging");
  });

  slot.addEventListener("dragend", (e) => {
    slot.classList.remove("dragging");
    document
      .querySelectorAll(
        ".equipment-slot-main, .bag-slot-main, .equipment-slot, .bag-slot"
      )
      .forEach((s) => {
        s.classList.remove("drag-over");
      });
  });
}

function updateEquipmentSlotMain(slotName, item) {
  const slotEl = document.querySelector(
    `.equipment-slot-main[data-slot="${slotName}"]`
  );
  const itemEl = document.getElementById(`equipped-${slotName}-main`);

  if (!slotEl || !itemEl) return;

  // Remove existing event listeners by cloning
  const newSlot = slotEl.cloneNode(true);
  slotEl.parentNode.replaceChild(newSlot, slotEl);
  const updatedSlot = document.querySelector(
    `.equipment-slot-main[data-slot="${slotName}"]`
  );
  const updatedItemEl = document.getElementById(`equipped-${slotName}-main`);

  if (item) {
    updatedSlot.classList.add("has-item");
    updatedSlot.classList.add(`item-${item.rarity}`);
    updatedItemEl.innerHTML = createItemDisplay(item, true);
    updatedSlot.title = item.name;
    updatedSlot.draggable = true;

    // Setup drag handlers for equipped items
    setupEquipmentDragHandlers(updatedSlot, item, slotName);

    // Add right-click context menu handler for equipment
    updatedSlot.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showEquipmentContextMenu(e, item, slotName);
    });

    // Setup drop handlers for equipment slots
    setupEquipmentDropHandlersMain(updatedSlot, slotName);
  } else {
    updatedSlot.classList.remove("has-item");
    updatedSlot.classList.remove(
      "item-common",
      "item-uncommon",
      "item-rare",
      "item-epic",
      "item-legendary"
    );
    updatedItemEl.innerHTML = "";
    updatedSlot.title = getSlotLabel(slotName);
    updatedSlot.draggable = false;

    // Setup drop handlers for empty equipment slots
    setupEquipmentDropHandlersMain(updatedSlot, slotName);
  }
}

function setupEquipmentDropHandlersMain(slot, slotName) {
  // Remove existing handlers
  const newSlot = slot.cloneNode(true);
  slot.parentNode.replaceChild(newSlot, slot);
  const updatedSlot = document.querySelector(
    `.equipment-slot-main[data-slot="${slotName}"]`
  );

  if (!updatedSlot) return;

  // Allow drop
  updatedSlot.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    updatedSlot.classList.add("drag-over");
  });

  // Remove drag-over on drag leave
  updatedSlot.addEventListener("dragleave", (e) => {
    updatedSlot.classList.remove("drag-over");
  });

  // Handle drop
  updatedSlot.addEventListener("drop", async (e) => {
    e.preventDefault();
    updatedSlot.classList.remove("drag-over");

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));

      if (data.source === "bag" && data.itemId) {
        const itemType = data.itemType;

        // Validate item can be equipped in this slot
        if (slotName === "weapon" && itemType !== "weapon") {
          addMessage(
            "This item cannot be equipped in the weapon slot.",
            "error"
          );
          return;
        }
        if (slotName === "armor" && itemType !== "armor") {
          addMessage(
            "This item cannot be equipped in the armor slot.",
            "error"
          );
          return;
        }
        if (slotName.startsWith("accessory") && itemType !== "accessory") {
          addMessage(
            "This item cannot be equipped in the accessory slot.",
            "error"
          );
          return;
        }

        // Equip the item
        await equipItem(data.itemId);
      }
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  });

  // Click to unequip
  updatedSlot.addEventListener("click", async (e) => {
    // Only unequip if not dragging and has item
    if (e.target.closest(".dragging")) return;

    const equipment = gameState?.equipment || {};
    const item = equipment[slotName];

    if (item) {
      await unequipItem(slotName);
    }
  });
}

function updateBagGrid(bag) {
  const bagGrid = document.getElementById("bag-grid");
  if (!bagGrid) return;

  // Get filter and sort values
  const filterValue =
    document.getElementById("inventory-filter")?.value || "all";
  const sortValue =
    document.getElementById("inventory-sort")?.value || "default";

  // Filter items
  let filteredBag = [...bag];
  if (filterValue !== "all") {
    filteredBag = bag.filter((item) => item.type === filterValue);
  }

  // Sort items
  filteredBag = sortItems(filteredBag, sortValue);

  // Clear existing slots
  bagGrid.innerHTML = "";

  // Create slots for filtered items (still show 50 slots total)
  const totalSlots = 50;
  for (let i = 0; i < totalSlots; i++) {
    const slot = document.createElement("div");
    slot.className = "bag-slot empty";
    slot.dataset.slotIndex = i;

    if (i < filteredBag.length) {
      const item = filteredBag[i];
      const originalIndex = bag.findIndex((b) => b.id === item.id);
      slot.classList.remove("empty");
      slot.classList.add(`item-${item.rarity}`);
      slot.innerHTML = createItemDisplay(item, false);
      slot.dataset.itemId = item.id;
      slot.dataset.itemType = item.type;
      slot.draggable = true;

      // Add drag handlers
      setupBagDragHandlers(slot, item, originalIndex >= 0 ? originalIndex : i);

      // Add right-click context menu handler
      slot.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showContextMenu(e, item, originalIndex >= 0 ? originalIndex : i);
      });

      // Add double-click handler for quick actions
      slot.addEventListener("dblclick", () => {
        handleQuickAction(item);
      });
    }

    bagGrid.appendChild(slot);
  }
}

// Diablo-style inventory grid: 10 columns x 8 rows = 80 slots
const BAG_GRID_WIDTH = 10;
const BAG_GRID_HEIGHT = 8;
const BAG_GRID_TOTAL = BAG_GRID_WIDTH * BAG_GRID_HEIGHT;

function getItemSize(item) {
  // Assign sizes based on item type (Diablo 3 style)
  if (!item.width || !item.height) {
    switch (item.type) {
      case "consumable":
      case "material":
        return { width: 1, height: 1 };
      case "weapon":
        return { width: 2, height: 1 }; // Horizontal weapons
      case "armor":
        return { width: 2, height: 2 }; // Square armor
      case "accessory":
        return { width: 1, height: 1 };
      default:
        return { width: 1, height: 1 };
    }
  }
  return { width: item.width, height: item.height };
}

function findItemPosition(bag, item, gridWidth = BAG_GRID_WIDTH) {
  const size = getItemSize(item);

  // If item already has a position, check if it's still valid
  if (item.bagPosition) {
    const { x, y } = item.bagPosition;
    if (
      canPlaceItemAt(bag, item.id, x, y, size.width, size.height, gridWidth)
    ) {
      return { x, y };
    }
  }

  // Try to find a valid position
  for (let y = 0; y <= BAG_GRID_HEIGHT - size.height; y++) {
    for (let x = 0; x <= gridWidth - size.width; x++) {
      if (
        canPlaceItemAt(bag, item.id, x, y, size.width, size.height, gridWidth)
      ) {
        return { x, y };
      }
    }
  }

  return null; // No space available
}

function canPlaceItemAt(bag, itemId, x, y, width, height, gridWidth) {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const checkX = x + dx;
      const checkY = y + dy;
      const slotIndex = checkY * gridWidth + checkX;

      if (slotIndex >= BAG_GRID_TOTAL) return false;

      // Check if this slot is occupied by another item
      const occupyingItem = bag.find((item) => {
        if (item.id === itemId) return false;
        if (!item.bagPosition) return false;
        const itemSize = getItemSize(item);
        const itemX = item.bagPosition.x;
        const itemY = item.bagPosition.y;

        return (
          checkX >= itemX &&
          checkX < itemX + itemSize.width &&
          checkY >= itemY &&
          checkY < itemY + itemSize.height
        );
      });

      if (occupyingItem) return false;
    }
  }
  return true;
}

function updateBagGridMain(bag) {
  const bagGrid = document.getElementById("bag-grid-main");
  if (!bagGrid) return;

  // Get filter value
  const filterValue =
    document.getElementById("inventory-filter-main")?.value || "all";

  // Filter items
  let filteredBag = [...bag];
  if (filterValue !== "all") {
    filteredBag = bag.filter((item) => item.type === filterValue);
  }

  // Clear existing slots
  bagGrid.innerHTML = "";

  // Create grid slots (10x8 = 80 slots)
  const grid = Array(BAG_GRID_TOTAL).fill(null);

  // Place items in grid
  filteredBag.forEach((item) => {
    const position = findItemPosition(bag, item);
    if (position) {
      item.bagPosition = position;
      const size = getItemSize(item);

      // Mark all slots occupied by this item
      for (let dy = 0; dy < size.height; dy++) {
        for (let dx = 0; dx < size.width; dx++) {
          const slotX = position.x + dx;
          const slotY = position.y + dy;
          const slotIndex = slotY * BAG_GRID_WIDTH + slotX;
          if (slotIndex < BAG_GRID_TOTAL) {
            if (!grid[slotIndex]) {
              grid[slotIndex] = { item, isFirst: dx === 0 && dy === 0 };
            }
          }
        }
      }
    }
  });

  // Render grid
  for (let i = 0; i < BAG_GRID_TOTAL; i++) {
    const slot = document.createElement("div");
    slot.className = "bag-slot-main empty";
    slot.dataset.slotIndex = i;
    slot.dataset.gridX = i % BAG_GRID_WIDTH;
    slot.dataset.gridY = Math.floor(i / BAG_GRID_WIDTH);

    const slotData = grid[i];
    if (slotData && slotData.isFirst) {
      // This is the top-left slot of an item
      const item = slotData.item;
      const size = getItemSize(item);
      const originalIndex = bag.findIndex((b) => b.id === item.id);

      slot.classList.remove("empty");
      slot.classList.add("occupied");

      // Create item element
      const itemEl = document.createElement("div");
      itemEl.className = `bag-item item-${item.rarity}`;
      itemEl.style.position = "absolute";
      itemEl.style.left = `${position.x * (100 / BAG_GRID_WIDTH)}%`;
      itemEl.style.top = `${position.y * (100 / BAG_GRID_HEIGHT)}%`;
      itemEl.style.width = `${size.width * (100 / BAG_GRID_WIDTH)}%`;
      itemEl.style.height = `${size.height * (100 / BAG_GRID_HEIGHT)}%`;
      itemEl.style.margin = "2px";
      itemEl.style.boxSizing = "border-box";
      itemEl.dataset.itemId = item.id;
      itemEl.dataset.itemType = item.type;
      itemEl.dataset.itemWidth = size.width;
      itemEl.dataset.itemHeight = size.height;
      itemEl.draggable = true;
      itemEl.title = item.name;

      itemEl.innerHTML = `
        <div class="item-icon">${item.icon || "📦"}</div>
        ${
          item.quantity && item.quantity > 1
            ? `<div class="item-quantity">${item.quantity}</div>`
            : ""
        }
      `;

      // Add drag handlers
      setupBagDragHandlers(
        itemEl,
        item,
        originalIndex >= 0 ? originalIndex : i
      );

      // Add right-click context menu handler
      itemEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showContextMenu(e, item, originalIndex >= 0 ? originalIndex : i);
      });

      // Add double-click handler for quick actions
      itemEl.addEventListener("dblclick", async () => {
        await handleQuickAction(item);
      });

      bagGrid.appendChild(itemEl);
    } else if (slotData && !slotData.isFirst) {
      // This slot is occupied but not the first slot
      slot.classList.remove("empty");
      slot.classList.add("occupied");
    } else {
      // Empty slot - setup drop handlers
      setupBagDropHandlersMain(slot, i);
    }

    bagGrid.appendChild(slot);
  }
}

function sortItems(items, sortType) {
  const sorted = [...items];

  switch (sortType) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "rarity":
      const rarityOrder = {
        legendary: 5,
        epic: 4,
        rare: 3,
        uncommon: 2,
        common: 1,
      };
      return sorted.sort(
        (a, b) => (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0)
      );
    case "value":
      return sorted.sort((a, b) => {
        const valueA = a.sellValue || calculateItemSellValue(a);
        const valueB = b.sellValue || calculateItemSellValue(b);
        return valueB - valueA;
      });
    case "type":
      return sorted.sort((a, b) => a.type.localeCompare(b.type));
    default:
      return sorted;
  }
}

async function handleQuickAction(item) {
  // Quick action: equip if equippable, use if consumable
  if (
    item.type === "weapon" ||
    item.type === "armor" ||
    item.type === "accessory"
  ) {
    await equipItem(item.id);
  } else if (item.type === "consumable") {
    await consumeItem(item.id);
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
    document
      .querySelectorAll(
        ".equipment-slot-main, .bag-slot-main, .equipment-slot, .bag-slot"
      )
      .forEach((s) => {
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

function setupBagDropHandlersMain(slot, slotIndex) {
  // Allow drop on bag slots (main section)
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

  // Get comparison stats if equippable and not already equipped
  const comparisonStats =
    !isEquipment &&
    (item.type === "weapon" ||
      item.type === "armor" ||
      item.type === "accessory")
      ? getItemComparison(item)
      : null;

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
        ${createStatDisplay(item, comparisonStats)}
        ${
          item.level
            ? `<div class="tooltip-level">Requires Level ${item.level}</div>`
            : ""
        }
        ${
          comparisonStats
            ? `<div class="tooltip-comparison">${comparisonStats}</div>`
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

function getItemComparison(item) {
  if (!gameState || !gameState.equipment) return null;

  const equipment = gameState.equipment;
  let currentItem = null;
  let slotName = "";

  if (item.type === "weapon") {
    currentItem = equipment.weapon;
    slotName = "weapon";
  } else if (item.type === "armor") {
    currentItem = equipment.armor;
    slotName = "armor";
  } else if (item.type === "accessory") {
    // Find which accessory slot to compare with (use first empty or first one)
    if (!equipment.accessory1) slotName = "accessory1";
    else if (!equipment.accessory2) slotName = "accessory2";
    else if (!equipment.accessory3) slotName = "accessory3";
    else {
      currentItem = equipment.accessory1;
      slotName = "accessory1";
    }
  }

  if (!currentItem) {
    return `<div class="comparison-new">New item - will be equipped</div>`;
  }

  const comparisons = [];
  const stats = [
    "str",
    "dex",
    "wis",
    "cha",
    "luck",
    "damage",
    "defense",
    "health",
    "stamina",
  ];

  stats.forEach((stat) => {
    const newStat = item.stats?.[stat] || 0;
    const currentStat = currentItem.stats?.[stat] || 0;
    if (newStat !== currentStat) {
      const diff = newStat - currentStat;
      const sign = diff > 0 ? "+" : "";
      const color = diff > 0 ? "#10b981" : "#ef4444";
      comparisons.push(
        `<span style="color: ${color}">${stat.toUpperCase()}: ${sign}${diff}</span>`
      );
    }
  });

  if (comparisons.length === 0) {
    return `<div class="comparison-same">Similar stats to equipped item</div>`;
  }

  return `<div class="comparison-stats">vs Equipped: ${comparisons.join(
    ", "
  )}</div>`;
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

function calculateEffectiveStats(player, equipment) {
  if (!player || !equipment) return player?.stats || {};

  const baseStats = { ...player.stats };
  const effectiveStats = { ...baseStats };

  // Add stats from equipped items
  Object.values(equipment).forEach((item) => {
    if (item && item.stats) {
      Object.keys(item.stats).forEach((stat) => {
        effectiveStats[stat] =
          (effectiveStats[stat] || 0) + (item.stats[stat] || 0);
      });
    }
  });

  return effectiveStats;
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

      // Calculate effective stats from equipment
      gameState.effectiveStats = calculateEffectiveStats(
        gameState.player,
        gameState.equipment
      );

      updateInventory();
      updateUI();

      // Show stat changes if item was equipped
      if (data.result.unequipped) {
        addMessage(
          `Equipped ${item.name}. ${data.result.unequipped.name} was unequipped.`,
          "success"
        );
      } else {
        addMessage(data.result.message, "success");
      }

      // Visual feedback animation
      showItemActionFeedback("equipped", item.name);
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

  // Find the item to get its name for feedback
  const bag = gameState.bag || [];
  const item = bag.find((i) => i.id === itemId);

  if (!item) {
    addMessage("Item not found in bag.", "error");
    return;
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

      // Visual feedback animation
      showItemActionFeedback("consumed", item.name);
    } else {
      addMessage(data.result.message, "error");
    }
  } catch (error) {
    console.error("Error consuming item:", error);
    addMessage("Failed to consume item.", "error");
  }
}

async function sellItem(itemId) {
  if (!userId || !gameState) {
    if (!userId) userId = getOrCreateUserId();
    if (!gameState) return;
  }

  const bag = gameState.bag || [];
  const item = bag.find((i) => i.id === itemId);

  if (!item) {
    addMessage("Item not found in bag.", "error");
    return;
  }

  // Calculate sell value (use sellValue if available, otherwise calculate from rarity)
  const sellValue = item.sellValue || calculateItemSellValue(item);

  if (sellValue <= 0) {
    addMessage("This item cannot be sold.", "error");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/game/${userId}/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, sellValue }),
    });

    const data = await response.json();

    if (data.result.success) {
      gameState = {
        ...gameState,
        bag: data.bag || [],
        player: data.player || gameState.player,
      };
      updateInventory();
      updateUI();
      addMessage(data.result.message, "success");

      // Visual feedback animation
      showItemActionFeedback("sold", item.name, sellValue);
    } else {
      addMessage(data.result.message, "error");
    }
  } catch (error) {
    console.error("Error selling item:", error);
    addMessage("Failed to sell item.", "error");
  }
}

function calculateItemSellValue(item) {
  const baseValues = {
    common: 5,
    uncommon: 15,
    rare: 50,
    epic: 150,
    legendary: 500,
  };

  let value = baseValues[item.rarity] || 5;

  // Add value based on stats
  if (item.stats) {
    const statValue =
      (item.stats.str || 0) +
      (item.stats.dex || 0) +
      (item.stats.wis || 0) +
      (item.stats.cha || 0) +
      (item.stats.luck || 0) +
      (item.stats.damage || 0) * 2 +
      (item.stats.defense || 0) * 2;
    value += statValue * 2;
  }

  return Math.floor(value);
}

// Context Menu Functions
let currentContextItem = null;
let currentContextItemIndex = null;
let currentContextSlot = null;
let isEquipmentContext = false;

function showContextMenu(event, item, bagIndex) {
  isEquipmentContext = false;
  currentContextSlot = null;
  const contextMenu = document.getElementById("context-menu");
  if (!contextMenu) return;

  currentContextItem = item;
  currentContextItemIndex = bagIndex;

  // Position the menu at cursor
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.style.display = "block";

  // Show/hide menu items based on item type
  const equipItem = contextMenu.querySelector('[data-action="equip"]');
  const useItem = contextMenu.querySelector('[data-action="use"]');
  const sellItemEl = contextMenu.querySelector('[data-action="sell"]');
  const infoItem = contextMenu.querySelector('[data-action="info"]');

  // Equip option - only for equippable items
  if (
    item.type === "weapon" ||
    item.type === "armor" ||
    item.type === "accessory"
  ) {
    equipItem.style.display = "flex";
  } else {
    equipItem.style.display = "none";
  }

  // Use option - only for consumables
  if (item.type === "consumable") {
    useItem.style.display = "flex";
  } else {
    useItem.style.display = "none";
  }

  // Sell option - show for all items (they all have value)
  sellItemEl.style.display = "flex";
  const sellValue = item.sellValue || calculateItemSellValue(item);
  sellItemEl.querySelector(
    ".context-text"
  ).textContent = `Sell (${sellValue}💰)`;

  // Info option - always show
  infoItem.style.display = "flex";

  // Close menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener("click", closeContextMenu, true);
    document.addEventListener("contextmenu", closeContextMenu, true);
  }, 0);
}

function showEquipmentContextMenu(event, item, slotName) {
  isEquipmentContext = true;
  currentContextItem = item;
  currentContextSlot = slotName;
  currentContextItemIndex = null;

  const contextMenu = document.getElementById("context-menu");
  if (!contextMenu) return;

  // Position the menu at cursor
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.style.display = "block";

  // Show/hide menu items for equipment
  const equipItem = contextMenu.querySelector('[data-action="equip"]');
  const useItem = contextMenu.querySelector('[data-action="use"]');
  const sellItemEl = contextMenu.querySelector('[data-action="sell"]');
  const infoItem = contextMenu.querySelector('[data-action="info"]');
  const unequipItem = contextMenu.querySelector('[data-action="unequip"]');

  // Hide equip/use/sell for equipment
  equipItem.style.display = "none";
  useItem.style.display = "none";
  sellItemEl.style.display = "none";

  // Show unequip and info
  if (!unequipItem) {
    // Add unequip option if it doesn't exist
    const divider = contextMenu.querySelector(".context-menu-divider");
    const unequipEl = document.createElement("div");
    unequipEl.className = "context-menu-item";
    unequipEl.dataset.action = "unequip";
    unequipEl.innerHTML =
      '<span class="context-icon">📦</span><span class="context-text">Unequip</span>';
    contextMenu.insertBefore(unequipEl, divider);
  } else {
    contextMenu.querySelector('[data-action="unequip"]').style.display = "flex";
  }

  infoItem.style.display = "flex";

  // Close menu when clicking elsewhere
  setTimeout(() => {
    document.addEventListener("click", closeContextMenu, true);
    document.addEventListener("contextmenu", closeContextMenu, true);
  }, 0);
}

function closeContextMenu() {
  const contextMenu = document.getElementById("context-menu");
  if (contextMenu) {
    contextMenu.style.display = "none";
  }
  document.removeEventListener("click", closeContextMenu, true);
  document.removeEventListener("contextmenu", closeContextMenu, true);
  currentContextItem = null;
  currentContextItemIndex = null;
  currentContextSlot = null;
  isEquipmentContext = false;
}

// Setup context menu event handlers
document.addEventListener("DOMContentLoaded", () => {
  const contextMenu = document.getElementById("context-menu");
  if (!contextMenu) return;

  contextMenu.addEventListener("click", async (e) => {
    e.stopPropagation();
    const menuItem = e.target.closest(".context-menu-item");
    if (!menuItem) return;

    const action = menuItem.dataset.action;
    if (!action) return;

    if (isEquipmentContext) {
      if (action === "unequip" && currentContextSlot) {
        await unequipItem(currentContextSlot);
        closeContextMenu();
        return;
      }
      if (action === "info" && currentContextItem) {
        showItemInfo(currentContextItem);
        closeContextMenu();
        return;
      }
      closeContextMenu();
      return;
    }

    if (!currentContextItem) {
      closeContextMenu();
      return;
    }

    switch (action) {
      case "equip":
        await equipItem(currentContextItem.id);
        closeContextMenu();
        break;
      case "use":
        await consumeItem(currentContextItem.id);
        closeContextMenu();
        break;
      case "sell":
        await sellItem(currentContextItem.id);
        closeContextMenu();
        break;
      case "info":
        showItemInfo(currentContextItem);
        closeContextMenu();
        break;
      default:
        closeContextMenu();
    }
  });
});

function showItemInfo(item) {
  if (!item) {
    addMessage("Item information not available.", "error");
    return;
  }

  const sellValue = item.sellValue || calculateItemSellValue(item);
  let infoText = `${item.name}\n${item.description}\n\nType: ${item.type}\nRarity: ${item.rarity}\nSell Value: ${sellValue}💰`;

  if (item.stats) {
    const stats = [];
    if (item.stats.str) stats.push(`STR: +${item.stats.str}`);
    if (item.stats.dex) stats.push(`DEX: +${item.stats.dex}`);
    if (item.stats.wis) stats.push(`WIS: +${item.stats.wis}`);
    if (item.stats.cha) stats.push(`CHA: +${item.stats.cha}`);
    if (item.stats.luck) stats.push(`LCK: +${item.stats.luck}`);
    if (item.stats.damage) stats.push(`DMG: +${item.stats.damage}`);
    if (item.stats.defense) stats.push(`DEF: +${item.stats.defense}`);
    if (item.stats.health) stats.push(`HP: +${item.stats.health}`);
    if (item.stats.stamina) stats.push(`STA: +${item.stats.stamina}`);

    if (stats.length > 0) {
      infoText += `\n\nStats:\n${stats.join("\n")}`;
    }
  }

  if (item.level) {
    infoText += `\n\nRequires Level: ${item.level}`;
  }

  // Use a better modal instead of alert
  const modal = document.createElement("div");
  modal.className = "item-info-modal";
  modal.innerHTML = `
    <div class="item-info-content">
      <div class="item-info-header">
        <h3 style="color: ${getRarityColor(item.rarity)}">${item.name}</h3>
        <button class="item-info-close" onclick="this.closest('.item-info-modal').remove()">×</button>
      </div>
      <div class="item-info-body">
        <p>${item.description}</p>
        <div class="item-info-details">
          <div><strong>Type:</strong> ${item.type}</div>
          <div><strong>Rarity:</strong> ${item.rarity}</div>
          <div><strong>Sell Value:</strong> ${sellValue}💰</div>
          ${
            item.level
              ? `<div><strong>Requires Level:</strong> ${item.level}</div>`
              : ""
          }
        </div>
        ${
          item.stats
            ? `<div class="item-info-stats">${Object.entries(item.stats)
                .filter(([k, v]) => v)
                .map(([k, v]) => `<span>${k.toUpperCase()}: +${v}</span>`)
                .join(" ")}</div>`
            : ""
        }
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Close on click outside
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Visual feedback for item actions
function showItemActionFeedback(action, itemName, value = null) {
  const feedback = document.createElement("div");
  feedback.className = `item-action-feedback feedback-${action}`;

  let message = "";
  switch (action) {
    case "equipped":
      message = `⚔️ Equipped ${itemName}`;
      break;
    case "consumed":
      message = `💊 Used ${itemName}`;
      break;
    case "sold":
      message = `💰 Sold ${itemName} (+${value}💰)`;
      break;
    default:
      message = itemName;
  }

  feedback.textContent = message;
  document.body.appendChild(feedback);

  // Animate
  setTimeout(() => {
    feedback.classList.add("show");
  }, 10);

  // Remove after animation
  setTimeout(() => {
    feedback.classList.remove("show");
    setTimeout(() => {
      feedback.remove();
    }, 300);
  }, 2000);
}

// Setup Inventory Controls (Filter and Sort)
function setupInventoryControls() {
  // Main section controls only (left panel removed)
  const filterSelectMain = document.getElementById("inventory-filter-main");
  const sortTypeBtnMain = document.getElementById("sort-type-btn-main");

  if (filterSelectMain) {
    filterSelectMain.addEventListener("change", () => {
      if (gameState && gameState.bag) {
        updateBagGridMain(gameState.bag);
      }
    });
  }

  if (sortTypeBtnMain) {
    sortTypeBtnMain.addEventListener("click", () => {
      if (gameState && gameState.bag) {
        updateBagGridMain(gameState.bag);
      }
    });
  }
}

// Setup Tribe Info Panel Toggle and Tabs
function setupTribeInfoPanel() {
  const toggleBtn = document.getElementById("tribe-info-toggle");
  const panel = document.getElementById("tribe-info-panel");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  if (!toggleBtn || !panel) return;

  // Toggle panel visibility
  toggleBtn.addEventListener("click", () => {
    const isVisible = panel.style.display !== "none";
    panel.style.display = isVisible ? "none" : "block";
    toggleBtn.querySelector(".toggle-icon").textContent = isVisible
      ? "📋"
      : "✕";
    toggleBtn.querySelector(".toggle-text").textContent = isVisible
      ? "Tribe Info"
      : "Close";
  });

  // Tab switching
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tab;

      // Remove active class from all buttons and panes
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanes.forEach((p) => p.classList.remove("active"));

      // Add active class to clicked button and corresponding pane
      btn.classList.add("active");
      const targetPane = document.getElementById(`tab-${targetTab}`);
      if (targetPane) {
        targetPane.classList.add("active");
      }
    });
  });
}

// Setup drag and drop handlers for equipment slots
function setupEquipmentDropHandlers() {
  document.querySelectorAll(".equipment-slot").forEach((slot) => {
    // Allow drop
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      slot.classList.add("drag-over");
    });

    // Remove drag-over on drag leave
    slot.addEventListener("dragleave", (e) => {
      slot.classList.remove("drag-over");
    });

    // Handle drop
    slot.addEventListener("drop", async (e) => {
      e.preventDefault();
      slot.classList.remove("drag-over");

      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));

        if (data.source === "bag" && data.itemId) {
          const slotName = slot.dataset.slot;
          const itemType = data.itemType;

          // Validate item can be equipped in this slot
          if (slotName === "weapon" && itemType !== "weapon") {
            addMessage(
              "This item cannot be equipped in the weapon slot.",
              "error"
            );
            return;
          }
          if (slotName === "armor" && itemType !== "armor") {
            addMessage(
              "This item cannot be equipped in the armor slot.",
              "error"
            );
            return;
          }
          if (slotName.startsWith("accessory") && itemType !== "accessory") {
            addMessage(
              "This item cannot be equipped in the accessory slot.",
              "error"
            );
            return;
          }

          // Equip the item
          await equipItem(data.itemId);
        }
      } catch (error) {
        console.error("Error handling drop:", error);
      }
    });

    // Click to unequip
    slot.addEventListener("click", (e) => {
      // Only unequip if not dragging
      if (e.target.closest(".dragging")) return;

      const slotName = slot.dataset.slot;
      const equipment = gameState?.equipment || {};
      const item = equipment[slotName];

      if (item) {
        unequipItem(slotName);
      }
    });
  });
}

// Setup drag and drop handlers for equipment slots on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    setupEquipmentDropHandlers();
  }, 100);
});
