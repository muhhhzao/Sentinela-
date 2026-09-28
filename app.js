// ========================
// STATE
// ========================
const state = {
  config: {
    lat: -23.5505,
    lon: -46.6333,
    city: 'São Paulo, SP',
    inmetKey: ''
  },
  data: null,
  demoMode: false,
  currentTab: 'radar',
  updateInterval: null,
  windDirection: 0,
  hourlyForecast: [],
  radarFrame: 0,
  radarInterval: null,
  chartData: {
    precip: Array(24).fill(0),
    wind:   Array(24).fill(0),
    temp:   Array(24).fill(null),
    labels: Array(24).fill('--')
  }
};

// ========================
// CHART INSTANCES
// ========================
let precipChartInst = null;
let windChartInst   = null;
let tempChartInst   = null;

// ========================
// CLOCK
// ========================
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('pt-BR', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ========================
// MODAL
// ========================
function openModal() {
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('latInput').value   = state.config.lat;
  document.getElementById('lonInput').value   = state.config.lon;
  document.getElementById('cityInput').value  = state.config.city;
  document.getElementById('inmetKey').value   = state.config.inmetKey;
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

document.getElementById('modalOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ========================
// GEOCODING
// ========================
async function geocodeCity() {
  const q = document.getElementById('citySearch').value.trim();
  if (!q) return;

  showNotif('Buscando cidade...', 'info');

  try {
    const res  = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=pt&format=json`
    );
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const r     = data.results[0];
      const label = [r.name, r.admin1, r.country_code].filter(Boolean).join(', ');

      document.getElementById('latInput').value  = r.latitude.toFixed(4);
      document.getElementById('lonInput').value  = r.longitude.toFixed(4);
      document.getElementById('cityInput').value = label;

      showNotif(`Encontrado: ${label}`, 'ok');
    } else {
      showNotif('Cidade não encontrada', 'warn');
    }
  } catch (e) {
    showNotif('Erro na geocodificação', 'danger');
  }
}

document.getElementById('citySearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') geocodeCity();
});

// ========================
// SEARCH LOCATION (barra principal)
// ========================
async function searchLocation() {
  const q = document.getElementById('searchCity').value.trim();
  if (!q) return;

  showNotif('Buscando...', 'info');

  try {
    const res  = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=pt&format=json`
    );
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const r = data.results[0];

      state.config.lat  = r.latitude;
      state.config.lon  = r.longitude;
      state.config.city = [r.name, r.admin1, r.country_code].filter(Boolean).join(', ');

      state.demoMode = false;
      document.getElementById('searchCity').value = '';

      showNotif(`Monitorando: ${state.config.city}`, 'ok');
      fetchOpenMeteo();

      if (state.updateInterval) clearInterval(state.updateInterval);
      state.updateInterval = setInterval(fetchOpenMeteo, 600000);
    } else {
      showNotif('Cidade não encontrada', 'warn');
    }
  } catch (e) {
    showNotif('Erro na busca', 'danger');
  }
}

document.getElementById('searchCity').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchLocation();
});

// ========================
// SAVE CONFIG
// ========================
function saveConfig() {
  state.config.lat     = parseFloat(document.getElementById('latInput').value)  || -23.5505;
  state.config.lon     = parseFloat(document.getElementById('lonInput').value)  || -46.6333;
  state.config.city    = document.getElementById('cityInput').value.trim()       || 'São Paulo, SP';
  state.config.inmetKey = document.getElementById('inmetKey').value.trim();
  state.demoMode       = false;

  closeModal();
  fetchOpenMeteo();

  if (state.updateInterval) clearInterval(state.updateInterval);
  state.updateInterval = setInterval(fetchOpenMeteo, 600000);
}

// ========================
// NOTIFICATION
// ========================
function showNotif(msg, type = 'info') {
  const stack = document.getElementById('notifStack');
  const notif = document.createElement('div');
  notif.className   = `notif ${type}`;
  notif.textContent = msg;
  stack.appendChild(notif);

  setTimeout(() => {
    notif.style.opacity = '0';
    setTimeout(() => notif.remove(), 300);
  }, 4000);
}

