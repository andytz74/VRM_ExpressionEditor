# VRM Companion Resource Reference Rules

Updated: 2026-08-27

이 문서는 VRM Expression Editor에서 제작한 캐릭터 리소스 묶음을 프론트/익스텐션 런타임에 전달할 때의 폴더 구조와 참조 규칙을 정의한다.

## 1. 전달 단위

프론트/익스텐션에는 아래 폴더와 파일을 하나의 리소스 패키지로 전달한다.

```text
models/
  CharacterName.vrm
  CharacterName.vrm.meta

animations/
  animations.meta
  *.vrma

emotionLinker/
  emotion-linker.meta
  emotion-linker2.meta

img/
  *.png
  *.svg

props/
  *.glb
```

현재 프로젝트에서 모델 파일을 별도 `models/` 폴더가 아니라 다른 위치에 두고 관리하더라도, 런타임 전달 시에는 위 구조처럼 모델과 메타파일을 함께 묶는 것을 권장한다.

## 2. 파일 역할

### VRM 파일

```text
models/CharacterName.vrm
```

캐릭터 본체 모델이다.

런타임은 VRM 파일만 단독으로 로드하면 안 된다. 반드시 같은 캐릭터의 `.vrm.meta`를 함께 로드해야 한다.

### 캐릭터 메타파일

```text
models/CharacterName.vrm.meta
```

캐릭터별 설정 파일이다.

주요 포함 정보:

- VRM 버전 구분값
- Motion Correction 보정값
- Expression Preset
- Blush 설정
- Emotion Image 설정
- Extra Bone Follow Setting
- Material outline color / width
- Props 설정
- Emotion Map 설정

Emotion Linker 관련 조합 정보는 캐릭터 메타에 넣지 않는다. 별도의 `emotionLinker/` 메타파일을 사용한다.

### 애니메이션 폴더

```text
animations/
```

VRMA 애니메이션 파일을 저장한다.

### 애니메이션 공통 메타파일

```text
animations/animations.meta
```

애니메이션 파일 목록과 공통 속성을 저장한다.

주요 포함 정보:

- 파일명
- 설명
- duration
- loop 여부
- isFirst 여부
- mustWatchFull 여부
- lookAtCamera 여부

### 이미지 폴더

```text
img/
```

표정 보조 이미지를 저장한다.

포함 대상:

- 홍조 이미지
- 감정 이미지
- PNG 이미지
- SVG 이미지

### 프랍 폴더

```text
props/
```

캐릭터에 부착할 GLB 오브젝트를 저장한다.

예:

- 응원봉
- 응원판
- 손에 들 소품

## 3. 기본 참조 규칙

모든 메타파일의 리소스 참조값은 절대경로가 아니라 파일명 기준으로 저장한다.

프론트/익스텐션 런타임은 아래 기준으로 파일을 찾아야 한다.

```text
animationFile  -> animations/ 기준 파일명
image          -> img/ 기준 파일명
prop file      -> props/ 기준 파일명
```

파일명 비교는 확장자를 포함한 완전한 파일명 기준으로 한다.

예:

```json
{
  "animationFile": "a0_1.vrma",
  "image": "imgSurp.svg",
  "file": "OBJ_cheerBoard.glb"
}
```

런타임 해석:

```text
animations/a0_1.vrma
img/imgSurp.svg
props/OBJ_cheerBoard.glb
```

## 4. 애니메이션 참조 규칙

애니메이션 식별자는 별도 ID가 아니라 VRMA 파일명이다.

캐릭터 메타파일과 `animations.meta`에서 애니메이션을 참조할 때는 같은 파일명을 사용한다.

예:

```json
{
  "animationFile": "a0_1.vrma"
}
```

이 값은 다음 파일을 가리킨다.

```text
animations/a0_1.vrma
```

`animations.meta`의 `animations` 객체도 파일명을 key로 사용한다.

```json
{
  "animations": {
    "a0_1.vrma": {
      "fileName": "a0_1.vrma",
      "description": "대기 - 기본",
      "loop": true,
      "isFirst": true
    }
  }
}
```

