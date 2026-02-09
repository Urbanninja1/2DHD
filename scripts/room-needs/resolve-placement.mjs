/**
 * Stage 3: Placement Resolver
 *
 * Converts PlacementRules to actual (x, y, z) coordinates using
 * room dimensions, feature registry, and door exclusion zones.
 */

// Y-placement constants
const Y_FLOOR = 0.005;
// Default table surface height. Override with explicit Y in array positions for specific models.
const Y_TABLE = 1.07;
const Y_WALL_MOUNT = 3.5;

/**
 * Resolve Y coordinate from yPlacement value.
 */
function resolveY(yPlacement, roomHeight) {
  if (typeof yPlacement === 'number') return yPlacement;
  switch (yPlacement) {
    case 'floor': return Y_FLOOR;
    case 'table-height': return Y_TABLE;
    case 'wall-mount': return Y_WALL_MOUNT;
    case 'ceiling': return roomHeight - 0.5;
    default:
      console.warn(`Unknown yPlacement "${yPlacement}" — defaulting to floor (y=${Y_FLOOR})`);
      return Y_FLOOR;
  }
}

/**
 * Resolve rotation from rotationY value.
 */
function resolveRotation(rotationY, position, anchor) {
  if (typeof rotationY === 'number') return rotationY;
  switch (rotationY) {
    case 'face-center':
      return Math.atan2(position.x, position.z);
    case 'face-anchor':
      if (!anchor) return 0;
      return Math.atan2(
        position.x - anchor.x,
        position.z - anchor.z,
      );
    case 'random':
      return Math.random() * Math.PI * 2;
    default:
      return 0;
  }
}

/**
 * Check if a position is within a door exclusion zone.
 */
function isInDoorZone(pos, doors) {
  for (const door of doors) {
    const dx = Math.abs(pos.x - door.position.x);
    const dz = Math.abs(pos.z - door.position.z);
    const radius = door.exclusionRadius || (door.halfExtents
      ? Math.max(door.halfExtents.x, door.halfExtents.z) + 1.0
      : 2.0);
    if (dx < radius && dz < radius) return true;
  }
  return false;
}

/**
 * Check if a position is within room bounds.
 */
function isInBounds(pos, dims, margin = 0.3) {
  const halfW = dims.width / 2 - margin;
  const halfD = dims.depth / 2 - margin;
  return Math.abs(pos.x) <= halfW && Math.abs(pos.z) <= halfD;
}

/**
 * Simple Poisson-ish disk sampling for scattered placement.
 * Weighted toward center of room.
 * minDist is auto-calculated from count and area to allow dense packing.
 */
function scatterPositions(count, dims, margin = 1.0) {
  const positions = [];
  const halfW = dims.width / 2 - margin;
  const halfD = dims.depth / 2 - margin;
  const area = (halfW * 2) * (halfD * 2);
  // Auto-scale min distance so dense counts can actually fit
  const minDist = Math.max(0.3, Math.sqrt(area / count) * 0.5);
  const maxAttempts = count * 20;
  let attempts = 0;

  while (positions.length < count && attempts < maxAttempts) {
    attempts++;
    // Gaussian-ish distribution: bias toward center but use full width for high counts
    const spread = count > 50 ? 0.95 : 0.8;
    const u1 = Math.random();
    const u2 = Math.random();
    const x = (u1 * 2 - 1) * halfW * spread;
    const z = (u2 * 2 - 1) * halfD * spread;

    // Min distance check against existing positions
    const tooClose = positions.some(p =>
      Math.hypot(p.x - x, p.z - z) < minDist
    );
    if (!tooClose) {
      positions.push({ x, z });
    }
  }

  return positions;
}

/**
 * Generate evenly spaced positions along a surface extent.
 */