// ========================
// LOADING
// ========================
function showLoading(show) {
  const el = document.getElementById('statusLoading');
  if (!el) return;
  show ? el.classList.remove('hidden') : el.classList.add('hidden');
}

// ========================
// FETCH OPEN-METEO
// ========================
async function fetchOpenMeteo() {
  showLoading(true);

  const { lat, lon } = state.config;
  const url = `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,` +
    `precipitation,weather_code,wind_speed_10m,wind_direction_10m,` +
    `wind_gusts_10m,surface_pressure,visibility` +
    `&hourly=temperature_2m,precipitation,wind_speed_10m,weather_code` +
    `&timezone=America%2FSao_Paulo` +
    `&forecast_days=2`;

  try {
    const res  = await fetch(url);
    const data = await res.json();

    state.data = data;
    state.demoMode = false;

    processWeatherData(data);
    showNotif('Dados atualizados', 'OK');
  } catch (e) {
    showNotif('Erro ao buscar dados — verifique a conexão', 'danger');
    showLoading(false);
  }
}

// ========================
// PROCESS WEATHER DATA
// ========================
function processWeatherData(data) {
  const c = data.current;

  // Preenche estado
  state.windDirection  = c.wind_direction_10m || 0;
  state.hourlyForecast = buildHourlyForecast(data);
  state.chartData      = buildChartData(data);

  updateDashboard(c);
  updateAlerts(c);
  updateRiskLevel(c);
  updateForecastStrip();
  renderCharts();
  updateRadar();

  showLoading(false);
  document.getElementById('dataSource').textContent = `FONTE: OPEN-METEO — ${state.config.city}`;
}

