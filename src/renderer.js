import "./styles.css";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from "@pixiv/three-vrm-animation";
import {
  ArrowLeft,
  Camera,
  Download,
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
const EMOTION_GRAPH_WIDTH = 280;
const EMOTION_GRAPH_HEIGHT = 148;
const EMOTION_HEAD_ROTATION_MIN = -10;
const EMOTION_HEAD_ROTATION_MAX = 10;
const EMOTION_MAP_X_VALUES = [-1, -0.5, 0, 0.5, 1];
const EMOTION_MAP_Y_VALUES = [0, 0.33, 0.66, 1];
const EMOTION_MAP_Y_MIN = 0;
const EMOTION_MAP_Y_MAX = 1;
const EMOTION_MAP_POINTS = [
  { index: 1, x: -1, y: 1, label: "극대노" },
  { index: 2, x: -0.5, y: 1, label: "분노 / 격앙" },
  { index: 3, x: 0, y: 1, label: "압도 / 패닉" },
  { index: 4, x: 0.5, y: 1, label: "환희 / 흥분" },
  { index: 5, x: 1, y: 1, label: "파안대소" },
  { index: 6, x: -1, y: 0.66, label: "짜증 / 경계" },
  { index: 7, x: -0.5, y: 0.66, label: "불안 / 긴장" },
  { index: 8, x: 0, y: 0.66, label: "놀람" },
  { index: 9, x: 0.5, y: 0.66, label: "들뜸" },
  { index: 10, x: 1, y: 0.66, label: "신남" },
  { index: 11, x: -1, y: 0.33, label: "실망" },
  { index: 12, x: -0.5, y: 0.33, label: "삐짐 / 불만" },
  { index: 13, x: 0, y: 0.33, label: "당황 / 멈칫" },
  { index: 14, x: 0.5, y: 0.33, label: "피식 웃음" },
  { index: 15, x: 1, y: 0.33, label: "만족" },
  { index: 16, x: -1, y: 0, label: "차가움 / 무심" },
  { index: 17, x: -0.5, y: 0, label: "무기력" },
  { index: 18, x: 0, y: 0, label: "무표정 / 기본" },
  { index: 19, x: 0.5, y: 0, label: "안도 / 편안" },
  { index: 20, x: 1, y: 0, label: "은은한 호감" },
];

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
  linkerTransitionSeconds: 0.2,
  emotionLinker: createEmptyEmotionLinkerMeta(),
  emotionLinker2: createEmptyEmotionLinker2Meta(),
  emotionLinkerPath: null,
  emotionLinker2Path: null,
  activeLinkTimeline: null,
  selectedMotionSlotId: null,
  emotionMapCursor: { x: 0, y: 0 },
  selectedEmotionMapSlotIndex: 1,
  emotionMapTransitionSeconds: 0.3,
  emotionMapBindings: Array.from({ length: 20 }, () => null),
  emotionMapLabels: Array.from({ length: 20 }, () => ""),
  emotionMapPresetRangeSelections: {},
  emotionMapTempPath: null,
  editingMotionSlotTitleId: null,
  editingMotionSlotTitleValue: "",
  selectedPropId: null,
  propTransformMode: "translate",
  blushPanelMinimized: false,
  emotionImagePanelMinimized: false,
  selectedEmotionImageGraph: { graph: "scaleGraph", index: 0 },
  emotionImageAnimation: null,
  emotionMapActiveEmotionImage: null,
  emotionImagePivotPicking: false,
  screenshot: {
    selecting: false,
    message: "",
    rect: { x: 0.62, y: 0.16, width: 0.28, height: 0.42 },
  },
  correctionRightTab: "outline",
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
    trayMode: "transition",
    sequence: [],
    sequencePlaying: false,
    sequenceActiveIndex: -1,
    playing: false,
    runId: 0,
    timelineStartedAt: 0,
    timelineDuration: 0,
    timelineProgress: 0,
  },
  lipSyncPreview: {
    text: "",
    playing: false,
    elapsed: 0,
    duration: 0,
    timeline: [],
    activeShape: "",
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
  activeRorrInfluenceValues: {},
  blink: {
    elapsed: 0,
    nextDelay: 0.5 + Math.random() * 4.5,
    duration: 0.16,
    closing: false,
  },
  lookAtCameraActive: false,
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
  metaImportReport: null,
  selectedExtraBoneFollowId: null,
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
  separateMirrorBoneCorrection: false,
  extraBoneGizmoVisible: false,
  correctionSteps: {
    rotationOffset: 0.1,
  },
  boneRestTransforms: new Map(),
};

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
camera.position.set(0, 1.35, 3.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
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
let lastExtraBoneFollowBases = new Map();
let blushOverlay = null;
let emotionImageOverlay = null;
let emotionImageTransformControls = null;
let emotionImageTransformDragging = false;
let emotionImageHeadRotationOffset = null;
let blushOverlayRequestId = 0;
let emotionImageOverlayRequestId = 0;
let propOverlay = null;
let propTransformControls = null;
let propTransformDragging = false;
const propWorldPosition = new THREE.Vector3();
const emotionImageRollAxis = new THREE.Vector3(0, 0, 1);
const emotionImageRollQuat = new THREE.Quaternion();
const emotionImageRaycaster = new THREE.Raycaster();
const emotionImagePointer = new THREE.Vector2();

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
    emotionImage: null,
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
    sequencePlaying: false,
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
    trayMode: "transition",
    sequence: [],
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
  next.trayMode = config?.trayMode === "sequence" ? "sequence" : "transition";
  next.sequence = normalizeTransitionSequence(config?.sequence);
  return next;
}

function normalizeTransitionSequence(sequence) {
  if (!Array.isArray(sequence)) return [];
  return sequence
    .slice(0, 10)
    .map((slot, index) => ({
      id: String(slot?.id || `sequence-slot-${index}`),
      fileName: String(slot?.fileName ?? ""),
      loopCount: Math.max(1, Math.min(99, Math.round(normalizeFiniteNumber(slot?.loopCount, 1)))),
      transitionSeconds: clampSequenceTransitionSeconds(normalizeFiniteNumber(slot?.transitionSeconds, 0.2)),
    }))
    .filter((slot) => slot.fileName);
}

