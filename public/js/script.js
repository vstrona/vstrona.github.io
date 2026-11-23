(function () {
  'use strict';

  var works = window.WORKS || [];
  var grid = document.getElementById('works-grid');
  var modal = document.getElementById('work-modal');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var lastTrigger = null;
  var viewer = window.createViewer();

  function enterFullscreen(v) {
    if (v.requestFullscreen) v.requestFullscreen().catch(function () { if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); });
    else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();   // iPhone
  }

  var $ = function (id) { return document.getElementById(id); };

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }
  function icon(name) { return el('i', { class: 'ph ph-' + name, 'aria-hidden': 'true' }); }

  /* ---------- Карточки ---------- */
  function renderCards() {
    if (!works.length) {
      var empty = el('div', { class: 'empty' });
      empty.appendChild(el('p', { class: 'title-1' }, 'Работы скоро появятся'));
      empty.appendChild(el('p', { class: 'body-3 muted' }, 'Сейчас я собираю проекты для портфолио. Напишите мне, и я пришлю примеры лично.'));
      grid.appendChild(empty);
      return;
    }

    var frag = document.createDocumentFragment();
    works.forEach(function (w, i) {
      var card = el('button', { type: 'button', class: 'card', 'data-reveal': '', 'aria-haspopup': 'dialog' });
      card.style.setProperty('--d', (i % 2) * 80 + 'ms');
      card.addEventListener('click', function () { openWork(i, card); });

      var frame = el('div', { class: 'card__frame' });
      if (w.preview) {
        frame.appendChild(el('img', {
          src: w.preview, alt: w.title, loading: 'lazy', decoding: 'async', width: '1200', height: '900'
        }));
      } else {
        frame.appendChild(el('span', { class: 'card__stub heading-5', 'aria-hidden': 'true' }, w.title));
      }
      var open = el('span', { class: 'card__open button-sm', 'aria-hidden': 'true' }, 'Открыть');
      open.appendChild(icon('arrow-up-right'));
      frame.appendChild(open);

      var meta = el('div', { class: 'card__meta' });
      meta.appendChild(el('h3', { class: 'card__title title-1' }, w.title));
      meta.appendChild(el('span', { class: 'card__year caption-2' }, w.year || ''));
      if (w.short) meta.appendChild(el('p', { class: 'card__short body-6' }, w.short));

      card.appendChild(frame);
      card.appendChild(meta);
      frag.appendChild(card);
    });
    grid.appendChild(frag);
  }

  /* ---------- Веер работ на первом экране ---------- */
  // Порядок: первая карта самая левая, последняя лежит сверху
  var FAN = ['lestnica', 'sevmsubot', 'sushiko', 'olha'];
  function renderFan() {
    var box = $('hero-fan');
    if (!box) return;
    var picked = [];
    FAN.forEach(function (id) {
      for (var i = 0; i < works.length; i++) if (works[i].id === id && works[i].preview) picked.push(i);
    });
    if (!picked.length) { box.hidden = true; return; }
    picked.forEach(function (wi, k) {
      var w = works[wi];
      var card = el('button', { type: 'button', class: 'fan__card', 'aria-haspopup': 'dialog', 'aria-label': 'Открыть работу «' + w.title + '»' });
      card.style.setProperty('--c', k - (picked.length - 1) / 2);   // -1.5 … 1.5: насколько карта отклонена от центра
      card.style.setProperty('--i', k);
      card.appendChild(el('img', { src: w.preview, alt: '', width: '1300', height: '900', decoding: 'async' }));
      card.appendChild(el('span', { class: 'fan__tag button-sm', 'aria-hidden': 'true' }, w.title));
      card.addEventListener('click', function () { openWork(wi, card); });
      box.appendChild(card);
    });
  }

  /* ---------- Окно проекта ---------- */
  function stub(iconName, text) {
    var s = el('div', { class: 'media-stub' });
    s.appendChild(icon(iconName));
    s.appendChild(el('span', { class: 'caption-2' }, text));
    return s;
  }

  function fillModal(w) {
    $('modal-title').textContent = w.title;
    $('modal-short').textContent = w.short || '';

    // Видео создаётся только при открытии
    var video = $('modal-video');
    video.innerHTML = '';
    if (w.video) {
      // preload="none": 2–4 МБ видео качаются только после нажатия Play
      var v = el('video', { controls: '', playsinline: '', preload: 'none' });
      if (w.poster) v.setAttribute('poster', w.poster);
      v.src = w.video;
      // Вертикальные ролики не растягиваем на всю ширину окна
      v.addEventListener('loadedmetadata', function () {
        video.classList.toggle('is-vertical', v.videoHeight > v.videoWidth);
      });
      if (w.poster) {
        var probe = new Image();
        probe.onload = function () { video.classList.toggle('is-vertical', probe.naturalHeight > probe.naturalWidth); };
        probe.src = w.poster;
      }
      video.classList.remove('is-vertical');
      var frame = el('div', { class: 'video-frame' });
      frame.appendChild(v);
      // Своя кнопка «на весь экран»: работает и там, где встроенной нет (iPhone, браузер Telegram)
      var fs = el('button', { type: 'button', class: 'icon-btn video-fs', 'aria-label': 'Видео на весь экран' });
      fs.appendChild(icon('arrows-out'));
      fs.addEventListener('click', function () { enterFullscreen(v); });
      frame.appendChild(fs);
      video.appendChild(frame);
    } else if (w.placeholder) {
      video.appendChild(stub('play-circle', 'Здесь будет видео о проекте'));
    }
    video.hidden = !video.firstChild;

    // Скриншоты: пока грузятся, рамка мигает как скелетон
    var gallery = $('modal-gallery');
    gallery.innerHTML = '';
    gallery.scrollLeft = 0;
    var images = w.images || [];
    if (images.length) {
      images.forEach(function (item, n) {
        var src = typeof item === 'string' ? item : item.src;
        // Клик открывает просмотрщик поверх окна проекта
        var shot = el('button', { type: 'button', class: 'shot is-loading', 'aria-label': 'Открыть скриншот ' + (n + 1) + ' на весь экран' });
        shot.addEventListener('click', function () { viewer.open(images, n, w.title); });
        if (item.w && item.h) shot.style.aspectRatio = item.w + ' / ' + item.h;
        var img = el('img', { alt: w.title + ', скриншот ' + (n + 1), decoding: 'async' });
        if (item.w) { img.width = item.w; img.height = item.h; }
        if (n > 2) img.loading = 'lazy';
        img.addEventListener('load', function () { shot.classList.remove('is-loading'); shot.classList.add('is-loaded'); });
        img.addEventListener('error', function () {
          shot.classList.remove('is-loading');
          shot.innerHTML = '';
          shot.appendChild(stub('image-broken', 'Скриншот не загрузился'));
        });
        img.src = src;
        shot.appendChild(img);
        gallery.appendChild(shot);
      });
    } else if (w.placeholder) {
      for (var n = 0; n < 3; n++) {
        var s = el('div', { class: 'shot' });
        var st = stub('image', 'Скриншот');
        st.style.height = '100%';
        s.appendChild(st);
        gallery.appendChild(s);
      }
    }
    var count = gallery.children.length;
    $('modal-gallery-wrap').hidden = count === 0;
    modal.querySelector('.modal__arrows').hidden = count < 2;

    // Описание: абзацы, подзаголовки "## " и списки "- "
    var desc = $('modal-desc');
    desc.innerHTML = '';
    var list = null;
    String(w.description || '').split(/\n\s*\n/).forEach(function (block) {
      block = block.trim();
      if (!block) return;
      if (block.indexOf('- ') === 0) {
        if (!list) { list = el('ul', { class: 'desc-list' }); desc.appendChild(list); }
        block.split(/\n/).forEach(function (line) {
          desc.lastChild.appendChild(el('li', null, line.replace(/^-\s*/, '')));
        });
        return;
      }
      list = null;
      if (block.indexOf('## ') === 0) desc.appendChild(el('h3', { class: 'heading-6' }, block.slice(3)));
      else desc.appendChild(el('p', null, block));
    });

    // Детали
    var meta = $('modal-meta');
    meta.innerHTML = '';
    [['Тип', w.type], ['Сделано на', (w.stack || []).join(', ')], ['Год', w.year]].forEach(function (row) {
      if (!row[1]) return;
      var wrap = el('div');
      wrap.appendChild(el('dt', { class: 'caption-2' }, row[0]));
      wrap.appendChild(el('dd', { class: 'title-3' }, String(row[1])));
      meta.appendChild(wrap);
    });

    var link = $('modal-link');
    link.hidden = !w.url;
    if (w.url) link.href = w.url;

    // Дополнительные ссылки: бот, код
    var extra = $('modal-links');
    extra.innerHTML = '';
    (w.links || []).forEach(function (l) {
      var a = el('a', { class: 'btn btn--ghost button-md', href: l.url, target: '_blank', rel: 'noopener' }, l.label + ' ');
      a.appendChild(icon('arrow-up-right'));
      extra.appendChild(a);
    });
    extra.hidden = !extra.firstChild;
  }

  function openWork(i, trigger) {
    lastTrigger = trigger;
    fillModal(works[i]);
    document.documentElement.classList.add('is-locked');
    modal.classList.remove('is-closing');
    modal.showModal();
    modal.scrollTop = 0;
    requestAnimationFrame(updateArrows);
  }

  function closeModal() {
    if (!modal.open || modal.classList.contains('is-closing')) return;
    var v = modal.querySelector('video');
    if (v) v.pause();
    modal.classList.add('is-closing');
    setTimeout(function () {
      modal.close();
      modal.classList.remove('is-closing');
    }, reduceMotion.matches ? 0 : 280);
  }

  modal.addEventListener('close', function () {
    document.documentElement.classList.remove('is-locked');
    $('modal-video').innerHTML = '';
    if (lastTrigger) lastTrigger.focus({ preventScroll: true });
  });
  modal.addEventListener('cancel', function (e) { e.preventDefault(); closeModal(); });
  modal.addEventListener('click', function (e) {
    if (e.target === modal || e.target.closest('[data-close]')) closeModal();
  });

  /* ---------- Стрелки галереи ---------- */
  var gallery = $('modal-gallery');
  function updateArrows() {
    var max = gallery.scrollWidth - gallery.clientWidth - 2;
    modal.querySelector('.arrow[data-dir="-1"]').disabled = gallery.scrollLeft <= 2;
    modal.querySelector('.arrow[data-dir="1"]').disabled = gallery.scrollLeft >= max;
  }
  gallery.addEventListener('scroll', function () { requestAnimationFrame(updateArrows); }, { passive: true });
  modal.querySelectorAll('.arrow').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = gallery.firstElementChild;
      if (!item) return;
      var step = item.getBoundingClientRect().width + parseFloat(getComputedStyle(gallery).columnGap || 0);
      gallery.scrollBy({ left: step * Number(btn.dataset.dir), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Появление секций ---------- */
  function reveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------- Текущий раздел в навигации ---------- */
  /* ---------- Меню: чёрная капсула под разделом, который сейчас на экране ---------- */
  function navCurrent() {
    var nav = document.querySelector('.nav');
    var pill = $('nav-pill');
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
    if (!nav || !pill || !links.length) return;

    var current = null;
    var lockUntil = 0;   // после нажатия на вкладку капсула не скачет по разделам, мимо которых едет прокрутка

    function place(link, animate) {
      var navBox = nav.getBoundingClientRect();
      var box = link.getBoundingClientRect();
      var left = box.left - navBox.left - nav.clientLeft;
      var right = navBox.right - box.right - nav.clientLeft;
      var oldLeft = parseFloat(pill.style.getPropertyValue('--pill-left')) || 0;
      var forward = left > oldLeft;

      // Передний край уходит сразу, задний чуть позже: капсула перетекает, а не прыгает
      pill.style.setProperty('--lag-left', forward ? '90ms' : '0ms');
      pill.style.setProperty('--lag-right', forward ? '0ms' : '90ms');
      pill.classList.toggle('no-anim', !animate);
      pill.style.setProperty('--pill-left', left + 'px');
      pill.style.setProperty('--pill-right', right + 'px');
      pill.classList.add('is-on');
      if (!animate) { void pill.offsetWidth; pill.classList.remove('no-anim'); }
    }

    function setCurrent(id, animate) {
      if (id === current) return;
      var first = current === null;
      current = id;
      links.forEach(function (a) {
        var on = a.dataset.nav === id;
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        if (on) place(a, animate && !first);
      });
    }

    // Активен последний раздел, чей верх уже поднялся выше середины экрана.
    // В самом низу страницы активны контакты, даже если они не дотянулись до середины.
    function detect() {
      var line = window.innerHeight * 0.45;
      var id = links[0].dataset.nav;
      links.forEach(function (a) {
        var s = $(a.dataset.nav);
        if (s && s.getBoundingClientRect().top <= line) id = a.dataset.nav;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) id = links[links.length - 1].dataset.nav;
      return id;
    }

    var ticking = false;
    function onScroll() {
      if (ticking || Date.now() < lockUntil) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; setCurrent(detect(), true); });
    }

    links.forEach(function (a) {
      a.addEventListener('click', function () {
        lockUntil = Date.now() + 1200;
        setCurrent(a.dataset.nav, true);
      });
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', function () { lockUntil = 0; onScroll(); });

    // Ширина вкладок меняется, когда догружаются шрифты и иконки или поворачивают экран:
    // следим за самими вкладками, а не за событиями окна
    function replace() { links.forEach(function (a) { if (a.dataset.nav === current) place(a, false); }); }
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(replace);
      ro.observe(nav);
      links.forEach(function (a) { ro.observe(a); });
    } else {
      window.addEventListener('resize', replace);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);

    setCurrent(detect(), false);
  }

  document.querySelectorAll('.hero [data-reveal]').forEach(function (n, i) {
    n.style.setProperty('--d', i * 80 + 'ms');
  });

  var y = $('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- Копирование почты ---------- */
  var toastTimer;
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.dataset.copy;
      var toast = $('copy-toast');
      var done = function (ok) {
        toast.textContent = ok ? 'Почта скопирована: ' + text : 'Не получилось скопировать. Почта: ' + text;
        toast.classList.add('is-on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2400);
      };
      // Запасной способ для браузеров, где Clipboard API запрещён (например, внутри Telegram)
      var fallback = function () {
        var field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
        document.body.appendChild(field);
        field.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        field.remove();
        done(ok);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
      else fallback();
    });
  });

  renderFan();
  renderCards();
  reveal();
  navCurrent();
})();
