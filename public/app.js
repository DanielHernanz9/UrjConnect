/*!
* Start Bootstrap - Shop Homepage v5.0.6 (https://startbootstrap.com/template/shop-homepage)
* Copyright 2013-2023 Start Bootstrap
* Licensed under MIT (https://github.com/StartBootstrap/startbootstrap-shop-homepage/blob/master/LICENSE)
*/
// This file is intentionally blank
// Use this file to add JavaScript to your project

 
    /** =========================
     *  Datos base
     *  ========================= */
    const SUBJECTS = [
      { id: "matematicas", name: "Matemáticas", color: "linear-gradient(135deg,#6366f1,#06b6d4)", desc: "Álgebra, cálculo, estadísticas y más." },
      { id: "lengua", name: "Lengua", color: "linear-gradient(135deg,#f43f5e,#f59e0b)", desc: "Gramática, comentario de texto y literatura." },
      { id: "historia", name: "Historia", color: "linear-gradient(135deg,#0ea5e9,#22c55e)", desc: "Desde la Antigüedad hasta la actualidad." },
      { id: "biologia", name: "Biología", color: "linear-gradient(135deg,#22c55e,#14b8a6)", desc: "Genética, ecología y biotecnología." },
      { id: "fisica", name: "Física", color: "linear-gradient(135deg,#06b6d4,#8b5cf6)", desc: "Mecánica, ondas, electricidad y magnetismo." },
      { id: "quimica", name: "Química", color: "linear-gradient(135deg,#f59e0b,#ec4899)", desc: "Reacciones, orgánica y química de materiales." },
      { id: "ingles", name: "Inglés", color: "linear-gradient(135deg,#8b5cf6,#22c55e)", desc: "Speaking, writing, grammar & vocabulary." },
      { id: "informatica", name: "Informática", color: "linear-gradient(135deg,#ec4899,#6366f1)", desc: "Programación, redes y desarrollo web." },
    ];

    /** =========================
     *  Helpers
     *  ========================= */
    const $ = (sel, ctx=document) => ctx.querySelector(sel);
    const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
    const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); };
    const initialsOf = (name='?') => name.trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()||'').join('') || 'UX';
    const hash = (s) => btoa(unescape(encodeURIComponent(s)));

    // 🎨 Presets de color para el avatar
    const PRESET_COLORS = ['#6366f1','#06b6d4','#22c55e','#f59e0b','#ec4899','#8b5cf6','#0ea5e9','#14b8a6'];

    // HSL (antiguo) -> HEX (para compatibilidad)
    function hslToHex(h, s, l){
      s/=100; l/=100;
      const c = (1 - Math.abs(2*l - 1)) * s;
      const x = c * (1 - Math.abs((h/60)%2 - 1));
      const m = l - c/2;
      let r=0,g=0,b=0;
      if (0<=h && h<60){ r=c; g=x; b=0; }
      else if (60<=h && h<120){ r=x; g=c; b=0; }
      else if (120<=h && h<180){ r=0; g=c; b=x; }
      else if (180<=h && h<240){ r=0; g=x; b=c; }
      else if (240<=h && h<300){ r=x; g=0; b=c; }
      else { r=c; g=0; b=x; }
      const to255 = (n)=> Math.round((n+m)*255);
      const hex = (n)=> n.toString(16).padStart(2, '0');
      return '#' + hex(to255(r)) + hex(to255(g)) + hex(to255(b));
    }
    function getAvatarBg(user){
      if(user?.avatarColor) return user.avatarColor;
      const h = user?.hue ?? 210;
      return hslToHex(h,85,60);
    }

    const store = {
      getUsers(){ return JSON.parse(localStorage.getItem('users')||'{}'); },
      setUsers(obj){ localStorage.setItem('users', JSON.stringify(obj)); },
      getSession(){ return JSON.parse(localStorage.getItem('session')||'null'); },
      setSession(email){ localStorage.setItem('session', JSON.stringify({email})); },
      clearSession(){ localStorage.removeItem('session'); },
      getPosts(email, subject){ return JSON.parse(localStorage.getItem(`posts:${email}:${subject}`) || '[]'); },
      setPosts(email, subject, posts){ localStorage.setItem(`posts:${email}:${subject}`, JSON.stringify(posts)); },
    };

    /** =========================
     *  Autenticación (localStorage)
     *  ========================= */
    const authUI = {
      authSection: $('#auth'),
      appSection: $('#app'),
      pill: $('#switchPill'),
      btnLoginTab: $('#btnLoginTab'),
      btnRegisterTab: $('#btnRegisterTab'),
      loginForm: $('#loginForm'),
      registerForm: $('#registerForm'),
      formsWrap: $('#formsWrap'),
      loginError: $('#loginError'),
      registerError: $('#registerError'),
      swapToLogin: $('#swapToLogin'),

      setTab(tab){
        const isLogin = tab === 'login';
        this.btnLoginTab.classList.toggle('active', isLogin);
        this.btnRegisterTab.classList.toggle('active', !isLogin);

        this.loginForm.classList.toggle('active', isLogin);
        this.registerForm.classList.toggle('active', !isLogin);
        this.pill.style.transform = isLogin ? 'translateX(0)' : 'translateX(100%)';

        // Altura suave del contenedor de formularios
        requestAnimationFrame(()=> {
          const active = isLogin ? this.loginForm : this.registerForm;
          const h = active.offsetHeight;
          this.formsWrap.style.height = h + 'px';
        });
      },
      showApp(){ this.authSection.style.display = 'none'; this.appSection.style.display = 'block'; },
      showAuth(){ this.authSection.style.display = 'flex'; this.appSection.style.display = 'none'; },
      measureInit(){ this.formsWrap.style.height = this.loginForm.offsetHeight + 'px'; }
    };

    authUI.btnLoginTab.addEventListener('click', () => authUI.setTab('login'));
    authUI.btnRegisterTab.addEventListener('click', () => authUI.setTab('register'));
    authUI.swapToLogin?.addEventListener('click', (e)=>{ e.preventDefault(); authUI.setTab('login'); });

    window.addEventListener('resize', () => {
      // Mantener centrado y altura correcta en cambios de viewport
      const active = authUI.loginForm.classList.contains('active') ? authUI.loginForm : authUI.registerForm;
      authUI.formsWrap.style.height = active.offsetHeight + 'px';
    });

    // LOGIN
    authUI.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      authUI.loginError.textContent = '';
      const email = $('#li_email').value.trim().toLowerCase();
      const pass = $('#li_pass').value;
      const users = store.getUsers();
      const user = users[email];
      if(!user){ authUI.loginError.textContent = 'No existe ninguna cuenta con ese email.'; return; }
      if(user.pass !== hash(pass)){ authUI.loginError.textContent = 'Contraseña incorrecta.'; return; }
      store.setSession(email);
      toast('¡Bienvenido de nuevo!');
      app.init();
      authUI.showApp();
    });

    // REGISTER → volver a login (sin iniciar sesión)
    authUI.registerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      authUI.registerError.textContent = '';
      const name = $('#r_name').value.trim();
      const email = $('#r_email').value.trim().toLowerCase();
      const pass = $('#r_pass').value;
      const pass2 = $('#r_pass2').value;
      const bio = $('#r_bio').value.trim();

      if(pass.length < 6){ authUI.registerError.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
      if(pass !== pass2){ authUI.registerError.textContent = 'Las contraseñas no coinciden.'; return; }
      const users = store.getUsers();
      if(users[email]){ authUI.registerError.textContent = 'Ya existe una cuenta con ese email.'; return; }
      const hue = Math.floor(Math.random()*360);
      users[email] = { name, email, pass: hash(pass), bio, hue, theme: 'dark', favorites: [] };
      store.setUsers(users);

      // Volver a login, pre-rellenar email y enfocar la contraseña
      authUI.registerForm.reset();
      authUI.setTab('login');
      $('#li_email').value = email;
      setTimeout(() => { $('#li_pass').focus(); }, 0);
      toast('Cuenta creada. Ahora inicia sesión con tus credenciales.');
    });

    /** =========================
     *  APP
     *  ========================= */
    const app = {
      el: {
        profileBtn: $('#profileButton'),
        profileMenu: $('#profileMenu'),
        avatar: $('#avatar'),
        avatarInitials: $('#avatarInitials'),
        profileName: $('#profileName'),
        btnEditProfile: $('#btnEditProfile'),
        btnLogout: $('#btnLogout'),
        filterFavsBtn: $('#filterFavsBtn'),
        chipsRow: $('#chipsRow'),
        cardsGrid: $('#cardsGrid'),
        themeToggle: $('#themeToggle'),
        search: $('#searchInput'),
        // modals
        profileModal: $('#profileModal'),
        p_name: $('#p_name'),
        p_bio: $('#p_bio'),
        p_color: $('#p_color'),
        p_swatches: $('#p_swatches'),
        saveProfile: $('#saveProfile'),
        forumModal: $('#forumModal'),
        forumTitle: $('#forumTitle'),
        posts: $('#posts'),
        newPost: $('#newPost'),
        sendPost: $('#sendPost'),
      },
      user: null,
  onlyFavs: false,
      get sessionEmail(){ const s = store.getSession(); return s?.email || null; },
      get users(){ return store.getUsers(); },

      init(){
        const email = this.sessionEmail;
        if(!email){ authUI.showAuth(); return; }
        this.user = this.users[email];
        if(!this.user){ store.clearSession(); authUI.showAuth(); return; }

        // Theme
        document.documentElement.setAttribute('data-theme', this.user.theme || 'dark');

        // Header info
        this.el.profileName.textContent = this.user.name || 'Tu Nombre';
        this.el.avatar.style.background = getAvatarBg(this.user);
        this.el.avatarInitials.textContent = initialsOf(this.user.name || this.user.email);

        // Favorites UI
        this.renderFavDropdown();
        this.renderChips();
        // Cards
        this.renderCards();

        authUI.showApp();
      },

      saveUser(next){
        const users = this.users;
        users[this.user.email] = Object.assign({}, this.user, next);
        store.setUsers(users);
        this.user = users[this.user.email];
      },

      /* ---------- Favorites ---------- */
      isFav(id){ return (this.user.favorites || []).includes(id); },
      toggleFav(id){
        const favs = new Set(this.user.favorites || []);
        favs.has(id) ? favs.delete(id) : favs.add(id);
        this.saveUser({ favorites: Array.from(favs) });
        this.renderFavDropdown();
        this.renderChips();
        this.renderCards();
      },

      renderFavDropdown(){
        // kept for compatibility but the UI no longer has a dropdown; this builds a simple list if needed elsewhere
        return SUBJECTS.map(s => ({ id: s.id, name: s.name, checked: this.isFav(s.id) }));
      },

      renderChips(){
        const { chipsRow } = this.el;
        chipsRow.innerHTML = '';
        const favs = this.user.favorites || [];
       
        favs.forEach(id => {
          const subj = SUBJECTS.find(s=>s.id===id);
          if(!subj) return;
          const chip = document.createElement('button');
          chip.className = 'chip starred';
          chip.innerHTML = `⭐ ${subj.name}`;
          chip.addEventListener('click', () => this.renderCards(id));
          chipsRow.appendChild(chip);
        });

      },

      /* ---------- Cards ---------- */
      renderCards(filterById){
        const g = this.el.cardsGrid;
        g.innerHTML = '';
        const q = (this.el.search?.value || '').toLowerCase().trim();

        let list = SUBJECTS.filter(s => (!filterById || s.id === filterById));
        // If the app is in 'only favorites' mode, filter accordingly
        if(this.onlyFavs){ list = list.filter(s => this.isFav(s.id)); }
        if(q){
          list = list.filter(s => s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
        }
        // Orden: favoritos primero
        list.sort((a,b) => {
          const af = this.isFav(a.id) ? 0 : 1;
          const bf = this.isFav(b.id) ? 0 : 1;
          return af - bf || a.name.localeCompare(b.name, 'es');
        });

        if(list.length === 0){
          const empty = document.createElement('div');
          empty.className = 'hint';
          empty.style.padding = '12px';
          empty.textContent = 'No hay resultados con ese filtro.';
          g.appendChild(empty);
          return;
        }

        const tpl = $('#cardTemplate');
        list.forEach(s => {
          const node = tpl.content.firstElementChild.cloneNode(true);
          $('[data-title]', node).textContent = s.name;
          $('[data-desc]', node).textContent = s.desc;
          const icon = $('[data-bg]', node);
          icon.style.background = s.color;

          // ⭐ Botón activo: toggle favorito por card
          const favBtn = $('[data-fav]', node);
          const updateFavVisual = () => { favBtn.textContent = this.isFav(s.id) ? '★' : '☆'; favBtn.classList.toggle('active', this.isFav(s.id)); };
          updateFavVisual();
          favBtn.removeAttribute('disabled');
          favBtn.removeAttribute('aria-disabled');
          favBtn.setAttribute('aria-label', this.isFav(s.id) ? 'Quitar de favoritos' : 'Marcar como favorito');
          favBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleFav(s.id); updateFavVisual(); });

          const detailsBtn = $('[data-details]', node);
          const enterBtn = $('[data-enter]', node);
          detailsBtn.setAttribute('disabled', 'true');
          detailsBtn.setAttribute('aria-disabled', 'true');
          enterBtn.setAttribute('disabled', 'true');
          enterBtn.setAttribute('aria-disabled', 'true');

          // Hover 3D visual
          node.addEventListener('mousemove', (e) => {
            const r = node.getBoundingClientRect();
            const cx = e.clientX - r.left, cy = e.clientY - r.top;
            const rx = ((cy/r.height)-0.5) * -6;
            const ry = ((cx/r.width)-0.5) * 8;
            node.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
          });
          node.addEventListener('mouseleave', () => { node.style.transform = 'rotateX(0) rotateY(0)'; });

          g.appendChild(node);
        });
      },

      /* ---------- Events wiring ---------- */
      wire(){
        // Profile menu
        this.el.profileBtn.addEventListener('click', () => {
          const open = this.el.profileMenu.style.display === 'flex';
          this.el.profileMenu.style.display = open ? 'none' : 'flex';
          this.el.profileBtn.setAttribute('aria-expanded', String(!open));
        });
        document.addEventListener('click', (e) => {
          if(!e.target.closest('.profile')) this.el.profileMenu.style.display = 'none';
        });

        // Edit profile
        this.el.btnEditProfile.addEventListener('click', () => {
          this.el.profileMenu.style.display = 'none';
          // Rellenar
          this.el.p_name.value = this.user?.name || '';
          this.el.p_bio.value = this.user?.bio || '';
          // Pintar swatches + seleccionar actual
          this.renderSwatches();
          const current = getAvatarBg(this.user);
          this.selectColor(current);
          this.el.p_color.value = current;
          modals.open('#profileModal');
        });
        this.el.saveProfile.addEventListener('click', () => {
          const name = this.el.p_name.value.trim();
          const bio = this.el.p_bio.value.trim();
          const avatarColor = this.el.p_color.value;
          this.saveUser({ name, bio, avatarColor }); // guardamos hex
          // Refrescar UI
          this.el.profileName.textContent = this.user.name || 'Tu Nombre';
          this.el.avatar.style.background = getAvatarBg(this.user);
          this.el.avatarInitials.textContent = initialsOf(this.user.name || this.user.email);
          toast('Perfil actualizado');
          modals.close('#profileModal');
        });

        // Logout
        this.el.btnLogout.addEventListener('click', () => {
          store.clearSession();
          toast('Sesión cerrada');
          setTimeout(()=>location.reload(), 400);
        });

        // Filter favorites button (above the grid)
        this.el.filterFavsBtn?.addEventListener('click', () => {
          this.onlyFavs = !this.onlyFavs;
          this.el.filterFavsBtn.setAttribute('aria-pressed', String(this.onlyFavs));
          this.el.filterFavsBtn.classList.toggle('pressed', this.onlyFavs);
          this.renderCards();
        });

        // Theme
        this.el.themeToggle.addEventListener('click', () => {
          const next = (this.user.theme === 'dark') ? 'light' : 'dark';
          this.saveUser({ theme: next });
          document.documentElement.setAttribute('data-theme', next);
        });

        // Search
        this.el.search?.addEventListener('input', () => this.renderCards());
      },

      /* ---------- Swatches helpers ---------- */
      renderSwatches(){
        const box = this.el.p_swatches;
        box.innerHTML = '';
        PRESET_COLORS.forEach(c => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'swatch';
          b.style.background = c;
          b.dataset.color = c;
          b.addEventListener('click', () => {
            this.selectColor(c);
            this.el.p_color.value = c;
          });
          box.appendChild(b);
        });
        // Input color en vivo
        this.el.p_color.addEventListener('input', () => {
          this.selectColor(this.el.p_color.value);
        }, { once: true });
      },

      selectColor(color){
        const sws = Array.from(this.el.p_swatches.querySelectorAll('.swatch'));
        sws.forEach(s => s.classList.toggle('selected', s.dataset.color.toLowerCase() === (color||'').toLowerCase()));
      },
    };

    /** =========================
     *  Forum logic (cards desactivadas por ahora)
     *  ========================= */
    const forum = {
      subject: null,
      open(s){
        this.subject = s;
        $('#forumTitle').textContent = `Foro — ${s.name}`;
        this.renderPosts();
        modals.open('#forumModal');
      },
      renderPosts(){
        const email = app.sessionEmail;
        const posts = store.getPosts(email, this.subject.id);
        const wrap = $('#posts'); wrap.innerHTML = '';
        if(posts.length === 0){
          const ph = document.createElement('div');
          ph.className = 'hint';
          ph.textContent = 'Aún no hay mensajes. ¡Sé el primero!';
          wrap.appendChild(ph);
        } else {
          posts.forEach(p => {
            const item = document.createElement('div');
            item.className = 'post';
            item.innerHTML = `
              <div class="meta">
                <div class="avatar" style="width:22px;height:22px;border-radius:7px;background:${getAvatarBg(app.user)}"></div>
                <strong>${app.user.name}</strong>
                <span>•</span>
                <span>${new Date(p.ts).toLocaleString()}</span>
              </div>
              <div class="text">${escapeHtml(p.text)}</div>
            `;
            wrap.appendChild(item);
          });
        }
      },
      send(){
        const text = ($('#newPost').value || '').trim();
        if(!text){ toast('Escribe un mensaje'); return; }
        const email = app.sessionEmail;
        const list = store.getPosts(email, this.subject.id);
        list.push({ text, ts: Date.now() });
        store.setPosts(email, this.subject.id, list);
        $('#newPost').value = '';
        this.renderPosts();
        toast('Mensaje publicado');
      }
    };

    function escapeHtml(str){
      return str.replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    /** =========================
     *  Modals
     *  ========================= */
    const modals = {
      open(sel){ const m = $(sel); if(!m) return; m.style.display = 'grid'; },
      close(sel){ const m = $(sel); if(!m) return; m.style.display = 'none'; }
    };
    $$('[data-close]').forEach(btn => btn.addEventListener('click', () => {
      const sel = btn.getAttribute('data-close'); modals.close(sel);
    }));
    $('#sendPost').addEventListener('click', ()=> forum.send());

    /** =========================
     *  Start
     *  ========================= */
    app.wire();
    // Medir altura inicial del bloque de forms y garantizar centrado
    authUI.measureInit();
    authUI.setTab('login');

    if(store.getSession()){ app.init(); authUI.showApp(); }
    else { authUI.showAuth(); }