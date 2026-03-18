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

  let allPlayers  = []
  let currentUser = null

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
  }

  // ============================================================
  //  CHARGER TOUS LES JOUEURS
  // ============================================================
  async function loadPlayers() {
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

    const { data: stats } = await sb
      .from('player_stats')
      .select('*')

    allPlayers = (profiles || []).map(p => {
      const s = stats?.find(st => st.profile_id === p.id) || {
        total_games: 0, wins: 0, losses: 0, draws: 0, win_rate: 0,
        best_streak: 0, rock_played: 0, paper_played: 0, scissors_played: 0
      }
      const winRate = s.total_games > 0
        ? Math.round((s.wins / s.total_games) * 100)
        : 0
      return {
        id:              p.id,
        first_name:      p.first_name,
        last_name:       p.last_name,
        username:        p.username,
        avatar_url:      p.avatar_url,
        created_at:      p.created_at,
        total_games:     s.total_games     || 0,
        wins:            s.wins            || 0,
        losses:          s.losses          || 0,
        draws:           s.draws           || 0,
        win_rate:        winRate,
        best_streak:     s.best_streak     || 0,
        rock_played:     s.rock_played     || 0,
        paper_played:    s.paper_played    || 0,
        scissors_played: s.scissors_played || 0,
      }
    })

    updateKPIs()
    renderPlayers(allPlayers)
  }

  // ============================================================
  //  KPIs GLOBAUX
  // ============================================================
  function updateKPIs() {
    setEl('kpi-total', allPlayers.length)

    const totalGames = allPlayers.reduce((acc, p) => acc + p.total_games, 0)
    setEl('kpi-games', totalGames.toLocaleString())

    const avgWinRate = allPlayers.length > 0
      ? Math.round(allPlayers.reduce((acc, p) => acc + p.win_rate, 0) / allPlayers.length)
      : 0
    setEl('kpi-winrate', avgWinRate + '%')

    const best = [...allPlayers].sort((a, b) => b.wins - a.wins)[0]
    setEl('kpi-best', best ? best.username : '—')
  }

  // ============================================================
  //  AFFICHER LA LISTE DES JOUEURS
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
                 </div>`
            }
            <div class="min-w-0">
              <div class="font-outfit font-medium text-sm dark:text-white text-[#0a0f1e] truncate">${fullName}</div>
              <div class="font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">${player.id.substring(0, 8)}...</div>
            </div>
          </div>
          <div class="text-center">
            <span class="font-rajdhani text-sm dark:text-primary text-[#0288d1] font-semibold">@${player.username}</span>
          </div>
          <div class="text-center font-outfit text-sm dark:text-white text-[#0a0f1e]">${player.total_games}</div>
          <div class="text-center font-orbitron font-bold text-sm text-win">${player.wins}</div>
          <div class="text-center font-orbitron font-bold text-sm ${winColor}">${player.win_rate}%</div>
          <div class="text-center font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">${dateStr}</div>
          <div class="flex items-center justify-center gap-2">
            <button onclick="openStats('${player.id}')"
              class="action-btn bg-[rgba(2,183,245,0.1)] text-primary hover:bg-[rgba(2,183,245,0.2)]"
              title="Voir les stats">
              <i class="fa-solid fa-chart-bar"></i>
            </button>
            <button onclick="openEdit('${player.id}')"
              class="action-btn bg-[rgba(251,191,36,0.1)] text-gold hover:bg-[rgba(251,191,36,0.2)]"
              title="Modifier">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button onclick="openDelete('${player.id}', '${fullName.replace(/'/g, "\\'")}')"
              class="action-btn bg-[rgba(239,68,68,0.1)] text-lose hover:bg-[rgba(239,68,68,0.2)]"
              title="Supprimer">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `
      container.appendChild(row)
    })
  }

  // ============================================================
  //  RECHERCHE
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
  //  MODAL STATS
  // ============================================================
  window.openStats = function (playerId) {
    const player = allPlayers.find(p => p.id === playerId)
    if (!player) return

    const initials = (player.first_name[0] + player.last_name[0]).toUpperCase()
    const avatarEl = document.getElementById('stats-avatar')
    if (player.avatar_url) {
      avatarEl.innerHTML = `<img src="${player.avatar_url}" alt="avatar" class="w-full h-full object-cover rounded-full">`
    } else {
      avatarEl.textContent = initials
    }

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

  document.getElementById('btn-stats-close').addEventListener('click', () => {
    document.getElementById('modal-stats').classList.add('hidden')
  })
  document.getElementById('modal-stats').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-stats'))
      document.getElementById('modal-stats').classList.add('hidden')
  })

  // ============================================================
  //  MODAL ÉDITION
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

  document.getElementById('btn-edit-close').addEventListener('click', () => {
    document.getElementById('modal-edit').classList.add('hidden')
  })
  document.getElementById('btn-edit-cancel').addEventListener('click', () => {
    document.getElementById('modal-edit').classList.add('hidden')
  })
  document.getElementById('modal-edit').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-edit'))
      document.getElementById('modal-edit').classList.add('hidden')
  })

  document.getElementById('btn-edit-save').addEventListener('click', async () => {
    const id        = document.getElementById('edit-player-id').value
    const lastName  = document.getElementById('edit-lastname').value.trim()
    const firstName = document.getElementById('edit-firstname').value.trim()
    const username  = document.getElementById('edit-username').value.trim()

    if (!lastName || !firstName || !username) {
      showToast('Tous les champs sont obligatoires.', 'error')
      return
    }

    const btn = document.getElementById('btn-edit-save')
    btn.disabled    = true
    btn.textContent = 'Sauvegarde...'

    const { data: existing } = await sb
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', id)
      .maybeSingle()

    if (existing) {
      showToast('Ce pseudo est déjà utilisé par un autre joueur.', 'error')
      btn.disabled    = false
      btn.innerHTML   = '<i class="fa-solid fa-floppy-disk mr-1"></i> Sauvegarder'
      return
    }

    const { error } = await sb
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName, username })
      .eq('id', id)

    if (error) {
      showToast('Erreur lors de la mise à jour.', 'error')
      console.error(error)
    } else {
      showToast('Joueur mis à jour avec succès.', 'success')
      document.getElementById('modal-edit').classList.add('hidden')
      await loadPlayers()
    }

    btn.disabled  = false
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> Sauvegarder'
  })

  // ============================================================
  //  MODAL SUPPRESSION
  // ============================================================
  window.openDelete = function (playerId, playerName) {
    document.getElementById('delete-player-id').value          = playerId
    document.getElementById('delete-player-name').textContent  = playerName
    document.getElementById('modal-delete').classList.remove('hidden')
  }

  document.getElementById('btn-delete-cancel').addEventListener('click', () => {
    document.getElementById('modal-delete').classList.add('hidden')
  })
  document.getElementById('modal-delete').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-delete'))
      document.getElementById('modal-delete').classList.add('hidden')
  })

  document.getElementById('btn-delete-confirm').addEventListener('click', async () => {
    const id  = document.getElementById('delete-player-id').value
    const btn = document.getElementById('btn-delete-confirm')

    btn.disabled    = true
    btn.textContent = 'Suppression...'

    const { error } = await sb
      .from('profiles')
      .delete()
      .eq('id', id)

    if (error) {
      showToast('Erreur lors de la suppression.', 'error')
      console.error(error)
      btn.disabled  = false
      btn.innerHTML = '<i class="fa-solid fa-trash mr-1"></i> SUPPRIMER'
      return
    }

    showToast('Joueur supprimé avec succès.', 'success')
    document.getElementById('modal-delete').classList.add('hidden')
    await loadPlayers()

    btn.disabled  = false
    btn.innerHTML = '<i class="fa-solid fa-trash mr-1"></i> SUPPRIMER'
  })

  // ============================================================
  //  DÉCONNEXION
  // ============================================================
  function initLogout() {
    const modal      = document.getElementById('modal-logout')
    const btnOpen    = document.getElementById('btn-logout')
    const btnCancel  = document.getElementById('btn-logout-cancel')
    const btnConfirm = document.getElementById('btn-logout-confirm')

    btnOpen?.addEventListener('click',   () => modal.classList.remove('hidden'))
    btnCancel?.addEventListener('click', () => modal.classList.add('hidden'))
    modal?.addEventListener('click', e => {
      if (e.target === modal) modal.classList.add('hidden')
    })
    btnConfirm?.addEventListener('click', async () => {
      await sb.auth.signOut()
      window.location.href = ADMIN_URL + '/connexion_admin.html'
    })
  }

  // ============================================================
  //  THÈME
  // ============================================================
  function initTheme() {
    const html   = document.documentElement
    const toggle = document.getElementById('themeToggle')
    const icon   = document.getElementById('themeIcon')
    const saved  = localStorage.getItem('theme') || 'dark'

    applyTheme(saved)

    function applyTheme(theme) {
      if (theme === 'light') {
        html.classList.remove('dark')
        if (icon) icon.className = 'fa-solid fa-sun text-[#f59e0b]'
      } else {
        html.classList.add('dark')
        if (icon) icon.className = 'fa-solid fa-moon text-primary'
      }
    }

    toggle?.addEventListener('click', () => {
      const next = html.classList.contains('dark') ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      applyTheme(next)
    })
  }

  // ============================================================
  //  SIDEBAR MOBILE
  // ============================================================
  function initSidebar() {
    const menuToggle = document.getElementById('menuToggle')
    const overlay    = document.getElementById('sidebarOverlay')
    const body       = document.body

    menuToggle?.addEventListener('click', e => {
      e.stopPropagation()
      body.classList.toggle('sidebar-open')
    })
    overlay?.addEventListener('click', () => body.classList.remove('sidebar-open'))
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  function setEl(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
  }

  function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.className   = 'toast font-rajdhani font-semibold'
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