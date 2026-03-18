(function () {

  // ============================================================
  //  CONFIG SUPABASE
  // ============================================================
  const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
  const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'
  const { createClient } = supabase
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const BASE_URL = window.location.origin

  let currentUser    = null
  let currentProfile = null

  // ============================================================
  //  INIT
  // ============================================================
  async function init() {
    console.log('[DASHBOARD] init()')

    const { data: { session }, error: sessionError } = await sb.auth.getSession()
    console.log('[DASHBOARD] session:', session, 'erreur:', sessionError)

    if (!session) {
      window.location.href = BASE_URL + '/player/connexion.html'
      return
    }
    currentUser = session.user
    console.log('[DASHBOARD] currentUser.id:', currentUser.id)

    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('first_name, last_name, username, avatar_url')
      .eq('id', currentUser.id)
      .single()

    console.log('[DASHBOARD] profile:', profile, 'erreur:', profileError)

    if (profile) {
      currentProfile = profile
      const initials = (profile.first_name[0] + profile.last_name[0]).toUpperCase()
      const fullName = profile.first_name + ' ' + profile.last_name

      const navAvatar = document.getElementById('nav-avatar')
      const navName   = document.getElementById('nav-name')
      const navUser   = document.getElementById('nav-username')
      const welcomeEl = document.getElementById('welcome-name')


      if (navAvatar) {
        if (profile.avatar_url) {
          navAvatar.innerHTML = `<img src="${profile.avatar_url}" 
            class="w-full h-full object-cover rounded-full" alt="avatar">`
        } else {
          navAvatar.textContent = initials
        }
      }
      if (navName)   navName.textContent   = fullName
      if (navUser)   navUser.textContent   = '@' + profile.username
      if (welcomeEl) welcomeEl.textContent = 'Bienvenue, ' + profile.first_name
    }

    await loadMyStats()
    await loadLeaderboard()
  }

  // ============================================================
  //  MES STATS
  // ============================================================
  async function loadMyStats() {
    console.log('[STATS] loadMyStats() pour profile_id:', currentUser.id)

    const { data: stats, error } = await sb
      .from('player_stats')
      .select('*')
      .eq('profile_id', currentUser.id)
      .single()

    console.log('[STATS] data:', stats, 'erreur:', error)

    if (!stats) {
      console.warn('[STATS] Aucune stat trouvée')
      setEl('stat-total-games', 0)
      setEl('stat-score',  '0')
      setEl('stat-wins',   0)
      setEl('stat-losses', 0)
      setEl('stat-draws',  0)
      setEl('rate-wins',   '0% de taux de victoire')
      setEl('rate-losses', '0% de défaites')
      setEl('rate-draws',  "0% d'égalités")
      setProgress('progress-wins',   0)
      setProgress('progress-losses', 0)
      setProgress('progress-draws',  0)
      return
    }

    const total    = stats.total_games || 0
    const wins     = stats.wins        || 0
    const losses   = stats.losses      || 0
    const draws    = stats.draws       || 0
    const winRate  = total > 0 ? Math.round((wins   / total) * 100) : 0
    const lossRate = total > 0 ? Math.round((losses / total) * 100) : 0
    const drawRate = total > 0 ? Math.round((draws  / total) * 100) : 0
    const xp       = wins * 10 + draws * 3

    console.log('[STATS] total:', total, 'wins:', wins, 'xp:', xp)

    setEl('stat-total-games', total)
    setEl('stat-score',       xp.toLocaleString())
    setEl('stat-wins',        wins)
    setEl('stat-losses',      losses)
    setEl('stat-draws',       draws)
    setEl('rate-wins',        winRate  + '% de taux de victoire')
    setEl('rate-losses',      lossRate + '% de défaites')
    setEl('rate-draws',       drawRate + "% d'égalités")
    setProgress('progress-wins',   winRate)
    setProgress('progress-losses', lossRate)
    setProgress('progress-draws',  drawRate)
  }

  // ============================================================
  //  CLASSEMENT
  // ============================================================
  async function loadLeaderboard() {
    console.log('[LEADERBOARD] loadLeaderboard()')

    const { data: allProfiles, error: profError } = await sb
      .from('profiles')
      .select('id, first_name, last_name, username, created_at')
      .eq('role', 'player')

    console.log('[LEADERBOARD] profiles:', allProfiles?.length, 'erreur:', profError)

    const { data: allStats, error: statsError } = await sb
      .from('player_stats')
      .select('*')

    console.log('[LEADERBOARD] stats:', allStats?.length, 'erreur:', statsError)

    if (!allProfiles || allProfiles.length === 0) {
      console.warn('[LEADERBOARD] Aucun profil trouvé')
      return
    }

    const players = allProfiles.map(p => {
      const stats = allStats?.find(s => s.profile_id === p.id) || {
        total_games: 0, wins: 0, losses: 0, draws: 0,
        win_rate: 0, best_streak: 0,
        rock_played: 0, paper_played: 0, scissors_played: 0
      }
      const xp = (stats.wins || 0) * 10 + (stats.draws || 0) * 3
      return { id: p.id, first_name: p.first_name, last_name: p.last_name, username: p.username, created_at: p.created_at, total_games: stats.total_games || 0, wins: stats.wins || 0, losses: stats.losses || 0, draws: stats.draws || 0, best_streak: stats.best_streak || 0, xp }
    })

    players.sort((a, b) => {
      if (b.xp !== a.xp) return b.xp - a.xp
      return new Date(a.created_at) - new Date(b.created_at)
    })

    const myIndex = players.findIndex(p => p.id === currentUser.id)
    const myRank  = myIndex + 1
    console.log('[LEADERBOARD] mon rang:', myRank)

    setEl('my-rank', '#' + myRank)

    const me = players[myIndex]
    if (me) {
      setEl('my-rank-wins',   (me.wins   || 0) + 'V')
      setEl('my-rank-losses', (me.losses || 0) + 'D')
      setEl('my-rank-draws',  (me.draws  || 0) + 'E')
      setEl('my-rank-score',  me.xp.toLocaleString() + ' pts')

      const rankBadge = document.getElementById('nav-rank')
      if (rankBadge) rankBadge.innerHTML = `<i class="fa-solid fa-medal"></i> Rang #${myRank}`

      const rankSub = document.getElementById('nav-rank-sub')
      if (rankSub) rankSub.textContent = 'Rang #' + myRank + ' mondial'
    }

    renderTop5(players)
    renderWorldLeaderboard(players)
  }

  // ============================================================
  //  TOP 5
  // ============================================================
  function renderTop5(players) {
    const container = document.getElementById('top5-container')
    if (!container) { console.warn('[TOP5] container introuvable'); return }

    container.innerHTML = ''
    const top5 = players.slice(0, 5)

    const rankColors  = ['text-gold', 'text-silver', 'text-bronze', 'text-[#475569]', 'text-[#475569]']
    const avatarGrads = [
      'from-[#fbbf24] to-[#f59e0b]',
      'from-[#94a3b8] to-[#64748b]',
      'from-[#02b7f5] to-[#0066ff]',
      'from-[#475569] to-[#1e293b]',
      'from-[#475569] to-[#334155]',
    ]

    top5.forEach((player, i) => {
      const isMe     = player.id === currentUser.id
      const rank     = i + 1
      const initials = (player.first_name[0] + player.last_name[0]).toUpperCase()
      const fullName = player.first_name + ' ' + player.last_name
      const grad     = isMe ? 'from-[#02b7f5] to-[#0066ff]' : (avatarGrads[i] || 'from-[#475569] to-[#1e293b]')

      const row = document.createElement('div')
      row.className = `flex items-center gap-3 p-2 rounded-xl transition ${
        isMe ? 'bg-[rgba(2,183,245,0.08)] border-l-4 border-l-primary' : 'hover:bg-[rgba(2,183,245,0.05)]'
      }`
      row.innerHTML = `
        <span class="font-orbitron font-bold ${rankColors[i] || 'text-[#475569]'} w-6">${rank}</span>
        <div class="w-8 h-8 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-orbitron text-xs shrink-0">
          ${initials}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-outfit font-medium text-sm dark:text-white text-[#0a0f1e] truncate">${fullName}</span>
            ${isMe ? '<span class="text-[10px] font-rajdhani px-2 py-0.5 rounded-full bg-primary text-white shrink-0">MOI</span>' : ''}
          </div>
          <div class="font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">
            ${player.total_games || 0} partie${(player.total_games || 0) !== 1 ? 's' : ''} · ${player.xp.toLocaleString()} pts
          </div>
        </div>
        <span class="font-orbitron font-bold text-primary shrink-0">${player.xp.toLocaleString()}</span>
      `
      container.appendChild(row)
    })
    console.log('[TOP5] rendu OK,', top5.length, 'joueurs')
  }

  // ============================================================
  //  CLASSEMENT MONDIAL
  // ============================================================
  function renderWorldLeaderboard(players) {
    const container = document.getElementById('leaderboard-body')
    if (!container) { console.warn('[LEADERBOARD] leaderboard-body introuvable'); return }

    container.innerHTML = ''

    players.forEach((player, i) => {
      const rank     = i + 1
      const isMe     = player.id === currentUser.id
      const initials = (player.first_name[0] + player.last_name[0]).toUpperCase()
      const fullName = player.first_name + ' ' + player.last_name

      let rankIcon = ''
      if (rank === 1) rankIcon = `<div class="w-7 h-7 rounded-full bg-[rgba(251,191,36,0.15)] flex items-center justify-center text-gold"><i class="fa-solid fa-crown text-sm"></i></div>`
      else if (rank === 2) rankIcon = `<div class="w-7 h-7 rounded-full bg-[rgba(148,163,184,0.15)] flex items-center justify-center text-silver"><i class="fa-solid fa-medal text-sm"></i></div>`
      else if (rank === 3) rankIcon = `<div class="w-7 h-7 rounded-full bg-[rgba(180,83,9,0.15)] flex items-center justify-center text-bronze"><i class="fa-solid fa-medal text-sm"></i></div>`

      const rankColor = rank === 1 ? 'text-gold' : rank === 2 ? 'text-silver' : rank === 3 ? 'text-bronze' : 'text-[#475569]'
      const grad = isMe
        ? 'from-[#02b7f5] to-[#0066ff]'
        : rank === 1 ? 'from-[#fbbf24] to-[#f59e0b]'
        : rank === 2 ? 'from-[#94a3b8] to-[#64748b]'
        : 'from-[#475569] to-[#1e293b]'

      const row = document.createElement('div')
      row.className = `grid grid-cols-[80px_1fr_100px_80px_80px_80px_120px] gap-2 px-6 py-4 items-center transition ${
        isMe
          ? 'dark:bg-[rgba(2,183,245,0.06)] bg-[rgba(2,183,245,0.04)] border-l-4 border-l-primary'
          : 'hover:dark:bg-[rgba(2,183,245,0.04)] hover:bg-[rgba(2,183,245,0.02)]'
      }`
      row.innerHTML = `
        <div class="flex items-center gap-1">
          ${rankIcon}
          <span class="font-orbitron font-bold ${rankColor}">${rank}</span>
        </div>
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-orbitron text-xs shrink-0">
            ${initials}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-outfit font-medium text-sm dark:text-white text-[#0a0f1e] truncate">${fullName}</span>
              ${isMe ? '<span class="text-[10px] font-rajdhani px-2 py-0.5 rounded-full bg-primary text-white shrink-0">VOUS</span>' : ''}
            </div>
            <div class="font-outfit text-xs dark:text-[#94a3b8] text-[#64748b]">@${player.username}</div>
          </div>
        </div>
        <div class="font-outfit text-sm text-center">${player.total_games || 0}</div>
        <div class="font-orbitron font-bold text-sm text-win text-center">${player.wins || 0}</div>
        <div class="font-orbitron font-bold text-sm text-lose text-center">${player.losses || 0}</div>
        <div class="font-orbitron font-bold text-sm text-draw text-center">${player.draws || 0}</div>
        <div class="font-orbitron font-bold text-sm text-primary text-right">${player.xp.toLocaleString()}</div>
      `
      container.appendChild(row)
    })
    console.log('[LEADERBOARD] rendu OK,', players.length, 'joueurs')
  }

  // ============================================================
  //  DÉCONNEXION
  // ============================================================
  function initLogout() {
    const btnLogout        = document.getElementById('btn-logout')
    const btnLogoutSidebar = document.getElementById('btn-logout-sidebar')
    const modalLogout      = document.getElementById('modal-logout')
    const btnCancel        = document.getElementById('btn-logout-cancel')
    const btnConfirm       = document.getElementById('btn-logout-confirm')

    function openModal()  { modalLogout?.classList.remove('hidden') }
    function closeModal() { modalLogout?.classList.add('hidden') }

    btnLogout?.addEventListener('click', openModal)
    btnLogoutSidebar?.addEventListener('click', openModal)
    btnCancel?.addEventListener('click', closeModal)
    modalLogout?.addEventListener('click', e => {
      if (e.target === modalLogout) closeModal()
    })
    btnConfirm?.addEventListener('click', async () => {
      await sb.auth.signOut()
      window.location.href = BASE_URL + '/player/connexion.html'
    })
  }

  // ============================================================
  //  THÈME
  // ============================================================
  function initTheme() {
    const html               = document.documentElement
    const themeToggleSidebar = document.getElementById('themeToggleSidebar')
    const themeToggleNav     = document.getElementById('themeToggleNav')
    const navThemeIcon       = document.getElementById('navThemeIcon')

    const savedTheme = localStorage.getItem('theme') || 'dark'
    applyTheme(savedTheme)

    function applyTheme(theme) {
      if (theme === 'light') {
        html.classList.remove('dark')
        if (navThemeIcon) navThemeIcon.className = 'fa-solid fa-sun text-[#f59e0b]'
      } else {
        html.classList.add('dark')
        if (navThemeIcon) navThemeIcon.className = 'fa-solid fa-moon text-primary'
      }
    }

    function toggleTheme() {
      const next = html.classList.contains('dark') ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      applyTheme(next)
    }

    themeToggleSidebar?.addEventListener('click', toggleTheme)
    themeToggleNav?.addEventListener('click', toggleTheme)
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
    overlay?.addEventListener('click', () => {
      body.classList.remove('sidebar-open')
    })
  }

  // ============================================================
  //  HIGHLIGHT MENU AU SCROLL
  // ============================================================
  function initScrollHighlight() {
    const sections = document.querySelectorAll('div[id]')
    const navLinks = document.querySelectorAll('.sidebar nav a')

    window.addEventListener('scroll', () => {
      let current = ''
      sections.forEach(section => {
        if (window.pageYOffset >= section.offsetTop - 150) {
          current = section.getAttribute('id')
        }
      })
      navLinks.forEach(link => {
        link.classList.remove('active-menu')
        if (link.getAttribute('href') === `#${current}`) {
          link.classList.add('active-menu')
        }
      })
    })
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  function setEl(id, value) {
    const el = document.getElementById(id)
    if (el) {
      el.textContent = value
    } else {
      console.warn('[setEl] élément introuvable:', id)
    }
  }

  function setProgress(id, percent) {
    const el = document.getElementById(id)
    if (el) {
      el.style.width = Math.min(Math.max(percent, 0), 100) + '%'
    } else {
      console.warn('[setProgress] élément introuvable:', id)
    }
  }

  // ============================================================
  //  LANCEMENT
  // ============================================================
  initTheme()
  initSidebar()
  initScrollHighlight()
  initLogout()
  init()

})()