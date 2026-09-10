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
      team: [],
      demands: [],
      notes: '',
      settings: { oneSignalAppId: '', pushAsked: false, trafficMigrado: false }
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
    s.team = Array.isArray(s.team) ? s.team : [];
    s.demands = Array.isArray(s.demands) ? s.demands : [];
    s.notes = typeof s.notes === 'string' ? s.notes : '';
    s.settings = s.settings && typeof s.settings === 'object' ? s.settings : base.settings;
    if (typeof s.settings.oneSignalAppId !== 'string') s.settings.oneSignalAppId = '';

    s.tasks.forEach(function (t) {
      if (!Array.isArray(t.doneDates)) t.doneDates = [];
      if (!t.kind) t.kind = 'task';
      if (!t.repeat) t.repeat = 'none';
    });

    // Clientes agora contam por semana tambem, e os numeros de prontos e
    // agendados sao editaveis na mao. Quem ja existia recebe o valor
    // calculado da producao como ponto de partida.
    s.clients.forEach(function (c) {
      if (typeof c.needed !== 'number') c.needed = Number(c.needed) || 0;
      if (typeof c.produced !== 'number') c.produced = Number(c.produced) || 0;
      if (c.neededWeek == null) c.neededWeek = c.needed ? Math.max(1, Math.round(c.needed / 4)) : 0;
      if (c.producedWeek == null) c.producedWeek = 0;
      if (c.ready == null) {
        c.ready = s.productions.filter(function (p) {
          return p.clientId === c.id && p.stage === 'pronto';
        }).length;
      }
      if (c.scheduled == null) {
        c.scheduled = s.productions.filter(function (p) {
          return p.clientId === c.id && p.stage !== 'postado' && (p.postOk || p.postDate);
        }).length;
      }
    });

    s.demands.forEach(function (d) {
      if (!Array.isArray(d.chargedDates)) d.chargedDates = [];
      if (!d.status) d.status = 'pendente';
    });

    // O bloco de trafego morava solto na Producao da semana. Virou cobranca
    // de um membro da equipe. Se ela ja tinha preenchido algo, nao se perde.
    if (s.traffic && (String(s.traffic.leads || '').trim() || String(s.traffic.notes || '').trim())
        && !s.settings.trafficMigrado) {
      var joe = s.team.filter(function (m) { return /joe/i.test(m.name); })[0];
      if (!joe) {
        joe = { id: uid(), name: 'Joe', role: 'Gestor de tráfego', active: true, notes: '', createdAt: Date.now() };
        s.team.push(joe);
      }
      s.demands.push({
        id: uid(), memberId: joe.id, clientId: '',
        title: 'Relatório de tráfego da semana',
        detail: 'Leads captados e o que ajustar.',
        due: today(), status: 'entregue', chargedDates: [], deliveredAt: today(),
        leads: String(s.traffic.leads || ''), result: String(s.traffic.notes || ''),
        createdAt: Date.now()
      });
      s.settings.trafficMigrado = true;
    }
    delete s.traffic;

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

  // Os numeros sao os que ela mantem na mao (prontos, agendados, feitos na
  // semana). O status sai deles; a semana manda, o mes e acompanhamento.
  function clientStatus(client) {
    var produced = Number(client.produced) || 0;
    var needed = Number(client.needed) || 0;
    var producedWeek = Number(client.producedWeek) || 0;
    var neededWeek = Number(client.neededWeek) || 0;
    var estoque = Number(client.ready) || 0;
    var agendados = Number(client.scheduled) || 0;

    var deficitWeek = Math.max(0, neededWeek - producedWeek);
    var deficit = Math.max(0, needed - produced);

    var status, severity, accent;
    if (deficitWeek > 0 && agendados === 0) {
      status = 'Sem conteúdo pra semana'; severity = 3; accent = 'alert';
    } else if (estoque < 2) {
      status = 'Precisa de novo roteiro'; severity = 2; accent = 'warn';
    } else {
      status = 'OK'; severity = 1; accent = 'ok';
    }

    return {
      status: status, severity: severity, accent: accent,
      produced: produced, needed: needed, deficit: deficit,
      producedWeek: producedWeek, neededWeek: neededWeek, deficitWeek: deficitWeek,
      agendados: agendados, estoque: estoque,
      total: state.productions.filter(function (p) { return p.clientId === client.id; }).length
    };
  }

  // Quem esta mais atrasado aparece primeiro.
  function clientsByPriority() {
    return state.clients
      .map(function (c) { return { client: c, calc: clientStatus(c) }; })
      .sort(function (a, b) {
        if (a.calc.severity !== b.calc.severity) return b.calc.severity - a.calc.severity;
        if (a.calc.deficitWeek !== b.calc.deficitWeek) return b.calc.deficitWeek - a.calc.deficitWeek;
        if (a.calc.deficit !== b.calc.deficit) return b.calc.deficit - a.calc.deficit;
        if (a.calc.estoque !== b.calc.estoque) return a.calc.estoque - b.calc.estoque;
        return (a.client.name || '').localeCompare(b.client.name || '');
      });
  }

  // Soma rapida nos contadores do cliente, direto no card (sem abrir form).
  function bumpClient(id, field, delta) {
    var c = state.clients.find(function (x) { return x.id === id; });
    if (!c) return;
    var v = (Number(c[field]) || 0) + delta;
    c[field] = Math.max(0, Math.min(999, v));
    save();
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

  /* ---------- equipe e cobrancas ----------
     Uma "demand" e uma coisa que ela cobra de alguem: o que e, pra quando,
     de qual cliente, se ja entregou, e o historico de quantas vezes cobrou. */

  var DEMAND_STATUS = {
    pendente: { label: 'Em aberto', accent: 'warn' },
    entregue: { label: 'Entregue', accent: 'ok' },
    'nao-entregue': { label: 'Não entregou', accent: 'alert' }
  };

  // Pendente com prazo vencido conta como atrasada.
  function demandLate(d) {
    return d.status === 'pendente' && d.due && daysBetween(d.due, today()) > 0;
  }
  function demandDaysLate(d) {
    return demandLate(d) ? daysBetween(d.due, today()) : 0;
  }

  function demandsOf(memberId) {
    return state.demands
      .filter(function (d) { return d.memberId === memberId; })
      .sort(ordenaDemand);
  }
  function demandsOfClient(clientId) {
    return state.demands
      .filter(function (d) { return d.clientId === clientId; })
      .sort(ordenaDemand);
  }
  function openDemands() {
    return state.demands
      .filter(function (d) { return d.status === 'pendente'; })
      .sort(ordenaDemand);
  }

  // Em aberto primeiro, mais atrasado no topo; entregues por ultimo.
  function ordenaDemand(a, b) {
    var pa = a.status === 'pendente' ? 0 : 1;
    var pb = b.status === 'pendente' ? 0 : 1;
    if (pa !== pb) return pa - pb;
    if (pa === 0) return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
    return (b.deliveredAt || '') < (a.deliveredAt || '') ? -1 : 1;
  }

  // Registra que cobrou hoje (sem duplicar se cobrar duas vezes no mesmo dia).
  function chargeDemand(id) {
    var d = state.demands.find(function (x) { return x.id === id; });
    if (!d) return;
    var t = today();
    if (d.chargedDates.indexOf(t) === -1) d.chargedDates.push(t);
    save();
  }
  function lastCharge(d) {
    if (!d.chargedDates || !d.chargedDates.length) return '';
    return d.chargedDates.slice().sort()[d.chargedDates.length - 1];
  }
  // Cobranças feitas na semana passada — util pra lembrar o que ficou pendurado.
  function chargedLastWeek(d) {
    var inicio = addDays(weekStart(today()), -7);
    var fim = addDays(inicio, 6);
    return (d.chargedDates || []).filter(function (x) { return x >= inicio && x <= fim; });
  }

  function setDemandStatus(id, status, extra) {
    var d = state.demands.find(function (x) { return x.id === id; });
    if (!d) return;
    d.status = status;
    d.deliveredAt = status === 'entregue' ? today() : '';
    if (extra) {
      if (extra.result != null) d.result = extra.result;
      if (extra.leads != null) d.leads = extra.leads;
    }
    save();
  }

  function memberName(id) {
    var m = state.team.find(function (x) { return x.id === id; });
    return m ? m.name : 'Sem responsável';
  }

  // Contagem que aparece na lista da equipe.
  function memberSummary(memberId) {
    var mine = demandsOf(memberId);
    return {
      total: mine.length,
      abertas: mine.filter(function (d) { return d.status === 'pendente'; }).length,
      atrasadas: mine.filter(demandLate).length,
      entregues: mine.filter(function (d) { return d.status === 'entregue'; }).length,
      furadas: mine.filter(function (d) { return d.status === 'nao-entregue'; }).length
    };
  }

  function teamByUrgency() {
    return state.team
      .map(function (m) { return { member: m, calc: memberSummary(m.id) }; })
      .sort(function (a, b) {
        if (a.calc.atrasadas !== b.calc.atrasadas) return b.calc.atrasadas - a.calc.atrasadas;
        if (a.calc.abertas !== b.calc.abertas) return b.calc.abertas - a.calc.abertas;
        return (a.member.name || '').localeCompare(b.member.name || '');
      });
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
    clientName: clientName, productionsOfWeek: productionsOfWeek, bumpClient: bumpClient,
    // equipe e cobrancas
    DEMAND_STATUS: DEMAND_STATUS, demandLate: demandLate, demandDaysLate: demandDaysLate,
    demandsOf: demandsOf, demandsOfClient: demandsOfClient, openDemands: openDemands,
    chargeDemand: chargeDemand, lastCharge: lastCharge, chargedLastWeek: chargedLastWeek,
    setDemandStatus: setDemandStatus, memberName: memberName,
    memberSummary: memberSummary, teamByUrgency: teamByUrgency,
    // links e visao por cliente
    PLATFORMS: PLATFORMS, platformOf: platformOf, extractUrl: extractUrl,
    linksOf: linksOf, tasksOfClient: tasksOfClient, productionsOfClient: productionsOfClient,
    // crud
    upsert: upsert, remove: remove, find: find,
    exportJSON: exportJSON, importJSON: importJSON
  };
})();
