# Emotion Linker 2 Frontend Runtime Spec

Updated: 2026-09-26

이 문서는 프런트/익스텐션 런타임에서 Emotion Linker 2의 **슬롯 이름을 호출하여 애니메이션, 표정, 이펙트를 에디터에서 설정한 시퀀스대로 재생**하기 위한 구현 명세다.

이 기능은 참고사항이 아니라 프런트 구현 대상이다.

## 1. 핵심 계약

프런트는 최소한 아래 호출 인터페이스를 제공해야 한다.

```ts
playMotionSlotByTitle(title: string, options?: PlayMotionSlotOptions): MotionSlotPlaybackHandle
stopMotionSlot(reason?: string): void
```

호출 예:

```ts
playMotionSlotByTitle("좋았어!");
playMotionSlotByTitle("생각중");
```

한 번의 슬롯 호출은 아래 항목을 하나의 재생 단위로 취급한다.

```text
VRMA 애니메이션
+ 캐릭터별 Motion Correction
+ 애니메이션에 연결된 GLB Prop
+ 정면시선(lookAtCamera)
+ 시작 표정
+ 시간축 표정 시퀀스
+ 표정의 Head/Eye Pose Controls
+ 지정 시점의 파티클 이펙트
```

## 2. 전달해야 하는 리소스

```text
models/
  CharacterName.vrm
  CharacterName.vrm.meta

animations/
  animations.meta
  *.vrma

emotionLinker/
  emotion-linker2.meta

effects/
  effects.meta

img/
  *.png
  *.svg

props/
  *.glb
```

관련 세부 문서:

- `docs/RESOURCE_REFERENCE_RULES.md`
- `docs/EFFECT_RUNTIME_SPEC.md`
- `docs/EMOTION_IMAGE_RUNTIME_SPEC.md`
- `docs/LOOK_AT_CAMERA_RUNTIME_SPEC.md`

## 3. 로딩 및 인덱스 생성

권장 로딩 순서:

```text
1. VRM 로드
2. 같은 캐릭터의 CharacterName.vrm.meta 로드
3. animations/animations.meta 로드
4. emotionLinker/emotion-linker2.meta 로드
5. effects/effects.meta 로드
6. 슬롯에서 참조하는 VRMA, 이미지, GLB 리소스 준비
7. title/id 인덱스 생성
```

```ts
const slotById = new Map<string, MotionSlot>();
const slotByTitle = new Map<string, MotionSlot>();

for (const slot of emotionLinker2Meta.motionSlots ?? []) {
  slotById.set(slot.id, slot);

  const title = slot.title.trim();
  if (!title) continue;
  if (slotByTitle.has(title)) {
    console.error(`Duplicate Emotion Linker 2 title: ${title}`);
    continue;
  }
  slotByTitle.set(title, slot);
}
```

외부 호출에는 사람이 읽을 수 있는 `title`을 사용하고, 재생이 시작된 뒤에는 변하지 않는 `id`를 내부 키로 사용한다.

`motionSlots` 배열의 저장 순서와 에디터의 이름순 정렬 여부는 재생 의미에 영향을 주면 안 된다.

### 슬롯 이름 중복 정책

슬롯 이름 호출을 사용하려면 `title`이 고유해야 한다. 이름이 중복되면 첫 슬롯을 조용히 재생하지 말고 오류를 기록하고 호출을 실패시키는 것을 권장한다.

```ts
function playMotionSlotByTitle(title: string) {
  const matches = motionSlots.filter((slot) => slot.title.trim() === title.trim());
  if (matches.length !== 1) {
    throw new Error(`Motion slot title must resolve to exactly one slot: ${title}`);
  }
  return playMotionSlot(matches[0]);
}
```

## 4. emotion-linker2.meta 구조

```json
{
  "schemaVersion": 1,
  "type": "vrm-emotion-linker2-meta",
  "motionSlots": [
    {
      "id": "motion-slot-1789001845503-26",
      "title": "좋았어!",
      "animationFile": "a3_1.vrma",
      "expressionPresetId": "emotion-4",
      "expressionPresetName": "Joy",
      "effectId": "effect-1789020298667-1",
      "effectStartTime": 0.6,
      "loop": false,
      "transitionSeconds": 0.2,
      "expressionTimeline": [
        {
          "id": "motion-point-1",
          "time": 0.4,
          "expressionPresetId": "emotion-4",
          "expressionPresetName": "Joy",
          "expressionRangeId": "",
          "expressionValue": 1,
          "transitionSeconds": 0.2
        }
      ]
    }
  ]
}
```

