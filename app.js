// Este es el corazón de la aplicación.
// Aquí iría toda la lógica de la BD (IndexedDB), manejo de eventos,
// actualización de la UI, y lógica del gráfico.

// (Pseudocódigo y estructura general - la implementación real sería más larga)

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicialización de IndexedDB
    const DB_NAME = 'gastosFamiliaresDB';
    const DB_VERSION = 1;
    let db;

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error('Error al abrir la base de datos:', event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        const objectStore = db.createObjectStore('gastos', { keyPath: 'id', autoIncrement: true });
        objectStore.createIndex('fecha', 'fecha', { unique: false });
        objectStore.createIndex('mesAnio', ['mes', 'anio'], { unique: false });
        console.log('Base de datos creada/actualizada');
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Base de datos abierta correctamente');
        // Cargar datos iniciales o el dashboard
        loadDashboard();
        loadExpenseList(); // Cargar la lista inicial
        populateFilterOptions(); // Rellenar los filtros de mes y año
        renderChart(); // Renderizar el gráfico inicial
    };

    // 2. Elementos del DOM
    const btnNuevoGasto = document.getElementById('btn-nuevo-gasto');
    const formGastoSection = document.getElementById('form-gasto');
    const formRegistroGasto = document.getElementById('form-registro-gasto');
    const btnCancelarGasto = document.getElementById('btn-cancelar-gasto');
    const listaGastosContainer = document.getElementById('lista-gastos-container');
    const filtroMes = document.getElementById('filtro-mes');
    const filtroAnio = document.getElementById('filtro-anio');
    const aplicarFiltroBtn = document.getElementById('aplicar-filtro');
    const resetearFiltroBtn = document.getElementById('resetear-filtro');
    const graficoAnioSelect = document.getElementById('grafico-anio');
    const actualizarGraficoBtn = document.getElementById('actualizar-grafico');
    const myChartCanvas = document.getElementById('myChart');

    // Navegación
    const navDashboardBtn = document.getElementById('nav-dashboard');
    const navListadoBtn = document.getElementById('nav-listado');
    const navGraficoBtn = document.getElementById('nav-grafico');
    const dashboardSection = document.getElementById('dashboard');
    const listadoGastosSection = document.getElementById('listado-gastos');
    const graficoGastosSection = document.getElementById('grafico-gastos');

    // 3. Manejadores de Eventos
    btnNuevoGasto.addEventListener('click', () => {
        showSection(formGastoSection);
    });

    btnCancelarGasto.addEventListener('click', () => {
        formRegistroGasto.reset();
        showSection(dashboardSection);
    });

    formRegistroGasto.addEventListener('submit', (event) => {
        event.preventDefault();
        const fecha = document.getElementById('fecha').value;
        const importe = parseFloat(document.getElementById('importe').value);
        const concepto = document.getElementById('concepto').value;

        if (fecha && importe > 0 && concepto) {
            const dateObj = new Date(fecha);
            const mes = dateObj.getMonth() + 1; // 1-12
            const anio = dateObj.getFullYear();

            const nuevoGasto = { fecha, importe, concepto, mes, anio };
            addGasto(nuevoGasto);
            formRegistroGasto.reset();
            showSection(dashboardSection);
        } else {
            alert('Por favor, rellena todos los campos correctamente.');
        }
    });

    aplicarFiltroBtn.addEventListener('click', loadExpenseList);
    resetearFiltroBtn.addEventListener('click', () => {
        filtroMes.value = '';
        filtroAnio.value = '';
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
            loadDashboard(); // Actualizar el dashboard
            loadExpenseList(); // Actualizar la lista
            populateFilterOptions(); // Actualizar opciones de filtro si hay nuevos años/meses
            renderChart(); // Actualizar el gráfico
        };

        request.onerror = (event) => {
            console.error('Error al añadir gasto:', event.target.errorCode);
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
                <span>${gasto.fecha}</span> -
                <span>${gasto.concepto}</span>:
                <strong>€${gasto.importe.toFixed(2)}</strong>
            `;
            listaGastosContainer.appendChild(li);
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

        // Rellenar select de meses
        filtroMes.innerHTML = '<option value="">Todos</option>';
        meses.forEach(mes => {
            const option = document.createElement('option');
            option.value = mes.value;
            option.textContent = mes.name;
            filtroMes.appendChild(option);
        });
    }

    let myChart; // Variable para la instancia de Chart.js

    async function renderChart() {
        const gastos = await getAllGastos();
        const anioSeleccionado = graficoAnioSelect.value;
        let gastosParaGrafico = gastos;

        if (anioSeleccionado) {
            gastosParaGrafico = gastos.filter(g => g.anio === parseInt(anioSeleccionado));
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
                    label: 'Gastos Totales (€)',
                    data: datosAgrupadosPorMes,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
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