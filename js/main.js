/* L'Essence Skin Clinic — interações
   Módulos pequenos e independentes, iniciados no fim do arquivo. */

const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Header: sombra ao rolar */
function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;
  const atualizar = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  atualizar();
  window.addEventListener('scroll', atualizar, { passive: true });
}

/* Menu mobile */
function initMenu() {
  const botao = document.querySelector('.menu-toggle');
  const nav = document.getElementById('menu');
  if (!botao || !nav) return;

  const icone = botao.querySelector('use');
  const definir = (aberto) => {
    nav.classList.toggle('is-open', aberto);
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    icone.setAttribute('href', aberto ? '#i-close' : '#i-menu');
  };

  botao.addEventListener('click', () => definir(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) definir(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { definir(false); botao.focus(); }
  });
  window.matchMedia('(min-width: 960px)').addEventListener('change', () => definir(false));
}

/* Link ativo no menu conforme a seção visível */
function initLinkAtivo() {
  const links = [...document.querySelectorAll('.nav__list a')];
  const secoes = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (!('IntersectionObserver' in window) || !secoes.length) return;

  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((ent) => {
      if (!ent.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${ent.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  secoes.forEach((s) => obs.observe(s));
}

/* Revelar ligado à rolagem: cada .reveal recebe --p (0 a 1) conforme a posição
   na tela. Desce = a animação se faz; sobe = se desfaz, acompanhando roda/dedo. */
let remedirReveal = () => {};

function initReveal() {
  const itens = [...document.querySelectorAll('.reveal')];
  if (!itens.length) return;
  if (reduzMovimento) { itens.forEach((el) => el.style.setProperty('--p', '1')); return; }

  const raiz = document.documentElement;
  // escalonamento: itens lado a lado entram um pouco depois do anterior
  const atrasoDe = (el) => {
    const irmaos = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    return Math.min(irmaos.indexOf(el) % 4, 3) * 0.15;
  };
  // posição no documento sem o deslocamento da própria animação (offsetTop ignora transform)
  const topoNoDoc = (el) => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };

  const dados = itens.map((el) => ({ el, topo: 0, atraso: atrasoDe(el), p: -1 }));
  let agendado = false;

  const atualizar = () => {
    agendado = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const faixa = vh * 0.3;                              // quanto rolar para completar a entrada
    const noFim = y + vh >= raiz.scrollHeight - 4;       // no fim da página tudo aparece
    dados.forEach((d) => {
      const bruto = noFim ? 1 : (y + vh - d.topo) / faixa - d.atraso;
      const p = Math.round(Math.min(Math.max(bruto, 0), 1) * 1000) / 1000;
      if (p !== d.p) { d.p = p; d.el.style.setProperty('--p', p); }
    });
  };
  const agendar = () => { if (!agendado) { agendado = true; requestAnimationFrame(atualizar); } };

  remedirReveal = () => { dados.forEach((d) => { d.topo = topoNoDoc(d.el); }); agendar(); };

  window.addEventListener('scroll', agendar, { passive: true });
  window.addEventListener('resize', remedirReveal);
  window.addEventListener('load', remedirReveal);
  if ('ResizeObserver' in window) new ResizeObserver(remedirReveal).observe(document.body);
  remedirReveal();
}

/* Contador animado nas estatísticas: conta ao entrar descendo, zera ao sair por baixo */
function initContadores() {
  const numeros = document.querySelectorAll('[data-count]');
  const formatar = (n) => n.toLocaleString('pt-BR');

  if (reduzMovimento || !('IntersectionObserver' in window)) return;

  const quadros = new WeakMap();
  const parar = (el) => cancelAnimationFrame(quadros.get(el));

  const animar = (el) => {
    parar(el);
    const alvo = Number(el.dataset.count);
    const duracao = 1400;
    const inicio = performance.now();
    const passo = (agora) => {
      const t = Math.min((agora - inicio) / duracao, 1);
      const suave = 1 - Math.pow(1 - t, 3);
      el.textContent = formatar(Math.round(alvo * suave));
      if (t < 1) quadros.set(el, requestAnimationFrame(passo));
    };
    quadros.set(el, requestAnimationFrame(passo));
  };

  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((ent) => {
      const el = ent.target;
      if (ent.isIntersecting && !el.dataset.contado) {
        el.dataset.contado = '1';
        animar(el);
      } else if (!ent.isIntersecting && ent.boundingClientRect.top > 0) {
        // saiu pela parte de baixo da tela (rolando para cima): desfaz
        parar(el);
        delete el.dataset.contado;
        el.textContent = '0';
      }
    });
  }, { threshold: 0.6 });

  numeros.forEach((el) => {
    el.textContent = '0';
    obs.observe(el);
  });
}

/* Filtro de tratamentos */
function initFiltros() {
  const botoes = document.querySelectorAll('.filtro');
  const cards = document.querySelectorAll('#lista-servicos .card');
  if (!botoes.length) return;

  // libera o transform do reveal ao fim da animação do filtro
  cards.forEach((card) => card.addEventListener('animationend', () => card.classList.remove('is-entering')));

  botoes.forEach((botao) => {
    botao.addEventListener('click', () => {
      const filtro = botao.dataset.filter;
      botoes.forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));

      cards.forEach((card) => {
        const mostra = filtro === 'todos' || card.dataset.cat.split(' ').includes(filtro);
        card.hidden = !mostra;
        if (mostra && !reduzMovimento) {
          card.classList.remove('is-entering');
          void card.offsetWidth; // reinicia a animação
          card.classList.add('is-entering');
        }
      });
      remedirReveal(); // o grid mudou de altura
    });
  });
}

