# TECH.md - Next.js + Firebase + TypeScript 통합 개발 가이드 (v5.0)
**최종 수정일**: 2026-03-11

⚠️ **Next.js 정적 Export + Firebase 전용 가이드**

---

## 🚨 **중요: 정적 Export + Firebase Functions 전용 가이드**

**이 가이드는 Next.js 정적 Export (`output: 'export'`) + Firebase Functions 전용입니다.**

- ✅ **Firebase Hosting만 사용** (SSR/ISR 없음)
- ✅ **백엔드는 Firebase Functions만 사용** (Cloud Functions for Firebase)
- ✅ **Firebase Functions는 v2 API만 사용**
- ✅ **소규모 프로젝트 최적화** (복잡도 최소화)
- ✅ **Firestore 접근은 Functions 경유 권장** (rules 단순화, 보안 로직은 TypeScript로. 실시간 리스너 필요 시에만 클라이언트 직접 접근 허용)
- ❌ **SSR/ISR 금지** (필요하면 Vercel 사용)
- ❌ **frameworksBackend 사용 금지** (정적 파일만)
- ❌ **GCD 사용 금지**

---

## 🎯 핵심 원칙

### 1. 기존 함수 활용 우선
- ✅ 새 기능 구현 전, 기존 함수가 있는지 **반드시** 확인
- ✅ 재사용 가능하면 기존 함수 확장
- ✅ 완전히 다른 기능일 때만 신규 생성

### 2. 모듈화
- ✅ 기능별 파일 분리
- ✅ 공통 함수는 `lib/` 폴더에 모아둠
- ✅ 타입은 `types/` 폴더에 중앙 관리

### 3. Firebase Modular SDK
- ✅ Modular import 방식만 사용 — 항상 최신 stable 사용
- ❌ v8 compat 방식 절대 금지

### 4. Firebase 단일 배포
- ✅ 배포 타깃은 Firebase Hosting + Cloud Functions만 사용
- ❌ Vercel, Cloud Run 등 타 호스팅 플랫폼 사용 금지
- ✅ `firebase.json`/`firebase deploy` 파이프라인을 표준으로 유지

---

## 🔥 **핵심 기술 스택**

### Frontend Framework
- **프론트엔드**: Next.js (App Router) — 항상 최신 stable 사용 (2026.03 기준 15 이상 권장, 14는 EOL)
- **언어**: TypeScript 5+ (엄격 모드)
- **스타일링**: TailwindCSS — 항상 최신 stable 사용 (2026.03 기준 v4.x, v3→v4는 설정 방식 변경: tailwind.config.js → CSS-first). 인라인 스타일 금지, shadcn/ui 적극 권장

### UI & Forms
- **UI 컴포넌트**: shadcn/ui (선택사항 - 권장)
- **아이콘**: lucide-react (선택사항)
- **폼 관리**: react-hook-form + Zod (권장)

### Backend & State
- **백엔드**: Firebase Modular SDK (Auth, Firestore, Storage) — 항상 최신 stable 사용
- **API**: Firebase Functions (v2) Callable만 사용 (HTTP onRequest는 웹훅 등 외부 연동 한정)
- **Next.js Route Handler 금지** (정적 Export 환경에서는 배포되지 않음)
- **검증**: Zod 스키마 필수 (v3 또는 v4 — 프로젝트 내 버전 통일)
- **상태관리**:
  - 로컬 상태: React useState/useReducer
  - 전역 상태: Zustand (선택사항 - 권장)

### test
- **테스트**: vitest

---

## 📁 폴더 구조 (권장)

