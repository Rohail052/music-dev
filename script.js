(() => {
  const apiKey = 'AIzaSyDHP2EWHt-9Pm4_L20lHeVt3Qotb8WYIZU'; // Replace with your API key

  // DOM elements
  const navLinks = document.querySelectorAll('.nav-links a'),
        hamburger = document.querySelector('.hamburger-menu'),
        pages = { home: '#home', playlist: '#playlist', recent: '#recent', settings: '#settings' },
        searchInput = document.getElementById('searchInput'),
        searchButton = document.getElementById('searchButton'),
        resultsList = document.getElementById('resultsList'),
        audioOnlyToggle = document.getElementById('audioOnlyToggle'),
        newPlaylistName = document.getElementById('newPlaylistName'),
        createPlaylistBtn = document.getElementById('createPlaylistBtn'),
        activePlaylistSelector = document.getElementById('activePlaylistSelector'),
        renamePlaylistBtn = document.getElementById('renamePlaylistBtn'),
        deletePlaylistBtn = document.getElementById('deletePlaylistBtn'),
        playlistItems = document.getElementById('playlistItems'),
        exportPlaylistsBtn = document.getElementById('exportPlaylistsBtn'),
        importPlaylistsBtn = document.getElementById('importPlaylistsBtn'),
        importFileInput = document.getElementById('importFileInput'),
        clearRecentBtn = document.getElementById('clearRecentBtn'),
        recentlyPlayedList = document.getElementById('recentlyPlayedList'),
        notifyToggle = document.getElementById('notifyToggle');

  let playlists = {}, activePlaylist = null, recent = [], currentVideoId = null;

  function saveState() {
    localStorage.setItem('allplay_playlists', JSON.stringify(playlists));
    localStorage.setItem('allplay_recent', JSON.stringify(recent));
    localStorage.setItem('allplay_notify', notifyToggle.checked);
  }

  function loadState() {
    playlists = JSON.parse(localStorage.getItem('allplay_playlists') || '{}');
    recent = JSON.parse(localStorage.getItem('allplay_recent') || '[]');
    activePlaylist = Object.keys(playlists)[0] || null;
    notifyToggle.checked = localStorage.getItem('allplay_notify') === 'true';
  }

  function switchPage(pageKey) {
    for(const key in pages) {
      document.querySelector(pages[key]).classList.toggle('active', key === pageKey);
      navLinks.forEach(a => a.classList.toggle('active', a.dataset.page === key));
    }
    document.querySelector('.nav-links').classList.remove('active');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded','false');
  }

  hamburger.addEventListener('click', () => {
    const open = !hamburger.classList.toggle('open');
    document.querySelector('.nav-links').classList.toggle('active', !open);
    hamburger.setAttribute('aria-expanded', (!open).toString());
  });

  navLinks.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      switchPage(a.dataset.page);
    });
  });

  async function youtubeSearch(query) {
    if(!query.trim()) return;
    resultsList.innerHTML = '<li>🔍 Searching…</li>';
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('maxResults', '12');
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'video');
      url.searchParams.set('videoCategoryId', '10');
      url.searchParams.set('key', apiKey);
      const res = await fetch(url);
      const json = await res.json();
      resultsList.innerHTML = '';
      (json.items || []).forEach(item => {
        const vid = item.id.videoId;
        const li = document.createElement('li');
        li.innerHTML = `
          <img src="${item.snippet.thumbnails.medium.url}" alt="Thumbnail">
          <p>${item.snippet.title}</p>
        `;
        li.tabIndex = 0;
        li.addEventListener('click', () => playUnder(li, vid, item.snippet.title));
        li.addEventListener('keydown', e => { if(e.key==='Enter') playUnder(li, vid, item.snippet.title) });
        resultsList.appendChild(li);
      });
    } catch {
      resultsList.innerHTML = '<li style="color:red">Error fetching results.</li>';
    }
  }

  function playUnder(li, videoId, title) {
    currentVideoId = videoId;
    const existing = resultsList.querySelector('.player-container');
    if(existing) existing.remove();
    const div = document.createElement('div');
    div.className = 'player-container';
    if(audioOnlyToggle.checked) {
      div.innerHTML = `
        <div class="audio-only-text">🎧 Audio Only</div>
        <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0" 
          style="width:0;height:0;border:0;position:absolute;left:-9999px;"
          allow="autoplay"></iframe>`;
    } else {
      div.innerHTML = `<iframe class="player-iframe" src="https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1" allow="autoplay"></iframe>`;
    }
    const btn = document.createElement('button');
    btn.textContent = '➕ Add to Playlist';
    btn.addEventListener('click', () => addToPlaylist({ videoId, title }));
    div.appendChild(btn);
    li.after(div);
    addRecent({ videoId, title });
  }

  function addToPlaylist(song) {
    if(!activePlaylist) return alert('Create/select a playlist first');
    if(playlists[activePlaylist].some(s => s.videoId === song.videoId)) return alert('Already added');
    playlists[activePlaylist].push(song);
    saveState();
    renderPlaylistItems();
    alert('Added to "' + activePlaylist + '"');
  }

  createPlaylistBtn.addEventListener('click', () => {
    const name = newPlaylistName.value.trim();
    if(!name) return;
    if(playlists[name]) return alert('Name taken');
    playlists[name] = [];
    activePlaylist = name;
    newPlaylistName.value = '';
    saveState(); renderPlaylistList();
  });

  activePlaylistSelector.addEventListener('change', () => {
    activePlaylist = activePlaylistSelector.value;
    renderPlaylistItems();
  });

  renamePlaylistBtn.addEventListener('click', () => {
    if(!activePlaylist) return;
    const newName = prompt('Rename playlist:', activePlaylist);
    if(!newName || playlists[newName]) return;
    playlists[newName] = playlists[activePlaylist];
    delete playlists[activePlaylist];
    activePlaylist = newName;
    saveState(); renderPlaylistList();
  });

  deletePlaylistBtn.addEventListener('click', () => {
    if(!activePlaylist || !confirm('Delete?')) return;
    delete playlists[activePlaylist];
    activePlaylist = Object.keys(playlists)[0] || null;
    saveState(); renderPlaylistList();
  });

  exportPlaylistsBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(playlists,null,2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'playlists.json';
    a.click();
  });

  importPlaylistsBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', () => {
    const f = importFileInput.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if(typeof obj !== 'object') throw '';
        playlists = obj;
        activePlaylist = Object.keys(playlists)[0] || null;
        saveState(); renderPlaylistList(); alert('Playlists imported');
      } catch {
        alert('Invalid JSON');
      }
    };
    reader.readAsText(f);
  });

  function renderPlaylistList() {
    activePlaylistSelector.innerHTML = '';
    Object.keys(playlists).forEach(n => {
      const o = document.createElement('option');
      o.value = o.textContent = n;
      activePlaylistSelector.appendChild(o);
    });
    renderPlaylistItems();
  }

  function renderPlaylistItems() {
    playlistItems.innerHTML = '';
    if(!activePlaylist) return;
    playlists[activePlaylist].forEach(s => {
      const li = document.createElement('li');
      li.textContent = s.title;
      const playBtn = document.createElement('button');
      playBtn.textContent = '▶️';
      playBtn.addEventListener('click', () => { switchPage('home'); playUnder(document.createElement('div'), s.videoId, s.title); });
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '❌';
      removeBtn.addEventListener('click', () => {
        playlists[activePlaylist] = playlists[activePlaylist].filter(x => x.videoId !== s.videoId);
        saveState(); renderPlaylistItems();
      });
      li.appendChild(playBtn);
      li.appendChild(removeBtn);
      playlistItems.appendChild(li);
    });
  }

  clearRecentBtn.addEventListener('click', () => {
    if(confirm('Clear recent?')) {
      recent = [];
      saveState(); renderRecent();
    }
  });

  function addRecent(song) {
    recent = recent.filter(s => s.videoId !== song.videoId);
    recent.unshift(song);
    if(recent.length > 20) recent.pop();
    saveState(); renderRecent();
  }

  function renderRecent() {
    recentlyPlayedList.innerHTML = '';
    recent.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s.title;
      const playBtn = document.createElement('button');
      playBtn.textContent = '▶️';
      playBtn.addEventListener('click', () => { switchPage('home'); playUnder(document.createElement('div'), s.videoId, s.title); });
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '❌';
      removeBtn.addEventListener('click', () => {
        recent = recent.filter(x => x.videoId !== s.videoId);
        saveState(); renderRecent();
      });
      li.appendChild(playBtn);
      li.appendChild(removeBtn);
      recentlyPlayedList.appendChild(li);
    });
  }

  notifyToggle.addEventListener('change', () => saveState());

  searchButton.addEventListener('click', () => youtubeSearch(searchInput.value));
  searchInput.addEventListener('keydown', e => e.key === 'Enter' && youtubeSearch(searchInput.value));

  loadState();
  renderPlaylistList();
  renderRecent();
  switchPage('home');
})();