프론트/익스텐션은 `isFirst: true`인 애니메이션을 캐릭터 로드 후 기본 애니메이션 후보로 사용할 수 있다.

여러 개가 `isFirst: true`이면 첫 번째로 발견한 항목만 사용하거나, 리소스 검수 오류로 처리한다.

## 5. 이미지 참조 규칙

캐릭터 메타에서 이미지 파일명은 `img/` 폴더 기준이다.

### Blush

캐릭터 공통 홍조 이미지:

```json
{
  "blush": {
    "image": "redFace.png",
    "y": 0.04,
    "z": 0.08,
    "scale": 0.28
  }
}
```

런타임 해석:

```text
img/redFace.png
```

표정별 홍조 사용 여부와 투명도:

```json
{
  "expressionPresets": [
    {
      "id": "emotion-0",
      "name": "Surprise",
      "blush": {
        "enabled": true,
        "opacity": 0.54
      }
    }
  ]
}
```

`blush.enabled`가 `false`이거나 홍조 정보가 없으면 opacity는 `0`으로 취급한다.

### Emotion Image

표정별 감정 이미지는 각 expression preset 또는 range slot 안의 `emotionImage.image` 값으로 참조한다.

예:

```json
{
  "emotionImage": {
    "image": "imgSurp.svg",
    "position": [0, 1.5, 0],
    "rotation": 0,
    "scale": 0.4,
    "opacity": 1
  }
}
```

런타임 해석:

```text
img/imgSurp.svg
```

Emotion Image는 표정마다 독립 설정이다. Blush처럼 캐릭터 공통 설정으로 공유하지 않는다.

Emotion Image는 단순 표시뿐 아니라 간단한 1초 기준 애니메이션 그래프를 가질 수 있다.

확장 필드:

```json
{
  "emotionImage": {
    "image": "imgSurp.svg",
    "x": 0,
    "y": 1.5,
    "z": 0,
    "rotation": 0,
    "scale": 0.4,
    "opacity": 1,
    "pivotX": 0.5,
    "pivotY": 0.5,
    "animationDuration": 1,
    "loop": false,
    "scaleGraph": [
      { "time": 0, "value": 1, "curve": "linear" },
      { "time": 1, "value": 1, "curve": "linear" }
    ],
    "opacityGraph": [
      { "time": 0, "value": 1, "curve": "linear" },
      { "time": 1, "value": 1, "curve": "linear" }
    ],
    "headRotationAxes": {
      "x": false,
      "y": false,
      "z": false
    },
    "headRotationGraph": {
      "x": [
        { "time": 0, "value": 0, "curve": "linear" },
        { "time": 1, "value": 0, "curve": "linear" }
      ],
      "y": [
        { "time": 0, "value": 0, "curve": "linear" },
        { "time": 1, "value": 0, "curve": "linear" }
      ],
      "z": [
        { "time": 0, "value": 0, "curve": "linear" },
        { "time": 1, "value": 0, "curve": "linear" }
      ]
    }
  }
}
```

필드 의미:

- `x`, `y`, `z`: 감정 이미지 plane의 위치.
- `rotation`: 카메라를 바라보는 billboard plane의 화면 기준 회전각, degree 기준.
- `scale`: 기본 스케일.
- `opacity`: 기본 투명도.
- `pivotX`, `pivotY`: 스케일 피벗. 이미지 UV 기준 `0~1` 값이다.
- `animationDuration`: 그래프를 재생하는 시간, 초 단위.
- `loop`: true면 그래프 애니메이션을 반복한다.
- `scaleGraph`: 시간에 따른 scale 배율 그래프. `value`는 기본 scale에 곱해진다.
- `opacityGraph`: 시간에 따른 opacity 배율 그래프. `value`는 기본 opacity에 곱해진다.
- `headRotationAxes`: 감정 이미지 재생 중 head bone에 보조 회전을 적용할 축 선택값.
- `headRotationGraph`: head bone local rotation offset 그래프. `value`는 degree 기준이며 권장 범위는 `-10~10`이다.