// ========================
// UPDATE DASHBOARD
// ========================
function updateDashboard(c) {
  const wmo = getWMOInfo(c.weather_code);

  document.getElementById('condIcon').textContent        = wmo.icon;
  document.getElementById('condName').textContent        = wmo.name;
  document.getElementById('condDesc').textContent        = wmo.desc;
  document.getElementById('tempVal').textContent         = `${Math.round(c.temperature_2m)}°C`;
  document.getElementById('humVal').textContent          = `${c.relative_humidity_2m}%`;
  document.getElementById('windVal').textContent         = `${Math.round(c.wind_speed_10m)} km/h`;
  document.getElementById('gustVal').textContent         = `${Math.round(c.wind_gusts_10m || c.wind_speed_10m)} km/h`;
  document.getElementById('rainVal').textContent         = `${(c.precipitation || 0).toFixed(1)} mm`;
  document.getElementById('pressVal').textContent        = `${Math.round(c.surface_pressure || 1013)} hPa`;
  document.getElementById('visVal').textContent          = `${((c.visibility || 10000) / 1000).toFixed(1)} km`;
  document.getElementById('regionVal').textContent       = state.config.city;
  document.getElementById('radarTime').textContent       = `ULT. ATUALIZAÇÃO: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  // big chart values
  document.getElementById('precipBig').textContent       = (c.precipitation || 0).toFixed(1);
  document.getElementById('windBig').textContent         = Math.round(c.wind_speed_10m);
  document.getElementById('tempBig').textContent         = Math.round(c.temperature_2m);

  // compass
  updateCompass(c.wind_direction_10m || 0);
}

// ========================
// COMPASS
// ========================
function updateCompass(deg) {
  state.windDirection = deg;
  const arrow = document.getElementById('compassArrow');
  if (arrow) {
    arrow.style.transform = `translateX(-50%) translateY(-100%) rotate(${deg}deg)`;
  }
  const label = document.getElementById('windDirLabel');
  if (label) {
    label.textContent = `${deg}° — ${degToCardinal(deg)}`;
  }
}

function degToCardinal(deg) {
  const dirs = ['N','NNE','NE','ENE','L','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];
  return dirs[Math.round(deg / 22.5) % 16];
}


function getWMOInfo(code) {
  const map = {
    0:  { icon: '☀️',  name: 'CÉU LIMPO',       desc: 'Sem nuvens' },
    1:  { icon: '🌤',  name: 'LIMPO',             desc: 'Principalmente limpo' },
    2:  { icon: '⛅',  name: 'PARCIALMENTE NUBLADO', desc: 'Nuvens parciais' },
    3:  { icon: '☁️',  name: 'NUBLADO',           desc: 'Cobertura total' },
    45: { icon: '🌫',  name: 'NEBLINA',           desc: 'Visibilidade reduzida' },
    48: { icon: '🌫',  name: 'GEADA NEBULOSA',    desc: 'Névoa com geada' },
    51: { icon: '🌦',  name: 'GAROA LEVE',        desc: 'Garoa fraca' },
    53: { icon: '🌦',  name: 'GAROA',             desc: 'Garoa moderada' },
    55: { icon: '🌧',  name: 'GAROA INTENSA',     desc: 'Garoa densa' },
    61: { icon: '🌧',  name: 'CHUVA LEVE',        desc: 'Precipitação fraca' },
    63: { icon: '🌧',  name: 'CHUVA',             desc: 'Precipitação moderada' },
    65: { icon: '🌧',  name: 'CHUVA FORTE',       desc: 'Precipitação intensa' },
    71: { icon: '🌨',  name: 'NEVE LEVE',         desc: 'Queda de neve fraca' },
    73: { icon: '🌨',  name: 'NEVE',              desc: 'Queda de neve' },
    75: { icon: '❄️',  name: 'NEVE INTENSA',      desc: 'Queda de neve forte' },
    77: { icon: '🌨',  name: 'GRÃOS DE NEVE',     desc: 'Precipitação granular' },
    80: { icon: '🌦',  name: 'PANCADAS LEVES',    desc: 'Chuva de pancadas' },
    81: { icon: '⛈',  name: 'PANCADAS',          desc: 'Chuva moderada de pancadas' },
    82: { icon: '⛈',  name: 'PANCADAS FORTES',   desc: 'Chuva forte de pancadas' },
    85: { icon: '🌨',  name: 'PANCADAS DE NEVE',  desc: 'Neve em pancadas' },
    86: { icon: '❄️',  name: 'NEVE EM PANCADAS',  desc: 'Neve intensa em pancadas' },
    95: { icon: '⛈',  name: 'TEMPESTADE',        desc: 'Trovoadas e relâmpagos' },
    96: { icon: '⛈',  name: 'TEMPESTADE C/ GRANIZO', desc: 'Trovoadas com granizo' },
    99: { icon: '🌩',  name: 'TEMPESTADE SEVERA', desc: 'Granizo intenso' }
  };
  return map[code] || { icon: '🌡', name: 'DADO INDISPONÍVEL', desc: `Código ${code}` };
}

// ========================
// BUILD HOURLY FORECAST
// ========================
function buildHourlyForecast(data) {
  const h   = data.hourly;
  const now = new Date();
  const result = [];

  for (let i = 0; i < Math.min(h.time.length, 48); i++) {
    const t = new Date(h.time[i]);
    if (t < now) continue;
    if (result.length >= 24) break;

    result.push({
      time:  t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      temp:  Math.round(h.temperature_2m[i]),
      rain:  (h.precipitation[i] || 0).toFixed(1),
      wind:  Math.round(h.wind_speed_10m[i]),
      code:  h.weather_code[i]
    });
  }
  return result;
}


function buildChartData(data) {
  const h      = data.hourly;
  const now    = new Date();
  const precip = [], wind = [], temp = [], labels = [];
  let count = 0;

  for (let i = 0; i < h.time.length && count < 24; i++) {
    const t = new Date(h.time[i]);
    if (t < now) continue;
    precip.push(h.precipitation[i]  || 0);
    wind.push(h.wind_speed_10m[i]   || 0);
    temp.push(h.temperature_2m[i]   ?? null);
    labels.push(t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    count++;
  }

  return { precip, wind, temp, labels };
}


function updateAlerts(c) {
  const container = document.getElementById('alertsContainer');
  const alerts    = [];

  if (c.wind_gusts_10m >= 80) {
    alerts.push({ level: 'danger', title: 'RAJADAS EXTREMAS', desc: `Rajadas de ${Math.round(c.wind_gusts_10m)} km/h detectadas. Risco de danos.` });
  } else if (c.wind_gusts_10m >= 50) {
    alerts.push({ level: 'warn',   title: 'VENTO FORTE',     desc: `Rajadas de ${Math.round(c.wind_gusts_10m)} km/h. Atenção.` });
  }

  if (c.precipitation >= 20) {
    alerts.push({ level: 'danger', title: 'CHUVA INTENSA',   desc: `${c.precipitation.toFixed(1)} mm/h — Risco de alagamentos.` });
  } else if (c.precipitation >= 5) {
    alerts.push({ level: 'warn',   title: 'CHUVA MODERADA',  desc: `${c.precipitation.toFixed(1)} mm/h em curso.` });
  }

  const wc = c.weather_code;
  if (wc >= 95) {
    alerts.push({ level: 'danger', title: 'TEMPESTADE ATIVA', desc: 'Trovoadas com relâmpagos e granizo possível.' });
  }

  if (c.temperature_2m >= 40) {
    alerts.push({ level: 'danger', title: 'CALOR EXTREMO',   desc: `${Math.round(c.temperature_2m)}°C — Risco à saúde.` });
  } else if (c.temperature_2m <= 5) {
    alerts.push({ level: 'warn',   title: 'FRIO INTENSO',    desc: `${Math.round(c.temperature_2m)}°C — Risco de hipotermia.` });
  }

  if ((c.visibility || 10000) < 1000) {
    alerts.push({ level: 'warn',   title: 'NEBLINA DENSA',   desc: `Visibilidade: ${((c.visibility||0)/1000).toFixed(1)} km.` });
  }

  // Banner
  const banner = document.getElementById('alertBanner');
  if (alerts.length > 0) {
    const top = alerts[0];
    banner.classList.add('active');
    document.getElementById('alertText').textContent       = top.title.replace(/^\S+\s/, '');
    document.getElementById('alertLevelBadge').textContent = top.level === 'danger' ? 'NÍVEL 3' : 'NÍVEL 2';
  } else {
    banner.classList.remove('active');
  }

  // Cards
  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="alert-card ok">
        <div class="alert-card-title" style="color:var(--ok)">✅ SEM ALERTAS ATIVOS</div>
        <div class="alert-card-desc">Condições normais para ${state.config.city}.</div>
        <div class="alert-card-time">${new Date().toLocaleString('pt-BR')}</div>
      </div>`;
  } else {
    container.innerHTML = alerts.map(a => `
      <div class="alert-card ${a.level}">
        <div class="alert-card-title" style="color:var(--${a.level})">${a.title}</div>
        <div class="alert-card-desc">${a.desc}</div>
        <div class="alert-card-time">${new Date().toLocaleString('pt-BR')}</div>
      </div>`).join('');
  }

  // Histórico
  const hist = document.getElementById('historyContainer');
  const now  = new Date();
  hist.innerHTML = Array.from({ length: 5 }, (_, i) => {
    const t = new Date(now - (i + 1) * 3600000);
    return `${t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — Sem eventos registrados`;
  }).join('<br>');
}