### Motion Slot 필드

| 필드 | 의미 |
| --- | --- |
| `id` | 내부 식별자. 재생 중 상태 관리 키로 사용한다. |
| `title` | 프런트에서 호출할 슬롯 이름이다. |
| `animationFile` | `animations/` 기준 VRMA 파일명이다. |
| `expressionPresetId` | 슬롯 시작 시 적용할 표정 프리셋 ID다. |
| `expressionPresetName` | ID를 찾지 못했을 때의 fallback 및 표시용 이름이다. |
| `effectId` | `effects.meta.effects[].id` 참조다. 빈 문자열이면 이펙트가 없다. |
| `effectStartTime` | 슬롯 시작 후 이펙트 시작 시점, 초 단위다. |
| `loop` | 이 슬롯의 애니메이션과 시퀀스를 반복할지 결정한다. |
| `transitionSeconds` | 이전 동작에서 이 슬롯으로 전환하는 시간이며 시작 표정 전환에도 사용한다. |
| `expressionTimeline` | 슬롯 시간축에 따라 적용할 표정 전환 목록이다. |

슬롯의 `loop`가 `animations.meta`의 기본 `loop`보다 우선한다.

## 5. 이름 호출부터 재생까지

슬롯 재생은 다음 순서로 시작한다.

```text
1. title을 정확히 비교하여 슬롯 하나를 찾는다.
2. 이전 슬롯의 예약 작업과 재생 토큰을 취소한다.
3. animationFile로 VRMA와 animations.meta 항목을 찾는다.
4. 이전 animation action에서 새 action으로 transitionSeconds 동안 전환한다.
5. 캐릭터 메타의 Motion Correction과 연결된 Props를 활성화한다.
6. animations.meta의 lookAtCamera를 적용하거나 해제한다.
7. time=0인 timeline 표정이 있으면 그것을 적용한다.
8. 그렇지 않으면 슬롯의 기본 expressionPresetId를 적용한다.
9. expressionTimeline과 effectStartTime 감시를 시작한다.
```

새 슬롯을 시작할 때 이전 슬롯의 `setTimeout`만 남겨두면 이전 이펙트나 표정이 새 슬롯 중간에 실행될 수 있다. 모든 예약 작업은 재생별 `runId` 또는 `AbortController`에 묶어 취소해야 한다.

## 6. 권장 재생 컨트롤러

`setTimeout` 여러 개만 사용하는 것보다 매 프레임 현재 VRMA 시간을 기준으로 이벤트 경계를 통과했는지 확인하는 방식이 안전하다. 탭 비활성화, 프레임 드롭, 재생 속도 변경에도 시퀀스가 덜 어긋난다.

```ts
class MotionSlotPlayer {
  private runId = 0;
  private active: ActiveMotionSlot | null = null;

  async playByTitle(title: string) {
    const slot = requireUniqueSlotByTitle(title);
    return this.play(slot);
  }

  async play(slot: MotionSlot) {
    const runId = ++this.runId;
    this.stopActiveResources();

    const animationMeta = animationsMeta.animations?.[slot.animationFile];
    const action = await loadVrmaAction(`animations/${slot.animationFile}`);
    if (runId !== this.runId) return;

    crossFadeTo(action, slot.transitionSeconds);
    action.setLoop(slot.loop);
    action.play();

    applyMotionCorrection(characterMeta.animations?.[slot.animationFile]);
    applyAnimationProps(characterMeta, slot.animationFile);
    applyLookAtCamera(vrm, camera, Boolean(animationMeta?.lookAtCamera));

    this.active = {
      runId,
      slotId: slot.id,
      slot,
      action,
      previousTime: 0,
      appliedExpressionPointIds: new Set(),
      effectTriggered: false
    };

    applyInitialSlotExpression(slot, this.active);
  }

  update() {
    const active = this.active;
    if (!active) return;

    const currentTime = active.action.time;
    const looped = active.slot.loop && currentTime + 0.001 < active.previousTime;
    if (looped) {
      active.appliedExpressionPointIds.clear();
      active.effectTriggered = false;
      stopSlotEffect(active.slot.effectId);
    }

    applyCrossedExpressionPoints(active, active.previousTime, currentTime, looped);
    triggerEffectIfCrossed(active, active.previousTime, currentTime, looped);
    active.previousTime = currentTime;
  }

  stop(reason = "replaced") {
    ++this.runId;
    this.stopActiveResources();
    this.active = null;
  }
}
```

