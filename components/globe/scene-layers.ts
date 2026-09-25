import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Raycaster,
  SRGBColorSpace,
  Sphere,
  Vector2,
  Vector3,
} from 'three';
import type { GlobeMethods } from 'react-globe.gl';
import type { Feature, Geometry } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { geoCentroid } from 'd3-geo';
import countriesTopo from 'world-atlas/countries-110m.json';
import type { LatLng } from '@/types';

/**
 * Country borders, country names and tap picking, built directly on three.js.
 *
 * react-globe.gl's own polygon and label layers create one or two meshes per country (~850 draw calls),
 * re-triangulate every shape whenever any of their props change, and its `toGlobeCoords` raycasts every
 * one of those meshes. These replacements draw the same thing in one draw call each and pick with a
 * single ray/sphere test.
 */

/** three-globe's fixed globe radius (what `getGlobeRadius()` returns). */
const GLOBE_RADIUS = 100;
const DEG = Math.PI / 180;

const ANTARCTICA_ID = '010'; // dropped — it distorts badly at the pole

/** three-globe's lat/lng → cartesian convention, so our geometry lines up with its layers. */
function toCartesian(lat: number, lng: number, radius: number, out: Vector3): Vector3 {
  const phi = (90 - lat) * DEG;
  const theta = (90 - lng) * DEG;
  const sinPhi = Math.sin(phi);
  return out.set(radius * sinPhi * Math.cos(theta), radius * Math.cos(phi), radius * sinPhi * Math.sin(theta));
}

function getTopology(): Topology<{ countries: GeometryCollection }> {
  return countriesTopo as unknown as Topology<{ countries: GeometryCollection }>;
}

// ── Borders ────────────────────────────────────────────────────────────────

const BORDER_ALTITUDE = 0.0061;
const BORDER_STEP_DEG = 2; // segments are split along the great circle so long borders hug the surface
const BORDER_COLOR = '#94ffb2';
// Was 0.55 per polygon, but every shared border was drawn twice (once per country) and read heavier.
const BORDER_OPACITY = 0.75;

let borderPositions: Float32Array | null = null;

/** Line-segment vertex pairs for every country border and coastline, computed once per session. */
function getBorderPositions(): Float32Array {
  if (borderPositions) return borderPositions;

  const topo = getTopology();
  const land: GeometryCollection = {
    type: 'GeometryCollection',
    geometries: topo.objects.countries.geometries.filter((g) => g.id !== ANTARCTICA_ID),
  };
  // A mesh shares each border between its two countries, so it is drawn once, not twice.
  const lines = mesh(topo, land).coordinates;

  const radius = GLOBE_RADIUS * (1 + BORDER_ALTITUDE);
  const positions: number[] = [];
  const from = new Vector3();
  const to = new Vector3();
  const prev = new Vector3();
  const point = new Vector3();

  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      toCartesian(line[i - 1][1], line[i - 1][0], 1, from);
      toCartesian(line[i][1], line[i][0], 1, to);
      const angle = Math.acos(Math.min(1, Math.max(-1, from.dot(to))));
      const steps = Math.max(1, Math.ceil(angle / (BORDER_STEP_DEG * DEG)));
      const sinAngle = Math.sin(angle);

      prev.copy(from).multiplyScalar(radius);
      for (let s = 1; s <= steps; s++) {
        if (steps === 1 || sinAngle < 1e-6) {
          point.copy(to);
        } else {
          const t = s / steps;
          point.set(0, 0, 0).addScaledVector(from, Math.sin((1 - t) * angle) / sinAngle).addScaledVector(to, Math.sin(t * angle) / sinAngle);
        }
        point.multiplyScalar(radius);
        positions.push(prev.x, prev.y, prev.z, point.x, point.y, point.z);
        prev.copy(point);
      }
    }
  }

  borderPositions = Float32Array.from(positions);
  return borderPositions;
}