function updateRiskLevel(c) {
  let risk = 0;

  risk += Math.min(40, (c.precipitation || 0) * 2);
  risk += Math.min(25, ((c.wind_gusts_10m || 0) - 30) * 0.5);
  const wc = c.weather_code;
  if (wc >= 95) risk += 30;
  else if (wc >= 80) risk += 15;
  else if (wc >= 61) risk += 8;

  risk = Math.min(100, Math.max(0, Math.round(risk)));

  const color  = risk >= 70 ? 'var(--danger)' : risk >= 40 ? 'var(--warn)' : 'var(--ok)';
  const label  = risk >= 70 ? 'ALTO RISCO' : risk >= 40 ? 'RISCO MODERADO' : 'BAIXO RISCO';

  document.getElementById('riskValue').textContent    = risk;
  document.getElementById('riskValue').style.color    = color;
  document.getElementById('riskLabel').textContent    = label;
  document.getElementById('riskLabel').style.color    = color;
  document.getElementById('riskBarFill').style.width  = `${risk}%`;
  document.getElementById('riskBarFill').style.background = color;
}


function updateForecastStrip() {
  const strip = document.getElementById('forecastStrip');

  if (!state.hourlyForecast.length) {
    strip.innerHTML = `<div style="padding:20px;font-family:var(--font-mono);font-size:11px;color:var(--muted)">Sem dados de previsão</div>`;
    return;
  }

  strip.innerHTML = state.hourlyForecast.map((h, i) => {
    const wmo = getWMOInfo(h.code);
    return `
      <div class="forecast-item ${i === 0 ? 'active' : ''}">
        <div class="forecast-time">${h.time}</div>
        <div class="forecast-icon">${wmo.icon}</div>
        <div class="forecast-temp">${h.temp}°</div>
        <div class="forecast-rain">${h.rain}mm</div>
        <div class="forecast-wind">${h.wind}km/h</div>
      </div>`;
  }).join('');
}

