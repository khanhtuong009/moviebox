const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const getKey = () => { try { return localStorage.getItem('tmdb_key') || ''; } catch (e) { return ''; } };

async function api(path, params = {}) {
  const key = getKey();
  const p = new URLSearchParams({ language: 'vi-VN', ...params });
  const headers = {};
  if (key.length > 40) headers.Authorization = 'Bearer ' + key; else p.set('api_key', key);
  const r = await fetch(`${API}${path}?${p}`, { headers });
  if (r.status === 401) throw new Error('key');
  if (!r.ok) throw new Error('net');
  return r.json();
}

const title = m => m.title || m.name || '';
const year = m => (m.release_date || m.first_air_date || '').slice(0, 4);
const type = m => m.media_type || (m.title ? 'movie' : 'tv');

function card(m) {
  const t = type(m);
  const img = m.poster_path ? `<img loading="lazy" src="${IMG}w342${m.poster_path}" alt="">` : '<div class="ph"></div>';
  return `<a class="card" href="#/${t}/${m.id}">${img}<span>${esc(title(m))}</span></a>`;
}
const row = (name, items) => items.length ? `<section class="row"><h2>${esc(name)}</h2><div class="scroll">${items.map(card).join('')}</div></section>` : '';

function msg(text, link) { app.innerHTML = `<div class="msg">${esc(text)}${link ? `<br><br><a class="btn" href="#/settings">Nhập API key</a>` : ''}</div>`; }
function fail(e) {
  if (e.message === 'key') return msg(getKey() ? 'API key không hợp lệ. Kiểm tra lại trong Cài đặt.' : 'Bạn cần nhập TMDB API key để xem danh sách phim.', true);
  msg('Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử lại.');
}

async function home() {
  if (!getKey()) return fail(new Error('key'));
  msg('Đang tải…');
  const [tr, pop, top, tv, vn] = await Promise.all([
    api('/trending/all/week'), api('/movie/popular'), api('/movie/top_rated'),
    api('/tv/popular'), api('/discover/movie', { with_original_language: 'vi', sort_by: 'popularity.desc' })
  ]);
  const h = tr.results.find(m => m.backdrop_path) || tr.results[0];
  app.innerHTML = `
    <div class="hero" style="background-image:url(${IMG}w780${h.backdrop_path})"><div>
      <h1>${esc(title(h))}</h1><p>${esc(h.overview)}</p>
      <a class="btn" href="#/${type(h)}/${h.id}">Xem chi tiết</a></div></div>
    ${row('Thịnh hành tuần này', tr.results)}${row('Phim Việt Nam', vn.results)}
    ${row('Phim lẻ phổ biến', pop.results)}${row('Phim bộ phổ biến', tv.results)}
    ${row('Đánh giá cao nhất', top.results)}`;
}

async function search(q) {
  if (!q) return home();
  msg('Đang tìm…');
  const d = await api('/search/multi', { query: q });
  const items = d.results.filter(m => m.media_type !== 'person');
  app.innerHTML = items.length ? `<div class="grid">${items.map(card).join('')}</div>` : `<div class="msg">Không có kết quả cho “${esc(q)}”.</div>`;
}

async function detail(t, id) {
  msg('Đang tải…');
  const d = await api(`/${t}/${id}`, { append_to_response: 'videos,watch/providers', include_video_language: 'vi,en,null' });
  const vids = (d.videos?.results || []).filter(v => v.site === 'YouTube');
  const tr = vids.find(v => v.type === 'Trailer') || vids[0];
  const prov = d['watch/providers']?.results || {};
  const region = prov.VN ? 'VN' : (prov.US ? 'US' : '');
  const p = region ? prov[region] : null;
  const list = p ? [...(p.flatrate || []), ...(p.rent || []), ...(p.buy || [])] : [];
  const seen = new Set();
  const uniq = list.filter(x => !seen.has(x.provider_id) && seen.add(x.provider_id));
  const run = d.runtime ? d.runtime + ' phút' : (d.number_of_seasons ? d.number_of_seasons + ' mùa' : '');
  app.innerHTML = `<div class="detail">
    <div class="bd" style="background-image:url(${d.backdrop_path ? IMG + 'w780' + d.backdrop_path : ''})"></div>
    <div class="info">
      <h1>${esc(title(d))}</h1>
      <div class="meta"><b>★ ${(d.vote_average || 0).toFixed(1)}</b> · ${esc(year(d))} · ${esc(run)}</div>
      <div class="tags">${(d.genres || []).map(g => `<span>${esc(g.name)}</span>`).join('')}</div>
      <p class="over">${esc(d.overview) || 'Chưa có mô tả.'}</p>
      ${tr ? `<h3>Trailer</h3><iframe class="vid" src="https://www.youtube-nocookie.com/embed/${esc(tr.key)}" allow="encrypted-media; fullscreen" allowfullscreen></iframe>` : ''}
      <h3>Xem hợp pháp ở đâu</h3>
      ${uniq.length ? `<div class="prov">${uniq.map(x => `<img title="${esc(x.provider_name)}" src="${IMG}w92${x.logo_path}" alt="${esc(x.provider_name)}">`).join('')}</div>
        <p class="note" style="margin-top:8px">Dữ liệu từ JustWatch, khu vực ${region}.</p>
        ${p.link ? `<p style="margin-top:12px"><a class="btn alt" href="${esc(p.link)}" target="_blank" rel="noopener">Mở trang xem phim</a></p>` : ''}`
        : '<p class="note">Chưa có dịch vụ nào cung cấp phim này ở khu vực của bạn.</p>'}
    </div></div>`;
  window.scrollTo(0, 0);
}

function settings() {
  app.innerHTML = `<div class="set"><h1>Cài đặt</h1>
    <p>Nhập TMDB API key (miễn phí tại themoviedb.org → Settings → API). Key được lưu trên máy bạn.</p>
    <input id="k" type="password" placeholder="API key hoặc Read Access Token" value="${esc(getKey())}">
    <button class="btn" id="save">Lưu</button>
    <p class="note" style="margin-top:20px">Ứng dụng này dùng dữ liệu của TMDB nhưng không được TMDB chứng nhận hay xác nhận.</p></div>`;
  $('#save').onclick = () => { try { localStorage.setItem('tmdb_key', $('#k').value.trim()); } catch (e) {} location.hash = '#/'; };
}

async function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  try {
    if (h[0] === 'movie' || h[0] === 'tv') await detail(h[0], h[1]);
    else if (h[0] === 'search') await search(decodeURIComponent(h[1] || ''));
    else if (h[0] === 'settings') settings();
    else await home();
  } catch (e) { fail(e); }
}
$('#sf').addEventListener('submit', e => { e.preventDefault(); const v = $('#q').value.trim(); if (v) { location.hash = '#/search/' + encodeURIComponent(v); $('#q').blur(); } });
addEventListener('hashchange', route);
route();
