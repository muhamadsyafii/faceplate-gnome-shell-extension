const AccountsService = imports.gi.AccountsService;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const AVATAR_SIZE = 22;
const MENU_AVATAR_SIZE = 64;
const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.faceplate';
const EXTENSION_UUID = 'faceplate@muhamadsyafii';
const EXTENSION_VERSION = '3';
const EXTENSION_REPOSITORY = 'https://github.com/muhamadsyafii/faceplate-gnome-shell-extension';
const AUTHOR_PROFILE = 'https://github.com/muhamadsyafii';
const CLICK_ACTION_MENU = 'menu';
const CLICK_ACTION_COMMAND = 'command';
const TEXT_DECODER = new TextDecoder();
const COMMANDS = {
    'user-accounts': {
        label: 'User Accounts',
        icon: 'preferences-system-users-symbolic',
        command: 'gnome-control-center user-accounts',
    },
    'extensions': {
        label: 'Extensions',
        icon: 'application-x-addon-symbolic',
        command: 'gnome-extensions-app',
    },
    'system-monitor': {
        label: 'System Monitor',
        icon: 'utilities-system-monitor-symbolic',
        command: 'gnome-system-monitor',
    },
    'terminal': {
        label: 'Terminal',
        icon: 'utilities-terminal-symbolic',
        command: 'gnome-terminal',
    },
    'software': {
        label: 'Software',
        icon: 'org.gnome.Software-symbolic',
        command: 'gnome-software',
    },
    'custom': {
        label: 'Custom Command',
        icon: 'system-run-symbolic',
        command: null,
    },
};

