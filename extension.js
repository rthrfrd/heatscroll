const vscode = require('vscode');


// ----- //
// Units //
// ----- //


class Config {
    alphaMax;
    lane;
    rgbForEditing;
    rgbForVisibility;
    decayRate;
    drawIntervalMs;
    decayIntervalMs;

    constructor () {
        this.load();
    }

    load () {
        const section = vscode.workspace.getConfiguration("heatscroll");

        this.alphaMax = parseFloat('' + (section.get("alpha", 0.66) || 0.66));
        this.lane = (section.get("lane", vscode.OverviewRulerLane.Center) || vscode.OverviewRulerLane.Center);
        this.rgbForEditing = (section.get("rgbEdit", "153,255,238") || "153,255,238").split(",");
        this.rgbForVisibility = (section.get("rgbScroll", "255,68,191") || "255,68,191").split(",");
        this.decayRate = parseFloat('' + (section.get("decayRate", 0.001) || 0.001));
        this.drawIntervalMs = parseInt('' + (section.get("drawIntervalMs", 200) || 200), 10);
        this.decayIntervalMs = parseInt('' + (section.get("drawIntervalMs", 1000) || 1000), 10);
    }
};

const bucketCountMax = 64;

class Tracker {
    bucketsByFileName = {};

    bucketsForFile (fileName, bucketCount) {
        const buckets = (this.bucketsByFileName[fileName] = this.bucketsByFileName[fileName] || []);
        if (buckets.length < bucketCount) {
            buckets.push(...new Array(bucketCount - buckets.length).fill(0));
        }
        return buckets;
    }

    recordLine (fileName, line, lineMax, rate) {
        const bucketCount = Math.min(bucketCountMax, lineMax);
        const buckets = this.bucketsForFile(fileName, bucketCount);
        const bucket = Math.floor((line / (lineMax - 1)) * (bucketCount - 1));

        for (let b = 0; b < bucketCount; ++b) {
            const score = b == bucket ? 1 : 0;
            buckets[b] = (rate * score) + (1 - rate) * (buckets[b] || 0);
        }
    }

    recordLines (fileName, lineFrom, lineTo, lineMax, rate) {
        const bucketCount = Math.min(bucketCountMax, lineMax);
        const buckets = this.bucketsForFile(fileName, bucketCount);

        for (let b = 0; b < bucketCount; ++b) {
            const line = Math.floor((b / (bucketCount - 1)) * (lineMax - 1));
            const score = (line >= lineFrom && line <= lineTo) ? 1 : 0;
            buckets[b] = (rate * score) + (1 - rate) * (buckets[b] || 0);
        }
    }

    bucketIntensitiesFor (fileName) {
        const values = this.bucketsForFile(fileName);
        const max = values.reduce((c, i) => i > c ? i : c , 0);
        return values.map(x => x / max);
    }
};

const alphaLevels = 25;

class Renderer {
    /** @type {vscode.TextEditorDecorationType[]} */
    decorationTypes = [];

    generateDecorationTypes ([r, g, b], alphaMax, lane) {
        this.decorationTypes = Array.from({length: alphaLevels}, (_, i) => {
            const alpha = (i / (alphaLevels - 1)) * alphaMax;
            return vscode.window.createTextEditorDecorationType({
                overviewRulerColor: `rgba(${r}, ${g}, ${b}, ${alpha})`,
                overviewRulerLane: lane,
            });
        });
        return this;
    }

