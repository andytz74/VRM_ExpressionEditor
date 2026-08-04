import "./styles.css";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import {
  ArrowLeft,
  Camera,
  Download,
  EyeClosed,
  FolderOpen,
  GitCompare,
  Lock,
  Copy,
  Play,
  RotateCcw,
  RotateCw,
  Save,
  SlidersHorizontal,
  Unlock,
  X,
} from "lucide";

const app = document.querySelector("#app");

const BONE_GROUPS = [
  {
    label: "Body",
    bones: ["hips", "spine", "chest", "upperChest", "neck", "head", "jaw"],
  },
  {
    label: "Left Arm",
    bones: ["leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand"],
  },
  {
    label: "Right Arm",
    bones: ["rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand"],
  },
  {
    label: "Left Leg",
    bones: ["leftUpperLeg", "leftLowerLeg", "leftFoot", "leftToes"],
  },
  {
    label: "Right Leg",
    bones: ["rightUpperLeg", "rightLowerLeg", "rightFoot", "rightToes"],
  },
  {
    label: "Left Fingers",
    bones: [
      "leftThumbMetacarpal",
      "leftThumbProximal",
      "leftThumbDistal",
      "leftIndexProximal",
      "leftIndexIntermediate",
      "leftIndexDistal",
      "leftMiddleProximal",
      "leftMiddleIntermediate",
      "leftMiddleDistal",
      "leftRingProximal",
      "leftRingIntermediate",
      "leftRingDistal",
      "leftLittleProximal",
      "leftLittleIntermediate",
      "leftLittleDistal",
    ],
  },
  {
    label: "Right Fingers",
    bones: [
      "rightThumbMetacarpal",
      "rightThumbProximal",
      "rightThumbDistal",
      "rightIndexProximal",
      "rightIndexIntermediate",
      "rightIndexDistal",
      "rightMiddleProximal",
      "rightMiddleIntermediate",
      "rightMiddleDistal",
      "rightRingProximal",
      "rightRingIntermediate",
      "rightRingDistal",
      "rightLittleProximal",
      "rightLittleIntermediate",
      "rightLittleDistal",
    ],
  },
];

const HUMAN_BONES = BONE_GROUPS.flatMap((group) => group.bones);
const HUMAN_BONE_SET = new Set(HUMAN_BONES);
const POSITION_MATCH_TOLERANCE = 0.0005;
const MIRROR_AXIS_SIGNS = {
  positionOffset: [-1, 1, 1],
  rotationOffset: [1, -1, -1],
  scaleMultiplier: [1, 1, 1],
};

const DEFAULT_EMOTION_PRESET_NAMES = ["Neutral", "Focus", "Tension", "Surprise", "Joy", "Relief", "Disappointed", "Warm Smile", "Joy"];

const state = {
  mode: "expression",
  filePath: null,
  fileName: null,
  tempPath: null,
  glb: null,
  document: null,
  expressions: [],
  expressionValues: new Map(),
  expressionPresets: createDefaultEmotionPresets(),
  selectedExpressionPresetId: "emotion-0",
  selectedExpressionRangeId: null,
  decayPreviewSeconds: {},
  transitionViewer: {
    idle: [],
    transition: [],
    event: [],
    start: null,
    transitionPick: null,
    end: null,
    startBlend: 0.4,
    endBlend: 0.4,
    transitionTrim: 0,
    transitionPivot: 0,
    playing: false,
    runId: 0,
    timelineStartedAt: 0,
    timelineDuration: 0,
    timelineProgress: 0,
  },
  rorrParameters: [],
  currentParameterIds: new Set(),
  newParameterIds: new Set(),
  parameterFilterOpen: false,
  visibleParameterIds: null,
  config: {
    expressionEditor: {
      knownShapeKeys: null,
      visibleShapeKeys: null,
    },
    cameraPresets: {},
    viewer: {
      lightIntensity: 0.75,
    },
  },
  cameraSettingsOpen: null,
  cameraTransition: null,
  expressionParameterDraft: {},
  expressionParameterDirty: false,
  expressionTransition: null,
  expressionDecay: null,
  expressionDirty: false,
  draggingEmotionPresetId: null,
  editing: null,
  editDraft: null,
  dirtyEdit: false,
  hasWorkspaceChanges: false,
  confirmBack: false,
  undoStack: [],
  redoStack: [],
  transfer: {
    source: null,
    target: null,
    sourceMesh: null,
    targetMesh: null,
    report: null,
    busy: false,
  },
  correction: createEmptyCorrection(),
  correctionPath: null,
  correctionDirty: false,
  animationCatalog: {},
  selectedAnimationName: null,
  correctionAnimationTab: "play",
  animation: {
    fileName: null,
    clipName: null,
    duration: 0,
    time: 0,
    playing: false,
    loop: true,
    message: "기준 애니메이션을 불러오세요.",
  },
  selectedBone: "hips",
  correctionSteps: {
    positionOffset: 0.01,
    rotationOffset: 0.1,
    scaleMultiplier: 0.01,
  },
  boneRestTransforms: new Map(),
};

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 1.35, 3.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
keyLight.position.set(1.4, 2.2, 2.6);
scene.add(keyLight);
const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
scene.add(ambientLight);

let controls;
let currentVrm = null;
let currentUrl = null;
let animationUrl = null;
let animationMixer = null;
let animationAction = null;
let lastCorrectionBases = new Map();

const enc = new TextEncoder();
const dec = new TextDecoder();
const clock = new THREE.Clock();

function createDefaultEmotionPresets() {
  return DEFAULT_EMOTION_PRESET_NAMES.map((name, index) => ({
    id: `emotion-${index}`,
    name,
    value: 0,
    locked: false,
    isDisableBlink: false,
    parameters: {},
    rangeSlots: [],
  }));
}

async function loadEditorConfig() {
  try {
    const config = await window.vrmFiles.loadConfig();
    state.config = normalizeEditorConfig(config);
  } catch {
    state.config = normalizeEditorConfig(null);
  }
  state.transitionViewer = {
    ...state.transitionViewer,
    ...normalizeTransitionViewerConfig(state.config.transitionViewer),
    playing: false,
    runId: 0,
  };
}

function normalizeEditorConfig(config) {
  const known = config?.expressionEditor?.knownShapeKeys;
  const visible = config?.expressionEditor?.visibleShapeKeys;
  const normalizedVisible = Array.isArray(visible) ? visible.map(String) : null;
  return {
    expressionEditor: {
      knownShapeKeys: Array.isArray(known) ? known.map(String) : normalizedVisible,
      visibleShapeKeys: normalizedVisible,
    },
    cameraPresets: normalizeCameraPresets(config?.cameraPresets),
    viewer: {
      lightIntensity: clampLightIntensity(config?.viewer?.lightIntensity),
    },
    transitionViewer: normalizeTransitionViewerConfig(config?.transitionViewer),
  };
}

function createEmptyTransitionViewerConfig() {
  return {
    idle: [],
    transition: [],
    event: [],
    start: null,
    transitionPick: null,
    end: null,
    startBlend: 0.4,
    endBlend: 0.4,
    transitionTrim: 0,
    transitionPivot: 0,
  };
}

function normalizeTransitionViewerConfig(config) {
  const next = createEmptyTransitionViewerConfig();
  for (const kind of ["idle", "transition", "event"]) {
    next[kind] = Array.isArray(config?.[kind])
      ? config[kind]
          .map((slot, index) => ({
            id: String(slot?.id || `transition-slot-${kind}-${index}`),
            kind,
            fileName: String(slot?.fileName ?? ""),
          }))
          .filter((slot) => slot.fileName || slot.id)
      : [];
  }
  for (const key of ["start", "transitionPick", "end"]) {
    const pick = config?.[key];
    next[key] =
      pick && typeof pick === "object" && pick.fileName
        ? {
            id: String(pick.id ?? ""),
            kind: String(pick.kind ?? ""),
            fileName: String(pick.fileName ?? ""),
          }
        : null;
  }
  next.startBlend = Math.min(2, Math.max(0, normalizeFiniteNumber(config?.startBlend, 0.4)));
  next.endBlend = Math.min(2, Math.max(0, normalizeFiniteNumber(config?.endBlend, 0.4)));
  next.transitionTrim = Math.max(0, normalizeFiniteNumber(config?.transitionTrim, 0));
  next.transitionPivot = Math.max(0, normalizeFiniteNumber(config?.transitionPivot, 0));
  return next;
}

function normalizeCameraPresets(presets) {
  const next = {};
  for (const mode of ["transfer", "correction", "expression", "linker", "transitionViewer"]) {
    const preset = presets?.[mode];
    if (!preset || typeof preset !== "object") continue;
    next[mode] = normalizeCameraPreset(preset);
  }
  return next;
}

function normalizeCameraPreset(preset) {
  const target = Array.isArray(preset?.target) ? preset.target.map(Number) : [0, 1, 0];
  return {
    yaw: normalizeFiniteNumber(preset?.yaw, 0),
    pitch: normalizeFiniteNumber(preset?.pitch, 0),
    distance: normalizeFiniteNumber(preset?.distance, 3),
    fov: normalizeFiniteNumber(preset?.fov, 28),
    target: [normalizeFiniteNumber(target[0], 0), normalizeFiniteNumber(target[1], 1), normalizeFiniteNumber(target[2], 0)],
  };
}

function normalizeFiniteNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clampLightIntensity(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 0.75;
  return Math.min(1.5, Math.max(0.2, Math.round(next * 100) / 100));
}

function applyViewerLightIntensity(value) {
  const intensity = clampLightIntensity(value);
  keyLight.intensity = 2.4 * intensity;
  ambientLight.intensity = 1.8 * intensity;
}

function updateLightIntensity(value) {
  const intensity = clampLightIntensity(value);
  state.config = normalizeEditorConfig({
    ...state.config,
    viewer: {
      ...(state.config?.viewer ?? {}),
      lightIntensity: intensity,
    },
  });
  applyViewerLightIntensity(intensity);
  const label = document.querySelector(".viewer-light-control strong");
  if (label) label.textContent = `${Math.round(intensity * 100)}%`;
  updateEditorConfigMemory();
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpAngleDegrees(a, b, t) {
  let delta = ((b - a + 540) % 360) - 180;
  return a + delta * t;
}

async function saveEditorConfig() {
  state.config = buildCurrentEditorConfig();
  await window.vrmFiles.saveConfig(state.config);
}

function updateEditorConfigMemory() {
  state.config = buildCurrentEditorConfig();
  window.vrmFiles.updateConfigMemory?.(state.config).catch((error) => {
    console.error("Failed to update ExpressionEditorConfig.ini memory", error);
  });
}

function buildCurrentEditorConfig() {
  if (!state.rorrParameters.length) return normalizeEditorConfig(state.config);
  const visibleIds = state.visibleParameterIds instanceof Set ? state.visibleParameterIds : null;
  return normalizeEditorConfig({
    ...state.config,
    expressionEditor: {
      ...(state.config?.expressionEditor ?? {}),
      knownShapeKeys: state.rorrParameters.map((parameter) => parameter.id),
      visibleShapeKeys: state.rorrParameters
        .map((parameter) => parameter.id)
        .filter((id) => !visibleIds || visibleIds.has(id)),
    },
    cameraPresets: state.config?.cameraPresets ?? {},
    viewer: state.config?.viewer ?? {},
    transitionViewer: serializeTransitionViewerState(),
  });
}

function serializeTransitionViewerState() {
  return normalizeTransitionViewerConfig({
    idle: state.transitionViewer.idle,
    transition: state.transitionViewer.transition,
    event: state.transitionViewer.event,
    start: state.transitionViewer.start,
    transitionPick: state.transitionViewer.transitionPick,
    end: state.transitionViewer.end,
    startBlend: state.transitionViewer.startBlend,
    endBlend: state.transitionViewer.endBlend,
    transitionTrim: state.transitionViewer.transitionTrim,
    transitionPivot: state.transitionViewer.transitionPivot,
  });
}

initialize();
window.addEventListener("beforeunload", () => {
  saveEditorConfig().catch(() => {});
});

async function initialize() {
  await loadEditorConfig();
  applyViewerLightIntensity(state.config.viewer.lightIntensity);
  await refreshAnimationCatalog();
  const names = getAnimationNames();
  state.selectedAnimationName = names[0] ?? null;
  await loadSelectedAnimation();
  render();
}

function iconSvg(icon, size = 18) {
  const children = icon
    .map(([tag, attrs]) => {
      const attrText = Object.entries(attrs)
        .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
        .join(" ");
      return `<${tag} ${attrText}></${tag}>`;
    })
    .join("");
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

function dottedArrowSvg(size = 22) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12h3" />
    <path d="M10 12h3" />
    <path d="M17 12h8" />
    <path d="M20 6l6 6-6 6" />
  </svg>`;
}

function lightIconSvg(size = 16) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>`;
}

function verticalSwapSvg(size = 30) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 3v16" />
    <path d="m4 15 4 4 4-4" />
    <path d="M16 21V5" />
    <path d="m12 9 4-4 4 4" />
  </svg>`;
}

function render() {
  if (!app.innerHTML) {
    app.innerHTML = "";
  }
  const isExpressionLayout = state.mode === "expression" && !state.editing;
  const isTransitionLayout = state.mode === "transitionViewer";
  app.innerHTML = `
    <main class="app ${isExpressionLayout ? "expression-layout" : ""} ${isTransitionLayout ? "transition-layout" : ""}">
      <aside class="sidebar">
        ${
          state.mode === "correction"
            ? renderMotionCorrectionPanel()
            : state.mode === "linker"
            ? renderEmotionLinkerPanel()
            : state.mode === "transitionViewer"
            ? renderTransitionViewerPanel()
            : state.editing
              ? renderEditor()
              : renderEmotionExpressionPanel()
        }
      </aside>
      <section class="viewer">
        <div id="canvasHost"></div>
        ${renderCameraSettingsPanel()}
        ${state.filePath ? "" : renderDropHint()}
        ${renderStatusPill()}
        ${renderViewerLightControl()}
        ${state.mode === "transitionViewer" ? renderTransitionTimelineOverlay() : ""}
      </section>
      ${state.mode === "expression" && !state.editing ? renderEmotionParameterTrayWithSave() : ""}
      ${state.mode === "transitionViewer" ? renderTransitionViewerTray() : ""}
    </main>
  `;

  document.querySelector("#canvasHost")?.appendChild(renderer.domElement);
  bindUi();
  resize();
}

function renderStatusPill() {
  if (!state.filePath) return "";
  const parts = [];
  if (state.hasWorkspaceChanges) parts.push("표정 변경사항 있음");
  if (state.correctionDirty) parts.push("meta 변경사항 있음");
  if (!parts.length) parts.push("원본과 동일");
  return `<div class="status-pill">${escapeHtml(parts.join(" · "))}</div>`;
}

function renderExpressionParameterTray() {
  return `
    <aside class="expression-parameter-tray">
      <div class="parameter-tray-header">
        <h2>Parameters</h2>
        <p>VRM에서 읽어낸 조절 항목이 여기에 들어갑니다</p>
      </div>
      <div class="parameter-tray-empty">
        <p>아직 표시할 파라미터가 없습니다.</p>
      </div>
    </aside>
  `;
}

function renderViewerLightControl() {
  const value = clampLightIntensity(state.config?.viewer?.lightIntensity);
  return `
    <div class="viewer-light-control">
      <span class="viewer-light-icon" title="Light">${lightIconSvg()}</span>
      <input type="range" min="0.2" max="1.5" step="0.01" value="${roundForInput(value)}" data-light-intensity />
      <strong>${Math.round(value * 100)}%</strong>
    </div>
  `;
}

function renderEmotionParameterTray() {
  const selected = getSelectedEmotionPreset();
  const rows = state.rorrParameters.map((parameter) => {
    const value = state.expressionParameterDraft?.[parameter.id] ?? 0;
    return `
      <div class="rorr-parameter-row">
        <label title="${escapeHtml(parameter.label)}">${escapeHtml(parameter.label)}</label>
        <div class="rorr-parameter-controls">
          <input class="rorr-parameter-slider" type="range" min="0" max="1" step="0.01" value="${formatEmotionValue(value)}" data-rorr-param="${parameter.id}" />
          <input class="rorr-parameter-value" type="number" min="0" max="1" step="0.01" value="${formatEmotionValue(value)}" data-rorr-param-value="${parameter.id}" />
        </div>
      </div>
    `;
  }).join("");
  return `
    <aside class="expression-parameter-tray">
      <div class="parameter-tray-header">
        <h2>Parameters</h2>
        <p>${selected ? escapeHtml(selected.name) : "No emotion selected"}</p>
      </div>
      <div class="parameter-tray-empty">
        ${
          rows ||
          `<p>${state.filePath ? "표시할 shape key가 없습니다." : "VRM을 열면 shape key가 여기에 표시됩니다."}</p>`
        }
      </div>
    </aside>
  `;
}

function renderEmotionParameterTrayWithSave() {
  const selected = getSelectedEmotionPreset();
  const visibleIds = getVisibleParameterIdSet();
  const rows = state.rorrParameters.map((parameter) => {
    const isAvailable = state.currentParameterIds.has(parameter.id);
    const isNew = state.newParameterIds.has(parameter.id);
    const isVisible = visibleIds.has(parameter.id);
    const value = state.expressionParameterDraft?.[parameter.id] ?? 0;
    return `
      <div class="rorr-parameter-row ${isAvailable ? "" : "disabled"}" data-parameter-row="${escapeHtml(parameter.id)}" ${isVisible ? "" : "hidden"}>
        <div class="rorr-parameter-title">
          <label title="${escapeHtml(parameter.label)}">${escapeHtml(parameter.label)}</label>
          ${isNew ? `<span class="new-badge">new</span>` : ""}
        </div>
        <div class="rorr-parameter-controls">
          <input class="rorr-parameter-slider" type="range" min="0" max="1" step="0.01" value="${formatEmotionValue(value)}" data-rorr-param="${parameter.id}" ${isAvailable ? "" : "disabled"} />
          <input class="rorr-parameter-value" type="number" min="0" max="1" step="0.01" value="${formatEmotionValue(value)}" data-rorr-param-value="${parameter.id}" ${isAvailable ? "" : "disabled"} />
        </div>
      </div>
    `;
  }).join("");

  return `
    <aside class="expression-parameter-tray">
      <div class="parameter-tray-header">
        <div class="parameter-tray-title-row">
          <div>
            <h2>Parameters</h2>
            <p>${escapeHtml(getSelectedExpressionEditLabel())}</p>
          </div>
          <button class="filter-button ${state.parameterFilterOpen ? "active" : ""}" id="toggleParameterFilter" title="Filter">${iconSvg(SlidersHorizontal, 16)}</button>
        </div>
        ${state.parameterFilterOpen ? renderParameterFilterPopup() : ""}
      </div>
      <div class="parameter-tray-empty">
        ${rows || `<p>${state.filePath ? "표시할 shape key가 없습니다." : "VRM을 열면 shape key가 여기에 표시됩니다."}</p>`}
      </div>
      <div class="parameter-tray-footer">
        <div class="parameter-tray-emotion-name">${escapeHtml(getSelectedExpressionEditLabel())}</div>
        <button class="primary-button" id="saveSelectedParameters" ${selected && !selected.locked && state.expressionParameterDirty ? "" : "disabled"}>Save parameter</button>
      </div>
    </aside>
  `;
}

function renderParameterFilterPopup() {
  const visibleIds = getVisibleParameterIdSet();
  const knownIds = getKnownParameterIdSet();
  const rows = state.rorrParameters.map((parameter) => {
    const isAvailable = state.currentParameterIds.has(parameter.id);
    const isKnown = knownIds.has(parameter.id);
    const isNew = state.newParameterIds.has(parameter.id);
    const isMissing = isKnown && !isAvailable;
    return `
      <label class="parameter-filter-row ${isMissing ? "missing" : ""}">
        <input type="checkbox" value="${escapeHtml(parameter.id)}" data-parameter-filter="${escapeHtml(parameter.id)}" ${visibleIds.has(parameter.id) ? "checked" : ""} />
        <span title="${escapeHtml(parameter.label)}">${escapeHtml(parameter.label)}</span>
        ${isNew ? `<em class="new-badge">new</em>` : ""}
        ${isMissing ? `<button type="button" class="filter-remove-button" data-parameter-remove="${escapeHtml(parameter.id)}">x</button>` : ""}
      </label>
    `;
  }).join("");
  return `
    <div class="parameter-filter-popup">
      ${rows || `<p>표시할 shape key가 없습니다.</p>`}
    </div>
  `;
}

function getVisibleParameterIdSet() {
  if (!state.visibleParameterIds) {
    state.visibleParameterIds = new Set(state.rorrParameters.map((parameter) => parameter.id));
  }
  return state.visibleParameterIds;
}

function getKnownParameterIdSet() {
  const known = state.config?.expressionEditor?.knownShapeKeys;
  return new Set(Array.isArray(known) ? known.map(String) : []);
}

function applyParameterFilterFromConfig() {
  const currentParameters = state.rorrParameters;
  state.currentParameterIds = new Set(currentParameters.map((parameter) => parameter.id));
  const knownIds = getKnownParameterIdSet();
  state.newParameterIds = new Set([...state.currentParameterIds].filter((id) => !knownIds.has(id)));
  const parameterMap = new Map(currentParameters.map((parameter) => [parameter.id, parameter]));
  for (const id of knownIds) {
    if (!parameterMap.has(id)) parameterMap.set(id, { id, label: id });
  }
  state.rorrParameters = [...parameterMap.values()].sort((a, b) => a.label.localeCompare(b.label));

  const configuredVisible = state.config?.expressionEditor?.visibleShapeKeys;
  if (!Array.isArray(configuredVisible)) {
    state.visibleParameterIds = new Set(state.rorrParameters.map((parameter) => parameter.id));
    return;
  }
  const visible = new Set(configuredVisible.map(String));
  for (const id of state.currentParameterIds) {
    if (!knownIds.has(id)) visible.add(id);
  }
  state.visibleParameterIds = visible;
}

function syncParameterFilterConfigMemory() {
  state.config = buildCurrentEditorConfig();
  updateEditorConfigMemory();
}

function getModelFrameInfo() {
  if (!currentVrm?.scene) {
    return {
      center: new THREE.Vector3(0, 1, 0),
      height: 1.6,
    };
  }
  const box = new THREE.Box3().setFromObject(currentVrm.scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    center,
    height: Math.max(size.y, 1),
  };
}

function getDefaultCameraPreset(mode) {
  const { center, height } = getModelFrameInfo();
  if (mode === "expression") {
    return {
      yaw: 0,
      pitch: 0,
      distance: height * 0.72,
      fov: 22,
      target: [center.x, center.y + height * 0.62, center.z],
    };
  }
  return {
    yaw: 0,
    pitch: 0,
    distance: height * 1.65,
    fov: 28,
    target: [center.x, center.y + height * 0.1, center.z],
  };
}

function getCurrentCameraPreset() {
  const target = controls?.target ?? new THREE.Vector3(0, 1, 0);
  const offset = camera.position.clone().sub(target);
  const distance = Math.max(offset.length(), 0.001);
  const yaw = THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z));
  const pitch = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(offset.y / distance, -1, 1)));
  return {
    yaw,
    pitch,
    distance,
    fov: camera.fov,
    target: [target.x, target.y, target.z],
  };
}

function getCameraPresetForMode(mode) {
  return state.config?.cameraPresets?.[mode] ?? getDefaultCameraPreset(mode);
}

function applyCameraPresetForMode(mode) {
  transitionCameraToPreset(getCameraPresetForMode(mode), 0.5);
}

function transitionCameraToPreset(preset, duration = 0.5) {
  if (!controls || !preset) return;
  if (duration <= 0) {
    state.cameraTransition = null;
    applyCameraPreset(preset);
    return;
  }
  state.cameraTransition = {
    elapsed: 0,
    duration,
    from: getCurrentCameraPreset(),
    to: normalizeCameraPreset(preset),
  };
}

function applyCameraPreset(preset) {
  if (!controls || !preset) return;
  const normalized = normalizeCameraPreset(preset);
  const target = new THREE.Vector3(...normalized.target);
  const yaw = THREE.MathUtils.degToRad(normalized.yaw);
  const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(normalized.pitch, -80, 80));
  const distance = Math.max(normalized.distance, 0.1);
  const horizontal = Math.cos(pitch) * distance;
  camera.position.set(
    target.x + Math.sin(yaw) * horizontal,
    target.y + Math.sin(pitch) * distance,
    target.z + Math.cos(yaw) * horizontal,
  );
  controls.target.copy(target);
  camera.fov = THREE.MathUtils.clamp(normalized.fov, 10, 70);
  camera.updateProjectionMatrix();
  controls.update();
}

function updateCameraTransition(delta) {
  const transition = state.cameraTransition;
  if (!transition) return;
  transition.elapsed += delta;
  const t = Math.min(1, transition.elapsed / Math.max(transition.duration, 0.001));
  const eased = easeInOutCubic(t);
  const target = [
    lerp(transition.from.target[0], transition.to.target[0], eased),
    lerp(transition.from.target[1], transition.to.target[1], eased),
    lerp(transition.from.target[2], transition.to.target[2], eased),
  ];
  applyCameraPreset({
    yaw: lerpAngleDegrees(transition.from.yaw, transition.to.yaw, eased),
    pitch: lerp(transition.from.pitch, transition.to.pitch, eased),
    distance: lerp(transition.from.distance, transition.to.distance, eased),
    fov: lerp(transition.from.fov, transition.to.fov, eased),
    target,
  });
  if (t >= 1) state.cameraTransition = null;
}

function updateCameraSetting(key, value, source) {
  if (!state.cameraSettingsOpen || !Number.isFinite(value)) return;
  const preset = getCurrentCameraPreset();
  if (key === "yaw") preset.yaw = value;
  if (key === "pitch") preset.pitch = value;
  if (key === "distance") preset.distance = Math.max(0.1, value);
  if (key === "targetY") preset.target[1] = value;
  if (key === "fov") preset.fov = value;
  applyCameraPreset(preset);
  syncCameraSettingControls(key, value, source);
}

function syncCameraSettingControls(key, value, source) {
  const rounded = roundForInput(value);
  for (const input of document.querySelectorAll(`[data-camera-setting="${key}"], [data-camera-setting-number="${key}"]`)) {
    if (input === source) continue;
    input.value = rounded;
  }
}

async function closeCameraSettings() {
  if (!state.cameraSettingsOpen) return;
  state.config = normalizeEditorConfig({
    ...state.config,
    cameraPresets: {
      ...(state.config?.cameraPresets ?? {}),
      [state.cameraSettingsOpen]: getCurrentCameraPreset(),
    },
  });
  state.cameraSettingsOpen = null;
  await saveEditorConfig();
  render();
}

function renderModeBar(active) {
  const modes = [
    ["correction", "Motion Correction", SlidersHorizontal],
    ["expression", "Expression Editor", SlidersHorizontal],
    ["linker", "Emotion Linker", GitCompare],
    ["transitionViewer", "Transition Viewer", GitCompare],
  ];
  return `
    <div class="mode-bar">
      ${modes
        .map(
          ([mode, label, icon]) => `
            <div class="mode-row">
              <button class="mode-button ${active === mode ? "active" : ""}" data-mode="${mode}">${iconSvg(icon, 14)}${label}</button>
              <button class="camera-preset-button ${state.cameraSettingsOpen === mode ? "active" : ""}" data-camera-settings="${mode}" title="${label} camera">${iconSvg(Camera, 15)}</button>
            </div>
          `,
        )
        .join("")}
    </div>
    ${renderVrmVersionSelector()}
  `;
}

function renderCameraSettingsPanel() {
  const mode = state.cameraSettingsOpen;
  if (!mode) return "";
  const values = getCurrentCameraPreset();
  return `
    <div class="camera-settings-panel">
      <div class="camera-settings-head">
        <strong>${escapeHtml(formatModeName(mode))} Camera</strong>
        <button class="mini-button" id="closeCameraSettings">Close</button>
      </div>
      ${renderCameraRange("yaw", "Yaw", -180, 180, 1, values.yaw, "deg")}
      ${renderCameraRange("pitch", "Pitch", -80, 80, 1, values.pitch, "deg")}
      ${renderCameraRange("distance", "Distance", 0.4, 8, 0.05, values.distance, "m")}
      ${renderCameraRange("targetY", "Target Y", 0, 2.5, 0.01, values.target[1], "m")}
      ${renderCameraRange("fov", "FOV", 10, 70, 1, values.fov, "deg")}
    </div>
  `;
}

function renderCameraRange(key, label, min, max, step, value, unit) {
  return `
    <label class="camera-setting-row">
      <span>${escapeHtml(label)}</span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${roundForInput(value)}" data-camera-setting="${key}" />
      <input type="number" min="${min}" max="${max}" step="${step}" value="${roundForInput(value)}" data-camera-setting-number="${key}" />
      <em>${escapeHtml(unit)}</em>
    </label>
  `;
}

function renderEmotionExpressionPanel() {
  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Expression Editor</h1>
        <p>${state.fileName ? escapeHtml(state.fileName) : "VRM을 열고 표정 프리셋을 조정합니다"}</p>
      </div>
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
    </div>
    ${renderModeBar("expression")}
    <div class="expression-editor-panel">
      <div class="emotion-preset-list">
        ${state.expressionPresets.map((preset) => renderEmotionPresetCard(preset)).join("")}
        <button class="add-emotion-button" id="addEmotionPreset">Add New Emotion</button>
      </div>
    </div>
    <div class="expression-editor-footer">
      <button class="primary-button" id="saveExpressionMeta" ${state.correctionPath && state.expressionDirty ? "" : "disabled"}>${iconSvg(Save, 16)}Save Meta</button>
    </div>
  `;
}

