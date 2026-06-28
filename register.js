const registerEls = {
  form: document.getElementById('registerForm'),
  displayName: document.getElementById('displayName'),
  username: document.getElementById('username'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  confirmPassword: document.getElementById('confirmPassword'),
  acceptRules: document.getElementById('acceptRules'),
  message: document.getElementById('registerMessage'),
  button: document.getElementById('registerBtn'),
  themeBtn: document.getElementById('themeBtn')
};

function setMessage(message, tone = '') {
  registerEls.message.textContent = message;
  registerEls.message.dataset.tone = tone;
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
}

function redirectHome() {
  window.location.href = 'forum.html';
}

async function ensureProfile(userId) {
  if (!userId) return;
  const displayName = registerEls.displayName.value.trim();
  const username = normalizeUsername(registerEls.username.value);
  const patch = {
    display_name: displayName,
    username: username || null,
    last_seen_at: new Date().toISOString()
  };
  const { error } = await ForumCore.db.from('profiles').update(patch).eq('id', userId);
  if (error) console.warn('Profile update skipped:', error.message);
}

async function completeRegistration(event) {
  event.preventDefault();
  const displayName = registerEls.displayName.value.trim();
  const email = registerEls.email.value.trim();
  const password = registerEls.password.value;
  const confirmPassword = registerEls.confirmPassword.value;

  if (displayName.length < 2) {
    setMessage('Inserisci un nome pubblico di almeno 2 caratteri.');
    return;
  }
  if (password !== confirmPassword) {
    setMessage('Le password non coincidono.');
    return;
  }
  if (!registerEls.acceptRules.checked) {
    setMessage('Per creare un account devi accettare le regole del forum.');
    return;
  }

  registerEls.button.disabled = true;
  setMessage('Creazione account in corso...');

  try {
    const { data, error } = await ForumCore.db.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: new URL('forum.html', window.location.href).toString()
      }
    });
    if (error) throw error;

    let session = data.session;
    if (!session) {
      const loginResult = await ForumCore.db.auth.signInWithPassword({ email, password });
      if (!loginResult.error) session = loginResult.data.session;
    }

    if (session?.user) {
      await ensureProfile(session.user.id);
      setMessage('Account creato. Ti sto portando al forum...', 'success');
      setTimeout(redirectHome, 700);
      return;
    }

    setMessage('Account creato. Controlla la tua email per confermare la registrazione, poi potrai accedere dal forum.', 'success');
  } catch (error) {
    setMessage(error.message || 'Registrazione non riuscita.');
  } finally {
    registerEls.button.disabled = false;
  }
}

async function bootstrapRegister() {
  document.getElementById('pageNav').innerHTML = ForumCore.buildShellLinks('forum');
  document.body.dataset.theme = localStorage.getItem('incForumTheme') || 'dark';
  const { user } = await ForumCore.getCurrentUser();
  if (user) {
    setMessage('Sei già connesso. Ti sto riportando al forum...', 'success');
    setTimeout(redirectHome, 700);
  }
}

registerEls.form.addEventListener('submit', completeRegistration);
registerEls.username.addEventListener('input', () => {
  const clean = normalizeUsername(registerEls.username.value);
  if (registerEls.username.value !== clean) registerEls.username.value = clean;
});
registerEls.themeBtn.addEventListener('click', () => {
  const next = document.body.dataset.theme === 'light' ? 'dark' : 'light';
  document.body.dataset.theme = next;
  localStorage.setItem('incForumTheme', next);
});

bootstrapRegister();