/** All country borders as a single draw call. */
export function createBorderLines(): LineSegments<BufferGeometry, LineBasicMaterial> {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(getBorderPositions(), 3));
  const material = new LineBasicMaterial({
    color: BORDER_COLOR,
    transparent: true,
    opacity: BORDER_OPACITY,
    depthWrite: false,
  });
  const lines = new LineSegments(geometry, material);
  lines.renderOrder = 1;
  return lines;
}

// ── Country names ──────────────────────────────────────────────────────────

export const LABEL_OPACITY = 0.68;

const LABEL_ALTITUDE = 0.005;
// Em height in degrees of arc. three-globe's bundled typeface runs ~1.4× larger than its nominal size
// (cap height ≈ 0.99 em), so its 0.9° labels correspond to ~1.25° of a normal system font.
const LABEL_SIZE_DEG = 1.25;
const LABEL_FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

// Glyph atlas: each distinct character is rasterised once, then every name is assembled from quads.
const GLYPH_PX = 96; // raster em size — stays crisp at maximum zoom
const GLYPH_PAD = 16; // transparent margin so mipmaps don't bleed neighbouring glyphs together
const ASCENT_EM = 1;
const DESCENT_EM = 0.3;
const ATLAS_WIDTH = 2048;

interface CountryLabel extends LatLng {
  text: string;
}

interface LabelData {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  atlas: HTMLCanvasElement;
}

let countryLabels: CountryLabel[] | null = null;

/** Country names, placed at each shape's centroid. */
function getCountryLabels(): CountryLabel[] {
  if (!countryLabels) {
    const topo = getTopology();
    const countries: Feature<Geometry>[] = feature(topo, topo.objects.countries).features;
    countryLabels = countries
      .filter((f) => f.id !== ANTARCTICA_ID)
      .flatMap((f) => {
        const name = f.properties?.name as string | undefined;
        if (!name) return [];
        const [lng, lat] = geoCentroid(f);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
        return [{ lat, lng, text: name }];
      });
  }
  return countryLabels;
}

let labelData: LabelData | null = null;

