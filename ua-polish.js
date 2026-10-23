/* UA-полірування для Сяйва / Lampa.
 * 1. Українські переклади рядків, яких бракує плагінам (Lampa без `uk` падає на `ru`).
 * 2. Необов'язково: шрифт Inter (латиниця + кирилиця) і фокус карток як в Apple TV
 *    (картка піднімається з тінню й відблиском замість білої рамки).
 * Налаштування: Налаштування → UA-полірування.
 */
(function () {
    'use strict';
    if (window.ua_polish_ready) return;
    window.ua_polish_ready = true;

    // Шрифт лежить поруч із плагіном; currentScript зникає після виконання, тож беремо адресу зараз.
    var script = document.currentScript && document.currentScript.src || '';
    var base = script.slice(0, script.lastIndexOf('/') + 1);

    // Плагіни задають ці ключі лише з ru/en (Bandera Online); uk додаємо тут.
    var strings = {
        online_watch: 'Дивитися онлайн',
        online_no_watch_history: 'Немає історії перегляду',
        online_video: 'Відео',
        ua_polish_title: 'UA-полірування',
        ua_polish_font: 'Шрифт Inter',
        ua_polish_font_descr: 'Один шрифт для кирилиці й латиниці, як у лаунчері',
        ua_polish_focus: 'Фокус як в Apple TV',
        ua_polish_focus_descr: 'Картка піднімається з тінню й відблиском замість білої рамки'
    };

    function addStrings() {
        var data = {};
        for (var key in strings) data[key] = { uk: strings[key] };
        Lampa.Lang.add(data);
    }

    var ease = 'cubic-bezier(0.23, 1, 0.32, 1)';
    var css =
        "@font-face{font-family:'UAP Inter';src:url('" + base + "inter.ttf') format('truetype');font-weight:100 900;font-display:swap}" +
        "body.uap-font{font-family:'UAP Inter','SegoeUI',sans-serif}" +
        // Фокус: прибираємо рамку, піднімаємо й збільшуємо картку, додаємо тінь і відблиск зверху.
        'body.uap-focus .card .card__view{transition:transform 180ms ' + ease + ',box-shadow 180ms ' + ease + ';border-radius:1em}' +
        'body.uap-focus .card .card__view::after{display:none}' +
        'body.uap-focus .card.focus .card__view,body.uap-focus .card.hover .card__view{transform:translateY(-0.3em) scale(1.08);box-shadow:0 1.2em 2.4em rgba(0,0,0,.55);z-index:2}' +
        'body.uap-focus .card.focus .card__view::after,body.uap-focus .card.hover .card__view::after{display:block;top:0;left:0;right:0;bottom:0;border:0;border-radius:1em;z-index:3;' +
        'background:linear-gradient(180deg,rgba(255,255,255,.18) 0%,rgba(255,255,255,.04) 45%,rgba(255,255,255,0) 60%)}' +
        '@media (prefers-reduced-motion: reduce){body.uap-focus .card .card__view{transition:none}}';

    function apply() {
        $('body').toggleClass('uap-font', Lampa.Storage.field('ua_polish_font') !== false);
        $('body').toggleClass('uap-focus', Lampa.Storage.field('ua_polish_focus') !== false);
    }

    function addSettings() {
        Lampa.SettingsApi.addComponent({
            component: 'ua_polish',
            name: Lampa.Lang.translate('ua_polish_title'),
            icon: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="7" rx="1.5" fill="#0057B7"/><rect x="3" y="12" width="18" height="7" rx="1.5" fill="#FFD700"/></svg>'
        });
        [['ua_polish_font', 'ua_polish_font_descr'], ['ua_polish_focus', 'ua_polish_focus_descr']].forEach(function (p) {
            Lampa.SettingsApi.addParam({
                component: 'ua_polish',
                param: { name: p[0], type: 'trigger', default: true },
                field: { name: Lampa.Lang.translate(p[0]), description: Lampa.Lang.translate(p[1]) },
                onChange: apply
            });
        });
    }

    function start() {
        addStrings();
        $('<style id="ua-polish-css"></style>').text(css).appendTo('head');
        addSettings();
        apply();
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') start(); });
})();
