// Login/Registro — página separada
(function () {
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const ERROR_MESSAGES = {
        1: "No existe ninguna cuenta con ese email.",
        2: "Contraseña incorrecta.",
        11: "Ya existe una cuenta con ese email.",
    };

    // Aplicar tema guardado
    try {
        document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "dark");
    } catch (e) {}

    const ui = {
        pill: $("#switchPill"),
        btnLoginTab: $("#btnLoginTab"),
        btnRegisterTab: $("#btnRegisterTab"),
        loginForm: $("#loginForm"),
        registerForm: $("#registerForm"),
        formsWrap: $("#formsWrap"),
        loginError: $("#loginError"),
        registerError: $("#registerError"),
        setTab(tab) {
            const isLogin = tab === "login";
            this.btnLoginTab.classList.toggle("active", isLogin);
            this.btnRegisterTab.classList.toggle("active", !isLogin);
            this.loginForm.classList.toggle("active", isLogin);
            this.registerForm.classList.toggle("active", !isLogin);
            this.pill.style.transform = isLogin ? "translateX(0)" : "translateX(100%)";
            requestAnimationFrame(() => {
                const active = isLogin ? this.loginForm : this.registerForm;
                this.formsWrap.style.height = active.offsetHeight + "px";
            });
        },
        measureInit() {
            this.formsWrap.style.height = this.loginForm.offsetHeight + "px";
        },
    };

    if (ui.btnLoginTab) ui.btnLoginTab.addEventListener("click", () => ui.setTab("login"));
    if (ui.btnRegisterTab) ui.btnRegisterTab.addEventListener("click", () => ui.setTab("register"));
    window.addEventListener("resize", () => {
        const active = ui.loginForm.classList.contains("active") ? ui.loginForm : ui.registerForm;
        ui.formsWrap.style.height = active.offsetHeight + "px";
    });

    // Mostrar contraseña mientras se mantenga pulsado
    function initPasswordToggles() {
        const addSlash = (svg) => {
            if (!svg) return;
            if (!svg.querySelector("path[data-hide]")) {
                const slash = document.createElementNS("http://www.w3.org/2000/svg", "path");
                slash.setAttribute("d", "M3 3L21 21");
                slash.setAttribute("stroke", "currentColor");
                slash.setAttribute("stroke-width", "2");
                slash.setAttribute("stroke-linecap", "round");
                slash.setAttribute("data-hide", "");
                svg.appendChild(slash);
            }
        };
        const removeSlash = (svg) => {
            if (!svg) return;
            const hideEl = svg.querySelector("path[data-hide]");
            if (hideEl) hideEl.remove();
        };
        const showWhileHold = (btn) => {
            const id = btn.getAttribute("data-pw-toggle");
            const input = document.getElementById(id);
            if (!input) return;
            input.type = "text";
            btn.setAttribute("aria-label", "Ocultar contraseña");
            removeSlash(btn.querySelector("svg"));
            addSlash(btn.querySelector("svg"));
        };
        const hideOnRelease = (btn) => {
            const id = btn.getAttribute("data-pw-toggle");
            const input = document.getElementById(id);
            if (!input) return;
            input.type = "password";
            btn.setAttribute("aria-label", "Mostrar contraseña");
            removeSlash(btn.querySelector("svg"));
        };
        document.querySelectorAll("[data-pw-toggle]")?.forEach((btn) => {
            btn.addEventListener("mousedown", (e) => {
                if (e.button !== 0) return;
                showWhileHold(btn);
            });
            btn.addEventListener("mouseup", () => hideOnRelease(btn));
            btn.addEventListener("mouseleave", () => hideOnRelease(btn));
            btn.addEventListener(
                "touchstart",
                (e) => {
                    e.preventDefault();
                    showWhileHold(btn);
                },
                { passive: false }
            );
            const end = () => hideOnRelease(btn);
            btn.addEventListener("touchend", end);
            btn.addEventListener("touchcancel", end);
            btn.addEventListener("keydown", (e) => {
                if (e.code === "Space" || e.key === " ") {
                    e.preventDefault();
                    showWhileHold(btn);
                }
            });
            btn.addEventListener("keyup", (e) => {
                if (e.code === "Space" || e.key === " ") {
                    hideOnRelease(btn);
                }
            });
        });
    }

    // Submit handlers
    if (ui.loginForm)
        ui.loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            ui.loginError.textContent = "";
            const email = document.getElementById("li_email").value.trim().toLowerCase();
            const pass = document.getElementById("li_pass").value;
            try {
                const response = await fetch("/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password: pass }),
                });
                const data = await response.json();
                if (data.code !== 0) {
                    ui.loginError.textContent = ERROR_MESSAGES[data.code] || "Error de acceso";
                    return;
                }
                // Cookie de sesión ya está puesta: ir a index (foros)
                window.location.href = "/";
            } catch (err) {
                ui.loginError.textContent = "Error al conectar con el servidor.";
            }
        });

    if (ui.registerForm)
        ui.registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            ui.registerError.textContent = "";
            const name = document.getElementById("r_name").value.trim();
            const email = document.getElementById("r_email").value.trim().toLowerCase();
            const pass = document.getElementById("r_pass").value;
            const pass2 = document.getElementById("r_pass2").value;
            const bio = document.getElementById("r_bio").value.trim();
            if (pass.length < 6) {
                ui.registerError.textContent = "La contraseña debe tener al menos 6 caracteres.";
                return;
            }
            if (pass !== pass2) {
                ui.registerError.textContent = "Las contraseñas no coinciden.";
                return;
            }
            try {
                const response = await fetch("/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password: pass, name, bio }),
                });
                const data = await response.json();
                if (data.code !== 0) {
                    ui.registerError.textContent = ERROR_MESSAGES[data.code] || "No se pudo registrar";
                    return;
                }
                window.location.href = "/";
            } catch (err) {
                ui.registerError.textContent = "Error al conectar con el servidor.";
            }
        });

    // Inicialización
    ui.measureInit();
    ui.setTab("login");
    initPasswordToggles();
})();