const AvatarIndicator = GObject.registerClass(
class AvatarIndicator extends PanelMenu.Button {
    _init(settings) {
        super._init(0.5, 'Avatar Indicator');

        this._settings = settings;
        this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
        this._userLoadedId = 0;
        this._userIconId = 0;
        this._statusRefreshId = 0;
        this._usageTimerId = 0;
        this._focusWindowId = 0;
        this._buttonPressId = 0;
        this._menuOpenStateId = 0;
        this._activeAppKey = null;
        this._activeAppSince = 0;
        this._usageStartedAt = GLib.get_monotonic_time();
        this._appUsage = {};
        this._settingsIds = [];

        this._box = new St.BoxLayout({
            style_class: 'faceplate-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._avatar = new St.Widget({
            style_class: 'faceplate-avatar faceplate-avatar-small',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._avatarFallbackIcon = new St.Icon({
            icon_name: 'avatar-default-symbolic',
            style_class: 'faceplate-avatar-fallback-icon',
            icon_size: 14,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._avatar.add_child(this._avatarFallbackIcon);

        this._label = new St.Label({
            text: GLib.get_real_name() || GLib.get_user_name(),
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._box.add_child(this._avatar);
        this._box.add_child(this._label);
        this.add_child(this._box);

        this._buttonPressId = this.connect('button-press-event', () => {
            if (this._settings.get_string('default-click-action') === CLICK_ACTION_COMMAND) {
                this._runLaunchCommand();
                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE;
        });

        this._settingsIds.push(
            this._settings.connect('changed::layout-horizontal', () => this._syncLayout())
        );
        this._settingsIds.push(
            this._settings.connect('changed::custom-avatar-path', () => this._syncAvatar())
        );
        this._settingsIds.push(
            this._settings.connect('changed::custom-command', () => this._syncCustomCommandItem())
        );
        this._settingsIds.push(
            this._settings.connect('changed::launch-command', () => this._syncLaunchCommandItem())
        );

        this._buildMenu();
        this._menuOpenStateId = this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this._syncSystemStatus();
                this._startStatusRefresh();
            } else {
                this._stopStatusRefresh();
            }
        });
        this._watchUser();
        this._startAppUsageTracking();
        this._syncLayout();
        this._syncAvatar();
        this._syncCustomCommandItem();
        this._syncLaunchCommandItem();
    }

    _buildMenu() {
        const realName = GLib.get_real_name() || GLib.get_user_name();
        const username = GLib.get_user_name();

        const headerItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'faceplate-menu-header',
        });

        const headerBox = new St.BoxLayout({
            vertical: true,
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'faceplate-menu-profile',
        });

        this._menuAvatar = new St.Widget({
            style_class: 'faceplate-avatar faceplate-avatar-large',
            x_align: Clutter.ActorAlign.CENTER,
        });
        this._menuAvatarFallbackIcon = new St.Icon({
            icon_name: 'avatar-default-symbolic',
            style_class: 'faceplate-avatar-fallback-icon',
            icon_size: 40,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._menuAvatar.add_child(this._menuAvatarFallbackIcon);

        const headerText = new St.BoxLayout({
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            style_class: 'faceplate-menu-header-text',
        });

        headerText.add_child(new St.Label({
            text: realName,
            style_class: 'faceplate-menu-name',
        }));
        headerText.add_child(new St.Label({
            text: username,
            style_class: 'faceplate-menu-subtitle',
        }));

        headerBox.add_child(this._menuAvatar);
        headerBox.add_child(headerText);
        headerItem.add_child(headerBox);
        this.menu.addMenuItem(headerItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._cpuLoadItem = this._createInfoItem('utilities-system-monitor-symbolic', 'CPU Load', 'Loading...');
        this._memoryItem = this._createInfoItem('drive-harddisk-system-symbolic', 'Memory', 'Loading...');
        this._swapItem = this._createInfoItem('media-flash-symbolic', 'Swap', 'Loading...');
        this._diskItem = this._createInfoItem('drive-harddisk-symbolic', 'Disk', 'Loading...');
        this._uptimeItem = this._createInfoItem('appointment-soon-symbolic', 'Uptime', 'Loading...');
        this.menu.addMenuItem(this._cpuLoadItem);
        this.menu.addMenuItem(this._memoryItem);
        this.menu.addMenuItem(this._swapItem);
        this.menu.addMenuItem(this._diskItem);
        this.menu.addMenuItem(this._uptimeItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addMenuItem(this._createCommandItem(
            'utilities-terminal-symbolic',
            'Terminal',
            'gnome-terminal'
        ));
        this.menu.addMenuItem(this._createCommandItem(
            'system-file-manager-symbolic',
            'Files',
            'nautilus'
        ));
        this.menu.addMenuItem(this._createCommandItem(
            'utilities-system-monitor-symbolic',
            'System Monitor',
            'gnome-system-monitor'
        ));
        this.menu.addMenuItem(this._createCommandItem(
            'appointment-soon-symbolic',
            'App Usage',
            null,
            () => this._showAppUsageDialog()
        ));
        this.menu.addMenuItem(this._createCommandItem(
            'preferences-system-symbolic',
            'Settings',
            'gnome-control-center'
        ));
        this.menu.addMenuItem(this._createCommandItem(
            'help-about-symbolic',
            'About Faceplate',
            null,
            () => this._showAboutDialog()
        ));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addMenuItem(this._createCommandItem(
            'system-lock-screen-symbolic',
            'Lock Screen',
            'loginctl lock-session'
        ));
        this.menu.addMenuItem(this._createCommandItem(
            'system-log-out-symbolic',
            'Log Out',
            'gnome-session-quit --logout'
        ));
    }

    _createInfoItem(iconName, label, value) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'faceplate-status-row',
        });
        const content = new St.BoxLayout({
            style_class: 'faceplate-status-content',
        });
        const icon = new St.Icon({
            icon_name: iconName,
            style_class: 'popup-menu-icon',
        });
        const titleLabel = new St.Label({
            text: label,
            style_class: 'faceplate-status-title',
        });
        const valueLabel = new St.Label({
            text: value,
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
            style_class: 'faceplate-menu-value',
        });

        item.setOrnament(PopupMenu.Ornament.HIDDEN);
        content.add_child(icon);
        content.add_child(titleLabel);
        content.add_child(valueLabel);
        item.add_child(content);
        item._faceplateValueLabel = valueLabel;

        return item;
    }

    _createCommandItem(iconName, label, command, callback = null) {
        const item = new PopupMenu.PopupImageMenuItem(label, iconName);

        item.setOrnament(PopupMenu.Ornament.HIDDEN);
        item._faceplateIcon = item._icon;
        item._faceplateLabel = item.label;
        item.connect('activate', () => {
            this.menu.close();

            if (callback) {
                callback();
                return;
            }

            this._spawnCommand(command, label);
        });

        return item;
    }

    _getLaunchCommand() {
        const selected = this._settings.get_string('launch-command');
        const preset = COMMANDS[selected] || COMMANDS['user-accounts'];
        const command = selected === 'custom'
            ? this._settings.get_string('custom-command').trim()
            : preset.command;

        return {
            label: preset.label,
            icon: preset.icon,
            command,
        };
    }

    _watchUser() {
        if (!this._user)
            return;

        this._userIconId = this._user.connect('changed', () => this._syncAvatar());

        if (!this._isUserLoaded()) {
            this._userLoadedId = this._user.connect('notify::is-loaded', () => {
                if (this._isUserLoaded())
                    this._syncAvatar();
            });
        }
    }

    _isUserLoaded() {
        if (!this._user)
            return false;

        if (typeof this._user.is_loaded === 'function')
            return this._user.is_loaded();

        if (typeof this._user.get_is_loaded === 'function')
            return this._user.get_is_loaded();

        if (typeof this._user.is_loaded === 'boolean')
            return this._user.is_loaded;

        return true;
    }

    _syncLayout() {
        this._box.vertical = !this._settings.get_boolean('layout-horizontal');
    }

    _syncAvatar() {
        const customPath = this._settings.get_string('custom-avatar-path').trim();
        const accountPath = this._isUserLoaded() ? this._user.get_icon_file() : '';
        const avatarPath = customPath || accountPath;

        if (!avatarPath || !GLib.file_test(avatarPath, GLib.FileTest.EXISTS)) {
            this._setAvatarBackground(null);

            return;
        }

        this._setAvatarBackground(avatarPath);
    }

    _setAvatarBackground(avatarPath) {
        const hasAvatar = Boolean(avatarPath);
        const escapedPath = hasAvatar ? avatarPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';
        const background = hasAvatar
            ? `background-image: url("${escapedPath}");`
            : 'background-image: none;';

        this._avatar.set_style(background);
        this._menuAvatar.set_style(background);
        this._avatarFallbackIcon.visible = !hasAvatar;
        this._menuAvatarFallbackIcon.visible = !hasAvatar;
    }

    _syncCustomCommandItem() {
        return;
    }

    _syncLaunchCommandItem() {
        return;
    }

    _runLaunchCommand() {
        const launchCommand = this._getLaunchCommand();

        if (!launchCommand.command)
            return;

        this._spawnCommand(launchCommand.command, launchCommand.label);
    }

    _spawnCommand(command, label) {
        try {
            GLib.spawn_command_line_async(command);
        } catch (error) {
            logError(error, `Failed to run ${label}`);
            Main.notifyError('Faceplate', `Failed to run ${label}.`);
        }
    }

    _startAppUsageTracking() {
        if (this._focusWindowId)
            return;

        this._focusWindowId = global.display.connect('notify::focus-window', () => {
            this._syncActiveApp();
        });
        this._usageTimerId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this._updateActiveAppUsage();
            return GLib.SOURCE_CONTINUE;
        });
        this._syncActiveApp();
    }

    _stopAppUsageTracking() {
        this._updateActiveAppUsage();

        if (this._focusWindowId) {
            global.display.disconnect(this._focusWindowId);
            this._focusWindowId = 0;
        }

        if (this._usageTimerId) {
            GLib.source_remove(this._usageTimerId);
            this._usageTimerId = 0;
        }
    }

    _syncActiveApp() {
        this._updateActiveAppUsage();

        const window = this._getFocusedWindow();
        const app = this._getWindowApp(window);

        if (!app) {
            this._activeAppKey = null;
            this._activeAppSince = 0;
            return;
        }

        this._activeAppKey = app.key;
        this._activeAppSince = GLib.get_monotonic_time();

        if (!this._appUsage[this._activeAppKey]) {
            this._appUsage[this._activeAppKey] = {
                name: app.name,
                seconds: 0,
            };
        }
    }

    _updateActiveAppUsage() {
        if (!this._activeAppKey || !this._activeAppSince)
            return;

        const now = GLib.get_monotonic_time();
        const elapsed = Math.max(0, (now - this._activeAppSince) / 1000000);

        if (this._appUsage[this._activeAppKey])
            this._appUsage[this._activeAppKey].seconds += elapsed;

        this._activeAppSince = now;
    }

    _getFocusedWindow() {
        if (global.display.get_focus_window)
            return global.display.get_focus_window();

        return global.display.focus_window || null;
    }

    _getWindowApp(window) {
        if (!window)
            return null;

        const tracker = Shell.WindowTracker.get_default();
        const app = tracker ? tracker.get_window_app(window) : null;
        const appName = app ? app.get_name() : null;
        const appId = app ? app.get_id() : null;
        const wmClass = window.get_wm_class ? window.get_wm_class() : null;
        const title = window.get_title ? window.get_title() : null;
        const key = appId || wmClass || title;
        const name = appName || wmClass || title;

        if (!key || !name)
            return null;

        return {
            key,
            name,
        };
    }

    _showAppUsageDialog() {
        this._updateActiveAppUsage();

        const dialog = new ModalDialog.ModalDialog();
        const title = new St.Label({
            text: 'App Usage',
            style_class: 'faceplate-dialog-title',
        });
        const subtitle = new St.Label({
            text: 'Tracked for this Faceplate session',
            style_class: 'faceplate-dialog-subtitle',
        });
        const list = new St.BoxLayout({
            vertical: true,
            style_class: 'faceplate-usage-list',
        });
        const scrollView = new St.ScrollView({
            style_class: 'faceplate-usage-scroll',
            overlay_scrollbars: true,
        });
        const apps = Object.values(this._appUsage)
            .filter(app => app.seconds > 0)
            .sort((a, b) => b.seconds - a.seconds);

        scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        dialog.contentLayout.add_child(title);
        dialog.contentLayout.add_child(subtitle);

        if (apps.length === 0) {
            list.add_child(new St.Label({
                text: 'No app usage has been tracked yet.',
                style_class: 'faceplate-dialog-subtitle',
            }));
        } else {
            list.add_child(this._createUsageHeaderRow());

            for (let index = 0; index < apps.length; index++)
                list.add_child(this._createUsageRow(index + 1, apps[index].name, apps[index].seconds));
        }

        scrollView.add_actor(list);
        dialog.contentLayout.add_child(scrollView);
        dialog.addButton({
            label: 'Reset',
            action: () => {
                this._resetAppUsage();
                dialog.close();
            },
        });
        dialog.addButton({
            label: 'Close',
            action: () => dialog.close(),
            key: Clutter.KEY_Escape,
        });
        dialog.open();
    }

    _showAboutDialog() {
        const dialog = new ModalDialog.ModalDialog();
        const title = new St.Label({
            text: 'About Faceplate',
            style_class: 'faceplate-dialog-title',
        });
        const description = new St.BoxLayout({
            vertical: true,
            style_class: 'faceplate-about-description',
        });
        const metaList = new St.BoxLayout({
            vertical: true,
            style_class: 'faceplate-about-list',
        });

        metaList.add_child(this._createAboutRow('Version', EXTENSION_VERSION));
        metaList.add_child(this._createAboutRow('UUID', EXTENSION_UUID));
        metaList.add_child(this._createAboutRow('Creator', 'Muhamad Syafii'));
        metaList.add_child(this._createAboutRow('Profile', 'GitHub profile'));
        metaList.add_child(this._createAboutRow('Repository', 'Source repository'));

        dialog.contentLayout.add_child(title);
        description.add_child(this._createAboutDescriptionLine('A small personal companion'));
        description.add_child(this._createAboutDescriptionLine('for the GNOME top panel.'));
        description.add_child(this._createAboutDescriptionLine('It keeps your profile, system glance,'));
        description.add_child(this._createAboutDescriptionLine('and shortcuts close at hand.'));

        dialog.contentLayout.add_child(description);
        dialog.contentLayout.add_child(metaList);
        dialog.addButton({
            label: 'Creator Profile',
            action: () => {
                this._spawnCommand(`xdg-open ${AUTHOR_PROFILE}`, 'creator profile');
                dialog.close();
            },
        });
        dialog.addButton({
            label: 'Repository',
            action: () => {
                this._spawnCommand(`xdg-open ${EXTENSION_REPOSITORY}`, 'repository');
                dialog.close();
            },
        });
        dialog.addButton({
            label: 'Close',
            action: () => dialog.close(),
            key: Clutter.KEY_Escape,
        });
        dialog.open();
    }

    _createAboutRow(label, value) {
        const row = new St.BoxLayout({
            style_class: 'faceplate-about-row',
        });

        row.add_child(new St.Label({
            text: label,
            style_class: 'faceplate-about-label',
        }));
        row.add_child(new St.Label({
            text: value,
            x_expand: true,
            x_align: Clutter.ActorAlign.START,
            style_class: 'faceplate-about-value',
        }));

        return row;
    }

    _createAboutDescriptionLine(text) {
        return new St.Label({
            text,
            x_align: Clutter.ActorAlign.START,
            style_class: 'faceplate-about-description-line',
        });
    }

    _createUsageHeaderRow() {
        const row = new St.BoxLayout({
            style_class: 'faceplate-usage-row faceplate-usage-header-row',
        });

        row.add_child(this._createUsageCell('Rank', 'rank'));
        row.add_child(this._createUsageCell('Apps', 'app'));
        row.add_child(this._createUsageCell('Hours Active', 'duration'));
        row.add_child(this._createUsageCell('Daily Average', 'duration'));

        return row;
    }

    _createUsageRow(rank, name, seconds) {
        const row = new St.BoxLayout({
            style_class: 'faceplate-usage-row',
        });

        row.add_child(this._createUsageCell(`${rank}.`, 'rank'));
        row.add_child(this._createUsageCell(name, 'app'));
        row.add_child(this._createUsageCell(this._formatDuration(seconds), 'duration'));
        row.add_child(this._createUsageCell(this._formatDuration(this._calculateDailyAverage(seconds)), 'duration'));

        return row;
    }

    _createUsageCell(text, kind) {
        return new St.Label({
            text,
            x_expand: kind === 'app',
            style_class: `faceplate-usage-cell faceplate-usage-cell-${kind}`,
        });
    }

    _calculateDailyAverage(seconds) {
        const elapsed = Math.max(1, (GLib.get_monotonic_time() - this._usageStartedAt) / 1000000);
        const days = Math.max(1, elapsed / 86400);

        return seconds / days;
    }

    _resetAppUsage() {
        this._appUsage = {};
        this._activeAppSince = GLib.get_monotonic_time();
        this._usageStartedAt = this._activeAppSince;
    }

    _formatDuration(seconds) {
        const total = Math.floor(seconds);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = total % 60;

        if (hours > 0)
            return `${hours}h ${minutes}m`;

        if (minutes > 0)
            return `${minutes}m ${secs}s`;

        return `${secs}s`;
    }

    _syncSystemStatus() {
        const cpuLoad = this._readCpuLoad();
        const memoryInfo = this._readMemoryInfo();
        const diskInfo = this._readDiskInfo();
        const uptime = this._readUptime();

        this._cpuLoadItem._faceplateValueLabel.text = cpuLoad || 'Unavailable';

        if (memoryInfo) {
            const memoryUsed = memoryInfo.memTotal - memoryInfo.memAvailable;
            const swapUsed = memoryInfo.swapTotal - memoryInfo.swapFree;

            this._memoryItem._faceplateValueLabel.text =
                `${this._formatBytes(memoryUsed)} / ${this._formatBytes(memoryInfo.memTotal)}`;
            this._swapItem._faceplateValueLabel.text =
                `${this._formatBytes(swapUsed)} / ${this._formatBytes(memoryInfo.swapTotal)}`;
        } else {
            this._memoryItem._faceplateValueLabel.text = 'Unavailable';
            this._swapItem._faceplateValueLabel.text = 'Unavailable';
        }

        if (diskInfo) {
            this._diskItem._faceplateValueLabel.text =
                `${this._formatBytes(diskInfo.used)} / ${this._formatBytes(diskInfo.total)}`;
        } else {
            this._diskItem._faceplateValueLabel.text = 'Unavailable';
        }

        this._uptimeItem._faceplateValueLabel.text = uptime || 'Unavailable';
    }

    _startStatusRefresh() {
        if (this._statusRefreshId)
            return;

        this._statusRefreshId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._syncSystemStatus();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopStatusRefresh() {
        if (!this._statusRefreshId)
            return;

        GLib.source_remove(this._statusRefreshId);
        this._statusRefreshId = 0;
    }

    _readMemoryInfo() {
        try {
            const [ok, contents] = GLib.file_get_contents('/proc/meminfo');

            if (!ok)
                return null;

            const text = TEXT_DECODER.decode(contents);
            const values = {};

            for (const line of text.split('\n')) {
                const match = /^(\w+):\s+(\d+)\skB$/.exec(line);

                if (match)
                    values[match[1]] = Number.parseInt(match[2], 10) * 1024;
            }

            return {
                memTotal: values.MemTotal || 0,
                memAvailable: values.MemAvailable || values.MemFree || 0,
                swapTotal: values.SwapTotal || 0,
                swapFree: values.SwapFree || 0,
            };
        } catch (error) {
            logError(error, 'Failed to read memory status');
            return null;
        }
    }

    _readCpuLoad() {
        try {
            const [ok, contents] = GLib.file_get_contents('/proc/loadavg');

            if (!ok)
                return null;

            const parts = TEXT_DECODER.decode(contents).trim().split(/\s+/);

            if (parts.length < 3)
                return null;

            return parts[0];
        } catch (error) {
            logError(error, 'Failed to read CPU load');
            return null;
        }
    }

    _readDiskInfo() {
        try {
            return this._readFilesystemUsage('/');
        } catch (error) {
            logError(error, 'Failed to read disk status');
            return null;
        }
    }

    _readFilesystemUsage(path) {
        const file = Gio.File.new_for_path(path);
        const info = file.query_filesystem_info(
            'filesystem::size,filesystem::free',
            null
        );
        const total = info.get_attribute_uint64('filesystem::size');
        const free = info.get_attribute_uint64('filesystem::free');

        return {
            total,
            used: total - free,
        };
    }

    _readUptime() {
        try {
            const [ok, contents] = GLib.file_get_contents('/proc/uptime');

            if (!ok)
                return null;

            const text = TEXT_DECODER.decode(contents);
            const seconds = Number.parseInt(text.split(' ')[0], 10);

            if (!Number.isFinite(seconds))
                return null;

            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);

            if (days > 0)
                return `${days}d ${hours}h`;

            if (hours > 0)
                return `${hours}h ${minutes}m`;

            return `${minutes}m`;
        } catch (error) {
            logError(error, 'Failed to read uptime');
            return null;
        }
    }

    _formatBytes(bytes) {
        if (!bytes)
            return '0 B';

        const gb = bytes / 1000 / 1000 / 1000;

        if (gb >= 1)
            return `${gb.toFixed(1)} GB`;

        const mb = bytes / 1000 / 1000;
        return `${mb.toFixed(0)} MB`;
    }

    destroy() {
        this._stopStatusRefresh();
        this._stopAppUsageTracking();

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

        if (this._menuOpenStateId) {
            this.menu.disconnect(this._menuOpenStateId);
            this._menuOpenStateId = 0;
        }

        if (this._buttonPressId) {
            this.disconnect(this._buttonPressId);
            this._buttonPressId = 0;
        }

        super.destroy();
    }
});

class AvatarExtension {
    constructor(uuid) {
        this._uuid = uuid;
        this._settings = null;
        this._indicator = null;
    }

    enable() {
        this._settings = ExtensionUtils.getSettings(SETTINGS_SCHEMA);
        this._indicator = new AvatarIndicator(this._settings);
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        this._settings = null;
    }
}

function init(meta) {
    return new AvatarExtension(meta.uuid);
}
