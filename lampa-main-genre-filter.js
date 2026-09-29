(function () {
    'use strict';

    if (window.genre_main_filter_plugin) return;
    window.genre_main_filter_plugin = true;

    var STORAGE_PREFIX = 'genre_main_filter_';
    var MANUAL_IDS_KEY = STORAGE_PREFIX + 'manual_ids';

    // These are intentionally a small curated set of genres that users commonly want to hide.
    // Anything outside this list can be added by TMDB ID in the separate manual field.
    var PRESET_GENRES = [
        { id: 27, key: 'gmf_genre_horror', default: true },
        { id: 10749, key: 'gmf_genre_romance', default: false },
        { id: 10402, key: 'gmf_genre_music', default: false },
        { id: 99, key: 'gmf_genre_documentary', default: false },
        { id: 10752, key: 'gmf_genre_war', default: false },
        { id: 37, key: 'gmf_genre_western', default: false },
        { id: 80, key: 'gmf_genre_crime', default: false },
        { id: 10764, key: 'gmf_genre_reality', default: false },
        { id: 10766, key: 'gmf_genre_soap', default: false },
        { id: 10767, key: 'gmf_genre_talk', default: false },
        { id: 10763, key: 'gmf_genre_news', default: false },
        { id: 10762, key: 'gmf_genre_kids', default: false }
    ];

    function normalize(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function getManualIds() {
        var value = Lampa.Storage.get(MANUAL_IDS_KEY, '');
        var ids = [];

        String(value || '')
            .split(',')
            .map(function (item) { return item.trim(); })
            .filter(Boolean)
            .forEach(function (item) {
                if (/^\d+$/.test(item)) {
                    var id = Number(item);
                    if (id > 0 && ids.indexOf(id) === -1) ids.push(id);
                }
            });

        return ids;
    }

    function getBlockedGenreIds() {
        var ids = getManualIds();

        PRESET_GENRES.forEach(function (genre) {
            if (Lampa.Storage.get(STORAGE_PREFIX + genre.id, genre.default)) {
                if (ids.indexOf(genre.id) === -1) ids.push(genre.id);
            }
        });

        return ids;
    }

    function resolveGenreName(value) {
        var name = normalize(value);
        var found = -1;

        PRESET_GENRES.forEach(function (genre) {
            var ru = normalize(Lampa.Lang.translate(genre.key));
            if (name === ru && found < 0) found = genre.id;
        });

        return found;
    }

    function hasBlockedMainGenre(item) {
        if (!item) return false;

        var blocked = getBlockedGenreIds();
        if (!blocked.length) return false;

        // Detailed cards can expose an ordered genres array.
        if (Array.isArray(item.genres) && item.genres.length) {
            var first = item.genres[0];

            if (first && typeof first === 'object' && first.id != null) {
                return blocked.indexOf(Number(first.id)) !== -1;
            }

            if (typeof first === 'string') {
                var resolved = resolveGenreName(first);
                return resolved > 0 && blocked.indexOf(resolved) !== -1;
            }
        }

        // TMDB list responses normally expose an ordered genre_ids array.
        if (Array.isArray(item.genre_ids) && item.genre_ids.length) {
            return blocked.indexOf(Number(item.genre_ids[0])) !== -1;
        }

        return false;
    }

    function applyFilter(results) {
        return results.filter(function (item) {
            return !hasBlockedMainGenre(item);
        });
    }

    function addSettings() {
        if (!Lampa.SettingsApi || !Lampa.SettingsApi.addComponent) return;

        Lampa.SettingsApi.addComponent({
            component: 'genre_main_filter',
            name: Lampa.Lang.translate('gmf_settings_title'),
            icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                '<path d="M4 6h16l-6.5 7v5l-3 1.5V13L4 6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>'
        });

        PRESET_GENRES.forEach(function (genre) {
            var storageKey = STORAGE_PREFIX + genre.id;

            Lampa.SettingsApi.addParam({
                component: 'genre_main_filter',
                param: {
                    name: storageKey,
                    type: 'trigger',
                    default: genre.default
                },
                field: {
                    name: Lampa.Lang.translate(genre.key)
                }
            });
        });

        Lampa.SettingsApi.addParam({
            component: 'genre_main_filter',
            param: {
                name: MANUAL_IDS_KEY,
                type: 'input',
                values: '',
                placeholder: Lampa.Lang.translate('gmf_manual_ids_placeholder'),
                default: ''
            },
            field: {
                name: Lampa.Lang.translate('gmf_manual_ids'),
                description: Lampa.Lang.translate('gmf_manual_ids_desc')
            },
            onChange: function () {
                console.log('[Main Genre Filter] Manual IDs:', getManualIds());
            }
        });
    }

    function start() {
        addSettings();

        Lampa.Listener.follow('request_secuses', function (event) {
            if (!event || !event.data || !Array.isArray(event.data.results)) return;

            var results = event.data.results;
            event.data.__genre_filter_original_length = results.length;

            var filtered = applyFilter(results);

            if (filtered.length !== results.length) {
                event.data.results = filtered;

                console.log(
                    '[Main Genre Filter] hidden:',
                    results.length - filtered.length,
                    'of',
                    results.length
                );
            }
        });

        console.log('[Main Genre Filter] enabled. Blocked main genre IDs:', getBlockedGenreIds());
    }

    Lampa.Lang.add({
        gmf_settings_title: {
            ru: 'Фильтр жанров',
            en: 'Genre Filter'
        },
        gmf_genre_horror: {
            ru: 'Ужасы',
            en: 'Horror'
        },
        gmf_genre_romance: {
            ru: 'Мелодрама',
            en: 'Romance'
        },
        gmf_genre_music: {
            ru: 'Музыка / мюзикл',
            en: 'Music / Musical'
        },
        gmf_genre_documentary: {
            ru: 'Документальный',
            en: 'Documentary'
        },
        gmf_genre_war: {
            ru: 'Военный',
            en: 'War'
        },
        gmf_genre_western: {
            ru: 'Вестерн',
            en: 'Western'
        },
        gmf_genre_crime: {
            ru: 'Криминал',
            en: 'Crime'
        },
        gmf_genre_reality: {
            ru: 'Реалити-шоу',
            en: 'Reality'
        },
        gmf_genre_soap: {
            ru: 'Мыльная опера',
            en: 'Soap'
        },
        gmf_genre_talk: {
            ru: 'Ток-шоу',
            en: 'Talk'
        },
        gmf_genre_news: {
            ru: 'Новости',
            en: 'News'
        },
        gmf_genre_kids: {
            ru: 'Детский',
            en: 'Kids'
        },
        gmf_manual_ids: {
            ru: 'Дополнительные ID жанров TMDB',
            en: 'Additional TMDB genre IDs'
        },
        gmf_manual_ids_desc: {
            ru: 'Укажите ID через запятую для жанров, которых нет в списке выше. Названия здесь не распознаются.',
            en: 'Enter IDs separated by commas for genres not listed above. Names are not resolved here.'
        },
        gmf_manual_ids_placeholder: {
            ru: 'Например: 18, 9648',
            en: 'Example: 18, 9648'
        }
    });

    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', function (event) {
            if (event.type === 'ready') start();
        });
    }
})();