```
project-name/
├── app/                    # Next.js 페이지 (정적 Export)
│   ├── (auth)/            # 라우트 그룹 (URL에 포함 안 됨)
│   └── [dynamic]/         # 동적 라우팅 (generateStaticParams 필요)
├── components/            # 재사용 컴포넌트
│   ├── ui/               # shadcn/ui 컴포넌트 (자동 생성)
│   └── [feature]/        # 기능별 컴포넌트
├── lib/                   # 라이브러리 설정 ⭐ 핵심
│   ├── firebase.ts       # Firebase 초기화 (단 1개 파일)
│   ├── firestore-schema.ts  # Firestore 컬렉션 상수 (중앙 관리)
│   ├── firestore-helpers.ts # Firestore 읽기 전용 헬퍼 (CUD는 Functions 경유)
│   ├── auth.ts           # 인증 관련 함수
│   ├── validation.ts     # Zod 스키마
│   └── store.ts          # Zustand 스토어 (선택)
├── types/                 # TypeScript 타입 정의 ⭐ 중앙 관리
│   ├── index.ts          # 모든 타입 export
│   ├── user.ts           # 사용자 타입
│   └── [entity].ts       # 프로젝트 데이터 타입들
├── hooks/                 # 커스텀 훅
│   ├── useAuth.ts
│   └── use[Feature].ts
├── utils/                 # 유틸리티 함수
└── functions/             # Firebase Functions (서버 로직)
    ├── src/
    │   ├── index.ts       # 함수 export
    │   ├── types/         # Functions 전용 타입 (또는 프론트 types/ 복제)
    │   ├── utils/         # 컬렉션 상수, 헬퍼 등
    │   └── [feature]/     # 기능별 함수
    ├── package.json
    └── tsconfig.json
```

### ⚠️ 프론트/Functions 간 타입 공유

Functions는 별도 `tsconfig.json` (`rootDir: ./src`)을 사용하므로 프론트의 `@/types`를 직접 import할 수 없다. 공유 방법:

| 방법 | 설명 | 적합 |
|------|------|------|
| **복제** | 프론트 `types/`의 필요 타입을 `functions/src/types/`에 복사 | 소규모, 타입 적을 때 |
| **공유 패키지** | 루트에 `shared/types/`를 두고 양쪽에서 참조 (tsconfig paths) | 타입이 많을 때 |

> **AI 주의**: Functions 코드에서 `../../types/` 같은 rootDir 밖 import를 하면 빌드 실패. 반드시 `functions/src/` 안에 있는 타입만 import할 것.

---

## 🚀 배포 & CI (Firebase 전용 - 정적 Export)

### 1. Next.js 설정 (필수)

**next.config.ts**
```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',  // 정적 빌드 (SSR 비활성화)
  reactStrictMode: true,
  images: {
    unoptimized: true,  // Firebase Hosting은 이미지 최적화 미지원
  },
  trailingSlash: true,  // 정적 호스팅 권장
}

export default nextConfig
```

### 2. Firebase 설정

**firebase.json**
```json
{
  "hosting": {
    "public": "out",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "cleanUrls": true,
    "rewrites": [
      {
        "source": "/share/**",
        "function": "ogMeta"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs22"
  }
}
```

### 3. 프로젝트 초기화

```bash
# Firebase 초기화 (처음 한 번만)
firebase init hosting functions

# 선택 사항:
# - Hosting: Yes (public: out)
# - Functions: Yes (Node.js 22)
# - SSR/Frameworks: No (정적 Export만 사용)
```

### 4. 배포 파이프라인

**로컬 배포:**
```bash
pnpm build                          # Next.js 정적 빌드 (out/ 폴더 생성)
firebase deploy --only hosting      # Hosting만 배포
firebase deploy --only functions    # Functions만 배포 (필요 시)
```

**CI/CD (GitHub Actions):**
```yaml
name: Deploy to Firebase

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v6
        with:
          node-version: 22  # firebase.json runtime과 일치시킬 것
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm build  # Next.js 정적 빌드

      - run: cd functions && npm install && npm run build

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'

      - run: npm install -g firebase-tools

      - run: firebase deploy --only hosting,functions --project "$FIREBASE_PROJECT_ID"
        env:
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
```

### 5. 환경변수 관리

**로컬 개발 (.env.local):**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
```

**Cloud Functions (서버 전용):**

> 권장 순서:
> 1. 일반 설정값은 `firebase-functions/params` 사용
> 2. 민감한 값(API secret, 결제 키 등)은 `defineSecret()` 사용
> 3. `functions/.env`는 로컬 개발용 또는 단순 비민감 설정에 한정

```env
# functions/.env 파일에 기재 (로컬 개발/비민감 설정용)
APP_ENV=development
API_BASE_URL=https://api.example.com
FEATURE_FLAG_NEW_UI=true
```
```typescript
import { defineString, defineSecret } from 'firebase-functions/params'
import { onCall } from 'firebase-functions/v2/https'

// 일반 설정값
const appEnv = defineString('APP_ENV')

// 민감한 키(결제 등)
const stripeKey = defineSecret('STRIPE_SECRET_KEY')