function normalizeCameraPresets(presets) {
  const next = {};
  for (const mode of ["transfer", "correction", "expression", "emotionMap", "linker", "linker2", "extraBone", "transitionViewer"]) {
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
    trayMode: state.transitionViewer.trayMode,
    sequence: state.transitionViewer.sequence,
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
  state.selectedAnimationName = getDefaultAnimationName() ?? names[0] ?? null;
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

function blushIconSvg(size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="8.1" />
    <path d="M8.4 14.1l2.1-3.1" />
    <path d="M11.8 14.1l2.1-3.1" />
    <path d="M15.2 14.1l2.1-3.1" />
  </svg>`;
}

function blinkDisabledSvg(size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.8 12.4c2.2 2.5 4.6 3.8 7.2 3.8" />
    <path d="M14 16.2c2.8 0 5.2-1.3 7.2-3.8" />
    <path d="M5.1 14.6l-1.7 2" />
    <path d="M9.2 16l-.8 2.2" />
    <path d="M15 16l.8 2.2" />
    <path d="M19 14.6l1.7 2" />
    <path d="M4.3 21.2L19.7 2.8" />
  </svg>`;
}

function emotionImageIconSvg(size = 20) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.7 9.1v2" />
    <path d="M15.3 9.1v2" />
    <path d="M8.5 15.2c1.8 1.7 5.2 1.7 7 0" />
  </svg>`;
}

function pivotIconSvg(size = 18) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M12 7v10" />
    <path d="M7 12h10" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
  </svg>`;
}

function crossedDriversSvg(size = 22) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 3l16 16" />
    <path d="M3 5l3-3 3 3-3 3z" />
    <path d="M18 16l3 3-2 2-3-3" />
    <path d="M19 3L3 19" />
    <path d="M21 5l-3-3-3 3 3 3z" />
    <path d="M6 16l-3 3 2 2 3-3" />
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function render() {
  if (!app.innerHTML) {
    app.innerHTML = "";
  }
  const isExpressionLayout = state.mode === "expression" && !state.editing;
  const isTransitionLayout = state.mode === "transitionViewer";
  const hasEmptyRightTray = state.mode === "correction" || state.mode === "linker" || state.mode === "linker2" || state.mode === "emotionMap";
  app.innerHTML = `
    <main class="app ${isExpressionLayout ? "expression-layout" : ""} ${isTransitionLayout ? "transition-layout" : ""} ${hasEmptyRightTray ? "empty-right-layout" : ""}">
      <aside class="sidebar">
        ${
          state.mode === "correction"
            ? renderMotionCorrectionPanel()
            : state.mode === "linker"
            ? renderEmotionLinkerPanel()
            : state.mode === "linker2"
            ? renderEmotionLinker2Panel()
            : state.mode === "emotionMap"
            ? renderEmotionMapPanel()
            : state.mode === "extraBone"
            ? renderExtraBoneFollowPanel()
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
        ${renderScreenshotTools()}
        ${renderScreenshotSelectionOverlay()}
        ${renderViewerLightControl()}
        ${renderExtraBoneGizmoControls()}
        ${renderExtraBoneGizmoOverlay()}
        ${renderEmotionLinkerTransitionControl()}
        ${renderLipSyncPreviewOverlay()}
        ${renderBlushOverlayPanel()}
        ${renderEmotionImageOverlayPanel()}
        ${renderMetaImportOverlay()}
        ${renderMotionSlotTitleOverlay()}
        ${renderEmotionMapOverlay()}
        ${state.mode === "transitionViewer" && state.transitionViewer.trayMode !== "sequence" ? renderTransitionTimelineOverlay() : ""}
      </section>
      ${state.mode === "expression" && !state.editing ? renderEmotionParameterTrayWithSave() : ""}
      ${state.mode === "transitionViewer" ? renderTransitionViewerTray() : ""}
      ${state.mode === "correction" ? renderCorrectionRightTray() : state.mode === "emotionMap" ? renderEmotionMapRightTray() : state.mode === "linker" || state.mode === "linker2" ? renderEmptyRightTray() : ""}
    </main>
  `;

  document.querySelector("#canvasHost")?.appendChild(renderer.domElement);
  attachHeaderMetaButtons();
  bindUi();
  resize();
}

function attachHeaderMetaButtons() {
  for (const openButton of document.querySelectorAll("#openFile")) {
    if (openButton.nextElementSibling?.classList?.contains("meta-load-button")) continue;
    const metaButton = document.createElement("button");
    metaButton.type = "button";
    metaButton.className = "icon-button meta-load-button";
    metaButton.id = "importMetaSettings";
    metaButton.title = "Meta 불러오기";
    metaButton.textContent = ".m";
    metaButton.disabled = !state.correctionPath;
    openButton.insertAdjacentElement("afterend", metaButton);
  }
}

function renderEmptyRightTray() {
  return `<aside class="mode-empty-tray" aria-hidden="true"></aside>`;
}

function renderEmotionMapRightTray() {
  return `
    <aside class="mode-empty-tray emotion-map-right-tray">
      <div class="emotion-map-coordinate-readout">
        <strong>Picked Coordinate</strong>
        <div>
          <span>X</span>
          <b data-emotion-map-readout-x>${formatSignedNumber(state.emotionMapCursor.x)}</b>
        </div>
        <div>
          <span>Y</span>
          <b data-emotion-map-readout-y>${state.emotionMapCursor.y.toFixed(2)}</b>
        </div>
      </div>
      <div class="emotion-map-slot-list">
        ${EMOTION_MAP_POINTS.map((point) => renderEmotionMapTargetSlot(point.index)).join("")}
      </div>
    </aside>
  `;
}

function renderEmotionMapTargetSlot(index) {
  const binding = getEmotionMapBinding(index);
  const selected = state.selectedEmotionMapSlotIndex === index;
  const label = state.emotionMapLabels[index - 1] ?? "";
  return `
    <div class="emotion-map-target-slot ${selected ? "selected" : ""} ${binding ? "bound" : ""}" data-emotion-map-slot="${index}">
      <span>${index}</span>
      <strong>${binding ? escapeHtml(binding.name) : "Empty"}</strong>
      <input type="text" value="${escapeHtml(label)}" placeholder="" data-emotion-map-name="${index}" />
    </div>
  `;
}

function renderEmotionMapPanel() {
  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Emotion Map</h1>
        <p>감정 좌표에 표정 프리셋을 배치합니다</p>
      </div>
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
    </div>
    ${renderModeBar("emotionMap")}
    <div class="emotion-map-preset-panel">
      <div class="emotion-map-preset-head">
        <strong>Expression Presets</strong>
        <span>${state.expressionPresets.length}</span>
      </div>
      <div class="emotion-map-preset-list">
        ${state.expressionPresets.map((preset) => renderEmotionMapPresetSlot(preset)).join("")}
      </div>
    </div>
    <div class="correction-footer">
      <button class="primary-button" id="saveCorrection" ${state.correctionPath && state.correctionDirty ? "" : "disabled"}>${iconSvg(Save, 16)}Save Meta</button>
    </div>
  `;
}

function renderEmotionMapPresetSlot(preset) {
  const boundSlots = getEmotionMapBoundSlotNumbers(preset.id);
  const selected = state.selectedExpressionPresetId === preset.id;
  const ranges = normalizeExpressionRangeSlots(preset.rangeSlots);
  const selectedRangeId = getEmotionMapPresetRangeSelection(preset);
  return `
    <div class="emotion-map-preset-slot ${selected ? "selected" : ""}" data-emotion-map-preset="${escapeHtml(preset.id)}">
      <span>${escapeHtml(preset.name)}</span>
      <small>${boundSlots.length ? boundSlots.join(", ") : ""}</small>
      ${
        ranges.length
          ? `<select class="emotion-map-range-select" data-emotion-map-preset-range="${escapeHtml(preset.id)}" title="Preset range">
              ${ranges
                .map((range, rangeIndex) => `<option value="${escapeHtml(range.id)}" ${range.id === selectedRangeId ? "selected" : ""}>${rangeIndex + 1}</option>`)
                .join("")}
            </select>`
          : ""
      }
      <button class="mini-button" type="button" title="Assign preset" data-emotion-map-bind="${escapeHtml(preset.id)}">&gt;</button>
    </div>
  `;
}

function renderCorrectionRightTray() {
  const activeTab = state.correctionRightTab === "props" ? "props" : "outline";
  return `
    <aside class="material-outline-tray correction-right-tray">
      <div class="correction-right-tabs">
        <button class="${activeTab === "outline" ? "active" : ""}" data-correction-right-tab="outline">Outline</button>
        <button class="${activeTab === "props" ? "active" : ""}" data-correction-right-tab="props">Props</button>
      </div>
      ${activeTab === "props" ? renderPropsTrayContent() : renderMaterialOutlineContent()}
    </aside>
  `;
}

function renderMaterialOutlineContent() {
  const outlineSettings = normalizeMaterialSettings(state.correction.materialSettings).outline;
  const materials = collectVisibleOutlineMaterials(outlineSettings.showAll);
  return `
    <div class="material-outline-content">
      <div class="material-outline-head">
        <div class="material-outline-title-row">
          <h2>Outline</h2>
          <label>
            <input type="checkbox" id="showAllOutlineMaterials" ${outlineSettings.showAll ? "checked" : ""} />
            Show all
          </label>
        </div>
        <p>MToon material color / width</p>
      </div>
      <div class="material-outline-list">
        ${
          materials.length
            ? materials.map((material) => renderMaterialOutlineItem(material)).join("")
            : `<div class="material-outline-empty">VRM material 없음</div>`
        }
      </div>
    </div>
  `;
}

function renderPropsTrayContent() {
  const props = normalizePropSettings(state.correction.props);
  const selected = getSelectedPropSetting();
  return `
    <div class="props-tray-content">
      <div class="props-list">
        ${
          props.length
            ? props.map((prop) => renderPropListItem(prop)).join("")
            : `<div class="material-outline-empty">등록된 GLB prop 없음</div>`
        }
        <button class="props-add-button" data-add-prop-glb>+</button>
      </div>
      <div class="props-settings-area">
        ${selected ? renderPropSettingsPanel(selected) : `<div class="material-outline-empty">+ 버튼으로 GLB prop을 등록하세요.</div>`}
      </div>
    </div>
  `;
}

function renderPropListItem(prop) {
  const enabled = isPropEnabledForSelectedAnimation(prop.id);
  const selected = getSelectedPropSetting()?.id === prop.id;
  return `
    <div class="prop-list-item ${selected ? "selected" : ""}" data-prop-select="${escapeHtml(prop.id)}">
      <button type="button" class="prop-enable-switch ${enabled ? "active" : ""}" data-prop-toggle="${escapeHtml(prop.id)}" ${state.selectedAnimationName ? "" : "disabled"} title="현재 애니메이션에서 사용">
        <span></span>
      </button>
      <div class="prop-list-text">
        <strong>${escapeHtml(prop.name || getPropDisplayName(prop))}</strong>
        <small>${escapeHtml(prop.file)}</small>
      </div>
      <button class="prop-reload-button" data-prop-reload="${escapeHtml(prop.id)}" title="GLB 다시 불러오기">${iconSvg(RotateCw, 14)}</button>
    </div>
  `;
}

function renderPropSettingsPanel(prop) {
  return `
    <div class="prop-settings-panel">
      <label class="prop-control-full">
        Prop Name
        <input type="text" value="${escapeHtml(prop.name || getPropDisplayName(prop))}" data-prop-name="${escapeHtml(prop.id)}" />
      </label>
      <label class="prop-control-full">
        Parent Bone
        <select id="selectedPropBone">
          ${renderPropBoneOptions(prop.attachBone)}
        </select>
      </label>
      <div class="prop-gizmo-mode-row">
        <button class="${state.propTransformMode === "translate" ? "active" : ""}" data-prop-transform-mode="translate">Move</button>
        <button class="${state.propTransformMode === "rotate" ? "active" : ""}" data-prop-transform-mode="rotate">Rotate</button>
      </div>
      <label class="prop-follow-row">
        <span>Follow Rotation</span>
        <input type="checkbox" data-prop-follow-rotation="${escapeHtml(prop.id)}" ${prop.followRotation ? "checked" : ""} />
      </label>
      ${renderPropVector("positionOffset", "Position", prop.positionOffset, -1, 1, 0.001)}
      ${renderPropVector("rotationOffset", "Rotation", prop.rotationOffset, -180, 180, 0.1)}
      <label class="blush-control-row prop-scale-row">
        <span>Scale</span>
        <input type="range" min="0.01" max="5" step="0.001" value="${roundForInput(prop.scale)}" data-prop-number="scale" />
        <input type="number" min="0.01" max="5" step="0.001" value="${roundForInput(prop.scale)}" data-prop-number="scale" />
      </label>
      <button class="delete-emotion-button prop-delete-button" id="removeSelectedProp" title="Remove Prop">${iconSvg(X, 18)}</button>
    </div>
  `;
}

function renderMaterialOutlineItem(material) {
  const color = getMaterialOutlineColor(material);
  const width = getMaterialOutlineWidth(material);
  const hidden = isMaterialOutlineHidden(material);
  return `
    <div class="material-outline-item ${hidden ? "is-hidden" : ""}">
      <button class="material-outline-hide ${hidden ? "active" : ""}" data-outline-hide="${escapeHtml(material.name)}" title="${hidden ? "Show material" : "Hide material"}">${iconSvg(X, 13)}</button>
      <button class="material-outline-swatch" data-outline-pick="${escapeHtml(material.name)}" style="background: ${escapeHtml(color)}" title="${escapeHtml(material.name)}"></button>
      <span>${escapeHtml(material.name)}</span>
      <div class="material-outline-picker">
        <input type="color" value="${escapeHtml(color)}" data-outline-color="${escapeHtml(material.name)}" />
        <input type="text" value="${escapeHtml(color)}" data-outline-hex="${escapeHtml(material.name)}" />
      </div>
      <div class="material-outline-width">
        <span>Width</span>
        <input type="range" min="0" max="2" step="0.001" value="${roundForInput(width)}" data-outline-width="${escapeHtml(material.name)}" />
        <input type="number" min="0" max="2" step="0.001" value="${roundForInput(width)}" data-outline-width-number="${escapeHtml(material.name)}" />
      </div>
    </div>
  `;
}

function renderMetaImportOverlay() {
  const report = state.metaImportReport;
  if (!report) return "";
  return `
    <aside class="meta-import-overlay ${report.applied ? "has-applied" : ""}">
      <div class="meta-import-overlay-head">
        <strong>${escapeHtml(report.title)}</strong>
        <button class="mini-button" id="closeMetaImportReport">Close</button>
      </div>
      <p>${escapeHtml(report.summary)}</p>
      ${report.messages?.length ? `<ul>${report.messages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>` : ""}
    </aside>
  `;
}

function renderMotionSlotTitleOverlay() {
  if (state.mode !== "linker2" || !state.selectedMotionSlotId) return "";
  const slot = getMotionSlot(state.selectedMotionSlotId);
  if (!slot?.title) return "";
  return `
    <div class="motion-slot-title-overlay">
      ${escapeHtml(slot.title)}
    </div>
  `;
}

function renderStatusPill() {
  if (!state.filePath) return "";
  const parts = [];
  if (state.screenshot.message) parts.push(state.screenshot.message);
  if (state.hasWorkspaceChanges) parts.push("표정 변경사항 있음");
  if (state.correctionDirty) parts.push("meta 변경사항 있음");
  if (!parts.length) parts.push("원본과 동일");
  return `<div class="status-pill">${escapeHtml(parts.join(" · "))}</div>`;
}

function renderScreenshotTools() {
  return `
    <div class="screenshot-tools">
      <button class="screenshot-button capture" id="captureScreenshot" title="Screenshot to clipboard">${iconSvg(Camera, 18)}</button>
      <button class="screenshot-button region ${state.screenshot.selecting ? "active" : ""}" id="toggleScreenshotRegion" title="Set screenshot area">${crossedDriversSvg(22)}</button>
    </div>
  `;
}

function renderEmotionMapOverlay() {
  if (state.mode !== "emotionMap") return "";
  return `
    <div class="emotion-map-overlay-wrap">
      <div class="emotion-map-overlay">
        <div class="emotion-map-overlay-head">
          <strong>Emotion Map</strong>
          <span>x -1..1 / y 0..1</span>
        </div>
        <div class="emotion-map-plot-placeholder" data-emotion-map-plot>
          <div class="emotion-map-plot-inner">
            <div class="emotion-map-axis x"></div>
            <div class="emotion-map-axis y"></div>
            ${EMOTION_MAP_POINTS.map((point) => renderEmotionMapPoint(point)).join("")}
            <div class="emotion-map-cursor-dot" data-emotion-map-cursor-dot style="${emotionMapPointStyle(state.emotionMapCursor)}"></div>
            <div class="emotion-map-base-dot" title="neutral base"></div>
          </div>
        </div>
      </div>
      <div class="emotion-map-transition-control" title="Emotion map transition seconds">
        <input type="range" min="0" max="1" step="0.01" value="${state.emotionMapTransitionSeconds.toFixed(2)}" data-emotion-map-transition />
        <b data-emotion-map-transition-value>${state.emotionMapTransitionSeconds.toFixed(2)}</b>
      </div>
    </div>
  `;
}

function renderEmotionMapPoint(point) {
  const bound = Boolean(getEmotionMapBinding(point.index));
  const selected = state.selectedEmotionMapSlotIndex === point.index;
  const bottom = point.y <= EMOTION_MAP_Y_MIN + 0.000001;
  return `
    <button class="emotion-map-point ${bottom ? "bottom" : ""} ${bound ? "bound" : ""} ${selected ? "selected" : ""}" style="${emotionMapPointStyle(point)}" data-emotion-map-slot="${point.index}" title="${point.index}">
      <span></span>
      <b>${point.index}</b>
    </button>
  `;
}

function emotionMapPointStyle(point) {
  const x = clampNumber(Number(point?.x), -1, 1, 0);
  const y = clampNumber(Number(point?.y), EMOTION_MAP_Y_MIN, EMOTION_MAP_Y_MAX, 0);
  const left = ((x + 1) / 2) * 100;
  const top = (1 - (y - EMOTION_MAP_Y_MIN) / (EMOTION_MAP_Y_MAX - EMOTION_MAP_Y_MIN)) * 100;
  return `left: ${left}%; top: ${top}%;`;
}

function handleEmotionMapPlotPointerDown(event) {
  if (event.target.closest("[data-emotion-map-slot]")) return;
  if (event.button != null && event.button !== 0) return;
  event.preventDefault();
  const plot = event.currentTarget;
  updateEmotionMapCursorFromPointer(event, plot);
  plot.setPointerCapture?.(event.pointerId);
  const onMove = (moveEvent) => {
    updateEmotionMapCursorFromPointer(moveEvent, plot);
  };
  const onUp = (upEvent) => {
    plot.releasePointerCapture?.(upEvent.pointerId);
    plot.removeEventListener("pointermove", onMove);
    plot.removeEventListener("pointerup", onUp);
    plot.removeEventListener("pointercancel", onUp);
  };
  plot.addEventListener("pointermove", onMove);
  plot.addEventListener("pointerup", onUp);
  plot.addEventListener("pointercancel", onUp);
}

function updateEmotionMapCursorFromPointer(event, plot) {
  const plotInner = plot.querySelector(".emotion-map-plot-inner") ?? plot;
  const rect = plotInner.getBoundingClientRect();
  const px = clampNumber((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1, 0.5);
  const py = clampNumber((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1, 0.5);
  state.emotionMapCursor = {
    x: Math.round((-1 + px * 2) * 100) / 100,
    y: Math.round((EMOTION_MAP_Y_MAX - py * (EMOTION_MAP_Y_MAX - EMOTION_MAP_Y_MIN)) * 100) / 100,
  };
  applyEmotionMapCursorExpression();
  syncEmotionMapCursorUi();
}

function syncEmotionMapCursorUi() {
  const dot = document.querySelector("[data-emotion-map-cursor-dot]");
  if (dot) dot.setAttribute("style", emotionMapPointStyle(state.emotionMapCursor));
  const x = document.querySelector("[data-emotion-map-readout-x]");
  if (x) x.textContent = formatSignedNumber(state.emotionMapCursor.x);
  const y = document.querySelector("[data-emotion-map-readout-y]");
  if (y) y.textContent = state.emotionMapCursor.y.toFixed(2);
}

function selectEmotionMapSlot(index) {
  if (!EMOTION_MAP_POINTS.some((point) => point.index === index)) return;
  state.selectedEmotionMapSlotIndex = index;
  const point = EMOTION_MAP_POINTS.find((item) => item.index === index);
  if (point) state.emotionMapCursor = { x: point.x, y: point.y };
  applyEmotionMapCursorExpression();
  renderPreservingScrollableUi();
}

function updateEmotionMapLabel(index, value) {
  if (!EMOTION_MAP_POINTS.some((point) => point.index === index)) return;
  state.emotionMapLabels[index - 1] = String(value ?? "");
  state.correctionDirty = true;
  syncSaveMetaButton();
}

function bindPresetToSelectedEmotionMapSlot(presetId) {
  const index = state.selectedEmotionMapSlotIndex;
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  if (!preset || !EMOTION_MAP_POINTS.some((point) => point.index === index)) return;
  const rangeId = getEmotionMapPresetRangeSelection(preset);
  const range = normalizeExpressionRangeSlots(preset.rangeSlots).find((item) => item.id === rangeId);
  state.emotionMapBindings[index - 1] = {
    presetId: preset.id,
    name: preset.name,
    expressionRangeId: range?.id ?? "",
    expressionRangeName: range ? `range ${formatEmotionValue(range.threshold)}` : "",
    expressionValue: range ? clampEmotionValue(range.threshold) : 1,
  };
  state.correctionDirty = true;
  renderPreservingScrollableUi();
}

function updateEmotionMapPresetRangeSelection(presetId, rangeId) {
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  if (!preset) return;
  const range = normalizeExpressionRangeSlots(preset.rangeSlots).find((item) => item.id === rangeId);
  state.emotionMapPresetRangeSelections[preset.id] = range?.id ?? "";
  previewEmotionMapPreset(preset.id, range?.id ?? "");
}

function getEmotionMapBinding(index) {
  return state.emotionMapBindings[index - 1] ?? null;
}

function getEmotionMapPresetRangeSelection(preset) {
  const selectedRangeId = state.emotionMapPresetRangeSelections?.[preset.id] ?? "";
  const ranges = normalizeExpressionRangeSlots(preset.rangeSlots);
  if (!ranges.length) return "";
  if (ranges.some((range) => range.id === selectedRangeId)) return selectedRangeId;
  return ranges[ranges.length - 1]?.id ?? "";
}

function getEmotionMapBoundSlotNumbers(presetId) {
  return state.emotionMapBindings
    .map((binding, index) => (binding?.presetId === presetId ? index + 1 : null))
    .filter((index) => index != null);
}

function previewEmotionMapPreset(presetId, rangeId = null) {
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  if (!preset) return;
  const selectedRangeId = rangeId ?? getEmotionMapPresetRangeSelection(preset);
  const range = normalizeExpressionRangeSlots(preset.rangeSlots).find((item) => item.id === selectedRangeId);
  state.selectedExpressionPresetId = preset.id;
  state.selectedExpressionRangeId = range?.id ?? null;
  for (const item of state.expressionPresets) {
    item.value = item.id === preset.id ? (range ? clampEmotionValue(range.threshold) : 1) : 0;
  }
  loadSelectedExpressionParameterDraft();
  transitionToSelectedEmotionPreset(0.2);
  renderPreservingScrollableUi();
}

function applyEmotionMapCursorExpression() {
  const weightedPoints = getEmotionMapBilinearWeights(state.emotionMapCursor)
    .map((item) => ({
      ...item,
      binding: getEmotionMapBinding(item.point.index),
    }))
    .filter((item) => item.binding && item.weight > 0);
  const totalWeight = weightedPoints.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) {
    startExpressionTransition({}, 1, state.emotionMapTransitionSeconds);
    clearBlushOverlay();
    clearEmotionMapEmotionImageOverlay();
    return;
  }
  const mixed = {};
  for (const item of weightedPoints) {
    const preset = state.expressionPresets.find((candidate) => candidate.id === item.binding.presetId);
    if (!preset) continue;
    const value = getEmotionMapBindingExpressionValue(item.binding, preset);
    const parameters = getExpressionParametersAtValue(preset, value, false, null, true);
    const normalizedWeight = item.weight / totalWeight;
    for (const [name, value] of Object.entries(parameters)) {
      mixed[name] = (mixed[name] ?? 0) + clampEmotionValue(value) * normalizedWeight;
    }
  }
  startExpressionTransition(mixed, 1, state.emotionMapTransitionSeconds);
  applyEmotionMapBlushOverlay(weightedPoints, totalWeight);
  applyEmotionMapEmotionImageOverlay(weightedPoints, totalWeight);
}

function updateEmotionMapTransitionSeconds(value) {
  state.emotionMapTransitionSeconds = Math.min(1, Math.max(0, Math.round(Number(value || 0) * 100) / 100));
  const readout = document.querySelector("[data-emotion-map-transition-value]");
  if (readout) readout.textContent = state.emotionMapTransitionSeconds.toFixed(2);
}

function getEmotionMapBindingExpressionValue(binding, preset) {
  const range = normalizeExpressionRangeSlots(preset?.rangeSlots).find((item) => item.id === binding?.expressionRangeId);
  if (range) return clampEmotionValue(range.threshold);
  return clampEmotionValue(binding?.expressionValue ?? 1);
}

function applyEmotionMapBlushOverlay(weightedPoints, totalWeight) {
  const blush = getActiveBlushSettings();
  if (!currentVrm || !blush?.image) {
    clearBlushOverlay();
    return;
  }
  let opacity = 0;
  for (const item of weightedPoints) {
    const preset = state.expressionPresets.find((candidate) => candidate.id === item.binding.presetId);
    if (!preset) continue;
    const value = getEmotionMapBindingExpressionValue(item.binding, preset);
    opacity += getBlushOpacityAtValue(preset, value) * (item.weight / totalWeight);
  }
  if (opacity <= 0.001) {
    clearBlushOverlay();
    return;
  }
  void ensureBlushOverlay(blush, { requireSelectedPreset: false }).then((ready) => {
    if (ready) applyBlushOverlaySettings(blush, 1, opacity);
  });
}

function applyEmotionMapEmotionImageOverlay(weightedPoints, totalWeight) {
  const candidates = weightedPoints
    .map((item) => {
      const preset = state.expressionPresets.find((candidate) => candidate.id === item.binding.presetId);
      if (!preset) return null;
      const value = getEmotionMapBindingExpressionValue(item.binding, preset);
      const settings = getEmotionImageSettingsForPresetAtValue(preset, item.binding, value);
      return {
        preset,
        settings,
        weight: item.weight / totalWeight,
      };
    })
    .filter(Boolean);
  const dominant = candidates
    .filter((item) => item.settings?.image)
    .sort((a, b) => b.weight - a.weight)[0];
  if (!dominant?.settings?.image) {
    clearEmotionMapEmotionImageOverlay();
    return;
  }
  const imageInfluence = candidates
    .filter((item) => item.settings?.image === dominant.settings.image)
    .reduce((sum, item) => sum + item.weight, 0);
  if (imageInfluence <= 0.001) {
    clearEmotionMapEmotionImageOverlay();
    return;
  }
  state.emotionMapActiveEmotionImage = {
    settings: dominant.settings,
    opacityMultiplier: imageInfluence,
  };
  void ensureEmotionImageOverlay(dominant.settings, { requireSelectedPreset: false }).then((ready) => {
    if (ready) applyEmotionImageOverlaySettings(dominant.settings, imageInfluence);
  });
}

function clearEmotionMapEmotionImageOverlay() {
  state.emotionMapActiveEmotionImage = null;
  clearEmotionImageOverlay();
}

function getEmotionImageSettingsForPresetAtValue(preset, binding, value) {
  if (!preset?.emotionImage) return null;
  const rangeSlot = normalizeExpressionRangeSlots(preset.rangeSlots).find((slot) => slot.id === binding?.expressionRangeId);
  if (rangeSlot) {
    return normalizePresetEmotionImage(rangeSlot.emotionImage, getEmotionImageBaseSettings(preset) ?? preset.emotionImage);
  }
  return normalizePresetEmotionImage(preset.emotionImage);
}

function getEmotionMapBilinearWeights(position) {
  const x = clampNumber(Number(position?.x), -1, 1, 0);
  const y = clampNumber(Number(position?.y), EMOTION_MAP_Y_MIN, EMOTION_MAP_Y_MAX, 0);
  const xBounds = getEmotionMapBounds(x, EMOTION_MAP_X_VALUES);
  const yBounds = getEmotionMapBounds(y, EMOTION_MAP_Y_VALUES);
  const tx = xBounds.max === xBounds.min ? 0 : (x - xBounds.min) / (xBounds.max - xBounds.min);
  const ty = yBounds.max === yBounds.min ? 0 : (y - yBounds.min) / (yBounds.max - yBounds.min);
  const corners = [
    { x: xBounds.min, y: yBounds.max, weight: (1 - tx) * ty },
    { x: xBounds.max, y: yBounds.max, weight: tx * ty },
    { x: xBounds.min, y: yBounds.min, weight: (1 - tx) * (1 - ty) },
    { x: xBounds.max, y: yBounds.min, weight: tx * (1 - ty) },
  ];
  return corners
    .map((corner) => ({
      point: EMOTION_MAP_POINTS.find((point) => point.x === corner.x && point.y === corner.y),
      weight: corner.weight,
    }))
    .filter((item) => item.point);
}

function getEmotionMapBounds(value, values) {
  if (value <= values[0]) return { min: values[0], max: values[0] };
  const last = values[values.length - 1];
  if (value >= last) return { min: last, max: last };
  for (let index = 0; index < values.length - 1; index += 1) {
    if (value >= values[index] && value <= values[index + 1]) {
      return { min: values[index], max: values[index + 1] };
    }
  }
  return { min: values[0], max: values[0] };
}

async function loadEmotionMapFromCharacterMeta(vrmPath) {
  state.emotionMapBindings = Array.from({ length: 20 }, () => null);
  state.emotionMapLabels = Array.from({ length: 20 }, () => "");
  state.emotionMapTempPath = null;
  const metaMap = normalizeEmotionMapConfig(state.correction.emotionMap);
  if (metaMap.hasData) {
    state.emotionMapBindings = metaMap.bindings;
    state.emotionMapLabels = metaMap.labels;
    return;
  }
  const result = await window.vrmFiles.loadEmotionMapTemp?.(vrmPath);
  if (!result?.data) return;
  state.emotionMapTempPath = result.filePath;
  try {
    const json = JSON.parse(dec.decode(new Uint8Array(result.data)));
    const normalized = normalizeEmotionMapConfig(json);
    state.emotionMapBindings = normalized.bindings;
    state.emotionMapLabels = normalized.labels;
    state.correction.emotionMap = serializeEmotionMapConfig();
    state.correctionDirty = true;
  } catch {
    state.emotionMapBindings = Array.from({ length: 20 }, () => null);
    state.emotionMapLabels = Array.from({ length: 20 }, () => "");
  }
}

function serializeEmotionMapConfig() {
  return {
    schemaVersion: 1,
    type: "vrm-emotion-map",
    vrmFileName: state.fileName ?? "",
    range: {
      x: [-1, 1],
      y: [EMOTION_MAP_Y_MIN, EMOTION_MAP_Y_MAX],
    },
    points: EMOTION_MAP_POINTS.map((point) => {
      const binding = getEmotionMapBinding(point.index);
      return {
        index: point.index,
        label: point.label,
        emotionName: state.emotionMapLabels[point.index - 1] ?? "",
        x: point.x,
        y: point.y,
        expressionPresetId: binding?.presetId ?? "",
        expressionPresetName: binding?.name ?? "",
        expressionRangeId: binding?.expressionRangeId ?? "",
        expressionRangeName: binding?.expressionRangeName ?? "",
        expressionValue: binding?.expressionValue ?? 1,
      };
    }),
  };
}

function normalizeEmotionMapConfig(json, presets = state.expressionPresets) {
  const bindings = Array.from({ length: 20 }, () => null);
  const labels = Array.from({ length: 20 }, () => "");
  const sourcePoints = Array.isArray(json?.points) ? json.points : [];
  let hasData = false;
  for (const source of sourcePoints) {
    const index = Number(source?.index);
    if (!EMOTION_MAP_POINTS.some((point) => point.index === index)) continue;
    const hasPointData = Boolean(
      String(source?.emotionName ?? "") ||
        String(source?.expressionPresetId ?? "") ||
        String(source?.expressionPresetName ?? ""),
    );
    if (hasPointData) hasData = true;
    labels[index - 1] = String(source?.emotionName ?? "");
    const preset = findMatchingExpressionPreset(source?.expressionPresetId, source?.expressionPresetName, presets);
    if (!preset) continue;
    const range = normalizeExpressionRangeSlots(preset.rangeSlots).find((item) => item.id === source?.expressionRangeId);
    bindings[index - 1] = {
      presetId: preset.id,
      name: preset.name,
      expressionRangeId: range?.id ?? "",
      expressionRangeName: range ? `range ${formatEmotionValue(range.threshold)}` : "",
      expressionValue: range ? clampEmotionValue(range.threshold) : clampEmotionValue(source?.expressionValue ?? 1),
    };
  }
  return { bindings, labels, hasData };
}

function serializeEmotionMapFromNormalized(normalized, source = {}) {
  const bindings = Array.isArray(normalized?.bindings) ? normalized.bindings : Array.from({ length: 20 }, () => null);
  const labels = Array.isArray(normalized?.labels) ? normalized.labels : Array.from({ length: 20 }, () => "");
  return {
    schemaVersion: 1,
    type: "vrm-emotion-map",
    vrmFileName: String(source?.vrmFileName ?? state.fileName ?? ""),
    range: {
      x: [-1, 1],
      y: [EMOTION_MAP_Y_MIN, EMOTION_MAP_Y_MAX],
    },
    points: EMOTION_MAP_POINTS.map((point) => {
      const binding = bindings[point.index - 1];
      return {
        index: point.index,
        label: point.label,
        emotionName: labels[point.index - 1] ?? "",
        x: point.x,
        y: point.y,
        expressionPresetId: binding?.presetId ?? "",
        expressionPresetName: binding?.name ?? "",
        expressionRangeId: binding?.expressionRangeId ?? "",
        expressionRangeName: binding?.expressionRangeName ?? "",
        expressionValue: binding?.expressionValue ?? 1,
      };
    }),
  };
}

function formatSignedNumber(value) {
  const number = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}`;
}

function renderScreenshotSelectionOverlay() {
  if (!state.screenshot.selecting) return "";
  const rect = normalizeScreenshotRect(state.screenshot.rect);
  return `
    <div class="screenshot-selection-layer">
      <div
        class="screenshot-selection-box"
        data-screenshot-drag="move"
        style="left: ${rect.x * 100}%; top: ${rect.y * 100}%; width: ${rect.width * 100}%; height: ${rect.height * 100}%;"
      >
        <span class="screenshot-selection-label">screenshot</span>
        <button class="screenshot-handle nw" data-screenshot-drag="nw" aria-label="Resize northwest"></button>
        <button class="screenshot-handle ne" data-screenshot-drag="ne" aria-label="Resize northeast"></button>
        <button class="screenshot-handle sw" data-screenshot-drag="sw" aria-label="Resize southwest"></button>
        <button class="screenshot-handle se" data-screenshot-drag="se" aria-label="Resize southeast"></button>
      </div>
    </div>
  `;
}

function toggleScreenshotRegion() {
  state.screenshot.selecting = !state.screenshot.selecting;
  render();
}

async function captureScreenshotToClipboard() {
  try {
    renderer.render(scene, camera);
    const rect = normalizeScreenshotRect(state.screenshot.rect);
    const source = await loadImageFromDataUrl(renderer.domElement.toDataURL("image/png"));
    const crop = document.createElement("canvas");
    crop.width = Math.max(1, Math.round(source.width * rect.width));
    crop.height = Math.max(1, Math.round(source.height * rect.height));
    const context = crop.getContext("2d");
    context.fillStyle = "#11151b";
    context.fillRect(0, 0, crop.width, crop.height);
    context.drawImage(
      source,
      Math.round(source.width * rect.x),
      Math.round(source.height * rect.y),
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );
    const result = await window.vrmFiles.writeClipboardImage(crop.toDataURL("image/png"));
    setScreenshotMessage(`screenshot ${result.size.width}x${result.size.height}`);
  } catch (error) {
    console.error(error);
    setScreenshotMessage("screenshot failed");
  }
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function setScreenshotMessage(message) {
  state.screenshot.message = message;
  render();
  window.clearTimeout(setScreenshotMessage.timer);
  setScreenshotMessage.timer = window.setTimeout(() => {
    if (state.screenshot.message !== message) return;
    state.screenshot.message = "";
    render();
  }, 2200);
}

function beginScreenshotRectDrag(event, mode) {
  event.preventDefault();
  event.stopPropagation();
  const viewer = document.querySelector(".viewer");
  const box = document.querySelector(".screenshot-selection-box");
  if (!viewer || !box) return;
  const viewerRect = viewer.getBoundingClientRect();
  const startRect = normalizeScreenshotRect(state.screenshot.rect);
  const startX = event.clientX;
  const startY = event.clientY;
  const minSize = 0.05;
  const onMove = (moveEvent) => {
    const dx = (moveEvent.clientX - startX) / Math.max(viewerRect.width, 1);
    const dy = (moveEvent.clientY - startY) / Math.max(viewerRect.height, 1);
    let next = { ...startRect };
    if (mode === "move") {
      next.x = startRect.x + dx;
      next.y = startRect.y + dy;
    } else {
      if (mode.includes("w")) {
        next.x = startRect.x + dx;
        next.width = startRect.width - dx;
      }
      if (mode.includes("e")) next.width = startRect.width + dx;
      if (mode.includes("n")) {
        next.y = startRect.y + dy;
        next.height = startRect.height - dy;
      }
      if (mode.includes("s")) next.height = startRect.height + dy;
      if (next.width < minSize) {
        if (mode.includes("w")) next.x -= minSize - next.width;
        next.width = minSize;
      }
      if (next.height < minSize) {
        if (mode.includes("n")) next.y -= minSize - next.height;
        next.height = minSize;
      }
    }
    state.screenshot.rect = normalizeScreenshotRect(next);
    updateScreenshotBoxStyle(box, state.screenshot.rect);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function updateScreenshotBoxStyle(box, rect) {
  const normalized = normalizeScreenshotRect(rect);
  box.style.left = `${normalized.x * 100}%`;
  box.style.top = `${normalized.y * 100}%`;
  box.style.width = `${normalized.width * 100}%`;
  box.style.height = `${normalized.height * 100}%`;
}

function updateExtraBoneGizmoOverlay() {
  const svg = document.querySelector(".bone-gizmo-overlay");
  if (!svg || state.mode !== "extraBone" || !state.extraBoneGizmoVisible || !currentVrm?.scene) return;
  const viewer = document.querySelector(".viewer");
  if (!viewer) return;
  const rect = viewer.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
  const humanoidLines = collectHumanoidBoneLineSegments();
  const extraLines = collectExtraBoneFollowLineSegments();
  svg.innerHTML = [
    ...humanoidLines.map((line) => renderProjectedBoneLine(line, rect, "humanoid")),
    ...extraLines.map((line) => renderProjectedBoneLine(line, rect, "extra")),
  ]
    .filter(Boolean)
    .join("");
}

function renderProjectedBoneLine(line, rect, kind) {
  const start = projectWorldPointToViewer(line.start, rect);
  const end = projectWorldPointToViewer(line.end, rect);
  if (!start || !end) return "";
  const stroke = kind === "extra" ? "#3d8dff" : "#24d46a";
  const width = kind === "extra" ? 6 : 4;
  return `<line class="bone-gizmo-line ${kind}" x1="${start.x.toFixed(1)}" y1="${start.y.toFixed(1)}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}" stroke="${stroke}" stroke-width="${width}" />`;
}

function projectWorldPointToViewer(point, rect) {
  const projected = point.clone().project(camera);
  if (projected.z < -1 || projected.z > 1) return null;
  return {
    x: (projected.x * 0.5 + 0.5) * rect.width,
    y: (-projected.y * 0.5 + 0.5) * rect.height,
  };
}

function collectHumanoidBoneLineSegments() {
  const humanoidObjects = new Map(HUMAN_BONES.map((boneName) => [getRawBoneNode(boneName), boneName]).filter(([bone]) => bone));
  const lines = [];
  for (const bone of humanoidObjects.keys()) {
    const parent = findNearestMappedBoneAncestor(bone, humanoidObjects);
    if (!parent) continue;
    lines.push(createBoneLineSegment(parent, bone));
  }
  return lines.filter(Boolean);
}

function collectExtraBoneFollowLineSegments() {
  const settings = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings);
  const lines = [];
  for (const setting of settings) {
    const bone = findBoneByName(setting.targetBone);
    if (!bone) continue;
    const tailTarget = getRawBoneNode(setting.tailDirectionBone);
    if (tailTarget) {
      lines.push(createBoneLineSegment(bone, tailTarget));
      continue;
    }
    const childBones = bone.children.filter((child) => child?.isBone);
    if (childBones.length) {
      for (const child of childBones) lines.push(createBoneLineSegment(bone, child));
    } else if (bone.parent?.isBone) {
      lines.push(createBoneLineSegment(bone.parent, bone));
    }
  }
  return lines.filter(Boolean);
}

function findNearestMappedBoneAncestor(bone, mappedBones) {
  let parent = bone?.parent ?? null;
  while (parent) {
    if (mappedBones.has(parent)) return parent;
    parent = parent.parent;
  }
  return null;
}

function createBoneLineSegment(startBone, endBone) {
  if (!startBone || !endBone) return null;
  return {
    start: startBone.getWorldPosition(new THREE.Vector3()),
    end: endBone.getWorldPosition(new THREE.Vector3()),
  };
}

function normalizeScreenshotRect(rect) {
  const minSize = 0.05;
  const width = Math.min(1, Math.max(minSize, Number(rect?.width) || 0.28));
  const height = Math.min(1, Math.max(minSize, Number(rect?.height) || 0.42));
  return {
    x: Math.min(1 - width, Math.max(0, Number(rect?.x) || 0)),
    y: Math.min(1 - height, Math.max(0, Number(rect?.y) || 0)),
    width,
    height,
  };
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
      <button class="viewer-camera-reset" id="resetModeCamera" title="Reset camera">${iconSvg(Camera, 16)}</button>
    </div>
  `;
}

function renderLipSyncPreviewOverlay() {
  if (state.mode !== "transitionViewer") return "";
  return `
    <section class="lip-sync-preview">
      <input
        type="text"
        value="${escapeHtml(state.lipSyncPreview.text)}"
        data-lip-sync-text
        placeholder="말할 문장을 입력"
      />
      <button class="lip-sync-play-button ${state.lipSyncPreview.playing ? "active" : ""}" id="playLipSyncPreview" ${currentVrm ? "" : "disabled"} title="Lip sync preview">
        ${iconSvg(Play, 17)}
      </button>
    </section>
  `;
}

function renderExtraBoneGizmoControls() {
  if (state.mode !== "extraBone") return "";
  return `
    <button class="bone-gizmo-toggle ${state.extraBoneGizmoVisible ? "active" : ""}" id="toggleBoneGizmo" title="Bone structure">
      ${iconSvg(GitCompare, 18)}
    </button>
  `;
}

function renderExtraBoneGizmoOverlay() {
  if (state.mode !== "extraBone" || !state.extraBoneGizmoVisible) return "";
  return `<svg class="bone-gizmo-overlay" aria-hidden="true"></svg>`;
}

function renderBlushOverlayPanel() {
  if (state.mode !== "expression" || state.editing) return "";
  const selected = getSelectedEmotionPreset();
  const blush = getActiveBlushSettings();
  if (!selected || !isPresetBlushEnabled(selected) || !blush?.image) return "";
  if (state.blushPanelMinimized) {
    return `
      <button class="blush-mini-button" id="restoreBlushPanel" title="Blush">
        <span></span>
      </button>
    `;
  }
  const opacity = getSelectedBlushOpacity();
  return `
    <section class="blush-overlay-panel">
      <div class="blush-overlay-head">
        <div>
          <strong>Blush</strong>
          <span>${escapeHtml(blush.image)}</span>
        </div>
        <button class="blush-minimize-button" id="minimizeBlushPanel" title="Minimize">_</button>
        <button class="blush-remove-button" data-emotion-blush-remove="${escapeHtml(selected.id)}" title="Remove blush">${iconSvg(X, 18)}</button>
      </div>
      ${renderBlushControl("y", "Y", 0, 0.1, 0.001, blush.y)}
      ${renderBlushControl("z", "Z", 0, 0.2, 0.001, blush.z)}
      ${renderBlushControl("scale", "Scale", 0, 1, 0.001, blush.scale)}
      ${renderBlushControl("opacity", "Opacity", 0, 1, 0.01, opacity)}
      <div class="blush-overlay-actions">
        <button class="secondary-button" data-emotion-blush="${escapeHtml(selected.id)}">Change Image</button>
      </div>
    </section>
  `;
}

function renderEmotionImageOverlayPanel() {
  if (state.mode !== "expression" || state.editing) return "";
  const selected = getSelectedEmotionPreset();
  const settings = getActiveEmotionImageSettings();
  if (!selected || !selected.emotionImage || !settings?.image) return "";
  if (state.emotionImagePanelMinimized) {
    const stacked = Boolean(isPresetBlushEnabled(selected) && getActiveBlushSettings()?.image);
    return `
      <button class="emotion-image-mini-button ${stacked ? "stacked" : ""}" id="restoreEmotionImagePanel" title="Emotion image">
        ${emotionImageIconSvg(24)}
      </button>
    `;
  }
  const stacked = Boolean(isPresetBlushEnabled(selected) && getActiveBlushSettings()?.image);
  const hasRangeOverride = Boolean(getSelectedExpressionRangeSlot());
  return `
    <section class="emotion-image-overlay-panel ${stacked ? "stacked" : ""}">
      <div class="blush-overlay-head">
        <div>
          <strong>Emotion Image</strong>
          <span>${escapeHtml(settings.image)}</span>
        </div>
        <button class="blush-minimize-button" id="minimizeEmotionImagePanel" title="Minimize">_</button>
        <button class="blush-remove-button" data-emotion-image-remove="${escapeHtml(selected.id)}" ${selected.locked ? "disabled" : ""} title="Remove emotion image">${iconSvg(X, 18)}</button>
      </div>
      <div class="emotion-image-position-grid">
        ${renderEmotionImagePositionValue("X", settings.x)}
        ${renderEmotionImagePositionValue("Y", settings.y)}
        ${renderEmotionImagePositionValue("Z", settings.z)}
      </div>
      ${renderEmotionImageRotationControl(settings.rotation, selected.locked)}
      ${renderEmotionImageScaleControl(settings.scale, selected.locked)}
      <div class="blush-overlay-actions">
        <button class="secondary-button" data-emotion-image="${escapeHtml(selected.id)}" ${selected.locked ? "disabled" : ""}>Change Image</button>
        ${
          hasRangeOverride
            ? `<button class="secondary-button" data-emotion-image-range-reset ${selected.locked ? "disabled" : ""}>Reset Range</button>`
            : ""
        }
      </div>
      ${renderEmotionImageGraphEditor(settings, selected.locked)}
    </section>
  `;
}

function renderEmotionImagePositionValue(label, value) {
  return `
    <label class="emotion-image-position-value">
      <span>${escapeHtml(label)}</span>
      <input type="number" value="${roundForInput(value)}" readonly data-emotion-image-position="${escapeHtml(label.toLowerCase())}" />
    </label>
  `;
}

function renderEmotionImageRotationControl(value, disabled = false) {
  const normalized = normalizeDegrees(Number(value ?? 0));
  return `
    <label class="blush-control-row emotion-image-rotation-control">
      <span>Rotation</span>
      <input type="range" min="-180" max="180" step="1" value="${roundForInput(normalized)}" data-emotion-image-control="rotation" ${disabled ? "disabled" : ""} />
      <input type="number" min="-180" max="180" step="1" value="${roundForInput(normalized)}" data-emotion-image-number="rotation" ${disabled ? "disabled" : ""} />
      <button class="mini-icon-button" id="resetEmotionImageRotation" ${disabled ? "disabled" : ""} title="Reset rotation">${iconSvg(RotateCcw, 14)}</button>
    </label>
  `;
}

function renderEmotionImageScaleControl(value, disabled = false) {
  return `
    <label class="blush-control-row emotion-image-scale-control">
      <span>Scale</span>
      <input type="range" min="0" max="3" step="0.001" value="${roundForInput(value)}" data-emotion-image-control="scale" ${disabled ? "disabled" : ""} />
      <input type="number" min="0" max="3" step="0.001" value="${roundForInput(value)}" data-emotion-image-number="scale" ${disabled ? "disabled" : ""} />
      <button class="mini-icon-button ${state.emotionImagePivotPicking ? "active" : ""}" type="button" data-emotion-image-pivot ${disabled ? "disabled" : ""} title="Set scale pivot">${pivotIconSvg(14)}</button>
    </label>
  `;
}

function renderEmotionImageGraphEditor(settings, disabled = false) {
  const duration = normalizeEmotionImageDuration(settings.animationDuration);
  return `
    <div class="emotion-image-graph-editor">
      <div class="emotion-image-duration-row">
        <span>Time</span>
        <input type="number" min="0.1" max="30" step="0.1" value="${roundForInput(duration)}" data-emotion-image-number="animationDuration" ${disabled ? "disabled" : ""} />
        <label class="emotion-image-loop-row">
          <input type="checkbox" data-emotion-image-loop ${settings.loop ? "checked" : ""} ${disabled ? "disabled" : ""} />
          <span>Loop</span>
        </label>
      </div>
      ${renderEmotionImageGraph("scaleGraph", "Scale", settings.scaleGraph, 2, disabled)}
      ${renderEmotionImageGraph("opacityGraph", "Opacity", settings.opacityGraph, 1, disabled)}
      ${renderEmotionImageHeadRotationGraph(settings, disabled)}
      ${renderEmotionImageCurveButtons(settings, disabled)}
    </div>
  `;
}

function renderEmotionImageGraph(graphKey, label, graph, maxValue, disabled = false) {
  const points = normalizeEmotionImageGraph(graph, maxValue);
  const selected = state.selectedEmotionImageGraph?.graph === graphKey ? state.selectedEmotionImageGraph.index : -1;
  const selectedValue = points[selected]?.value;
  const pointMarkup = points
    .map((point, index) => {
      const y = emotionGraphY(point.value, maxValue);
      return `<button class="emotion-graph-point ${index === selected ? "selected" : ""}" style="left:${(point.time * 100).toFixed(3)}%;top:${((y / EMOTION_GRAPH_HEIGHT) * 100).toFixed(3)}%" data-emotion-graph-point="${graphKey}:${index}" ${disabled ? "disabled" : ""} title="${roundForInput(point.time)} / ${roundForInput(point.value)}"></button>`;
    })
    .join("");
  return `
    <div class="emotion-image-graph-block">
      <div class="emotion-image-graph-label">
        <span>${escapeHtml(label)}</span>
        <strong>${maxValue.toFixed(1)}</strong>
      </div>
      <div class="emotion-graph-surface" data-emotion-graph="${graphKey}" data-emotion-graph-max="${maxValue}" ${disabled ? "data-disabled=\"true\"" : ""}>
        ${renderEmotionGraphSelectedValue(selectedValue)}
        <svg viewBox="0 0 ${EMOTION_GRAPH_WIDTH} ${EMOTION_GRAPH_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
          <path class="emotion-graph-grid" d="M0 ${EMOTION_GRAPH_HEIGHT / 2}H${EMOTION_GRAPH_WIDTH}" />
          <path class="emotion-graph-line" d="${escapeHtml(buildEmotionGraphPath(points, maxValue))}" />
        </svg>
        ${pointMarkup}
      </div>
    </div>
  `;
}

function renderEmotionImageHeadRotationGraph(settings, disabled = false) {
  const axes = normalizeHeadRotationAxes(settings.headRotationAxes);
  const selectedAxis = getSelectedHeadRotationAxis(settings);
  const activeGraph = settings.headRotationGraph?.[selectedAxis] ?? [];
  const selected =
    state.selectedEmotionImageGraph?.graph === "headRotationGraph" && state.selectedEmotionImageGraph?.axis === selectedAxis
      ? state.selectedEmotionImageGraph.index
      : -1;
  const activePoints = normalizeEmotionImageGraphRange(activeGraph, EMOTION_HEAD_ROTATION_MIN, EMOTION_HEAD_ROTATION_MAX, 0);
  const selectedValue = axes[selectedAxis] ? activePoints[selected]?.value : null;
  const axisMarkup = ["x", "y", "z"]
    .filter((axis) => axes[axis])
    .map((axis) => {
      const points = normalizeEmotionImageGraphRange(settings.headRotationGraph?.[axis], EMOTION_HEAD_ROTATION_MIN, EMOTION_HEAD_ROTATION_MAX, 0);
      return `<path class="emotion-graph-line emotion-graph-axis-${axis}" d="${escapeHtml(buildEmotionGraphPathRange(points, EMOTION_HEAD_ROTATION_MIN, EMOTION_HEAD_ROTATION_MAX))}" />`;
    })
    .join("");
  const pointMarkup = axes[selectedAxis]
    ? activePoints
        .map((point, index) => {
          const y = emotionGraphYRange(point.value, EMOTION_HEAD_ROTATION_MIN, EMOTION_HEAD_ROTATION_MAX);
          return `<button class="emotion-graph-point ${index === selected ? "selected" : ""} emotion-graph-axis-${selectedAxis}" style="left:${(point.time * 100).toFixed(3)}%;top:${((y / EMOTION_GRAPH_HEIGHT) * 100).toFixed(3)}%" data-emotion-graph-point="headRotationGraph:${index}" ${disabled ? "disabled" : ""} title="${roundForInput(point.time)} / ${roundForInput(point.value)}"></button>`;
        })
        .join("")
    : "";
  return `
    <div class="emotion-image-graph-block">
      <div class="emotion-image-graph-label">
        <span>Head Rotation</span>
        <strong>-10 / 10</strong>
      </div>
      <div class="emotion-graph-surface emotion-head-rotation-surface" data-emotion-graph="headRotationGraph" data-emotion-graph-min="${EMOTION_HEAD_ROTATION_MIN}" data-emotion-graph-max="${EMOTION_HEAD_ROTATION_MAX}" ${disabled || !axes[selectedAxis] ? "data-disabled=\"true\"" : ""}>
        ${renderEmotionGraphSelectedValue(selectedValue)}
        <svg viewBox="0 0 ${EMOTION_GRAPH_WIDTH} ${EMOTION_GRAPH_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
          <path class="emotion-graph-grid" d="M0 ${EMOTION_GRAPH_HEIGHT / 2}H${EMOTION_GRAPH_WIDTH}" />
          ${axisMarkup}
        </svg>
        ${pointMarkup}
      </div>
      <div class="emotion-head-axis-buttons">
        ${["x", "y", "z"]
          .map(
            (axis) =>
              `<button class="emotion-head-axis-button ${axes[axis] ? "active" : ""} ${selectedAxis === axis ? "selected" : ""} axis-${axis}" data-emotion-head-axis="${axis}" ${disabled ? "disabled" : ""}>${axis.toUpperCase()}</button>`,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderEmotionGraphSelectedValue(value) {
  return `<span class="emotion-graph-selected-value">${Number.isFinite(value) ? Number(value).toFixed(1) : ""}</span>`;
}

function renderPropBoneOptions(selectedBone) {
  return HUMAN_BONES.map(
    (boneName) =>
      `<option value="${escapeHtml(boneName)}" ${boneName === selectedBone ? "selected" : ""}>${escapeHtml(formatBoneName(boneName))}</option>`,
  ).join("");
}

function renderPropVector(key, label, values, min, max, step) {
  return `
    <div class="prop-vector-block">
      <strong>${escapeHtml(label)}</strong>
      ${["X", "Y", "Z"]
        .map(
          (axisLabel, index) => `
            <label class="prop-vector-row">
              <span>${axisLabel}</span>
              <input type="number" min="${min}" max="${max}" step="${step}" value="${roundForInput(values[index])}" data-prop-vector="${escapeHtml(key)}" data-axis="${index}" />
            </label>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEmotionImageCurveButtons(settings, disabled = false) {
  const selected = getSelectedEmotionImageGraphPoint(settings);
  const curve = selected?.curve ?? "linear";
  const canDelete = selected && selected.index > 0 && selected.index < selected.points.length - 1;
  const buttons = [
    ["linear", "M4 20L20 4"],
    ["easeOut", "M4 20C5 8 12 4 20 4"],
    ["easeIn", "M4 20C13 20 18 12 20 4"],
    ["easeInOut", "M4 19C8 19 8 5 12 12C16 19 16 5 20 5"],
    ["step", "M5 19H13V5H20"],
  ]
    .map(
      ([type, path]) =>
        `<button class="emotion-curve-button ${curve === type ? "active" : ""}" data-emotion-curve="${type}" ${disabled || !selected ? "disabled" : ""} title="${type}"><svg viewBox="0 0 24 24"><path d="${path}" /></svg></button>`,
    )
    .join("");
  return `
    <div class="emotion-curve-buttons">
      ${buttons}
      <button class="emotion-curve-button danger" data-emotion-curve-delete ${disabled || !canDelete ? "disabled" : ""} title="Delete"><svg viewBox="0 0 24 24"><path d="M6 6L18 18M18 6L6 18" /></svg></button>
      <button class="emotion-curve-button play" data-emotion-graph-preview ${disabled ? "disabled" : ""} title="Preview">${iconSvg(Play, 18)}</button>
    </div>
  `;
}

function renderEmotionLinkerTransitionControl() {
  if (state.mode !== "linker") return "";
  const value = clampNumber(Number(state.linkerTransitionSeconds), 0, 1, 0.2);
  return `
    <div class="linker-transition-control">
      <span>Transition</span>
      <input type="range" min="0" max="1" step="0.01" value="${roundForInput(value)}" data-linker-transition />
      <strong>${value.toFixed(2)}s</strong>
    </div>
  `;
}

function renderBlushControl(key, label, min, max, step, value) {
  return `
    <label class="blush-control-row">
      <span>${escapeHtml(label)}</span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${roundForInput(value)}" data-blush-control="${key}" />
      <input type="number" min="${min}" max="${max}" step="${step}" value="${roundForInput(value)}" data-blush-number="${key}" />
    </label>
  `;
}

function renderFileButtons() {
  return `
    <div class="header-file-buttons">
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
      <button class="icon-button meta-load-button" id="importMetaSettings" title="Meta 불러오기" ${state.correctionPath ? "" : "disabled"}>.m</button>
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
    ["emotionMap", "Emotion Map", GitCompare],
    ["extraBone", "Extra Bone Follow Setting", GitCompare],
    ["linker", "Emotion Linker (view only)", GitCompare],
    ["linker2", "Emotion Linker 2 (view only)", GitCompare],
    ["transitionViewer", "Transition Viewer (view only)", GitCompare],
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
  const blushEnabled = isPresetBlushEnabled(preset);
  return `
    <div class="emotion-card ${preset.locked ? "locked" : "unlocked"} ${selected ? "selected" : ""}" data-emotion-select="${preset.id}" data-emotion-drop="${preset.id}">
      <div class="emotion-card-top">
        <button class="lock-button ${preset.locked ? "locked" : ""}" draggable="true" data-emotion-lock="${preset.id}" data-emotion-drag="${preset.id}" title="${preset.locked ? "Unlock" : "Lock"}">${iconSvg(preset.locked ? Lock : Unlock, 18)}</button>
        ${
          preset.locked
            ? `<div class="emotion-name-readonly">${escapeHtml(preset.name)}</div>`
            : `<input class="emotion-name-input" type="text" value="${escapeHtml(preset.name)}" data-emotion-name="${preset.id}" />`
        }
        <div class="emotion-card-actions">
          <button class="blink-emotion-button ${preset.isDisableBlink ? "active" : ""}" data-emotion-blink="${preset.id}" title="Disable blink">${blinkDisabledSvg(18)}</button>
          <button class="blush-emotion-button ${blushEnabled ? "active" : ""}" data-emotion-blush="${preset.id}" title="Blush image">${blushIconSvg(18)}</button>
          <button class="emotion-image-button ${preset.emotionImage ? "active" : ""}" data-emotion-image="${preset.id}" title="Emotion image">${emotionImageIconSvg(18)}</button>
          <button class="duplicate-emotion-button" data-emotion-duplicate="${preset.id}" title="Duplicate">${iconSvg(Copy, 15)}</button>
          ${preset.locked ? `<span class="delete-emotion-placeholder"></span>` : `<button class="delete-emotion-button" data-emotion-delete="${preset.id}" title="Delete">${iconSvg(X, 16)}</button>`}
        </div>
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
  const selectedAnimationMeta = getAnimationMetaEntry(state.selectedAnimationName);
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
          <button class="${state.correctionAnimationTab === "play" ? "active" : ""}" data-correction-animation-tab="play">Play & Correction</button>
          <button class="${state.correctionAnimationTab === "files" ? "active" : ""}" data-correction-animation-tab="files">File List</button>
        </div>
        ${renderAnimationFileList(animationNames)}
        <div class="animation-toolbar">
          <button class="secondary-button" id="addAnimation">New Ani</button>
          <button class="icon-button compact" id="prevAnimation" ${animationNames.length ? "" : "disabled"} title="Previous animation">&lt;</button>
          <button class="icon-button compact" id="nextAnimation" ${animationNames.length ? "" : "disabled"} title="Next animation">&gt;</button>
          <button class="icon-button compact danger-compact" id="deleteAnimation" ${selectedAnimation ? "" : "disabled"} title="Delete animation">x</button>
        </div>
        <div class="animation-name-line">
          <label>
            Ani Name
            <input type="text" value="${escapeHtml(state.selectedAnimationName ?? "")}" readonly />
          </label>
        <label class="animation-check-row animation-first-row">
          <span>is First</span>
          <input type="checkbox" id="toggleFirstAnimation" ${selectedAnimation?.isFirst ? "checked" : ""} ${selectedAnimation ? "" : "disabled"} />
        </label>
        </div>
        <div class="animation-option-row">
          <label class="animation-check-row animation-loop-row">
            <input type="checkbox" id="toggleSelectedAnimationLoop" ${selectedAnimationMeta.loop ? "checked" : ""} ${selectedAnimation ? "" : "disabled"} />
            <span>Loop</span>
          </label>
          <label class="animation-check-row animation-look-row">
            <input type="checkbox" id="toggleSelectedAnimationLookAt" ${selectedAnimationMeta.lookAtCamera ? "checked" : ""} ${selectedAnimation ? "" : "disabled"} />
            <span>정면시선</span>
          </label>
          <button class="prop-load-button" data-add-prop-glb ${currentVrm ? "" : "disabled"} title="GLB Prop 불러오기">GLB</button>
        </div>
        <div class="animation-description-line">
          <label>
            설명
            <input type="text" value="${escapeHtml(selectedAnimation?.description ?? "")}" data-animation-description ${selectedAnimation ? "" : "disabled"} />
          </label>
          <button class="warning-toggle ${selectedAnimation?.mustWatchFull ? "active" : ""}" id="toggleMustWatch" ${selectedAnimation ? "" : "disabled"} title="끝까지 확인할 애니메이션 표시">!</button>
        </div>
        <p class="parameter-meta">${escapeHtml(state.animation.fileName ? `${state.animation.fileName}${state.animation.clipName ? ` / ${state.animation.clipName}` : ""}` : state.animation.message)}</p>
        <div class="animation-controls">
          <button class="animation-action-button" id="toggleAnimation" ${animationAction ? "" : "disabled"} title="${state.animation.playing ? "Pause" : "Play"}">${iconSvg(Play, 20)}</button>
          <button class="animation-action-button" id="restartAnimation" ${animationAction ? "" : "disabled"} title="Restart">${iconSvg(RotateCcw, 20)}</button>
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
                <div class="target-bone-tools">
                  <button class="mirror-split-button ${state.separateMirrorBoneCorrection ? "active" : ""}" id="toggleMirrorBoneCorrection" title="좌우 본을 따로 보정">
                    <span>L</span><span>R</span>
                  </button>
                  <button class="mini-button" id="resetBoneCorrection">Reset</button>
                </div>
              </div>
              <select id="selectedBone">${renderBoneOptions()}</select>
              <p class="parameter-meta">${getBoneAvailabilityText(state.selectedBone)} ${getMirrorBoneName(state.selectedBone) ? (state.separateMirrorBoneCorrection ? "좌우를 따로 보정합니다." : "좌우를 대칭으로 함께 보정합니다.") : ""}</p>
            </div>
            ${renderCorrectionVector("rotationOffset", "Rotation Offset", selected.rotationOffset, -45, 45, 0.1, "deg")}
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
        <h1>Emotion Linker (view only)</h1>
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

function renderEmotionLinker2Panel() {
  const slots = normalizeMotionSlots(state.emotionLinker2.motionSlots);
  state.emotionLinker2.motionSlots = slots;
  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Emotion Linker 2 (view only)</h1>
        <p>${state.correctionPath ? escapeHtml(fileNameFromPath(state.correctionPath)) : "모션 슬롯을 만들어 애니메이션과 표정을 연결합니다"}</p>
      </div>
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
    </div>
    ${renderModeBar("linker2")}
      <div class="emotion-linker-panel motion-linker-panel">
      ${
        slots.length
          ? slots.map((slot, index) => renderMotionSlotCard(slot, index, slots.length)).join("")
          : `<div class="correction-card"><p class="parameter-meta">+ 버튼으로 모션 슬롯을 추가하세요.</p></div>`
      }
      <button class="emotion-link-add-point motion-slot-add" id="addMotionSlot">+</button>
    </div>
    <div class="correction-footer">
      <button class="primary-button" id="saveCorrection" ${state.correctionPath && state.correctionDirty ? "" : "disabled"}>${iconSvg(Save, 16)}Save Meta</button>
    </div>
  `;
}

function renderMotionSlotCard(slot, index = 0, total = 1) {
  const animationNames = getAnimationNames();
  const linkedPreset = state.expressionPresets.find((preset) => preset.id === slot.expressionPresetId);
  const duration = getAnimationDuration(slot.animationFile, 2);
  const selected = state.selectedMotionSlotId === slot.id;
  const titleValue =
    state.editingMotionSlotTitleId === slot.id ? state.editingMotionSlotTitleValue : slot.title;
  return `
    <div class="emotion-link-card motion-slot-card ${selected ? "selected" : ""}">
      <div class="motion-slot-top">
        <input class="motion-slot-title" type="text" value="${escapeHtml(titleValue)}" placeholder="input title" data-motion-slot-title="${escapeHtml(slot.id)}" />
        <div class="motion-slot-order-buttons">
          <button class="mini-icon-button" data-motion-slot-move="${escapeHtml(slot.id)}" data-direction="-1" ${index <= 0 ? "disabled" : ""} title="Move up">▲</button>
          <button class="mini-icon-button" data-motion-slot-move="${escapeHtml(slot.id)}" data-direction="1" ${index >= total - 1 ? "disabled" : ""} title="Move down">▼</button>
        </div>
        <button class="delete-emotion-button compact-delete" data-motion-slot-delete="${escapeHtml(slot.id)}" title="Delete">${iconSvg(X, 16)}</button>
      </div>
      <select class="emotion-link-select" data-motion-slot-animation="${escapeHtml(slot.id)}">
        <option value="">애니메이션 선택</option>
        ${animationNames
          .map((name) => `<option value="${escapeHtml(name)}" ${name === slot.animationFile ? "selected" : ""}>${escapeHtml(formatAnimationOptionLabel(name))}</option>`)
          .join("")}
      </select>
      <select class="emotion-link-select" data-motion-slot-expression="${escapeHtml(slot.id)}">
        <option value="">표정 프리셋 이름</option>
        ${state.expressionPresets
          .map((preset) => `<option value="${escapeHtml(preset.id)}" ${preset.id === slot.expressionPresetId ? "selected" : ""}>${escapeHtml(preset.name)}</option>`)
          .join("")}
      </select>
      <div class="emotion-link-actions">
        <label class="emotion-link-loop">
          <input type="checkbox" data-motion-slot-loop="${escapeHtml(slot.id)}" ${slot.loop ? "checked" : ""} />
          Loop
        </label>
        <div class="motion-slot-transition-control" title="Start transition">
          <span>${clampTimelineTransitionSeconds(slot.transitionSeconds).toFixed(1)}</span>
          <div>
            <button type="button" data-motion-slot-transition="${escapeHtml(slot.id)}" data-direction="1">▲</button>
            <button type="button" data-motion-slot-transition="${escapeHtml(slot.id)}" data-direction="-1">▼</button>
          </div>
        </div>
        <button class="icon-button emotion-link-play" data-motion-slot-play="${escapeHtml(slot.id)}" ${currentVrm && slot.animationFile ? "" : "disabled"} title="Play">${iconSvg(Play, 24)}</button>
      </div>
      ${renderMotionSlotTimeline(slot, duration, linkedPreset)}
    </div>
  `;
}

function renderMotionSlotTimeline(slot, duration, linkedPreset) {
  const timeline = normalizeExpressionTimeline(slot.expressionTimeline);
  const progress =
    state.selectedMotionSlotId === slot.id && state.animation.duration
      ? Math.min(100, Math.max(0, (state.animation.time / Math.max(state.animation.duration, 0.001)) * 100))
      : 0;
  return `
    <div class="emotion-link-timeline">
      <div class="emotion-link-progress">
        <div class="emotion-link-progress-track">
          <span class="emotion-link-progress-cursor" data-motion-slot-progress="${escapeHtml(slot.id)}" style="left: ${progress}%;"></span>
          ${timeline.map((timelineSlot, index) => renderMotionSlotTimelineMarker(slot.id, timelineSlot, index, duration)).join("")}
        </div>
      </div>
      <div class="emotion-link-timeline-slots">
        ${timeline.map((timelineSlot, index) => renderMotionSlotTimelineSlot(slot.id, timelineSlot, index, duration)).join("")}
        <button class="emotion-link-add-point" data-motion-slot-timeline-add="${escapeHtml(slot.id)}">+</button>
      </div>
    </div>
  `;
}

function renderMotionSlotTimelineMarker(slotId, slot, index, duration) {
  const left = Math.min(100, Math.max(0, (slot.time / Math.max(duration, 0.001)) * 100));
  return `
    <button class="emotion-link-marker" style="left: ${left}%;" data-motion-slot-timeline-jump="${escapeHtml(slotId)}" data-slot-id="${escapeHtml(slot.id)}" title="${slot.time.toFixed(1)}">
      <span></span>
      <em>${index + 1}</em>
    </button>
  `;
}

function renderMotionSlotTimelineSlot(slotId, slot, index, duration) {
  const preset = findMatchingExpressionPreset(slot.expressionPresetId, slot.expressionPresetName);
  const ranges = normalizeExpressionRangeSlots(preset?.rangeSlots);
  const hasRanges = ranges.length > 0;
  return `
    <div class="emotion-link-timeline-slot">
      <button class="emotion-range-number" data-motion-slot-timeline-jump="${escapeHtml(slotId)}" data-slot-id="${escapeHtml(slot.id)}">${index + 1}</button>
      <div class="emotion-link-time-value" data-motion-slot-timeline-drag="${escapeHtml(slotId)}" data-slot-id="${escapeHtml(slot.id)}">${slot.time.toFixed(1)}</div>
      <select data-motion-slot-timeline-expression="${escapeHtml(slotId)}" data-slot-id="${escapeHtml(slot.id)}">
        <option value="">F</option>
        ${state.expressionPresets
          .map((item) => `<option value="${escapeHtml(item.id)}" ${preset?.id === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
          .join("")}
      </select>
      <select class="emotion-link-range-select" data-motion-slot-timeline-range="${escapeHtml(slotId)}" data-slot-id="${escapeHtml(slot.id)}" ${hasRanges ? "" : "disabled"}>
        <option value="">-</option>
        ${ranges.map((range, rangeIndex) => `<option value="${escapeHtml(range.id)}" ${range.id === slot.expressionRangeId ? "selected" : ""}>${rangeIndex + 1}</option>`).join("")}
      </select>
      <div class="timeline-transition-stepper">
        <strong>${clampTimelineTransitionSeconds(slot.transitionSeconds).toFixed(1)}</strong>
        <div class="timeline-transition-buttons">
          <button data-motion-slot-timeline-transition="${escapeHtml(slotId)}" data-slot-id="${escapeHtml(slot.id)}" data-direction="1">+</button>
          <button data-motion-slot-timeline-transition="${escapeHtml(slotId)}" data-slot-id="${escapeHtml(slot.id)}" data-direction="-1">-</button>
        </div>
      </div>
      <button class="delete-emotion-button compact-delete" data-motion-slot-timeline-delete="${escapeHtml(slotId)}" data-slot-id="${escapeHtml(slot.id)}">${iconSvg(X, 16)}</button>
    </div>
  `;
}

function renderEmotionLinkerCard(animationName) {
  const catalogEntry = state.animationCatalog?.[animationName] ?? {};
  const metaEntry = getEmotionLinkerEntry(animationName);
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
      ${renderEmotionLinkTimeline(animationName, metaEntry)}
    </div>
  `;
}

function renderEmotionLinkTimeline(animationName, metaEntry) {
  const duration = getAnimationDuration(animationName, 2);
  const timeline = normalizeExpressionTimeline(metaEntry.expressionTimeline);
  const progress =
    state.selectedAnimationName === animationName && state.animation.duration
      ? Math.min(100, Math.max(0, (state.animation.time / Math.max(state.animation.duration, 0.001)) * 100))
      : 0;
  return `
    <div class="emotion-link-timeline">
      <div class="emotion-link-progress">
        <div class="emotion-link-progress-track">
          <span class="emotion-link-progress-cursor" data-link-progress="${escapeHtml(animationName)}" style="left: ${progress}%;"></span>
          ${timeline.map((slot, index) => renderEmotionLinkTimelineMarker(animationName, slot, index, duration)).join("")}
        </div>
      </div>
      <div class="emotion-link-timeline-slots">
        ${timeline.map((slot, index) => renderEmotionLinkTimelineSlot(animationName, slot, index, duration)).join("")}
        <button class="emotion-link-add-point" data-link-timeline-add="${escapeHtml(animationName)}">+</button>
      </div>
    </div>
  `;
}

function renderEmotionLinkTimelineMarker(animationName, slot, index, duration) {
  const left = Math.min(100, Math.max(0, (slot.time / Math.max(duration, 0.001)) * 100));
  return `
    <button class="emotion-link-marker" style="left: ${left}%;" data-link-timeline-jump="${escapeHtml(animationName)}" data-slot-id="${escapeHtml(slot.id)}" title="${slot.time.toFixed(1)}">
      <span></span>
      <em>${index + 1}</em>
    </button>
  `;
}

function renderEmotionLinkTimelineSlot(animationName, slot, index, duration) {
  const preset = findMatchingExpressionPreset(slot.expressionPresetId, slot.expressionPresetName);
  const rangeSlots = normalizeExpressionRangeSlots(preset?.rangeSlots);
  const hasRanges = rangeSlots.length > 0;
  const selectedRangeId = hasRanges && rangeSlots.some((item) => item.id === slot.expressionRangeId) ? slot.expressionRangeId : "";
  return `
    <div class="emotion-link-timeline-slot">
      <button class="emotion-range-number" data-link-timeline-jump="${escapeHtml(animationName)}" data-slot-id="${escapeHtml(slot.id)}">${index + 1}</button>
      <div class="emotion-link-time-value" data-link-timeline-drag="${escapeHtml(animationName)}" data-slot-id="${escapeHtml(slot.id)}">${slot.time.toFixed(1)}</div>
      <select data-link-timeline-expression="${escapeHtml(animationName)}" data-slot-id="${escapeHtml(slot.id)}">
        <option value="">Expression</option>
        ${state.expressionPresets
          .map(
            (item) =>
              `<option value="${escapeHtml(item.id)}" ${item.id === slot.expressionPresetId ? "selected" : ""}>${escapeHtml(item.name)}</option>`,
          )
          .join("")}
      </select>
      <select class="emotion-link-range-select" data-link-timeline-range="${escapeHtml(animationName)}" data-slot-id="${escapeHtml(slot.id)}" ${hasRanges ? "" : "disabled"} title="${hasRanges ? "Preset range" : "No ranges"}">
        <option value="" ${selectedRangeId ? "" : "selected"}>F</option>
        ${rangeSlots
          .map(
            (item, rangeIndex) =>
              `<option value="${escapeHtml(item.id)}" ${item.id === selectedRangeId ? "selected" : ""}>${rangeIndex + 1}</option>`,
          )
          .join("")}
      </select>
      <div class="timeline-transition-stepper">
        <strong>${clampTimelineTransitionSeconds(slot.transitionSeconds).toFixed(1)}</strong>
        <div class="timeline-transition-buttons">
          <button data-link-timeline-transition="${escapeHtml(animationName)}" data-slot-id="${escapeHtml(slot.id)}" data-direction="1">+</button>
          <button data-link-timeline-transition="${escapeHtml(animationName)}" data-slot-id="${escapeHtml(slot.id)}" data-direction="-1">-</button>
        </div>
      </div>
      <button class="delete-emotion-button compact-delete" data-link-timeline-delete="${escapeHtml(animationName)}" data-slot-id="${escapeHtml(slot.id)}">${iconSvg(X, 16)}</button>
    </div>
  `;
}

function renderExtraBoneFollowPanel() {
  const settings = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings);
  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Extra Bone Follow Setting</h1>
        <p>${state.correctionPath ? escapeHtml(fileNameFromPath(state.correctionPath)) : "VRM을 열면 extra bone follow 설정을 저장합니다"}</p>
      </div>
      <button class="icon-button" id="openFile" title="VRM 열기">${iconSvg(FolderOpen)}</button>
    </div>
    ${renderModeBar("extraBone")}
    <div class="extra-bone-panel">
      <div class="extra-bone-list">
        ${settings.map((setting, index) => renderExtraBoneFollowSlot(setting, index)).join("")}
        <button class="add-emotion-button" id="addExtraBoneFollow">+</button>
      </div>
    </div>
    <div class="correction-footer">
      <button class="primary-button" id="saveCorrection" ${state.correctionPath && state.correctionDirty ? "" : "disabled"}>${iconSvg(Save, 16)}Save Meta</button>
    </div>
  `;
}

function renderExtraBoneFollowSlot(setting, index) {
  const targetOptions = collectExtraBoneOptions();
  const sourceOptions = collectAvailableHumanoidBoneOptions();
  return `
    <section class="correction-card extra-bone-slot ${state.selectedExtraBoneFollowId === setting.id ? "selected" : ""}">
      <div class="correction-card-head">
        <strong>Follow ${index + 1}</strong>
        <button class="delete-emotion-button compact-delete" data-extra-bone-delete="${escapeHtml(setting.id)}" title="Delete">${iconSvg(X, 16)}</button>
      </div>
      <label>
        Apply Bone
        <select data-extra-bone-target="${escapeHtml(setting.id)}">
          <option value="">extra bone</option>
          ${targetOptions
            .map(
              (boneName) =>
                `<option value="${escapeHtml(boneName)}" ${boneName === setting.targetBone ? "selected" : ""}>${escapeHtml(boneName)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label>
        Follow Target
        <select data-extra-bone-source="${escapeHtml(setting.id)}">
          <option value="">humanoid bone</option>
          ${sourceOptions
            .map(
              (boneName) =>
                `<option value="${escapeHtml(boneName)}" ${boneName === setting.sourceBone ? "selected" : ""}>${escapeHtml(formatBoneName(boneName))}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label>
        Tail Direction Target
        <select data-extra-bone-tail="${escapeHtml(setting.id)}">
          <option value="">tail direction bone</option>
          ${sourceOptions
            .map(
              (boneName) =>
                `<option value="${escapeHtml(boneName)}" ${boneName === setting.tailDirectionBone ? "selected" : ""}>${escapeHtml(formatBoneName(boneName))}</option>`,
            )
            .join("")}
        </select>
      </label>
      <div class="extra-bone-factor-list">
        ${renderExtraBoneFactorRow(setting, "swing", "Swing", setting.swingFactor)}
        ${renderExtraBoneFactorRow(setting, "twist", "Twist", setting.twistFactor)}
      </div>
    </section>
  `;
}

function renderExtraBoneFactorRow(setting, key, label, value) {
  return `
    <label class="extra-bone-factor-row">
      <span>${label}</span>
      <input type="number" step="0.01" value="${roundForInput(value)}" data-extra-bone-factor="${escapeHtml(setting.id)}" data-factor="${key}" />
    </label>
  `;
}

function renderExtraBoneAxisRow(setting, axis) {
  const axisSetting = normalizeExtraBoneAxisSetting(setting.axes?.[axis]);
  return `
    <label class="extra-bone-axis-row">
      <span>${axis.toUpperCase()}</span>
      <input type="number" step="0.01" value="${roundForInput(axisSetting.factor)}" data-extra-bone-factor="${escapeHtml(setting.id)}" data-axis="${axis}" />
      <span class="extra-bone-ignore">
        <input type="checkbox" data-extra-bone-ignore="${escapeHtml(setting.id)}" data-axis="${axis}" ${axisSetting.ignore ? "checked" : ""} />
        제외
      </span>
    </label>
  `;
}

function renderTransitionViewerPanel() {
  return `
    <div class="panel-header">
      <div class="title-block">
        <h1>Transition Viewer (view only)</h1>
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
        state.transitionViewer.trayMode === "sequence"
          ? `<button class="transition-use-button transition-use-sequence" data-transition-use="${slot.id}" data-target="sequence" title="Add to sequence">&gt;</button>`
          : kind === "transition"
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
  if (state.transitionViewer.trayMode === "sequence") return renderTransitionSequenceTray();
  const start = getTransitionPick("start");
  const transition = getTransitionPick("transitionPick");
  const end = getTransitionPick("end");
  return `
    <aside class="transition-preview-tray">
      ${renderTransitionTrayModeTabs()}
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

function renderTransitionTrayModeTabs() {
  const active = state.transitionViewer.trayMode === "sequence" ? "sequence" : "transition";
  return `
    <div class="transition-tray-tabs">
      <button class="${active === "transition" ? "active" : ""}" data-transition-tray-mode="transition">Transition</button>
      <button class="${active === "sequence" ? "active" : ""}" data-transition-tray-mode="sequence">Sequence</button>
    </div>
  `;
}

function renderTransitionSequenceTray() {
  const sequence = normalizeTransitionSequence(state.transitionViewer.sequence);
  return `
    <aside class="transition-preview-tray transition-sequence-tray">
      ${renderTransitionTrayModeTabs()}
      <section class="transition-sequence-panel">
        <div class="transition-sequence-head">
          <h2>Sequence Play</h2>
          <span>${sequence.length}/10</span>
        </div>
        <div class="transition-sequence-list">
          ${
            sequence.length
              ? sequence.map((slot, index) => renderTransitionSequenceSlot(slot, index)).join("")
              : `<p class="parameter-meta">왼쪽 슬롯의 &gt; 버튼으로 동작+표정 프리셋을 추가하세요.</p>`
          }
        </div>
      </section>
      <button class="transition-sequence-play" id="playTransitionSequence" ${sequence.length && currentVrm ? "" : "disabled"}>
        ${state.transitionViewer.sequencePlaying ? "playing" : "play sequence"}
      </button>
    </aside>
  `;
}

function renderTransitionSequenceSlot(slot, index) {
  const isLoop = isAnimationLoop(slot.fileName);
  const active = state.transitionViewer.sequencePlaying && state.transitionViewer.sequenceActiveIndex === index;
  return `
    <section class="transition-sequence-slot ${active ? "playing" : ""}">
      <div class="transition-sequence-slot-head">
        <strong>${index + 1}</strong>
        <span title="${escapeHtml(formatTransitionLinkerOptionLabel(slot.fileName))}">${escapeHtml(formatTransitionLinkerOptionLabel(slot.fileName))}</span>
        <div class="transition-sequence-move">
          <button data-sequence-move="${escapeHtml(slot.id)}" data-direction="-1" ${index <= 0 ? "disabled" : ""} title="Move up">▲</button>
          <button data-sequence-move="${escapeHtml(slot.id)}" data-direction="1" ${index >= normalizeTransitionSequence(state.transitionViewer.sequence).length - 1 ? "disabled" : ""} title="Move down">▼</button>
        </div>
        <button class="transition-remove-button" data-sequence-remove="${escapeHtml(slot.id)}" title="Remove">-</button>
      </div>
      <div class="transition-sequence-controls">
        <label class="${isLoop ? "" : "disabled"}">
          Loop
          <input type="number" min="1" max="99" step="1" value="${slot.loopCount}" data-sequence-loop-count="${escapeHtml(slot.id)}" ${isLoop ? "" : "disabled"} />
        </label>
        <label>
          Transition
          <input class="sequence-transition-input" type="number" min="0" max="2" step="0.1" value="${slot.transitionSeconds.toFixed(1)}" data-sequence-transition="${escapeHtml(slot.id)}" data-sequence-transition-drag="${escapeHtml(slot.id)}" />
        </label>
      </div>
    </section>
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
  for (const button of document.querySelectorAll("#importMetaSettings")) {
    button.addEventListener("click", importMetaSettings);
  }
  document.querySelector("#closeMetaImportReport")?.addEventListener("click", () => {
    state.metaImportReport = null;
    render();
  });
  document.querySelector("#resetModeCamera")?.addEventListener("click", () => applyCameraPresetForMode(state.mode));
  document.querySelector("#toggleScreenshotRegion")?.addEventListener("click", toggleScreenshotRegion);
  document.querySelector("#captureScreenshot")?.addEventListener("click", captureScreenshotToClipboard);
  for (const node of document.querySelectorAll("[data-screenshot-drag]")) {
    node.addEventListener("pointerdown", (event) => beginScreenshotRectDrag(event, node.dataset.screenshotDrag));
  }
  document.querySelector("#minimizeBlushPanel")?.addEventListener("click", () => {
    state.blushPanelMinimized = true;
    renderPreservingExpressionEditorScrolls();
  });
  document.querySelector("#restoreBlushPanel")?.addEventListener("click", () => {
    state.blushPanelMinimized = false;
    renderPreservingExpressionEditorScrolls();
  });
  document.querySelector("#minimizeEmotionImagePanel")?.addEventListener("click", () => {
    state.emotionImagePanelMinimized = true;
    detachEmotionImageTransformControls();
    renderPreservingExpressionEditorScrolls();
  });
  document.querySelector("#restoreEmotionImagePanel")?.addEventListener("click", () => {
    state.emotionImagePanelMinimized = false;
    renderPreservingExpressionEditorScrolls();
    attachEmotionImageTransformControls();
  });
  document.querySelector("#resetEmotionImageRotation")?.addEventListener("click", () => {
    resetEmotionImageRotation();
  });
  document.querySelector("[data-emotion-image-pivot]")?.addEventListener("click", (event) => {
    event.stopPropagation();
    beginEmotionImagePivotPicking();
  });
  document.querySelector("[data-linker-transition]")?.addEventListener("input", (event) =>
    updateLinkerTransitionSeconds(Number(event.target.value)),
  );
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
  document.querySelector("#addExtraBoneFollow")?.addEventListener("click", addExtraBoneFollowSetting);
  document.querySelector("#saveSelectedParameters")?.addEventListener("click", saveSelectedExpressionParameters);
  document.querySelector("#toggleParameterFilter")?.addEventListener("click", () => {
    state.parameterFilterOpen = !state.parameterFilterOpen;
    renderPreservingScrollableUi();
  });
  document.querySelector("#addAnimation")?.addEventListener("click", addAnimation);
  document.querySelector("#prevAnimation")?.addEventListener("click", () => stepSelectedAnimation(-1));
  document.querySelector("#nextAnimation")?.addEventListener("click", () => stepSelectedAnimation(1));
  document.querySelector("#deleteAnimation")?.addEventListener("click", deleteSelectedAnimation);
  for (const button of document.querySelectorAll("[data-add-prop-glb]")) {
    button.addEventListener("click", addPropGlb);
  }
  document.querySelector("#removeSelectedProp")?.addEventListener("click", removeSelectedProp);
  for (const button of document.querySelectorAll("[data-correction-right-tab]")) {
    button.addEventListener("click", () => {
      state.correctionRightTab = button.dataset.correctionRightTab === "props" ? "props" : "outline";
      renderPreservingScrollableUi();
    });
  }
  for (const button of document.querySelectorAll("[data-prop-select]")) {
    button.addEventListener("click", (event) => {
      if (event.target.closest("[data-prop-toggle], [data-prop-reload]")) return;
      selectProp(button.dataset.propSelect);
    });
  }
  for (const button of document.querySelectorAll("[data-prop-toggle]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePropForSelectedAnimation(button.dataset.propToggle, !button.classList.contains("active"));
    });
  }
  for (const button of document.querySelectorAll("[data-prop-reload]")) {
    button.addEventListener("click", () => reloadPropGlb(button.dataset.propReload));
  }
  for (const input of document.querySelectorAll("[data-prop-name]")) {
    input.addEventListener("input", () => updatePropName(input.dataset.propName, input.value));
  }
  for (const input of document.querySelectorAll("[data-prop-follow-rotation]")) {
    input.addEventListener("change", () => updateSelectedProp({ followRotation: input.checked }));
  }
  document.querySelector("#toggleMustWatch")?.addEventListener("click", toggleSelectedAnimationMustWatch);
  document.querySelector("#toggleFirstAnimation")?.addEventListener("change", (event) => toggleSelectedAnimationFirst(event.target.checked));
  document.querySelector("#toggleSelectedAnimationLoop")?.addEventListener("change", (event) =>
    updateAnimationLoop(state.selectedAnimationName, event.target.checked),
  );
  document.querySelector("#toggleSelectedAnimationLookAt")?.addEventListener("change", (event) =>
    updateAnimationLookAtCamera(state.selectedAnimationName, event.target.checked),
  );
  document.querySelector("#toggleAnimation")?.addEventListener("click", toggleAnimationPlayback);
  document.querySelector("#restartAnimation")?.addEventListener("click", restartAnimation);
  document.querySelector("#resetBoneCorrection")?.addEventListener("click", resetSelectedBoneCorrection);
  for (const button of document.querySelectorAll("[data-correction-animation-tab]")) {
    button.addEventListener("click", () => {
      state.correctionAnimationTab = button.dataset.correctionAnimationTab === "files" ? "files" : "play";
      renderPreservingScrollableUi();
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

  document.querySelector("#addMotionSlot")?.addEventListener("click", addMotionSlot);
  for (const input of document.querySelectorAll("[data-motion-slot-title]")) {
    input.addEventListener("pointerdown", (event) => event.stopPropagation());
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("focus", () => beginMotionSlotTitleEdit(input.dataset.motionSlotTitle, input.value));
    input.addEventListener("input", () => updateMotionSlotTitle(input.dataset.motionSlotTitle, input.value));
    input.addEventListener("blur", () => finishMotionSlotTitleEdit(input.dataset.motionSlotTitle, input.value));
  }
  for (const select of document.querySelectorAll("[data-motion-slot-animation]")) {
    select.addEventListener("change", () => updateMotionSlot(select.dataset.motionSlotAnimation, { animationFile: select.value }));
  }
  for (const select of document.querySelectorAll("[data-motion-slot-expression]")) {
    select.addEventListener("change", () => updateMotionSlotExpression(select.dataset.motionSlotExpression, select.value));
  }
  for (const input of document.querySelectorAll("[data-motion-slot-loop]")) {
    input.addEventListener("change", () => updateMotionSlot(input.dataset.motionSlotLoop, { loop: input.checked }));
  }
  for (const button of document.querySelectorAll("[data-motion-slot-transition]")) {
    button.addEventListener("click", () =>
      nudgeMotionSlotTransition(button.dataset.motionSlotTransition, Number(button.dataset.direction)),
    );
  }
  for (const button of document.querySelectorAll("[data-motion-slot-delete]")) {
    button.addEventListener("click", () => deleteMotionSlot(button.dataset.motionSlotDelete));
  }
  for (const button of document.querySelectorAll("[data-motion-slot-move]")) {
    button.addEventListener("click", () => moveMotionSlot(button.dataset.motionSlotMove, Number(button.dataset.direction)));
  }
  for (const button of document.querySelectorAll("[data-motion-slot-play]")) {
    button.addEventListener("click", () => playMotionSlot(button.dataset.motionSlotPlay));
  }
  for (const button of document.querySelectorAll("[data-motion-slot-timeline-add]")) {
    button.addEventListener("click", () => addMotionSlotTimelineSlot(button.dataset.motionSlotTimelineAdd));
  }
  for (const button of document.querySelectorAll("[data-motion-slot-timeline-delete]")) {
    button.addEventListener("click", () => deleteMotionSlotTimelineSlot(button.dataset.motionSlotTimelineDelete, button.dataset.slotId));
  }
  for (const select of document.querySelectorAll("[data-motion-slot-timeline-expression]")) {
    select.addEventListener("change", () =>
      updateMotionSlotTimelineExpression(select.dataset.motionSlotTimelineExpression, select.dataset.slotId, select.value),
    );
  }
  for (const select of document.querySelectorAll("[data-motion-slot-timeline-range]")) {
    select.addEventListener("change", () =>
      updateMotionSlotTimelineRange(select.dataset.motionSlotTimelineRange, select.dataset.slotId, select.value),
    );
  }
  for (const button of document.querySelectorAll("[data-motion-slot-timeline-transition]")) {
    button.addEventListener("click", () =>
      nudgeMotionSlotTimelineTransition(button.dataset.motionSlotTimelineTransition, button.dataset.slotId, Number(button.dataset.direction)),
    );
  }
  for (const node of document.querySelectorAll("[data-motion-slot-timeline-drag]")) {
    node.addEventListener("pointerdown", (event) =>
      beginMotionSlotTimelineDrag(event, node.dataset.motionSlotTimelineDrag, node.dataset.slotId),
    );
  }
  for (const button of document.querySelectorAll("[data-motion-slot-timeline-jump]")) {
    button.addEventListener("click", () => jumpMotionSlotTimeline(button.dataset.motionSlotTimelineJump, button.dataset.slotId));
  }

  for (const button of document.querySelectorAll("[data-link-timeline-add]")) {
    button.addEventListener("click", () => addEmotionLinkTimelineSlot(button.dataset.linkTimelineAdd));
  }

  for (const button of document.querySelectorAll("[data-link-timeline-delete]")) {
    button.addEventListener("click", () => deleteEmotionLinkTimelineSlot(button.dataset.linkTimelineDelete, button.dataset.slotId));
  }

  for (const select of document.querySelectorAll("[data-link-timeline-expression]")) {
    select.addEventListener("change", () =>
      updateEmotionLinkTimelineExpression(select.dataset.linkTimelineExpression, select.dataset.slotId, select.value),
    );
  }

  for (const select of document.querySelectorAll("[data-link-timeline-range]")) {
    select.addEventListener("change", () =>
      updateEmotionLinkTimelineRange(select.dataset.linkTimelineRange, select.dataset.slotId, select.value),
    );
  }

  for (const button of document.querySelectorAll("[data-link-timeline-transition]")) {
    button.addEventListener("click", () =>
      nudgeEmotionLinkTimelineTransition(button.dataset.linkTimelineTransition, button.dataset.slotId, Number(button.dataset.direction)),
    );
  }

  for (const node of document.querySelectorAll("[data-link-timeline-drag]")) {
    node.addEventListener("pointerdown", (event) =>
      beginEmotionLinkTimelineDrag(event, node.dataset.linkTimelineDrag, node.dataset.slotId),
    );
  }

  for (const button of document.querySelectorAll("[data-link-timeline-jump]")) {
    button.addEventListener("click", () => previewEmotionLinkTimelineSlot(button.dataset.linkTimelineJump, button.dataset.slotId));
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

  for (const button of document.querySelectorAll("[data-transition-tray-mode]")) {
    button.addEventListener("click", () => setTransitionTrayMode(button.dataset.transitionTrayMode));
  }

  for (const button of document.querySelectorAll("[data-sequence-remove]")) {
    button.addEventListener("click", () => removeTransitionSequenceSlot(button.dataset.sequenceRemove));
  }

  for (const button of document.querySelectorAll("[data-sequence-move]")) {
    button.addEventListener("click", () => moveTransitionSequenceSlot(button.dataset.sequenceMove, Number(button.dataset.direction)));
  }

  for (const input of document.querySelectorAll("[data-sequence-loop-count]")) {
    input.addEventListener("change", () => updateTransitionSequenceSlot(input.dataset.sequenceLoopCount, { loopCount: Number(input.value) }));
  }

  for (const input of document.querySelectorAll("[data-sequence-transition]")) {
    input.addEventListener("change", () => updateTransitionSequenceSlot(input.dataset.sequenceTransition, { transitionSeconds: Number(input.value) }));
  }

  for (const input of document.querySelectorAll("[data-sequence-transition-drag]")) {
    input.addEventListener("pointerdown", (event) =>
      beginTransitionSequenceValueDrag(event, input.dataset.sequenceTransitionDrag),
    );
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
  document.querySelector("#playTransitionSequence")?.addEventListener("click", playTransitionSequence);
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
  document.querySelector("#toggleMirrorBoneCorrection")?.addEventListener("click", () => {
    state.separateMirrorBoneCorrection = !state.separateMirrorBoneCorrection;
    renderPreservingScrollableUi();
  });
  document.querySelector("#selectedPropBone")?.addEventListener("change", (event) => updateSelectedProp({ attachBone: event.target.value }));

  for (const input of document.querySelectorAll("[data-correction-meta]")) {
    input.addEventListener("input", () => updateCorrectionMeta(input.dataset.correctionMeta, input.value));
  }

  document.querySelector("#showAllOutlineMaterials")?.addEventListener("change", (event) => updateOutlineMaterialShowAll(event.target.checked));

  for (const input of document.querySelectorAll("[data-outline-color]")) {
    input.addEventListener("input", () => updateMaterialOutlineColor(input.dataset.outlineColor, input.value));
  }

  for (const button of document.querySelectorAll("[data-outline-hide]")) {
    button.addEventListener("click", () => toggleOutlineMaterialVisibility(button.dataset.outlineHide));
  }

  for (const button of document.querySelectorAll("[data-outline-pick]")) {
    button.addEventListener("click", () => {
      document.querySelector(`[data-outline-color="${cssEscape(button.dataset.outlinePick)}"]`)?.click();
    });
  }

  for (const input of document.querySelectorAll("[data-outline-hex]")) {
    input.addEventListener("blur", () => updateMaterialOutlineColor(input.dataset.outlineHex, input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        updateMaterialOutlineColor(input.dataset.outlineHex, input.value);
        input.blur();
      }
    });
  }

  for (const input of document.querySelectorAll("[data-outline-width]")) {
    input.addEventListener("input", () => updateMaterialOutlineWidth(input.dataset.outlineWidth, Number(input.value), input));
  }

  for (const input of document.querySelectorAll("[data-outline-width-number]")) {
    input.addEventListener("input", () => updateMaterialOutlineWidth(input.dataset.outlineWidthNumber, Number(input.value), input));
  }

  for (const select of document.querySelectorAll("[data-extra-bone-target]")) {
    select.addEventListener("change", () => updateExtraBoneFollowSetting(select.dataset.extraBoneTarget, { targetBone: select.value }));
  }

  for (const select of document.querySelectorAll("[data-extra-bone-source]")) {
    select.addEventListener("change", () => {
      const existing = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings).find((setting) => setting.id === select.dataset.extraBoneSource);
      updateExtraBoneFollowSetting(select.dataset.extraBoneSource, {
        sourceBone: select.value,
        tailDirectionBone: existing?.tailDirectionBone || getDefaultTailDirectionBone(select.value),
      });
    });
  }

  for (const select of document.querySelectorAll("[data-extra-bone-tail]")) {
    select.addEventListener("change", () => updateExtraBoneFollowSetting(select.dataset.extraBoneTail, { tailDirectionBone: select.value }));
  }

  for (const input of document.querySelectorAll("[data-extra-bone-factor]")) {
    input.addEventListener("input", () =>
      updateExtraBoneFollowFactor(input.dataset.extraBoneFactor, input.dataset.factor, Number(input.value)),
    );
  }

  for (const button of document.querySelectorAll("[data-extra-bone-delete]")) {
    button.addEventListener("click", () => deleteExtraBoneFollowSetting(button.dataset.extraBoneDelete));
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

  const lipSyncInput = document.querySelector("[data-lip-sync-text]");
  lipSyncInput?.addEventListener("input", (event) => {
    state.lipSyncPreview.text = event.target.value;
  });
  lipSyncInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") startLipSyncPreview();
  });
  document.querySelector("#playLipSyncPreview")?.addEventListener("click", startLipSyncPreview);

  for (const input of document.querySelectorAll("[data-correction-vector]")) {
    input.addEventListener("input", () => updateCorrectionValue(input.dataset.correctionVector, Number(input.dataset.axis), Number(input.value)));
  }

  for (const input of document.querySelectorAll("[data-correction-number]")) {
    input.addEventListener("input", () => updateCorrectionValue(input.dataset.correctionNumber, Number(input.dataset.axis), Number(input.value)));
  }

  for (const input of document.querySelectorAll("[data-prop-vector]")) {
    input.addEventListener("input", () => updateSelectedPropVector(input.dataset.propVector, Number(input.dataset.axis), Number(input.value)));
  }

  for (const input of document.querySelectorAll("[data-prop-number]")) {
    input.addEventListener("input", () => updateSelectedPropNumber(input.dataset.propNumber, Number(input.value)));
  }

  for (const button of document.querySelectorAll("[data-prop-transform-mode]")) {
    button.addEventListener("click", () => updatePropTransformMode(button.dataset.propTransformMode));
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
      if (state.mode !== "expression") {
        clearBlushOverlay();
        clearEmotionImageOverlay();
      }
      if (state.mode !== "correction") {
        clearPropOverlay();
      } else {
        updateVisiblePropsForSelectedAnimation();
      }
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
  document.querySelector("[data-emotion-map-plot]")?.addEventListener("pointerdown", handleEmotionMapPlotPointerDown);
  document.querySelector("[data-emotion-map-transition]")?.addEventListener("input", (event) =>
    updateEmotionMapTransitionSeconds(Number(event.target.value)),
  );
  for (const button of document.querySelectorAll("[data-emotion-map-slot]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectEmotionMapSlot(Number(button.dataset.emotionMapSlot));
    });
  }
  for (const input of document.querySelectorAll("[data-emotion-map-name]")) {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("input", () => updateEmotionMapLabel(Number(input.dataset.emotionMapName), input.value));
  }
  for (const button of document.querySelectorAll("[data-emotion-map-bind]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      bindPresetToSelectedEmotionMapSlot(button.dataset.emotionMapBind);
    });
  }
  for (const select of document.querySelectorAll("[data-emotion-map-preset-range]")) {
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", (event) => {
      event.stopPropagation();
      updateEmotionMapPresetRangeSelection(select.dataset.emotionMapPresetRange, select.value);
    });
  }
  for (const slot of document.querySelectorAll("[data-emotion-map-preset]")) {
    slot.addEventListener("click", () => previewEmotionMapPreset(slot.dataset.emotionMapPreset));
  }
  document.querySelector("[data-light-intensity]")?.addEventListener("input", (event) => updateLightIntensity(Number(event.target.value)));
  document.querySelector("#toggleBoneGizmo")?.addEventListener("click", () => {
    state.extraBoneGizmoVisible = !state.extraBoneGizmoVisible;
    renderPreservingScrollableUi();
  });

  for (const input of document.querySelectorAll("[data-camera-setting]")) {
    input.addEventListener("input", () => updateCameraSetting(input.dataset.cameraSetting, Number(input.value), input));
  }

  for (const input of document.querySelectorAll("[data-camera-setting-number]")) {
    input.addEventListener("input", () => updateCameraSetting(input.dataset.cameraSettingNumber, Number(input.value), input));
  }

  for (const button of document.querySelectorAll("[data-emotion-blush]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.blushPanelMinimized = false;
      addOrChangeEmotionBlush(button.dataset.emotionBlush, {
        pickImage: Boolean(button.closest(".blush-overlay-panel")),
      });
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-image]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.emotionImagePanelMinimized = false;
      addOrChangeEmotionImage(button.dataset.emotionImage, {
        pickImage: Boolean(button.closest(".emotion-image-overlay-panel")),
      });
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-blush-remove]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      removeEmotionBlush(button.dataset.emotionBlushRemove);
    });
  }

  for (const button of document.querySelectorAll("[data-emotion-image-remove]")) {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      removeEmotionImage(button.dataset.emotionImageRemove);
    });
  }

  for (const input of document.querySelectorAll("[data-blush-control]")) {
    input.addEventListener("input", () => updateSelectedBlushValue(input.dataset.blushControl, Number(input.value), input));
  }

  for (const input of document.querySelectorAll("[data-blush-number]")) {
    input.addEventListener("input", () => updateSelectedBlushValue(input.dataset.blushNumber, Number(input.value), input));
  }

  for (const input of document.querySelectorAll("[data-emotion-image-control]")) {
    input.addEventListener("input", () => updateSelectedEmotionImageValue(input.dataset.emotionImageControl, Number(input.value), input));
  }

  for (const input of document.querySelectorAll("[data-emotion-image-number]")) {
    input.addEventListener("input", () => updateSelectedEmotionImageValue(input.dataset.emotionImageNumber, Number(input.value), input));
  }

  document.querySelector("[data-emotion-image-loop]")?.addEventListener("change", (event) => updateSelectedEmotionImageLoop(event.target.checked));

  for (const surface of document.querySelectorAll("[data-emotion-graph]")) {
    surface.addEventListener("pointerdown", (event) => handleEmotionGraphPointerDown(event, surface));
    surface.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  for (const button of document.querySelectorAll("[data-emotion-head-axis]")) {
    button.addEventListener("click", () => toggleEmotionHeadRotationAxis(button.dataset.emotionHeadAxis));
  }

  for (const button of document.querySelectorAll("[data-emotion-curve]")) {
    button.addEventListener("click", () => updateSelectedEmotionImageCurve(button.dataset.emotionCurve));
  }

  document.querySelector("[data-emotion-curve-delete]")?.addEventListener("click", () => deleteSelectedEmotionImageGraphPoint());
  document.querySelector("[data-emotion-graph-preview]")?.addEventListener("click", () => startEmotionImageGraphAnimationForSelected(true));
  document.querySelector("[data-emotion-image-range-reset]")?.addEventListener("click", resetSelectedEmotionImageRangeSettings);

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

  for (const scroller of document.querySelectorAll(".expression-list, .parameter-list, .transfer-panel, .correction-panel, .expression-editor-panel, .emotion-linker-panel, .emotion-map-preset-list, .emotion-map-slot-list, .material-outline-list, .props-list, .props-settings-area, .extra-bone-panel, .transition-viewer-panel, .transition-preview-tray")) {
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
          : state.mode === "emotionMap"
            ? ".emotion-map-preset-list"
          : state.mode === "extraBone"
            ? ".extra-bone-panel"
          : state.mode === "transitionViewer"
            ? ".transition-viewer-panel"
        : state.editing
          ? ".parameter-list"
          : ".expression-editor-panel",
  );
  if (sidebar && activeScroller) bindPanelWheel(sidebar, activeScroller);
  bindEditableEventGuards();
}

function bindEditableEventGuards() {
  for (const element of document.querySelectorAll("input, textarea, select, [contenteditable='true']")) {
    element.addEventListener("pointerdown", (event) => event.stopPropagation());
    element.addEventListener("mousedown", (event) => event.stopPropagation());
    element.addEventListener("click", (event) => event.stopPropagation());
    element.addEventListener("dblclick", (event) => event.stopPropagation());
    element.addEventListener("keydown", (event) => event.stopPropagation());
    element.addEventListener("dragstart", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }
}

function getSelectedEmotionPreset() {
  return state.expressionPresets.find((preset) => preset.id === state.selectedExpressionPresetId) ?? state.expressionPresets[0] ?? null;
}

function repairSelectedExpressionPreset(fallbackId = null) {
  if (state.expressionPresets.some((preset) => preset.id === state.selectedExpressionPresetId)) return;
  const fallback = fallbackId && state.expressionPresets.some((preset) => preset.id === fallbackId)
    ? fallbackId
    : (state.expressionPresets[0]?.id ?? null);
  state.selectedExpressionPresetId = fallback;
  state.selectedExpressionRangeId = null;
  loadSelectedExpressionParameterDraft();
}

function getSelectedExpressionRangeSlot() {
  const selected = getSelectedEmotionPreset();
  if (!selected || !state.selectedExpressionRangeId) return null;
  return normalizeExpressionRangeSlots(selected.rangeSlots).find((slot) => slot.id === state.selectedExpressionRangeId) ?? null;
}

function updateSelectedExpressionRangeSlot(updater) {
  const selected = getSelectedEmotionPreset();
  if (!selected || !state.selectedExpressionRangeId) return null;
  const slots = normalizeExpressionRangeSlots(selected.rangeSlots);
  const index = slots.findIndex((slot) => slot.id === state.selectedExpressionRangeId);
  if (index < 0) return null;
  slots[index] = updater(slots[index], slots) ?? slots[index];
  selected.rangeSlots = slots.sort((a, b) => a.threshold - b.threshold);
  return selected.rangeSlots.find((slot) => slot.id === state.selectedExpressionRangeId) ?? null;
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
    blush: createDisabledPresetBlush(),
    emotionImage: null,
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
    blush: normalizePresetBlush(source.blush),
    emotionImage: source.emotionImage ? normalizePresetEmotionImage(source.emotionImage) : null,
    rangeSlots: normalizeExpressionRangeSlots(source.rangeSlots).map((slot, index) => ({
      id: `range-${Date.now()}-${index}`,
      threshold: slot.threshold,
      parameters: normalizeExpressionParameterValues(slot.parameters),
      ...(slot.blushOpacity != null ? { blushOpacity: slot.blushOpacity } : {}),
      ...(slot.emotionImage ? { emotionImage: normalizePresetEmotionImage(slot.emotionImage) } : {}),
    })),
  };
  state.expressionPresets.splice(sourceIndex + 1, 0, copy);
  markExpressionMetaDirty();
  renderPreservingExpressionScroll();
}

async function addOrChangeEmotionBlush(id, options = {}) {
  const preset = state.expressionPresets.find((item) => item.id === id);
  if (!preset) return;
  if (isPresetBlushEnabled(preset) && !options.pickImage) {
    state.selectedExpressionPresetId = id;
    state.selectedExpressionRangeId = null;
    updateBlushOverlayForSelected();
    renderPreservingExpressionScroll();
    return;
  }
  if (preset.locked) return;
  if (!isPresetBlushEnabled(preset) && !window.confirm("홍조를 추가할까요?")) return;
  const shouldPickImage = options.pickImage || !state.correction.blush?.image;
  if (shouldPickImage) {
    const result = await window.vrmFiles.storeImage();
    if (!result) return;
    state.correction.blush = normalizeBlushSettings({
      ...(state.correction.blush ?? {}),
      image: result.name,
    });
  }
  preset.blush = { ...normalizePresetBlush(preset.blush), enabled: true };
  state.selectedExpressionPresetId = id;
  state.selectedExpressionRangeId = null;
  markExpressionMetaDirty();
  updateBlushOverlayForSelected();
  renderPreservingExpressionScroll();
}

function removeEmotionBlush(id) {
  const preset = state.expressionPresets.find((item) => item.id === id);
  if (!preset || preset.locked) return;
  if (!window.confirm("홍조를 제거할까요?")) return;
  preset.blush = createDisabledPresetBlush();
  preset.rangeSlots = normalizeExpressionRangeSlots(preset.rangeSlots).map((slot) => {
    return { ...slot, blushOpacity: 0 };
  });
  markExpressionMetaDirty();
  updateBlushOverlayForSelected();
  renderPreservingExpressionScroll();
}

function updateSelectedBlushValue(key, value, source) {
  const selected = getSelectedEmotionPreset();
  if (!selected || !isPresetBlushEnabled(selected) || selected.locked || !Number.isFinite(value)) return;
  if (key === "opacity") {
    setSelectedBlushOpacity(value);
  } else {
    state.correction.blush = normalizeBlushSettings({
      ...(state.correction.blush ?? {}),
      [key]: value,
    });
  }
  syncBlushControls(key, key === "opacity" ? getSelectedBlushOpacity() : state.correction.blush?.[key], source);
  markExpressionMetaDirty();
  updateBlushOverlayForSelected();
}

async function addOrChangeEmotionImage(id, options = {}) {
  const preset = state.expressionPresets.find((item) => item.id === id);
  if (!preset) return;
  if (preset.emotionImage && !options.pickImage) {
    state.selectedExpressionPresetId = id;
    state.selectedExpressionRangeId = null;
    updateEmotionImageOverlayForSelected();
    renderPreservingExpressionScroll();
    return;
  }
  if (preset.locked) return;
  if (!preset.emotionImage && !window.confirm("이미지를 추가할까요?")) return;
  const shouldPickImage = options.pickImage || !preset.emotionImage?.image;
  if (shouldPickImage) {
    const result = await window.vrmFiles.storeImage();
    if (!result) return;
    preset.emotionImage = normalizePresetEmotionImage({
      ...(preset.emotionImage ?? {}),
      image: result.name,
    });
    setEmotionImageFileForAllRangeSlots(preset, result.name);
  } else {
    preset.emotionImage = normalizePresetEmotionImage(preset.emotionImage);
  }
  seedEmotionImageToAllRangeSlots(preset, preset.emotionImage);
  state.selectedExpressionPresetId = id;
  state.selectedExpressionRangeId = null;
  markExpressionMetaDirty();
  updateEmotionImageOverlayForSelected();
  renderPreservingExpressionScroll();
}

function removeEmotionImage(id) {
  const preset = state.expressionPresets.find((item) => item.id === id);
  if (!preset || preset.locked) return;
  if (!window.confirm("이미지를 제거할까요?")) return;
  preset.emotionImage = null;
  preset.rangeSlots = normalizeExpressionRangeSlots(preset.rangeSlots).map((slot) => {
    const next = { ...slot };
    delete next.emotionImage;
    return next;
  });
  markExpressionMetaDirty();
  updateEmotionImageOverlayForSelected();
  renderPreservingExpressionScroll();
}

function updateSelectedEmotionImageValue(key, value, source) {
  const selected = getSelectedEmotionPreset();
  if (!selected || !selected.emotionImage || selected.locked || !Number.isFinite(value)) return;
  if (!["scale", "rotation", "animationDuration"].includes(key)) return;
  const next = updateSelectedEmotionImageSettings({ [key]: value });
  syncEmotionImageControls(key, next?.[key], source);
  markExpressionMetaDirty();
  updateEmotionImageOverlayForSelected();
}

function updateSelectedEmotionImageLoop(loop) {
  const selected = getSelectedEmotionPreset();
  if (!selected || !selected.emotionImage || selected.locked) return;
  const next = updateSelectedEmotionImageSettings({ loop: Boolean(loop) });
  markExpressionMetaDirty();
  if (next?.loop && isEmotionImageGraphAnimated(getActiveEmotionImageSettings())) {
    startEmotionImageGraphAnimationForSelected(true);
  }
}

function beginEmotionImagePivotPicking() {
  const selected = getSelectedEmotionPreset();
  if (!selected?.emotionImage || selected.locked || !emotionImageOverlay?.mesh) return;
  state.emotionImagePivotPicking = !state.emotionImagePivotPicking;
  if (state.emotionImagePivotPicking) {
    detachEmotionImageTransformControls();
    setScreenshotMessage("감정 이미지에서 스케일 피벗 위치를 클릭하세요.");
  } else {
    attachEmotionImageTransformControls();
    setScreenshotMessage("");
  }
  renderPreservingExpressionScroll();
}

function handleEmotionImagePivotPointerDown(event) {
  if (!state.emotionImagePivotPicking) return;
  event.preventDefault();
  event.stopPropagation();
  const selected = getSelectedEmotionPreset();
  if (!selected?.emotionImage || selected.locked || !emotionImageOverlay?.mesh) {
    state.emotionImagePivotPicking = false;
    return;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  emotionImagePointer.set(
    ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
    -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1),
  );
  emotionImageRaycaster.setFromCamera(emotionImagePointer, camera);
  const hit = emotionImageRaycaster.intersectObject(emotionImageOverlay.mesh, false)[0];
  if (!hit?.uv) {
    setScreenshotMessage("감정 이미지 위를 클릭하세요.");
    return;
  }
  const next = updateSelectedEmotionImageSettings({
    pivotX: hit.uv.x,
    pivotY: hit.uv.y,
  });
  if (!next) return;
  state.emotionImagePivotPicking = false;
  markExpressionMetaDirty();
  applyEmotionImageOverlaySettings(next);
  attachEmotionImageTransformControls();
  setScreenshotMessage("감정 이미지 스케일 피벗을 저장했습니다.");
  renderPreservingExpressionScroll();
}

function resetEmotionImageRotation() {
  const selected = getSelectedEmotionPreset();
  if (!selected || !selected.emotionImage || selected.locked) return;
  updateSelectedEmotionImageSettings({ rotation: 0 });
  syncEmotionImageControls("rotation", 0);
  markExpressionMetaDirty();
  updateEmotionImageOverlayForSelected();
}

function resetSelectedEmotionImageRangeSettings() {
  const selected = getSelectedEmotionPreset();
  const slot = getSelectedExpressionRangeSlot();
  if (!selected?.emotionImage || !slot || selected.locked) return;
  const slots = normalizeExpressionRangeSlots(selected.rangeSlots);
  const lastSlot = slots.filter((item) => item.emotionImage?.image && item.id !== slot.id).at(-1);
  const base = lastSlot?.emotionImage ?? normalizePresetEmotionImage(selected.emotionImage);
  if (!base) return;
  updateSelectedExpressionRangeSlot((target) => ({
    ...target,
    emotionImage: normalizePresetEmotionImage(base),
  }));
  markExpressionMetaDirty();
  updateEmotionImageOverlayForSelected();
  renderPreservingExpressionScroll();
}

function syncEmotionImageControls(key, value, source = null) {
  const formatted = roundForInput(value);
  for (const input of document.querySelectorAll(`[data-emotion-image-control="${key}"], [data-emotion-image-number="${key}"]`)) {
    if (input === source) continue;
    input.value = formatted;
  }
}

function syncEmotionImagePositionControls(settings = getActiveEmotionImageSettings()) {
  if (!settings) return;
  for (const axis of ["x", "y", "z"]) {
    const input = document.querySelector(`[data-emotion-image-position="${axis}"]`);
    if (input) input.value = roundForInput(settings[axis]);
  }
}

function handleEmotionGraphPointerDown(event, surface) {
  const selected = getSelectedEmotionPreset();
  if (!selected?.emotionImage || selected.locked || surface.dataset.disabled === "true") return;
  const graphKey = surface.dataset.emotionGraph;
  const minValue = Number(surface.dataset.emotionGraphMin ?? 0);
  const maxValue = Number(surface.dataset.emotionGraphMax);
  if (!isEmotionImageEditableGraph(graphKey) || !Number.isFinite(minValue) || !Number.isFinite(maxValue)) return;
  event.preventDefault();
  event.stopPropagation();
  const pointButton = event.target.closest?.("[data-emotion-graph-point]");
  if (event.button === 2) {
    if (pointButton) {
      const pointIndex = Number(String(pointButton.dataset.emotionGraphPoint ?? "").split(":")[1]);
      deleteEmotionImageGraphPoint(graphKey, pointIndex);
    }
    return;
  }
  if (event.button != null && event.button !== 0) return;
  let pointIndex = -1;
  if (pointButton) {
    pointIndex = Number(String(pointButton.dataset.emotionGraphPoint ?? "").split(":")[1]);
  } else {
    pointIndex = addEmotionImageGraphPointAtEvent(graphKey, maxValue, event, surface);
  }
  if (pointIndex < 0) return;
  state.selectedEmotionImageGraph =
    graphKey === "headRotationGraph"
      ? { graph: graphKey, axis: getSelectedHeadRotationAxis(getActiveEmotionImageSettings()), index: pointIndex }
      : { graph: graphKey, index: pointIndex };
  renderPreservingExpressionScroll();
  const nextSurface = document.querySelector(`[data-emotion-graph="${graphKey}"]`);
  beginEmotionImageGraphPointDrag(event, nextSurface, graphKey, maxValue, pointIndex);
}

function addEmotionImageGraphPointAtEvent(graphKey, maxValue, event, surface) {
  const minValue = Number(surface.dataset.emotionGraphMin ?? 0);
  const point = getEmotionGraphPointFromEvent(event, surface, maxValue, minValue);
  const settings = getActiveEmotionImageSettings();
  const graph = getEmotionImageGraphForKey(settings, graphKey);
  graph.push({ time: point.time, value: point.value, curve: "linear" });
  graph.sort((a, b) => a.time - b.time);
  const index = graph.findIndex((item) => Math.abs(item.time - point.time) < 0.0001 && Math.abs(item.value - point.value) < 0.0001);
  updateEmotionImageGraph(graphKey, graph);
  return Math.max(0, index);
}

function beginEmotionImageGraphPointDrag(event, surface, graphKey, maxValue, pointIndex) {
  if (!surface) return;
  const move = (moveEvent) => {
    moveEvent.preventDefault();
    moveEmotionImageGraphPoint(graphKey, maxValue, moveEvent, surface, pointIndex);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    renderPreservingExpressionScroll();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}

function moveEmotionImageGraphPoint(graphKey, maxValue, event, surface, pointIndex) {
  const settings = getActiveEmotionImageSettings();
  const minValue = Number(surface.dataset.emotionGraphMin ?? 0);
  const graph = getEmotionImageGraphForKey(settings, graphKey);
  const current = graph[pointIndex];
  if (!current) return;
  const point = getEmotionGraphPointFromEvent(event, surface, maxValue, minValue);
  const isFirst = pointIndex === 0;
  const isLast = pointIndex === graph.length - 1;
  const minTime = isFirst ? 0 : graph[pointIndex - 1].time + 0.01;
  const maxTime = isLast ? 1 : graph[pointIndex + 1].time - 0.01;
  graph[pointIndex] = {
    ...current,
    time: isFirst ? 0 : isLast ? 1 : clampNumber(point.time, minTime, maxTime, current.time),
    value: clampNumber(point.value, minValue, maxValue, current.value),
  };
  state.selectedEmotionImageGraph =
    graphKey === "headRotationGraph"
      ? { graph: graphKey, axis: getSelectedHeadRotationAxis(getActiveEmotionImageSettings()), index: pointIndex }
      : { graph: graphKey, index: pointIndex };
  updateEmotionImageGraph(graphKey, graph, { render: false });
  updateEmotionImageGraphDom(graphKey, graph, maxValue);
}

function getEmotionGraphPointFromEvent(event, surface, maxValue, minValue = 0) {
  const rect = surface.getBoundingClientRect();
  const x = clampNumber((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1, 0);
  const y = clampNumber((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1, 0);
  return {
    time: Math.round(x * 10) / 10,
    value: Math.round((minValue + (maxValue - minValue) * (1 - y)) * 10) / 10,
  };
}

function updateEmotionImageGraphDom(graphKey, graph, maxValue) {
  const surface = document.querySelector(`[data-emotion-graph="${graphKey}"]`);
  if (!surface) return;
  const minValue = Number(surface.dataset.emotionGraphMin ?? 0);
  const path =
    graphKey === "headRotationGraph"
      ? surface.querySelector(`.emotion-graph-axis-${getSelectedHeadRotationAxis(getActiveEmotionImageSettings())}`)
      : surface.querySelector(".emotion-graph-line");
  if (path) {
    path.setAttribute("d", minValue < 0 ? buildEmotionGraphPathRange(graph, minValue, maxValue) : buildEmotionGraphPath(graph, maxValue));
  }
  const selectedIndex = state.selectedEmotionImageGraph?.graph === graphKey ? Number(state.selectedEmotionImageGraph.index) : -1;
  const selectedValue = graph[selectedIndex]?.value;
  const valueLabel = surface.querySelector(".emotion-graph-selected-value");
  if (valueLabel) valueLabel.textContent = Number.isFinite(selectedValue) ? Number(selectedValue).toFixed(1) : "";
  for (const button of surface.querySelectorAll("[data-emotion-graph-point]")) {
    const index = Number(String(button.dataset.emotionGraphPoint ?? "").split(":")[1]);
    const point = graph[index];
    if (!point) continue;
    button.style.left = `${(point.time * 100).toFixed(3)}%`;
    const y = minValue < 0 ? emotionGraphYRange(point.value, minValue, maxValue) : emotionGraphY(point.value, maxValue);
    button.style.top = `${((y / EMOTION_GRAPH_HEIGHT) * 100).toFixed(3)}%`;
  }
}

function updateSelectedEmotionImageCurve(curve) {
  const selected = getSelectedEmotionPreset();
  const graphKey = state.selectedEmotionImageGraph?.graph;
  const pointIndex = state.selectedEmotionImageGraph?.index ?? -1;
  if (
    !selected?.emotionImage ||
    selected.locked ||
    !isEmotionImageEditableGraph(graphKey) ||
    !["linear", "easeOut", "easeIn", "easeInOut", "step"].includes(curve)
  ) {
    return;
  }
  const settings = getActiveEmotionImageSettings();
  const graph = getEmotionImageGraphForKey(settings, graphKey);
  if (!graph[pointIndex]) return;
  graph[pointIndex] = { ...graph[pointIndex], curve };
  updateEmotionImageGraph(graphKey, graph);
}

function deleteSelectedEmotionImageGraphPoint() {
  const selected = getSelectedEmotionPreset();
  const graphKey = state.selectedEmotionImageGraph?.graph;
  const pointIndex = state.selectedEmotionImageGraph?.index ?? -1;
  if (!selected?.emotionImage || selected.locked || !isEmotionImageEditableGraph(graphKey)) return;
  const graph = getEmotionImageGraphForKey(getActiveEmotionImageSettings(), graphKey);
  if (pointIndex <= 0 || pointIndex >= graph.length - 1) return;
  deleteEmotionImageGraphPoint(graphKey, pointIndex);
}

function deleteEmotionImageGraphPoint(graphKey, pointIndex) {
  const selected = getSelectedEmotionPreset();
  if (!selected?.emotionImage || selected.locked || !isEmotionImageEditableGraph(graphKey)) return;
  const graph = getEmotionImageGraphForKey(getActiveEmotionImageSettings(), graphKey);
  if (pointIndex <= 0 || pointIndex >= graph.length - 1) return;
  graph.splice(pointIndex, 1);
  state.selectedEmotionImageGraph =
    graphKey === "headRotationGraph"
      ? { graph: graphKey, axis: getSelectedHeadRotationAxis(getActiveEmotionImageSettings()), index: Math.max(0, pointIndex - 1) }
      : { graph: graphKey, index: Math.max(0, pointIndex - 1) };
  updateEmotionImageGraph(graphKey, graph);
}

function updateEmotionImageGraph(graphKey, graph, options = {}) {
  const selected = getSelectedEmotionPreset();
  if (!selected?.emotionImage || selected.locked || !isEmotionImageEditableGraph(graphKey)) return;
  const settings = getActiveEmotionImageSettings();
  const patch =
    graphKey === "headRotationGraph"
      ? {
          headRotationGraph: {
            ...normalizeHeadRotationGraph(settings.headRotationGraph),
            [getSelectedHeadRotationAxis(settings)]: normalizeEmotionImageGraphRange(
              graph,
              EMOTION_HEAD_ROTATION_MIN,
              EMOTION_HEAD_ROTATION_MAX,
              0,
            ),
          },
        }
      : { [graphKey]: graph };
  updateSelectedEmotionImageSettings(patch);
  markExpressionMetaDirty();
  updateEmotionImageOverlayForSelected();
  if (options.render !== false) renderPreservingExpressionScroll();
}

function isEmotionImageEditableGraph(graphKey) {
  return ["scaleGraph", "opacityGraph", "headRotationGraph"].includes(graphKey);
}

function getEmotionImageGraphForKey(settings, graphKey) {
  if (graphKey === "scaleGraph") return normalizeEmotionImageGraph(settings?.scaleGraph, 2);
  if (graphKey === "opacityGraph") return normalizeEmotionImageGraph(settings?.opacityGraph, 1);
  if (graphKey === "headRotationGraph") {
    const axis = getSelectedHeadRotationAxis(settings);
    return normalizeEmotionImageGraphRange(settings?.headRotationGraph?.[axis], EMOTION_HEAD_ROTATION_MIN, EMOTION_HEAD_ROTATION_MAX, 0);
  }
  return [];
}

function toggleEmotionHeadRotationAxis(axis) {
  const selected = getSelectedEmotionPreset();
  if (!selected?.emotionImage || selected.locked || !["x", "y", "z"].includes(axis)) return;
  const settings = getActiveEmotionImageSettings();
  const axes = normalizeHeadRotationAxes(settings.headRotationAxes);
  const wasSelected = state.selectedEmotionImageGraph?.graph === "headRotationGraph" && state.selectedEmotionImageGraph?.axis === axis;
  axes[axis] = wasSelected ? !axes[axis] : true;
  updateSelectedEmotionImageSettings({
    ...settings,
    headRotationAxes: axes,
    headRotationGraph: normalizeHeadRotationGraph(settings.headRotationGraph),
  });
  state.selectedEmotionImageGraph = { graph: "headRotationGraph", axis, index: 0 };
  markExpressionMetaDirty();
  startEmotionImageGraphAnimationForSelected(true);
  renderPreservingExpressionScroll();
}

function syncBlushControls(key, value, source) {
  const formatted = roundForInput(value);
  for (const input of document.querySelectorAll(`[data-blush-control="${key}"], [data-blush-number="${key}"]`)) {
    if (input === source) continue;
    input.value = formatted;
  }
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
    ...(preset.emotionImage ? { emotionImage: normalizePresetEmotionImage(getEmotionImageBaseSettings(preset) ?? preset.emotionImage) } : {}),
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
  if (!preset || preset.locked) return;
  preset.isDisableBlink = !preset.isDisableBlink;
  markExpressionMetaDirty();
  renderPreservingExpressionScroll();
}

function deleteEmotionPreset(id) {
  const deleteIndex = state.expressionPresets.findIndex((item) => item.id === id);
  const preset = state.expressionPresets[deleteIndex];
  if (!preset || preset.locked) return;
  if (!window.confirm("삭제할까요?")) return;
  const wasSelected = state.selectedExpressionPresetId === id;
  const nextFallbackIndex = Math.max(0, Math.min(deleteIndex, state.expressionPresets.length - 2));
  state.expressionPresets = state.expressionPresets.filter((item) => item.id !== id);
  if (wasSelected) {
    state.selectedExpressionPresetId = state.expressionPresets[nextFallbackIndex]?.id ?? null;
    state.selectedExpressionRangeId = null;
    state.expressionTransition = null;
    state.expressionDecay = null;
  }
  repairSelectedExpressionPreset();
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
  const editableFocus = captureEditableFocus();
  render();
  const nextPopup = document.querySelector(".parameter-filter-popup");
  if (nextPopup) nextPopup.scrollTop = scrollTop;
  restoreEditableFocus(editableFocus);
}

function cssEscape(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isEditableElement(element) {
  if (!element?.matches) return false;
  return element.matches("input, textarea, select, [contenteditable='true']");
}

function getStableElementSelector(element) {
  if (!element?.attributes) return null;
  if (element.id) return `[id="${cssEscape(element.id)}"]`;
  for (const attribute of element.attributes) {
    if (attribute.name.startsWith("data-") && attribute.value) {
      return `[${attribute.name}="${cssEscape(attribute.value)}"]`;
    }
  }
  return null;
}

function captureEditableFocus() {
  const active = document.activeElement;
  if (!isEditableElement(active)) return null;
  const selector = getStableElementSelector(active);
  if (!selector) return null;
  return {
    selector,
    start: active.selectionStart ?? active.value.length,
    end: active.selectionEnd ?? active.value.length,
  };
}

function restoreEditableFocus(focusState) {
  if (!focusState?.selector) return;
  const input = document.querySelector(focusState.selector);
  if (!isEditableElement(input)) return;
  input.focus({ preventScroll: true });
  if (typeof input.setSelectionRange !== "function") return;
  const end = Math.min(focusState.end, input.value.length);
  const start = Math.min(focusState.start, end);
  input.setSelectionRange(start, end);
}

function renderPreservingExpressionScroll(options = {}) {
  const scroller = document.querySelector(".expression-editor-panel");
  const scrollTop = scroller?.scrollTop ?? 0;
  const editableFocus = captureEditableFocus();
  render();
  const nextScroller = document.querySelector(".expression-editor-panel");
  if (!nextScroller) return;
  nextScroller.scrollTop = options.scrollToBottom ? nextScroller.scrollHeight : scrollTop;
  restoreEditableFocus(editableFocus);
}

function renderPreservingExpressionEditorScrolls() {
  const expressionScroller = document.querySelector(".expression-editor-panel");
  const parameterScroller = document.querySelector(".expression-parameter-tray");
  const expressionScrollTop = expressionScroller?.scrollTop ?? 0;
  const parameterScrollTop = parameterScroller?.scrollTop ?? 0;
  const editableFocus = captureEditableFocus();
  render();
  const nextExpressionScroller = document.querySelector(".expression-editor-panel");
  const nextParameterScroller = document.querySelector(".expression-parameter-tray");
  if (nextExpressionScroller) nextExpressionScroller.scrollTop = expressionScrollTop;
  if (nextParameterScroller) nextParameterScroller.scrollTop = parameterScrollTop;
  restoreEditableFocus(editableFocus);
}

function renderPreservingEmotionLinkerScroll() {
  const scroller = document.querySelector(".emotion-linker-panel");
  const scrollTop = scroller?.scrollTop ?? 0;
  const editableFocus = captureEditableFocus();
  render();
  const nextScroller = document.querySelector(".emotion-linker-panel");
  if (nextScroller) nextScroller.scrollTop = scrollTop;
  restoreEditableFocus(editableFocus);
}

function renderPreservingScrollableUi() {
  const selectors = [
    ".expression-list",
    ".parameter-list",
    ".transfer-panel",
    ".correction-panel",
    ".expression-editor-panel",
    ".expression-parameter-tray",
    ".emotion-linker-panel",
    ".emotion-map-preset-list",
    ".emotion-map-slot-list",
    ".material-outline-list",
    ".props-list",
    ".props-settings-area",
    ".extra-bone-panel",
    ".transition-viewer-panel",
    ".transition-preview-tray",
    ".parameter-filter-popup",
  ];
  const positions = selectors.map((selector) => {
    const element = document.querySelector(selector);
    return { selector, scrollTop: element?.scrollTop ?? 0, scrollLeft: element?.scrollLeft ?? 0 };
  });
  const editableFocus = captureEditableFocus();
  render();
  for (const position of positions) {
    const element = document.querySelector(position.selector);
    if (!element) continue;
    element.scrollTop = position.scrollTop;
    element.scrollLeft = position.scrollLeft;
  }
  restoreEditableFocus(editableFocus);
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
  updateBlushOverlayForSelected();
  updateEmotionImageOverlayForSelected();
  startEmotionImageGraphAnimationForSelected();
}

function updateBlushOverlayForSelected() {
  const selected = getSelectedEmotionPreset();
  const blush = isPresetBlushEnabled(selected) ? getActiveBlushSettings() : null;
  if (!currentVrm || !blush?.image) {
    clearBlushOverlay();
    return;
  }
  void ensureBlushOverlay(blush).then((ready) => {
    if (ready) applyBlushOverlaySettings(blush, selected.value);
  });
}

async function ensureBlushOverlay(blush, options = {}) {
  const requireSelectedPreset = options.requireSelectedPreset !== false;
  const head = getRawBoneNode("head");
  if (!head) {
    clearBlushOverlay();
    return false;
  }
  if (blushOverlay?.image === blush.image && blushOverlay.mesh?.parent === head) return true;
  clearBlushOverlay();
  const requestId = ++blushOverlayRequestId;
  let result;
  try {
    result = await window.vrmFiles.openStoredImage(blush.image);
  } catch {
    clearBlushOverlay();
    return false;
  }
  if (requestId !== blushOverlayRequestId || !result || getActiveBlushSettings()?.image !== blush.image || (requireSelectedPreset && !isPresetBlushEnabled(getSelectedEmotionPreset()))) return false;
  const url = URL.createObjectURL(new Blob([new Uint8Array(result.data)], { type: getImageMimeType(result.name) }));
  let texture;
  try {
    texture = await new THREE.TextureLoader().loadAsync(url);
  } catch {
    URL.revokeObjectURL(url);
    clearBlushOverlay();
    return false;
  }
  if (requestId !== blushOverlayRequestId || getActiveBlushSettings()?.image !== blush.image || (requireSelectedPreset && !isPresetBlushEnabled(getSelectedEmotionPreset()))) {
    texture.dispose?.();
    URL.revokeObjectURL(url);
    return false;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  const imageWidth = texture.image?.width || 1;
  const imageHeight = texture.image?.height || 1;
  const aspect = imageWidth / Math.max(imageHeight, 1);
  const geometry = new THREE.PlaneGeometry(aspect, 1);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "ExpressionEditor_BlushOverlay";
  mesh.renderOrder = 999;
  head.add(mesh);
  blushOverlay = { mesh, material, texture, geometry, url, image: blush.image };
  return true;
}

function applyBlushOverlaySettings(blush, weight = 1, opacityOverride = null) {
  if (!blushOverlay?.mesh || !blushOverlay?.material) return;
  const normalized = normalizeBlushSettings(blush);
  if (!normalized) return;
  blushOverlay.mesh.position.set(0, normalized.y, normalized.z);
  blushOverlay.mesh.rotation.set(0, 0, 0);
  blushOverlay.mesh.scale.setScalar(normalized.scale);
  blushOverlay.material.opacity = opacityOverride == null ? getBlushOpacityAtValue(getSelectedEmotionPreset(), weight) : clampEmotionValue(Number(opacityOverride));
  blushOverlay.mesh.visible = blushOverlay.material.opacity > 0.001;
}

function clearBlushOverlay() {
  blushOverlayRequestId += 1;
  if (!blushOverlay) return;
  blushOverlay.mesh?.parent?.remove(blushOverlay.mesh);
  blushOverlay.geometry?.dispose?.();
  blushOverlay.material?.dispose?.();
  blushOverlay.texture?.dispose?.();
  if (blushOverlay.url) URL.revokeObjectURL(blushOverlay.url);
  blushOverlay = null;
}

function updateEmotionImageOverlayForSelected() {
  const selected = getSelectedEmotionPreset();
  const settings = selected?.emotionImage ? getActiveEmotionImageSettings() : null;
  if (!currentVrm || !settings?.image) {
    clearEmotionImageOverlay();
    return;
  }
  void ensureEmotionImageOverlay(settings).then((ready) => {
    if (ready) applyEmotionImageOverlaySettings(settings);
  });
}

function ensureEmotionImageTransformControls() {
  if (emotionImageTransformControls) return emotionImageTransformControls;
  emotionImageTransformControls = new TransformControls(camera, renderer.domElement);
  emotionImageTransformControls.setMode("translate");
  emotionImageTransformControls.setSize(0.75);
  const helper = emotionImageTransformControls.getHelper();
  helper.name = "ExpressionEditor_EmotionImageTransformControls";
  scene.add(helper);
  emotionImageTransformControls.addEventListener("dragging-changed", (event) => {
    emotionImageTransformDragging = Boolean(event.value);
    controls.enabled = !event.value;
  });
  emotionImageTransformControls.addEventListener("objectChange", () => {
    updateEmotionImagePositionFromGizmo();
  });
  return emotionImageTransformControls;
}

function attachEmotionImageTransformControls() {
  const selected = getSelectedEmotionPreset();
  if (
    !emotionImageOverlay?.group ||
    !selected?.emotionImage ||
    selected.locked ||
    state.mode !== "expression" ||
    state.editing ||
    state.emotionImagePanelMinimized ||
    state.emotionImagePivotPicking
  ) {
    detachEmotionImageTransformControls();
    return;
  }
  const transform = ensureEmotionImageTransformControls();
  transform.setMode("translate");
  if (transform.object !== emotionImageOverlay.group) transform.attach(emotionImageOverlay.group);
}

function detachEmotionImageTransformControls() {
  if (!emotionImageTransformControls) return;
  emotionImageTransformDragging = false;
  emotionImageTransformControls.detach();
  controls.enabled = true;
}

function updateEmotionImagePositionFromGizmo() {
  const selected = getSelectedEmotionPreset();
  if (!selected?.emotionImage || selected.locked || !emotionImageOverlay?.group) return;
  const position = emotionImageOverlay.group.position;
  const next = updateSelectedEmotionImageSettings({
    x: position.x,
    y: position.y,
    z: position.z,
  });
  if (!next) return;
  emotionImageOverlay.group.position.set(
    next.x,
    next.y,
    next.z,
  );
  syncEmotionImagePositionControls(next);
  markExpressionMetaDirty();
}

async function ensureEmotionImageOverlay(settings, options = {}) {
  const requireSelectedPreset = options.requireSelectedPreset !== false;
  if (emotionImageOverlay?.image === settings.image && emotionImageOverlay.group?.parent === scene) return true;
  clearEmotionImageOverlay();
  const requestId = ++emotionImageOverlayRequestId;
  let result;
  try {
    result = await window.vrmFiles.openStoredImage(settings.image);
  } catch {
    clearEmotionImageOverlay();
    return false;
  }
  if (requestId !== emotionImageOverlayRequestId || !result || getActiveEmotionImageSettings()?.image !== settings.image || (requireSelectedPreset && !getSelectedEmotionPreset()?.emotionImage)) return false;
  const url = URL.createObjectURL(new Blob([new Uint8Array(result.data)], { type: getImageMimeType(result.name) }));
  let texture;
  try {
    texture = await new THREE.TextureLoader().loadAsync(url);
  } catch {
    URL.revokeObjectURL(url);
    clearEmotionImageOverlay();
    return false;
  }
  if (requestId !== emotionImageOverlayRequestId || getActiveEmotionImageSettings()?.image !== settings.image || (requireSelectedPreset && !getSelectedEmotionPreset()?.emotionImage)) {
    texture.dispose?.();
    URL.revokeObjectURL(url);
    return false;
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  const imageWidth = texture.image?.width || 1;
  const imageHeight = texture.image?.height || 1;
  const aspect = imageWidth / Math.max(imageHeight, 1);
  const width = aspect * 0.45;
  const height = 0.45;
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "ExpressionEditor_EmotionImageBillboard";
  mesh.renderOrder = 1000;
  const group = new THREE.Group();
  group.name = "ExpressionEditor_EmotionImagePivot";
  group.add(mesh);
  scene.add(group);
  emotionImageOverlay = { group, mesh, material, texture, geometry, url, image: settings.image, width, height };
  attachEmotionImageTransformControls();
  return true;
}

function applyEmotionImageOverlaySettings(settings, opacityMultiplier = 1) {
  if (!emotionImageOverlay?.group || !emotionImageOverlay?.mesh) return;
  const normalized = normalizeEmotionImageSettings(settings);
  if (!normalized) return;
  emotionImageOverlay.group.position.set(normalized.x, normalized.y, normalized.z);
  applyEmotionImagePivotOffset(normalized);
  applyEmotionImageBillboardQuaternion(normalized);
  applyEmotionImageAnimatedValues(normalized, opacityMultiplier);
  emotionImageOverlay.group.visible = true;
  emotionImageOverlay.mesh.visible = true;
  attachEmotionImageTransformControls();
}

function updateEmotionImageBillboard() {
  if (!emotionImageOverlay?.group?.visible) return;
  const active = getActiveEmotionImageSettings();
  const opacityMultiplier = state.mode === "emotionMap" ? (state.emotionMapActiveEmotionImage?.opacityMultiplier ?? 1) : 1;
  applyEmotionImageBillboardQuaternion(active);
  applyEmotionImageAnimatedValues(active, opacityMultiplier);
}

function applyEmotionImageBillboardQuaternion(settings = getActiveEmotionImageSettings()) {
  if (!emotionImageOverlay?.group) return;
  const rotation = normalizeEmotionImageSettings(settings)?.rotation ?? 0;
  emotionImageRollQuat.setFromAxisAngle(emotionImageRollAxis, THREE.MathUtils.degToRad(rotation));
  emotionImageOverlay.group.quaternion.copy(camera.quaternion).multiply(emotionImageRollQuat);
}

function applyEmotionImagePivotOffset(settings = getActiveEmotionImageSettings()) {
  if (!emotionImageOverlay?.mesh) return;
  const normalized = normalizeEmotionImageSettings(settings);
  const width = emotionImageOverlay.width ?? 0.45;
  const height = emotionImageOverlay.height ?? 0.45;
  emotionImageOverlay.mesh.position.set(
    (0.5 - (normalized?.pivotX ?? 0.5)) * width,
    (0.5 - (normalized?.pivotY ?? 0.5)) * height,
    0,
  );
}

function startEmotionImageGraphAnimationForSelected(force = false) {
  const selected = getSelectedEmotionPreset();
  const settings = selected?.emotionImage ? getActiveEmotionImageSettings() : null;
  if (!settings?.image || (!force && !isEmotionImageGraphAnimated(settings))) {
    state.emotionImageAnimation = null;
    return;
  }
  state.emotionImageAnimation = {
    elapsed: 0,
    duration: normalizeEmotionImageDuration(settings.animationDuration),
  };
}

function updateEmotionImageAnimation(delta) {
  if (!state.emotionImageAnimation) return;
  const settings = getActiveEmotionImageSettings();
  const duration = Math.max(normalizeEmotionImageDuration(settings?.animationDuration), 0.001);
  state.emotionImageAnimation.elapsed += delta;
  if (settings?.loop && state.emotionImageAnimation.elapsed >= duration) {
    state.emotionImageAnimation.elapsed %= duration;
    state.emotionImageAnimation.done = false;
    return;
  }
  if (state.emotionImageAnimation.elapsed >= duration) {
    state.emotionImageAnimation.elapsed = duration;
    state.emotionImageAnimation.done = true;
  }
}

function getEmotionImageAnimationProgress(settings = getActiveEmotionImageSettings()) {
  if (!settings || !state.emotionImageAnimation) return 1;
  const duration = Math.max(normalizeEmotionImageDuration(settings.animationDuration), 0.001);
  return clampNumber(state.emotionImageAnimation.elapsed / duration, 0, 1, 1);
}

function applyEmotionImageAnimatedValues(settings = getActiveEmotionImageSettings(), opacityMultiplierOverride = 1) {
  if (!emotionImageOverlay?.group || !emotionImageOverlay?.material || !settings) return;
  const progress = getEmotionImageAnimationProgress(settings);
  const scaleMultiplier = evaluateEmotionImageGraph(settings.scaleGraph, progress, 2);
  const opacityMultiplier = evaluateEmotionImageGraph(settings.opacityGraph, progress, 1);
  emotionImageOverlay.group.scale.setScalar(settings.scale * scaleMultiplier);
  emotionImageOverlay.material.opacity = clampNumber(settings.opacity * opacityMultiplier * opacityMultiplierOverride, 0, 1, 1);
}

function restoreEmotionImageHeadRotationOffset() {
  if (!emotionImageHeadRotationOffset) return;
  const head = getRawBoneNode("head");
  if (head) {
    head.quaternion.multiply(emotionImageHeadRotationOffset.clone().invert());
  }
  emotionImageHeadRotationOffset = null;
}

function applyEmotionImageHeadRotation(settings = getActiveEmotionImageSettings()) {
  if (!settings || !state.emotionImageAnimation) return;
  const axes = normalizeHeadRotationAxes(settings.headRotationAxes);
  if (!axes.x && !axes.y && !axes.z) return;
  const head = getRawBoneNode("head");
  if (!head) return;
  const progress = getEmotionImageAnimationProgress(settings);
  const x = axes.x ? evaluateEmotionImageGraph(settings.headRotationGraph?.x, progress, EMOTION_HEAD_ROTATION_MAX, EMOTION_HEAD_ROTATION_MIN) : 0;
  const y = axes.y ? evaluateEmotionImageGraph(settings.headRotationGraph?.y, progress, EMOTION_HEAD_ROTATION_MAX, EMOTION_HEAD_ROTATION_MIN) : 0;
  const z = axes.z ? evaluateEmotionImageGraph(settings.headRotationGraph?.z, progress, EMOTION_HEAD_ROTATION_MAX, EMOTION_HEAD_ROTATION_MIN) : 0;
  if (Math.abs(x) < 0.0001 && Math.abs(y) < 0.0001 && Math.abs(z) < 0.0001) return;
  const offset = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z),
      "XYZ",
    ),
  );
  head.quaternion.multiply(offset);
  emotionImageHeadRotationOffset = offset;
}

function evaluateEmotionImageGraph(graph, time, maxValue = 1, minValue = 0) {
  const points =
    minValue < 0
      ? normalizeEmotionImageGraphRange(graph, minValue, maxValue, 0)
      : normalizeEmotionImageGraph(graph, maxValue);
  const t = clampNumber(Number(time), 0, 1, 1);
  if (t <= points[0].time) return points[0].value;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    if (t > next.time) continue;
    const span = Math.max(next.time - current.time, 0.001);
    const local = clampNumber((t - current.time) / span, 0, 1, 0);
    if (current.curve === "step") return local < 1 ? current.value : next.value;
    const eased = evaluateEmotionImageCurve(current.curve, local);
    return current.value + (next.value - current.value) * eased;
  }
  return points.at(-1).value;
}

function evaluateEmotionImageCurve(curve, value) {
  const t = clampNumber(Number(value), 0, 1, 0);
  if (curve === "easeOut") return 1 - (1 - t) ** 3;
  if (curve === "easeIn") return t ** 3;
  if (curve === "easeInOut") return t * t * (3 - 2 * t);
  return t;
}

function clearEmotionImageOverlay() {
  emotionImageOverlayRequestId += 1;
  restoreEmotionImageHeadRotationOffset();
  state.emotionImageAnimation = null;
  state.emotionImagePivotPicking = false;
  if (!emotionImageOverlay) return;
  detachEmotionImageTransformControls();
  emotionImageOverlay.group?.parent?.remove(emotionImageOverlay.group);
  emotionImageOverlay.geometry?.dispose?.();
  emotionImageOverlay.material?.dispose?.();
  emotionImageOverlay.texture?.dispose?.();
  if (emotionImageOverlay.url) URL.revokeObjectURL(emotionImageOverlay.url);
  emotionImageOverlay = null;
}

function getImageMimeType(fileName) {
  const lower = String(fileName ?? "").toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

function transitionToSelectedEmotionPreset(duration = 0.2) {
  const selected = getSelectedEmotionPreset();
  if (!selected) {
    startExpressionTransition({}, 0, duration);
    clearBlushOverlay();
    clearEmotionImageOverlay();
    return;
  }
  startExpressionTransition(getExpressionParametersAtValue(selected, selected.value, true), 1, duration);
  updateBlushOverlayForSelected();
  updateEmotionImageOverlayForSelected();
  startEmotionImageGraphAnimationForSelected();
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

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeDegrees(value) {
  if (!Number.isFinite(value)) return 0;
  let next = value % 360;
  if (next > 180) next -= 360;
  if (next < -180) next += 360;
  return Math.round(next * 1000) / 1000;
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

async function importMetaSettings() {
  if (!state.correctionPath) return;
  const result = await window.vrmFiles.openMeta();
  if (!result) return;
  let source;
  let rawSource;
  try {
    rawSource = JSON.parse(dec.decode(new Uint8Array(result.data)));
    source = normalizeCorrectionJson(rawSource);
  } catch (error) {
    state.metaImportReport = {
      title: "Import failed",
      summary: "meta 파일을 읽지 못했습니다.",
      messages: [String(error?.message ?? error)],
      applied: false,
    };
    renderPreservingScrollableUi();
    return;
  }

  const report =
    state.mode === "correction"
      ? importCorrectionMeta(source)
      : state.mode === "expression"
        ? importExpressionMeta(source)
        : state.mode === "emotionMap"
          ? importEmotionMapMeta(source)
          : state.mode === "linker" || state.mode === "transitionViewer"
          ? importLinkerMeta(normalizeEmotionLinkerMeta(rawSource, state.expressionPresets))
          : {
              summary: "현재 모드에는 가져올 캐릭터 meta 설정이 없습니다.",
              messages: [],
              applied: false,
            };

  state.metaImportReport = {
    ...report,
    title: `${fileNameFromPath(result.filePath)} 가져오기`,
  };
  if (report.applied) {
    state.correctionDirty = true;
    if (state.mode === "expression") state.expressionDirty = true;
    loadSelectedExpressionParameterDraft();
    applySelectedEmotionPreset();
    applyMaterialOutlineSettings();
    applyMotionCorrectionPreview();
    syncSaveMetaButton();
  }
  renderPreservingScrollableUi();
}

function importEmotionMapMeta(source) {
  const messages = [];
  const labels = Array.from({ length: 20 }, () => "");
  const bindings = Array.from({ length: 20 }, () => null);
  let labelCount = 0;
  let bindingCount = 0;
  for (const point of source.emotionMap?.points ?? []) {
    const index = Number(point?.index);
    if (!EMOTION_MAP_POINTS.some((item) => item.index === index)) continue;
    labels[index - 1] = String(point?.emotionName ?? "");
    if (labels[index - 1]) labelCount += 1;
    const preset = findMatchingExpressionPreset(point?.expressionPresetId, point?.expressionPresetName);
    if (point?.expressionPresetId || point?.expressionPresetName) {
      if (!preset) {
        messages.push(`${point.expressionPresetName || point.expressionPresetId} 표정 없음`);
        continue;
      }
      const range = normalizeExpressionRangeSlots(preset.rangeSlots).find((item) => item.id === point?.expressionRangeId);
      bindings[index - 1] = {
        presetId: preset.id,
        name: preset.name,
        expressionRangeId: range?.id ?? "",
        expressionRangeName: range ? `range ${formatEmotionValue(range.threshold)}` : "",
        expressionValue: range ? clampEmotionValue(range.threshold) : clampEmotionValue(point?.expressionValue ?? 1),
      };
      bindingCount += 1;
    }
  }
  state.emotionMapLabels = labels;
  state.emotionMapBindings = bindings;
  state.correction.emotionMap = serializeEmotionMapConfig();
  return {
    summary: `${labelCount}개 감정 이름, ${bindingCount}개 감정맵 표정 연결 적용`,
    messages: [...new Set(messages)],
    applied: labelCount > 0 || bindingCount > 0,
  };
}

function importCorrectionMeta(source) {
  const messages = [];
  let animationCount = 0;
  let boneCount = 0;
  for (const [animationName, sourceEntry] of Object.entries(source.animations ?? {})) {
    const fileName = fileNameFromPath(animationName);
    if (!state.animationCatalog[fileName]) {
      messages.push(`${fileName} 없음`);
      continue;
    }
    const targetEntry = ensureAnimationMetaEntry(fileName);
    if (!targetEntry) {
      messages.push(`${fileName} 없음`);
      continue;
    }
    const nextCorrections = {};
    for (const [boneName, correction] of Object.entries(sourceEntry.corrections ?? {})) {
      if (!HUMAN_BONE_SET.has(boneName) || !getRawBoneNode(boneName)) {
        messages.push(`${boneName} 본 없음`);
        continue;
      }
      nextCorrections[boneName] = normalizeBoneCorrection(correction);
      pruneCorrectionObject(nextCorrections, boneName);
      if (nextCorrections[boneName]) boneCount += 1;
    }
    targetEntry.corrections = nextCorrections;
    animationCount += 1;
  }
  return {
    summary: `${animationCount}개 애니메이션, ${boneCount}개 본 보정값 적용`,
    messages,
    applied: animationCount > 0,
  };
}

function importLinkerMeta(source) {
  const messages = [];
  let linkCount = 0;
  for (const [animationName, sourceEntry] of Object.entries(source.animations ?? {})) {
    const fileName = fileNameFromPath(animationName);
    if (!state.animationCatalog[fileName]) {
      messages.push(`${fileName} 없음`);
      continue;
    }
    const targetEntry = ensureEmotionLinkerEntry(fileName);
    if (!targetEntry) {
      messages.push(`${fileName} 없음`);
      continue;
    }
    const preset = findMatchingExpressionPreset(sourceEntry.expressionPresetId, sourceEntry.expressionPresetName);
    if (sourceEntry.expressionPresetId || sourceEntry.expressionPresetName) {
      if (preset) {
        targetEntry.expressionPresetId = preset.id;
        targetEntry.expressionPresetName = preset.name;
        linkCount += 1;
      } else {
        delete targetEntry.expressionPresetId;
        delete targetEntry.expressionPresetName;
        messages.push(`${sourceEntry.expressionPresetName || sourceEntry.expressionPresetId} 표정 없음`);
      }
    }
  }
  return {
    summary: `${linkCount}개 애니메이션-표정 연결 적용`,
    messages,
    applied: linkCount > 0,
  };
}

function importExpressionMeta(source) {
  const messages = [];
  const imported = normalizeExpressionPresets(source.expressionPresets);
  if (!imported.length) {
    return { summary: "가져올 표정 프리셋이 없습니다.", messages, applied: false };
  }
  if (source.blush?.image) state.correction.blush = normalizeBlushSettings(source.blush);
  state.expressionPresets = imported.map((preset) => {
    const next = cloneJson(preset);
    next.value = 0;
    next.parameters = filterImportedExpressionParameters(next.parameters, state.currentParameterIds, messages);
    next.rangeSlots = next.rangeSlots.map((slot) => ({
      ...slot,
      parameters: filterImportedExpressionParameters(slot.parameters, state.currentParameterIds, messages),
    }));
    return next;
  });
  state.selectedExpressionPresetId = state.expressionPresets[0]?.id ?? null;
  state.selectedExpressionRangeId = null;
  return {
    summary: `${state.expressionPresets.length}개 표정 프리셋 적용`,
    messages: [...new Set(messages)],
    applied: state.expressionPresets.length > 0,
  };
}

function filterImportedExpressionParameters(parameters, parameterIds, messages) {
  const next = {};
  for (const [name, value] of Object.entries(parameters ?? {})) {
    if (!parameterIds.has(name)) {
      messages.push(`${name} 파라미터 없음`);
      continue;
    }
    next[name] = clampEmotionValue(Number(value));
  }
  return next;
}

function findMatchingExpressionPreset(id, name, presets = state.expressionPresets) {
  const idText = String(id ?? "");
  const nameText = String(name ?? "");
  return (
    presets.find((preset) => preset.id === idText) ??
    presets.find((preset) => preset.name === nameText) ??
    null
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
    await loadEmotionMapFromCharacterMeta(result.filePath);
    state.selectedPropId = normalizePropSettings(state.correction.props)[0]?.id ?? null;
    applySelectedEmotionPreset();
    await loadSelectedAnimation();
    updateVisiblePropsForSelectedAnimation();
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
  renderPreservingScrollableUi();
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
  renderPreservingScrollableUi();
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
  renderPreservingScrollableUi();
}

function useTransitionViewerSlot(slotId, target) {
  const found = findTransitionViewerSlot(slotId);
  if (!found || !found.slot.fileName) return;
  if (target === "sequence") {
    addTransitionSequencePick(found.slot.fileName);
    return;
  }
  if (!["start", "transitionPick", "end"].includes(target)) return;
  state.transitionViewer[target] = {
    id: found.slot.id,
    kind: found.kind,
    fileName: found.slot.fileName,
  };
  syncTransitionViewerConfigMemory();
  renderPreservingScrollableUi();
}

function setTransitionTrayMode(mode) {
  state.transitionViewer.trayMode = mode === "sequence" ? "sequence" : "transition";
  syncTransitionViewerConfigMemory();
  renderPreservingScrollableUi();
}

function addTransitionSequencePick(fileName) {
  if (!fileName) return;
  const sequence = normalizeTransitionSequence(state.transitionViewer.sequence);
  if (sequence.length >= 10) return;
  sequence.push({
    id: `sequence-slot-${Date.now()}-${sequence.length}`,
    fileName,
    loopCount: 1,
    transitionSeconds: 0.2,
  });
  state.transitionViewer.sequence = sequence;
  syncTransitionViewerConfigMemory();
  renderPreservingScrollableUi();
}

function removeTransitionSequenceSlot(slotId) {
  state.transitionViewer.sequence = normalizeTransitionSequence(state.transitionViewer.sequence).filter((slot) => slot.id !== slotId);
  syncTransitionViewerConfigMemory();
  renderPreservingScrollableUi();
}

function updateTransitionSequenceSlot(slotId, patch) {
  state.transitionViewer.sequence = normalizeTransitionSequence(state.transitionViewer.sequence).map((slot) =>
    slot.id === slotId
      ? normalizeTransitionSequence([
          {
            ...slot,
            ...patch,
          },
        ])[0] ?? slot
      : slot,
  );
  syncTransitionViewerConfigMemory();
  renderPreservingScrollableUi();
}

function moveTransitionSequenceSlot(slotId, direction) {
  const sequence = normalizeTransitionSequence(state.transitionViewer.sequence);
  const index = sequence.findIndex((slot) => slot.id === slotId);
  const nextIndex = index + Math.sign(direction);
  if (index < 0 || nextIndex < 0 || nextIndex >= sequence.length) return;
  const next = sequence.slice();
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  state.transitionViewer.sequence = next;
  syncTransitionViewerConfigMemory();
  renderPreservingScrollableUi();
}

function beginTransitionSequenceValueDrag(event, slotId) {
  if (event.button !== 0) return;
  const input = event.currentTarget;
  const sequence = normalizeTransitionSequence(state.transitionViewer.sequence);
  const slot = sequence.find((item) => item.id === slotId);
  if (!slot) return;
  const startX = event.clientX;
  const startValue = slot.transitionSeconds;
  let dragging = false;
  let latestValue = startValue;
  const onMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    if (!dragging && Math.abs(delta) < 3) return;
    dragging = true;
    moveEvent.preventDefault();
    latestValue = clampSequenceTransitionSeconds(startValue + delta / 80);
    input.value = latestValue.toFixed(1);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (dragging) {
      updateTransitionSequenceSlot(slotId, { transitionSeconds: latestValue });
    }
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}

function clampSequenceTransitionSeconds(value) {
  if (!Number.isFinite(value)) return 0.2;
  return Math.min(2, Math.max(0, Math.round(value * 10) / 10));
}

function getTransitionPick(key) {
  const pick = state.transitionViewer[key];
  return pick?.fileName ? pick : null;
}

function clearTransitionViewerPick() {
  state.transitionViewer.transitionPick = null;
  syncTransitionViewerConfigMemory();
  renderPreservingScrollableUi();
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
  renderPreservingScrollableUi();
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

async function playTransitionSequence() {
  const sequence = normalizeTransitionSequence(state.transitionViewer.sequence);
  if (!sequence.length || !currentVrm) return;
  const runId = Date.now();
  state.transitionViewer.runId = runId;
  state.transitionViewer.playing = false;
  state.transitionViewer.sequencePlaying = true;
  state.transitionViewer.sequenceActiveIndex = -1;
  state.transitionViewer.timelineProgress = 0;
  stopTransitionTimeline();
  render();
  try {
    let previousAction = false;
    for (let index = 0; index < sequence.length; index += 1) {
      const slot = sequence[index];
      state.transitionViewer.sequenceActiveIndex = index;
      renderPreservingScrollableUi();
      const loop = isAnimationLoop(slot.fileName);
      const transitionSeconds = previousAction ? slot.transitionSeconds : 0;
      await playTransitionViewerStep(slot.fileName, loop, transitionSeconds, {
        preserveCurrentAction: previousAction,
      });
      previousAction = true;
      if (!isCurrentTransitionRun(runId)) return;
      const next = sequence[index + 1];
      const duration = getTransitionSequenceSlotDuration(slot);
      const nextTransition = next ? Math.min(duration, next.transitionSeconds) : 0;
      await sleep(Math.max(0, duration - nextTransition) * 1000);
      if (!isCurrentTransitionRun(runId)) return;
    }
  } finally {
    if (isCurrentTransitionRun(runId)) {
      state.transitionViewer.sequencePlaying = false;
      state.transitionViewer.sequenceActiveIndex = -1;
      state.transitionViewer.playing = false;
      render();
    }
  }
}

function getTransitionSequenceSlotDuration(slot) {
  const duration = getAnimationDuration(slot.fileName, 2);
  return isAnimationLoop(slot.fileName) ? Math.max(0.1, duration * Math.max(1, slot.loopCount)) : Math.max(0.1, duration);
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
  const entry = getEmotionLinkerEntry(fileName);
  state.expressionDecay = null;
  startActiveLinkTimeline(fileName);
  const active = state.activeLinkTimeline;
  if (active?.timeline?.length) {
    applyInitialLinkedExpression(entry);
  } else if (entry.expressionPresetId) {
    applyLinkedExpressionPreset(entry.expressionPresetId, state.linkerTransitionSeconds);
  } else {
    state.activeLinkTimeline = null;
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
    updateVisiblePropsForSelectedAnimation();
    return;
  }
  if (!currentVrm) {
    resetAnimationState("VRM을 열면 애니메이션 미리보기가 가능합니다.");
    updateVisiblePropsForSelectedAnimation();
    return;
  }
  try {
    const result = await window.vrmFiles.openStoredAnimation(entry.fileName);
    const transition = await loadAnimationResult(result, options);
    updateVisiblePropsForSelectedAnimation();
    return transition;
  } catch (error) {
    resetAnimationState(`${entry.fileName} 파일을 animations 폴더에서 찾지 못했습니다.`);
    updateVisiblePropsForSelectedAnimation();
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
  renderPreservingScrollableUi();
}

async function selectAnimationFromFileList(animationName) {
  if (!animationName || !state.animationCatalog?.[animationName]) return;
  state.selectedAnimationName = animationName;
  await loadSelectedAnimation();
  applyMotionCorrectionPreview();
  renderPreservingScrollableUi();
}

async function deleteSelectedAnimation() {
  if (!state.selectedAnimationName) return;
  const name = state.selectedAnimationName;
  const shouldDelete = window.confirm(`현재 애니메이션을 삭제할까요?\n${name}\n\n앱 공통 애니메이션 목록과 animations 폴더의 파일이 삭제됩니다.`);
  if (!shouldDelete) return;
  const beforeNames = getAnimationNames();
  const deletedIndex = beforeNames.indexOf(name);
  await window.vrmFiles.deleteStoredAnimation(name);
  const hadCharacterCorrection = Boolean(state.correction.animations[name]);
  delete state.correction.animations[name];
  await refreshAnimationCatalog();
  const names = getAnimationNames();
  const fallbackIndex = Math.max(0, Math.min(deletedIndex, names.length - 1));
  state.selectedAnimationName = getDefaultAnimationName() ?? names[fallbackIndex] ?? null;
  if (hadCharacterCorrection && state.correctionPath) state.correctionDirty = true;
  await loadSelectedAnimation();
  applyMotionCorrectionPreview();
  renderPreservingScrollableUi();
}

function toggleSelectedAnimationMustWatch() {
  const entry = getSelectedAnimationEntry();
  if (!entry) return;
  entry.mustWatchFull = !entry.mustWatchFull;
  window.vrmFiles.updateAnimationInfo(entry.fileName, { mustWatchFull: entry.mustWatchFull });
  renderPreservingScrollableUi();
}

async function toggleSelectedAnimationFirst(checked) {
  const entry = getSelectedAnimationEntry();
  if (!entry) return;
  const updated = await window.vrmFiles.updateAnimationInfo(entry.fileName, { isFirst: Boolean(checked) });
  if (!updated) return;
  for (const animation of Object.values(state.animationCatalog)) animation.isFirst = false;
  entry.isFirst = Boolean(updated?.isFirst);
  renderPreservingScrollableUi();
}

function updateSelectedAnimationDescription(value) {
  const entry = getSelectedAnimationEntry();
  if (!entry) return;
  entry.description = value;
  window.vrmFiles.updateAnimationInfo(entry.fileName, { description: value });
}

function updateAnimationExpressionLink(animationName, presetId) {
  const entry = ensureEmotionLinkerEntry(animationName);
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
  if (!animationName || !state.animationCatalog?.[animationName]) return;
  const loop = Boolean(checked);
  state.animationCatalog[animationName].loop = loop;
  const entry = state.correction.animations?.[animationName];
  if (entry) entry.loop = loop;
  window.vrmFiles.updateAnimationInfo(animationName, { loop }).catch(() => {});
  if (state.selectedAnimationName === animationName && animationAction) {
    configureAnimationLoop(loop);
  }
  syncSaveMetaButton();
}

function updateAnimationLookAtCamera(animationName, checked) {
  if (!animationName || !state.animationCatalog?.[animationName]) return;
  const lookAtCamera = Boolean(checked);
  state.animationCatalog[animationName].lookAtCamera = lookAtCamera;
  const entry = state.correction.animations?.[animationName];
  if (entry) entry.lookAtCamera = lookAtCamera;
  window.vrmFiles.updateAnimationInfo(animationName, { lookAtCamera }).catch(() => {});
  applyLookAtCameraOverride();
  syncSaveMetaButton();
}

function getAnimationPreviewDecaySeconds(animationName) {
  return normalizeDecaySeconds(state.decayPreviewSeconds?.[animationName]);
}

function updateAnimationDecaySeconds(animationName, value) {
  if (!animationName) return;
  state.decayPreviewSeconds[animationName] = normalizeDecaySeconds(value);
}

async function addPropGlb() {
  if (!currentVrm) return;
  const result = await window.vrmFiles.storeProp?.();
  if (!result?.name) return;
  state.correction.props = normalizePropSettings(state.correction.props);
  const id = `prop-${Date.now()}-${state.correction.props.length}`;
  const prop = createPropSetting({
    id,
    name: getPropDisplayName({ file: result.name }),
    file: result.name,
    attachBone: state.selectedBone || "rightHand",
  });
  state.correction.props.push(prop);
  state.selectedPropId = id;
  state.correctionRightTab = "props";
  state.correctionDirty = true;
  updateVisiblePropsForSelectedAnimation();
  renderPreservingScrollableUi();
}

function removeSelectedProp() {
  const prop = getSelectedPropSetting();
  if (!prop) return;
  if (!window.confirm("이 GLB prop을 제거할까요?")) return;
  state.correction.props = normalizePropSettings(state.correction.props).filter((item) => item.id !== prop.id);
  for (const animation of Object.values(state.correction.animations ?? {})) {
    if (!Array.isArray(animation.props)) continue;
    animation.props = animation.props.filter((id) => String(id) !== prop.id);
    if (!animation.props.length) delete animation.props;
  }
  state.selectedPropId = state.correction.props[0]?.id ?? null;
  state.correctionDirty = true;
  syncSaveMetaButton();
  clearPropOverlay();
  void loadSelectedPropOverlay();
  renderPreservingScrollableUi();
}

function selectProp(propId) {
  if (!normalizePropSettings(state.correction.props).some((prop) => prop.id === propId)) return;
  state.selectedPropId = propId;
  void loadSelectedPropOverlay();
  renderPreservingScrollableUi();
}

async function reloadPropGlb(propId) {
  const prop = normalizePropSettings(state.correction.props).find((item) => item.id === propId);
  if (!prop) return;
  state.selectedPropId = prop.id;
  clearPropOverlay();
  await loadSelectedPropOverlay();
  renderPreservingScrollableUi();
}

function updatePropName(propId, name) {
  state.correction.props = normalizePropSettings(state.correction.props).map((prop) =>
    prop.id === propId ? createPropSetting({ ...prop, name }) : prop,
  );
  state.correctionDirty = true;
  syncSaveMetaButton();
}

function updateSelectedProp(patch) {
  const prop = getSelectedPropSetting();
  if (!prop) return;
  state.correction.props = normalizePropSettings(state.correction.props).map((item) =>
    item.id === prop.id ? createPropSetting({ ...item, ...patch }) : item,
  );
  state.correctionDirty = true;
  syncSaveMetaButton();
  void loadSelectedPropOverlay();
  renderPreservingScrollableUi();
}

function updateSelectedPropVector(key, axis, value) {
  const prop = getSelectedPropSetting();
  if (!prop || !["positionOffset", "rotationOffset"].includes(key) || !Number.isFinite(axis) || !Number.isFinite(value)) return;
  const next = [...prop[key]];
  next[axis] = value;
  updateSelectedProp({ [key]: next });
}

function updateSelectedPropNumber(key, value) {
  if (key !== "scale" || !Number.isFinite(value)) return;
  updateSelectedProp({ scale: value });
}

function getSelectedPropSetting() {
  const props = normalizePropSettings(state.correction.props);
  if (!props.length) return null;
  return props.find((prop) => prop.id === state.selectedPropId) ?? props[0] ?? null;
}

function getPropDisplayName(prop) {
  return fileNameFromPath(prop?.file ?? "").replace(/\.[^.]+$/, "") || "prop";
}

function getAnimationPropIds(animationName = state.selectedAnimationName) {
  const entry = animationName ? getAnimationMetaEntry(animationName) : null;
  return Array.isArray(entry?.props) ? entry.props.map(String) : [];
}

function isPropEnabledForSelectedAnimation(propId) {
  return getAnimationPropIds().includes(String(propId ?? ""));
}

function togglePropForSelectedAnimation(propId, enabled) {
  const entry = state.selectedAnimationName ? ensureAnimationMetaEntry(state.selectedAnimationName) : null;
  if (!entry || !propId) return;
  const ids = new Set(Array.isArray(entry.props) ? entry.props.map(String) : []);
  if (enabled) ids.add(String(propId));
  else ids.delete(String(propId));
  entry.props = [...ids].filter((id) => normalizePropSettings(state.correction.props).some((prop) => prop.id === id));
  if (!entry.props.length) delete entry.props;
  state.selectedPropId = String(propId);
  state.correctionDirty = true;
  syncSaveMetaButton();
  updateVisiblePropsForSelectedAnimation();
  renderPreservingScrollableUi();
}

function updateVisiblePropsForSelectedAnimation() {
  const prop = getSelectedPropSetting();
  if (prop && isPropEnabledForSelectedAnimation(prop.id)) {
    void loadSelectedPropOverlay();
  } else {
    clearPropOverlay();
  }
}

async function loadSelectedPropOverlay() {
  const prop = getSelectedPropSetting();
  if (!currentVrm || !prop?.file || !isPropEnabledForSelectedAnimation(prop.id)) {
    clearPropOverlay();
    return;
  }
  if (propOverlay?.id === prop.id && propOverlay?.file === prop.file) {
    applyPropOverlaySettings(prop);
    return;
  }
  clearPropOverlay();
  let result;
  try {
    result = await window.vrmFiles.openStoredProp(prop.file);
  } catch {
    setScreenshotMessage(`${prop.file} prop 파일을 props 폴더에서 찾지 못했습니다.`);
    return;
  }
  const url = URL.createObjectURL(new Blob([new Uint8Array(result.data)], { type: "model/gltf-binary" }));
  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await loader.loadAsync(url);
  } catch {
    URL.revokeObjectURL(url);
    setScreenshotMessage(`${prop.file} GLB를 읽지 못했습니다.`);
    return;
  }
  const group = new THREE.Group();
  group.name = `ExpressionEditor_Prop_${prop.id}`;
  group.add(gltf.scene);
  propOverlay = { id: prop.id, file: prop.file, group, scene: gltf.scene, url };
  applyPropOverlaySettings(prop);
}

function applyPropOverlaySettings(setting = getSelectedPropSetting()) {
  if (!propOverlay?.group || !setting) return;
  const prop = createPropSetting(setting);
  const parent = getRawBoneNode(prop.attachBone);
  if (!parent) {
    propOverlay.group.visible = false;
    detachPropTransformControls();
    return;
  }
  if (prop.followRotation && propOverlay.group.parent !== parent) {
    propOverlay.group.parent?.remove(propOverlay.group);
    parent.add(propOverlay.group);
  } else if (!prop.followRotation && propOverlay.group.parent !== scene) {
    propOverlay.group.parent?.remove(propOverlay.group);
    scene.add(propOverlay.group);
  }
  propOverlay.group.visible = true;
  applyPropOverlayTransform(prop, parent);
  attachPropTransformControls();
}

function applyPropOverlayTransform(prop = getSelectedPropSetting(), parent = null) {
  if (!propOverlay?.group || !prop) return;
  const setting = createPropSetting(prop);
  const targetParent = parent ?? getRawBoneNode(setting.attachBone);
  if (!targetParent) return;
  if (setting.followRotation) {
    propOverlay.group.position.set(...setting.positionOffset);
    propOverlay.group.rotation.set(
      THREE.MathUtils.degToRad(setting.rotationOffset[0]),
      THREE.MathUtils.degToRad(setting.rotationOffset[1]),
      THREE.MathUtils.degToRad(setting.rotationOffset[2]),
      "XYZ",
    );
  } else {
    targetParent.updateMatrixWorld(true);
    targetParent.getWorldPosition(propWorldPosition);
    propOverlay.group.position.set(
      propWorldPosition.x + setting.positionOffset[0],
      propWorldPosition.y + setting.positionOffset[1],
      propWorldPosition.z + setting.positionOffset[2],
    );
    propOverlay.group.rotation.set(
      THREE.MathUtils.degToRad(setting.rotationOffset[0]),
      THREE.MathUtils.degToRad(setting.rotationOffset[1]),
      THREE.MathUtils.degToRad(setting.rotationOffset[2]),
      "XYZ",
    );
  }
  propOverlay.group.scale.setScalar(setting.scale);
  propOverlay.group.updateMatrixWorld(true);
}

function updatePropOverlayRuntime() {
  const prop = getSelectedPropSetting();
  if (!propOverlay?.group || !prop || prop.followRotation || propTransformDragging) return;
  applyPropOverlayTransform(prop);
}

function ensurePropTransformControls() {
  if (propTransformControls) return propTransformControls;
  propTransformControls = new TransformControls(camera, renderer.domElement);
  propTransformControls.setMode("translate");
  propTransformControls.setSize(0.75);
  const helper = propTransformControls.getHelper();
  helper.name = "ExpressionEditor_PropTransformControls";
  scene.add(helper);
  propTransformControls.addEventListener("dragging-changed", (event) => {
    propTransformDragging = Boolean(event.value);
    controls.enabled = !event.value;
  });
  propTransformControls.addEventListener("objectChange", () => updatePropTransformFromGizmo());
  return propTransformControls;
}

function attachPropTransformControls() {
  if (state.mode !== "correction" || !propOverlay?.group || !getSelectedPropSetting()) {
    detachPropTransformControls();
    return;
  }
  const transform = ensurePropTransformControls();
  transform.setMode(state.propTransformMode === "rotate" ? "rotate" : "translate");
  transform.setSpace?.(getSelectedPropSetting()?.followRotation ? "local" : "world");
  if (transform.object !== propOverlay.group) transform.attach(propOverlay.group);
}

function detachPropTransformControls() {
  if (!propTransformControls) return;
  propTransformDragging = false;
  propTransformControls.detach();
  controls.enabled = true;
}

function updatePropTransformMode(mode) {
  state.propTransformMode = mode === "rotate" ? "rotate" : "translate";
  attachPropTransformControls();
  renderPreservingScrollableUi();
}

function updatePropTransformFromGizmo() {
  const prop = getSelectedPropSetting();
  if (!prop || !propOverlay?.group) return;
  const position = propOverlay.group.position;
  const rotation = propOverlay.group.rotation;
  const parent = getRawBoneNode(prop.attachBone);
  let positionOffset = [position.x, position.y, position.z];
  if (!prop.followRotation && parent) {
    parent.updateMatrixWorld(true);
    parent.getWorldPosition(propWorldPosition);
    positionOffset = [
      position.x - propWorldPosition.x,
      position.y - propWorldPosition.y,
      position.z - propWorldPosition.z,
    ];
  }
  state.correction.props = normalizePropSettings(state.correction.props).map((item) =>
    item.id === prop.id
      ? createPropSetting({
          ...item,
          positionOffset,
          rotationOffset: [
            THREE.MathUtils.radToDeg(rotation.x),
            THREE.MathUtils.radToDeg(rotation.y),
            THREE.MathUtils.radToDeg(rotation.z),
          ],
        })
      : item,
  );
  state.correctionDirty = true;
  syncSaveMetaButton();
  syncPropPositionControls(positionOffset);
  syncPropRotationControls(rotation);
}

function syncPropPositionControls(position) {
  const values = Array.isArray(position) ? position : [position.x, position.y, position.z];
  for (const [axis, value] of values.entries()) {
    const input = document.querySelector(`[data-prop-vector="positionOffset"][data-axis="${axis}"]`);
    if (input) input.value = roundForInput(value);
  }
}

function syncPropRotationControls(rotation) {
  const values = [
    THREE.MathUtils.radToDeg(rotation.x),
    THREE.MathUtils.radToDeg(rotation.y),
    THREE.MathUtils.radToDeg(rotation.z),
  ];
  for (const [axis, value] of values.entries()) {
    const input = document.querySelector(`[data-prop-vector="rotationOffset"][data-axis="${axis}"]`);
    if (input) input.value = roundForInput(value);
  }
}

function clearPropOverlay() {
  detachPropTransformControls();
  if (!propOverlay) return;
  propOverlay.group?.parent?.remove(propOverlay.group);
  propOverlay.group?.traverse?.((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose?.();
    }
  });
  if (propOverlay.url) URL.revokeObjectURL(propOverlay.url);
  propOverlay = null;
}

function addMotionSlot() {
  state.emotionLinker2.motionSlots = normalizeMotionSlots(state.emotionLinker2.motionSlots);
  const id = `motion-slot-${Date.now()}-${state.emotionLinker2.motionSlots.length}`;
  state.emotionLinker2.motionSlots.push({
    id,
    title: "input title",
    animationFile: "",
    expressionPresetId: "",
    expressionPresetName: "",
    loop: false,
    transitionSeconds: 0.2,
    expressionTimeline: [],
  });
  state.selectedMotionSlotId = id;
  markCorrectionDirtyAndRenderLinker2();
}

function updateMotionSlot(slotId, patch) {
  state.emotionLinker2.motionSlots = normalizeMotionSlots(state.emotionLinker2.motionSlots).map((slot) =>
    slot.id === slotId ? normalizeMotionSlot({ ...slot, ...patch }) : slot,
  );
  state.selectedMotionSlotId = slotId;
  markCorrectionDirtyAndRenderLinker2();
}

function beginMotionSlotTitleEdit(slotId, title) {
  state.selectedMotionSlotId = slotId;
  state.editingMotionSlotTitleId = slotId;
  state.editingMotionSlotTitleValue = title;
}

function updateMotionSlotTitle(slotId, title) {
  state.editingMotionSlotTitleId = slotId;
  state.editingMotionSlotTitleValue = title;
  state.emotionLinker2.motionSlots = normalizeMotionSlots(state.emotionLinker2.motionSlots).map((slot) =>
    slot.id === slotId ? normalizeMotionSlot({ ...slot, title }) : slot,
  );
  state.selectedMotionSlotId = slotId;
  state.correctionDirty = true;
  syncSaveMetaButton();
}

function finishMotionSlotTitleEdit(slotId, title) {
  updateMotionSlotTitle(slotId, title);
  if (state.editingMotionSlotTitleId === slotId) {
    state.editingMotionSlotTitleId = null;
    state.editingMotionSlotTitleValue = "";
  }
  renderPreservingEmotionLinkerScroll();
}

function updateMotionSlotExpression(slotId, presetId) {
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  updateMotionSlot(slotId, {
    expressionPresetId: preset?.id ?? "",
    expressionPresetName: preset?.name ?? "",
  });
}

function nudgeMotionSlotTransition(slotId, direction) {
  const slot = getMotionSlot(slotId);
  if (!slot) return;
  updateMotionSlot(slotId, {
    transitionSeconds: clampTimelineTransitionSeconds(slot.transitionSeconds + Math.sign(direction) * 0.1),
  });
}

function deleteMotionSlot(slotId) {
  if (!window.confirm("이 모션 슬롯을 삭제할까요?")) return;
  state.emotionLinker2.motionSlots = normalizeMotionSlots(state.emotionLinker2.motionSlots).filter((slot) => slot.id !== slotId);
  if (state.selectedMotionSlotId === slotId) state.selectedMotionSlotId = state.emotionLinker2.motionSlots[0]?.id ?? null;
  markCorrectionDirtyAndRenderLinker2();
}

function moveMotionSlot(slotId, direction) {
  const slots = normalizeMotionSlots(state.emotionLinker2.motionSlots);
  const fromIndex = slots.findIndex((slot) => slot.id === slotId);
  const toIndex = fromIndex + Math.sign(direction);
  if (fromIndex < 0 || toIndex < 0 || toIndex >= slots.length) return;
  const [slot] = slots.splice(fromIndex, 1);
  slots.splice(toIndex, 0, slot);
  state.emotionLinker2.motionSlots = slots;
  state.selectedMotionSlotId = slotId;
  markCorrectionDirtyAndRenderLinker2();
}

function getMotionSlot(slotId) {
  return normalizeMotionSlots(state.emotionLinker2.motionSlots).find((slot) => slot.id === slotId) ?? null;
}

function setMotionSlotTimeline(slotId, timeline) {
  state.emotionLinker2.motionSlots = normalizeMotionSlots(state.emotionLinker2.motionSlots).map((slot) =>
    slot.id === slotId ? normalizeMotionSlot({ ...slot, expressionTimeline: normalizeExpressionTimeline(timeline) }) : slot,
  );
  state.selectedMotionSlotId = slotId;
  state.correctionDirty = true;
  syncSaveMetaButton();
}

function addMotionSlotTimelineSlot(slotId) {
  const slot = getMotionSlot(slotId);
  if (!slot?.animationFile) return;
  const timeline = normalizeExpressionTimeline(slot.expressionTimeline);
  const duration = getAnimationDuration(slot.animationFile, 2);
  const time = findNewTimelineTime(timeline, duration);
  const preset = state.expressionPresets.find((item) => item.id === slot.expressionPresetId);
  timeline.push({
    id: `motion-point-${Date.now()}-${timeline.length}`,
    time,
    expressionPresetId: preset?.id ?? "",
    expressionPresetName: preset?.name ?? "",
    expressionValue: 1,
    transitionSeconds: 0.2,
  });
  setMotionSlotTimeline(slotId, timeline);
  renderPreservingEmotionLinkerScroll();
}

function deleteMotionSlotTimelineSlot(slotId, pointId) {
  const slot = getMotionSlot(slotId);
  if (!slot) return;
  setMotionSlotTimeline(
    slotId,
    normalizeExpressionTimeline(slot.expressionTimeline).filter((point) => point.id !== pointId),
  );
  renderPreservingEmotionLinkerScroll();
}

function updateMotionSlotTimelineExpression(slotId, pointId, presetId) {
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  const slot = getMotionSlot(slotId);
  if (!slot) return;
  const timeline = normalizeExpressionTimeline(slot.expressionTimeline).map((point) =>
    point.id === pointId
      ? {
          ...point,
          expressionPresetId: preset?.id ?? "",
          expressionPresetName: preset?.name ?? "",
          expressionRangeId: "",
          expressionRangeName: "",
        }
      : point,
  );
  setMotionSlotTimeline(slotId, timeline);
  renderPreservingEmotionLinkerScroll();
}

function updateMotionSlotTimelineRange(slotId, pointId, rangeId) {
  const slot = getMotionSlot(slotId);
  if (!slot) return;
  const timeline = normalizeExpressionTimeline(slot.expressionTimeline).map((point) => {
    if (point.id !== pointId) return point;
    const preset = findMatchingExpressionPreset(point.expressionPresetId, point.expressionPresetName);
    const range = normalizeExpressionRangeSlots(preset?.rangeSlots).find((item) => item.id === rangeId);
    return {
      ...point,
      expressionRangeId: range?.id ?? "",
      expressionRangeName: range ? `range ${range.threshold}` : "",
      expressionValue: range ? clampEmotionValue(range.threshold) : point.expressionValue,
    };
  });
  setMotionSlotTimeline(slotId, timeline);
  renderPreservingEmotionLinkerScroll();
}

function nudgeMotionSlotTimelineTransition(slotId, pointId, direction) {
  const slot = getMotionSlot(slotId);
  if (!slot) return;
  const timeline = normalizeExpressionTimeline(slot.expressionTimeline).map((point) =>
    point.id === pointId
      ? { ...point, transitionSeconds: clampTimelineTransitionSeconds(point.transitionSeconds + direction * 0.1) }
      : point,
  );
  setMotionSlotTimeline(slotId, timeline);
  renderPreservingEmotionLinkerScroll();
}

function beginMotionSlotTimelineDrag(event, slotId, pointId) {
  event.preventDefault();
  const slot = getMotionSlot(slotId);
  if (!slot?.animationFile) return;
  const duration = getAnimationDuration(slot.animationFile, 2);
  const startX = event.clientX;
  const timeline = normalizeExpressionTimeline(slot.expressionTimeline);
  const point = timeline.find((item) => item.id === pointId);
  if (!point) return;
  const startTime = point.time;
  const onMove = (moveEvent) => {
    const delta = ((moveEvent.clientX - startX) / 180) * duration;
    const time = Math.min(duration, Math.max(0, Math.round((startTime + delta) * 10) / 10));
    const nextTimeline = normalizeExpressionTimeline(getMotionSlot(slotId)?.expressionTimeline).map((item) =>
      item.id === pointId ? { ...item, time } : item,
    );
    setMotionSlotTimeline(slotId, nextTimeline);
    const value = document.querySelector(`[data-motion-slot-timeline-drag="${cssEscape(slotId)}"][data-slot-id="${cssEscape(pointId)}"]`);
    if (value) value.textContent = time.toFixed(1);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    renderPreservingEmotionLinkerScroll();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp, { once: true });
}

function jumpMotionSlotTimeline(slotId, pointId) {
  const slot = getMotionSlot(slotId);
  if (!slot?.animationFile || !animationAction || state.selectedAnimationName !== slot.animationFile) return;
  const point = normalizeExpressionTimeline(slot.expressionTimeline).find((item) => item.id === pointId);
  if (!point) return;
  setAnimationTime(point.time);
}

async function playMotionSlot(slotId) {
  const scroller = document.querySelector(".emotion-linker-panel");
  const scrollTop = scroller?.scrollTop ?? 0;
  const slot = getMotionSlot(slotId);
  if (!slot?.animationFile) return;
  state.selectedMotionSlotId = slot.id;
  state.selectedAnimationName = slot.animationFile;
  const transition = await loadSelectedAnimation({ preserveCurrentAction: true });
  startActiveMotionSlotTimeline(slot);
  applyInitialMotionSlotExpression(slot);
  const transitionSeconds = clampTimelineTransitionSeconds(slot.transitionSeconds);
  playAnimationFromStart(Boolean(slot.loop), {
    previousAction: transition?.previousAction,
    transitionSeconds: transition?.previousAction ? transitionSeconds : 0,
  });
  render();
  const nextScroller = document.querySelector(".emotion-linker-panel");
  if (nextScroller) nextScroller.scrollTop = scrollTop;
}

function startActiveMotionSlotTimeline(slot) {
  const timeline = normalizeExpressionTimeline(slot.expressionTimeline).filter((point) =>
    findMatchingExpressionPreset(point.expressionPresetId, point.expressionPresetName),
  );
  state.activeLinkTimeline = {
    animationName: slot.animationFile,
    motionSlotId: slot.id,
    timeline,
    previousTime: 0,
    appliedIds: new Set(),
  };
}

function applyInitialMotionSlotExpression(slot) {
  const first = normalizeExpressionTimeline(slot.expressionTimeline)[0];
  if (first && first.time <= 0.001) {
    applyTimelineExpressionSlot(first, 0);
    state.activeLinkTimeline?.appliedIds?.add(first.id);
    return;
  }
  if (slot.expressionPresetId) applyLinkedExpressionPreset(slot.expressionPresetId, clampTimelineTransitionSeconds(slot.transitionSeconds));
}

function markCorrectionDirtyAndRenderLinker2() {
  state.correctionDirty = true;
  syncSaveMetaButton();
  renderPreservingEmotionLinkerScroll();
}

function nudgeAnimationDecaySeconds(animationName, direction) {
  updateAnimationDecaySeconds(animationName, getAnimationPreviewDecaySeconds(animationName) + direction);
  renderPreservingEmotionLinkerScroll();
}

function getEmotionLinkTimeline(animationName) {
  return normalizeExpressionTimeline(getEmotionLinkerEntry(animationName).expressionTimeline);
}

function setEmotionLinkTimeline(animationName, timeline) {
  const entry = ensureEmotionLinkerEntry(animationName);
  if (!entry) return;
  const normalized = normalizeExpressionTimeline(timeline);
  if (normalized.length) entry.expressionTimeline = normalized;
  else delete entry.expressionTimeline;
  state.correctionDirty = true;
  syncSaveMetaButton();
}

function addEmotionLinkTimelineSlot(animationName) {
  const entry = ensureEmotionLinkerEntry(animationName);
  if (!entry) return;
  const timeline = getEmotionLinkTimeline(animationName);
  const duration = getAnimationDuration(animationName, 2);
  const presetId = entry.expressionPresetId || state.expressionPresets[0]?.id || "";
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  const time = findNewTimelineTime(timeline, duration);
  timeline.push({
    id: `link-point-${Date.now()}-${timeline.length}`,
    time,
    expressionPresetId: presetId,
    expressionPresetName: preset?.name ?? "",
    expressionRangeId: "",
    expressionValue: 1,
    transitionSeconds: 0.2,
  });
  setEmotionLinkTimeline(animationName, timeline);
  renderPreservingEmotionLinkerScroll();
}

function findNewTimelineTime(timeline, duration) {
  const maxTime = Math.max(0.01, duration);
  const points = [0, ...timeline.map((slot) => slot.time), maxTime].sort((a, b) => a - b);
  let bestStart = 0;
  let bestEnd = maxTime;
  for (let index = 0; index < points.length - 1; index += 1) {
    if (points[index + 1] - points[index] > bestEnd - bestStart) {
      bestStart = points[index];
      bestEnd = points[index + 1];
    }
  }
  return Math.round(((bestStart + bestEnd) / 2) * 10) / 10;
}

function deleteEmotionLinkTimelineSlot(animationName, slotId) {
  setEmotionLinkTimeline(
    animationName,
    getEmotionLinkTimeline(animationName).filter((slot) => slot.id !== slotId),
  );
  renderPreservingEmotionLinkerScroll();
}

function updateEmotionLinkTimelineExpression(animationName, slotId, presetId) {
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  const timeline = getEmotionLinkTimeline(animationName).map((slot) =>
    slot.id === slotId
      ? {
          ...slot,
          expressionPresetId: preset?.id ?? "",
          expressionPresetName: preset?.name ?? "",
          expressionRangeId: "",
          expressionValue: 1,
        }
      : slot,
  );
  setEmotionLinkTimeline(animationName, timeline);
  renderPreservingEmotionLinkerScroll();
}

function updateEmotionLinkTimelineRange(animationName, slotId, rangeId) {
  const timeline = getEmotionLinkTimeline(animationName).map((slot) => {
    if (slot.id !== slotId) return slot;
    const preset = findMatchingExpressionPreset(slot.expressionPresetId, slot.expressionPresetName);
    const rangeSlots = normalizeExpressionRangeSlots(preset?.rangeSlots);
    const rangeSlot = rangeSlots.find((item) => item.id === rangeId);
    return {
      ...slot,
      expressionRangeId: rangeSlot?.id ?? "",
      expressionValue: rangeSlot ? clampEmotionValue(rangeSlot.threshold) : 1,
    };
  });
  setEmotionLinkTimeline(animationName, timeline);
  renderPreservingEmotionLinkerScroll();
}

function nudgeEmotionLinkTimelineTransition(animationName, slotId, direction) {
  const timeline = getEmotionLinkTimeline(animationName).map((slot) =>
    slot.id === slotId
      ? {
          ...slot,
          transitionSeconds: clampTimelineTransitionSeconds(slot.transitionSeconds + direction * 0.1),
        }
      : slot,
  );
  setEmotionLinkTimeline(animationName, timeline);
  renderPreservingEmotionLinkerScroll();
}

function beginEmotionLinkTimelineDrag(event, animationName, slotId) {
  event.preventDefault();
  event.stopPropagation();
  const duration = getAnimationDuration(animationName, 2);
  const timeline = getEmotionLinkTimeline(animationName);
  const slot = timeline.find((item) => item.id === slotId);
  if (!slot) return;
  const startX = event.clientX;
  const startTime = slot.time;
  const onMove = (moveEvent) => {
    const delta = ((moveEvent.clientX - startX) / 260) * duration;
    const nextTime = Math.min(duration, Math.max(0, Math.round((startTime + delta) * 10) / 10));
    setEmotionLinkTimeline(
      animationName,
      getEmotionLinkTimeline(animationName).map((item) => (item.id === slotId ? { ...item, time: nextTime } : item)),
    );
    updateEmotionLinkTimelineTimeUi(animationName, slotId, nextTime, duration);
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    renderPreservingEmotionLinkerScroll();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function updateEmotionLinkTimelineTimeUi(animationName, slotId, time, duration) {
  const value = document.querySelector(`[data-link-timeline-drag="${cssEscape(animationName)}"][data-slot-id="${cssEscape(slotId)}"]`);
  if (value) value.textContent = time.toFixed(1);
  const marker = document.querySelector(`[data-link-timeline-jump="${cssEscape(animationName)}"][data-slot-id="${cssEscape(slotId)}"].emotion-link-marker`);
  if (marker) marker.style.left = `${Math.min(100, Math.max(0, (time / Math.max(duration, 0.001)) * 100))}%`;
}

function previewEmotionLinkTimelineSlot(animationName, slotId) {
  const slot = getEmotionLinkTimeline(animationName).find((item) => item.id === slotId);
  if (!slot) return;
  const preset = state.expressionPresets.find((item) => item.id === slot.expressionPresetId);
  if (!preset) return;
  applyTimelineExpressionSlot(slot, slot.transitionSeconds);
}

function updateLinkerTransitionSeconds(value) {
  state.linkerTransitionSeconds = clampNumber(Number(value), 0, 1, 0.2);
  const label = document.querySelector(".linker-transition-control strong");
  if (label) label.textContent = `${state.linkerTransitionSeconds.toFixed(2)}s`;
}

async function playLinkedAnimation(animationName, options = {}) {
  if (!animationName) return;
  const scroller = document.querySelector(".emotion-linker-panel");
  const scrollTop = scroller?.scrollTop ?? 0;
  const entry = ensureEmotionLinkerEntry(animationName);
  if (!entry) return;
  state.selectedAnimationName = animationName;
  const transition = await loadSelectedAnimation({ preserveCurrentAction: true });
  if (options.decay) {
    state.activeLinkTimeline = null;
    startLinkedExpressionDecay(entry.expressionPresetId, getAnimationPreviewDecaySeconds(animationName));
  } else {
    startActiveLinkTimeline(animationName);
    state.expressionDecay = null;
    applyInitialLinkedExpression(entry);
  }
  playAnimationFromStart(Boolean(entry.loop), {
    previousAction: transition?.previousAction,
    transitionSeconds: transition?.previousAction ? state.linkerTransitionSeconds : 0,
  });
  render();
  const nextScroller = document.querySelector(".emotion-linker-panel");
  if (nextScroller) nextScroller.scrollTop = scrollTop;
}

function startActiveLinkTimeline(animationName) {
  const timeline = getEmotionLinkTimeline(animationName).filter((slot) => findMatchingExpressionPreset(slot.expressionPresetId, slot.expressionPresetName));
  state.activeLinkTimeline = {
    animationName,
    timeline,
    previousTime: 0,
    appliedIds: new Set(),
  };
}

function applyInitialLinkedExpression(entry) {
  const active = state.activeLinkTimeline;
  const first = active?.timeline?.[0];
  if (first && first.time <= 0.001) {
    applyTimelineExpressionSlot(first, 0);
    active.appliedIds.add(first.id);
    return;
  }
  applyLinkedExpressionPreset(entry.expressionPresetId, state.linkerTransitionSeconds);
}

function updateActiveLinkTimeline() {
  const active = state.activeLinkTimeline;
  if (!active || active.animationName !== state.selectedAnimationName || !state.animation.playing) return;
  const currentTime = state.animation.time;
  const looped = currentTime + 0.001 < active.previousTime;
  if (looped) active.appliedIds = new Set();
  for (const slot of active.timeline) {
    const shouldApply = looped ? slot.time <= currentTime || slot.time > active.previousTime : slot.time > active.previousTime && slot.time <= currentTime;
    if (!shouldApply || active.appliedIds.has(slot.id)) continue;
    applyTimelineExpressionSlot(slot, slot.transitionSeconds);
    active.appliedIds.add(slot.id);
  }
  active.previousTime = currentTime;
}

function shouldUseLookAtCameraOverride() {
  if (!currentVrm?.lookAt || !state.selectedAnimationName) return false;
  if (state.mode === "expression") return false;
  return Boolean(state.animationCatalog?.[state.selectedAnimationName]?.lookAtCamera);
}

function applyLookAtCameraOverride() {
  const lookAt = currentVrm?.lookAt;
  if (!lookAt) {
    state.lookAtCameraActive = false;
    return;
  }
  if (shouldUseLookAtCameraOverride()) {
    lookAt.target = camera;
    lookAt.autoUpdate = true;
    state.lookAtCameraActive = true;
    return;
  }
  if (state.lookAtCameraActive && lookAt.target === camera) {
    lookAt.target = null;
    lookAt.reset?.();
  }
  state.lookAtCameraActive = false;
}

function applyTimelineExpressionSlot(slot, fallbackTransitionSeconds = 0.2) {
  const preset = findMatchingExpressionPreset(slot.expressionPresetId, slot.expressionPresetName);
  if (!preset) return;
  const value = getTimelineExpressionValue(slot, preset);
  for (const item of state.expressionPresets) item.value = item.id === preset.id ? value : 0;
  state.selectedExpressionPresetId = preset.id;
  state.selectedExpressionRangeId = getTimelineExpressionRangeSlot(slot, preset)?.id ?? null;
  loadSelectedExpressionParameterDraft();
  startExpressionTransition(
    getExpressionParametersAtValue(preset, value, false, null, true),
    1,
    clampTimelineTransitionSeconds(slot.transitionSeconds ?? fallbackTransitionSeconds),
  );
  updateBlushOverlayForSelected();
  updateEmotionImageOverlayForSelected();
  startEmotionImageGraphAnimationForSelected();
}

function getTimelineExpressionRangeSlot(slot, preset) {
  const rangeSlots = normalizeExpressionRangeSlots(preset?.rangeSlots);
  return rangeSlots.find((item) => item.id === slot?.expressionRangeId) ?? null;
}

function getTimelineExpressionValue(slot, preset) {
  const rangeSlot = getTimelineExpressionRangeSlot(slot, preset);
  if (rangeSlot) return clampEmotionValue(rangeSlot.threshold);
  return clampEmotionValue(slot?.expressionValue ?? 1);
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
  updateBlushOverlayForSelected();
  updateEmotionImageOverlayForSelected();
  startEmotionImageGraphAnimationForSelected();
}

function applyLinkedExpressionPreset(presetId, duration = 0.2) {
  const preset = state.expressionPresets.find((item) => item.id === presetId);
  if (!preset) {
    startExpressionTransition({}, 0, duration);
    return;
  }
  for (const item of state.expressionPresets) {
    item.value = item.id === preset.id ? 1 : 0;
  }
  state.selectedExpressionPresetId = preset.id;
  loadSelectedExpressionParameterDraft();
  transitionToSelectedEmotionPreset(duration);
  startEmotionImageGraphAnimationForSelected();
}

function clearReferenceAnimation() {
  clearMotionCorrectionPreview();
  clearExtraBoneFollowPreview();
  state.activeLinkTimeline = null;
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
  clearExtraBoneFollowPreview();
  const nextTime = Math.min(Math.max(time, 0), state.animation.duration || 0);
  animationAction.paused = true;
  state.animation.playing = false;
  animationAction.time = nextTime;
  animationMixer.setTime(nextTime);
  state.animation.time = nextTime;
  currentVrm?.update?.(0);
  applyMotionCorrectionPreview();
  applyExtraBoneFollowPreview();
  updateAnimationControls();
}

function updateAnimationControls() {
  const toggle = document.querySelector("#toggleAnimation");
  if (toggle) toggle.textContent = state.animation.playing ? "Pause" : "Play";
  const time = document.querySelector(".animation-time");
  if (time) time.textContent = `${formatAnimationTime(state.animation.time)} / ${formatAnimationTime(state.animation.duration)}`;
  const scrub = document.querySelector("[data-animation-time]");
  if (scrub && document.activeElement !== scrub) scrub.value = state.animation.time;
  updateEmotionLinkProgressCursor();
}

function updateEmotionLinkProgressCursor() {
  if (!state.selectedAnimationName || !state.animation.duration) return;
  const cursor = document.querySelector(`[data-link-progress="${cssEscape(state.selectedAnimationName)}"]`);
  const motionSlotCursor = state.selectedMotionSlotId
    ? document.querySelector(`[data-motion-slot-progress="${cssEscape(state.selectedMotionSlotId)}"]`)
    : null;
  if (!cursor && !motionSlotCursor) return;
  const progress = Math.min(100, Math.max(0, (state.animation.time / Math.max(state.animation.duration, 0.001)) * 100));
  if (cursor) cursor.style.left = `${progress}%`;
  if (motionSlotCursor) motionSlotCursor.style.left = `${progress}%`;
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
  clearBlushOverlay();
  clearEmotionImageOverlay();
  clearPropOverlay();
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
  applyMaterialOutlineSettings();
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

function collectRenderableMaterials() {
  if (!currentVrm?.scene) return [];
  const byName = new Map();
  currentVrm.scene.traverse((object) => {
    if (!object?.isMesh || !object.material) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material?.name || byName.has(material.name)) continue;
      byName.set(material.name, material);
    }
  });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function collectVisibleOutlineMaterials(showAll = false) {
  const materials = collectRenderableMaterials();
  if (showAll) return materials;
  return materials.filter((material) => !isMaterialOutlineHidden(material));
}

function isMaterialOutlineHidden(material) {
  const settings = normalizeMaterialSettings(state.correction.materialSettings).outline;
  const name = material?.name ?? "";
  if (!name) return true;
  if (settings.hiddenMaterials.includes(name)) return true;
  if (settings.includedMaterials.includes(name)) return false;
  return !isOutlineEditableMaterial(material);
}

function isOutlineEditableMaterial(material) {
  return Boolean(
    material?.isMToonMaterial ||
      material?.outlineColorFactor ||
      material?.outlineWidthFactor ||
      material?.uniforms?.outlineColorFactor ||
      material?.uniforms?.outlineWidthFactor ||
      material?.userData?.gltfExtensions?.VRMC_materials_mtoon ||
      material?.userData?.gltfExtensions?.VRM?.materialProperties,
  );
}

function getMaterialOutlineColor(material) {
  const saved = normalizeHexColor(state.correction.materialSettings?.outline?.materials?.[material.name]?.color);
  if (saved) return saved;
  return readMaterialOutlineColor(material) ?? "#000000";
}

function getMaterialOutlineWidth(material) {
  const saved = normalizeOutlineWidth(state.correction.materialSettings?.outline?.materials?.[material.name]?.width);
  if (saved != null) return saved;
  return readMaterialOutlineWidth(material) ?? 0;
}

function readMaterialOutlineColor(material) {
  const color = new THREE.Color();
  if (material?.outlineColorFactor?.isColor) return `#${material.outlineColorFactor.getHexString()}`;
  if (material?.uniforms?.outlineColorFactor?.value?.isColor) return `#${material.uniforms.outlineColorFactor.value.getHexString()}`;
  const extension = material?.userData?.gltfExtensions?.VRMC_materials_mtoon ?? material?.userData?.gltfExtensions?.VRM?.materialProperties;
  const factor = extension?.outlineColorFactor ?? extension?.floatProperties?._OutlineColor;
  if (Array.isArray(factor) && factor.length >= 3) {
    color.setRGB(factor[0], factor[1], factor[2]);
    return `#${color.getHexString()}`;
  }
  return null;
}

function readMaterialOutlineWidth(material) {
  const direct = normalizeOutlineWidth(material?.outlineWidthFactor);
  if (direct != null) return direct;
  const uniform = normalizeOutlineWidth(material?.uniforms?.outlineWidthFactor?.value);
  if (uniform != null) return uniform;
  const extension = material?.userData?.gltfExtensions?.VRMC_materials_mtoon ?? material?.userData?.gltfExtensions?.VRM?.materialProperties;
  const extensionWidth = normalizeOutlineWidth(extension?.outlineWidthFactor ?? extension?.floatProperties?._OutlineWidth);
  if (extensionWidth != null) return extensionWidth;
  return null;
}

function updateMaterialOutlineColor(materialName, colorValue) {
  const color = normalizeHexColor(colorValue);
  if (!materialName || !color) return;
  state.correction.materialSettings = normalizeMaterialSettings(state.correction.materialSettings);
  const previous = state.correction.materialSettings.outline.materials[materialName] ?? {};
  state.correction.materialSettings.outline.materials[materialName] = { ...previous, color };
  applyMaterialOutlineSettings();
  state.correctionDirty = true;
  syncSaveMetaButton();
  syncMaterialOutlineControls(materialName, color);
}

function updateMaterialOutlineWidth(materialName, widthValue, source = null) {
  const width = normalizeOutlineWidth(widthValue);
  if (!materialName || width == null) return;
  state.correction.materialSettings = normalizeMaterialSettings(state.correction.materialSettings);
  const previous = state.correction.materialSettings.outline.materials[materialName] ?? {};
  state.correction.materialSettings.outline.materials[materialName] = { ...previous, width };
  applyMaterialOutlineSettings();
  state.correctionDirty = true;
  syncSaveMetaButton();
  syncMaterialOutlineWidthControls(materialName, width, source);
}

function updateOutlineMaterialShowAll(showAll) {
  state.correction.materialSettings = normalizeMaterialSettings(state.correction.materialSettings);
  state.correction.materialSettings.outline.showAll = Boolean(showAll);
  renderPreservingScrollableUi();
}

function toggleOutlineMaterialVisibility(materialName) {
  if (!materialName) return;
  state.correction.materialSettings = normalizeMaterialSettings(state.correction.materialSettings);
  const settings = state.correction.materialSettings.outline;
  const material = collectRenderableMaterials().find((item) => item.name === materialName);
  const hidden = material ? isMaterialOutlineHidden(material) : settings.hiddenMaterials.includes(materialName);
  const hiddenSet = new Set(settings.hiddenMaterials);
  const includedSet = new Set(settings.includedMaterials);
  if (hidden) {
    hiddenSet.delete(materialName);
    includedSet.add(materialName);
  } else {
    hiddenSet.add(materialName);
    includedSet.delete(materialName);
  }
  settings.hiddenMaterials = [...hiddenSet].sort((a, b) => a.localeCompare(b));
  settings.includedMaterials = [...includedSet].sort((a, b) => a.localeCompare(b));
  state.correctionDirty = true;
  syncSaveMetaButton();
  renderPreservingScrollableUi();
}

function applyMaterialOutlineSettings() {
  const settings = normalizeMaterialSettings(state.correction.materialSettings).outline.materials;
  if (!currentVrm?.scene || !Object.keys(settings).length) return;
  for (const material of collectRenderableMaterials()) {
    const materialSettings = settings[material.name];
    if (!materialSettings) continue;
    if (materialSettings.color) applyOutlineColorToMaterial(material, materialSettings.color);
    if (materialSettings.width != null) applyOutlineWidthToMaterial(material, materialSettings.width);
  }
}

function applyOutlineColorToMaterial(material, colorValue) {
  const color = new THREE.Color(colorValue);
  if (material.outlineColorFactor?.isColor) material.outlineColorFactor.copy(color);
  if (material.uniforms?.outlineColorFactor?.value?.isColor) material.uniforms.outlineColorFactor.value.copy(color);
  const extension = material.userData?.gltfExtensions?.VRMC_materials_mtoon;
  if (extension) extension.outlineColorFactor = [color.r, color.g, color.b];
  material.needsUpdate = true;
}

function applyOutlineWidthToMaterial(material, widthValue) {
  const width = normalizeOutlineWidth(widthValue);
  if (width == null) return;
  if ("outlineWidthFactor" in material) material.outlineWidthFactor = width;
  if (material.uniforms?.outlineWidthFactor) material.uniforms.outlineWidthFactor.value = width;
  const extension = material.userData?.gltfExtensions?.VRMC_materials_mtoon;
  if (extension) extension.outlineWidthFactor = width;
  const vrm0 = material.userData?.gltfExtensions?.VRM?.materialProperties;
  if (vrm0?.floatProperties) vrm0.floatProperties._OutlineWidth = width;
  material.needsUpdate = true;
}

function syncMaterialOutlineControls(materialName, color) {
  for (const input of document.querySelectorAll(`[data-outline-color="${cssEscape(materialName)}"], [data-outline-hex="${cssEscape(materialName)}"]`)) {
    input.value = color;
  }
  for (const swatch of document.querySelectorAll(`[data-outline-pick="${cssEscape(materialName)}"]`)) {
    swatch.style.background = color;
  }
}

function syncMaterialOutlineWidthControls(materialName, width, source = null) {
  const formatted = roundForInput(width);
  for (const input of document.querySelectorAll(`[data-outline-width="${cssEscape(materialName)}"], [data-outline-width-number="${cssEscape(materialName)}"]`)) {
    if (input === source) continue;
    input.value = formatted;
  }
}

function normalizeOutlineWidth(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(2, Math.max(0, Math.round(number * 1000) / 1000));
}

function normalizeHexColor(value) {
  const text = String(value ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(text)) return `#${text.toLowerCase()}`;
  if (/^#[0-9a-fA-F]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase();
  }
  return null;
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
  state.activeRorrInfluenceValues = { ...(values ?? {}) };
  applyRorrInfluenceValuesRaw(state.activeRorrInfluenceValues);
}

function applyRorrInfluenceValuesRaw(values) {
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

function reapplyActiveRorrInfluences() {
  if (!currentVrm || !Object.keys(state.activeRorrInfluenceValues ?? {}).length) return;
  applyRorrInfluenceValuesRaw(state.activeRorrInfluenceValues);
}

function startLipSyncPreview() {
  if (state.mode !== "transitionViewer" || !currentVrm) return;
  const text = String(state.lipSyncPreview.text ?? "").trim();
  const timeline = buildLipSyncTimeline(text);
  state.lipSyncPreview.timeline = timeline;
  state.lipSyncPreview.elapsed = 0;
  state.lipSyncPreview.duration = timeline.at(-1)?.end ?? 0;
  state.lipSyncPreview.playing = timeline.length > 0;
  state.lipSyncPreview.activeShape = "";
  state.lipSyncPreview.restoreValues = readMouthInfluenceValues();
  if (!state.lipSyncPreview.playing) {
    applyMouthInfluenceValues(state.lipSyncPreview.restoreValues ?? {});
  }
  renderPreservingScrollableUi();
}

function buildLipSyncTimeline(text) {
  const timeline = [];
  let cursor = 0;
  for (const char of String(text ?? "")) {
    if (/\s/.test(char)) {
      cursor += 0.16;
      continue;
    }
    const shape = getVisemeForCharacter(char);
    const duration = shape === "closed" ? 0.08 : 0.16;
    timeline.push({ start: cursor, end: cursor + duration, shape });
    cursor += duration;
    if (shape !== "closed") {
      timeline.push({ start: cursor, end: cursor + 0.04, shape: "closed" });
      cursor += 0.04;
    }
  }
  return timeline;
}

function getVisemeForCharacter(char) {
  const code = char.codePointAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const offset = code - 0xac00;
    const vowelIndex = Math.floor((offset % 588) / 28);
    const finalIndex = offset % 28;
    const vowelToViseme = {
      0: "A",
      1: "A",
      2: "A",
      3: "A",
      4: "E",
      5: "E",
      6: "E",
      7: "E",
      8: "O",
      9: "O",
      10: "O",
      11: "O",
      12: "O",
      13: "U",
      14: "U",
      15: "U",
      16: "U",
      17: "U",
      18: "U",
      19: "I",
      20: "I",
    };
    return finalIndex ? vowelToViseme[vowelIndex] ?? "closed" : vowelToViseme[vowelIndex] ?? "A";
  }
  const lower = String(char).toLowerCase();
  if ("a".includes(lower)) return "A";
  if ("i".includes(lower)) return "I";
  if ("u".includes(lower)) return "U";
  if ("e".includes(lower)) return "E";
  if ("o".includes(lower)) return "O";
  if (/[.,!?;:]/.test(lower)) return "closed";
  return "A";
}

function updateLipSyncPreview(delta) {
  if (state.mode !== "transitionViewer") {
    if (state.lipSyncPreview.playing) stopLipSyncPreview();
    return;
  }
  if (!currentVrm || !state.lipSyncPreview.playing) return;
  state.lipSyncPreview.elapsed += delta;
  const elapsed = state.lipSyncPreview.elapsed;
  const active = state.lipSyncPreview.timeline.find((slot) => elapsed >= slot.start && elapsed < slot.end);
  if (!active) {
    if (elapsed >= state.lipSyncPreview.duration) {
      stopLipSyncPreview();
      return;
    }
    applyLipSyncMouthShape("closed", 1);
    return;
  }
  const span = Math.max(0.001, active.end - active.start);
  const local = (elapsed - active.start) / span;
  const envelope = Math.sin(Math.PI * clamp01(local));
  applyLipSyncMouthShape(active.shape, envelope);
}

function stopLipSyncPreview() {
  state.lipSyncPreview.playing = false;
  state.lipSyncPreview.elapsed = 0;
  state.lipSyncPreview.activeShape = "";
  applyMouthInfluenceValues(state.lipSyncPreview.restoreValues ?? {});
}

function applyLipSyncMouthShape(shape, value) {
  const targets = collectMouthShapeKeyNames();
  const next = {};
  for (const name of targets.all) next[name] = 0;
  const targetName = targets.byShape[shape];
  if (targetName) next[targetName] = clampEmotionValue(value);
  applyMouthInfluenceValues(next);
}

function collectMouthShapeKeyNames() {
  const all = new Set();
  const byShape = {};
  const shapePatterns = {
    A: /(?:^|[_-])(?:MTH|LIP_SYNC)[_-]?A$/i,
    I: /(?:^|[_-])(?:MTH|LIP_SYNC)[_-]?I$/i,
    U: /(?:^|[_-])(?:MTH|LIP_SYNC)[_-]?U$/i,
    E: /(?:^|[_-])(?:MTH|LIP_SYNC)[_-]?E$/i,
    O: /(?:^|[_-])(?:MTH|LIP_SYNC)[_-]?O$/i,
  };
  currentVrm?.scene?.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary) return;
    for (const name of Object.keys(object.morphTargetDictionary)) {
      if (!/(?:MTH|LIP_SYNC)/i.test(name)) continue;
      all.add(name);
      for (const [shape, pattern] of Object.entries(shapePatterns)) {
        if (!byShape[shape] && pattern.test(name)) byShape[shape] = name;
      }
    }
  });
  return { all: [...all], byShape };
}

function readMouthInfluenceValues() {
  const next = {};
  const names = collectMouthShapeKeyNames().all;
  currentVrm?.scene?.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary || !Array.isArray(object.morphTargetInfluences)) return;
    for (const name of names) {
      const index = object.morphTargetDictionary[name];
      if (index == null || next[name] != null) continue;
      next[name] = clampEmotionValue(object.morphTargetInfluences[index] ?? 0);
    }
  });
  return next;
}

function applyMouthInfluenceValues(values) {
  if (!currentVrm) return;
  const names = Object.keys(values ?? {});
  currentVrm.scene.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary || !Array.isArray(object.morphTargetInfluences)) return;
    for (const name of names) {
      const index = object.morphTargetDictionary[name];
      if (index == null) continue;
      object.morphTargetInfluences[index] = clampEmotionValue(values[name] ?? 0);
    }
  });
}

function updateRandomBlink(delta) {
  if (!currentVrm || shouldDisableRandomBlink()) {
    state.blink.elapsed = 0;
    state.blink.closing = false;
    return;
  }
  const blinkTargets = collectBlinkShapeKeyNames();
  if (!blinkTargets.length) return;
  state.blink.elapsed += delta;
  if (!state.blink.closing && state.blink.elapsed >= state.blink.nextDelay) {
    state.blink.elapsed = 0;
    state.blink.closing = true;
    state.blink.duration = 0.12 + Math.random() * 0.08;
  }
  if (!state.blink.closing) return;
  const t = Math.min(1, state.blink.elapsed / Math.max(state.blink.duration, 0.001));
  const blinkValue = Math.sin(t * Math.PI);
  applyBlinkInfluence(blinkTargets, blinkValue);
  if (t >= 1) {
    state.blink.elapsed = 0;
    state.blink.closing = false;
    state.blink.nextDelay = 0.5 + Math.random() * 4.5;
  }
}

function shouldDisableRandomBlink() {
  if (state.mode === "expression") return true;
  const selected = getSelectedEmotionPreset();
  return Boolean(selected?.isDisableBlink && (selected.value ?? 0) > 0.001);
}

function collectBlinkShapeKeyNames() {
  const names = state.rorrParameters.map((parameter) => parameter.id);
  const preferred = [
    "Fcl_Eye_Close",
    "Fcl_EYE_Close",
    "EYE_Close_All",
    "EYE_Close",
    "Blink",
    "blink",
  ];
  const exact = preferred.filter((name) => names.includes(name));
  if (exact.length) return exact;
  return names.filter((name) => /eye/i.test(name) && /close|blink/i.test(name));
}

function applyBlinkInfluence(names, value) {
  const clamped = clampEmotionValue(value);
  currentVrm.scene.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary || !Array.isArray(object.morphTargetInfluences)) return;
    for (const name of names) {
      const index = object.morphTargetDictionary[name];
      if (index == null) continue;
      object.morphTargetInfluences[index] = Math.max(object.morphTargetInfluences[index] ?? 0, clamped);
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
  updateBlushOverlayForSelected();
  if (t >= 1) {
    preset.value = 0;
    applyRorrParameterValues(getExpressionParametersAtValue(preset, 0, false, null, true), 1);
    updateBlushOverlayForSelected();
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
    motionSlots: [],
    props: [],
    extraBoneFollowSettings: [],
    materialSettings: {
      outline: {
        materials: {},
        showAll: false,
        hiddenMaterials: [],
        includedMaterials: [],
      },
    },
    blush: null,
    emotionImage: null,
    emotionMap: {
      schemaVersion: 1,
      type: "vrm-emotion-map",
      range: {
        x: [-1, 1],
        y: [EMOTION_MAP_Y_MIN, EMOTION_MAP_Y_MAX],
      },
      points: [],
    },
    expressionPresets: createDefaultEmotionPresets().map(({ id, name, locked, isDisableBlink, rangeSlots, emotionImage }) => ({
      id,
      name,
      locked,
      isDisableBlink,
      rangeSlots,
      emotionImage,
    })),
  };
}

function createEmptyEmotionLinkerMeta() {
  return {
    schemaVersion: 1,
    type: "vrm-emotion-linker-meta",
    animations: {},
  };
}

function createEmptyEmotionLinker2Meta() {
  return {
    schemaVersion: 1,
    type: "vrm-emotion-linker2-meta",
    motionSlots: [],
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

function getDefaultAnimationName() {
  return getAnimationNames().find((name) => state.animationCatalog?.[name]?.isFirst) ?? null;
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
    const entry = getEmotionLinkerEntry(name);
    return Boolean(entry.expressionPresetId || state.animationCatalog?.[name]?.description);
  });
  const filtered = names.filter((name) => isAnimationRecommendedForTransitionKind(kind, name));
  return filtered.length ? filtered : names;
}

function formatTransitionLinkerOptionLabel(animationName) {
  if (!animationName) return "";
  const catalogEntry = state.animationCatalog?.[animationName] ?? {};
  const metaEntry = getEmotionLinkerEntry(animationName);
  const preset = state.expressionPresets.find((item) => item.id === metaEntry.expressionPresetId);
  const title = String(catalogEntry.description ?? "").trim() || getAnimationDisplayName(animationName);
  return preset ? `${title} / ${preset.name}` : title;
}

function isAnimationLoop(animationName) {
  return Boolean(state.animationCatalog?.[animationName]?.loop);
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
  const next = normalizeAnimationCorrectionEntry(entry ?? {});
  next.loop = Boolean(state.animationCatalog?.[animationName]?.loop);
  next.lookAtCamera = Boolean(state.animationCatalog?.[animationName]?.lookAtCamera);
  return next;
}

function getEmotionLinkerEntry(animationName) {
  if (!animationName) return {};
  const entry = state.emotionLinker.animations?.[animationName];
  const next = normalizeAnimationLinkEntry(entry ?? {});
  next.loop = Boolean(state.animationCatalog?.[animationName]?.loop);
  return next;
}

function collectExtraBoneOptions() {
  if (!currentVrm?.scene) return [];
  const humanoidObjects = new Set(HUMAN_BONES.map((boneName) => getRawBoneNode(boneName)).filter(Boolean));
  const names = new Set();
  currentVrm.scene.traverse((object) => {
    if (!object?.isBone || !object.name || humanoidObjects.has(object)) return;
    names.add(object.name);
  });
  return [...names].sort((a, b) => a.localeCompare(b));
}

function collectAvailableHumanoidBoneOptions() {
  return HUMAN_BONES.filter((boneName) => getRawBoneNode(boneName));
}

function addExtraBoneFollowSetting() {
  const settings = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings);
  const targetBone = collectExtraBoneOptions().find((boneName) => !settings.some((setting) => setting.targetBone === boneName)) ?? "";
  const sourceBone = collectAvailableHumanoidBoneOptions()[0] ?? "";
  const tailDirectionBone = getDefaultTailDirectionBone(sourceBone);
  const id = `extra-bone-${Date.now()}-${settings.length}`;
  settings.push(createExtraBoneFollowSetting({ id, targetBone, sourceBone, tailDirectionBone }));
  state.correction.extraBoneFollowSettings = settings;
  state.selectedExtraBoneFollowId = id;
  state.correctionDirty = true;
  applyExtraBoneFollowPreview();
  syncSaveMetaButton();
  renderPreservingScrollableUi();
}

function updateExtraBoneFollowSetting(id, patch) {
  state.correction.extraBoneFollowSettings = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings).map((setting) =>
    setting.id === id ? createExtraBoneFollowSetting({ ...setting, ...patch }) : setting,
  );
  state.selectedExtraBoneFollowId = id;
  state.correctionDirty = true;
  applyExtraBoneFollowPreview();
  syncSaveMetaButton();
  renderPreservingScrollableUi();
}

function updateExtraBoneFollowAxis(id, axis, patch) {
  if (!["x", "y", "z"].includes(axis)) return;
  state.correction.extraBoneFollowSettings = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings).map((setting) => {
    if (setting.id !== id) return setting;
    return createExtraBoneFollowSetting({
      ...setting,
      axes: {
        ...setting.axes,
        [axis]: {
          ...normalizeExtraBoneAxisSetting(setting.axes?.[axis]),
          ...patch,
        },
      },
    });
  });
  state.selectedExtraBoneFollowId = id;
  state.correctionDirty = true;
  applyExtraBoneFollowPreview();
  syncSaveMetaButton();
}

function updateExtraBoneFollowFactor(id, factorKey, value) {
  if (!["swing", "twist"].includes(factorKey) || !Number.isFinite(value)) return;
  const patch = factorKey === "swing" ? { swingFactor: value } : { twistFactor: value };
  state.correction.extraBoneFollowSettings = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings).map((setting) =>
    setting.id === id ? createExtraBoneFollowSetting({ ...setting, ...patch }) : setting,
  );
  state.selectedExtraBoneFollowId = id;
  state.correctionDirty = true;
  applyExtraBoneFollowPreview();
  syncSaveMetaButton();
}

function deleteExtraBoneFollowSetting(id) {
  clearExtraBoneFollowPreview();
  state.correction.extraBoneFollowSettings = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings).filter((setting) => setting.id !== id);
  if (state.selectedExtraBoneFollowId === id) state.selectedExtraBoneFollowId = null;
  state.correctionDirty = true;
  applyExtraBoneFollowPreview();
  syncSaveMetaButton();
  renderPreservingScrollableUi();
}

