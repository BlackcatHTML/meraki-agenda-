/* ============================================================
   APP — router, telas e interacoes.
   ============================================================ */
(function () {
  'use strict';

  var S = window.Store;
  S.load();

  // Aparece na aba Notas. Serve pra saber, de olho, qual versao esta rodando.
  var VERSION = (window.MERAKI_CONFIG || {}).VERSION || '—';

  var view = document.getElementById('view');
  var tabbar = document.getElementById('tabbar');
  var sheetWrap = document.getElementById('sheetWrap');
  var sheetBody = document.getElementById('sheetBody');
  var sheetTitle = document.getElementById('sheetTitle');
  var toastEl = document.getElementById('toast');

  /* ---------- utilitarios ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  var ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 13a4 4 0 006 .5l2.5-2.5a4 4 0 00-5.7-5.7L11.5 6.6"/><path d="M14 11a4 4 0 00-6-.5L5.5 13a4 4 0 005.7 5.7l1.3-1.3"/></svg>',
    open: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
    paste: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-2"/></svg>'
  };

  var toastTimer = null;
  function Toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }
  window.Toast = Toast;

  /* ---------- bottom sheet ---------- */
  var sheetOnClose = null;
  function openSheet(title, html, onMount) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = html;
    sheetWrap.hidden = false;
    document.body.style.overflow = 'hidden';
    if (onMount) onMount(sheetBody);
    var first = sheetBody.querySelector('input,textarea,select');
    if (first && !('ontouchstart' in window)) first.focus();
  }
  function closeSheet() {
    sheetWrap.hidden = true;
    sheetBody.innerHTML = '';
    document.body.style.overflow = '';
    if (sheetOnClose) { var f = sheetOnClose; sheetOnClose = null; f(); }
  }
  sheetWrap.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-sheet]')) closeSheet();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !sheetWrap.hidden) closeSheet();
  });

  /* ============================================================
     TELA: HOJE
     ============================================================ */
  function viewHoje() {
    var t = S.today();
    var tasks = S.tasksOn(t);
    var charges = S.pendingCharges();
    var overdue = S.overdueTasks();
    var pend = tasks.filter(function (x) { return !S.isDone(x, t); });
    var prod = S.productionsOfWeek(t);
    var travando = prod.filter(function (p) { return p.stage !== 'postado'; }).length;
    var prio = S.clientsByPriority().filter(function (r) { return r.calc.severity === 3; });

    var h = '';
    h += '<h1 class="page-title">' + esc(cap(S.fmtLong(t))) + '</h1>';
    h += '<p class="page-sub">' + (pend.length ? pend.length + ' tarefa' + (pend.length > 1 ? 's' : '') + ' em aberto hoje.' : 'Nada em aberto hoje.') + '</p>';

    h += '<div class="metrics">' +
      metric(pend.length, 'Tarefas hoje', pend.length > 0) +
      metric(charges.length, 'Cobranças', charges.length > 0) +
      metric(travando, 'Vídeos na fila', false) +
      '</div>';

    // Cobrancas em destaque
    h += '<section class="section">' +
      secHead('Cobranças pendentes', charges.length) +
      (charges.length ? charges.map(chargeCard).join('') :
        '<div class="empty">Ninguém devendo nada. Aproveita.</div>') +
      '</section>';

    // Posts combinados pra hoje — vem da agenda de cada cliente
    var posts = S.postsDoDia(t);
    if (posts.length) {
      var faltando = posts.filter(function (x) { return !x.pronto; }).length;
      h += '<section class="section">' + secHead('Posts de hoje', faltando + '/' + posts.length);
      h += posts.map(function (x) {
        var p = x.production;
        var meta = [];
        // Sem conteúdo, o título já é o nome do cliente — não repete embaixo.
        if (p) meta.push('<span>' + esc(x.client.name) + '</span>');
        if (p) {
          meta.push('<span class="badge">' + esc(stageLabel(p.stage)) + '</span>');
          meta.push('<span>' + (x.pronto ? 'post configurado' : 'falta configurar o post') + '</span>');
        } else {
          meta.push('<span class="badge b-alert">sem conteúdo pra hoje</span>');
        }
        return '<a class="item" data-accent="' + (x.pronto ? 'ok' : 'alert') + '" href="#/cliente/' + x.client.id + '">' +
          '<div class="item-main">' +
          '<p class="item-title">' + esc(p ? p.title : x.client.name) + '</p>' +
          '<div class="item-meta">' + meta.join('') + '</div>' +
          '</div>' +
          '<div class="item-actions"><span class="icon-btn" aria-hidden="true">' + ICON.open + '</span></div>' +
          '</a>';
      }).join('');
      h += '</section>';
    }

    // Tarefas do dia
    h += '<section class="section">' + secHead('Tarefas de hoje', tasks.length);
    h += tasks.length ? tasks.map(function (x) { return taskItem(x, t); }).join('')
      : '<div class="empty">Dia limpo. Adicione algo se precisar.</div>';
    h += '</section>';

    // Atrasadas
    if (overdue.length) {
      h += '<section class="section">' + secHead('Ficou pra trás', overdue.length) +
        overdue.map(function (x) { return taskItem(x, x.date, true); }).join('') +
        '</section>';
    }

    // Clientes criticos
    if (prio.length) {
      h += '<section class="section">' + secHead('Clientes sem conteúdo', prio.length) +
        prio.map(function (r) {
          return '<a class="item" data-accent="alert" href="#/clientes">' +
            '<div class="item-main"><p class="item-title">' + esc(r.client.name) + '</p>' +
            '<div class="item-meta"><span class="badge b-alert">' + esc(r.calc.status) + '</span>' +
            '<span>' + r.calc.produced + '/' + r.calc.needed + ' vídeos</span></div></div></a>';
        }).join('') + '</section>';
    }

    h += '<button class="btn" data-act="new-task">' + ICON.plus + 'Adicionar tarefa</button>';

    view.innerHTML = h;
  }

  function metric(n, label, hot) {
    return '<div class="metric"><div class="metric-n' + (hot ? ' hot' : '') + '">' + n + '</div>' +
      '<div class="metric-l">' + esc(label) + '</div></div>';
  }
  function secHead(title, count) {
    return '<div class="section-head"><h2 class="section-title">' + esc(title) + '</h2>' +
      (count != null ? '<span class="section-count">' + count + '</span>' : '') + '</div>';
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function chargeCard(c) {
    var late = c.late;
    var tag = late === 0 ? 'para hoje' : late === 1 ? '1 dia atrasada' : late + ' dias atrasada';
    return '<div class="item cobranca" data-id="' + c.task.id + '">' +
      checkBtn(c.task.id, c.date, false) +
      '<div class="item-main">' +
      '<p class="item-title">' + esc(c.task.title) + '</p>' +
      '<div class="item-meta">' +
      (c.task.who ? '<span class="badge">' + esc(c.task.who) + '</span>' : '') +
      '<span>' + esc(tag) + '</span>' +
      (c.task.time ? '<span class="sep">·</span><span>' + esc(c.task.time) + '</span>' : '') +
      '</div></div>' +
      '<div class="item-actions"><button class="icon-btn" data-act="edit-task" data-id="' + c.task.id + '" aria-label="Editar">' + ICON.edit + '</button></div>' +
      '</div>';
  }

  function checkBtn(id, date, done) {
    return '<button class="check" data-act="toggle" data-id="' + id + '" data-date="' + date + '" ' +
      'aria-pressed="' + (done ? 'true' : 'false') + '" aria-label="Concluir">' + ICON.check + '</button>';
  }

  function taskItem(task, date, showDate, hideClient) {
    var done = S.isDone(task, date);
    var meta = [];
    if (showDate) meta.push('<span class="badge b-alert">' + esc(S.fmtRelative(date)) + '</span>');
    if (task.time) meta.push('<span>' + esc(task.time) + '</span>');
    if (task.repeat === 'daily') meta.push('<span>diária</span>');
    if (task.repeat === 'weekly') meta.push('<span>toda ' + esc(weekdayName(task.date)) + '</span>');
    if (task.who) meta.push('<span class="badge">' + esc(task.who) + '</span>');
    if (task.clientId && !hideClient) meta.push('<span>' + esc(S.clientName(task.clientId)) + '</span>');

    return '<div class="item' + (done ? ' is-done' : '') + '"' +
      (task.kind === 'cobranca' ? ' data-accent="cobranca"' : '') + '>' +
      checkBtn(task.id, date, done) +
      '<div class="item-main"><p class="item-title">' + esc(task.title) + '</p>' +
      (meta.length ? '<div class="item-meta">' + meta.join('') + '</div>' : '') +
      '</div>' +
      '<div class="item-actions">' +
      '<button class="icon-btn" data-act="edit-task" data-id="' + task.id + '" aria-label="Editar">' + ICON.edit + '</button>' +
      '</div></div>';
  }

  function weekdayName(dateStr) {
    var d = S.parse(dateStr);
    if (!d) return '';
    return ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][d.getDay()];
  }

  /* ============================================================
     TELA: TAREFAS
     ============================================================ */
  var taskFilter = { mode: 'hoje', date: S.today() };

  function viewTarefas() {
    var h = '';
    h += '<h1 class="page-title">Tarefas</h1>';
    h += '<p class="page-sub">Tudo que precisa ser feito, com recorrência.</p>';

    h += '<div class="chips">' +
      chip('hoje', 'Hoje') + chip('semana', 'Semana') +
      chip('todas', 'Todas') + chip('cobrancas', 'Cobranças') +
      chip('data', 'Por data') +
      '</div>';

    if (taskFilter.mode === 'data') {
      h += '<div class="field"><label for="filterDate">Escolher data</label>' +
        '<input class="input" type="date" id="filterDate" value="' + taskFilter.date + '"></div>';
    }

    var groups = buildTaskGroups();
    if (!groups.length) {
      h += '<div class="empty">Nada aqui com esse filtro.</div>';
    } else {
      groups.forEach(function (g) {
        h += '<section class="section">' + secHead(g.label, g.items.length) +
          g.items.map(function (it) { return taskItem(it.task, it.date, g.showDate); }).join('') +
          '</section>';
      });
    }

    h += '<button class="btn" data-act="new-task">' + ICON.plus + 'Nova tarefa</button>';
    view.innerHTML = h;

    var fd = document.getElementById('filterDate');
    if (fd) fd.addEventListener('change', function () {
      taskFilter.date = fd.value || S.today();
      viewTarefas();
    });
  }

  function chip(id, label) {
    return '<button class="chip" data-act="task-filter" data-mode="' + id + '" ' +
      'aria-pressed="' + (taskFilter.mode === id ? 'true' : 'false') + '">' + esc(label) + '</button>';
  }

  function buildTaskGroups() {
    var t = S.today();
    var st = S.state;

    if (taskFilter.mode === 'hoje') {
      var items = S.tasksOn(t).map(function (x) { return { task: x, date: t }; });
      return items.length ? [{ label: 'Hoje · ' + S.fmtShort(t), items: items, showDate: false }] : [];
    }

    if (taskFilter.mode === 'data') {
      var d = taskFilter.date;
      var its = S.tasksOn(d).map(function (x) { return { task: x, date: d }; });
      return its.length ? [{ label: cap(S.fmtLong(d)), items: its, showDate: false }] : [];
    }

    if (taskFilter.mode === 'semana') {
      var out = [];
      for (var i = 0; i < 7; i++) {
        var day = S.addDays(S.weekStart(t), i);
        var list = S.tasksOn(day).map(function (x) { return { task: x, date: day }; });
        if (list.length) out.push({ label: cap(S.fmtLong(day)), items: list, showDate: false });
      }
      return out;
    }

    if (taskFilter.mode === 'cobrancas') {
      var ch = st.tasks.filter(function (x) { return x.kind === 'cobranca'; })
        .map(function (x) { return { task: x, date: x.date }; });
      return ch.length ? [{ label: 'Todas as cobranças', items: ch, showDate: true }] : [];
    }

    // todas
    var all = st.tasks.slice().sort(function (a, b) {
      return (a.date || '') < (b.date || '') ? -1 : 1;
    }).map(function (x) { return { task: x, date: x.date }; });
    return all.length ? [{ label: 'Todas as tarefas', items: all, showDate: true }] : [];
  }

  /* ---------- formulario de tarefa ---------- */
  function taskForm(id, preset) {
    preset = preset || {};
    var t = id ? S.find('tasks', id) : null;
    var isNew = !t;
    t = t || {
      title: '', date: S.today(), time: '', repeat: 'none',
      kind: 'task', who: '', clientId: preset.clientId || '', done: false, doneDates: []
    };

    var html = '' +
      '<form id="taskForm">' +
      '<div class="field"><label for="f-title">O que precisa ser feito</label>' +
      '<input class="input" id="f-title" required maxlength="140" value="' + esc(t.title) + '" placeholder="Ex.: cobrar edição do Victor"></div>' +
      '<div class="row-2">' +
      '<div class="field"><label for="f-date">Data</label>' +
      '<input class="input" type="date" id="f-date" required value="' + esc(t.date || S.today()) + '"></div>' +
      '<div class="field"><label for="f-time">Horário</label>' +
      '<input class="input" type="time" id="f-time" value="' + esc(t.time || '') + '"></div>' +
      '</div>' +
      '<div class="row-2">' +
      '<div class="field"><label for="f-repeat">Recorrência</label>' +
      '<select class="input" id="f-repeat">' +
      opt('none', 'Nenhuma', t.repeat) + opt('daily', 'Diária', t.repeat) + opt('weekly', 'Semanal', t.repeat) +
      '</select></div>' +
      '<div class="field"><label for="f-kind">Tipo</label>' +
      '<select class="input" id="f-kind">' +
      opt('task', 'Tarefa', t.kind) + opt('cobranca', 'Cobrança', t.kind) +
      '</select></div>' +
      '</div>' +
      '<div class="field"><label for="f-who">Cobrar quem (opcional)</label>' +
      '<input class="input" id="f-who" maxlength="40" value="' + esc(t.who || '') + '" placeholder="Victor, Joe, cliente..."></div>' +
      '<div class="field"><label for="f-client">Cliente (opcional)</label>' +
      '<select class="input" id="f-client">' + clientOptions(t.clientId) + '</select></div>' +
      '<button class="btn" type="submit">' + (isNew ? 'Criar tarefa' : 'Salvar') + '</button>' +
      (isNew ? '' : '<div style="height:10px"></div><button class="btn danger" type="button" data-act="delete-task" data-id="' + t.id + '">' + ICON.trash + 'Excluir</button>') +
      '</form>';

    openSheet(isNew ? 'Nova tarefa' : 'Editar tarefa', html, function (root) {
      root.querySelector('#taskForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var title = root.querySelector('#f-title').value.trim();
        if (!title) return;
        S.upsert('tasks', {
          id: t.id,
          title: title,
          date: root.querySelector('#f-date').value || S.today(),
          time: root.querySelector('#f-time').value,
          repeat: root.querySelector('#f-repeat').value,
          kind: root.querySelector('#f-kind').value,
          who: root.querySelector('#f-who').value.trim(),
          clientId: root.querySelector('#f-client').value,
          done: t.done || false,
          doneDates: t.doneDates || []
        });
        closeSheet();
        render();
        Toast(isNew ? 'Tarefa criada' : 'Tarefa salva');
      });
    });
  }

  function opt(val, label, cur) {
    return '<option value="' + val + '"' + (cur === val ? ' selected' : '') + '>' + esc(label) + '</option>';
  }

  // Lista de clientes para <select>, com a opcao "nenhum" na frente.
  function clientOptions(selected, emptyLabel) {
    return opt('', emptyLabel || '— nenhum —', selected || '') +
      S.state.clients.slice().sort(function (a, b) {
        return (a.name || '').localeCompare(b.name || '');
      }).map(function (c) {
        return opt(c.id, c.name, selected || '');
      }).join('');
  }

  /* ============================================================
     TELA: PRODUCAO DA SEMANA
     ============================================================ */
  var weekRef = S.today();

  function viewProducao() {
    var a = S.weekStart(weekRef), b = S.weekEnd(weekRef);
    var list = S.productionsOfWeek(weekRef);
    var postados = list.filter(function (p) { return p.stage === 'postado'; }).length;

    var h = '';
    h += '<h1 class="page-title">Produção da semana</h1>';
    h += '<p class="page-sub">' + esc(S.fmtShort(a)) + ' a ' + esc(S.fmtShort(b)) +
      ' · ' + postados + ' de ' + list.length + ' postado' + (postados === 1 ? '' : 's') + '</p>';

    h += '<div class="chips">' +
      '<button class="chip" data-act="week" data-delta="-7">&larr; Semana anterior</button>' +
      '<button class="chip" data-act="week" data-delta="0" aria-pressed="' + (S.weekStart(S.today()) === a ? 'true' : 'false') + '">Esta semana</button>' +
      '<button class="chip" data-act="week" data-delta="7">Próxima &rarr;</button>' +
      '</div>';

    h += '<section class="section">' + secHead('Conteúdos', list.length);
    h += list.length ? list.map(prodCard).join('') :
      '<div class="empty">Nenhum conteúdo nessa semana ainda.</div>';
    h += '</section>';

    h += '<button class="btn" data-act="new-prod">' + ICON.plus + 'Novo conteúdo</button>';

    // O relatorio de trafego saiu daqui: virou cobranca na aba Equipe,
    // vinculada a quem entrega e a qual cliente.
    var abertas = S.openDemands();
    if (abertas.length) {
      h += '<div class="divider"></div>';
      h += '<section class="section">' + secHead('Esperando a equipe', abertas.length);
      h += abertas.slice(0, 4).map(function (d) { return demandItem(d, true); }).join('');
      h += '<div style="height:10px"></div>';
      h += '<button class="btn ghost" data-act="go" data-hash="#/equipe">Ver a equipe</button>';
      h += '</section>';
    }

    view.innerHTML = h;
  }

  function prodCard(p) {
    var st = S.STAGES;
    var idx = st.findIndex(function (s) { return s.id === p.stage; });
    var accent = p.stage === 'postado' ? 'ok' : (idx <= 1 ? 'warn' : '');

    var h = '<div class="item" style="display:block"' + (accent ? ' data-accent="' + accent + '"' : '') + ' data-id="' + p.id + '">';
    h += '<div style="display:flex;gap:12px;align-items:flex-start">';
    h += '<div class="item-main"><p class="item-title">' + esc(p.title) + '</p>' +
      '<div class="item-meta">' +
      '<span class="badge">' + esc(S.clientName(p.clientId)) + '</span>' +
      (p.postDate ? '<span>post ' + esc(S.fmtShort(p.postDate)) + '</span>' : '<span>sem data de post</span>') +
      '</div></div>';
    h += '<div class="item-actions">' +
      '<button class="icon-btn" data-act="edit-prod" data-id="' + p.id + '" aria-label="Editar">' + ICON.edit + '</button>' +
      '</div>';
    h += '</div>';

    h += '<div class="stages">' + st.map(function (s) {
      return '<button class="stage" data-act="set-stage" data-id="' + p.id + '" data-stage="' + s.id + '" ' +
        'aria-pressed="' + (p.stage === s.id ? 'true' : 'false') + '">' + esc(s.label) + '</button>';
    }).join('') + '</div>';

    h += '<div style="margin-top:6px">';
    h += switchRow('victorOk', p.id, 'Victor confirmou edição', p.victorOk);
    h += switchRow('postOk', p.id, 'Post configurado', p.postOk);
    h += '</div>';

    h += '</div>';
    return h;
  }

  function switchRow(field, id, label, on) {
    return '<button class="switch-row" type="button" data-act="toggle-flag" data-field="' + field + '" ' +
      'data-id="' + id + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
      '<span class="box">' + ICON.check + '</span>' +
      '<span class="sr-label">' + esc(label) + '</span></button>';
  }

  function prodForm(id, preset) {
    preset = preset || {};
    var p = id ? S.find('productions', id) : null;
    var isNew = !p;
    p = p || {
      title: '',
      clientId: preset.clientId || (S.state.clients[0] || {}).id || '',
      stage: 'roteiro',
      victorOk: false, postOk: false,
      postDate: preset.postDate || ''
    };

    var clientOptions = S.state.clients.length
      ? S.state.clients.map(function (c) {
          return '<option value="' + c.id + '"' + (p.clientId === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
        }).join('')
      : '<option value="">Cadastre um cliente primeiro</option>';

    var html = '<form id="prodForm">' +
      '<div class="field"><label for="p-title">Conteúdo / vídeo</label>' +
      '<input class="input" id="p-title" required maxlength="140" value="' + esc(p.title) + '" placeholder="Ex.: Reels 3 mitos sobre lentes"></div>' +
      '<div class="field"><label for="p-client">Cliente</label>' +
      '<select class="input" id="p-client">' + clientOptions + '</select></div>' +
      '<div class="row-2">' +
      '<div class="field"><label for="p-stage">Etapa</label><select class="input" id="p-stage">' +
      S.STAGES.map(function (s) { return opt(s.id, s.label, p.stage); }).join('') +
      '</select></div>' +
      '<div class="field"><label for="p-date">Data do post</label>' +
      '<input class="input" type="date" id="p-date" value="' + esc(p.postDate || '') + '"></div>' +
      '</div>' +
      '<button class="btn" type="submit">' + (isNew ? 'Adicionar' : 'Salvar') + '</button>' +
      (isNew ? '' : '<div style="height:10px"></div><button class="btn danger" type="button" data-act="delete-prod" data-id="' + p.id + '">' + ICON.trash + 'Excluir</button>') +
      '</form>';

    openSheet(isNew ? 'Novo conteúdo' : 'Editar conteúdo', html, function (root) {
      root.querySelector('#prodForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var title = root.querySelector('#p-title').value.trim();
        if (!title) return;
        S.upsert('productions', {
          id: p.id,
          title: title,
          clientId: root.querySelector('#p-client').value,
          stage: root.querySelector('#p-stage').value,
          postDate: root.querySelector('#p-date').value,
          victorOk: p.victorOk || false,
          postOk: p.postOk || false
        });
        closeSheet();
        render();
        Toast(isNew ? 'Conteúdo adicionado' : 'Conteúdo salvo');
      });
    });
  }

  /* ============================================================
     TELA: CLIENTES
     ============================================================ */
  function viewClientes() {
    var rows = S.clientsByPriority();
    var h = '';
    h += '<h1 class="page-title">Clientes</h1>';
    h += '<p class="page-sub">Quem está mais atrasado aparece primeiro.</p>';

    if (!rows.length) {
      h += '<div class="empty">Nenhum cliente cadastrado ainda.</div>';
    } else {
      h += rows.map(clientCard).join('');
    }

    h += '<div style="height:14px"></div>';
    h += '<button class="btn" data-act="new-client">' + ICON.plus + 'Novo cliente</button>';
    view.innerHTML = h;
  }

  // Um contador que ela mexe com o polegar, sem abrir formulário.
  function stepper(clientId, field, label, value, alvo) {
    return '<div class="stepper">' +
      '<span class="stepper-label">' + esc(label) + '</span>' +
      '<div class="stepper-row">' +
      '<button class="stepper-btn" data-act="bump" data-id="' + clientId + '" data-field="' + field + '" data-delta="-1" aria-label="Menos um">&minus;</button>' +
      '<b class="stepper-n">' + value + (alvo != null ? '<i>/' + alvo + '</i>' : '') + '</b>' +
      '<button class="stepper-btn" data-act="bump" data-id="' + clientId + '" data-field="' + field + '" data-delta="1" aria-label="Mais um">+</button>' +
      '</div></div>';
  }

  function clientCard(r) {
    var c = r.client, k = r.calc;
    var pct = k.needed > 0 ? Math.min(100, Math.round((k.produced / k.needed) * 100)) : 0;
    var barClass = pct >= 100 ? 'bar full' : (pct < 40 ? 'bar low' : 'bar');

    var nLinks = S.linksOf(c.id).length;
    var nTasks = S.tasksOfClient(c.id).filter(function (t) { return !S.isDone(t, S.today()); }).length;
    var nEquipe = S.demandsOfClient(c.id).filter(function (d) { return d.status === 'pendente'; }).length;

    var h = '<div class="item" style="display:block" data-accent="' + k.accent + '">';

    // Só o cabeçalho abre a ficha — os contadores abaixo são clicáveis.
    h += '<a href="#/cliente/' + c.id + '" style="display:flex;gap:12px;align-items:flex-start">';
    h += '<div class="item-main">' +
      '<p class="item-title">' + esc(c.name) + '</p>' +
      '<div class="item-meta">' +
      '<span class="badge b-' + k.accent + '">' + esc(k.status) + '</span>' +
      '</div></div>';
    h += '<div class="item-actions"><span class="icon-btn" aria-hidden="true">' + ICON.open + '</span></div></a>';

    h += '<div class="steppers">' +
      stepper(c.id, 'producedWeek', 'Semana', k.producedWeek, k.neededWeek) +
      stepper(c.id, 'ready', 'Prontos', k.estoque) +
      stepper(c.id, 'scheduled', 'Agendados', k.agendados) +
      '</div>';

    var agenda = S.scheduleLabel(c);
    h += '<div class="item-meta" style="margin-top:10px">' +
      (agenda ? '<span class="badge">' + esc(agenda) + '</span>' : '') +
      '<span>' + k.produced + '/' + k.needed + ' no mês</span>' +
      (nLinks ? '<span class="sep">·</span><span>' + nLinks + ' link' + (nLinks === 1 ? '' : 's') + '</span>' : '') +
      (nTasks ? '<span class="sep">·</span><span>' + nTasks + ' a fazer</span>' : '') +
      (nEquipe ? '<span class="sep">·</span><span>' + nEquipe + ' com a equipe</span>' : '') +
      '</div>';
    h += '<div class="' + barClass + '"><i style="width:' + pct + '%"></i></div>';
    h += '</div>';
    return h;
  }

  function clientForm(id) {
    var c = id ? S.find('clients', id) : null;
    var isNew = !c;
    c = c || { name: '', produced: 0, needed: 8, producedWeek: 0, neededWeek: 2, ready: 0, scheduled: 0, notes: '' };

    var num = function (v) { return Number(v) || 0; };

    var html = '<form id="clientForm">' +
      '<div class="field"><label for="c-name">Nome do cliente</label>' +
      '<input class="input" id="c-name" required maxlength="80" value="' + esc(c.name) + '" placeholder="Ex.: Dra. Marina — Odonto"></div>' +

      '<p class="label" style="margin-top:4px">Na semana</p>' +
      '<div class="row-2">' +
      '<div class="field"><label for="c-prodw">Já feitos</label>' +
      '<input class="input" type="number" min="0" max="999" id="c-prodw" value="' + num(c.producedWeek) + '"></div>' +
      '<div class="field"><label for="c-needw">Necessários</label>' +
      '<input class="input" type="number" min="0" max="999" id="c-needw" value="' + num(c.neededWeek) + '"></div>' +
      '</div>' +

      '<p class="label" style="margin-top:4px">No mês</p>' +
      '<div class="row-2">' +
      '<div class="field"><label for="c-prod">Já feitos</label>' +
      '<input class="input" type="number" min="0" max="999" id="c-prod" value="' + num(c.produced) + '"></div>' +
      '<div class="field"><label for="c-need">Necessários</label>' +
      '<input class="input" type="number" min="0" max="999" id="c-need" value="' + num(c.needed) + '"></div>' +
      '</div>' +

      '<p class="label" style="margin-top:4px">Estoque</p>' +
      '<div class="row-2">' +
      '<div class="field"><label for="c-ready">Vídeos prontos</label>' +
      '<input class="input" type="number" min="0" max="999" id="c-ready" value="' + num(c.ready) + '"></div>' +
      '<div class="field"><label for="c-sched">Agendados</label>' +
      '<input class="input" type="number" min="0" max="999" id="c-sched" value="' + num(c.scheduled) + '"></div>' +
      '</div>' +

      '<p class="label" style="margin-top:4px">Dias de post combinados</p>' +
      '<div id="schedBox"></div>' +

      '<div class="field"><label for="c-notes">Dados e combinados</label>' +
      '<textarea class="input" id="c-notes" style="min-height:140px" placeholder="@ do perfil, dia de gravação, tom de voz, o que pode e o que não pode, contato do responsável...">' + esc(c.notes || '') + '</textarea></div>' +
      '<button class="btn" type="submit">' + (isNew ? 'Cadastrar' : 'Salvar') + '</button>' +
      (isNew ? '' : '<div style="height:10px"></div><button class="btn danger" type="button" data-act="delete-client" data-id="' + c.id + '">' + ICON.trash + 'Excluir</button>') +
      '</form>';

    // Cópia de trabalho: só entra no cliente quando ela salvar o formulário.
    var sch = {
      mode: (c.schedule && c.schedule.mode) || 'semanal',
      weekdays: ((c.schedule && c.schedule.weekdays) || []).slice(),
      dates: ((c.schedule && c.schedule.dates) || []).slice()
    };

    openSheet(isNew ? 'Novo cliente' : 'Editar cliente', html, function (root) {
      var box = root.querySelector('#schedBox');

      function pintaAgenda() {
        var h = '';
        h += '<div class="chips" style="margin-bottom:10px">' +
          '<button type="button" class="chip" data-sched="semanal" aria-pressed="' + (sch.mode === 'semanal' ? 'true' : 'false') + '">Toda semana</button>' +
          '<button type="button" class="chip" data-sched="manual" aria-pressed="' + (sch.mode === 'manual' ? 'true' : 'false') + '">Datas escolhidas</button>' +
          '</div>';

        if (sch.mode === 'semanal') {
          h += '<div class="weekdays">';
          for (var d = 0; d < 7; d++) {
            h += '<button type="button" class="wd" data-wd="' + d + '" ' +
              'aria-pressed="' + (sch.weekdays.indexOf(d) !== -1 ? 'true' : 'false') + '">' +
              S.WD_MINI[d] + '</button>';
          }
          h += '</div>';
          h += '<p class="hint">' + (sch.weekdays.length
            ? 'Posta ' + esc(S.scheduleLabel({ schedule: sch })) + '.'
            : 'Toque nos dias em que este cliente posta.') + '</p>';
        } else {
          h += '<div style="display:flex;gap:8px;align-items:flex-end">' +
            '<div class="field" style="flex:1;margin:0"><input class="input" type="date" id="sched-new"></div>' +
            '<button type="button" class="btn ghost sm" data-sched-add>Adicionar</button>' +
            '</div>';
          if (sch.dates.length) {
            h += '<div class="chips" style="margin-top:10px">';
            sch.dates.slice().sort().forEach(function (d) {
              h += '<button type="button" class="chip" data-sched-del="' + d + '">' +
                esc(S.fmtShort(d)) + ' ×</button>';
            });
            h += '</div>';
          } else {
            h += '<p class="hint">Nenhuma data marcada ainda.</p>';
          }
        }
        box.innerHTML = h;
      }

      box.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;

        if (b.hasAttribute('data-sched')) {
          sch.mode = b.getAttribute('data-sched');
          pintaAgenda();
          return;
        }
        if (b.hasAttribute('data-wd')) {
          var d = Number(b.getAttribute('data-wd'));
          var i = sch.weekdays.indexOf(d);
          if (i === -1) sch.weekdays.push(d); else sch.weekdays.splice(i, 1);
          pintaAgenda();
          return;
        }
        if (b.hasAttribute('data-sched-add')) {
          var campo = box.querySelector('#sched-new');
          var v = campo && campo.value;
          if (v && sch.dates.indexOf(v) === -1) sch.dates.push(v);
          pintaAgenda();
          return;
        }
        if (b.hasAttribute('data-sched-del')) {
          var alvo = b.getAttribute('data-sched-del');
          sch.dates = sch.dates.filter(function (x) { return x !== alvo; });
          pintaAgenda();
        }
      });

      pintaAgenda();

      root.querySelector('#clientForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = root.querySelector('#c-name').value.trim();
        if (!name) return;
        S.upsert('clients', {
          id: c.id,
          name: name,
          produced: Number(root.querySelector('#c-prod').value) || 0,
          needed: Number(root.querySelector('#c-need').value) || 0,
          producedWeek: Number(root.querySelector('#c-prodw').value) || 0,
          neededWeek: Number(root.querySelector('#c-needw').value) || 0,
          ready: Number(root.querySelector('#c-ready').value) || 0,
          scheduled: Number(root.querySelector('#c-sched').value) || 0,
          schedule: sch,
          notes: root.querySelector('#c-notes').value.trim()
        });
        closeSheet();
        render();
        Toast(isNew ? 'Cliente cadastrado' : 'Cliente salvo');
      });
    });
  }

  /* ============================================================
     TELA: LINKS
     Referencias de TikTok / Instagram, cada uma na pasta de um cliente.
     ============================================================ */
  var linkFilter = '';

  function viewLinks() {
    var all = S.linksOf();
    var list = linkFilter ? all.filter(function (l) { return l.clientId === linkFilter; }) : all;
    var semCliente = all.filter(function (l) { return !l.clientId; }).length;

    var h = '';
    h += '<h1 class="page-title">Links</h1>';
    h += '<p class="page-sub">Referências salvas na pasta de cada cliente.</p>';

    h += '<button class="btn" data-act="new-link">' + ICON.plus + 'Salvar link</button>';
    h += '<div style="height:8px"></div>';
    h += '<button class="btn ghost" data-act="paste-link">' + ICON.paste + 'Colar link copiado</button>';
    h += '<div style="height:18px"></div>';

    if (all.length) {
      h += '<div class="chips">';
      h += '<button class="chip" data-act="link-filter" data-client="" aria-pressed="' + (linkFilter ? 'false' : 'true') + '">Todos</button>';
      if (semCliente) {
        h += '<button class="chip" data-act="link-filter" data-client="__none__" ' +
          'aria-pressed="' + (linkFilter === '__none__' ? 'true' : 'false') + '">Sem cliente (' + semCliente + ')</button>';
      }
      S.state.clients.forEach(function (c) {
        var n = S.linksOf(c.id).length;
        if (!n) return;
        h += '<button class="chip" data-act="link-filter" data-client="' + c.id + '" ' +
          'aria-pressed="' + (linkFilter === c.id ? 'true' : 'false') + '">' + esc(c.name) + ' (' + n + ')</button>';
      });
      h += '</div>';
    }

    if (linkFilter === '__none__') {
      list = all.filter(function (l) { return !l.clientId; });
    }

    if (!list.length) {
      h += '<div class="empty">Nenhum link aqui ainda.<br>Compartilhe do TikTok ou do Instagram, ou cole o link acima.</div>';
    } else {
      h += list.map(function (l) { return linkItem(l, true); }).join('');
    }

    view.innerHTML = h;
  }

  function linkItem(l, showClient) {
    var p = S.platformOf(l.url);
    var meta = ['<span class="badge p-' + p.id + '">' + esc(p.label) + '</span>'];
    if (showClient) {
      meta.push('<span>' + esc(l.clientId ? S.clientName(l.clientId) : 'sem cliente') + '</span>');
    }
    if (l.createdAt) meta.push('<span>' + esc(S.fmtShort(S.iso(new Date(l.createdAt)))) + '</span>');

    return '<div class="item' + (l.used ? ' is-used' : '') + '" data-accent="' + (l.used ? 'ok' : '') + '">' +
      '<button class="check" data-act="toggle-link" data-id="' + l.id + '" ' +
      'aria-pressed="' + (l.used ? 'true' : 'false') + '" aria-label="Marcar como usado">' + ICON.check + '</button>' +
      '<div class="item-main">' +
      '<p class="item-title">' + esc(l.title || p.label + ' salvo') + '</p>' +
      '<div class="item-meta">' + meta.join('') + '</div>' +
      '<a class="link-url" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + esc(l.url) + '</a>' +
      (l.note ? '<p class="hint">' + esc(l.note) + '</p>' : '') +
      '</div>' +
      '<div class="item-actions">' +
      '<button class="icon-btn" data-act="edit-link" data-id="' + l.id + '" aria-label="Editar">' + ICON.edit + '</button>' +
      '</div></div>';
  }

  function linkForm(id, preset) {
    preset = preset || {};
    var l = id ? S.find('links', id) : null;
    var isNew = !l;
    l = l || {
      url: preset.url || '', title: preset.title || '', note: '',
      clientId: preset.clientId || '', used: false
    };

    var html = '<form id="linkForm">' +
      '<div class="field"><label for="l-url">Link</label>' +
      '<input class="input" id="l-url" required inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
      'value="' + esc(l.url) + '" placeholder="https://www.tiktok.com/..."></div>' +
      '<div class="field"><label for="l-client">Pasta do cliente</label>' +
      '<select class="input" id="l-client">' + clientOptions(l.clientId, '— sem cliente —') + '</select></div>' +
      '<div class="field"><label for="l-title">Como você chama isso</label>' +
      '<input class="input" id="l-title" maxlength="90" value="' + esc(l.title || '') + '" placeholder="Ex.: gancho bom pra vídeo de lentes"></div>' +
      '<div class="field"><label for="l-note">Por que salvou</label>' +
      '<textarea class="input" id="l-note" style="min-height:80px" placeholder="O que aproveitar: o corte, a legenda, o áudio...">' + esc(l.note || '') + '</textarea></div>' +
      '<button class="btn" type="submit">' + (isNew ? 'Salvar link' : 'Salvar') + '</button>' +
      (isNew ? '' : '<div style="height:10px"></div><button class="btn danger" type="button" data-act="delete-link" data-id="' + l.id + '">' + ICON.trash + 'Excluir</button>') +
      '</form>';

    openSheet(isNew ? 'Salvar link' : 'Editar link', html, function (root) {
      root.querySelector('#linkForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var raw = root.querySelector('#l-url').value.trim();
        var url = S.extractUrl(raw) || raw;
        if (!url) return;
        S.upsert('links', {
          id: l.id,
          url: url,
          clientId: root.querySelector('#l-client').value,
          title: root.querySelector('#l-title').value.trim(),
          note: root.querySelector('#l-note').value.trim(),
          used: l.used || false
        });
        closeSheet();
        render();
        Toast(isNew ? 'Link salvo' : 'Link atualizado');
      });
    });
  }

  /* ---------- entrada por compartilhamento ----------
     Android: share_target do manifest chega em ?st_url=...
     iPhone: Atalho da Apple abre o app em ?url=... (o README explica).
     Tambem aceita ?text= com o link no meio da frase.                */
  function readSharedParams() {
    var q = new URLSearchParams(location.search);
    var raw = q.get('st_url') || q.get('url') || q.get('st_text') || q.get('text') || '';
    var title = q.get('st_title') || q.get('title') || '';
    if (!raw) return null;

    // limpa a barra de endereco pra nao repetir o mesmo link ao recarregar
    try { history.replaceState(null, '', location.pathname + '#/links'); } catch (e) {}

    var url = S.extractUrl(raw) || raw.trim();
    if (!/^https?:\/\//i.test(url)) return null;
    return { url: url, title: title };
  }

  // Alternativa ao compartilhamento: le o link ja copiado.
  function pasteLink() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      linkForm(null);
      return;
    }
    navigator.clipboard.readText().then(function (txt) {
      var url = S.extractUrl(txt);
      if (url) linkForm(null, { url: url });
      else { Toast('Não achei um link copiado'); linkForm(null); }
    }).catch(function () {
      linkForm(null);
    });
  }

  /* ============================================================
     TELA: FICHA DO CLIENTE
     ============================================================ */
  function viewCliente(id) {
    var c = S.find('clients', id);
    if (!c) { location.hash = '#/clientes'; return; }

    var k = S.clientStatus(c);
    var tasks = S.tasksOfClient(c.id);
    var links = S.linksOf(c.id);
    var prods = S.productionsOfClient(c.id);
    var t = S.today();
    var abertas = tasks.filter(function (x) { return !S.isDone(x, t); });

    var h = '';
    h += '<button class="back" data-act="go" data-hash="#/clientes">' + ICON.back + 'Clientes</button>';

    h += '<div class="hero">';
    h += '<h1>' + esc(c.name) + '</h1>';
    h += '<span class="badge b-' + k.accent + '">' + esc(k.status) + '</span>';
    h += '<div class="kv">' +
      '<div><b>' + k.producedWeek + '/' + k.neededWeek + '</b><span>na semana</span></div>' +
      '<div><b>' + k.produced + '/' + k.needed + '</b><span>no mês</span></div>' +
      '<div><b>' + k.estoque + '</b><span>prontos</span></div>' +
      '</div>';
    h += '<div class="steppers" style="margin-top:10px">' +
      stepper(c.id, 'producedWeek', 'Semana', k.producedWeek, k.neededWeek) +
      stepper(c.id, 'ready', 'Prontos', k.estoque) +
      stepper(c.id, 'scheduled', 'Agendados', k.agendados) +
      '</div>';
    h += '<div class="hero-actions">' +
      '<button class="btn ghost" data-act="edit-client" data-id="' + c.id + '">' + ICON.edit + 'Editar</button>' +
      '<button class="btn cherry" data-act="new-task-client" data-id="' + c.id + '">' + ICON.plus + 'Tarefa</button>' +
      '</div>';
    h += '</div>';

    // O que precisa fazer por este cliente
    h += '<section class="section">' + secHead('A fazer por este cliente', abertas.length);
    h += tasks.length
      ? tasks.map(function (x) { return taskItem(x, S.occursOn(x, t) ? t : x.date, true, true); }).join('')
      : '<div class="empty">Nada pendente pra este cliente.</div>';
    h += '</section>';

    // Agenda de post combinada: cada dia previsto, com ou sem conteúdo
    var slots = S.postSlots(c, t, 14);
    h += '<section class="section">' +
      secHead('Agenda de post', S.hasSchedule(c) ? null : undefined);
    if (!S.hasSchedule(c)) {
      h += '<div class="empty">Nenhum dia combinado ainda.<br>Toque em Editar e marque em que dias este cliente posta.</div>';
    } else {
      h += '<p class="hint" style="margin:0 0 10px">' + esc(S.scheduleLabel(c)) + ' · próximos 14 dias</p>';
      h += slots.length
        ? slots.map(function (dia) { return slotItem(c, dia); }).join('')
        : '<div class="empty">Nenhum post previsto nos próximos 14 dias.</div>';
    }
    h += '</section>';

    // O que a equipe deve (ou já entregou) por esta empresa
    var daEquipe = S.demandsOfClient(c.id);
    var equipeAbertas = daEquipe.filter(function (d) { return d.status === 'pendente'; });
    h += '<section class="section">' + secHead('Equipe neste cliente', equipeAbertas.length);
    h += daEquipe.length
      ? daEquipe.map(function (d) { return demandItem(d, true); }).join('')
      : '<div class="empty">Nada cobrado da equipe por este cliente.</div>';
    h += '<div style="height:10px"></div>';
    h += '<button class="btn ghost" data-act="new-demand-client" data-id="' + c.id + '">' + ICON.plus + 'Cobrar alguém por este cliente</button>';
    h += '</section>';

    // Dados e combinados
    h += '<section class="section">' + secHead('Dados e combinados');
    h += '<div class="card">';
    h += c.notes
      ? '<div class="notes-block">' + esc(c.notes) + '</div>'
      : '<p class="hint" style="margin:0">Nada anotado ainda. Toque em Editar pra guardar @ do perfil, dia de gravação, combinados do contrato.</p>';
    h += '</div></section>';

    // Links salvos
    h += '<section class="section">' + secHead('Links salvos', links.length);
    h += links.length
      ? links.map(function (l) { return linkItem(l, false); }).join('')
      : '<div class="empty">Nenhuma referência salva pra este cliente.</div>';
    h += '<div style="height:10px"></div>';
    h += '<button class="btn ghost" data-act="new-link-client" data-id="' + c.id + '">' + ICON.link + 'Salvar link aqui</button>';
    h += '</section>';

    // Producao
    h += '<section class="section">' + secHead('Conteúdos', prods.length);
    h += prods.length
      ? prods.map(function (p) {
          return '<div class="item" data-accent="' + (p.stage === 'postado' ? 'ok' : '') + '">' +
            '<div class="item-main"><p class="item-title">' + esc(p.title) + '</p>' +
            '<div class="item-meta"><span class="badge">' + esc(stageLabel(p.stage)) + '</span>' +
            (p.postDate ? '<span>post ' + esc(S.fmtShort(p.postDate)) + '</span>' : '<span>sem data</span>') +
            '</div></div>' +
            '<div class="item-actions"><button class="icon-btn" data-act="edit-prod" data-id="' + p.id + '" aria-label="Editar">' + ICON.edit + '</button></div>' +
            '</div>';
        }).join('')
      : '<div class="empty">Nenhum conteúdo cadastrado.</div>';
    h += '</section>';

    view.innerHTML = h;
  }

  // Uma data prevista de post: mostra o conteúdo marcado pra ela, ou o vazio.
  function slotItem(c, dia) {
    var p = S.productionAt(c.id, dia);
    var hoje = dia === S.today();

    var meta = ['<span class="badge' + (hoje ? ' b-solid' : '') + '">' + esc(S.fmtShort(dia)) + '</span>'];
    if (hoje) meta.push('<span>é hoje</span>');

    if (!p) {
      return '<div class="item" data-accent="alert">' +
        '<div class="item-main">' +
        '<p class="item-title">Sem conteúdo pra este dia</p>' +
        '<div class="item-meta">' + meta.join('') + '</div>' +
        '</div>' +
        '<div class="item-actions">' +
        '<button class="icon-btn" data-act="new-prod-slot" data-id="' + c.id + '" data-date="' + dia + '" aria-label="Marcar conteúdo">' + ICON.plus + '</button>' +
        '</div></div>';
    }

    meta.push('<span class="badge">' + esc(stageLabel(p.stage)) + '</span>');
    if (p.postOk) meta.push('<span class="badge b-ok">post configurado</span>');
    else meta.push('<span>post ainda não configurado</span>');

    var accent = p.stage === 'postado' ? 'ok' : (p.postOk ? '' : 'warn');
    return '<div class="item" data-accent="' + accent + '">' +
      '<div class="item-main">' +
      '<p class="item-title">' + esc(p.title) + '</p>' +
      '<div class="item-meta">' + meta.join('') + '</div>' +
      '</div>' +
      '<div class="item-actions">' +
      '<button class="icon-btn" data-act="edit-prod" data-id="' + p.id + '" aria-label="Editar">' + ICON.edit + '</button>' +
      '</div></div>';
  }

  function stageLabel(id) {
    var s = S.STAGES.find(function (x) { return x.id === id; });
    return s ? s.label : id;
  }

  /* ============================================================
     TELA: EQUIPE
     Cada pessoa, o que ela deve entregar, pra quando, de qual cliente,
     e o histórico de quantas vezes já foi cobrada.
     ============================================================ */
  function viewEquipe() {
    var rows = S.teamByUrgency();
    var abertas = S.openDemands();
    var atrasadas = abertas.filter(S.demandLate);

    var h = '';
    h += '<h1 class="page-title">Equipe</h1>';
    h += '<p class="page-sub">Quem te deve o quê, e desde quando.</p>';

    h += '<div class="metrics">' +
      metric(rows.length, 'Pessoas', false) +
      metric(abertas.length, 'Em aberto', abertas.length > 0) +
      metric(atrasadas.length, 'Atrasadas', atrasadas.length > 0) +
      '</div>';

    if (!rows.length) {
      h += '<div class="empty">Ninguém cadastrado ainda.<br>Cadastre o Joe, o Victor, quem mais te entrega alguma coisa.</div>';
    } else {
      h += rows.map(memberCard).join('');
    }

    h += '<div style="height:14px"></div>';
    h += '<button class="btn" data-act="new-member">' + ICON.plus + 'Nova pessoa</button>';
    if (rows.length) {
      h += '<div style="height:8px"></div>';
      h += '<button class="btn ghost" data-act="new-demand">' + ICON.plus + 'Nova cobrança</button>';
    }
    view.innerHTML = h;
  }

  function memberCard(r) {
    var m = r.member, k = r.calc;
    var accent = k.atrasadas ? 'alert' : (k.abertas ? 'warn' : 'ok');

    var h = '<a class="item" style="display:block" data-accent="' + accent + '" href="#/membro/' + m.id + '">';
    h += '<div style="display:flex;gap:12px;align-items:flex-start">';
    h += '<div class="item-main"><p class="item-title">' + esc(m.name) + '</p>' +
      '<div class="item-meta">' +
      (m.role ? '<span class="badge">' + esc(m.role) + '</span>' : '') +
      (k.atrasadas ? '<span class="badge b-alert">' + k.atrasadas + ' atrasada' + (k.atrasadas === 1 ? '' : 's') + '</span>' : '') +
      '</div></div>';
    h += '<div class="item-actions"><span class="icon-btn" aria-hidden="true">' + ICON.open + '</span></div></div>';
    h += '<div class="item-meta" style="margin-top:9px">' +
      '<span>' + k.abertas + ' em aberto</span>' +
      '<span class="sep">·</span><span>' + k.entregues + ' entregue' + (k.entregues === 1 ? '' : 's') + '</span>' +
      (k.furadas ? '<span class="sep">·</span><span>' + k.furadas + ' não entregue</span>' : '') +
      '</div>';
    h += '</a>';
    return h;
  }

  /* ---------- ficha da pessoa ---------- */
  function viewMembro(id) {
    var m = S.find('team', id);
    if (!m) { location.hash = '#/equipe'; return; }

    var k = S.memberSummary(m.id);
    var todas = S.demandsOf(m.id);
    var abertas = todas.filter(function (d) { return d.status === 'pendente'; });
    var entregues = todas.filter(function (d) { return d.status === 'entregue'; });
    var furadas = todas.filter(function (d) { return d.status === 'nao-entregue'; });

    var h = '';
    h += '<button class="back" data-act="go" data-hash="#/equipe">' + ICON.back + 'Equipe</button>';

    h += '<div class="hero">';
    h += '<h1>' + esc(m.name) + '</h1>';
    if (m.role) h += '<span class="badge">' + esc(m.role) + '</span>';
    h += '<div class="kv">' +
      '<div><b>' + k.abertas + '</b><span>em aberto</span></div>' +
      '<div><b>' + k.atrasadas + '</b><span>atrasadas</span></div>' +
      '<div><b>' + k.entregues + '</b><span>entregues</span></div>' +
      '</div>';
    h += '<div class="hero-actions">' +
      '<button class="btn ghost" data-act="edit-member" data-id="' + m.id + '">' + ICON.edit + 'Editar</button>' +
      '<button class="btn cherry" data-act="new-demand-member" data-id="' + m.id + '">' + ICON.plus + 'Cobrança</button>' +
      '</div>';
    h += '</div>';

    h += '<section class="section">' + secHead('Preciso cobrar', abertas.length);
    h += abertas.length
      ? abertas.map(function (d) { return demandItem(d, false); }).join('')
      : '<div class="empty">Nada pendente com ' + esc(m.name.split(' ')[0]) + '.</div>';
    h += '</section>';

    if (furadas.length) {
      h += '<section class="section">' + secHead('Não entregou', furadas.length) +
        furadas.map(function (d) { return demandItem(d, false); }).join('') + '</section>';
    }

    h += '<section class="section">' + secHead('Já entregou', entregues.length);
    h += entregues.length
      ? entregues.map(function (d) { return demandItem(d, false); }).join('')
      : '<div class="empty">Ainda não entregou nada por aqui.</div>';
    h += '</section>';

    if (m.notes) {
      h += '<section class="section">' + secHead('Anotações') +
        '<div class="card"><div class="notes-block">' + esc(m.notes) + '</div></div></section>';
    }

    view.innerHTML = h;
  }

  /* ---------- um item de cobrança ---------- */
  function demandItem(d, showMember) {
    var late = S.demandLate(d);
    var info = S.DEMAND_STATUS[d.status] || S.DEMAND_STATUS.pendente;
    var accent = late ? 'alert' : info.accent;

    var meta = [];
    if (showMember) meta.push('<span class="badge">' + esc(S.memberName(d.memberId)) + '</span>');
    if (d.clientId) meta.push('<span>' + esc(S.clientName(d.clientId)) + '</span>');

    if (d.status === 'pendente') {
      if (late) {
        var dias = S.demandDaysLate(d);
        meta.push('<span class="badge b-alert">' + dias + ' dia' + (dias === 1 ? '' : 's') + ' atrasada</span>');
      } else if (d.due) {
        meta.push('<span>até ' + esc(S.fmtRelative(d.due)) + '</span>');
      }
    } else if (d.status === 'entregue' && d.deliveredAt) {
      meta.push('<span class="badge b-ok">entregue ' + esc(S.fmtShort(d.deliveredAt)) + '</span>');
    } else if (d.status === 'nao-entregue') {
      meta.push('<span class="badge b-alert">não entregou</span>');
    }

    var nCob = (d.chargedDates || []).length;
    if (nCob) {
      meta.push('<span>cobrei ' + nCob + 'x · última ' + esc(S.fmtShort(S.lastCharge(d))) + '</span>');
    }
    var semanaPassada = S.chargedLastWeek(d).length;
    if (semanaPassada) meta.push('<span>' + semanaPassada + 'x semana passada</span>');

    var h = '<div class="item" style="display:block" data-accent="' + accent + '">';
    h += '<div style="display:flex;gap:12px;align-items:flex-start">';
    h += '<div class="item-main"><p class="item-title">' + esc(d.title) + '</p>' +
      (meta.length ? '<div class="item-meta">' + meta.join('') + '</div>' : '') +
      (d.detail ? '<p class="hint">' + esc(d.detail) + '</p>' : '') +
      '</div>';
    h += '<div class="item-actions">' +
      '<button class="icon-btn" data-act="edit-demand" data-id="' + d.id + '" aria-label="Editar">' + ICON.edit + '</button>' +
      '</div></div>';

    if (d.status === 'entregue' && (d.result || d.leads)) {
      h += '<div class="card" style="margin-top:10px;padding:11px">' +
        (d.leads ? '<div class="item-meta" style="margin:0 0 6px"><span class="badge b-ok">' + esc(d.leads) + ' leads</span></div>' : '') +
        (d.result ? '<div class="notes-block" style="font-size:13px">' + esc(d.result) + '</div>' : '') +
        '</div>';
    }

    if (d.status === 'pendente') {
      h += '<div class="demand-actions">' +
        '<button class="btn ghost sm" data-act="charge-demand" data-id="' + d.id + '">Cobrei hoje</button>' +
        '<button class="btn sm" data-act="deliver-demand" data-id="' + d.id + '">Entregou</button>' +
        '<button class="btn danger sm" data-act="fail-demand" data-id="' + d.id + '">Furou</button>' +
        '</div>';
    } else {
      h += '<div class="demand-actions">' +
        '<button class="btn ghost sm" data-act="reopen-demand" data-id="' + d.id + '">Reabrir</button>' +
        '</div>';
    }

    h += '</div>';
    return h;
  }

  /* ---------- formulários da equipe ---------- */
  function memberForm(id) {
    var m = id ? S.find('team', id) : null;
    var isNew = !m;
    m = m || { name: '', role: '', notes: '' };

    var html = '<form id="memberForm">' +
      '<div class="field"><label for="m-name">Nome</label>' +
      '<input class="input" id="m-name" required maxlength="60" value="' + esc(m.name) + '" placeholder="Ex.: Joe"></div>' +
      '<div class="field"><label for="m-role">Função</label>' +
      '<input class="input" id="m-role" maxlength="60" value="' + esc(m.role || '') + '" placeholder="Ex.: Gestor de tráfego"></div>' +
      '<div class="field"><label for="m-notes">Anotações</label>' +
      '<textarea class="input" id="m-notes" style="min-height:100px" placeholder="Contato, combinado de prazo, como prefere receber a demanda...">' + esc(m.notes || '') + '</textarea></div>' +
      '<button class="btn" type="submit">' + (isNew ? 'Cadastrar' : 'Salvar') + '</button>' +
      (isNew ? '' : '<div style="height:10px"></div><button class="btn danger" type="button" data-act="delete-member" data-id="' + m.id + '">' + ICON.trash + 'Excluir</button>') +
      '</form>';

    openSheet(isNew ? 'Nova pessoa' : 'Editar pessoa', html, function (root) {
      root.querySelector('#memberForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = root.querySelector('#m-name').value.trim();
        if (!name) return;
        S.upsert('team', {
          id: m.id, name: name,
          role: root.querySelector('#m-role').value.trim(),
          notes: root.querySelector('#m-notes').value.trim(),
          active: true
        });
        closeSheet();
        render();
        Toast(isNew ? 'Pessoa cadastrada' : 'Pessoa salva');
      });
    });
  }

  function memberOptions(selected) {
    if (!S.state.team.length) return '<option value="">Cadastre alguém primeiro</option>';
    return S.state.team.slice().sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    }).map(function (m) {
      return opt(m.id, m.name + (m.role ? ' — ' + m.role : ''), selected || '');
    }).join('');
  }

  function demandForm(id, preset) {
    preset = preset || {};
    var d = id ? S.find('demands', id) : null;
    var isNew = !d;
    d = d || {
      memberId: preset.memberId || (S.state.team[0] || {}).id || '',
      clientId: preset.clientId || '',
      title: '', detail: '',
      due: S.addDays(S.today(), 7),
      status: 'pendente', chargedDates: []
    };

    var html = '<form id="demandForm">' +
      '<div class="field"><label for="d-title">O que você precisa receber</label>' +
      '<input class="input" id="d-title" required maxlength="140" value="' + esc(d.title) + '" placeholder="Ex.: relatório de tráfego da semana"></div>' +
      '<div class="field"><label for="d-member">De quem</label>' +
      '<select class="input" id="d-member">' + memberOptions(d.memberId) + '</select></div>' +
      '<div class="field"><label for="d-client">De qual cliente</label>' +
      '<select class="input" id="d-client">' + clientOptions(d.clientId, '— nenhum / interno —') + '</select></div>' +
      '<div class="field"><label for="d-due">Até quando</label>' +
      '<input class="input" type="date" id="d-due" value="' + esc(d.due || '') + '"></div>' +
      '<div class="field"><label for="d-detail">Detalhe do que é</label>' +
      '<textarea class="input" id="d-detail" style="min-height:90px" placeholder="O que exatamente precisa vir: número de leads, arquivo editado, print...">' + esc(d.detail || '') + '</textarea></div>' +
      '<button class="btn" type="submit">' + (isNew ? 'Criar cobrança' : 'Salvar') + '</button>' +
      (isNew ? '' : '<div style="height:10px"></div><button class="btn danger" type="button" data-act="delete-demand" data-id="' + d.id + '">' + ICON.trash + 'Excluir</button>') +
      '</form>';

    openSheet(isNew ? 'Nova cobrança' : 'Editar cobrança', html, function (root) {
      root.querySelector('#demandForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var title = root.querySelector('#d-title').value.trim();
        var memberId = root.querySelector('#d-member').value;
        if (!title || !memberId) { Toast('Falta o título ou a pessoa'); return; }
        S.upsert('demands', {
          id: d.id, memberId: memberId,
          clientId: root.querySelector('#d-client').value,
          title: title,
          detail: root.querySelector('#d-detail').value.trim(),
          due: root.querySelector('#d-due').value,
          status: d.status || 'pendente',
          chargedDates: d.chargedDates || [],
          deliveredAt: d.deliveredAt || '',
          result: d.result || '', leads: d.leads || ''
        });
        closeSheet();
        render();
        Toast(isNew ? 'Cobrança criada' : 'Cobrança salva');
      });
    });
  }

  // Ao marcar como entregue, ela registra o que veio (ex.: leads da semana).
  function deliverForm(id) {
    var d = S.find('demands', id);
    if (!d) return;

    var html = '<form id="deliverForm">' +
      '<p class="hint" style="margin:0 0 14px">' + esc(d.title) +
      (d.clientId ? ' · ' + esc(S.clientName(d.clientId)) : '') + '</p>' +
      '<div class="field"><label for="dv-leads">Número, se tiver (leads, vídeos, posts)</label>' +
      '<input class="input" id="dv-leads" inputmode="numeric" value="' + esc(d.leads || '') + '" placeholder="Ex.: 34"></div>' +
      '<div class="field"><label for="dv-result">Como foi</label>' +
      '<textarea class="input" id="dv-result" style="min-height:110px" placeholder="O que ele falou, o que rendeu, o que ajustar na próxima...">' + esc(d.result || '') + '</textarea></div>' +
      '<button class="btn" type="submit">Marcar como entregue</button>' +
      '</form>';

    openSheet('Entregou', html, function (root) {
      root.querySelector('#deliverForm').addEventListener('submit', function (e) {
        e.preventDefault();
        S.setDemandStatus(d.id, 'entregue', {
          leads: root.querySelector('#dv-leads').value.trim(),
          result: root.querySelector('#dv-result').value.trim()
        });
        closeSheet();
        render();
        Toast('Marcado como entregue');
      });
    });
  }

  /* ============================================================
     TELA: NOTAS
     ============================================================ */
  function viewNotas() {
    var st = S.state;
    var h = '';
    h += '<h1 class="page-title">Notas</h1>';
    h += '<p class="page-sub">Dados fixos e status das notificações.</p>';

    h += '<section class="section">' + secHead('Bloco fixo');
    h += '<div class="card">';
    h += '<textarea class="input" id="notesArea" style="min-height:220px" placeholder="Acessos, padrões de nomenclatura, links de referência, combinados com cliente...">' + esc(st.notes) + '</textarea>';
    h += '<div style="height:10px"></div>';
    h += '<button class="btn cherry" data-act="save-notes">Salvar notas</button>';
    h += '</div></section>';

    h += '<section class="section">' + secHead('Notificações');
    h += '<div class="card" id="pushCard">' + pushCardInner() + '</div>';
    h += '</section>';

    h += '<section class="section">' + secHead('Dados do app');
    h += '<div class="card">' +
      '<p class="hint" style="margin-top:0">Tudo fica salvo só neste aparelho. Exporte de vez em quando.</p>' +
      '<div style="height:10px"></div>' +
      '<button class="btn ghost" data-act="export">Exportar backup (.json)</button>' +
      '<div style="height:8px"></div>' +
      '<button class="btn ghost" data-act="import">Importar backup</button>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '<div class="divider" style="margin:16px 0 12px"></div>' +
      '<p class="hint" style="margin:0">Versão <code>' + esc(VERSION) + '</code>' +
      (window.Push.isStandalone() ? ' · instalado na tela de início' : ' · aberto pelo navegador') +
      '</p>' +
      '</div></section>';

    view.innerHTML = h;
    bindPushCard();

    var f = document.getElementById('importFile');
    f.addEventListener('change', function () {
      var file = f.files && f.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          S.importJSON(String(reader.result));
          Toast('Backup restaurado');
          render();
        } catch (e) {
          Toast('Arquivo inválido');
        }
      };
      reader.readAsText(file);
    });
  }

  function pushCardInner() {
    var p = window.Push.status;
    var st = S.state;
    var saved = (st.settings.oneSignalAppId || '').trim();
    var cfg = ((window.MERAKI_CONFIG || {}).ONESIGNAL_APP_ID || '').trim();
    var id = saved || cfg;

    var dot, text;
    if (!id) { dot = 'off'; text = 'OneSignal não configurado'; }
    else if (p.error) { dot = 'off'; text = 'Erro: ' + p.error; }
    else if (p.ios && !p.standalone) { dot = 'warn'; text = 'Abra pelo ícone da tela de início'; }
    else if (p.subscribed) { dot = 'on'; text = 'Conectado — este aparelho recebe push'; }
    else if (p.permission === 'denied') { dot = 'off'; text = 'Permissão negada nos Ajustes do iPhone'; }
    else { dot = 'warn'; text = 'Configurado, mas este aparelho ainda não ativou'; }

    var h = '';
    h += '<div class="status-line"><span class="status-dot ' + dot + '"></span><span>' + esc(text) + '</span></div>';

    if (id && !p.subscribed && p.permission !== 'denied') {
      h += '<button class="btn" data-act="enable-push">' + ICON.bell + 'Ativar notificações</button><div style="height:12px"></div>';
    }

    h += '<div class="field" style="margin-bottom:8px"><label for="osAppId">OneSignal App ID</label>' +
      '<input class="input" id="osAppId" value="' + esc(saved) + '" placeholder="' + (cfg ? esc(cfg) + ' (do config.js)' : 'cole aqui o App ID') + '" autocapitalize="off" autocorrect="off" spellcheck="false"></div>';
    h += '<button class="btn ghost sm" data-act="save-appid" style="width:100%">Salvar App ID e recarregar</button>';

    h += '<p class="hint">Os lembretes recorrentes (ex.: <code>toda sexta 10h</code>) são criados no painel do OneSignal, em <code>Messages &rsaquo; Automated</code>. O passo a passo está no README.</p>';

    if (p.ios) {
      h += '<p class="hint">No iPhone o push só existe depois de <b>Compartilhar &rsaquo; Adicionar à Tela de Início</b> e abrir pelo ícone. Pelo Safari, não funciona — é limitação da Apple.</p>';
    }
    return h;
  }

  function bindPushCard() {
    window.Push.onChange(function () {
      var card = document.getElementById('pushCard');
      if (card) { card.innerHTML = pushCardInner(); }
    });
  }

  /* ============================================================
     ACOES (delegacao de eventos)
     ============================================================ */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');

    switch (act) {
      case 'toggle':
        S.toggleDone(id, btn.getAttribute('data-date'));
        render();
        break;

      case 'new-task': taskForm(null); break;
      case 'edit-task': taskForm(id); break;
      case 'delete-task':
        if (confirm('Excluir esta tarefa?')) { S.remove('tasks', id); closeSheet(); render(); Toast('Tarefa excluída'); }
        break;

      case 'task-filter':
        taskFilter.mode = btn.getAttribute('data-mode');
        viewTarefas();
        break;

      case 'new-prod': prodForm(null); break;
      case 'new-prod-slot':
        prodForm(null, { clientId: id, postDate: btn.getAttribute('data-date') });
        break;
      case 'edit-prod': prodForm(id); break;
      case 'delete-prod':
        if (confirm('Excluir este conteúdo?')) { S.remove('productions', id); closeSheet(); render(); Toast('Conteúdo excluído'); }
        break;

      case 'set-stage': {
        var p = S.find('productions', id);
        if (p) { p.stage = btn.getAttribute('data-stage'); S.save(); viewProducao(); }
        break;
      }

      case 'toggle-flag': {
        var item = S.find('productions', id);
        if (item) {
          var f = btn.getAttribute('data-field');
          item[f] = !item[f];
          S.save();
          btn.setAttribute('aria-pressed', item[f] ? 'true' : 'false');
        }
        break;
      }

      case 'week': {
        var delta = Number(btn.getAttribute('data-delta'));
        weekRef = delta === 0 ? S.today() : S.addDays(weekRef, delta);
        viewProducao();
        break;
      }

      case 'go':
        location.hash = btn.getAttribute('data-hash');
        break;

      case 'new-task-client': taskForm(null, { clientId: id }); break;

      /* ---------- links ---------- */
      case 'new-link': linkForm(null); break;
      case 'new-link-client': linkForm(null, { clientId: id }); break;
      case 'edit-link': linkForm(id); break;
      case 'delete-link':
        if (confirm('Excluir este link?')) { S.remove('links', id); closeSheet(); render(); Toast('Link excluído'); }
        break;

      case 'toggle-link': {
        var lk = S.find('links', id);
        if (lk) { lk.used = !lk.used; S.save(); render(); }
        break;
      }

      case 'link-filter':
        linkFilter = btn.getAttribute('data-client');
        viewLinks();
        break;

      case 'paste-link':
        pasteLink();
        break;

      /* ---------- equipe ---------- */
      case 'new-member': memberForm(null); break;
      case 'edit-member': memberForm(id); break;
      case 'delete-member':
        if (confirm('Excluir esta pessoa? As cobranças dela também somem.')) {
          S.state.demands = S.state.demands.filter(function (d) { return d.memberId !== id; });
          S.remove('team', id);
          closeSheet();
          location.hash = '#/equipe';
          render();
          Toast('Pessoa excluída');
        }
        break;

      case 'new-demand': demandForm(null); break;
      case 'new-demand-member': demandForm(null, { memberId: id }); break;
      case 'new-demand-client': demandForm(null, { clientId: id }); break;
      case 'edit-demand': demandForm(id); break;
      case 'delete-demand':
        if (confirm('Excluir esta cobrança?')) {
          S.remove('demands', id); closeSheet(); render(); Toast('Cobrança excluída');
        }
        break;

      case 'charge-demand':
        S.chargeDemand(id);
        render();
        Toast('Anotado: cobrado hoje');
        break;

      case 'deliver-demand': deliverForm(id); break;

      case 'fail-demand':
        S.setDemandStatus(id, 'nao-entregue');
        render();
        Toast('Marcado como não entregue');
        break;

      case 'reopen-demand':
        S.setDemandStatus(id, 'pendente');
        render();
        Toast('Cobrança reaberta');
        break;

      /* ---------- contadores do cliente ---------- */
      case 'bump': {
        S.bumpClient(id, btn.getAttribute('data-field'), Number(btn.getAttribute('data-delta')));
        render();
        break;
      }

      case 'new-client': clientForm(null); break;
      case 'edit-client': clientForm(id); break;
      case 'delete-client':
        if (confirm('Excluir este cliente? Os conteúdos ligados a ele continuam existindo.')) {
          S.remove('clients', id); closeSheet(); render(); Toast('Cliente excluído');
        }
        break;

      case 'save-notes':
        S.state.notes = document.getElementById('notesArea').value;
        S.save();
        Toast('Notas salvas');
        break;

      case 'save-appid': {
        var val = document.getElementById('osAppId').value.trim();
        S.state.settings.oneSignalAppId = val;
        S.save();
        Toast(val ? 'App ID salvo, recarregando...' : 'App ID removido, recarregando...');
        setTimeout(function () { location.reload(); }, 700);
        break;
      }

      case 'enable-push':
        btn.disabled = true;
        window.Push.enable().then(function (ok) {
          Toast(ok ? 'Notificações ativadas' : 'Não ativou — confira a permissão');
        }).catch(function (err) {
          Toast(err.message || 'Não consegui ativar');
        }).then(function () {
          var b = document.querySelector('[data-act="enable-push"]');
          if (b) b.disabled = false;
          window.Push.refresh();
        });
        break;

      case 'export': {
        var blob = new Blob([S.exportJSON()], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'meraki-' + S.today() + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        break;
      }

      case 'import':
        document.getElementById('importFile').click();
        break;
    }
  });

  /* ============================================================
     ROUTER
     ============================================================ */
  var ROUTES = {
    hoje: viewHoje,
    tarefas: viewTarefas,
    producao: viewProducao,
    clientes: viewClientes,
    equipe: viewEquipe,
    links: viewLinks,
    notas: viewNotas
  };

  // "#/clientes" -> tela; "#/cliente/<id>" -> ficha, com a aba Clientes acesa.
  function currentRoute() {
    var raw = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    var parts = raw.split('/');
    if (parts[0] === 'cliente' && parts[1]) {
      return { name: 'cliente', arg: parts[1], tab: 'clientes' };
    }
    if (parts[0] === 'membro' && parts[1]) {
      return { name: 'membro', arg: parts[1], tab: 'equipe' };
    }
    var name = ROUTES[parts[0]] ? parts[0] : 'hoje';
    return { name: name, arg: '', tab: name };
  }

  function render() {
    var r = currentRoute();
    if (r.name === 'cliente') viewCliente(r.arg);
    else if (r.name === 'membro') viewMembro(r.arg);
    else ROUTES[r.name]();
    Array.prototype.forEach.call(tabbar.querySelectorAll('.tab'), function (a) {
      if (a.getAttribute('data-tab') === r.tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    // Notas nao tem aba embaixo: mora no botao do topo.
    var nb = document.getElementById('notasBtn');
    if (nb) {
      if (r.tab === 'notas') nb.setAttribute('aria-current', 'page');
      else nb.removeAttribute('aria-current');
    }
    updateBadges();
    window.scrollTo(0, 0);
  }

  function updateBadges() {
    var n = S.pendingCharges().length;
    var tab = tabbar.querySelector('[data-tab="hoje"]');
    var dot = tab.querySelector('.dot');
    if (n > 0 && !dot) {
      dot = document.createElement('span');
      dot.className = 'dot';
      tab.appendChild(dot);
    } else if (n === 0 && dot) {
      dot.remove();
    }
  }

  window.addEventListener('hashchange', function () {
    if (!sheetWrap.hidden) closeSheet();
    render();
  });

  /* ---------- data no topo ---------- */
  function paintDate() {
    var d = new Date();
    var wd = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'][d.getDay()];
    document.getElementById('topbarDate').textContent =
      wd + ' ' + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
  }

  /* ---------- virada do dia / volta pro app ---------- */
  var lastDay = S.today();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    if (S.today() !== lastDay) { lastDay = S.today(); paintDate(); }
    window.Push.refresh();
    render();
  });

  /* ---------- start ---------- */
  paintDate();
  var shared = readSharedParams();
  if (shared) location.hash = '#/links';
  else if (!location.hash) location.replace('#/hoje');
  render();
  if (shared) linkForm(null, shared);
  window.Push.init();
})();