function renderEmotionPresetCard(preset) {
  const selected = preset.id === state.selectedExpressionPresetId;
  const slots = normalizeExpressionRangeSlots(preset.rangeSlots);
  return `
    <div class="emotion-card ${preset.locked ? "locked" : "unlocked"} ${selected ? "selected" : ""}" data-emotion-select="${preset.id}" data-emotion-drop="${preset.id}">
      <div class="emotion-card-top">
        <button class="lock-button ${preset.locked ? "locked" : ""}" draggable="true" data-emotion-lock="${preset.id}" data-emotion-drag="${preset.id}" title="${preset.locked ? "Unlock" : "Lock"}">${iconSvg(preset.locked ? Lock : Unlock, 18)}</button>
        ${
          preset.locked
            ? `<div class="emotion-name-readonly">${escapeHtml(preset.name)}</div>`
            : `<input class="emotion-name-input" type="text" value="${escapeHtml(preset.name)}" data-emotion-name="${preset.id}" />`
        }
        <button class="blink-emotion-button ${preset.isDisableBlink ? "active" : ""}" data-emotion-blink="${preset.id}" title="Disable blink">${iconSvg(EyeClosed, 16)}</button>
        <button class="duplicate-emotion-button" data-emotion-duplicate="${preset.id}" title="Duplicate">${iconSvg(Copy, 16)}</button>
        ${preset.locked ? `<span class="delete-emotion-placeholder"></span>` : `<button class="delete-emotion-button" data-emotion-delete="${preset.id}" title="Delete">${iconSvg(X, 18)}</button>`}
      </div>
      <div class="emotion-card-controls">
        <div class="emotion-slider-wrap">
          <input class="emotion-slider" type="range" min="0" max="1" step="0.01" value="${formatEmotionValue(preset.value)}" data-emotion-slider="${preset.id}" />
          <div class="emotion-range-markers">
            ${slots.map((slot, index) => renderEmotionRangeMarker(slot, index)).join("")}
          </div>
        </div>
        <input class="emotion-value-input" type="number" min="0" max="1" step="0.01" value="${formatEmotionValue(preset.value)}" data-emotion-value="${preset.id}" />
      </div>
      ${selected ? renderEmotionRangeSlotList(preset, slots) : ""}
    </div>
  `;
}

function renderEmotionRangeMarker(slot, index) {
  const left = clampEmotionValue(slot.threshold) * 100;
  return `
    <button class="emotion-range-marker ${state.selectedExpressionRangeId === slot.id ? "selected" : ""}" style="left: ${left}%;" data-emotion-range-select="${slot.id}" title="${formatEmotionValue(slot.threshold)}">
      <span></span>
      <em>${index + 1}</em>
    </button>
  `;
}

function renderEmotionRangeSlotList(preset, slots) {
  return `
    <div class="emotion-range-slot-list">
      ${slots
        .map(
          (slot, index) => `
            <div class="emotion-range-slot ${state.selectedExpressionRangeId === slot.id ? "selected" : ""}" data-emotion-range-select="${slot.id}">
              <button class="emotion-range-number" data-emotion-range-jump="${slot.id}" title="Move slider to subslot">${index + 1}</button>
              <div class="emotion-range-value" data-emotion-range-drag="${slot.id}">${formatEmotionValue(slot.threshold)}</div>
              <button class="range-init-button" data-emotion-range-sample="${slot.id}" ${preset.locked ? "disabled" : ""} title="Sample initial parameters">${iconSvg(RotateCcw, 15)}</button>
              <button class="delete-emotion-button compact-delete" data-emotion-range-delete="${slot.id}" ${preset.locked ? "disabled" : ""} title="Delete range">${iconSvg(X, 16)}</button>
            </div>
          `,
        )
        .join("")}
      <button class="add-emotion-range-button" data-emotion-range-add="${preset.id}" ${preset.locked || slots.length >= 5 ? "disabled" : ""}>+</button>
    </div>
  `;
}

function renderVrmVersionSelector() {
  const version = state.correction.vrm.version ?? "";
  return `
    <div class="vrm-version-row">
      <span>This VRM version is</span>
      <label>
        <input type="radio" name="vrmVersion" value="1.0" ${version === "1.0" ? "checked" : ""} ${state.filePath ? "" : "disabled"} />
        v1.0
      </label>
      <label>
        <input type="radio" name="vrmVersion" value="0.0" ${version === "0.0" ? "checked" : ""} ${state.filePath ? "" : "disabled"} />
        v0.0
      </label>
    </div>
  `;
}

