(() => {
  const root = document.documentElement;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const wideScreen = matchMedia('(min-width: 1280px)');
  const clamp01 = (n) => Math.min(1, Math.max(0, n));
  /* Text fitting: scales [data-fit] so its widest line fills the parent. */
  function contentWidth(el) {
    const cs = getComputedStyle(el);
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }
  function fitText() {
    $$('[data-fit]').forEach((el) => {
      const ratio = parseFloat(getComputedStyle(el).getPropertyValue('--fit')) || 1;
      el.style.fontSize = '100px';
      const widest = Math.max(...$$('[data-fit-line]', el).map((l) => l.getBoundingClientRect().width));
      if (!widest) return;
      el.style.fontSize = `${(100 * contentWidth(el) * ratio) / widest}px`;
    });
  }

  /* Roll each letter in sequence while exposing one readable link label. */
  $$('[data-roll]').forEach((el) => {
    const label = el.textContent;
    const visible = document.createElement('span');
    visible.className = 'roll-label';
    visible.setAttribute('aria-hidden', 'true');
    for (const [i, letter] of Array.from(label).entries()) {
      const roll = document.createElement('span');
      roll.className = 'roll';
      roll.style.setProperty('--delay', `${i * 16}ms`);
      for (let copy = 0; copy < 2; copy++) {
        const glyph = document.createElement('span');
        glyph.textContent = letter === ' ' ? '\u00a0' : letter;
        roll.append(glyph);
      }
      visible.append(roll);
    }
    const accessible = document.createElement('span');
    accessible.className = 'sr-only';
    accessible.textContent = label;
    el.replaceChildren(accessible, visible);
  });

  $$('[data-title]').forEach((el) => {
    let index = 0;
    for (const node of [...el.childNodes]) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const words = node.textContent.split(/(\s+)/).map((word) => {
        if (!word.trim()) return document.createTextNode(word);
        const span = document.createElement('span');
        span.className = 'title__word';
        span.textContent = word;
        span.style.setProperty('--delay', `${index++ * 50}ms`);
        return span;
      });
      node.replaceWith(...words);
    }
  });

  /* Navigation */
  const nav = $('#nav');
  const navToggle = $('.nav__toggle', nav);
  const navMenu = $('#nav-menu');
  $$('li', navMenu).forEach((li, i) => li.style.setProperty('--i', i));
  function setNav(open) {
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navMenu.inert = !open;
  }
  navToggle.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
  navMenu.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setNav(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setNav(false);
      navToggle.focus();
    }
  });

  /* Titles start on entry. Cards reveal once half of their area is visible. */
  $$('.socials li, .footer__links li, .footer__mail').forEach((el) => {
    el.dataset.reveal = '';
    const index = [...el.parentElement.children].indexOf(el);
    el.style.setProperty('--reveal-delay', `${200 + index * 100}ms`);
  });

  function revealOnce(selector, threshold) {
    const targets = $$(selector);
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < threshold) continue;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    }, { threshold });
    targets.forEach((el) => observer.observe(el));
  }
  revealOnce('[data-title]', 0);
  revealOnce('[data-reveal], [data-flip]', .5);
  document.addEventListener('focusin', (event) => {
    event.target.closest('[data-reveal]')?.classList.add('in');
  });

  const statement = $('[data-words]');
  const track = statement.closest('.statement__track');
  const words = statement.textContent.trim().split(/\s+/).map((word) => {
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = word;
    return span;
  });
  // Spaces between the spans preserve native word wrapping, selection and speech.
  statement.replaceChildren(...words.flatMap((word, i) => i ? [' ', word] : [word]));
  let lastLit = -1;
  function paintWords() {
    // Use the text's unpinned position for the 30% to 1% viewport scroll range.
    const textTop = track.getBoundingClientRect().top + (innerHeight - statement.offsetHeight) / 2;
    const progress = clamp01((innerHeight * .30 - textTop) / (innerHeight * .29));
    const lit = reducedMotion.matches ? words.length : Math.floor(progress * words.length);
    if (lit === lastLit) return;
    words.forEach((word, i) => word.classList.toggle('is-dim', i > lit));
    lastLit = lit;
  }

  // The card stays bottom-aligned as it grows from 200 to 400px over one viewport.
  const portrait = $('.portrait__card');
  const hero = $('.hero');
  function paintPortrait() {
    if (!wideScreen.matches) return;
    const rect = hero.getBoundingClientRect();
    const progress = reducedMotion.matches ? 0 : clamp01(-rect.top / rect.height);
    portrait.style.setProperty('--portrait-y', `${25 * (1 - progress)}%`);
    portrait.style.setProperty('--portrait-scale', .5 + .5 * progress);
    portrait.style.setProperty('--portrait-turn', `${180 * progress}deg`);
  }

  $$('.shape').forEach((shape) => {
    let start = null;
    shape.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY };
      shape.setPointerCapture(event.pointerId);
      shape.style.transition = 'none';
    });
    shape.addEventListener('pointermove', (event) => {
      if (!start || !shape.hasPointerCapture(event.pointerId)) return;
      shape.style.setProperty('--drag-x', `${event.clientX - start.x}px`);
      shape.style.setProperty('--drag-y', `${event.clientY - start.y}px`);
    });
    shape.addEventListener('lostpointercapture', () => {
      start = null;
      shape.style.transition = 'translate .75s var(--ease)';
      shape.style.removeProperty('--drag-x');
      shape.style.removeProperty('--drag-y');
    });
  });

  /* Scroll and resize wiring */
  let scrollQueued = false;
  addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => {
      scrollQueued = false;
      paintWords();
      paintPortrait();
    });
  }, { passive: true });

  function layout() {
    fitText();
    paintPortrait();
    paintWords();
  }
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 80);
  });
  wideScreen.addEventListener('change', layout);
  reducedMotion.addEventListener('change', layout);
  addEventListener('load', layout);

  let started = false;
  function start() {
    if (started) return;
    started = true;
    layout();
    requestAnimationFrame(() => root.classList.add('is-ready'));
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  setTimeout(start, 1500);
  layout();

  /* Project sheet */
  const sheet = $('#sheet');
  const sheetBody = $('#sheet-body');
  let sheetOpener = null;
  function openSheet(trigger) {
    const detail = $('.project__detail', trigger.parentElement);
    if (!detail) return;
    sheetBody.innerHTML = detail.innerHTML;
    $('.detail__title', sheetBody).id = 'sheet-title';
    sheetOpener = trigger;
    sheet.showModal();
    $('.sheet__panel', sheet).scrollTop = 0;
    // Commit the off-screen position before starting the entrance transition.
    sheet.getBoundingClientRect();
    sheet.classList.add('is-open');
  }
  function closeSheet() {
    if (!sheet.open || !sheet.classList.contains('is-open')) return;
    sheet.classList.remove('is-open');
    const done = () => {
      sheet.close();
      if (sheetOpener) sheetOpener.focus({ preventScroll: true });
    };
    if (reducedMotion.matches) done();
    else setTimeout(done, 420);
  }
  $$('[data-project]').forEach((btn) => btn.addEventListener('click', () => openSheet(btn)));
  $('.sheet__close', sheet).addEventListener('click', closeSheet);
  sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

  /* "View" badge that follows the pointer over project covers. */
  const peek = $('#peek');
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.project').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        peek.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        peek.classList.toggle('on', !!e.target.closest('.project'));
      });
      card.addEventListener('pointerleave', () => peek.classList.remove('on'));
    });
    addEventListener('scroll', () => peek.classList.remove('on'), { passive: true });
  }

  /* Contact form: posts to data-endpoint when one is set, otherwise drafts an email. */
  const form = $('#contact-form');
  const note = $('#form-note');
  const messages = {
    name: 'Add your name.',
    email: 'Enter an email address like name@example.com.',
    message: 'Tell me a little about the project.',
  };
  function validate(field) {
    const error = $(`#e-${field.name}`);
    const bad = !field.value.trim() || !field.checkValidity();
    field.setAttribute('aria-invalid', String(bad));
    if (bad) field.setAttribute('aria-describedby', error.id);
    else field.removeAttribute('aria-describedby');
    error.hidden = !bad;
    error.textContent = bad ? messages[field.name] : '';
    return !bad;
  }
  const fields = $$('input, textarea', form);
  fields.forEach((field) => {
    field.addEventListener('input', () => {
      if (field.getAttribute('aria-invalid') === 'true') validate(field);
    });
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalid = fields.filter((field) => !validate(field));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    const endpoint = form.dataset.endpoint;
    note.classList.remove('is-done');
    if (endpoint) {
      note.textContent = 'Sending your message.';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        note.textContent = 'Message sent. I’ll reply by email.';
        note.classList.add('is-done');
      } catch {
        note.textContent = `The message didn’t send. Email ${form.dataset.to} instead.`;
      }
      return;
    }
    const subject = `Portfolio enquiry from ${data.name}`;
    const body = `${data.message}\n\n${data.name}\n${data.email}`;
    location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    note.textContent = 'Your email app has the message ready. Press send there to deliver it.';
    note.classList.add('is-done');
  });

  /* Lahore local time in the footer */
  const clock = $('#clock');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit' });
    const paintClock = () => { clock.textContent = fmt.format(new Date()); };
    paintClock();
    setInterval(paintClock, 30000);
  }
})();
