// app.js (Controlador Principal)

// 1. Importamos la Base de Datos y la Interfaz Visual
import { db, storage, collection, addDoc, getDocs, query, where, serverTimestamp, doc, updateDoc, orderBy, deleteDoc, ref, uploadBytes, getDownloadURL } from './firebase.js';
import { mostrarNotificacion, mostrarModal, inicializarTema } from './ui.js';

// 2. Inicializamos Componentes Independientes
inicializarTema('btn-tema');

// 3. Variables de Estado Global
let materiaActivaId = null;
let apunteActivoId = null;

// 4. Elementos del DOM
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

// 5. Configuración del Editor Quill
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
                ['image'] // Se agregó el botón nativo de imagen si lo necesitas a futuro
            ],
            handlers: {
                image: manejadorDeImagenes
            }
        }
    }
});
quill.enable(false);

async function manejadorDeImagenes() {
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
            console.error("Error al subir la imagen:", error);
            mostrarNotificacion("Hubo un error al subir la imagen.");
        }
    };
}

// 6. Funciones Lógicas del DOM
function bloquearEditor() {
    inputTitulo.value = "";
    inputTitulo.disabled = true;
    btnGuardar.disabled = true;
    apunteActivoId = null;
    btnEliminar.style.display = 'none';
    btnExportarPdf.style.display = 'none';
    quill.root.innerHTML = "";
    quill.enable(false);

    // Salimos del modo edición en móvil
    document.body.classList.remove('mobile-editing');
}