function renderLegacyExpressionPanel() {
  const rows = state.expressions
    .map((expression) => {
      const value = state.expressionValues.get(expression.id) ?? 0;
      return `
        <div class="expression-row">
          <div class="row-top">
            <div class="name" title="${escapeHtml(expression.name)}">${escapeHtml(expression.name)}</div>
            <button class="mini-button" data-edit="${expression.id}">Edit</button>
          </div>
          <div class="slider-line">
            <input type="range" min="0" max="1" step="0.01" value="${value}" data-expression-slider="${expression.id}" />
            <div class="value">${Math.round(value * 100)}%</div>
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>VRM Expression Editor</h1>
        <p>${state.fileName ? escapeHtml(state.fileName) : "VRM 파일을 열어주세요"}</p>
      </div>
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
    </div>
    ${renderModeBar("expression")}
    <div class="expression-list">
      ${
        state.expressions.length
          ? rows
          : `<p class="empty-text">표정 목록이 여기에 표시됩니다.</p>`
      }
    </div>
    <div class="sidebar-footer">
      <button class="secondary-button" id="undo" title="Ctrl+Z" ${state.undoStack.length ? "" : "disabled"}>${iconSvg(RotateCcw, 16)}Undo</button>
      <button class="secondary-button" id="redo" title="Ctrl+Shift+Z" ${state.redoStack.length ? "" : "disabled"}>${iconSvg(RotateCw, 16)}Redo</button>
      <button class="primary-button" id="commitAll" ${state.hasWorkspaceChanges ? "" : "disabled"}>${iconSvg(Download, 16)}변경사항 모두 저장</button>
    </div>
  `;
}

function renderExpressionPanel() {
  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Expression Editor</h1>
        <p>${state.fileName ? escapeHtml(state.fileName) : "VRM을 열고 표정 프리셋을 조정합니다"}</p>
      </div>
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
    </div>
    ${renderModeBar("expression")}
    <div class="expression-editor-panel">
      <div class="expression-name-card">
        <label>
          Emotion Name
          <input type="text" placeholder="joy, sad, angry..." />
        </label>
      </div>
      <div class="expression-template-list">
        ${EXPRESSION_EDITOR_CONTROLS.map(
          (name, index) => `
            <div class="expression-template-card">
              <label for="expressionTemplate${index}">${escapeHtml(name)}</label>
              <input id="expressionTemplate${index}" type="range" min="0" max="1" step="0.01" value="0" data-expression-template-slider />
            </div>
          `,
        ).join("")}
      </div>
    </div>
  `;
}

function renderTransferPanel() {
  const source = state.transfer.source;
  const target = state.transfer.target;
  const report = state.transfer.report;

  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Shape Key Transfer</h1>
        <p>Copy Face shape keys from A to B</p>
      </div>
    </div>
    ${renderModeBar("transfer")}
    <div class="transfer-panel">
      <div class="transfer-card">
        <div class="row-top">
          <div class="name">A: edited source</div>
          <button class="mini-button" id="openTransferSource">Open</button>
        </div>
        <p class="muted">${source ? escapeHtml(source.name) : "Shape keys already edited"}</p>
        ${
          source
            ? `<select id="sourceFaceMesh">${renderMeshOptions(source.faceMeshes, state.transfer.sourceMesh)}</select>
               <p class="parameter-meta">${describeMesh(source.faceMeshes, state.transfer.sourceMesh)}</p>`
            : ""
        }
      </div>
      <div class="transfer-card">
        <div class="row-top">
          <div class="name">B: target VRM</div>
          <button class="mini-button" id="openTransferTarget">Open</button>
        </div>
        <p class="muted">${target ? escapeHtml(target.name) : "VRM to receive A shape keys"}</p>
        ${
          target
            ? `<select id="targetFaceMesh">${renderMeshOptions(target.faceMeshes, state.transfer.targetMesh)}</select>
               <p class="parameter-meta">${describeMesh(target.faceMeshes, state.transfer.targetMesh)}</p>`
            : ""
        }
      </div>
      <button class="secondary-button" id="checkTransfer" ${source && target ? "" : "disabled"}>Check</button>
      ${report ? renderTransferReport(report) : ""}
    </div>
    <div class="sidebar-footer">
      <button class="primary-button" id="applyTransfer" ${report?.ok && !state.transfer.busy ? "" : "disabled"}>${iconSvg(Save, 16)}Apply to B</button>
    </div>
  `;
}

function renderMeshOptions(meshes, selected) {
  return meshes
    .map(
      (mesh) =>
        `<option value="${mesh.index}" ${mesh.index === selected ? "selected" : ""}>${escapeHtml(mesh.label)} (#${mesh.index}, ${mesh.vertexCount}v)</option>`,
    )
    .join("");
}

function describeMesh(meshes, selected) {
  const mesh = meshes?.find((item) => item.index === selected);
  if (!mesh) return "Face mesh candidate not found.";
  return `${mesh.vertexCount} total vertices, ${mesh.morphVertexCount} morph vertices, ${mesh.targetCount} shape keys, ${mesh.primitiveCount} primitives. Nodes: ${mesh.nodeNames.join(", ") || "none"}. Materials: ${mesh.materialNames.join(", ") || "none"}`;
}

function renderTransferReport(report) {
  const details = report.messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("");
  return `
    <div class="transfer-report ${report.ok ? "ok" : "bad"}">
      <div class="name">${report.ok ? "Ready" : "Not ready"}</div>
      <ul>${details}</ul>
    </div>
  `;
}

function renderMotionCorrectionPanel() {
  const correction = state.correction;
  const animationNames = getAnimationNames();
  const selectedAnimation = getSelectedAnimationEntry();
  const selected = getSelectedCorrection();
  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Motion Correction</h1>
        <p>${state.correctionPath ? escapeHtml(fileNameFromPath(state.correctionPath)) : "VRM을 열면 meta를 자동 생성합니다"}</p>
      </div>
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
    </div>
    ${renderModeBar("correction")}
    <div class="correction-panel">
      <div class="correction-card">
        <label>
          Character ID
          <input type="text" value="${escapeHtml(correction.vrm.characterId)}" data-correction-meta="id" />
        </label>
        <label>
          Display Name
          <input type="text" value="${escapeHtml(correction.vrm.displayName)}" data-correction-meta="name" />
        </label>
      </div>
      <div class="correction-card animation-card ${state.correctionAnimationTab === "files" ? "files" : "play"}">
        <div class="animation-card-tabs">
          <button class="${state.correctionAnimationTab === "files" ? "active" : ""}" data-correction-animation-tab="files">File List</button>
          <button class="${state.correctionAnimationTab === "play" ? "active" : ""}" data-correction-animation-tab="play">Animation Play</button>
        </div>
        ${renderAnimationFileList(animationNames)}
        <div class="animation-toolbar">
          <button class="secondary-button" id="addAnimation">New Ani</button>
          <button class="icon-button compact" id="prevAnimation" ${animationNames.length ? "" : "disabled"} title="Previous animation">&lt;</button>
          <button class="icon-button compact" id="nextAnimation" ${animationNames.length ? "" : "disabled"} title="Next animation">&gt;</button>
          <button class="icon-button compact danger-compact" id="deleteAnimation" ${selectedAnimation ? "" : "disabled"} title="Delete animation">x</button>
        </div>
        <label>
          Ani Name
          <input type="text" value="${escapeHtml(state.selectedAnimationName ?? "")}" readonly />
        </label>
        <div class="animation-description-line">
          <label>
            설명
            <input type="text" value="${escapeHtml(selectedAnimation?.description ?? "")}" data-animation-description ${selectedAnimation ? "" : "disabled"} />
          </label>
          <button class="warning-toggle ${selectedAnimation?.mustWatchFull ? "active" : ""}" id="toggleMustWatch" ${selectedAnimation ? "" : "disabled"} title="끝까지 확인할 애니메이션 표시">!</button>
        </div>
        <p class="parameter-meta">${escapeHtml(state.animation.fileName ? `${state.animation.fileName}${state.animation.clipName ? ` / ${state.animation.clipName}` : ""}` : state.animation.message)}</p>
        <div class="animation-controls">
          <button class="secondary-button" id="toggleAnimation" ${animationAction ? "" : "disabled"}>${state.animation.playing ? "Pause" : "Play"}</button>
          <button class="secondary-button" id="restartAnimation" ${animationAction ? "" : "disabled"}>Restart</button>
          <div class="animation-time">${formatAnimationTime(state.animation.time)} / ${formatAnimationTime(state.animation.duration)}</div>
        </div>
        <input class="animation-scrub" type="range" min="0" max="${Math.max(state.animation.duration, 0.001)}" step="0.01" value="${state.animation.time}" data-animation-time ${animationAction ? "" : "disabled"} />
      </div>
      ${
        selectedAnimation && currentVrm
          ? `
            <div class="correction-card">
              <div class="row-top">
                <div class="name">Target Bone</div>
                <button class="mini-button" id="resetBoneCorrection">Reset</button>
              </div>
              <select id="selectedBone">${renderBoneOptions()}</select>
              <p class="parameter-meta">${getBoneAvailabilityText(state.selectedBone)}</p>
            </div>
            ${renderCorrectionVector("positionOffset", "Position Offset", selected.positionOffset, -0.5, 0.5, 0.001, "m")}
            ${renderCorrectionVector("rotationOffset", "Rotation Offset", selected.rotationOffset, -45, 45, 0.1, "deg")}
            ${renderCorrectionVector("scaleMultiplier", "Scale Multiplier", selected.scaleMultiplier, 0.5, 1.5, 0.001, "x")}
          `
          : `<div class="correction-card"><p class="parameter-meta">${selectedAnimation ? "VRM을 열면 이 애니메이션의 관절 보정을 편집할 수 있습니다." : "New Ani로 검수할 애니메이션을 먼저 등록하세요."}</p></div>`
      }
    </div>
    <div class="correction-footer">
      <button class="primary-button" id="saveCorrection" ${state.correctionPath && state.correctionDirty ? "" : "disabled"}>${iconSvg(Save, 16)}Save Meta</button>
    </div>
  `;
}

function renderAnimationFileList(animationNames) {
  return `
    <div class="animation-file-list">
      ${
        animationNames.length
          ? animationNames.map((name) => renderAnimationFileItem(name)).join("")
          : `<p class="parameter-meta">New Ani로 애니메이션을 먼저 등록하세요.</p>`
      }
    </div>
  `;
}

function renderAnimationFileItem(animationName) {
  const entry = state.animationCatalog?.[animationName] ?? {};
  const selected = animationName === state.selectedAnimationName;
  const description = String(entry.description ?? "").trim();
  return `
    <button class="animation-file-item ${selected ? "selected" : ""}" data-animation-file-select="${escapeHtml(animationName)}">
      <strong>${escapeHtml(getAnimationDisplayName(animationName))}</strong>
      <span>${escapeHtml(description || "-")}</span>
    </button>
  `;
}

function renderEmotionLinkerPanel() {
  const animationNames = getAnimationNames();
  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Emotion Linker</h1>
        <p>${state.correctionPath ? escapeHtml(fileNameFromPath(state.correctionPath)) : "VRM을 열면 연결 정보를 meta에 저장합니다"}</p>
      </div>
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
    </div>
    ${renderModeBar("linker")}
    <div class="emotion-linker-panel">
      ${
        animationNames.length
          ? animationNames.map((name) => renderEmotionLinkerCard(name)).join("")
          : `<div class="correction-card"><p class="parameter-meta">Motion Correction에서 New Ani로 애니메이션을 먼저 등록하세요.</p></div>`
      }
    </div>
    <div class="correction-footer">
      <button class="primary-button" id="saveCorrection" ${state.correctionPath && state.correctionDirty ? "" : "disabled"}>${iconSvg(Save, 16)}Save Meta</button>
    </div>
  `;
}

function renderEmotionLinkerCard(animationName) {
  const catalogEntry = state.animationCatalog?.[animationName] ?? {};
  const metaEntry = getAnimationMetaEntry(animationName);
  const presetId = metaEntry.expressionPresetId ?? "";
  const linkedPreset = state.expressionPresets.find((preset) => preset.id === presetId);
  const hasDecayControls = normalizeExpressionRangeSlots(linkedPreset?.rangeSlots).length > 0;
  const decaySeconds = getAnimationPreviewDecaySeconds(animationName);
  return `
    <div class="emotion-link-card">
      <div class="emotion-link-readonly">${escapeHtml(animationName)}</div>
      <div class="emotion-link-readonly">${escapeHtml(catalogEntry.description ?? "")}</div>
      <select class="emotion-link-select" data-link-expression="${escapeHtml(animationName)}">
        <option value="">표정 프리셋 이름</option>
        ${state.expressionPresets
          .map(
            (preset) =>
              `<option value="${escapeHtml(preset.id)}" ${preset.id === presetId ? "selected" : ""}>${escapeHtml(preset.name)}</option>`,
          )
          .join("")}
      </select>
      <div class="emotion-link-actions">
        <label class="emotion-link-loop">
          <input type="checkbox" data-link-loop="${escapeHtml(animationName)}" ${metaEntry.loop ? "checked" : ""} />
          Loop
        </label>
        <div class="emotion-link-play-cluster ${hasDecayControls ? "has-decay" : ""}">
          ${
            hasDecayControls
              ? `
                <div class="emotion-decay-time">
                  <input type="number" min="1" max="30" step="1" value="${roundForInput(decaySeconds)}" data-link-decay-seconds="${escapeHtml(animationName)}" title="Decay seconds" />
                  <div>
                    <button data-link-decay-nudge="${escapeHtml(animationName)}" data-direction="1" title="Longer">▲</button>
                    <button data-link-decay-nudge="${escapeHtml(animationName)}" data-direction="-1" title="Shorter">▼</button>
                  </div>
                </div>
                <button class="icon-button emotion-link-decay-play" data-link-decay-play="${escapeHtml(animationName)}" ${currentVrm ? "" : "disabled"} title="Decay play">${dottedArrowSvg(24)}</button>
              `
              : ""
          }
          <button class="icon-button emotion-link-play" data-link-play="${escapeHtml(animationName)}" ${currentVrm ? "" : "disabled"} title="Play">${iconSvg(Play, 24)}</button>
        </div>
      </div>
    </div>
  `;
}

function renderTransitionViewerPanel() {
  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Transition Viewer</h1>
        <p>Idle, transition pose, event 전환을 확인합니다</p>
      </div>
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
    </div>
    ${renderModeBar("transitionViewer")}
    <div class="transition-viewer-panel">
      ${renderTransitionCategory("idle", "Idle (Loop)")}
      ${renderTransitionCategory("transition", "Transition")}
      ${renderTransitionCategory("event", "Event (Once)")}
    </div>
  `;
}

function renderTransitionCategory(kind, title) {
  const slots = state.transitionViewer[kind] ?? [];
  return `
    <section class="transition-category-card">
      <h2>${escapeHtml(title)}</h2>
      <div class="transition-slot-list">
        ${slots.map((slot) => renderTransitionSlot(kind, slot)).join("")}
        <button class="transition-add-button" data-transition-add="${kind}">+</button>
      </div>
    </section>
  `;
}

function renderTransitionSlot(kind, slot) {
  const animationNames = getTransitionLinkerAnimationNames(kind);
  const selectedName = slot.fileName ?? "";
  const selectedRecommended = !selectedName || isAnimationRecommendedForTransitionKind(kind, selectedName);
  return `
    <div class="transition-slot-row">
      <select class="transition-slot-select ${selectedRecommended ? "" : "not-recommended"}" data-transition-select="${slot.id}" title="${escapeHtml(formatTransitionLinkerOptionLabel(selectedName) || "link name")}">
        <option value="">link name</option>
        ${animationNames
          .map((name) => {
            const recommended = isAnimationRecommendedForTransitionKind(kind, name);
            return `<option class="${recommended ? "recommended" : "not-recommended"}" value="${escapeHtml(name)}" ${name === selectedName ? "selected" : ""}>${escapeHtml(formatTransitionLinkerOptionLabel(name))}</option>`;
          })
          .join("")}
      </select>
      <button class="transition-remove-button" data-transition-remove="${slot.id}" title="Remove">-</button>
      ${
        kind === "transition"
          ? `<button class="transition-use-button transition-use-mid" data-transition-use="${slot.id}" data-target="transitionPick" title="Use as transition">&gt;</button>`
          : `<div class="transition-use-stack">
              <button class="transition-use-button transition-use-start" data-transition-use="${slot.id}" data-target="start" title="Use as start">&gt;</button>
              <button class="transition-use-button transition-use-end" data-transition-use="${slot.id}" data-target="end" title="Use as end">&gt;</button>
            </div>`
      }
    </div>
  `;
}

function renderTransitionViewerTray() {
  const start = getTransitionPick("start");
  const transition = getTransitionPick("transitionPick");
  const end = getTransitionPick("end");
  return `
    <aside class="transition-preview-tray">
      ${renderTransitionPreviewCard("Start animation", start?.fileName, "start")}
      ${
        transition
          ? `
            ${renderTransitionBlendPanel("startBlend", "Start → Transition", "Start", "Transition", "start", "mid")}
            ${renderTransitionPreviewCard("Transition", transition.fileName, "mid", true)}
            ${renderTransitionTrimPanel()}
            ${renderTransitionBlendPanel("endBlend", "Transition → End", "Transition", "End", "mid", "end")}
          `
          : renderTransitionBlendPanel("endBlend", "Start → End", "Start", "End", "start", "end")
      }
      ${renderTransitionPreviewCard("End animation", end?.fileName, "end")}
      <div class="transition-preview-actions">
        <button class="transition-preview-swap" id="swapTransitionStartEnd" ${start && end ? "" : "disabled"} title="Swap start and end">
          ${verticalSwapSvg(34)}
        </button>
        <button class="transition-preview-play" id="playTransitionViewer" ${start && end && currentVrm ? "" : "disabled"}>
          ${state.transitionViewer.playing ? "playing" : "play"}
        </button>
      </div>
    </aside>
  `;
}

function renderTransitionPreviewCard(title, fileName, tone, canClear = false) {
  return `
    <section class="transition-preview-card transition-preview-${tone}">
      <div class="transition-preview-card-head">
        <h2>${escapeHtml(title)}</h2>
        <div class="transition-card-actions">
          ${
            canClear
              ? `<button class="icon-button transition-card-clear" data-clear-transition-pick title="Clear transition">x</button>`
              : ""
          }
          <button class="icon-button transition-card-play" data-transition-preview-play="${escapeHtml(fileName || "")}" ${fileName && currentVrm ? "" : "disabled"} title="Play">
            ${iconSvg(Play, 24)}
          </button>
        </div>
      </div>
      <p>${escapeHtml(formatTransitionLinkerOptionLabel(fileName) || "link name")}</p>
    </section>
  `;
}

function renderTransitionBlendPanel(key, title, leftLabel, rightLabel, leftTone, rightTone) {
  const maxValue = getTransitionBlendMax(key);
  const value = Math.min(maxValue, state.transitionViewer[key] ?? 0.4);
  return `
    <section class="transition-blend-panel">
      <div class="transition-blend-title">
        <span>${escapeHtml(title)}</span>
        <strong>${value.toFixed(2)}s</strong>
      </div>
      <div class="transition-blend-bars">
        <label>${escapeHtml(leftLabel)}</label>
        <div class="blend-bar ${leftTone}"><span style="width: ${Math.max(12, (1 - value / 2) * 100)}%"></span></div>
        <label>${escapeHtml(rightLabel)}</label>
        <div class="blend-bar ${rightTone}"><span style="width: ${Math.max(12, (value / 2) * 100)}%"></span></div>
      </div>
      <input type="range" min="0" max="${maxValue}" step="0.05" value="${value}" data-transition-blend="${key}" />
    </section>
  `;
}

function renderTransitionTrimPanel() {
  const transition = getTransitionPick("transitionPick");
  const maxTrim = transition ? getAnimationDuration(transition.fileName, 1) : 1;
  const value = getTransitionTrimSeconds();
  return `
    <section class="transition-blend-panel transition-trim-panel">
      <div class="transition-blend-title">
        <span>Transition Trim</span>
        <strong>${value.toFixed(2)}s</strong>
      </div>
      <input type="range" min="0.05" max="${Math.max(0.05, maxTrim)}" step="0.05" value="${value}" data-transition-trim />
    </section>
  `;
}

function renderTransitionTimelineOverlay() {
  const start = getTransitionPick("start");
  const transition = getTransitionPick("transitionPick");
  const end = getTransitionPick("end");
  if (!start && !transition && !end) return "";
  const metrics = getTransitionTimelineMetrics();
  const progress = clamp01(state.transitionViewer.timelineProgress ?? 0);
  const rows = [
    ["start", metrics.startLeft, metrics.startWidth],
    ...(metrics.hasTransition === false ? [] : [["mid", metrics.midLeft, metrics.midWidth]]),
    ["end", metrics.endLeft, metrics.endWidth],
  ];
  return `
    <div class="transition-timeline-overlay" aria-label="Transition progress">
      <div class="transition-timeline-track">
        ${rows
          .map(
            ([tone, left, width]) =>
              `<div class="transition-timeline-bar transition-timeline-${tone}" style="left:${left}%;width:${width}%"></div>`,
          )
          .join("")}
        ${
          metrics.hasTransition === false
            ? ""
            : `<button class="transition-timeline-handle handle-a" style="left:${metrics.handleA}%" data-transition-handle="a" title="Start to Transition blend">A</button>`
        }
        <button class="transition-timeline-handle handle-b" style="left:${metrics.handleB}%" data-transition-handle="b" title="Transition to End blend">B</button>
        ${
          metrics.hasTransition === false
            ? ""
            : `<button class="transition-timeline-handle handle-c" style="left:${metrics.handleC}%" data-transition-handle="c" title="Transition trim">C</button>`
        }
        <div class="transition-timeline-cursor" style="left:${progress * 100}%"></div>
      </div>
    </div>
  `;
}

function renderBoneOptions() {
  return BONE_GROUPS.map(
    (group) => `
      <optgroup label="${escapeHtml(group.label)}">
        ${group.bones
          .map(
            (bone) =>
              `<option value="${bone}" ${bone === state.selectedBone ? "selected" : ""}>${escapeHtml(formatBoneName(bone))}</option>`,
          )
          .join("")}
      </optgroup>
    `,
  ).join("");
}

function renderCorrectionVector(key, label, values, min, max, step, unit) {
  const axes = ["x", "y", "z"];
  const delta = state.correctionSteps[key] ?? step;
  const deltaOptions = [1, 0.1, 0.01];
  return `
    <div class="correction-card">
      <div class="correction-card-head">
        <div class="name">${escapeHtml(label)}</div>
        <div class="correction-card-tools">
          <div class="delta-toggle" role="group" aria-label="${escapeHtml(label)} delta">
            ${deltaOptions
              .map(
                (option) =>
                  `<button class="delta-button ${Math.abs(delta - option) < 0.000001 ? "active" : ""}" data-correction-step="${key}" data-step="${option}">${formatDeltaOption(option)}</button>`,
              )
              .join("")}
          </div>
          <button class="reset-button" title="${escapeHtml(label)} reset" data-correction-reset="${key}">${iconSvg(RotateCcw, 14)}</button>
        </div>
      </div>
      ${axes
        .map((axis, index) => {
          const value = values[index] ?? (key === "scaleMultiplier" ? 1 : 0);
          return `
            <div class="axis-row">
              <span>${axis.toUpperCase()}</span>
              <button class="step-button" data-correction-nudge="${key}" data-axis="${index}" data-direction="-1">-</button>
              <input type="number" min="${min}" max="${max}" step="${step}" value="${roundForInput(value)}" data-correction-number="${key}" data-axis="${index}" />
              <button class="step-button" data-correction-nudge="${key}" data-axis="${index}" data-direction="1">+</button>
              <span>${unit}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderEditor() {
  const expression = getExpression(state.editing);
  const parameters = state.editDraft?.parameters ?? [];
  const expressionValue = state.expressionValues.get(state.editing) ?? 0;
  const rows = parameters
    .map(
      (param, index) => `
      <div class="parameter-row">
        <div class="row-top">
          <div class="name" title="${escapeHtml(param.label)}">${escapeHtml(param.label)}</div>
          <div class="value">${Math.round(param.value * 100)}%</div>
        </div>
        <div class="parameter-meta">${escapeHtml(param.meta)}</div>
        <input type="range" min="0" max="1" step="0.01" value="${param.value}" data-param="${index}" />
      </div>
    `,
    )
    .join("");

  return `
    <div class="editor-screen">
      <div class="editor-header">
        <button class="icon-button" id="backFromEdit" title="뒤로">${iconSvg(ArrowLeft)}</button>
        <div class="editor-name">${escapeHtml(expression?.name ?? "Expression")}</div>
        <div class="editor-expression-control">
          <div class="value">${Math.round(expressionValue * 100)}%</div>
          <input type="range" min="0" max="1" step="0.01" value="${expressionValue}" data-edit-expression-slider="${state.editing}" />
        </div>
      </div>
      <div class="editor-actions">
        <button class="primary-button" id="saveExpression" ${state.dirtyEdit ? "" : "disabled"}>${iconSvg(Save, 16)}저장</button>
      </div>
      ${
        state.confirmBack
          ? `<div class="confirm-bar">
              <p>저장하지 않은 변경사항이 있습니다. 저장할까요?</p>
              <div class="confirm-actions">
                <button class="primary-button" id="saveAndBack">저장</button>
                <button class="danger-button" id="discardAndBack">버리고 나가기</button>
                <button class="secondary-button" id="cancelBack">취소</button>
              </div>
            </div>`
          : ""
      }
      <div class="parameter-list">
        ${
          parameters.length
            ? rows
            : `<p class="empty-text">이 표정에서 편집 가능한 얼굴 morph 파라미터를 찾지 못했습니다.</p>`
        }
      </div>
    </div>
  `;
}

function renderDropHint() {
  return `
    <div class="drop-hint">
      <h2>VRM 파일을 열어 시작</h2>
      <p>표정 확인과 캐릭터별 모션 보정 JSON 제작을 여기에서 다룹니다.</p>
      <button class="primary-button" id="openFileEmpty">${iconSvg(FolderOpen, 16)}VRM 열기</button>
    </div>
  `;
}

function bindUi() {
  document.querySelector("#openFile")?.addEventListener("click", openFile);
  document.querySelector("#openFileEmpty")?.addEventListener("click", openFile);
  document.querySelector("#commitAll")?.addEventListener("click", commitAll);
  document.querySelector("#undo")?.addEventListener("click", undo);
  document.querySelector("#redo")?.addEventListener("click", redo);
  document.querySelector("#backFromEdit")?.addEventListener("click", requestBack);
  document.querySelector("#saveExpression")?.addEventListener("click", saveCurrentExpression);
  document.querySelector("#saveAndBack")?.addEventListener("click", async () => {
    await saveCurrentExpression();
    leaveEditor();
  });
  document.querySelector("#discardAndBack")?.addEventListener("click", leaveEditor);
  document.querySelector("#cancelBack")?.addEventListener("click", () => {
    state.confirmBack = false;
    render();
  });
  document.querySelector("#saveCorrection")?.addEventListener("click", saveCorrection);
  document.querySelector("#saveExpressionMeta")?.addEventListener("click", saveCorrection);
  document.querySelector("#saveSelectedParameters")?.addEventListener("click", saveSelectedExpressionParameters);
  document.querySelector("#toggleParameterFilter")?.addEventListener("click", () => {
    state.parameterFilterOpen = !state.parameterFilterOpen;
    render();
  });
  document.querySelector("#addAnimation")?.addEventListener("click", addAnimation);
  document.querySelector("#prevAnimation")?.addEventListener("click", () => stepSelectedAnimation(-1));
  document.querySelector("#nextAnimation")?.addEventListener("click", () => stepSelectedAnimation(1));
  document.querySelector("#deleteAnimation")?.addEventListener("click", deleteSelectedAnimation);
  document.querySelector("#toggleMustWatch")?.addEventListener("click", toggleSelectedAnimationMustWatch);
  document.querySelector("#toggleAnimation")?.addEventListener("click", toggleAnimationPlayback);
  document.querySelector("#restartAnimation")?.addEventListener("click", restartAnimation);
  document.querySelector("#resetBoneCorrection")?.addEventListener("click", resetSelectedBoneCorrection);
  for (const button of document.querySelectorAll("[data-correction-animation-tab]")) {
    button.addEventListener("click", () => {
      state.correctionAnimationTab = button.dataset.correctionAnimationTab === "files" ? "files" : "play";
      render();
    });
  }
  for (const button of document.querySelectorAll("[data-animation-file-select]")) {
    button.addEventListener("click", () => selectAnimationFromFileList(button.dataset.animationFileSelect));
  }
  document.querySelector("#openTransferSource")?.addEventListener("click", () => openTransferFile("source"));
  document.querySelector("#openTransferTarget")?.addEventListener("click", () => openTransferFile("target"));
  document.querySelector("#checkTransfer")?.addEventListener("click", checkTransferCompatibility);
  document.querySelector("#applyTransfer")?.addEventListener("click", applyTransfer);
  document.querySelector("#addEmotionPreset")?.addEventListener("click", addEmotionPreset);
  for (const select of document.querySelectorAll("[data-link-expression]")) {
    select.addEventListener("change", () => updateAnimationExpressionLink(select.dataset.linkExpression, select.value));
  }

  for (const input of document.querySelectorAll("[data-link-loop]")) {
    input.addEventListener("change", () => updateAnimationLoop(input.dataset.linkLoop, input.checked));
  }

  for (const button of document.querySelectorAll("[data-link-play]")) {
    button.addEventListener("click", () => playLinkedAnimation(button.dataset.linkPlay));
  }

  for (const button of document.querySelectorAll("[data-link-decay-play]")) {
    button.addEventListener("click", () => playLinkedAnimation(button.dataset.linkDecayPlay, { decay: true }));
  }

  for (const input of document.querySelectorAll("[data-link-decay-seconds]")) {
    input.addEventListener("change", () => {
      updateAnimationDecaySeconds(input.dataset.linkDecaySeconds, Number(input.value));
      renderPreservingEmotionLinkerScroll();
    });
  }

  for (const button of document.querySelectorAll("[data-link-decay-nudge]")) {
    button.addEventListener("click", () =>
      nudgeAnimationDecaySeconds(button.dataset.linkDecayNudge, Number(button.dataset.direction)),
    );
  }

  for (const button of document.querySelectorAll("[data-transition-add]")) {
    button.addEventListener("click", () => addTransitionViewerSlot(button.dataset.transitionAdd));
  }

  for (const button of document.querySelectorAll("[data-transition-remove]")) {
    button.addEventListener("click", () => removeTransitionViewerSlot(button.dataset.transitionRemove));
  }

  for (const select of document.querySelectorAll("[data-transition-select]")) {
    select.addEventListener("change", () => updateTransitionViewerSlot(select.dataset.transitionSelect, select.value));
  }

  for (const button of document.querySelectorAll("[data-transition-use]")) {
    button.addEventListener("click", () => useTransitionViewerSlot(button.dataset.transitionUse, button.dataset.target));
  }

  for (const input of document.querySelectorAll("[data-transition-blend]")) {
    input.addEventListener("input", () => updateTransitionBlend(input.dataset.transitionBlend, Number(input.value)));
  }

  document.querySelector("[data-transition-trim]")?.addEventListener("input", (event) =>
    updateTransitionTrim(Number(event.target.value)),
  );

  for (const handle of document.querySelectorAll("[data-transition-handle]")) {
    handle.addEventListener("pointerdown", (event) => beginTransitionTimelineHandleDrag(event, handle.dataset.transitionHandle));
  }

  for (const button of document.querySelectorAll("[data-transition-preview-play]")) {
    button.addEventListener("click", () => playTransitionViewerSingle(button.dataset.transitionPreviewPlay));
  }

  document.querySelector("[data-clear-transition-pick]")?.addEventListener("click", clearTransitionViewerPick);
  document.querySelector("#swapTransitionStartEnd")?.addEventListener("click", swapTransitionViewerStartEnd);
  document.querySelector("#playTransitionViewer")?.addEventListener("click", playTransitionViewer);
  document.querySelector("#sourceFaceMesh")?.addEventListener("change", (event) => {
    state.transfer.sourceMesh = Number(event.target.value);
    state.transfer.report = null;
    render();
  });
  document.querySelector("#targetFaceMesh")?.addEventListener("change", (event) => {
    state.transfer.targetMesh = Number(event.target.value);
    state.transfer.report = null;
    render();
  });
  document.querySelector("#selectedBone")?.addEventListener("change", (event) => {
    state.selectedBone = event.target.value;
    render();
  });

  for (const input of document.querySelectorAll("[data-correction-meta]")) {
    input.addEventListener("input", () => updateCorrectionMeta(input.dataset.correctionMeta, input.value));
  }

  for (const input of document.querySelectorAll("[name='vrmVersion']")) {
    input.addEventListener("change", () => updateVrmVersion(input.value));
  }

  document.querySelector("[data-animation-description]")?.addEventListener("input", (event) => {
    updateSelectedAnimationDescription(event.target.value);
  });

  for (const input of document.querySelectorAll("[data-animation-time]")) {
    input.addEventListener("input", () => setAnimationTime(Number(input.value)));
  }

  for (const input of document.querySelectorAll("[data-correction-vector]")) {
    input.addEventListener("input", () => updateCorrectionValue(input.dataset.correctionVector, Number(input.dataset.axis), Number(input.value)));
  }

  for (const input of document.querySelectorAll("[data-correction-number]")) {
    input.addEventListener("input", () => updateCorrectionValue(input.dataset.correctionNumber, Number(input.dataset.axis), Number(input.value)));
  }

  for (const input of document.querySelectorAll("[data-correction-step]")) {
    input.addEventListener("click", () => updateCorrectionStep(input.dataset.correctionStep, Number(input.dataset.step)));
  }

  for (const button of document.querySelectorAll("[data-correction-reset]")) {
    button.addEventListener("click", () => resetCorrectionField(button.dataset.correctionReset));
  }

  for (const button of document.querySelectorAll("[data-correction-nudge]")) {
    button.addEventListener("click", () =>
      nudgeCorrectionValue(button.dataset.correctionNudge, Number(button.dataset.axis), Number(button.dataset.direction)),
    );
  }

  for (const button of document.querySelectorAll("[data-edit]")) {
    button.addEventListener("click", () => startEdit(button.dataset.edit));
  }

  for (const button of document.querySelectorAll("[data-mode]")) {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.editing = null;
      state.confirmBack = false;
      applyCameraPresetForMode(state.mode);
      render();
    });
  }

  for (const button of document.querySelectorAll("[data-camera-settings]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.cameraSettingsOpen = state.cameraSettingsOpen === button.dataset.cameraSettings ? null : button.dataset.cameraSettings;
      render();
    });
  }

  document.querySelector("#closeCameraSettings")?.addEventListener("click", () => closeCameraSettings());
  document.querySelector("[data-light-intensity]")?.addEventListener("input", (event) => updateLightIntensity(Number(event.target.value)));

  for (const input of document.querySelectorAll("[data-camera-setting]")) {
    input.addEventListener("input", () => updateCameraSetting(input.dataset.cameraSetting, Number(input.value), input));
  }

  for (const input of document.querySelectorAll("[data-camera-setting-number]")) {
    input.addEventListener("input", () => updateCameraSetting(input.dataset.cameraSettingNumber, Number(input.value), input));
  }

  for (const card of document.querySelectorAll("[data-emotion-select]")) {
    card.addEventListener("click", () => selectEmotionPreset(card.dataset.emotionSelect));
  }

  for (const card of document.querySelectorAll("[data-emotion-drop]")) {
    card.addEventListener("dragover", (event) => event.preventDefault());
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      reorderEmotionPreset(state.draggingEmotionPresetId, card.dataset.emotionDrop);
    });
  }

  for (const handle of document.querySelectorAll("[data-emotion-drag]")) {
    handle.addEventListener("dragstart", (event) => {
      event.stopPropagation();
      state.draggingEmotionPresetId = handle.dataset.emotionDrag;
      event.dataTransfer?.setData("text/plain", state.draggingEmotionPresetId);
      const card = handle.closest(".emotion-card");
      if (card) event.dataTransfer?.setDragImage(card, 12, 12);
    });
    handle.addEventListener("dragend", () => {
      state.draggingEmotionPresetId = null;
    });
  }

  for (const control of document.querySelectorAll(".emotion-card input, .emotion-card button:not([data-emotion-drag])")) {
    control.setAttribute("draggable", "false");
    control.addEventListener("pointerdown", (event) => event.stopPropagation());
    control.addEventListener("mousedown", (event) => event.stopPropagation());
    control.addEventListener("touchstart", (event) => event.stopPropagation(), { passive: true });
    control.addEventListener("dragstart", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-lock]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleEmotionPresetLock(button.dataset.emotionLock);
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-delete]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteEmotionPreset(button.dataset.emotionDelete);
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-duplicate]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      duplicateEmotionPreset(button.dataset.emotionDuplicate);
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-blink]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleEmotionPresetBlink(button.dataset.emotionBlink);
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-range-add]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      addEmotionRangeSlot(button.dataset.emotionRangeAdd);
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-range-delete]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteEmotionRangeSlot(button.dataset.emotionRangeDelete);
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-range-sample]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      sampleEmotionRangeSlotParameters(button.dataset.emotionRangeSample);
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-range-jump]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      jumpEmotionSliderToRangeSlot(button.dataset.emotionRangeJump);
    });
  }

  for (const target of document.querySelectorAll("[data-emotion-range-select]")) {
    target.addEventListener("click", (event) => {
      event.stopPropagation();
      selectEmotionRangeSlot(target.dataset.emotionRangeSelect);
    });
  }

  for (const handle of document.querySelectorAll("[data-emotion-range-drag]")) {
    handle.addEventListener("pointerdown", (event) => beginEmotionRangeThresholdDrag(event, handle.dataset.emotionRangeDrag));
  }

  for (const input of document.querySelectorAll("[data-emotion-name]")) {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("blur", () => updateEmotionPresetName(input.dataset.emotionName, input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        updateEmotionPresetName(input.dataset.emotionName, input.value);
        input.blur();
      }
    });
  }

  for (const slider of document.querySelectorAll("[data-emotion-slider]")) {
    slider.addEventListener("click", (event) => event.stopPropagation());
    slider.addEventListener("input", () => updateEmotionPresetValue(slider.dataset.emotionSlider, Number(slider.value), slider));
  }

  for (const input of document.querySelectorAll("[data-emotion-value]")) {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("blur", () => updateEmotionPresetValue(input.dataset.emotionValue, Number(input.value), input, true));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        updateEmotionPresetValue(input.dataset.emotionValue, Number(input.value), input, true);
        input.blur();
      }
    });
  }

  for (const slider of document.querySelectorAll("[data-rorr-param]")) {
    slider.addEventListener("input", () => updateSelectedRorrParameter(slider.dataset.rorrParam, Number(slider.value), slider));
  }

  for (const input of document.querySelectorAll("[data-rorr-param-value]")) {
    input.addEventListener("blur", () => updateSelectedRorrParameter(input.dataset.rorrParamValue, Number(input.value), input, true));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        updateSelectedRorrParameter(input.dataset.rorrParamValue, Number(input.value), input, true);
        input.blur();
      }
    });
  }

  for (const input of document.querySelectorAll("[data-parameter-filter]")) {
    input.addEventListener("change", () => updateParameterFilter(input.dataset.parameterFilter, input.checked));
  }

  for (const button of document.querySelectorAll("[data-parameter-remove]")) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeMissingParameterFromConfig(button.dataset.parameterRemove);
    });
  }

  for (const slider of document.querySelectorAll("[data-expression-slider]")) {
    slider.addEventListener("input", () => {
      const value = Number(slider.value);
      setExpressionPreview(slider.dataset.expressionSlider, value);
      updateSliderValueLabel(slider, value);
    });
  }

  for (const slider of document.querySelectorAll("[data-edit-expression-slider]")) {
    slider.addEventListener("input", () => {
      const value = Number(slider.value);
      setExpressionPreview(slider.dataset.editExpressionSlider, value);
      updateEditorExpressionControl(value);
      applyEditDraftMorphPreview();
    });
  }

  for (const slider of document.querySelectorAll("[data-param]")) {
    slider.addEventListener("input", () => {
      const value = Number(slider.value);
      updateDraftParameter(Number(slider.dataset.param), value);
      updateSliderValueLabel(slider, value);
    });
  }

  for (const scroller of document.querySelectorAll(".expression-list, .parameter-list, .transfer-panel, .correction-panel, .expression-editor-panel, .emotion-linker-panel, .transition-viewer-panel, .transition-preview-tray")) {
    bindPanelWheel(scroller, scroller);
  }

  const sidebar = document.querySelector(".sidebar");
  const activeScroller = document.querySelector(
    state.mode === "transfer"
      ? ".transfer-panel"
      : state.mode === "correction"
        ? ".correction-panel"
        : state.mode === "linker"
          ? ".emotion-linker-panel"
          : state.mode === "transitionViewer"
            ? ".transition-viewer-panel"
        : state.editing
          ? ".parameter-list"
          : ".expression-editor-panel",
  );
  if (sidebar && activeScroller) bindPanelWheel(sidebar, activeScroller);
}

function getSelectedEmotionPreset() {
  return state.expressionPresets.find((preset) => preset.id === state.selectedExpressionPresetId) ?? state.expressionPresets[0] ?? null;
}

function getSelectedExpressionRangeSlot() {
  const selected = getSelectedEmotionPreset();
  if (!selected || !state.selectedExpressionRangeId) return null;
  return normalizeExpressionRangeSlots(selected.rangeSlots).find((slot) => slot.id === state.selectedExpressionRangeId) ?? null;
}

function getSelectedExpressionEditLabel() {
  const selected = getSelectedEmotionPreset();
  const slot = getSelectedExpressionRangeSlot();
  if (!selected) return "No emotion selected";
  if (!slot) return selected.name;
  const slots = normalizeExpressionRangeSlots(selected.rangeSlots);
  const index = Math.max(0, slots.findIndex((item) => item.id === slot.id));
  return `${selected.name} / ${index + 1} (${formatEmotionValue(slot.threshold)})`;
}

function selectEmotionPreset(id) {
  if (state.selectedExpressionPresetId === id) {
    if (!confirmPendingExpressionParameterChanges()) return;
    state.selectedExpressionRangeId = null;
    loadSelectedExpressionParameterDraft();
    const current = getSelectedEmotionPreset();
    if (current) current.value = 1;
    transitionToSelectedEmotionPreset(0.2);
    renderPreservingExpressionScroll();
    return;
  }
  if (!confirmPendingExpressionParameterChanges()) return;
  for (const preset of state.expressionPresets) {
    preset.value = preset.id === id ? 1 : 0;
  }
  state.selectedExpressionPresetId = id;
  state.selectedExpressionRangeId = null;
  loadSelectedExpressionParameterDraft();
  transitionToSelectedEmotionPreset(0.2);
  renderPreservingExpressionScroll();
}

function addEmotionPreset() {
  if (!confirmPendingExpressionParameterChanges()) return;
  const id = `emotion-${Date.now()}-${state.expressionPresets.length}`;
  state.expressionPresets.push({
    id,
    name: "new emotion",
    value: 0,
    locked: false,
    isDisableBlink: false,
    parameters: {},
  });
  for (const preset of state.expressionPresets) {
    preset.value = preset.id === id ? 1 : 0;
  }
  state.selectedExpressionPresetId = id;
  state.selectedExpressionRangeId = null;
  loadSelectedExpressionParameterDraft();
  markExpressionMetaDirty();
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll({ scrollToBottom: true });
}

function duplicateEmotionPreset(id) {
  const sourceIndex = state.expressionPresets.findIndex((item) => item.id === id);
  if (sourceIndex < 0) return;
  const source = state.expressionPresets[sourceIndex];
  const copy = {
    id: `emotion-${Date.now()}-${state.expressionPresets.length}`,
    name: source.name,
    value: 0,
    locked: false,
    isDisableBlink: Boolean(source.isDisableBlink),
    parameters: normalizeExpressionParameterValues(source.parameters),
    rangeSlots: normalizeExpressionRangeSlots(source.rangeSlots).map((slot, index) => ({
      id: `range-${Date.now()}-${index}`,
      threshold: slot.threshold,
      parameters: normalizeExpressionParameterValues(slot.parameters),
    })),
  };
  state.expressionPresets.splice(sourceIndex + 1, 0, copy);
  markExpressionMetaDirty();
  renderPreservingExpressionScroll();
}

function addEmotionRangeSlot(presetId) {
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  if (!preset || preset.locked) return;
  const slots = normalizeExpressionRangeSlots(preset.rangeSlots);
  if (slots.length >= 5) return;
  const threshold = findNewRangeThreshold(slots);
  const slot = {
    id: `range-${Date.now()}-${slots.length}`,
    threshold,
    parameters: {},
  };
  preset.rangeSlots = [...slots, slot].sort((a, b) => a.threshold - b.threshold);
  state.selectedExpressionPresetId = preset.id;
  state.selectedExpressionRangeId = slot.id;
  loadSelectedExpressionParameterDraft();
  markExpressionMetaDirty();
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll();
}

function findNewRangeThreshold(slots) {
  const points = [0, ...slots.map((slot) => slot.threshold), 1].sort((a, b) => a - b);
  let bestStart = 0;
  let bestEnd = 1;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (end - start > bestEnd - bestStart) {
      bestStart = start;
      bestEnd = end;
    }
  }
  return clampEmotionValue((bestStart + bestEnd) / 2);
}

function selectEmotionRangeSlot(slotId) {
  const selected = getSelectedEmotionPreset();
  if (!selected) return;
  if (!normalizeExpressionRangeSlots(selected.rangeSlots).some((slot) => slot.id === slotId)) return;
  if (!confirmPendingExpressionParameterChanges()) return;
  state.selectedExpressionRangeId = slotId;
  loadSelectedExpressionParameterDraft();
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll();
}

function deleteEmotionRangeSlot(slotId) {
  const selected = getSelectedEmotionPreset();
  if (!selected || selected.locked) return;
  selected.rangeSlots = normalizeExpressionRangeSlots(selected.rangeSlots).filter((slot) => slot.id !== slotId);
  if (state.selectedExpressionRangeId === slotId) state.selectedExpressionRangeId = null;
  loadSelectedExpressionParameterDraft();
  markExpressionMetaDirty();
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll();
}

function sampleEmotionRangeSlotParameters(slotId) {
  const selected = getSelectedEmotionPreset();
  if (!selected || selected.locked) return;
  const slots = normalizeExpressionRangeSlots(selected.rangeSlots);
  const slot = slots.find((item) => item.id === slotId);
  if (!slot) return;
  const sampled = getExpressionParametersAtValue(selected, slot.threshold, false, slotId);
  slot.parameters = normalizeExpressionParameterValues(sampled);
  selected.rangeSlots = slots;
  state.selectedExpressionRangeId = slotId;
  state.expressionParameterDraft = { ...slot.parameters };
  state.expressionParameterDirty = false;
  setEmotionPresetPreviewValue(selected.id, slot.threshold);
  markExpressionMetaDirty();
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll();
}

function jumpEmotionSliderToRangeSlot(slotId) {
  const selected = getSelectedEmotionPreset();
  if (!selected) return;
  const slot = normalizeExpressionRangeSlots(selected.rangeSlots).find((item) => item.id === slotId);
  if (!slot) return;
  if (!confirmPendingExpressionParameterChanges()) return;
  state.selectedExpressionRangeId = slotId;
  loadSelectedExpressionParameterDraft();
  setEmotionPresetPreviewValue(selected.id, slot.threshold);
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll();
}

function setEmotionPresetPreviewValue(presetId, value) {
  for (const preset of state.expressionPresets) {
    preset.value = preset.id === presetId ? clampEmotionValue(value) : 0;
  }
}

function updateEmotionRangeThreshold(slotId, threshold) {
  const selected = getSelectedEmotionPreset();
  if (!selected || selected.locked) return;
  const slots = normalizeExpressionRangeSlots(selected.rangeSlots);
  const slot = slots.find((item) => item.id === slotId);
  if (!slot) return;
  slot.threshold = clampEmotionValue(threshold);
  selected.rangeSlots = slots.sort((a, b) => a.threshold - b.threshold);
  markExpressionMetaDirty();
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll();
}

function beginEmotionRangeThresholdDrag(event, slotId) {
  const selected = getSelectedEmotionPreset();
  if (!selected || selected.locked) return;
  event.preventDefault();
  event.stopPropagation();
  state.selectedExpressionRangeId = slotId;
  loadSelectedExpressionParameterDraft();
  const slot = normalizeExpressionRangeSlots(selected.rangeSlots).find((item) => item.id === slotId);
  if (!slot) return;
  const startX = event.clientX;
  const startThreshold = slot.threshold;
  const onMove = (moveEvent) => {
    const delta = (moveEvent.clientX - startX) / 260;
    updateEmotionRangeThreshold(slotId, startThreshold + delta);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function toggleEmotionPresetLock(id) {
  const preset = state.expressionPresets.find((item) => item.id === id);
  if (!preset) return;
  const selectionChanged = state.selectedExpressionPresetId !== id;
  if (selectionChanged && !confirmPendingExpressionParameterChanges()) return;
  preset.locked = !preset.locked;
  state.selectedExpressionPresetId = id;
  if (selectionChanged) state.selectedExpressionRangeId = null;
  if (selectionChanged) loadSelectedExpressionParameterDraft();
  if (preset.locked) state.expressionParameterDirty = false;
  markExpressionMetaDirty();
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll();
}

function toggleEmotionPresetBlink(id) {
  const preset = state.expressionPresets.find((item) => item.id === id);
  if (!preset) return;
  preset.isDisableBlink = !preset.isDisableBlink;
  markExpressionMetaDirty();
  renderPreservingExpressionScroll();
}

function deleteEmotionPreset(id) {
  const preset = state.expressionPresets.find((item) => item.id === id);
  if (!preset || preset.locked) return;
  if (!window.confirm("삭제할까요?")) return;
  state.expressionPresets = state.expressionPresets.filter((item) => item.id !== id);
  if (state.selectedExpressionPresetId === id) {
    state.selectedExpressionPresetId = state.expressionPresets[0]?.id ?? null;
    state.selectedExpressionRangeId = null;
  }
  loadSelectedExpressionParameterDraft();
  markExpressionMetaDirty();
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll();
}

function updateEmotionPresetName(id, name) {
  const preset = state.expressionPresets.find((item) => item.id === id);
  if (!preset || preset.locked) return;
  const selectionChanged = state.selectedExpressionPresetId !== id;
  if (selectionChanged && !confirmPendingExpressionParameterChanges()) return;
  const nextName = name.trim() || "new emotion";
  if (preset.name === nextName) return;
  preset.name = nextName;
  state.selectedExpressionPresetId = id;
  if (selectionChanged) state.selectedExpressionRangeId = null;
  if (selectionChanged) loadSelectedExpressionParameterDraft();
  markExpressionMetaDirty();
  applySelectedEmotionPreset();
  renderPreservingExpressionScroll();
}

function updateEmotionPresetValue(id, value, source, shouldRender = false) {
  const preset = state.expressionPresets.find((item) => item.id === id);
  if (!preset) return;
  state.expressionDecay = null;
  if (state.selectedExpressionPresetId !== id) {
    if (!confirmPendingExpressionParameterChanges()) return;
    for (const item of state.expressionPresets) {
      item.value = item.id === id ? item.value : 0;
    }
    state.selectedExpressionPresetId = id;
    state.selectedExpressionRangeId = null;
    loadSelectedExpressionParameterDraft();
  }
  const nextValue = clampEmotionValue(value);
  preset.value = nextValue;
  state.selectedExpressionPresetId = id;
  syncEmotionValueControls(id, nextValue, source);
  applySelectedEmotionPreset();
  if (shouldRender) renderPreservingExpressionScroll();
}

function reorderEmotionPreset(draggedId, targetId) {
  if (!draggedId || !targetId || draggedId === targetId) return;
  const selectionChanged = state.selectedExpressionPresetId !== draggedId;
  if (selectionChanged && !confirmPendingExpressionParameterChanges()) return;
  const fromIndex = state.expressionPresets.findIndex((item) => item.id === draggedId);
  const toIndex = state.expressionPresets.findIndex((item) => item.id === targetId);
  if (fromIndex < 0 || toIndex < 0) return;
  const [moved] = state.expressionPresets.splice(fromIndex, 1);
  state.expressionPresets.splice(toIndex, 0, moved);
  state.selectedExpressionPresetId = draggedId;
  if (selectionChanged) state.selectedExpressionRangeId = null;
  if (selectionChanged) loadSelectedExpressionParameterDraft();
  markExpressionMetaDirty();
  renderPreservingExpressionScroll();
}

function updateSelectedRorrParameter(parameterId, value, source, shouldRender = false) {
  const selected = getSelectedEmotionPreset();
  if (!selected || !state.currentParameterIds.has(parameterId)) return;
  state.expressionDecay = null;
  state.expressionParameterDraft ??= {};
  state.expressionParameterDraft[parameterId] = clampEmotionValue(value);
  if (!selected.locked) state.expressionParameterDirty = true;
  syncRorrParameterControls(parameterId, state.expressionParameterDraft[parameterId], source);
  applySelectedEmotionPreset();
  syncSaveParameterButton();
}

function markExpressionMetaDirty() {
  state.expressionDirty = true;
  syncSaveMetaButton();
}

function loadSelectedExpressionParameterDraft() {
  const selected = getSelectedEmotionPreset();
  const slot = getSelectedExpressionRangeSlot();
  state.expressionParameterDraft = { ...((slot ?? selected)?.parameters ?? {}) };
  state.expressionParameterDirty = false;
}

function commitSelectedExpressionParameters() {
  const selected = getSelectedEmotionPreset();
  if (!selected || selected.locked) return false;
  const slot = getSelectedExpressionRangeSlot();
  if (slot) {
    const slots = normalizeExpressionRangeSlots(selected.rangeSlots);
    const target = slots.find((item) => item.id === slot.id);
    if (!target) return false;
    target.parameters = normalizeExpressionParameterValues(state.expressionParameterDraft);
    selected.rangeSlots = slots;
  } else {
    selected.parameters = normalizeExpressionParameterValues(state.expressionParameterDraft);
  }
  state.expressionParameterDirty = false;
  markExpressionMetaDirty();
  applySelectedEmotionPreset();
  return true;
}

function saveSelectedExpressionParameters() {
  if (!commitSelectedExpressionParameters()) return;
  renderPreservingExpressionEditorScrolls();
}

function confirmPendingExpressionParameterChanges() {
  if (!state.expressionParameterDirty) return true;
  if (window.confirm("편집한 파라미터를 저장할까요?")) {
    commitSelectedExpressionParameters();
  } else {
    state.expressionParameterDirty = false;
  }
  return true;
}

function syncSaveParameterButton() {
  const button = document.querySelector("#saveSelectedParameters");
  const selected = getSelectedEmotionPreset();
  if (button) button.disabled = !(selected && !selected.locked && state.expressionParameterDirty);
}

function updateParameterFilter(parameterId, checked) {
  const visibleIds = getVisibleParameterIdSet();
  if (checked) {
    visibleIds.add(parameterId);
  } else {
    visibleIds.delete(parameterId);
  }
  for (const row of document.querySelectorAll(`[data-parameter-row="${cssEscape(parameterId)}"]`)) {
    row.hidden = !checked;
  }
  syncParameterFilterConfigMemory();
}

function removeMissingParameterFromConfig(parameterId) {
  if (state.currentParameterIds.has(parameterId)) return;
  const known = getKnownParameterIdSet();
  known.delete(parameterId);
  const visible = getVisibleParameterIdSet();
  visible.delete(parameterId);
  state.config = normalizeEditorConfig({
    ...state.config,
    expressionEditor: {
      ...(state.config?.expressionEditor ?? {}),
      knownShapeKeys: [...known],
      visibleShapeKeys: [...visible],
    },
  });
  state.rorrParameters = state.rorrParameters.filter((parameter) => parameter.id !== parameterId);
  updateEditorConfigMemory();
  renderPreservingParameterFilterScroll();
}

function renderPreservingParameterFilterScroll() {
  const popup = document.querySelector(".parameter-filter-popup");
  const scrollTop = popup?.scrollTop ?? 0;
  render();
  const nextPopup = document.querySelector(".parameter-filter-popup");
  if (nextPopup) nextPopup.scrollTop = scrollTop;
}

function cssEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function renderPreservingExpressionScroll(options = {}) {
  const scroller = document.querySelector(".expression-editor-panel");
  const scrollTop = scroller?.scrollTop ?? 0;
  render();
  const nextScroller = document.querySelector(".expression-editor-panel");
  if (!nextScroller) return;
  nextScroller.scrollTop = options.scrollToBottom ? nextScroller.scrollHeight : scrollTop;
}

function renderPreservingExpressionEditorScrolls() {
  const expressionScroller = document.querySelector(".expression-editor-panel");
  const parameterScroller = document.querySelector(".expression-parameter-tray");
  const expressionScrollTop = expressionScroller?.scrollTop ?? 0;
  const parameterScrollTop = parameterScroller?.scrollTop ?? 0;
  render();
  const nextExpressionScroller = document.querySelector(".expression-editor-panel");
  const nextParameterScroller = document.querySelector(".expression-parameter-tray");
  if (nextExpressionScroller) nextExpressionScroller.scrollTop = expressionScrollTop;
  if (nextParameterScroller) nextParameterScroller.scrollTop = parameterScrollTop;
}

function renderPreservingEmotionLinkerScroll() {
  const scroller = document.querySelector(".emotion-linker-panel");
  const scrollTop = scroller?.scrollTop ?? 0;
  render();
  const nextScroller = document.querySelector(".emotion-linker-panel");
  if (nextScroller) nextScroller.scrollTop = scrollTop;
}

function syncEmotionValueControls(id, value, source) {
  const formatted = formatEmotionValue(value);
  for (const input of document.querySelectorAll(`[data-emotion-slider="${id}"], [data-emotion-value="${id}"]`)) {
    if (input === source && input.type === "range") continue;
    input.value = formatted;
  }
}

function syncRorrParameterControls(id, value, source) {
  const formatted = formatEmotionValue(value);
  for (const input of document.querySelectorAll(`[data-rorr-param="${id}"], [data-rorr-param-value="${id}"]`)) {
    if (input === source && input.type === "range") continue;
    input.value = formatted;
  }
}

function applySelectedEmotionPreset() {
  const selected = getSelectedEmotionPreset();
  if (!selected) return;
  state.expressionDecay = null;
  applyRorrParameterValues(getExpressionParametersAtValue(selected, selected.value, true), 1);
}

function transitionToSelectedEmotionPreset(duration = 0.2) {
  const selected = getSelectedEmotionPreset();
  if (!selected) {
    startExpressionTransition({}, 0, duration);
    return;
  }
  startExpressionTransition(getExpressionParametersAtValue(selected, selected.value, true), 1, duration);
}

function getExpressionParametersAtValue(preset, value, includeDraft = false, excludeRangeSlotId = null, easeSegment = false) {
  const clamped = clampEmotionValue(value);
  const mainParameters =
    includeDraft && !state.selectedExpressionRangeId && preset.id === state.selectedExpressionPresetId
      ? normalizeExpressionParameterValues(state.expressionParameterDraft)
      : normalizeExpressionParameterValues(preset.parameters);
  const slots = normalizeExpressionRangeSlots(preset.rangeSlots)
    .filter((slot) => slot.id !== excludeRangeSlotId)
    .map((slot) => ({
      ...slot,
      parameters:
        includeDraft && state.selectedExpressionRangeId === slot.id && preset.id === state.selectedExpressionPresetId
          ? normalizeExpressionParameterValues(state.expressionParameterDraft)
          : normalizeExpressionParameterValues(slot.parameters),
    }));
  const points = [
    { threshold: 0, parameters: {} },
    ...slots,
    { threshold: 1, parameters: mainParameters },
  ].sort((a, b) => a.threshold - b.threshold);
  let left = points[0];
  let right = points[points.length - 1];
  for (let index = 0; index < points.length - 1; index += 1) {
    if (clamped >= points[index].threshold && clamped <= points[index + 1].threshold) {
      left = points[index];
      right = points[index + 1];
      break;
    }
  }
  if (Math.abs(right.threshold - left.threshold) < 0.000001) return normalizeExpressionParameterValues(right.parameters);
  const rawT = (clamped - left.threshold) / (right.threshold - left.threshold);
  const t = easeSegment ? easeInOutCubic(rawT) : rawT;
  return interpolateExpressionParameters(left.parameters, right.parameters, t);
}

function interpolateExpressionParameters(left, right, t) {
  const next = {};
  const names = new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})]);
  for (const name of names) {
    next[name] = clampEmotionValue((left?.[name] ?? 0) + ((right?.[name] ?? 0) - (left?.[name] ?? 0)) * t);
  }
  return next;
}

function clampEmotionValue(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

function normalizeDecaySeconds(value) {
  const next = Number(value);
  if (!Number.isFinite(next)) return 6;
  return Math.min(30, Math.max(1, Math.round(next)));
}

function formatEmotionValue(value) {
  return clampEmotionValue(value).toFixed(2);
}

function updateSliderValueLabel(slider, value) {
  const row = slider.closest(".expression-row, .parameter-row");
  const label = row?.querySelector(".value");
  if (label) label.textContent = `${Math.round(value * 100)}%`;
}

function updateEditorExpressionControl(value) {
  const control = document.querySelector(".editor-expression-control");
  const label = control?.querySelector(".value");
  const slider = control?.querySelector("input");
  if (label) label.textContent = `${Math.round(value * 100)}%`;
  if (slider) slider.value = value;
}

function bindPanelWheel(target, scroller) {
  target.addEventListener(
    "wheel",
    (event) => {
      if (!scroller || scroller.scrollHeight <= scroller.clientHeight) return;
      event.preventDefault();
      event.stopPropagation();
      scroller.scrollTop += event.deltaY;
      scroller.scrollLeft += event.deltaX;
    },
    { passive: false, capture: true },
  );
}

async function openFile() {
  try {
    const result = await window.vrmFiles.open();
    if (!result) return;

    const bytes = new Uint8Array(result.data);
    state.filePath = result.filePath;
    state.fileName = result.name;
    state.tempPath = null;
    state.glb = bytes;
    state.document = parseGlb(bytes);
    state.expressions = extractExpressions(state.document.json);
    state.expressionValues = new Map(state.expressions.map((expression) => [expression.id, 0]));
    state.editing = null;
    state.editDraft = null;
    state.dirtyEdit = false;
    state.hasWorkspaceChanges = false;
    state.undoStack = [];
    state.redoStack = [];
    await loadVrm(bytes);
    await loadOrCreateVrmMeta(result.filePath, result.name);
    applySelectedEmotionPreset();
    await loadSelectedAnimation();
    render();
  } catch (error) {
    alert(`VRM을 열지 못했습니다.\n${error.message || String(error)}`);
  }
}

async function openTransferFile(kind) {
  const result = await window.vrmFiles.open();
  if (!result) return;

  const bytes = new Uint8Array(result.data);
  const document = parseGlb(bytes);
  const faceMeshes = findFaceMeshesImproved(document.json);
  const file = {
    filePath: result.filePath,
    name: result.name,
    bytes,
    document,
    faceMeshes,
  };

  state.transfer[kind] = file;
  state.transfer.report = null;
  const selectedKey = kind === "source" ? "sourceMesh" : "targetMesh";
  state.transfer[selectedKey] = pickDefaultFaceMesh(faceMeshes)?.index ?? null;
  render();
}

async function addAnimation() {
  const result = await window.vrmFiles.openAnimation();
  if (!result) return;
  const fileName = result.name;
  const existsInAnimations = await window.vrmFiles.existsStoredAnimation(fileName);
  if (existsInAnimations) {
    const shouldUpdate = window.confirm(`같은 이름의 애니메이션이 있습니다.\n${fileName}\n업데이트할까요?`);
    if (!shouldUpdate) return;
  }

  try {
    const stored = await window.vrmFiles.storeAnimation(result.filePath);
    await refreshAnimationCatalog();
    state.selectedAnimationName = fileName;
    await loadSelectedAnimation();
    render();
  } catch (error) {
    state.animation.message = error.message || String(error);
    render();
  }
}

function addTransitionViewerSlot(kind) {
  if (!["idle", "transition", "event"].includes(kind)) return;
  state.transitionViewer[kind].push({
    id: `transition-slot-${Date.now()}-${state.transitionViewer[kind].length}`,
    kind,
    fileName: "",
  });
  syncTransitionViewerConfigMemory();
  render();
}

function findTransitionViewerSlot(slotId) {
  for (const kind of ["idle", "transition", "event"]) {
    const slot = state.transitionViewer[kind].find((item) => item.id === slotId);
    if (slot) return { kind, slot };
  }
  return null;
}

function removeTransitionViewerSlot(slotId) {
  const found = findTransitionViewerSlot(slotId);
  if (!found) return;
  state.transitionViewer[found.kind] = state.transitionViewer[found.kind].filter((slot) => slot.id !== slotId);
  for (const key of ["start", "transitionPick", "end"]) {
    if (state.transitionViewer[key]?.id === slotId) state.transitionViewer[key] = null;
  }
  syncTransitionViewerConfigMemory();
  render();
}

function updateTransitionViewerSlot(slotId, fileName) {
  const found = findTransitionViewerSlot(slotId);
  if (!found) return;
  found.slot.fileName = fileName;
  for (const key of ["start", "transitionPick", "end"]) {
    if (state.transitionViewer[key]?.id === slotId) {
      state.transitionViewer[key] = fileName
        ? { id: found.slot.id, kind: found.kind, fileName }
        : null;
    }
  }
  syncTransitionViewerConfigMemory();
  render();
}

function useTransitionViewerSlot(slotId, target) {
  const found = findTransitionViewerSlot(slotId);
  if (!found || !found.slot.fileName) return;
  if (!["start", "transitionPick", "end"].includes(target)) return;
  state.transitionViewer[target] = {
    id: found.slot.id,
    kind: found.kind,
    fileName: found.slot.fileName,
  };
  syncTransitionViewerConfigMemory();
  render();
}

function getTransitionPick(key) {
  const pick = state.transitionViewer[key];
  return pick?.fileName ? pick : null;
}

function clearTransitionViewerPick() {
  state.transitionViewer.transitionPick = null;
  syncTransitionViewerConfigMemory();
  render();
}

function swapTransitionViewerStartEnd() {
  const start = state.transitionViewer.start;
  const end = state.transitionViewer.end;
  if (!start || !end) return;
  state.transitionViewer.start = { ...end };
  state.transitionViewer.end = { ...start };
  state.transitionViewer.timelineProgress = 0;
  stopTransitionTimeline();
  syncTransitionViewerConfigMemory();
  render();
}

function updateTransitionBlend(key, value) {
  if (key !== "startBlend" && key !== "endBlend") return;
  if (!Number.isFinite(value)) return;
  const maxValue = getTransitionBlendMax(key);
  state.transitionViewer[key] = Math.min(maxValue, Math.max(0, Math.round(value * 100) / 100));
  const panel = document.querySelector(`[data-transition-blend="${key}"]`)?.closest(".transition-blend-panel");
  const label = panel?.querySelector(".transition-blend-title strong");
  if (label) label.textContent = `${state.transitionViewer[key].toFixed(2)}s`;
  const bars = panel?.querySelectorAll(".blend-bar span");
  if (bars?.length === 2) {
    bars[0].style.width = `${Math.max(12, (1 - state.transitionViewer[key] / 2) * 100)}%`;
    bars[1].style.width = `${Math.max(12, (state.transitionViewer[key] / 2) * 100)}%`;
  }
  syncTransitionViewerConfigMemory();
  refreshTransitionTimelineDom();
}

function getTransitionBlendMax(key) {
  const start = getTransitionPick("start");
  const end = getTransitionPick("end");
  const startDuration = start ? (start.kind === "idle" ? 2 : getAnimationDuration(start.fileName, 2)) : 2;
  const endDuration = end ? (end.kind === "idle" ? 2 : getAnimationDuration(end.fileName, 2)) : 2;
  const transitionDuration = getTransitionTrimSeconds();
  if (key === "startBlend") return Math.max(0, Math.round(Math.min(startDuration, transitionDuration, 2) * 100) / 100);
  if (key === "endBlend") return Math.max(0, Math.round(Math.min(endDuration, transitionDuration, 2) * 100) / 100);
  return 2;
}

function updateTransitionTrim(value) {
  const transition = getTransitionPick("transitionPick");
  const maxTrim = transition ? getAnimationDuration(transition.fileName, 1) : 1;
  if (!Number.isFinite(value)) return;
  state.transitionViewer.transitionTrim = Math.min(maxTrim, Math.max(0.05, Math.round(value * 100) / 100));
  const input = document.querySelector("[data-transition-trim]");
  if (input && document.activeElement !== input) input.value = state.transitionViewer.transitionTrim;
  const label = input?.closest(".transition-blend-panel")?.querySelector(".transition-blend-title strong");
  if (label) label.textContent = `${getTransitionTrimSeconds().toFixed(2)}s`;
  syncTransitionViewerConfigMemory();
  refreshTransitionTimelineDom();
}

function beginTransitionTimelineHandleDrag(event, handleKey) {
  event.preventDefault();
  event.stopPropagation();
  const track = event.currentTarget.closest(".transition-timeline-track");
  if (!track) return;
  const move = (moveEvent) => updateTransitionTimelineHandle(handleKey, moveEvent.clientX, track);
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
    render();
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop, { once: true });
}

function updateTransitionTimelineHandle(handleKey, clientX, track) {
  const rect = track.getBoundingClientRect();
  const metrics = getTransitionTimelineMetrics();
  const total = metrics.totalSeconds;
  const seconds = Math.min(total, Math.max(0, ((clientX - rect.left) / Math.max(rect.width, 1)) * total));
  if (metrics.hasTransition === false) {
    const b = Math.min(metrics.startSourceDuration, Math.max(0, seconds));
    state.transitionViewer.endBlend = Math.round(Math.max(0, metrics.startSourceDuration - b) * 100) / 100;
    syncTransitionViewerConfigMemory();
    refreshTransitionControlsDom();
    refreshTransitionTimelineDom();
    return;
  }
  let a = metrics.transitionLeftSeconds;
  let b = metrics.endLeftSeconds;
  let c = metrics.transitionEndSeconds;
  const maxTrimEnd = a + metrics.transitionSourceDuration;

  if (handleKey === "a") {
    a = Math.min(metrics.startSourceDuration, b, c - 0.05, Math.max(0, seconds));
  } else if (handleKey === "b") {
    b = Math.min(c, Math.max(metrics.startSourceDuration, seconds));
  } else if (handleKey === "c") {
    c = Math.min(maxTrimEnd, Math.max(b, a + 0.05, seconds));
  }

  state.transitionViewer.transitionPivot = Math.round(b * 100) / 100;
  state.transitionViewer.startBlend = Math.round(Math.max(0, metrics.startSourceDuration - a) * 100) / 100;
  state.transitionViewer.transitionTrim = Math.round(Math.max(0.05, c - a) * 100) / 100;
  state.transitionViewer.endBlend = Math.round(Math.max(0, c - b) * 100) / 100;
  syncTransitionViewerConfigMemory();
  refreshTransitionControlsDom();
  refreshTransitionTimelineDom();
}

function refreshTransitionControlsDom() {
  for (const key of ["startBlend", "endBlend"]) {
    const input = document.querySelector(`[data-transition-blend="${key}"]`);
    if (input) input.value = state.transitionViewer[key];
    const label = input?.closest(".transition-blend-panel")?.querySelector(".transition-blend-title strong");
    if (label) label.textContent = `${state.transitionViewer[key].toFixed(2)}s`;
  }
  const trimInput = document.querySelector("[data-transition-trim]");
  if (trimInput) trimInput.value = getTransitionTrimSeconds();
  const trimLabel = trimInput?.closest(".transition-blend-panel")?.querySelector(".transition-blend-title strong");
  if (trimLabel) trimLabel.textContent = `${getTransitionTrimSeconds().toFixed(2)}s`;
}

function refreshTransitionTimelineDom() {
  const metrics = getTransitionTimelineMetrics();
  const setBar = (tone, left, width) => {
    const bar = document.querySelector(`.transition-timeline-${tone}`);
    if (!bar) return;
    bar.style.left = `${left}%`;
    bar.style.width = `${width}%`;
  };
  setBar("start", metrics.startLeft, metrics.startWidth);
  setBar("mid", metrics.midLeft, metrics.midWidth);
  setBar("end", metrics.endLeft, metrics.endWidth);
  const handleA = document.querySelector('[data-transition-handle="a"]');
  const handleB = document.querySelector('[data-transition-handle="b"]');
  const handleC = document.querySelector('[data-transition-handle="c"]');
  if (handleA) handleA.style.left = `${metrics.handleA}%`;
  if (handleB) handleB.style.left = `${metrics.handleB}%`;
  if (handleC) handleC.style.left = `${metrics.handleC}%`;
}

function syncTransitionViewerConfigMemory() {
  state.config = normalizeEditorConfig({
    ...state.config,
    transitionViewer: serializeTransitionViewerState(),
  });
  updateEditorConfigMemory();
}

function getTransitionTimelineMetrics() {
  const start = getTransitionPick("start");
  const transition = getTransitionPick("transitionPick");
  const end = getTransitionPick("end");
  const startDuration = start ? (start.kind === "idle" ? 2 : getAnimationDuration(start.fileName, 2)) : 2;
  const endDuration = end ? (end.kind === "idle" ? 2 : getAnimationDuration(end.fileName, 2)) : 2;
  if (!transition) {
    const blendSeconds = Math.min(startDuration, endDuration, Math.max(0, state.transitionViewer.endBlend ?? 0.2));
    const endLeftSeconds = Math.max(0, startDuration - blendSeconds);
    const totalSeconds = Math.max(0.001, endLeftSeconds + endDuration);
    const percent = (seconds) => (seconds / totalSeconds) * 100;
    return {
      totalSeconds,
      startWindowSeconds: startDuration,
      startSourceDuration: startDuration,
      transitionSourceDuration: 0,
      transitionDuration: 0,
      endDuration,
      startBlendSeconds: 0,
      endBlendSeconds: blendSeconds,
      transitionLeftSeconds: 0,
      endLeftSeconds,
      transitionEndSeconds: 0,
      startLeft: 0,
      startWidth: percent(startDuration),
      midLeft: 0,
      midWidth: 0,
      endLeft: percent(endLeftSeconds),
      endWidth: percent(endDuration),
      handleA: 0,
      handleB: percent(endLeftSeconds),
      handleC: 0,
      hasTransition: false,
    };
  }
  const transitionSourceDuration = getAnimationDuration(transition.fileName, 1);
  const pivotFallback = Math.min(startDuration, Math.max(0, startDuration));
  const rawPivotSeconds = Math.max(0, normalizeFiniteNumber(state.transitionViewer.transitionPivot, 0) || pivotFallback);
  const startBlendSeconds = Math.min(startDuration, Math.max(0, state.transitionViewer.startBlend ?? 0.4));
  const endBlendSeconds = Math.min(endDuration, Math.max(0, state.transitionViewer.endBlend ?? 0.4));
  const minimumTrim = Math.max(0.05, startBlendSeconds + endBlendSeconds);
  const configuredTrim = Number(state.transitionViewer.transitionTrim);
  const transitionDuration = Math.min(
    transitionSourceDuration,
    Math.max(minimumTrim, Number.isFinite(configuredTrim) && configuredTrim > 0 ? configuredTrim : minimumTrim),
  );
  const transitionLeftSeconds = Math.max(0, startDuration - startBlendSeconds);
  const transitionEndSeconds = transitionLeftSeconds + transitionDuration;
  const pivotSeconds = Math.min(transitionEndSeconds, Math.max(startDuration, rawPivotSeconds));
  const endLeftSeconds = Math.min(transitionEndSeconds, Math.max(startDuration, pivotSeconds));
  const effectiveEndBlend = Math.max(0, transitionEndSeconds - endLeftSeconds);
  const effectiveStartBlend = Math.max(0, startDuration - transitionLeftSeconds);
  const totalSeconds = Math.max(0.001, Math.max(endLeftSeconds + endDuration, transitionEndSeconds));
  const startLeftSeconds = 0;
  const percent = (seconds) => (seconds / totalSeconds) * 100;
  return {
    totalSeconds,
    startWindowSeconds: startDuration,
    startSourceDuration: startDuration,
    transitionSourceDuration,
    transitionDuration,
    endDuration,
    startBlendSeconds: effectiveStartBlend,
    endBlendSeconds: effectiveEndBlend,
    transitionLeftSeconds,
    endLeftSeconds,
    transitionEndSeconds,
    startLeft: percent(startLeftSeconds),
    startWidth: percent(startDuration),
    midLeft: percent(transitionLeftSeconds),
    midWidth: percent(transitionDuration),
    endLeft: percent(endLeftSeconds),
    endWidth: percent(endDuration),
    handleA: percent(transitionLeftSeconds),
    handleB: percent(endLeftSeconds),
    handleC: percent(transitionEndSeconds),
  };
}

function getTransitionTrimSeconds() {
  const transition = getTransitionPick("transitionPick");
  const sourceDuration = transition ? getAnimationDuration(transition.fileName, 1) : 1;
  const configured = Number(state.transitionViewer.transitionTrim);
  if (!Number.isFinite(configured) || configured <= 0) return sourceDuration;
  return Math.min(sourceDuration, Math.max(0.05, configured));
}

function startTransitionTimeline(durationSeconds) {
  state.transitionViewer.timelineStartedAt = performance.now();
  state.transitionViewer.timelineDuration = Math.max(0.001, durationSeconds);
  state.transitionViewer.timelineProgress = 0;
}

function stopTransitionTimeline() {
  state.transitionViewer.timelineStartedAt = 0;
  state.transitionViewer.timelineDuration = 0;
}

function updateTransitionTimelineProgress() {
  if (!state.transitionViewer.timelineStartedAt || !state.transitionViewer.timelineDuration) return;
  const elapsed = (performance.now() - state.transitionViewer.timelineStartedAt) / 1000;
  state.transitionViewer.timelineProgress = clamp01(elapsed / state.transitionViewer.timelineDuration);
  const cursor = document.querySelector(".transition-timeline-cursor");
  if (cursor) cursor.style.left = `${state.transitionViewer.timelineProgress * 100}%`;
  if (state.transitionViewer.timelineProgress >= 1) stopTransitionTimeline();
}

async function playTransitionViewerSingle(fileName) {
  if (!fileName || !currentVrm) return;
  state.transitionViewer.runId = Date.now();
  state.transitionViewer.playing = false;
  state.transitionViewer.timelineProgress = 0;
  stopTransitionTimeline();
  await playTransitionViewerStep(fileName, isAnimationLoop(fileName), 0, { preserveCurrentAction: false });
}

async function playTransitionViewer() {
  const start = getTransitionPick("start");
  const transition = getTransitionPick("transitionPick");
  const end = getTransitionPick("end");
  if (!start || !end || !currentVrm) return;
  const runId = Date.now();
  state.transitionViewer.runId = runId;
  state.transitionViewer.playing = true;
  const metrics = getTransitionTimelineMetrics();
  startTransitionTimeline(metrics.totalSeconds);
  render();
  try {
    const startWindowSeconds = metrics.startWindowSeconds;
    const transitionDuration = metrics.transitionDuration;
    const startBlendSeconds = metrics.startBlendSeconds;
    const endBlendSeconds = metrics.endBlendSeconds;
    await playTransitionViewerStep(start.fileName, start.kind === "idle", 0, { preserveCurrentAction: false });
    if (!isCurrentTransitionRun(runId)) return;
    if (!transition) {
      await sleep(Math.max(0, startWindowSeconds - endBlendSeconds) * 1000);
      if (!isCurrentTransitionRun(runId)) return;
      await playTransitionViewerStep(end.fileName, end.kind === "idle", endBlendSeconds);
      if (!isCurrentTransitionRun(runId)) return;
      await sleep(endBlendSeconds * 1000);
      return;
    }
    await sleep(Math.max(0, startWindowSeconds - startBlendSeconds) * 1000);
    if (!isCurrentTransitionRun(runId)) return;
    await playTransitionViewerStep(transition.fileName, false, startBlendSeconds);
    if (!isCurrentTransitionRun(runId)) return;
    await sleep(Math.max(0, transitionDuration - endBlendSeconds) * 1000);
    if (!isCurrentTransitionRun(runId)) return;
    await playTransitionViewerStep(end.fileName, end.kind === "idle", endBlendSeconds);
    if (!isCurrentTransitionRun(runId)) return;
    await sleep(endBlendSeconds * 1000);
  } finally {
    if (isCurrentTransitionRun(runId)) {
      state.transitionViewer.playing = false;
      state.transitionViewer.timelineProgress = 1;
      stopTransitionTimeline();
      render();
    }
  }
}

async function playTransitionViewerStep(fileName, loop, transitionSeconds, options = {}) {
  state.selectedAnimationName = fileName;
  applyTransitionViewerLinkedExpression(fileName);
  const transition = await loadSelectedAnimation({ preserveCurrentAction: options.preserveCurrentAction !== false });
  playAnimationFromStart(loop, {
    previousAction: transition?.previousAction,
    transitionSeconds: transition?.previousAction ? transitionSeconds : 0,
  });
}

function applyTransitionViewerLinkedExpression(fileName) {
  const entry = getAnimationMetaEntry(fileName);
  if (entry.expressionPresetId) {
    applyLinkedExpressionPreset(entry.expressionPresetId);
  }
}

function isCurrentTransitionRun(runId) {
  return state.transitionViewer.runId === runId;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function loadSelectedAnimation(options = {}) {
  const entry = getSelectedAnimationEntry();
  if (!entry) {
    resetAnimationState(getAnimationNames().length ? "애니메이션을 선택하세요." : "New Ani로 애니메이션을 등록하세요.");
    return;
  }
  if (!currentVrm) {
    resetAnimationState("VRM을 열면 애니메이션 미리보기가 가능합니다.");
    return;
  }
  try {
    const result = await window.vrmFiles.openStoredAnimation(entry.fileName);
    return await loadAnimationResult(result, options);
  } catch (error) {
    resetAnimationState(`${entry.fileName} 파일을 animations 폴더에서 찾지 못했습니다.`);
  }
}

async function loadAnimationResult(result, options = {}) {
  if (!result) return null;
  const previousAction = options.preserveCurrentAction ? animationAction : null;
  const previousUrl = options.preserveCurrentAction ? animationUrl : null;
  try {
    if (!options.preserveCurrentAction) clearReferenceAnimation();
    const bytes = new Uint8Array(result.data);
    animationUrl = URL.createObjectURL(new Blob([bytes], { type: "model/gltf-binary" }));
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    const gltf = await loader.loadAsync(animationUrl);
    const vrmAnimation = gltf.userData.vrmAnimations?.[0];
    const clip = vrmAnimation ? createVRMAnimationClip(vrmAnimation, currentVrm) : gltf.animations?.[0];
    if (!clip) throw new Error("애니메이션 클립을 찾지 못했습니다.");

    animationMixer ??= new THREE.AnimationMixer(currentVrm.scene);
    animationAction = animationMixer.clipAction(clip);
    const metaEntry = getAnimationMetaEntry(result.name);
    configureAnimationLoop(metaEntry.loop, animationAction);
    animationAction.reset();
    animationAction.play();
    animationAction.paused = true;
    if (!options.preserveCurrentAction) {
      animationMixer.setTime(0);
      currentVrm?.update?.(0);
    }
    if (previousUrl && previousUrl !== animationUrl) URL.revokeObjectURL(previousUrl);

    state.animation = {
      fileName: result.name,
      clipName: clip.name || "Animation",
      duration: clip.duration,
      time: 0,
      playing: false,
      loop: Boolean(metaEntry.loop),
      message: "",
    };
    updateStoredAnimationDuration(result.name, clip.duration);
    return { previousAction };
  } catch (error) {
    clearReferenceAnimation();
    state.animation.message = error.message || String(error);
    return null;
  }
}

async function stepSelectedAnimation(direction) {
  const names = getAnimationNames();
  if (!names.length) return;
  const currentIndex = Math.max(0, names.indexOf(state.selectedAnimationName));
  const nextIndex = (currentIndex + direction + names.length) % names.length;
  state.selectedAnimationName = names[nextIndex];
  await loadSelectedAnimation();
  applyMotionCorrectionPreview();
  render();
}

async function selectAnimationFromFileList(animationName) {
  if (!animationName || !state.animationCatalog?.[animationName]) return;
  state.selectedAnimationName = animationName;
  await loadSelectedAnimation();
  applyMotionCorrectionPreview();
  render();
}

async function deleteSelectedAnimation() {
  if (!state.selectedAnimationName) return;
  const name = state.selectedAnimationName;
  const shouldDelete = window.confirm(`현재 애니메이션을 삭제할까요?\n${name}\n\n앱 공통 애니메이션 목록과 animations 폴더의 파일이 삭제됩니다.`);
  if (!shouldDelete) return;
  await window.vrmFiles.deleteStoredAnimation(name);
  const hadCharacterCorrection = Boolean(state.correction.animations[name]);
  delete state.correction.animations[name];
  await refreshAnimationCatalog();
  const names = getAnimationNames();
  state.selectedAnimationName = names[0] ?? null;
  if (hadCharacterCorrection && state.correctionPath) state.correctionDirty = true;
  await loadSelectedAnimation();
  applyMotionCorrectionPreview();
  render();
}

function toggleSelectedAnimationMustWatch() {
  const entry = getSelectedAnimationEntry();
  if (!entry) return;
  entry.mustWatchFull = !entry.mustWatchFull;
  window.vrmFiles.updateAnimationInfo(entry.fileName, { mustWatchFull: entry.mustWatchFull });
  render();
}

function updateSelectedAnimationDescription(value) {
  const entry = getSelectedAnimationEntry();
  if (!entry) return;
  entry.description = value;
  window.vrmFiles.updateAnimationInfo(entry.fileName, { description: value });
}

function updateAnimationExpressionLink(animationName, presetId) {
  const entry = ensureAnimationMetaEntry(animationName);
  if (!entry) return;
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  if (preset) {
    entry.expressionPresetId = preset.id;
    entry.expressionPresetName = preset.name;
  } else {
    delete entry.expressionPresetId;
    delete entry.expressionPresetName;
  }
  state.correctionDirty = true;
  syncSaveMetaButton();
}

function updateAnimationLoop(animationName, checked) {
  const entry = ensureAnimationMetaEntry(animationName);
  if (!entry) return;
  entry.loop = Boolean(checked);
  state.correctionDirty = true;
  if (state.selectedAnimationName === animationName && animationAction) {
    configureAnimationLoop(entry.loop);
  }
  syncSaveMetaButton();
}

function getAnimationPreviewDecaySeconds(animationName) {
  return normalizeDecaySeconds(state.decayPreviewSeconds?.[animationName]);
}

function updateAnimationDecaySeconds(animationName, value) {
  if (!animationName) return;
  state.decayPreviewSeconds[animationName] = normalizeDecaySeconds(value);
}

function nudgeAnimationDecaySeconds(animationName, direction) {
  updateAnimationDecaySeconds(animationName, getAnimationPreviewDecaySeconds(animationName) + direction);
  renderPreservingEmotionLinkerScroll();
}

async function playLinkedAnimation(animationName, options = {}) {
  if (!animationName) return;
  const scroller = document.querySelector(".emotion-linker-panel");
  const scrollTop = scroller?.scrollTop ?? 0;
  const entry = ensureAnimationMetaEntry(animationName);
  if (!entry) return;
  state.selectedAnimationName = animationName;
  const transition = await loadSelectedAnimation({ preserveCurrentAction: true });
  if (options.decay) {
    startLinkedExpressionDecay(entry.expressionPresetId, getAnimationPreviewDecaySeconds(animationName));
  } else {
    state.expressionDecay = null;
    applyLinkedExpressionPreset(entry.expressionPresetId);
  }
  playAnimationFromStart(Boolean(entry.loop), {
    previousAction: transition?.previousAction,
    transitionSeconds: transition?.previousAction ? 0.2 : 0,
  });
  render();
  const nextScroller = document.querySelector(".emotion-linker-panel");
  if (nextScroller) nextScroller.scrollTop = scrollTop;
}

function startLinkedExpressionDecay(presetId, duration) {
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  if (!preset) {
    state.expressionDecay = null;
    startExpressionTransition({}, 0, 0.2);
    return;
  }
  for (const item of state.expressionPresets) {
    item.value = item.id === preset.id ? 1 : 0;
  }
  state.selectedExpressionPresetId = preset.id;
  state.selectedExpressionRangeId = null;
  loadSelectedExpressionParameterDraft();
  state.expressionTransition = null;
  state.expressionDecay = {
    presetId: preset.id,
    elapsed: 0,
    duration: normalizeDecaySeconds(duration),
  };
  applyRorrParameterValues(getExpressionParametersAtValue(preset, 1, false, null, true), 1);
}

function applyLinkedExpressionPreset(presetId) {
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  if (!preset) {
    startExpressionTransition({}, 0, 0.2);
    return;
  }
  for (const item of state.expressionPresets) {
    item.value = item.id === preset.id ? 1 : 0;
  }
  state.selectedExpressionPresetId = preset.id;
  loadSelectedExpressionParameterDraft();
  transitionToSelectedEmotionPreset(0.2);
}

function clearReferenceAnimation() {
  clearMotionCorrectionPreview();
  animationMixer?.stopAllAction();
  animationMixer = null;
  animationAction = null;
  if (animationUrl) URL.revokeObjectURL(animationUrl);
  animationUrl = null;
  state.animation.time = 0;
  state.animation.duration = 0;
  state.animation.playing = false;
  lastCorrectionBases = new Map();
}

function resetAnimationState(message) {
  state.animation = {
    fileName: null,
    clipName: null,
    duration: 0,
    time: 0,
    playing: false,
    loop: true,
    message,
  };
}

function toggleAnimationPlayback() {
  if (!animationAction) return;
  state.animation.playing = !state.animation.playing;
  animationAction.paused = !state.animation.playing;
  updateAnimationControls();
}

function restartAnimation() {
  if (!animationAction) return;
  const entry = getAnimationMetaEntry(state.selectedAnimationName);
  playAnimationFromStart(Boolean(entry.loop));
}

function playAnimationFromStart(loop, options = {}) {
  if (!animationAction) return;
  clearMotionCorrectionPreview();
  configureAnimationLoop(loop, animationAction);
  state.animation.loop = Boolean(loop);
  state.animation.playing = true;
  state.animation.time = 0;
  animationAction.enabled = true;
  animationAction.paused = false;
  animationAction.reset();
  animationAction.setEffectiveWeight(1);
  animationAction.play();
  if (options.previousAction && options.previousAction !== animationAction && options.transitionSeconds > 0) {
    options.previousAction.enabled = true;
    options.previousAction.paused = false;
    options.previousAction.crossFadeTo(animationAction, options.transitionSeconds, false);
    window.setTimeout(() => {
      options.previousAction.stop();
    }, Math.ceil(options.transitionSeconds * 1000) + 80);
  }
  updateAnimationControls();
}

function configureAnimationLoop(loop, action = animationAction) {
  if (!action) return;
  if (loop) {
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
  } else {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
  }
}

function setAnimationTime(time) {
  if (!animationAction || !animationMixer) return;
  clearMotionCorrectionPreview();
  const nextTime = Math.min(Math.max(time, 0), state.animation.duration || 0);
  animationAction.paused = true;
  state.animation.playing = false;
  animationAction.time = nextTime;
  animationMixer.setTime(nextTime);
  state.animation.time = nextTime;
  currentVrm?.update?.(0);
  applyMotionCorrectionPreview();
  updateAnimationControls();
}

function updateAnimationControls() {
  const toggle = document.querySelector("#toggleAnimation");
  if (toggle) toggle.textContent = state.animation.playing ? "Pause" : "Play";
  const time = document.querySelector(".animation-time");
  if (time) time.textContent = `${formatAnimationTime(state.animation.time)} / ${formatAnimationTime(state.animation.duration)}`;
  const scrub = document.querySelector("[data-animation-time]");
  if (scrub && document.activeElement !== scrub) scrub.value = state.animation.time;
}

function checkTransferCompatibility() {
  state.transfer.report = getTransferReport();
  render();
}

async function applyTransfer() {
  const report = getTransferReport();
  state.transfer.report = report;
  if (!report.ok) {
    render();
    return;
  }

  state.transfer.busy = true;
  render();
  try {
    const sourceMesh = getSelectedTransferMesh("source");
    const targetMesh = getSelectedTransferMesh("target");
    const targetDocument = state.transfer.target.document;
    const nextBinary = copyFaceShapeKeys(
      state.transfer.source.document.json,
      state.transfer.source.document.binaryChunk,
      sourceMesh.index,
      targetDocument.json,
      targetDocument.binaryChunk,
      targetMesh.index,
    );
    const output = buildGlb(targetDocument.json, nextBinary);
    const result = await window.vrmFiles.saveAddedShapeKeys(state.transfer.target.filePath, output);
    state.transfer.target.bytes = output;
    state.transfer.target.document = parseGlb(output);
    state.transfer.target.faceMeshes = findFaceMeshesImproved(state.transfer.target.document.json);
    state.transfer.report = {
      ok: true,
      messages: [`Saved added shape keys file: ${result.filePath}`],
    };
  } catch (error) {
    state.transfer.report = { ok: false, messages: [error.message || String(error)] };
  } finally {
    state.transfer.busy = false;
    render();
  }
}

function getSelectedTransferMesh(kind) {
  const file = state.transfer[kind];
  const selected = state.transfer[kind === "source" ? "sourceMesh" : "targetMesh"];
  return file?.faceMeshes.find((mesh) => mesh.index === selected) ?? null;
}

function getTransferReport() {
  const source = state.transfer.source;
  const target = state.transfer.target;
  const sourceMesh = getSelectedTransferMesh("source");
  const targetMesh = getSelectedTransferMesh("target");
  const messages = [];

  if (!source) messages.push("A source VRM is not loaded.");
  if (!target) messages.push("B target VRM is not loaded.");
  if (!sourceMesh) messages.push("A Face mesh was not found.");
  if (!targetMesh) messages.push("B Face mesh was not found.");
  if (messages.length) return { ok: false, messages };

  messages.push(`A mesh: ${sourceMesh.name}, B mesh: ${targetMesh.name}`);
  if (sourceMesh.targetCount !== targetMesh.targetCount) {
    messages.push(`Shape key count differs: A ${sourceMesh.targetCount}, B ${targetMesh.targetCount}`);
  }
  const nameDiff = compareTargetNames(sourceMesh.targetNames, targetMesh.targetNames);
  messages.push(
    nameDiff.length
      ? `Same names will be overwritten and A-only shape keys will be appended. Differences: ${nameDiff.slice(0, 4).join(", ")}${nameDiff.length > 4 ? "..." : ""}`
      : "Shape key names already match.",
  );

  const mappingReport = estimatePositionMapping(
    source.document.json,
    source.document.binaryChunk,
    sourceMesh.index,
    target.document.json,
    target.document.binaryChunk,
    targetMesh.index,
  );
  messages.push(...mappingReport.messages);
  if (!mappingReport.ok) {
    messages.push("Warning: matched vertices are low. Output may contain zero or weak shape keys.");
  }
  messages.unshift("Ready to copy Face shape key data from A to B.");
  return { ok: true, messages };
}

async function loadVrm(bytes) {
  clearReferenceAnimation();
  resetAnimationState("기준 애니메이션을 불러오세요.");
  if (currentVrm) {
    scene.remove(currentVrm.scene);
    VRMUtils.deepDispose(currentVrm.scene);
    currentVrm = null;
  }
  if (currentUrl) URL.revokeObjectURL(currentUrl);

  currentUrl = URL.createObjectURL(new Blob([bytes], { type: "model/gltf-binary" }));
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(currentUrl);
  currentVrm = gltf.userData.vrm;
  if (!currentVrm) throw new Error("VRM 데이터를 읽지 못했습니다.");

  VRMUtils.rotateVRM0(currentVrm);
  scene.add(currentVrm.scene);
  frameModel(currentVrm.scene);
  applyCameraPreset(getCameraPresetForMode(state.mode));
  state.rorrParameters = collectShapeKeyParameters();
  applyParameterFilterFromConfig();
  state.parameterFilterOpen = false;
  captureBoneRestTransforms();
  applyAllExpressionPreviews();
  applySelectedEmotionPreset();
  applyMotionCorrectionPreview();
}

function frameModel(root) {
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const height = Math.max(size.y, 1);
  controls.target.set(center.x, center.y + height * 0.1, center.z);
  camera.position.set(center.x, center.y + height * 0.12, center.z + height * 1.65);
  camera.near = Math.max(height / 100, 0.01);
  camera.far = Math.max(height * 20, 100);
  camera.updateProjectionMatrix();
  controls.update();
}

function collectShapeKeyParameters() {
  const names = new Set();
  currentVrm?.scene?.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary) return;
    for (const name of Object.keys(object.morphTargetDictionary)) {
      names.add(name);
    }
  });
  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({
    id: name,
    label: name,
  }));
}

function applyRorrParameterValues(values, weight = 1) {
  if (!currentVrm) return;
  state.expressionTransition = null;
  applyRorrInfluenceValues(getWeightedRorrParameterValues(values, weight));
}

function startExpressionTransition(values, weight = 1, duration = 0.2) {
  if (!currentVrm) {
    applyRorrParameterValues(values, weight);
    return;
  }
  const to = getWeightedRorrParameterValues(values, weight);
  if (duration <= 0) {
    state.expressionTransition = null;
    applyRorrInfluenceValues(to);
    return;
  }
  state.expressionTransition = {
    elapsed: 0,
    duration,
    from: readCurrentRorrInfluenceValues(),
    to,
  };
}

function getWeightedRorrParameterValues(values, weight = 1) {
  const next = {};
  const clampedWeight = clampEmotionValue(weight);
  for (const parameter of state.rorrParameters) {
    next[parameter.id] = clampEmotionValue(values?.[parameter.id] ?? 0) * clampedWeight;
  }
  return next;
}

function readCurrentRorrInfluenceValues() {
  const next = {};
  const rorrNames = new Set(state.rorrParameters.map((parameter) => parameter.id));
  currentVrm?.scene?.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary || !Array.isArray(object.morphTargetInfluences)) return;
    for (const name of rorrNames) {
      const index = object.morphTargetDictionary[name];
      if (index == null || next[name] != null) continue;
      next[name] = clampEmotionValue(object.morphTargetInfluences[index] ?? 0);
    }
  });
  for (const name of rorrNames) {
    next[name] ??= 0;
  }
  return next;
}

function applyRorrInfluenceValues(values) {
  if (!currentVrm) return;
  const rorrNames = new Set(state.rorrParameters.map((parameter) => parameter.id));
  currentVrm.scene.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary || !Array.isArray(object.morphTargetInfluences)) return;
    for (const name of rorrNames) {
      const index = object.morphTargetDictionary[name];
      if (index == null) continue;
      object.morphTargetInfluences[index] = clampEmotionValue(values?.[name] ?? 0);
    }
  });
}

function updateExpressionTransition(delta) {
  const transition = state.expressionTransition;
  if (!transition) return;
  transition.elapsed += delta;
  const t = Math.min(1, transition.elapsed / Math.max(transition.duration, 0.001));
  const eased = t * t * (3 - 2 * t);
  const values = {};
  const names = new Set([...Object.keys(transition.from), ...Object.keys(transition.to)]);
  for (const name of names) {
    const from = transition.from[name] ?? 0;
    const to = transition.to[name] ?? 0;
    values[name] = from + (to - from) * eased;
  }
  applyRorrInfluenceValues(values);
  if (t >= 1) state.expressionTransition = null;
}

function updateExpressionDecay(delta) {
  const decay = state.expressionDecay;
  if (!decay) return;
  const preset = state.expressionPresets.find((item) => item.id === decay.presetId);
  if (!preset) {
    state.expressionDecay = null;
    return;
  }
  decay.elapsed += delta;
  const t = Math.min(1, decay.elapsed / Math.max(decay.duration, 0.001));
  const value = clampEmotionValue(1 - easeInOutCubic(t));
  preset.value = value;
  applyRorrParameterValues(getExpressionParametersAtValue(preset, value, false, null, true), 1);
  if (t >= 1) {
    preset.value = 0;
    applyRorrParameterValues(getExpressionParametersAtValue(preset, 0, false, null, true), 1);
    state.expressionDecay = null;
  }
}

function startEdit(expressionId) {
  const expression = getExpression(expressionId);
  state.editing = expressionId;
  state.editDraft = structuredClone(expression);
  state.dirtyEdit = false;
  state.confirmBack = false;
  render();
}

function requestBack() {
  if (state.dirtyEdit) {
    state.confirmBack = true;
    render();
    return;
  }
  leaveEditor();
}

function leaveEditor() {
  state.editing = null;
  state.editDraft = null;
  state.dirtyEdit = false;
  state.confirmBack = false;
  render();
}

function updateDraftParameter(index, value) {
  if (!state.editDraft?.parameters[index]) return;
  state.editDraft.parameters[index].value = value;
  setExpressionPreview(state.editDraft.id, 1);
  updateEditorExpressionControl(1);
  state.dirtyEdit = true;
  state.confirmBack = false;
  previewDraftExpression();
}

function previewDraftExpression() {
  if (!state.editDraft) return;
  const value = state.expressionValues.get(state.editDraft.id) ?? 1;
  setExpressionPreview(state.editDraft.id, value || 1, false);
  applyEditDraftMorphPreview();
}

async function saveCurrentExpression() {
  if (!state.editDraft || !state.dirtyEdit) return;

  pushUndo();
  applyDraftToJson(state.document.json, state.editDraft);
  state.expressions = extractExpressions(state.document.json);
  const rebuilt = buildGlb(state.document.json, state.document.binaryChunk);
  state.glb = rebuilt;
  const temp = await window.vrmFiles.writeTemp(state.filePath, rebuilt);
  state.tempPath = temp.tempPath;
  state.hasWorkspaceChanges = true;
  state.editing = state.editDraft.id;
  state.editDraft = structuredClone(getExpression(state.editing));
  state.dirtyEdit = false;
  state.confirmBack = false;
  await loadVrm(rebuilt);
  render();
}

async function commitAll() {
  if (!state.filePath || !state.glb || !state.hasWorkspaceChanges) return;
  const result = await window.vrmFiles.commit(state.filePath, state.glb);
  state.hasWorkspaceChanges = false;
  state.tempPath = null;
  render();
  alert(`저장 완료\n백업: ${result.backupPath}`);
}

function pushUndo() {
  state.undoStack.push({
    json: structuredClone(state.document.json),
    expressions: structuredClone(state.expressions),
  });
  if (state.undoStack.length > 30) state.undoStack.shift();
  state.redoStack = [];
}

async function restoreSnapshot(snapshot) {
  state.document.json = structuredClone(snapshot.json);
  state.expressions = extractExpressions(state.document.json);
  const rebuilt = buildGlb(state.document.json, state.document.binaryChunk);
  state.glb = rebuilt;
  await window.vrmFiles.writeTemp(state.filePath, rebuilt);
  state.hasWorkspaceChanges = true;
  if (state.editing) state.editDraft = structuredClone(getExpression(state.editing));
  await loadVrm(rebuilt);
  render();
}

async function undo() {
  const snapshot = state.undoStack.pop();
  if (!snapshot) return;
  state.redoStack.push({
    json: structuredClone(state.document.json),
    expressions: structuredClone(state.expressions),
  });
  await restoreSnapshot(snapshot);
}

async function redo() {
  const snapshot = state.redoStack.pop();
  if (!snapshot) return;
  state.undoStack.push({
    json: structuredClone(state.document.json),
    expressions: structuredClone(state.expressions),
  });
  await restoreSnapshot(snapshot);
}

function setExpressionPreview(expressionId, value, remember = true) {
  if (remember) state.expressionValues.set(expressionId, value);
  const expression = getExpression(expressionId);
  const manager = currentVrm?.expressionManager;
  if (!expression || !manager) return;

  const names = [
    expression.name,
    expression.presetName,
    expression.key,
    expression.name?.toLowerCase(),
    expression.presetName?.toLowerCase(),
  ].filter(Boolean);
  for (const name of names) {
    if (manager.getExpression?.(name)) {
      manager.setValue(name, value);
      manager.update?.();
      return;
    }
  }
}

function applyAllExpressionPreviews() {
  for (const [id, value] of state.expressionValues) {
    setExpressionPreview(id, value, false);
  }
}

function applyEditDraftMorphPreview() {
  if (!state.editDraft || !currentVrm) return;
  const expressionValue = state.expressionValues.get(state.editDraft.id) ?? 0;
  const previewWeight = clamp01(expressionValue);

  for (const param of state.editDraft.parameters ?? []) {
    const targetValue = clamp01(param.value) * previewWeight;
    currentVrm.scene.traverse((object) => {
      if (!object.isMesh || !Array.isArray(object.morphTargetInfluences)) return;
      const matchesVrm1 = param.nodeName && object.parent?.name === param.nodeName;
      const matchesVrm0 = param.meshName && object.name.includes(param.meshName);
      if (!matchesVrm1 && !matchesVrm0) return;
      if (param.index < object.morphTargetInfluences.length) {
        object.morphTargetInfluences[param.index] = targetValue;
      }
    });
  }
}

function getExpression(id) {
  return state.expressions.find((expression) => expression.id === id);
}

function createEmptyCorrection() {
  return {
    schemaVersion: 1,
    type: "vrm-animation-meta",
    vrm: {
      fileName: "",
      characterId: "",
      displayName: "",
      version: "",
    },
    units: {
      position: "meters",
      rotation: "degrees",
      scale: "multiplier",
      rotationOrder: "XYZ",
    },
    animations: {},
    expressionPresets: createDefaultEmotionPresets().map(({ id, name, locked, isDisableBlink, rangeSlots }) => ({ id, name, locked, isDisableBlink, rangeSlots })),
  };
}

function createEmptyBoneCorrection() {
  return {
    positionOffset: [0, 0, 0],
    rotationOffset: [0, 0, 0],
    scaleMultiplier: [1, 1, 1],
  };
}

function getSelectedCorrection() {
  return getBoneCorrection(state.selectedBone);
}

function getAnimationNames() {
  return Object.keys(state.animationCatalog ?? {}).sort((a, b) => a.localeCompare(b));
}

function getAnimationDisplayName(animationName) {
  return String(animationName ?? "").replace(/\.[^.]+$/, "");
}

function getAnimationDuration(animationName, fallback = 2) {
  const duration = Number(state.animationCatalog?.[animationName]?.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : fallback;
}

function updateStoredAnimationDuration(animationName, duration) {
  const fileName = fileNameFromPath(animationName);
  const nextDuration = Number(duration);
  if (!fileName || !Number.isFinite(nextDuration) || nextDuration <= 0) return;
  const entry = state.animationCatalog?.[fileName];
  if (!entry || Math.abs((entry.duration ?? 0) - nextDuration) < 0.01) return;
  entry.duration = Math.round(nextDuration * 1000) / 1000;
  window.vrmFiles.updateAnimationInfo(fileName, { duration: entry.duration }).catch(() => {});
}

function formatAnimationOptionLabel(animationName) {
  if (!animationName) return "";
  const entry = state.animationCatalog?.[animationName] ?? {};
  const displayName = getAnimationDisplayName(animationName);
  const description = String(entry.description ?? "").trim();
  return description ? `${displayName} / ${description}` : displayName;
}

function getTransitionLinkerAnimationNames(kind) {
  const names = getAnimationNames().filter((name) => {
    const entry = getAnimationMetaEntry(name);
    return Boolean(entry.expressionPresetId || state.animationCatalog?.[name]?.description);
  });
  const filtered = names.filter((name) => isAnimationRecommendedForTransitionKind(kind, name));
  return filtered.length ? filtered : names;
}

function formatTransitionLinkerOptionLabel(animationName) {
  if (!animationName) return "";
  const catalogEntry = state.animationCatalog?.[animationName] ?? {};
  const metaEntry = getAnimationMetaEntry(animationName);
  const preset = state.expressionPresets.find((item) => item.id === metaEntry.expressionPresetId);
  const title = String(catalogEntry.description ?? "").trim() || getAnimationDisplayName(animationName);
  return preset ? `${title} / ${preset.name}` : title;
}

function isAnimationLoop(animationName) {
  return Boolean(getAnimationMetaEntry(animationName).loop);
}

function isAnimationRecommendedForTransitionKind(kind, animationName) {
  if (!animationName) return true;
  const loop = isAnimationLoop(animationName);
  return kind === "idle" ? loop : !loop;
}

function getSelectedAnimationEntry() {
  if (!state.selectedAnimationName) return null;
  return state.animationCatalog?.[state.selectedAnimationName] ?? null;
}

function getAnimationMetaEntry(animationName) {
  if (!animationName) return {};
  const entry = state.correction.animations?.[animationName];
  return normalizeAnimationCorrectionEntry(entry ?? {});
}

function ensureAnimationMetaEntry(animationName) {
  if (!animationName || !state.animationCatalog?.[animationName]) return null;
  state.correction.animations[animationName] = normalizeAnimationCorrectionEntry(state.correction.animations[animationName] ?? {});
  return state.correction.animations[animationName];
}

function getSelectedAnimationCorrections() {
  if (!state.selectedAnimationName) return {};
  return state.correction.animations?.[state.selectedAnimationName]?.corrections ?? {};
}

function ensureSelectedAnimationCorrections() {
  if (!state.selectedAnimationName || !getSelectedAnimationEntry()) return null;
  const entry = ensureAnimationMetaEntry(state.selectedAnimationName);
  if (!entry) return null;
  entry.corrections ??= {};
  return entry.corrections;
}

function getBoneCorrection(boneName) {
  const existing = getSelectedAnimationCorrections()[boneName];
  if (existing) return normalizeBoneCorrection(existing);
  return createEmptyBoneCorrection();
}

function normalizeBoneCorrection(correction) {
  return {
    positionOffset: normalizeVector(correction.positionOffset, [0, 0, 0]),
    rotationOffset: normalizeVector(correction.rotationOffset, [0, 0, 0]),
    scaleMultiplier: normalizeVector(correction.scaleMultiplier, [1, 1, 1]),
  };
}

function normalizeVector(value, fallback) {
  return Array.from({ length: 3 }, (_item, index) => {
    const next = Number(value?.[index]);
    return Number.isFinite(next) ? next : fallback[index];
  });
}

function getMirrorBoneName(boneName) {
  if (boneName.startsWith("left")) {
    const mirror = `right${boneName.slice(4)}`;
    return HUMAN_BONE_SET.has(mirror) ? mirror : null;
  }
  if (boneName.startsWith("right")) {
    const mirror = `left${boneName.slice(5)}`;
    return HUMAN_BONE_SET.has(mirror) ? mirror : null;
  }
  return null;
}

function getMirroredCorrectionAxisValue(key, axis, value) {
  const sign = MIRROR_AXIS_SIGNS[key]?.[axis] ?? 1;
  return value * sign;
}

function updateCorrectionMeta(key, value) {
  if (key === "id") state.correction.vrm.characterId = value;
  if (key === "name") state.correction.vrm.displayName = value;
  state.correctionDirty = true;
  syncSaveMetaButton();
}

function updateVrmVersion(value) {
  if (value !== "1.0" && value !== "0.0") return;
  state.correction.vrm.version = value;
  state.correctionDirty = true;
  syncSaveMetaButton();
}

function updateCorrectionValue(key, axis, value) {
  if (!Number.isFinite(value)) return;
  const next = setCorrectionAxisValue(state.selectedBone, key, axis, value);
  const mirrorBone = getMirrorBoneName(state.selectedBone);
  if (mirrorBone) setCorrectionAxisValue(mirrorBone, key, axis, getMirroredCorrectionAxisValue(key, axis, value));
  state.correctionDirty = true;
  applyMotionCorrectionPreview();
  syncCorrectionInputs(key, axis, next[key][axis]);
  syncSaveMetaButton();
}

function updateCorrectionStep(key, value) {
  if (!Number.isFinite(value)) return;
  state.correctionSteps[key] = value;
  syncCorrectionStepButtons(key);
}

function nudgeCorrectionValue(key, axis, direction) {
  const current = getBoneCorrection(state.selectedBone)[key][axis];
  const delta = state.correctionSteps[key] ?? 0.01;
  updateCorrectionValue(key, axis, current + direction * delta);
}

function syncCorrectionInputs(key, axis, value) {
  const rounded = roundForInput(value);
  for (const input of document.querySelectorAll(`[data-correction-number="${key}"][data-axis="${axis}"]`)) {
    input.value = rounded;
  }
}

function syncCorrectionStepButtons(key) {
  const current = state.correctionSteps[key] ?? 0.01;
  for (const button of document.querySelectorAll(`[data-correction-step="${key}"]`)) {
    const value = Number(button.dataset.step);
    button.classList.toggle("active", Math.abs(current - value) < 0.000001);
  }
}

function syncSaveMetaButton() {
  const correctionButton = document.querySelector("#saveCorrection");
  if (correctionButton) correctionButton.disabled = !(state.correctionPath && state.correctionDirty);
  const expressionButton = document.querySelector("#saveExpressionMeta");
  if (expressionButton) expressionButton.disabled = !(state.correctionPath && state.expressionDirty);
}

function isEmotionControlElement(target) {
  return Boolean(target?.closest?.("input, button, select, textarea, .emotion-card-controls"));
}

function clampValueForCorrection(key, value) {
  if (key === "rotationOffset") return Math.min(45, Math.max(-45, value));
  if (key === "scaleMultiplier") return Math.min(1.5, Math.max(0.5, value));
  return Math.min(0.5, Math.max(-0.5, value));
}

function setCorrectionAxisValue(boneName, key, axis, value) {
  const corrections = ensureSelectedAnimationCorrections();
  if (!corrections) return createEmptyBoneCorrection();
  const next = getBoneCorrection(boneName);
  next[key][axis] = clampValueForCorrection(key, value);
  corrections[boneName] = next;
  pruneDefaultCorrection(boneName);
  return next;
}

function resetCorrectionField(key) {
  const next = resetCorrectionFieldForBone(state.selectedBone, key);
  const mirrorBone = getMirrorBoneName(state.selectedBone);
  if (mirrorBone) resetCorrectionFieldForBone(mirrorBone, key);
  state.correctionDirty = true;
  applyMotionCorrectionPreview();
  syncSaveMetaButton();
  for (let axis = 0; axis < 3; axis += 1) {
    syncCorrectionInputs(key, axis, next[key][axis]);
  }
}

function resetCorrectionFieldForBone(boneName, key) {
  const corrections = ensureSelectedAnimationCorrections();
  if (!corrections) return createEmptyBoneCorrection();
  const next = getBoneCorrection(boneName);
  next[key] = key === "scaleMultiplier" ? [1, 1, 1] : [0, 0, 0];
  corrections[boneName] = next;
  pruneDefaultCorrection(boneName);
  return next;
}

function resetSelectedBoneCorrection() {
  const corrections = ensureSelectedAnimationCorrections();
  if (!corrections) return;
  delete corrections[state.selectedBone];
  const mirrorBone = getMirrorBoneName(state.selectedBone);
  if (mirrorBone) delete corrections[mirrorBone];
  state.correctionDirty = true;
  applyMotionCorrectionPreview();
  syncSaveMetaButton();
  render();
}

function pruneDefaultCorrection(boneName) {
  const corrections = getSelectedAnimationCorrections();
  const correction = corrections[boneName];
  if (!correction) return;
  const isDefault =
    correction.positionOffset.every((value) => Math.abs(value) < 0.000001) &&
    correction.rotationOffset.every((value) => Math.abs(value) < 0.000001) &&
    correction.scaleMultiplier.every((value) => Math.abs(value - 1) < 0.000001);
  if (isDefault) delete corrections[boneName];
}

async function saveCorrection() {
  const modeBeforeSave = state.mode;
  const emotionLinkerScrollTop = document.querySelector(".emotion-linker-panel")?.scrollTop ?? 0;
  const correctionScrollTop = document.querySelector(".correction-panel")?.scrollTop ?? 0;
  const payload = JSON.stringify(serializeCorrection(), null, 2);
  const result = await window.vrmFiles.saveMeta(state.correctionPath, payload);
  if (!result) return;
  await saveEditorConfig();
  state.correctionPath = result.filePath;
  state.correctionDirty = false;
  state.expressionDirty = false;
  syncSaveMetaButton();
  render();
  if (modeBeforeSave === "linker") {
    const nextScroller = document.querySelector(".emotion-linker-panel");
    if (nextScroller) nextScroller.scrollTop = emotionLinkerScrollTop;
  }
  if (modeBeforeSave === "correction") {
    const nextScroller = document.querySelector(".correction-panel");
    if (nextScroller) nextScroller.scrollTop = correctionScrollTop;
  }
}

async function loadOrCreateVrmMeta(vrmPath, vrmName) {
  const initial = createEmptyCorrection();
  initial.vrm.fileName = vrmName;
  initial.vrm.displayName = vrmName.replace(/\.vrm$/i, "");
  initial.vrm.characterId = slugify(initial.vrm.displayName);
  initial.vrm.version = detectVrmVersion(state.document?.json);
  const result = await window.vrmFiles.loadOrCreateMeta(vrmPath, JSON.stringify(initial, null, 2));
  const text = dec.decode(new Uint8Array(result.data));
  let rawMeta;
  try {
    rawMeta = JSON.parse(text);
  } catch {
    rawMeta = initial;
    await window.vrmFiles.saveMeta(result.filePath, JSON.stringify(initial, null, 2));
  }
  state.correction = normalizeCorrectionJson(rawMeta);
  await refreshAnimationCatalog();
  await migrateAnimationInfoFromCharacterMeta(rawMeta);
  state.correction.vrm.fileName = vrmName;
  state.correction.vrm.displayName ||= vrmName.replace(/\.vrm$/i, "");
  state.correction.vrm.characterId ||= slugify(state.correction.vrm.displayName);
  state.correction.vrm.version ||= detectVrmVersion(state.document?.json);
  state.expressionPresets = normalizeExpressionPresets(state.correction.expressionPresets);
  state.selectedExpressionPresetId = state.expressionPresets[0]?.id ?? null;
  loadSelectedExpressionParameterDraft();
  state.correctionPath = result.filePath;
  state.correctionDirty = false;
  state.expressionDirty = false;
  const names = getAnimationNames();
  state.selectedAnimationName = names.includes(state.selectedAnimationName) ? state.selectedAnimationName : (names[0] ?? null);
}

async function refreshAnimationCatalog() {
  const catalog = await window.vrmFiles.listStoredAnimations();
  state.animationCatalog = {};
  for (const [fileName, animation] of Object.entries(catalog.animations ?? {})) {
    const safeName = fileNameFromPath(fileName);
    state.animationCatalog[safeName] = {
      fileName: safeName,
      description: String(animation.description ?? ""),
      mustWatchFull: Boolean(animation.mustWatchFull),
      duration: normalizeFiniteNumber(animation.duration, 0),
    };
  }
}

async function migrateAnimationInfoFromCharacterMeta(meta) {
  let changed = false;
  for (const [animationName, animation] of Object.entries(meta.animations ?? {})) {
    const fileName = fileNameFromPath(animationName);
    const catalogEntry = state.animationCatalog[fileName];
    if (!catalogEntry) continue;
    const patch = {};
    if (!catalogEntry.description && animation.description) patch.description = String(animation.description);
    if (!catalogEntry.mustWatchFull && animation.mustWatchFull) patch.mustWatchFull = true;
    if (!Object.keys(patch).length) continue;
    const updated = await window.vrmFiles.updateAnimationInfo(fileName, patch);
    state.animationCatalog[fileName] = {
      fileName,
      description: String(updated.description ?? ""),
      mustWatchFull: Boolean(updated.mustWatchFull),
      duration: normalizeFiniteNumber(updated.duration, catalogEntry.duration ?? 0),
    };
    changed = true;
  }
  if (changed) await refreshAnimationCatalog();
}

function normalizeCorrectionJson(json) {
  const next = createEmptyCorrection();
  next.schemaVersion = Number(json.schemaVersion) || 1;
  next.type = "vrm-animation-meta";
  next.vrm.fileName = String(json.vrm?.fileName ?? json.vrmFile ?? "");
  next.vrm.characterId = String(json.vrm?.characterId ?? json.character?.id ?? "");
  next.vrm.displayName = String(json.vrm?.displayName ?? json.character?.name ?? "");
  next.vrm.version = normalizeVrmVersion(json.vrm?.version ?? json.vrmVersion ?? "");
  for (const [animationName, animation] of Object.entries(json.animations ?? {})) {
    const fileName = fileNameFromPath(animationName);
    next.animations[fileName] = normalizeAnimationCorrectionEntry(animation);
  }
  if (json.corrections && !Object.keys(next.animations).length) {
    const legacyName = "legacy.vrma";
    next.animations[legacyName] = normalizeAnimationCorrectionEntry({ corrections: json.corrections });
  }
  next.expressionPresets = normalizeExpressionPresets(json.expressionPresets);
  return next;
}

function normalizeExpressionPresets(presets) {
  const source = Array.isArray(presets) && presets.length ? presets : createDefaultEmotionPresets();
  return source.map((preset, index) => ({
    id: String(preset.id ?? `emotion-${index}`),
    name: String(preset.name ?? "new emotion"),
    value: 0,
    locked: Boolean(preset.locked),
    isDisableBlink: Boolean(preset.isDisableBlink),
    parameters: normalizeExpressionParameterValues(preset.parameters),
    rangeSlots: normalizeExpressionRangeSlots(preset.rangeSlots),
  }));
}

function normalizeExpressionRangeSlots(slots) {
  if (!Array.isArray(slots)) return [];
  return slots
    .slice(0, 5)
    .map((slot, index) => ({
      id: String(slot?.id ?? `range-${index}`),
      threshold: clampEmotionValue(Number(slot?.threshold ?? 0.5)),
      parameters: normalizeExpressionParameterValues(slot?.parameters),
    }))
    .sort((a, b) => a.threshold - b.threshold);
}

function normalizeExpressionParameterValues(parameters) {
  const next = {};
  for (const [key, value] of Object.entries(parameters ?? {})) {
    next[String(key)] = clampEmotionValue(Number(value));
  }
  return next;
}

function detectVrmVersion(json) {
  if (json?.extensions?.VRMC_vrm) return "1.0";
  if (json?.extensions?.VRM) return "0.0";
  return "";
}

function normalizeVrmVersion(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "1" || text === "1.0" || text === "v1" || text === "v1.0" || text === "vrm1" || text === "vrm1.0") return "1.0";
  if (text === "0" || text === "0.0" || text === "v0" || text === "v0.0" || text === "vrm0" || text === "vrm0.0") return "0.0";
  return "";
}

function normalizeAnimationCorrectionEntry(animation) {
  const next = {
    loop: Boolean(animation?.loop),
    expressionPresetId: String(animation?.expressionPresetId ?? ""),
    expressionPresetName: String(animation?.expressionPresetName ?? ""),
    corrections: {},
  };
  for (const [boneName, correction] of Object.entries(animation.corrections ?? {})) {
    if (!HUMAN_BONES.includes(boneName)) continue;
    next.corrections[boneName] = normalizeBoneCorrection(correction);
    pruneCorrectionObject(next.corrections, boneName);
  }
  if (!next.expressionPresetId) delete next.expressionPresetId;
  if (!next.expressionPresetName) delete next.expressionPresetName;
  return next;
}

function serializeCorrection() {
  const next = normalizeCorrectionJson(state.correction);
  for (const animation of Object.values(next.animations)) {
    if (!animation.expressionPresetId) continue;
    const preset = state.expressionPresets.find((item) => item.id === animation.expressionPresetId);
    if (preset) animation.expressionPresetName = preset.name;
  }
  for (const animation of Object.values(next.animations)) {
    for (const boneName of Object.keys(animation.corrections)) {
      pruneCorrectionObject(animation.corrections, boneName);
    }
  }
  next.expressionPresets = normalizeExpressionPresets(state.expressionPresets).map(({ id, name, locked, isDisableBlink, parameters, rangeSlots }) => ({
    id,
    name,
    locked,
    isDisableBlink,
    parameters,
    rangeSlots,
  }));
  return next;
}

function pruneCorrectionObject(corrections, boneName) {
  const correction = corrections[boneName];
  if (!correction) return;
  const isDefault =
    correction.positionOffset.every((value) => Math.abs(value) < 0.000001) &&
    correction.rotationOffset.every((value) => Math.abs(value) < 0.000001) &&
    correction.scaleMultiplier.every((value) => Math.abs(value - 1) < 0.000001);
  if (isDefault) delete corrections[boneName];
}

function captureBoneRestTransforms() {
  state.boneRestTransforms = new Map();
  lastCorrectionBases = new Map();
  for (const boneName of HUMAN_BONES) {
    const bone = getRawBoneNode(boneName);
    if (!bone) continue;
    state.boneRestTransforms.set(boneName, {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone(),
    });
  }
}

function applyMotionCorrectionPreview() {
  if (!currentVrm || !state.boneRestTransforms.size) return;
  lastCorrectionBases = new Map();
  for (const boneName of HUMAN_BONES) {
    const bone = getRawBoneNode(boneName);
    if (!bone) continue;
    lastCorrectionBases.set(boneName, {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone(),
    });

    const correction = getSelectedAnimationCorrections()[boneName];
    if (!correction) continue;
    const normalized = normalizeBoneCorrection(correction);
    bone.position.add(new THREE.Vector3(...normalized.positionOffset));
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(normalized.rotationOffset[0]),
      THREE.MathUtils.degToRad(normalized.rotationOffset[1]),
      THREE.MathUtils.degToRad(normalized.rotationOffset[2]),
      "XYZ",
    );
    bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(euler));
    bone.scale.multiply(new THREE.Vector3(...normalized.scaleMultiplier));
  }
  currentVrm.scene.updateMatrixWorld(true);
}

function clearMotionCorrectionPreview() {
  if (!currentVrm || !lastCorrectionBases.size) return;
  for (const [boneName, base] of lastCorrectionBases) {
    const bone = getRawBoneNode(boneName);
    if (!bone) continue;
    bone.position.copy(base.position);
    bone.quaternion.copy(base.quaternion);
    bone.scale.copy(base.scale);
  }
  lastCorrectionBases = new Map();
  currentVrm.scene.updateMatrixWorld(true);
}

function getRawBoneNode(boneName) {
  return currentVrm?.humanoid?.getRawBoneNode?.(boneName) ?? null;
}

function getBoneAvailabilityText(boneName) {
  if (!currentVrm) return "VRM을 열면 보정 미리보기가 적용됩니다.";
  return getRawBoneNode(boneName)
    ? `${formatBoneName(boneName)} 본에 보정 미리보기가 적용됩니다.`
    : "현재 VRM에서 이 본을 찾지 못했습니다. JSON 저장은 가능합니다.";
}

function findFaceMeshesImproved(json) {
  const meshes = [];
  for (const [meshIndexText, mesh] of Object.entries(json.meshes ?? {})) {
    const meshIndex = Number(meshIndexText);
    const primitives = mesh.primitives ?? [];
    const targetNames = listMeshTargets(mesh).map((target) => target.name);
    const primitiveCount = primitives.length;
    const targetCount = Math.max(0, ...(primitives.map((primitive) => primitive.targets?.length ?? 0)), targetNames.length);
    const vertexCount = primitives.reduce((sum, primitive) => sum + getAccessorCount(json, primitive.attributes?.POSITION), 0);
    const morphVertexCount = primitives
      .filter((primitive) => primitive.targets?.length)
      .reduce((sum, primitive) => sum + getAccessorCount(json, primitive.attributes?.POSITION), 0);
    if (!targetCount || !morphVertexCount) continue;

    const nodeNames = (json.nodes ?? [])
      .filter((node) => node?.mesh === meshIndex)
      .map((node) => node.name ?? "");
    const materialNames = primitives
      .map((primitive) => json.materials?.[primitive.material]?.name)
      .filter(Boolean);
    const searchable = `${mesh.name ?? ""} ${nodeNames.join(" ")} ${materialNames.join(" ")} ${targetNames.join(" ")}`.toLowerCase();
    const score =
      (/(face|head|facial|kao|顔|顔面|얼굴)/i.test(searchable) ? 80 : 0) +
      (/(body|skin|体|몸)/i.test(searchable) ? 20 : 0) +
      (targetNames.some((name) => /fcl|eye|mouth|brow|blink|joy|angry|sorrow|surprised/i.test(name)) ? 60 : 0) +
      Math.min(targetCount, 80);

    meshes.push({
      index: meshIndex,
      name: mesh.name ?? `mesh ${meshIndex}`,
      label: mesh.name ?? `mesh ${meshIndex}`,
      vertexCount,
      morphVertexCount,
      targetCount,
      primitiveCount,
      targetNames,
      nodeNames,
      materialNames,
      score,
    });
  }

  return meshes.sort((a, b) => b.score - a.score || b.targetCount - a.targetCount || b.morphVertexCount - a.morphVertexCount);
}

function pickDefaultFaceMesh(meshes) {
  return meshes[0] ?? null;
}

function compareTargetNames(sourceNames, targetNames) {
  const max = Math.max(sourceNames.length, targetNames.length);
  const diff = [];
  for (let i = 0; i < max; i += 1) {
    if ((sourceNames[i] ?? "") !== (targetNames[i] ?? "")) {
      diff.push(`#${i}: ${sourceNames[i] ?? "(none)"} vs ${targetNames[i] ?? "(none)"}`);
    }
  }
  return diff;
}

function getAccessorCount(json, accessorIndex) {
  if (accessorIndex == null) return 0;
  return json.accessors?.[accessorIndex]?.count ?? 0;
}

function copyFaceShapeKeys(sourceJson, sourceBinary, sourceMeshIndex, targetJson, targetBinary, targetMeshIndex) {
  const result = transferShapeKeysByPosition(
    sourceJson,
    sourceBinary,
    sourceMeshIndex,
    targetJson,
    targetBinary,
    targetMeshIndex,
  );
  copyMissingExpressions(sourceJson, sourceMeshIndex, targetJson, targetMeshIndex, result.sourceIndexToNewIndex);
  return result.binary;
}

function estimatePositionMapping(sourceJson, sourceBinary, sourceMeshIndex, targetJson, targetBinary, targetMeshIndex) {
  const sourceVertices = collectMorphBaseVertices(sourceJson, sourceBinary, sourceMeshIndex);
  const targetVertices = collectMorphBaseVertices(targetJson, targetBinary, targetMeshIndex);
  const sourceMap = buildPositionMap(sourceVertices);
  let matched = 0;
  for (const vertex of targetVertices) {
    if (findNearestSourceVertex(sourceMap, vertex.position)) matched += 1;
  }
  const ratio = targetVertices.length ? matched / targetVertices.length : 0;
  return {
    ok: ratio >= 0.95,
    messages: [`Position mapping: ${matched}/${targetVertices.length} B morph vertices matched A (${Math.round(ratio * 100)}%).`],
    matched,
    total: targetVertices.length,
  };
}

function transferShapeKeysByPosition(sourceJson, sourceBinary, sourceMeshIndex, targetJson, targetBinary, targetMeshIndex) {
  const sourceMesh = sourceJson.meshes[sourceMeshIndex];
  const targetMesh = targetJson.meshes[targetMeshIndex];
  const sourceVertices = collectMorphBaseVertices(sourceJson, sourceBinary, sourceMeshIndex);
  const sourceMap = buildPositionMap(sourceVertices);
  const attrs = ["POSITION", "NORMAL", "TANGENT"];
  const sourceNames = listMeshTargets(sourceMesh).map((target) => target.name);
  const targetNames = listMeshTargets(targetMesh).map((target) => target.name);
  const targetNameSet = new Set(targetNames);
  const addedSourceNames = sourceNames.filter((name) => !targetNameSet.has(name));
  const desiredNames = targetNames.concat(addedSourceNames);
  const oldTargetNameToIndex = new Map(targetNames.map((name, index) => [name, index]));
  const newTargetNameToIndex = new Map(desiredNames.map((name, index) => [name, index]));
  const oldTargetIndexToNewIndex = new Map(
    targetNames.map((name, index) => [index, newTargetNameToIndex.get(name)]),
  );
  const sourceIndexToNewIndex = new Map(
    sourceNames.map((name, index) => [index, newTargetNameToIndex.get(name)]),
  );

  const oldWeights = Array.isArray(targetMesh.weights) ? targetMesh.weights.slice() : [];

  for (const targetPrimitive of targetMesh.primitives ?? []) {
    const targetPositions = readAccessorVec3(targetJson, targetBinary, targetPrimitive.attributes.POSITION);
    const sourceForTargetVertex = targetPositions.map((position) => findNearestSourceVertex(sourceMap, position));
    const matchedCount = sourceForTargetVertex.filter(Boolean).length;
    if (targetPositions.length && matchedCount / targetPositions.length < 0.5) {
      throw new Error(`Too few vertices matched for shape transfer: ${matchedCount}/${targetPositions.length}.`);
    }
    const oldTargets = targetPrimitive.targets?.slice() ?? [];
    const rebuiltTargets = [];

    for (let newShapeIndex = 0; newShapeIndex < desiredNames.length; newShapeIndex += 1) {
      const shapeName = desiredNames[newShapeIndex];
      const sourceShapeIndex = sourceNames.indexOf(shapeName);
      const oldTargetIndex = oldTargetNameToIndex.get(shapeName);
      if (sourceShapeIndex < 0) {
        const preservedTarget = { ...(oldTargets[oldTargetIndex] ?? {}) };
        if (preservedTarget.POSITION == null) {
          const appended = appendFloatAccessor(targetJson, targetBinary, new Float32Array(targetPositions.length * 3), "VEC3");
          targetBinary = appended.binary;
          preservedTarget.POSITION = appended.accessorIndex;
        }
        rebuiltTargets[newShapeIndex] = preservedTarget;
        continue;
      }

      const targetEntry = {};
      let positionDeltaAbsSum = 0;
      for (const attr of attrs) {
        const sourceRefWithAttr = sourceForTargetVertex.find((sourceRef) => sourceRef?.primitive.targets?.[sourceShapeIndex]?.[attr] != null);
        if (!sourceRefWithAttr) continue;
        const sourceAccessor = sourceRefWithAttr.primitive.targets[sourceShapeIndex][attr];
        const sourceInfo = getAccessorInfo(sourceJson, sourceAccessor);
        if (sourceInfo.type !== "VEC3" && sourceInfo.type !== "VEC4") continue;
        const componentCount = getTypeComponentCount(sourceInfo.type);
        const values = new Float32Array(targetPositions.length * componentCount);

        for (let vertexIndex = 0; vertexIndex < sourceForTargetVertex.length; vertexIndex += 1) {
          const sourceRef = sourceForTargetVertex[vertexIndex];
          if (!sourceRef) continue;
          const mappedSourceAccessor = sourceRef.primitive.targets?.[sourceShapeIndex]?.[attr];
          if (mappedSourceAccessor == null) continue;
          const sourceValues = readAccessorVector(sourceJson, sourceBinary, mappedSourceAccessor);
          const mappedInfo = getAccessorInfo(sourceJson, mappedSourceAccessor);
          const mappedComponentCount = getTypeComponentCount(mappedInfo.type);
          const copyCount = Math.min(componentCount, mappedComponentCount);
          for (let component = 0; component < copyCount; component += 1) {
            const nextValue = sourceValues[sourceRef.vertexIndex * mappedComponentCount + component];
            values[vertexIndex * componentCount + component] = nextValue;
            if (attr === "POSITION") positionDeltaAbsSum += Math.abs(nextValue);
          }
        }

        const appended = appendFloatAccessor(targetJson, targetBinary, values, sourceInfo.type);
        targetBinary = appended.binary;
        targetEntry[attr] = appended.accessorIndex;
      }
      if (targetEntry.POSITION == null) {
        const appended = appendFloatAccessor(targetJson, targetBinary, new Float32Array(targetPositions.length * 3), "VEC3");
        targetBinary = appended.binary;
        targetEntry.POSITION = appended.accessorIndex;
      }
      rebuiltTargets[newShapeIndex] = targetEntry;
    }
    targetPrimitive.targets = rebuiltTargets;
    targetPrimitive.extras = { ...(targetPrimitive.extras ?? {}), targetNames: desiredNames };
  }

  if (!targetMesh.extras) targetMesh.extras = {};
  targetMesh.extras.targetNames = desiredNames;
  targetMesh.weights = desiredNames.map((name) => {
    const oldIndex = oldTargetNameToIndex.get(name);
    return oldIndex == null ? 0 : Number(oldWeights[oldIndex] ?? 0);
  });
  validateMorphTargetStructure(targetJson, targetBinary, targetMeshIndex, desiredNames);
  remapTargetExpressionIndexes(targetJson, targetMeshIndex, oldTargetIndexToNewIndex);

  return {
    binary: targetBinary,
    sourceIndexToNewIndex,
  };
}

function collectMorphBaseVertices(json, binary, meshIndex) {
  const mesh = json.meshes?.[meshIndex];
  const vertices = [];
  for (const primitive of mesh?.primitives ?? []) {
    if (!primitive.targets?.length) continue;
    const positions = readAccessorVec3(json, binary, primitive.attributes.POSITION);
    for (let vertexIndex = 0; vertexIndex < positions.length; vertexIndex += 1) {
      vertices.push({ position: positions[vertexIndex], primitive, vertexIndex });
    }
  }
  return vertices;
}

function validateMorphTargetStructure(json, binary, meshIndex, targetNames) {
  const mesh = json.meshes?.[meshIndex];
  if (!mesh) throw new Error(`Target mesh ${meshIndex} not found after transfer.`);
  if ((mesh.extras?.targetNames?.length ?? 0) !== targetNames.length) {
    throw new Error("Shape key targetNames length does not match transferred target count.");
  }
  if ((mesh.weights?.length ?? 0) !== targetNames.length) {
    throw new Error("Shape key weights length does not match transferred target count.");
  }

  for (const [primitiveIndexText, primitive] of Object.entries(mesh.primitives ?? {})) {
    const primitiveIndex = Number(primitiveIndexText);
    const vertexCount = getAccessorCount(json, primitive.attributes?.POSITION);
    if ((primitive.targets?.length ?? 0) !== targetNames.length) {
      throw new Error(`Primitive ${primitiveIndex} shape key count does not match targetNames.`);
    }
    for (let targetIndex = 0; targetIndex < targetNames.length; targetIndex += 1) {
      const target = primitive.targets[targetIndex];
      if (!target?.POSITION) throw new Error(`Primitive ${primitiveIndex} shape key ${targetIndex} has no POSITION accessor.`);
      const accessor = json.accessors?.[target.POSITION];
      const view = json.bufferViews?.[accessor?.bufferView];
      if (!accessor || !view) throw new Error(`Primitive ${primitiveIndex} shape key ${targetIndex} POSITION accessor is incomplete.`);
      if (accessor.count !== vertexCount) {
        throw new Error(`Primitive ${primitiveIndex} shape key ${targetIndex} vertex count mismatch.`);
      }
      const byteOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      const byteLength = accessor.count * getTypeComponentCount(accessor.type) * getComponentSize(accessor.componentType);
      if (byteOffset + byteLength > binary.byteLength) {
        throw new Error(`Primitive ${primitiveIndex} shape key ${targetIndex} accessor is outside binary chunk.`);
      }
    }
  }
}

function buildPositionMap(vertices) {
  const map = new Map();
  for (const vertex of vertices) {
    const key = positionKey(vertex.position);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(vertex);
  }
  return map;
}

function positionKey(position) {
  return positionCell(position).join(",");
}

function positionCell(position) {
  return position.map((value) => Math.round(value / POSITION_MATCH_TOLERANCE));
}

function findNearestSourceVertex(positionMap, position) {
  const cell = positionCell(position);
  let best = null;
  let bestDistanceSq = POSITION_MATCH_TOLERANCE * POSITION_MATCH_TOLERANCE;
  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        const candidates = positionMap.get(`${cell[0] + x},${cell[1] + y},${cell[2] + z}`) ?? [];
        for (const candidate of candidates) {
          const distanceSq =
            (candidate.position[0] - position[0]) ** 2 +
            (candidate.position[1] - position[1]) ** 2 +
            (candidate.position[2] - position[2]) ** 2;
          if (distanceSq <= bestDistanceSq) {
            bestDistanceSq = distanceSq;
            best = candidate;
          }
        }
      }
    }
  }
  return best;
}