// ⚠️ secret은 반드시 함수 옵션의 secrets 배열에 바인딩해야 함
export const processPayment = onCall(
  { secrets: [stripeKey] },  // ← 필수: 바인딩 없으면 런타임에서 접근 불가
  async (request) => {
    const key = stripeKey.value()   // 바인딩된 함수 안에서만 사용 가능
    const env = appEnv.value()      // 일반 설정값은 바인딩 불필요
    // ...
  }
)
```

### 6. 주의사항

- ✅ **정적 Export만 사용** (SSR/ISR 없음)
- ✅ **AI/외부 API는 Cloud Functions에서 호출**
- ✅ **Next.js는 UI 렌더링만** (서버 로직 금지)
- ❌ **`getServerSideProps` 사용 금지** (정적 빌드 실패)
- ❌ **`revalidate` 사용 금지** (ISR 미지원)

### 7. OG 태그 (동적 공유 미리보기)

> 정적 Export에서는 페이지별 동적 메타태그가 불가능하다.
> 카카오톡/슬랙 등에서 공유 링크 미리보기가 필요하면 **Firebase Functions + Hosting rewrite**로 해결한다.

**흐름:**
1. 공유 URL: `https://도메인/share/{id}`
2. Hosting rewrite → `ogMeta` Function 호출
3. Function이 Firestore에서 데이터 조회 → OG태그 포함 HTML 반환
4. 사용자 클릭 시 실제 앱 페이지로 리다이렉트

**Functions 예시 (`functions/src/og/ogMeta.ts`):**
```typescript
import { onRequest } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'

// HTML 속성값 이스케이프 (XSS 방지)
function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const ogMeta = onRequest(async (req, res) => {
  const id = req.path.split('/').pop()
  if (!id) { res.status(404).send('Not found'); return }

  const doc = await getFirestore().doc(`items/${id}`).get()
  if (!doc.exists) { res.status(404).send('Not found'); return }

  const data = doc.data()!
  const title = escapeAttr(data.title ?? '제목 없음')
  const description = escapeAttr(data.description ?? '')
  const image = escapeAttr(data.thumbnail ?? '')
  const appUrl = `https://도메인/page?id=${encodeURIComponent(id)}`

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${escapeAttr(appUrl)}" />
</head>
<body></body>
</html>`)
})
```

> **주의**: OG태그가 필요 없는 프로젝트(QR 진입, 내부용 등)에서는 이 패턴 불필요. 필요할 때만 추가할 것.

---

### 📊 파일별 역할 명확화

| 파일 | 역할 | 예시 |
|------|------|------|
| `lib/firestore-schema.ts` | 컬렉션/경로 상수 | `COLLECTIONS`, `getCollectionPath` |
| `lib/firestore-helpers.ts` | 읽기 전용 헬퍼 (CUD는 Functions 경유) | `getDocument`, `getCollection` |
| `lib/auth.ts` | 인증 관련 함수 | `signIn`, `signUp`, `signOut` |
| `lib/validation.ts` | Zod 스키마 | `createEntitySchema` |
| `types/*.ts` | 타입 정의만 | `Entity`, `User` (프로젝트별) |
| `hooks/*.ts` | 커스텀 훅 | `useAuth`, `useEntity` (프로젝트별) |
| `functions/src/*.ts` | 서버 로직 (Firebase Functions) | `createGame`, `submitGuess` |

---

## 🏷️ 네이밍 규칙

### 파일명
```typescript
components/UserProfile.tsx          // 컴포넌트: PascalCase.tsx
components/ui/button.tsx           // shadcn/ui: kebab-case.tsx
app/user-profile/page.tsx          // 페이지: kebab-case/page.tsx
utils/dateUtils.ts                 // 유틸: camelCase.ts
lib/firebase.ts                    # 설정: camelCase.ts
lib/store.ts                       # Zustand: store.ts
hooks/useAuth.ts                   # 훅: use+PascalCase.ts
types/user.ts                      # 타입: camelCase.ts
```

### 코드 네이밍
```typescript
export interface UserData {}       // 타입: PascalCase
const MAX_FILE_SIZE = 1024         // 상수: UPPER_SNAKE_CASE
function getUserData() {}          // 함수: camelCase
const UserProfile = () => {}       // 컴포넌트: PascalCase
const useStore = create(() => {})  // Zustand: camelCase
```

### 함수 네이밍 규칙

