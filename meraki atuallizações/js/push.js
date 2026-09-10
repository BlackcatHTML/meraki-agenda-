/* ============================================================
   PUSH — OneSignal Web SDK v16.
   O agendamento das mensagens recorrentes vive no painel do
   OneSignal (Messages > Automated / Recurring). Aqui so cuidamos
   de registrar o aparelho e mostrar o estado pra ela.

   Detalhe do iPhone: push so funciona depois de instalar na tela
   de inicio e abrir pelo icone. No Safari, nem aparece a opcao.
   ============================================================ */
(function () {
  'use strict';

  var SDK = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
  var listeners = [];
  var status = {
    appId: '',
    configured: false,
    supported: 'serviceWorker' in navigator && 'PushManager' in window,
    standalone: isStandalone(),
    ios: isIOS(),
    permission: (window.Notification && Notification.permission) || 'default',
    subscribed: false,
    ready: false,
    error: ''
  };

  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function isIOS() {
    var ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function appId() {
    var s = window.Store && window.Store.state;
    var saved = s && s.settings && s.settings.oneSignalAppId;
    var cfg = (window.MERAKI_CONFIG || {}).ONESIGNAL_APP_ID;
    return (saved || cfg || '').trim();
  }

  function emit() { listeners.forEach(function (fn) { try { fn(status); } catch (e) {} }); }
  function onChange(fn) { listeners.push(fn); }

  function refresh() {
    status.permission = (window.Notification && Notification.permission) || 'default';
    status.standalone = isStandalone();
    try {
      if (window.OneSignal && OneSignal.User && OneSignal.User.PushSubscription) {
        status.subscribed = OneSignal.User.PushSubscription.optedIn === true;
      }
    } catch (e) {}
    emit();
  }

  /* ---------- inicializacao ---------- */
  var initPromise = null;

  function init() {
    if (initPromise) return initPromise;
    var id = appId();
    status.appId = id;
    status.configured = !!id;

    if (!id) {
      // Sem OneSignal ainda: registra o service worker proprio,
      // pra pelo menos instalar e funcionar offline.
      registerPlainSW();
      status.ready = true;
      emit();
      initPromise = Promise.resolve(false);
      return initPromise;
    }

    initPromise = unregisterPlainSW()
      .then(function () { return loadScript(SDK); })
      .then(function () {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        return new Promise(function (resolve, reject) {
          var timer = setTimeout(function () {
            reject(new Error('OneSignal não respondeu (rede ou App ID inválido).'));
          }, 15000);

          window.OneSignalDeferred.push(function (OneSignal) {
            var opts = {
              appId: id,
              // O worker na raiz importa o SDK e o cache do app.
              serviceWorkerPath: 'OneSignalSDKWorker.js',
              serviceWorkerParam: { scope: '/' },
              // Nada de pop-up automatico: a permissao e pedida por botao.
              autoResume: true,
              notifyButton: { enable: false },
              promptOptions: { slidedown: { prompts: [] } }
            };
            var safari = (window.MERAKI_CONFIG || {}).ONESIGNAL_SAFARI_WEB_ID;
            if (safari) opts.safari_web_id = safari;

            OneSignal.init(opts).then(function () {
              clearTimeout(timer);
              try {
                OneSignal.User.PushSubscription.addEventListener('change', refresh);
              } catch (e) {}
              status.ready = true;
              refresh();
              resolve(true);
            }).catch(function (err) {
              clearTimeout(timer);
              reject(err);
            });
          });
        });
      })
      .catch(function (err) {
        console.error('[push]', err);
        status.error = err && err.message ? err.message : String(err);
        status.ready = true;
        emit();
        return false;
      });

    return initPromise;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-onesignal]')) return resolve();
      var s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.setAttribute('data-onesignal', '');
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Não consegui carregar o SDK do OneSignal.')); };
      document.head.appendChild(s);
    });
  }

  /* ---------- service workers ---------- */
  // Sem OneSignal usamos sw.js. Com OneSignal, quem manda na raiz e
  // o OneSignalSDKWorker.js (que ja importa o mesmo cache), entao
  // o sw.js precisa sair de cena pra nao brigar pelo mesmo escopo.
  function registerPlainSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function (e) {
      console.warn('[sw]', e);
    });
  }

  function unregisterPlainSW() {
    if (!('serviceWorker' in navigator)) return Promise.resolve();
    return navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) {
        var url = (r.active && r.active.scriptURL) || (r.installing && r.installing.scriptURL) || '';
        if (/\/sw\.js(\?|$)/.test(url)) return r.unregister();
        return null;
      }));
    }).catch(function () {});
  }

  /* ---------- pedir permissao (sempre a partir de um toque) ---------- */
  function enable() {
    return init().then(function (ok) {
      if (!ok) {
        throw new Error(status.error || 'OneSignal ainda não está configurado. Cole o App ID abaixo.');
      }
      if (status.ios && !isStandalone()) {
        throw new Error('No iPhone, instale na tela de início e abra pelo ícone. Pelo Safari o push não existe.');
      }
      return OneSignal.Notifications.requestPermission().then(function () {
        return OneSignal.User.PushSubscription.optIn();
      }).then(function () {
        refresh();
        return status.subscribed;
      });
    });
  }

  window.Push = {
    init: init,
    enable: enable,
    refresh: refresh,
    onChange: onChange,
    get status() { return status; },
    isStandalone: isStandalone,
    isIOS: isIOS
  };
})();