function readAccessorVec3(json, binary, accessorIndex) {
  const values = readAccessorVector(json, binary, accessorIndex);
  const info = getAccessorInfo(json, accessorIndex);
  const componentCount = getTypeComponentCount(info.type);
  const result = [];
  for (let i = 0; i < info.count; i += 1) {
    result.push([
      values[i * componentCount],
      values[i * componentCount + 1],
      values[i * componentCount + 2],
    ]);
  }
  return result;
}

function readAccessorVector(json, binary, accessorIndex) {
  const info = getAccessorInfo(json, accessorIndex);
  if (info.componentType !== 5126) throw new Error("Only float accessors are supported for shape transfer.");
  if (info.byteStride !== info.elementSize) throw new Error("Interleaved accessors are not supported for shape transfer.");
  const componentCount = getTypeComponentCount(info.type);
  const array = new Float32Array(info.count * componentCount);
  const view = new DataView(binary.buffer, binary.byteOffset + info.byteOffset, info.byteLength);
  for (let i = 0; i < array.length; i += 1) {
    array[i] = view.getFloat32(i * 4, true);
  }
  return array;
}

function appendFloatAccessor(json, binary, values, type) {
  const alignedOffset = align4(binary.byteLength);
  const byteLength = values.byteLength;
  const nextBinary = new Uint8Array(alignedOffset + byteLength);
  nextBinary.set(binary);
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  nextBinary.set(bytes, alignedOffset);

  const bufferViewIndex = json.bufferViews.length;
  json.bufferViews.push({
    buffer: 0,
    byteOffset: alignedOffset,
    byteLength,
  });
  if (json.buffers?.[0]) json.buffers[0].byteLength = nextBinary.byteLength;

  const accessorIndex = json.accessors.length;
  json.accessors.push({
    bufferView: bufferViewIndex,
    componentType: 5126,
    count: values.length / getTypeComponentCount(type),
    type,
  });
  updateAccessorMinMax(json, nextBinary, accessorIndex);
  return { binary: nextBinary, accessorIndex };
}

