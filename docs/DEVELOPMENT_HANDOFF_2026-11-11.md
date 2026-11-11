# Development Handoff - 2026-11-11

이 문서는 `9223344` 이후 VRM Expression Editor에 추가·수정된 개발 내용을 정리한 전달 문서다. 캐릭터 모델, 애니메이션 원본, 작업용 메타와 공간 리소스는 이 커밋에 포함하지 않는다.

## 1. 변경 요약

- Emotion Linker 2 전체 전환 ON/OFF 토글 및 런타임 메타 계약 추가
- Emotion Linker 2 슬롯 전환과 세부 설정 선택 시 오른쪽 UI 스크롤 위치 유지
- 애니메이션 전환 시 동작, 표정과 관절 보정값을 함께 보간
- 애니메이션 재생 중 UI 및 본 조회/보정 처리의 반복 비용 절감
- Transition Viewer 텍스트 립싱크 미리보기와 발화 연출 도구 추가
- Head Motion에 발화 중 랜덤 쉐이프키 보조 모션 추가
- 실행 시 업로더 패키지의 전이 AWS SDK 의존성 누락까지 검사하도록 보강

## 2. Emotion Linker 2

### 전체 전환 토글

Motion Slots 제목 오른쪽에 전환 아이콘 버튼을 추가했다. 버튼 상태는 `emotionLinker/emotion-linker2.meta`의 최상위 `transitionEnabled`에 저장된다.

```json
{
  "schemaVersion": 1,
  "type": "vrm-emotion-linker2-meta",
  "transitionEnabled": true,
  "motionSlots": []
}
```

- `true`: 각 슬롯과 표정 타임라인의 `transitionSeconds`를 사용한다.
- `false`: 애니메이션, 시작 표정, 타임라인 표정과 관절 보정을 즉시 전환한다.
- 필드가 없는 기존 메타: 하위 호환을 위해 `true`로 처리한다.

프런트 구현 계약은 `docs/EMOTION_LINKER2_RUNTIME_SPEC.md`와 `docs/RESOURCE_REFERENCE_RULES.md`에 반영했다.

### 애니메이션과 관절 보정 전환

슬롯을 바꿀 때 이전 AnimationAction과 새 AnimationAction의 weight를 전환 시간 동안 보간한다. 같은 시간축에서 캐릭터 메타의 Motion Correction quaternion도 이전 보정값에서 새 보정값으로 보간한다. 전환 토글이 꺼져 있으면 두 처리를 즉시 교체한다.

### UI 상태 유지

Emotion Linker 2에서 슬롯을 선택하거나 슬롯 내부 세부 설정을 변경해도 오른쪽 편집 패널의 스크롤 위치가 초기화되지 않도록 렌더링 전후 위치를 복원한다.

## 3. Transition Viewer 발화 미리보기

이 기능은 에디터 검수용이며 이번 변경만으로 프런트 런타임의 필수 계약이 되지는 않는다.

### 립싱크와 텍스트

- 입력 텍스트의 한글 모음을 A/I/U/E/O 입 모양으로 변환한다.
- 연속 입 모양을 부드럽게 보간하고 한 음절 발화에는 열림, 유지, 닫힘 구간을 둔다.
- 쉼표, 마침표, 느낌표, 물음표와 말줄임표에 발화 간격을 적용한다.
- 마지막 문장부호는 불필요한 추가 Head Motion 이벤트를 만들지 않는다.
- 립싱크 진행 시간에 맞춰 뷰어 상단에 녹색 타이핑 텍스트를 표시한다.
- 발화 속도는 `0.5x~4x` 범위로 조절한다.

### Head Motion

발화 중 Head와 Neck에 작은 회전 오프셋을 생성한다.

- X Pitch, Y Yaw, Z Roll별 ON/OFF 및 최솟값·최댓값
- 목표값 유지 시간 범위
- 다음 목표값으로 이동하는 전환 시간 범위
- Neck Follow 비율
- 발화 종료 후 원래 자세로 돌아오는 시간
- 패널 접기/펼치기
- 저장 버튼을 통한 설정 보존

