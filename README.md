# VRM Expression Editor

VRM 캐릭터의 표정 프리셋, 애니메이션별 보정값, 추가 본 팔로우 설정을 제작하고 검수하기 위한 Electron 기반 툴입니다.

이 저장소에는 프론트/익스텐션 런타임에서 `.vrm.meta`와 `animations/animations.meta`를 어떻게 읽고 적용해야 하는지 정리한 PDF 문서가 포함되어 있습니다.

## 실행

먼저 Node.js LTS가 설치되어 있어야 합니다.

Windows에서는 아래 배치 파일을 실행합니다.

```text
VRM Expression Editor.bat
```

macOS에서는 아래 파일을 실행합니다.

```text
VRM Expression Editor.command
```

명령줄에서는 Windows와 macOS 모두 아래 명령으로 실행할 수 있습니다.

```text
npm start
```

## dev 리소스 업로드

VRM을 연 뒤 상단의 **업로드** 버튼을 누르면 현재 캐릭터 리소스를 dev 서버와 비교하고, 확인 후 업로드할 수 있습니다.

- 변경 파일은 추가, 변경, 서버에만 있음으로 구분해 표시합니다. 서버에만 있는 파일은 자동으로 삭제하지 않습니다.
- 오류가 있거나 변경 파일이 없으면 업로드 버튼이 비활성화됩니다.
- 새 meta 필드 등 익스텐션 검토가 필요한 경고는 업로드 전에 별도로 표시합니다.
- 업로드 중에는 창을 닫거나 중복 실행할 수 없으며, 완료 후 CDN 검증 결과를 표시합니다.
- `ExpressionEditorConfig.ini`의 `[ResourceUpload]` 섹션에 캐릭터 ID, AWS 프로필 이름, 업로더 이름을 저장합니다. AWS 키 자체는 저장하지 않습니다.
- `ExpressionEditorConfig.ini`, `spaces/`, `vrSpace/`, `work/`, `output/`은 업로드 대상이 아닙니다.

실제 비교와 업로드는 Electron main 프로세스에서 `@piecomp/rorr-resource-uploader`의 `plan()`과 `run()`을 호출합니다. 업로더 패키지와 dev 전용 AWS 자격 증명이 준비되지 않은 PC에서는 안내 메시지만 표시하며, 렌더러에는 자격 증명을 노출하지 않습니다.

개발 연동 계약과 실제 dev 검증 항목은 [Resource Uploader Integration](docs/RESOURCE_UPLOADER_INTEGRATION.md)에 정리되어 있습니다.

## 프론트/익스텐션 전달 문서

- [VRM Expression Editor Frontend Runtime Guide](docs/VRM_ExpressionEditor_Frontend_Runtime_Guide.pdf)
- [Resource Reference Rules](docs/RESOURCE_REFERENCE_RULES.md)
- [Resource Uploader Integration](docs/RESOURCE_UPLOADER_INTEGRATION.md)
- [Emotion Linker 2 Frontend Runtime Spec](docs/EMOTION_LINKER2_RUNTIME_SPEC.md)
- [Effect Runtime Spec](docs/EFFECT_RUNTIME_SPEC.md)
- [Look At Camera Runtime Spec](docs/LOOK_AT_CAMERA_RUNTIME_SPEC.md)

런타임 가이드 PDF에는 다음 내용이 정리되어 있습니다.

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

등록된 애니메이션과 표정 프리셋을 연결해서 확인하는 view only 모드입니다.

애니메이션 재생 중 특정 시점에 표정 프리셋을 전환하는 설정을 만들 수 있습니다. 이 정보는 `emotionLinker/emotion-linker.meta`에 저장됩니다.

### Emotion Linker 2

모션 슬롯 단위로 애니메이션과 표정 프리셋을 연결해서 확인하는 view only 모드입니다.

슬롯 제목, 애니메이션 파일, 표정 프리셋과 시간축 전환, 파티클 이펙트, loop, transition 값을 관리합니다. 이 정보는 `emotionLinker/emotion-linker2.meta`에 저장됩니다. 프런트에서는 슬롯 제목을 호출해 설정된 애니메이션, 표정, 이펙트 시퀀스를 함께 재생합니다.

### Space Editor

> **개발 중 / 현재 비활성화**
> Space Editor는 아직 안정화되지 않았으며 모드 진입 시 멈춤 현상이 발생할 수 있어 앱에서 버튼을 비활성화했습니다. 안정성 문제가 해결되기 전까지 `vrSpace/` 리소스는 프런트 전달 및 배포 대상에 포함하지 않습니다.

코드로 생성한 큐브룸의 크기, 위치, 회전, 벽과 바닥 재질을 설정하는 모드입니다.

공간 목록과 현재 선택 정보는 `vrSpace/vrSpace.meta`에 저장되고, 각 공간의 실제 설정은 `vrSpace/spaces/*.meta`에 하나씩 분리해 저장됩니다. 선택한 벽·바닥 타일 텍스처는 `vrSpace/textures/`, 공간에 배치할 GLB는 `vrSpace/props/`에 복사됩니다. 벽과 바닥 및 GLB의 PBR 재질은 공간 조명의 영향을 받습니다.

### Transition Viewer

애니메이션 전환 상태를 검수하는 view only 모드입니다.

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
props/
emotionLinker/
  emotion-linker.meta
  emotion-linker2.meta
vrSpace/
  vrSpace.meta
  spaces/
    *.meta
  props/
    *.glb
  bakes/
    *-ao.png
  textures/
```

- `.vrm.meta`: 캐릭터별 표정, 모션 보정, 추가 본 설정, 감정맵, 보조 이미지, 아웃라인, props 정보를 저장합니다.
- `animations/animations.meta`: 툴에 등록된 VRMA 애니메이션 목록, 설명, 루프 여부, first 여부 등을 저장합니다.
- `img/`: 홍조 등 표정 보조 이미지 리소스를 저장합니다.
- `props/`: GLB 소품 리소스를 저장합니다.
- `emotionLinker/`: 확인용 애니메이션-표정 연결 정보를 저장합니다.
- `vrSpace/` 관련 파일은 Space Editor 안정화 전까지 개발 중인 실험 리소스로 취급하며 현재 전달·배포 대상에서 제외합니다.
- `vrSpace/vrSpace.meta`: Space Editor의 공간 목록, 표시 이름, 활성 공간과 개별 공간 메타 경로를 관리합니다.
- `vrSpace/spaces/*.meta`: 공간 하나의 크기, 위치, 회전, 재질과 배치 오브젝트 설정을 파일 하나에 저장합니다.
- `vrSpace/props/*.glb`: 공간에 배치하는 3D 오브젝트를 저장합니다.
- `vrSpace/bakes/*-ao.png`: 방의 벽·바닥·천장에 적용하는 베이크된 AO 맵을 저장합니다.
- `vrSpace/textures/`: 벽과 바닥에 사용하는 타일 텍스처를 저장합니다.

## 개발 메모

- 기술 스택: Electron, Vite, Three.js, `@pixiv/three-vrm`
- 실행 방식: Windows `.bat`, macOS `.command`, 공통 `npm start`
- 현재 주요 작업 대상은 Expression Editor, Motion Correction, Extra Bone Follow Setting, Emotion Linker, Transition Viewer입니다.
