# Look At Camera Runtime Spec

Updated: 2026-09-15

이 문서는 VRM Expression Editor의 `정면시선` 옵션을 프론트/익스텐션 런타임에서 재현하기 위한 기준이다.

## 1. 핵심 요약

에디터 UI의 `정면시선`은 메타에서는 `lookAtCamera`로 저장된다.

`lookAtCamera`는 Emotion Linker 2 슬롯 안에 직접 저장되지 않는다. Emotion Linker 2 슬롯의 `animationFile`을 통해 `animations/animations.meta`를 조회해서 사용해야 한다.

```text
emotion-linker2.meta motion slot
-> animationFile
-> animations/animations.meta.animations[animationFile]
-> lookAtCamera
```

## 2. 저장 위치

파일:

```text
animations/animations.meta
```

예:

```json
{
  "animations": {
    "a3_1.vrma": {
      "fileName": "a3_1.vrma",
      "description": "좋았어",
      "duration": 2.5,
      "loop": false,
      "isFirst": false,
      "mustWatchFull": false,
      "lookAtCamera": true
    }
  }
}
```

필드 의미:

- `lookAtCamera: true`: 해당 애니메이션 재생 중 캐릭터 시선을 카메라로 향하게 한다.
- `lookAtCamera: false`: 해당 애니메이션 재생 중 카메라 시선 고정을 사용하지 않는다.

필드가 없으면 `false`로 취급한다.

## 3. Emotion Linker 2에서 읽는 방법

Emotion Linker 2 슬롯 예:

```json
{
  "id": "motion-slot-...",
  "title": "좋았어!",
  "animationFile": "a3_1.vrma",
  "expressionPresetId": "emotion-4",
  "expressionPresetName": "Joy",
  "effectId": "effect-...",
  "effectStartTime": 0.6,
  "loop": false,
  "transitionSeconds": 0.2,
  "expressionTimeline": []
}
```

이 슬롯에는 `lookAtCamera`가 없다.

프론트는 `slot.animationFile`로 `animations.meta`를 조회해야 한다.

```js
const animationMeta = animationsMeta.animations?.[slot.animationFile];
const lookAtCamera = Boolean(animationMeta?.lookAtCamera);
```

그 다음 슬롯 재생 시 `lookAtCamera` 값을 적용한다.

## 4. 적용 규칙

VRM에 `lookAt` 기능이 있으면 카메라를 target으로 설정한다.

```js
function applyLookAtCamera(vrm, camera, enabled) {
  if (!vrm?.lookAt) return;

  if (enabled) {
    vrm.lookAt.target = camera;
    vrm.lookAt.autoUpdate = true;
    return;
  }

  vrm.lookAt.target = null;
  vrm.lookAt.reset?.();
}
```

Emotion Linker 2 슬롯 재생 시:

```js
function playMotionSlot(slot, context) {
  const { vrm, camera, animationsMeta } = context;
  const animationMeta = animationsMeta.animations?.[slot.animationFile];

  playVrma(slot.animationFile, { loop: slot.loop });
  applyExpressionPreset(slot.expressionPresetId);
  scheduleExpressionTimeline(slot.expressionTimeline);

  applyLookAtCamera(vrm, camera, Boolean(animationMeta?.lookAtCamera));

  if (slot.effectId) {
    scheduleAt(slot.effectStartTime, () => {
      playEffect(slot.effectId);
    });
  }
}
```

## 5. 해제 타이밍

`lookAtCamera`는 현재 재생 중인 애니메이션/모션 슬롯의 속성이다.

따라서 다음 애니메이션 또는 다음 motion slot으로 바뀔 때 반드시 새 `animationFile`의 `lookAtCamera` 값을 다시 적용해야 한다.

```text
새 slot.lookAtCamera true  -> camera target 설정
새 slot.lookAtCamera false -> camera target 해제
```

이전 슬롯에서 true였던 시선 고정이 다음 슬롯에 남으면 안 된다.

## 6. 단독 애니메이션 재생 시

Emotion Linker 2를 사용하지 않고 VRMA를 직접 재생할 때도 같은 규칙을 사용한다.

```js
function playAnimation(animationFile, context) {
  const { vrm, camera, animationsMeta } = context;
  const animationMeta = animationsMeta.animations?.[animationFile];

  playVrma(animationFile, { loop: animationMeta?.loop });
  applyLookAtCamera(vrm, camera, Boolean(animationMeta?.lookAtCamera));
}
```

## 7. 구현 주의사항

- `lookAtCamera`는 `emotion-linker2.meta`가 아니라 `animations.meta`에서 읽는다.
- `animationFile`은 확장자를 포함한 파일명 기준으로 매칭한다.
- VRM 모델에 `lookAt`이 없으면 무시한다.
- `lookAtCamera: false` 또는 필드 없음은 모두 시선 고정 해제로 처리한다.
- 슬롯/애니메이션 전환 때마다 다시 적용해야 한다.

