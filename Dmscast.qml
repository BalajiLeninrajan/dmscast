import QtQuick
import Quickshell
import Quickshell.Io
import qs.Services
import "calc.js" as Calc

QtObject {
    id: root

    property var pluginService: null
    property string trigger: "="

    signal itemsChanged

    readonly property string pluginId: "dmscast"
    readonly property double ratesMaxAge: 6 * 3600 * 1000
    readonly property double retryDelay: 5 * 60 * 1000

    property var rates: ({
            fiat: {},
            date: "",
            fiatAt: 0
        })
    property double fiatTriedAt: 0

    property string localZone: ""

    // Answers that needed a process, keyed by query. getItems() returns
    // nothing at first and the launcher re-queries once the process exits.
    property var asyncAnswers: ({})
    property var pending: null

    property var zoneTab: FileView {
        path: "/usr/share/zoneinfo/zone.tab"
        printErrors: false
        onLoaded: root.loadZones()
    }

    property var placesFile: FileView {
        path: Qt.resolvedUrl("data/places.tsv").toString().replace("file://", "")
        printErrors: false
        onLoaded: root.loadZones()
    }

    property var isoTab: FileView {
        path: "/usr/share/zoneinfo/iso3166.tab"
        printErrors: false
        onLoaded: root.loadZones()
    }

    property var localZoneProc: Process {
        command: ["timedatectl", "show", "-p", "Timezone", "--value"]
        running: true
        stdout: StdioCollector {
            onStreamFinished: {
                root.localZone = text.trim();
                root.loadZones();
            }
        }
    }

    property var asyncProc: Process {
        property string query: ""
        property var spec: null

        stdout: StdioCollector {
            onStreamFinished: root.finishAsync(root.asyncProc.query, root.asyncProc.spec, text)
        }
    }

    Component.onCompleted: loadRates()
    onPluginServiceChanged: loadRates()

    function getItems(query) {
        refreshRates();
        const text = String(query || "").trim();
        const answer = Calc.answer(text, new Date()) || cachedAnswer(text);
        if (answer)
            return [toItem(answer)];
        const spec = asyncSpec(text);
        if (spec)
            runAsync(text, spec);
        return [];
    }

    function executeItem(item) {
        Quickshell.execDetached(["dms", "cl", "copy", item.copyText]);
        ToastService.showInfo("Copied", item.copyText);
    }

    function getPasteText(item) {
        return item.copyText;
    }

    function toItem(answer) {
        return {
            id: pluginId,
            name: answer.title,
            comment: answer.subtitle,
            icon: "material:" + answer.icon,
            badgeLabel: "Copy",
            categories: ["Calculator"],
            copyText: answer.title
        };
    }

    // ------------------------------------------------------------ async answers

    function asyncSpec(text) {
        return Calc.timeQuery(text);
    }

    function cachedAnswer(text) {
        const hit = asyncAnswers[text];
        if (!hit)
            return null;
        // "time in tokyo" goes stale; a converted "3pm pst" doesn't.
        if (hit.live && Date.now() - hit.at > 20000)
            return null;
        return hit.answer;
    }

    function runAsync(text, spec) {
        if (asyncProc.running) {
            pending = {
                text: text,
                spec: spec
            };
            return;
        }
        asyncProc.query = text;
        asyncProc.spec = spec;
        asyncProc.command = spec.command;
        asyncProc.running = true;
    }

    function finishAsync(text, spec, output) {
        const answer = Calc.timeAnswer(spec, output);

        const answers = Object.keys(asyncAnswers).length > 200 ? {} : Object.assign({}, asyncAnswers);
        answers[text] = {
            answer: answer,
            live: spec.live,
            at: Date.now()
        };
        asyncAnswers = answers;
        if (answer && pluginService)
            pluginService.requestLauncherUpdate(pluginId);

        const next = pending;
        pending = null;
        if (next && next.text !== text)
            runAsync(next.text, next.spec);
    }

    // ------------------------------------------------------------ reference data

    function loadZones() {
        if (zoneTab.loaded && isoTab.loaded && placesFile.loaded)
            Calc.setZones(zoneTab.text(), isoTab.text(), localZone, placesFile.text());
    }

    function loadRates() {
        if (!pluginService)
            return;
        const saved = pluginService.loadPluginState(pluginId, "rates", null);
        if (saved)
            rates = {
                fiat: saved.fiat || {},
                date: saved.date || "",
                fiatAt: saved.fiatAt || 0
            };
        applyRates();
    }

    function applyRates() {
        Calc.setRates(rates.fiat, rates.date);
    }

    function saveRates(changes) {
        rates = Object.assign({}, rates, changes);
        applyRates();
        if (pluginService)
            pluginService.savePluginState(pluginId, "rates", rates);
    }

    function refreshRates() {
        const now = Date.now();
        if (now - rates.fiatAt > ratesMaxAge && now - fiatTriedAt > retryDelay) {
            fiatTriedAt = now;
            // ECB reference rates, published once per working day.
            fetchJson("https://api.frankfurter.dev/v1/latest", data => {
                if (data && data.rates)
                    saveRates({
                        fiat: data.rates,
                        date: data.date || "",
                        fiatAt: Date.now()
                    });
            });
        }
    }

    function fetchJson(url, callback) {
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== XMLHttpRequest.DONE)
                return;
            let data = null;
            try {
                if (xhr.status === 200)
                    data = JSON.parse(xhr.responseText);
            } catch (e) {
                data = null;
            }
            callback(data);
        };
        xhr.open("GET", url);
        xhr.send();
    }
}