// ========================
// CHARTS
// ========================
function renderCharts() {
  const { precip, wind, temp, labels } = state.chartData;

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: false, beginAtZero: true }
    },
    elements: { point: { radius: 0 } },
    animation: { duration: 600 }
  };

  // Precipitação
  const precipCtx = document.getElementById('precipChart').getContext('2d');
  if (precipChartInst) precipChartInst.destroy();
  precipChartInst = new Chart(precipCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: precip,
        backgroundColor: 'rgba(0,212,255,0.4)',
        borderColor: 'rgba(0,212,255,0.8)',
        borderWidth: 1
      }]
    },
    options: { ...baseOpts, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } }
  });

  // Tendências
  const maxPrecip = Math.max(...precip.slice(0, 6));
  const avgPrecip = precip.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  document.getElementById('precipTrend').textContent = maxPrecip > 5 ? '▲ aumentando' : avgPrecip > 0.5 ? '→ estável' : '▼ diminuindo';

  // Vento
  const windCtx = document.getElementById('windChart').getContext('2d');
  if (windChartInst) windChartInst.destroy();
  windChartInst = new Chart(windCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: wind,
        borderColor: 'rgba(255,107,53,0.8)',
        backgroundColor: 'rgba(255,107,53,0.1)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.4
      }]
    },
    options: baseOpts
  });

  const avgWindFirst = wind.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  const avgWindLast  = wind.slice(-4).reduce((a, b) => a + b, 0) / 4;
  document.getElementById('windTrend').textContent = avgWindLast > avgWindFirst + 5 ? '▲ aumentando' : avgWindLast < avgWindFirst - 5 ? '▼ diminuindo' : '→ estável';
  document.getElementById('windTrend').style.color = avgWindLast > avgWindFirst + 10 ? 'var(--danger)' : 'var(--ok)';

  // Temperatura
  const tempCtx = document.getElementById('tempChart').getContext('2d');
  if (tempChartInst) tempChartInst.destroy();
  tempChartInst = new Chart(tempCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: temp,
        borderColor: 'rgba(255,214,10,0.8)',
        backgroundColor: 'rgba(255,214,10,0.08)',
        borderWidth: 1.5,
        fill: true,
        tension: 0.4
      }]
    },
    options: baseOpts
  });

  const tFirst = temp[0] || 0;
  const tLast  = temp[temp.length - 1] || 0;
  document.getElementById('tempTrend').textContent = tLast > tFirst + 2 ? '▲ subindo' : tLast < tFirst - 2 ? '▼ caindo' : '→ estável';
  document.getElementById('tempTrend').style.color = tLast > 35 ? 'var(--danger)' : tLast < 10 ? 'var(--accent)' : 'var(--ok)';
}


function updateRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth  || 400;
  canvas.height = canvas.offsetHeight || 220;

  drawRadarFrame(ctx, canvas.width, canvas.height);

  if (state.radarInterval) clearInterval(state.radarInterval);
  state.radarFrame = 0;
  state.radarInterval = setInterval(() => {
    state.radarFrame++;
    drawRadarFrame(ctx, canvas.width, canvas.height);
  }, 1200);
}