function align4(value) {
  return value + ((4 - (value % 4)) % 4);
}

function updateAccessorMinMax(json, binary, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const values = readAccessorVector(json, binary, accessorIndex);
  const componentCount = getTypeComponentCount(accessor.type);
  const min = Array(componentCount).fill(Infinity);
  const max = Array(componentCount).fill(-Infinity);
  for (let i = 0; i < accessor.count; i += 1) {
    for (let c = 0; c < componentCount; c += 1) {
      const value = values[i * componentCount + c];
      min[c] = Math.min(min[c], value);
      max[c] = Math.max(max[c], value);
    }
  }
  accessor.min = min;
  accessor.max = max;
}

function getAccessorInfo(json, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  const view = json.bufferViews?.[accessor?.bufferView];
  if (!accessor || !view) throw new Error(`Accessor ${accessorIndex} is incomplete.`);
  const componentSize = getComponentSize(accessor.componentType);
  const componentCount = getTypeComponentCount(accessor.type);
  const elementSize = componentSize * componentCount;
  return {
    buffer: view.buffer ?? 0,
    componentType: accessor.componentType,
    type: accessor.type,
    count: accessor.count,
    sparse: Boolean(accessor.sparse),
    elementSize,
    byteStride: view.byteStride ?? elementSize,
    byteOffset: (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0),
    byteLength: accessor.count * elementSize,
  };
}

