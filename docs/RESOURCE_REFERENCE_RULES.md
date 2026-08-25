# VRM Companion Resource Reference Rules

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
- Emotion Linker 2 motion slot 설정

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
      "parameters": {}
    }
  ]
}
```

런타임은 표정 강도값이 들어오면 main preset과 range slot 사이를 보간해서 최종 parameter 값을 만든다.

## 8. Emotion Linker 2 참조 규칙

Emotion Linker 2의 motion slot은 캐릭터 메타의 `motionSlots`에 저장된다.

예:

```json
{
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

`expressionTimeline` 안의 표정도 `expressionPresetId`를 우선 사용한다.

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

## 11. 런타임 로딩 순서

권장 로딩 순서:

```text
1. VRM 파일 로드
2. 같은 캐릭터의 .vrm.meta 로드
3. animations/animations.meta 로드
4. .vrm.meta의 참조값을 기준으로 필요한 img 리소스 로드
5. .vrm.meta의 props 항목을 기준으로 필요한 props GLB 로드
6. animations.meta 또는 motionSlots를 기준으로 필요한 VRMA 로드
7. VRM에 material outline 설정 적용
8. Extra Bone Follow / Motion Correction / Props / Overlay 초기화
9. isFirst 애니메이션 또는 지정된 motion slot 재생
```

## 12. 누락 파일 처리 규칙

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
```

프론트 로그에는 어떤 참조가 실패했는지 파일명 또는 필드명을 남긴다.

예:

```text
Missing image: img/imgSurp.svg
Missing prop: props/OBJ_cheerBoard.glb
Missing animation: animations/a0_1.vrma
Missing expression parameter: Fcl_MTH_A
Missing bone: J_Sec_L_Sleeve
```

## 13. 적용 우선순위

프레임 단위 적용 순서는 아래를 권장한다.

```text
1. VRMA animation update
2. Motion Correction
3. Extra Bone Follow Setting
4. Props transform update
5. Expression Preset / Emotion Link Timeline
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

## 14. 전달 체크리스트

프론트/익스텐션에 전달하기 전에 아래를 확인한다.

```text
[ ] VRM 파일과 .vrm.meta가 같은 캐릭터 기준으로 짝이 맞는다.
[ ] animations.meta에 등록된 fileName이 animations 폴더의 실제 파일명과 일치한다.
[ ] 캐릭터 메타의 animationFile 값이 animations 폴더의 실제 파일명과 일치한다.
[ ] 캐릭터 메타의 image 값이 img 폴더의 실제 파일명과 일치한다.
[ ] 캐릭터 메타의 props file 값이 props 폴더의 실제 파일명과 일치한다.
[ ] expressionPresetId가 실제 expressionPresets 안의 id와 일치한다.
[ ] outline material 이름이 현재 VRM material 이름과 일치한다.
[ ] extraBoneFollowSettings의 targetBone/sourceBone/tailDirectionBone을 런타임에서 찾을 수 있다.
```

