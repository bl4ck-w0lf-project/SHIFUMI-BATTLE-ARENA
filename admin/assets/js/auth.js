// ============================================================
//  CONFIGURATION SUPABASE
//  Fichier : admin/assets/js/auth.js
//  storageKey 'sba-admin-session' — session admin isolée
// ============================================================
const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'

const { createClient } = supabase

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'sba-admin-session' }
})

const ADMIN_URL = window.location.origin + '/admin'


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

;['login-email', 'login-password'].forEach(id => {
  const el = document.getElementById(id)
  if (el) el.addEventListener('input', () => clearFieldError(el))
})


// ============================================================
//  HELPERS
// ============================================================
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
//  CONNEXION ADMIN
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
    // Étape 1 — Connexion via le client admin (storageKey: 'sba-admin-session')
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

    // Étape 2 — Vérifie que le rôle est admin
    const { data: profile, error: profileError } = await sb
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      await sb.auth.signOut()
      showFieldError(emailEl, 'Compte introuvable.')
      return
    }

    if (profile.role !== 'admin') {
      await sb.auth.signOut()
      showFieldError(emailEl, "Accès refusé. Ce compte n'est pas administrateur.")
      return
    }

    // Étape 3 — Redirige vers admin/admin.html
    showToast('Connexion réussie ! Redirection...', 'success')
    setTimeout(() => {
      window.location.href = ADMIN_URL + '/admin.html'
    }, 1000)

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