## 7. 표정 시작 규칙

`expressionTimeline`을 시간순으로 정렬한 뒤 첫 포인트가 `time <= 0.001`이면 그 포인트가 시작 표정보다 우선한다.

```ts
function applyInitialSlotExpression(slot: MotionSlot, active: ActiveMotionSlot) {
  const timeline = [...(slot.expressionTimeline ?? [])].sort((a, b) => a.time - b.time);
  const first = timeline[0];

  if (first && first.time <= 0.001) {
    applyExpressionPoint(first, 0);
    active.appliedExpressionPointIds.add(first.id);
    return;
  }

  applyExpressionReference(
    slot.expressionPresetId,
    slot.expressionPresetName,
    1,
    slot.transitionSeconds
  );
}
```

표정 참조 우선순위:

```text
1. expressionPresetId 일치
2. ID가 없거나 찾지 못한 경우 expressionPresetName 일치
3. 둘 다 찾지 못하면 표정 적용만 생략하고 애니메이션은 계속 재생
```

## 8. expressionTimeline 재생

```json
{
  "id": "motion-point-...",
  "time": 1.5,
  "expressionPresetId": "emotion-4",
  "expressionPresetName": "Joy",
  "expressionRangeId": "range-...",
  "expressionValue": 0.8,
  "transitionSeconds": 0.2
}
```

| 필드 | 의미 |
| --- | --- |
| `time` | 슬롯/VRMA 시작 후 표정을 적용할 시간, 초 단위다. |
| `expressionPresetId` | 적용할 표정 프리셋 ID다. |
| `expressionPresetName` | ID fallback 및 표시용 이름이다. |
| `expressionRangeId` | 해당 프리셋의 `rangeSlots[].id` 참조다. |
| `expressionValue` | range ID를 사용하지 않을 때의 표정 강도 `0..1`이다. |
| `transitionSeconds` | 현재 표정에서 이 포인트의 표정으로 전환하는 시간이다. |

적용값 결정:

```text
expressionRangeId가 유효함 -> 해당 range slot의 threshold 사용
그 외                       -> expressionValue 사용
```

프레임이 이벤트 시각을 정확히 밟지 않을 수 있으므로 `currentTime === point.time` 비교를 사용하면 안 된다. `previousTime < point.time <= currentTime`으로 경계 통과를 검사한다.

루프가 처음으로 돌아간 프레임에는 적용 완료 ID를 초기화하고 아래 두 구간을 모두 검사한다.

```text
previousTime < point.time <= duration
0 <= point.time <= currentTime
```

동일 시간의 포인트는 메타 배열의 기존 순서를 유지해 적용한다.

## 9. Expression Preset 전체 적용

표정 프리셋은 shape key 값만 뜻하지 않는다. 아래 항목을 하나의 프리셋으로 함께 처리한다.

```text
parameters
poseControls
blush
emotionImage
rangeSlots
isDisableBlink
```

프리셋 예:

```json
{
  "id": "emotion-4",
  "name": "Joy",
  "isDisableBlink": false,
  "parameters": {
    "MTH_Smile": 1
  },
  "poseControls": {
    "headYaw": { "value": 12, "mode": "offset" },
    "eyeGazeX": { "value": -0.3, "mode": "override" },
    "eyeGazeY": { "value": 0.15, "mode": "offset" }
  },
  "rangeSlots": []
}
```

`expressionValue`이 `0..1` 사이면 다음 기준점 사이를 보간한다.

```text
threshold 0              -> 모든 표정값과 Pose Control 값 0
rangeSlots[].threshold   -> 해당 range slot 값
threshold 1              -> 프리셋 본값
```

