(function () {
    'use strict';

    // Torrentio options: every tracker except the Russian ones (Rutor, Rutracker); drop BD remuxes (60+ GB),
    // screeners, cams and 3D; at most 5 per quality, best quality first.
    var PROVIDERS = 'yts,eztv,rarbg,1337x,ext,thepiratebay,kickasstorrents,torrentgalaxy,magnetdl,horriblesubs,nyaasi,tokyotosho,anidex,nekobt,' +
        'comando,bludv,micoleaodublado,torrent9,ilcorsaronero,mejortorrent,wolfmax4k,cinecalidad,besttorrents';
    var OPTIONS = '|qualityfilter=brremux,scr,cam,threed|limit=5|sort=qualitysize';
    // Toloka through the LampaUA Jackett (the one Ukrainian parser that answers); only toloka results are kept.
    var TOLOKA = 'http://lampaua.mooo.com/api/v2.0/indexers/all/results?apikey=&Query=';
    var TRACKERS = ['udp://tracker.opentrackr.org:1337/announce', 'udp://open.demonii.com:1337/announce', 'udp://tracker.torrent.eu.org:451/announce'];
    var HEAVY = 15 * 1024 * 1024 * 1024;
    var TABS = [['ua', 'Українська'], ['en', 'English'], ['all', 'Усі']];

    $('head').append('<style>' +
        '.torrentio-tabs{display:flex;gap:1em;padding:0 0 1.5em}' +
        '.torrentio-tabs .simple-button.active:not(.focus){background-color:rgba(255,255,255,.3);color:#fff}' +
        // Heavy releases stall this TV: greyed, but kept in their sorted place.
        '.torrent-item.torrentio-heavy{opacity:.45}.torrent-item.torrentio-heavy.focus{opacity:.8}' +
        '</style>');

    // "tpb": only The Pirate Bay, only English releases, no Toloka and no language tabs.
    function onlyTpb() {
        return Lampa.Storage.field('torrentio_source') == 'tpb';
    }

    function server() {
        // shortcut: assumes the TorrServe app on this TV at 127.0.0.1:8090 when Lampa has no TorrServe address set.
        return Lampa.Torserver.url() || 'http://127.0.0.1:8090';
    }

    function today() { return new Date().toISOString().slice(0, 10); }

    function rankOf(text) {
        if (/2160p|\b4k\b|uhd/i.test(text)) return 4;
        if (/1080p/i.test(text)) return 3;
        if (/720p/i.test(text)) return 2;
        return 1;
    }

    function bytesOf(text) {
        var m = (text || '').match(/([\d.,]+)\s*(KB|MB|GB|TB)/i);
        return m ? parseFloat(m[1].replace(',', '.')) * Math.pow(1024, ['KB', 'MB', 'GB', 'TB'].indexOf(m[2].toUpperCase()) + 1) : 0;
    }

    function episodeView(movie, season, episode) {
        return Lampa.Timeline.watchedEpisode(movie, season, episode, true);
    }

    function playUrl(url, object) {
        var movie = object.movie;
        var data = {
            url: url,
            title: object.season ? (movie.name + ' · S' + object.season + 'E' + object.episode) : (movie.title || movie.name),
            card: movie,
            timeline: object.season ? episodeView(movie, object.season, object.episode) : Lampa.Timeline.view(Lampa.Utils.hash(movie.original_title || movie.title))
        };
        Lampa.Player.play(data);
        Lampa.Player.playlist([data]);
    }

    // Torrentio title: "release\n[file in pack\n]👤 170 💾 6.91 GB ⚙️ YTS[\nMulti Audio / 🇬🇧 / 🇺🇦]".
    function parse(s) {
        var lines = (s.title || '').split('\n');
        var at = -1;
        lines.forEach(function (l, i) { if (l.indexOf('👤') >= 0) at = i; });
        var meta = at >= 0 ? lines[at] : '';
        var langs = at >= 0 ? lines.slice(at + 1).join(' ') : '';
        var tracker = (meta.match(/⚙️\s*(.+)$/) || [])[1] || '';
        var flags = langs.match(/[\u{1F1E6}-\u{1F1FF}]{2}/gu) || [];
        // Releases with dozens of subtitle languages list every flag; show a few.
        var shown = flags.length > 4 ? flags.slice(0, 3).join(' ') + ' +' + (flags.length - 3) : langs;
        return {
            title: (at >= 0 ? lines.slice(0, at) : lines).join(' / '),
            date: (s.name || '').replace('Torrentio\n', ''),
            tracker: shown ? tracker + ' · ' + shown : tracker,
            langs: langs,
            flags: flags.length,
            seeds: (meta.match(/👤\s*(\d+)/) || [])[1] || '0',
            size: (meta.match(/💾\s*([\d.,]+\s*\w+)/) || [])[1] || ''
        };
    }

    // A Torrentio stream already names its file; TorrServe counts files from 1, Torrentio from 0.
    function torrentioRow(s, object) {
        var data = parse(s);
        var bytes = bytesOf(data.size);
        return {
            hash: (s.infoHash || '').toLowerCase(),
            data: data,
            // A 🇺🇦 among many flags is a subtitle track, not Ukrainian audio.
            ua: /ukr/i.test(data.langs) || (/🇺🇦/.test(data.langs) && data.flags <= 4),
            // No language line means an English-only release. Pirate Bay mode keeps "Dual/Multi Audio" (an anime's
            // dub, a film's original + one dub) and drops only releases flagged with other languages alone.
            en: !data.langs || /🇬🇧|eng/i.test(data.langs) || (onlyTpb() && !data.flags),
            rank: rankOf(data.date),
            bytes: bytes,
            heavy: rankOf(data.date) == 4 || bytes > HEAVY,
            enter: function () {
                var magnet = 'magnet:?xt=urn:btih:' + s.infoHash + TRACKERS.map(function (t) { return '&tr=' + encodeURIComponent(t); }).join('');
                var name = (s.behaviorHints && s.behaviorHints.filename) || 'video.mkv';
                playUrl(server() + '/stream/' + encodeURIComponent(name) + '?link=' + encodeURIComponent(magnet) + '&index=' + ((s.fileIdx || 0) + 1) + '&play', object);
            }
        };
    }

    // Toloka gives whole-season packs without file numbers: the viewer's passkey goes in, then playPack.
    function playToloka(r, object) {
        // Toloka torrents are private: the parser's own passkey may only seed, so the viewer's passkey goes in.
        var passkey = (Lampa.Storage.get('torrentio_toloka_passkey', '') + '').trim();
        if (!passkey) return Lampa.Noty.show('Для Toloka потрібен ваш ключ: Налаштування → Torrentio');
        playPack((r.MagnetUri || r.Link).replace(/([?&]h=)[^&]*/g, '$1' + passkey), r.Title, 'Toloka', object);
    }

    // A torrent without file numbers: add it to TorrServe, wait for its file list, then find the episode by file
    // name the way Lampa's own torrent screen does (a film: the largest video).
    function playPack(link, title, source, object) {
        var post = function (body) {
            return fetch(server() + '/torrents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
                .then(function (res) { return res.json(); });
        };
        var stopped = false;
        Lampa.Loading.start(function () { stopped = true; Lampa.Loading.stop(); });
        post({ action: 'add', link: link, title: title, save_to_db: false }).then(function (t) {
            var tries = 0;
            (function poll() {
                if (stopped) return;
                post({ action: 'get', hash: t.hash }).then(function (info) {
                    if (!info.file_stats) {
                        if (++tries < 30) return setTimeout(poll, 2000);
                        Lampa.Loading.stop();
                        return Lampa.Noty.show(source + ': не вдалося отримати список файлів');
                    }
                    Lampa.Loading.stop();
                    var videos = info.file_stats.filter(function (f) { return /\.(mkv|mp4|avi|m4v|ts|mov)$/i.test(f.path); });
                    var file = object.season ? videos.filter(function (f) {
                        var p = Lampa.Torserver.parse({ movie: object.movie, files: videos, filename: f.path.split('/').pop(), path: f.path });
                        return p.episode == object.episode && (!p.season || p.season == object.season);
                    })[0] : videos.sort(function (a, b) { return b.length - a.length; })[0];
                    // A single-episode torrent names its episode in the release, not always in the file.
                    if (!file && object.season && videos.length == 1) file = videos[0];
                    if (!file) return Lampa.Noty.show('У цьому релізі немає серії ' + object.episode);
                    playUrl(server() + '/stream/' + encodeURIComponent(file.path.split('/').pop()) + '?link=' + t.hash + '&index=' + file.id + '&play', object);
                }, function () { Lampa.Loading.stop(); Lampa.Noty.show('TorrServe не відповідає'); });
            })();
        }, function () { Lampa.Loading.stop(); Lampa.Noty.show('TorrServe не відповідає'); });
    }

    function tolokaRows(object) {
        var movie = object.movie;
        var names = [movie.title, movie.name, movie.original_title, movie.original_name].filter(Boolean).map(function (n) { return n.toLowerCase(); });
        var year = (movie.release_date || '').slice(0, 4);
        return fetch(TOLOKA + encodeURIComponent(movie.title || movie.name))
            .then(function (res) { return res.json(); })
            .then(function (json) {
                return (json.Results || []).filter(function (r) {
                    var title = r.Title || '';
                    if ((r.Tracker || '').toLowerCase() != 'toloka') return false;
                    if (!names.some(function (n) { return title.toLowerCase().indexOf(n) >= 0; })) return false;
                    if (!object.season) return !year || title.indexOf(year) >= 0;
                    // "(Сезон 3)", "(Сезон 1-2)", "(Season 1-4)"; a release without a season number stays in.
                    var m = title.match(/(?:Сезон|Season)\S*\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
                    return !m || (object.season >= +m[1] && object.season <= +(m[2] || m[1]));
                }).map(function (r) {
                    var rank = rankOf(r.Title);
                    return {
                        data: { title: r.Title, date: ['', '', '720p', '1080p', '4k'][rank], tracker: 'Toloka', seeds: r.Seeders || 0, size: Lampa.Utils.bytesToSize(r.Size) },
                        ua: true,
                        en: /eng/i.test(r.Title),
                        rank: rank,
                        bytes: r.Size,
                        // A Toloka series release is a season pack, so only 4K marks it heavy.
                        heavy: rank == 4 || (!object.season && r.Size > HEAVY),
                        enter: function () { playToloka(r, object); }
                    };
                });
            })
            .catch(function () { return []; });
    }

    // Torrentio maps Pirate Bay releases to IMDb with a lag (a season out a week had none), so Pirate Bay mode also
    // asks Pirate Bay's own API. Its JSON has no CORS header: Lampa's native request goes around that on Android.
    function apibay(query) {
        return new Promise(function (resolve) {
            var network = new Lampa.Reguest();
            network.timeout(15000);
            network.native('https://apibay.org/q.php?q=' + encodeURIComponent(query), function (json) {
                try { resolve(typeof json == 'string' ? JSON.parse(json) : json || []); } catch (e) { resolve([]); }
            }, function () { resolve([]); });
        });
    }

    // S02E01, S02 (a season pack), S01-S02 or "Season 2"; a release naming no season is left out.
    function fitsEpisode(name, season, episode) {
        var m = name.match(/S(\d{1,2})E(\d{1,3})/i);
        if (m) return +m[1] == season && +m[2] == episode;
        m = name.match(/S(\d{1,2})\s*-\s*S?(\d{1,2})\b/i);
        if (m) return season >= +m[1] && season <= +m[2];
        m = name.match(/\bS(\d{1,2})\b|Season\s*(\d{1,2})/i);
        return !!m && +(m[1] || m[2]) == season;
    }

    function pirateRows(object) {
        var movie = object.movie;
        var name = (movie.original_name || movie.original_title || movie.name || movie.title || '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
        var queries = [movie.imdb_id];
        // Season packs often carry no IMDb tag.
        if (object.season) queries.push(name + ' S' + (object.season < 10 ? '0' : '') + object.season);
        return Promise.all(queries.filter(Boolean).map(apibay)).then(function (lists) {
            var seen = {};
            return [].concat.apply([], lists).filter(function (r) {
                var hash = (r.info_hash || '').toLowerCase();
                if (!hash || r.id == '0' || seen[hash] || !/^2/.test(r.category)) return false;
                seen[hash] = true;
                if (/dublado|latino|castellano|hindi|tamil|telugu|truefrench|\bvff?\b|\brus\b/i.test(r.name) && !/eng/i.test(r.name)) return false;
                return object.season ? fitsEpisode(r.name, object.season, object.episode) : true;
            }).map(function (r) {
                var rank = rankOf(r.name);
                var bytes = +r.size;
                var magnet = 'magnet:?xt=urn:btih:' + r.info_hash + '&dn=' + encodeURIComponent(r.name) + TRACKERS.map(function (t) { return '&tr=' + encodeURIComponent(t); }).join('');
                return {
                    hash: r.info_hash.toLowerCase(),
                    data: { title: r.name, date: ['', '', '720p', '1080p', '4k'][rank], tracker: 'ThePirateBay', seeds: +r.seeders, size: Lampa.Utils.bytesToSize(bytes) },
                    en: true,
                    rank: rank,
                    bytes: bytes,
                    // A season pack is many episodes, so only 4K marks it heavy.
                    heavy: rank == 4 || (!object.season && bytes > HEAVY),
                    enter: function () { playPack(magnet, r.name, 'Pirate Bay', object); }
                };
            });
        });
    }

    function streamRows(object) {
        var tpb = onlyTpb();
        // Pirate Bay: best-seeded first within a quality, so the popular small encodes are not cut by the limit.
        var base = 'https://torrentio.strem.fun/providers=' + (tpb ? 'thepiratebay' + OPTIONS.replace('limit=5|sort=qualitysize', 'limit=8|sort=quality') : PROVIDERS + OPTIONS);
        var torrentio = fetch(base + '/stream/' + object.type + '/' + object.id + '.json')
            .then(function (res) { return res.json(); })
            .then(function (json) { return (json.streams || []).map(function (s) { return torrentioRow(s, object); }); })
            .then(function (rows) { return tpb ? rows.filter(function (r) { return r.en; }) : rows; })
            .catch(function () { return []; });
        var extra = tpb ? pirateRows(object).catch(function () { return []; }) : tolokaRows(object);
        return Promise.all([torrentio, extra]).then(function (lists) {
            // The same release from both: keep Torrentio's, which already knows the episode's file.
            var known = {};
            lists[0].forEach(function (r) { known[r.hash] = true; });
            return lists[0].concat(lists[1].filter(function (r) { return !r.hash || !known[r.hash]; })).sort(function (a, b) {
                return b.rank - a.rank || (tpb ? b.data.seeds - a.data.seeds : b.bytes - a.bytes);
            });
        });
    }

    // Full-screen list in Lampa's own torrent-row style.
    function Screen(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html = $('<div></div>');
        var tabs = $('<div class="torrentio-tabs"></div>');
        var list = $('<div></div>');
        var last, all, tab;
        scroll.minus();
        scroll.body().addClass('torrent-list');

        this.create = function () {
            var _this = this;
            this.activity.loader(true);
            var rows = object.level == 'season' ? Promise.resolve(seasonRows(object.movie))
                : object.level == 'episode' ? episodeRows(object)
                : streamRows(object);
            rows.then(function (r) { _this.build(r); }, function () { _this.build([]); });
            return this.render();
        };

        this.build = function (rows) {
            if (!object.level) {
                all = rows;
                if (onlyTpb()) tab = 'all';
                else {
                    tab = rows.some(function (r) { return r.ua; }) ? 'ua' : 'en';
                    scroll.append(tabs);
                    drawTabs();
                }
            }
            scroll.append(list);
            fill(object.level ? rows : shown());
            html.append(scroll.render());
            this.activity.loader(false);
            this.activity.toggle();
        };

        function shown() {
            return all.filter(function (r) { return tab == 'all' || r[tab]; });
        }

        function drawTabs() {
            tabs.empty();
            TABS.forEach(function (t) {
                var count = t[0] == 'all' ? all.length : all.filter(function (r) { return r[t[0]]; }).length;
                var button = $('<div class="simple-button selector"></div>').text(t[1] + ' (' + count + ')').toggleClass('active', t[0] == tab);
                button.on('hover:focus', function () { last = button[0]; scroll.update(button, true); });
                button.on('hover:enter', function () {
                    tab = t[0];
                    drawTabs();
                    fill(shown());
                    last = tabs.find('.active')[0];
                    Lampa.Controller.toggle('content');
                });
                tabs.append(button);
            });
        }

        function fill(rows) {
            list.empty();
            if (!rows.length) list.append($('<div class="torrent-item selector"><div class="torrent-item__title">Нічого не знайдено</div></div>'));
            rows.forEach(function (row) {
                var item = Lampa.Template.get(row.template || 'torrent', row.data);
                // Neither source gives a peer count, and bitrate needs the runtime.
                item.find('.torrent-item__bitrate, .torrent-item__grabs').remove();
                if (object.level == 'season') item.find('.torrent-item__seeds, .torrent-item__size').remove();
                if (row.heavy) item.addClass('torrentio-heavy');
                if (row.decorate) row.decorate(item);
                item.on('hover:focus', function () { last = item[0]; scroll.update(item, true); });
                item.on('hover:enter', row.enter);
                list.append(item);
            });
            Lampa.Layer.visible(scroll.render(true));
        }

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                up: function () { if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
                down: function () { Navigator.move('down'); },
                left: function () { if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
                right: function () { Navigator.move('right'); },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};
        this.stop = function () {};
        this.render = function () { return html; };
        this.destroy = function () { scroll.destroy(); html.remove(); };
    }

    Lampa.Component.add('torrentio', Screen);

    Lampa.SettingsApi.addComponent({
        component: 'torrentio',
        name: 'Torrentio',
        icon: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M8 8v5a4 4 0 0 0 8 0V8" stroke="currentColor" stroke-width="2"/></svg>'
    });
    Lampa.SettingsApi.addParam({
        component: 'torrentio',
        param: { name: 'torrentio_source', type: 'select', values: { tpb: 'Лише The Pirate Bay (англійською)', all: 'Усі трекери + Toloka' }, default: 'tpb' },
        field: { name: 'Джерело', description: 'Pirate Bay: лише англомовні релізи, без вкладок мов' }
    });
    Lampa.SettingsApi.addParam({
        component: 'torrentio',
        param: { name: 'torrentio_toloka_passkey', type: 'input', default: '', values: '', placeholder: '' },
        field: { name: 'Ключ Toloka (passkey)', description: 'Потрібен для релізів з Toloka. Його видно на toloka.to у вашому профілі або в посиланні announce будь-якого .torrent' }
    });

    function push(params) {
        params.url = '';
        params.component = 'torrentio';
        params.page = 1;
        Lampa.Activity.push(params);
    }

    // Seasons that have started airing.
    function seasonRows(movie) {
        var list = (movie.seasons || []).filter(function (s) { return s.season_number > 0 && s.air_date && s.air_date <= today(); });
        if (!list.length) for (var i = 1; i <= (movie.number_of_seasons || 1); i++) list.push({ season_number: i });
        return list.map(function (s) {
            return {
                data: { title: s.name || 'Сезон ' + s.season_number, date: s.episode_count ? s.episode_count + ' сер.' : '', tracker: s.air_date ? s.air_date.slice(0, 4) : '' },
                enter: function () { push({ title: 'Torrentio · Сезон ' + s.season_number, movie: movie, level: 'episode', season: s.season_number }); }
            };
        });
    }

    // Released episodes with name, date, still and watched progress from TMDB and Lampa's timeline.
    function episodeRows(object) {
        var movie = object.movie, season = object.season;
        return new Promise(function (resolve) { Lampa.Api.seasons(movie, [season], resolve); }).then(function (data) {
            var episodes = ((data[season] || {}).episodes || []).filter(function (e) { return e.air_date && e.air_date <= today(); });
            return episodes.map(function (e) {
                var n = e.episode_number;
                var view = episodeView(movie, season, n);
                return {
                    template: 'torrent_file_serial',
                    data: { img: e.still_path ? Lampa.Api.img(e.still_path) : './img/img_broken.svg', fname: e.name || 'Серія ' + n, season: season, air_date: Lampa.Utils.parseTime(e.air_date).full, episode: n, size: '', exe: '' },
                    decorate: function (item) {
                        item.find('.torrent-serial__detail').remove();
                        var img = item.find('.torrent-serial__img')[0];
                        img.onload = function () { img.classList.add('loaded'); };
                        img.src = img.getAttribute('data-src');
                        item.find('.torrent-serial__content').append(Lampa.Timeline.render(view));
                    },
                    enter: function () {
                        push({ title: 'Torrentio · S' + season + 'E' + n, movie: movie, type: 'series', id: movie.imdb_id + ':' + season + ':' + n, season: season, episode: n });
                    }
                };
            });
        });
    }

    function open(movie) {
        if (!movie.imdb_id) return Lampa.Noty.show('Torrentio: у картки немає IMDb ID');
        if (!movie.name) return push({ title: 'Torrentio', movie: movie, type: 'movie', id: movie.imdb_id });
        push({ title: 'Torrentio · ' + movie.name, movie: movie, level: 'season' });
    }

    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;
        var movie = e.data.movie;
        var btn = $('<div class="full-start__button selector view--torrentio"><svg><use xlink:href="#sprite-torrent"></use></svg><span>Torrentio</span></div>');
        btn.on('hover:enter', function () { open(movie); });
        var root = e.object.activity.render();
        var native = root.find('.view--torrent');
        // Torrentio now covers Toloka too, so it replaces Lampa's own "Торренти" source. Hidden, not removed:
        // other source plugins insert their buttons next to it.
        if (native.length) native.after(btn).addClass('hide');
        else root.find('.buttons--container').append(btn);
    });
})();