function createExtraBoneFollowSetting(setting = {}) {
  const legacy = normalizeLegacyExtraBoneFactors(setting);
  return {
    id: String(setting.id ?? `extra-bone-${Date.now()}`),
    targetBone: String(setting.targetBone ?? ""),
    sourceBone: String(setting.sourceBone ?? ""),
    tailDirectionBone: String(setting.tailDirectionBone ?? ""),
    swingFactor: normalizeExtraBoneFactor(setting.swingFactor, legacy.swingFactor),
    twistFactor: normalizeExtraBoneFactor(setting.twistFactor, legacy.twistFactor),
  };
}

function getDefaultTailDirectionBone(sourceBoneName) {
  const source = getRawBoneNode(sourceBoneName);
  if (!source) return "";
  for (const boneName of HUMAN_BONES) {
    const bone = getRawBoneNode(boneName);
    if (!bone || bone === source) continue;
    if (findNearestMappedBoneAncestor(bone, new Map([[source, sourceBoneName]])) === source) return boneName;
  }
  return "";
}

function normalizeExtraBoneRotationOrder(order) {
  const value = String(order ?? "YXZ").toUpperCase();
  return ["YXZ", "YZX", "XYZ", "XZY", "ZXY", "ZYX"].includes(value) ? value : "YXZ";
}

