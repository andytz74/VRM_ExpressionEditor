# VRM Expression Editor

VRM 캐릭터의 표정 프리셋, 애니메이션별 보정값, 추가 본 팔로우 설정을 제작하고 검수하기 위한 Electron 기반 툴입니다.

이 저장소에는 프론트/익스텐션 런타임에서 `.vrm.meta`와 `animations/animations.meta`를 어떻게 읽고 적용해야 하는지 정리한 PDF 문서가 포함되어 있습니다.

## 실행

Windows에서 아래 배치 파일을 실행합니다.

```text
VRM Expression Editor.bat
```

## 프론트/익스텐션 전달 문서

- [VRM Expression Editor Frontend Runtime Guide](docs/VRM_ExpressionEditor_Frontend_Runtime_Guide.pdf)

이 PDF에는 다음 내용이 정리되어 있습니다.

- 캐릭터 `.vrm.meta` 로딩 규칙
- `animations/animations.meta` 로딩 규칙
- Motion Correction 적용 순서
- Expression Preset 적용 방식
- Extra Bone Follow Setting 적용 방식
- Emotion Linker의 애니메이션/표정 연결 정보
- Transition Viewer의 용도
- 자동 눈깜빡임 처리 기준

프론트/익스텐션 런타임에서 반드시 적용해야 하는 핵심은 다음입니다.

- VRM을 로드할 때 같은 위치의 `파일명.vrm.meta`를 함께 읽습니다.
- 애니메이션 목록과 설명은 `animations/animations.meta`에서 읽습니다.
- 애니메이션 식별자는 별도 id가 아니라 VRMA 파일명입니다.
- 표정은 `expressionPresetId`를 우선 사용하고, 이름은 표시용 또는 보조 식별값으로만 취급합니다.
- 런타임 적용 순서는 기본 애니메이션 포즈 적용 후 `Motion Correction`, `Extra Bone Follow Setting` 순서입니다.
- 자동 눈깜빡임은 기본적으로 `Fcl_Eye_Close`를 사용합니다.

## 주요 모드

### Motion Correction

캐릭터별, 애니메이션별 관절 보정값을 만드는 모드입니다.

VRMA 애니메이션을 등록하고, 특정 본의 위치/회전/스케일 보정값을 캐릭터 `.meta` 파일에 저장합니다. 같은 캐릭터의 다른 복장 모델에도 동일한 보정값을 재사용하는 것이 목적입니다.

### Expression Editor

VRM 안의 shape key 값을 조합해서 표정 프리셋을 만드는 모드입니다.

표정 프리셋은 캐릭터 `.meta` 파일에 저장됩니다. 프리셋에는 shape key 파라미터, 구간별 파라미터, 눈깜빡임 비활성화 여부, 홍조 오버레이 설정 등이 포함될 수 있습니다.

### Extra Bone Follow Setting

VRM 휴머노이드 본이 아닌 추가 본을 특정 휴머노이드 본의 회전값에 따라 움직이도록 설정하는 모드입니다.

의상 소매본처럼 VRM 런타임에서 Blender constraint가 동작하지 않는 보조 본을 보정하기 위한 기능입니다. 설정값은 캐릭터 `.meta` 파일에 저장되며, 익스텐션 런타임에서 동일하게 적용해야 합니다.

### Emotion Linker

등록된 애니메이션과 표정 프리셋을 연결해서 확인하는 모드입니다.

애니메이션 재생 중 특정 시점에 표정 프리셋을 전환하는 설정을 만들 수 있습니다. 이 정보는 캐릭터 `.meta` 파일에 저장되며, 익스텐션에서 애니메이션을 호출할 때 표정 연동에 사용됩니다.

### Transition Viewer

애니메이션 전환 상태를 검수하는 참고용 모드입니다.

start, transition, end 또는 sequence 형태로 애니메이션 전환을 확인합니다. 현재는 런타임 필수 메타라기보다 제작/검수용 작업환경에 가깝습니다.

### Shape Key Transfer

현재 제작 파이프라인에서는 당분간 사용하지 않습니다.

표정용 shape key는 Blender에서 직접 제작하고, 이 툴에서는 해당 shape key를 조합해 표정 프리셋으로 저장하는 방식을 사용합니다.

## 저장 파일

기본 산출물은 다음 형태입니다.

```text
CharacterName.vrm
CharacterName.vrm.meta
animations/
  animations.meta
img/
```

- `.vrm.meta`: 캐릭터별 표정, 모션 보정, 추가 본 설정, 애니메이션-표정 연결 정보를 저장합니다.
- `animations/animations.meta`: 툴에 등록된 VRMA 애니메이션 목록, 설명, 루프 여부, first 여부 등을 저장합니다.
- `img/`: 홍조 등 표정 보조 이미지 리소스를 저장합니다.

## 개발 메모

- 기술 스택: Electron, Vite, Three.js, `@pixiv/three-vrm`
- 실행 방식: Windows `.bat`
- 현재 주요 작업 대상은 Expression Editor, Motion Correction, Extra Bone Follow Setting, Emotion Linker, Transition Viewer입니다.
