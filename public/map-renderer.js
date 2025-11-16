// Map Renderer - Enhanced map with terrain and NPC graphics
class MapRenderer {
  constructor() {
    this.mapData = {
      terrain: [
        { type: 'forest', x: 10, y: 10, width: 30, height: 25 },
        { type: 'mountain', x: 60, y: 5, width: 25, height: 30 },
        { type: 'river', x: 0, y: 50, width: 100, height: 8 },
        { type: 'plains', x: 40, y: 40, width: 35, height: 35 },
        { type: 'village', x: 20, y: 35, width: 20, height: 20 },
      ],
      landmarks: [
        { name: 'Stonefang Village', x: 25, y: 42, type: 'village', tribe: 'Stonefang' },
        { name: 'Windveil Camp', x: 70, y: 45, type: 'camp', tribe: 'Windveil' },
        { name: 'Emberroot Grove', x: 15, y: 60, type: 'grove', tribe: 'Emberroot' },
        { name: 'Ancient Forest', x: 5, y: 15, type: 'forest' },
        { name: 'Mountain Peak', x: 65, y: 8, type: 'mountain' },
      ]
    };
  }

  renderMap(canvas, gameState) {
    if (!canvas || !gameState) return;
    
    canvas.innerHTML = '';
    
    // Create SVG for scalable graphics
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 800 600');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.zIndex = '1';
    
    // Render terrain
    this.renderTerrain(svg);
    
    // Render landmarks
    this.renderLandmarks(svg, gameState);
    
    // Render paths/roads
    this.renderPaths(svg);
    
    canvas.appendChild(svg);
    
    // Render NPCs on top
    this.renderNPCs(canvas, gameState);
  }

