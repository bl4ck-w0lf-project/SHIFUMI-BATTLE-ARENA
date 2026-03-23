(function () {

  // ============================================================
  //  CONFIG SUPABASE
  // ============================================================
  const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
  const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'
  const { createClient } = supabase
  const sb      = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const BASE_URL = window.location.origin

  let currentUser     = null
  let currentProfile  = null
  let openRowId       = null
  let presenceChannel = null

  // ============================================================
  //  INIT
  // ============================================================
  async function init() {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { window.location.href = BASE_URL + '/player/connexion.html'; return }
    currentUser = session.user

    // ★ FIX PAGE BLANCHE
    document.body.style.visibility = 'visible'
    document.body.style.opacity    = '1'

    const { data: profile } = await sb
      .from('profiles')
      .select('first_name, last_name, username, avatar_url')
      .eq('id', currentUser.id)
      .single()

    if (profile) {
      currentProfile = profile
      const initials  = (profile.first_name[0] + profile.last_name[0]).toUpperCase()
      const navAvatar = document.getElementById('nav-avatar')
      if (profile.avatar_url) {
        navAvatar.innerHTML = `<img src="${profile.avatar_url}" class="w-full h-full object-cover rounded-full" alt="avatar">`
      } else {
        navAvatar.textContent = initials
      }
      document.getElementById('nav-name').textContent     = profile.first_name + ' ' + profile.last_name
      document.getElementById('nav-username').textContent = '@' + profile.username
      document.getElementById('welcome-name').textContent = 'Bienvenue, ' + profile.first_name
    }

    await Promise.all([loadMyStats(), loadLeaderboard(), initPresence(), loadPvpTop3()])
  }

  // ============================================================
  //  MES STATS SOLO — XP depuis la base
  // ============================================================
  async function loadMyStats() {
    const { data: stats } = await sb
      .from('player_stats')
      .select(`total_games, wins, losses, draws, win_rate,
        games_easy, games_medium, games_hard,
        wins_easy, wins_medium, wins_hard,
        losses_easy, losses_medium, losses_hard,
        draws_easy, draws_medium, draws_hard,
        xp_easy, xp_medium, xp_hard, xp_total,
        best_streak, current_streak`)
      .eq('profile_id', currentUser.id)
      .single()

    const empty = { games_easy:0, games_medium:0, games_hard:0,
      wins_easy:0, wins_medium:0, wins_hard:0,
      losses_easy:0, losses_medium:0, losses_hard:0,
      draws_easy:0, draws_medium:0, draws_hard:0,
      xp_easy:0, xp_medium:0, xp_hard:0, xp_total:0 }

    if (!stats) {
      setEl('stat-total-games', 0); setEl('stat-score', '0')
      setEl('stat-wins', 0); setEl('stat-losses', 0); setEl('stat-draws', 0)
      setEl('rate-wins', '0% de taux de victoire'); setEl('rate-losses', '0% de défaites'); setEl('rate-draws', "0% d'égalités")
      setProgress('progress-wins', 0); setProgress('progress-losses', 0); setProgress('progress-draws', 0)
      renderLevelStats(empty)
      renderPvpStats(null)
      return
    }

    const total    = stats.total_games || 0
    const wins     = stats.wins        || 0
    const losses   = stats.losses      || 0
    const draws    = stats.draws       || 0
    const winRate  = total > 0 ? Math.round((wins   / total) * 100) : 0
    const lossRate = total > 0 ? Math.round((losses / total) * 100) : 0
    const drawRate = total > 0 ? Math.round((draws  / total) * 100) : 0

    setEl('stat-total-games', total)
    setEl('stat-score',       (stats.xp_total || 0).toLocaleString())
    setEl('stat-wins',        wins)
    setEl('stat-losses',      losses)
    setEl('stat-draws',       draws)
    setEl('rate-wins',        winRate  + '% de taux de victoire')
    setEl('rate-losses',      lossRate + '% de défaites')
    setEl('rate-draws',       drawRate + "% d'égalités")
    setProgress('progress-wins',   winRate)
    setProgress('progress-losses', lossRate)
    setProgress('progress-draws',  drawRate)
    renderLevelStats(stats)

    const { data: pvp } = await sb
      .from('player_stats_pvp')
      .select('total_games, wins, losses, draws, win_rate, best_streak, current_streak')
      .eq('profile_id', currentUser.id)
      .single()
    renderPvpStats(pvp)
  }

  // ============================================================
  //  STATS PAR NIVEAU
  // ============================================================
  function renderLevelStats(s) {
    const lvls = [
      { k:'easy',   label:'Facile',    colorText:'text-win',  barId:'bar-easy'   },
      { k:'medium', label:'Moyen',     colorText:'text-draw', barId:'bar-medium' },
      { k:'hard',   label:'Difficile', colorText:'text-lose', barId:'bar-hard'   },
    ]
    lvls.forEach(l => {
      const g  = s[`games_${l.k}`]   || 0
      const w  = s[`wins_${l.k}`]    || 0
      const lo = s[`losses_${l.k}`]  || 0
      const dr =  s[`draws_${l.k}`]   || 0
      const xp = s[`xp_${l.k}`]      || 0
      const wr = g > 0 ? Math.round((w / g) * 100) : 0
      setEl(`games-${l.k}`,  g)
      setEl(`wins-${l.k}`,   w)
      setEl(`losses-${l.k}`, lo)
      setEl(`draws-${l.k}`, dr)
      setEl(`xp-${l.k}`,     xp + ' xp')
      setEl(`rate-${l.k}`,   wr + '% win')
      setProgress(l.barId, wr)
    })
  }

  // ============================================================
  //  STATS PVP (mes stats perso)
  // ============================================================
  function renderPvpStats(pvp) {
    const container = document.getElementById('pvp-stats-container')
    if (!container) return

    if (!pvp || (pvp.total_games || 0) === 0) {
      container.innerHTML = `
        <div class="text-center py-6">
          <i class="fa-solid fa-users dark:text-[#2a3a4a] text-[#cbd5e1] text-3xl mb-3 block"></i>
          <p class="font-rajdhani dark:text-[#475569] text-[#94a3b8] text-sm">Aucune partie multijoueur jouée</p>
          <a href="../room/lobby.html" class="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full
             bg-gradient-to-r from-[#a855f7] to-[#7c3aed] text-white font-rajdhani font-semibold text-sm
             hover:brightness-110 transition">
            <i class="fa-solid fa-plus"></i> Créer une partie
          </a>
        </div>`
      return
    }

    const total  = pvp.total_games || 0
    const wins   = pvp.wins        || 0
    const losses = pvp.losses      || 0
    const draws  = pvp.draws       || 0
    const wr     = total > 0 ? Math.round((wins / total) * 100) : 0

    container.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center p-4 dark:bg-[rgba(168,85,247,0.08)] bg-[rgba(168,85,247,0.05)] rounded-xl border dark:border-[rgba(168,85,247,0.15)] border-[rgba(168,85,247,0.2)]">
          <div class="font-orbitron font-bold text-2xl dark:text-white text-[#0a0f1e]">${total}</div>
          <div class="font-rajdhani text-xs uppercase dark:text-[#94a3b8] text-[#475569] mt-1">Parties</div>
        </div>
        <div class="text-center p-4 dark:bg-[rgba(34,197,94,0.08)] bg-[rgba(34,197,94,0.05)] rounded-xl border dark:border-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.2)]">
          <div class="font-orbitron font-bold text-2xl text-win">${wins}</div>
          <div class="font-rajdhani text-xs uppercase dark:text-[#94a3b8] text-[#475569] mt-1">Victoires</div>
        </div>
        <div class="text-center p-4 dark:bg-[rgba(239,68,68,0.08)] bg-[rgba(239,68,68,0.05)] rounded-xl border dark:border-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.2)]">
          <div class="font-orbitron font-bold text-2xl text-lose">${losses}</div>
          <div class="font-rajdhani text-xs uppercase dark:text-[#94a3b8] text-[#475569] mt-1">Défaites</div>
        </div>
        <div class="text-center p-4 dark:bg-[rgba(245,158,11,0.1)] bg-[rgba(245,158,11,0.08)] rounded-xl border dark:border-[rgba(245,158,11,0.15)] border-[rgba(245,158,11,0.2)]">
          <div class="font-orbitron font-bold text-2xl text-draw">${draws}</div>
          <div class="font-rajdhani text-xs uppercase dark:text-[#94a3b8] text-[#475569] mt-1">Égalités</div>
        </div>
        <div class="text-center p-4 dark:bg-[rgba(168,85,247,0.08)] bg-[rgba(168,85,247,0.05)] rounded-xl border dark:border-[rgba(168,85,247,0.15)] border-[rgba(168,85,247,0.2)]">
          <div class="font-orbitron font-bold text-2xl text-[#a855f7]">${pvp.best_streak || 0}</div>
          <div class="font-rajdhani text-xs uppercase dark:text-[#94a3b8] text-[#475569] mt-1">Meilleure série</div>
        </div>
      </div>
      <div class="mt-4">
        <div class="flex justify-between mb-1">
          <span class="font-rajdhani text-xs dark:text-[#94a3b8] text-[#475569]">Ratio victoires</span>
          <span class="font-rajdhani text-xs text-win font-semibold">${wr}%</span>
        </div>
        <div class="w-full h-2 dark:bg-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.06)] rounded-full">
          <div class="h-full bg-gradient-to-r from-[#a855f7] to-[#22c55e] rounded-full progress-fill" style="width:${wr}%"></div>
        </div>
        <div class="flex justify-between mt-1">
          <span class="font-rajdhani text-[10px] dark:text-[#475569] text-[#94a3b8]">${draws} égalité${draws !== 1 ? 's' : ''}</span>
          <a href="lobby.html" class="font-rajdhani text-[10px] text-[#a855f7] hover:underline">
            Jouer une partie <i class="fa-solid fa-arrow-right ml-1"></i>
          </a>
        </div>
      </div>`
  }

  // ============================================================
  //  TOP 3 PVP — classement multijoueur
  // ============================================================
  async function loadPvpTop3() {
    const { data: players } = await sb
      .from('player_stats_pvp')
      .select(`
        profile_id,
        total_games, wins, losses, draws,
        win_rate, best_streak,
        profiles!inner(first_name, last_name, username, avatar_url)
      `)
      .gt('total_games', 0)
      .order('wins', { ascending: false })
      .limit(3)

    renderPvpTop3(players || [])
  }

  function renderPvpTop3(players) {
    const container = document.getElementById('pvp-top3-container')
    if (!container) return

    if (players.length === 0) {
      container.className = ''
      container.innerHTML = `
        <div class="col-span-3 text-center py-10">
          <i class="fa-solid fa-users dark:text-[#2a3a4a] text-[#cbd5e1] text-3xl mb-3 block"></i>
          <p class="font-rajdhani dark:text-[#475569] text-[#94a3b8] text-sm">Aucune donnée PvP disponible</p>
        </div>`
      return
    }

    // Ordre podium : 2ème (gauche) | 1er/Champion (centre) | 3ème (droite)
    const slots = [
      players[1] || null,
      players[0] || null,
      players[2] || null,
    ]

    const cfg = [
      {
        rankLabel: '2ÈME',
        rankIcon:  '<i class="fa-solid fa-medal"></i>',
        rankClass: 'pvp-rank-2nd',
        cardClass: 'pvp-card-2nd',
        avClass:   'pvp-av pvp-av-2nd',
        numSize:   'pvp-vde-n pvp-vde-n-md',
        isChamp:   false,
      },
      {
        rankLabel: 'CHAMPION',
        rankIcon:  '<i class="fa-solid fa-crown"></i>',
        rankClass: 'pvp-rank-champion',
        cardClass: 'pvp-card-champion',
        avClass:   'pvp-av pvp-av-champion',
        numSize:   'pvp-vde-n pvp-vde-n-lg',
        isChamp:   true,
      },
      {
        rankLabel: '3ÈME',
        rankIcon:  '<i class="fa-solid fa-medal"></i>',
        rankClass: 'pvp-rank-3rd',
        cardClass: 'pvp-card-3rd',
        avClass:   'pvp-av pvp-av-3rd',
        numSize:   'pvp-vde-n pvp-vde-n-md',
        isChamp:   false,
      },
    ]

    container.className = 'pvp-podium-wrap'
    container.innerHTML = ''

    slots.forEach((player, i) => {
      const c = cfg[i]

      if (!player) {
        // Placeholder vide si moins de 3 joueurs
        const empty = document.createElement('div')
        empty.className = `pvp-podium-card ${c.cardClass}`
        empty.style.opacity = '0.3'
        empty.innerHTML = `<span class="pvp-rank-lbl ${c.rankClass}">${c.rankIcon} ${c.rankLabel}</span>
          <div class="${c.avClass}">?</div>
          <span class="pvp-fullname" style="color:#475569">—</span>`
        container.appendChild(empty)
        return
      }

      const profile  = player.profiles
      const initials = (profile.first_name[0] + profile.last_name[0]).toUpperCase()
      const total    = player.total_games || 0
      const wins     = player.wins        || 0
      const losses   = player.losses      || 0
      const draws    = player.draws       || 0
      const wr       = total > 0 ? Math.round((wins / total) * 100) : 0
      const isMe     = player.profile_id === currentUser.id
      const streak   = player.best_streak || 0

      const card = document.createElement('div')
      card.className = `pvp-podium-card ${c.cardClass}`
      card.innerHTML = `
        <!-- Rang -->
        <div class="pvp-rank-lbl ${c.rankClass}">
          ${c.rankIcon} ${c.rankLabel}
          ${isMe ? '<span style="font-size:0.5rem;background:#02b7f5;color:#fff;padding:1px 5px;border-radius:99px;margin-left:4px;">MOI</span>' : ''}
        </div>

        <!-- Avatar -->
        <div class="relative">
          <div class="${c.avClass}" style="position:relative;">
            ${profile.avatar_url
              ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="avatar">`
              : initials}
          </div>
          <div class="presence-dot presence-offline"
               data-presence="${player.profile_id}"
               style="position:absolute;bottom:0;right:0;"></div>
        </div>

        <!-- Nom complet -->
        <div class="pvp-fullname">${profile.first_name} ${profile.last_name}</div>
        <div class="pvp-username ${c.rankClass}">@${profile.username}</div>

        <!-- V / D / E -->
        <div class="pvp-vde">
          <div class="pvp-vde-col">
            <span class="${c.numSize}" style="color:#22c55e">${wins}</span>
            <span class="pvp-vde-lbl">V</span>
          </div>
          <div class="pvp-vde-col">
            <span class="${c.numSize}" style="color:#ef4444">${losses}</span>
            <span class="pvp-vde-lbl">D</span>
          </div>
          <div class="pvp-vde-col">
            <span class="${c.numSize}" style="color:#f59e0b">${draws}</span>
            <span class="pvp-vde-lbl">E</span>
          </div>
        </div>

        <!-- Win rate -->
        <div class="pvp-wr-wrap">
          <div class="pvp-wr-row">
            <span>Win rate</span>
            <span>${wr}%</span>
          </div>
          <div class="pvp-wr-track">
            <div class="pvp-wr-fill" style="width:${wr}%"></div>
          </div>
        </div>

        <!-- Série max -->
        <div class="pvp-streak">
          <i class="fa-solid fa-fire" style="color:#f59e0b;font-size:0.75rem;"></i>
          <strong>${streak}</strong>
          <span>série max</span>
        </div>`

      container.appendChild(card)
    })
  }

  // ============================================================
  //  CLASSEMENT — via v_leaderboard
  // ============================================================
  async function loadLeaderboard() {
    const { data: players } = await sb.from('v_leaderboard').select('*')
    if (!players || players.length === 0) return

    const myIndex = players.findIndex(p => p.profile_id === currentUser.id)
    const myRank  = myIndex + 1
    const me      = players[myIndex]

    if (me) {
      setEl('my-rank',        '#' + myRank)
      setEl('my-rank-wins',   (me.wins   || 0) + 'V')
      setEl('my-rank-losses', (me.losses || 0) + 'D')
      setEl('my-rank-draws',  (me.draws  || 0) + 'E')
      setEl('my-rank-score',  (me.xp_total || 0).toLocaleString() + ' pts')
      const rankBadge = document.getElementById('nav-rank')
      if (rankBadge) rankBadge.innerHTML = `<i class="fa-solid fa-medal"></i> Rang #${myRank}`
      const rankSub = document.getElementById('nav-rank-sub')
      if (rankSub) rankSub.textContent = 'Rang #' + myRank + ' mondial'
    }

    openRowId = 'lb-' + currentUser.id
    renderTop5(players.slice(0, 5))
    renderWorldLeaderboard(players)
  }

  // ============================================================
  //  TOP 5
  // ============================================================
  function renderTop5(players) {
    const container = document.getElementById('top5-container')
    if (!container) return
    container.innerHTML = ''

    const rankColors  = ['text-gold','text-silver','text-bronze','text-[#475569]','text-[#475569]']
    const avatarGrads = [
      'from-[#fbbf24] to-[#f59e0b]','from-[#94a3b8] to-[#64748b]',
      'from-[#02b7f5] to-[#0066ff]','from-[#475569] to-[#1e293b]','from-[#475569] to-[#334155]',
    ]

    players.forEach((player, i) => {
      const isMe     = player.profile_id === currentUser.id
      const rank     = i + 1
      const initials = (player.first_name[0] + player.last_name[0]).toUpperCase()
      const grad     = isMe ? 'from-[#02b7f5] to-[#0066ff]' : (avatarGrads[i] || 'from-[#475569] to-[#1e293b]')
      const xp       = player.xp_total || 0
      const winRate  = player.total_games > 0 ? Math.round((player.wins / player.total_games) * 100) : 0
      const expandId = 'top5-' + player.profile_id
      const isOpen   = isMe

      const row = document.createElement('div')
      row.className = `rounded-xl overflow-hidden transition ${isMe ? 'bg-[rgba(2,183,245,0.08)] border-l-4 border-l-primary' : ''}`
      row.innerHTML = `
        <div class="lb-row-header flex items-center gap-3 p-2 ${!isMe ? 'hover:bg-[rgba(2,183,245,0.05)]' : ''} rounded-xl"
             onclick="window.toggleTop5Row('${expandId}')">
          <span class="font-orbitron font-bold ${rankColors[i]} w-6">${rank}</span>
          <div class="relative">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-orbitron text-xs shrink-0">${initials}</div>
            <div class="presence-dot presence-offline absolute -bottom-0.5 -right-0.5" data-presence="${player.profile_id}"></div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-outfit font-medium text-sm dark:text-white text-[#0a0f1e] truncate">@${player.username}</span>
              ${isMe ? '<span class="text-[10px] font-rajdhani px-2 py-0.5 rounded-full bg-primary text-white shrink-0">MOI</span>' : ''}
            </div>
            <div class="font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">
              ${player.total_games} partie${player.total_games !== 1 ? 's' : ''} · <span class="text-win">${winRate}%</span> win
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="font-orbitron font-bold text-primary text-sm">${xp.toLocaleString()}</span>
            <i class="fa-solid fa-chevron-right lb-chevron ${isOpen ? 'open' : ''} text-[#475569] text-xs" id="chev-${expandId}"></i>
          </div>
        </div>
        <div class="lb-expand ${isOpen ? 'open' : ''}" id="${expandId}">
          ${buildExpandPanel(player)}
        </div>`
      container.appendChild(row)
    })
  }

  // ============================================================
  //  CLASSEMENT MONDIAL
  // ============================================================
  function renderWorldLeaderboard(players) {
    const container = document.getElementById('leaderboard-body')
    if (!container) return
    container.innerHTML = ''

    players.forEach((player, i) => {
      const rank     = i + 1
      const isMe     = player.profile_id === currentUser.id
      const initials = (player.first_name[0] + player.last_name[0]).toUpperCase()
      const fullName = player.first_name + ' ' + player.last_name
      const xp       = player.xp_total || 0
      const expandId = 'lb-' + player.profile_id
      const isOpen   = isMe

      let rankIcon = ''
      if (rank === 1)      rankIcon = `<div class="w-7 h-7 rounded-full bg-[rgba(251,191,36,0.15)] flex items-center justify-center text-gold shrink-0"><i class="fa-solid fa-crown text-sm"></i></div>`
      else if (rank === 2) rankIcon = `<div class="w-7 h-7 rounded-full bg-[rgba(148,163,184,0.15)] flex items-center justify-center text-silver shrink-0"><i class="fa-solid fa-medal text-sm"></i></div>`
      else if (rank === 3) rankIcon = `<div class="w-7 h-7 rounded-full bg-[rgba(180,83,9,0.15)] flex items-center justify-center text-bronze shrink-0"><i class="fa-solid fa-medal text-sm"></i></div>`

      const rankColor = rank===1?'text-gold':rank===2?'text-silver':rank===3?'text-bronze':'dark:text-[#475569] text-[#94a3b8]'
      const grad = isMe?'from-[#02b7f5] to-[#0066ff]':rank===1?'from-[#fbbf24] to-[#f59e0b]':rank===2?'from-[#94a3b8] to-[#64748b]':'from-[#475569] to-[#1e293b]'
      const meBadge = isMe?`<span class="text-[10px] font-rajdhani px-2 py-0.5 rounded-full bg-primary text-white shrink-0">VOUS</span>`:''
      const rowBg = isMe?'dark:bg-[rgba(2,183,245,0.06)] bg-[rgba(2,183,245,0.04)] border-l-4 border-l-primary':''

      const row = document.createElement('div')
      row.className = `transition border-b dark:border-[rgba(255,255,255,0.04)] border-[rgba(0,0,0,0.04)] ${rowBg}`
      row.innerHTML = `
        <div class="lb-row-header hover:dark:bg-[rgba(2,183,245,0.04)] hover:bg-[rgba(2,183,245,0.02)]"
             onclick="window.toggleLbRow('${expandId}')">

          <!-- MOBILE -->
          <div class="lg:hidden px-4 py-3">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1 shrink-0 w-10">${rankIcon}<span class="font-orbitron font-bold text-sm ${rankColor}">${rank}</span></div>
              <div class="relative">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-orbitron text-xs shrink-0">${initials}</div>
                <div class="presence-dot presence-offline absolute -bottom-0.5 -right-0.5" data-presence="${player.profile_id}"></div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-outfit text-sm dark:text-white text-[#0a0f1e] font-medium truncate">@${player.username}</span>${meBadge}
                </div>
                <div class="font-outfit text-xs dark:text-[#94a3b8] text-[#64748b] truncate">${fullName}</div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <div class="text-right">
                  <div class="font-orbitron font-bold text-sm text-primary">${xp.toLocaleString()}</div>
                  <div class="font-rajdhani text-[10px] dark:text-[#475569] text-[#94a3b8] uppercase">pts</div>
                </div>
                <i class="fa-solid fa-chevron-right lb-chevron ${isOpen?'open':''} text-[#475569] text-xs" id="chev-${expandId}"></i>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-2 ml-[52px]">
              <span class="font-rajdhani text-xs dark:text-[#94a3b8] text-[#64748b]">${player.total_games} partie${player.total_games!==1?'s':''}</span>
              <span class="text-xs dark:text-[#2a3a4a] text-[#cbd5e1]">·</span>
              <span class="font-rajdhani text-xs text-win"><i class="fa-solid fa-trophy mr-1 text-[10px]"></i>${player.wins}V</span>
              <span class="font-rajdhani text-xs text-lose"><i class="fa-solid fa-skull mr-1 text-[10px]"></i>${player.losses}D</span>
              <span class="font-rajdhani text-xs text-draw"><i class="fa-solid fa-handshake mr-1 text-[10px]"></i>${player.draws}E</span>
            </div>
          </div>

          <!-- DESKTOP -->
          <div class="hidden lg:grid grid-cols-[80px_1fr_100px_80px_80px_80px_110px_32px] gap-2 px-6 py-4 items-center">
            <div class="flex items-center gap-1">${rankIcon}<span class="font-orbitron font-bold ${rankColor}">${rank}</span></div>
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative">
                <div class="w-9 h-9 rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white font-orbitron text-xs shrink-0">${initials}</div>
                <div class="presence-dot presence-offline absolute -bottom-0.5 -right-0.5" data-presence="${player.profile_id}"></div>
              </div>
              <div class="min-w-0">
                <div class="font-outfit text-sm dark:text-white text-[#64748b]">@${player.username}</div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-outfit font-medium text-xs dark:text-[#94a3b8] text-[#0a0f1e] truncate">${fullName}</span>${meBadge}
                </div>
              </div>
            </div>
            <div class="font-outfit text-sm text-center dark:text-white text-[#0a0f1e]">${player.total_games}</div>
            <div class="font-orbitron font-bold text-sm text-win text-center">${player.wins}</div>
            <div class="font-orbitron font-bold text-sm text-lose text-center">${player.losses}</div>
            <div class="font-orbitron font-bold text-sm text-draw text-center">${player.draws}</div>
            <div class="font-orbitron font-bold text-sm text-primary text-right">${xp.toLocaleString()}</div>
            <div class="text-center">
              <i class="fa-solid fa-chevron-right lb-chevron ${isOpen?'open':''} text-[#475569] text-xs" id="chev-${expandId}"></i>
            </div>
          </div>
        </div>

        <!-- Panel expansion -->
        <div class="lb-expand ${isOpen?'open':''}" id="${expandId}">
          ${buildExpandPanel(player)}
        </div>`
      container.appendChild(row)
    })
  }

  // ============================================================
  //  PANEL EXPANSION — stats solo + PvP
  // ============================================================
  function buildExpandPanel(player) {
    const lvls = [
      { label:'Facile',    color:'text-win',  bar:'bg-win',  g:player.games_easy||0,  w:player.wins_easy||0,  l:player.losses_easy||0,  e:player.draws_easy||0,  xp:player.xp_easy||0  },
      { label:'Moyen',     color:'text-draw', bar:'bg-draw', g:player.games_medium||0, w:player.wins_medium||0, l:player.losses_medium||0, e:player.draws_medium||0, xp:player.xp_medium||0 },
      { label:'Difficile', color:'text-lose', bar:'bg-lose', g:player.games_hard||0,  w:player.wins_hard||0,  l:player.losses_hard||0,  e:player.draws_hard||0,  xp:player.xp_hard||0  },
    ]
    const pvpG  = player.pvp_games        || 0
    const pvpW  = player.pvp_wins         || 0
    const pvpL  = player.pvp_losses       || 0
    const pvpD  = player.pvp_draws        || 0
    const pvpR  = pvpG > 0 ? Math.round((pvpW / pvpG) * 100) : 0
    const pvpBS = player.pvp_best_streak  || 0

    return `
    <div class="grid md:grid-cols-2 gap-3 px-4 lg:px-6 py-4
                dark:bg-[rgba(2,183,245,0.02)] bg-[rgba(2,183,245,0.01)]
                border-t dark:border-[rgba(2,183,245,0.08)] border-[rgba(2,183,245,0.12)]">

      <div class="dark:bg-[#0d1b2a] bg-white rounded-xl p-4 border dark:border-[rgba(2,183,245,0.15)] border-[rgba(2,183,245,0.2)]">
        <div class="flex items-center gap-2 mb-3">
          <i class="fa-solid fa-robot text-primary text-xs"></i>
          <span class="font-rajdhani text-xs uppercase tracking-widest text-primary font-bold">Solo vs IA</span>
          <span class="ml-auto font-orbitron font-bold text-xs text-primary">${(player.xp_total||0).toLocaleString()} xp</span>
        </div>
        ${lvls.map(lv => {
          const wr = lv.g > 0 ? Math.round((lv.w / lv.g) * 100) : 0
          return `
          <div class="flex items-center gap-2 mb-2.5">
            <span class="font-rajdhani text-xs font-semibold ${lv.color} w-16 shrink-0">${lv.label}</span>
            <div class="flex-1">
              <div class="flex justify-between mb-1">
                <span class="font-outfit text-xs dark:text-[#94a3b8] text-[#475569]">${lv.g}p · ${lv.w}V ${lv.l}D ${lv.e}E</span>
                <span class="font-rajdhani text-xs ${lv.color}">${lv.xp} xp</span>
              </div>
              <div class="w-full h-1 dark:bg-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.06)] rounded-full">
                <div class="h-full rounded-full progress-fill ${lv.bar}" style="width:${wr}%"></div>
              </div>
            </div>
          </div>`
        }).join('')}
      </div>

      <div class="dark:bg-[#0d1b2a] bg-white rounded-xl p-4 border dark:border-[rgba(168,85,247,0.2)] border-[rgba(168,85,247,0.25)]">
        <div class="flex items-center gap-2 mb-3">
          <i class="fa-solid fa-users text-[#a855f7] text-xs"></i>
          <span class="font-rajdhani text-xs uppercase tracking-widest text-[#a855f7] font-bold">Multijoueur</span>
          <span class="ml-auto font-rajdhani text-xs dark:text-[#94a3b8] text-[#475569]">${pvpG} partie${pvpG!==1?'s':''}</span>
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
            <span class="font-orbitron font-bold text-xs text-[#a855f7]">${pvpBS} <i class="fa-solid fa-fire text-draw"></i></span>
          </div>`}
      </div>
    </div>`
  }

  // ============================================================
  //  TOGGLE EXPANSION
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
  //  PRÉSENCE
  // ============================================================
  function updatePresenceDots(userId, status) {
    const label = {
      online:   'En ligne',
      in_game:  'En partie',
      in_lobby: 'Dans le lobby',
      offline:  'Hors ligne',
    }[status] || 'Hors ligne'

    document.querySelectorAll(`[data-presence="${userId}"]`).forEach(d => {
      d.className = `presence-dot presence-${status}`
      d.title     = label
    })
  }

  async function initPresence() {
    presenceChannel = sb.channel('shifumi-presence', {
      config: { presence: { key: currentUser.id } }
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()

        const count = Object.keys(state).length
        const el    = document.getElementById('online-count')
        if (el) el.textContent = count + ' joueur' + (count !== 1 ? 's' : '') + ' en ligne'

        document.querySelectorAll('[data-presence]').forEach(d => {
          d.className = 'presence-dot presence-offline'
          d.title     = 'Hors ligne'
        })

        Object.values(state).forEach(presences => {
          const p = presences[0]; if (!p) return
          updatePresenceDots(p.user_id, p.status || 'online')
        })
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach(p => updatePresenceDots(p.user_id, p.status || 'online'))
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach(p => updatePresenceDots(p.user_id, 'offline'))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: currentUser.id,
            username: currentProfile?.username || '',
            status:   'online',
            since:    new Date().toISOString()
          })
        }
      })

    listenForInvitations()
  }

  window.updateMyPresenceStatus = async function(status) {
    if (!presenceChannel) return
    await presenceChannel.track({
      user_id: currentUser.id,
      username: currentProfile?.username || '',
      status,
      since: new Date().toISOString()
    })
  }

  // ============================================================
  //  INVITATIONS
  // ============================================================
  function listenForInvitations() {
    sb.channel(`notifications-${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'invitations',
        filter: `to_id=eq.${currentUser.id}`
      }, async (payload) => {
        await showInvitationPopup(payload.new)
      })
      .subscribe()
  }

  async function showInvitationPopup(invitation) {
    const { data: from } = await sb.from('profiles')
      .select('username, first_name').eq('id', invitation.from_id).single()
    if (!from) return

    document.getElementById('invitation-popup')?.remove()
    let countdown = 60

    const popup = document.createElement('div')
    popup.id = 'invitation-popup'
    popup.className = `fixed bottom-6 right-6 z-50 dark:bg-[#0d1b2a] bg-white
                       rounded-2xl p-5 border-2 border-primary shadow-2xl max-w-sm w-full`
    popup.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-[#02b7f5] to-[#0066ff]
                    flex items-center justify-center text-white font-orbitron text-xs shrink-0">
          ${from.first_name[0].toUpperCase()}
        </div>
        <div class="flex-1">
          <div class="font-orbitron font-bold text-sm dark:text-white text-[#0a0f1e]">Invitation de combat !</div>
          <div class="font-rajdhani text-xs text-primary">@${from.username} te défie</div>
        </div>
        <span id="inv-countdown" class="font-orbitron text-sm text-primary font-bold">${countdown}</span>
      </div>
      <div class="flex gap-2">
        <button onclick="window.respondInvitation('${invitation.id}','${invitation.room_id}','accepted')"
          class="flex-1 py-2.5 rounded-full bg-gradient-to-r from-[#22c55e] to-[#16a34a]
                 text-white font-orbitron text-xs font-bold hover:brightness-110 transition">
          <i class="fa-solid fa-check mr-1"></i> ACCEPTER
        </button>
        <button onclick="window.respondInvitation('${invitation.id}','${invitation.room_id}','declined')"
          class="flex-1 py-2.5 rounded-full border border-red-500 text-red-500
                 font-orbitron text-xs font-bold hover:bg-red-500 hover:text-white transition">
          <i class="fa-solid fa-xmark mr-1"></i> REFUSER
        </button>
      </div>`
    document.body.appendChild(popup)

    const timer = setInterval(() => {
      countdown--
      const el = document.getElementById('inv-countdown')
      if (el) { el.textContent = countdown; if (countdown <= 10) el.style.color = '#ef4444' }
      if (countdown <= 0) {
        clearInterval(timer); popup.remove()
        sb.from('invitations').update({ status: 'expired' }).eq('id', invitation.id)
      }
    }, 1000)
  }

  window.respondInvitation = async function(invitationId, roomId, status) {
    document.getElementById('invitation-popup')?.remove()
    await sb.from('invitations').update({ status }).eq('id', invitationId)
    if (status === 'accepted') {
      await sb.from('multiplayer_rooms').update({ guest_id: currentUser.id, status: 'playing' }).eq('id', roomId)
      window.location.href = BASE_URL + '/room/game_pvp.html?room=' + roomId
    }
  }

  // ============================================================
  //  DÉCONNEXION
  // ============================================================
  function initLogout() {
    const modal = document.getElementById('modal-logout')
    const open  = () => modal?.classList.remove('hidden')
    const close = () => modal?.classList.add('hidden')
    document.getElementById('btn-logout')?.addEventListener('click', open)
    document.getElementById('btn-logout-sidebar')?.addEventListener('click', open)
    document.getElementById('btn-logout-cancel')?.addEventListener('click', close)
    modal?.addEventListener('click', e => { if (e.target === modal) close() })
    document.getElementById('btn-logout-confirm')?.addEventListener('click', async () => {
      presenceChannel?.untrack()
      await sb.auth.signOut()
      window.location.href = BASE_URL + '/player/connexion.html'
    })
  }

  // ============================================================
  //  THÈME
  // ============================================================
  function initTheme() {
    const html         = document.documentElement
    const navThemeIcon = document.getElementById('navThemeIcon')
    const savedTheme   = localStorage.getItem('theme') || 'dark'
    applyTheme(savedTheme)
    function applyTheme(t) {
      if (t === 'light') { html.classList.remove('dark'); if (navThemeIcon) navThemeIcon.className = 'fa-solid fa-sun text-[#f59e0b]' }
      else               { html.classList.add('dark');    if (navThemeIcon) navThemeIcon.className = 'fa-solid fa-moon text-primary'  }
    }
    function toggle() {
      const next = html.classList.contains('dark') ? 'light' : 'dark'
      localStorage.setItem('theme', next); applyTheme(next)
    }
    document.getElementById('themeToggleSidebar')?.addEventListener('click', toggle)
    document.getElementById('themeToggleNav')?.addEventListener('click', toggle)
  }

  // ============================================================
  //  SIDEBAR MOBILE
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
  function setProgress(id, pct) { const el = document.getElementById(id); if (el) el.style.width = Math.min(Math.max(pct,0),100) + '%' }

  // ============================================================
  //  LANCEMENT
  // ============================================================
  initTheme()
  initSidebar()
  initLogout()
  init()

})()
