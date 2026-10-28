# LNG 워크샵 — Vercel 배포 및 공동 투표

현재 배포 전 단계입니다. 이 압축파일 자체는 웹사이트 주소가 아닙니다.
기존 할로윈 × 빼빼로 발표자료·미니게임을 유지하고, Supabase 공동 투표와 진행자 화면을 추가했습니다.

## 1. GitHub에 배포파일 올리기

1. 이 ZIP을 다운로드하고 압축을 풉니다.
2. GitHub에 로그인 → New repository → 저장소 이름 `lng-workshop`.
3. 얼굴 사진이 포함된 소스이므로 코드 저장소 공개 범위는 Private을 권합니다. 이 설정만으로 배포된 웹사이트까지 비공개가 되지는 않습니다.
4. 저장소 생성 후 `uploading an existing file` 또는 Add file → Upload files를 선택합니다.
5. 압축을 푼 폴더 안의 내용물을 올립니다. `public`, `api`, `lib`, `scripts`, `sql`, `tests` 폴더와 `package.json`, `vercel.json`, `README_KO.md` 등이 저장소 최상단에 와야 합니다.
6. Commit changes로 저장합니다. ZIP 파일 하나만 올리거나, 모든 파일을 추가 상위 폴더에 넣지 마세요.
7. 실제 비밀번호·비밀키·실제 `.env` 파일은 저장소에 올리지 않습니다. `.env.example`은 빈 값의 설명용 견본입니다.

## 2. Vercel에서 저장소 가져오기

1. 기존 Vercel 계정 → Add New / New Project → 방금 만든 GitHub 저장소 Import.
2. 저장소가 보이지 않으면 Vercel의 GitHub 연결에서 해당 저장소 접근을 허용합니다.
3. Framework Preset은 Other, Root Directory는 저장소 최상단입니다.
4. `vercel.json`이 Output Directory를 `public`으로 지정합니다. 별도의 빌드 명령은 필요하지 않습니다. 기존 다른 프로젝트의 빌드 설정을 재사용하지 마세요.
5. 배포 설정의 Environment Variables에 아래 세 값을 추가합니다. 배포 전에 넣지 않았다면 Settings → Environment Variables에서 추가한 후 반드시 Redeploy합니다.

| Name | Value |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 홈의 `https://…supabase.co` 주소. `/dashboard/project/…` 주소가 아닙니다. |
| `SUPABASE_SECRET_KEY` | Supabase Settings → API Keys의 `sb_secret_…` 서버용 Secret key. Publishable key가 아닙니다. |
| `WORKSHOP_ADMIN_PASSWORD` | 직접 정한 진행자 비밀번호. 공백 없이 영문·숫자·기호 16~128자. |

- 변수 이름은 위의 영문을 그대로 사용합니다.
- 값에는 따옴표를 붙이지 않습니다.
- 최소한 Production에 적용합니다. Preview 배포에서도 DB 연동을 확인하려면 Preview에도 적용합니다.
- 비밀키와 진행자 비밀번호는 채팅·HTML·GitHub에 붙여 넣지 말고 Vercel에 직접 등록합니다.
- 새 Supabase Secret key는 `apikey` 헤더로만 사용합니다. 기존 `service_role` JWT도 코드상 지원하지만 새 키 사용을 권합니다.
- 무료 Vercel Hobby는 개인·비상업 용도로 제한됩니다. 회사 행사에 사용할 계정·요금제는 해당 조건에 맞게 선택하세요.

6. Deploy를 실행합니다. 성공 후 Vercel이 표시한 배포 URL을 사용합니다.
7. Production URL과 Preview URL은 다른 주소일 수 있습니다. 참석자에게는 동일한 Production URL을 공유하세요.

## 3. 진행자가 11개의 개인 참여 링크 배부하기

1. 배포 URL 끝에 `/admin.html`을 붙여 접속합니다. 예: `https://배포주소/admin.html`.
2. Vercel의 `WORKSHOP_ADMIN_PASSWORD` 값으로 로그인합니다. Vercel 계정 비밀번호나 Supabase 비밀번호가 아닙니다.
3. 11개 참가 번호가 보이면 데이터베이스 연결이 된 것입니다.
4. 참가자 01~11번을 동료들에게 하나씩 배정합니다. 표에는 실명 대신 번호를 사용합니다.
5. 각 행의 `링크 복사`로 해당 동료에게 그 사람의 링크 한 개만 전달합니다. 이 시스템이 대신 메시지를 보내지는 않습니다.
6. 또는 `개인 참여 링크 CSV 저장`으로 명단을 내려받고 번호별 링크를 배부합니다. CSV에는 모든 참여 코드가 있으므로 진행자만 보관합니다.
7. 참석자는 개인 링크로 접속 → 02 취향 탭 → 스캔 또는 식당 정보 확인 → 원하는 메뉴에 투표합니다.