`curve` 값은 아래 문자열 중 하나를 사용한다.

```text
linear
easeOut
easeIn
easeInOut
step
```

표정에 감정 이미지가 없으면 런타임은 해당 감정 이미지 opacity를 `0`으로 취급해야 한다. 이전 표정에서 표시하던 감정 이미지가 다음 표정에 남아 있으면 안 된다.

## 6. Props 참조 규칙

캐릭터 메타의 props 항목은 `props/` 폴더 기준 GLB 파일명을 참조한다.

예:

```json
{
  "props": [
    {
      "id": "prop-...",
      "name": "OBJ_cheerBoard",
      "file": "OBJ_cheerBoard.glb",
      "attachBone": "rightHand",
      "followRotation": false,
      "positionOffset": [0, 0, 0],
      "rotationOffset": [0, 0, 0],
      "scale": 0.18,
      "visible": false
    }
  ]
}
```

런타임 해석:

```text
props/OBJ_cheerBoard.glb
```

필드 의미:

- `id`: 프랍 내부 식별자
- `name`: 표시용 이름
- `file`: `props/` 기준 GLB 파일명
- `attachBone`: 프랍을 따라가게 할 VRM humanoid bone key
- `followRotation`: true면 부모 본의 회전까지 따른다. false면 위치만 따라가고 회전은 월드 기준 오프셋처럼 사용한다.
- `positionOffset`: 위치 오프셋
- `rotationOffset`: 회전 오프셋, degree 기준
- `scale`: 프랍 스케일
- `visible`: 기본 표시 여부

프랍 파일 자체는 캐릭터 메타 안에 들어가지 않는다. 메타에는 참조값과 배치값만 들어간다.

애니메이션별로 사용할 prop은 각 animation entry의 `props` 배열에 prop `id`를 기록해서 연결한다.

```json
{
  "animations": {
    "cheerBoard.vrma": {
      "props": ["prop-..."]
    }
  }
}
```

런타임은 현재 재생 중인 애니메이션 entry의 `props` 배열에 포함된 prop만 표시한다.
포함되지 않은 prop은 숨기는 것을 기본 규칙으로 한다.

## 7. Expression Preset 참조 규칙

표정 프리셋은 캐릭터 메타의 `expressionPresets` 배열에 저장된다.

런타임에서 표정을 호출할 때는 `id`를 우선 식별자로 사용한다.

```json
{
  "id": "emotion-0",
  "name": "Neutral0",
  "parameters": {
    "BROW_Up": 0.2,
    "Fcl_MTH_A": 0.5
  }
}
```

적용 규칙:

- `parameters`의 key는 VRM에서 감지한 shape key 또는 expression parameter 이름이다.
- 런타임 VRM에 존재하지 않는 parameter는 무시한다.
- `name`은 UI 표시용 또는 fallback 식별값으로만 사용한다.
- `id`가 있으면 `id`를 우선 사용한다.

구간이 있는 표정은 `rangeSlots`를 사용한다.

```json
{
  "rangeSlots": [
    {
      "id": "range-...",
      "threshold": 0.5,
      "parameters": {},
      "blushOpacity": 0.5,
      "emotionImage": {}
    }
  ]
}
```

런타임은 표정 강도값이 들어오면 main preset과 range slot 사이를 보간해서 최종 parameter 값을 만든다.

구간별로 홍조와 감정 이미지도 별도 값을 가질 수 있다.

- `blushOpacity`: 해당 구간에서 사용할 홍조 투명도.
- `emotionImage`: 해당 구간에서 사용할 감정 이미지 설정.

구간이 지정된 표정을 호출할 때는 `expressionRangeId`를 우선 사용한다. `expressionRangeId`가 없으면 `expressionValue`를 기준으로 보간한다.

## 8. Emotion Linker 참조 규칙

Emotion Linker 계열의 정보는 캐릭터 메타와 분리해서 저장한다.

```text
emotionLinker/
  emotion-linker.meta
  emotion-linker2.meta
```