    /**
     * @param {vscode.TextEditor} editor
     * @param {Tracker} tracker
     */
    drawFor (editor, tracker) {
        const fileName = editor.document.fileName;
        const lineCount = editor.document.lineCount;
        const bucketIntensities = tracker.bucketIntensitiesFor(fileName);
        const bucketCount = bucketIntensities.length;

        const decorationsByAlpha = [];
        for (let b = 0; b < bucketCount; ++b) {
            const alphaLevel = Math.floor((alphaLevels - 1) * bucketIntensities[b]);
            const lineNumberFrom = Math.floor((b / (bucketCount - 1)) * (lineCount - 1));
            const lineNumberTo = Math.max(Math.floor(((b + 1) / (bucketCount - 1)) * (lineCount - 1)) - 1, 0);
            const range = new vscode.Range(new vscode.Position(lineNumberFrom, 0), new vscode.Position(lineNumberTo, 0));

            decorationsByAlpha[alphaLevel] = decorationsByAlpha[alphaLevel] || [];
            decorationsByAlpha[alphaLevel].push({range});
        }

        for (let alphaLevel = 0; alphaLevel < alphaLevels; ++alphaLevel) {
            const decorationType = this.decorationTypes[alphaLevel];
            if (decorationsByAlpha[alphaLevel]) {
                editor.setDecorations(decorationType, decorationsByAlpha[alphaLevel]);
            } else {
                editor.setDecorations(decorationType, []);
            }
        }
    }
};


// ----- //
// State //
// ----- //


const config = new Config();

const visibilityTracker = new Tracker();
const visibilityRenderer = (new Renderer()).generateDecorationTypes(
    config.rgbForVisibility,
    config.alphaMax,
    config.lane
);

const editingTracker = new Tracker();
const editingRenderer = (new Renderer()).generateDecorationTypes(
    config.rgbForEditing,
    config.alphaMax,
    config.lane
);

let decayInterval;
let drawInterval;


// ----------- //
// Entrypoints //
// ----------- //


/**
 * Invoked via the "activationEvents" > "onStartupFinished" in package.json
 * @param {vscode.ExtensionContext} context
 */
function activate (context) {
    /** @param {vscode.TextEditor} editor */
    function updateLineEditing (editor) {
        editingTracker.recordLine(
            editor.document.fileName,
            editor.selection.active.line,
            editor.document.lineCount,
            config.decayRate
        );
    }

    /** @param {vscode.TextEditor} editor */
    function updateLineVisibility (editor) {
        for (const range of editor.visibleRanges) {
            visibilityTracker.recordLines(
                editor.document.fileName,
                range.start.line,
                range.end.line,
                editor.document.lineCount,
                config.decayRate
            );
        }
    }

    // Track which lines are visible when scrolling:
    vscode.window.onDidChangeTextEditorVisibleRanges(function onScroll (e) {
        updateLineVisibility(e.textEditor)
    });

    // Track which lines are visible over time:
    decayInterval = setInterval(function tick () {
        if (vscode.window.state.active) {
            updateLineVisibility(vscode.window.activeTextEditor);
            updateLineVisibility(vscode.window.activeTextEditor);
        }
    }, config.decayIntervalMs);

    // Track which lines are being edited:
    vscode.workspace.onDidChangeTextDocument(function onEdit (e) {
        // Require the changed document to be the one in the active editor:
        const editor = vscode.window.activeTextEditor;
        if (editor && (editor.document.fileName == e.document.fileName)) {
            updateLineEditing(editor);
        }
    });

    /* @todo Respond to changes in configuration:
    vscode.workspace.onDidChangeConfiguration(function onConfig (e) {
        config.load();
        editingRenderer.generateDecorationTypes();
        visibilityRenderer.generateDecorationTypes();
    });
    //*/

    // Update the scrollbar view at a fixed rate:
    drawInterval = setInterval(function draw () {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            visibilityRenderer.drawFor(editor, visibilityTracker);
            editingRenderer.drawFor(editor, editingTracker);
        }
    }, config.drawIntervalMs);

    /*/ @todo Command to reset state for file or all files
    context.subscriptions.push(vscode.commands.registerCommand('heatscroll.toggle', function onToggle () {

    }));
    //*/
}

function deactivate () {
    clearInterval(decayInterval);
    clearInterval(drawInterval);
}

module.exports = {
    activate,
    deactivate,
};