function drawRadarFrame(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);

  // fundo
  ctx.fillStyle = '#040c14';
  ctx.fillRect(0, 0, w, h);

  // grade
  ctx.strokeStyle = 'rgba(26,48,69,0.6)';
  ctx.lineWidth   = 0.5;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const cx = w / 2, cy = h / 2;
  [40, 80, 120].forEach(r => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,212,255,0.12)';
    ctx.lineWidth   = 1;
    ctx.stroke();
  });

  const data = state.data?.current;
  if (data) {
    const precip = data.precipitation || 0;
    const wc     = data.weather_code  || 0;

    if (precip > 0 || wc >= 51) {
      const intensity = Math.min(1, precip / 20);
      const frame     = state.radarFrame;

      const blobs = [
        { x: cx - 30 + Math.sin(frame * 0.05) * 5, y: cy + 20 + Math.cos(frame * 0.04) * 5, r: 35 + intensity * 25, alpha: 0.25 + intensity * 0.3 },
        { x: cx + 40 + Math.sin(frame * 0.03) * 8, y: cy - 30 + Math.cos(frame * 0.05) * 6, r: 25 + intensity * 15, alpha: 0.15 + intensity * 0.2 },
        { x: cx - 60 + Math.sin(frame * 0.04) * 6, y: cy - 10 + Math.cos(frame * 0.03) * 8, r: 20 + intensity * 12, alpha: 0.12 + intensity * 0.15 }
      ];

      const color = wc >= 95 ? [255, 51, 85] : wc >= 80 ? [255, 107, 53] : wc >= 61 ? [255, 214, 10] : [0, 255, 136];

      blobs.forEach(b => {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(0,   `rgba(${color.join(',')},${b.alpha})`);
        g.addColorStop(0.6, `rgba(${color.join(',')},${b.alpha * 0.4})`);
        g.addColorStop(1,   `rgba(${color.join(',')},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  // varredura do radar
  const angle = ((state.radarFrame * 6) % 360) * (Math.PI / 180);
  const sweep = ctx.createConicalGradient
    ? null
    : null;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(0, 0, 130, 0);
  g.addColorStop(0,   'rgba(0,212,255,0.35)');
  g.addColorStop(0.3, 'rgba(0,212,255,0.08)');
  g.addColorStop(1,   'rgba(0,212,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 130, -Math.PI / 8, Math.PI / 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // centro
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'var(--accent)';
  ctx.fill();
  ctx.shadowBlur  = 8;
  ctx.shadowColor = '#00d4ff';
  ctx.fill();
  ctx.shadowBlur  = 0;

  // título do radar
  updateRadarTitle();
}

function updateRadarTitle() {
  const titleEl = document.getElementById('radarTitle');
  if (!titleEl) return;

  const c  = state.data?.current;
  if (!c) return;

  const wc = c.weather_code || 0;
  if (wc >= 95)      titleEl.textContent = 'TEMPESTADE DETECTADA';
  else if (wc >= 80) titleEl.textContent = 'PANCADAS EM CURSO';
  else if (wc >= 61) titleEl.textContent = 'CHUVA EM CURSO';
  else if (wc >= 51) titleEl.textContent = 'GAROA DETECTADA';
  else               titleEl.textContent = `SEM PRECIPITAÇÃO — ${state.config.city}`;
}

// ========================
// SWITCH TABS
// ========================
function switchTab(tab, el) {
  state.currentTab = tab;

  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');

  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth  || 400;
  canvas.height = canvas.offsetHeight || 220;

  if (state.radarInterval) clearInterval(state.radarInterval);

  const tabLabels = {
    radar:        'RADAR DE PRECIPITAÇÃO',
    precipitacao: 'ACUMULADO DE CHUVA',
    vento:        'CAMPO DE VENTO',
    temperatura:  'CAMPO DE TEMPERATURA'
  };

  document.getElementById('radarTitle').textContent = tabLabels[tab] || '';

  drawStaticLayer(ctx, canvas.width, canvas.height, tab);

  state.radarInterval = setInterval(() => {
    state.radarFrame++;
    if (tab === 'radar') {
      drawRadarFrame(ctx, canvas.width, canvas.height);
    } else {
      drawStaticLayer(ctx, canvas.width, canvas.height, tab);
    }
  }, 1500);
}

function drawStaticLayer(ctx, w, h, type) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#040c14';
  ctx.fillRect(0, 0, w, h);

  // grade
  ctx.strokeStyle = 'rgba(26,48,69,0.5)';
  ctx.lineWidth   = 0.5;
  for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }

  const cx = w / 2, cy = h / 2;
  const c  = state.data?.current;
  const f  = state.radarFrame;

  if (type === 'precipitacao') {
    const mm   = c?.precipitation || 0;
    const col  = mm > 10 ? [255,51,85] : mm > 2 ? [255,214,10] : [0,212,255];
    const r    = 30 + mm * 3 + Math.sin(f * 0.1) * 5;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(r, 100));
    grad.addColorStop(0,   `rgba(${col},0.5)`);
    grad.addColorStop(1,   `rgba(${col},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, 100, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#c8dce8';
    ctx.font = '12px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText(`${mm.toFixed(1)} mm/h`, cx, cy + 4);

  } else if (type === 'vento') {
    const spd = c?.wind_speed_10m || 0;
    const dir = (c?.wind_direction_10m || 0) * Math.PI / 180;
    const len = 30 + spd;

    ctx.strokeStyle = `rgba(255,107,53,${0.3 + spd / 100})`;
    ctx.lineWidth   = 1;
    for (let i = 0; i < 12; i++) {
      const bx = cx + Math.cos(i * 0.52) * 80;
      const by = cy + Math.sin(i * 0.52) * 60;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(dir) * len * 0.5, by + Math.sin(dir) * len * 0.5);
      ctx.stroke();
    }
    ctx.fillStyle   = '#ff6b35';
    ctx.font        = '11px JetBrains Mono';
    ctx.textAlign   = 'center';
    ctx.fillText(`${Math.round(spd)} km/h ${degToCardinal(c?.wind_direction_10m||0)}`, cx, h - 16);

  } else if (type === 'temperatura') {
    const t    = c?.temperature_2m || 20;
    const r    = t > 30 ? 255 : t > 20 ? 255 : t > 10 ? 100 : 0;
    const bl   = t < 15 ? 255 : t < 25 ? 100 : 0;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
    grad.addColorStop(0, `rgba(${r},80,${bl},0.5)`);
    grad.addColorStop(1, `rgba(${r},80,${bl},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#c8dce8';
    ctx.font      = 'bold 24px Bebas Neue';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(t)}°C`, cx, cy + 8);
  }
}


function loadDemo() {
  state.demoMode = true;

  const demoData = {
    current: {
      temperature_2m:       27.4,
      relative_humidity_2m: 82,
      apparent_temperature: 31.2,
      precipitation:        8.5,
      weather_code:         81,
      wind_speed_10m:       42,
      wind_direction_10m:   135,
      wind_gusts_10m:       67,
      surface_pressure:     1008,
      visibility:           4200
    },
    hourly: {
      time:            Array.from({ length: 48 }, (_, i) => {
        const d = new Date(); d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() + i);
        return d.toISOString().slice(0, 16);
      }),
      temperature_2m:  Array.from({ length: 48 }, (_, i) => 22 + Math.sin(i * 0.26) * 7 + Math.random() * 2),
      precipitation:   Array.from({ length: 48 }, (_, i) => i < 6 ? Math.random() * 12 : i < 12 ? Math.random() * 3 : 0),
      wind_speed_10m:  Array.from({ length: 48 }, (_, i) => 20 + Math.sin(i * 0.3) * 15 + Math.random() * 5),
      weather_code:    Array.from({ length: 48 }, (_, i) => i < 6 ? 81 : i < 12 ? 63 : i < 18 ? 3 : 1)
    }
  };

  state.data = demoData;
  state.config.city = 'DEMONSTRAÇÃO — São Paulo, SP';

  closeModal();
  processWeatherData(demoData);
  showNotif('Modo demonstração ativado', 'warn');
}


window.addEventListener('load', () => {
  openModal();
  updateRadar();

  setTimeout(() => {
    document.getElementById('riskBarFill').style.width = '0%';
  }, 500);
});