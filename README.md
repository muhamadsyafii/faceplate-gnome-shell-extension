# Faceplate

Faceplate is a GNOME Shell extension that adds a compact profile faceplate to the top panel. It shows your GNOME account avatar and display name, with optional click actions for opening a custom command.

Repository: https://github.com/muhamadsyafii/faceplate-gnome-shell-extension

## Features

- Shows your account avatar from AccountsService.
- Shows your display name beside the avatar.
- Falls back to the default symbolic avatar icon when no account avatar is available.
- Supports a custom avatar image path from preferences.
- Supports an optional custom command when the faceplate is clicked.
- Supports horizontal and vertical layout.
- Updates light and dark styling from GNOME's `org.gnome.desktop.interface color-scheme` setting.

## Compatibility

This release targets the legacy GNOME Shell extension API used by:

- GNOME Shell 42
- GNOME Shell 43
- GNOME Shell 44

GNOME Shell 45 and newer use the ESModules extension API. A separate port is required before this extension can support GNOME 45+.

## Project Structure

```text
.
├── extension.js
├── metadata.json
├── prefs.js
├── stylesheet.css
└── schemas/
    └── org.gnome.shell.extensions.faceplate.gschema.xml
```

Generated files such as `schemas/gschemas.compiled` and `*.shell-extension.zip` are ignored by git.

## Install From Source

Clone the repository:

```bash
git clone https://github.com/muhamadsyafii/faceplate-gnome-shell-extension.git
cd faceplate-gnome-shell-extension
```

Install the extension locally:

```bash
UUID=$(grep -oP '"uuid":\s*"\K[^"]+' metadata.json)
rm -rf ~/.local/share/gnome-shell/extensions/$UUID
mkdir -p ~/.local/share/gnome-shell/extensions/$UUID
cp -r metadata.json extension.js prefs.js stylesheet.css schemas ~/.local/share/gnome-shell/extensions/$UUID/
glib-compile-schemas ~/.local/share/gnome-shell/extensions/$UUID/schemas/
```

Reload GNOME Shell:

- X11: press `Alt` + `F2`, type `r`, then press `Enter`.
- Wayland: log out and log back in.

Enable the extension:

```bash
gnome-extensions enable $UUID
```

Open preferences:

```bash
gnome-extensions prefs $UUID
```

## Preferences

Faceplate provides these settings:

- `Custom Command`: a shell command to run when the faceplate is clicked.
- `Custom Avatar Path`: an optional local image path used instead of the AccountsService avatar.
- `Layout Horizontal`: controls whether the avatar and name are shown side by side or stacked vertically.

If `Custom Avatar Path` is empty or points to a missing file, Faceplate uses the GNOME account avatar. If that avatar is also unavailable, it falls back to GNOME's default symbolic avatar icon.

## Package For Release

Compile schemas and create the extension zip:

```bash
glib-compile-schemas schemas/
gnome-extensions pack --force --extra-source=stylesheet.css .
```

The generated package will be:

```text
faceplate@muhamadsyafii.shell-extension.zip
```

## Submit To extensions.gnome.org

Before submitting, make sure:

- `metadata.json` has a valid `url` field pointing to this repository.
- `version` in `metadata.json` is a whole number.
- `shell-version` only lists GNOME Shell versions that were tested.
- `glib-compile-schemas schemas/` succeeds.
- `gnome-extensions pack --force --extra-source=stylesheet.css .` succeeds.
- The extension enables, disables, and opens preferences without errors.
- Light and dark mode are tested.

Upload the generated zip at:

```text
https://extensions.gnome.org/upload/
```

## Debugging

Follow GNOME Shell logs:

```bash
journalctl -f -o cat /usr/bin/gnome-shell
```

List installed extensions:

```bash
gnome-extensions list
```

Show extension info:

```bash
gnome-extensions info faceplate@muhamadsyafii
```

Disable the extension:

```bash
gnome-extensions disable faceplate@muhamadsyafii
```

## Development Notes

- `extension.js` contains the top panel indicator.
- `prefs.js` contains the preferences window.
- `stylesheet.css` contains panel styling.
- `schemas/org.gnome.shell.extensions.faceplate.gschema.xml` defines persistent settings.
- Do not commit `schemas/gschemas.compiled`; generate it locally before packaging.

## License

No license has been added yet.
