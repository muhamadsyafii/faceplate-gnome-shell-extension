const Adw = imports.gi.Adw;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.faceplate';
const CLICK_ACTIONS = [
    ['menu', 'Open Faceplate Menu'],
    ['command', 'Run Command'],
];
const LAUNCH_COMMANDS = [
    ['user-accounts', 'User Accounts'],
    ['extensions', 'Extensions'],
    ['system-monitor', 'System Monitor'],
    ['terminal', 'Terminal'],
    ['software', 'Software'],
    ['custom', 'Custom'],
];

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

    const clickActionRow = new Adw.ActionRow({
        title: 'Default Click Action',
    });
    const clickActionDropdown = _createDropdown(CLICK_ACTIONS, settings.get_string('default-click-action'));
    _bindDropdown(settings, 'default-click-action', clickActionDropdown, CLICK_ACTIONS);
    clickActionRow.add_suffix(clickActionDropdown);
    clickActionRow.activatable_widget = clickActionDropdown;

    const launchCommandRow = new Adw.ActionRow({
        title: 'Launch Command',
        subtitle: 'Pick the command used by the menu item or direct click action',
    });
    const launchCommandDropdown = _createDropdown(LAUNCH_COMMANDS, settings.get_string('launch-command'));
    _bindDropdown(settings, 'launch-command', launchCommandDropdown, LAUNCH_COMMANDS);
    launchCommandRow.add_suffix(launchCommandDropdown);
    launchCommandRow.activatable_widget = launchCommandDropdown;

    const commandRow = new Adw.ActionRow({
        title: 'Custom Command',
        subtitle: 'Used when Launch Command is set to Custom',
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

    const syncCustomCommandVisibility = () => {
        commandRow.visible = settings.get_string('launch-command') === 'custom';
    };
    settings.connect('changed::launch-command', syncCustomCommandVisibility);
    syncCustomCommandVisibility();

    group.add(layoutRow);
    group.add(clickActionRow);
    group.add(launchCommandRow);
    group.add(commandRow);
    group.add(avatarRow);
    page.add(group);
    window.add(page);
}

function _createDropdown(options, selectedValue) {
    const dropdown = new Gtk.ComboBoxText({
        valign: Gtk.Align.CENTER,
    });

    for (const [value, label] of options)
        dropdown.append(value, label);

    dropdown.active_id = _findSelectedValue(options, selectedValue);

    return dropdown;
}

function _bindDropdown(settings, key, dropdown, options) {
    dropdown.connect('changed', () => {
        const selected = dropdown.active_id;

        if (!options.some(([value]) => value === selected))
            return;

        settings.set_string(key, selected);
    });

    settings.connect(`changed::${key}`, () => {
        const selected = _findSelectedValue(options, settings.get_string(key));

        if (dropdown.active_id !== selected)
            dropdown.active_id = selected;
    });
}

function _findSelectedValue(options, selectedValue) {
    return options.some(([value]) => value === selectedValue)
        ? selectedValue
        : options[0][0];
}
