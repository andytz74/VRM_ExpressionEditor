# Effect Runtime Spec

Updated: 2026-09-13

이 문서는 VRM Expression Editor의 Effect Editor에서 만든 `effects/effects.meta`를 프론트/익스텐션 런타임에서 재현하기 위한 구현 기준이다.

현재 프론트 구현 대상은 `effects/effects.meta`의 이펙트 재생이다.

`emotionLinker/emotion-linker2.meta`에 추가된 이펙트 연결 필드는 아직 프론트에서 재현할 내용이 아니며, 이 문서에서는 참고사항으로만 다룬다.

## 1. 파일 위치

리소스 패키지에는 아래 파일과 폴더가 포함된다.

```text
effects/
  effects.meta

img/
  *.png
  *.svg
```

파티클 텍스처는 `img/` 폴더 기준 파일명으로 참조한다.

예:

```json
{
  "texture": {
    "image": "effPaper4.svg"
  }
}
```

런타임 해석:

```text
img/effPaper4.svg
```

## 2. effects.meta 최상위 구조

```json
{
  "version": 1,
  "type": "vrm-effects-meta",
  "effects": []
}
```

`effects`는 이펙트 슬롯 배열이다. 각 이펙트 슬롯은 하나 이상의 파티클 슬롯을 가진다.

## 3. Effect Slot

```json
{
  "id": "effect-...",
  "name": "WinCelebration",
  "attachBone": "world",
  "positionOffset": [0, 1, 0],
  "rotationOffset": [0, 0, 0],
  "scale": 1,
  "duration": 3,
  "enabled": true,
  "particles": []
}
```

필드 의미:

- `id`: 이펙트 식별자.
- `name`: 에디터 표시 이름.
- `attachBone`: 부착 대상. 현재 메타에서는 `world` 또는 VRM humanoid bone key를 사용한다.
- `positionOffset`: 이펙트 루트 위치 오프셋 `[x, y, z]`.
- `rotationOffset`: 이펙트 루트 회전 오프셋 degree `[x, y, z]`.
- `scale`: 이펙트 루트 스케일.
- `duration`: 이펙트 재생 기준 시간, 초 단위.
- `enabled`: 프리뷰/런타임 사용 여부.
- `particles`: 파티클 슬롯 배열.

루트 transform 적용 순서:

```text
attach target transform
-> positionOffset
-> rotationOffset
-> scale
-> particle local transform
```

## 4. Particle Slot

```json
{
  "id": "particle-...",
  "name": "Particle 1",
  "enabled": true,
  "positionOffset": [0, 0, 0],
  "rotationOffset": [0, 0, 0],
  "scale": 1,
  "loop": false,
  "count": [30, 50],
  "shape": "texture",
  "billboard": true,
  "burst": true,
  "colorSlots": ["#ffb914", "#ff1a1a"],
  "spread": 0.8,
  "emitterRadiusEnabled": true,
  "emitterRadius": 0.02,
  "speed": [5, 15],
  "drag": 3,
  "gravity": 0.7,
  "driftEnabled": true,
  "driftStrength": 0.2,
  "driftFallSpeedRef": 1,
  "driftFrequency": 0.5,
  "rotation": [0, 360],
  "alignToVelocity": false,
  "angularVelocity": [[0, 0], [0, 0], [-720, 720]],
  "angularVelocityEnabled": [false, false, true],
  "angularDrag": 0.7,
  "stopWhenSlow": false,
  "stopSpeedThreshold": 0.01,
  "size": [0.01, 0.05],
  "lifetime": [0.6, 3],
  "renderQueue": "afterModel",
  "blending": "normal",
  "seedMode": "fixed",
  "seed": 2,
  "emissionGraph": [],
  "sizeGraph": [],
  "opacityGraph": []
}
```

필드 의미:

- `enabled`: false이면 해당 파티클 슬롯은 재생하지 않는다.
- `positionOffset`, `rotationOffset`, `scale`: 이펙트 루트 아래의 파티클 로컬 transform.
- `loop`: true이면 `duration` 기준으로 반복 재생한다. false이면 처음부터 한 번만 재생한다.
- `count`: 생성량 범위 `[min, max]`. 생성 시 범위 안에서 랜덤값을 사용한다.
- `shape`: 파티클 형태.
- `billboard`: true이면 파티클 면이 카메라를 향한다.
- `burst`: true이면 emission graph 대신 한 번에 `count`만큼 생성한다.
- `colorSlots`: 생성 시 랜덤 선택되는 색 목록.
- `spread`: 발사 방향 퍼짐.
- `emitterRadiusEnabled`: 위치 퍼짐을 `spread`에서 분리할지 여부.
- `emitterRadius`: 위치 퍼짐 반경.
- `speed`: 초기 속도 범위.
- `drag`: 속도 감쇠.
- `gravity`: 글로벌 Y축 중력 계수. 양수는 아래 방향으로 적용한다.
- `driftEnabled`: 느린 낙하 시 좌우 흔들림 사용 여부.
- `rotation`: 생성 시 Z축 회전각 범위, degree.
- `alignToVelocity`: true이면 파티클 방향을 진행 방향에 맞춘다.
- `angularVelocity`: X/Y/Z 회전 속도 범위, degree/sec.
- `angularVelocityEnabled`: 각 축 회전 계산 여부.
- `angularDrag`: 회전 속도 감쇠.
- `stopWhenSlow`: true이면 속도가 threshold 이하일 때 제거한다.
- `size`: 생성 시 크기 범위.
- `lifetime`: 각 파티클 수명 범위, 초 단위.
- `renderQueue`: 모델보다 앞/뒤 렌더링.
- `blending`: 블렌딩 모드.
- `seedMode`, `seed`: 랜덤 시드 설정.

## 5. Shape

지원 shape:

```text
dot
softCircle
square
diamond
triangle
star
cross
ring
line
texture
```

`texture`를 사용하면 `texture` 설정을 함께 읽는다.

`dot`, `softCircle`, `texture`는 기본적으로 billboard로 쓰는 것을 권장한다.

## 6. Texture Particle

```json
{
  "shape": "texture",
  "texture": {
    "image": "effPaper4.svg",
    "sourceType": "svgMask",
    "colorMode": "particleColor",
    "atlas": {
      "columns": 2,
      "rows": 2,
      "aspectRatio": 1,
      "spriteMode": "random"
    }
  }
}
```

필드 의미:

- `image`: `img/` 기준 파일명.
- `sourceType`: `bitmap` 또는 `svgMask`.
- `colorMode`: `original` 또는 `particleColor`.
- `atlas.columns`: 가로 분할 수.
- `atlas.rows`: 세로 분할 수.
- `atlas.aspectRatio`: 표시 비율 보정값. 의미는 `height / width`.
- `atlas.spriteMode`: 현재는 `random`만 사용한다.

PNG 처리:

```text
sourceType = bitmap
colorMode = original 권장
이미지 원본 RGB와 alpha를 사용한다.
```

SVG 처리:

```text
sourceType = svgMask
colorMode = particleColor 권장
SVG alpha를 mask로 사용하고, RGB는 colorSlots에서 선택한 파티클 색을 사용한다.
```

Atlas 규칙:

```text
spriteCount = columns * rows
파티클 생성 시 spriteIndex를 랜덤 선택한다.
선택된 spriteIndex는 해당 파티클이 사라질 때까지 고정한다.
```

UV 분할:

```text
column = spriteIndex % columns
row = floor(spriteIndex / columns)

u0 = column / columns
u1 = (column + 1) / columns
v0 = 1 - (row + 1) / rows
v1 = 1 - row / rows
```

Aspect 적용:

`aspectRatio`는 파티클 전체 크기값을 바꾸기 위한 값이 아니라, 텍스처 표시 비율을 보정하기 위한 값이다.

면적감은 유지하고 가로/세로 비율만 바꾼다.

```text
baseHalfSize = size * sizeGraphValue * 0.5
aspectScale = sqrt(aspectRatio)

halfWidth = baseHalfSize / aspectScale
halfHeight = baseHalfSize * aspectScale
```

예:

```text
aspectRatio 1    -> 정방형
aspectRatio 0.33 -> 가로가 긴 형태
aspectRatio 3    -> 세로가 긴 형태
```

## 7. Random Rules

랜덤이 적용되는 항목:

- `count`
- `colorSlots`
- `speed`
- `size`
- `lifetime`
- `rotation`
- `angularVelocity`
- texture atlas sprite index
- emission position/direction
- drift phase/direction

시드:

```text
seedMode = fixed -> seed 사용
seedMode = time  -> HHMMSS 형식 숫자를 seed로 사용
```

