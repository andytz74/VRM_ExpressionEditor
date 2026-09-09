# Emotion Image Runtime Spec

Updated: 2026-09-02

이 문서는 VRM Expression Editor에서 만든 감정 이미지와 홍조 오버레이를 프론트/익스텐션 런타임에서 같은 크기와 움직임으로 재현하기 위한 기준값이다.

## 핵심 규칙

런타임은 메타의 `scale`만으로 plane 크기를 정하면 안 된다.

먼저 타입별 기준 plane을 만들고, 그 위에 `scale`을 곱한다.

```text
Emotion Image baseHeight = 0.45
Blush baseHeight = 1
```

기준값이 다르면 같은 `scale`이어도 런타임 표시 크기가 달라진다. 예를 들어 Emotion Image를 `1m` 기준으로 만들면 에디터보다 약 `2.22배` 크게 보인다.

## Emotion Image Plane

```text
height = baseHeight
width = imageAspectRatio * baseHeight
finalScale = scale
```

메타 예:

```json
{
  "emotionImage": {
    "image": "imgSurp.svg",
    "baseHeight": 0.45,
    "x": 0,
    "y": 1.5,
    "z": 0,
    "rotation": 0,
    "scale": 0.4,
    "opacity": 1,
    "pivotX": 0.5,
    "pivotY": 0.5,
    "animationDuration": 1,
    "loop": false
  }
}
```

`baseHeight`가 없는 기존 메타는 `0.45`로 취급한다.

## Blush Plane

```text
height = baseHeight
width = imageAspectRatio * baseHeight
finalScale = scale
```

메타 예:

```json
{
  "blush": {
    "image": "redFace.png",
    "baseHeight": 1,
    "y": 0.04,
    "z": 0.08,
    "scale": 0.28
  }
}
```

`baseHeight`가 없는 기존 메타는 `1`로 취급한다.

Blush는 head bone의 자식으로 붙는다.

```text
position = [0, y, z]
rotation = [0, 0, 0]
scale = [scale, scale, scale]
```

현재 에디터는 Blush의 `x` 값을 사용하지 않는다.

## Billboard Rotation

Emotion Image는 항상 카메라를 보는 billboard다.

```text
worldRotation = cameraRotation * localZRotation(rotationDegrees)
```

`rotation`은 카메라를 바라본 뒤 화면 기준 roll 값으로 적용한다.

## Pivot Offset

`pivotX`, `pivotY`는 UV 기준 `0~1` 값이다. 실제 mesh offset은 plane의 월드 크기를 곱해서 계산한다.

```text
offsetX = (0.5 - pivotX) * width
offsetY = (0.5 - pivotY) * height
```

이 offset은 mesh local position으로 적용한다. 부모 group에는 위치, billboard 회전, scale을 적용한다.

## Value Ranges

Emotion Image:

```text
x: -2 ~ 2, default 0
y: -1 ~ 3, default 1.5
z: -2 ~ 2, default 0
scale: 0 ~ 3, default 1
opacity: 0 ~ 1, default 1
rotation: -180 ~ 180, default 0
pivotX: 0 ~ 1, default 0.5
pivotY: 0 ~ 1, default 0.5
animationDuration: 0.1 ~ 30 seconds, default 1
loop: boolean, default false
```

Blush:

```text
y: 0 ~ 0.1, default 0
z: 0 ~ 0.2, default 0.08
scale: 0 ~ 1, default 0.28
```

## Graph Rules

지원 curve:

```text
linear
easeOut
easeIn
easeInOut
step
```

Graph 범위:

```text
scaleGraph: 0 ~ 2, default value 1
opacityGraph: 0 ~ 1, default value 1
headRotationGraph: -10 ~ 10 degrees, default value 0
```

정규화 규칙:

```text
time은 0~1로 제한한다.
value는 graph별 범위로 제한한다.
curve가 지원 문자열이 아니면 linear로 처리한다.
point는 time 오름차순으로 정렬한다.
첫 점이 time 0보다 뒤에 있으면 기본점을 추가한다.
마지막 점이 time 1보다 앞에 있으면 기본점을 추가한다.
첫 점 time은 0, 마지막 점 time은 1로 강제한다.
연속 점의 time 차이가 0.001 미만이면 뒤쪽 점으로 합친다.
최대 12개 점까지만 사용한다.
```

평가 규칙:

```text
각 구간의 curve는 시작점의 curve 값을 따른다.
linear: t
easeIn: t^3
easeOut: 1 - (1 - t)^3
easeInOut: t^2 * (3 - 2t)
step: 다음 점에 도달하기 전까지 시작값 유지
```

## Empty State

표정에 Emotion Image가 없으면 런타임은 Emotion Image opacity를 `0`으로 취급한다.

표정에 Blush가 없거나 `enabled: false`이면 Blush opacity를 `0`으로 취급한다.

이전 표정에서 표시되던 Emotion Image 또는 Blush가 다음 표정에 남으면 안 된다.
