(function () {

  const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
  const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'
  const { createClient } = supabase
  const sb       = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const BASE_URL = window.location.origin

  let currentUser     = null
  let currentProfile  = null
  let presenceChannel = null

  async function init() {
    try { await sb.removeAllChannels() } catch (e) {}

    applyTheme()
    document.body.style.visibility = 'visible'
    document.body.style.opacity    = '1'

    const urlParams = new URLSearchParams(window.location.search)
    const urlCode   = urlParams.get('code')

    if (!urlCode) { showState('nocode'); return }

    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      const redirect = `https://shifumi-battle-arena.vercel.app/room/join.html?code=${urlCode}`
      window.location.href = BASE_URL + '/player/connexion.html?redirect=' + encodeURIComponent(redirect)
      return
    }

    currentUser = session.user

    const { data: profile } = await sb
      .from('profiles')
      .select('first_name, last_name, username, avatar_url')
      .eq('id', currentUser.id)
      .single()
    if (profile) currentProfile = profile

    presenceChannel = sb.channel('shifumi-presence', {
      config: { presence: { key: currentUser.id } }
    })
    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id:  currentUser.id,
          username: currentProfile?.username || '',
          status:   'online',
          since:    new Date().toISOString()
        })
      }
    })

    await joinByCode(urlCode.toUpperCase())
  }

  async function joinByCode(code) {
    showState('loading')

    try {
      const { data: room, error } = await sb
        .from('multiplayer_rooms')
        .select('id, host_id, total_rounds, status, expires_at')
        .eq('code', code)
        .eq('status', 'waiting')
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !room) {
        showState('error', 'Salle introuvable, expirée ou déjà commencée.')
        return
      }

      if (room.host_id === currentUser.id) {
        showState('error', 'Tu ne peux pas rejoindre ta propre salle.')
        return
      }

      const { error: updateError } = await sb
        .from('multiplayer_rooms')
        .update({
          guest_id:         currentUser.id,
          status:           'playing',
          round_started_at: new Date().toISOString()
        })
        .eq('id', room.id)
        .eq('status', 'waiting')

      if (updateError) throw updateError

      // ★ Notifier le host via broadcast instantané
      const notifyChannel = sb.channel(`notify-host-${room.id}`)
      await new Promise(resolve => {
        notifyChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await notifyChannel.send({
              type:    'broadcast',
              event:   'guest_joined',
              payload: { room_id: room.id }
            })
            resolve()
          }
        })
      })

      await presenceChannel.track({
        user_id:  currentUser.id,
        username: currentProfile?.username || '',
        status:   'in_game',
        since:    new Date().toISOString()
      })

      showState('success')
      setTimeout(() => {
        window.location.href = `https://shifumi-battle-arena.vercel.app/room/game_pvp.html?room=${room.id}`
      }, 800)

    } catch (err) {
      console.error('Erreur joinByCode:', err)
      showState('error', 'Une erreur est survenue. Réessaie.')
    }
  }

  function showState(state, errorMsg) {
    ['loading','success','error','nocode'].forEach(s => {
      document.getElementById(`state-${s}`)?.classList.add('hidden')
    })
    document.getElementById(`state-${state}`)?.classList.remove('hidden')
    if (state === 'error' && errorMsg) {
      const el = document.getElementById('error-msg')
      if (el) el.textContent = errorMsg
    }
  }

  function applyTheme() {
    const saved = localStorage.getItem('theme') || 'dark'
    if (saved === 'light') document.documentElement.classList.remove('dark')
    else                   document.documentElement.classList.add('dark')
  }

  init()

})()
