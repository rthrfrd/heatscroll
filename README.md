# Heatscroll

__[Install via the VSCode Marketplace](https://marketplace.visualstudio.com/items?itemName=rthrfrd.heatscroll)__

Heatscroll is a heat map in your scroll bar that gives you an automatic visual history of where you've been in the files you are editing.

This is particularly useful for people regularly working in large files, or on smaller screens.

https://github.com/user-attachments/assets/ad066b30-d3d4-4738-930d-09465c881911

## Extension Settings

Due to the nature of how scrollbar decorations are implemented in the VSCode API, for simplicity's sake most changes will require a restart to take effect.

* `heatscroll.alpha`: Maximum heat map opacity.
* `heatscroll.decayRate`: How quickly new heat map activity erases old heat map activity.
* `heatscroll.decayIntervalMs`: How quickly the heat map decays without any activity.
* `heatscroll.drawIntervalMs`: How frequently the heat map is redrawn.
* `heatscroll.lane`: Which scroll bar lane the heat map occupies (L=1|C=2|R=4|F=7).
* `heatscroll.lineThreshold`: Don't show heatmap for files with less lines than this..
* `heatscroll.rgbEdit`: Comma-separated RGB heat map color for editing.
* `heatscroll.rgbScroll`: Comma-separated RGB heat map color for scrolling.

## Release Notes

### 0.0.4

- Fix: Avoid errors when editor is not available.

### 0.0.3

- Added `heatscroll.toggle` command.

### 0.0.2

- Added `heatscroll.lineThreshold` setting.

### 0.0.1

- Initial release.

----

_A [Picle](https://picle.fi/) a day keeps the brainrot away._
