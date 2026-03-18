// ============================================================
//  CONFIGURATION SUPABASE
//  Fichier : assets/js/auth.js
//  Client joueur uniquement — clé par défaut
// ============================================================
const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const BASE_URL = window.location.origin + '/player'


// ============================================================
//  SWITCH CONNEXION / INSCRIPTION
// ============================================================
const btnConnexion    = document.getElementById('btn-connexion')
const btnInscription  = document.getElementById('btn-inscription')
const formConnexion   = document.getElementById('form-connexion')
const formInscription = document.getElementById('form-inscription')

btnConnexion.addEventListener('click', () => {
  btnConnexion.classList.add('active')
  btnInscription.classList.remove('active')
  formConnexion.classList.add('active')
  formInscription.classList.remove('active')
  clearAllErrors()
})

btnInscription.addEventListener('click', () => {
  btnInscription.classList.add('active')
  btnConnexion.classList.remove('active')
  formInscription.classList.add('active')
  formConnexion.classList.remove('active')
  clearAllErrors()
})


// ============================================================
//  TOAST
// ============================================================
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.animation = 'slideInRight 0.3s ease reverse'
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}


// ============================================================
//  ERREURS INLINE
// ============================================================
function showFieldError(inputEl, message) {
  clearFieldError(inputEl)
  inputEl.classList.add('error')
  if (!message || !message.trim()) return

  const errorEl = document.createElement('span')
  errorEl.className = 'field-error'
  errorEl.textContent = message

  const wrapper = inputEl.closest('.password-input-wrapper')
  const anchor  = wrapper || inputEl
  anchor.insertAdjacentElement('afterend', errorEl)
}

function clearFieldError(inputEl) {
  inputEl.classList.remove('error')
  const wrapper = inputEl.closest('.password-input-wrapper')
  const anchor  = wrapper || inputEl
  const next    = anchor.nextElementSibling
  if (next && next.classList.contains('field-error')) next.remove()
}

function clearAllErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.remove())
  document.querySelectorAll('input.error').forEach(el => el.classList.remove('error'))
}

;['login-email','login-password',
  'signup-nom','signup-prenom','signup-pseudo',
  'signup-email','signup-password','signup-confirm-password'
].forEach(id => {
  const el = document.getElementById(id)
  if (el) el.addEventListener('input', () => clearFieldError(el))
})


// ============================================================
//  HELPERS
// ============================================================
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidPassword(password) {
  return password.length >= 6
}

function setButtonLoading(btn, loading, loadingText = '') {
  btn.disabled = loading
  if (loading) {
    btn.dataset.originalText = btn.textContent
    btn.textContent = loadingText
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent
  }
}


// ============================================================
//  CONNEXION JOUEUR
//  Redirige toujours vers game.html
//  Si un admin essaie de se connecter ici, il est bloqué
// ============================================================
async function handleConnexion(event) {
  event.preventDefault()
  clearAllErrors()

  const emailEl  = document.getElementById('login-email')
  const passEl   = document.getElementById('login-password')
  const email    = emailEl.value.trim()
  const password = passEl.value

  let hasError = false

  if (!email || !isValidEmail(email)) {
    showFieldError(emailEl, 'Adresse email invalide.')
    hasError = true
  }
  if (!password) {
    showFieldError(passEl, 'Veuillez saisir votre mot de passe.')
    hasError = true
  }
  if (hasError) return

  const btn = event.target.querySelector('button[type="submit"]')
  setButtonLoading(btn, true, 'Connexion en cours...')

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        showFieldError(emailEl, 'Email ou mot de passe incorrect.')
        showFieldError(passEl, ' ')
      } else {
        showFieldError(emailEl, error.message)
      }
      return
    }

    // Vérifie que c'est bien un joueur — pas un admin
    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'admin') {
      await sb.auth.signOut()
      showFieldError(emailEl, 'Les admins se connectent via le panel admin.')
      return
    }

    showToast('Connexion réussie ! Vous serez rediriger vers l\'arène...', 'success')
    setTimeout(() => {
      window.location.href = BASE_URL + '/game.html'
    }, 1000)

  } catch (err) {
    showToast('Une erreur inattendue est survenue.', 'error')
    console.error(err)
  } finally {
    setButtonLoading(btn, false)
  }
}


