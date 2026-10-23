/* UA-полірування для Сяйва / Lampa.
 * 1. Українські переклади рядків, яких бракує плагінам (Lampa без `uk` падає на `ru`).
 * 2. Необов'язково: шрифт Inter (латиниця + кирилиця) і фокус карток як в Apple TV
 *    (картка піднімається з тінню й відблиском замість білої рамки).
 * 3. Миттєвий перегляд: «Дивитись» без меню джерел. Фільм вмикається одразу з найкращої версії,
 *    серіал відкривається на наступній серії з вкладками сезонів. Утримати OK на «Дивитись» — ручний вибір.
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
        ua_polish_focus_descr: 'Картка піднімається з тінню й відблиском замість білої рамки',
        ua_polish_instant: 'Миттєвий перегляд',
        ua_polish_instant_descr: '«Дивитись» одразу вмикає найкраще джерело. Утримайте OK на кнопці, щоб вибрати вручну',
        ua_polish_season: 'Сезон',
        ua_polish_next: 'Далі'
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
        // Рядки серій і версій: той самий фокус замість подвійної білої рамки UAFilms.
        'body.uap-focus .online-prestige{border-radius:1em;transition:transform 180ms ' + ease + ',box-shadow 180ms ' + ease + ',background-color 180ms ' + ease + '}' +
        'body.uap-focus .online-prestige .online-prestige__img{border-radius:.7em;overflow:hidden}' +
        'body.uap-focus .online-prestige.focus{transform:scale(1.015);background-color:rgba(255,255,255,.16)!important;box-shadow:0 1em 2.2em rgba(0,0,0,.5)!important;border-radius:1em!important}' +
        'body.uap-focus .online-prestige.focus::after{display:none}' +
        // Вкладки сезонів: обраний сезон світлий, як сегменти tvOS.
        '.uap-season{white-space:nowrap}' +
        '.simple-button.uap-season.active:not(.focus){background-color:rgba(255,255,255,.3);color:#fff;font-weight:600}' +
        // Пошук за назвою потрібен рідко, а з вкладками рядок і так довгий.
        '.uap-seasons .filter--search{display:none}' +
        // Позначка наступної серії.
        '.uap-next .online-prestige__title::before{content:attr(data-uap-next);display:inline-block;margin-right:.6em;padding:.1em .55em;border-radius:.4em;background:#fff;color:#000;font-size:.75em;font-weight:600;vertical-align:.1em}' +
        '@media (prefers-reduced-motion: reduce){body.uap-focus .card .card__view,body.uap-focus .online-prestige{transition:none}body.uap-focus .online-prestige.focus{transform:none}}';

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
        [['ua_polish_font', 'ua_polish_font_descr'], ['ua_polish_focus', 'ua_polish_focus_descr'], ['ua_polish_instant', 'ua_polish_instant_descr']].forEach(function (p) {
            Lampa.SettingsApi.addParam({
                component: 'ua_polish',
                param: { name: p[0], type: 'trigger', default: true },
                field: { name: Lampa.Lang.translate(p[0]), description: Lampa.Lang.translate(p[1]) },
                onChange: apply
            });
        });
    }

    // --- Миттєвий перегляд ---

    // Порядок джерел: перше знайдене запускається, решта — запасні, якщо в попереднього нічого немає.
    var order = ['view--uafilms', 'view--bandera-online', 'view--online', 'view--torrent'];
    var manual = false;

    function instant() {
        return Lampa.Storage.field('ua_polish_instant') !== false;
    }

    function rank(btn) {
        for (var i = 0; i < order.length; i++) if (btn.hasClass(order[i])) return i;
        return -1;
    }

    // Сяйво показує меню «Джерело» через Lampa.Select; замість меню одразу запускаємо найкраще джерело.
    function hookSelect() {
        var show = Lampa.Select.show;
        Lampa.Select.show = function (params) {
            var auto = instant() && !manual && params && params.title == Lang('settings_rest_source');
            manual = false;
            var queue = auto ? params.items.map(function (i) { return i.btn; }).filter(function (b) { return b && rank(b) >= 0; }) : [];
            if (!queue.length) return show.apply(this, arguments);
            queue.sort(function (a, b) { return rank(a) - rank(b); });
            launch(queue);
        };
        // Сяйво перепривʼязує кнопку при кожному фокусі, тож слухаємо делеговано на document.
        $(document).on('hover:long', '.full-start__button.button--play', function () {
            manual = true;
            $(this).trigger('hover:enter');
        });
    }

    function Lang(key) {
        return Lampa.Lang.translate(key);
    }

    function launch(queue) {
        var btn = queue.shift();
        if (btn.hasClass('view--uafilms')) follow(queue);
        btn.trigger('hover:enter');
    }

    // Стежимо за екраном UAFilms: фільм запускаємо одразу, порожній результат — переходимо до наступного джерела.
    function follow(queue) {
        var seen = false, timer = 0;
        var obs = new MutationObserver(function () {
            var a = Lampa.Activity.active();
            if (!a || a.component != 'uafilms') return seen && done();
            seen = true;
            var root = a.activity.render();
            if (root.find('.uafilms-empty').length) {
                done();
                if (queue.length) {
                    Lampa.Activity.backward();
                    setTimeout(function () { launch(queue); }, 300);
                }
                return;
            }
            var movie = a.movie || {};
            if (movie.name || movie.number_of_seasons) return done(); // серіал: лишаємо список серій
            // Чекаємо трохи: UAFilms може за мить перемкнутися на кращого провайдера й перемалювати список.
            if (!timer && root.find('.online-prestige.selector').length) timer = setTimeout(function () {
                var item = best(root.find('.online-prestige.selector'));
                done();
                if (item && Lampa.Activity.active() === a) item.trigger('hover:enter');
            }, 600);
        });
        var stop = setTimeout(done, 30000);
        function done() {
            obs.disconnect();
            clearTimeout(stop);
        }
        obs.observe(document.body, { childList: true, subtree: true });
    }

    // Версія з переглядом, що почався, далі українська, далі перша (UAFilms уже сортує провайдерів).
    function best(items) {
        var list = items.toArray().map(function (el) { return $(el); });
        function started(i) {
            var bar = i.find('.time-line > div')[0];
            return bar && parseFloat(bar.style.width) > 0;
        }
        function ua(i) {
            return /укр|україн|\bua\b|дубл/i.test(i.find('.online-prestige__title').text());
        }
        return list.filter(started)[0] || list.filter(ua)[0] || list[0];
    }

    // UAFilms ховає сезони в меню «Фільтр»; виносимо їх вкладками в рядок над серіями.
    function hookFilter() {
        var Filter = Lampa.Filter;
        Lampa.Filter = function (object) {
            var filter = new Filter(object), set = filter.set;
            filter.set = function (type, items) {
                var res = set.apply(this, arguments);
                if (type == 'filter') seasons(filter, items);
                return res;
            };
            return filter;
        };
        Lampa.Filter.prototype = Filter.prototype;
    }

    function seasons(filter, items) {
        var season = items.filter(function (i) { return i.stype == 'season'; })[0];
        if (!season) return;
        var active = 0;
        season.items.forEach(function (s, n) { if (s.selected) active = n; });
        var head = filter.render();
        var key = season.items.length + ':' + active;
        // Перемальовуємо лише коли щось змінилось, інакше фокус на вкладці злетить.
        if (head.data('uap-seasons') !== key) {
            head.data('uap-seasons', key).addClass('uap-seasons');
            head.find('.uap-season').remove();
            var anchor = head.find('.filter--filter');
            season.items.forEach(function (s, n) {
                $('<div class="simple-button selector uap-season"></div>')
                    .text(Lang('ua_polish_season') + ' ' + (n + 1))
                    .toggleClass('active', n == active)
                    .on('hover:enter', function () { if (n != active) filter.onSelect('filter', season, s); })
                    .insertBefore(anchor);
            });
        }
        // Серії додаються одразу після filter.set, тож позначаємо наступну в наступному такті.
        setTimeout(function () { markNext(filter, season, active); }, 0);
    }

    function markNext(filter, season, active) {
        var episodes = filter.render().closest('.explorer, .files').find('.online-prestige[data-episode]');
        if (!episodes.length) return;
        episodes.removeClass('uap-next');
        var next = episodes.filter(function () { return !$(this).find('.online-prestige__viewed').length; }).first();
        // Сезон переглянуто повністю — один раз переходимо до наступного.
        if (!next.length && active + 1 < season.items.length && !filter.uap_advanced) {
            filter.uap_advanced = true;
            return filter.onSelect('filter', season, season.items[active + 1]);
        }
        if (next.index() > 0) next.addClass('uap-next').find('.online-prestige__title').attr('data-uap-next', Lang('ua_polish_next'));
    }

    function start() {
        addStrings();
        $('<style id="ua-polish-css"></style>').text(css).appendTo('head');
        addSettings();
        apply();
        hookSelect();
        hookFilter();
    }

    if (window.appready) start();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') start(); });
})();
