# Cloudflare R2 프로필 이미지 설정

프로필 이미지는 브라우저에서 Cloudflare R2로 직접 업로드합니다. Vercel API는 로그인과 파일 메타데이터를 검증하고 5분짜리 Presigned PUT URL을 발급한 뒤, 업로드 완료 시 R2 객체를 다시 확인합니다.

DB에는 공개 URL이나 Presigned URL을 저장하지 않습니다. `app_users.picture_key`에는 `users/{userId}/images/{yyyy}/{mm}/{uuid}.{ext}` 형식의 R2 object key만 저장하고, API 응답을 만들 때 `R2_PUBLIC_BASE_URL`과 결합합니다. 업로드 중에는 서버가 발급한 key만 `app_users.pending_picture_key`에 임시 저장하고, 완료 API가 검증·저장에 성공하면 이 값을 비웁니다.

## 필요한 Vercel 환경변수

다음 값을 Vercel 프로젝트의 Production, Preview, Development 환경에 각각 설정합니다. 실제 값은 Git에 커밋하지 않습니다.

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_BASE_URL
```

- `R2_ACCOUNT_ID`: S3 API endpoint의 Cloudflare account ID
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`: 대상 버킷에만 Object Read & Write 권한이 있는 R2 API token 자격 증명
- `R2_BUCKET_NAME`: 프로필 이미지를 저장할 버킷 이름
- `R2_PUBLIC_BASE_URL`: 객체를 공개 조회할 때 사용할 origin. 끝의 `/`는 생략합니다.

S3 API endpoint는 서버가 `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` 형식으로 생성합니다. 이 endpoint는 업로드 서명용이며 `R2_PUBLIC_BASE_URL`로 사용하지 않습니다.

## R2 CORS

R2 버킷의 Settings → CORS Policy에 실제 앱 origin을 등록합니다. 아래 origin은 배포 환경에 맞게 조정하고, Vercel Preview를 시험할 때는 해당 Preview origin도 명시적으로 추가합니다.

```json
[
  {
    "AllowedOrigins": [
      "https://cue-sheet-two.vercel.app",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Presigned URL에 `Content-Type`과 신청한 파일의 `Content-Length`가 서명되므로 PUT 요청은 반드시 같은 MIME과 바이트 크기를 보내야 합니다. 브라우저는 `File` body에 맞는 `Content-Length`를 자동으로 설정합니다. CORS가 없거나 origin/header가 일치하지 않으면 브라우저의 preflight 또는 PUT 요청이 차단됩니다.

Cloudflare 문서:

- [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Configure CORS](https://developers.cloudflare.com/r2/buckets/cors/)

## 공개 URL

개발 중에는 버킷 Settings의 Public Development URL을 켜고 발급된 `https://...r2.dev` 주소를 `R2_PUBLIC_BASE_URL`로 사용할 수 있습니다. `r2.dev`는 제한이 있는 개발용 endpoint입니다.

운영 전에는 버킷에 Cloudflare custom domain을 연결하고 `R2_PUBLIC_BASE_URL`을 그 HTTPS origin으로 교체합니다. S3 Presigned URL은 계속 Cloudflare S3 API domain을 사용합니다.

- [Public buckets and custom domains](https://developers.cloudflare.com/r2/buckets/public-buckets/)

## DB 마이그레이션

다음 마이그레이션을 순서대로 운영 DB에 적용합니다.

1. `migrations/001_add_app_users_picture_key.sql`
2. `migrations/002_add_app_users_pending_picture_key.sql`

서버의 기존 스키마 보정 코드도 같은 컬럼을 비파괴적으로 추가하지만, 운영 변경 이력은 마이그레이션 파일을 기준으로 관리합니다.

기존 `picture_url`은 이미 저장된 Google 또는 과거 프로필 이미지의 호환 표시용으로만 읽습니다. 신규 Google 로그인과 R2 업로드는 전체 이미지 URL을 저장하지 않으며, R2 업로드가 완료되면 `picture_key`만 저장하고 해당 사용자의 `picture_url`은 비웁니다.

## 배포 후 확인

1. 로그인한 상태에서 JPG, PNG, WebP 또는 AVIF 파일을 선택합니다.
2. 브라우저 Network에서 Vercel의 `uploads/presign`, R2로 향하는 PUT, Vercel의 `uploads/complete` 순서를 확인합니다.
3. PUT 요청 body가 Vercel API를 거치지 않는지 확인합니다.
4. R2 Objects에서 `users/{userId}/images/...` 객체를 확인합니다.
5. DB의 `picture_key`가 상대 object key이고 `picture_url`에 새 공개 URL이 저장되지 않았으며, 성공 후 `pending_picture_key`가 빈 문자열인지 확인합니다.
6. 새로고침 후 프로필, 회원 목록과 그룹 멤버 이미지가 표시되는지 확인합니다.
7. `/api/album-art`와 `/api/album-image` 기능이 계속 동작하는지 확인합니다.

## 보안과 정합성

- Presigned URL은 300초 뒤 만료되는 bearer credential이므로 로그에 기록하거나 공유하지 않습니다.
- Presigned PUT 서명에 `Content-Type`과 `Content-Length`를 포함해 Presign에 신청한 MIME·크기와 다른 업로드를 R2가 거부하게 합니다.
- 서버는 완료 요청에서 로그인 사용자 prefix, 실제 Content-Type과 Content-Length를 `HeadObject`로 다시 검사합니다.
- 같은 사용자에게 여러 Presign을 발급하면 가장 최근에 발급한 `pending_picture_key`만 완료할 수 있습니다. 교체된 이전 key의 완료 요청은 DB를 되돌리지 않고 거부됩니다.
- DB 저장 실패 또는 완료 검증 실패 시 서버가 새 객체 삭제를 시도합니다.
- 이미지 교체는 새 key의 DB 저장이 성공한 뒤 이전 key를 삭제합니다.
- Presign 뒤 PUT만 하고 완료 요청을 보내지 않은 객체는 고아 객체가 될 수 있습니다. 운영에서는 주기적인 DB/R2 정합성 점검을 권장합니다.
- 로컬 자격 증명 파일과 `.env.local`은 Git 및 Vercel 업로드 대상에서 제외합니다.
