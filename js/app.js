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
    var tr = S.state.traffic;
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

    // Relatorio de trafego (Joe)
    h += '<div class="divider"></div>';
    h += '<section class="section">' + secHead('Relatório de tráfego · Joe');
    h += '<div class="card">';
    h += '<div class="field"><label for="tr-leads">Leads captados na semana</label>' +
      '<input class="input" id="tr-leads" inputmode="numeric" value="' + esc(tr.leads || '') + '" placeholder="Ex.: 34"></div>';
    h += '<div class="field"><label for="tr-notes">Observações da reunião</label>' +
      '<textarea class="input" id="tr-notes" placeholder="Custo por lead, campanha que rodou melhor, o que ajustar...">' + esc(tr.notes || '') + '</textarea></div>';
    h += '<div class="status-line"><span class="status-dot' + (tr.updatedAt ? ' on' : ' off') + '"></span>' +
      (tr.updatedAt ? 'Atualizado em ' + esc(tr.updatedAt) : 'Nunca atualizado') + '</div>';
    h += '<button class="btn cherry" data-act="save-traffic">Salvar relatório</button>';
    h += '</div></section>';

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

  function prodForm(id) {
    var p = id ? S.find('productions', id) : null;
    var isNew = !p;
    p = p || {
      title: '', clientId: (S.state.clients[0] || {}).id || '', stage: 'roteiro',
      victorOk: false, postOk: false, postDate: ''
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

  function clientCard(r) {
    var c = r.client, k = r.calc;
    var pct = k.needed > 0 ? Math.min(100, Math.round((k.produced / k.needed) * 100)) : 0;
    var barClass = pct >= 100 ? 'bar full' : (pct < 40 ? 'bar low' : 'bar');

    var nLinks = S.linksOf(c.id).length;
    var nTasks = S.tasksOfClient(c.id).filter(function (t) { return !S.isDone(t, S.today()); }).length;

    var h = '<a class="item" style="display:block" data-accent="' + k.accent + '" href="#/cliente/' + c.id + '">';
    h += '<div style="display:flex;gap:12px;align-items:flex-start">';
    h += '<div class="item-main">' +
      '<p class="item-title">' + esc(c.name) + '</p>' +
      '<div class="item-meta">' +
      '<span class="badge b-' + k.accent + '">' + esc(k.status) + '</span>' +
      '</div></div>';
    h += '<div class="item-actions"><span class="icon-btn" aria-hidden="true">' + ICON.open + '</span></div></div>';

    h += '<div class="item-meta" style="margin-top:9px">' +
      '<span>' + k.produced + '/' + k.needed + ' vídeos no mês</span>' +
      '<span class="sep">·</span><span>' + k.estoque + ' pronto' + (k.estoque === 1 ? '' : 's') + '</span>' +
      '<span class="sep">·</span><span>' + k.agendados + ' agendado' + (k.agendados === 1 ? '' : 's') + '</span>' +
      (nLinks ? '<span class="sep">·</span><span>' + nLinks + ' link' + (nLinks === 1 ? '' : 's') + '</span>' : '') +
      (nTasks ? '<span class="sep">·</span><span>' + nTasks + ' a fazer</span>' : '') +
      '</div>';
    h += '<div class="' + barClass + '"><i style="width:' + pct + '%"></i></div>';
    h += '</a>';
    return h;
  }

  function clientForm(id) {
    var c = id ? S.find('clients', id) : null;
    var isNew = !c;
    c = c || { name: '', produced: 0, needed: 8, notes: '' };

    var html = '<form id="clientForm">' +
      '<div class="field"><label for="c-name">Nome do cliente</label>' +
      '<input class="input" id="c-name" required maxlength="80" value="' + esc(c.name) + '" placeholder="Ex.: Dra. Marina — Odonto"></div>' +
      '<div class="row-2">' +
      '<div class="field"><label for="c-prod">Vídeos produzidos</label>' +
      '<input class="input" type="number" min="0" max="999" id="c-prod" value="' + (Number(c.produced) || 0) + '"></div>' +
      '<div class="field"><label for="c-need">Necessários no mês</label>' +
      '<input class="input" type="number" min="0" max="999" id="c-need" value="' + (Number(c.needed) || 0) + '"></div>' +
      '</div>' +
      '<div class="field"><label for="c-notes">Dados e combinados</label>' +
      '<textarea class="input" id="c-notes" style="min-height:140px" placeholder="@ do perfil, dia de gravação, tom de voz, o que pode e o que não pode, contato do responsável...">' + esc(c.notes || '') + '</textarea></div>' +
      '<button class="btn" type="submit">' + (isNew ? 'Cadastrar' : 'Salvar') + '</button>' +
      (isNew ? '' : '<div style="height:10px"></div><button class="btn danger" type="button" data-act="delete-client" data-id="' + c.id + '">' + ICON.trash + 'Excluir</button>') +
      '</form>';

    openSheet(isNew ? 'Novo cliente' : 'Editar cliente', html, function (root) {
      root.querySelector('#clientForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var name = root.querySelector('#c-name').value.trim();
        if (!name) return;
        S.upsert('clients', {
          id: c.id,
          name: name,
          produced: Number(root.querySelector('#c-prod').value) || 0,
          needed: Number(root.querySelector('#c-need').value) || 0,
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
      '<div><b>' + k.produced + '/' + k.needed + '</b><span>vídeos no mês</span></div>' +
      '<div><b>' + k.estoque + '</b><span>prontos</span></div>' +
      '<div><b>' + k.agendados + '</b><span>agendados</span></div>' +
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

  function stageLabel(id) {
    var s = S.STAGES.find(function (x) { return x.id === id; });
    return s ? s.label : id;
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

      case 'save-traffic': {
        var leads = document.getElementById('tr-leads').value.trim();
        var notes = document.getElementById('tr-notes').value.trim();
        S.state.traffic = { leads: leads, notes: notes, updatedAt: S.fmtShort(S.today()) };
        S.save();
        viewProducao();
        Toast('Relatorio salvo');
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
    var name = ROUTES[parts[0]] ? parts[0] : 'hoje';
    return { name: name, arg: '', tab: name };
  }

  function render() {
    var r = currentRoute();
    if (r.name === 'cliente') viewCliente(r.arg);
    else ROUTES[r.name]();
    Array.prototype.forEach.call(tabbar.querySelectorAll('.tab'), function (a) {
      if (a.getAttribute('data-tab') === r.tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
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
