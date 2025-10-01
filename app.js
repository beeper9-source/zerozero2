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
            supabase.from('P_member').select('*').order('name', { ascending: true }).limit(200),
            fetchMemberStats()
        ]);
        if (membersRes.error) throw membersRes.error;
        renderMemberCards(membersRes.data || [], statsMap);
        setStatus(`Loaded ${membersRes.data?.length || 0} members`);
    } catch (err) { setError(err); setStatus('Error'); }
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
        return statsByMemberId;
    } catch (_) {
        return new Map();
    }
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
        const stats = statsByMemberId?.get(member.id) || { wins: 0, losses: 0, participation: 0 };
        const totalGames = (stats.wins || 0) + (stats.losses || 0);
        const winrate = totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
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
    results.forEach(row => {
        const wins = row.wins ?? 0;
        const losses = row.losses ?? 0;
        const total = wins + losses;
        const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
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
        ['#pmemLoad', pmemList], ['#pmemCreate', pmemCreate], ['#pmemSave', pmemSave], ['#pmemCancel', hideMemberForm],
        ['#pcourtLoad', pcourtList], ['#pcourtLoadAll', pcourtListAll], ['#pcourtCreate', pcourtCreate], ['#pcourtSave', pcourtSave], ['#pcourtCancel', hideCourtForm],
        ['#pgameLoad', pgameList], ['#pgameCreate', pgameCreate], ['#pgameUpdate', pgameUpdate], ['#pgameDelete', pgameDelete],
    ];
    for (const [sel, fn] of mappings) {
        const nodes = document.querySelectorAll(sel);
        if (!nodes || nodes.length === 0) continue;
        nodes.forEach((el) => el.addEventListener('click', fn));
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


