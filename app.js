// 앱 초기 상태 관리 및 유틸
const $ = (sel) => document.querySelector(sel);
const statusEl = () => $('#status');
const errorsEl = () => $('#errors');
const resultsEl = () => $('#results');

// 아코디언 토글 함수
function toggleSection(sectionName) {
    const content = document.getElementById(`${sectionName}-content`);
    const chevron = document.getElementById(`${sectionName}-chevron`);
    
    if (content && chevron) {
        content.classList.toggle('collapsed');
        
        if (content.classList.contains('collapsed')) {
            chevron.style.transform = 'rotate(-90deg)';
        } else {
            chevron.style.transform = 'rotate(0deg)';
        }
    }
}

function setStatus(text) {
    statusEl().textContent = text;
}

function setError(err) {
    if (!err) {
        errorsEl().textContent = '';
        return;
    }
    const message = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
    errorsEl().textContent = message;
}

function renderResults(data) {
    try {
        resultsEl().textContent = JSON.stringify(data, null, 2);
    } catch (_) {
        resultsEl().textContent = String(data);
    }
}

async function ensureSupabaseReady() {
    if (window.validateSupabaseConfig && !window.validateSupabaseConfig()) {
        throw new Error('Supabase 설정이 유효하지 않습니다. `supabase-config.js`를 확인하세요.');
    }
    const client = window.supabaseClient;
    if (!client) {
        throw new Error('Supabase 클라이언트가 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.');
    }
    return client;
}

// 상단 일반 테이블 조회 기능 제거됨
document.addEventListener('DOMContentLoaded', () => {
    setStatus('Ready');
});


// -------------------------
// P_member / P_court / P_game_result CRUD
// -------------------------

// Helpers
function setJSON(elSelector, data) {
    const el = document.querySelector(elSelector);
    if (el) el.textContent = JSON.stringify(data || [], null, 2);
}

async function refreshCourtOptions() {
    const supabase = await ensureSupabaseReady();
    const { data, error } = await supabase.from('P_court').select('id,name').eq('active', true).order('name');
    if (error) throw error;
    const sel = document.querySelector('#pgameCourt');
    if (!sel) return;
    sel.innerHTML = '';
    for (const row of data || []) {
        const opt = document.createElement('option');
        opt.value = row.id;
        opt.textContent = row.name;
        sel.appendChild(opt);
    }
}

async function refreshMemberOptions() {
    const supabase = await ensureSupabaseReady();
    const { data, error } = await supabase.from('P_member').select('id,name').order('name');
    if (error) throw error;
    const sel = document.querySelector('#pgameMember');
    if (!sel) return;
    sel.innerHTML = '';
    for (const row of data || []) {
        const opt = document.createElement('option');
        opt.value = row.id;
        opt.textContent = row.name;
        sel.appendChild(opt);
    }
}

// P_member
let currentEditingMemberId = null;

async function pmemList() {
    setError('');
    setStatus('Loading P_member...');
    try {
        const supabase = await ensureSupabaseReady();
        const [membersRes, statsMap] = await Promise.all([
            supabase.from('P_member').select('*').limit(200),
            fetchMemberStats()
        ]);
        if (membersRes.error) throw membersRes.error;
        
        // 정렬 옵션에 따라 회원 목록 정렬
        const sortedMembers = sortMembers(membersRes.data || [], statsMap);
        renderMemberCards(sortedMembers, statsMap);
        
        // 기본 정렬이 "이번달 불참"인 경우 참석 현황 메시지 표시
        const sortSelect = document.querySelector('#pmemSort');
        const sortOption = sortSelect?.value || 'absent';
        
        // 초기 로드 시 정렬 옵션을 "이번달 불참"으로 설정
        if (sortSelect && !sortSelect.value) {
            sortSelect.value = 'absent';
        }
        
        // 테이블 헤더 업데이트
        updateTableHeader(sortOption);
        
        if (sortOption === 'absent') {
            updateAttendanceStatus(statsMap);
        }
        
        setStatus(`Loaded ${sortedMembers.length} members`);
    } catch (err) { setError(err); setStatus('Error'); }
}

// DUPR 점수 산정 로직 표시 함수
function pmemShowDUPRLogic() {
    setError('');
    setStatus('DUPR 점수 산정 로직을 표시합니다...');
    
    // DUPR 점수 산정 로직 설명
    const duprLogic = `
🎯 DUPR (Dynamic Universal Pickleball Rating) 점수 산정 로직

📊 기본 점수 계산:
• 90% 이상 승률: 4.5-5.0점
• 80-90% 승률: 3.5-4.5점  
• 70-80% 승률: 2.5-3.5점
• 60-70% 승률: 1.5-2.5점
• 50-60% 승률: 0.5-1.5점
• 50% 미만 승률: 0-0.5점

🏆 등급 시스템:
• 전문가 (4.0+): 👑 빨간색 - 최고 실력자
• 고급 (3.0+): ⭐ 주황색 - 상급 실력자  
• 중급 (2.0+): 🏅 노란색 - 중급 실력자
• 초급 (1.0+): 🌱 초록색 - 초급 실력자
• 입문 (1.0 미만): 🍃 회색 - 입문자

📈 참여도 보정:
• 경기 참여 횟수에 따라 최대 0.2점 보너스
• 더 많은 경기 참여 시 신뢰도 증가
• 참여도 = 경기 결과 기록 횟수

💡 계산 공식:
DUPR = 기본점수 + 참여도보정(최대 0.2점)
최종 점수는 소수점 둘째자리까지 반올림
    `;
    
    // 모달 창으로 표시
    showDUPRLogicModal(duprLogic);
    setStatus('DUPR 점수 산정 로직 표시 완료');
}

