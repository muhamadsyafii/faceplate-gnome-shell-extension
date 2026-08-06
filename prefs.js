const Adw = imports.gi.Adw;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.faceplate';

function init() {
}

function fillPreferencesWindow(window) {
    const settings = ExtensionUtils.getSettings(SETTINGS_SCHEMA);

    const page = new Adw.PreferencesPage({
        title: 'Faceplate',
        icon_name: 'avatar-default-symbolic',
    });

    const group = new Adw.PreferencesGroup({
        title: 'Avatar Settings',
    });

    const commandRow = new Adw.ActionRow({
        title: 'Custom Command',
    });
    const commandEntry = new Gtk.Entry({
        text: settings.get_string('custom-command'),
        hexpand: true,
    });
    settings.bind('custom-command', commandEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
    commandRow.add_suffix(commandEntry);
    commandRow.activatable_widget = commandEntry;

    const avatarRow = new Adw.ActionRow({
        title: 'Custom Avatar Path',
    });
    const avatarEntry = new Gtk.Entry({
        text: settings.get_string('custom-avatar-path'),
        hexpand: true,
    });
    settings.bind('custom-avatar-path', avatarEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
    avatarRow.add_suffix(avatarEntry);
    avatarRow.activatable_widget = avatarEntry;

    const layoutRow = new Adw.ActionRow({
        title: 'Layout Horizontal',
    });
    const layoutSwitch = new Gtk.Switch({
        active: settings.get_boolean('layout-horizontal'),
        valign: Gtk.Align.CENTER,
    });
    settings.bind('layout-horizontal', layoutSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    layoutRow.add_suffix(layoutSwitch);
    layoutRow.activatable_widget = layoutSwitch;

    group.add(commandRow);
    group.add(avatarRow);
    group.add(layoutRow);
    page.add(group);
    window.add(page);
}
