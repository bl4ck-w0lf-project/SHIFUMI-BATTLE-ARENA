(function () {

  // ============================================================
  //  CONFIG SUPABASE
  // ============================================================
  const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
  const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'
  const { createClient } = supabase
  const sb       = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const BASE_URL = window.location.origin

  // ============================================================
  //  ÉTAT
  // ============================================================
  let currentUser     = null
  let currentProfile  = null
  let currentRoom     = null
  let totalRounds     = 5
  let presenceChannel = null
  let roomChannel     = null
  let expiryTimer     = null
  let onlinePlayers   = {}
  let startPvpListenerAdded = false  // ← évite les doublons d'event listener

  // ============================================================
  //  INIT
  // ============================================================
  async function init() {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      window.location.href = BASE_URL + '/player/connexion.html?redirect=/room/lobby.html'
      return
    }
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
    }

    initLogout()
    initRoundsSelector()
    await initPresence()
  }

  // ============================================================
  //  SÉLECTEUR DE ROUNDS
  // ============================================================
  function initRoundsSelector() {
    document.querySelectorAll('.rounds-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.rounds-btn').forEach(b => b.classList.remove('active'))
        this.classList.add('active')
        totalRounds = parseInt(this.dataset.rounds)
      })
    })
  }

  // ============================================================
  //  PRESENCE
  // ============================================================
  async function initPresence() {
    presenceChannel = sb.channel('shifumi-presence', {
      config: { presence: { key: currentUser.id } }
    })

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        onlinePlayers = {}
        Object.values(state).forEach(presences => {
          const p = presences[0]
          if (p) onlinePlayers[p.user_id] = p
        })
        renderOnlinePlayers()
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach(p => { onlinePlayers[p.user_id] = p })
        renderOnlinePlayers()
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach(p => { delete onlinePlayers[p.user_id] })
        renderOnlinePlayers()
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id:  currentUser.id,
            username: currentProfile?.username || '',
            status:   'in_lobby',
            since:    new Date().toISOString()
          })
        }
      })
  }

  // ============================================================
  //  LISTE DES JOUEURS EN LIGNE
  // ============================================================
  function renderOnlinePlayers() {
    const container = document.getElementById('online-players-list')
    const badge     = document.getElementById('online-badge')
    if (!container) return

    const others = Object.values(onlinePlayers).filter(p => p.user_id !== currentUser.id)
    badge.textContent = others.length + ' en ligne'

    if (others.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center py-10 gap-3">
          <div class="w-12 h-12 rounded-full dark:bg-[rgba(255,255,255,0.04)] bg-[rgba(0,0,0,0.04)]
                      flex items-center justify-center">
            <i class="fa-solid fa-user-slash dark:text-[#2a3a4a] text-[#cbd5e1] text-xl"></i>
          </div>
          <p class="font-rajdhani dark:text-[#475569] text-[#94a3b8] text-sm text-center">
            Aucun joueur en ligne<br>pour l'instant
          </p>
        </div>`
      return
    }

    container.innerHTML = ''

    const order = { online: 0, in_lobby: 1, in_game: 2 }
    others.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3))

    others.forEach(player => {
      const status    = player.status || 'online'
      const isInGame  = status === 'in_game'
      const isInLobby = status === 'in_lobby'
      const isOnline  = status === 'online'
      const initials  = player.username ? player.username.substring(0, 2).toUpperCase() : '??'
      const canInvite = currentRoom && !isInGame

      const statusLabel   = isInGame ? 'En partie' : isInLobby ? 'Dans un lobby' : 'Disponible'
      const statusColor   = isInGame ? 'text-primary' : isInLobby ? 'text-draw' : 'text-win'
      const avatarGrad    = isOnline ? 'from-[#02b7f5] to-[#0066ff]'
                          : isInLobby ? 'from-[#f59e0b] to-[#d97706]'
                          : 'from-[#475569] to-[#334155]'

      const card = document.createElement('div')
      card.className = `flex items-center gap-3 p-3 rounded-xl transition-all
                        dark:bg-[rgba(255,255,255,0.03)] bg-[rgba(0,0,0,0.02)]
                        border dark:border-[rgba(255,255,255,0.06)] border-[rgba(0,0,0,0.06)]
                        ${isInGame ? 'opacity-50' : 'hover:dark:bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(0,0,0,0.03)]'}`

      card.innerHTML = `
        <div class="relative shrink-0">
          <div class="w-9 h-9 rounded-full bg-gradient-to-br ${avatarGrad}
                      flex items-center justify-center text-white font-orbitron text-xs font-bold">
            ${initials}
          </div>
          <div class="presence-dot presence-${status} absolute -bottom-0.5 -right-0.5"></div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="font-outfit font-semibold text-sm dark:text-white text-[#0a0f1e] truncate">
            @${player.username || 'joueur'}
          </div>
          <div class="font-rajdhani text-xs ${statusColor}">${statusLabel}</div>
        </div>
        ${canInvite ? `
          <button onclick="window.invitePlayer('${player.user_id}', '${player.username}')"
            class="shrink-0 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#a855f7] to-[#7c3aed]
                   text-white font-rajdhani font-bold text-xs hover:brightness-110 hover:scale-105 transition">
            <i class="fa-solid fa-paper-plane mr-1"></i> Inviter
          </button>`
        : isInGame ? `
          <span class="shrink-0 font-rajdhani text-xs dark:text-[#475569] text-[#94a3b8] px-2">
            En partie
          </span>`
        : !currentRoom ? `
          <span class="shrink-0 font-rajdhani text-xs dark:text-[#475569] text-[#94a3b8] px-2 text-right leading-tight">
            Crée une<br>salle d'abord
          </span>` : ''}
      `
      container.appendChild(card)
    })
  }

  // ============================================================
  //  CRÉER UNE SALLE
  // ============================================================
  document.getElementById('btn-create-room').addEventListener('click', async () => {
    const btn = document.getElementById('btn-create-room')
    btn.disabled = true
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Création...'

    try {
      const code = generateCode()

      const { data: room, error } = await sb
        .from('multiplayer_rooms')
        .insert({
          code,
          host_id:           currentUser.id,
          total_rounds:      totalRounds,
          countdown_seconds: 15,
          status:            'waiting',
          expires_at:        new Date(Date.now() + 15 * 60 * 1000).toISOString()
        })
        .select('*')
        .single()

      if (error) throw error
      currentRoom = room
      startPvpListenerAdded = false

      await presenceChannel.track({
        user_id:  currentUser.id,
        username: currentProfile?.username || '',
        status:   'in_lobby',
        since:    new Date().toISOString()
      })

      showRoomScreen(room)
      listenToRoom(room.id)
      startExpiryCountdown(room.expires_at)

    } catch (err) {
      console.error('Erreur création salle:', err)
      showToast('Erreur lors de la création de la salle', 'error')
      btn.disabled = false
      btn.innerHTML = '<i class="fa-solid fa-plus mr-2"></i> CRÉER LA SALLE'
    }
  })

  // ============================================================
  //  AFFICHER L'ÉCRAN SALLE
  // ============================================================
  function showRoomScreen(room) {
    document.getElementById('screen-setup').classList.add('hidden')
    document.getElementById('screen-room').classList.remove('hidden')

    // Code avec cases stylisées
    const codeDisplay = document.getElementById('room-code-display')
    codeDisplay.innerHTML = room.code.split('').map((char, i) => `
      <div class="code-char dark:bg-[rgba(2,183,245,0.1)] bg-[rgba(2,183,245,0.08)]
                  dark:text-[#02b7f5] text-[#0288d1]
                  border-2 dark:border-[rgba(2,183,245,0.3)] border-[rgba(2,183,245,0.4)]
                  count-in" style="animation-delay:${i * 80}ms">
        ${char}
      </div>`).join('')

    // Bouton copier le code
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      navigator.clipboard.writeText(room.code)
      showToast('Code copié !', 'success')
    })

    // URLs de partage — pointer vers join.html?code=
    const joinUrl = `${BASE_URL}/room/join.html?code=${room.code}`
    const msg     = `Rejoins-moi sur Shifumi Battle Arena !\nCode : ${room.code}\n${joinUrl}`

    document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
    })
    document.getElementById('btn-share-sms').addEventListener('click', () => {
      window.open(`sms:?body=${encodeURIComponent(msg)}`, '_blank')
    })
    document.getElementById('btn-share-link').addEventListener('click', () => {
      navigator.clipboard.writeText(joinUrl)
      showToast('Lien copié !', 'success')
    })

    renderOnlinePlayers()
  }

  // ============================================================
  //  ÉCOUTER LA SALLE — Realtime
  // ============================================================
  function listenToRoom(roomId) {
  roomChannel = sb.channel(`room-${roomId}`)
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'multiplayer_rooms',
      filter: `id=eq.${roomId}`
    }, async (payload) => {
      const room = payload.new
      console.log('[LOBBY] Realtime update reçu:', room.status, 'guest:', room.guest_id)

      // Guest vient de rejoindre
      if (room.guest_id && room.guest_id !== currentRoom?.guest_id) {
        currentRoom = { ...currentRoom, ...room }
        await onGuestJoined(room.guest_id)
      }

      // Partie lancée
      if (room.status === 'playing' && currentRoom?.status !== 'playing') {
        currentRoom = { ...currentRoom, ...room }
        goToGame(roomId)
      }
    })
    .subscribe((status) => {
      console.log('[LOBBY] Channel status:', status)
      if (status === 'SUBSCRIBED') {
        // Vérifier immédiatement si quelqu'un a déjà rejoint
        // pendant le délai de souscription
        sb.from('multiplayer_rooms')
          .select('*, profiles!host_id(first_name, last_name, username)')
          .eq('id', roomId)
          .single()
          .then(({ data: room }) => {
            if (room?.guest_id && room.guest_id !== currentRoom?.guest_id) {
              currentRoom = { ...currentRoom, ...room }
              onGuestJoined(room.guest_id)
            }
          })
      }
    })
}

  // ============================================================
  //  GUEST A REJOINT
  // ============================================================
  async function onGuestJoined(guestId) {
    const { data: guestProfile } = await sb
      .from('profiles')
      .select('first_name, last_name, username')
      .eq('id', guestId)
      .single()

    const name = guestProfile
      ? `@${guestProfile.username} — ${guestProfile.first_name} ${guestProfile.last_name}`
      : 'Un adversaire'

    document.getElementById('waiting-status').classList.add('hidden')
    document.getElementById('guest-arrived').classList.remove('hidden')
    document.getElementById('guest-name').textContent = name

    if (expiryTimer) clearInterval(expiryTimer)

    showToast(`${name} a rejoint ! Lance la partie 🎮`, 'success')

    // Éviter les doublons de listener
    if (!startPvpListenerAdded) {
      startPvpListenerAdded = true
      document.getElementById('btn-start-pvp').addEventListener('click', async () => {
        const btn = document.getElementById('btn-start-pvp')
        btn.disabled = true
        btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Lancement...'

        await sb.from('multiplayer_rooms')
          .update({
            status:           'playing',
            round_started_at: new Date().toISOString()
          })
          .eq('id', currentRoom.id)

        goToGame(currentRoom.id)
      })
    }
  }

  // ============================================================
  //  INVITER UN JOUEUR
  // ============================================================
  window.invitePlayer = async function (toId, toUsername) {
    if (!currentRoom) {
      showToast('Crée une salle d\'abord !', 'warning')
      return
    }

    try {
      // Vérifier si une invitation est déjà en cours pour cette salle
      const { data: existing } = await sb
        .from('invitations')
        .select('id, status')
        .eq('room_id', currentRoom.id)
        .eq('to_id', toId)
        .eq('status', 'pending')
        .maybeSingle()

      if (existing) {
        showToast(`Invitation déjà envoyée à @${toUsername}`, 'info')
        return
      }

      await sb.from('invitations').insert({
        from_id: currentUser.id,
        to_id:   toId,
        room_id: currentRoom.id
      })

      showToast(`Invitation envoyée à @${toUsername} !`, 'success')
      listenInvitationResponse(currentRoom.id, toUsername)

    } catch (err) {
      console.error('Erreur invitation:', err)
      showToast('Erreur lors de l\'envoi de l\'invitation', 'error')
    }
  }

  function listenInvitationResponse(roomId, toUsername) {
    const ch = sb.channel(`inv-response-${roomId}-${Date.now()}`)
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'invitations',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        const inv = payload.new
        if (inv.status === 'declined') {
          showToast(`@${toUsername} a refusé l'invitation`, 'warning')
          ch.unsubscribe()
        } else if (inv.status === 'accepted') {
          showToast(`@${toUsername} a accepté ! En attente de connexion…`, 'success')
          ch.unsubscribe()
        } else if (inv.status === 'expired') {
          showToast(`Invitation à @${toUsername} expirée`, 'warning')
          ch.unsubscribe()
        }
      })
      .subscribe()
  }

  // ============================================================
  //  ANNULER LA SALLE
  // ============================================================
  document.getElementById('btn-cancel-room').addEventListener('click', async () => {
    if (!currentRoom) return
    await cancelRoom()
    document.getElementById('screen-room').classList.add('hidden')
    document.getElementById('screen-setup').classList.remove('hidden')
    document.getElementById('btn-create-room').disabled = false
    document.getElementById('btn-create-room').innerHTML = '<i class="fa-solid fa-plus mr-2"></i> CRÉER LA SALLE'
    // Reset état guest-arrived
    document.getElementById('guest-arrived').classList.add('hidden')
    document.getElementById('waiting-status').classList.remove('hidden')
    startPvpListenerAdded = false
  })

  async function cancelRoom() {
    if (!currentRoom) return
    try {
      await sb.from('multiplayer_rooms')
        .update({ status: 'abandoned', expires_at: new Date().toISOString() })
        .eq('id', currentRoom.id)
      roomChannel?.unsubscribe()
      if (expiryTimer) clearInterval(expiryTimer)
      currentRoom = null

      await presenceChannel.track({
        user_id:  currentUser.id,
        username: currentProfile?.username || '',
        status:   'in_lobby',
        since:    new Date().toISOString()
      })
    } catch (err) {
      console.error('Erreur annulation:', err)
    }
  }

  // ============================================================
  //  COUNTDOWN EXPIRATION (15 min)
  // ============================================================
  function startExpiryCountdown(expiresAt) {
    const el = document.getElementById('expiry-countdown')
    if (!el) return
    if (expiryTimer) clearInterval(expiryTimer)

    expiryTimer = setInterval(async () => {
      const remaining = Math.max(0, new Date(expiresAt) - Date.now())
      const mins = Math.floor(remaining / 60000)
      const secs = Math.floor((remaining % 60000) / 1000)
      el.textContent = `${mins}:${secs.toString().padStart(2, '0')}`

      if (remaining <= 0) {
        clearInterval(expiryTimer)
        showToast('La salle a expiré', 'warning')
        await cancelRoom()
        document.getElementById('screen-room').classList.add('hidden')
        document.getElementById('screen-setup').classList.remove('hidden')
        document.getElementById('btn-create-room').disabled = false
        document.getElementById('btn-create-room').innerHTML = '<i class="fa-solid fa-plus mr-2"></i> CRÉER LA SALLE'
        document.getElementById('guest-arrived').classList.add('hidden')
        document.getElementById('waiting-status').classList.remove('hidden')
        startPvpListenerAdded = false
      }
    }, 1000)
  }

  // ============================================================
  //  ALLER À LA PARTIE
  // ============================================================
  function goToGame(roomId) {
    presenceChannel?.track({
      user_id:  currentUser.id,
      username: currentProfile?.username || '',
      status:   'in_game',
      since:    new Date().toISOString()
    })
    window.location.href = `${BASE_URL}/room/game_pvp.html?room=${roomId}`
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  function showToast(message, type = 'info') {
    document.querySelector('.lobby-toast')?.remove()
    const toast = document.createElement('div')
    toast.className = 'lobby-toast fixed top-20 right-4 z-50 px-5 py-3 rounded-xl font-rajdhani font-semibold text-white shadow-xl'
    toast.style.maxWidth = '320px'
    toast.textContent = message
    const colors = { warning:'#f59e0b', error:'#ef4444', success:'#22c55e', info:'#02b7f5' }
    toast.style.background = colors[type] || colors.info
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3500)
  }

  // ============================================================
  //  THÈME
  // ============================================================
  function initTheme() {
    const html  = document.documentElement
    const icon  = document.getElementById('themeIcon')
    const saved = localStorage.getItem('theme') || 'dark'
    apply(saved)
    document.getElementById('themeToggle').addEventListener('click', () => {
      const next = html.classList.contains('dark') ? 'light' : 'dark'
      localStorage.setItem('theme', next); apply(next)
    })
    function apply(t) {
      if (t === 'light') { html.classList.remove('dark'); if (icon) icon.className = 'fa-solid fa-sun text-[#f59e0b]' }
      else               { html.classList.add('dark');    if (icon) icon.className = 'fa-solid fa-moon text-primary'  }
    }
  }

  // ============================================================
  //  DÉCONNEXION
  // ============================================================
  function initLogout() {
    const modal = document.getElementById('modal-logout')
    document.getElementById('btn-logout')?.addEventListener('click', () => modal.classList.remove('hidden'))
    document.getElementById('btn-logout-cancel')?.addEventListener('click', () => modal.classList.add('hidden'))
    modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden') })
    document.getElementById('btn-logout-confirm')?.addEventListener('click', async () => {
      if (currentRoom) await cancelRoom()
      presenceChannel?.untrack()
      await sb.auth.signOut()
      window.location.href = BASE_URL + '/player/connexion.html'
    })
  }

  // ============================================================
  //  LANCEMENT
  // ============================================================
  initTheme()
  init()

})()