#### Firestore CRUD 함수
```typescript
// ✅ 패턴: <동사><대상>
createEntity()           // 생성
getEntity(id)            // 단일 읽기
getEntities()            // 목록 읽기
updateEntity(id, data)   // 업데이트
deleteEntity(id)         // 삭제

// 예시: 제품(Product) 관리
createProduct()
getProduct(id)
getProducts()
```

#### 비즈니스 로직 함수
```typescript
// ✅ 패턴: <동사><대상><동작>
generateCode()            // 코드 생성
activateEntity(id)        // 활성화
deactivateEntity(id)      // 비활성화
processPayment(data)      // 결제 처리
```

#### 커스텀 훅
```typescript
// ✅ 패턴: use<대상>
useAuth()                 // 인증 상태
useUser()                 // 사용자 정보
useEntity(id)             // 데이터 조회
useRealtimeEntity(id)     // 실시간 데이터

// 예시
useProduct(id)
useRealtimeOrders()
```

#### 컴포넌트
```typescript
// ✅ PascalCase + 명확한 역할
LoginPage
Dashboard
EntityCard
CreateEntityForm

// 예시
ProductCard
OrderList
CheckoutForm
```

---

## 🔥 TypeScript 필수 규칙

### 1. 타입 정의 (Types)

#### ✅ 필수 사항:
```typescript
// types/entity.ts (예시: 공용 도메인 타입)
// 공용 타입은 Firestore 전용 타입(Timestamp)에 덜 묶이게 유지하는 편이 안전함
import { Timestamp } from 'firebase/firestore'

export interface Entity {
  field1: string
  field2: string
  status: 'active' | 'inactive'
  createdAt: string          // ISO string 권장
  updatedAt: string | null
}

// ID 포함 타입 (Firestore에서 읽을 때)
export interface EntityWithId extends Entity {
  id: string
}

// 저장소 경계에서만 Firestore 타입 사용
export interface FirestoreEntity {
  field1: string
  field2: string
  status: 'active' | 'inactive'
  createdAt: Timestamp
  updatedAt: Timestamp | null
}

// 생성 시 타입 (타임스탬프 제외)
export type CreateEntityInput = Omit<Entity, 'createdAt' | 'updatedAt'>

// 업데이트 시 타입 (부분 업데이트)
export type UpdateEntityInput = Partial<Omit<Entity, 'createdAt'>>
```

#### ❌ 금지 사항:
```typescript
// ❌ any 타입 사용
const data: any = { ... }

// ❌ 인라인 타입 정의
const lecture: { title: string, code: string } = { ... }

// ❌ 타입 단언 남용
const data = someData as Lecture  // 정말 필요한 경우만 사용
```

---

### 2. Firestore 경로/컬렉션 관리

#### ✅ 필수: `lib/firestore-schema.ts` 사용

**firestore-schema.ts** (템플릿 - 프로젝트에 맞게 수정)
```typescript
// ========================================
// Firestore 컬렉션 상수 (중앙 관리)
// AI는 문자열 직접 입력 절대 금지!
// 프로젝트별로 컬렉션명 수정 필요
// ========================================

export const COLLECTIONS = {
  USERS: 'users',
  ITEMS: 'items',           // 예시: 프로젝트 메인 컬렉션
  // 프로젝트에 맞게 추가
} as const

export const SUBCOLLECTIONS = {
  SUB_ITEMS: 'sub_items',   // 예시: 서브컬렉션
  // 프로젝트에 맞게 추가
} as const

// 경로 생성 헬퍼 (오타 방지)
export const getCollectionPath = {
  // Users 컬렉션
  users: () => COLLECTIONS.USERS,
  user: (userId: string) => `${COLLECTIONS.USERS}/${userId}`,

  // 메인 컬렉션 (예시)
  items: () => COLLECTIONS.ITEMS,
  item: (itemId: string) => `${COLLECTIONS.ITEMS}/${itemId}`,

  // 서브컬렉션 (예시)
  subItems: (itemId: string) =>
    `${COLLECTIONS.ITEMS}/${itemId}/${SUBCOLLECTIONS.SUB_ITEMS}`,

  subItem: (itemId: string, subItemId: string) =>
    `${COLLECTIONS.ITEMS}/${itemId}/${SUBCOLLECTIONS.SUB_ITEMS}/${subItemId}`,

  // 프로젝트에 맞게 추가
} as const
```

