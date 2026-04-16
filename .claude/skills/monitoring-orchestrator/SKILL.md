---
name: monitoring-orchestrator
description: "BCSDLab 모니터링 시스템 개발 오케스트레이터. 새 기능 추가, 메트릭 추가, 차트 추가, 대시보드 수정, 데이터 동기화 수정, DB 스키마 변경, API 추가, 버그 수정, 리팩토링 등 모든 개발 작업을 조율한다. '모니터링', '대시보드', '동기화', '메트릭', '차트', '성과', '팀원', '트랙', 'PR', '커밋', '코멘트', '리뷰' 관련 작업 시 반드시 이 스킬을 사용. 후속 작업: 다시 실행, 재실행, 업데이트, 수정, 보완, 결과 개선, 이전 결과 기반 수정 시에도 반드시 이 스킬을 사용."
---

# Monitoring System Orchestrator

BCSDLab GitHub 팀 성과 모니터링 시스템의 개발 작업을 조율하는 통합 오케스트레이터.

## 실행 모드: 서브 에이전트

소규모 풀스택 프로젝트에 적합한 서브 에이전트 모드를 사용한다. 작업이 순차적(분석→구현→검증)으로 흐르며, 에이전트 간 실시간 통신이 불필요하다.

## 에이전트 구성

| 에이전트 | subagent_type | 역할 | 출력 |
|---------|--------------|------|------|
| planner | planner | 요구사항 분석, 구현 계획 수립 | `_workspace/01_plan.md` |
| developer | developer | 풀스택 코드 구현 | 코드 변경 + `_workspace/02_dev_result.md` |
| qa | qa | 품질 검증, 경계면 교차 비교 | `_workspace/03_qa_report.md` |

## 워크플로우

### Phase 0: 컨텍스트 확인

기존 산출물 존재 여부를 확인하여 실행 모드를 결정한다:

1. `_workspace/` 디렉토리 존재 여부 확인
2. 실행 모드 결정:
   - **`_workspace/` 미존재** → 초기 실행. Phase 1로 진행
   - **`_workspace/` 존재 + 사용자가 부분 수정 요청** → 부분 재실행. 해당 에이전트만 재호출. 기존 산출물 경로를 프롬프트에 포함
   - **`_workspace/` 존재 + 새 입력 제공** → 새 실행. 기존 `_workspace/`를 `_workspace_{YYYYMMDD_HHMMSS}/`로 이동 후 Phase 1 진행

### Phase 1: 분석 및 계획

Planner 에이전트를 호출하여 구현 계획을 수립한다.

```
Agent(
  description: "구현 계획 수립",
  subagent_type: "planner",
  model: "sonnet",
  prompt: "사용자 요청: {user_request}
  
  _workspace/01_plan.md에 구현 계획을 작성하라.
  기존 코드를 반드시 읽고 현재 구조를 파악한 뒤 계획을 세워라.
  
  프로젝트: BCSDLab GitHub 팀 성과 모니터링 시스템
  위치: /Users/kimdohun/Desktop/BCSD/monitoring_system/
  
  [이전 산출물이 있을 경우]
  이전 계획: _workspace/01_plan.md 를 읽고 피드백을 반영하여 개선하라."
)
```

리더는 계획을 확인하고, 규모/방향이 적절한지 검토한다.

### Phase 2: 구현

Developer 에이전트를 호출하여 코드를 구현한다.

```
Agent(
  description: "코드 구현",
  subagent_type: "developer",
  model: "sonnet",
  prompt: "_workspace/01_plan.md를 읽고 구현 계획에 따라 코드를 작성하라.
  
  완료 후 _workspace/02_dev_result.md에 변경 요약을 작성하라.
  
  프로젝트: /Users/kimdohun/Desktop/BCSD/monitoring_system/
  
  [QA 피드백이 있을 경우]
  QA 보고서: _workspace/03_qa_report.md 를 읽고 발견된 문제를 수정하라."
)
```

### Phase 3: 검증

QA 에이전트를 호출하여 구현 결과를 검증한다.

```
Agent(
  description: "품질 검증",
  subagent_type: "qa",
  model: "opus",
  prompt: "_workspace/01_plan.md (계획)과 _workspace/02_dev_result.md (구현 결과)를 읽어라.
  
  변경된 파일들을 모두 읽고 다음을 검증하라:
  1. DB 스키마 ↔ SQL 쿼리 ↔ API 응답 ↔ 프론트엔드 타입 간 정합성
  2. TypeScript 컴파일 확인 (npx tsc --noEmit)
  3. 기존 기능 회귀 여부
  
  결과를 _workspace/03_qa_report.md에 작성하라.
  
  프로젝트: /Users/kimdohun/Desktop/BCSD/monitoring_system/"
)
```

### Phase 4: 피드백 루프 (최대 2회)

QA 결과가 FAIL이면:
1. `_workspace/03_qa_report.md`를 읽어 문제 파악
2. Developer 에이전트를 재호출 (Phase 2)하여 수정
3. QA 에이전트를 재호출 (Phase 3)하여 재검증
4. 최대 2회 반복 후에도 FAIL이면 사용자에게 알리고 남은 문제를 보고

### Phase 5: 정리

1. `_workspace/` 디렉토리 보존 (감사 추적용)
2. 사용자에게 결과 요약 보고:
   - 변경된 파일 목록
   - 주요 변경 내용
   - QA 결과
   - 추가 확인이 필요한 사항 (dev server 실행 후 UI 확인 등)

## 데이터 흐름

```
[사용자 요청]
      ↓
[Planner] → _workspace/01_plan.md
      ↓
[Developer] → 코드 변경 + _workspace/02_dev_result.md
      ↓
[QA] → _workspace/03_qa_report.md
      ↓ (FAIL시)
[Developer] → 수정 (최대 2회 루프)
      ↓
[사용자에게 결과 보고]
```

## 에러 핸들링

| 상황 | 전략 |
|------|------|
| Planner 실패 | 리더가 직접 간략한 계획 수립 후 Developer 호출 |
| Developer 실패 | 1회 재시도. 재실패 시 에러 내용과 함께 사용자에게 보고 |
| QA 실패 | QA 없이 Developer 결과만으로 진행. 사용자에게 수동 검증 요청 |
| 피드백 루프 2회 초과 | 남은 문제 목록을 사용자에게 제시하고 수동 수정 안내 |

## 테스트 시나리오

### 정상 흐름
1. 사용자: "대시보드에 주간 트렌드 차트를 추가해줘"
2. Phase 1: Planner가 DB 쿼리 + 프론트엔드 차트 구현 계획 수립
3. Phase 2: Developer가 API 라우트 + 차트 컴포넌트 구현
4. Phase 3: QA가 데이터 흐름 검증 → PASS
5. Phase 5: 변경 요약 보고

### 에러 흐름
1. 사용자: "새 메트릭을 추가해줘"
2. Phase 1~2: 정상 진행
3. Phase 3: QA가 DB 컬럼명과 프론트엔드 인터페이스 불일치 발견 → FAIL
4. Phase 4: Developer가 수정 → QA 재검증 → PASS
5. Phase 5: 보고 (1회 수정 루프 발생 명시)
