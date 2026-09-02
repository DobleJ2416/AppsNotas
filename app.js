// app.js (Controlador Principal con Enrutamiento Dual)

import { db, storage, auth, provider, signInWithPopup, onAuthStateChanged, signOut, collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, orderBy, deleteDoc, ref, uploadBytes, getDownloadURL } from './firebase.js';
import { mostrarNotificacion, mostrarModal, inicializarTema } from './ui.js';

inicializarTema('btn-tema');

// --- VARIABLES Y DOM ---
let materiaActivaId = null;
let apunteActivoId = null;

const listaMateriasDOM = document.getElementById('lista-materias');
const btnNuevaMateria = document.getElementById('btn-nueva-materia');
const btnNuevoApunte = document.getElementById('btn-nuevo-apunte');
const inputTitulo = document.getElementById('input-titulo');
const btnGuardar = document.getElementById('btn-guardar');
const btnEliminar = document.getElementById('btn-eliminar');
const btnEditarMateria = document.getElementById('btn-editar-materia');
const btnEliminarMateria = document.getElementById('btn-eliminar-materia');
const inputBuscar = document.getElementById('input-buscar-apunte');
const selectOrden = document.getElementById('select-orden-fecha');
const controlesFiltro = document.getElementById('controles-filtro');
const btnExportarPdf = document.getElementById('btn-exportar-pdf');
const listaApuntesDOM = document.getElementById('lista-apuntes');
const btnVolverMovil = document.getElementById('btn-volver-movil');
const loginOverlay = document.getElementById('login-overlay');
const btnLoginLocal = document.getElementById('btn-login-local');
const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLoginSidebar = document.getElementById('btn-login');

// --- HERRAMIENTAS LOCALES (OFFLINE) ---
const getModo = () => localStorage.getItem('modoApp') || 'local';
const leerBDLocal = (tabla) => JSON.parse(localStorage.getItem(tabla)) || [];
const guardarBDLocal = (tabla, datos) => localStorage.setItem(tabla, JSON.stringify(datos));
const generarIdLocal = () => 'loc_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

// --- CONFIGURACIÓN DE QUILL ---
const quill = new Quill('#editor-container', {
    theme: 'snow',
    placeholder: 'Escribe tus apuntes aquí...',
    modules: {
        formula: true,
        toolbar: {
            container: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                ['formula', 'code-block'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['image']
            ],
            handlers: { image: manejadorDeImagenes }
        }
    }
});
quill.enable(false);

async function manejadorDeImagenes() {
    if (getModo() === 'local') {
        mostrarNotificacion("Las imágenes solo están disponibles en modo online");
        return;
    }
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const archivo = input.files[0];
        if (!archivo) return;
        const nombreArchivo = `${Date.now()}_${archivo.name}`;
        const storageRef = ref(storage, `apuntes_imagenes/${nombreArchivo}`);
        try {
            const rango = quill.getSelection();
            await uploadBytes(storageRef, archivo);
            const urlDescarga = await getDownloadURL(storageRef);
            quill.insertEmbed(rango.index, 'image', urlDescarga);
        } catch (error) {
            console.error("Error al subir:", error);
            mostrarNotificacion("Error al subir la imagen.");
        }
    };
}

// --- INTERFAZ (UI) ---
function bloquearEditor() {
    inputTitulo.value = ""; inputTitulo.disabled = true;
    btnGuardar.disabled = true; apunteActivoId = null;
    btnEliminar.style.display = 'none'; btnExportarPdf.style.display = 'none';
    quill.root.innerHTML = ""; quill.enable(false);
    document.body.classList.remove('mobile-editing');
}

function habilitarEditor() {
    inputTitulo.disabled = false; btnGuardar.disabled = false;
    quill.enable(true); btnExportarPdf.style.display = 'inline-block';
    document.body.classList.add('mobile-editing');
}