Head Motion은 VRM humanoid 갱신 뒤, spring bone 갱신 전에 적용한다. 따라서 머리 회전에 따른 머리카락 등의 물리 반응을 유지한다.

### 랜덤 쉐이프키 보조 모션

Head Motion 패널의 `Shape Parameters`에서 발화 중 사용할 쉐이프키를 최대 3개까지 추가할 수 있다.

- `+` 버튼으로 항목 추가
- 드롭다운으로 쉐이프키 선택
- 항목별 `min ~ max` 범위 입력, 허용 범위 `0~1`
- Head Motion과 동일한 Hold/Transition 구간을 사용해 목표값 사이를 보간
- 현재 표정값에 오프셋으로 더한 후 최종값을 `0~1`로 제한
- 프레임마다 직전 오프셋을 제거한 뒤 다시 적용하므로 값이 누적되지 않음
- 립싱크 입 모양 쉐이프키는 충돌 방지를 위해 선택 목록에서 제외

설정은 `ExpressionEditorConfig.ini`의 `TransitionViewer.StateJson` 내부에 저장된다.

```json
{
  "lipSyncPreview": {
    "speed": 1.15,
    "returnDuration": 0.6,
    "headMotion": {
      "shapeParameters": [
        { "id": "BROW_Happy", "min": 0, "max": 0.2 }
      ]
    }
  }
}
```

## 4. 재생 성능 개선

- WebGL renderer의 `preserveDrawingBuffer`를 끄고 high-performance GPU preference를 사용한다.
- 애니메이션 진행 UI 갱신을 최대 약 30fps로 제한한다.
- 본 이름 조회 결과를 캐시해 매 프레임 scene traverse를 반복하지 않는다.
- 실제 보정값이 있는 본만 Motion Correction 미리보기에 적용한다.
- 불필요한 `updateMatrixWorld` 호출과 position/scale 백업을 줄였다.

스크린샷은 별도의 캡처 경로를 사용하므로 상시 `preserveDrawingBuffer`가 필요하지 않다.

## 5. 실행 복구 검사

`scripts/start-app.cjs`는 직접 의존성 버전뿐 아니라 `@piecomp/rorr-resource-uploader`를 실제로 require하여 전이 AWS SDK 패키지 누락 여부도 확인한다. 설치가 중간에 끊겨 패키지 폴더만 남은 경우 재설치를 유도한다.

## 6. 변경 파일

```text
README.md
docs/DEVELOPMENT_HANDOFF_2026-11-11.md
docs/EMOTION_LINKER2_RUNTIME_SPEC.md
docs/RESOURCE_REFERENCE_RULES.md
scripts/start-app.cjs
src/main.cjs
src/renderer.js
src/styles.css
```

## 7. 제외한 로컬 작업물

아래 항목은 코드 전달 커밋에 포함하지 않는다.

- `ExpressionEditorConfig.ini`
- `models/`
- 작업 중인 VRM/VRMA 및 `animations/animations.meta`
- `emotionLinker/*.meta`
- `spaces/` 및 `vrSpace/`
- 테스트용 `img/` 리소스
- 백업 ZIP과 생성 출력물

## 8. 검증

```text
npm run build
```

Vite production build가 성공했다. 기존과 동일하게 단일 JS chunk가 500 kB를 넘는다는 경고가 남아 있으나 빌드 실패는 아니다.

수동 검수 권장 항목:

1. Emotion Linker 2 전환 토글 ON/OFF에서 애니메이션·표정·관절 보정 전환 차이 확인
2. 슬롯과 세부 설정 선택 후 오른쪽 패널 스크롤 유지 확인
3. 립싱크 속도 `0.5x`, `1x`, `4x` 비교
4. Head Motion과 머리카락 spring bone 반응 확인
5. 쉐이프키 1~3개 추가, 범위 보간, 삭제와 저장 후 재실행 확인
