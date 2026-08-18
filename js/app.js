document.addEventListener('DOMContentLoaded', () => {
    // Basic Router
    const mainContent = document.getElementById('main-content');
    const topNav = document.getElementById('top-nav');
    let mapInstance = null;
    let markers = {};
    let ws = null;
    let currentData = null;

    function connectWS() {
        if(ws) return;
        ws = new WebSocket(`ws://${window.location.host}`);
        ws.onmessage = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.type === 'telemetry') {
                currentData = msg.data;
                updateLiveUI(currentData);
            }
        };
    }

    function navigateTo(route) {
        document.querySelectorAll('.nav-link').forEach(link => {
            if(link.dataset.route === route) link.classList.add('active');
            else link.classList.remove('active');
        });

        if (route === 'landing') topNav.classList.add('hidden');
        else { topNav.classList.remove('hidden'); connectWS(); }

        const tpl = document.getElementById(`tpl-${route}`);
        if (tpl) {
            mainContent.innerHTML = '';
            mainContent.appendChild(tpl.content.cloneNode(true));
        } else if (route === 'reports') {
            mainContent.innerHTML = '<div class="page-layout"><p>Reports functionality coming soon...</p></div>';
        }

        if (route === 'landing') {
            document.getElementById('btnOperatorSign').addEventListener('click', () => navigateTo('fleet'));
            document.getElementById('btnEnterControlRoom').addEventListener('click', () => navigateTo('fleet'));
        }
        
        if (route === 'fleet') {
            initFleetView();
            if(currentData) updateLiveUI(currentData);
        }
        if (route === 'analytics') {
            initAnalyticsView();
        }

        setTimeout(() => {
            if (mapInstance && route !== 'fleet') {
                mapInstance = null;
            }
        }, 100);
    }

    function initFleetView() {
        mapInstance = L.map('map', { center: [15.0, 80.0], zoom: 5, zoomControl: false, attributionControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(mapInstance);
        L.control.zoom({ position: 'topleft' }).addTo(mapInstance);

        const closeBtn = document.getElementById('closeWecPanel');
        if(closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('wecPanel').classList.add('hidden');
            });
        }
    }

    function openPanel(c, env) {
        const p = document.getElementById('wecPanel');
        if(!p) return;
        p.classList.remove('hidden');
        document.getElementById('panelWecId').innerText = c.id;
        
        const s = document.getElementById('panelStatus');
        s.innerText = c.status === 'GREEN' ? 'HEALTHY' : (c.status === 'RED' ? 'CRITICAL' : 'WARNING');
        s.className = 'status-badge bg-' + (c.status === 'GREEN' ? 'green' : (c.status === 'RED' ? 'red' : 'orange'));
        
        const d = document.getElementById('panelDamage');
        d.innerText = c.damage || 'None';
        d.className = c.status === 'RED' ? 'text-red' : (c.status === 'YELLOW' ? 'text-orange' : 'text-green');

        document.getElementById('p-batt').innerText = '92%'; 
        document.getElementById('p-rpm').innerText = c.rpm ? c.rpm.toFixed(0) : '--';
        document.getElementById('p-press').innerText = c.hydraulicPressure ? c.hydraulicPressure.toFixed(1) + ' bar' : '--';
        
        if(env) {
            document.getElementById('p-wave').innerText = env.waveHeight.toFixed(1) + ' m';
            document.getElementById('p-period').innerText = env.wavePeriod.toFixed(1) + ' s';
        }

        if(c.agents) {
            document.getElementById('ag-w').innerText = c.agents.wave;
            document.getElementById('ag-h').innerText = c.agents.hydraulics;
            document.getElementById('ag-s').innerText = c.agents.safety;
            document.getElementById('ag-wea').innerText = c.agents.weather;
        }
    }

    function updateLiveUI(data) {
        const route = document.querySelector('.nav-link.active')?.dataset.route;
        if(route !== 'fleet' || !mapInstance) return;

        const listContainer = document.getElementById('fleet-list-container');
        if(listContainer && listContainer.children.length === 0) {
            // First time render list
            data.converters.forEach(conv => {
                const item = document.createElement('div');
                item.className = 'converter-item';
                item.id = 'list-item-' + conv.id;
                listContainer.appendChild(item);
                
                item.addEventListener('click', () => {
                    const latestC = currentData.converters.find(x => x.id === conv.id);
                    openPanel(latestC, currentData.environment);
                });
            });
        }

        let h=0, m=0, c=0;
        data.converters.forEach(conv => {
            if(conv.status === 'GREEN') h++;
            if(conv.status === 'YELLOW') m++;
            if(conv.status === 'RED') c++;

            const item = document.getElementById('list-item-' + conv.id);
            if(item) {
                let dotColor = conv.status === 'GREEN' ? 'var(--color-green)' : (conv.status === 'YELLOW' ? 'var(--color-orange)' : 'var(--color-red)');
                item.innerHTML = `
                    <div class="dot" style="background:${dotColor}"></div>
                    <div class="converter-info">
                        <div class="converter-name">${conv.name}</div>
                        <div class="converter-id">${conv.id} • ${conv.region}</div>
                    </div>
                    <div class="converter-status">${conv.status === 'GREEN' ? 'HEALTHY' : (conv.status === 'YELLOW' ? 'MINOR DAMAGE' : 'CRITICAL DAMAGE')}</div>
                `;
            }

            const color = conv.status === 'GREEN' ? '#10b981' : (conv.status === 'RED' ? '#ef4444' : '#f59e0b');
            const iconHtml = `<div style="width:100%;height:100%;border-radius:50%;background:${color};"></div>`;
            
            if(!markers[conv.id]) {
                const icon = L.divIcon({ className: 'custom-marker', html: iconHtml, iconSize: [14, 14] });
                const marker = L.marker([conv.lat, conv.lng], { icon }).addTo(mapInstance);
                marker.on('click', () => {
                    const latestC = currentData.converters.find(x => x.id === conv.id);
                    openPanel(latestC, currentData.environment);
                });
                markers[conv.id] = marker;
            } else {
                const icon = L.divIcon({ className: 'custom-marker', html: iconHtml, iconSize: [14, 14] });
                markers[conv.id].setIcon(icon);
            }

            const pid = document.getElementById('panelWecId');
            if (pid && pid.innerText === conv.id) {
                openPanel(conv, data.environment);
            }
        });

        const kpiH = document.getElementById('kpi-healthy');
        if(kpiH) {
            kpiH.innerText = h;
            document.getElementById('kpi-minor').innerText = m;
            document.getElementById('kpi-critical').innerText = c;
        }
    }

    function initAnalyticsView() {
        if(!currentData) return;
        const container = document.getElementById('analytics-grid-container');
        if(container) {
            container.innerHTML = '';
            currentData.converters.forEach(conv => {
                const card = document.createElement('div');
                card.className = 'analytics-card';
                card.innerHTML = `<div class="id">${conv.id}</div><div class="name">${conv.name}</div>`;
                container.appendChild(card);
            });
        }
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(e.currentTarget.dataset.route);
        });
    });

    document.getElementById('btnSignOut').addEventListener('click', () => {
        navigateTo('landing');
    });

    setInterval(() => {
        const now = new Date();
        document.getElementById('clock').innerText = now.toISOString().substr(11,8) + ' UTC';
    }, 1000);

    navigateTo('landing');
});