function procesarFiltros() {
    const textoBusqueda = inputBuscar.value.toLowerCase();
    const orden = selectOrden.value;
    const elementos = Array.from(listaApuntesDOM.children);
    
    elementos.forEach(li => {
        const titulo = li.dataset.titulo || "";
        li.style.display = titulo.includes(textoBusqueda) ? 'block' : 'none';
    });
    
    elementos.sort((a, b) => {
        const fechaA = parseInt(a.dataset.fecha);
        const fechaB = parseInt(b.dataset.fecha);
        return orden === 'desc' ? fechaB - fechaA : fechaA - fechaB;
    });
    
    elementos.forEach(li => listaApuntesDOM.appendChild(li));
}

// --- CONSULTAS DUALES (LECTURA) ---
async function cargarMaterias() {
    listaMateriasDOM.innerHTML = "Cargando materias...";
    let materias = [];

    if (getModo() === 'online') {
        try {
            const usuarioId = auth.currentUser?.uid;
            if(!usuarioId) return;
            const consulta = query(collection(db, "materias"), where("usuario_id", "==", usuarioId));
            const querySnapshot = await getDocs(consulta);
            querySnapshot.forEach(doc => materias.push({ id: doc.id, ...doc.data() }));
        } catch (error) {
            listaMateriasDOM.innerHTML = "<li>Error de conexión.</li>"; return;
        }
    } else {
        materias = leerBDLocal('bd_materias');
    }

    listaMateriasDOM.innerHTML = "";
    if (materias.length === 0) {
        listaMateriasDOM.innerHTML = "<li style='cursor:default; text-align:center; color:#7f8c8d;'>Aún no tienes materias.<br>Agrega una para comenzar.</li>";
        return;
    }

    materias.forEach((materia) => {
        const li = document.createElement('li');
        li.textContent = materia.nombre;
        li.addEventListener('click', () => {
            materiaActivaId = materia.id;
            document.getElementById('titulo-materia-actual').textContent = materia.nombre;
            btnEditarMateria.style.display = 'inline-block';
            btnEliminarMateria.style.display = 'inline-block';
            controlesFiltro.style.display = 'flex';
            btnNuevoApunte.disabled = false;
            bloquearEditor();
            cargarApuntesDeMateria(materia.id);
        });
        listaMateriasDOM.appendChild(li);
    });
}

