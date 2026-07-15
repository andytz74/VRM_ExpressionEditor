# VRM Expression Editor

VRM Expression Editor는 VRM 캐릭터의 표정 프리셋과 애니메이션별 관절 보정값을 만들기 위한 Electron 기반 제작 도구입니다.

주요 목적은 다음과 같습니다.

- VRM 파일을 열어 모델과 shape key를 확인합니다.
- Blender에서 준비한 shape key들을 조합해 표정 프리셋을 만듭니다.
- 캐릭터별 `.meta` 파일에 표정 프리셋과 Motion Correction 값을 저장합니다.
- 프론트/익스텐션에서는 VRM과 같은 이름의 `.meta` 파일을 함께 읽어 캐릭터별 동작을 재현합니다.

## 실행

Windows에서 아래 배치 파일을 실행합니다.

```text
VRM Expression Editor.bat
```

## 전달 파일

제작이 끝난 캐릭터 리소스는 기본적으로 다음 두 파일입니다.

```text
CharacterName.vrm
CharacterName.vrm.meta
```

익스텐션에서는 VRM을 로드할 때 같은 이름의 `.meta` 파일도 함께 로드해서 캐릭터별 설정값으로 사용합니다.

## 1. 메타파일 역할

`.meta` 파일은 VRM 자체를 수정하지 않고, 캐릭터별 추가 정보를 저장하는 JSON 파일입니다.

포함될 수 있는 주요 정보는 다음과 같습니다.

- VRM 버전 정보
- 캐릭터 식별 정보
- 표정 프리셋
- 표정 프리셋별 shape key 파라미터 값
- 애니메이션별 Motion Correction 보정값

## 2. VRM 버전 정보

메타파일에는 해당 VRM이 `v1.0`인지 `v0.0`인지 구분하는 값이 들어갑니다.

익스텐션에서는 이 값을 참고해서 VRM 1.0 / VRM 0.x 처리 방식을 필요한 경우 분기합니다.

```json
{
  "vrm": {
    "version": "1.0"
  }
}
```

또는:

```json
{
  "vrm": {
    "version": "0.0"
  }
}
```

## 3. 표정 프리셋

표정 프리셋은 메타파일의 `expressionPresets` 배열에 저장됩니다.

각 프리셋은 표정 이름과 shape key 조합값을 가집니다.

```json
{
  "expressionPresets": [
    {
      "id": "emotion-0",
      "name": "Joy",
      "locked": false,
      "parameters": {
        "BROW_Up_L": 0.2,
        "BROW_Up_R": 0.2,
        "EYE_Close_L": 0.1,
        "EYE_Close_R": 0.1,
        "MTH_Smile": 0.8
      }
    }
  ]
}
```

익스텐션에서는 `name`을 표정 이름으로 사용하고, `parameters`의 key/value를 shape key 이름과 weight로 사용합니다.

## 4. 표정 적용 방식

표정 프리셋을 적용할 때는 다음 순서로 처리합니다.

1. 현재 적용 중인 표정 관련 morph 값을 초기화합니다.
2. 선택된 프리셋의 `parameters`를 읽습니다.
3. VRM 모델 내부에서 같은 이름의 shape key / morph target을 찾습니다.
4. 해당 morph target weight에 저장된 값을 적용합니다.

```js
function applyExpressionPreset(vrmRoot, preset) {
  const params = preset.parameters ?? {};

  vrmRoot.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary || !object.morphTargetInfluences) return;

    for (const [shapeKeyName, value] of Object.entries(params)) {
      const index = object.morphTargetDictionary[shapeKeyName];
      if (index == null) continue;

      object.morphTargetInfluences[index] = value;
    }
  });
}
```

## 5. 값 범위

표정 파라미터 값은 `0.0 ~ 1.0` 범위입니다.

```text
0.0 = 적용 안 함
1.0 = 완전 적용
```

## 6. 실시간 감정값과 프리셋 혼합

라이브 데이터로 감정 강도가 들어오는 경우, 프리셋 값을 그대로 쓰지 않고 감정 강도를 곱해서 적용할 수 있습니다.

```js
function applyExpressionPresetWithWeight(vrmRoot, preset, weight) {
  const params = preset.parameters ?? {};

  vrmRoot.traverse((object) => {
    if (!object.isMesh || !object.morphTargetDictionary || !object.morphTargetInfluences) return;

    for (const [shapeKeyName, value] of Object.entries(params)) {
      const index = object.morphTargetDictionary[shapeKeyName];
      if (index == null) continue;

      object.morphTargetInfluences[index] = value * weight;
    }
  });
}
```

예:

```text
Joy 프리셋의 MTH_Smile = 0.8
현재 joy 감정 강도 = 0.5
실제 적용값 = 0.8 * 0.5 = 0.4
```

## 7. 없는 shape key 처리

메타파일에 있는 shape key 이름이 현재 VRM에 없을 수 있습니다.

이 경우 에러로 중단하지 말고 해당 항목만 무시합니다.

```js
const index = object.morphTargetDictionary[shapeKeyName];
if (index == null) continue;
```

## 8. Motion Correction

메타파일에는 애니메이션별 관절 보정값도 들어갈 수 있습니다.

익스텐션에서 애니메이션을 재생할 때, 현재 재생 중인 VRMA 파일명과 메타파일의 애니메이션 보정 정보를 매칭해서 적용합니다.

중요한 기준은 애니메이션 ID가 아니라 파일명입니다.

```text
a0.vrma
clap.vrma
idle.vrma
```

보정값은 보통 다음 계층으로 사용합니다.

```text
캐릭터
  - 애니메이션 파일명
      - 본 이름
          - positionOffset
          - rotationOffset
          - scaleMultiplier
```

적용 방식은 애니메이션 포즈가 계산된 뒤, 렌더링 직전에 캐릭터별 보정값을 더하는 방식이 적합합니다.

메타파일에서는 다음처럼 캐릭터별 파일 안에서 애니메이션 파일명을 key로 사용합니다.

```json
{
  "animations": {
    "a0.vrma": {
      "corrections": {
        "Left Upper Arm": {
          "positionOffset": [0, 0, 0],
          "rotationOffset": [0, 0, 0],
          "scaleMultiplier": [1, 1, 1]
        }
      }
    }
  }
}
```

## 9. 권장 로딩 흐름

```js
async function loadCharacter(vrmUrl) {
  const vrm = await loadVrm(vrmUrl);

  const metaUrl = vrmUrl + ".meta";
  const meta = await fetch(metaUrl).then((res) => res.json());

  return {
    vrm,
    meta,
    vrmVersion: meta.vrm?.version,
    expressionPresets: meta.expressionPresets ?? [],
    motionCorrection: meta.motionCorrection ?? {}
  };
}
```

## 10. 핵심 요약

- VRM과 같은 이름의 `.meta` 파일을 함께 로드합니다.
- 표정은 `expressionPresets`의 `parameters`를 shape key weight로 적용합니다.
- shape key 이름이 없으면 무시합니다.
- 감정 강도가 있으면 `저장된 값 * 감정 강도`로 적용합니다.
- Motion Correction은 애니메이션 파일명을 기준으로 보정값을 찾아 적용합니다.

## PDF 문서

같은 내용을 PDF로 정리한 파일도 포함되어 있습니다.

```text
output/pdf/VRM_metafile_integration_guide.pdf
```