이 파일들은 표정의 실제 파라미터 값을 저장하지 않는다. 항상 캐릭터 메타의 `expressionPresets[].id`를 참조한다.

### emotion-linker.meta

기존 Emotion Linker의 애니메이션별 표정 연결과 타임라인을 저장한다.

예:

```json
{
  "schemaVersion": 1,
  "type": "vrm-emotion-linker-meta",
  "animations": {
    "a0_1.vrma": {
      "expressionPresetId": "emotion-0",
      "expressionPresetName": "Neutral0",
      "expressionTimeline": []
    }
  }
}
```

### emotion-linker2.meta

Emotion Linker 2의 motion slot을 저장한다.

예:

```json
{
  "schemaVersion": 1,
  "type": "vrm-emotion-linker2-meta",
  "motionSlots": [
    {
      "id": "motion-slot-...",
      "title": "A0_1 대기",
      "animationFile": "a0_1.vrma",
      "expressionPresetId": "emotion-0",
      "expressionPresetName": "Neutral0",
      "loop": true,
      "transitionSeconds": 0.2,
      "expressionTimeline": []
    }
  ]
}
```

참조 규칙:

- `animationFile`은 `animations/` 기준 VRMA 파일명이다.
- `expressionPresetId`는 같은 캐릭터 메타의 `expressionPresets[].id`를 참조한다.
- `transitionSeconds`는 이 motion slot을 시작할 때 애니메이션과 표정 전환에 사용하는 시간이다.
- `expressionTimeline`은 애니메이션 진행 시간별 표정 전환 정보다.
- 캐릭터가 바뀌어도 같은 `expressionPresetId`가 유지되면 같은 Emotion Linker 메타를 재사용할 수 있다.

`expressionTimeline` 안의 표정도 `expressionPresetId`를 우선 사용한다.

`expressionTimeline` 예:

```json
{
  "expressionTimeline": [
    {
      "id": "timeline-...",
      "time": 1.2,
      "expressionPresetId": "emotion-0",
      "expressionPresetName": "Neutral0",
      "expressionRangeId": "range-...",
      "expressionValue": 0.5,
      "transitionSeconds": 0.2
    }
  ]
}
```

필드 의미:

- `time`: 애니메이션 시작 후 표정 전환이 발생하는 시간, 초 단위.
- `expressionPresetId`: 적용할 표정 프리셋 id.
- `expressionRangeId`: 구간 프리셋을 직접 지정할 때 사용한다.
- `expressionValue`: 구간 id가 없을 때 표정 강도값으로 사용한다.
- `transitionSeconds`: 이 지점에 도달했을 때 표정이 전환되는 시간이다.

`motionSlots`는 Emotion Linker 2와 Transition Viewer에서 같이 사용할 수 있는 동작 프리셋이다. 프론트/익스텐션이 특정 동작을 호출할 때는 가능하면 `animationFile`과 `expressionPresetId`를 따로 조합하기보다 `motionSlots[].id` 또는 `motionSlots[].title`을 기준으로 호출하는 구조가 관리에 유리하다.

## 9. Material Outline 참조 규칙

Outline 설정은 외부 파일을 참조하지 않는다.

캐릭터 메타의 material 이름을 key로 사용한다.

```json
{
  "materialSettings": {
    "outline": {
      "materials": {
        "N00_000_00_Face_00_SKIN": {
          "color": "#2a1a1a",
          "width": 0.5
        }
      }
    }
  }
}
```

런타임은 VRM 로드 후 material 이름이 일치하는 항목에만 color와 width를 적용한다.

일치하는 material이 없으면 해당 항목은 무시한다.

## 10. Extra Bone Follow Setting 참조 규칙

Extra Bone Follow Setting은 외부 파일을 참조하지 않는다.

캐릭터 메타 안에서 VRM 내부 본 이름과 humanoid bone key를 참조한다.

```json
{
  "extraBoneFollowSettings": [
    {
      "targetBone": "J_Sec_L_Sleeve",
      "sourceBone": "leftUpperArm",
      "tailDirectionBone": "leftLowerArm",
      "swingFactor": 1,
      "twistFactor": 0
    }
  ]
}
```