function habilitarEditor() {
    inputTitulo.disabled = false;
    btnGuardar.disabled = false;
    quill.enable(true);
    btnExportarPdf.style.display = 'inline-block';

    // Entramos al modo edición en móvil
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

// 7. Funciones de Base de Datos (Consultas)
async function cargarMaterias() {
    listaMateriasDOM.innerHTML = "Cargando materias...";
    try {
        const querySnapshot = await getDocs(collection(db, "materias"));
        listaMateriasDOM.innerHTML = "";
        
        if (querySnapshot.empty) {
            listaMateriasDOM.innerHTML = "<li style='cursor:default; text-align:center; color:#7f8c8d;'>Aún no tienes materias.<br>Agrega una para comenzar.</li>";
            return;
        }
        
        querySnapshot.forEach((doc) => {
            const materia = doc.data();
            const li = document.createElement('li');
            li.textContent = materia.nombre;
            
            li.addEventListener('click', () => {
                materiaActivaId = doc.id;
                document.getElementById('titulo-materia-actual').textContent = materia.nombre;
                btnEditarMateria.style.display = 'inline-block';
                btnEliminarMateria.style.display = 'inline-block';
                controlesFiltro.style.display = 'flex';
                btnNuevoApunte.disabled = false;
                bloquearEditor();
                cargarApuntesDeMateria(doc.id);
            });
            listaMateriasDOM.appendChild(li);
        });
    } catch (error) {
        console.error("Error al cargar materias:", error);
        listaMateriasDOM.innerHTML = "<li>Error de conexión.</li>";
    }
}

async function cargarApuntesDeMateria(materiaId) {
    listaApuntesDOM.innerHTML = "Cargando apuntes...";
    try {
        const q = query(collection(db, "apuntes"), where("materia_id", "==", materiaId), orderBy("fecha", "desc"));
        const querySnapshot = await getDocs(q);
        listaApuntesDOM.innerHTML = "";
        
        if (querySnapshot.empty) {
            listaApuntesDOM.innerHTML = "<li style='cursor:default; color:#7f8c8d;'>No hay apuntes en esta materia.</li>";
            bloquearEditor();
            return;
        }
        
        querySnapshot.forEach((documento) => {
            const apunte = documento.data();
            const li = document.createElement('li');
            
            let fechaTexto = "Guardando...";
            if (apunte.fecha) {
                const fechaObj = apunte.fecha.toDate();
                fechaTexto = fechaObj.toLocaleDateString('es-MX');
            }
            
            li.innerHTML = `<strong>${apunte.titulo}</strong><br><small style="color: #7f8c8d;">${fechaTexto}</small>`;
            li.dataset.titulo = apunte.titulo ? apunte.titulo.toLowerCase() : "";
            li.dataset.fecha = apunte.fecha ? apunte.fecha.toMillis() : 0;
            
            li.addEventListener('click', () => {
                apunteActivoId = documento.id;
                habilitarEditor();
                btnEliminar.style.display = 'inline-block';
                inputTitulo.value = apunte.titulo;
                quill.root.innerHTML = apunte.contenido || "";
            });
            listaApuntesDOM.appendChild(li);
        });
    } catch (error) {
        console.error("Error al cargar apuntes:", error);
        listaApuntesDOM.innerHTML = "<li>Error al cargar apuntes.</li>";
    }
}

// 7.5 Sistema de verificación de arranque
function verificarEstadoApp() {
    // Leemos la memoria del navegador para ver si ya tomó una decisión antes
    const modoApp = localStorage.getItem('modoApp');

    if (modoApp) {
        // Ya existe un registro (es su segunda vez o más). Ocultamos la ventana.
        loginOverlay.classList.add('oculto');

        // IMPORTANTE: Solo cargamos la base de datos si ya pasamos la pantalla de bienvenida
        cargarMaterias(); 
    } else {
        // Es la primera vez. La ventana se queda visible y no cargamos datos aún.
    }
}

// 8. Event Listeners (Botones y Acciones)
btnNuevoApunte.addEventListener('click', () => {
    apunteActivoId = null;
    habilitarEditor();
    inputTitulo.value = "";
    quill.root.innerHTML = "";
    inputTitulo.focus();
    btnEliminar.style.display = 'none';
});

btnVolverMovil.addEventListener('click', () => {
    bloquearEditor(); // Esto limpia el editor y nos regresa a las listas
});

btnGuardar.addEventListener('click', async () => {
    if (!materiaActivaId || !inputTitulo.value) {
        mostrarNotificacion("Completa todos los campos");
        return;
    }
    try {
        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";
        if (apunteActivoId) {
            await updateDoc(doc(db, "apuntes", apunteActivoId), {
                titulo: inputTitulo.value,
                contenido: quill.root.innerHTML
            });
        } else {
            await addDoc(collection(db, "apuntes"), {
                materia_id: materiaActivaId,
                titulo: inputTitulo.value,
                contenido: quill.root.innerHTML,
                fecha: serverTimestamp()
            });
        }
        cargarApuntesDeMateria(materiaActivaId);
        if (!apunteActivoId) {
            inputTitulo.value = "";
            quill.root.innerHTML = "";
        } else {
            mostrarNotificacion("Apunte actualizado");
        }
    } catch (error) {
        console.error("Error al guardar:", error);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar Apunte";
    }
});

btnEliminar.addEventListener('click', async () => {
    if (!apunteActivoId) return;
    const confirmar = await mostrarModal({
        titulo: "Eliminar Apunte",
        mensaje: "¿Estás seguro de que deseas eliminar este apunte de forma permanente?"
    });
    if (confirmar) {
        try {
            btnEliminar.disabled = true;
            await deleteDoc(doc(db, "apuntes", apunteActivoId));
            mostrarNotificacion("Apunte eliminado");
            bloquearEditor();
            cargarApuntesDeMateria(materiaActivaId);
        } catch (error) {
            console.error("Error al eliminar:", error);
            mostrarNotificacion("Hubo un error al intentar eliminar el archivo.");
        } finally {
            btnEliminar.disabled = false;
        }
    }
});

btnNuevaMateria.addEventListener('click', async () => {
    const nombreMateria = await mostrarModal({ titulo: "Nueva Materia", mensaje: "Ingresa el nombre:", tipo: "prompt" });
    if (nombreMateria && nombreMateria.trim() !== "") {
        try {
            await addDoc(collection(db, "materias"), { nombre: nombreMateria.trim() });
            mostrarNotificacion("Materia creada con éxito");
            cargarMaterias();
        } catch (error) {
            console.error("Error al agregar materia: ", error);
            mostrarNotificacion("Error al crear la materia");
        }
    }
});

btnEditarMateria.addEventListener('click', async () => {
    if (!materiaActivaId) return;
    const nombreActual = document.getElementById('titulo-materia-actual').textContent;
    const nuevoNombre = await mostrarModal({ titulo: "Editar Materia", mensaje: "Nuevo nombre:", tipo: "prompt", valorInicial: nombreActual });
    if (nuevoNombre && nuevoNombre.trim() !== "" && nuevoNombre !== nombreActual) {
        try {
            btnEditarMateria.disabled = true;
            btnEditarMateria.textContent = "Guardando...";
            await updateDoc(doc(db, "materias", materiaActivaId), { nombre: nuevoNombre.trim() });
            document.getElementById('titulo-materia-actual').textContent = nuevoNombre.trim();
            cargarMaterias();
        } catch (error) {
            console.error("Error al editar materia:", error);
            mostrarNotificacion("Hubo un error al actualizar el nombre.");
        } finally {
            btnEditarMateria.disabled = false;
            btnEditarMateria.textContent = "✏️ Editar Nombre";
        }
    }
});

btnEliminarMateria.addEventListener('click', async () => {
    if (!materiaActivaId) return;
    const confirmar = await mostrarModal({
        titulo: "Eliminar Materia",
        mensaje: "⚠️ Advertencia: Esto eliminará la materia y TODOS los apuntes que contenga. ¿Estás seguro?",
        tipo: "confirm"
    });
    if (confirmar) {
        try {
            btnEliminarMateria.disabled = true;
            btnEliminarMateria.textContent = "Eliminando...";
            
            const q = query(collection(db, "apuntes"), where("materia_id", "==", materiaActivaId));
            const querySnapshot = await getDocs(q);
            const promesasEliminacion = [];
            querySnapshot.forEach((documento) => promesasEliminacion.push(deleteDoc(doc(db, "apuntes", documento.id))));
            
            await Promise.all(promesasEliminacion);
            await deleteDoc(doc(db, "materias", materiaActivaId));
            
            document.getElementById('titulo-materia-actual').textContent = "Selecciona una materia";
            btnEditarMateria.style.display = 'none';
            btnEliminarMateria.style.display = 'none';
            listaApuntesDOM.innerHTML = '';
            materiaActivaId = null;
            bloquearEditor();
            cargarMaterias();
            mostrarNotificacion("Materia y apuntes eliminados correctamente");
        } catch (error) {
            console.error("Error al eliminar la materia:", error);
            mostrarNotificacion("Hubo un error al eliminar la materia");
        } finally {
            btnEliminarMateria.disabled = false;
            btnEliminarMateria.textContent = "🗑️ Eliminar Materia";
        }
    }
});

inputBuscar.addEventListener('input', procesarFiltros);
selectOrden.addEventListener('change', procesarFiltros);

btnExportarPdf.addEventListener('click', () => {
    const tituloOriginal = document.title;
    const nombreArchivo = inputTitulo.value ? inputTitulo.value.trim() : 'Apunte';
    document.title = nombreArchivo;
    window.print();
    document.title = tituloOriginal;
});

// Acción: Elegir el Modo Desconectado
btnLoginLocal.addEventListener('click', () => {
    localStorage.setItem('modoApp', 'local'); // Guardamos la decisión
    loginOverlay.classList.add('oculto');     // Quitamos la ventana
    mostrarNotificacion("Modo desconectado activado");

    cargarMaterias(); // Arrancamos la aplicación
});

// Acción: Elegir iniciar sesión (Dejamos la puerta abierta para el siguiente paso)
btnLoginGoogle.addEventListener('click', () => {
    // Aquí conectaremos Firebase Authentication en el siguiente paso. 
    // Por ahora lo simulamos.
    localStorage.setItem('modoApp', 'online');
    loginOverlay.classList.add('oculto');
    mostrarNotificacion("Iniciando sesión en la nube...");

    cargarMaterias();
});

// 9. Arranque de la App
verificarEstadoApp();