#### ✅ 사용 방법:
```typescript
import { getCollectionPath } from '@/lib/firestore-schema'
import { doc } from 'firebase/firestore'

// ✅ 올바른 방법
const itemRef = doc(db, getCollectionPath.item('123'))

// ❌ 절대 금지
const itemRef = doc(db, 'items/123')  // 오타 위험!
```

---

### 3. 공통 함수 관리

#### `lib/firestore-helpers.ts` — 클라이언트 직접 접근 한정 (실시간 리스너 등)

> **원칙**: 데이터 변경(CUD)은 Firebase Functions 경유 권장. 아래 헬퍼는 실시간 구독이나 읽기 전용, 또는 Firestore Rules만으로 충분히 보호되는 단순 클라이언트 접근에 한해 사용.

**firestore-helpers.ts** (읽기 전용 — CUD는 Firebase Functions 경유)
```typescript
import {
  doc,
  getDoc,
  collection,
  getDocs,
} from 'firebase/firestore'
import { db } from './firebase'

// ========================================
// 클라이언트 읽기 전용 헬퍼 (중복 방지)
// CUD는 반드시 Firebase Functions 경유!
// AI는 이 함수를 재사용해야 함!
// ========================================

/**
 * 문서 읽기 (Read)
 * @param path - Firestore 경로
 * @returns 문서 데이터 (없으면 null)
 */
export async function getDocument<T>(
  path: string
): Promise<(T & { id: string }) | null> {
  const docRef = doc(db, path)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return null
  }

  return { id: docSnap.id, ...docSnap.data() } as T & { id: string }
}

/**
 * 컬렉션 전체 조회
 * @param path - 컬렉션 경로
 * @returns 문서 배열
 */
export async function getCollection<T>(
  path: string
): Promise<(T & { id: string })[]> {
  const collectionRef = collection(db, path)
  const querySnapshot = await getDocs(collectionRef)

  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as (T & { id: string })[]
}
```

#### ✅ 클라이언트 사용 예시 (읽기/실시간 구독 한정):
```typescript
import { getDocument, getCollection } from '@/lib/firestore-helpers'
import { getCollectionPath } from '@/lib/firestore-schema'
import type { FirestoreEntity, Entity } from '@/types'

// ✅ 읽기 — 클라이언트에서 직접 접근 OK
async function getItem(itemId: string) {
  const path = getCollectionPath.item(itemId)
  const rawItem = await getDocument<FirestoreEntity>(path)

  if (rawItem) {
    const item: Entity = {
      ...rawItem,
      createdAt: rawItem.createdAt.toDate().toISOString(),
      updatedAt: rawItem.updatedAt
        ? rawItem.updatedAt.toDate().toISOString()
        : null,
    }
    console.log(item.field1)  // 타입 안전
  }
}

// ✅ 데이터 변경(CUD) — Functions 경유 필수
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '@/lib/firebase'
const functions = getFunctions(app, 'asia-northeast3')  // 서버 리전과 일치 필수

async function createItem(data: CreateEntityInput) {
  const result = await httpsCallable(functions, 'createItem')(data)
  return result.data
}

// ❌ 금지: 클라이언트에서 직접 CUD
async function createItemBad(data: any) {
  const ref = doc(db, 'items/123')  // 오타 위험 + 보안 rules 복잡화
  await setDoc(ref, { ...data, createdAt: serverTimestamp() })
}
```

#### 🔁 AI 코드 생성 시 추가 권장 패턴
- `zod` 스키마를 단일 소스로 선언하고, 여기에서 타입과 컬렉션/필드 상수를 자동 생성하면 AI가 문자열을 새로 만들지 않아도 됩니다.
- `pnpm generate:schema` 같은 스크립트를 만들어 스키마 → 타입 → 상수가 항상 동시에 갱신되도록 CI에 포함하세요.
- Firestore 구조 변경 시 `스키마 갱신 → 코드 생성 실행 → Firestore 호출부 확인` 순서를 체크리스트로 운영합니다.

```typescript
// lib/firestore-schema.ts
import { z } from 'zod'

const userSchema = z.object({
  displayName: z.string(),
  interests: z.array(z.string()),
})

export type UserDocument = z.infer<typeof userSchema>

const buildFieldMap = <T extends z.AnyZodObject>(schema: T) =>
  Object.freeze(
    Object.fromEntries(
      Object.keys(schema.shape).map(key => [key, key])
    ) as Record<keyof z.infer<T>, keyof z.infer<T>>
  )

export const COLLECTIONS = {
  USERS: {
    name: 'users',
    fields: buildFieldMap(userSchema),
  },
} as const
```