function normalizeExtraBoneFactor(value, fallback = 1) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeLegacyExtraBoneFactors(setting) {
  const axes = setting?.axes;
  if (!axes || typeof axes !== "object") return { swingFactor: 1, twistFactor: 0 };
  const x = normalizeExtraBoneAxisSetting(axes.x);
  const y = normalizeExtraBoneAxisSetting(axes.y);
  const z = normalizeExtraBoneAxisSetting(axes.z);
  const swingValues = [x, z].filter((axis) => !axis.ignore).map((axis) => axis.factor);
  return {
    swingFactor: swingValues.length ? swingValues.reduce((sum, value) => sum + value, 0) / swingValues.length : 1,
    twistFactor: y.ignore ? 0 : y.factor,
  };
}

function ensureAnimationMetaEntry(animationName) {
  if (!animationName) return null;
  state.correction.animations[animationName] = normalizeAnimationCorrectionEntry(state.correction.animations[animationName] ?? {});
  if (state.animationCatalog?.[animationName]) {
    state.correction.animations[animationName].loop = Boolean(state.animationCatalog[animationName].loop);
  }
  return state.correction.animations[animationName];
}

function ensureEmotionLinkerEntry(animationName) {
  if (!animationName) return null;
  state.emotionLinker.animations[animationName] = normalizeAnimationLinkEntry(state.emotionLinker.animations[animationName] ?? {});
  return state.emotionLinker.animations[animationName];
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
    positionOffset: [0, 0, 0],
    rotationOffset: normalizeVector(correction.rotationOffset, [0, 0, 0]),
    scaleMultiplier: [1, 1, 1],
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

function getActiveMirrorBoneName(boneName) {
  if (state.separateMirrorBoneCorrection) return null;
  return getMirrorBoneName(boneName);
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
  const mirrorBone = getActiveMirrorBoneName(state.selectedBone);
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
  const mirrorBone = getActiveMirrorBoneName(state.selectedBone);
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
  const mirrorBone = getActiveMirrorBoneName(state.selectedBone);
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
  const payload = JSON.stringify(serializeCorrection(), null, 2);
  const result = await window.vrmFiles.saveMeta(state.correctionPath, payload);
  if (!result) return;
  await saveEmotionLinkerMetas();
  await saveEditorConfig();
  state.correctionPath = result.filePath;
  state.correctionDirty = false;
  state.expressionDirty = false;
  syncSaveMetaButton();
  renderPreservingScrollableUi();
}

async function saveEmotionLinkerMetas() {
  await window.vrmFiles.saveEmotionLinkerMeta?.("linker", JSON.stringify(serializeEmotionLinkerMeta(), null, 2));
  await window.vrmFiles.saveEmotionLinkerMeta?.("linker2", JSON.stringify(serializeEmotionLinker2Meta(), null, 2));
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
  const migratedLinkerMeta = await loadEmotionLinkerMetas(rawMeta);
  loadSelectedExpressionParameterDraft();
  state.correctionPath = result.filePath;
  state.correctionDirty = Boolean(migratedLinkerMeta);
  state.expressionDirty = false;
  const names = getAnimationNames();
  state.selectedAnimationName = getDefaultAnimationName() ?? (names.includes(state.selectedAnimationName) ? state.selectedAnimationName : (names[0] ?? null));
  applyMaterialOutlineSettings();
}

async function loadEmotionLinkerMetas(characterMeta = {}) {
  let migrated = false;
  const fallbackLinker = createEmptyEmotionLinkerMeta();
  fallbackLinker.animations = {};
  for (const [animationName, animation] of Object.entries(characterMeta.animations ?? {})) {
    const fileName = fileNameFromPath(animationName);
    if (!fileName) continue;
    const entry = normalizeAnimationLinkEntry(animation, state.expressionPresets);
    if (entry.expressionPresetId || entry.expressionPresetName || entry.expressionTimeline?.length) {
      fallbackLinker.animations[fileName] = entry;
      migrated = true;
    }
  }

  const fallbackLinker2 = createEmptyEmotionLinker2Meta();
  fallbackLinker2.motionSlots = normalizeMotionSlots(characterMeta.motionSlots, state.expressionPresets);
  if (fallbackLinker2.motionSlots.length) migrated = true;

  state.emotionLinker = fallbackLinker;
  state.emotionLinker2 = fallbackLinker2;
  state.emotionLinkerPath = null;
  state.emotionLinker2Path = null;

  const linkerResult = await window.vrmFiles.loadOrCreateEmotionLinkerMeta?.("linker", JSON.stringify(fallbackLinker, null, 2));
  if (linkerResult?.data) {
    state.emotionLinkerPath = linkerResult.filePath;
    state.emotionLinker = normalizeEmotionLinkerMeta(parseJsonBuffer(linkerResult.data, fallbackLinker), state.expressionPresets);
    if (!Object.keys(state.emotionLinker.animations).length && Object.keys(fallbackLinker.animations).length) {
      state.emotionLinker = normalizeEmotionLinkerMeta(fallbackLinker, state.expressionPresets);
      await window.vrmFiles.saveEmotionLinkerMeta?.("linker", JSON.stringify(state.emotionLinker, null, 2));
    }
  }

  const linker2Result = await window.vrmFiles.loadOrCreateEmotionLinkerMeta?.("linker2", JSON.stringify(fallbackLinker2, null, 2));
  if (linker2Result?.data) {
    state.emotionLinker2Path = linker2Result.filePath;
    state.emotionLinker2 = normalizeEmotionLinker2Meta(parseJsonBuffer(linker2Result.data, fallbackLinker2), state.expressionPresets);
    if (!state.emotionLinker2.motionSlots.length && fallbackLinker2.motionSlots.length) {
      state.emotionLinker2 = normalizeEmotionLinker2Meta(fallbackLinker2, state.expressionPresets);
      await window.vrmFiles.saveEmotionLinkerMeta?.("linker2", JSON.stringify(state.emotionLinker2, null, 2));
    }
  }
  return migrated;
}

function parseJsonBuffer(data, fallback) {
  try {
    return JSON.parse(dec.decode(new Uint8Array(data)));
  } catch {
    return fallback;
  }
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
      isFirst: Boolean(animation.isFirst),
      loop: Boolean(animation.loop),
      lookAtCamera: Boolean(animation.lookAtCamera),
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
    if (!catalogEntry.loop && animation.loop) patch.loop = true;
    if (!catalogEntry.lookAtCamera && animation.lookAtCamera) patch.lookAtCamera = true;
    if (!Object.keys(patch).length) continue;
    const updated = await window.vrmFiles.updateAnimationInfo(fileName, patch);
    state.animationCatalog[fileName] = {
      fileName,
      description: String(updated.description ?? ""),
      mustWatchFull: Boolean(updated.mustWatchFull),
      duration: normalizeFiniteNumber(updated.duration, catalogEntry.duration ?? 0),
      isFirst: Boolean(updated.isFirst),
      loop: Boolean(updated.loop),
      lookAtCamera: Boolean(updated.lookAtCamera),
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
  const legacyBlush = Array.isArray(json.expressionPresets)
    ? json.expressionPresets.find((preset) => preset?.blush?.image)?.blush
    : null;
  next.blush = normalizeBlushSettings(json.blush ?? legacyBlush);
  next.emotionImage = normalizeEmotionImageSettings(json.emotionImage);
  next.extraBoneFollowSettings = normalizeExtraBoneFollowSettings(json.extraBoneFollowSettings);
  next.materialSettings = normalizeMaterialSettings(json.materialSettings);
  next.expressionPresets = normalizeExpressionPresets(json.expressionPresets);
  if (next.emotionImage?.image) {
    next.expressionPresets = next.expressionPresets.map((preset) => ({
      ...preset,
      emotionImage: preset.emotionImage ? normalizePresetEmotionImage(preset.emotionImage, next.emotionImage) : null,
    }));
  }
  delete next.motionSlots;
  next.props = normalizePropSettings(json.props);
  next.emotionMap = serializeEmotionMapFromNormalized(normalizeEmotionMapConfig(json.emotionMap, next.expressionPresets), json.emotionMap);
  return next;
}

function normalizeEmotionLinkerMeta(json, presets = state.expressionPresets) {
  const next = createEmptyEmotionLinkerMeta();
  next.schemaVersion = Number(json?.schemaVersion) || 1;
  const animations = json?.animations && typeof json.animations === "object" ? json.animations : {};
  for (const [animationName, animation] of Object.entries(animations)) {
    const fileName = fileNameFromPath(animationName);
    if (!fileName) continue;
    const entry = normalizeAnimationLinkEntry(animation, presets);
    if (entry.expressionPresetId || entry.expressionPresetName || entry.expressionTimeline?.length) {
      next.animations[fileName] = entry;
    }
  }
  return next;
}

function normalizeEmotionLinker2Meta(json, presets = state.expressionPresets) {
  const next = createEmptyEmotionLinker2Meta();
  next.schemaVersion = Number(json?.schemaVersion) || 1;
  next.motionSlots = normalizeMotionSlots(json?.motionSlots, presets);
  return next;
}

function normalizeAnimationLinkEntry(animation, presets = state.expressionPresets) {
  const preset =
    presets?.find?.((item) => item.id === animation?.expressionPresetId) ??
    presets?.find?.((item) => item.name === animation?.expressionPresetName);
  const next = {
    expressionPresetId: preset?.id ?? String(animation?.expressionPresetId ?? ""),
    expressionPresetName: preset?.name ?? String(animation?.expressionPresetName ?? ""),
    expressionTimeline: normalizeExpressionTimeline(animation?.expressionTimeline),
  };
  if (!next.expressionPresetId) delete next.expressionPresetId;
  if (!next.expressionPresetName) delete next.expressionPresetName;
  if (!next.expressionTimeline.length) delete next.expressionTimeline;
  return next;
}

function normalizeMaterialSettings(settings) {
  const next = {
    outline: {
      materials: {},
      showAll: Boolean(settings?.outline?.showAll),
      hiddenMaterials: normalizeStringList(settings?.outline?.hiddenMaterials),
      includedMaterials: normalizeStringList(settings?.outline?.includedMaterials),
    },
  };
  const materials = settings?.outline?.materials;
  if (!materials || typeof materials !== "object") return next;
  for (const [name, value] of Object.entries(materials)) {
    const color = normalizeHexColor(typeof value === "string" ? value : value?.color);
    const width = typeof value === "object" ? normalizeOutlineWidth(value?.width) : null;
    if (!name || (!color && width == null)) continue;
    next.outline.materials[String(name)] = {
      ...(color ? { color } : {}),
      ...(width != null ? { width } : {}),
    };
  }
  return next;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function normalizeExtraBoneFollowSettings(settings) {
  if (!Array.isArray(settings)) return [];
  return settings
    .slice(0, 32)
    .map((setting, index) =>
      createExtraBoneFollowSetting({
        ...setting,
        id: String(setting?.id ?? `extra-bone-${index}`),
      }),
    )
    .filter((setting) => setting.id);
}

function normalizeExtraBoneAxisSetting(setting) {
  return {
    factor: Number.isFinite(Number(setting?.factor)) ? Number(setting.factor) : 1,
    ignore: Boolean(setting?.ignore),
  };
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
    blush: normalizePresetBlush(preset.blush),
    emotionImage: preset.emotionImage ? normalizePresetEmotionImage(preset.emotionImage) : null,
    rangeSlots: normalizeExpressionRangeSlots(preset.rangeSlots),
  }));
}

