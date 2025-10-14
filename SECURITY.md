# 보안 가이드 (Security Guide)

## 개요
이 문서는 Zero Zero 2 Admin 애플리케이션의 보안 정책과 구현 사항을 설명합니다.

## 비밀번호 암호화 및 저장

### Supabase Authentication 시스템
- **암호화 방식**: Supabase는 bcrypt 알고리즘을 사용하여 비밀번호를 해시화
- **저장 위치**: Supabase의 `auth.users` 테이블에 안전하게 저장
- **솔트(Salt)**: 각 비밀번호마다 고유한 솔트가 자동 생성되어 레인보우 테이블 공격 방지
- **해시 강도**: bcrypt의 기본 라운드 수는 10 (2^10 = 1024회 반복)

### 비밀번호 정책
- **최소 길이**: 6자 이상
- **도메인 제한**: Samsung.com 도메인만 허용
- **회원 검증**: P_member 테이블에 등록된 이메일만 회원가입 가능

## 인증 시스템

### 로그인 프로세스
1. 사용자가 이메일/비밀번호 입력
2. Samsung.com 도메인 검증
3. Supabase Auth API를 통한 인증
4. JWT 토큰 발급 및 세션 관리
5. Row Level Security (RLS) 정책 적용

### 세션 관리
- **토큰 타입**: JWT (JSON Web Token)
- **토큰 저장**: 브라우저의 localStorage
- **자동 갱신**: Supabase가 자동으로 토큰 갱신
- **로그아웃**: 토큰 무효화 및 세션 종료

## 데이터베이스 보안

### Row Level Security (RLS) 정책
모든 테이블에 RLS가 활성화되어 인증된 사용자만 데이터 접근 가능:

#### P_member 테이블
```sql
-- 모든 인증된 사용자가 읽기/쓰기 가능
CREATE POLICY "Enable all for authenticated users" ON "public"."P_member"
FOR ALL USING (auth.role() = 'authenticated');
```

#### P_court 테이블
```sql
-- 모든 인증된 사용자가 읽기/쓰기 가능
CREATE POLICY "Enable all for authenticated users" ON "public"."P_court"
FOR ALL USING (auth.role() = 'authenticated');
```

#### P_game_result 테이블
```sql
-- 모든 인증된 사용자가 읽기/쓰기 가능
CREATE POLICY "Enable all for authenticated users" ON "public"."P_game_result"
FOR ALL USING (auth.role() = 'authenticated');
```

### 데이터 접근 제어
- **익명 접근 차단**: 모든 데이터는 인증된 사용자만 접근 가능
- **API 키 보호**: Supabase anon key는 공개되어도 RLS로 보호됨
- **SQL 인젝션 방지**: Supabase 클라이언트가 자동으로 파라미터화된 쿼리 사용

## 네트워크 보안

### HTTPS 통신
- **전체 통신**: 모든 API 호출이 HTTPS로 암호화
- **Supabase 연결**: TLS 1.2 이상 사용
- **브라우저 보안**: Mixed Content 차단으로 HTTP 요청 방지

### CORS 정책
- **도메인 제한**: 허용된 도메인에서만 API 접근 가능
- **헤더 제한**: 필요한 헤더만 허용
- **메서드 제한**: GET, POST, PUT, DELETE만 허용

## 접근 제어

### 사용자 인증
- **이메일 기반**: Samsung.com 도메인만 허용
- **회원 검증**: 사전 등록된 회원만 계정 생성 가능
- **세션 타임아웃**: 자동 로그아웃 기능

### 관리자 권한
- **단일 관리자**: 현재 모든 인증된 사용자가 동일한 권한
- **데이터 수정**: 모든 사용자가 모든 데이터 수정 가능
- **감사 로그**: Supabase에서 자동으로 모든 작업 로그 기록

## 보안 모범 사례

### 클라이언트 사이드 보안
- **민감 정보**: API 키는 공개되어도 RLS로 보호됨
- **입력 검증**: 클라이언트와 서버 양쪽에서 검증
- **XSS 방지**: 입력 데이터의 적절한 이스케이핑

### 서버 사이드 보안
- **RLS 정책**: 모든 테이블에 적절한 접근 제어
- **SQL 인젝션**: Supabase 클라이언트가 자동 방지
- **CSRF 보호**: SameSite 쿠키 정책 적용

## 보안 체크리스트

### 배포 전 확인사항
- [ ] 모든 테이블에 RLS 정책 적용됨
- [ ] Samsung.com 도메인 제한 활성화
- [ ] HTTPS 통신 확인
- [ ] 비밀번호 정책 준수
- [ ] 회원 검증 로직 작동 확인

### 정기 보안 점검
- [ ] 사용자 계정 정리 (비활성 계정 삭제)
- [ ] 로그 모니터링 (의심스러운 활동 확인)
- [ ] 의존성 업데이트 (보안 패치 적용)
- [ ] 접근 권한 검토

## 보안 사고 대응

### 계정 도용 시
1. 즉시 해당 계정 비활성화
2. Supabase 관리자 패널에서 사용자 삭제
3. 관련 데이터 접근 로그 확인
4. 필요시 데이터 백업 및 복원

### 데이터 유출 시
1. 즉시 시스템 접근 차단
2. 영향 범위 파악
3. 관련 기관 및 사용자 통보
4. 보안 강화 조치 적용

## 연락처
보안 관련 문의사항이 있으시면 시스템 관리자에게 연락하시기 바랍니다.

---
*이 문서는 보안 정책의 일부이며, 정기적으로 업데이트됩니다.*