예:

```text
13:02:38 -> 130238
```

런타임에서 에디터와 완전히 같은 난수열이 필요하면 같은 LCG 계열의 deterministic random을 사용한다. 정확한 일치를 강제하지 않고 시각적 유사성만 필요하면 동일 seed 기반 난수면 충분하다.

## 8. Emission

`burst: true`:

```text
재생 시작 시 count 범위에서 결정된 개수만큼 한 번에 생성한다.
emissionGraph는 사용하지 않는다.
```

`burst: false`:

```text
duration 진행률 t = elapsed / duration
emissionGraph(t)를 초당 생성 개수로 평가한다.
```

`loop: false`이면 `duration`이 지난 뒤 새 파티클을 생성하지 않는다. 이미 생성된 파티클은 각자의 `lifetime`이 끝날 때까지 남아 있다.

`loop: true`이면 `duration` 기준으로 emission 진행률이 반복된다.

## 9. Graph Rules

사용 그래프:

```text
emissionGraph: 시간별 방출량
sizeGraph: 파티클 수명 비율에 따른 크기 배율
opacityGraph: 파티클 수명 비율에 따른 투명도
```

포인트 형식:

```json
{
  "time": 0,
  "value": 1,
  "curve": "linear"
}
```

지원 curve:

```text
linear
easeOut
easeIn
easeInOut
step
```

평가 규칙:

```text
time은 0~1 비율값이다.
각 구간의 curve는 시작점의 curve 값을 따른다.
linear: t
easeIn: t^3
easeOut: 1 - (1 - t)^3
easeInOut: t^2 * (3 - 2t)
step: 다음 점에 도달하기 전까지 시작값 유지
```

적용 기준:

```text
emissionGraph time = effect elapsed / duration
sizeGraph time = particle age / particle lifetime
opacityGraph time = particle age / particle lifetime
```

## 10. Movement

초기 위치:

```text
emitterRadiusEnabled true:
  emitterRadius 안의 원형 영역에서 랜덤 위치

emitterRadiusEnabled false:
  spread 기반 작은 반경에서 랜덤 위치
```

초기 속도:

```text
speed는 min~max에서 랜덤 결정한다.
spread는 발사 방향의 퍼짐에 사용한다.
```

중력:

```text
글로벌 Y축 아래 방향으로 적용한다.
파티클 로컬 회전과 무관하게 월드 중력으로 해석한다.
```

Drag:

```text
velocity *= exp(-drag * deltaTime)
angularVelocity *= exp(-angularDrag * deltaTime)
```

Drift:

느리게 떨어지는 파티클에만 좌우 흔들림을 더한다.

```text
fallSpeed = abs(velocity.y)
slowFactor = max(0, 1 - fallSpeed / driftFallSpeedRef)
driftAmount = driftStrength * slowFactor * wave * deltaTime
```

`wave`는 단순 삼각파 또는 유사한 저비용 주기 함수를 사용하면 된다.

## 11. Render Queue

```text
renderQueue = afterModel  -> 모델 렌더 후 파티클 렌더
renderQueue = beforeModel -> 모델 렌더 전 파티클 렌더
```

`beforeModel`은 깊이값에 따라 모델 앞뒤가 갈리는 방식이 아니라, 모델보다 먼저 그려지는 레이어 성격으로 취급한다.

## 12. Blending

```text
normal   -> 일반 알파 블렌딩
add      -> additive blending
multiply -> multiply blending
```

블렌딩은 Effect Slot 단위가 아니라 Particle Slot 단위로 적용한다.

## 13. Emotion Linker 2 연동 참고사항

현재 프론트/익스텐션의 필수 구현 대상은 `effects/effects.meta`의 이펙트 단독 재현이다.

다만 `emotionLinker/emotion-linker2.meta`에는 애니메이션, 표정, 이펙트를 하나의 모션 슬롯으로 묶어 재생할 수 있는 정보가 이미 준비되어 있다. 프론트에서 Emotion Linker 2 재생 기능을 구현하면, 에디터에서 설정한 대로 아래 세 가지를 함께 사용할 수 있다.

```text
VRMA animation
+ expression preset / expression timeline
+ effect trigger
```

### Motion Slot 구조

Emotion Linker 2의 슬롯은 대략 아래 구조를 가진다.

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

이 중 이펙트 연동 필드는 아래 두 개다.