  renderTerrain(svg) {
    const terrainColors = {
      forest: { fill: '#1a3d1a', stroke: '#2d5016', glow: 'rgba(34, 197, 94, 0.3)' },
      mountain: { fill: '#3a3a4a', stroke: '#4a5568', glow: 'rgba(107, 114, 128, 0.3)' },
      river: { fill: '#1e3a5f', stroke: '#2c5282', glow: 'rgba(59, 130, 246, 0.4)' },
      plains: { fill: '#2a3a2a', stroke: '#3a4a3a', glow: 'rgba(34, 197, 94, 0.2)' },
      village: { fill: '#4a2a1a', stroke: '#744210', glow: 'rgba(245, 158, 11, 0.3)' }
    };

    this.mapData.terrain.forEach(area => {
      const terrain = terrainColors[area.type] || terrainColors.plains;
      const x = (area.x / 100) * 800;
      const y = (area.y / 100) * 600;
      const width = (area.width / 100) * 800;
      const height = (area.height / 100) * 600;
      
      // Create glow effect
      const glow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      glow.setAttribute('x', x - 5);
      glow.setAttribute('y', y - 5);
      glow.setAttribute('width', width + 10);
      glow.setAttribute('height', height + 10);
      glow.setAttribute('fill', terrain.glow);
      glow.setAttribute('opacity', '0.5');
      glow.setAttribute('rx', '8');
      glow.setAttribute('filter', 'url(#glow)');
      svg.appendChild(glow);
      
      // Main terrain shape
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
      rect.setAttribute('fill', terrain.fill);
      rect.setAttribute('stroke', terrain.stroke);
      rect.setAttribute('stroke-width', '2');
      rect.setAttribute('opacity', '0.4');
      rect.setAttribute('rx', '8');
      rect.setAttribute('ry', '8');
      svg.appendChild(rect);
      
      // Add pattern/texture
      if (area.type === 'forest') {
        // Add multiple tree icons for density
        for (let i = 0; i < 3; i++) {
          const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          icon.setAttribute('x', x + (width / 4) * (i + 1));
          icon.setAttribute('y', y + height / 2);
          icon.setAttribute('text-anchor', 'middle');
          icon.setAttribute('dominant-baseline', 'middle');
          icon.setAttribute('font-size', '32');
          icon.setAttribute('opacity', '0.5');
          icon.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))');
          icon.textContent = '🌲';
          svg.appendChild(icon);
        }
      } else if (area.type === 'mountain') {
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        icon.setAttribute('x', x + width / 2);
        icon.setAttribute('y', y + height / 2);
        icon.setAttribute('text-anchor', 'middle');
        icon.setAttribute('dominant-baseline', 'middle');
        icon.setAttribute('font-size', '48');
        icon.setAttribute('opacity', '0.5');
        icon.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))');
        icon.textContent = '⛰️';
        svg.appendChild(icon);
      } else if (area.type === 'river') {
        // Add flowing water effect
        const wave = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const wavePath = `M ${x} ${y + height/2} Q ${x + width/4} ${y + height/2 - 5} ${x + width/2} ${y + height/2} T ${x + width} ${y + height/2}`;
        wave.setAttribute('d', wavePath);
        wave.setAttribute('fill', 'none');
        wave.setAttribute('stroke', terrain.stroke);
        wave.setAttribute('stroke-width', '3');
        wave.setAttribute('opacity', '0.6');
        svg.appendChild(wave);
      }
    });
    
    // Add SVG filter for glow effects
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'glow');
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    
    const feGaussianBlur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    feGaussianBlur.setAttribute('stdDeviation', '4');
    feGaussianBlur.setAttribute('result', 'coloredBlur');
    
    const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
    const feMergeNode1 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode1.setAttribute('in', 'coloredBlur');
    const feMergeNode2 = document.createElementNS('http://www.w3.org/2000/svg', 'feMergeNode');
    feMergeNode2.setAttribute('in', 'SourceGraphic');
    
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feGaussianBlur);
    filter.appendChild(feMerge);
    defs.appendChild(filter);
    svg.appendChild(defs);
  }

  renderLandmarks(svg, gameState) {
    this.mapData.landmarks.forEach(landmark => {
      const x = (landmark.x / 100) * 800;
      const y = (landmark.y / 100) * 600;
      
      const landmarkIcon = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      landmarkIcon.setAttribute('class', 'landmark-marker');
      
      // Outer glow circle
      const glowCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      glowCircle.setAttribute('cx', x);
      glowCircle.setAttribute('cy', y);
      glowCircle.setAttribute('r', '32');
      glowCircle.setAttribute('fill', 'rgba(139, 92, 246, 0.2)');
      glowCircle.setAttribute('opacity', '0.6');
      landmarkIcon.appendChild(glowCircle);
      
      // Background circle with gradient
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', '28');
      circle.setAttribute('fill', 'rgba(139, 92, 246, 0.4)');
      circle.setAttribute('stroke', 'rgba(139, 92, 246, 0.8)');
      circle.setAttribute('stroke-width', '3');
      circle.setAttribute('filter', 'url(#glow)');
      landmarkIcon.appendChild(circle);
      
      // Inner highlight
      const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      innerCircle.setAttribute('cx', x);
      innerCircle.setAttribute('cy', y);
      innerCircle.setAttribute('r', '20');
      innerCircle.setAttribute('fill', 'rgba(139, 92, 246, 0.2)');
      landmarkIcon.appendChild(innerCircle);
      
      // Icon with shadow
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      icon.setAttribute('x', x);
      icon.setAttribute('y', y + 10);
      icon.setAttribute('text-anchor', 'middle');
      icon.setAttribute('font-size', '28');
      icon.setAttribute('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))');
      const landmarkEmojis = {
        village: '🏘️',
        camp: '⛺',
        grove: '🌳',
        forest: '🌲',
        mountain: '⛰️'
      };
      icon.textContent = landmarkEmojis[landmark.type] || '📍';
      landmarkIcon.appendChild(icon);
      
      // Label with background
      const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      labelBg.setAttribute('x', x - 60);
      labelBg.setAttribute('y', y + 50);
      labelBg.setAttribute('width', '120');
      labelBg.setAttribute('height', '20');
      labelBg.setAttribute('rx', '10');
      labelBg.setAttribute('fill', 'rgba(0, 0, 0, 0.7)');
      labelBg.setAttribute('stroke', 'rgba(139, 92, 246, 0.5)');
      labelBg.setAttribute('stroke-width', '1');
      landmarkIcon.appendChild(labelBg);
      
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', y + 63);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('fill', '#f0f0ff');
      label.setAttribute('font-weight', '700');
      label.setAttribute('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.8))');
      label.textContent = landmark.name;
      landmarkIcon.appendChild(label);
      
      svg.appendChild(landmarkIcon);
    });
  }

  renderPaths(svg) {
    // Draw paths between landmarks
    const paths = [
      { from: { x: 25, y: 42 }, to: { x: 70, y: 45 } },
      { from: { x: 25, y: 42 }, to: { x: 15, y: 60 } },
    ];

    paths.forEach(path => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', (path.from.x / 100) * 800);
      line.setAttribute('y1', (path.from.y / 100) * 600);
      line.setAttribute('x2', (path.to.x / 100) * 800);
      line.setAttribute('y2', (path.to.y / 100) * 600);
      line.setAttribute('stroke', 'rgba(139, 92, 246, 0.2)');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-dasharray', '5,5');
      svg.appendChild(line);
    });
  }

  renderNPCs(canvas, gameState) {
    if (!gameState.npcs) return;

    const encounteredNPCs = gameState.npcs.filter(
      (npc) => npc.encountered || npc.flags?.met
    );

    encounteredNPCs.forEach((npc) => {
      if (!npc.location) return;

      // Convert pixel coordinates to percentage if needed
      // NPC locations are stored as pixels (0-800 for x, 0-600 for y)
      const xPercent = npc.location.x <= 100 ? npc.location.x : (npc.location.x / 800) * 100;
      const yPercent = npc.location.y <= 100 ? npc.location.y : (npc.location.y / 600) * 100;

      // Create NPC sprite container
      const npcSprite = document.createElement('div');
      npcSprite.className = 'npc-sprite';
      npcSprite.style.left = `${xPercent}%`;
      npcSprite.style.top = `${yPercent}%`;
      npcSprite.style.zIndex = '10';
      
      // Create NPC graphic
      const npcGraphic = this.createNPCGraphic(npc);
      npcSprite.appendChild(npcGraphic);
      
      // Add level badge
      const levelBadge = document.createElement('div');
      levelBadge.className = 'npc-level-badge';
      levelBadge.textContent = `Lv.${npc.level || 1}`;
      npcSprite.appendChild(levelBadge);
      
      // Tooltip
      const tooltip = document.createElement('div');
      tooltip.className = 'npc-tooltip';
      const relationship = gameState.player.relationships[npc.id] || 50;
      tooltip.innerHTML = `
        <h3>${npc.name}</h3>
        <p><strong>Role:</strong> ${npc.role}</p>
        <p><strong>Level:</strong> ${npc.level || 1}</p>
        <p><strong>Disposition:</strong> ${npc.disposition}</p>
        <div class="relationship-bar">
          <div class="relationship-fill" style="width: ${relationship}%"></div>
        </div>
        <p><strong>Relationship:</strong> ${relationship}/100</p>
      `;

      npcSprite.addEventListener('mouseenter', (e) => {
        const rect = npcSprite.getBoundingClientRect();
        const mapRect = canvas.getBoundingClientRect();
        tooltip.style.left = `${rect.left - mapRect.left + 60}px`;
        tooltip.style.top = `${rect.top - mapRect.top - 10}px`;
        tooltip.classList.add('visible');
      });

      npcSprite.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
      });

      npcSprite.addEventListener('click', () => {
        // Call the global function if it exists, otherwise trigger NPC visit
        if (typeof interactWithNPCFromMap === 'function') {
          interactWithNPCFromMap(npc.id);
        } else if (typeof showNPCModal === 'function') {
          showNPCModal();
        }
      });

      canvas.appendChild(npcSprite);
      canvas.appendChild(tooltip);
    });
  }

  createNPCGraphic(npc) {
    const container = document.createElement('div');
    container.className = 'npc-graphic';
    
    // Role-based graphics
    const roleGraphics = {
      Merchant: { emoji: '💰', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.2)' },
      Warrior: { emoji: '⚔️', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
      Elder: { emoji: '👴', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' },
      Hunter: { emoji: '🏹', color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },
      Farmer: { emoji: '🌾', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' },
      Mystic: { emoji: '🔮', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.2)' },
    };

    const graphic = roleGraphics[npc.role] || { emoji: '👤', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.2)' };
    
    // Create sprite circle
    const spriteCircle = document.createElement('div');
    spriteCircle.className = 'npc-sprite-circle';
    spriteCircle.style.background = `radial-gradient(circle, ${graphic.bg}, transparent)`;
    spriteCircle.style.borderColor = graphic.color;
    
    // Create emoji
    const emoji = document.createElement('div');
    emoji.className = 'npc-emoji';
    emoji.textContent = graphic.emoji;
    
    spriteCircle.appendChild(emoji);
    container.appendChild(spriteCircle);
    
    // Add disposition indicator
    const dispositionIndicator = document.createElement('div');
    dispositionIndicator.className = `npc-disposition-indicator ${npc.disposition.toLowerCase()}`;
    container.appendChild(dispositionIndicator);
    
    return container;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapRenderer;
}