function normalizeMotionSlots(slots, presets = state.expressionPresets) {
  if (!Array.isArray(slots)) return [];
  return slots
    .slice(0, 128)
    .map((slot, index) => normalizeMotionSlot(slot, index, presets))
    .filter((slot) => slot.id);
}

function normalizeMotionSlot(slot, index = 0, presets = state.expressionPresets) {
  const animationFile = fileNameFromPath(slot?.animationFile ?? "");
  const preset =
    presets?.find?.((item) => item.id === slot?.expressionPresetId) ??
    presets?.find?.((item) => item.name === slot?.expressionPresetName);
  return {
    id: String(slot?.id ?? `motion-slot-${index}`),
    title: String(slot?.title ?? "input title"),
    animationFile,
    expressionPresetId: preset?.id ?? String(slot?.expressionPresetId ?? ""),
    expressionPresetName: preset?.name ?? String(slot?.expressionPresetName ?? ""),
    loop: Boolean(slot?.loop),
    transitionSeconds: clampTimelineTransitionSeconds(Number(slot?.transitionSeconds ?? 0.2)),
    expressionTimeline: normalizeExpressionTimeline(slot?.expressionTimeline),
  };
}

function normalizePropSettings(props) {
  if (!Array.isArray(props)) return [];
  return props
    .slice(0, 32)
    .map((prop, index) => createPropSetting({ ...prop, id: String(prop?.id ?? `prop-${index}`) }))
    .filter((prop) => prop.id && prop.file);
}

