# Zero Zero 2 - Pickleball Club Management System

## 📋 프로젝트 개요

Zero Zero 2는 피클볼 클럽을 위한 모바일 친화적인 관리 시스템입니다. 회원 관리, 구장 관리, 게임 결과 기록 및 통계를 제공합니다.

## ✨ 주요 기능

### 👥 회원 관리 (P_member)
- 회원 등록, 수정, 삭제
- 회원별 게임 통계 (승률, 승수, 패수, 참여횟수)
- 카드 형태의 직관적인 UI

### 🏟️ 구장 관리 (P_court)
- 구장 등록, 수정, 삭제
- 게임 결과와 연동

### 🏆 게임 결과 관리 (P_game_result)
- 게임 결과 기록 (날짜, 회원, 구장, 승수, 패수)
- 날짜 + 회원 복합키로 중복 방지
- 표 형태의 결과 조회
- 자동 승률 계산

## 🛠️ 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Supabase (PostgreSQL)
- **Styling**: Custom CSS with modern design
- **Icons**: Font Awesome
- **Logo**: Samsung SVG

## 📁 프로젝트 구조

```
zerozero2/
├── index.html          # 메인 HTML 파일
├── app.js              # JavaScript 로직
├── styles2.css         # 스타일시트
├── supabase-config.js  # Supabase 설정
├── Samsung_Logo.svg    # Samsung 로고
└── README.md           # 프로젝트 문서
```

## 🚀 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone [repository-url]
cd zerozero2
```

### 2. Supabase 설정
1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. `supabase-config.js` 파일에서 URL과 API 키 설정
3. 데이터베이스 테이블 생성 (아래 SQL 참조)

### 3. 로컬 실행
```bash
# 간단한 HTTP 서버 실행 (Python 3)
python -m http.server 8000

# 또는 Node.js http-server 사용
npx http-server

# 브라우저에서 http://localhost:8000 접속
```

## 🗄️ 데이터베이스 스키마

### P_member 테이블
```sql
CREATE TABLE public."P_member" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  department text,
  created_at timestamp with time zone DEFAULT now()
);
```

### P_court 테이블
```sql
CREATE TABLE public."P_court" (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
```

### P_game_result 테이블
```sql
CREATE TABLE public."P_game_result" (
  game_date date NOT NULL,
  member_id uuid NOT NULL,
  court_id uuid NOT NULL,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (game_date, member_id),
  FOREIGN KEY (member_id) REFERENCES public."P_member"(id) ON DELETE CASCADE,
  FOREIGN KEY (court_id) REFERENCES public."P_court"(id) ON DELETE CASCADE
);
```

## 🎨 UI/UX 특징

- **모던 디자인**: 그라데이션 배경과 글래스모피즘 효과
- **반응형**: 모바일, 태블릿, 데스크톱 지원
- **직관적 인터페이스**: 카드 기반 레이아웃과 표 형태 데이터 표시
- **부드러운 애니메이션**: 호버 효과와 전환 애니메이션

## 📱 모바일 최적화

- 터치 친화적인 버튼 크기
- 반응형 그리드 레이아웃
- 모바일 우선 CSS 미디어 쿼리
- 가로/세로 모드 지원

## 🔧 주요 기능 상세

### 회원 통계 자동 계산
- 각 회원의 총 게임 수, 승수, 패수, 승률 자동 집계
- 실시간 통계 업데이트

### 중복 데이터 방지
- 게임 결과는 날짜 + 회원 조합으로 유니크 제약
- UPSERT 방식으로 중복 입력 시 자동 업데이트

### 데이터 검증
- 필수 필드 검증
- 숫자 입력 검증
- 날짜 형식 검증

## 🚨 주의사항

- Supabase 프로젝트의 RLS(Row Level Security) 정책 설정 필요
- 브라우저에서 CORS 정책 확인
- 로컬 개발 시 HTTPS 필요할 수 있음

## 📞 지원

문제가 발생하거나 기능 요청이 있으시면 이슈를 생성해 주세요.

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

**Zero Zero 2** - Samsung Pickleball Club Management System