shape key, Pose Control, blush opacity를 같은 구간 비율로 보간한다. Emotion Image는 `docs/EMOTION_IMAGE_RUNTIME_SPEC.md`의 선택 및 그래프 규칙을 따른다.

Emotion Image 설정 안에 `effect` 참조가 있으면 해당 이미지 연출의 시작 시간에 Effect Runtime을 호출한다. 이것은 Motion Slot의 `effectId`와 별개의 트리거이므로 둘 다 설정된 경우 각각 독립적으로 재생한다.

## 10. Head/Eye Pose Controls

이 항목은 프런트 구현에서 반드시 읽어야 한다.

### 필드

```json
{
  "poseControls": {
    "headYaw": { "value": 0, "mode": "offset" },
    "eyeGazeX": { "value": 0, "mode": "offset" },
    "eyeGazeY": { "value": 0, "mode": "offset" }
  }
}
```

- `headYaw`: 머리 좌우 회전. 단위는 degree이며 범위는 `-60..60`이다.
- `eyeGazeX`: 눈동자 좌우. 정규화 범위 `-1..1`, 최대 회전은 좌우 약 `30deg`다.
- `eyeGazeY`: 눈동자 상하. 정규화 범위 `-1..1`, 최대 회전은 상하 약 `20deg`다.
- 값 `0`: 해당 항목은 아무 효과도 주지 않는다.
- `mode: "offset"`: 현재 VRMA/시선 결과에 상대 회전을 더한다.
- `mode: "override"`: 해당 축의 상대 회전을 지정값으로 교체한다.

눈동자 좌우는 눈동자 본의 부모 좌표계 기준 Y 회전, 상하는 부모 좌표계 기준 X 회전으로 처리한다. 현재 에디터와 같은 상하 방향을 내려면 `eyeGazeY * -20deg`를 X축에 적용한다.

### 눈동자 본 매핑

캐릭터 메타의 최상위 필드:

```json
{
  "expressionPoseBoneMapping": {
    "leftEye": "J_Adj_L_FaceEye",
    "rightEye": "J_Adj_R_FaceEye"
  }
}
```

본 탐색 순서:

```text
1. expressionPoseBoneMapping에 지정된 실제 본 이름
2. VRM humanoid leftEye / rightEye
3. 호환 fallback: J_Adj_L_FaceEye / J_Adj_R_FaceEye
4. 찾지 못하면 Eye Pose Control만 생략
```

본 이름을 코드에 하나로 고정하면 다른 캐릭터에서 깨질 수 있으므로 캐릭터 메타의 매핑을 우선한다.

### 프레임 적용 방식

Pose Control을 누적 회전시키면 프레임마다 각도가 계속 증가한다. 매 프레임 애니메이션 결과를 기준으로 다시 계산해 한 번만 적용해야 한다.

```text
VRMA pose
-> Motion Correction
-> lookAtCamera 결과
-> Expression Pose Controls(offset/override)
-> render
```

## 11. 정면시선: lookAtCamera

에디터의 `정면시선` 값은 슬롯 안이 아니라 `animations/animations.meta`에 저장된다.

```text
slot.animationFile
-> animations.meta.animations[animationFile]
-> lookAtCamera
```

```ts
const animationMeta = animationsMeta.animations?.[slot.animationFile];
applyLookAtCamera(vrm, camera, Boolean(animationMeta?.lookAtCamera));
```

- `true`: 재생 중 VRM 시선 target을 현재 런타임 카메라로 설정한다.
- `false` 또는 필드 없음: 카메라 target을 해제한다.
- 새 슬롯을 재생할 때마다 반드시 다시 평가한다.
- 이전 슬롯의 `true` 상태가 다음 슬롯에 남아서는 안 된다.
- VRM에 lookAt 기능이 없으면 이 항목만 생략한다.

세부 규칙은 `docs/LOOK_AT_CAMERA_RUNTIME_SPEC.md`를 따른다.

## 12. Motion Correction과 Props

슬롯의 `animationFile`은 캐릭터 메타의 애니메이션별 설정을 찾는 키이기도 하다.

```ts
const characterAnimation = characterMeta.animations?.[slot.animationFile];
```

여기서 다음 항목을 함께 적용한다.

- `corrections`: 애니메이션 결과 위에 적용할 본 보정값.
- `props`: 이 애니메이션에서 표시할 Prop ID 목록.