function createPropSetting(prop = {}) {
  const file = fileNameFromPath(prop.file ?? "");
  return {
    id: String(prop.id ?? `prop-${Date.now()}`),
    name: String(prop.name ?? getPropDisplayName({ file })),
    file,
    attachBone: HUMAN_BONE_SET.has(prop.attachBone) ? prop.attachBone : "rightHand",
    followRotation: prop.followRotation !== false,
    positionOffset: normalizeNumberArray(prop.positionOffset, 3, 0),
    rotationOffset: normalizeNumberArray(prop.rotationOffset, 3, 0),
    scale: clampNumber(Number(prop.scale), 0.01, 5, 1),
    visible: prop.visible !== false,
  };
}

function normalizeNumberArray(value, length, fallback = 0) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => {
    const number = Number(source[index]);
    return Number.isFinite(number) ? number : fallback;
  });
}

function normalizeBlushSettings(blush) {
  if (!blush || !blush.image) return null;
  return {
    image: fileNameFromPath(blush.image),
    y: clampNumber(Number(blush.y), 0, 0.1, 0),
    z: clampNumber(Number(blush.z), 0, 0.2, 0.08),
    scale: clampNumber(Number(blush.scale), 0, 1, 0.28),
  };
}

function normalizePresetBlush(blush) {
  if (!blush) return createDisabledPresetBlush();
  const enabled = blush.enabled != null ? Boolean(blush.enabled) : true;
  return {
    enabled,
    opacity: enabled ? clampEmotionValue(Number(blush.opacity ?? 0.65)) : 0,
  };
}