function getComponentSize(componentType) {
  const sizes = {
    5120: 1,
    5121: 1,
    5122: 2,
    5123: 2,
    5125: 4,
    5126: 4,
  };
  if (!sizes[componentType]) throw new Error(`Unsupported component type: ${componentType}`);
  return sizes[componentType];
}

function getTypeComponentCount(type) {
  const counts = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  if (!counts[type]) throw new Error(`Unsupported accessor type: ${type}`);
  return counts[type];
}

function copyMissingExpressions(sourceJson, sourceMeshIndex, targetJson, targetMeshIndex, sourceIndexToNewIndex) {
  if (sourceJson.extensions?.VRMC_vrm?.expressions && targetJson.extensions?.VRMC_vrm?.expressions) {
    copyMissingVrm1Expressions(sourceJson, sourceMeshIndex, targetJson, targetMeshIndex, sourceIndexToNewIndex);
  }
  if (sourceJson.extensions?.VRM?.blendShapeMaster && targetJson.extensions?.VRM?.blendShapeMaster) {
    copyMissingVrm0Expressions(sourceJson, sourceMeshIndex, targetJson, targetMeshIndex, sourceIndexToNewIndex);
  }
}

function remapTargetExpressionIndexes(targetJson, targetMeshIndex, oldTargetIndexToNewIndex) {
  if (targetJson.extensions?.VRMC_vrm?.expressions) {
    remapVrm1ExpressionIndexes(targetJson, targetMeshIndex, oldTargetIndexToNewIndex);
  }
  if (targetJson.extensions?.VRM?.blendShapeMaster) {
    remapVrm0ExpressionIndexes(targetJson, targetMeshIndex, oldTargetIndexToNewIndex);
  }
}