개인 링크는 `/#vote=개인코드` 형식입니다. 참여 코드는 첫 접속 시 현재 브라우저에만 기억하며 서버 요청은 코드로 본인 표를 확인합니다. 코드는 초기 접속 후 주소창에서 제거합니다.
일반 메인 URL로도 발표자료·미니게임·집계는 볼 수 있지만 투표에는 개인 코드가 필요합니다.
한 코드를 여러 기기에서 써도 같은 번호의 한 표만 바뀝니다. 코드를 다른 사람에게 전달하면 그 사람도 해당 표를 바꿀 수 있으므로 개인별로 배부하세요.

## 4. 실제 연결 확인

이 패키지의 API 검증은 모의 저장소로 수행했습니다. 실제 Supabase 프로젝트·Vercel Production 연결은 아래 절차로 배포 후 확인해야 합니다.

1. 진행자 화면에서 개인 참여 링크 2개를 준비합니다.
2. 휴대폰 A에서는 01번 링크로 브런치, 휴대폰 B에서는 02번 링크로 피맥을 선택합니다.
3. 둘 다 취향 탭을 보고 있을 때 약 5초 안에 2명 참여·각 1표로 같아지는지 확인합니다.
4. A에서 피맥으로 변경하면 총 2표·피맥 2표가 되어야 합니다. 총표수가 3표가 되면 안 됩니다.
5. 새로고침 후에도 개인 선택과 집계가 유지되는지 확인합니다.
6. 진행자 화면에서 결과 CSV를 저장할 수 있는지 확인합니다.
7. 연습이 끝나면 진행자 화면에서 전체 투표를 초기화합니다. 참여 링크는 그대로 유지됩니다.
8. 그 후 참석자에게 링크를 배부합니다.

집계는 실시간 푸시가 아니라 취향 탭이 보이는 동안 약 5초 간격으로 조회합니다. 휴대폰이 절전 상태이거나 네트워크가 끊기면 늦어질 수 있으며, 화면 복귀 시 다시 확인합니다.
진행자 화면은 `집계 새로고침`으로 최신 상태를 불러옵니다.

## 5. 저장소·권한

- Supabase `public.workshop_votes` 테이블과 앞서 실행한 SQL을 그대로 사용합니다.
- 브라우저에는 Supabase 비밀키를 전달하지 않습니다.
- 참가자용 API는 전체 득표수 또는 자기 참여 코드의 표만 반환합니다.
- 전체 개인 참여 코드·참가 번호별 선택은 진행자 API 로그인 후에만 반환합니다.
- 투표·변경·취소는 모두 동일한 DB 행을 갱신하므로, 이 구현에서는 코드 하나가 유효한 표 하나에 대응합니다. 실제 사람의 신원을 확인하는 실명 인증은 아닙니다.
- 공개 화면에는 앞서 요청한 동료 사진·이름이 포함되어 있습니다. 메인 페이지 자체는 링크로 접속 가능한 구조입니다.

## 6. 연결 오류별 확인

| 화면 메시지 | 확인할 항목 |
|---|---|
| 서버 연결 설정이 필요합니다 | Vercel 환경변수 이름, Supabase URL, Secret key 입력과 Redeploy 여부 |
| 투표 저장소를 확인하지 못했습니다 | URL이 맞는지, Secret key가 유효한지, setup.sql의 권한 설정이 완료됐는지 |
| 11명용 투표 저장소가 준비되지 않았습니다 | Supabase SQL Editor에서 `select count(*) from public.workshop_votes;` 결과가 11인지 |
| 진행자 비밀번호가 올바르지 않습니다 | Vercel에 설정한 `WORKSHOP_ADMIN_PASSWORD`와 입력값이 같은지 |
| 공동 투표 서버를 확인하지 못했습니다 | HTML만 단독 업로드하지 않았는지, `api/`와 `lib/`가 저장소 최상단에 있는지 |
| 연습용 화면입니다 | 개발용 `npm run dev` 화면입니다. 실제 투표는 Production 배포 URL에서 진행합니다. |

이미 SQL 실행이 끝났으면 `sql/setup.sql`을 다시 실행할 필요가 없습니다. 다시 실행해도 기존 표·참여 코드는 지우지 않습니다.

## 7. 개발 확인

Node.js 24 이상에서 외부 패키지 설치 없이 `npm test`로 API 동작을 확인합니다.
`npm run dev`는 모의 데이터를 사용하며 실제 Supabase에는 저장하지 않습니다.
연습 화면 진행자 비밀번호는 `PreviewOnlyPassword123!`입니다. 이 문자열을 실제 운영 비밀번호로 사용하지 마세요.
모의 저장소는 `scripts/`에 있으며 Production API에서는 불러오지 않습니다.

## 공식 문서

- Vercel Git 배포: https://vercel.com/docs/git
- Vercel Node.js 함수: https://vercel.com/docs/functions/runtimes/node-js
- Vercel 환경변수: https://vercel.com/docs/environment-variables/managing-environment-variables
- Supabase API 키: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
