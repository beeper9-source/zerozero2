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

// DUPR 모달 닫기 함수
function closeDUPRModal() {
    const modal = document.querySelector('#duprLogicModal');
    if (modal) {
        modal.remove();
    }
}

// 회원 정렬 함수
function sortMembers(members, statsMap) {
    const sortOption = document.querySelector('#pmemSort')?.value || 'name';
    
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
            default:
                return (a.name || '').localeCompare(b.name || '');
        }
    });
}

async function fetchMemberStats() {
    try {
        const supabase = await ensureSupabaseReady();
        const { data, error } = await supabase
            .from('P_game_result')
            .select('member_id,wins,losses')
            .limit(2000);
        if (error) throw error;
        const statsByMemberId = new Map();
        for (const row of data || []) {
            const memberId = row.member_id;
            if (!memberId) continue;
            const current = statsByMemberId.get(memberId) || { wins: 0, losses: 0, participation: 0 };
            current.wins += Number(row.wins || 0);
            current.losses += Number(row.losses || 0);
            current.participation += 1;
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
    const grid = document.querySelector('#pmemGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (members.length === 0) {
        grid.innerHTML = '<div class="no-members"><i class="fas fa-user-slash"></i><p>등록된 회원이 없습니다.</p></div>';
        return;
    }
    
    members.forEach(member => {
        const card = document.createElement('div');
        card.className = 'member-card';
        const stats = statsByMemberId?.get(member.id) || { wins: 0, losses: 0, participation: 0, dupr: 0 };
        const totalGames = (stats.wins || 0) + (stats.losses || 0);
        const winrate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
        
        // DUPR 등급 결정
        const getDUPRGrade = (dupr) => {
            if (dupr >= 4.0) return { grade: '전문가', color: '#dc2626', icon: 'fa-crown' };
            else if (dupr >= 3.0) return { grade: '고급', color: '#ea580c', icon: 'fa-star' };
            else if (dupr >= 2.0) return { grade: '중급', color: '#ca8a04', icon: 'fa-medal' };
            else if (dupr >= 1.0) return { grade: '초급', color: '#16a34a', icon: 'fa-seedling' };
            else return { grade: '입문', color: '#64748b', icon: 'fa-leaf' };
        };
        
        const duprInfo = getDUPRGrade(stats.dupr);
        
        card.innerHTML = `
            <div class="member-header">
                <div class="member-photo-container">
                    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNlMmU4ZjAiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHBhdGggZD0iTTEyIDEyQzE0LjIwOTEgMTIgMTYgMTAuMjA5MSAxNiA4QzE2IDUuNzkwODYgMTQuMjA5MSA0IDEyIDRDOS43OTA4NiA0IDggNS43OTA4NiA4IDhDOCAxMC4yMDkxIDkuNzkwODYgMTIgMTIgMTJaIiBmaWxsPSIjYTBhZWMwIi8+CjxwYXRoIGQ9Ik0xMiAxNEM5LjMzIDE0IDcgMTUuMzMgNyAxOEgxN0MxNyAxNS4zMyAxNC42NyAxNCAxMiAxNFoiIGZpbGw9IiNhMGFlYzAiLz4KPC9zdmc+Cjwvc3ZnPgo=" class="member-photo" alt="Profile">
                </div>
                <div class="member-info">
                    <h3>${member.name || 'Unknown'}</h3>
                    <p><i class="fas fa-building"></i> ${member.department || 'No Department'}</p>
                    <p><i class="fas fa-calendar"></i> ${new Date(member.created_at).toLocaleDateString()}</p>
                    <p><i class="fas fa-trophy"></i> 승률: ${winrate}% · wins: ${stats.wins || 0} · loss: ${stats.losses || 0} · 참여: ${stats.participation || 0}</p>
                    <p><i class="fas ${duprInfo.icon}" style="color:${duprInfo.color};"></i> DUPR: <strong style="color:${duprInfo.color};">${stats.dupr.toFixed(2)}</strong> (${duprInfo.grade})</p>
                </div>
            </div>
            <div class="member-actions">
                <button class="btn btn-secondary" onclick="editMember('${member.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger" onclick="deleteMember('${member.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        grid.appendChild(card);
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
    ];
    for (const [sel, fn] of mappings) {
        const nodes = document.querySelectorAll(sel);
        if (!nodes || nodes.length === 0) continue;
        nodes.forEach((el) => el.addEventListener('click', fn));
    }
    
    // 회원 정렬 옵션 변경 이벤트 리스너
    const pmemSortSelect = document.querySelector('#pmemSort');
    if (pmemSortSelect) {
        pmemSortSelect.addEventListener('change', () => {
            // 현재 로드된 회원 데이터가 있으면 다시 정렬하여 표시
            const grid = document.querySelector('#pmemGrid');
            if (grid && grid.children.length > 0) {
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