- **장점**: 스키마가 단일 진실원(Source of Truth)이 되어 상수/타입/런타임 검증이 일관되게 유지되고, 하드코딩 문자열이 구조적으로 사라집니다.
- **주의**: 동적 필드가 많을수록 스키마가 복잡해지니 `z.union`, `z.record` 등으로 명시적인 모델을 유지하고, 코드 생성 산출물을 커밋해 변경 이력을 추적하세요.

---

## 🔧 필수 구현 패턴

### 1. 컴포넌트 - 로딩/에러 상태 필수
```typescript
'use client'
import { useState } from 'react'

export function MyComponent() {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // ...
}
```

---

### 2. Zustand 전역 상태 (선택사항)

**lib/store.ts**
```typescript
import { create } from 'zustand'
import type { User } from '@/types'

interface AppState {
  user: User | null
  currentLectureId: string | null
  setUser: (user: User | null) => void
  setCurrentLectureId: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  currentLectureId: null,
  setUser: (user) => set({ user }),
  setCurrentLectureId: (id) => set({ currentLectureId: id }),
}))
```

**사용 예시**
```typescript
import { useAppStore } from '@/lib/store'

// 컴포넌트 내에서
const user = useAppStore((state) => state.user)
const setUser = useAppStore((state) => state.setUser)
```

#### ❌ 금지: 전역 변수
```typescript
// ❌ 절대 금지
let currentUser = null
let currentLectureId = null
```

---

### 3. shadcn/ui 컴포넌트 사용
```typescript
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

<Button variant="default" size="lg">클릭</Button>
```

---

### 4. react-hook-form + Zod 검증
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const FormSchema = z.object({
  email: z.string().email('올바른 이메일을 입력하세요'),
  password: z.string().min(6, '최소 6자 이상'),
})

export function LoginForm() {
  const form = useForm({
    resolver: zodResolver(FormSchema),
  })

  const onSubmit = (data) => {
    // data는 이미 검증됨
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* ... */}
    </form>
  )
}
```

---

### 5. API 호출 - 재시도 로직 (선택사항)
```typescript
const fetchWithRetry = async (
  fn: () => Promise<any>,
  retries = 3
) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) throw error
    }
  }
}
```

---

## 🛡️ 보안 패턴

### XSS 방지
```typescript
// ✅ 올바른 방법
element.textContent = userInput

// ❌ 금지
element.innerHTML = userInput
```

### 환경변수 관리 (.env.local)

> **주의**: 정적 Export 아키텍처에는 Next.js 런타임 서버가 없다.
> `.env.local`은 **빌드타임/로컬 개발용**으로만 유효하며, 비밀값(API secret 등)은 Functions의 `defineSecret()`으로 관리할 것.

```env
# 빌드타임 전용 — NEXT_PUBLIC_ 접두사는 클라이언트 번들에 포함됨 (비밀값 금지)
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
```

---

## 📊 성능 최적화

### 1. 동적 import로 코드 분할
```typescript
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(
  () => import('./HeavyComponent'),
  { loading: () => <p>Loading...</p> }
)
```

### 2. Firestore 쿼리 최적화
```typescript
import { query, collection, where, limit } from 'firebase/firestore'

const q = query(
  collection(db, 'users'),
  where('status', '==', 'active'),
  limit(10)
)
```

### 3. 이미지 최적화 (Next.js Image)
```typescript
import Image from 'next/image'

<Image
  src="/photo.jpg"
  alt="photo"
  width={500}
  height={300}
  priority // LCP 이미지는 priority 추가
/>
```

---

## 🔄 에러 처리 표준

### 필수 패턴
```typescript
import { FirebaseError } from 'firebase/app'

try {
  setLoading(true)
  const result = await apiCall()
  setData(result)
} catch (error) {
  if (error instanceof FirebaseError) {
    setError('Firebase 연결 오류: ' + error.code)
  } else if (error instanceof Error) {
    setError(error.message)
  } else {
    setError('알 수 없는 오류 발생')
  }
} finally {
  setLoading(false)
}
```

---

## 🎯 서버 로직 - Firebase Functions (필수)

> **중요**: Next.js Route Handler는 정적 Export에서 배포되지 않습니다.
> 모든 서버 로직은 **Firebase Functions**로 구현하세요.

### Firebase Functions 구조
```
functions/
├── src/
│   ├── index.ts           # 함수 export
│   ├── [feature]/         # 기능별 폴더
│   │   ├── onCreate.ts    # Firestore 트리거
│   │   ├── onCall.ts      # Callable 함수
│   │   └── http.ts        # HTTP 함수
│   └── lib/               # 공통 유틸
├── package.json
└── tsconfig.json
```

### ⚠️ Functions v2 리전 설정 (필수)

> **중요**: Firebase Functions v2는 `firebase.json`의 region 설정을 **무시**합니다.
> 코드에서 직접 리전을 지정해야 합니다.

**`functions/src/index.ts`에서 전역 설정 (권장)**
```typescript
import { setGlobalOptions } from 'firebase-functions/v2'

