(function () {

  const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
  const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'
  const { createClient } = supabase
  const sb       = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const BASE_URL = window.location.origin

  let currentUser       = null
  let currentProfile    = null
  let room              = null
  let isHost            = false
  let selectedMove      = null
  let myMove            = null
  let roundChannel      = null
  let presenceChannel   = null
  let countdownInterval = null
  let pollInterval      = null
  let disconnectTimer   = null
  let roundInProgress   = false
  let presenceReady     = false
  let processingResult  = false

  // ★ FIX — numéro du round en cours côté client
  // Empêche le polling de traiter un ancien round déjà traité
  let expectedRound = 0

  let scoreMe   = 0
  let scoreOpp  = 0
  let scoreDraw = 0

  const MOVES = {
    rock:     { label: 'PIERRE',  beats: 'scissors' },
    paper:    { label: 'FEUILLE', beats: 'rock'     },
    scissors: { label: 'CISEAUX', beats: 'paper'    },
    timeout:  { label: 'TIMEOUT', beats: null        },
  }

  const SCISSORS_PATH = `M 11.40625 6.96875 C 10.578125 6.953125 9.890625 7.125 9.46875 7.25 L 6.9375 8.03125 C 4.003906 8.933594 2 11.652344 2 14.71875 L 2 20 C 2 23.855469 5.144531 27 9 27 L 18.90625 27 C 20.125 27.027344 21.304688 26.3125 21.78125 25.125 C 22.082031 24.371094 22.039063 23.578125 21.75 22.875 C 22.363281 22.550781 22.882813 22.027344 23.15625 21.34375 C 23.46875 20.558594 23.417969 19.722656 23.09375 19 L 27 19 C 28.644531 19 30 17.644531 30 16 C 30 14.355469 28.644531 13 27 13 L 25.46875 13 L 25.875 12.875 C 27.449219 12.398438 28.351563 10.699219 27.875 9.125 C 27.398438 7.550781 25.699219 6.648438 24.125 7.125 L 15.6875 9.71875 C 15.613281 9.53125 15.527344 9.328125 15.40625 9.125 C 14.90625 8.289063 13.894531 7.34375 12.28125 7.0625 C 11.980469 7.011719 11.683594 6.972656 11.40625 6.96875 Z M 25.125 9 C 25.515625 9.042969 25.847656 9.3125 25.96875 9.71875 C 26.132813 10.257813 25.820313 10.804688 25.28125 10.96875 L 18.4375 13.03125 L 18.78125 14.15625 L 18.78125 15 L 27 15 C 27.566406 15 28 15.433594 28 16 C 28 16.566406 27.566406 17 27 17 L 20.40625 17 L 17.78125 15.96875 C 17.402344 15.816406 17.011719 15.742188 16.625 15.75 L 16.09375 11.65625 L 24.71875 9.03125 C 24.855469 8.988281 24.996094 8.984375 25.125 9 Z M 11.375 9.03125 C 11.566406 9.03125 11.765625 9.03125 11.9375 9.0625 C 13.011719 9.25 13.425781 9.71875 13.6875 10.15625 C 13.949219 10.59375 13.96875 10.90625 13.96875 10.90625 L 14.8125 17.40625 C 14.96875 18.027344 14.652344 18.53125 14.125 18.65625 C 13.800781 18.734375 13.636719 18.691406 13.46875 18.59375 C 13.300781 18.496094 13.09375 18.289063 12.9375 17.84375 L 11.6875 13 C 11.609375 12.703125 11.398438 12.460938 11.121094 12.339844 C 10.839844 12.21875 10.519531 12.230469 10.25 12.375 L 8.59375 13.28125 C 8.109375 13.546875 7.933594 14.15625 8.203125 14.640625 C 8.46875 15.125 9.078125 15.300781 9.5625 15.03125 L 10.0625 14.75 L 11.03125 18.4375 C 11.332031 19.304688 11.792969 19.925781 12.4375 20.3125 C 12.964844 20.628906 13.578125 20.75 14.1875 20.6875 C 13.871094 20.980469 13.609375 21.355469 13.4375 21.78125 C 12.980469 22.925781 13.269531 24.183594 14.09375 25 L 9 25 C 6.226563 25 4 22.773438 4 20 L 4 14.71875 C 4 12.519531 5.429688 10.585938 7.53125 9.9375 L 10.03125 9.1875 C 10.234375 9.125 10.804688 9.03125 11.375 9.03125 Z M 16.8125 17.78125 C 16.886719 17.792969 16.957031 17.78125 17.03125 17.8125 L 20.75 19.3125 C 21.273438 19.523438 21.523438 20.070313 21.3125 20.59375 C 21.101563 21.117188 20.523438 21.367188 20 21.15625 L 16.28125 19.6875 C 16.226563 19.667969 16.203125 19.621094 16.15625 19.59375 C 16.550781 19.085938 16.804688 18.445313 16.8125 17.78125 Z M 16.1875 21.90625 C 16.320313 21.90625 16.460938 21.917969 16.59375 21.96875 L 17.9375 22.5 L 19.25 23.03125 L 19.375 23.0625 C 19.898438 23.273438 20.148438 23.851563 19.9375 24.375 C 19.785156 24.757813 19.445313 24.980469 19.0625 25 C 19.050781 25 19.042969 25 19.03125 25 C 18.898438 25.003906 18.757813 24.988281 18.625 24.9375 L 15.84375 23.8125 C 15.320313 23.601563 15.070313 23.023438 15.28125 22.5 C 15.386719 22.238281 15.578125 22.070313 15.8125 21.96875 C 15.929688 21.917969 16.054688 21.90625 16.1875 21.90625 Z`

  function moveSVG(move, color) {
    if (move === 'timeout')  return `<i class="fa-solid fa-hourglass-end" style="font-size:36px;color:${color}"></i>`
    if (move === 'rock')     return `<svg width="48" height="48" viewBox="0 0 256 256" fill="${color}"><path d="M200,80H184V64a31.97943,31.97943,0,0,0-56-21.13208A31.97443,31.97443,0,0,0,72.20508,60.4231,31.978,31.978,0,0,0,24,88v40a104,104,0,0,0,208,0V112A32.03635,32.03635,0,0,0,200,80ZM152,48a16.01833,16.01833,0,0,1,16,16V80H136V64A16.01833,16.01833,0,0,1,152,48ZM88,64a16,16,0,0,1,32,0v40a16,16,0,0,1-32,0V64ZM40,88a16,16,0,0,1,32,0v16a16,16,0,0,1-32,0Zm88,128a88.10627,88.10627,0,0,1-87.9209-84.249A31.94065,31.94065,0,0,0,80,125.13208a31.92587,31.92587,0,0,0,44.58057,3.34595,32.23527,32.23527,0,0,0,11.79443,11.4414A47.906,47.906,0,0,0,120,176a8,8,0,0,0,16,0,32.03635,32.03635,0,0,1,32-32,8,8,0,0,0,0-16H152a16.01833,16.01833,0,0,1-16-16V96h64a16.01833,16.01833,0,0,1,16,16v16A88.09957,88.09957,0,0,1,128,216Z"/></svg>`
    if (move === 'paper')    return `<svg width="48" height="48" viewBox="0 0 485 485" fill="${color}"><path d="M382.5,69.429c-7.441,0-14.5,1.646-20.852,4.573c-4.309-23.218-24.7-40.859-49.148-40.859c-7.68,0-14.958,1.744-21.467,4.852C285.641,16.205,265.932,0,242.5,0c-23.432,0-43.141,16.206-48.533,37.995c-6.508-3.107-13.787-4.852-21.467-4.852c-27.57,0-50,22.43-50,50v122.222c-6.129-2.686-12.891-4.187-20-4.187c-27.57,0-50,22.43-50,50V354c0,72.233,58.766,131,131,131h118c72.233,0,131-58.767,131-131V119.429C432.5,91.858,410.07,69.429,382.5,69.429z M402.5,354c0,55.691-45.309,101-101,101h-118c-55.691,0-101-45.309-101-101V251.178c0-11.028,8.972-20,20-20s20,8.972,20,20v80h30V83.143c0-11.028,8.972-20,20-20s20,8.972,20,20v158.035h30V50c0-11.028,8.972-20,20-20c11.028,0,20,8.972,20,20v191.178h30V83.143c0-11.028,8.972-20,20-20s20,8.972,20,20v158.035h30v-121.75c0-11.028,8.972-20,20-20s20,8.972,20,20V354z"/></svg>`
    if (move === 'scissors') return `<svg width="48" height="48" viewBox="0 0 32 32" fill="${color}"><path d="${SCISSORS_PATH}"/></svg>`
    return `<svg width="40" height="40" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="40" r="28" stroke="${color}" stroke-width="3" stroke-dasharray="6 6" fill="none"/><circle cx="40" cy="40" r="4" fill="${color}"/></svg>`
  }

  // ============================================================
  //  INIT
  // ============================================================
  async function init() {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) { window.location.href = BASE_URL + '/player/connexion.html'; return }
    currentUser = session.user

    document.body.style.visibility = 'visible'
    document.body.style.opacity    = '1'

    const roomId = new URLSearchParams(window.location.search).get('room')
    if (!roomId) { window.location.href = BASE_URL + '/room/lobby.html'; return }

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

    const { data: roomData } = await sb
      .from('multiplayer_rooms')
      .select('*, host:profiles!host_id(first_name,last_name,username), guest:profiles!guest_id(first_name,last_name,username)')
      .eq('id', roomId)
      .single()

    if (!roomData || roomData.status === 'finished') {
      showToast('Salle introuvable ou terminée', 'error')
      setTimeout(() => window.location.href = BASE_URL + '/player/dashboard.html', 2000)
      return
    }

    room         = roomData
    isHost       = room.host_id === currentUser.id
    // ★ FIX — initialiser le round attendu depuis la BDD
    expectedRound = room.current_round

    setEl('room-code-badge', room.code)
    const opponent = isHost ? room.guest : room.host
    const oppName  = opponent ? '@' + opponent.username : 'Adversaire'
    setEl('opponent-label', oppName.substring(0, 8))
    setEl('opp-label-move', oppName.substring(0, 8))

    buildDots(room.total_rounds)
    updateRoundCounter(room.current_round + 1, room.total_rounds)

    if (isHost) { scoreMe = room.host_score || 0;  scoreOpp = room.guest_score || 0 }
    else        { scoreMe = room.guest_score || 0; scoreOpp = room.host_score  || 0 }
    scoreDraw = room.draw_score || 0
    updateScoreUI()
    markPlayedDots(room.current_round)

    initTheme()
    initAbandon()
    initCardSelection()
    initValidateButton()
    await initPresence()

    if (isHost) {
      // ★ FIX — pas de filtre current_round=0 qui cause une erreur 400
      // si la salle a déjà un current_round > 0 (reconnexion)
      const now = new Date().toISOString()
      await sb.from('multiplayer_rooms')
        .update({ round_started_at: now })
        .eq('id', roomId)
      startRound(now, room.countdown_seconds || 15)
    } else {
      if (room.round_started_at) {
        startRound(room.round_started_at, room.countdown_seconds || 15)
      } else {
        const waitStart = setInterval(async () => {
          const { data } = await sb
            .from('multiplayer_rooms')
            .select('round_started_at, countdown_seconds')
            .eq('id', roomId)
            .single()
          if (data?.round_started_at) {
            clearInterval(waitStart)
            startRound(data.round_started_at, data.countdown_seconds || 15)
          }
        }, 1000)
      }
    }
  }

  // ============================================================
  //  SÉLECTION DES CARTES
  // ============================================================
  function initCardSelection() {
    document.querySelectorAll('.choice-card').forEach(card => {
      card.addEventListener('click', function () {
        if (!roundInProgress || myMove) return

        document.querySelectorAll('.choice-card').forEach(c => c.classList.remove('selected'))
        this.classList.add('selected')
        selectedMove = this.dataset.move

        setEl('my-move-label', MOVES[selectedMove]?.label || selectedMove)
        document.getElementById('my-move-display').innerHTML = moveSVG(selectedMove, '#02b7f5')

        const btn = document.getElementById('btn-validate')
        if (btn) { btn.classList.remove('hidden'); btn.disabled = false }
      })
    })
  }

  // ============================================================
  //  BOUTON VALIDER — FIX : pas de console.log orphelin
  // ============================================================
  function initValidateButton() {
    const btn = document.getElementById('btn-validate')
    if (!btn) return

    btn.addEventListener('click', async function () {
      if (!selectedMove || myMove || !roundInProgress) return

      myMove = selectedMove
      this.disabled = true
      this.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Envoi...'

      document.querySelectorAll('.choice-card').forEach(c => c.classList.add('disabled'))

      const moveCol = isHost ? 'host_move' : 'guest_move'
      const { error } = await sb.from('multiplayer_rooms')
        .update({ [moveCol]: myMove })
        .eq('id', room.id)

      if (error) {
        console.error('[VALIDATE ERROR]', error)
        showToast('Erreur lors de l\'envoi du coup', 'error')
        return
      }

      // Arrêter le countdown visuellement
      clearInterval(countdownInterval)
      const num  = document.getElementById('countdown-number')
      const ring = document.getElementById('countdown-ring')
      const bar  = document.getElementById('countdown-bar')
      if (num)  num.textContent = '✓'
      if (ring) ring.style.stroke = '#22c55e'
      if (bar)  { bar.style.width = '100%'; bar.style.background = '#22c55e' }

      this.innerHTML = '<i class="fa-solid fa-check mr-2"></i> COUP SOUMIS !'
      document.getElementById('my-status')?.classList.remove('hidden')
    })
  }

  // ============================================================
  //  DÉMARRER UN ROUND — FIX : reset expectedRound
  // ============================================================
  function startRound(roundStartedAt, totalSeconds) {
    roundInProgress  = true
    selectedMove     = null
    myMove           = null
    processingResult = false

    // Reset UI
    document.querySelectorAll('.choice-card').forEach(c => c.classList.remove('selected', 'disabled'))
    document.getElementById('my-status')?.classList.add('hidden')
    document.getElementById('my-move-display').innerHTML  = moveSVG(null, '#02b7f5')
    document.getElementById('my-move-label').textContent  = '—'
    document.getElementById('opp-move-display').innerHTML = moveSVG(null, '#a855f7')
    document.getElementById('opp-move-label').textContent = '—'
    setEl('opp-status', 'En attente…')
    const oppEl = document.getElementById('opp-status')
    if (oppEl) oppEl.className = 'font-rajdhani text-[10px] dark:text-[#475569] text-[#94a3b8] mt-1'

    const btn = document.getElementById('btn-validate')
    if (btn) {
      btn.classList.add('hidden')
      btn.disabled = true
      btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i> JOUER CE COUP'
    }

    startCountdown(roundStartedAt, totalSeconds)
    startPollResult()
  }

  // ============================================================
  //  COUNTDOWN
  // ============================================================
  function startCountdown(roundStartedAt, totalSeconds) {
    clearInterval(countdownInterval)

    const CIRCUMFERENCE = 276.46
    const ring = document.getElementById('countdown-ring')
    const num  = document.getElementById('countdown-number')
    const bar  = document.getElementById('countdown-bar')

    countdownInterval = setInterval(() => {
      const elapsed   = (Date.now() - new Date(roundStartedAt).getTime()) / 1000
      const remaining = Math.max(0, totalSeconds - Math.floor(elapsed))
      const pct       = remaining / totalSeconds

      if (num)  num.textContent = remaining
      if (ring) ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - pct)
      if (bar)  bar.style.width = (pct * 100) + '%'

      if (remaining <= 5) {
        if (num)  num.className = 'font-orbitron font-black text-3xl countdown-danger'
        if (ring) ring.style.stroke = '#ef4444'
        if (bar)  bar.classList.add('bar-danger')
      } else if (remaining <= 10) {
        if (num)  num.className = 'font-orbitron font-black text-3xl text-draw'
        if (ring) ring.style.stroke = '#f59e0b'
        if (bar)  { bar.classList.remove('bar-danger'); bar.style.background = '#f59e0b' }
      } else {
        if (num)  num.className = 'font-orbitron font-black text-3xl text-primary'
        if (ring) ring.style.stroke = '#02b7f5'
        if (bar)  { bar.classList.remove('bar-danger'); bar.style.background = '#02b7f5' }
      }

      if (remaining <= 0) {
        clearInterval(countdownInterval)
        if (!myMove) handleTimeout()
      }
    }, 250)
  }

  // ============================================================
  //  POLLING — avec logs debug
  // ============================================================
  function startPollResult() {
    stopPollResult()
    console.log(`[POLL START] isHost=${isHost} expectedRound=${expectedRound}`)
    pollInterval = setInterval(async () => {
      if (!room || processingResult) return
      try {
        const { data } = await sb
          .from('multiplayer_rooms')
          .select('id, host_move, guest_move, status, round_started_at, current_round, total_rounds, host_score, guest_score, draw_score, winner_id, countdown_seconds')
          .eq('id', room.id)
          .single()

        if (!data) return

        console.log(`[POLL] current_round=${data.current_round} expected=${expectedRound} host_move=${JSON.stringify(data.host_move)} guest_move=${JSON.stringify(data.guest_move)} status=${data.status}`)

        // Ignorer si ce n'est pas le round qu'on attend
        if (data.current_round !== expectedRound) {
          console.log(`[POLL SKIP] round ${data.current_round} != expected ${expectedRound}`)
          return
        }

        // Partie terminée
        if (data.status === 'finished' || data.status === 'abandoned') {
          stopPollResult()
          clearInterval(countdownInterval)
          showFinalResult(data)
          return
        }

        // Afficher statut adversaire
        const oppMove = isHost ? data.guest_move : data.host_move
        if (oppMove) {
          const oppEl = document.getElementById('opp-status')
          if (oppEl && !oppEl.classList.contains('text-win')) {
            setEl('opp-status', oppMove === 'timeout' ? '⏰ Timeout' : '✓ A joué')
            oppEl.classList.remove('dark:text-[#475569]', 'text-[#94a3b8]')
            oppEl.classList.add('text-win')
          }
        }

        const bothPlayed = !!data.host_move && !!data.guest_move
        console.log(`[POLL] bothPlayed=${bothPlayed} processingResult=${processingResult}`)
        if (bothPlayed && !processingResult) {
          processingResult = true
          stopPollResult()
          clearInterval(countdownInterval)
          console.log(`[POLL TRIGGER] processRoundResult round=${data.current_round}`)
          await processRoundResult(data)
        }

      } catch (e) { console.error('[POLL ERROR]', e) }
    }, 2000)
  }

  function stopPollResult() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
  }

  // ============================================================
  //  TIMEOUT
  // ============================================================
  async function handleTimeout() {
    if (myMove) return
    selectedMove = 'timeout'
    myMove       = 'timeout'
    document.querySelectorAll('.choice-card').forEach(c => c.classList.add('disabled'))
    document.getElementById('btn-validate')?.classList.add('hidden')
    setEl('my-move-label', 'TIMEOUT')
    document.getElementById('my-move-display').innerHTML = moveSVG('timeout', '#ef4444')
    document.getElementById('my-status')?.classList.remove('hidden')

    const moveCol = isHost ? 'host_move' : 'guest_move'
    await sb.from('multiplayer_rooms')
      .update({ [moveCol]: 'timeout' })
      .eq('id', room.id)
  }

  // ============================================================
  //  RÉSULTAT DU ROUND — FIX : incrémenter expectedRound
  // ============================================================
  async function processRoundResult(data) {
    roundInProgress = false
    console.log(`[PROCESS] round=${data.current_round} host_move=${data.host_move} guest_move=${data.guest_move} isHost=${isHost}`)

    const hostMove   = data.host_move
    const guestMove  = data.guest_move
    const myMoveNow  = isHost ? hostMove  : guestMove
    const oppMoveNow = isHost ? guestMove : hostMove

    document.getElementById('my-move-display').innerHTML  = moveSVG(myMoveNow,  '#02b7f5')
    document.getElementById('opp-move-display').innerHTML = moveSVG(oppMoveNow, '#a855f7')
    setEl('my-move-label',  MOVES[myMoveNow]?.label  || myMoveNow)
    setEl('opp-move-label', MOVES[oppMoveNow]?.label || oppMoveNow)

    const resultHost = getRoundResult(hostMove, guestMove)
    const myResult   = isHost
      ? resultHost
      : (resultHost === 'win' ? 'loss' : resultHost === 'loss' ? 'win' : 'draw')

    if (myResult === 'win')       scoreMe++
    else if (myResult === 'loss') scoreOpp++
    else                          scoreDraw++
    updateScoreUI()

    // ★ FIX dots — current_round est l'index du round qui vient d'être joué (0, 1, 2...)
    markDot(data.current_round, myResult)

    await delay(400)
    showRoundBanner(myResult, myMoveNow, oppMoveNow)

    if (isHost) {
      await delay(2000)
      const nextRound  = data.current_round + 1
      const hostScore  = scoreMe
      const guestScore = scoreOpp

      if (nextRound >= data.total_rounds) {
        await finishGame(null, hostScore, guestScore)
      } else {
        // ★ FIX — incrémenter expectedRound AVANT de mettre à jour la BDD
        expectedRound = nextRound

        const newStart = new Date().toISOString()
        await sb.from('multiplayer_rooms').update({
          current_round:    nextRound,
          host_move:        null,
          guest_move:       null,
          round_started_at: newStart,
          host_score:       hostScore,
          guest_score:      guestScore,
          draw_score:       scoreDraw,
        }).eq('id', room.id)  // ★ room.id — toujours disponible

        updateRoundCounter(nextRound + 1, data.total_rounds)
        startRound(newStart, data.countdown_seconds || 15)
      }
    } else {
      // GUEST — attend que le HOST mette à jour la BDD pour le prochain round
      await delay(2000)

      // ★ FIX — si c'est le dernier round, ne pas lancer waitNext
      // Le HOST va mettre status='finished' → on poll directement
      if (data.current_round + 1 >= data.total_rounds) {
        // Attendre que le HOST finalise la partie
        let finalFired = false
        const waitFinal = setInterval(async () => {
          if (finalFired) { clearInterval(waitFinal); return }
          const { data: final } = await sb
            .from('multiplayer_rooms')
            .select('*')
            .eq('id', room.id)
            .single()
          if (!final) return
          if (final.status === 'finished') {
            finalFired = true
            clearInterval(waitFinal)
            showFinalResult(final)
          }
        }, 1000)
        return
      }

      // Capturer le round actuel AVANT le setInterval pour la comparaison
      const roundJustPlayed = data.current_round
      // ★ FIX — flag pour éviter que waitNext fire deux fois
      let waitNextFired = false

      const waitNext = setInterval(async () => {
        if (waitNextFired) { clearInterval(waitNext); return }

        const { data: next } = await sb
          .from('multiplayer_rooms')
          .select('round_started_at, current_round, host_move, guest_move, status, countdown_seconds, total_rounds')
          .eq('id', room.id)
          .single()

        if (!next) return

        // Sécurité — si la partie est finie pendant l'attente
        if (next.status === 'finished') {
          waitNextFired = true
          clearInterval(waitNext)
          const { data: final } = await sb.from('multiplayer_rooms').select('*').eq('id', room.id).single()
          if (final) showFinalResult(final)
          return
        }

        // Supabase retourne undefined pour les champs remis à null, pas null strict
        const roundChanged  = next.current_round > roundJustPlayed
        const movesAreEmpty = !next.host_move && !next.guest_move
        console.log(`[WAIT_NEXT] current_round=${next.current_round} roundJustPlayed=${roundJustPlayed} roundChanged=${roundChanged} movesAreEmpty=${movesAreEmpty} host_move=${JSON.stringify(next.host_move)} guest_move=${JSON.stringify(next.guest_move)}`)

        if (roundChanged && movesAreEmpty && next.round_started_at) {
          waitNextFired = true
          clearInterval(waitNext)
          expectedRound = next.current_round
          updateRoundCounter(next.current_round + 1, next.total_rounds)
          startRound(next.round_started_at, next.countdown_seconds || 15)
        }
      }, 1000)
    }
  }

  function getRoundResult(hostMove, guestMove) {
    if (hostMove === 'timeout' && guestMove === 'timeout') return 'draw'
    if (hostMove === 'timeout')  return 'loss'
    if (guestMove === 'timeout') return 'win'
    if (hostMove === guestMove)  return 'draw'
    return MOVES[hostMove]?.beats === guestMove ? 'win' : 'loss'
  }

  // ============================================================
  //  TERMINER LA PARTIE
  // ============================================================
  async function finishGame(forcedWinner = null, hostScore = null, guestScore = null) {
    clearInterval(countdownInterval)
    stopPollResult()

    const hScore = hostScore  ?? (isHost ? scoreMe : scoreOpp)
    const gScore = guestScore ?? (isHost ? scoreOpp : scoreMe)

    let winner_id = null
    if (forcedWinner === 'host')       winner_id = room.host_id
    else if (forcedWinner === 'guest') winner_id = room.guest_id
    else if (hScore > gScore)          winner_id = room.host_id
    else if (gScore > hScore)          winner_id = room.guest_id

    await sb.from('multiplayer_rooms').update({
      status:      'finished',
      winner_id,
      host_score:  hScore,
      guest_score: gScore,
      draw_score:  scoreDraw,
    }).eq('id', room.id)
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
        if (presenceReady) checkOpponentPresence()
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (!presenceReady) return
        const oppId = isHost ? room.guest_id : room.host_id
        if (leftPresences.some(p => p.user_id === oppId)) handleOpponentDisconnect()
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        const oppId = isHost ? room.guest_id : room.host_id
        if (newPresences.some(p => p.user_id === oppId)) handleOpponentReconnect()
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id:  currentUser.id,
            username: currentProfile?.username || '',
            status:   'in_game',
            since:    new Date().toISOString()
          })
          setTimeout(() => { presenceReady = true }, 5000)
        }
      })
  }

  function checkOpponentPresence() {
    if (!presenceReady) return
    const oppId = isHost ? room.guest_id : room.host_id
    const state = presenceChannel.presenceState()
    const oppOnline = Object.values(state).some(presences =>
      presences.some(p => p.user_id === oppId && p.status === 'in_game')
    )
    if (!oppOnline) handleOpponentDisconnect()
    else            handleOpponentReconnect()
  }

  let disconnectCountdown = 30
  function handleOpponentDisconnect() {
    if (disconnectTimer) return
    document.getElementById('disconnect-warning')?.classList.remove('hidden')
    disconnectCountdown = 30
    disconnectTimer = setInterval(async () => {
      disconnectCountdown--
      setEl('disconnect-countdown', disconnectCountdown + 's')
      if (disconnectCountdown <= 0) {
        clearInterval(disconnectTimer); disconnectTimer = null
        await finishGame(isHost ? 'host' : 'guest')
      }
    }, 1000)
  }

  function handleOpponentReconnect() {
    if (!disconnectTimer) return
    clearInterval(disconnectTimer); disconnectTimer = null
    document.getElementById('disconnect-warning')?.classList.add('hidden')
    showToast('Adversaire reconnecté !', 'success')
  }

  // ============================================================
  //  RÉSULTAT FINAL
  // ============================================================
  function showFinalResult(updatedRoom) {
    clearInterval(countdownInterval)
    stopPollResult()
    presenceChannel?.track({
      user_id: currentUser.id, username: currentProfile?.username || '',
      status: 'online', since: new Date().toISOString()
    })

    const hScore   = updatedRoom.host_score  || 0
    const gScore   = updatedRoom.guest_score || 0
    const myScore  = isHost ? hScore : gScore
    const oppScore = isHost ? gScore : hScore

    let outcome, title, sub
    if (!updatedRoom.winner_id) {
      outcome = 'draw'; title = 'MATCH NUL !'
      sub = `${myScore} victoires chacun sur ${updatedRoom.total_rounds} rounds`
    } else if (updatedRoom.winner_id === currentUser.id) {
      outcome = 'win'; title = 'VICTOIRE !'
      sub = `${myScore} - ${oppScore} sur ${updatedRoom.total_rounds} rounds !`
    } else {
      outcome = 'loss'; title = 'DÉFAITE !'
      sub = `${oppScore} - ${myScore} pour ton adversaire...`
    }

    const cfg = {
      win:  { bg:'rgba(0,30,10,0.75)',  border:'#22c55e', color:'#4ade80', icon:'fa-trophy',           grad:'linear-gradient(135deg,rgba(20,83,45,0.95),rgba(10,15,30,0.98))', btn:'#16a34a' },
      loss: { bg:'rgba(30,0,0,0.75)',   border:'#ef4444', color:'#f87171', icon:'fa-skull-crossbones', grad:'linear-gradient(135deg,rgba(127,29,29,0.95),rgba(10,15,30,0.98))', btn:'#dc2626' },
      draw: { bg:'rgba(10,15,30,0.75)', border:'#94a3b8', color:'#e2e8f0', icon:'fa-handshake',        grad:'linear-gradient(135deg,rgba(30,41,59,0.95),rgba(10,15,30,0.98))', btn:'#475569' },
    }[outcome]

    const overlay = document.createElement('div')
    overlay.style.cssText = `position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);background:${cfg.bg};`
    const box = document.createElement('div')
    box.style.cssText = `background:${cfg.grad};border:2px solid ${cfg.border};border-radius:24px;padding:48px 32px;max-width:400px;width:90%;text-align:center;box-shadow:0 0 80px ${cfg.border}55;`
    box.innerHTML = `
      <i class="fa-solid ${cfg.icon}" style="font-size:56px;color:${cfg.color};margin-bottom:20px;display:block;"></i>
      <div style="font-family:'Orbitron',sans-serif;font-size:26px;font-weight:900;color:${cfg.color};letter-spacing:2px;margin-bottom:10px;">${title}</div>
      <p style="font-family:'Rajdhani',sans-serif;font-size:16px;color:rgba(255,255,255,0.75);margin-bottom:8px;">${sub}</p>
      <div style="display:flex;justify-content:center;gap:20px;margin:16px 0 28px;font-family:'Orbitron',sans-serif;font-size:13px;">
        <span style="color:#22c55e;">${myScore}V MOI</span>
        <span style="color:#94a3b8;">${updatedRoom.draw_score || 0} NULS</span>
        <span style="color:#ef4444;">${oppScore}V ADV</span>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        <button id="btn-play-again" style="background:linear-gradient(to right,${cfg.btn},${cfg.btn}cc);color:white;border:none;padding:14px 28px;border-radius:999px;font-family:'Orbitron',sans-serif;font-size:13px;font-weight:700;cursor:pointer;">
          <i class="fa-solid fa-rotate-right"></i> REJOUER
        </button>
        <button id="btn-go-dashboard" style="background:transparent;color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.3);padding:14px 28px;border-radius:999px;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:600;cursor:pointer;">
          <i class="fa-solid fa-house mr-1"></i> Dashboard
        </button>
      </div>
    `
    overlay.appendChild(box)
    document.body.appendChild(overlay)

    document.getElementById('btn-play-again').addEventListener('click', () => {
      window.location.href = BASE_URL + '/room/lobby.html'
    })
    document.getElementById('btn-go-dashboard').addEventListener('click', () => {
      window.location.href = BASE_URL + '/player/dashboard.html'
    })
  }

  // ============================================================
  //  BANNER ROUND
  // ============================================================
  function showRoundBanner(result, myMove, oppMove) {
    const cfg = {
      win:  { bg:'rgba(0,25,8,0.75)',   border:'#22c55e', color:'#4ade80', icon:'fa-trophy',    label:'TU GAGNES CE ROUND !' },
      loss: { bg:'rgba(30,0,0,0.75)',   border:'#ef4444', color:'#f87171', icon:'fa-skull',     label:'ROUND PERDU !'        },
      draw: { bg:'rgba(10,15,30,0.75)', border:'#64748b', color:'#94a3b8', icon:'fa-handshake', label:'ROUND NUL !'          },
    }[result]

    const overlay = document.createElement('div')
    overlay.style.cssText = `position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);background:${cfg.bg};`
    const card = document.createElement('div')
    card.style.cssText = `border:2px solid ${cfg.border};border-radius:24px;padding:36px 44px;max-width:360px;width:90%;text-align:center;background:rgba(10,15,30,0.92);`
    card.innerHTML = `
      <i class="fa-solid ${cfg.icon}" style="font-size:44px;color:${cfg.color};margin-bottom:12px;display:block;"></i>
      <div style="font-family:'Orbitron',sans-serif;font-size:18px;font-weight:900;color:${cfg.color};letter-spacing:2px;">${cfg.label}</div>
      <div style="display:flex;justify-content:center;align-items:center;gap:20px;margin-top:16px;font-family:'Rajdhani',sans-serif;font-size:14px;color:rgba(255,255,255,0.6);">
        <span>${MOVES[myMove]?.label || myMove}</span>
        <span style="color:rgba(255,255,255,0.3);">vs</span>
        <span>${MOVES[oppMove]?.label || oppMove}</span>
      </div>
    `
    overlay.appendChild(card)
    document.body.appendChild(overlay)
    setTimeout(() => overlay.remove(), 1800)
  }

  // ============================================================
  //  ABANDON
  // ============================================================
  function initAbandon() {
    const modal = document.getElementById('modal-abandon')
    document.getElementById('btn-abandon').addEventListener('click', () => modal.classList.remove('hidden'))
    document.getElementById('btn-abandon-cancel').addEventListener('click', () => modal.classList.add('hidden'))
    document.getElementById('btn-abandon-confirm').addEventListener('click', async () => {
      modal.classList.add('hidden')
      const winner = isHost ? 'guest' : 'host'
      await finishGame(winner)
      window.location.href = BASE_URL + '/player/dashboard.html'
    })
  }

  // ============================================================
  //  DOTS
  // ============================================================
  function buildDots(total) {
    const container = document.getElementById('rounds-dots')
    if (!container) return
    container.innerHTML = ''
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('div')
      dot.className = 'round-dot' + (i === 0 ? ' current' : '')
      dot.id = `dot-${i}`
      container.appendChild(dot)
    }
  }

  function markDot(index, result) {
    const dot = document.getElementById(`dot-${index}`)
    if (!dot) return
    dot.classList.remove('current')
    dot.classList.add(result === 'win' ? 'win' : result === 'loss' ? 'lose' : 'draw')
    const next = document.getElementById(`dot-${index + 1}`)
    if (next) next.classList.add('current')
  }

  function markPlayedDots(currentRound) {
    for (let i = 0; i < currentRound; i++) {
      const dot = document.getElementById(`dot-${i}`)
      if (dot) { dot.classList.remove('current'); dot.classList.add('draw') }
    }
    const current = document.getElementById(`dot-${currentRound}`)
    if (current) current.classList.add('current')
  }

  function updateRoundCounter(round, total) {
    setEl('round-counter', `Round ${round} / ${total}`)
  }

  function updateScoreUI() {
    setEl('score-me',   scoreMe)
    setEl('score-opp',  scoreOpp)
    setEl('score-draw', scoreDraw)
  }

  function setEl(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

  function showToast(message, type = 'info') {
    document.querySelector('.pvp-toast')?.remove()
    const toast = document.createElement('div')
    toast.className = 'pvp-toast fixed top-20 right-4 z-50 px-5 py-3 rounded-xl font-rajdhani font-semibold text-white shadow-xl'
    toast.textContent = message
    const colors = { warning:'#f59e0b', error:'#ef4444', success:'#22c55e', info:'#02b7f5' }
    toast.style.background = colors[type] || colors.info
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3500)
  }

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

  initTheme()
  init()

})()
