/*
  Просмотрщик скриншотов «как в Telegram».
  Третий слой поверх окна проекта:
  - листать: свайп, стрелки на экране, клавиши ← →
  - приближать: колесо мыши, щипок двумя пальцами, двойной клик или тап, кнопки + и −
  - двигать приближенное фото: перетаскивание мышью или пальцем
  - закрыть: крестик, Esc, клик по пустому месту, свайп вниз
*/
(function () {
  'use strict';

  var MIN = 1, MAX = 5, DOUBLE = 2.5;
  var EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

  window.createViewer = function () {
    var dlg = document.getElementById('viewer');
    var stage = document.getElementById('viewer-stage');
    var img = document.getElementById('viewer-img');
    var count = document.getElementById('viewer-count');
    var btnPrev = dlg.querySelector('[data-viewer="prev"]');
    var btnNext = dlg.querySelector('[data-viewer="next"]');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    var items = [], index = 0, title = '';
    var s = 1, tx = 0, ty = 0;            // масштаб и сдвиг
    var pointers = new Map();
    var g = null;                          // текущий жест
    var lastTap = { t: 0, x: 0, y: 0 };
    var busy = false;

    function srcOf(item) { return typeof item === 'string' ? item : item.src; }

    function apply(animate) {
      img.style.transition = animate && !reduce.matches ? 'transform 300ms ' + EASE : 'none';
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
      stage.classList.toggle('is-zoomed', s > 1.01);
    }

    // Не даём утащить фото за край
    function clamp() {
      var w = img.offsetWidth * s, h = img.offsetHeight * s;
      var mx = Math.max(0, (w - stage.clientWidth) / 2);
      var my = Math.max(0, (h - stage.clientHeight) / 2);
      tx = Math.min(mx, Math.max(-mx, tx));
      ty = Math.min(my, Math.max(-my, ty));
    }

    // Точка экрана относительно центра сцены
    function local(x, y) {
      var r = stage.getBoundingClientRect();
      return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
    }

    // Приблизить так, чтобы точка под курсором осталась на месте
    function zoomTo(next, px, py, animate) {
      next = Math.min(MAX, Math.max(MIN, next));
      tx = px - (px - tx) * next / s;
      ty = py - (py - ty) * next / s;
      s = next;
      if (s <= 1.01) { s = 1; tx = 0; ty = 0; }
      clamp();
      apply(animate);
    }

    function reset() { s = 1; tx = 0; ty = 0; apply(false); }

    function preload(i) {
      if (items[i]) { var p = new Image(); p.src = srcOf(items[i]); }
    }

    function show(i, dir) {
      if (busy || i < 0 || i >= items.length) return;
      var go = function () {
        index = i;
        reset();
        img.src = srcOf(items[i]);
        img.alt = title + ', скриншот ' + (i + 1);
        count.textContent = (i + 1) + ' / ' + items.length;
        btnPrev.disabled = i === 0;
        btnNext.disabled = i === items.length - 1;
        preload(i + 1); preload(i - 1);
      };
      if (!dir || reduce.matches || !img.animate) { go(); return; }
      busy = true;
      var out = img.animate(
        [{ transform: img.style.transform || 'none', opacity: 1 },
         { transform: 'translateX(' + (-dir * 40) + 'px)', opacity: 0 }],
        { duration: 160, easing: EASE, fill: 'forwards' });
      var done = false;
      var finish = function () {
        if (done) return;
        done = true;
        go();
        out.cancel();
        img.animate(
          [{ transform: 'translateX(' + (dir * 40) + 'px)', opacity: 0 },
           { transform: 'translateX(0)', opacity: 1 }],
          { duration: 300, easing: EASE });
        busy = false;
      };
      out.onfinish = finish;
      setTimeout(finish, 220);   // страховка, если анимация не доиграет
    }

    function open(list, i, name) {
      items = list; title = name || '';
      dlg.classList.toggle('is-single', items.length < 2);
      show(i);
      dlg.showModal();
    }

    function close() {
      if (!dlg.open || dlg.classList.contains('is-closing')) return;
      dlg.classList.add('is-closing');
      setTimeout(function () {
        dlg.close();
        dlg.classList.remove('is-closing');
        img.style.opacity = '';
      }, reduce.matches ? 0 : 200);
    }

    /* ---------- Жесты ---------- */
    stage.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      startGesture();
    });

    function startGesture() {
      var pts = Array.from(pointers.values());
      if (pts.length >= 2) {
        var a = pts[0], b = pts[1];
        var mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
        g = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), s: s, mid: mid, tx: tx, ty: ty };
      } else if (pts.length === 1) {
        g = { type: 'pending', x: pts[0].x, y: pts[0].y, tx: tx, ty: ty, moved: false, t: Date.now() };
      }
    }

    stage.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId) || !g) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      var pts = Array.from(pointers.values());

      if (g.type === 'pinch' && pts.length >= 2) {
        var a = pts[0], b = pts[1];
        var next = Math.min(MAX, Math.max(MIN * 0.8, g.s * Math.hypot(a.x - b.x, a.y - b.y) / g.dist));
        var mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
        s = next;
        tx = mid.x - (g.mid.x - g.tx) * next / g.s;
        ty = mid.y - (g.mid.y - g.ty) * next / g.s;
        apply(false);
        return;
      }

      var dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (g.type === 'pending') {
        if (Math.hypot(dx, dy) < 8) return;
        g.moved = true;
        if (s > 1.01) g.type = 'pan';
        else g.type = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'dismiss';
      }
      if (g.type === 'pan') {
        tx = g.tx + dx; ty = g.ty + dy; clamp(); apply(false);
      } else if (g.type === 'swipe') {
        // у краёв списка тянется туже
        var edge = (index === 0 && dx > 0) || (index === items.length - 1 && dx < 0);
        tx = edge ? dx * 0.3 : dx; apply(false);
      } else if (g.type === 'dismiss') {
        ty = Math.max(0, dy);
        apply(false);
        img.style.opacity = String(Math.max(0.3, 1 - ty / 400));
      }
    });

    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      var up = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      var gesture = g;

      if (gesture && gesture.type === 'pinch') {
        if (s < 1) { s = 1; tx = 0; ty = 0; }
        clamp(); apply(true);
        startGesture();               // оставшийся палец продолжает двигать фото
        if (g) g.type = s > 1.01 ? 'pan' : 'pending', g.moved = true;
        return;
      }
      g = null;
      if (!gesture) return;

      var dx = up.x - gesture.x, dy = up.y - gesture.y;
      if (gesture.type === 'swipe') {
        var dir = dx < -60 ? 1 : dx > 60 ? -1 : 0;
        if (dir && items[index + dir]) { show(index + dir, dir); }
        else { tx = 0; apply(true); }
        return;
      }
      if (gesture.type === 'dismiss') {
        if (dy > 120) { close(); return; }
        ty = 0; img.style.opacity = ''; apply(true);
        return;
      }
      if (gesture.type === 'pan') return;

      // Тап: двойной = приблизить/отдалить, одиночный мимо фото = закрыть
      if (!gesture.moved) {
        var now = Date.now();
        var p = local(up.x, up.y);
        if (now - lastTap.t < 300 && Math.hypot(up.x - lastTap.x, up.y - lastTap.y) < 30) {
          lastTap.t = 0;
          clearTimeout(lastTap.timer);
          if (s > 1.01) zoomTo(1, 0, 0, true); else zoomTo(DOUBLE, p.x, p.y, true);
          return;
        }
        lastTap = { t: now, x: up.x, y: up.y };
        var onImage = e.target === img;
        if (!onImage && s <= 1.01) {
          lastTap.timer = setTimeout(close, 300);
        }
      }
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    // Колесо мыши и щипок на тачпаде
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = local(e.clientX, e.clientY);
      var k = e.ctrlKey ? 0.01 : 0.0025;
      zoomTo(s * Math.exp(-e.deltaY * k), p.x, p.y, false);
    }, { passive: false });

    /* ---------- Кнопки и клавиши ---------- */
    btnPrev.addEventListener('click', function () { show(index - 1, -1); });
    btnNext.addEventListener('click', function () { show(index + 1, 1); });
    dlg.querySelector('[data-viewer="in"]').addEventListener('click', function () { zoomTo(s * 1.6, 0, 0, true); });
    dlg.querySelector('[data-viewer="out"]').addEventListener('click', function () { zoomTo(s / 1.6, 0, 0, true); });
    dlg.querySelector('[data-viewer="close"]').addEventListener('click', close);

    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1, 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1, -1); }
      else if (e.key === '+' || e.key === '=') zoomTo(s * 1.6, 0, 0, true);
      else if (e.key === '-') zoomTo(s / 1.6, 0, 0, true);
    });
    window.addEventListener('resize', function () { if (dlg.open) { clamp(); apply(false); } });

    return { open: open, close: close };
  };
})();