// DUPR 로직 모달 표시 함수
function showDUPRLogicModal(content) {
    // 기존 모달이 있으면 제거
    const existingModal = document.querySelector('#duprLogicModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // 모달 생성
    const modal = document.createElement('div');
    modal.id = 'duprLogicModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        position: relative;
    `;
    
    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #1f2937;">🎯 DUPR 점수 산정 로직</h2>
            <button onclick="closeDUPRModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">&times;</button>
        </div>
        <div style="white-space: pre-line; line-height: 1.6; color: #374151; font-family: 'Courier New', monospace; background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">${content}</div>
        <div style="margin-top: 20px; text-align: center;">
            <button onclick="closeDUPRModal()" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px;">확인</button>
        </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeDUPRModal();
        }
    });
}

// 게임결과 폼 초기화 함수
function initializeGameForm() {
    // 오늘 날짜를 YYYY-MM-DD 형식으로 설정
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    
    const dateInput = document.querySelector('#pgameDate');
    if (dateInput) {
        dateInput.value = todayString;
    }
}

// DUPR 모달 닫기 함수
function closeDUPRModal() {
    const modal = document.querySelector('#duprLogicModal');
    if (modal) {
        modal.remove();
    }
}

// 통계 데이터 수집 함수들
async function fetchStatisticsData() {
    try {
        const supabase = await ensureSupabaseReady();
        
        // 모든 게임 결과 데이터 가져오기
        const { data: gameResults, error: gameError } = await supabase
            .from('P_game_result')
            .select('member_id, court_id, game_date, wins, losses')
            .order('game_date', { ascending: false })
            .limit(2000);
            
        if (gameError) throw gameError;
        
        // 모든 회원 데이터 가져오기
        const { data: members, error: memberError } = await supabase
            .from('P_member')
            .select('id, name, department')
            .limit(2000);
            
        if (memberError) throw memberError;
        
        // 모든 구장 데이터 가져오기
        const { data: courts, error: courtError } = await supabase
            .from('P_court')
            .select('id, name')
            .eq('active', true)
            .limit(2000);
            
        if (courtError) throw courtError;
        
        return {
            gameResults: gameResults || [],
            members: members || [],
            courts: courts || []
        };
    } catch (err) {
        console.error('통계 데이터 수집 중 오류:', err);
        return {
            gameResults: [],
            members: [],
            courts: []
        };
    }
}

// 월별 참석자 추이 계산
function calculateMonthlyAttendance(gameResults) {
    const monthlyData = new Map();
    
    gameResults.forEach(result => {
        if (!result.game_date) return;
        
        const date = new Date(result.game_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
        
        if (!monthlyData.has(monthKey)) {
            monthlyData.set(monthKey, {
                month: monthName,
                uniqueParticipants: new Set(),
                totalGames: 0
            });
        }
        
        const monthData = monthlyData.get(monthKey);
        monthData.uniqueParticipants.add(result.member_id);
        monthData.totalGames += 1;
    });
    
    return Array.from(monthlyData.values())
        .map(data => ({
            month: data.month,
            participants: data.uniqueParticipants.size,
            totalGames: data.totalGames
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
}

// 구장별 참여일수 계산
function calculateCourtParticipation(gameResults, courts) {
    const courtData = new Map();
    
    // 구장별로 초기화
    courts.forEach(court => {
        courtData.set(court.id, {
            name: court.name,
            uniqueParticipants: new Set(),
            totalGames: 0,
            uniqueDates: new Set()
        });
    });
    
    // 게임 결과 데이터 처리
    gameResults.forEach(result => {
        if (!result.court_id || !result.game_date) return;
        
        const court = courtData.get(result.court_id);
        if (!court) return;
        
        court.uniqueParticipants.add(result.member_id);
        court.totalGames += 1;
        court.uniqueDates.add(result.game_date);
    });
    
    return Array.from(courtData.values())
        .map(data => ({
            name: data.name,
            participants: data.uniqueParticipants.size,
            totalGames: data.totalGames,
            participationDays: data.uniqueDates.size
        }))
        .sort((a, b) => b.participationDays - a.participationDays);
}

// 회원별 활동 통계 계산
function calculateMemberActivity(gameResults, members) {
    const memberData = new Map();
    
    // 회원별로 초기화
    members.forEach(member => {
        memberData.set(member.id, {
            name: member.name,
            department: member.department,
            totalGames: 0,
            wins: 0,
            losses: 0,
            uniqueDates: new Set(),
            courts: new Set()
        });
    });
    
    // 게임 결과 데이터 처리
    gameResults.forEach(result => {
        if (!result.member_id) return;
        
        const member = memberData.get(result.member_id);
        if (!member) return;
        
        member.totalGames += 1;
        member.wins += result.wins || 0;
        member.losses += result.losses || 0;
        member.uniqueDates.add(result.game_date);
        if (result.court_id) member.courts.add(result.court_id);
    });
    
    return Array.from(memberData.values())
        .filter(data => data.totalGames > 0)
        .map(data => ({
            ...data,
            winRate: data.totalGames > 0 ? Math.round((data.wins / (data.wins + data.losses)) * 100) : 0,
            participationDays: data.uniqueDates.size,
            courtsUsed: data.courts.size
        }))
        .sort((a, b) => b.totalGames - a.totalGames);
}

// 전체 요약 통계 계산
function calculateOverallStats(gameResults, members, courts) {
    const uniqueParticipants = new Set();
    const uniqueDates = new Set();
    const uniqueCourts = new Set();
    let totalGames = 0;
    let totalWins = 0;
    let totalLosses = 0;
    
    gameResults.forEach(result => {
        if (result.member_id) uniqueParticipants.add(result.member_id);
        if (result.game_date) uniqueDates.add(result.game_date);
        if (result.court_id) uniqueCourts.add(result.court_id);
        totalGames += 1;
        totalWins += result.wins || 0;
        totalLosses += result.losses || 0;
    });
    
    return {
        totalMembers: members.length,
        activeMembers: uniqueParticipants.size,
        totalCourts: courts.length,
        activeCourts: uniqueCourts.size,
        totalGames: totalGames,
        totalWins: totalWins,
        totalLosses: totalLosses,
        totalParticipationDays: uniqueDates.size,
        averageGamesPerMember: uniqueParticipants.size > 0 ? Math.round(totalGames / uniqueParticipants.size * 10) / 10 : 0,
        overallWinRate: totalGames > 0 ? Math.round((totalWins / (totalWins + totalLosses)) * 100) : 0
    };
}

// 통계 데이터 렌더링 함수들
function renderMonthlyAttendanceChart(monthlyData) {
    const container = document.querySelector('#monthlyAttendanceChart');
    if (!container) return;
    
    if (monthlyData.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; padding:40px;">데이터가 없습니다.</p>';
        return;
    }
    
    const maxParticipants = Math.max(...monthlyData.map(d => d.participants));
    
    let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
    monthlyData.forEach(data => {
        const percentage = maxParticipants > 0 ? (data.participants / maxParticipants) * 100 : 0;
        html += `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="min-width:80px; font-weight:bold;">${data.month}</div>
                <div style="flex:1; background:#e5e7eb; border-radius:4px; height:20px; position:relative;">
                    <div style="background:#3b82f6; height:100%; border-radius:4px; width:${percentage}%; transition:width 0.3s ease;"></div>
                </div>
                <div style="min-width:60px; text-align:right; font-weight:bold; color:#1e40af;">${data.participants}명</div>
                <div style="min-width:80px; text-align:right; color:#64748b; font-size:0.9em;">${data.totalGames}경기</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function renderCourtParticipationChart(courtData) {
    const container = document.querySelector('#courtParticipationChart');
    if (!container) return;
    
    if (courtData.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; padding:40px;">데이터가 없습니다.</p>';
        return;
    }
    
    const maxDays = Math.max(...courtData.map(d => d.participationDays));
    
    let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
    courtData.forEach(data => {
        const percentage = maxDays > 0 ? (data.participationDays / maxDays) * 100 : 0;
        html += `
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="min-width:120px; font-weight:bold;">${data.name}</div>
                <div style="flex:1; background:#e5e7eb; border-radius:4px; height:20px; position:relative;">
                    <div style="background:#10b981; height:100%; border-radius:4px; width:${percentage}%; transition:width 0.3s ease;"></div>
                </div>
                <div style="min-width:60px; text-align:right; font-weight:bold; color:#059669;">${data.participationDays}일</div>
                <div style="min-width:80px; text-align:right; color:#64748b; font-size:0.9em;">${data.participants}명</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function renderMemberActivityStats(memberData) {
    const container = document.querySelector('#memberActivityStats');
    if (!container) return;
    
    if (memberData.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#64748b; padding:40px;">데이터가 없습니다.</p>';
        return;
    }
    
    // 상위 10명만 표시
    const topMembers = memberData.slice(0, 10);
    
    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
    topMembers.forEach((member, index) => {
        html += `
            <div style="display:flex; align-items:center; gap:15px; padding:8px; background:#f9fafb; border-radius:6px;">
                <div style="min-width:30px; text-align:center; font-weight:bold; color:#d97706;">${index + 1}</div>
                <div style="min-width:100px; font-weight:bold;">${member.name}</div>
                <div style="min-width:80px; color:#64748b; font-size:0.9em;">${member.department || 'No Dept'}</div>
                <div style="min-width:60px; text-align:right; font-weight:bold; color:#d97706;">${member.totalGames}경기</div>
                <div style="min-width:50px; text-align:right; color:#059669;">${member.winRate}%</div>
                <div style="min-width:60px; text-align:right; color:#3b82f6;">${member.participationDays}일</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function renderOverallStats(overallStats) {
    const container = document.querySelector('#overallStats');
    if (!container) return;
    
    let html = '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:20px;">';
    
    const stats = [
        { label: '전체 회원', value: overallStats.totalMembers, icon: 'fa-users', color: '#8b5cf6' },
        { label: '활동 회원', value: overallStats.activeMembers, icon: 'fa-user-check', color: '#10b981' },
        { label: '전체 구장', value: overallStats.totalCourts, icon: 'fa-building', color: '#3b82f6' },
        { label: '활동 구장', value: overallStats.activeCourts, icon: 'fa-building', color: '#059669' },
        { label: '총 경기수', value: overallStats.totalGames, icon: 'fa-gamepad', color: '#f59e0b' },
        { label: '총 승수', value: overallStats.totalWins, icon: 'fa-trophy', color: '#dc2626' },
        { label: '총 패수', value: overallStats.totalLosses, icon: 'fa-times-circle', color: '#64748b' },
        { label: '참여일수', value: overallStats.totalParticipationDays, icon: 'fa-calendar', color: '#7c3aed' },
        { label: '회원당 평균 경기', value: overallStats.averageGamesPerMember, icon: 'fa-chart-line', color: '#ea580c' },
        { label: '전체 승률', value: `${overallStats.overallWinRate}%`, icon: 'fa-percentage', color: '#16a34a' }
    ];
    
    stats.forEach(stat => {
        html += `
            <div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; border-left:4px solid ${stat.color};">
                <i class="fas ${stat.icon}" style="font-size:24px; color:${stat.color}; margin-bottom:10px;"></i>
                <div style="font-size:24px; font-weight:bold; color:${stat.color}; margin-bottom:5px;">${stat.value}</div>
                <div style="color:#64748b; font-size:14px;">${stat.label}</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// 통계 로드 함수
async function loadStatistics() {
    try {
        setStatus('통계 데이터를 로드하는 중...');
        
        const data = await fetchStatisticsData();
        
        // 각 통계 계산 및 렌더링
        const monthlyData = calculateMonthlyAttendance(data.gameResults);
        const courtData = calculateCourtParticipation(data.gameResults, data.courts);
        const memberData = calculateMemberActivity(data.gameResults, data.members);
        const overallStats = calculateOverallStats(data.gameResults, data.members, data.courts);
        
        renderMonthlyAttendanceChart(monthlyData);
        renderCourtParticipationChart(courtData);
        renderMemberActivityStats(memberData);
        renderOverallStats(overallStats);
        
        setStatus('통계 데이터 로드 완료');
    } catch (err) {
        setError(err);
        setStatus('통계 로드 중 오류 발생');
    }
}

// 통계 새로고침 함수
function refreshStatistics() {
    loadStatistics();
}

// 회원 정렬 함수
function sortMembers(members, statsMap) {
    const sortOption = document.querySelector('#pmemSort')?.value || 'absent';
    
    return members.sort((a, b) => {
        const statsA = statsMap?.get(a.id) || { wins: 0, losses: 0, participation: 0, dupr: 0 };
        const statsB = statsMap?.get(b.id) || { wins: 0, losses: 0, participation: 0, dupr: 0 };
        
        switch (sortOption) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'dupr':
                return statsB.dupr - statsA.dupr; // 높은 순
            case 'games':
                return statsB.participation - statsA.participation; // 높은 순
            case 'winrate':
                const winrateA = statsA.participation > 0 ? (statsA.wins / (statsA.wins + statsA.losses)) : 0;
                const winrateB = statsB.participation > 0 ? (statsB.wins / (statsB.wins + statsB.losses)) : 0;
                return winrateB - winrateA; // 높은 순
            case 'wins':
                return statsB.wins - statsA.wins; // 높은 순
            case 'absent':
                // 이번달 불참 회원을 먼저 표시 (true가 먼저)
                if (statsA.isAbsentThisMonth && !statsB.isAbsentThisMonth) return -1;
                if (!statsA.isAbsentThisMonth && statsB.isAbsentThisMonth) return 1;
                // 둘 다 불참이거나 둘 다 참석인 경우 이름순으로 정렬
                return (a.name || '').localeCompare(b.name || '');
            default:
                return (a.name || '').localeCompare(b.name || '');
        }
    });
}

// 참석 현황 계산 및 표시 함수
function updateAttendanceStatus(statsByMemberId) {
    const attendanceStatusDiv = document.querySelector('#attendanceStatus');
    const attendanceMessage = document.querySelector('#attendanceMessage');
    
    if (!attendanceStatusDiv || !attendanceMessage) return;
    
    // 전체 회원 수와 이번달 참석 회원 수 계산
    let totalMembers = 0;
    let attendedMembers = 0;
    
    for (const [memberId, stats] of statsByMemberId) {
        totalMembers++;
        if (!stats.isAbsentThisMonth) {
            attendedMembers++;
        }
    }
    
    const absentMembers = totalMembers - attendedMembers;
    const requiredMembers = 30; // 목표 참석 인원
    const shortage = Math.max(0, requiredMembers - attendedMembers);
    
    // 메시지 업데이트
    attendanceMessage.textContent = `이번달 ${requiredMembers}명이 참석을 해야 하는데 현재 ${attendedMembers}명이 참석을 해서 ${shortage}명이 부족합니다.`;
    
    // 메시지 표시
    attendanceStatusDiv.style.display = 'block';
}

// 참석 현황 메시지 숨기기 함수
function hideAttendanceStatus() {
    const attendanceStatusDiv = document.querySelector('#attendanceStatus');
    if (attendanceStatusDiv) {
        attendanceStatusDiv.style.display = 'none';
    }
}

// 테이블 헤더 업데이트 함수
function updateTableHeader(sortOption) {
    const duprHeader = document.querySelector('#pmemTable th:nth-child(3)');
    if (!duprHeader) return;
    
    switch (sortOption) {
        case 'games':
            duprHeader.textContent = '참여일수';
            break;
        case 'winrate':
            duprHeader.textContent = '승률';
            break;
        case 'wins':
            duprHeader.textContent = '승수';
            break;
        default:
            duprHeader.textContent = 'DUPR';
            break;
    }
}

async function fetchMemberStats() {
    try {
        const supabase = await ensureSupabaseReady();
        
        // 이번달 날짜 범위 계산
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
        
        const [allDataRes, thisMonthDataRes, lastAttendanceRes] = await Promise.all([
            supabase
                .from('P_game_result')
                .select('member_id,wins,losses')
                .limit(2000),
            supabase
                .from('P_game_result')
                .select('member_id,game_date')
                .gte('game_date', firstDayOfMonth.toISOString().split('T')[0])
                .lte('game_date', lastDayOfMonth.toISOString().split('T')[0])
                .limit(2000),
            supabase
                .from('P_game_result')
                .select('member_id,game_date')
                .order('game_date', { ascending: false })
                .limit(2000)
        ]);
        
        if (allDataRes.error) throw allDataRes.error;
        if (thisMonthDataRes.error) throw thisMonthDataRes.error;
        if (lastAttendanceRes.error) throw lastAttendanceRes.error;
        
        const statsByMemberId = new Map();
        
        // 전체 통계 계산
        for (const row of allDataRes.data || []) {
            const memberId = row.member_id;
            if (!memberId) continue;
            const current = statsByMemberId.get(memberId) || { wins: 0, losses: 0, participation: 0, thisMonthParticipation: 0 };
            current.wins += Number(row.wins || 0);
            current.losses += Number(row.losses || 0);
            current.participation += 1;
            statsByMemberId.set(memberId, current);
        }
        
        // 이번달 참여 통계 계산
        const thisMonthParticipants = new Set();
        for (const row of thisMonthDataRes.data || []) {
            const memberId = row.member_id;
            if (!memberId) continue;
            thisMonthParticipants.add(memberId);
            const current = statsByMemberId.get(memberId) || { wins: 0, losses: 0, participation: 0, thisMonthParticipation: 0 };
            current.thisMonthParticipation += 1;
            statsByMemberId.set(memberId, current);
        }
        
        // 최종참석일 계산
        const lastAttendanceByMember = new Map();
        for (const row of lastAttendanceRes.data || []) {
            const memberId = row.member_id;
            if (!memberId) continue;
            if (!lastAttendanceByMember.has(memberId)) {
                lastAttendanceByMember.set(memberId, row.game_date);
            }
        }
        
        // 모든 회원에 대해 이번달 불참 정보 및 최종참석일 추가
        const { data: allMembers } = await supabase
            .from('P_member')
            .select('id')
            .limit(2000);
            
        for (const member of allMembers || []) {
            const memberId = member.id;
            const current = statsByMemberId.get(memberId) || { wins: 0, losses: 0, participation: 0, thisMonthParticipation: 0 };
            current.isAbsentThisMonth = !thisMonthParticipants.has(memberId);
            current.lastAttendanceDate = lastAttendanceByMember.get(memberId) || null;
            statsByMemberId.set(memberId, current);
        }
        
        // DUPR 점수 계산 추가
        for (const [memberId, stats] of statsByMemberId) {
            stats.dupr = calculateDUPR(stats.wins, stats.losses, stats.participation);
        }
        
        return statsByMemberId;
    } catch (_) {
        return new Map();
    }
}

// DUPR 점수 계산 함수
function calculateDUPR(wins, losses, participation) {
    if (participation === 0) return 0;
    
    const totalGames = wins + losses;
    if (totalGames === 0) return 0;
    
    const winRate = wins / totalGames;
    
    // 기본 DUPR 계산 (간단한 버전)
    let dupr = 0;
    
    if (winRate >= 0.9) dupr = 4.5 + (winRate - 0.9) * 5; // 90% 이상: 4.5-5.0
    else if (winRate >= 0.8) dupr = 3.5 + (winRate - 0.8) * 10; // 80-90%: 3.5-4.5
    else if (winRate >= 0.7) dupr = 2.5 + (winRate - 0.7) * 10; // 70-80%: 2.5-3.5
    else if (winRate >= 0.6) dupr = 1.5 + (winRate - 0.6) * 10; // 60-70%: 1.5-2.5
    else if (winRate >= 0.5) dupr = 0.5 + (winRate - 0.5) * 10; // 50-60%: 0.5-1.5
    else dupr = winRate * 1; // 50% 미만: 0-0.5
    
    // 참여도 보정 (더 많은 경기에 참여할수록 신뢰도 증가)
    const participationBonus = Math.min(participation * 0.01, 0.2); // 최대 0.2점 보너스
    
    return Math.round((dupr + participationBonus) * 100) / 100; // 소수점 둘째자리까지
}

function renderMemberCards(members, statsByMemberId) {
    const tableBody = document.querySelector('#pmemTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (members.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" style="text-align:center; padding:40px; color:#64748b;"><i class="fas fa-user-slash"></i> 등록된 회원이 없습니다.</td>';
        tableBody.appendChild(row);
        return;
    }
    
    // 현재 정렬 옵션 가져오기
    const sortOption = document.querySelector('#pmemSort')?.value || 'absent';
    
    members.forEach((member, index) => {
        const stats = statsByMemberId?.get(member.id) || { 
            wins: 0, 
            losses: 0, 
            participation: 0, 
            dupr: 0, 
            thisMonthParticipation: 0, 
            isAbsentThisMonth: false,
            lastAttendanceDate: null
        };
        
        // DUPR 등급 결정
        const getDUPRGrade = (dupr) => {
            if (dupr >= 4.0) return { grade: '전문가', color: '#dc2626', icon: 'fa-crown' };
            else if (dupr >= 3.0) return { grade: '고급', color: '#ea580c', icon: 'fa-star' };
            else if (dupr >= 2.0) return { grade: '중급', color: '#ca8a04', icon: 'fa-medal' };
            else if (dupr >= 1.0) return { grade: '초급', color: '#16a34a', icon: 'fa-seedling' };
            else return { grade: '입문', color: '#64748b', icon: 'fa-leaf' };
        };
        
        const duprInfo = getDUPRGrade(stats.dupr);
        
        // 최종참석일 포맷팅
        const formatLastAttendance = (dateString) => {
            if (!dateString) return '미참석';
            const date = new Date(dateString);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
            const weekday = weekdays[date.getDay()];
            return `${month}/${day}(${weekday})`;
        };
        
        // 정렬 기준에 따른 4번째 컬럼 내용 결정
        let fourthColumnContent = '';
        switch (sortOption) {
            case 'games':
                fourthColumnContent = `
                    <i class="fas fa-calendar-check" style="color:#3b82f6;"></i> 
                    <strong style="color:#3b82f6;">${stats.participation || 0}</strong> 일
                `;
                break;
            case 'winrate':
                const totalGames = (stats.wins || 0) + (stats.losses || 0);
                const winrate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
                fourthColumnContent = `
                    <i class="fas fa-percentage" style="color:#10b981;"></i> 
                    <strong style="color:#10b981;">${winrate}%</strong>
                `;
                break;
            case 'wins':
                fourthColumnContent = `
                    <i class="fas fa-trophy" style="color:#f59e0b;"></i> 
                    <strong style="color:#f59e0b;">${stats.wins || 0}</strong> 승
                `;
                break;
            default:
                fourthColumnContent = `
                    <i class="fas ${duprInfo.icon}" style="color:${duprInfo.color};"></i> 
                    <strong style="color:${duprInfo.color};">${stats.dupr.toFixed(2)}</strong> 
                    (${duprInfo.grade})
                `;
                break;
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="text-align:center;">${index + 1}</td>
            <td style="text-align:center;">${member.name || 'Unknown'}(${member.department || 'No Department'})</td>
            <td style="text-align:center;">${fourthColumnContent}</td>
            <td style="text-align:center;">${formatLastAttendance(stats.lastAttendanceDate)}</td>
        `;
        
        // 불참 회원인 경우 행 배경색 변경
        if (stats.isAbsentThisMonth) {
            row.style.backgroundColor = '#fef2f2';
            row.style.color = '#dc2626';
        }
        
        tableBody.appendChild(row);
    });
}

function showMemberForm() {
    const form = document.querySelector('#pmemForm');
    if (form) {
        form.style.display = 'block';
        currentEditingMemberId = null;
        // Clear form
        document.querySelector('#pmemName').value = '';
        document.querySelector('#pmemDept').value = '';
    }
}

function hideMemberForm() {
    const form = document.querySelector('#pmemForm');
    if (form) {
        form.style.display = 'none';
        currentEditingMemberId = null;
    }
}

async function pmemCreate() {
    showMemberForm();
}

async function pmemSave() {
    setError(''); setStatus('Saving member...');
    try {
        const name = document.querySelector('#pmemName')?.value.trim();
        const dept = document.querySelector('#pmemDept')?.value.trim();
        if (!name) throw new Error('name 은 필수입니다.');
        
        const supabase = await ensureSupabaseReady();
        
        if (currentEditingMemberId) {
            // Update existing member
            const { error } = await supabase.from('P_member').update({ name, department: dept || null }).eq('id', currentEditingMemberId);
            if (error) throw error;
            setStatus('Member updated');
        } else {
            // Create new member
            const { error } = await supabase.from('P_member').insert({ name, department: dept || null });
            if (error) throw error;
            setStatus('Member created');
        }
        
        hideMemberForm();
        await pmemList();
    } catch (err) { setError(err); setStatus('Error'); }
}

async function editMember(memberId) {
    setError('');
    try {
        const supabase = await ensureSupabaseReady();
        const { data, error } = await supabase.from('P_member').select('*').eq('id', memberId).single();
        if (error) throw error;
        
        currentEditingMemberId = memberId;
        document.querySelector('#pmemName').value = data.name || '';
        document.querySelector('#pmemDept').value = data.department || '';
        
        const form = document.querySelector('#pmemForm');
        if (form) form.style.display = 'block';
        
        setStatus('Editing member');
    } catch (err) { setError(err); setStatus('Error'); }
}

async function deleteMember(memberId) {
    if (!confirm('정말로 이 회원을 삭제하시겠습니까?')) return;
    
    setError(''); setStatus('Deleting member...');
    try {
        const supabase = await ensureSupabaseReady();
        const { error } = await supabase.from('P_member').delete().eq('id', memberId);
        if (error) throw error;
        await pmemList();
        setStatus('Member deleted');
    } catch (err) { setError(err); setStatus('Error'); }
}


// P_court
let currentEditingCourtId = null;

async function pcourtList() {
    setError(''); setStatus('Loading active courts...');
    try {
        const supabase = await ensureSupabaseReady();
        const { data, error } = await supabase.from('P_court').select('*').eq('active', true).order('name');
        if (error) throw error;
        renderCourtCards(data || []);
        await refreshCourtOptions();
        setStatus(`Loaded ${data?.length || 0} active courts`);
    } catch (err) { setError(err); setStatus('Error'); }
}

async function pcourtListAll() {
    setError(''); setStatus('Loading all courts...');
    try {
        const supabase = await ensureSupabaseReady();
        const { data, error } = await supabase.from('P_court').select('*').order('name');
        if (error) throw error;
        renderCourtCards(data || []);
        await refreshCourtOptions();
        setStatus(`Loaded ${data?.length || 0} courts (all)`);
    } catch (err) { setError(err); setStatus('Error'); }
}

function renderCourtCards(courts) {
    const grid = document.querySelector('#pcourtGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (courts.length === 0) {
        grid.innerHTML = '<div class="no-members"><i class="fas fa-building"></i><p>등록된 구장이 없습니다.</p></div>';
        return;
    }
    
    courts.forEach(court => {
        const card = document.createElement('div');
        card.className = 'member-card';
        const isActive = court.active === true; // 명시적으로 true인 경우만 활성
        const activeStatus = isActive ? '활성' : '비활성';
        const activeIcon = isActive ? 'fa-check-circle' : 'fa-times-circle';
        const activeColor = isActive ? '#10b981' : '#ef4444';
        
        card.innerHTML = `
            <div class="member-header">
                <div class="member-photo-container">
                    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNlMmU4ZjAiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjYTBhZWMwIi8+Cjwvc3ZnPgo8L3N2Zz4K" class="member-photo" alt="Court">
                </div>
                <div class="member-info">
                    <h3>${court.name || 'Unknown'}</h3>
                    <p><i class="fas fa-calendar"></i> ${new Date(court.created_at).toLocaleDateString()}</p>
                    <p><i class="fas ${activeIcon}" style="color:${activeColor};"></i> 상태: ${activeStatus}</p>
                </div>
            </div>
            <div class="member-actions">
                <button class="btn btn-secondary" onclick="editCourt('${court.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn ${isActive ? 'btn-warning' : 'btn-success'}" onclick="toggleCourtActive('${court.id}', ${isActive})">
                    <i class="fas ${isActive ? 'fa-pause' : 'fa-play'}"></i> ${isActive ? '비활성화' : '활성화'}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function showCourtForm() {
    const form = document.querySelector('#pcourtForm');
    if (form) {
        form.style.display = 'block';
        currentEditingCourtId = null;
        // Clear form
        document.querySelector('#pcourtName').value = '';
        document.querySelector('#pcourtActive').checked = true;
    }
}

function hideCourtForm() {
    const form = document.querySelector('#pcourtForm');
    if (form) {
        form.style.display = 'none';
        currentEditingCourtId = null;
    }
}

async function pcourtCreate() {
    showCourtForm();
}

async function pcourtSave() {
    setError(''); setStatus('Saving court...');
    try {
        const name = document.querySelector('#pcourtName')?.value.trim();
        const active = document.querySelector('#pcourtActive')?.checked === true;
        if (!name) throw new Error('name 은 필수입니다.');
        
        const supabase = await ensureSupabaseReady();
        
        if (currentEditingCourtId) {
            // Update existing court
            const { error } = await supabase.from('P_court').update({ name, active }).eq('id', currentEditingCourtId);
            if (error) throw error;
            setStatus('Court updated');
        } else {
            // Create new court
            const { error } = await supabase.from('P_court').insert({ name, active });
            if (error) throw error;
            setStatus('Court created');
        }
        
        hideCourtForm();
        await pcourtList();
    } catch (err) { setError(err); setStatus('Error'); }
}

async function editCourt(courtId) {
    setError('');
    try {
        const supabase = await ensureSupabaseReady();
        const { data, error } = await supabase.from('P_court').select('*').eq('id', courtId).single();
        if (error) throw error;
        
        currentEditingCourtId = courtId;
        document.querySelector('#pcourtName').value = data.name || '';
        document.querySelector('#pcourtActive').checked = data.active === true; // 명시적으로 true인 경우만 체크
        
        const form = document.querySelector('#pcourtForm');
        if (form) form.style.display = 'block';
        
        setStatus('Editing court');
    } catch (err) { setError(err); setStatus('Error'); }
}

async function toggleCourtActive(courtId, currentActive) {
    const newActive = !currentActive;
    const action = newActive ? '활성화' : '비활성화';
    
    if (!confirm(`정말로 이 구장을 ${action}하시겠습니까?`)) return;
    
    setError(''); setStatus(`${action} 중...`);
    try {
        const supabase = await ensureSupabaseReady();
        const { error } = await supabase.from('P_court').update({ active: newActive }).eq('id', courtId);
        if (error) throw error;
        await pcourtList();
        setStatus(`구장이 ${action}되었습니다`);
    } catch (err) { setError(err); setStatus('Error'); }
}


// P_game_result
async function pgameList() {
    setError(''); setStatus('Loading P_game_result...');
    try {
        const supabase = await ensureSupabaseReady();
        const { data, error } = await supabase
            .from('P_game_result')
            .select('*, court:P_court(name), member:P_member(name)')
            .order('game_date', { ascending: false })
            .order('wins', { ascending: false })
            .order('losses', { ascending: true })
            .limit(200);
        if (error) throw error;
        
        // 승률 계산 및 정렬
        const resultsWithWinrate = (data || []).map(row => {
            const wins = row.wins || 0;
            const losses = row.losses || 0;
            const total = wins + losses;
            const winrate = total > 0 ? (wins / total) * 100 : 0;
            return { ...row, winrate };
        });
        
        // 날짜 내림차순, 승률 내림차순으로 정렬
        resultsWithWinrate.sort((a, b) => {
            // 먼저 날짜로 정렬 (최신순)
            const dateA = new Date(a.game_date);
            const dateB = new Date(b.game_date);
            if (dateA > dateB) return -1;
            if (dateA < dateB) return 1;
            
            // 날짜가 같으면 승률로 정렬 (높은순)
            return b.winrate - a.winrate;
        });
        
        renderGameTable(resultsWithWinrate);
        setStatus(`Loaded ${resultsWithWinrate.length} results`);
    } catch (err) { setError(err); setStatus('Error'); }
}

function renderGameTable(results) {
    const tbody = document.querySelector('#pgameTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (results.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.style.padding = '12px';
        td.textContent = '게임결과가 없습니다.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }
    let currentDate = null;
    let isEvenDate = false;
    
    results.forEach(row => {
        const wins = row.wins ?? 0;
        const losses = row.losses ?? 0;
        const total = wins + losses;
        const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        
        // 날짜가 변경되면 배경색 토글
        if (currentDate !== row.game_date) {
            currentDate = row.game_date;
            isEvenDate = !isEvenDate;
        }
        
        // 날짜별 배경색 설정
        if (isEvenDate) {
            tr.style.backgroundColor = '#f8fafc'; // 연한 회색
        } else {
            tr.style.backgroundColor = '#ffffff'; // 흰색
        }
        tr.addEventListener('click', () => {
            const courtSelect = document.querySelector('#pgameCourt');
            const memberSelect = document.querySelector('#pgameMember');
            const dateInput = document.querySelector('#pgameDate');
            const winsInput = document.querySelector('#pgameWins');
            const lossesInput = document.querySelector('#pgameLosses');
            if (courtSelect && row.court_id) courtSelect.value = row.court_id;
            if (memberSelect && row.member_id) memberSelect.value = row.member_id;
            if (dateInput) dateInput.value = row.game_date || '';
            if (winsInput) winsInput.value = wins;
            if (lossesInput) lossesInput.value = losses;
            setStatus('Selected row loaded to form');
        });
        // 날짜 포맷팅 (MM/DD(요일) 형태)
        const formatDate = (dateString) => {
            if (!dateString) return '-';
            const date = new Date(dateString);
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
            const weekday = weekdays[date.getDay()];
            return `${month}/${day}(${weekday})`;
        };

        const tds = [
            formatDate(row.game_date),
            `${winrate}%(${wins}승/${losses}패)`,
            row.member?.name || '-',
            row.court?.name || '-'
        ];
        tds.forEach((val, idx) => {
            const td = document.createElement('td');
            td.textContent = val;
            td.style.padding = '8px';
            td.style.borderBottom = '1px solid #e2e8f0';
            td.style.textAlign = 'center';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

async function pgameCreate() {
    setError(''); setStatus('Saving result...');
    try {
        const court_id = document.querySelector('#pgameCourt')?.value;
        const wins = parseInt(document.querySelector('#pgameWins')?.value, 10) || 0;
        const losses = parseInt(document.querySelector('#pgameLosses')?.value, 10) || 0;
        const game_date = document.querySelector('#pgameDate')?.value || null; // yyyy-mm-dd
        const member_id = document.querySelector('#pgameMember')?.value || null;
        if (!court_id) throw new Error('court 를 선택하세요.');
        if (!member_id) throw new Error('member 를 선택하세요.');
        if (!game_date) throw new Error('date 를 선택하세요.');
        
        const supabase = await ensureSupabaseReady();
        const payload = { court_id, member_id, wins, losses, game_date };
        
        // UPSERT 방식으로 처리 (PostgreSQL의 ON CONFLICT 사용)
        const { error } = await supabase
            .from('P_game_result')
            .upsert(payload, { 
                onConflict: 'game_date,member_id',
                ignoreDuplicates: false 
            });
        
        if (error) throw error;
        setStatus('Result saved successfully');
        await pgameList();
        
        // 폼 초기화 (오늘 날짜로 설정)
        initializeGameForm();
        document.querySelector('#pgameMember').value = '';
        document.querySelector('#pgameCourt').value = '';
        document.querySelector('#pgameWins').value = '0';
        document.querySelector('#pgameLosses').value = '0';
    } catch (err) { 
        setError(err); 
        setStatus('Error'); 
    }
}

async function pgameUpdate() {
    setError(''); setStatus('Updating result...');
    try {
        const court_id = document.querySelector('#pgameCourt')?.value;
        const member_id = document.querySelector('#pgameMember')?.value;
        const wins = parseInt(document.querySelector('#pgameWins')?.value, 10);
        const losses = parseInt(document.querySelector('#pgameLosses')?.value, 10);
        const game_date = document.querySelector('#pgameDate')?.value;
        if (!member_id || !game_date) throw new Error('member와 date를 선택하세요.');
        if (!court_id) throw new Error('court를 선택하세요.');
        const payload = { court_id, wins, losses };
        const supabase = await ensureSupabaseReady();
        // Update the result with this member and date (composite key)
        const { error } = await supabase.from('P_game_result').update(payload).eq('member_id', member_id).eq('game_date', game_date);
        if (error) throw error;
        await pgameList(); setStatus('Result updated');
    } catch (err) { setError(err); setStatus('Error'); }
}

async function pgameDelete() {
    setError(''); setStatus('Deleting result...');
    try {
        const member_id = document.querySelector('#pgameMember')?.value;
        const game_date = document.querySelector('#pgameDate')?.value;
        if (!member_id || !game_date) throw new Error('member와 date를 선택하세요.');
        const supabase = await ensureSupabaseReady();
        // Delete the result with this member and date (composite key)
        const { error } = await supabase.from('P_game_result').delete().eq('member_id', member_id).eq('game_date', game_date);
        if (error) throw error;
        await pgameList(); setStatus('Result deleted');
    } catch (err) { setError(err); setStatus('Error'); }
}

function bindPickleballUI() {
    const mappings = [
        ['#pmemLoad', pmemList], ['#pmemCreate', pmemCreate], ['#pmemSave', pmemSave], ['#pmemCancel', hideMemberForm], ['#pmemShowDUPRLogic', pmemShowDUPRLogic],
        ['#pcourtLoad', pcourtList], ['#pcourtLoadAll', pcourtListAll], ['#pcourtCreate', pcourtCreate], ['#pcourtSave', pcourtSave], ['#pcourtCancel', hideCourtForm],
        ['#pgameLoad', pgameList], ['#pgameCreate', pgameCreate], ['#pgameUpdate', pgameUpdate], ['#pgameDelete', pgameDelete],
        ['#statisticsLoad', loadStatistics], ['#statisticsRefresh', refreshStatistics],
    ];
    for (const [sel, fn] of mappings) {
        const nodes = document.querySelectorAll(sel);
        if (!nodes || nodes.length === 0) continue;
        nodes.forEach((el) => el.addEventListener('click', fn));
    }
    
    // 회원 정렬 옵션 변경 이벤트 리스너
    const pmemSortSelect = document.querySelector('#pmemSort');
    if (pmemSortSelect) {
        pmemSortSelect.addEventListener('change', async () => {
            const sortOption = pmemSortSelect.value;
            
            // 테이블 헤더 업데이트
            updateTableHeader(sortOption);
            
            // 이번달 불참 정렬을 선택한 경우 참석 현황 메시지 표시
            if (sortOption === 'absent') {
                // 현재 로드된 회원 데이터가 있으면 통계 정보를 가져와서 메시지 표시
                const tableBody = document.querySelector('#pmemTableBody');
                if (tableBody && tableBody.children.length > 0) {
                    try {
                        const statsMap = await fetchMemberStats();
                        updateAttendanceStatus(statsMap);
                    } catch (err) {
                        console.error('참석 현황 계산 중 오류:', err);
                    }
                }
            } else {
                // 다른 정렬 옵션을 선택한 경우 참석 현황 메시지 숨기기
                hideAttendanceStatus();
            }
            
            // 현재 로드된 회원 데이터가 있으면 다시 정렬하여 표시
            const tableBody = document.querySelector('#pmemTableBody');
            if (tableBody && tableBody.children.length > 0) {
                pmemList(); // 회원 목록을 다시 로드하여 정렬 적용
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try { await Promise.all([refreshCourtOptions(), refreshMemberOptions()]); } catch (e) { /* ignore until tables exist */ }
    bindPickleballUI();
    updateLastUpdateDate();
    initializeAccordion();
    initializeGameForm(); // 게임결과 폼 초기화
});

// 아코디언 초기화 - 첫 번째 섹션만 열어두기
function initializeAccordion() {
    // 회원과 구장 섹션을 기본적으로 접어두기
    toggleSection('member');
    toggleSection('court');
}

function updateLastUpdateDate() {
    // document.lastModified를 사용하여 index.html 파일의 수정일 가져오기
    const lastModified = document.lastModified;
    if (lastModified) {
        const date = new Date(lastModified);
        const dateString = date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const dateElement = document.getElementById('lastUpdateDate');
        if (dateElement) {
            dateElement.textContent = dateString;
        }
    }
}