참조 규칙:

- `targetBone`: VRM scene 안의 실제 node 이름
- `sourceBone`: VRM humanoid bone key
- `tailDirectionBone`: VRM humanoid bone key

런타임에서 본을 찾지 못하면 해당 setting만 무시한다.

## 11. Emotion Map 참조 규칙

Emotion Map은 캐릭터 메타의 `emotionMap` 필드에 저장된다.

Emotion Map은 감정 엔진이 만든 좌표값을 표정 프리셋으로 변환하기 위한 매핑 테이블이다.

현재 좌표 범위:

```text
x: -1 ~ 1
y: 0 ~ 1
```

현재 포인트 배치:

```text
x: -1, -0.5, 0, 0.5, 1
y: 0, 0.33, 0.66, 1
```

포인트 번호는 좌상단부터 우하단까지 row-major 순서로 매긴다.

```text
1   2   3   4   5
6   7   8   9   10
11  12  13  14  15
16  17  18  19  20
```

예:

```json
{
  "emotionMap": {
    "schemaVersion": 1,
    "type": "vrm-emotion-map",
    "range": {
      "x": [-1, 1],
      "y": [0, 1]
    },
    "points": [
      {
        "index": 18,
        "label": "무표정 / 기본",
        "emotionName": "Neutral",
        "x": 0,
        "y": 0,
        "expressionPresetId": "emotion-0",
        "expressionPresetName": "Neutral0",
        "expressionRangeId": "",
        "expressionRangeName": "",
        "expressionValue": 1
      }
    ]
  }
}
```

필드 의미:

- `index`: 1~20 포인트 번호.
- `label`: 툴 내부 기준 라벨. 런타임 필수값은 아니다.
- `emotionName`: 사용자가 직접 입력한 감정 이름. 프론트 UI 표시나 로그에 사용할 수 있다.
- `x`, `y`: 감정맵 좌표.
- `expressionPresetId`: 해당 포인트에 연결된 표정 프리셋 id.
- `expressionPresetName`: fallback 또는 표시용 표정 이름.
- `expressionRangeId`: 해당 표정의 특정 구간을 직접 연결할 때 사용한다.
- `expressionValue`: 구간 id가 없을 때 사용할 표정 강도값이다.

런타임 적용 규칙:

1. 감정 엔진에서 좌표 `x`, `y`를 받는다.
2. 좌표 주변의 Emotion Map 포인트를 찾는다.
3. 일반적으로 주변 4개 포인트의 가중치를 bilinear 방식으로 계산한다.
4. 바인딩된 포인트만 사용한다.
5. 바인딩된 포인트의 가중치를 다시 정규화한다.
6. 각 포인트의 `expressionPresetId`와 `expressionRangeId` 또는 `expressionValue`로 표정 파라미터를 계산한다.
7. 계산된 표정 파라미터를 가중 평균해서 최종 표정을 만든다.

정확히 포인트 위에 있는 좌표라면 해당 포인트 하나만 적용해도 된다.

Emotion Map에서 Blush 처리:

- 각 포인트의 표정 프리셋에서 홍조 opacity를 얻는다.
- 주변 포인트 가중치로 홍조 opacity를 보간한다.
- 홍조가 없는 표정은 opacity `0`으로 취급한다.

Emotion Map에서 Emotion Image 처리:

- Emotion Image는 이미지 파일 자체가 표정마다 다를 수 있으므로 여러 이미지를 동시에 단순 보간하지 않는다.
- 현재 권장 구현은 가중치가 가장 큰 포인트의 Emotion Image를 대표 이미지로 선택하는 방식이다.
- 같은 이미지가 여러 포인트에 걸려 있으면 해당 포인트들의 가중치를 합산해서 opacity multiplier로 사용할 수 있다.
- Emotion Image가 없는 표정은 opacity `0`으로 취급하고, 이전 이미지가 남지 않게 숨긴다.

## 12. 런타임 로딩 순서

권장 로딩 순서:

```text
1. VRM 파일 로드
2. 같은 캐릭터의 .vrm.meta 로드
3. animations/animations.meta 로드
4. emotionLinker/emotion-linker.meta 로드
5. emotionLinker/emotion-linker2.meta 로드
6. .vrm.meta의 참조값을 기준으로 필요한 img 리소스 로드
7. .vrm.meta의 props 항목을 기준으로 필요한 props GLB 로드
8. animations.meta 또는 emotion-linker2.meta의 motionSlots를 기준으로 필요한 VRMA 로드
9. VRM에 material outline 설정 적용
10. Extra Bone Follow / Motion Correction / Props / Overlay 초기화
11. Emotion Map 초기화
12. isFirst 애니메이션 또는 지정된 motion slot 재생
```

## 13. 누락 파일 처리 규칙

런타임은 리소스 누락이 있어도 전체 캐릭터 로딩을 중단하지 않는 것을 권장한다.

권장 처리:

```text
VRM 없음                 -> 캐릭터 로드 실패
.vrm.meta 없음           -> 기본값으로 로드 가능하나 기능 제한 표시
animations.meta 없음     -> 애니메이션 설명/loop/isFirst 정보 없이 파일명 기준 처리
VRMA 파일 없음           -> 해당 애니메이션만 비활성
img 파일 없음            -> 해당 이미지 overlay만 비활성
props GLB 파일 없음      -> 해당 prop만 비활성
material 없음            -> 해당 outline 설정만 무시
bone 없음                -> 해당 correction/follow/prop attach만 무시
parameter 없음           -> 해당 expression parameter만 무시
emotionMap point 없음    -> 해당 포인트만 미바인딩으로 취급
emotion-linker meta 없음 -> 동작-표정 연결 프리셋 없이 기본 애니메이션만 사용
```

프론트 로그에는 어떤 참조가 실패했는지 파일명 또는 필드명을 남긴다.

예:

```text
Missing image: img/imgSurp.svg
Missing prop: props/OBJ_cheerBoard.glb
Missing animation: animations/a0_1.vrma
Missing expression parameter: Fcl_MTH_A
Missing bone: J_Sec_L_Sleeve
Missing emotion map preset: emotion-0
```

## 14. 적용 우선순위

프레임 단위 적용 순서는 아래를 권장한다.

```text
1. VRMA animation update
2. Motion Correction
3. Extra Bone Follow Setting
4. Props transform update
5. Expression Preset / Emotion Link Timeline / Emotion Map
6. Blink / Lip sync 등 임시 override
7. Blush / Emotion Image overlay update
8. Render
```

표정 관련 override 우선순위는 프로젝트 정책에 맞춰야 한다.

권장:

```text
기본 표정 프리셋
-> expressionTimeline 표정 전환
-> lip sync preview/runtime override
-> 자동 blink, 단 isDisableBlink이면 제외
```

## 15. 전달 체크리스트

프론트/익스텐션에 전달하기 전에 아래를 확인한다.

```text
[ ] VRM 파일과 .vrm.meta가 같은 캐릭터 기준으로 짝이 맞는다.
[ ] animations.meta에 등록된 fileName이 animations 폴더의 실제 파일명과 일치한다.
[ ] 캐릭터 메타의 animationFile 값이 animations 폴더의 실제 파일명과 일치한다.
[ ] 캐릭터 메타의 image 값이 img 폴더의 실제 파일명과 일치한다.
[ ] 캐릭터 메타의 props file 값이 props 폴더의 실제 파일명과 일치한다.
[ ] expressionPresetId가 실제 expressionPresets 안의 id와 일치한다.
[ ] emotionMap points의 expressionPresetId가 실제 expressionPresets 안의 id와 일치한다.
[ ] emotionMap points의 expressionRangeId가 해당 expression preset의 rangeSlots 안에 존재한다.
[ ] outline material 이름이 현재 VRM material 이름과 일치한다.
[ ] extraBoneFollowSettings의 targetBone/sourceBone/tailDirectionBone을 런타임에서 찾을 수 있다.
```
