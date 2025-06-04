document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización de IndexedDB
    const DB_NAME = 'gastosFamiliaresDB';
    const DB_VERSION = 2;
    let db;

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error('Error al abrir la base de datos:', event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        // Si la objectStore 'gastos' ya existe y necesitas cambiarla,
        // deberías borrarla y recrearla (o usar migraciones, más avanzado).
        // Para añadir un índice 'concepto', simplemente lo creamos.
        if (!db.objectStoreNames.contains('gastos')) {
            const objectStore = db.createObjectStore('gastos', { keyPath: 'id', autoIncrement: true });
            objectStore.createIndex('fecha', 'fecha', { unique: false });
            objectStore.createIndex('mesAnio', ['mes', 'anio'], { unique: false });
            objectStore.createIndex('concepto', 'concepto', { unique: false }); // Nuevo índice para el concepto
        } else {
            // Si ya existe, podemos intentar añadir el índice si no lo tiene.
            // Esto es más complejo y requeriría incrementar DB_VERSION para que onupgradeneeded se ejecute de nuevo.
            // Para simplicidad en este ejemplo, si ya existe, asumimos que tiene el índice.
            // Si cambias DB_VERSION a 2, por ejemplo, puedes hacer:
            // const objectStore = request.transaction.objectStore('gastos');
            // if (!objectStore.indexNames.contains('concepto')) {
            //     objectStore.createIndex('concepto', 'concepto', { unique: false });
            // }
        }
        console.log('Base de datos creada/actualizada');
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Base de datos abierta correctamente');
        // Cargar datos iniciales o el dashboard
        loadDashboard();
        loadExpenseList();
        populateFilterOptions();
        populateConceptFilterOptions(); // Nuevo: rellenar opciones de concepto para el gráfico
        renderChart();
    };

    // 2. Elementos del DOM
    const btnNuevoGasto = document.getElementById('btn-nuevo-gasto');
    const formGastoSection = document.getElementById('form-gasto');
    const formRegistroGasto = document.getElementById('form-registro-gasto');
    const btnCancelarGasto = document.getElementById('btn-cancelar-gasto');
    const btnBorrarTodo = document.getElementById('btn-borrar-todo'); // Nuevo botón
    const listaGastosContainer = document.getElementById('lista-gastos-container');
    const filtroMes = document.getElementById('filtro-mes');
    const filtroAnio = document.getElementById('filtro-anio');
    const aplicarFiltroBtn = document.getElementById('aplicar-filtro');
    const resetearFiltroBtn = document.getElementById('resetear-filtro');
    const graficoAnioSelect = document.getElementById('grafico-anio');
    const graficoConceptoSelect = document.getElementById('grafico-concepto'); // Nuevo select de concepto para gráfico
    const actualizarGraficoBtn = document.getElementById('actualizar-grafico');
    const myChartCanvas = document.getElementById('myChart');

    // Campos del formulario de gasto
    const inputFecha = document.getElementById('fecha');
    const inputImporte = document.getElementById('importe');
    const inputConcepto = document.getElementById('concepto-input'); // Campo de texto libre
    const selectConcepto = document.getElementById('concepto-select'); // Select de conceptos por defecto

    // Navegación
    const navDashboardBtn = document.getElementById('nav-dashboard');
    const navListadoBtn = document.getElementById('nav-listado');
    const navGraficoBtn = document.getElementById('nav-grafico');
    const dashboardSection = document.getElementById('dashboard');
    const listadoGastosSection = document.getElementById('listado-gastos');
    const graficoGastosSection = document.getElementById('grafico-gastos');

    // 3. Manejadores de Eventos
    btnNuevoGasto.addEventListener('click', () => {
        // Establecer la fecha actual por defecto en el formulario
        inputFecha.valueAsDate = new Date();
        showSection(formGastoSection);
    });

    btnCancelarGasto.addEventListener('click', () => {
        formRegistroGasto.reset();
        showSection(dashboardSection);
    });

    // Nuevo manejador para borrar todos los gastos
    btnBorrarTodo.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres BORRAR TODOS los gastos? Esta acción es irreversible.')) {
            clearAllGastos();
        }
    });

    formRegistroGasto.addEventListener('submit', (event) => {
        event.preventDefault();
        const fecha = inputFecha.value;
        const importe = parseFloat(inputImporte.value);

        // Lógica para obtener el concepto: preferir el select si se seleccionó uno
        let concepto = inputConcepto.value.trim(); // Concepto del input de texto
        if (selectConcepto.value !== "") { // Si se seleccionó algo en el select
            concepto = selectConcepto.value;
        }

        if (fecha && importe > 0 && concepto) {
            const dateObj = new Date(fecha);
            const mes = dateObj.getMonth() + 1; // 1-12
            const anio = dateObj.getFullYear();

            const nuevoGasto = { fecha, importe, concepto, mes, anio };
            addGasto(nuevoGasto);
            formRegistroGasto.reset();
            showSection(dashboardSection);
        } else {
            alert('Por favor, rellena al menos la fecha, el importe y un concepto válido.');
        }
    });

    aplicarFiltroBtn.addEventListener('click', loadExpenseList);
    resetearFiltroBtn.addEventListener('click', () => {
        filtroMes.value = '';
        filtroAnio.value = '';
        loadExpenseList();
    });

    actualizarGraficoBtn.addEventListener('click', renderChart); // Actualizar gráfico con nuevo filtro de concepto

    navDashboardBtn.addEventListener('click', () => showSection(dashboardSection));
    navListadoBtn.addEventListener('click', () => showSection(listadoGastosSection));
    navGraficoBtn.addEventListener('click', () => showSection(graficoGastosSection));

    // 4. Funciones de la BD (CRUD)
    function addGasto(gasto) {
        const transaction = db.transaction(['gastos'], 'readwrite');
        const objectStore = transaction.objectStore('gastos');
        const request = objectStore.add(gasto);

        request.onsuccess = () => {
            console.log('Gasto añadido con éxito');
            loadDashboard();
            loadExpenseList();
            populateFilterOptions();
            populateConceptFilterOptions(); // Actualizar conceptos para el gráfico
            renderChart();
        };

        request.onerror = (event) => {
            console.error('Error al añadir gasto:', event.target.errorCode);
        };
    }

    // Nuevo: Función para borrar un gasto específico
    function deleteGasto(id) {
        const transaction = db.transaction(['gastos'], 'readwrite');
        const objectStore = transaction.objectStore('gastos');
        const request = objectStore.delete(id);

        request.onsuccess = () => {
            console.log('Gasto borrado con éxito:', id);
            loadDashboard();
            loadExpenseList();
            populateFilterOptions();
            populateConceptFilterOptions(); // Actualizar conceptos para el gráfico
            renderChart();
        };

        request.onerror = (event) => {
            console.error('Error al borrar gasto:', event.target.errorCode);
        };
    }

    // Nuevo: Función para borrar todos los gastos
    function clearAllGastos() {
        const transaction = db.transaction(['gastos'], 'readwrite');
        const objectStore = transaction.objectStore('gastos');
        const request = objectStore.clear();

        request.onsuccess = () => {
            console.log('Todos los gastos han sido borrados.');
            loadDashboard();
            loadExpenseList();
            populateFilterOptions();
            populateConceptFilterOptions(); // Limpiar conceptos para el gráfico
            renderChart();
        };

        request.onerror = (event) => {
            console.error('Error al borrar todos los gastos:', event.target.errorCode);
        };
    }

    function getAllGastos() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['gastos'], 'readonly');
            const objectStore = transaction.objectStore('gastos');
            const request = objectStore.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.errorCode);
            };
        });
    }

    // 5. Funciones para la UI
    function showSection(sectionToShow) {
        document.querySelectorAll('main section').forEach(section => {
            section.classList.add('hidden');
        });
        sectionToShow.classList.remove('hidden');
    }

    async function loadDashboard() {
        const gastos = await getAllGastos();
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        const gastosMesActual = gastos.filter(g => g.mes === currentMonth && g.anio === currentYear);
        const totalMesActual = gastosMesActual.reduce((sum, g) => sum + g.importe, 0);

        document.getElementById('gasto-mes-actual').textContent = `€${totalMesActual.toFixed(2)}`;
    }

    async function loadExpenseList() {
        const gastos = await getAllGastos();
        const mesFiltrado = filtroMes.value;
        const anioFiltrado = filtroAnio.value;

        let gastosFiltrados = gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // Ordenar por fecha descendente

        if (mesFiltrado) {
            gastosFiltrados = gastosFiltrados.filter(g => g.mes === parseInt(mesFiltrado));
        }
        if (anioFiltrado) {
            gastosFiltrados = gastosFiltrados.filter(g => g.anio === parseInt(anioFiltrado));
        }

        listaGastosContainer.innerHTML = '';
        if (gastosFiltrados.length === 0) {
            listaGastosContainer.innerHTML = '<p>No hay gastos registrados para los filtros seleccionados.</p>';
            return;
        }

        gastosFiltrados.forEach(gasto => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <span>${gasto.fecha}</span> -
                    <span>${gasto.concepto}</span>:
                    <strong>€${gasto.importe.toFixed(2)}</strong>
                </div>
                <button class="delete-button" data-id="${gasto.id}">Borrar</button>
            `;
            listaGastosContainer.appendChild(li);
        });

        // Añadir listeners a los nuevos botones de borrado
        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const idToDelete = parseInt(event.target.dataset.id);
                if (confirm('¿Estás seguro de que quieres borrar este gasto?')) {
                    deleteGasto(idToDelete);
                }
            });
        });
    }

    async function populateFilterOptions() {
        const gastos = await getAllGastos();
        const anios = [...new Set(gastos.map(g => g.anio))].sort();
        const meses = [
            { value: 1, name: 'Enero' }, { value: 2, name: 'Febrero' },
            { value: 3, name: 'Marzo' }, { value: 4, name: 'Abril' },
            { value: 5, name: 'Mayo' }, { value: 6, name: 'Junio' },
            { value: 7, name: 'Julio' }, { value: 8, name: 'Agosto' },
            { value: 9, name: 'Septiembre' }, { value: 10, name: 'Octubre' },
            { value: 11, name: 'Noviembre' }, { value: 12, name: 'Diciembre' }
        ];

        // Rellenar select de años para filtros
        filtroAnio.innerHTML = '<option value="">Todos</option>';
        graficoAnioSelect.innerHTML = ''; // Limpiar para el gráfico también
        anios.forEach(anio => {
            const option1 = document.createElement('option');
            option1.value = anio;
            option1.textContent = anio;
            filtroAnio.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = anio;
            option2.textContent = anio;
            graficoAnioSelect.appendChild(option2);
        });
        // Seleccionar el año actual por defecto en el gráfico si existe
        if (graficoAnioSelect.value === '' && anios.includes(new Date().getFullYear())) {
            graficoAnioSelect.value = new Date().getFullYear();
        }


        // Rellenar select de meses
        filtroMes.innerHTML = '<option value="">Todos</option>';
        meses.forEach(mes => {
            const option = document.createElement('option');
            option.value = mes.value;
            option.textContent = mes.name;
            filtroMes.appendChild(option);
        });
    }

    // Nuevo: Función para rellenar opciones de concepto para el filtro del gráfico
    async function populateConceptFilterOptions() {
        const gastos = await getAllGastos();
        const conceptos = [...new Set(gastos.map(g => g.concepto))].sort();

        graficoConceptoSelect.innerHTML = '<option value="">Todos</option>';
        conceptos.forEach(concepto => {
            const option = document.createElement('option');
            option.value = concepto;
            option.textContent = concepto;
            graficoConceptoSelect.appendChild(option);
        });
    }


    let myChart; // Variable para la instancia de Chart.js

    async function renderChart() {
        const gastos = await getAllGastos();
        const anioSeleccionado = graficoAnioSelect.value;
        const conceptoFiltrado = graficoConceptoSelect.value; // Nuevo filtro por concepto

        let gastosParaGrafico = gastos;

        if (anioSeleccionado) {
            gastosParaGrafico = gastosParaGrafico.filter(g => g.anio === parseInt(anioSeleccionado));
        }
        if (conceptoFiltrado) { // Aplicar filtro de concepto si está seleccionado
            gastosParaGrafico = gastosParaGrafico.filter(g => g.concepto === conceptoFiltrado);
        }


        const datosAgrupadosPorMes = Array(12).fill(0); // Para los 12 meses
        gastosParaGrafico.forEach(gasto => {
            datosAgrupadosPorMes[gasto.mes - 1] += gasto.importe;
        });

        const labels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const ctx = myChartCanvas.getContext('2d');

        if (myChart) {
            myChart.destroy(); // Destruir la instancia anterior del gráfico
        }

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: `Gastos Totales (€) ${conceptoFiltrado ? ' - ' + conceptoFiltrado : ''}`, // Etiqueta dinámica
                    data: datosAgrupadosPorMes,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Permitir que el gráfico no mantenga siempre la misma proporción
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Importe (€)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Mes'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    // 6. Registro del Service Worker (para PWA)
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrado con éxito:', registration.scope);
                })
                .catch(error => {
                    console.error('Fallo al registrar Service Worker:', error);
                });
        });
    }
});