Prop은 캐릭터 메타 최상위 `props[]`에서 ID로 찾고 `props/{file}` GLB를 로드한다.

```json
{
  "animations": {
    "cheerBoard.vrma": {
      "props": ["prop-1787309873132-0"],
      "corrections": {}
    }
  },
  "props": [
    {
      "id": "prop-1787309873132-0",
      "file": "OBJ_cheerBoard.glb",
      "attachBone": "rightHand",
      "visible": true
    }
  ]
}
```

Prop 표시 여부는 `animations[animationFile].props` 포함 여부와 Prop의 `visible` 값으로만 결정한다. 에디터에서 어떤 Prop 카드가 선택되어 있었는지는 런타임 의미가 없고 메타에도 의존하면 안 된다.

새 슬롯으로 전환할 때 새 애니메이션에 포함되지 않은 이전 Prop은 숨기거나 제거한다.

## 13. 이펙트 트리거

```text
slot.effectId
-> effects.meta.effects[].id
-> effectStartTime에 playEffect(effectId)
```

`effectId`가 비어 있거나 찾을 수 없으면 이펙트만 생략하고 슬롯 재생은 계속한다.

`effectStartTime <= 0.001`이면 슬롯 시작과 동시에 이펙트를 시작한다. 그 외에는 VRMA의 현재 재생 시간이 해당 시각을 통과할 때 한 번 실행한다.

슬롯이 루프하면 매 루프마다 이펙트 트리거를 다시 활성화하고, 이전 루프의 같은 슬롯 이펙트 인스턴스는 정리한 뒤 처음부터 재생한다.

이펙트 자체의 particle slot, duration, burst, graph, texture, blending, render queue 등은 `docs/EFFECT_RUNTIME_SPEC.md`를 그대로 따른다.

## 14. loop와 종료

### `loop: false`

- VRMA를 한 번 재생한다.
- timeline 포인트와 이펙트를 한 번만 실행한다.
- 애니메이션이 끝나면 슬롯을 완료 상태로 바꾼다.
- 이펙트는 자체 duration/lifetime에 따라 남은 파티클을 마칠 수 있다.

### `loop: true`

- VRMA가 처음으로 돌아갈 때 timeline 적용 완료 상태를 초기화한다.
- `effectStartTime` 트리거를 다시 활성화한다.
- 루프마다 동일한 시퀀스를 반복한다.

### 강제 교체 또는 중단

새 슬롯 호출이나 명시적 정지 시 다음을 정리한다.

```text
이전 VRMA action/crossfade
expression timeline 상태
예약된 effect trigger
활성 슬롯 이펙트
이전 슬롯 전용 Props
lookAtCamera target
재생 토큰 또는 AbortController
```

표정을 중립으로 돌릴지는 제품 정책으로 정할 수 있지만, 이전 슬롯의 예약 이벤트가 새 슬롯에 들어오면 안 된다.

## 15. animations.meta의 추가 실행 정책

```json
{
  "fileName": "a3_1.vrma",
  "duration": 2.458,
  "loop": false,
  "isFirst": false,
  "mustWatchFull": false,
  "lookAtCamera": false
}
```

- `duration`: 타임라인 UI와 사전 검증용 길이. 실제 재생 시간은 로드된 clip duration을 우선한다.
- `isFirst`: 캐릭터 로드 직후 기본 동작 후보로 사용할 수 있다.
- `mustWatchFull`: 상위 대화/연출 시스템이 다른 슬롯으로 교체하기 전에 끝까지 재생할지 판단하는 정책값이다.
- `lookAtCamera`: 반드시 11장의 규칙대로 적용한다.
- `loop`: 직접 애니메이션을 재생할 때의 기본값이며 Emotion Linker 2에서는 `slot.loop`가 우선한다.

## 16. 오류 격리와 fallback

```text
슬롯 이름 없음/중복          -> 호출 실패, 명확한 로그
VRMA 없음                    -> 슬롯 재생 실패
animations.meta 항목 없음    -> VRMA는 재생, lookAtCamera=false
표정 프리셋 없음             -> 표정만 생략
timeline 표정 없음           -> 해당 포인트만 생략
effect 없음                  -> 이펙트만 생략
prop GLB 없음                -> 해당 Prop만 생략
본 없음                      -> 해당 correction/Pose Control만 생략
shape key 없음               -> 해당 parameter만 생략
```

