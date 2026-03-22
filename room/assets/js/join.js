(function () {

  const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
  const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'
  const { createClient } = supabase
  const sb       = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const BASE_URL = window.location.origin

  let currentUser     = null
  let currentProfile  = null
  let presenceChannel = null

  // ============================================================
  //  INIT
  // ============================================================
  async function init() {
    // Fermer tous les channels hérités (dashboard etc.)
    try { await sb.removeAllChannels() } catch (e) {}

    // Appliquer le thème avant de révéler la page
    applyTheme()
    document.body.style.visibility = 'visible'
    document.body.style.opacity    = '1'

    // Vérifier si un code est dans l'URL
    const urlParams = new URLSearchParams(window.location.search)
    const urlCode   = urlParams.get('code')

    if (!urlCode) {
      showState('nocode')
      return
    }

    // Vérifier la session
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      const redirect = `/room/join.html?code=${urlCode}`
      window.location.href = BASE_URL + '/player/connexion.html?redirect=' + encodeURIComponent(redirect)
      return
    }

    currentUser = session.user

    // Charger le profil
    const { data: profile } = await sb
      .from('profiles')
      .select('first_name, last_name, username, avatar_url')
      .eq('id', currentUser.id)
      .single()
    if (profile) currentProfile = profile

    // Initialiser présence
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

    // Rejoindre directement
    await joinByCode(urlCode.toUpperCase())
  }

  // ============================================================
  //  REJOINDRE — cherche + update + redirect
  // ============================================================
  async function joinByCode(code) {
    showState('loading')

    try {
      // 1. Chercher la salle
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

      // 2. Update guest_id + status playing en une seule requête
      const { error: updateError } = await sb
        .from('multiplayer_rooms')
        .update({
          guest_id:         currentUser.id,
          status:           'playing',
          round_started_at: new Date().toISOString()
        })
        .eq('id', room.id)
        .eq('status', 'waiting') // sécurité : évite double-join

      if (updateError) throw updateError

      // 3. Présence en in_game
      await presenceChannel.track({
        user_id:  currentUser.id,
        username: currentProfile?.username || '',
        status:   'in_game',
        since:    new Date().toISOString()
      })

      // 4. Afficher succès brièvement puis redirect
      showState('success')
      setTimeout(() => {
        window.location.href = `${BASE_URL}/room/game_pvp.html?room=${room.id}`
      }, 800)

    } catch (err) {
      console.error('Erreur joinByCode:', err)
      showState('error', 'Une erreur est survenue. Réessaie.')
    }
  }

  // ============================================================
  //  GESTION DES ÉTATS VISUELS
  // ============================================================
  function showState(state, errorMsg) {
    document.getElementById('state-loading')?.classList.add('hidden')
    document.getElementById('state-success')?.classList.add('hidden')
    document.getElementById('state-error')?.classList.add('hidden')
    document.getElementById('state-nocode')?.classList.add('hidden')

    const el = document.getElementById(`state-${state}`)
    if (el) el.classList.remove('hidden')

    if (state === 'error' && errorMsg) {
      const msgEl = document.getElementById('error-msg')
      if (msgEl) msgEl.textContent = errorMsg
    }
  }

  // ============================================================
  //  THÈME
  // ============================================================
  function applyTheme() {
    const saved = localStorage.getItem('theme') || 'dark'
    if (saved === 'light') document.documentElement.classList.remove('dark')
    else                   document.documentElement.classList.add('dark')
  }

  // ============================================================
  //  LANCEMENT
  // ============================================================
  init()

})()
