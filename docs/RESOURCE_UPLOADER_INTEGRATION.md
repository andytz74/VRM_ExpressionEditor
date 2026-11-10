# Resource Uploader Integration

## 목적

VRM Expression Editor에서 디자이너가 작업을 마친 뒤 개발자를 거치지 않고 dev S3/CDN에 캐릭터 리소스를 업로드하기 위한 연동 문서입니다. 로컬 에디터 폴더의 파일을 원본으로 보고, 원격 리소스와 비교한 결과를 확인한 뒤 업로드합니다.

## 현재 구현 상태

- VRM을 연 뒤 상단의 **업로드** 버튼으로 업로드 창을 열 수 있습니다.
- 캐릭터 ID, AWS 프로필, 업로더 이름을 설정할 수 있습니다.
- 로컬과 원격의 차이를 추가, 변경, 서버에만 있음으로 구분합니다.
- 오류, 경고, 파일 크기, 메모를 확인한 뒤 업로드할 수 있습니다.
- 저장하지 않은 에디터 변경이 있으면 업로드를 차단합니다.
- 업로드 진행률과 CDN 검증 결과를 표시합니다.
- 렌더러에는 AWS 자격 증명과 S3 클라이언트를 노출하지 않습니다.

UI와 IPC 흐름은 구현 및 mock 검증이 완료되었습니다. 실제 dev S3 연동 검증은 업로더 패키지와 프로그램용 AWS 프로필을 받은 뒤 진행해야 합니다.

## 업로더 모듈 계약

Electron main 프로세스에서 기본적으로 다음 패키지를 지연 로드합니다.

```text
@piecomp/rorr-resource-uploader
```

로컬 패키지로 먼저 연동할 때는 `RORR_RESOURCE_UPLOADER_PATH` 환경 변수에 모듈 경로를 지정할 수 있습니다.

업로더 모듈은 다음 함수를 제공해야 합니다.

```js
await uploader.plan(options)
await uploader.run(plan, options)
```

`plan()`은 업로드 전에 원격과 비교하고 `added`, `changed`, `remoteOnly`, `errors`, `warnings`, `totalBytes`, `canUpload`를 반환합니다. `run()`은 확정된 plan을 받아 업로드, CloudFront 무효화, CDN 검증, 업로드 이력 기록을 수행하고 진행 상황을 콜백으로 알립니다.

관련 IPC는 다음과 같습니다.

- `upload:plan`: 비교 plan 생성
- `upload:run`: main 프로세스에 보관된 plan 실행
- `upload:progress`: 렌더러에 단계와 진행률 전달

렌더러가 파일 목록이나 S3 대상 키를 임의로 변경하지 못하도록 실행할 plan은 main 프로세스에 보관합니다.

## 설정

에디터는 `ExpressionEditorConfig.ini`의 `[ResourceUpload]` 섹션에 아래 값만 저장합니다.

```ini
[ResourceUpload]
CharacterId=seoha-rorr
AwsProfile=rorr-resources-dev
UploaderName=<OS user name>
```

AWS access key, secret key, 콘솔 비밀번호는 저장하지 않습니다. 에디터 실행 계정에는 AWS SDK/CLI가 사용할 수 있는 프로그램용 프로필이 별도로 구성되어야 합니다.

AWS 프로필 이름은 자료 간 표기가 다릅니다.

- 상세 구현 문서: `rorr-resources-dev`
- 기존 AWS 인벤토리: `resources-dev`

개발 담당자가 실제 발급 프로필 이름을 하나로 확정한 뒤 에디터 기본값 또는 운영 배포 설정과 맞춰야 합니다.

운영 업로드는 에디터에서 수행하지 않고 CI 절차를 사용합니다. 운영 콘솔 계정과 비밀번호를 앱, 저장소, 설정 파일에 넣으면 안 됩니다.

## 업로드 순서와 정책

- 참조되는 이미지, VRMA, GLB 등의 리소스를 먼저 업로드합니다.
- 메타 파일은 참조 리소스 이후에 업로드합니다.
- 캐릭터의 `.vrm.meta`는 마지막에 업로드합니다.
- 원격에만 있는 파일은 목록에 표시하되 자동 삭제하지 않습니다.
- 알 수 없는 메타 필드나 삭제된 필드는 `익스텐션 담당 확인 필요` 경고로 표시합니다.
- 업로드 완료 후 CloudFront 무효화와 CDN 재조회 검증을 수행합니다.
- 누가, 언제, 어떤 캐릭터에 어떤 파일을 업로드했는지 이력을 남깁니다.

## 업로드 제외 대상

다음 로컬 작업 파일과 개발 중 리소스는 업로드하거나 커밋할 대상이 아닙니다.

- `ExpressionEditorConfig.ini`
- `spaces/`
- `vrSpace/`
- `work/`
- `output/`, `outputs/`
- 백업 및 임시 파일

모델 원본과 캐릭터 메타는 기존 전달 정책에 따라 별도로 관리합니다. 개발 중인 Space Editor 리소스는 현재 배포 대상에서 제외합니다.

## 실제 dev 연동 검증

업로더 패키지와 프로그램용 AWS 프로필이 준비되면 다음 항목을 확인해야 합니다.

1. 로컬 파일과 dev S3의 추가/변경/원격 전용 판정
2. 참조 리소스, 일반 메타, `.vrm.meta` 순서 보장
3. 원격 파일이 자동 삭제되지 않는지 확인
4. 권한 부족, 만료된 자격 증명, 네트워크 오류 안내
5. CloudFront 무효화 요청과 완료 처리
6. CDN에서 새 파일 내용과 ETag 또는 해시 재검증
7. 업로드 이력 저장
8. 중복 실행 및 창 닫기 차단

## 개발 환경 참고

- Node.js `22.12` 이상을 권장합니다.
- Electron은 `42.5.0`을 사용합니다.
- Electron 42는 `npm install`만으로 실행 파일이 내려받아지지 않을 수 있습니다. `npm start`의 시작 스크립트가 실행 파일이 없을 때 `install-electron`으로 복구합니다.
- `npm run build`에서 출력되는 500 kB 이상 chunk 경고는 현재 실행을 막는 오류가 아닙니다.

현재 확인된 범위는 빌드 성공, 앱 시작 성공, mock 업로더를 통한 비교/경고/업로드 완료 흐름입니다. 실제 S3 업로드 성공 여부는 외부 업로더 패키지와 dev 자격 증명이 연결된 뒤 최종 확인해야 합니다.
