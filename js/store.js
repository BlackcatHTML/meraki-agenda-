/* ============================================================
   STORE — estado do app em localStorage.
   Um usuario, um aparelho, sem login e sem sincronizacao.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'meraki:v1';

  /* ---------- datas (tudo em horario local, sem UTC) ---------- */
  function iso(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function today() { return iso(new Date()); }
  function parse(s) {
    if (!s) return null;
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(s, n) {
    var d = parse(s);
    d.setDate(d.getDate() + n);
    return iso(d);
  }
  // Segunda-feira da semana de `s`.
  function weekStart(s) {
    var d = parse(s || today());
    var wd = (d.getDay() + 6) % 7; // 0 = segunda
    d.setDate(d.getDate() - wd);
    return iso(d);
  }
  function weekEnd(s) { return addDays(weekStart(s), 6); }

  var WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var WD_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var MONTH = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function fmtShort(s) {
    var d = parse(s);
    if (!d) return '';
    return WD_SHORT[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0') + '/' +
      String(d.getMonth() + 1).padStart(2, '0');
  }
  function fmtLong(s) {
    var d = parse(s);
    if (!d) return '';
    return WD[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTH[d.getMonth()];
  }
  function fmtRelative(s) {
    var t = today();
    if (s === t) return 'hoje';
    if (s === addDays(t, 1)) return 'amanhã';
    if (s === addDays(t, -1)) return 'ontem';
    return fmtShort(s);
  }
  function daysBetween(a, b) {
    return Math.round((parse(b) - parse(a)) / 86400000);
  }

  /* ---------- id ---------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- estado inicial ---------- */
  function seed() {
    var t = today();
    var ws = weekStart(t);
    // sexta desta semana; se ja passou, sexta da proxima
    var friday = addDays(ws, 4);
    if (daysBetween(t, friday) < 0) friday = addDays(friday, 7);
    var monday = daysBetween(t, ws) < 0 ? addDays(ws, 7) : ws;

    return {
      version: 1,
      tasks: [
        {
          id: uid(), title: 'Cobrar edições do Victor', kind: 'cobranca', who: 'Victor',
          date: friday, time: '10:00', repeat: 'weekly', done: false, doneDates: [], createdAt: Date.now()
        },
        {
          id: uid(), title: 'Cobrar relatório de tráfego do Joe', kind: 'cobranca', who: 'Joe',
          date: monday, time: '09:00', repeat: 'weekly', done: false, doneDates: [], createdAt: Date.now()
        },
        {
          id: uid(), title: 'Revisar roteiros da semana', kind: 'task', who: '',
          date: t, time: '', repeat: 'none', done: false, doneDates: [], createdAt: Date.now()
        }
      ],
      clients: [],
      productions: [],
      links: [],
      traffic: { leads: '', notes: '', updatedAt: '' },
      notes: '',
      settings: { oneSignalAppId: '', pushAsked: false }
    };
  }

  /* ---------- carga / gravacao ---------- */
  var state = null;

  function normalize(s) {
    var base = seed();
    if (!s || typeof s !== 'object') return base;
    s.tasks = Array.isArray(s.tasks) ? s.tasks : [];
    s.clients = Array.isArray(s.clients) ? s.clients : [];
    s.productions = Array.isArray(s.productions) ? s.productions : [];
    s.links = Array.isArray(s.links) ? s.links : [];
    s.traffic = s.traffic && typeof s.traffic === 'object' ? s.traffic : base.traffic;
    s.notes = typeof s.notes === 'string' ? s.notes : '';
    s.settings = s.settings && typeof s.settings === 'object' ? s.settings : base.settings;
    if (typeof s.settings.oneSignalAppId !== 'string') s.settings.oneSignalAppId = '';
    s.tasks.forEach(function (t) {
      if (!Array.isArray(t.doneDates)) t.doneDates = [];
      if (!t.kind) t.kind = 'task';
      if (!t.repeat) t.repeat = 'none';
    });
    s.version = 1;
    return s;
  }

  function load() {
    if (state) return state;
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? normalize(JSON.parse(raw)) : seed();
    } catch (e) {
      console.warn('[store] leitura falhou, comecando do zero', e);
      state = seed();
    }
    return state;
  }

  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        console.error('[store] gravacao falhou', e);
        if (window.Toast) window.Toast('Não consegui salvar (armazenamento cheio?)');
      }
    }, 60);
  }

  /* ---------- tarefas ---------- */
  // Uma tarefa "cai" numa data quando: pontual e e o dia; diaria e ja comecou;
  // semanal e ja comecou e e o mesmo dia da semana.
  function occursOn(task, date) {
    if (!task.date) return false;
    if (task.repeat === 'none') return task.date === date;
    if (daysBetween(task.date, date) < 0) return false;
    if (task.repeat === 'daily') return true;
    if (task.repeat === 'weekly') return parse(task.date).getDay() === parse(date).getDay();
    return false;
  }

  function isDone(task, date) {
    if (task.repeat === 'none') return !!task.done;
    return task.doneDates.indexOf(date) !== -1;
  }

  function toggleDone(id, date) {
    var t = state.tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    if (t.repeat === 'none') {
      t.done = !t.done;
    } else {
      var i = t.doneDates.indexOf(date);
      if (i === -1) t.doneDates.push(date); else t.doneDates.splice(i, 1);
      // nao deixa a lista crescer pra sempre
      if (t.doneDates.length > 200) t.doneDates = t.doneDates.slice(-120);
    }
    save();
  }

  // Tarefas de uma data, ordenadas por horario (sem horario vai pro fim).
  function tasksOn(date) {
    return state.tasks
      .filter(function (t) { return occursOn(t, date); })
      .sort(function (a, b) {
        var ta = a.time || '99:99', tb = b.time || '99:99';
        if (ta !== tb) return ta < tb ? -1 : 1;
        return a.createdAt - b.createdAt;
      });
  }

  // Cobrancas em aberto: hoje e tudo que ficou pra tras.
  function pendingCharges() {
    var t = today();
    var out = [];
    state.tasks.forEach(function (task) {
      if (task.kind !== 'cobranca') return;
      for (var back = 0; back <= 21; back++) {
        var d = addDays(t, -back);
        if (occursOn(task, d) && !isDone(task, d)) {
          out.push({ task: task, date: d, late: back });
          break; // so a ocorrencia mais recente em aberto
        }
      }
    });
    return out.sort(function (a, b) { return b.late - a.late; });
  }

  // Tarefas comuns atrasadas (nao-cobrancas, pontuais, antes de hoje).
  function overdueTasks() {
    var t = today();
    return state.tasks.filter(function (x) {
      return x.kind !== 'cobranca' && x.repeat === 'none' && !x.done &&
        x.date && daysBetween(x.date, t) > 0;
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  /* ---------- clientes ---------- */
  var STAGES = [
    { id: 'roteiro', label: 'Roteiro' },
    { id: 'gravacao', label: 'Gravação' },
    { id: 'edicao', label: 'Edição' },
    { id: 'pronto', label: 'Pronto' },
    { id: 'postado', label: 'Postado' }
  ];

  // Status calculado a partir da producao real, nao de um campo manual.
  function clientStatus(client) {
    var t = today();
    var mine = state.productions.filter(function (p) { return p.clientId === client.id; });

    // Posts com data futura ja definida (ou marcados como configurados).
    var agendados = mine.filter(function (p) {
      return p.stage !== 'postado' && (p.postOk || (p.postDate && daysBetween(t, p.postDate) >= 0));
    }).length;

    // Estoque = o que esta pronto e ainda nao foi postado.
    var estoque = mine.filter(function (p) { return p.stage === 'pronto'; }).length;

    var produced = Number(client.produced) || 0;
    var needed = Number(client.needed) || 0;
    var deficit = Math.max(0, needed - produced);

    var status, severity, accent;
    if (deficit > 0 && agendados === 0) {
      status = 'Sem conteúdo pra semana'; severity = 3; accent = 'alert';
    } else if (estoque < 2) {
      status = 'Precisa de novo roteiro'; severity = 2; accent = 'warn';
    } else {
      status = 'OK'; severity = 1; accent = 'ok';
    }

    return {
      status: status, severity: severity, accent: accent,
      produced: produced, needed: needed, deficit: deficit,
      agendados: agendados, estoque: estoque, total: mine.length
    };
  }

  // Quem esta mais atrasado aparece primeiro.
  function clientsByPriority() {
    return state.clients
      .map(function (c) { return { client: c, calc: clientStatus(c) }; })
      .sort(function (a, b) {
        if (a.calc.severity !== b.calc.severity) return b.calc.severity - a.calc.severity;
        if (a.calc.deficit !== b.calc.deficit) return b.calc.deficit - a.calc.deficit;
        if (a.calc.estoque !== b.calc.estoque) return a.calc.estoque - b.calc.estoque;
        return (a.client.name || '').localeCompare(b.client.name || '');
      });
  }

  function clientName(id) {
    var c = state.clients.find(function (x) { return x.id === id; });
    return c ? c.name : 'Sem cliente';
  }

  /* ---------- links de referencia (TikTok, Instagram, etc.) ---------- */
  var PLATFORMS = [
    { id: 'tiktok', label: 'TikTok', match: /tiktok\.com/i },
    { id: 'instagram', label: 'Instagram', match: /instagram\.com|instagr\.am/i },
    { id: 'youtube', label: 'YouTube', match: /youtube\.com|youtu\.be/i },
    { id: 'kwai', label: 'Kwai', match: /kwai\.com/i },
    { id: 'pinterest', label: 'Pinterest', match: /pinterest\./i },
    { id: 'drive', label: 'Drive', match: /drive\.google\.com|docs\.google\.com/i },
    { id: 'outro', label: 'Link', match: /./ }
  ];

  function platformOf(url) {
    var u = String(url || '');
    for (var i = 0; i < PLATFORMS.length; i++) {
      if (PLATFORMS[i].match.test(u)) return PLATFORMS[i];
    }
    return PLATFORMS[PLATFORMS.length - 1];
  }

  // Aceita texto colado do compartilhamento ("olha isso https://... ") e
  // devolve so a URL.
  function extractUrl(text) {
    var m = String(text || '').match(/https?:\/\/[^\s"'<>]+/i);
    return m ? m[0] : '';
  }

  function linksOf(clientId) {
    return state.links
      .filter(function (l) { return clientId ? l.clientId === clientId : true; })
      .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  }

  function tasksOfClient(clientId) {
    return state.tasks
      .filter(function (t) { return t.clientId === clientId; })
      .sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });
  }

  function productionsOfClient(clientId) {
    return state.productions
      .filter(function (p) { return p.clientId === clientId; })
      .sort(function (a, b) {
        var sa = STAGES.findIndex(function (s) { return s.id === a.stage; });
        var sb = STAGES.findIndex(function (s) { return s.id === b.stage; });
        return sa - sb;
      });
  }

  /* ---------- producao ---------- */
  // Itens da semana de `ref`: entram os com data de post na semana
  // e os que ainda nao tem data e nao foram postados.
  function productionsOfWeek(ref) {
    var a = weekStart(ref), b = weekEnd(ref);
    return state.productions.filter(function (p) {
      if (p.postDate) return p.postDate >= a && p.postDate <= b;
      return p.stage !== 'postado';
    }).sort(function (x, y) {
      var sx = STAGES.findIndex(function (s) { return s.id === x.stage; });
      var sy = STAGES.findIndex(function (s) { return s.id === y.stage; });
      if (sx !== sy) return sx - sy;
      return (x.postDate || '9999') < (y.postDate || '9999') ? -1 : 1;
    });
  }

  /* ---------- CRUD generico ---------- */
  function upsert(list, obj) {
    var arr = state[list];
    if (obj.id) {
      var i = arr.findIndex(function (x) { return x.id === obj.id; });
      if (i !== -1) { arr[i] = Object.assign(arr[i], obj); save(); return arr[i]; }
    }
    obj.id = obj.id || uid();
    obj.createdAt = obj.createdAt || Date.now();
    arr.push(obj);
    save();
    return obj;
  }
  function remove(list, id) {
    var arr = state[list];
    var i = arr.findIndex(function (x) { return x.id === id; });
    if (i !== -1) { arr.splice(i, 1); save(); }
  }
  function find(list, id) {
    return state[list].find(function (x) { return x.id === id; }) || null;
  }

  /* ---------- exportar / importar ---------- */
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    var parsed = JSON.parse(text);
    state = normalize(parsed);
    save();
  }

  window.Store = {
    load: load, save: save, uid: uid,
    get state() { return state; },
    // datas
    iso: iso, today: today, parse: parse, addDays: addDays,
    weekStart: weekStart, weekEnd: weekEnd, daysBetween: daysBetween,
    fmtShort: fmtShort, fmtLong: fmtLong, fmtRelative: fmtRelative,
    // tarefas
    occursOn: occursOn, isDone: isDone, toggleDone: toggleDone,
    tasksOn: tasksOn, pendingCharges: pendingCharges, overdueTasks: overdueTasks,
    // clientes / producao
    STAGES: STAGES, clientStatus: clientStatus, clientsByPriority: clientsByPriority,
    clientName: clientName, productionsOfWeek: productionsOfWeek,
    // links e visao por cliente
    PLATFORMS: PLATFORMS, platformOf: platformOf, extractUrl: extractUrl,
    linksOf: linksOf, tasksOfClient: tasksOfClient, productionsOfClient: productionsOfClient,
    // crud
    upsert: upsert, remove: remove, find: find,
    exportJSON: exportJSON, importJSON: importJSON
  };
})();