function alongSurface(anchor, feature, count, spacing, doors, excludeDoors) {
  const positions = [];
  const extent = feature.extent || {};

  if (extent.zRange) {
    // Vertical surface (east/west wall) — distribute along Z
    const [zMin, zMax] = extent.zRange;
    const totalLen = zMax - zMin;
    const actualSpacing = spacing || (totalLen / (count + 1));
    const x = feature.position.x;

    for (let i = 0; i < count; i++) {
      const z = zMin + actualSpacing * (i + 1);
      const pos = { x, z };
      if (excludeDoors && isInDoorZone(pos, doors)) continue;
      positions.push(pos);
    }
  } else if (extent.xRange) {
    // Horizontal surface (north/south wall or table) — distribute along X
    const [xMin, xMax] = extent.xRange;
    const totalLen = xMax - xMin;
    const actualSpacing = spacing || (totalLen / (count + 1));
    const z = feature.position.z;

    for (let i = 0; i < count; i++) {
      const x = xMin + actualSpacing * (i + 1);
      const pos = { x, z };
      if (excludeDoors && isInDoorZone(pos, doors)) continue;
      positions.push(pos);
    }
  }

  return positions;
}

/**
 * Resolve all placements in a manifest.
 * Returns a new manifest with all items having resolved `positions` arrays.
 */
export function resolvePlacements(manifest, roomDims, doors = []) {
  const features = manifest.features || {};
  const roomHeight = roomDims.height;
  const layerNames = ['architecture', 'essentialFurnishing', 'functionalObjects', 'lifeLayer'];
  const resolved = { ...manifest, layers: { ...manifest.layers } };

  // Build door list with exclusion info
  const doorList = doors.map(d => ({
    position: d.position,
    halfExtents: d.halfExtents,
    exclusionRadius: d.exclusionRadius || (d.halfExtents
      ? Math.max(d.halfExtents.x, d.halfExtents.z) + 1.0
      : 2.0),
  }));

  for (const layerName of layerNames) {
    const items = manifest.layers[layerName] || [];
    resolved.layers[layerName] = items.map(item => {
      const p = item.placement;
      const feature = features[p.anchor] || { position: { x: 0, y: 0, z: 0 } };
      const y = resolveY(p.yPlacement, roomHeight);
      let positions;

      switch (p.strategy) {
        case 'array':
          // Pass through — Claude provided exact coordinates
          positions = (p.positions || []).map(pos => ({
            x: pos.x,
            y: pos.y ?? y,
            z: pos.z,
            rotationY: pos.rotationY ?? (typeof p.rotationY === 'number' ? p.rotationY : undefined),
          }));
          break;

        case 'at-anchor': {
          const ox = p.offset?.x || 0;
          const oy = p.offset?.y || 0;
          const oz = p.offset?.z || 0;
          const pos = {
            x: feature.position.x + ox,
            y: y + oy,
            z: feature.position.z + oz,
          };
          const rot = resolveRotation(p.rotationY, pos, feature.position);
          positions = [{ ...pos, rotationY: rot || undefined }];
          break;
        }

        case 'along-surface': {
          const count = p.count || 4;
          const rawPositions = alongSurface(
            p.anchor, feature, count, p.spacing, doorList, p.excludeDoors,
          );
          positions = rawPositions.map(pos => {
            const fullPos = { x: pos.x, y, z: pos.z };
            const rot = resolveRotation(p.rotationY, fullPos, feature.position);
            return { ...fullPos, rotationY: rot || undefined };
          });
          break;
        }

        case 'on-surface': {
          // Place on top of anchor (e.g., items on a table)
          const ox = p.offset?.x || 0;
          const oz = p.offset?.z || 0;
          const surfaceY = feature.position.y + (p.offset?.y || 0);
          const pos = {
            x: feature.position.x + ox,
            y: surfaceY,
            z: feature.position.z + oz,
          };
          const rot = resolveRotation(p.rotationY, pos, feature.position);
          positions = [{ ...pos, rotationY: rot || undefined }];
          break;
        }

        case 'scattered': {
          const roomArea = roomDims.width * roomDims.depth;
          const count = p.count || Math.max(1, Math.round((roomArea / 10) * (p.density || 1)));
          const rawPositions = scatterPositions(count, roomDims);
          positions = rawPositions.map(pos => {
            const fullPos = { x: pos.x, y, z: pos.z };
            const rot = resolveRotation(p.rotationY, fullPos, feature.position);
            return { ...fullPos, rotationY: rot || undefined };
          });
          break;
        }

        default:
          positions = [{ x: feature.position.x, y, z: feature.position.z }];
      }

      // Bounds validation
      positions = positions.filter(pos => isInBounds(pos, roomDims, 0));

      return {
        ...item,
        resolvedPositions: positions,
        ...(p.anchor ? { anchorName: p.anchor } : {}),
      };
    });
  }

  return resolved;
}