function remapVrm1ExpressionIndexes(targetJson, targetMeshIndex, oldTargetIndexToNewIndex) {
  const targetNodes = new Set(
    (targetJson.nodes ?? [])
      .map((node, index) => (node?.mesh === targetMeshIndex ? index : null))
      .filter((item) => item != null),
  );
  const expressions = targetJson.extensions.VRMC_vrm.expressions;
  for (const scope of ["preset", "custom"]) {
    for (const expression of Object.values(expressions[scope] ?? {})) {
      expression.morphTargetBinds = (expression.morphTargetBinds ?? [])
        .map((bind) => {
          if (!targetNodes.has(bind.node)) return bind;
          const nextIndex = oldTargetIndexToNewIndex.get(bind.index);
          return nextIndex == null ? null : { ...bind, index: nextIndex };
        })
        .filter(Boolean);
    }
  }
}

function remapVrm0ExpressionIndexes(targetJson, targetMeshIndex, oldTargetIndexToNewIndex) {
  const groups = targetJson.extensions.VRM.blendShapeMaster.blendShapeGroups ?? [];
  for (const group of groups) {
    group.binds = (group.binds ?? [])
      .map((bind) => {
        if (bind.mesh !== targetMeshIndex) return bind;
        const nextIndex = oldTargetIndexToNewIndex.get(bind.index);
        return nextIndex == null ? null : { ...bind, index: nextIndex };
      })
      .filter(Boolean);
  }
}

