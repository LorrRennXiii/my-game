// Game State
let sessionId = null;
let gameState = null;

// API Base URL
const API_BASE = "";

// DOM Elements
const startScreen = document.getElementById("start-screen");
const loadScreen = document.getElementById("load-screen");
const gameScreen = document.getElementById("game-screen");
const npcModal = document.getElementById("npc-modal");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  checkForSavedSession();
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

  // Game actions
  document.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      if (action === "visit") {
        showNPCModal();
      } else {
        executeAction(action);
      }
    });
  });

  document.getElementById("end-day-btn").addEventListener("click", endDay);
  document.getElementById("save-game-btn").addEventListener("click", saveGame);

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
  const saved = localStorage.getItem("gameSessionId");
  if (saved) {
    sessionId = saved;
    loadGameState();
  }
}

async function startNewGame() {
  const name = document.getElementById("player-name").value.trim() || "Aro";
  const tribe = document.getElementById("tribe-select").value;

  // Load permanent config and NPCs
  const permanentConfig = getPermanentConfig();
  const permanentNPCs = getPermanentNPCs();

  try {
    const response = await fetch(`${API_BASE}/api/game/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tribe, permanentConfig, permanentNPCs }),
    });

    if (!response.ok) throw new Error("Failed to create game");

    const data = await response.json();
    sessionId = data.sessionId;
    localStorage.setItem("gameSessionId", sessionId);
    gameState = data;

    showGameScreen();
    updateUI();
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
  if (!sessionId) return;

  try {
    const response = await fetch(`${API_BASE}/api/game/${sessionId}`);
    if (!response.ok) {
      if (response.status === 404) {
        localStorage.removeItem("gameSessionId");
        sessionId = null;
        return;
      }
      throw new Error("Failed to load game");
    }

    gameState = await response.json();
    showGameScreen();
    updateUI();
  } catch (error) {
    console.error("Error loading game:", error);
  }
}

async function executeAction(action, npcId = null, combatDecision = null) {
  if (!sessionId) return;

  const actionBtn = document.querySelector(`[data-action="${action}"]`);
  if (actionBtn) actionBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/api/game/${sessionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, npcId, combatDecision }),
    });

    if (!response.ok) throw new Error("Failed to execute action");

    const data = await response.json();
    gameState = data;

    // Show result message
    addMessage(data.result.message, data.result.success ? "success" : "error");

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
      // Don't update UI yet - wait for player decision
      if (actionBtn) actionBtn.disabled = false;
      return;
    } else {
      // Hide encounter window if no encounter
      hideEncounterWindow();
    }

    // Show combat result if any
    if (data.result.combatResult) {
      const combat = data.result.combatResult;
      updateEncounterWindowWithResult(combat);
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
  } catch (error) {
    addMessage("Error: " + error.message, "error");
  } finally {
    if (actionBtn) actionBtn.disabled = false;
  }
}

async function endDay() {
  if (!sessionId) return;

  try {
    const response = await fetch(`${API_BASE}/api/game/${sessionId}/end-day`, {
      method: "POST",
    });

    if (!response.ok) throw new Error("Failed to end day");

    const data = await response.json();
    gameState = data;

    addMessage(
      "✨ A new day begins! Your stamina has been restored.",
      "success"
    );

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

async function saveGame() {
  if (!sessionId) return;

  try {
    const response = await fetch(`${API_BASE}/api/game/${sessionId}/save`, {
      method: "POST",
    });

    if (!response.ok) throw new Error("Failed to save game");

    const data = await response.json();
    addMessage("✅ Game saved successfully!", "success");
  } catch (error) {
    addMessage("Error saving: " + error.message, "error");
  }
}

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
    // Load permanent config and NPCs
    const permanentConfig = getPermanentConfig();
    const permanentNPCs = getPermanentNPCs();

    const response = await fetch(`${API_BASE}/api/game/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filepath, permanentConfig, permanentNPCs }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error || "Failed to load game";
      throw new Error(errorMsg);
    }

    sessionId = data.sessionId;
    localStorage.setItem("gameSessionId", sessionId);
    gameState = data;

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
  document.getElementById("health").textContent = gameState.health || 100;
  document.getElementById("max-health").textContent =
    gameState.maxHealth || 100;

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

  // Update NPCs
  if (gameState.npcs) {
    const npcsList = document.getElementById("npcs-list");
    npcsList.innerHTML = "";

    gameState.npcs.forEach((npc) => {
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

  // Render map
  renderMap();

  // Update action buttons based on stamina
  const stamina = gameState.stamina || 0;
  document.querySelectorAll(".action-btn").forEach((btn) => {
    btn.disabled = stamina <= 0;
  });
}

function showNPCModal() {
  if (!gameState || !gameState.npcs || gameState.npcs.length === 0) {
    addMessage("No NPCs available to visit.", "error");
    return;
  }

  const npcSelection = document.getElementById("npc-selection");
  npcSelection.innerHTML = "";

  gameState.npcs.forEach((npc) => {
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
function renderMap() {
  const mapCanvas = document.getElementById("map-canvas");
  if (!mapCanvas || !gameState) return;

  mapCanvas.innerHTML = "";

  // Add location labels
  const locations = [
    { name: "Stonefang Village", x: "50%", y: "40%", left: true },
  ];

  locations.forEach((loc) => {
    const locationEl = document.createElement("div");
    locationEl.className = "map-location";
    locationEl.textContent = loc.name;
    locationEl.style.left = loc.x;
    locationEl.style.top = loc.y;
    if (loc.left) locationEl.style.transform = "translateX(-50%)";
    mapCanvas.appendChild(locationEl);
  });

  // Render NPCs
  if (gameState.npcs) {
    const encounteredNPCs = gameState.npcs.filter(
      (npc) => npc.encountered || npc.flags?.met
    );

    encounteredNPCs.forEach((npc) => {
      if (!npc.location) return;

      const marker = document.createElement("div");
      marker.className = `npc-marker ${npc.disposition.toLowerCase()}`;
      marker.style.left = `${npc.location.x}px`;
      marker.style.top = `${npc.location.y}px`;
      marker.title = `${npc.name} (${npc.role})`;

      const roleEmoji = getRoleEmoji(npc.role);
      marker.textContent = roleEmoji;

      // Tooltip
      const tooltip = document.createElement("div");
      tooltip.className = "npc-tooltip";
      const relationship = gameState.player.relationships[npc.id] || 50;
      tooltip.innerHTML = `
                <h3>${npc.name}</h3>
                <p><strong>Role:</strong> ${npc.role}</p>
                <p><strong>Level:</strong> ${npc.level || 1}</p>
                <p><strong>Disposition:</strong> ${npc.disposition}</p>
                <div class="relationship-bar">
                    <div class="relationship-fill" style="width: ${relationship}%"></div>
                </div>
                <p style="margin-top: 6px;"><strong>Relationship:</strong> ${relationship}/100</p>
            `;

      marker.addEventListener("mouseenter", (e) => {
        const rect = marker.getBoundingClientRect();
        const mapRect = mapCanvas.getBoundingClientRect();
        tooltip.style.left = `${rect.left - mapRect.left + 60}px`;
        tooltip.style.top = `${rect.top - mapRect.top - 10}px`;
        tooltip.classList.add("visible");
      });

      marker.addEventListener("mouseleave", () => {
        tooltip.classList.remove("visible");
      });

      marker.addEventListener("click", () => {
        interactWithNPCFromMap(npc.id);
      });

      mapCanvas.appendChild(marker);
      mapCanvas.appendChild(tooltip);
    });
  }
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
  if (!sessionId) return;

  try {
    const response = await fetch(`/api/game/${sessionId}/action`, {
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

// Helper function to get permanent config from localStorage
function getPermanentConfig() {
  try {
    const savedConfig = localStorage.getItem("gameMasterConfig");
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
  } catch (error) {
    console.error("Error loading permanent config:", error);
  }
  return null;
}

// Helper function to get permanent NPCs from localStorage
function getPermanentNPCs() {
  try {
    const savedNPCs = localStorage.getItem("permanentNPCs");
    if (savedNPCs) {
      return JSON.parse(savedNPCs);
    }
  } catch (error) {
    console.error("Error loading permanent NPCs:", error);
  }
  return null;
}
