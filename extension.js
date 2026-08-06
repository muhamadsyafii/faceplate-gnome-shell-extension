const AccountsService = imports.gi.AccountsService;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;

const AVATAR_SIZE = 22;
const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.faceplate';

const AvatarIndicator = GObject.registerClass(
class AvatarIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.0, 'Avatar Indicator');

        this._settings = settings;
        this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
        this._userLoadedId = 0;
        this._userIconId = 0;
        this._settingsIds = [];

        this._box = new St.BoxLayout({
            style_class: 'faceplate-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._icon = new St.Icon({
            icon_name: 'avatar-default-symbolic',
            style_class: 'faceplate-icon',
            icon_size: AVATAR_SIZE,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._label = new St.Label({
            text: GLib.get_real_name() || GLib.get_user_name(),
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._box.add_child(this._icon);
        this._box.add_child(this._label);
        this.add_child(this._box);

        this.connect('button-press-event', () => {
            this._runCustomCommand();
            return Clutter.EVENT_STOP;
        });

        this._settingsIds.push(
            this._settings.connect('changed::layout-horizontal', () => this._syncLayout())
        );
        this._settingsIds.push(
            this._settings.connect('changed::custom-avatar-path', () => this._syncAvatar())
        );

        this._watchUser();
        this._syncLayout();
        this._syncAvatar();
    }

    _watchUser() {
        if (!this._user)
            return;

        this._userIconId = this._user.connect('changed', () => this._syncAvatar());

        if (!this._user.is_loaded()) {
            this._userLoadedId = this._user.connect('notify::is-loaded', () => {
                if (this._user.is_loaded())
                    this._syncAvatar();
            });
        }
    }

    _syncLayout() {
        this._box.vertical = !this._settings.get_boolean('layout-horizontal');
    }

    _syncAvatar() {
        const customPath = this._settings.get_string('custom-avatar-path').trim();
        const accountPath = this._user && this._user.is_loaded() ? this._user.get_icon_file() : '';
        const avatarPath = customPath || accountPath;

        if (!avatarPath || !GLib.file_test(avatarPath, GLib.FileTest.EXISTS)) {
            this._icon.gicon = null;
            this._icon.icon_name = 'avatar-default-symbolic';
            return;
        }

        this._icon.icon_name = null;
        this._icon.gicon = new Gio.FileIcon({file: Gio.File.new_for_path(avatarPath)});
    }

    _runCustomCommand() {
        const command = this._settings.get_string('custom-command').trim();

        if (!command)
            return;

        try {
            GLib.spawn_command_line_async(command);
        } catch (error) {
            logError(error, 'Failed to run avatar command');
            Main.notifyError('Faceplate', 'Failed to run custom command.');
        }
    }

    destroy() {
        for (const id of this._settingsIds)
            this._settings.disconnect(id);
        this._settingsIds = [];

        if (this._userIconId) {
            this._user.disconnect(this._userIconId);
            this._userIconId = 0;
        }

        if (this._userLoadedId) {
            this._user.disconnect(this._userLoadedId);
            this._userLoadedId = 0;
        }

        super.destroy();
    }
});

class AvatarExtension {
    constructor(uuid) {
        this._uuid = uuid;
        this._settings = null;
        this._indicator = null;
        this._interfaceSettings = null;
        this._colorSchemeId = 0;
    }

    enable() {
        this._settings = ExtensionUtils.getSettings(SETTINGS_SCHEMA);
        this._interfaceSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });

        this._indicator = new AvatarIndicator(this._settings);
        this._colorSchemeId = this._interfaceSettings.connect('changed::color-scheme', () => {
            this._updateColorScheme();
        });

        this._updateColorScheme();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        if (this._colorSchemeId) {
            this._interfaceSettings.disconnect(this._colorSchemeId);
            this._colorSchemeId = 0;
        }

        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._interfaceSettings = null;
        this._settings = null;
    }

    _updateColorScheme() {
        const box = this._indicator ? this._indicator._box : null;

        if (!box)
            return;

        let isDark = false;
        try {
            isDark = this._interfaceSettings.get_string('color-scheme') === 'prefer-dark';
        } catch (error) {
            isDark = false;
        }

        box.remove_style_class_name(isDark ? 'faceplate-box-light' : 'faceplate-box-dark');
        box.add_style_class_name(isDark ? 'faceplate-box-dark' : 'faceplate-box-light');
    }
}

function init(meta) {
    return new AvatarExtension(meta.uuid);
}