권장 로그에는 슬롯 `title`, 슬롯 `id`, 참조 필드와 파일명을 함께 남긴다.

```text
[EmotionLinker2] Missing animation: title=좋았어!, file=a3_1.vrma
[EmotionLinker2] Missing effect: title=좋았어!, effectId=effect-...
[ExpressionPose] Missing eye bone: side=leftEye, configured=J_Adj_L_FaceEye
```

## 17. 최소 공개 API 예

```ts
interface CompanionMotionApi {
  listMotionSlots(): Array<{ id: string; title: string }>;
  hasMotionSlot(title: string): boolean;
  playMotionSlotByTitle(title: string, options?: {
    restart?: boolean;
    onComplete?: () => void;
  }): MotionSlotPlaybackHandle;
  stopMotionSlot(reason?: string): void;
  getActiveMotionSlot(): { id: string; title: string; time: number } | null;
}
```

같은 제목이 이미 재생 중일 때의 기본 권장은 처음부터 재시작하는 것이다. `restart: false`를 지원한다면 현재 재생을 유지할 수 있다.

## 18. 구현 완료 체크리스트

```text
[ ] 슬롯 title로 정확히 하나의 motion slot을 찾을 수 있다.
[ ] 배열 순서가 바뀌어도 title/id 참조가 유지된다.
[ ] 중복 title을 감지하고 오류 처리한다.
[ ] slot.loop가 animations.meta.loop보다 우선한다.
[ ] transitionSeconds로 동작과 시작 표정을 전환한다.
[ ] time=0 timeline 포인트가 기본 표정보다 우선한다.
[ ] 프레임 드롭 시에도 지나간 timeline 포인트가 한 번 적용된다.
[ ] 루프마다 timeline과 effect trigger가 재설정된다.
[ ] expressionPresetId를 이름보다 우선한다.
[ ] expressionRangeId 또는 expressionValue로 range 값을 적용한다.
[ ] shape key뿐 아니라 poseControls, blush, emotionImage도 적용한다.
[ ] headYaw, eyeGazeX, eyeGazeY의 offset/override를 처리한다.
[ ] expressionPoseBoneMapping을 우선해 눈동자 본을 찾는다.
[ ] animations.meta의 lookAtCamera를 슬롯 전환마다 적용/해제한다.
[ ] 캐릭터 메타의 Motion Correction을 적용한다.
[ ] 애니메이션의 Prop ON/OFF는 선택 상태와 무관하게 적용한다.
[ ] effectStartTime에 effects.meta의 이펙트를 시작한다.
[ ] 새 슬롯 호출 시 이전 예약 이벤트와 리소스를 정리한다.
[ ] 일부 리소스 누락이 전체 캐릭터 런타임을 중단시키지 않는다.
```

## 19. 필수 검증 시나리오

1. `좋았어!` 호출 시 `a3_1.vrma`, Joy 표정 timeline, 지정 이펙트가 각각 설정 시각에 재생되는지 확인한다.
2. `생각중`처럼 loop 슬롯이 반복될 때 표정 timeline과 이펙트가 매 루프 동일하게 재실행되는지 확인한다.
3. `응원판` 호출 시 카드 선택 상태와 관계없이 애니메이션에 연결된 GLB Prop이 표시되는지 확인한다.
4. `lookAtCamera: true` 슬롯 다음에 `false` 슬롯을 재생했을 때 정면시선이 확실히 해제되는지 확인한다.
5. Head/Eye Pose Control 값 `0`에서 변화가 없고, offset/override가 서로 다르게 동작하는지 확인한다.
6. `J_Adj_L_FaceEye`, `J_Adj_R_FaceEye` 매핑 캐릭터에서 눈동자 좌우/상하 축이 올바른지 확인한다.
7. 재생 중 다른 슬롯을 빠르게 호출해도 이전 슬롯의 표정 포인트나 이펙트가 뒤늦게 실행되지 않는지 확인한다.
8. 슬롯을 이름순으로 정렬해 저장한 뒤에도 동일한 title 호출 결과가 유지되는지 확인한다.
