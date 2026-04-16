---
name: development-guide
description: "BCSDLab 모니터링 시스템의 개발 가이드. DB 스키마 변경, API 라우트 추가, GitHub 동기화 수정, 프론트엔드 컴포넌트 추가 등 구현 시 참조하는 기술 가이드. 모니터링 시스템 코드를 직접 수정하거나, 구현 방법을 안내할 때 이 스킬을 참조. 동기화 디버그, 데이터 파이프라인, 차트 추가, 메트릭 추가, 테이블 수정, API 엔드포인트 추가 시 사용."
---

# Monitoring System Development Guide

BCSDLab GitHub 팀 성과 모니터링 시스템의 개발 패턴과 컨벤션 가이드.

## 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js 16 (Pages Router) | Turbopack 사용 |
| 언어 | TypeScript 5 | strict mode |
| DB | Neon PostgreSQL (serverless) | `@neondatabase/serverless` |
| 스타일 | Tailwind CSS v4 | tw-animate-css |
| 차트 | Recharts 3 | ResponsiveContainer 패턴 |
| UI 컴포넌트 | Radix UI | Card, Select, Badge, Alert, Button |
| 패키지 매니저 | pnpm | |

## 데이터 흐름

```
GitHub API → GitHubService → DatabaseSyncService → Neon DB
                                                      ↓
                              getServerSideProps ← SQL 쿼리
                                    ↓
                           GitHubTeamDashboard (React)
```

## DB 스키마 변경 패턴

새 테이블이나 컬럼을 추가할 때:

1. `src/lib/db-setup.ts`의 `createTables()` 함수에 `CREATE TABLE IF NOT EXISTS` 또는 `ALTER TABLE` 추가
2. 관련 인덱스도 함께 추가
3. 변경이 `db-sync.ts`의 sync 로직에 영향을 주면 해당 부분도 수정

기존 테이블 구조:
- `team_members` — 팀원 정보 (github_id, track_name 등)
- `team_performances` — 월별 성과 집계 (commits, PRs, comments)
- `pr_activities` — PR 단위 활동 기록
- `review_activities` — 리뷰 활동 기록
- `comment_details` — 코멘트 상세 기록

## API 라우트 추가 패턴

`src/pages/api/` 하위에 파일 생성:

```typescript
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1. 메서드 검증
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // 2. 파라미터 검증
  // 3. 환경변수 검증 (필요시)
  // 4. 비즈니스 로직
  // 5. 응답
}
```

## 프론트엔드 컴포넌트 패턴

### 새 차트 추가

Recharts를 사용하며, 기존 패턴을 따른다:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <IconComponent className="h-5 w-5" />
      차트 제목
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="hsl(var(--primary))" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </CardContent>
</Card>
```

### 새 통계 카드 추가

```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle className="text-sm font-medium">카드 제목</CardTitle>
    <IconComponent className="h-4 w-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">{value}</div>
    <p className="text-xs text-muted-foreground">설명 텍스트</p>
  </CardContent>
</Card>
```

## GitHub 동기화 수정 패턴

동기화 로직은 `src/lib/db-sync.ts`의 `DatabaseSyncService`에 집중되어 있다.

새 데이터를 수집하려면:
1. `GitHubService`에 API 호출 메서드 추가
2. `MonthData` 인터페이스에 새 데이터 필드 추가  
3. `DatabaseSyncService.saveMonthData()`에 저장 로직 추가
4. `updatePerformanceStats()`에 집계 로직 추가

동기화 흐름:
```
syncMonthData()
  → getCompleteMonthData() // GitHub API에서 데이터 수집
  → clearExistingData()    // 해당 월/레포 기존 데이터 삭제
  → saveMonthData()        // 새 데이터 저장
  → updatePerformanceStats() // team_performances 테이블 갱신
```

## 트랙 및 레포지토리 설정

`src/components/GitHubTeamDashboard.tsx`에 하드코딩되어 있다:

```typescript
const TRACKS = ["Frontend Track", "Backend Track", "Android Track", "iOS Track"];
const REPOS = {
  "Frontend Track": ["KOIN_WEB_RECODE", "KOIN_ORDER_WEBVIEW", "KOIN_OWNER_WEB", "B_BOT", "BCSD_INTERNAL_WEB"],
  "Android Track": ["KOIN_ANDROID", "BCSD_INTERNAL_MOBILE"],
  "iOS Track": [],
  "Backend Track": ["KOIN_API_V2"],
};
```

새 트랙이나 레포를 추가하려면 이 상수를 수정한다.

## SSR 데이터 패턴

`getServerSideProps`에서 DB 쿼리를 수행하고 결과를 props로 전달한다:

```typescript
export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  // 1. URL 쿼리 파라미터에서 year/month 추출
  // 2. SQL 쿼리로 데이터 조회
  // 3. 타입 안전한 변환 (String(), Number())
  // 4. props로 반환
};
```

## 주의사항

- Neon serverless는 connection pool이 없으므로 쿼리를 최소화한다
- GitHub API는 rate limit이 있으므로 `delay()`로 간격을 둔다
- `ensureMember()`는 존재하지 않는 GitHub 유저를 자동 등록한다 — track_name이 "Unknown Track"으로 설정됨
- `isSubstantiveComment()`는 휴리스틱 기반이므로 완벽하지 않다