// ============================================================
//  INSCRIPTION JOUEUR
// ============================================================
async function handleInscription(event) {
  event.preventDefault()
  clearAllErrors()

  const nomEl     = document.getElementById('signup-nom')
  const prenomEl  = document.getElementById('signup-prenom')
  const pseudoEl  = document.getElementById('signup-pseudo')
  const emailEl   = document.getElementById('signup-email')
  const passEl    = document.getElementById('signup-password')
  const confirmEl = document.getElementById('signup-confirm-password')

  const lastName   = nomEl.value.trim()
  const firstName  = prenomEl.value.trim()
  const username   = pseudoEl.value.trim()
  const email      = emailEl.value.trim()
  const password   = passEl.value
  const confirmPwd = confirmEl.value

  let hasError = false

  if (!lastName)                        { showFieldError(nomEl,     'Veuillez saisir votre nom.');                           hasError = true }
  if (!firstName)                       { showFieldError(prenomEl,  'Veuillez saisir votre prénom.');                        hasError = true }
  if (!username || username.length < 3) { showFieldError(pseudoEl,  'Le pseudo doit faire au moins 3 caractères.');          hasError = true }
  if (!isValidEmail(email))             { showFieldError(emailEl,   'Adresse email invalide.');                              hasError = true }
  if (!isValidPassword(password))       { showFieldError(passEl,    'Le mot de passe doit contenir au moins 6 caractères.'); hasError = true }
  if (password && confirmPwd && password !== confirmPwd) {
    showFieldError(confirmEl, 'Les mots de passe ne correspondent pas.')
    hasError = true
  }
  if (hasError) return

  const btn = event.target.querySelector('button[type="submit"]')
  setButtonLoading(btn, true, 'Inscription en cours...')

  try {
    // Vérifie si le pseudo est déjà pris
    const { data: existingUser } = await sb
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle()

    if (existingUser) {
      showFieldError(pseudoEl, 'Ce pseudo est déjà utilisé.')
      setButtonLoading(btn, false)
      return
    }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name:  lastName,
          username:   username,
          role:       'player',
        }
      }
    })

    if (error) {
      if (error.message.includes('User already registered')) {
        showFieldError(emailEl, 'Un compte existe déjà avec cet email.')
      } else {
        showFieldError(emailEl, error.message)
      }
      return
    }

    if (data.user && data.user.identities?.length === 0) {
      showFieldError(emailEl, 'Un compte existe déjà avec cet email.')
      return
    }

    showToast('Compte créé ! Connectez-vous', 'success')
    setTimeout(() => { btnConnexion.click() }, 2500)

  } catch (err) {
    showToast('Une erreur inattendue est survenue.', 'error')
    console.error(err)
  } finally {
    setButtonLoading(btn, false)
  }
}


// ============================================================
//  TOGGLE VISIBILITÉ MOT DE PASSE
// ============================================================
function addPasswordToggle(inputId) {
  const input = document.getElementById(inputId)
  if (!input) return
  if (input.parentElement.classList.contains('password-input-wrapper')) return

  const wrapper = document.createElement('div')
  wrapper.className = 'password-input-wrapper'
  input.parentNode.insertBefore(wrapper, input)
  wrapper.appendChild(input)

  const icon = document.createElement('i')
  icon.className = 'fa-regular fa-eye password-toggle'
  wrapper.appendChild(icon)

  icon.addEventListener('click', () => {
    const isHidden = input.type === 'password'
    input.type     = isHidden ? 'text' : 'password'
    icon.className = isHidden
      ? 'fa-regular fa-eye-slash password-toggle'
      : 'fa-regular fa-eye password-toggle'
  })
}

addPasswordToggle('login-password')
addPasswordToggle('signup-password')
addPasswordToggle('signup-confirm-password')