async function cargarApuntesDeMateria(materiaId) {
    listaApuntesDOM.innerHTML = "Cargando apuntes...";
    let apuntes = [];

    if (getModo() === 'online') {
        try {
            const q = query(collection(db, "apuntes"), where("materia_id", "==", materiaId), orderBy("fecha", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => apuntes.push({ id: doc.id, ...doc.data() }));
        } catch (error) {
            listaApuntesDOM.innerHTML = "<li>Error al cargar.</li>"; return;
        }
    } else {
        const todosLosApuntes = leerBDLocal('bd_apuntes');
        apuntes = todosLosApuntes.filter(a => a.materia_id === materiaId).sort((a, b) => b.fecha - a.fecha);
    }

    listaApuntesDOM.innerHTML = "";
    if (apuntes.length === 0) {
        listaApuntesDOM.innerHTML = "<li style='cursor:default; color:#7f8c8d;'>No hay apuntes en esta materia.</li>";
        bloquearEditor(); return;
    }

    apuntes.forEach((apunte) => {
        const li = document.createElement('li');
        let fechaTexto = "Guardando...";
        let fechaMs = 0;

        if (getModo() === 'online' && apunte.fecha) {
            fechaTexto = apunte.fecha.toDate().toLocaleDateString('es-MX');
            fechaMs = apunte.fecha.toMillis();
        } else if (getModo() === 'local' && apunte.fecha) {
            fechaTexto = new Date(apunte.fecha).toLocaleDateString('es-MX');
            fechaMs = apunte.fecha;
        }

        li.innerHTML = `<strong>${apunte.titulo}</strong><br><small style="color: #7f8c8d;">${fechaTexto}</small>`;
        li.dataset.titulo = apunte.titulo ? apunte.titulo.toLowerCase() : "";
        li.dataset.fecha = fechaMs;

        li.addEventListener('click', () => {
            apunteActivoId = apunte.id;
            habilitarEditor();
            btnEliminar.style.display = 'inline-block';
            inputTitulo.value = apunte.titulo;
            quill.root.innerHTML = apunte.contenido || "";
        });
        listaApuntesDOM.appendChild(li);
    });
}

// --- ESCRITURA DUAL (CRUD) ---
btnNuevaMateria.addEventListener('click', async () => {
    const nombre = await mostrarModal({ titulo: "Nueva Materia", mensaje: "Ingresa el nombre:", tipo: "prompt" });
    if (!nombre || nombre.trim() === "") return;

    if (getModo() === 'online') {
        await addDoc(collection(db, "materias"), { nombre: nombre.trim(), usuario_id: auth.currentUser.uid });
    } else {
        const materias = leerBDLocal('bd_materias');
        materias.push({ id: generarIdLocal(), nombre: nombre.trim() });
        guardarBDLocal('bd_materias', materias);
    }
    mostrarNotificacion("Materia creada");
    cargarMaterias();
});

btnGuardar.addEventListener('click', async () => {
    if (!materiaActivaId || !inputTitulo.value) return mostrarNotificacion("Completa los campos");
    
    btnGuardar.disabled = true; btnGuardar.textContent = "Guardando...";
    
    if (getModo() === 'online') {
        if (apunteActivoId) {
            await updateDoc(doc(db, "apuntes", apunteActivoId), { titulo: inputTitulo.value, contenido: quill.root.innerHTML });
        } else {
            await addDoc(collection(db, "apuntes"), { materia_id: materiaActivaId, titulo: inputTitulo.value, contenido: quill.root.innerHTML, fecha: serverTimestamp(), usuario_id: auth.currentUser.uid });
        }
    } else {
        let apuntes = leerBDLocal('bd_apuntes');
        if (apunteActivoId) {
            const index = apuntes.findIndex(a => a.id === apunteActivoId);
            apuntes[index].titulo = inputTitulo.value;
            apuntes[index].contenido = quill.root.innerHTML;
        } else {
            apuntes.push({ id: generarIdLocal(), materia_id: materiaActivaId, titulo: inputTitulo.value, contenido: quill.root.innerHTML, fecha: Date.now() });
        }
        guardarBDLocal('bd_apuntes', apuntes);
    }

    cargarApuntesDeMateria(materiaActivaId);
    if (!apunteActivoId) { inputTitulo.value = ""; quill.root.innerHTML = ""; } 
    else { mostrarNotificacion("Actualizado"); }
    
    btnGuardar.disabled = false; btnGuardar.textContent = "Guardar Apunte";
});

btnEliminar.addEventListener('click', async () => {
    if (!apunteActivoId) return;
    const confirmar = await mostrarModal({ titulo: "Eliminar", mensaje: "¿Seguro que deseas eliminar este apunte?" });
    if (!confirmar) return;

    if (getModo() === 'online') {
        await deleteDoc(doc(db, "apuntes", apunteActivoId));
    } else {
        let apuntes = leerBDLocal('bd_apuntes');
        guardarBDLocal('bd_apuntes', apuntes.filter(a => a.id !== apunteActivoId));
    }
    mostrarNotificacion("Eliminado");
    bloquearEditor();
    cargarApuntesDeMateria(materiaActivaId);
});

btnEditarMateria.addEventListener('click', async () => {
    if (!materiaActivaId) return;
    const nombreActual = document.getElementById('titulo-materia-actual').textContent;
    const nuevoNombre = await mostrarModal({ titulo: "Editar Materia", mensaje: "Nuevo nombre:", tipo: "prompt", valorInicial: nombreActual });
    if (!nuevoNombre || nuevoNombre.trim() === "" || nuevoNombre === nombreActual) return;

    if (getModo() === 'online') {
        await updateDoc(doc(db, "materias", materiaActivaId), { nombre: nuevoNombre.trim() });
    } else {
        let materias = leerBDLocal('bd_materias');
        const index = materias.findIndex(m => m.id === materiaActivaId);
        materias[index].nombre = nuevoNombre.trim();
        guardarBDLocal('bd_materias', materias);
    }
    document.getElementById('titulo-materia-actual').textContent = nuevoNombre.trim();
    cargarMaterias();
});

btnEliminarMateria.addEventListener('click', async () => {
    if (!materiaActivaId) return;
    const confirmar = await mostrarModal({ titulo: "Eliminar Materia", mensaje: "Se eliminarán TODOS los apuntes. ¿Seguro?", tipo: "confirm" });
    if (!confirmar) return;

    if (getModo() === 'online') {
        const q = query(collection(db, "apuntes"), where("materia_id", "==", materiaActivaId));
        const qs = await getDocs(q);
        await Promise.all(qs.docs.map(d => deleteDoc(doc(db, "apuntes", d.id))));
        await deleteDoc(doc(db, "materias", materiaActivaId));
    } else {
        let materias = leerBDLocal('bd_materias');
        let apuntes = leerBDLocal('bd_apuntes');
        guardarBDLocal('bd_materias', materias.filter(m => m.id !== materiaActivaId));
        guardarBDLocal('bd_apuntes', apuntes.filter(a => a.materia_id !== materiaActivaId));
    }

    document.getElementById('titulo-materia-actual').textContent = "Selecciona una materia";
    btnEditarMateria.style.display = 'none'; btnEliminarMateria.style.display = 'none';
    listaApuntesDOM.innerHTML = ''; materiaActivaId = null; bloquearEditor();
    cargarMaterias(); mostrarNotificacion("Eliminada");
});

// --- EVENTOS SIMPLES ---
btnNuevoApunte.addEventListener('click', () => { apunteActivoId = null; habilitarEditor(); inputTitulo.value = ""; quill.root.innerHTML = ""; inputTitulo.focus(); btnEliminar.style.display = 'none'; });
btnVolverMovil.addEventListener('click', bloquearEditor);
inputBuscar.addEventListener('input', procesarFiltros);
selectOrden.addEventListener('change', procesarFiltros);
btnExportarPdf.addEventListener('click', () => { const original = document.title; document.title = inputTitulo.value || 'Apunte'; window.print(); document.title = original; });

// --- SISTEMA DE LOGIN Y ARRANQUE ---
btnLoginLocal.addEventListener('click', () => {
    localStorage.setItem('modoApp', 'local'); loginOverlay.classList.add('oculto');
    mostrarNotificacion("Modo desconectado activado"); cargarMaterias();
});

btnLoginGoogle.addEventListener('click', async () => {
    try {
        const res = await signInWithPopup(auth, provider);
        localStorage.setItem('modoApp', 'online'); loginOverlay.classList.add('oculto');
        mostrarNotificacion(`¡Bienvenido, ${res.user.displayName}!`);
        cargarMaterias();
    } catch (e) { mostrarNotificacion("Error al iniciar sesión."); }
});

onAuthStateChanged(auth, (usuario) => {
    if (usuario) {
        btnLoginSidebar.innerHTML = `🚪 <span class="texto-oculto-movil">Cerrar Sesión</span>`;
        btnLoginSidebar.onclick = async () => { await signOut(auth); localStorage.removeItem('modoApp'); location.reload(); };
        if (getModo() === 'online') cargarMaterias();
    } else {
        btnLoginSidebar.innerHTML = `👤 <span class="texto-oculto-movil">Ingresar</span>`;
        btnLoginSidebar.onclick = () => { localStorage.removeItem('modoApp'); location.reload(); };
        if (getModo() === 'online') { localStorage.removeItem('modoApp'); location.reload(); }
    }
});

function verificarEstadoApp() {
    const modoApp = localStorage.getItem('modoApp');
    if (modoApp) {
        loginOverlay.classList.add('oculto');
        if (modoApp === 'local') cargarMaterias();
    }
}
verificarEstadoApp();