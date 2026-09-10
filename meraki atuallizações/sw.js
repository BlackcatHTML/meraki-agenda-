/* Service worker usado quando o OneSignal ainda nao esta configurado.
   Quando estiver, quem assume a raiz e o OneSignalSDKWorker.js
   (que importa exatamente o mesmo cache). */
importScripts('./sw-cache.js');