function createDisabledPresetBlush() {
  return {
    enabled: false,
    opacity: 0,
  };
}

function isPresetBlushEnabled(preset) {
  return Boolean(preset?.blush && normalizePresetBlush(preset.blush).enabled);
}

function normalizeEmotionImageSettings(settings) {
  if (!settings || !settings.image) return null;
  return {
    image: fileNameFromPath(settings.image),
    x: clampNumber(Number(settings.x), -2, 2, 0),
    y: clampNumber(Number(settings.y), -1, 3, 1.5),
    z: clampNumber(Number(settings.z), -2, 2, 0),
    scale: clampNumber(Number(settings.scale), 0, 3, 1),
    opacity: clampNumber(Number(settings.opacity), 0, 1, 1),
    rotation: normalizeDegrees(Number(settings.rotation ?? 0)),
    pivotX: clampNumber(Number(settings.pivotX), 0, 1, 0.5),
    pivotY: clampNumber(Number(settings.pivotY), 0, 1, 0.5),
    animationDuration: normalizeEmotionImageDuration(settings.animationDuration),
    loop: Boolean(settings.loop),
    scaleGraph: normalizeEmotionImageGraph(settings.scaleGraph, 2),
    opacityGraph: normalizeEmotionImageGraph(settings.opacityGraph, 1),
    headRotationAxes: normalizeHeadRotationAxes(settings.headRotationAxes),
    headRotationGraph: normalizeHeadRotationGraph(settings.headRotationGraph),
  };
}

