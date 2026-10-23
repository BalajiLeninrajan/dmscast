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

    // Reads the place table and tz files the first time a query needs them.
    property var reader: FileView {
        preload: false
        blockLoading: true
        printErrors: false
    }

    Component.onCompleted: {
        Calc.setFileReader(readFile, Qt.resolvedUrl("data/places.tsv").toString().replace("file://", ""));
        loadRates();
    }
    onPluginServiceChanged: loadRates()

    function getItems(query) {
        refreshRates();
        const text = String(query || "").trim();
        const answer = Calc.answer(text, new Date());
        return answer ? [toItem(answer)] : [];
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

    // ------------------------------------------------------------ reference data

    function readFile(path, binary) {
        reader.path = path;
        const content = binary ? reader.data() : reader.text();
        // Drop the reader's copy; calc.js keeps what it needs.
        reader.path = "";
        return content;
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