// 모든 함수에 리전 적용
setGlobalOptions({ region: 'asia-northeast3' })

// 이후 export
export { createGame } from './game/createGame'
// ...
```

**개별 함수에서 설정 (대안)**
```typescript
export const myFunc = onCall(
  { region: 'asia-northeast3' },  // 옵션 객체로 리전 지정
  async (request) => { ... }
)
```

| 방법 | firebase.json | setGlobalOptions | 개별 함수 옵션 |
|------|---------------|------------------|----------------|
| Functions v1 | ✅ 적용됨 | - | - |
| Functions v2 | ❌ 무시됨 | ✅ 권장 | ✅ 가능 |

**기본값**: 리전 미지정 시 `us-central1`로 배포됨

---

### Callable 함수 패턴 (권장)
```typescript
// functions/src/game/createGame.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { z } from 'zod'
import { COLLECTIONS } from '../utils/firestore'        // 중앙화된 컬렉션 상수

// ✅ Zod 스키마로 런타임 검증 (타입 단언만으로는 불충분)
const createGameSchema = z.object({
  teamCount: z.number().int().min(2).max(10),
  timeout: z.number().int().min(10).max(300),
})

export const createGame = onCall(async (request) => {
  // 인증 확인
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인 필요')
  }

  // ✅ 런타임 검증 — request.data는 외부 입력이므로 반드시 parse
  const parsed = createGameSchema.safeParse(request.data)
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message)
  }

  const data = parsed.data
  const db = getFirestore()

  // ✅ 컬렉션 상수 사용 (문자열 직접 입력 금지)
  const gameRef = await db.collection(COLLECTIONS.GAMES).add({
    hostId: request.auth.uid,
    teamCount: data.teamCount,
    timeout: data.timeout,
    status: 'waiting',
    createdAt: new Date(),
  })

  return { gameId: gameRef.id }
})
```

### 클라이언트에서 호출
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from '@/lib/firebase'

// ⚠️ 리전 필수: 서버가 asia-northeast3이면 클라이언트도 동일하게 지정
const functions = getFunctions(app, 'asia-northeast3')
const createGame = httpsCallable(functions, 'createGame')

// 호출
const result = await createGame({ teamCount: 4, timeout: 60 })
console.log(result.data.gameId)
```

### HTTP 함수 패턴 (웹훅 등)
```typescript
// functions/src/webhook/stripe.ts
import { onRequest } from 'firebase-functions/v2/https'

export const stripeWebhook = onRequest(async (req, res) => {
  // 웹훅 처리
  res.status(200).send('OK')
})
```

---

## 🔒 AI 개발 시 체크리스트

### 함수 생성 전 확인사항:
- [ ] 읽기/조회면 `lib/firestore-helpers.ts`에 이미 있는 함수인가?
- [ ] CUD 로직이면 Firebase Functions로 구현하는가?
- [ ] 기존 함수를 확장할 수 있는가?
- [ ] 완전히 새로운 기능인가? (그럼 새 파일 생성)

### Firestore 작업 시:
- [ ] `getCollectionPath` 사용했는가?
- [ ] 타입 정의는 `types/` 폴더에서 import 했는가?
- [ ] `any` 타입 사용하지 않았는가?

### 컴포넌트 생성 시:
- [ ] 비슷한 컴포넌트가 이미 있는가?
- [ ] 재사용 가능하게 작성했는가?
- [ ] 네이밍 규칙을 따랐는가?

---

## ⚠️ 정적 Export 제약사항 (CONSTRAINTS)

> **중요:** 이 섹션은 tech.md 생성 시 반드시 PRD와 대조하여 충돌 여부를 확인해야 합니다.
> 충돌 발생 시 사용자에게 알리고 대안을 제시해야 합니다.

