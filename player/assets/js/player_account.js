(function () {

  // ============================================================
  //  CONFIG SUPABASE
  // ============================================================
  const SUPABASE_URL      = 'https://rblzhlykvssztahurebt.supabase.co'
  const SUPABASE_ANON_KEY = 'sb_publishable_b4cQt1irGiIGPnqxqJf_RQ_Jv_WO0wX'
  const { createClient } = supabase
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const BASE_URL = window.location.origin

  const MAX_FILE_SIZE    = 2 * 1024 * 1024  // 2 MB
  const ALLOWED_TYPES    = ['image/jpeg', 'image/png', 'image/webp']

  let currentUser    = null
  let currentProfile = null

  // ============================================================
  //  PROTECTION — joueur uniquement
  // ============================================================
  async function init() {
    const { data: { session } } = await sb.auth.getSession()
    if (!session) {
      window.location.href = BASE_URL + '/index.html'
      return
    }
    currentUser = session.user

    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single()

    if (!profile || profile.role === 'admin') {
      window.location.href = BASE_URL + '/index.html'
      return
    }

    currentProfile = profile
    populateForm()
  }

  // ============================================================
  //  REMPLIR LE FORMULAIRE avec les données actuelles
  // ============================================================
  function populateForm() {
    const p        = currentProfile
    const initials = (p.first_name[0] + p.last_name[0]).toUpperCase()
    const fullName = p.first_name + ' ' + p.last_name

    // Navbar
    setNavbar(initials, fullName, p.username, p.avatar_url)

    // Formulaire
    document.getElementById('field-lastname').value  = p.last_name  || ''
    document.getElementById('field-firstname').value = p.first_name || ''
    document.getElementById('field-username').value  = p.username   || ''
    document.getElementById('field-email').value     = currentUser.email || ''

    // Avatar
    renderAvatarPreview(p.avatar_url, initials)

    // Bouton supprimer avatar
    const btnDel = document.getElementById('btn-delete-avatar')
    if (btnDel) btnDel.classList.toggle('hidden', !p.avatar_url)
  }

  // ============================================================
  //  AFFICHAGE AVATAR
  // ============================================================
  function renderAvatarPreview(url, initials) {
    const preview = document.getElementById('avatar-preview')
    if (!preview) return

    if (url) {
      preview.innerHTML = `<img src="${url}" alt="avatar" class="w-full h-full object-cover">`
    } else {
      preview.innerHTML = initials
      preview.style.display = 'flex'
    }
  }

  function setNavbar(initials, fullName, username, avatarUrl) {
    const navAvatar = document.getElementById('nav-avatar')
    const navName   = document.getElementById('nav-name')
    const navUser   = document.getElementById('nav-username')

    if (navAvatar) {
      if (avatarUrl) {
        navAvatar.innerHTML = `<img src="${avatarUrl}" alt="avatar" class="w-full h-full object-cover rounded-full">`
      } else {
        navAvatar.textContent = initials
      }
    }
    if (navName)   navName.textContent   = fullName
    if (navUser)   navUser.textContent   = '@' + username
  }

  // ============================================================
  //  UPLOAD AVATAR — fichier depuis l'appareil
  // ============================================================
  const fileInput      = document.getElementById('avatar-file-input')
  const uploadZone     = document.getElementById('avatar-click-zone')
  const btnUpload      = document.getElementById('btn-upload-avatar')
  const progressBar    = document.getElementById('upload-progress')
  const progressFill   = document.getElementById('upload-progress-fill')

  // Clic sur la zone avatar ou le bouton → ouvre le sélecteur de fichier
  uploadZone?.addEventListener('click', () => fileInput.click())
  btnUpload?.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click() })

  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Validation type
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('Format non supporté. Utilise JPG, PNG ou WEBP.', 'error')
      fileInput.value = ''
      return
    }

    // Validation taille
    if (file.size > MAX_FILE_SIZE) {
      showToast('Image trop lourde. Maximum 2 MB.', 'error')
      fileInput.value = ''
      return
    }

    await uploadAvatarFile(file)
    fileInput.value = ''
  })

  async function uploadAvatarFile(file) {
    const ext      = file.name.split('.').pop().toLowerCase()
    const filePath = `${currentUser.id}/avatar.${ext}`

    // Affiche la barre de progression
    progressBar.style.display = 'block'
    progressFill.style.width  = '30%'

    try {
      // Upload vers Supabase Storage — upsert: true écrase l'ancien
      const { error: uploadError } = await sb.storage
        .from('avatars')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        showToast('Erreur lors de l\'upload. Réessaie.', 'error')
        console.error(uploadError)
        progressBar.style.display = 'none'
        return
      }

      progressFill.style.width = '70%'

      // Récupère l'URL publique
      const { data: urlData } = sb.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Ajoute un timestamp pour forcer le rechargement du cache navigateur
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()

      progressFill.style.width = '90%'

      // Met à jour avatar_url dans profiles
      const { error: updateError } = await sb
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', currentUser.id)

      if (updateError) {
        showToast('Erreur lors de la mise à jour du profil.', 'error')
        console.error(updateError)
        progressBar.style.display = 'none'
        return
      }

      progressFill.style.width = '100%'

      // Mise à jour locale
      currentProfile.avatar_url = publicUrl
      const initials = (currentProfile.first_name[0] + currentProfile.last_name[0]).toUpperCase()
      renderAvatarPreview(publicUrl, initials)
      setNavbar(initials, currentProfile.first_name + ' ' + currentProfile.last_name, currentProfile.username, publicUrl)

      // Affiche le bouton supprimer
      const btnDel = document.getElementById('btn-delete-avatar')
      if (btnDel) btnDel.classList.remove('hidden')

      showToast('Avatar mis à jour avec succès !', 'success')

      setTimeout(() => {
        progressBar.style.display = 'none'
        progressFill.style.width  = '0%'
      }, 800)

    } catch (err) {
      showToast('Une erreur inattendue est survenue.', 'error')
      console.error(err)
      progressBar.style.display = 'none'
    }
  }

  // ============================================================
  //  AVATAR PAR URL EXTERNE
  // ============================================================
  document.getElementById('btn-avatar-url')?.addEventListener('click', async () => {
    const url = document.getElementById('avatar-url-input').value.trim()

    if (!url) {
      showToast('Colle un lien image valide.', 'error')
      return
    }

    // Vérifie que l'URL pointe vers une image
    if (!url.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)) {
      showToast('Le lien ne semble pas pointer vers une image (jpg, png, webp).', 'error')
      return
    }

    const { error } = await sb
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', currentUser.id)

    if (error) {
      showToast('Erreur lors de la mise à jour.', 'error')
      return
    }

    currentProfile.avatar_url = url
    const initials = (currentProfile.first_name[0] + currentProfile.last_name[0]).toUpperCase()
    renderAvatarPreview(url, initials)
    setNavbar(initials, currentProfile.first_name + ' ' + currentProfile.last_name, currentProfile.username, url)
    document.getElementById('avatar-url-input').value = ''

    const btnDel = document.getElementById('btn-delete-avatar')
    if (btnDel) btnDel.classList.remove('hidden')

    showToast('Avatar mis à jour avec succès !', 'success')
  })

  // ============================================================
  //  SUPPRIMER L'AVATAR
  // ============================================================
  document.getElementById('btn-delete-avatar')?.addEventListener('click', () => {
    document.getElementById('modal-delete-avatar').classList.remove('hidden')
  })

  document.getElementById('btn-avatar-delete-cancel')?.addEventListener('click', () => {
    document.getElementById('modal-delete-avatar').classList.add('hidden')
  })

  document.getElementById('modal-delete-avatar')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-delete-avatar'))
      document.getElementById('modal-delete-avatar').classList.add('hidden')
  })

  document.getElementById('btn-avatar-delete-confirm')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-avatar-delete-confirm')
    btn.disabled    = true
    btn.textContent = 'Suppression...'

    // Supprime le fichier du bucket si c'est un avatar uploadé
    if (currentProfile.avatar_url?.includes('supabase')) {
      const ext      = currentProfile.avatar_url.split('.').pop().split('?')[0]
      const filePath = `${currentUser.id}/avatar.${ext}`
      await sb.storage.from('avatars').remove([filePath])
    }

    // Met avatar_url à null dans profiles
    const { error } = await sb
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', currentUser.id)

    if (error) {
      showToast('Erreur lors de la suppression.', 'error')
      btn.disabled    = false
      btn.innerHTML   = '<i class="fa-solid fa-trash mr-1"></i> SUPPRIMER'
      return
    }

    currentProfile.avatar_url = null
    const initials = (currentProfile.first_name[0] + currentProfile.last_name[0]).toUpperCase()
    renderAvatarPreview(null, initials)
    setNavbar(initials, currentProfile.first_name + ' ' + currentProfile.last_name, currentProfile.username, null)

    document.getElementById('btn-delete-avatar').classList.add('hidden')
    document.getElementById('modal-delete-avatar').classList.add('hidden')

    showToast('Avatar supprimé.', 'success')
    btn.disabled  = false
    btn.innerHTML = '<i class="fa-solid fa-trash mr-1"></i> SUPPRIMER'
  })

  // ============================================================
  //  SAUVEGARDER LE PROFIL
  // ============================================================
  document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
    const lastName  = document.getElementById('field-lastname').value.trim()
    const firstName = document.getElementById('field-firstname').value.trim()
    const username  = document.getElementById('field-username').value.trim()

    // Validation
    let hasError = false
    clearAllErrors()

    if (!lastName) {
      showFieldError(document.getElementById('field-lastname'), 'Veuillez saisir votre nom.')
      hasError = true
    }
    if (!firstName) {
      showFieldError(document.getElementById('field-firstname'), 'Veuillez saisir votre prénom.')
      hasError = true
    }
    if (!username || username.length < 3) {
      showFieldError(document.getElementById('field-username'), 'Le pseudo doit faire au moins 3 caractères.')
      hasError = true
    }
    if (hasError) return

    const btn = document.getElementById('btn-save-profile')
    btn.disabled    = true
    btn.textContent = 'Sauvegarde...'

    // Vérifie que le pseudo n'est pas pris par quelqu'un d'autre
    if (username !== currentProfile.username) {
      const { data: existing } = await sb
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', currentUser.id)
        .maybeSingle()

      if (existing) {
        showFieldError(document.getElementById('field-username'), 'Ce pseudo est déjà utilisé.')
        btn.disabled    = false
        btn.innerHTML   = '<i class="fa-solid fa-floppy-disk"></i> Sauvegarder'
        return
      }
    }

    const { error } = await sb
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName, username })
      .eq('id', currentUser.id)

    if (error) {
      showToast('Erreur lors de la sauvegarde.', 'error')
      console.error(error)
    } else {
      // Mise à jour locale
      currentProfile.first_name = firstName
      currentProfile.last_name  = lastName
      currentProfile.username   = username

      const initials = (firstName[0] + lastName[0]).toUpperCase()
      setNavbar(initials, firstName + ' ' + lastName, username, currentProfile.avatar_url)

      showToast('Profil mis à jour avec succès !', 'success')
    }

    btn.disabled  = false
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Sauvegarder'
  })

  // ============================================================
  //  SUPPRIMER SON COMPTE
  // ============================================================
  document.getElementById('btn-open-delete-account')?.addEventListener('click', () => {
    const confirmed = confirm(
      'Es-tu sûr de vouloir supprimer ton compte ?\n\n' +
      'Toutes tes parties et statistiques seront définitivement perdues.\n' +
      'Cette action est irréversible.'
    )
    if (!confirmed) return
    deleteAccount()
  })

  async function deleteAccount() {
    // Supprime le profil (cascade supprime stats, games, rounds)
    const { error } = await sb
      .from('profiles')
      .delete()
      .eq('id', currentUser.id)

    if (error) {
      showToast('Erreur lors de la suppression du compte.', 'error')
      console.error(error)
      return
    }

    await sb.auth.signOut()
    showToast('Compte supprimé. À bientôt !', 'info')
    setTimeout(() => {
      window.location.href = BASE_URL + '/index.html'
    }, 1500)
  }

  // ============================================================
  //  DÉCONNEXION
  // ============================================================
  function initLogout() {
    const modal          = document.getElementById('modal-logout')
    const btnLogout      = document.getElementById('btn-logout')
    const btnSidebar     = document.getElementById('btn-logout-sidebar')
    const btnCancel      = document.getElementById('btn-logout-cancel')
    const btnConfirm     = document.getElementById('btn-logout-confirm')

    function openModal()  { modal?.classList.remove('hidden') }
    function closeModal() { modal?.classList.add('hidden') }

    btnLogout?.addEventListener('click',  openModal)
    btnSidebar?.addEventListener('click', openModal)
    btnCancel?.addEventListener('click',  closeModal)
    modal?.addEventListener('click', e => { if (e.target === modal) closeModal() })

    btnConfirm?.addEventListener('click', async () => {
      await sb.auth.signOut()
      window.location.href = BASE_URL + '/index.html'
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
    const savedTheme         = localStorage.getItem('theme') || 'dark'

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
    overlay?.addEventListener('click', () => body.classList.remove('sidebar-open'))
  }

  // ============================================================
  //  HELPERS
  // ============================================================
  function setEl(id, value) {
    const el = document.getElementById(id)
    if (el) el.textContent = value
  }

  function showFieldError(inputEl, message) {
    inputEl.style.borderColor = '#ef4444'
    const err = document.createElement('span')
    err.className   = 'field-error'
    err.textContent = message
    inputEl.insertAdjacentElement('afterend', err)
  }

  function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.remove())
    ;['field-lastname','field-firstname','field-username'].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.style.borderColor = ''
    })
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
    setTimeout(() => toast.remove(), 4000)
  }

  // ============================================================
  //  LANCEMENT
  // ============================================================
  initTheme()
  initSidebar()
  initLogout()
  init()

})()