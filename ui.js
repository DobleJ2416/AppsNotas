// ui.js

export function mostrarNotificacion(mensaje) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = mensaje;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300); 
    }, 3000);
}

export function mostrarModal({ titulo, mensaje, tipo = 'confirm', valorInicial = '' }) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        const tituloEl = document.getElementById('modal-titulo');
        const mensajeEl = document.getElementById('modal-mensaje');
        const inputEl = document.getElementById('modal-input');
        
        let btnCancelar = document.getElementById('modal-btn-cancelar');
        let btnConfirmar = document.getElementById('modal-btn-confirmar');
        
        tituloEl.textContent = titulo;
        mensajeEl.textContent = mensaje;
        
        if (tipo === 'prompt') {
            inputEl.style.display = 'block';
            inputEl.value = valorInicial;
            setTimeout(() => inputEl.focus(), 100);
        } else {
            inputEl.style.display = 'none';
        }
        
        overlay.classList.remove('modal-oculto');
        
        const nuevoBtnCancelar = btnCancelar.cloneNode(true);
        const nuevoBtnConfirmar = btnConfirmar.cloneNode(true);
        btnCancelar.replaceWith(nuevoBtnCancelar);
        btnConfirmar.replaceWith(nuevoBtnConfirmar);
        
        const cerrarModal = () => overlay.classList.add('modal-oculto');
        
        nuevoBtnCancelar.addEventListener('click', () => {
            cerrarModal();
            resolve(null);
        });
        
        nuevoBtnConfirmar.addEventListener('click', () => {
            cerrarModal();
            resolve(tipo === 'prompt' ? document.getElementById('modal-input').value : true);
        });
    });
}

export function inicializarTema(btnTemaId) {
    const btnTema = document.getElementById(btnTemaId);
    const temaGuardado = localStorage.getItem('tema');
    
    if (temaGuardado === 'oscuro') {
        document.body.classList.add('dark-mode');
        btnTema.textContent = "☀️ Modo Claro";
    } else {
        btnTema.textContent = "🌙 Modo Oscuro";
    }
    
    btnTema.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        if (document.body.classList.contains('dark-mode')) {
            btnTema.textContent = "☀️ Modo Claro";
            localStorage.setItem('tema', 'oscuro');
        } else {
            btnTema.textContent = "🌙 Modo Oscuro";
            localStorage.setItem('tema', 'claro');
        }
    });
}