function normalizeEmotionImageDuration(value) {
  return Math.round(clampNumber(Number(value), 0.1, 30, 1) * 10) / 10;
}

function normalizeEmotionImageGraph(graph, maxValue = 1) {
  const source = Array.isArray(graph) && graph.length ? graph : [];
  const points = source
    .map((point) => ({
      time: clampNumber(Number(point?.time), 0, 1, 0),
      value: Math.round(clampNumber(Number(point?.value), 0, maxValue, 1) * 100) / 100,
      curve: ["linear", "easeOut", "easeIn", "easeInOut", "step"].includes(point?.curve) ? point.curve : "linear",
    }))
    .sort((a, b) => a.time - b.time);
  if (!points.length || points[0].time > 0.001) points.unshift({ time: 0, value: 1, curve: "linear" });
  points[0] = { ...points[0], time: 0 };
  if (points.at(-1).time < 0.999) points.push({ time: 1, value: 1, curve: "linear" });
  points[points.length - 1] = { ...points.at(-1), time: 1, curve: "linear" };
  const deduped = [];
  for (const point of points.slice(0, 12)) {
    if (deduped.length && Math.abs(deduped.at(-1).time - point.time) < 0.001) {
      deduped[deduped.length - 1] = point;
    } else {
      deduped.push(point);
    }
  }
  return deduped;
}

function normalizeEmotionImageGraphRange(graph, minValue, maxValue, defaultValue = 0) {
  const source = Array.isArray(graph) && graph.length ? graph : [];
  const points = source
    .map((point) => ({
      time: clampNumber(Number(point?.time), 0, 1, 0),
      value: Math.round(clampNumber(Number(point?.value), minValue, maxValue, defaultValue) * 100) / 100,
      curve: ["linear", "easeOut", "easeIn", "easeInOut", "step"].includes(point?.curve) ? point.curve : "linear",
    }))
    .sort((a, b) => a.time - b.time);
  if (!points.length || points[0].time > 0.001) points.unshift({ time: 0, value: defaultValue, curve: "linear" });
  points[0] = { ...points[0], time: 0 };
  if (points.at(-1).time < 0.999) points.push({ time: 1, value: defaultValue, curve: "linear" });
  points[points.length - 1] = { ...points.at(-1), time: 1, curve: "linear" };
  const deduped = [];
  for (const point of points.slice(0, 12)) {
    if (deduped.length && Math.abs(deduped.at(-1).time - point.time) < 0.001) {
      deduped[deduped.length - 1] = point;
    } else {
      deduped.push(point);
    }
  }
  return deduped;
}

function normalizeHeadRotationAxes(axes) {
  return {
    x: Boolean(axes?.x),
    y: Boolean(axes?.y),
    z: Boolean(axes?.z),
  };
}

function normalizeHeadRotationGraph(graph) {
  return {
    x: normalizeEmotionImageGraphRange(graph?.x, EMOTION_HEAD_ROTATION_MIN, EMOTION_HEAD_ROTATION_MAX, 0),
    y: normalizeEmotionImageGraphRange(graph?.y, EMOTION_HEAD_ROTATION_MIN, EMOTION_HEAD_ROTATION_MAX, 0),
    z: normalizeEmotionImageGraphRange(graph?.z, EMOTION_HEAD_ROTATION_MIN, EMOTION_HEAD_ROTATION_MAX, 0),
  };
}

function isEmotionImageGraphAnimated(settings = getActiveEmotionImageSettings()) {
  if (!settings) return false;
  const graphAnimated = [settings.scaleGraph, settings.opacityGraph].some((graph) =>
    graph.some((point) => Math.abs(point.value - 1) > 0.001 || point.curve !== "linear"),
  );
  const axes = normalizeHeadRotationAxes(settings.headRotationAxes);
  const rotationAnimated = ["x", "y", "z"].some(
    (axis) =>
      axes[axis] &&
      normalizeEmotionImageGraphRange(settings.headRotationGraph?.[axis], EMOTION_HEAD_ROTATION_MIN, EMOTION_HEAD_ROTATION_MAX, 0).some(
        (point) => Math.abs(point.value) > 0.001 || point.curve !== "linear",
      ),
  );
  return graphAnimated || rotationAnimated;
}

function emotionGraphX(time) {
  return Math.round(clampNumber(Number(time), 0, 1, 0) * EMOTION_GRAPH_WIDTH);
}

function emotionGraphY(value, maxValue) {
  return Math.round((1 - clampNumber(Number(value), 0, maxValue, 1) / Math.max(maxValue, 0.001)) * EMOTION_GRAPH_HEIGHT);
}

function emotionGraphYRange(value, minValue, maxValue) {
  const span = Math.max(maxValue - minValue, 0.001);
  return Math.round((1 - (clampNumber(Number(value), minValue, maxValue, 0) - minValue) / span) * EMOTION_GRAPH_HEIGHT);
}

function buildEmotionGraphPath(points, maxValue) {
  const normalized = normalizeEmotionImageGraph(points, maxValue);
  if (!normalized.length) return "";
  let path = `M${emotionGraphX(normalized[0].time)} ${emotionGraphY(normalized[0].value, maxValue)}`;
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];
    const x1 = emotionGraphX(current.time);
    const y1 = emotionGraphY(current.value, maxValue);
    const x2 = emotionGraphX(next.time);
    const y2 = emotionGraphY(next.value, maxValue);
    if (current.curve === "step") {
      path += ` L${x2} ${y1} L${x2} ${y2}`;
    } else if (current.curve === "easeOut") {
      path += ` C${x1 + (x2 - x1) * 0.16} ${y2} ${x1 + (x2 - x1) * 0.44} ${y2} ${x2} ${y2}`;
    } else if (current.curve === "easeIn") {
      path += ` C${x1 + (x2 - x1) * 0.56} ${y1} ${x1 + (x2 - x1) * 0.84} ${y1} ${x2} ${y2}`;
    } else if (current.curve === "easeInOut") {
      path += ` C${x1 + (x2 - x1) * 0.42} ${y1} ${x1 + (x2 - x1) * 0.58} ${y2} ${x2} ${y2}`;
    } else {
      path += ` L${x2} ${y2}`;
    }
  }
  return path;
}

function buildEmotionGraphPathRange(points, minValue, maxValue) {
  const normalized = normalizeEmotionImageGraphRange(points, minValue, maxValue, 0);
  if (!normalized.length) return "";
  let path = `M${emotionGraphX(normalized[0].time)} ${emotionGraphYRange(normalized[0].value, minValue, maxValue)}`;
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];
    const x1 = emotionGraphX(current.time);
    const y1 = emotionGraphYRange(current.value, minValue, maxValue);
    const x2 = emotionGraphX(next.time);
    const y2 = emotionGraphYRange(next.value, minValue, maxValue);
    if (current.curve === "step") {
      path += ` L${x2} ${y1} L${x2} ${y2}`;
    } else if (current.curve === "easeOut") {
      path += ` C${x1 + (x2 - x1) * 0.16} ${y2} ${x1 + (x2 - x1) * 0.44} ${y2} ${x2} ${y2}`;
    } else if (current.curve === "easeIn") {
      path += ` C${x1 + (x2 - x1) * 0.56} ${y1} ${x1 + (x2 - x1) * 0.84} ${y1} ${x2} ${y2}`;
    } else if (current.curve === "easeInOut") {
      path += ` C${x1 + (x2 - x1) * 0.42} ${y1} ${x1 + (x2 - x1) * 0.58} ${y2} ${x2} ${y2}`;
    } else {
      path += ` L${x2} ${y2}`;
    }
  }
  return path;
}

function getSelectedEmotionImageGraphPoint(settings = getActiveEmotionImageSettings()) {
  const graphKey = state.selectedEmotionImageGraph?.graph;
  if (!settings || !isEmotionImageEditableGraph(graphKey)) return null;
  if (graphKey === "headRotationGraph" && !normalizeHeadRotationAxes(settings.headRotationAxes)[getSelectedHeadRotationAxis(settings)]) return null;
  const points = getEmotionImageGraphForKey(settings, graphKey);
  const index = clampNumber(Number(state.selectedEmotionImageGraph?.index), 0, points.length - 1, 0);
  return { graphKey, points, index, ...points[index] };
}

function getSelectedHeadRotationAxis(settings = getActiveEmotionImageSettings()) {
  const axes = normalizeHeadRotationAxes(settings?.headRotationAxes);
  const current = state.selectedEmotionImageGraph?.axis;
  if (["x", "y", "z"].includes(current)) return current;
  return ["x", "y", "z"].find((axis) => axes[axis]) ?? "x";
}

function normalizePresetEmotionImage(settings, fallback = null) {
  const normalized = normalizeEmotionImageSettings(settings?.image ? settings : fallback);
  return normalized?.image ? normalized : null;
}

function getPresetEmotionImageRangeSlots(preset) {
  return normalizeExpressionRangeSlots(preset?.rangeSlots).filter((slot) => slot.emotionImage?.image);
}

function getLastEmotionImageRangeSettings(preset) {
  return getPresetEmotionImageRangeSlots(preset).at(-1)?.emotionImage ?? null;
}

function getEmotionImageBaseSettings(preset) {
  return getLastEmotionImageRangeSettings(preset) ?? normalizePresetEmotionImage(preset?.emotionImage);
}

function getSelectedEmotionImageSettingsForEdit() {
  const selected = getSelectedEmotionPreset();
  if (!selected?.emotionImage) return null;
  const slot = getSelectedExpressionRangeSlot();
  if (slot) {
    return normalizePresetEmotionImage(slot.emotionImage, getEmotionImageBaseSettings(selected) ?? selected.emotionImage);
  }
  return normalizePresetEmotionImage(selected.emotionImage);
}

function updateSelectedEmotionImageSettings(patch) {
  const selected = getSelectedEmotionPreset();
  if (!selected?.emotionImage || selected.locked) return null;
  const current = getSelectedEmotionImageSettingsForEdit() ?? normalizePresetEmotionImage(selected.emotionImage);
  const next = normalizePresetEmotionImage({
    ...(current ?? {}),
    ...(typeof patch === "function" ? patch(current) : patch),
    image: selected.emotionImage.image,
  });
  if (!next) return null;
  if (state.selectedExpressionRangeId) {
    updateSelectedExpressionRangeSlot((slot) => ({
      ...slot,
      emotionImage: next,
    }));
  } else {
    selected.emotionImage = next;
  }
  return next;
}

function seedEmotionImageToAllRangeSlots(preset, settings) {
  if (!preset) return;
  const normalized = normalizePresetEmotionImage(settings);
  if (!normalized) return;
  const slots = normalizeExpressionRangeSlots(preset.rangeSlots);
  preset.rangeSlots = slots.map((slot) => ({
    ...slot,
    emotionImage: normalizePresetEmotionImage(slot.emotionImage, normalized) ?? normalized,
  }));
}

function setEmotionImageFileForAllRangeSlots(preset, imageName) {
  if (!preset || !imageName) return;
  const slots = normalizeExpressionRangeSlots(preset.rangeSlots);
  preset.rangeSlots = slots.map((slot) => ({
    ...slot,
    emotionImage: slot.emotionImage
      ? normalizePresetEmotionImage({ ...slot.emotionImage, image: imageName })
      : null,
  }));
}

function getActiveBlushSettings() {
  return normalizeBlushSettings(state.correction.blush);
}

function getActiveEmotionImageSettings() {
  if (state.mode === "emotionMap" && state.emotionMapActiveEmotionImage?.settings) {
    return normalizePresetEmotionImage(state.emotionMapActiveEmotionImage.settings);
  }
  return getSelectedEmotionImageSettingsForEdit();
}

function getSelectedBlushOpacity() {
  const selected = getSelectedEmotionPreset();
  if (!isPresetBlushEnabled(selected)) return 0;
  const slot = getSelectedExpressionRangeSlot();
  return slot?.blushOpacity != null ? clampEmotionValue(Number(slot.blushOpacity)) : normalizePresetBlush(selected.blush).opacity;
}

function setSelectedBlushOpacity(value) {
  const selected = getSelectedEmotionPreset();
  if (!isPresetBlushEnabled(selected)) return;
  const opacity = clampEmotionValue(Number(value));
  const slot = getSelectedExpressionRangeSlot();
  if (slot) {
    const slots = normalizeExpressionRangeSlots(selected.rangeSlots);
    const target = slots.find((item) => item.id === slot.id);
    if (target) target.blushOpacity = opacity;
    selected.rangeSlots = slots;
  } else {
    selected.blush = { ...normalizePresetBlush(selected.blush), opacity };
  }
}

function getBlushOpacityAtValue(preset, value) {
  if (!isPresetBlushEnabled(preset)) return 0;
  const clamped = clampEmotionValue(value);
  const mainOpacity = normalizePresetBlush(preset.blush).opacity;
  const points = [
    { threshold: 0, opacity: 0 },
    ...normalizeExpressionRangeSlots(preset.rangeSlots)
      .filter((slot) => slot.blushOpacity != null)
      .map((slot) => ({ threshold: slot.threshold, opacity: clampEmotionValue(Number(slot.blushOpacity)) })),
    { threshold: 1, opacity: mainOpacity },
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
  if (Math.abs(right.threshold - left.threshold) < 0.000001) return right.opacity;
  const t = (clamped - left.threshold) / (right.threshold - left.threshold);
  return clampEmotionValue(left.opacity + (right.opacity - left.opacity) * t);
}

function normalizeExpressionRangeSlots(slots) {
  if (!Array.isArray(slots)) return [];
  return slots
    .slice(0, 5)
    .map((slot, index) => ({
      id: String(slot?.id ?? `range-${index}`),
      threshold: clampEmotionValue(Number(slot?.threshold ?? 0.5)),
      parameters: normalizeExpressionParameterValues(slot?.parameters),
      ...(slot?.blushOpacity != null ? { blushOpacity: clampEmotionValue(Number(slot.blushOpacity)) } : {}),
      ...(slot?.emotionImage ? { emotionImage: normalizePresetEmotionImage(slot.emotionImage) } : {}),
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
    props: normalizeStringList(animation?.props),
    corrections: {},
  };
  for (const [boneName, correction] of Object.entries(animation.corrections ?? {})) {
    if (!HUMAN_BONES.includes(boneName)) continue;
    next.corrections[boneName] = normalizeBoneCorrection(correction);
    pruneCorrectionObject(next.corrections, boneName);
  }
  if (!next.props.length) delete next.props;
  return next;
}

function normalizeExpressionTimeline(timeline) {
  if (!Array.isArray(timeline)) return [];
  return timeline
    .slice(0, 12)
    .map((item, index) => ({
      id: String(item?.id ?? `timeline-${index}`),
      time: Math.max(0, Math.round(Number(item?.time ?? 0) * 10) / 10),
      expressionPresetId: String(item?.expressionPresetId ?? ""),
      expressionPresetName: String(item?.expressionPresetName ?? ""),
      expressionRangeId: String(item?.expressionRangeId ?? ""),
      expressionValue: clampEmotionValue(Number(item?.expressionValue ?? 1)),
      transitionSeconds: clampTimelineTransitionSeconds(Number(item?.transitionSeconds ?? 0.2)),
    }))
    .filter((item) => item.expressionPresetId || item.expressionPresetName)
    .sort((a, b) => a.time - b.time);
}

function clampTimelineTransitionSeconds(value) {
  if (!Number.isFinite(value)) return 0.2;
  return Math.min(1, Math.max(0, Math.round(value * 10) / 10));
}

function serializeCorrection() {
  const next = normalizeCorrectionJson(state.correction);
  for (const animation of Object.values(next.animations)) {
    if (animation.expressionPresetId) {
      const preset = state.expressionPresets.find((item) => item.id === animation.expressionPresetId);
      if (preset) animation.expressionPresetName = preset.name;
    }
    if (Array.isArray(animation.expressionTimeline)) {
      animation.expressionTimeline = animation.expressionTimeline.map((slot) => {
        const preset = findMatchingExpressionPreset(slot.expressionPresetId, slot.expressionPresetName);
        if (!preset) return slot;
        const rangeSlot = normalizeExpressionRangeSlots(preset.rangeSlots).find((item) => item.id === slot.expressionRangeId);
        return {
          ...slot,
          expressionPresetId: preset.id,
          expressionPresetName: preset.name,
          expressionRangeId: rangeSlot?.id ?? "",
          expressionValue: rangeSlot ? clampEmotionValue(rangeSlot.threshold) : clampEmotionValue(slot.expressionValue ?? 1),
        };
      });
    }
  }
  for (const animation of Object.values(next.animations)) {
    for (const boneName of Object.keys(animation.corrections)) {
      pruneCorrectionObject(animation.corrections, boneName);
    }
  }
  next.blush = normalizeBlushSettings(state.correction.blush);
  next.emotionImage = null;
  next.extraBoneFollowSettings = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings);
  next.materialSettings = normalizeMaterialSettings(state.correction.materialSettings);
  next.motionSlots = [];
  next.props = normalizePropSettings(state.correction.props);
  next.emotionMap = serializeEmotionMapConfig();
  next.expressionPresets = normalizeExpressionPresets(state.expressionPresets).map((preset) => {
    const blush = normalizePresetBlush(preset.blush);
    const rangeSlots = normalizeExpressionRangeSlots(preset.rangeSlots).map((slot) =>
      blush.enabled ? slot : { ...slot, blushOpacity: 0 },
    );
    return {
      id: preset.id,
      name: preset.name,
      locked: preset.locked,
      isDisableBlink: preset.isDisableBlink,
      parameters: preset.parameters,
      rangeSlots,
      blush,
      emotionImage: preset.emotionImage,
    };
  });
  return next;
}

function serializeEmotionLinkerMeta() {
  const next = normalizeEmotionLinkerMeta(state.emotionLinker, state.expressionPresets);
  for (const animation of Object.values(next.animations)) {
    const preset = findMatchingExpressionPreset(animation.expressionPresetId, animation.expressionPresetName);
    if (preset) {
      animation.expressionPresetId = preset.id;
      animation.expressionPresetName = preset.name;
    }
    if (Array.isArray(animation.expressionTimeline)) {
      animation.expressionTimeline = animation.expressionTimeline.map((slot) => {
        const preset = findMatchingExpressionPreset(slot.expressionPresetId, slot.expressionPresetName);
        if (!preset) return slot;
        const rangeSlot = normalizeExpressionRangeSlots(preset.rangeSlots).find((item) => item.id === slot.expressionRangeId);
        return {
          ...slot,
          expressionPresetId: preset.id,
          expressionPresetName: preset.name,
          expressionRangeId: rangeSlot?.id ?? "",
          expressionValue: rangeSlot ? clampEmotionValue(rangeSlot.threshold) : clampEmotionValue(slot.expressionValue ?? 1),
        };
      });
    }
  }
  return next;
}

function serializeEmotionLinker2Meta() {
  const next = normalizeEmotionLinker2Meta(state.emotionLinker2, state.expressionPresets);
  next.motionSlots = next.motionSlots.map((slot) => {
    const preset = findMatchingExpressionPreset(slot.expressionPresetId, slot.expressionPresetName);
    const timeline = normalizeExpressionTimeline(slot.expressionTimeline).map((point) => {
      const pointPreset = findMatchingExpressionPreset(point.expressionPresetId, point.expressionPresetName);
      if (!pointPreset) return point;
      const rangeSlot = normalizeExpressionRangeSlots(pointPreset.rangeSlots).find((item) => item.id === point.expressionRangeId);
      return {
        ...point,
        expressionPresetId: pointPreset.id,
        expressionPresetName: pointPreset.name,
        expressionRangeId: rangeSlot?.id ?? "",
        expressionValue: rangeSlot ? clampEmotionValue(rangeSlot.threshold) : clampEmotionValue(point.expressionValue ?? 1),
      };
    });
    return {
      ...slot,
      expressionPresetId: preset?.id ?? slot.expressionPresetId,
      expressionPresetName: preset?.name ?? slot.expressionPresetName,
      expressionTimeline: timeline,
    };
  });
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
  lastExtraBoneFollowBases = new Map();
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

function findBoneByName(name) {
  if (!currentVrm?.scene || !name) return null;
  let found = null;
  currentVrm.scene.traverse((object) => {
    if (!found && object?.isBone && object.name === name) found = object;
  });
  return found;
}

function applyExtraBoneFollowPreview() {
  if (!currentVrm) return;
  clearExtraBoneFollowPreview();
  const settings = normalizeExtraBoneFollowSettings(state.correction.extraBoneFollowSettings);
  if (!settings.length) return;
  const sourceWorldQuaternion = new THREE.Quaternion();
  const parentWorldQuaternion = new THREE.Quaternion();
  const localQuaternion = new THREE.Quaternion();
  const tailAxis = new THREE.Vector3(0, 1, 0);
  for (const setting of settings) {
    if (!setting.targetBone || !setting.sourceBone) continue;
    const target = findBoneByName(setting.targetBone);
    const source = getRawBoneNode(setting.sourceBone);
    if (!target || !source) continue;
    lastExtraBoneFollowBases.set(setting.id, {
      bone: target,
      quaternion: target.quaternion.clone(),
    });
    source.getWorldQuaternion(sourceWorldQuaternion);
    if (target.parent) {
      target.parent.getWorldQuaternion(parentWorldQuaternion);
      localQuaternion.copy(parentWorldQuaternion).invert().multiply(sourceWorldQuaternion);
    } else {
      localQuaternion.copy(sourceWorldQuaternion);
    }
    target.quaternion.copy(getSwingTwistScaledQuaternion(localQuaternion, tailAxis, setting.swingFactor, setting.twistFactor));
    alignExtraBoneTailDirection(target, getRawBoneNode(setting.tailDirectionBone));
  }
  currentVrm.scene.updateMatrixWorld(true);
}

function getSwingTwistScaledQuaternion(quaternion, twistAxis, swingFactor = 1, twistFactor = 0) {
  const normalizedAxis = twistAxis.clone().normalize();
  const vector = new THREE.Vector3(quaternion.x, quaternion.y, quaternion.z);
  const projected = normalizedAxis.multiplyScalar(vector.dot(normalizedAxis));
  const twist = new THREE.Quaternion(projected.x, projected.y, projected.z, quaternion.w).normalize();
  if (!Number.isFinite(twist.x + twist.y + twist.z + twist.w)) twist.identity();
  const swing = quaternion.clone().multiply(twist.clone().invert()).normalize();
  const scaledSwing = new THREE.Quaternion().identity().slerp(swing, normalizeExtraBoneFactor(swingFactor, 1));
  const scaledTwist = new THREE.Quaternion().identity().slerp(twist, normalizeExtraBoneFactor(twistFactor, 0));
  return scaledSwing.multiply(scaledTwist).normalize();
}

function alignExtraBoneTailDirection(target, tailTarget) {
  if (!target || !tailTarget) return;
  currentVrm.scene.updateMatrixWorld(true);
  const targetPosition = target.getWorldPosition(new THREE.Vector3());
  const tailPosition = tailTarget.getWorldPosition(new THREE.Vector3());
  const desiredDirection = tailPosition.sub(targetPosition);
  if (desiredDirection.lengthSq() < 0.0000001) return;
  desiredDirection.normalize();

  const targetWorldQuaternion = target.getWorldQuaternion(new THREE.Quaternion());
  const currentDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(targetWorldQuaternion).normalize();
  if (currentDirection.lengthSq() < 0.0000001) return;

  const alignWorldQuaternion = new THREE.Quaternion().setFromUnitVectors(currentDirection, desiredDirection);
  const nextWorldQuaternion = alignWorldQuaternion.multiply(targetWorldQuaternion);
  if (target.parent) {
    const parentWorldQuaternion = target.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    target.quaternion.copy(parentWorldQuaternion.multiply(nextWorldQuaternion));
  } else {
    target.quaternion.copy(nextWorldQuaternion);
  }
  target.updateMatrixWorld(true);
}

function clearExtraBoneFollowPreview() {
  if (!currentVrm || !lastExtraBoneFollowBases.size) return;
  for (const base of lastExtraBoneFollowBases.values()) {
    if (!base.bone) continue;
    base.bone.quaternion.copy(base.quaternion);
  }
  lastExtraBoneFollowBases = new Map();
  currentVrm.scene.updateMatrixWorld(true);
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
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(normalized.rotationOffset[0]),
      THREE.MathUtils.degToRad(normalized.rotationOffset[1]),
      THREE.MathUtils.degToRad(normalized.rotationOffset[2]),
      "XYZ",
    );
    bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(euler));
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
  if (value === "emotionMap") return "Emotion Map";
  if (value === "linker") return "Emotion Linker (view only)";
  if (value === "linker2") return "Emotion Linker 2 (view only)";
  if (value === "extraBone") return "Extra Bone Follow";
  if (value === "transitionViewer") return "Transition Viewer (view only)";
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
  if (isEditableElement(event.target)) return;
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
renderer.domElement.addEventListener("pointerdown", handleEmotionImagePivotPointerDown, true);

function tick() {
  requestAnimationFrame(tick);
  const delta = clock.getDelta();
  restoreEmotionImageHeadRotationOffset();
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
    updateActiveLinkTimeline();
    updateAnimationControls();
  }
  applyLookAtCameraOverride();
  currentVrm?.update?.(delta);
  updateExpressionDecay(delta);
  updateExpressionTransition(delta);
  reapplyActiveRorrInfluences();
  updateRandomBlink(delta);
  updateLipSyncPreview(delta);
  updatePropOverlayRuntime();
  updateEmotionImageAnimation(delta);
  applyMotionCorrectionPreview();
  applyExtraBoneFollowPreview();
  applyEditDraftMorphPreview();
  applyEmotionImageHeadRotation();
  updateEmotionImageBillboard();
  renderer.render(scene, camera);
  updateExtraBoneGizmoOverlay();
}

render();
tick();
