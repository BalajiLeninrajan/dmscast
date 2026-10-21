import QtQuick
import Quickshell
import qs.Services
import "src/answer.mjs" as Calc

QtObject {
    id: root

    property var pluginService: null
    property string trigger: "="

    signal itemsChanged

    readonly property string pluginId: "dmscast"

    function getItems(query) {
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

}
