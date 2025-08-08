// home.js - main app logic
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/'; return; }
  const authFetch = (url, opts={}) => {
    opts.headers = opts.headers || {};
    opts.headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, opts);
  };

  // DOM
  const navButtons = document.querySelectorAll('.nav .item');
  const pages = document.querySelectorAll('.page');
  const profileSelect = document.getElementById('profile-select');
  const profilesBtn = document.getElementById('profiles-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsClose = document.getElementById('settings-close');
  const compatToggle = document.getElementById('compat-toggle');
  const themeSelect = document.getElementById('theme-select');

  const iptvForm = document.getElementById('iptv-credentials-form');
  const iptvError = document.getElementById('iptv-error');
  const saveIptvBtn = document.getElementById('save-iptv-btn');

  const liveCategoriesEl = document.getElementById('live-categories');
  const liveStreamsEl = document.getElementById('live-streams');
  const vodCategoriesEl = document.getElementById('vod-categories');
  const vodStreamsEl = document.getElementById('vod-streams');
  const seriesCategoriesEl = document.getElementById('series-categories');
  const seriesStreamsEl = document.getElementById('series-streams');

  const player = document.getElementById('player-section');
  const playerTitle = document.getElementById('player-title');
  const playerClose = document.getElementById('player-close');
  const video = document.getElementById('video-player');

  // About modal
  const aboutOverlay = document.getElementById('about-overlay');
  const aboutClose = document.getElementById('about-close');
  const aboutPlay = document.getElementById('about-play');
  const aboutAdd = document.getElementById('about-add');
  const aboutCover = document.getElementById('about-cover');
  const aboutTitle = document.getElementById('about-title');
  const aboutQuality = document.getElementById('about-quality');
  const aboutYear = document.getElementById('about-year');
  const aboutOverview = document.getElementById('about-overview');
  const aboutSeriesBlock = document.getElementById('about-series');
  const seasonChips = document.getElementById('season-chips');
  const episodesGrid = document.getElementById('episodes-grid');

  // Settings persistence (localStorage)
  const settings = {
    get compat() { return localStorage.getItem('compatMode') === '1'; },
    set compat(v) { localStorage.setItem('compatMode', v ? '1' : '0'); },
    get theme() { return localStorage.getItem('theme') || 'aurora'; },
    set theme(v) { localStorage.setItem('theme', v); }
  };
  // Apply theme on load
  document.documentElement.setAttribute('data-theme', settings.theme);
  themeSelect.value = settings.theme;
  compatToggle.checked = settings.compat;

  themeSelect.addEventListener('change', () => {
    settings.theme = themeSelect.value;
    document.documentElement.setAttribute('data-theme', settings.theme);
  });
  compatToggle.addEventListener('change', () => settings.compat = compatToggle.checked);

  // Navigation
  function switchPage(id) {
    navButtons.forEach(b => b.classList.toggle('active', b.dataset.section === id));
    pages.forEach(p => p.classList.toggle('show', p.id === id));
  }
  navButtons.forEach(btn => btn.addEventListener('click', () => {
    const id = btn.dataset.section;
    switchPage(id);
    if (id === 'live') loadCategories('live');
    if (id === 'movies') loadCategories('vod');
    if (id === 'series') loadCategories('series');
  }));

  profilesBtn.addEventListener('click', () => switchPage('profiles-section'));
  logoutBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = '/'; });
  settingsBtn.addEventListener('click', () => settingsOverlay.classList.remove('hidden'));
  settingsClose.addEventListener('click', () => settingsOverlay.classList.add('hidden'));

  // Profiles
  async function loadProfiles() {
    try {
      const res = await authFetch('/profiles');
      const data = await res.json();
      if (res.ok) {
        profileSelect.innerHTML = '';
        data.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id; opt.textContent = p.name;
          profileSelect.appendChild(opt);
        });
        if (!localStorage.getItem('profileId') && data.length) {
          localStorage.setItem('profileId', data[0].id);
        }
        if (localStorage.getItem('profileId')) {
          profileSelect.value = localStorage.getItem('profileId');
        }
        const list = document.getElementById('profiles-list');
        list.innerHTML = '';
        data.forEach(p => {
          const card = document.createElement('div');
          card.className = 'card card-item';
          card.style.padding = '10px'; card.style.display = 'grid'; card.style.placeItems = 'center';
          card.textContent = p.name;
          list.appendChild(card);
        });
      }
    } catch {}
  }
  profileSelect.addEventListener('change', () => localStorage.setItem('profileId', profileSelect.value));

  // IPTV credentials
  async function checkIptv() {
    const homeRows = document.getElementById('home-rows');
    try {
      const res = await authFetch('/categories/live');
      if (res.ok) {
        document.getElementById('iptv-credentials-form').style.display = 'none';
        // Populate some home rows (basic demo: first two categories from each type)
        homeRows.innerHTML = '';
        await buildHomeRows();
      } else {
        iptvForm.style.display = 'block';
      }
    } catch {
      iptvForm.style.display = 'block';
    }
  }
  saveIptvBtn.addEventListener('click', async () => {
    iptvError.textContent = '';
    const server_url = document.getElementById('server-url').value.trim();
    const username = document.getElementById('iptv-username').value.trim();
    const password = document.getElementById('iptv-password').value.trim();
    if (!server_url || !username || !password) { iptvError.textContent = 'All IPTV fields are required.'; return; }
    try {
      const res = await authFetch('/iptv/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({server_url, username, password})});
      const data = await res.json();
      if (res.ok) {
        iptvForm.style.display = 'none';
        await buildHomeRows();
      } else {
        iptvError.textContent = data.error || 'Failed to save IPTV credentials.';
      }
    } catch {
      iptvError.textContent = 'Could not connect to server.';
    }
  });

  // Categories + streams
  async function loadCategories(type) {
    let container;
    if (type==='live') container = liveCategoriesEl;
    if (type==='vod') container = vodCategoriesEl;
    if (type==='series') container = seriesCategoriesEl;
    if (!container) return;
    container.innerHTML = '';
    const res = await authFetch('/categories/' + type);
    const data = await res.json();
    if (!res.ok) { container.textContent = data.error || 'Failed to load categories'; return; }
    data.forEach((cat, idx) => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (idx===0?' active':'');
      chip.textContent = cat.category_name;
      chip.addEventListener('click', () => { Array.from(container.children).forEach(c => c.classList.remove('active')); chip.classList.add('active'); loadStreams(type, cat.category_id); });
      container.appendChild(chip);
      if (idx===0) loadStreams(type, cat.category_id);
    });
  }

  async function loadStreams(type, categoryId) {
    let target;
    if (type==='live') target = liveStreamsEl;
    if (type==='vod') target = vodStreamsEl;
    if (type==='series') target = seriesStreamsEl;
    target.innerHTML = '';
    const res = await authFetch('/streams/' + type + '/' + categoryId);
    const streams = await res.json();
    if (!res.ok) { target.textContent = streams.error || 'Failed to load streams'; return; }
    streams.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'card-item';
      const img = document.createElement('img');
      img.src = item.stream_icon || item.cover || 'https://via.placeholder.com/300x420?text=No+Image';
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = item.name || item.title || item.series_name || 'Untitled';

      // IDs differ per type
      if (type === 'series') {
        card.dataset.seriesId = item.series_id;
      } else {
        card.dataset.streamId = item.stream_id;
        if (type==='vod') card.dataset.ext = item.container_extension || 'mp4';
      }
      card.dataset.type = type;
      card.dataset.title = label.textContent;
      card.dataset.thumb = img.src;

      card.appendChild(img); card.appendChild(label);
      // Click opens About sheet
      card.addEventListener('click', () => openAbout(card));
      target.appendChild(card);
    });
  }

  // Build a simple home screen (fake "Trending"/"Recently added")
  async function buildHomeRows() {
    const container = document.getElementById('home-rows');
    container.innerHTML = '';

    // Three mini loaders: Live, Movies, Series first categories
    const sections = [
      {title:'Trending Live', type:'live'},
      {title:'Recently added Movies', type:'vod'},
      {title:'Popular Series', type:'series'}
    ];

    for (const sec of sections) {
      const wrap = document.createElement('div');
      const h = document.createElement('h2'); h.className='section-title'; h.textContent = sec.title;
      const row = document.createElement('div'); row.className='cards-row';
      wrap.appendChild(h); wrap.appendChild(row); container.appendChild(wrap);

      try {
        const cats = await (await authFetch('/categories/' + sec.type)).json();
        if (Array.isArray(cats) && cats.length) {
          const catId = cats[0].category_id;
          const items = await (await authFetch('/streams/' + sec.type + '/' + catId)).json();
          items.slice(0,12).forEach(item => {
            const card = document.createElement('div');
            card.className='card-item';
            const img = document.createElement('img');
            img.src = item.stream_icon || item.cover || 'https://via.placeholder.com/300x420?text=No+Image';
            const label = document.createElement('div'); label.className='label';
            label.textContent = item.name || item.title || item.series_name || 'Untitled';

            if (sec.type==='series') card.dataset.seriesId = item.series_id;
            else {
              card.dataset.streamId = item.stream_id;
              if (sec.type==='vod') card.dataset.ext = item.container_extension || 'mp4';
            }
            card.dataset.type = sec.type;
            card.dataset.title = label.textContent;
            card.dataset.thumb = img.src;

            card.appendChild(img); card.appendChild(label);
            card.addEventListener('click', () => openAbout(card));
            row.appendChild(card);
          });
        }
      } catch {}
    }
  }

  // About modal + series seasons/episodes
  let currentAbout = null; // {type, id, ext}
  function openAbout(card) {
    aboutOverlay.classList.remove('hidden');
    aboutSeriesBlock.classList.add('hidden');
    aboutTitle.textContent = card.dataset.title;
    aboutCover.src = card.dataset.thumb;
    aboutOverview.textContent = 'Loading details…';
    aboutQuality.textContent = '';
    aboutYear.textContent = '';

    const type = card.dataset.type;
    if (type === 'vod') {
      const id = card.dataset.streamId;
      currentAbout = {type, id, ext: (card.dataset.ext || 'mp4')};
      fetchInfo('vod', id).then(info => {
        aboutOverview.textContent = (info.info && (info.info.plot || info.info.description)) || 'No description available.';
        aboutYear.textContent = (info.info && (info.info.releasedate || info.info.releaseDate || '')).toString().slice(0,4);
        aboutQuality.textContent = (info.info && (info.info.container_extension || card.dataset.ext || 'mp4')).toUpperCase();
      });
    } else if (type === 'series') {
      const sid = card.dataset.seriesId;
      currentAbout = {type, id: sid};
      aboutSeriesBlock.classList.remove('hidden');
      fetchInfo('series', sid).then(info => {
        const details = info.info || {};
        aboutOverview.textContent = details.plot || 'No description available.';
        aboutYear.textContent = (details.releaseDate || details.start) ? String(details.releaseDate || details.start).slice(0,4) : '';
        aboutQuality.textContent = 'HD';
        // Build seasons
        seasonChips.innerHTML = '';
        episodesGrid.innerHTML = '';
        const seasons = info.seasons || [];
        const episodesBySeason = info.episodes || {};
        seasons.forEach((s, idx) => {
          const chip = document.createElement('div');
          chip.className = 'chip' + (idx===0 ? ' active' : '');
          chip.textContent = s.name || ('Season ' + (s.season_number || (idx+1)));
          chip.addEventListener('click', () => {
            Array.from(seasonChips.children).forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            renderEpisodes(episodesBySeason[String(s.season_number)] || []);
          });
          seasonChips.appendChild(chip);
          if (idx===0) renderEpisodes(episodesBySeason[String(s.season_number)] || []);
        });
      });
    } else {
      // live
      currentAbout = {type: 'live', id: card.dataset.streamId};
      aboutOverview.textContent = 'Live channel.';
      aboutQuality.textContent = 'LIVE';
    }
  }

  function renderEpisodes(list) {
    episodesGrid.innerHTML = '';
    list.forEach(ep => {
      const epDiv = document.createElement('div');
      epDiv.className = 'card-item';
      const img = document.createElement('img');
      img.src = ep.info && ep.info.movie_image ? ep.info.movie_image : 'https://via.placeholder.com/300x180?text=Episode';
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = (ep.title || ('Episode ' + ep.episode_num));
      epDiv.appendChild(img); epDiv.appendChild(label);
      epDiv.addEventListener('click', () => {
        playStream('series', ep.id, label.textContent, 'mp4');
        aboutOverlay.classList.add('hidden');
      });
      episodesGrid.appendChild(epDiv);
    });
  }

  async function fetchInfo(kind, id) {
    const res = await authFetch('/info/' + kind + '/' + id);
    return await res.json();
  }

  // About actions
  aboutClose.addEventListener('click', () => aboutOverlay.classList.add('hidden'));
  aboutPlay.addEventListener('click', () => {
    if (!currentAbout) return;
    if (currentAbout.type === 'vod') {
      playStream('vod', currentAbout.id, aboutTitle.textContent, currentAbout.ext);
    } else if (currentAbout.type === 'live') {
      playStream('live', currentAbout.id, aboutTitle.textContent, 'ts');
    }
    aboutOverlay.classList.add('hidden');
  });
  aboutAdd.addEventListener('click', async () => {
    const pid = localStorage.getItem('profileId');
    if (!pid) return alert('Create a profile first');
    if (!currentAbout) return;
    const payload = { content_type: currentAbout.type, item_id: String(currentAbout.id), title: aboutTitle.textContent, thumbnail: aboutCover.src };
    const res = await authFetch('/profiles/' + pid + '/favourites', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
    if (res.ok) alert('Added to My List'); else alert('Failed to add');
  });

  // Playback
  playerClose.addEventListener('click', () => { video.pause(); player.classList.add('hidden'); });
  function playStream(type, id, title, ext) {
    let url = '';
    if (type === 'vod' && localStorage.getItem('compatMode') === '1') {
      url = '/compat/vod/' + id + '?ext=' + encodeURIComponent(ext || 'mp4');
    } else {
      url = '/stream_url/' + type + '/' + id + (type !== 'live' ? ('?ext=' + encodeURIComponent(ext || 'mp4')) : '');
    }
    authFetch(url).then(r => r.json()).then(data => {
      const src = data.url || (url.startsWith('/compat') ? url : '');
      if (!src) { alert('Could not get playback URL'); return; }
      playerTitle.textContent = title || '';
      player.classList.remove('hidden');
      video.muted = false;
      video.autoplay = true;
      video.src = src;
      video.load();
      const playPromise = video.play();
      if (playPromise && playPromise.catch) playPromise.catch(()=>{});
    }).catch(() => alert('Playback error'));
  }

  // init
  loadProfiles().then(checkIptv);
});
