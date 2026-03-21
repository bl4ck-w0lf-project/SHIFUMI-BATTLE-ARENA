(function () {

  // ============================================================
  //  CONFIG SUPABASE
  //  Fichier : admin/assets/js/admin.js
  //  storageKey 'sba-admin-session' — même clé que admin/auth.js
  // ============================================================
  const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
  const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'
  const { createClient } = supabase

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storageKey: 'sba-admin-session' }
  })

  const ADMIN_URL = window.location.origin + '/admin'

  let allPlayers    = []
  let currentUser   = null
  let openRowId     = null
  let presenceChannel = null   // ← canal presence

  // ============================================================
  //  PROTECTION — session admin obligatoire
  // ============================================================
  async function init() {
    const { data: { session } } = await sb.auth.getSession()

    if (!session) {
      window.location.href = ADMIN_URL + '/connexion_admin.html'
      return
    }

    currentUser = session.user

    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      await sb.auth.signOut()
      window.location.href = ADMIN_URL + '/connexion_admin.html'
      return
    }

    const emailEl = document.getElementById('admin-email-sidebar')
    if (emailEl) emailEl.textContent = currentUser.email

    await loadPlayers()
    // initPresence est appelé dans loadPlayers() APRÈS le rendu du DOM
  }

  // ============================================================
  //  CHARGER TOUS LES JOUEURS
  //  On utilise v_leaderboard exactement comme dashboard.js
  //  pour avoir xp_total réel + stats PvP + stats par niveau
  // ============================================================
  async function loadPlayers() {

    // 1) Profils pour la liste de gestion
    const { data: profiles, error: profError } = await sb
      .from('profiles')
      .select('id, first_name, last_name, username, avatar_url, created_at, role')
      .eq('role', 'player')
      .order('created_at', { ascending: false })

    if (profError) {
      showToast('Erreur lors du chargement des joueurs.', 'error')
      console.error(profError)
      return
    }

    const { data: stats } = await sb.from('player_stats').select('*')

    allPlayers = (profiles || []).map(p => {
      const s = stats?.find(st => st.profile_id === p.id) || {
        total_games: 0, wins: 0, losses: 0, draws: 0, win_rate: 0,
        best_streak: 0, rock_played: 0, paper_played: 0, scissors_played: 0
      }
      const winRate = s.total_games > 0 ? Math.round((s.wins / s.total_games) * 100) : 0
      return {
        id: p.id, first_name: p.first_name, last_name: p.last_name,
        username: p.username, avatar_url: p.avatar_url, created_at: p.created_at,
        total_games: s.total_games || 0, wins: s.wins || 0, losses: s.losses || 0,
        draws: s.draws || 0, win_rate: winRate, best_streak: s.best_streak || 0,
        rock_played: s.rock_played || 0, paper_played: s.paper_played || 0,
        scissors_played: s.scissors_played || 0,
      }
    })

    updateKPIs()
    renderPlayers(allPlayers)

    // 2) Classement + Top5 via v_leaderboard (comme dashboard.js)
    await loadLeaderboard()

    // 3) Presence APRÈS que tous les dots data-presence sont dans le DOM
    await initPresence()
  }

  // ============================================================
  //  CLASSEMENT — via v_leaderboard (identique à dashboard.js)
  // ============================================================
  async function loadLeaderboard() {
    const { data: players } = await sb.from('v_leaderboard').select('*')
    if (!players || players.length === 0) return

    renderAdminTop5(players.slice(0, 5))
    renderAdminLeaderboard(players)
  }

  // ============================================================
  //  KPIs GLOBAUX
  // ============================================================
  function updateKPIs() {
    setEl('kpi-total', allPlayers.length)
    const totalGames = allPlayers.reduce((acc, p) => acc + p.total_games, 0)
    setEl('kpi-games', totalGames.toLocaleString())
    const avgWinRate = allPlayers.length > 0
      ? Math.round(allPlayers.reduce((acc, p) => acc + p.win_rate, 0) / allPlayers.length) : 0
    setEl('kpi-winrate', avgWinRate + '%')
    const best = [...allPlayers].sort((a, b) => b.wins - a.wins)[0]
    setEl('kpi-best', best ? best.username : '—')
  }

  // ============================================================
  //  AFFICHER LA LISTE DES JOUEURS (inchangée)
  // ============================================================
  function renderPlayers(players) {
    const container = document.getElementById('players-body')
    const countEl   = document.getElementById('players-count')

    if (countEl) countEl.textContent = `(${players.length} joueur${players.length !== 1 ? 's' : ''})`

    if (!players.length) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 gap-3 dark:text-[#94a3b8] text-[#475569]">
          <i class="fa-solid fa-users-slash text-3xl"></i>
          <span class="font-rajdhani">Aucun joueur trouvé</span>
        </div>`
      return
    }

    container.innerHTML = ''
    players.forEach(player => {
      const initials = (player.first_name[0] + player.last_name[0]).toUpperCase()
      const fullName = player.first_name + ' ' + player.last_name
      const dateStr  = new Date(player.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' })
      const winColor = player.win_rate >= 60 ? 'text-win' : player.win_rate >= 40 ? 'text-draw' : 'text-lose'

      const row = document.createElement('div')
      row.className = 'player-row px-4 md:px-6 py-4'
      row.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-[1fr_140px_80px_80px_80px_100px_120px] gap-3 items-center">
          <div class="flex items-center gap-3 min-w-0">
            ${player.avatar_url
              ? `<img src="${player.avatar_url}" alt="avatar" class="w-9 h-9 rounded-full object-cover flex-shrink-0">`
              : `<div class="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[#0066ff]
                             flex items-center justify-center text-white font-orbitron text-xs font-bold flex-shrink-0">
                   ${initials}
                 </div>`}
            <div class="min-w-0">
              <div class="font-outfit font-medium text-sm dark:text-white text-[#0a0f1e] truncate">${fullName}</div>
              <div class="font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">${player.id.substring(0, 8)}...</div>
            </div>
          </div>
          <div class="text-center"><span class="font-rajdhani text-sm dark:text-primary text-[#0288d1] font-semibold">@${player.username}</span></div>
          <div class="text-center font-outfit text-sm dark:text-white text-[#0a0f1e]">${player.total_games}</div>
          <div class="text-center font-orbitron font-bold text-sm text-win">${player.wins}</div>
          <div class="text-center font-orbitron font-bold text-sm ${winColor}">${player.win_rate}%</div>
          <div class="text-center font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">${dateStr}</div>
          <div class="flex items-center justify-center gap-2">
            <button onclick="openStats('${player.id}')"
              class="action-btn bg-[rgba(2,183,245,0.1)] text-primary hover:bg-[rgba(2,183,245,0.2)]" title="Voir les stats">
              <i class="fa-solid fa-chart-bar"></i>
            </button>
            <button onclick="openEdit('${player.id}')"
              class="action-btn bg-[rgba(251,191,36,0.1)] text-gold hover:bg-[rgba(251,191,36,0.2)]" title="Modifier">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button onclick="openDelete('${player.id}', '${fullName.replace(/'/g, "\\'")}')"
              class="action-btn bg-[rgba(239,68,68,0.1)] text-lose hover:bg-[rgba(239,68,68,0.2)]" title="Supprimer">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`
      container.appendChild(row)
    })
  }

  // ============================================================
  //  RECHERCHE (inchangée)
  // ============================================================
  document.getElementById('search-input').addEventListener('input', function () {
    const q = this.value.trim().toLowerCase()
    if (!q) { renderPlayers(allPlayers); return }
    const filtered = allPlayers.filter(p =>
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q)  ||
      p.username.toLowerCase().includes(q)
    )
    renderPlayers(filtered)
  })

  // ============================================================
  //  MODAL STATS (inchangée)
  // ============================================================
  window.openStats = function (playerId) {
    const player = allPlayers.find(p => p.id === playerId)
    if (!player) return
    const initials = (player.first_name[0] + player.last_name[0]).toUpperCase()
    const avatarEl = document.getElementById('stats-avatar')
    if (player.avatar_url) {
      avatarEl.innerHTML = `<img src="${player.avatar_url}" alt="avatar" class="w-full h-full object-cover rounded-full">`
    } else { avatarEl.textContent = initials }
    setEl('stats-name',     player.first_name + ' ' + player.last_name)
    setEl('stats-username', '@' + player.username)
    setEl('stats-games',    player.total_games)
    setEl('stats-wins',     player.wins)
    setEl('stats-losses',   player.losses)
    setEl('stats-draws',    player.draws)
    setEl('stats-winrate',  player.win_rate + '%')
    setEl('stats-streak',   player.best_streak)
    setEl('stats-rock',     player.rock_played)
    setEl('stats-paper',    player.paper_played)
    setEl('stats-scissors', player.scissors_played)
    document.getElementById('modal-stats').classList.remove('hidden')
  }
  document.getElementById('btn-stats-close').addEventListener('click', () => document.getElementById('modal-stats').classList.add('hidden'))
  document.getElementById('modal-stats').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-stats')) document.getElementById('modal-stats').classList.add('hidden')
  })

  // ============================================================
  //  MODAL ÉDITION (inchangée)
  // ============================================================
  window.openEdit = function (playerId) {
    const player = allPlayers.find(p => p.id === playerId)
    if (!player) return
    document.getElementById('edit-player-id').value  = player.id
    document.getElementById('edit-lastname').value   = player.last_name
    document.getElementById('edit-firstname').value  = player.first_name
    document.getElementById('edit-username').value   = player.username
    document.getElementById('modal-edit').classList.remove('hidden')
  }
  document.getElementById('btn-edit-close').addEventListener('click',  () => document.getElementById('modal-edit').classList.add('hidden'))
  document.getElementById('btn-edit-cancel').addEventListener('click', () => document.getElementById('modal-edit').classList.add('hidden'))
  document.getElementById('modal-edit').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-edit')) document.getElementById('modal-edit').classList.add('hidden')
  })
  document.getElementById('btn-edit-save').addEventListener('click', async () => {
    const id        = document.getElementById('edit-player-id').value
    const lastName  = document.getElementById('edit-lastname').value.trim()
    const firstName = document.getElementById('edit-firstname').value.trim()
    const username  = document.getElementById('edit-username').value.trim()
    if (!lastName || !firstName || !username) { showToast('Tous les champs sont obligatoires.', 'error'); return }
    const btn = document.getElementById('btn-edit-save')
    btn.disabled = true; btn.textContent = 'Sauvegarde...'
    const { data: existing } = await sb.from('profiles').select('id').eq('username', username).neq('id', id).maybeSingle()
    if (existing) {
      showToast('Ce pseudo est déjà utilisé par un autre joueur.', 'error')
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Sauvegarder'
      return
    }
    const { error } = await sb.from('profiles').update({ first_name: firstName, last_name: lastName, username }).eq('id', id)
    if (error) { showToast('Erreur lors de la mise à jour.', 'error'); console.error(error) }
    else {
      showToast('Joueur mis à jour avec succès.', 'success')
      document.getElementById('modal-edit').classList.add('hidden')
      await loadPlayers()
    }
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Sauvegarder'
  })

  // ============================================================
  //  MODAL SUPPRESSION (inchangée)
  // ============================================================
  window.openDelete = function (playerId, playerName) {
    document.getElementById('delete-player-id').value         = playerId
    document.getElementById('delete-player-name').textContent = playerName
    document.getElementById('modal-delete').classList.remove('hidden')
  }
  document.getElementById('btn-delete-cancel').addEventListener('click', () => document.getElementById('modal-delete').classList.add('hidden'))
  document.getElementById('modal-delete').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-delete')) document.getElementById('modal-delete').classList.add('hidden')
  })
  document.getElementById('btn-delete-confirm').addEventListener('click', async () => {
    const id  = document.getElementById('delete-player-id').value
    const btn = document.getElementById('btn-delete-confirm')
    btn.disabled = true; btn.textContent = 'Suppression...'
    const { error } = await sb.from('profiles').delete().eq('id', id)
    if (error) {
      showToast('Erreur lors de la suppression.', 'error'); console.error(error)
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash mr-1"></i> SUPPRIMER'
      return
    }
    showToast('Joueur supprimé avec succès.', 'success')
    document.getElementById('modal-delete').classList.add('hidden')
    await loadPlayers()
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash mr-1"></i> SUPPRIMER'
  })

  // ============================================================
  //  TOP 5 — même logique que dashboard.js renderTop5()
  //  Données depuis v_leaderboard (xp_total réel, stats par niveau, PvP)
  // ============================================================
  function renderAdminTop5(players) {
    const container = document.getElementById('admin-top5')
    if (!container) return
    container.innerHTML = ''

    const rankColors  = ['text-gold','text-silver','text-bronze','text-[#475569]','text-[#475569]']
    const avatarGrads = [
      'from-[#fbbf24] to-[#f59e0b]','from-[#94a3b8] to-[#64748b]',
      'from-[#02b7f5] to-[#0066ff]','from-[#475569] to-[#1e293b]','from-[#475569] to-[#334155]',
    ]

    players.forEach((player, i) => {
      const initials = (player.first_name[0] + player.last_name[0]).toUpperCase()
      const xp       = player.xp_total || 0
      const winRate  = player.total_games > 0 ? Math.round((player.wins / player.total_games) * 100) : 0
      const expandId = 'top5-' + player.profile_id

      const row = document.createElement('div')
      row.className = 'rounded-xl overflow-hidden transition'
      row.innerHTML = `
        <div class="lb-row-header flex items-center gap-3 p-2 hover:bg-[rgba(2,183,245,0.05)] rounded-xl cursor-pointer"
             onclick="window.toggleTop5Row('${expandId}')">
          <span class="font-orbitron font-bold ${rankColors[i]} w-6">${i + 1}</span>
          <div class="relative">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br ${avatarGrads[i]}
                        flex items-center justify-center text-white font-orbitron text-xs shrink-0">
              ${initials}
            </div>
            <div class="presence-dot presence-offline absolute -bottom-0.5 -right-0.5"
                 data-presence="${player.profile_id}"></div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-outfit font-medium text-sm dark:text-white text-[#0a0f1e] truncate">
              @${player.username}
            </div>
            <div class="font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">
              ${player.total_games} partie${player.total_games !== 1 ? 's' : ''} ·
              <span class="text-win">${winRate}%</span> win
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="font-orbitron font-bold text-primary text-sm">${xp.toLocaleString()}</span>
            <i class="fa-solid fa-chevron-right lb-chevron text-[#475569] text-xs" id="chev-${expandId}"></i>
          </div>
        </div>
        <div class="lb-expand" id="${expandId}">
          ${buildExpandPanel(player)}
        </div>`
      container.appendChild(row)
    })
  }

  // ============================================================
  //  CLASSEMENT MONDIAL — même logique que dashboard.js
  //  renderWorldLeaderboard() avec données v_leaderboard
  // ============================================================
  function renderAdminLeaderboard(players) {
    const container = document.getElementById('admin-leaderboard')
    if (!container) return
    container.innerHTML = ''

    players.forEach((player, i) => {
      const rank     = i + 1
      const initials = (player.first_name[0] + player.last_name[0]).toUpperCase()
      const fullName = player.first_name + ' ' + player.last_name
      const xp       = player.xp_total || 0
      const expandId = 'lb-' + player.profile_id

      let rankIcon = ''
      if (rank === 1)      rankIcon = `<div class="w-7 h-7 rounded-full bg-[rgba(251,191,36,0.15)] flex items-center justify-center text-gold shrink-0"><i class="fa-solid fa-crown text-sm"></i></div>`
      else if (rank === 2) rankIcon = `<div class="w-7 h-7 rounded-full bg-[rgba(148,163,184,0.15)] flex items-center justify-center text-silver shrink-0"><i class="fa-solid fa-medal text-sm"></i></div>`
      else if (rank === 3) rankIcon = `<div class="w-7 h-7 rounded-full bg-[rgba(180,83,9,0.15)] flex items-center justify-center text-bronze shrink-0"><i class="fa-solid fa-medal text-sm"></i></div>`

      const rankColor = rank===1?'text-gold':rank===2?'text-silver':rank===3?'text-bronze':'dark:text-[#475569] text-[#94a3b8]'
      const grad      = rank===1?'from-[#fbbf24] to-[#f59e0b]':rank===2?'from-[#94a3b8] to-[#64748b]':'from-[#475569] to-[#1e293b]'

      const row = document.createElement('div')
      row.className = 'transition border-b dark:border-[rgba(255,255,255,0.04)] border-[rgba(0,0,0,0.04)]'
      row.innerHTML = `
        <div class="lb-row-header hover:dark:bg-[rgba(2,183,245,0.04)] hover:bg-[rgba(2,183,245,0.02)] cursor-pointer"
             onclick="window.toggleLbRow('${expandId}')">

          <!-- MOBILE -->
          <div class="lg:hidden px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1 shrink-0 w-10">
                ${rankIcon}<span class="font-orbitron font-bold text-sm ${rankColor}">${rank}</span>
              </div>
              <div class="relative">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br ${grad}
                            flex items-center justify-center text-white font-orbitron text-xs shrink-0">
                  ${initials}
                </div>
                <div class="presence-dot presence-offline absolute -bottom-0.5 -right-0.5"
                     data-presence="${player.profile_id}"></div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-outfit text-sm dark:text-white text-[#0a0f1e] font-medium truncate">
                  @${player.username}
                </div>
                <div class="font-outfit text-xs dark:text-[#94a3b8] text-[#64748b] truncate">${fullName}</div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="text-right">
                  <div class="font-orbitron font-bold text-sm text-primary">${xp.toLocaleString()}</div>
                  <div class="font-rajdhani text-[10px] dark:text-[#475569] text-[#94a3b8] uppercase">pts</div>
                </div>
                <i class="fa-solid fa-chevron-right lb-chevron text-[#475569] text-xs" id="chev-${expandId}"></i>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-2 ml-[52px]">
              <span class="font-rajdhani text-xs dark:text-[#94a3b8] text-[#64748b]">
                ${player.total_games} partie${player.total_games!==1?'s':''}
              </span>
              <span class="dark:text-[#2a3a4a] text-[#cbd5e1] text-xs">·</span>
              <span class="font-rajdhani text-xs text-win"><i class="fa-solid fa-trophy mr-1 text-[10px]"></i>${player.wins}V</span>
              <span class="font-rajdhani text-xs text-lose"><i class="fa-solid fa-skull mr-1 text-[10px]"></i>${player.losses}D</span>
              <span class="font-rajdhani text-xs text-draw"><i class="fa-solid fa-handshake mr-1 text-[10px]"></i>${player.draws}E</span>
            </div>
          </div>

          <!-- DESKTOP -->
          <div class="hidden lg:grid grid-cols-[80px_1fr_100px_80px_80px_80px_120px] gap-2 px-6 py-4 items-center">
            <div class="flex items-center gap-1">
              ${rankIcon}
              <span class="font-orbitron font-bold ${rankColor}">${rank}</span>
            </div>
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br ${grad}
                            flex items-center justify-center text-white font-orbitron text-xs shrink-0">
                  ${initials}
                </div>
                <div class="presence-dot presence-offline absolute -bottom-0.5 -right-0.5"
                     data-presence="${player.profile_id}"></div>
              </div>
              <div class="min-w-0">
                <div class="font-outfit font-medium text-sm dark:text-white text-[#0a0f1e] truncate">
                  ${fullName}
                </div>
                <div class="font-outfit text-xs dark:text-[#94a3b8] text-[#64748b]">@${player.username}</div>
              </div>
            </div>
            <div class="font-outfit text-sm text-center dark:text-white text-[#0a0f1e]">${player.total_games}</div>
            <div class="font-orbitron font-bold text-sm text-win text-center">${player.wins}</div>
            <div class="font-orbitron font-bold text-sm text-lose text-center">${player.losses}</div>
            <div class="font-orbitron font-bold text-sm text-draw text-center">${player.draws}</div>
            <div class="font-orbitron font-bold text-sm text-primary text-right">${xp.toLocaleString()}</div>
          </div>
        </div>

        <!-- Panel expansion — identique dashboard.js -->
        <div class="lb-expand" id="${expandId}">
          ${buildExpandPanel(player)}
        </div>`
      container.appendChild(row)
    })
  }

  // ============================================================
  //  PANEL EXPANSION — copie exacte de buildExpandPanel() du dashboard.js
  //  Stats Solo par niveau (Facile/Moyen/Difficile) + stats PvP
  // ============================================================
  function buildExpandPanel(player) {
    const lvls = [
      { label:'Facile',    color:'text-win',  bar:'bg-win',  g:player.games_easy||0,  w:player.wins_easy||0,  l:player.losses_easy||0,  e:player.draws_easy||0,  xp:player.xp_easy||0  },
      { label:'Moyen',     color:'text-draw', bar:'bg-draw', g:player.games_medium||0, w:player.wins_medium||0, l:player.losses_medium||0, e:player.draws_medium||0, xp:player.xp_medium||0 },
      { label:'Difficile', color:'text-lose', bar:'bg-lose', g:player.games_hard||0,  w:player.wins_hard||0,  l:player.losses_hard||0,  e:player.draws_hard||0,  xp:player.xp_hard||0  },
    ]
    const pvpG  = player.pvp_games       || 0
    const pvpW  = player.pvp_wins        || 0
    const pvpL  = player.pvp_losses      || 0
    const pvpD  = player.pvp_draws       || 0
    const pvpR  = pvpG > 0 ? Math.round((pvpW / pvpG) * 100) : 0
    const pvpBS = player.pvp_best_streak || 0

    return `
    <div class="grid md:grid-cols-2 gap-3 px-4 lg:px-6 py-4
                dark:bg-[rgba(2,183,245,0.02)] bg-[rgba(2,183,245,0.01)]
                border-t dark:border-[rgba(2,183,245,0.08)] border-[rgba(2,183,245,0.12)]">

      <!-- SOLO -->
      <div class="dark:bg-[#0d1b2a] bg-white rounded-xl p-4 border
                  dark:border-[rgba(2,183,245,0.15)] border-[rgba(2,183,245,0.2)]">
        <div class="flex items-center gap-2 mb-3">
          <i class="fa-solid fa-robot text-primary text-xs"></i>
          <span class="font-rajdhani text-xs uppercase tracking-widest text-primary font-bold">Solo vs IA</span>
          <span class="ml-auto font-orbitron font-bold text-xs text-primary">
            ${(player.xp_total||0).toLocaleString()} xp
          </span>
        </div>
        ${lvls.map(lv => {
          const wr = lv.g > 0 ? Math.round((lv.w / lv.g) * 100) : 0
          return `
          <div class="flex items-center gap-2 mb-2.5">
            <span class="font-rajdhani text-xs font-semibold ${lv.color} w-16 shrink-0">${lv.label}</span>
            <div class="flex-1">
              <div class="flex justify-between mb-1">
                <span class="font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">
                  ${lv.g}p · ${lv.w}V ${lv.l}D ${lv.e}E
                </span>
                <span class="font-rajdhani text-xs ${lv.color}">${lv.xp} xp</span>
              </div>
              <div class="w-full h-1 dark:bg-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.06)] rounded-full">
                <div class="h-full rounded-full progress-fill ${lv.bar}" style="width:${wr}%"></div>
              </div>
            </div>
          </div>`
        }).join('')}
      </div>

      <!-- PVP -->
      <div class="dark:bg-[#0d1b2a] bg-white rounded-xl p-4 border
                  dark:border-[rgba(168,85,247,0.2)] border-[rgba(168,85,247,0.25)]">
        <div class="flex items-center gap-2 mb-3">
          <i class="fa-solid fa-users text-[#a855f7] text-xs"></i>
          <span class="font-rajdhani text-xs uppercase tracking-widest text-[#a855f7] font-bold">Multijoueur</span>
          <span class="ml-auto font-rajdhani text-xs dark:text-[#94a3b8] text-[#475569]">
            ${pvpG} partie${pvpG!==1?'s':''}
          </span>
        </div>
        ${pvpG === 0 ? `
          <div class="text-center py-3">
            <i class="fa-solid fa-gamepad dark:text-[#2a3a4a] text-[#cbd5e1] text-2xl mb-2 block"></i>
            <span class="font-outfit text-xs dark:text-[#475569] text-[#94a3b8]">Aucune partie multijoueur</span>
          </div>` : `
          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="text-center dark:bg-[rgba(34,197,94,0.1)] bg-[rgba(34,197,94,0.08)] rounded-lg p-2">
              <div class="font-orbitron font-bold text-lg text-win">${pvpW}</div>
              <div class="font-rajdhani text-[10px] uppercase text-win">V</div>
            </div>
            <div class="text-center dark:bg-[rgba(239,68,68,0.1)] bg-[rgba(239,68,68,0.08)] rounded-lg p-2">
              <div class="font-orbitron font-bold text-lg text-lose">${pvpL}</div>
              <div class="font-rajdhani text-[10px] uppercase text-lose">D</div>
            </div>
            <div class="text-center dark:bg-[rgba(245,158,11,0.1)] bg-[rgba(245,158,11,0.08)] rounded-lg p-2">
              <div class="font-orbitron font-bold text-lg text-draw">${pvpD}</div>
              <div class="font-rajdhani text-[10px] uppercase text-draw">E</div>
            </div>
          </div>
          <div class="flex justify-between mb-1">
            <span class="font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">Ratio victoires</span>
            <span class="font-rajdhani text-xs text-win font-semibold">${pvpR}%</span>
          </div>
          <div class="w-full h-1 dark:bg-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.06)] rounded-full mb-2">
            <div class="h-full bg-win rounded-full progress-fill" style="width:${pvpR}%"></div>
          </div>
          <div class="flex justify-between">
            <span class="font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">Meilleure série</span>
            <span class="font-orbitron font-bold text-xs text-[#a855f7]">
              ${pvpBS} <i class="fa-solid fa-fire text-draw"></i>
            </span>
          </div>`}
      </div>
    </div>`
  }

  // ============================================================
  //  TOGGLE EXPANSION — identique dashboard.js
  // ============================================================
  window.toggleLbRow = function(expandId) {
    const panel = document.getElementById(expandId)
    const chev  = document.getElementById('chev-' + expandId)
    if (!panel) return
    const isOpen = panel.classList.contains('open')
    if (openRowId && openRowId !== expandId) {
      document.getElementById(openRowId)?.classList.remove('open')
      document.getElementById('chev-' + openRowId)?.classList.remove('open')
    }
    panel.classList.toggle('open', !isOpen)
    chev?.classList.toggle('open', !isOpen)
    openRowId = isOpen ? null : expandId
  }

  window.toggleTop5Row = function(expandId) {
    const panel = document.getElementById(expandId)
    const chev  = document.getElementById('chev-' + expandId)
    if (!panel) return
    panel.classList.toggle('open')
    chev?.classList.toggle('open')
  }

  // ============================================================
  //  PRÉSENCE — lecture seule (admin observe, ne joue pas)
  //  Même canal 'shifumi-presence' que les joueurs
  // ============================================================
  function updatePresenceDots(userId, status) {
    const labels = {
      online:   'En ligne',
      in_game:  'En partie',
      in_lobby: 'Dans le lobby',
      offline:  'Hors ligne',
    }
    document.querySelectorAll(`[data-presence="${userId}"]`).forEach(dot => {
      dot.className = `presence-dot presence-${status}`
      dot.title     = labels[status] || 'Hors ligne'
    })
  }

  function applyPresenceState() {
    if (!presenceChannel) return
    const state = presenceChannel.presenceState()

    // Compteur
    const count = Object.keys(state).length
    const el    = document.getElementById('online-count')
    if (el) el.textContent = count + ' en ligne'

    // Reset tous les dots
    document.querySelectorAll('[data-presence]').forEach(d => {
      d.className = 'presence-dot presence-offline'
      d.title     = 'Hors ligne'
    })

    // Appliquer les statuts actuels
    Object.values(state).forEach(presences => {
      const p = presences[0]; if (!p) return
      updatePresenceDots(p.user_id, p.status || 'online')
    })
  }

  function initPresence() {
    return new Promise((resolve) => {
      presenceChannel = sb.channel('shifumi-presence', {
        config: { presence: { key: currentUser.id } }
      })

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          applyPresenceState()
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          newPresences.forEach(p => updatePresenceDots(p.user_id, p.status || 'online'))
          // Mettre à jour le compteur
          const count = Object.keys(presenceChannel.presenceState()).length
          const el    = document.getElementById('online-count')
          if (el) el.textContent = count + ' en ligne'
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          leftPresences.forEach(p => updatePresenceDots(p.user_id, 'offline'))
          const count = Object.keys(presenceChannel.presenceState()).length
          const el    = document.getElementById('online-count')
          if (el) el.textContent = count + ' en ligne'
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: currentUser.id,
              username: 'admin',
              status:   'online',
              since:    new Date().toISOString()
            })
            // Appliquer l'état initial UNE FOIS le track fait
            // (le sync peut avoir été émis avant le track)
            applyPresenceState()
            resolve()
          }
        })
    })
  }

  // ============================================================
  //  DÉCONNEXION (inchangée)
  // ============================================================
  function initLogout() {
    const modal      = document.getElementById('modal-logout')
    const btnOpen    = document.getElementById('btn-logout')
    const btnCancel  = document.getElementById('btn-logout-cancel')
    const btnConfirm = document.getElementById('btn-logout-confirm')
    btnOpen?.addEventListener('click',   () => modal.classList.remove('hidden'))
    btnCancel?.addEventListener('click', () => modal.classList.add('hidden'))
    modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden') })
    btnConfirm?.addEventListener('click', async () => {
      presenceChannel?.untrack()
      await sb.auth.signOut()
      window.location.href = ADMIN_URL + '/connexion_admin.html'
    })
  }

  // ============================================================
  //  THÈME (inchangé)
  // ============================================================
  function initTheme() {
    const html   = document.documentElement
    const toggle = document.getElementById('themeToggle')
    const icon   = document.getElementById('themeIcon')
    const saved  = localStorage.getItem('theme') || 'dark'
    applyTheme(saved)
    function applyTheme(theme) {
      if (theme === 'light') { html.classList.remove('dark'); if (icon) icon.className = 'fa-solid fa-sun text-[#f59e0b]' }
      else                   { html.classList.add('dark');    if (icon) icon.className = 'fa-solid fa-moon text-primary'  }
    }
    toggle?.addEventListener('click', () => {
      const next = html.classList.contains('dark') ? 'light' : 'dark'
      localStorage.setItem('theme', next); applyTheme(next)
    })
  }

  // ============================================================
  //  SIDEBAR MOBILE (inchangée)
  // ============================================================
  function initSidebar() {
    const menuToggle = document.getElementById('menuToggle')
    const overlay    = document.getElementById('sidebarOverlay')
    const body       = document.body
    menuToggle?.addEventListener('click', e => { e.stopPropagation(); body.classList.toggle('sidebar-open') })
    overlay?.addEventListener('click', () => body.classList.remove('sidebar-open'))
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  function setEl(id, value) { const el = document.getElementById(id); if (el) el.textContent = value }

  function showToast(message, type = 'info') {
    document.querySelector('.toast')?.remove()
    const toast = document.createElement('div')
    toast.className = 'toast font-rajdhani font-semibold'
    toast.textContent = message
    if (type === 'success') toast.style.background = '#10b981'
    if (type === 'error')   toast.style.background = '#ef4444'
    if (type === 'info')    toast.style.background = '#02b7f5'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3500)
  }

  // ============================================================
  //  LANCEMENT
  // ============================================================
  initTheme()
  initSidebar()
  initLogout()
  init()

})()