/* Carrossel de depoimentos (rolagem nativa + botões) */
function initCarrossel() {
  const trilho = document.getElementById('lista-depoimentos');
  const botoes = document.querySelectorAll('.carousel-btn');
  if (!trilho || !botoes.length) return;

  const passo = () => {
    const item = trilho.querySelector('.quote');
    const gap = parseFloat(getComputedStyle(trilho).columnGap) || 0;
    return item ? item.getBoundingClientRect().width + gap : trilho.clientWidth;
  };

  const atualizar = () => {
    const max = trilho.scrollWidth - trilho.clientWidth - 2;
    botoes[0].disabled = trilho.scrollLeft <= 2;
    botoes[1].disabled = trilho.scrollLeft >= max;
  };

  botoes.forEach((b) => b.addEventListener('click', () => {
    trilho.scrollBy({ left: passo() * Number(b.dataset.dir), behavior: reduzMovimento ? 'auto' : 'smooth' });
  }));

  trilho.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      trilho.scrollBy({ left: passo() * (e.key === 'ArrowRight' ? 1 : -1), behavior: reduzMovimento ? 'auto' : 'smooth' });
    }
  });

  trilho.addEventListener('scroll', atualizar, { passive: true });
  window.addEventListener('resize', atualizar);
  atualizar();
}

/* Newsletter (sem backend: só valida e confirma) */
function initNewsletter() {
  const form = document.querySelector('.news');
  if (!form) return;
  const campo = form.querySelector('input');
  const msg = form.querySelector('.news__msg');
  const padrao = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = campo.value.trim();

    if (!padrao.test(email)) {
      campo.setAttribute('aria-invalid', 'true');
      msg.className = 'news__msg is-error';
      msg.textContent = 'Digite um e-mail válido, como nome@email.com.';
      campo.focus();
      return;
    }

    // Integração futura: enviar `email` para o serviço de newsletter aqui.
    campo.removeAttribute('aria-invalid');
    campo.value = '';
    msg.className = 'news__msg is-ok';
    msg.textContent = 'Inscrição confirmada. A primeira dica chega no próximo envio.';
  });

  campo.addEventListener('input', () => {
    if (campo.getAttribute('aria-invalid') === 'true' && padrao.test(campo.value.trim())) {
      campo.removeAttribute('aria-invalid');
      msg.className = 'news__msg';
      msg.textContent = 'Uma mensagem por mês, sem spam.';
    }
  });
}

/* CTA flutuante do WhatsApp: entra depois da abertura do hero */
function initWhatsFloat() {
  const botao = document.querySelector('.whats-float');
  if (!botao) return;
  const mostrar = () => botao.classList.add('is-shown');
  reduzMovimento ? mostrar() : setTimeout(mostrar, 1200);
}

/* Ano atual no rodapé */
function initAno() {
  const ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();
}

initHeader();
initMenu();
initLinkAtivo();
initReveal();
initContadores();
initFiltros();
initCarrossel();
initNewsletter();
initWhatsFloat();
initAno();