function buildLabelData(): LabelData | null {
  const labels = getCountryLabels();
  const font = `500 ${GLYPH_PX}px ${LABEL_FONT_FAMILY}`;

  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return null;
  measure.font = font;

  const chars = [...new Set(labels.flatMap((l) => [...l.text]))];
  const advance = new Map(chars.map((ch) => [ch, measure.measureText(ch).width]));

  // Shelf-pack the glyph cells into the atlas.
  const cellHeight = Math.ceil(GLYPH_PX * (ASCENT_EM + DESCENT_EM)) + GLYPH_PAD * 2;
  const cells = new Map<string, { x: number; y: number; w: number }>();
  let x = 0;
  let y = 0;
  for (const ch of chars) {
    if (ch.trim() === '') continue; // whitespace only advances the cursor
    const w = Math.ceil(advance.get(ch) ?? 0) + GLYPH_PAD * 2;
    if (x + w > ATLAS_WIDTH) {
      x = 0;
      y += cellHeight;
    }
    cells.set(ch, { x, y, w });
    x += w;
  }
  const atlasHeight = 2 ** Math.ceil(Math.log2(y + cellHeight));

  const atlas = document.createElement('canvas');
  atlas.width = ATLAS_WIDTH;
  atlas.height = atlasHeight;
  const ctx = atlas.getContext('2d');
  if (!ctx) return null;
  ctx.font = font;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  for (const [ch, cell] of cells) ctx.fillText(ch, cell.x + GLYPH_PAD, cell.y + GLYPH_PAD + GLYPH_PX * ASCENT_EM);

  const emWorld = LABEL_SIZE_DEG * ((2 * Math.PI * GLOBE_RADIUS) / 360);
  const scale = emWorld / GLYPH_PX; // world units per atlas pixel
  const centerShift = 0.36 * emWorld; // put the middle of the lettering (cap height ≈ 0.72 em) on the anchor
  const top = (GLYPH_PX * ASCENT_EM + GLYPH_PAD) * scale - centerShift;
  const bottom = -(GLYPH_PX * DESCENT_EM + GLYPH_PAD) * scale - centerShift;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const anchor = new Object3D();
  const corner = new Vector3();

  for (const label of labels) {
    // Same placement as three-globe's label layer: on the surface, lettering facing outward.
    toCartesian(label.lat, label.lng, GLOBE_RADIUS * (1 + LABEL_ALTITUDE), anchor.position);
    anchor.lookAt(0, 0, 0);
    anchor.rotateY(Math.PI);
    anchor.updateMatrix();

    let width = 0;
    for (const ch of label.text) width += advance.get(ch) ?? 0;
    let cursor = (-width * scale) / 2;

    for (const ch of label.text) {
      const cell = cells.get(ch);
      if (cell) {
        const left = cursor - GLYPH_PAD * scale;
        const right = left + cell.w * scale;
        const base = positions.length / 3;
        for (const [cx, cy] of [
          [left, bottom],
          [right, bottom],
          [right, top],
          [left, top],
        ]) {
          corner.set(cx, cy, 0).applyMatrix4(anchor.matrix);
          positions.push(corner.x, corner.y, corner.z);
        }
        // Half-texel inset keeps edge samples inside the cell. Canvas y runs down, texture v runs up.
        const u0 = (cell.x + 0.5) / ATLAS_WIDTH;
        const u1 = (cell.x + cell.w - 0.5) / ATLAS_WIDTH;
        const v0 = 1 - (cell.y + cellHeight - 0.5) / atlasHeight;
        const v1 = 1 - (cell.y + 0.5) / atlasHeight;
        uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      cursor += (advance.get(ch) ?? 0) * scale;
    }
  }

  return {
    positions: Float32Array.from(positions),
    uvs: Float32Array.from(uvs),
    indices: Uint32Array.from(indices),
    atlas,
  };
}

/**
 * Every country name as a single draw call, starting fully transparent (fade `material.opacity` up to
 * LABEL_OPACITY). Returns null where canvas 2D isn't available. Layout is computed once per session.
 */
export function createLabelMesh(maxAnisotropy: number): Mesh<BufferGeometry, MeshBasicMaterial> | null {
  labelData ??= buildLabelData();
  if (!labelData) return null;

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(labelData.positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(labelData.uvs, 2));
  geometry.setIndex(new BufferAttribute(labelData.indices, 1));

  const texture = new CanvasTexture(labelData.atlas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = Math.min(4, maxAnisotropy); // keeps names legible near the horizon

  const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
  const labels = new Mesh(geometry, material);
  labels.renderOrder = 2;
  return labels;
}

/** Frees the GPU resources of a layer created above. */
export function disposeLayer(layer: LineSegments<BufferGeometry, LineBasicMaterial> | Mesh<BufferGeometry, MeshBasicMaterial>): void {
  layer.geometry.dispose();
  if ('map' in layer.material) layer.material.map?.dispose();
  layer.material.dispose();
}

// ── Picking ────────────────────────────────────────────────────────────────

const raycaster = new Raycaster();
const ndc = new Vector2();
const hit = new Vector3();
const globeSphere = new Sphere(new Vector3(0, 0, 0), GLOBE_RADIUS);

/**
 * Screen point (px, relative to the canvas) → lat/lng on the globe, or null if it misses.
 * One analytic ray/sphere test through the live camera (which already includes any view offset).
 */
export function pickGlobePoint(globe: GlobeMethods, x: number, y: number, width: number, height: number): LatLng | null {
  ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
  raycaster.setFromCamera(ndc, globe.camera());
  if (!raycaster.ray.intersectSphere(globeSphere, hit)) return null;
  const { lat, lng } = globe.toGeoCoords(hit);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}