```json
{
  "effectId": "effect-...",
  "effectStartTime": 0.6
}
```

- `effectId`: `effects/effects.meta`의 effect id.
- `effectStartTime`: 모션 슬롯 재생 중 이펙트를 시작할 시간, 초 단위.

`effectId`가 빈 문자열이면 이 슬롯에서는 이펙트를 재생하지 않는다.

### 프론트 구현 흐름

Emotion Linker 2를 프론트에서 구현할 경우, 슬롯 재생은 아래 순서로 처리한다.

```text
1. emotion-linker2.meta 로드
2. 선택된 motion slot을 찾는다.
3. animationFile로 animations/ 안의 VRMA를 재생한다.
4. animationFile로 animations.meta의 animation entry를 조회하고 lookAtCamera를 적용한다.
5. expressionPresetId 또는 expressionPresetName으로 캐릭터 표정 프리셋을 적용한다.
6. expressionTimeline이 있으면 시간에 따라 표정을 갱신한다.
7. effectId가 있으면 effects.meta에서 해당 effect를 찾는다.
8. slot 재생 시간이 effectStartTime에 도달하면 해당 effect를 재생한다.
```

의사코드:

```js
function playMotionSlot(slot, context) {
  const animationMeta = context.animationsMeta.animations?.[slot.animationFile];

  playVrma(slot.animationFile, { loop: slot.loop });
  applyLookAtCamera(context.vrm, context.camera, Boolean(animationMeta?.lookAtCamera));
  applyExpressionPreset(slot.expressionPresetId);

  scheduleExpressionTimeline(slot.expressionTimeline);

  if (slot.effectId) {
    scheduleAt(slot.effectStartTime, () => {
      playEffect(slot.effectId);
    });
  }
}
```

`playEffect(effectId)`는 이 문서 앞부분의 `effects.meta` 재현 규칙을 그대로 사용한다.

`lookAtCamera`는 에디터 UI의 `정면시선` 옵션이다. 이 값은 `emotion-linker2.meta` 슬롯 안에 직접 저장되지 않고, `animations/animations.meta`의 해당 `animationFile` 항목에서 읽는다. 자세한 규칙은 `docs/LOOK_AT_CAMERA_RUNTIME_SPEC.md`를 따른다.

### 시간 기준

`effectStartTime`은 슬롯의 VRMA 재생 시작 시점을 기준으로 한 초 단위 값이다.

```text
motion slot start time = 0
effect trigger time = effectStartTime
```

예:

```json
{
  "animationFile": "a3_1.vrma",
  "effectId": "effect-1789020298667-1",
  "effectStartTime": 0.6
}
```

이 경우 `a3_1.vrma` 재생을 시작하고 0.6초 뒤 `effect-1789020298667-1`을 재생한다.

### 현재 구현 범위 구분

이 문서 기준의 최소 구현:

```text
effects.meta를 읽고 playEffect(effectId)를 구현한다.
```

확장 구현:

```text
emotion-linker2.meta를 읽고 motion slot 재생 중 playEffect(slot.effectId)를 예약 호출한다.
```

따라서 Emotion Linker 2 연동은 현재 필수는 아니지만, 프론트에서 구현하면 애니메이션 + 표정 + 이펙트를 에디터 설정 그대로 호출할 수 있는 상태다.

## 14. 기본값

메타에 필드가 없을 때의 권장 기본값:

```json
{
  "enabled": true,
  "positionOffset": [0, 0, 0],
  "rotationOffset": [0, 0, 0],
  "scale": 1,
  "loop": true,
  "count": [80, 80],
  "shape": "dot",
  "billboard": false,
  "burst": false,
  "colorSlots": ["#ffd166"],
  "spread": 1.2,
  "emitterRadiusEnabled": false,
  "speed": [1.4, 1.4],
  "drag": 0,
  "gravity": 0,
  "driftEnabled": false,
  "rotation": [0, 360],
  "alignToVelocity": false,
  "angularVelocity": [[0, 0], [0, 0], [0, 0]],
  "angularVelocityEnabled": [false, false, false],
  "angularDrag": 0,
  "stopWhenSlow": false,
  "stopSpeedThreshold": 0.01,
  "size": [0.06, 0.06],
  "lifetime": [0.6, 1.2],
  "renderQueue": "afterModel",
  "blending": "normal",
  "seedMode": "time",
  "seed": 12345
}
```
