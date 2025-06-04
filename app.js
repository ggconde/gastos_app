document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización de IndexedDB
    const DB_NAME = 'gastosFamiliaresDB';
    const DB_VERSION = 3; // ¡Incrementa la versión de la BD para asegurar que los cambios se apliquen!
    let db;

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error('Error al abrir la base de datos:', event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        // Si no existe, crear la objectStore y sus índices.
        // Si ya existe (versión anterior), asegurar que el índice 'concepto' exista.
        let objectStore;
        if (!db.objectStoreNames.contains('gastos')) {
            objectStore = db.createObjectStore('gastos', { keyPath: 'id', autoIncrement: true });
        } else {
            objectStore = request.transaction.objectStore('gastos');
        }

        if (!objectStore.indexNames.contains('fecha')) {
            objectStore.createIndex('fecha', 'fecha', { unique: false });
        }
        if (!objectStore.indexNames.contains('mesAnio')) {
            objectStore.createIndex('mesAnio', ['mes', 'anio'], { unique: false });
        }
        if (!objectStore.indexNames.contains('concepto')) { // Nuevo índice
            objectStore.createIndex('concepto', 'concepto', { unique: false });
        }
        console.log('Base de datos creada/actualizada (Versión:', DB_VERSION, ')');
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Base de datos abierta correctamente');
        loadDashboard();
        populateFilterOptions();
        populateConceptFilterOptions(); // Rellenar para el filtro de listado y gráfico
        loadExpenseList(); // Cargar la lista inicial
        renderChart(); // Renderizar el gráfico inicial
    };

    // 2. Elementos del DOM
    const btnNuevoGasto = document.getElementById('btn-nuevo-gasto');
    const formGastoSection = document.getElementById('form-gasto');
    const formRegistroGasto = document.getElementById('form-registro-gasto');
    const btnCancelarGasto = document.getElementById('btn-cancelar-gasto');
    const btnBorrarTodo = document.getElementById('btn-borrar-todo');
    const listaGastosContainer = document.getElementById('lista-gastos-container');
    const filtroMes = document.getElementById('filtro-mes');
    const filtroAnio = document.getElementById('filtro-anio');
    const filtroConceptoListado = document.getElementById('filtro-concepto-listado'); // Nuevo: filtro de concepto para el listado
    const aplicarFiltroBtn = document.getElementById('aplicar-filtro');
    const resetearFiltroBtn = document.getElementById('resetear-filtro');
    const graficoAnioSelect = document.getElementById('grafico-anio');
    const graficoConceptoSelect = document.getElementById('grafico-concepto');
    const actualizarGraficoBtn = document.getElementById('actualizar-grafico');
    const myChartCanvas = document.getElementById('myChart');

    // Campos del formulario de gasto
    const inputFecha = document.getElementById('fecha');
    const inputImporte = document.getElementById('importe');
    const inputConcepto = document.getElementById('concepto-input');
    const selectConcepto = document.getElementById('concepto-select');

    // Navegación
    const navDashboardBtn = document.getElementById('nav-dashboard');
    const navListadoBtn = document.getElementById('nav-listado');
    const navGraficoBtn = document.getElementById('nav-grafico');
    const dashboardSection = document.getElementById('dashboard');
    const listadoGastosSection = document.getElementById('listado-gastos');
    const graficoGastosSection = document.getElementById('grafico-gastos');

    // 3. Manejadores de Eventos
    btnNuevoGasto.addEventListener('click', () => {
        inputFecha.valueAsDate = new Date();
        showSection(formGastoSection);
    });

    btnCancelarGasto.addEventListener('click', () => {
        formRegistroGasto.reset();
        showSection(dashboardSection);
    });

    btnBorrarTodo.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres BORRAR TODOS los gastos? Esta acción es irreversible.')) {
            clearAllGastos();
        }
    });

    formRegistroGasto.addEventListener('submit', (event) => {
        event.preventDefault();
        const fecha = inputFecha.value;
        const importe = parseFloat(inputImporte.value);

        let concepto = inputConcepto.value.trim();
        if (selectConcepto.value !== "") {
            concepto = selectConcepto.value;
        }

        if (fecha && importe > 0 && concepto) {
            const dateObj = new Date(fecha);
            const mes = dateObj.getMonth() + 1;
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
        filtroConceptoListado.value = ''; // Resetear también el filtro de concepto del listado
        loadExpenseList();
    });

    actualizarGraficoBtn.addEventListener('click', renderChart);

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
            populateConceptFilterOptions();
            renderChart();
        };

        request.onerror = (event) => {
            console.error('Error al añadir gasto:', event.target.errorCode);
        };
    }

    function deleteGasto(id) {
        const transaction = db.transaction(['gastos'], 'readwrite');
        const objectStore = transaction.objectStore('gastos');
        const request = objectStore.delete(id);

        request.onsuccess = () => {
            console.log('Gasto borrado con éxito:', id);
            loadDashboard();
            loadExpenseList();
            populateFilterOptions();
            populateConceptFilterOptions();
            renderChart();
        };

        request.onerror = (event) => {
            console.error('Error al borrar gasto:', event.target.errorCode);
        };
    }

    function clearAllGastos() {
        const transaction = db.transaction(['gastos'], 'readwrite');
        const objectStore = transaction.objectStore('gastos');
        const request = objectStore.clear();

        request.onsuccess = () => {
            console.log('Todos los gastos han sido borrados.');
            loadDashboard();
            loadExpenseList();
            populateFilterOptions();
            populateConceptFilterOptions();
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
        const conceptoFiltradoListado = filtroConceptoListado.value; // Nuevo: filtro de concepto para el listado

        let gastosFiltrados = gastos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // Ordenar por fecha descendente

        if (mesFiltrado) {
            gastosFiltrados = gastosFiltrados.filter(g => g.mes === parseInt(mesFiltrado));
        }
        if (anioFiltrado) {
            gastosFiltrados = gastosFiltrados.filter(g => g.anio === parseInt(anioFiltrado));
        }
        if (conceptoFiltradoListado) { // Aplicar filtro de concepto para el listado
            gastosFiltrados = gastosFiltrados.filter(g => g.concepto === conceptoFiltradoListado);
        }

        listaGastosContainer.innerHTML = '';
        if (gastosFiltrados.length === 0) {
            listaGastosContainer.innerHTML = '<p>No hay gastos registrados para los filtros seleccionados.</p>';
            return;
        }

        // Lógica para agrupar por meses si se selecciona "Todos" los meses en un año
        if (mesFiltrado === '' && anioFiltrado !== '') {
            const gastosAgrupadosPorMes = {};
            gastosFiltrados.forEach(gasto => {
                const mesNombre = new Date(gasto.fecha).toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                if (!gastosAgrupadosPorMes[mesNombre]) {
                    gastosAgrupadosPorMes[mesNombre] = [];
                }
                gastosAgrupadosPorMes[mesNombre].push(gasto);
            });

            // Ordenar los meses por fecha
            const mesesOrdenados = Object.keys(gastosAgrupadosPorMes).sort((a, b) => {
                const dateA = new Date(a.split(' ')[1], getMonthNumber(a.split(' ')[0]) -1 );
                const dateB = new Date(b.split(' ')[1], getMonthNumber(b.split(' ')[0]) -1 );
                return dateB - dateA; // Orden descendente
            });

            mesesOrdenados.forEach(mesNombre => {
                const mesHeader = document.createElement('h3');
                mesHeader.textContent = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1); // Capitalizar
                listaGastosContainer.appendChild(mesHeader);

                const ulMes = document.createElement('ul');
                ulMes.style.listStyle = 'none';
                ulMes.style.paddingLeft = '0';
                gastosAgrupadosPorMes[mesNombre].forEach(gasto => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div>
                            <span>${gasto.fecha}</span> -
                            <span>${gasto.concepto}</span>:
                            <strong>€${gasto.importe.toFixed(2)}</strong>
                        </div>
                        <button class="delete-button" data-id="${gasto.id}">Borrar</button>
                    `;
                    ulMes.appendChild(li);
                });
                listaGastosContainer.appendChild(ulMes);
            });
        } else {
            // Mostrar como lista plana si hay filtro de mes o no hay filtro de año
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
        }


        document.querySelectorAll('.delete-button').forEach(button => {
            button.addEventListener('click', (event) => {
                const idToDelete = parseInt(event.target.dataset.id);
                if (confirm('¿Estás seguro de que quieres borrar este gasto?')) {
                    deleteGasto(idToDelete);
                }
            });
        });
    }

    // Helper para obtener el número de mes a partir de su nombre
    function getMonthNumber(monthName) {
        const months = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
            'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
            'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
        };
        return months[monthName.toLowerCase()];
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

        filtroAnio.innerHTML = '<option value="">Todos</option>';
        graficoAnioSelect.innerHTML = '';
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
        if (graficoAnioSelect.value === '' && anios.includes(new Date().getFullYear())) {
            graficoAnioSelect.value = new Date().getFullYear();
        }

        filtroMes.innerHTML = '<option value="">Todos</option>';
        meses.forEach(mes => {
            const option = document.createElement('option');
            option.value = mes.value;
            option.textContent = mes.name;
            filtroMes.appendChild(option);
        });
    }

    async function populateConceptFilterOptions() {
        const gastos = await getAllGastos();
        const conceptos = [...new Set(gastos.map(g => g.concepto))].sort();

        // Rellenar para el filtro de listado
        filtroConceptoListado.innerHTML = '<option value="">Todos</option>';
        conceptos.forEach(concepto => {
            const option = document.createElement('option');
            option.value = concepto;
            option.textContent = concepto;
            filtroConceptoListado.appendChild(option);
        });

        // Rellenar para el filtro del gráfico
        graficoConceptoSelect.innerHTML = '<option value="">Todos</option>';
        conceptos.forEach(concepto => {
            const option = document.createElement('option');
            option.value = concepto;
            option.textContent = concepto;
            graficoConceptoSelect.appendChild(option);
        });
    }


    let myChart; // Variable para la instancia de Chart.js

    // Función para generar colores aleatorios (para las barras apiladas)
    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }

    // Un mapeo de conceptos a colores para consistencia (opcional, pero útil)
    const conceptColors = {};
    function getColorForConcept(concept) {
        if (!conceptColors[concept]) {
            conceptColors[concept] = getRandomColor();
        }
        return conceptColors[concept];
    }


    async function renderChart() {
        const gastos = await getAllGastos();
        const anioSeleccionado = graficoAnioSelect.value;
        const conceptoFiltrado = graficoConceptoSelect.value;

        let gastosParaGrafico = gastos;

        if (anioSeleccionado) {
            gastosParaGrafico = gastosParaGrafico.filter(g => g.anio === parseInt(anioSeleccionado));
        }

        const labels = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        const ctx = myChartCanvas.getContext('2d');

        if (myChart) {
            myChart.destroy();
        }

        // --- Lógica para el gráfico de barras apiladas o simple ---
        if (conceptoFiltrado === '') { // Si "Todos" los conceptos están seleccionados (gráfico apilado)
            const conceptosUnicos = [...new Set(gastosParaGrafico.map(g => g.concepto))].sort();
            const datasets = conceptosUnicos.map(concepto => {
                const data = Array(12).fill(0);
                gastosParaGrafico.filter(g => g.concepto === concepto).forEach(gasto => {
                    data[gasto.mes - 1] += gasto.importe;
                });
                return {
                    label: concepto,
                    data: data,
                    backgroundColor: getColorForConcept(concepto), // Color para cada concepto
                    borderColor: 'rgba(255, 255, 255, 0.8)', // Borde para separar barras
                    borderWidth: 1
                };
            });

            myChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true, // ¡Clave para barras apiladas!
                            title: { display: true, text: 'Mes' }
                        },
                        y: {
                            stacked: true, // ¡Clave para barras apiladas!
                            beginAtZero: true,
                            title: { display: true, text: 'Importe (€)' }
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

        } else { // Si un concepto específico está seleccionado (gráfico simple)
            gastosParaGrafico = gastosParaGrafico.filter(g => g.concepto === conceptoFiltrado);

            const datosAgrupadosPorMes = Array(12).fill(0);
            gastosParaGrafico.forEach(gasto => {
                datosAgrupadosPorMes[gasto.mes - 1] += gasto.importe;
            });

            myChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: `Gastos Totales (€) - ${conceptoFiltrado}`,
                        data: datosAgrupadosPorMes,
                        backgroundColor: 'rgba(75, 192, 192, 0.6)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: { display: true, text: 'Importe (€)' }
                        },
                        x: {
                            title: { display: true, text: 'Mes' }
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
