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
  let currentUser    = null
  let currentProfile = null
  let currentRoom    = null
  let presenceChannel= null
  let roomChannel    = null

  // ============================================================
  //  INIT
  // ============================================================
  async function init() {
    const { data: { session } } = await sb.auth.getSession()

    // Si pas connecté → rediriger vers connexion en gardant le code dans l'URL
    if (!session) {
      const params = new URLSearchParams(window.location.search)
      const code   = params.get('code')
      const redirect = code
        ? `/room/join.html?code=${code}`
        : '/room/join.html'
      window.location.href = BASE_URL + '/player/connexion.html?redirect=' + encodeURIComponent(redirect)
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
    initCodeInputs()
    initPresence()

    // Si code dans l'URL → pré-remplir et chercher automatiquement
    const urlParams = new URLSearchParams(window.location.search)
    const urlCode   = urlParams.get('code')
    if (urlCode) {
      prefillCode(urlCode)
      await searchRoom(urlCode.toUpperCase())
    }
  }

  // ============================================================
  //  PRESENCE
  // ============================================================
  function initPresence() {
  presenceChannel = sb.channel('shifumi-presence', {
    config: { presence: { key: currentUser.id } }
  })

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      // Sync global — s'assure que notre statut est bien propagé
      // après une reconnexion ou un refresh
      const state = presenceChannel.presenceState()
      const me = state[currentUser.id]
      if (!me) {
        // On n'est pas dans l'état global → re-tracker
        presenceChannel.track({
          user_id:  currentUser.id,
          username: currentProfile?.username || '',
          status:   'online',
          since:    new Date().toISOString()
        })
      }
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      // Vérifier si c'est nous qui rejoignons après reconnexion
      const isMe = newPresences.some(p => p.user_id === currentUser.id)
      if (isMe) console.log('[PRESENCE] Re-connecté au channel')
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      // Si on détecte qu'on a quitté le channel (ex: perte réseau)
      const isMe = leftPresences.some(p => p.user_id === currentUser.id)
      if (isMe) {
        // Re-tracker immédiatement
        presenceChannel.track({
          user_id:  currentUser.id,
          username: currentProfile?.username || '',
          status:   'online',
          since:    new Date().toISOString()
        })
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id:  currentUser.id,
          username: currentProfile?.username || '',
          status:   'online',
          since:    new Date().toISOString()
        })
      }
      // Reconnexion après perte réseau
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('[PRESENCE] Channel error — tentative reconnexion...')
        setTimeout(() => presenceChannel.subscribe(), 2000)
      }
    })
}

  // ============================================================
  //  INPUTS DU CODE — navigation auto + coller
  // ============================================================
  function initCodeInputs() {
    const inputs = document.querySelectorAll('.code-input')

    inputs.forEach((input, i) => {
      // Focus auto sur le premier
      if (i === 0) setTimeout(() => input.focus(), 100)

      input.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
        input.value = val ? val[val.length - 1] : ''

        if (input.value) {
          input.classList.add('filled')
          // Passer au suivant
          if (i < inputs.length - 1) inputs[i + 1].focus()
          // Si tous remplis → chercher automatiquement
          if (i === inputs.length - 1) autoSearch()
        } else {
          input.classList.remove('filled')
        }
        clearError()
      })

      input.addEventListener('keydown', (e) => {
        // Retour arrière → case précédente
        if (e.key === 'Backspace' && !input.value && i > 0) {
          inputs[i - 1].focus()
          inputs[i - 1].value = ''
          inputs[i - 1].classList.remove('filled')
        }
        // Flèches
        if (e.key === 'ArrowLeft'  && i > 0)               inputs[i - 1].focus()
        if (e.key === 'ArrowRight' && i < inputs.length - 1) inputs[i + 1].focus()
      })

      // Coller un code complet
      input.addEventListener('paste', (e) => {
        e.preventDefault()
        const pasted = (e.clipboardData.getData('text') || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (pasted.length === 6) {
          pasted.split('').forEach((char, j) => {
            if (inputs[j]) {
              inputs[j].value = char
              inputs[j].classList.add('filled')
            }
          })
          inputs[inputs.length - 1].focus()
          autoSearch()
        }
      })
    })

    // Bouton rejoindre
    document.getElementById('btn-join').addEventListener('click', async () => {
      const code = getCode()
      if (code.length < 6) { showError('Entre les 6 caractères du code'); return }
      await searchRoom(code)
    })
  }

  function getCode() {
    return Array.from(document.querySelectorAll('.code-input'))
      .map(i => i.value).join('')
  }

  function prefillCode(code) {
    const inputs  = document.querySelectorAll('.code-input')
    const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6)
    cleaned.split('').forEach((char, i) => {
      if (inputs[i]) {
        inputs[i].value = char
        inputs[i].classList.add('filled')
      }
    })
  }

  async function autoSearch() {
    const code = getCode()
    if (code.length === 6) {
      await searchRoom(code)
    }
  }

  // ============================================================
  //  CHERCHER UNE SALLE
  // ============================================================
  async function searchRoom(code) {
    const btn = document.getElementById('btn-join')
    btn.disabled = true
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Recherche...'
    clearError()

    try {
      const { data: room, error } = await sb
        .from('multiplayer_rooms')
        .select('*, profiles!host_id(first_name, last_name, username)')
        .eq('code', code)
        .eq('status', 'waiting')
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !room) {
        showError('Salle introuvable, expirée ou déjà en cours')
        setInputsError()
        btn.disabled = false
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i> REJOINDRE'
        return
      }

      // Vérifier que c'est pas sa propre salle
      if (room.host_id === currentUser.id) {
        showError('Tu ne peux pas rejoindre ta propre salle')
        btn.disabled = false
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i> REJOINDRE'
        return
      }

      // Salle trouvée → afficher les infos
      currentRoom = room
      showRoomScreen(room)

    } catch (err) {
      console.error('Erreur recherche:', err)
      showError('Une erreur est survenue')
      btn.disabled = false
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i> REJOINDRE'
    }
  }

  // ============================================================
  //  AFFICHER INFOS DE LA SALLE
  // ============================================================
  function showRoomScreen(room) {
    document.getElementById('screen-code').classList.add('hidden')
    document.getElementById('screen-room').classList.remove('hidden')

    const host = room.profiles
    const hostName = host
      ? `@${host.username} — ${host.first_name} ${host.last_name}`
      : 'Hôte inconnu'

    document.getElementById('host-name').textContent   = hostName
    document.getElementById('room-rounds').textContent = room.total_rounds

    // Bouton accepter
    document.getElementById('btn-confirm-join').addEventListener('click', async () => {
      await joinRoom(room)
    })

    // Bouton refuser
    document.getElementById('btn-refuse-join').addEventListener('click', () => {
      document.getElementById('screen-room').classList.add('hidden')
      document.getElementById('screen-code').classList.remove('hidden')
      currentRoom = null
      // Réactiver le bouton
      const btn = document.getElementById('btn-join')
      btn.disabled = false
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket mr-2"></i> REJOINDRE'
      // Vider les inputs
      document.querySelectorAll('.code-input').forEach(i => {
        i.value = ''
        i.classList.remove('filled', 'error')
      })
      document.querySelectorAll('.code-input')[0].focus()
    })
  }

  // ============================================================
  //  REJOINDRE LA SALLE
  // ============================================================
  async function joinRoom(room) {
  const btn = document.getElementById('btn-confirm-join')
  btn.disabled = true
  btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Connexion...'

  try {
    // 1. Mettre à jour la salle avec guest_id
    const { error } = await sb
      .from('multiplayer_rooms')
      .update({ guest_id: currentUser.id })
      .eq('id', room.id)
      .eq('status', 'waiting')

    if (error) throw error

    // 2. ★ Marquer l'invitation comme accepted pour notifier le host
    await sb
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('room_id', room.id)
      .eq('to_id', currentUser.id)
      .eq('status', 'pending')

    // 3. Présence
    await presenceChannel.track({
      user_id:  currentUser.id,
      username: currentProfile?.username || '',
      status:   'in_lobby',
      since:    new Date().toISOString()
    })

    showWaitingScreen(room)
    listenToRoom(room.id)

  } catch (err) {
    console.error('Erreur rejoindre salle:', err)
    showError('Impossible de rejoindre — la salle est peut-être pleine')
    btn.disabled = false
    btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> ACCEPTER ET REJOINDRE'
  }
}

  // ============================================================
  //  ÉCRAN ATTENTE — J2 attend que J1 lance
  // ============================================================
  function showWaitingScreen(room) {
    document.getElementById('screen-room').classList.add('hidden')
    document.getElementById('screen-waiting').classList.remove('hidden')

    // Afficher les initiales des deux joueurs
    const host = room.profiles
    const hostInitials = host
      ? (host.first_name[0] + host.last_name[0]).toUpperCase()
      : '?'
    const myInitials = currentProfile
      ? (currentProfile.first_name[0] + currentProfile.last_name[0]).toUpperCase()
      : '?'

    document.getElementById('host-avatar-wait').textContent = hostInitials
    document.getElementById('guest-avatar-wait').textContent = myInitials
    document.getElementById('host-label-wait').textContent = host
      ? `@${host.username}`
      : 'Hôte'

    // Bouton quitter
    document.getElementById('btn-leave-room').addEventListener('click', async () => {
      await leaveRoom(room.id)
      document.getElementById('screen-waiting').classList.add('hidden')
      document.getElementById('screen-code').classList.remove('hidden')
      currentRoom = null
      document.querySelectorAll('.code-input').forEach(i => {
        i.value = ''
        i.classList.remove('filled', 'error')
      })
      document.querySelectorAll('.code-input')[0].focus()
    })
  }

  // ============================================================
  //  ÉCOUTER LE LANCEMENT — Realtime
  // ============================================================
  function listenToRoom(roomId) {
  roomChannel?.unsubscribe()
  
  roomChannel = sb.channel(`room-${roomId}`)
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'multiplayer_rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      const room = payload.new
      console.log('[JOIN] Realtime update reçu:', room.status)

      if (room.status === 'playing') {
        goToGame(roomId)
      }

      if (room.status === 'abandoned') {
        showToast('L\'hôte a annulé la salle', 'warning')
        roomChannel?.unsubscribe()
        setTimeout(() => {
          document.getElementById('screen-waiting')?.classList.add('hidden')
          document.getElementById('screen-code')?.classList.remove('hidden')
          currentRoom = null
        }, 2000)
      }
    })
    .subscribe((status) => {
      console.log('[JOIN] Channel status:', status)
      if (status === 'SUBSCRIBED') {
        // Vérifier si la partie a déjà été lancée pendant la souscription
        sb.from('multiplayer_rooms')
          .select('status')
          .eq('id', roomId)
          .single()
          .then(({ data: room }) => {
            if (room?.status === 'playing') goToGame(roomId)
          })
      }
    })
}

  // ============================================================
  //  QUITTER LA SALLE
  // ============================================================
  async function leaveRoom(roomId) {
    try {
      await sb.from('multiplayer_rooms')
        .update({ guest_id: null })
        .eq('id', roomId)
      roomChannel?.unsubscribe()

      await presenceChannel.track({
        user_id:  currentUser.id,
        username: currentProfile?.username || '',
        status:   'online',
        since:    new Date().toISOString()
      })
    } catch (err) {
      console.error('Erreur quitter salle:', err)
    }
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
    window.location.href = `https://shifumi-battle-arena.vercel.app/room/game_pvp.html?room=${roomId}`
  }

  // ============================================================
  //  HELPERS UI
  // ============================================================
  function showError(msg) {
    const el  = document.getElementById('code-error')
    const txt = document.getElementById('code-error-msg')
    if (el && txt) { txt.textContent = msg; el.classList.remove('hidden') }
  }

  function clearError() {
    document.getElementById('code-error')?.classList.add('hidden')
    document.querySelectorAll('.code-input').forEach(i => i.classList.remove('error'))
  }

  function setInputsError() {
    document.querySelectorAll('.code-input').forEach(i => {
      i.classList.add('error')
      setTimeout(() => i.classList.remove('error'), 600)
    })
  }

  function showToast(message, type = 'info') {
    const existing = document.querySelector('.join-toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.className = 'join-toast fixed top-20 right-4 z-50 px-5 py-3 rounded-xl font-rajdhani font-semibold text-white shadow-xl'
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
      if (currentRoom) await leaveRoom(currentRoom.id)
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