function copyMissingVrm1Expressions(sourceJson, sourceMeshIndex, targetJson, targetMeshIndex, sourceIndexToNewIndex) {
  const sourceExpressions = sourceJson.extensions.VRMC_vrm.expressions;
  const targetExpressions = targetJson.extensions.VRMC_vrm.expressions;
  if (!targetExpressions.custom) targetExpressions.custom = {};
  const targetNode = findFirstNodeForMesh(targetJson, targetMeshIndex);
  const sourceNodes = new Set((sourceJson.nodes ?? []).map((node, index) => (node?.mesh === sourceMeshIndex ? index : null)).filter((item) => item != null));

  for (const [name, expression] of Object.entries(sourceExpressions.custom ?? {})) {
    if (targetExpressions.custom[name] || targetExpressions.preset?.[name]) continue;
    const copy = structuredClone(expression);
    copy.morphTargetBinds = (copy.morphTargetBinds ?? [])
      .filter((bind) => sourceNodes.has(bind.node))
      .map((bind) => {
        const nextIndex = getRemappedSourceIndex(sourceIndexToNewIndex, bind.index);
        return nextIndex == null ? null : { ...bind, node: targetNode, index: nextIndex };
      })
      .filter(Boolean);
    targetExpressions.custom[name] = copy;
  }
}

function copyMissingVrm0Expressions(sourceJson, sourceMeshIndex, targetJson, targetMeshIndex, sourceIndexToNewIndex) {
  const sourceGroups = sourceJson.extensions.VRM.blendShapeMaster.blendShapeGroups ?? [];
  const targetMaster = targetJson.extensions.VRM.blendShapeMaster;
  if (!targetMaster.blendShapeGroups) targetMaster.blendShapeGroups = [];
  const targetNames = new Set(targetMaster.blendShapeGroups.map((group) => group.name ?? group.presetName));

  for (const group of sourceGroups) {
    const name = group.name ?? group.presetName;
    if (!name || targetNames.has(name)) continue;
    const copy = structuredClone(group);
    copy.binds = (copy.binds ?? [])
      .filter((bind) => bind.mesh === sourceMeshIndex)
      .map((bind) => {
        const nextIndex = getRemappedSourceIndex(sourceIndexToNewIndex, bind.index);
        return nextIndex == null ? null : { ...bind, mesh: targetMeshIndex, index: nextIndex };
      })
      .filter(Boolean);
    targetMaster.blendShapeGroups.push(copy);
    targetNames.add(name);
  }
}

function getRemappedSourceIndex(sourceIndexToNewIndex, index) {
  if (!sourceIndexToNewIndex) return index;
  return sourceIndexToNewIndex.has(index) ? sourceIndexToNewIndex.get(index) : null;
}

function findFirstNodeForMesh(json, meshIndex) {
  const index = (json.nodes ?? []).findIndex((node) => node?.mesh === meshIndex);
  if (index < 0) throw new Error(`No node found for target mesh ${meshIndex}.`);
  return index;
}

function parseGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("GLB/VRM 파일이 아닙니다.");
  const chunks = [];
  let offset = 12;
  while (offset < bytes.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    chunks.push({ type, data: bytes.slice(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
  const binaryChunk = chunks.find((chunk) => chunk.type === 0x004e4942);
  if (!jsonChunk) throw new Error("VRM JSON 청크를 찾지 못했습니다.");
  return {
    json: JSON.parse(dec.decode(jsonChunk.data).trim()),
    binaryChunk: binaryChunk?.data ?? new Uint8Array(),
  };
}

function buildGlb(json, binaryChunk) {
  const jsonBytes = padBytes(enc.encode(JSON.stringify(json)), 0x20);
  const binBytes = padBytes(binaryChunk, 0x00);
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const output = new Uint8Array(total);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.set(jsonBytes, 20);
  const binOffset = 20 + jsonBytes.length;
  view.setUint32(binOffset, binBytes.length, true);
  view.setUint32(binOffset + 4, 0x004e4942, true);
  output.set(binBytes, binOffset + 8);
  return output;
}

function padBytes(bytes, pad) {
  const padded = new Uint8Array(bytes.length + ((4 - (bytes.length % 4)) % 4));
  padded.set(bytes);
  padded.fill(pad, bytes.length);
  return padded;
}

function extractExpressions(json) {
  if (json.extensions?.VRMC_vrm?.expressions) return extractVrm1Expressions(json);
  if (json.extensions?.VRM?.blendShapeMaster?.blendShapeGroups) return extractVrm0Expressions(json);
  return [];
}

function extractVrm1Expressions(json) {
  const expressions = json.extensions.VRMC_vrm.expressions;
  const targets = listVrm1MorphTargets(json);
  const entries = [];
  for (const scope of ["preset", "custom"]) {
    for (const [key, expression] of Object.entries(expressions[scope] ?? {})) {
      const existing = new Map(
        (expression.morphTargetBinds ?? []).map((bind) => [
          `${bind.node}:${bind.index}`,
          clamp01(Number(bind.weight ?? 0)),
        ]),
      );
      entries.push({
        id: `vrm1:${scope}:${key}`,
        version: "1",
        scope,
        key,
        name: expression.name || key,
        presetName: key,
        raw: expression,
        parameters: mergeVrm1Parameters(json, targets, existing, expression.morphTargetBinds ?? []),
      });
    }
  }
  return entries;
}

function listVrm1MorphTargets(json) {
  const targets = [];
  for (const [nodeIndexText, node] of Object.entries(json.nodes ?? {})) {
    if (!Number.isInteger(node.mesh)) continue;
    const nodeIndex = Number(nodeIndexText);
    const mesh = json.meshes?.[node.mesh];
    for (const target of listMeshTargets(mesh)) {
      targets.push({
        node: nodeIndex,
        nodeName: node.name ?? "",
        mesh: node.mesh,
        meshName: mesh?.name ?? "",
        index: target.index,
        label: `${node.name ?? `node ${nodeIndex}`} / ${target.name}`,
        meta: `node ${nodeIndex}, mesh ${node.mesh}, morph ${target.index}`,
      });
    }
  }
  return targets;
}

function mergeVrm1Parameters(json, targets, existing, originalBinds) {
  const parameters = targets.map((target) => ({
    ...target,
    value: existing.get(`${target.node}:${target.index}`) ?? 0,
  }));

  for (const bind of originalBinds) {
    if (parameters.some((param) => param.node === bind.node && param.index === bind.index)) {
      continue;
    }
    const node = json.nodes?.[bind.node];
    parameters.push({
      node: bind.node,
      nodeName: node?.name ?? "",
      mesh: node?.mesh,
      meshName: json.meshes?.[node?.mesh]?.name ?? "",
      index: bind.index,
      value: clamp01(Number(bind.weight ?? 0)),
      label: `${node?.name ?? `node ${bind.node}`} / morph ${bind.index}`,
      meta: `node ${bind.node}, morph ${bind.index}`,
    });
  }

  return parameters;
}

function extractVrm0Expressions(json) {
  const targets = listVrm0MorphTargets(json);
  return json.extensions.VRM.blendShapeMaster.blendShapeGroups.map((group, groupIndex) => ({
    id: `vrm0:${groupIndex}`,
    version: "0",
    groupIndex,
    key: group.name ?? group.presetName ?? `${groupIndex}`,
    name: group.name ?? group.presetName ?? `Expression ${groupIndex + 1}`,
    presetName: group.presetName,
    raw: group,
    parameters: mergeVrm0Parameters(json, targets, group.binds ?? []),
  }));
}

function listVrm0MorphTargets(json) {
  const targets = [];
  for (const [meshIndexText, mesh] of Object.entries(json.meshes ?? {})) {
    const meshIndex = Number(meshIndexText);
    for (const target of listMeshTargets(mesh)) {
      targets.push({
        mesh: meshIndex,
        meshName: mesh.name ?? "",
        index: target.index,
        label: `${mesh.name ?? `mesh ${meshIndex}`} / ${target.name}`,
        meta: `mesh ${meshIndex}, morph ${target.index}`,
      });
    }
  }
  return targets;
}

function mergeVrm0Parameters(json, targets, originalBinds) {
  const existing = new Map(
    originalBinds.map((bind) => [`${bind.mesh}:${bind.index}`, clamp01(Number(bind.weight ?? 0) / 100)]),
  );
  const parameters = targets.map((target) => ({
    ...target,
    value: existing.get(`${target.mesh}:${target.index}`) ?? 0,
  }));

  for (const bind of originalBinds) {
    if (parameters.some((param) => param.mesh === bind.mesh && param.index === bind.index)) {
      continue;
    }
    const mesh = json.meshes?.[bind.mesh];
    parameters.push({
      mesh: bind.mesh,
      meshName: mesh?.name ?? "",
      index: bind.index,
      value: clamp01(Number(bind.weight ?? 0) / 100),
      label: `${mesh?.name ?? `mesh ${bind.mesh}`} / morph ${bind.index}`,
      meta: `mesh ${bind.mesh}, morph ${bind.index}`,
    });
  }

  return parameters;
}

function listMeshTargets(mesh) {
  if (!mesh) return [];
  const targetNames =
    mesh.extras?.targetNames ??
    mesh.primitives?.find((primitive) => primitive.extras?.targetNames)?.extras?.targetNames ??
    [];
  const primitiveTargetCount = Math.max(
    0,
    ...(mesh.primitives ?? []).map((primitive) => primitive.targets?.length ?? 0),
  );
  const count = Math.max(targetNames.length, primitiveTargetCount);
  return Array.from({ length: count }, (_item, index) => ({
    index,
    name: targetNames[index] ?? `morph ${index}`,
  }));
}

function applyDraftToJson(json, draft) {
  if (draft.version === "1") {
    const expression = json.extensions.VRMC_vrm.expressions[draft.scope][draft.key];
    expression.morphTargetBinds = draft.parameters
      .filter((param) => clamp01(param.value) > 0)
      .map((param) => ({
        node: param.node,
        index: param.index,
        weight: clamp01(param.value),
      }));
  }

  if (draft.version === "0") {
    const group = json.extensions.VRM.blendShapeMaster.blendShapeGroups[draft.groupIndex];
    group.binds = draft.parameters
      .filter((param) => clamp01(param.value) > 0)
      .map((param) => ({
        mesh: param.mesh,
        index: param.index,
        weight: Math.round(clamp01(param.value) * 10000) / 100,
      }));
  }
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function roundForInput(value) {
  return Math.round(value * 1000) / 1000;
}

function formatDeltaOption(value) {
  if (value === 1) return "1";
  if (value === 0.1) return ".1";
  if (value === 0.01) return ".01";
  return String(value);
}

function formatAnimationTime(value) {
  if (!Number.isFinite(value)) return "0:00.00";
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

function formatBoneName(value) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function formatModeName(value) {
  if (value === "transfer") return "Shape Transfer";
  if (value === "correction") return "Motion Correction";
  if (value === "expression") return "Expression Editor";
  if (value === "linker") return "Emotion Linker";
  return "Viewer";
}

function slugify(value) {
  return String(value || "character")
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fileNameFromPath(filePath) {
  return String(filePath).split(/[\\/]/).pop();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  }
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    redo();
  }
});

function resize() {
  const host = document.querySelector(".viewer");
  if (!host) return;
  const rect = host.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / Math.max(rect.height, 1);
  camera.updateProjectionMatrix();
}

controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.screenSpacePanning = true;

function tick() {
  requestAnimationFrame(tick);
  const delta = clock.getDelta();
  controls.update();
  updateCameraTransition(delta);
  updateTransitionTimelineProgress();
  clearMotionCorrectionPreview();
  if (animationMixer && state.animation.playing) {
    animationMixer.update(delta);
    state.animation.time = animationAction?.time ?? state.animation.time;
    if (state.animation.duration && state.animation.time >= state.animation.duration) {
      if (state.animation.loop) {
        state.animation.time %= state.animation.duration;
      } else {
        state.animation.time = state.animation.duration;
        state.animation.playing = false;
        if (animationAction) animationAction.paused = true;
      }
    }
    updateAnimationControls();
  }
  updateExpressionDecay(delta);
  updateExpressionTransition(delta);
  currentVrm?.update?.(delta);
  applyMotionCorrectionPreview();
  applyEditDraftMorphPreview();
  renderer.render(scene, camera);
}

render();
tick();