### 제약사항 목록

| ID | 제약 | 조건 | 위반 시 | PRD 체크 포인트 |
|----|------|------|--------|----------------|
| **SE-01** | `[param]` 동적 라우트 사용 시 `generateStaticParams` 필수 | 정적 Export | 빌드 실패 | 런타임 생성 ID(gameId, sessionId 등) 있는지 |
| **SE-02** | 런타임 생성 ID로 동적 라우트 불가 | 정적 Export | 페이지 접근 불가 | → 쿼리 파라미터 방식으로 대체 필요 |
| **SE-03** | Route Handler (`app/api/`) 배포 안 됨 | 정적 Export | API 작동 안 함 | 서버 API 필요 시 → Firebase Functions 대체 |
| **SE-04** | `getServerSideProps` 사용 불가 | 정적 Export | 빌드 실패 | SSR 필요 시 → 클라이언트 fetch로 대체 |
| **SE-05** | `revalidate` / ISR 사용 불가 | Firebase Hosting | 동작 안 함 | 주기적 갱신 필요 시 → 클라이언트 polling 또는 realtime |

### 동적 라우팅 대안

PRD에 **런타임 생성 ID 기반 라우팅**이 있으면:

```
❌ 불가능: app/game/[gameId]/page.tsx
   → gameId는 런타임에 생성되므로 generateStaticParams로 미리 생성 불가

✅ 대안 1: 쿼리 파라미터
   app/game/page.tsx → /game?id=abc123
   useSearchParams()로 id 추출

✅ 대안 2: 해시 라우팅
   app/game/page.tsx → /game#abc123
   클라이언트에서 hash 파싱

✅ 대안 3: 단일 페이지 + 클라이언트 라우팅
   모든 게임 관련 UI를 하나의 페이지에서 조건부 렌더링
```

### PRD 검토 시 필수 확인 사항

tech-choice.json 생성 전 다음을 확인하라:

1. **런타임 생성 ID가 URL에 필요한가?**
   - 예: `/game/{gameId}`, `/session/{sessionId}`
   - → SE-01, SE-02 충돌 → 쿼리 파라미터로 대체

2. **서버 사이드 API가 필요한가?**
   - 예: 결제 웹훅, 외부 API 프록시
   - → SE-03 충돌 → Firebase Functions로 대체

3. **SSR/ISR이 필요한가?**
   - 예: SEO 중요, 동적 메타태그
   - → SE-04, SE-05 충돌 → 정적 Export 대신 Vercel 고려

---

## 🚨 절대 금지 사항

### 아키텍처:
- ❌ **Next.js Route Handler 사용** (app/api/*.ts) - 정적 Export에서 배포 안 됨
- ❌ **getServerSideProps 사용** - 정적 빌드 실패
- ❌ **revalidate/ISR 사용** - Firebase Hosting 미지원
- ❌ **서버 컴포넌트에서 DB 직접 접근** - 클라이언트 또는 Functions만

### TypeScript:
- ❌ `any` 타입 사용
- ❌ 문자열로 Firestore 경로 직접 입력
- ❌ 인라인 타입 정의
- ❌ 타입 단언 남용 (`as` 키워드)
- ❌ 기존 함수 무시하고 중복 생성

---

## ✅ AI 프롬프트 예시

### 좋은 프롬프트:
```
"엔티티를 비활성화하는 Callable 함수를 만들어줘.
- functions/src/utils/firestore.ts의 COLLECTIONS 상수 사용
- functions/src/types/의 Entity 타입 사용
- onCall + HttpsError 패턴으로 인증 확인 포함"
```

### 나쁜 프롬프트:
```
"비활성화 함수 만들어줘"
→ AI가 모든 걸 새로 만들 가능성 있음
→ 어떤 엔티티인지, 어떤 함수를 재사용할지 불명확
```

---

## 🎯 요약

1. **기존 함수 우선 확인** → 재사용/확장 → 마지막에 신규 생성
2. **타입은 각 환경의 types/ 폴더에서 import** (프론트: `types/`, Functions: `functions/src/types/`)
3. **Firestore 경로는 getCollectionPath 사용**
4. **데이터 변경(CUD)은 Functions 경유, 읽기/구독은 firestore-helpers 허용**
5. **상태는 단일 객체로 관리 (Zustand)**
6. **네이밍 규칙 준수**
7. **shadcn/ui + react-hook-form + Zod 활용**

---



