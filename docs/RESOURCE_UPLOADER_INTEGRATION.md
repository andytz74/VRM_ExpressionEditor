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

UI와 IPC 흐름은 구현 및 mock 검증이 완료되었습니다. 업로더 패키지는 `vendor/`에 포함되어 있으며, 실제 dev S3 연동 검증은 PC에 프로그램용 AWS 프로필이 설정된 뒤 진행합니다.

## 업로더 모듈 계약

Electron main 프로세스에서 기본적으로 다음 패키지를 지연 로드합니다.

```text
@piecomp/rorr-resource-uploader
```

패키지는 `vendor/piecomp-rorr-resource-uploader-<버전>.tgz` 파일로 저장소에 포함되고, `package.json`에서 `file:vendor/...` 의존성으로 설치됩니다. 별도 npm 레지스트리 로그인은 필요 없습니다.

- `npm start`(또는 실행 배치 파일)는 `package-lock.json`의 버전과 설치된 버전이 다르면 `npm install`을 다시 실행하므로, 새 버전 tgz로 교체된 커밋을 받으면 다음 실행 때 자동으로 설치됩니다.
- 새 버전은 익스텐션 담당자가 `rorr-vrm-resources` 저장소에서 `npm pack`으로 만들어 tgz 교체와 `package.json`/`package-lock.json` 갱신을 함께 PR로 올립니다.

업로더를 수정하면서 로컬 소스로 바로 연동할 때는 `RORR_RESOURCE_UPLOADER_PATH` 환경 변수에 모듈 경로를 지정할 수 있습니다.

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

렌더러가 파일 목록이나 S3 대상 키를 임의로 변경하지 못하도록 실행할 plan은 main 프로세스에 보관하고, 렌더러에는 내부 업로드 목록(`_uploads`, `_references`)을 뺀 화면 표시용 값만 보냅니다.

- 검사·업로드가 진행 중이면 다른 검사·업로드 요청은 `UPLOAD_BUSY`로 거절합니다.
- 업로드 중에는 창 닫기와 앱 종료를 막습니다.
- 한 번 실행한 plan은 성공·실패와 관계없이 버립니다. 다시 올리려면 다시 검사해야 하며, 이미 올라간 파일은 `같음`으로 건너뜁니다.

## 설정

에디터는 `ExpressionEditorConfig.ini`의 `[ResourceUpload]` 섹션에 아래 값만 저장합니다.

```ini
[ResourceUpload]
CharacterId=seoha-rorr
AwsProfile=rorr-resources-dev
UploaderName=<OS user name>
```

AWS access key, secret key, 콘솔 비밀번호는 저장하지 않습니다. 에디터 실행 계정에는 AWS SDK/CLI가 사용할 수 있는 프로그램용 프로필이 별도로 구성되어야 합니다.

디자이너 PC의 프로필 이름은 `rorr-resources-dev`로 확정합니다. (`resources-dev`는 익스텐션 담당자 PC의 프로필 이름입니다.)

- 익스텐션 담당자가 디자이너 PC에서 직접 `%USERPROFILE%\.aws\credentials`(macOS: `~/.aws/credentials`)에 `[rorr-resources-dev]` 프로필을 입력합니다. AWS CLI 설치는 필요 없습니다.
- 키는 dev 버킷 업로드 전용(삭제 권한 없음)이며, 메신저·문서·노션으로 전달하지 않습니다.
- 프로필이 없으면 검사 단계에서 `NO_CREDENTIALS`, 키가 틀리거나 만료되면 `ACCESS_DENIED`로 안내합니다.

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
