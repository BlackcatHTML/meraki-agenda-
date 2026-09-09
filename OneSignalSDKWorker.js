/* Worker do push. O OneSignal exige este arquivo na raiz do site.
   A ordem importa: primeiro o SDK, depois o cache do app. */
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
importScripts('./sw-cache.js');
